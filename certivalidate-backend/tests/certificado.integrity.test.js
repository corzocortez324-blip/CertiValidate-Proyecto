/**
 * Tests de integridad de certificados.
 * Verifica:
 * - Hash es consistente entre emisión y verificación
 * - Providers no implementados devuelven 501
 * - Multi-tenant security es enforced
 */
const request = require('supertest')
const app = require('../src/app')
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
let estudianteA
let estudianteB
let plantillaA
let plantillaB
let certificadoA

beforeAll(async () => {
  // Setup: dos instituciones
  instA = await createTestInstitucion(`HASH_A_${UNIQUE}`)
  instB = await createTestInstitucion(`HASH_B_${UNIQUE}`)

  const userA = await createTestUser(`hash_a_${UNIQUE}`)
  const userB = await createTestUser(`hash_b_${UNIQUE}`)

  await linkUserToInstitucion(userA.id, instA.id, 'admin')
  await linkUserToInstitucion(userB.id, instB.id, 'admin')

  const loginRes1 = await request(app)
    .post('/api/auth/login')
    .send({
      email: `__test__hash_a_${UNIQUE}@certivalidate.test`,
      password: 'TestPass123',
    })
  tokenA = loginRes1.body.data.token

  const loginRes2 = await request(app)
    .post('/api/auth/login')
    .send({
      email: `__test__hash_b_${UNIQUE}@certivalidate.test`,
      password: 'TestPass123',
    })
  tokenB = loginRes2.body.data.token

  estudianteA = await createTestEstudiante(instA.id, `HASH_A_${UNIQUE}`)
  estudianteB = await createTestEstudiante(instB.id, `HASH_B_${UNIQUE}`)
  plantillaA = await createTestPlantilla(instA.id, `HASH_A_${UNIQUE}`)
  plantillaB = await createTestPlantilla(instB.id, `HASH_B_${UNIQUE}`)

  // Emitir certificado en institución A
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

describe('Integridad de Hash', () => {
  it('hash calculado en emisión coincide con verificación por hash', async () => {
    // El hash devuelto en emisión debe coincidir cuando se verifica
    const verifyRes = await request(app)
      .post('/api/certificados/verificar')
      .send({ hash: certificadoA.hash_sha256 })

    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.data.estado).toBe('valido')
    expect(verifyRes.body.data.hash_verificado).toBe(true)
  })

  it('hash es verificable después de obtener certificado por ID', async () => {
    // El hash almacenado debe ser verificable
    const getRes = await request(app)
      .get(`/api/certificados/${certificadoA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)

    expect(getRes.status).toBe(200)
    const storedHash = getRes.body.data.hash_sha256

    // Verificar que ese hash es válido
    const verifyRes = await request(app)
      .post('/api/certificados/verificar')
      .send({ hash: storedHash })

    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.data.hash_verificado).toBe(true)
  })

  it('código único también verifica correctamente', async () => {
    const verifyRes = await request(app)
      .post('/api/certificados/verificar')
      .send({ codigo: certificadoA.codigo_unico })

    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.data.estado).toBe('valido')
    expect(verifyRes.body.data.hash_verificado).toBe(true)
  })
})

describe('Providers No Implementados', () => {
  it('provider graphql devuelve 501 Not Implemented', async () => {
    const res = await request(app)
      .post('/api/certificados/emitir')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        documento_estudiante: '1234567890',
        estudiante_id: estudianteA.id,
        institucion_id: instA.id,
        plantilla_id: plantillaA.id,
        provider: 'graphql',
      })

    expect(res.status).toBe(501)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBeDefined()
  })

  it('provider supabase-direct devuelve 501 Not Implemented', async () => {
    const res = await request(app)
      .post('/api/certificados/emitir')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        documento_estudiante: '1234567890',
        estudiante_id: estudianteA.id,
        institucion_id: instA.id,
        plantilla_id: plantillaA.id,
        provider: 'supabase-direct',
      })

    expect(res.status).toBe(501)
  })

  it('provider oracle devuelve 501 Not Implemented', async () => {
    const res = await request(app)
      .post('/api/certificados/emitir')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        documento_estudiante: '1234567890',
        estudiante_id: estudianteA.id,
        institucion_id: instA.id,
        plantilla_id: plantillaA.id,
        provider: 'oracle',
      })

    expect(res.status).toBe(501)
  })

  it('provider no válido devuelve 501', async () => {
    const res = await request(app)
      .post('/api/certificados/emitir')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        documento_estudiante: '1234567890',
        estudiante_id: estudianteA.id,
        institucion_id: instA.id,
        plantilla_id: plantillaA.id,
        provider: 'non-existent-provider',
      })

    expect(res.status).toBe(501)
  })
})

describe('Seguridad Multi-Tenant de Certificados', () => {
  it('usuario B no puede ver certificado de institución A', async () => {
    const res = await request(app)
      .get(`/api/certificados/${certificadoA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(res.status).toBe(403)
  })

  it('usuario B no puede descargar certificado de institución A', async () => {
    const res = await request(app)
      .get(`/api/certificados/descargar/${certificadoA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(res.status).toBe(403)
  })

  it('usuario B no puede revocar certificado de institución A', async () => {
    const res = await request(app)
      .post(`/api/certificados/${certificadoA.id}/revocar`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ motivo_codigo: 'ERROR_EMISION' })

    expect(res.status).toBe(403)
  })

  it('usuario A puede revocar su propio certificado', async () => {
    // Revocar el certificado
    const revokeRes = await request(app)
      .post(`/api/certificados/${certificadoA.id}/revocar`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ motivo_codigo: 'ERROR_EMISION' })

    expect(revokeRes.status).toBe(200)
    expect(revokeRes.body.data.estado).toBe('revocado')
  })

  it('certificado revocado no se verifica como válido', async () => {
    // Ya fue revocado en el test anterior
    const verifyRes = await request(app)
      .post('/api/certificados/verificar')
      .send({ codigo: certificadoA.codigo_unico })

    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.data.estado).toBe('revocado')
  })
})
