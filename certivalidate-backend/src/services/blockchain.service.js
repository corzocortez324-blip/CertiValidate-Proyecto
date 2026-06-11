const crypto = require('crypto')
const logger = require('../utils/logger')

// Human-readable ABI matching CertiValidateRegistry.sol
const CERTIVALIDATE_ABI = [
  'function registerCertificate(bytes32 hash) external',
  'function verifyCertificate(bytes32 hash) external view returns (bool valid, address issuer, uint256 registeredAt)',
  'function getCertificate(bytes32 hash) external view returns (uint256 registeredAt, address issuer, bool exists)',
  'function certificateExists(bytes32 hash) external view returns (bool)',
]

/**
 * Returns the current blockchain operating mode.
 * BLOCKCHAIN_MODE takes precedence; falls back to BLOCKCHAIN_ENABLED for backward compat.
 */
const getBlockchainMode = () => {
  const mode = process.env.BLOCKCHAIN_MODE
  if (mode === 'real' || mode === 'mock') return mode
  return process.env.BLOCKCHAIN_ENABLED === 'true' ? 'real' : 'mock'
}

/**
 * Returns the Polygon Amoy explorer URL for a tx hash, or null in mock mode / missing hash.
 */
const getExplorerUrl = (txHash) => {
  if (!txHash || getBlockchainMode() !== 'real') return null
  const base = process.env.BLOCKCHAIN_EXPLORER_BASE_URL || 'https://amoy.polygonscan.com/tx/'
  return `${base}${txHash}`
}

/**
 * Returns the canonical SHA-256 hash for a certificate.
 *
 * New path  (snapshot_nombre present): delegates to computeCertificateHash using the
 *   frozen snapshot fields — produces the same value as cert.hash_sha256.
 * Legacy path (snapshot_nombre null):  falls back to the original JSON-with-IDs format
 *   so that certificates issued before the snapshot migration still match their stored
 *   BlockchainTransaccion.hash without being marked as tampered.
 */
const generateCertificateHash = (certificado) => {
  const { computeCertificateHash } = require('./certificate-hash.service')

  if (certificado.snapshot_nombre !== null && certificado.snapshot_nombre !== undefined) {
    return computeCertificateHash({
      certificado_id: certificado.id,
      codigo_unico: certificado.codigo_unico,
      estudiante_id: certificado.estudiante_id,
      fecha_emision: certificado.fecha_emision,
      institucion_id: certificado.institucion_id,
      plantilla_id: certificado.plantilla_id,
      snapshot_apellido: certificado.snapshot_apellido,
      snapshot_documento: certificado.snapshot_documento,
      snapshot_email: certificado.snapshot_email,
      snapshot_institucion_nombre: certificado.snapshot_institucion_nombre,
      snapshot_nombre: certificado.snapshot_nombre,
      snapshot_plantilla_nombre: certificado.snapshot_plantilla_nombre,
    })
  }

  // Legacy path: certificates issued before snapshot migration
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
 * Throws 503 if a required env var is missing, naming the missing variable.
 */
const requireEnvVar = (name) => {
  if (!process.env[name]) {
    const err = new Error(
      `${name} no configurada. Proporcione esta variable para usar BLOCKCHAIN_MODE=real.`,
    )
    err.statusCode = 503
    throw err
  }
}

/** Validates vars required for write (register) operations. */
const assertRegisterVars = () => {
  requireEnvVar('BLOCKCHAIN_RPC_URL')
  requireEnvVar('BLOCKCHAIN_PRIVATE_KEY')
  requireEnvVar('BLOCKCHAIN_CONTRACT_ADDRESS')
}

/** Validates vars required for read-only (verify) operations. Private key not needed. */
const assertVerifyVars = () => {
  requireEnvVar('BLOCKCHAIN_RPC_URL')
  requireEnvVar('BLOCKCHAIN_CONTRACT_ADDRESS')
}

/**
 * Maps ethers / RPC errors to user-facing errors with appropriate status codes.
 */
const wrapEthersError = (error, context) => {
  const msg = error?.message || ''

  if (error.code === 'INSUFFICIENT_FUNDS' || msg.includes('insufficient funds')) {
    const err = new Error('Fondos insuficientes en la wallet para pagar el gas de la transacción.')
    err.statusCode = 402
    return err
  }

  if (
    msg.includes('certificate already registered') ||
    msg.includes('already registered')
  ) {
    const err = new Error('El certificado ya está registrado en la blockchain.')
    err.statusCode = 409
    return err
  }

  if (
    error.code === 'NETWORK_ERROR' ||
    error.code === 'SERVER_ERROR' ||
    error.code === 'TIMEOUT' ||
    msg.includes('could not detect network') ||
    msg.includes('connection refused')
  ) {
    const err = new Error(
      'No se pudo conectar al RPC blockchain. Verifique BLOCKCHAIN_RPC_URL y el estado de la red.',
    )
    err.statusCode = 503
    return err
  }

  if (
    error.code === 'BAD_DATA' ||
    error.code === 'INVALID_ARGUMENT' ||
    msg.includes('invalid contract') ||
    msg.includes('call revert exception')
  ) {
    const err = new Error(
      'Contrato inválido o incompatible. Verifique BLOCKCHAIN_CONTRACT_ADDRESS.',
    )
    err.statusCode = 503
    return err
  }

  logger.error({ err: error }, `[BlockchainService] Error inesperado en ${context}`)
  const err = new Error(`Error al operar con blockchain: ${msg}`)
  err.statusCode = 500
  return err
}

/**
 * Registra un hash en blockchain.
 * - mock: simula la transacción sin red real.
 * - real: usa ethers.js v6 + Polygon Amoy + contrato CertiValidateRegistry.
 *
 * Retorna: { txHash, network, status, mode, contractAddress, blockNumber, gasUsed, explorerUrl, registeredAt }
 */
const registerHashOnBlockchain = async (hash) => {
  const mode = getBlockchainMode()
  const network = process.env.BLOCKCHAIN_NETWORK || (mode === 'real' ? 'polygon-amoy' : 'mock')

  if (mode !== 'real') {
    const txHash = `mock_tx_${hash.substring(0, 16)}_${Date.now()}`

    logger.info(
      { hash, txHash, network, mode: 'mock' },
      '[BlockchainService] Registro simulado en blockchain',
    )

    return {
      txHash,
      network,
      status: 'confirmado',
      mode: 'mock',
      contractAddress: null,
      blockNumber: null,
      gasUsed: null,
      explorerUrl: null,
      registeredAt: new Date(),
    }
  }

  // real mode
  assertRegisterVars()

  const { ethers } = require('ethers')
  const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS

  try {
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL)
    const wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider)
    const contract = new ethers.Contract(contractAddress, CERTIVALIDATE_ABI, wallet)

    // SHA-256 hex → bytes32 (0x + 64 hex chars)
    const hashBytes32 = `0x${hash}`

    const tx = await contract.registerCertificate(hashBytes32)
    const receipt = await tx.wait()

    logger.info(
      { hash, txHash: tx.hash, network, blockNumber: receipt.blockNumber, mode: 'real' },
      '[BlockchainService] Certificado registrado en blockchain real',
    )

    return {
      txHash: tx.hash,
      network,
      status: 'confirmado',
      mode: 'real',
      contractAddress,
      blockNumber: receipt.blockNumber ?? null,
      gasUsed: receipt.gasUsed != null ? receipt.gasUsed.toString() : null,
      explorerUrl: getExplorerUrl(tx.hash),
      registeredAt: new Date(),
    }
  } catch (error) {
    throw wrapEthersError(error, 'registerHashOnBlockchain')
  }
}

