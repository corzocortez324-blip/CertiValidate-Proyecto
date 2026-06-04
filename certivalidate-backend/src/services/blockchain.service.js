const crypto = require('crypto')
const logger = require('../utils/logger')

const BLOCKCHAIN_ENABLED = process.env.BLOCKCHAIN_ENABLED === 'true'
const BLOCKCHAIN_NETWORK = process.env.BLOCKCHAIN_NETWORK || 'mock'

/**
 * Genera un hash SHA-256 estable del certificado usando JSON ordenado.
 * Incluye certificado_id (disponible post-creación) para anclaje blockchain.
 */
const generateCertificateHash = (certificado) => {
  const data = {
    certificado_id: certificado.id,
    codigo_unico: certificado.codigo_unico,
    estado: certificado.estado,
    estudiante_id: certificado.estudiante_id,
    fecha_emision:
      certificado.fecha_emision instanceof Date
        ? certificado.fecha_emision.toISOString()
        : String(certificado.fecha_emision),
    institucion_id: certificado.institucion_id,
    plantilla_id: certificado.plantilla_id,
  }

  const sorted = Object.fromEntries(
    Object.keys(data)
      .sort()
      .map((k) => [k, data[k]]),
  )

  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}

/**
 * Registra un hash en blockchain.
 * En modo mock (BLOCKCHAIN_ENABLED != true) simula la transacción.
 * Estructura lista para conectar con un contrato EVM real (Polygon, Sepolia, etc.).
 */
const registerHashOnBlockchain = async (hash) => {
  if (!BLOCKCHAIN_ENABLED) {
    const txHash = `mock_tx_${hash.substring(0, 16)}_${Date.now()}`

    logger.info(
      { hash, txHash, network: BLOCKCHAIN_NETWORK, mode: 'mock' },
      '[BlockchainService] Registro simulado en blockchain',
    )

    return {
      txHash,
      network: BLOCKCHAIN_NETWORK,
      status: 'confirmado',
      registeredAt: new Date(),
    }
  }

  // TODO: integrar contrato EVM real
  // const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL)
  // const wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider)
  // const contract = new ethers.Contract(process.env.BLOCKCHAIN_CONTRACT_ADDRESS, ABI, wallet)
  // const tx = await contract.registerHash(hash)
  // await tx.wait()
  // return { txHash: tx.hash, network: BLOCKCHAIN_NETWORK, status: 'confirmado', registeredAt: new Date() }

  const err = new Error(
    'Integración blockchain real no implementada. Configure BLOCKCHAIN_ENABLED=false para usar modo mock.',
  )
  err.statusCode = 501
  throw err
}

/**
 * Verifica que el hash siga siendo válido contra la transacción registrada.
 * En modo mock comprueba la estructura del txHash simulado.
 */
const verifyHashOnBlockchain = async (hash, txHash) => {
  if (!BLOCKCHAIN_ENABLED) {
    const valid =
      Boolean(txHash) && txHash.startsWith(`mock_tx_${hash.substring(0, 16)}`)

    logger.info(
      { hash, txHash, valid, network: BLOCKCHAIN_NETWORK, mode: 'mock' },
      '[BlockchainService] Verificación simulada en blockchain',
    )

    return {
      valid,
      network: BLOCKCHAIN_NETWORK,
      status: valid ? 'confirmado' : 'no_encontrado',
    }
  }

  // TODO: consultar contrato EVM real para validar el hash on-chain
  const err = new Error(
    'Verificación blockchain real no implementada. Configure BLOCKCHAIN_ENABLED=false para usar modo mock.',
  )
  err.statusCode = 501
  throw err
}

module.exports = {
  generateCertificateHash,
  registerHashOnBlockchain,
  verifyHashOnBlockchain,
}
