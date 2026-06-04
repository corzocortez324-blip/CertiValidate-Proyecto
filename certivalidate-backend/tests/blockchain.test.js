/**
 * Tests de integración blockchain.
 * Verifica:
 * - Generación de hash estable y determinista
 * - Registro mock exitoso
 * - Verificación de integridad exitosa
 * - Error si el certificado no existe
 * - Error si el usuario intenta acceder a certificado de otra institución
 * - Error 409 si el certificado ya fue registrado en blockchain
 */
const request = require('supertest')
const app = require('../src/app')
const { generateCertificateHash } = require('../src/services/blockchain.service')
const {
  cleanupTestData,
  createTestUser,
  createTestInstitucion,
  linkUserToInstitucion,
  createTestEstudiante,
  createTestPlantilla,
} = require('./helpers/db')

const UNIQUE = Date.now()
let tokenA
let tokenB
let instA
let instB
let certificadoA

beforeAll(async () => {
  instA = await createTestInstitucion(`BC_A_${UNIQUE}`)
  instB = await createTestInstitucion(`BC_B_${UNIQUE}`)

  const userA = await createTestUser(`bc_a_${UNIQUE}`)
  const userB = await createTestUser(`bc_b_${UNIQUE}`)

  await linkUserToInstitucion(userA.id, instA.id, 'admin')
  await linkUserToInstitucion(userB.id, instB.id, 'admin')

  const loginA = await request(app)
    .post('/api/auth/login')
    .send({ email: `__test__bc_a_${UNIQUE}@certivalidate.test`, password: 'TestPass123' })
  tokenA = loginA.body.data.token

  const loginB = await request(app)
    .post('/api/auth/login')
    .send({ email: `__test__bc_b_${UNIQUE}@certivalidate.test`, password: 'TestPass123' })
  tokenB = loginB.body.data.token

  const estudianteA = await createTestEstudiante(instA.id, `BC_A_${UNIQUE}`)
  const plantillaA = await createTestPlantilla(instA.id, `BC_A_${UNIQUE}`)

  const certRes = await request(app)
    .post('/api/certificados/emitir')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      estudiante_id: estudianteA.id,
      institucion_id: instA.id,
      plantilla_id: plantillaA.id,
    })
  certificadoA = certRes.body.data
})

afterAll(async () => {
  await cleanupTestData()
})

