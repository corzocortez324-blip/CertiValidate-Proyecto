const logger = require('./logger')

const registrarAuditoria = async (
  prisma,
  usuario_id,
  accion,
  entidad,
  entidad_id,
  valores_antes,
  valores_despues,
  ip,
  institucion_id = null,
) => {
  if (!usuario_id) {
    logger.warn('registrarAuditoria: usuario_id vacío, auditoría omitida')
    return
  }

  try {
    await prisma.auditoria.create({
      data: {
        usuario_id,
        accion,
        entidad,
        entidad_id,
        valores_antes: valores_antes || null,
        valores_despues: valores_despues || null,
        ip: ip || null,
        institucion_id: institucion_id || null,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error registrando auditoría')
  }
}

module.exports = {
  registrarAuditoria,
}
