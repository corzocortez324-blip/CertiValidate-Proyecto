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

let codigoUnico
let hashSHA256

beforeAll(async () => {
  // Crear datos mínimos para tener un certificado verificable
  const inst = await createTestInstitucion(`PUB_${UNIQUE}`)
  const user = await createTestUser(`pub_${UNIQUE}`)
  await linkUserToInstitucion(user.id, inst.id, 'admin')

  const estudiante = await createTestEstudiante(inst.id, `PUB_${UNIQUE}`)
  const plantilla = await createTestPlantilla(inst.id, `PUB_${UNIQUE}`)

  // Login para emitir el certificado
  const loginRes = await request(app).post('/api/auth/login').send({
    email: `__test__pub_${UNIQUE}@certivalidate.test`,
    password: 'TestPass123',
  })
  const token = loginRes.body.data.token

  const certRes = await request(app)
    .post('/api/certificados/emitir')
    .set('Authorization', `Bearer ${token}`)
    .send({ estudiante_id: estudiante.id, institucion_id: inst.id, plantilla_id: plantilla.id })

  codigoUnico = certRes.body.data.codigo_unico
  hashSHA256 = certRes.body.data.hash_sha256
})

afterAll(async () => {
  await cleanupTestData()
})

describe('POST /api/certificados/verificar (público)', () => {
  it('no requiere autenticación', async () => {
    const res = await request(app)
      .post('/api/certificados/verificar')
      .send({ codigo: codigoUnico })
    expect(res.status).toBe(200)
  })

  it('verifica por código único y retorna estado válido', async () => {
    const res = await request(app)
      .post('/api/certificados/verificar')
      .send({ codigo: codigoUnico })
    expect(res.status).toBe(200)
    expect(res.body.data.estado).toBe('valido')
    expect(res.body.data.codigo_unico).toBe(codigoUnico)
    expect(res.body.data.estudiante).toBeDefined()
    expect(res.body.data.institucion).toBeDefined()
  })

  it('verifica por hash SHA-256', async () => {
    const res = await request(app)
      .post('/api/certificados/verificar')
      .send({ hash: hashSHA256 })
    expect(res.status).toBe(200)
    expect(res.body.data.estado).toBe('valido')
  })

  it('retorna estado no_encontrado para código inexistente', async () => {
    const res = await request(app)
      .post('/api/certificados/verificar')
      .send({ codigo: 'CODIGOINEXISTENTE999' })
    expect(res.status).toBe(200)
    expect(res.body.data.estado).toBe('no_encontrado')
  })

  it('rechaza body vacío con 400', async () => {
    const res = await request(app).post('/api/certificados/verificar').send({})
    expect(res.status).toBe(400)
  })

  it('no expone datos sensibles del estudiante (solo nombre y apellido)', async () => {
    const res = await request(app)
      .post('/api/certificados/verificar')
      .send({ codigo: codigoUnico })
    const est = res.body.data.estudiante
    expect(est.documento).toBeUndefined()
    expect(est.email).toBeUndefined()
    expect(est.nombre).toBeDefined()
  })
})