describe('generateCertificateHash — estabilidad del hash', () => {
  it('produce el mismo hash para el mismo certificado (determinismo)', () => {
    const cert = {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      estudiante_id: 'aaa00000-0000-0000-0000-000000000001',
      institucion_id: 'bbb00000-0000-0000-0000-000000000002',
      plantilla_id: 'ccc00000-0000-0000-0000-000000000003',
      codigo_unico: 'ABCD1234EFGH5678',
      estado: 'valido',
      fecha_emision: new Date('2026-01-15T10:00:00.000Z'),
    }

    const hash1 = generateCertificateHash(cert)
    const hash2 = generateCertificateHash(cert)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
    expect(/^[a-f0-9]{64}$/.test(hash1)).toBe(true)
  })

  it('produce hashes distintos para certificados distintos', () => {
    const base = {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      estudiante_id: 'aaa00000-0000-0000-0000-000000000001',
      institucion_id: 'bbb00000-0000-0000-0000-000000000002',
      plantilla_id: 'ccc00000-0000-0000-0000-000000000003',
      codigo_unico: 'ABCD1234EFGH5678',
      estado: 'valido',
      fecha_emision: new Date('2026-01-15T10:00:00.000Z'),
    }

    const otro = { ...base, id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' }

    expect(generateCertificateHash(base)).not.toBe(generateCertificateHash(otro))
  })

  it('hash es estable independientemente del orden de propiedades del objeto', () => {
    const campos = {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      estudiante_id: 'aaa00000-0000-0000-0000-000000000001',
      institucion_id: 'bbb00000-0000-0000-0000-000000000002',
      plantilla_id: 'ccc00000-0000-0000-0000-000000000003',
      codigo_unico: 'ABCD1234EFGH5678',
      estado: 'valido',
      fecha_emision: new Date('2026-01-15T10:00:00.000Z'),
    }

    const certA = { ...campos, extra_ignorada: 'x' }
    // Mismo certificado, propiedades mezcladas + extras que se ignoran
    const certB = {
      fecha_emision: campos.fecha_emision,
      plantilla_id: campos.plantilla_id,
      id: campos.id,
      estado: campos.estado,
      codigo_unico: campos.codigo_unico,
      institucion_id: campos.institucion_id,
      estudiante_id: campos.estudiante_id,
      otro_campo: 99,
    }

    expect(generateCertificateHash(certA)).toBe(generateCertificateHash(certB))
  })
})

describe('POST /api/certificados/:id/blockchain/register', () => {
  it('registra el certificado en blockchain en modo mock', async () => {
    const res = await request(app)
      .post(`/api/certificados/${certificadoA.id}/blockchain/register`)
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.hash).toBeDefined()
    expect(res.body.data.tx_hash).toMatch(/^mock_tx_/)
    expect(res.body.data.network).toBeDefined()
    expect(res.body.data.status).toBe('confirmado')
    expect(res.body.data.registered_at).toBeDefined()
    expect(res.body.data.transaccion_id).toBeDefined()
    expect(res.body.data.certificado_id).toBe(certificadoA.id)
  })

  it('devuelve 409 si el certificado ya fue registrado en blockchain', async () => {
    const res = await request(app)
      .post(`/api/certificados/${certificadoA.id}/blockchain/register`)
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })

  it('devuelve 404 si el certificado no existe', async () => {
    const res = await request(app)
      .post('/api/certificados/00000000-0000-0000-0000-000000000000/blockchain/register')
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('devuelve 403 si el usuario intenta registrar un certificado de otra institución', async () => {
    const res = await request(app)
      .post(`/api/certificados/${certificadoA.id}/blockchain/register`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('devuelve 401 sin token', async () => {
    const res = await request(app)
      .post(`/api/certificados/${certificadoA.id}/blockchain/register`)

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })
})

describe('GET /api/certificados/:id/blockchain/verify', () => {
  it('verifica correctamente la integridad del certificado registrado', async () => {
    const res = await request(app)
      .get(`/api/certificados/${certificadoA.id}/blockchain/verify`)
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.valid).toBe(true)
    expect(res.body.data.hash_local).toBeDefined()
    expect(res.body.data.hash_registrado).toBeDefined()
    expect(res.body.data.hash_local).toBe(res.body.data.hash_registrado)
    expect(res.body.data.tx_hash).toMatch(/^mock_tx_/)
    expect(res.body.data.network).toBeDefined()
    expect(res.body.data.status).toBe('confirmado')
    expect(res.body.data.mensaje).toContain('Integridad verificada')
  })

  it('devuelve valid:false con mensaje si el certificado no fue registrado en blockchain', async () => {
    const estudianteB = await require('./helpers/db').createTestEstudiante(instB.id, `BC_B2_${UNIQUE}`)
    const plantillaB = await require('./helpers/db').createTestPlantilla(instB.id, `BC_B2_${UNIQUE}`)

    const certRes = await request(app)
      .post('/api/certificados/emitir')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        estudiante_id: estudianteB.id,
        institucion_id: instB.id,
        plantilla_id: plantillaB.id,
      })
    const certB = certRes.body.data

    const res = await request(app)
      .get(`/api/certificados/${certB.id}/blockchain/verify`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.valid).toBe(false)
    expect(res.body.data.mensaje).toContain('no ha sido registrado en blockchain')
  })

  it('devuelve 404 si el certificado no existe', async () => {
    const res = await request(app)
      .get('/api/certificados/00000000-0000-0000-0000-000000000000/blockchain/verify')
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('devuelve 403 si el usuario intenta verificar un certificado de otra institución', async () => {
    const res = await request(app)
      .get(`/api/certificados/${certificadoA.id}/blockchain/verify`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('devuelve 401 sin token', async () => {
    const res = await request(app)
      .get(`/api/certificados/${certificadoA.id}/blockchain/verify`)

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })
})
