const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const { registerHashOnBlockchain } = require('./blockchain.service')

// Tras este número de intentos fallidos la transacción pasa a 'fallido' y
// solo puede reintentarse creando un registro nuevo (CU-28).
const MAX_INTENTOS_BLOCKCHAIN = 3

/**
 * Envía a la red la transacción 'pendiente' indicada y persiste el resultado:
 * confirmada con su tx_hash, o un intento más (y 'fallido' al tercero).
 * Lanza el error de la red para que el llamador decida cómo informarlo.
 */
const enviarTransaccion = async (pendiente) => {
  let resultado
  try {
    resultado = await registerHashOnBlockchain(pendiente.hash)
  } catch (err) {
    const intentos = pendiente.intentos + 1
    const estado = intentos >= MAX_INTENTOS_BLOCKCHAIN ? 'fallido' : 'pendiente'
    await prisma.blockchainTransaccion.update({
      where: { id: pendiente.id },
      data: { intentos, estado, error_mensaje: String(err.message || err).slice(0, 500) },
    })
    logger.warn(
      { certificado_id: pendiente.certificado_id, intentos, estado },
      '[Blockchain] Intento de registro blockchain fallido',
    )
    throw err
  }

  const transaccion = await prisma.blockchainTransaccion.update({
    where: { id: pendiente.id },
    data: {
      tx_hash: resultado.txHash,
      red: resultado.network,
      estado: resultado.status,
      confirmado_en: resultado.registeredAt,
      error_mensaje: null,
    },
  })
  return { transaccion, resultado }
}

/**
 * Worker: reintenta las transacciones que quedaron 'pendiente' con intentos
 * disponibles. Devuelve cuántas se confirmaron y cuántas volvieron a fallar.
 */
const procesarTransaccionesPendientes = async ({ limite = 20 } = {}) => {
  const pendientes = await prisma.blockchainTransaccion.findMany({
    where: { estado: 'pendiente', intentos: { lt: MAX_INTENTOS_BLOCKCHAIN }, hash: { not: null } },
    orderBy: { created_at: 'asc' },
    take: limite,
  })

  const resumen = { procesadas: pendientes.length, confirmadas: 0, fallidas: 0 }
  for (const tx of pendientes) {
    try {
      await enviarTransaccion(tx)
      resumen.confirmadas++
    } catch {
      resumen.fallidas++
    }
  }
  if (pendientes.length > 0) logger.info(resumen, '[Blockchain] Worker de transacciones pendientes')
  return resumen
}

/** Inicia el worker periódico; devuelve una función para detenerlo. */
const iniciarWorkerBlockchain = (intervaloMs = Number(process.env.BLOCKCHAIN_WORKER_INTERVAL_MS) || 60000) => {
  const timer = setInterval(() => {
    procesarTransaccionesPendientes().catch((err) =>
      logger.error({ err }, '[Blockchain] Error en el worker de transacciones pendientes'),
    )
  }, intervaloMs)
  timer.unref?.()
  return () => clearInterval(timer)
}

module.exports = {
  MAX_INTENTOS_BLOCKCHAIN,
  enviarTransaccion,
  procesarTransaccionesPendientes,
  iniciarWorkerBlockchain,
}
