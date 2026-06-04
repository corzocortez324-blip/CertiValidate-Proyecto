/**
 * Tests unitarios puros de blockchain.service.js.
 * No requieren base de datos ni servidor — solo funciones puras de crypto.
 */
const { generateCertificateHash } = require('../src/services/blockchain.service')
const {
  registerHashOnBlockchain,
  verifyHashOnBlockchain,
} = require('../src/services/blockchain.service')

const CERT_BASE = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  estudiante_id: 'aaa00000-0000-0000-0000-000000000001',
  institucion_id: 'bbb00000-0000-0000-0000-000000000002',
  plantilla_id: 'ccc00000-0000-0000-0000-000000000003',
  codigo_unico: 'ABCD1234EFGH5678',
  estado: 'valido',
  fecha_emision: new Date('2026-01-15T10:00:00.000Z'),
}

describe('generateCertificateHash — estabilidad del hash', () => {
  it('produce el mismo hash para el mismo certificado (determinismo)', () => {
    const hash1 = generateCertificateHash(CERT_BASE)
    const hash2 = generateCertificateHash(CERT_BASE)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
    expect(/^[a-f0-9]{64}$/.test(hash1)).toBe(true)
  })

  it('produce hashes distintos para certificados distintos', () => {
    const otro = { ...CERT_BASE, id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' }
    expect(generateCertificateHash(CERT_BASE)).not.toBe(generateCertificateHash(otro))
  })

  it('el hash es estable independientemente del orden de propiedades del objeto', () => {
    const certA = { ...CERT_BASE, campo_extra: 'ignorado' }
    const certB = {
      fecha_emision: CERT_BASE.fecha_emision,
      plantilla_id: CERT_BASE.plantilla_id,
      id: CERT_BASE.id,
      estado: CERT_BASE.estado,
      codigo_unico: CERT_BASE.codigo_unico,
      institucion_id: CERT_BASE.institucion_id,
      estudiante_id: CERT_BASE.estudiante_id,
      otro_campo: 99,
    }
    expect(generateCertificateHash(certA)).toBe(generateCertificateHash(certB))
  })

  it('cambia el hash si cambia el estado del certificado', () => {
    const revocado = { ...CERT_BASE, estado: 'revocado' }
    expect(generateCertificateHash(CERT_BASE)).not.toBe(generateCertificateHash(revocado))
  })

  it('acepta fecha_emision como string ISO además de Date', () => {
    const certConString = { ...CERT_BASE, fecha_emision: '2026-01-15T10:00:00.000Z' }
    expect(generateCertificateHash(CERT_BASE)).toBe(generateCertificateHash(certConString))
  })
})

describe('registerHashOnBlockchain — modo mock', () => {
  it('retorna txHash con prefijo mock_tx_', async () => {
    const hash = generateCertificateHash(CERT_BASE)
    const result = await registerHashOnBlockchain(hash)

    expect(result.txHash).toMatch(/^mock_tx_/)
    expect(result.txHash).toContain(hash.substring(0, 16))
    expect(result.network).toBeDefined()
    expect(result.status).toBe('confirmado')
    expect(result.registeredAt).toBeInstanceOf(Date)
  })

  it('txHash incluye los primeros 16 caracteres del hash', async () => {
    const hash = generateCertificateHash(CERT_BASE)
    const result = await registerHashOnBlockchain(hash)

    expect(result.txHash.startsWith(`mock_tx_${hash.substring(0, 16)}`)).toBe(true)
  })
})

describe('verifyHashOnBlockchain — modo mock', () => {
  it('devuelve valid:true para un txHash generado por el mismo hash', async () => {
    const hash = generateCertificateHash(CERT_BASE)
    const { txHash } = await registerHashOnBlockchain(hash)

    const result = await verifyHashOnBlockchain(hash, txHash)

    expect(result.valid).toBe(true)
    expect(result.status).toBe('confirmado')
  })

  it('devuelve valid:false si el txHash no corresponde al hash', async () => {
    const hashCorrecto = generateCertificateHash(CERT_BASE)
    const hashFalso = generateCertificateHash({ ...CERT_BASE, id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' })
    const { txHash } = await registerHashOnBlockchain(hashFalso)

    const result = await verifyHashOnBlockchain(hashCorrecto, txHash)

    expect(result.valid).toBe(false)
  })

  it('devuelve valid:false si txHash es null', async () => {
    const hash = generateCertificateHash(CERT_BASE)
    const result = await verifyHashOnBlockchain(hash, null)

    expect(result.valid).toBe(false)
  })
})
