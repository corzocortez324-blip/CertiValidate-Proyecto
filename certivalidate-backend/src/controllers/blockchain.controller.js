const { sendSuccess, sendError } = require('../utils/response.utils')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const {
  generateCertificateHash,
  registerHashOnBlockchain,
  verifyHashOnBlockchain,
  getBlockchainMode,
  getExplorerUrl,
} = require('../services/blockchain.service')

/**
 * POST /api/certificados/:id/blockchain/register
 * Registra el hash SHA-256 del certificado en blockchain.
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
        mode: resultado.mode,
        contract_address: resultado.contractAddress,
        block_number: resultado.blockNumber,
        gas_used: resultado.gasUsed,
        explorer_url: resultado.explorerUrl,
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

    const hashLocal = generateCertificateHash(cert)

    if (!transaccion) {
      const mensaje = 'El certificado no ha sido registrado en blockchain'
      return sendSuccess(
        res,
        {
          valid: false,
          integrityStatus: 'pending',
          message: mensaje,
          hashLocal,
          hashRegistrado: null,
          txHash: null,
          network: null,
          status: null,
          registeredAt: null,
          mode: getBlockchainMode(),
          certificadoId: id,
          institucionId: cert.institucion_id,
          // backward-compatible fields
          hash_local: hashLocal,
          hash_registrado: null,
          tx_hash: null,
          mensaje,
        },
        'Sin registro blockchain',
        200,
      )
    }

    const hashCoincide = hashLocal === transaccion.hash
    const verificacion = await verifyHashOnBlockchain(hashLocal, transaccion.tx_hash)
    const valid = hashCoincide && verificacion.valid

    let integrityStatus
    let mensaje
    if (valid) {
      integrityStatus = 'valid'
      mensaje = 'Integridad verificada: el certificado no ha sido alterado'
    } else if (hashCoincide) {
      integrityStatus = 'pending'
      mensaje = 'Hash íntegro pero transacción no verificada en la red blockchain'
    } else {
      integrityStatus = 'invalid'
      mensaje =
        'Integridad comprometida: el hash del certificado no coincide con el registrado en blockchain'
    }

    return sendSuccess(
      res,
      {
        valid,
        integrityStatus,
        message: mensaje,
        hashLocal,
        hashRegistrado: transaccion.hash,
        txHash: transaccion.tx_hash,
        network: transaccion.red,
        status: transaccion.estado,
        registeredAt: transaccion.confirmado_en,
        mode: getBlockchainMode(),
        explorerUrl: verificacion.explorerUrl,
        certificadoId: id,
        institucionId: cert.institucion_id,
        // backward-compatible fields
        hash_local: hashLocal,
        hash_registrado: transaccion.hash,
        tx_hash: transaccion.tx_hash,
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

/**
 * GET /api/certificados/:id/blockchain/status
 * Resumen del estado blockchain de un certificado: si está registrado, integridad, red, etc.
 */
const getBlockchainStatus = async (req, res) => {
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
        'No autorizado para ver el estado blockchain de este certificado',
        403,
      )
    }

    const [transaccion, lastVerif] = await Promise.all([
      prisma.blockchainTransaccion.findFirst({
        where: { certificado_id: id },
        orderBy: { created_at: 'desc' },
      }),
      prisma.verificacionPublica.findFirst({
        where: { certificado_id: id },
        orderBy: { fecha: 'desc' },
      }),
    ])

    const lastVerificationAt = lastVerif?.fecha ?? null

    if (!transaccion) {
      return sendSuccess(
        res,
        {
          registered: false,
          status: null,
          network: null,
          txHash: null,
          registeredAt: null,
          lastVerificationAt,
          integrityStatus: 'pending',
          mode: getBlockchainMode(),
          certificadoId: id,
        },
        'Certificado no registrado en blockchain',
        200,
      )
    }

    const hashLocal = generateCertificateHash(cert)
    const hashCoincide = hashLocal === transaccion.hash

    let integrityStatus
    if (transaccion.estado === 'confirmado' && hashCoincide) {
      integrityStatus = 'valid'
    } else if (transaccion.estado === 'confirmado' && !hashCoincide) {
      integrityStatus = 'invalid'
    } else {
      integrityStatus = 'pending'
    }

    return sendSuccess(
      res,
      {
        registered: true,
        status: transaccion.estado,
        network: transaccion.red,
        txHash: transaccion.tx_hash,
        registeredAt: transaccion.confirmado_en ?? transaccion.created_at,
        lastVerificationAt,
        integrityStatus,
        mode: getBlockchainMode(),
        certificadoId: id,
      },
      'Estado blockchain obtenido',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en getBlockchainStatus',
    )
    return sendError(res, 'Error al obtener estado blockchain', 500)
  }
}

/**
 * GET /api/certificados/:id/blockchain/receipt
 * Comprobante blockchain listo para mostrar en frontend.
 * No incluye datos personales del estudiante ni claves privadas.
 */
const getBlockchainReceipt = async (req, res) => {
  try {
    const { id } = req.params
    const institucionIds = req.institucionIds || []

    const cert = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
      include: {
        institucion: { select: { id: true, nombre: true } },
      },
    })

    if (!cert) {
      return sendError(res, 'Certificado no encontrado', 404)
    }

    if (!institucionIds.includes(cert.institucion_id)) {
      return sendError(
        res,
        'No autorizado para obtener el comprobante blockchain de este certificado',
        403,
      )
    }

    const transaccion = await prisma.blockchainTransaccion.findFirst({
      where: { certificado_id: id, estado: { not: 'fallido' } },
      orderBy: { created_at: 'desc' },
    })

    if (!transaccion) {
      return sendSuccess(
        res,
        {
          certificadoId: id,
          codigoVerificacion: cert.codigo_unico,
          hash: null,
          txHash: null,
          network: null,
          status: 'no_registrado',
          registeredAt: null,
          mode: getBlockchainMode(),
          issuer: cert.institucion?.nombre ?? null,
          message: 'El certificado no ha sido registrado en blockchain',
        },
        'Sin registro blockchain',
        200,
      )
    }

    const message =
      transaccion.estado === 'confirmado'
        ? 'Certificado registrado y confirmado en blockchain'
        : 'Registro en blockchain pendiente de confirmación'

    return sendSuccess(
      res,
      {
        certificadoId: id,
        codigoVerificacion: cert.codigo_unico,
        hash: transaccion.hash,
        txHash: transaccion.tx_hash,
        network: transaccion.red,
        status: transaccion.estado,
        registeredAt: transaccion.confirmado_en ?? transaccion.created_at,
        mode: getBlockchainMode(),
        explorerUrl: getExplorerUrl(transaccion.tx_hash),
        issuer: cert.institucion?.nombre ?? null,
        message,
      },
      'Comprobante blockchain obtenido',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en getBlockchainReceipt',
    )
    return sendError(res, 'Error al obtener comprobante blockchain', 500)
  }
}

module.exports = {
  registerCertificateOnBlockchain,
  verifyCertificateBlockchain,
  getBlockchainStatus,
  getBlockchainReceipt,
}
