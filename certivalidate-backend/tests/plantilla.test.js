const request = require('supertest')
const app = require('../src/app')
const prisma = require('../src/utils/prisma')

const {
  cleanupTestData,
  createTestUser,
  createTestInstitucion,
  linkUserToInstitucion,
  createTestPlantilla,
} = require('./helpers/db')

const BASE = '/api/plantillas'
const BASE_AUTH = '/api/auth'
const UNIQUE = Date.now()

let tokenAdmin
let adminUser
let instFixture
let plantillaSinCerts
let plantillaConCerts
let plantillaYaInactiva

beforeAll(async () => {
  adminUser = await createTestUser(`plant_admin_${UNIQUE}`)
  instFixture = await createTestInstitucion(`plant_inst_${UNIQUE}`)
  await linkUserToInstitucion(adminUser.id, instFixture.id, 'admin')

  plantillaSinCerts = await createTestPlantilla(instFixture.id, `sin_certs_${UNIQUE}`)
  plantillaConCerts = await createTestPlantilla(instFixture.id, `con_certs_${UNIQUE}`)
  plantillaYaInactiva = await prisma.plantillaCertificado.create({
    data: {
      institucion_id: instFixture.id,
      nombre: `__test__Plantilla inactiva ${UNIQUE}`,
      template_html: '<p>Inactiva</p>',
      version: 1,
      activa: false,
    },
  })

  const estudianteTest = await prisma.estudiante.create({
    data: {
      institucion_id: instFixture.id,
      nombre: 'Test',
      apellido: `Estudiante ${UNIQUE}`,
      documento: `TDOC${UNIQUE}`,
    },
  })

  await prisma.certificado.create({
    data: {
      estudiante_id: estudianteTest.id,
      institucion_id: instFixture.id,
      plantilla_id: plantillaConCerts.id,
      codigo_unico: `TEST-CERT-${UNIQUE}`,
      estado: 'valido',
      fecha_emision: new Date(),
    },
  })

  tokenAdmin = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: adminUser.email, password: 'TestPass123' })
  ).body.data.token
})

afterAll(async () => {
  await cleanupTestData()
})

describe('DELETE /api/plantillas/:id (archivar)', () => {
  it('retorna 400 para id no UUID', async () => {
    const res = await request(app)
      .delete(`${BASE}/plant-001`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(400)
  })

  it('retorna 400 para otro id no UUID', async () => {
    const res = await request(app)
      .delete(`${BASE}/no-es-uuid`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(400)
  })

  it('retorna 404 para UUID inexistente', async () => {
    const res = await request(app)
      .delete(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(404)
  })

  it('retorna 409 si la plantilla tiene certificados asociados', async () => {
    const res = await request(app)
      .delete(`${BASE}/${plantillaConCerts.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })

  it('archiva correctamente una plantilla sin certificados', async () => {
    const res = await request(app)
      .delete(`${BASE}/${plantillaSinCerts.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.activa).toBe(false)
  })

  it('es idempotente — archivar una plantilla ya inactiva devuelve 200', async () => {
    const res = await request(app)
      .delete(`${BASE}/${plantillaYaInactiva.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(200)
    expect(res.body.data.activa).toBe(false)
  })

  it('rechaza sin token con 401', async () => {
    const res = await request(app).delete(`${BASE}/${plantillaSinCerts.id}`)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/plantillas (listar)', () => {
  it('admin lista plantillas activas de su institución', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(200)
    expect(res.body.data.data).toBeInstanceOf(Array)
    expect(res.body.data.meta).toMatchObject({
      total: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
      totalPages: expect.any(Number),
    })
  })
})

describe('GET /api/plantillas/:id (obtener por id)', () => {
  it('retorna 400 para id no UUID', async () => {
    const res = await request(app)
      .get(`${BASE}/plant-001`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(400)
  })

  it('retorna 404 para UUID inexistente', async () => {
    const res = await request(app)
      .get(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(404)
  })
})