/**
 * Verifica que el hash esté registrado en blockchain.
 * - mock: comprueba la estructura del txHash simulado.
 * - real: consulta certificateExists() en el contrato (view, sin gas).
 *
 * Retorna: { valid, network, mode, contractAddress, txHash, explorerUrl, status }
 */
const verifyHashOnBlockchain = async (hash, txHash) => {
  const mode = getBlockchainMode()
  const network = process.env.BLOCKCHAIN_NETWORK || (mode === 'real' ? 'polygon-amoy' : 'mock')

  if (mode !== 'real') {
    const valid = Boolean(txHash) && txHash.startsWith(`mock_tx_${hash.substring(0, 16)}`)

    logger.info(
      { hash, txHash, valid, network, mode: 'mock' },
      '[BlockchainService] Verificación simulada en blockchain',
    )

    return {
      valid,
      network,
      mode: 'mock',
      contractAddress: null,
      txHash,
      explorerUrl: null,
      status: valid ? 'confirmado' : 'no_encontrado',
    }
  }

  // real mode
  assertVerifyVars()

  const { ethers } = require('ethers')
  const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS

  try {
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL)
    const contract = new ethers.Contract(contractAddress, CERTIVALIDATE_ABI, provider)

    const hashBytes32 = `0x${hash}`
    const exists = await contract.certificateExists(hashBytes32)

    logger.info(
      { hash, txHash, exists, network, mode: 'real' },
      '[BlockchainService] Verificación en blockchain real',
    )

    return {
      valid: exists,
      network,
      mode: 'real',
      contractAddress,
      txHash,
      explorerUrl: getExplorerUrl(txHash),
      status: exists ? 'confirmado' : 'no_encontrado',
    }
  } catch (error) {
    throw wrapEthersError(error, 'verifyHashOnBlockchain')
  }
}

module.exports = {
  generateCertificateHash,
  registerHashOnBlockchain,
  verifyHashOnBlockchain,
  getBlockchainMode,
  getExplorerUrl,
  CERTIVALIDATE_ABI,
}
