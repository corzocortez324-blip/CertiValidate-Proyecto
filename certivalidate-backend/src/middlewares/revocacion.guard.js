const prisma = require('../utils/prisma')
const { registrarAuditoria } = require('../utils/auditoria')
const { obtenerAccesosUsuario } = require('../utils/authorization')
const { getClientIp } = require('../utils/validators')
const logger = require('../utils/logger')

const deny = (res, message, status = 403) =>
  res.status(status).json({
    success: false,
    statusCode: status,
    message,
    timestamp: new Date().toISOString(),
  })

const logIntento = (prisma, usuarioId, certId, motivo, rol, institucionId, ip) =>
  registrarAuditoria(
    prisma,
    usuarioId,
    'INTENTO_REVOCACION_NO_AUTORIZADO',
    'Certificado',
    certId,
    null,
    JSON.stringify({ motivo, rol: rol || null }),
    ip,
    institucionId || null,
  )

/**
 * Verifica ownership multi-tenant antes de permitir la revocación:
 *
 *  admin  (rol 'admin' en la institución del certificado) → acceso dentro de su propia institución
 *  emisor (rol 'emisor' en la institución del certificado) → solo certificados que él mismo emitió
 *  sin acceso a la institución del certificado → 403 inmediato + registro en auditoría
 *  cualquier otro rol → 403 + registro en auditoría
 *
 * Adjunta req.certificado y req.nivelRevocacion para el controller.
 */
const revocacionGuard = async (req, res, next) => {
  const { id } = req.params
  const usuarioId = req.usuario?.id
  const ip = getClientIp(req)

  try {
    const cert = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
    })

    if (!cert) {
      return deny(res, 'Certificado no encontrado', 404)
    }

    const accesos = await obtenerAccesosUsuario(usuarioId)

    const accesoInstitucion = accesos.find(
      (a) => a.institucion_id === cert.institucion_id,
    )

    if (!accesoInstitucion) {
      await logIntento(
        prisma, usuarioId, id,
        'Sin acceso a la institución del certificado',
        null, cert.institucion_id, ip,
      )
      return deny(res, 'No autorizado para revocar certificados de esta institución')
    }

    const { rol } = accesoInstitucion

    if (rol === 'admin') {
      req.certificado = cert
      req.nivelRevocacion = 'admin'
      return next()
    }

    if (rol === 'emisor') {
      // Verifica que el emisor haya sido quien emitió el certificado
      const emision = await prisma.auditoria.findFirst({
        where: {
          accion: 'EMITIR_CERTIFICADO',
          entidad: 'Certificado',
          entidad_id: id,
          usuario_id: usuarioId,
        },
      })

      if (!emision) {
        await logIntento(
          prisma, usuarioId, id,
          'Emisor intentó revocar un certificado que no emitió',
          rol, cert.institucion_id, ip,
        )
        return deny(res, 'Solo puedes revocar certificados que tú mismo emitiste')
      }

      req.certificado = cert
      req.nivelRevocacion = 'emisor'
      return next()
    }

    // Roles sin permiso de revocación (lector, viewer, docente, editor)
    await logIntento(
      prisma, usuarioId, id,
      'Rol sin permiso de revocación',
      rol, cert.institucion_id, ip,
    )
    return deny(res, 'Tu rol no permite revocar certificados')
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en RevocacionGuard')
    return deny(res, 'Error al validar permisos de revocación', 500)
  }
}

module.exports = { revocacionGuard }
