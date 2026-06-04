const { sendSuccess, sendError } = require('../utils/response.utils')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const {
  generateCertificateHash,
  registerHashOnBlockchain,
  verifyHashOnBlockchain,
} = require('../services/blockchain.service')

/**
 * POST /api/certificados/:id/blockchain/register
 * Registra el hash SHA-256 del certificado en blockchain.
 * Requiere autenticación y que el certificado pertenezca a una institución autorizada.
 */
const registerCertificateOnBlockchain = async (req, res) => {
  try {
    const { id } = req.params
    const institucionIds = req.institucionIds || []

    const cert = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
    })

    if (!cert) {
      return sendError(res, 'Certificado no encontrado', 404)
    }

    if (!institucionIds.includes(cert.institucion_id)) {
      return sendError(
        res,
        'No autorizado para registrar este certificado en blockchain',
        403,
      )
    }

    const existente = await prisma.blockchainTransaccion.findFirst({
      where: {
        certificado_id: id,
        estado: { not: 'fallido' },
      },
    })

    if (existente) {
      return sendError(
        res,
        'El certificado ya fue registrado en blockchain',
        409,
      )
    }

    const hash = generateCertificateHash(cert)
    const resultado = await registerHashOnBlockchain(hash)

    const transaccion = await prisma.blockchainTransaccion.create({
      data: {
        certificado_id: id,
        hash,
        tx_hash: resultado.txHash,
        red: resultado.network,
        estado: resultado.status,
        confirmado_en: resultado.registeredAt,
      },
    })

    logger.info(
      {
        certificado_id: id,
        txHash: resultado.txHash,
        network: resultado.network,
        requestId: req.requestId,
      },
      '[BlockchainController] Certificado registrado en blockchain',
    )

    return sendSuccess(
      res,
      {
        certificado_id: id,
        hash,
        tx_hash: resultado.txHash,
        network: resultado.network,
        status: resultado.status,
        registered_at: resultado.registeredAt,
        transaccion_id: transaccion.id,
      },
      'Certificado registrado en blockchain correctamente',
      201,
    )
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode)
    }

    logger.error(
      { err: error, requestId: req.requestId },
      'Error en registerCertificateOnBlockchain',
    )

    return sendError(res, 'Error al registrar certificado en blockchain', 500)
  }
}

/**
 * GET /api/certificados/:id/blockchain/verify
 * Verifica la integridad del certificado comparando el hash local con el registrado en blockchain.
 */
const verifyCertificateBlockchain = async (req, res) => {
  try {
    const { id } = req.params
    const institucionIds = req.institucionIds || []

    const cert = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
    })

    if (!cert) {
      return sendError(res, 'Certificado no encontrado', 404)
    }

    if (!institucionIds.includes(cert.institucion_id)) {
      return sendError(
        res,
        'No autorizado para verificar este certificado en blockchain',
        403,
      )
    }

    const transaccion = await prisma.blockchainTransaccion.findFirst({
      where: { certificado_id: id },
      orderBy: { created_at: 'desc' },
    })

    if (!transaccion) {
      return sendSuccess(
        res,
        {
          valid: false,
          certificado_id: id,
          mensaje: 'El certificado no ha sido registrado en blockchain',
        },
        'Sin registro blockchain',
        200,
      )
    }

    const hashLocal = generateCertificateHash(cert)
    const hashCoincide = hashLocal === transaccion.hash

    const verificacion = await verifyHashOnBlockchain(
      hashLocal,
      transaccion.tx_hash,
    )

    const valid = hashCoincide && verificacion.valid

    let mensaje
    if (valid) {
      mensaje = 'Integridad verificada: el certificado no ha sido alterado'
    } else if (hashCoincide) {
      mensaje =
        'Hash íntegro pero transacción no verificada en la red blockchain'
    } else {
      mensaje =
        'Integridad comprometida: el hash del certificado no coincide con el registrado en blockchain'
    }

    return sendSuccess(
      res,
      {
        valid,
        certificado_id: id,
        hash_local: hashLocal,
        hash_registrado: transaccion.hash,
        tx_hash: transaccion.tx_hash,
        network: transaccion.red,
        status: transaccion.estado,
        mensaje,
      },
      'Verificación blockchain completada',
      200,
    )
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode)
    }

    logger.error(
      { err: error, requestId: req.requestId },
      'Error en verifyCertificateBlockchain',
    )

    return sendError(res, 'Error al verificar certificado en blockchain', 500)
  }
}

module.exports = {
  registerCertificateOnBlockchain,
  verifyCertificateBlockchain,
}
