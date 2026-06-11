/**
 * Tests de integridad de certificados.
 * Verifica:
 * - Hash es consistente entre emisión y verificación
 * - Editar el estudiante después de emitir NO rompe la verificación (snapshot)
 * - El hash de verificación pública == el hash usado en blockchain
 * - Providers no implementados devuelven 501
 * - Multi-tenant security es enforced
 */
const request = require('supertest')
const app = require('../src/app')
const prisma = require('../src/utils/prisma')
const { computeCertificateHash } = require('../src/services/certificate-hash.service')
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

  it('editar el estudiante después de emitir NO rompe la verificación (snapshot frozen)', async () => {
    // Emitir un certificado con datos actuales del estudiante
    const estudianteSnap = await createTestEstudiante(instA.id, `SNAP_${UNIQUE}`)
    const plantillaSnap = await createTestPlantilla(instA.id, `SNAP_${UNIQUE}`)

    const certRes = await request(app)
      .post('/api/certificados/emitir')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        estudiante_id: estudianteSnap.id,
        institucion_id: instA.id,
        plantilla_id: plantillaSnap.id,
      })

    expect(certRes.status).toBe(201)
    const certEmitido = certRes.body.data

    // Modificar el nombre del estudiante en la tabla viva
    await prisma.estudiante.update({
      where: { id: estudianteSnap.id },
      data: { nombre: 'NombreModificado', apellido: 'ApellidoModificado' },
    })

    // La verificación debe seguir siendo válida porque usa el snapshot congelado
    const verifyRes = await request(app)
      .post('/api/certificados/verificar')
      .send({ hash: certEmitido.hash_sha256 })

    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.data.hash_verificado).toBe(true)
    expect(verifyRes.body.data.estado).toBe('valido')
  })

  it('hash de verificación pública == hash usado en blockchain (mismo computeCertificateHash)', async () => {
    // Emitir certificado nuevo
    const estudianteH = await createTestEstudiante(instA.id, `HASH_UNITY_${UNIQUE}`)
    const plantillaH = await createTestPlantilla(instA.id, `HASH_UNITY_${UNIQUE}`)

    const certRes = await request(app)
      .post('/api/certificados/emitir')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        estudiante_id: estudianteH.id,
        institucion_id: instA.id,
        plantilla_id: plantillaH.id,
      })

    expect(certRes.status).toBe(201)
    const certId = certRes.body.data.id

    // Leer el certificado completo (con snapshot fields) desde la BD
    const certDb = await prisma.certificado.findUnique({ where: { id: certId } })

    // El hash almacenado debe coincidir con computeCertificateHash sobre el snapshot
    const hashCanónico = computeCertificateHash({
      certificado_id: certDb.id,
      codigo_unico: certDb.codigo_unico,
      estudiante_id: certDb.estudiante_id,
      fecha_emision: certDb.fecha_emision,
      institucion_id: certDb.institucion_id,
      plantilla_id: certDb.plantilla_id,
      snapshot_apellido: certDb.snapshot_apellido,
      snapshot_documento: certDb.snapshot_documento,
      snapshot_email: certDb.snapshot_email,
      snapshot_institucion_nombre: certDb.snapshot_institucion_nombre,
      snapshot_nombre: certDb.snapshot_nombre,
      snapshot_plantilla_nombre: certDb.snapshot_plantilla_nombre,
    })

    expect(certDb.hash_sha256).toBe(hashCanónico)

    // generateCertificateHash (usado por blockchain) debe producir el mismo valor
    const hashBlockchain = generateCertificateHash(certDb)
    expect(hashBlockchain).toBe(certDb.hash_sha256)

    // Y la verificación pública debe confirmar el hash como válido
    const verifyRes = await request(app)
      .post('/api/certificados/verificar')
      .send({ hash: certDb.hash_sha256 })

    expect(verifyRes.status).toBe(200)
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
