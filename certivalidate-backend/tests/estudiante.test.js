const request = require('supertest')
const app = require('../src/app')
const {
  cleanupTestData,
  createTestUser,
  createTestInstitucion,
  linkUserToInstitucion,
  createTestEstudiante,
} = require('./helpers/db')

const BASE = '/api/estudiantes'
const BASE_AUTH = '/api/auth'
const UNIQUE = Date.now()

let token
let tokenSinPermiso
let inst
let estudianteFixture

beforeAll(async () => {
  inst = await createTestInstitucion(`est_${UNIQUE}`)

  const user = await createTestUser(`est_admin_${UNIQUE}`)
  await linkUserToInstitucion(user.id, inst.id, 'admin')

  await createTestUser(`est_noperm_${UNIQUE}`)

  token = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: `__test__est_admin_${UNIQUE}@certivalidate.test`, password: 'TestPass123' })
  ).body.data.token

  tokenSinPermiso = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: `__test__est_noperm_${UNIQUE}@certivalidate.test`, password: 'TestPass123' })
  ).body.data.token

  estudianteFixture = await createTestEstudiante(inst.id, `fix_${UNIQUE}`)
})

afterAll(async () => {
  await cleanupTestData()
})

describe('POST /api/estudiantes (crear)', () => {
  it('crea un estudiante correctamente y retorna 201', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        institucion_id: inst.id,
        nombre: 'Ana',
        apellido: 'García',
        documento: `DOC${UNIQUE}`,
        email: `ana_${UNIQUE}@test.com`,
      })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.documento).toBe(`DOC${UNIQUE}`)
    expect(res.body.data.nombre).toBe('Ana')
  })

  it('rechaza body sin campos obligatorios con 400', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ institucion_id: inst.id, nombre: 'Solo nombre' })
    expect(res.status).toBe(400)
  })

  it('rechaza sin permiso (usuario sin institución) con 403', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${tokenSinPermiso}`)
      .send({
        institucion_id: inst.id,
        nombre: 'Ana',
        apellido: 'García',
        documento: `DOC_NP_${UNIQUE}`,
      })
    expect(res.status).toBe(403)
  })

  it('rechaza request sin token con 401', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ institucion_id: inst.id, nombre: 'Ana', apellido: 'G', documento: 'X' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/estudiantes (listar)', () => {
  it('retorna shape { data: [], meta: { total, page, limit, totalPages } }', async () => {
    const res = await request(app).get(BASE).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.data).toBeInstanceOf(Array)
    expect(res.body.data.meta).toMatchObject({
      total: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
      totalPages: expect.any(Number),
    })
  })

  it('respeta query param limit=1', async () => {
    const res = await request(app).get(`${BASE}?limit=1`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.data.length).toBeLessThanOrEqual(1)
    expect(res.body.data.meta.limit).toBe(1)
  })

  it('incluye el estudianteFixture en los resultados', async () => {
    const res = await request(app).get(BASE).set('Authorization', `Bearer ${token}`)
    const ids = res.body.data.data.map((e) => e.id)
    expect(ids).toContain(estudianteFixture.id)
  })

  it('rechaza sin permiso con 403', async () => {
    const res = await request(app).get(BASE).set('Authorization', `Bearer ${tokenSinPermiso}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/estudiantes/:id (obtener por id)', () => {
  it('retorna el estudiante por ID', async () => {
    const res = await request(app)
      .get(`${BASE}/${estudianteFixture.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(estudianteFixture.id)
    expect(res.body.data.nombre).toBe(estudianteFixture.nombre)
  })

  it('retorna 404 para id inexistente', async () => {
    const res = await request(app)
      .get(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('rechaza sin permiso con 403', async () => {
    const res = await request(app)
      .get(`${BASE}/${estudianteFixture.id}`)
      .set('Authorization', `Bearer ${tokenSinPermiso}`)
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/estudiantes/:id (actualizar)', () => {
  it('actualiza el nombre del estudiante', async () => {
    const res = await request(app)
      .put(`${BASE}/${estudianteFixture.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Ana María' })
    expect(res.status).toBe(200)
    expect(res.body.data.nombre).toBe('Ana María')
    expect(res.body.data.id).toBe(estudianteFixture.id)
  })

  it('retorna 404 para id inexistente', async () => {
    const res = await request(app)
      .put(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Fantasma' })
    expect(res.status).toBe(404)
  })

  it('rechaza sin permiso con 403', async () => {
    const res = await request(app)
      .put(`${BASE}/${estudianteFixture.id}`)
      .set('Authorization', `Bearer ${tokenSinPermiso}`)
      .send({ nombre: 'Hackeado' })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/estudiantes/:id (eliminar)', () => {
  let estudianteParaEliminar

  beforeAll(async () => {
    estudianteParaEliminar = await createTestEstudiante(inst.id, `del_${UNIQUE}`)
  })

  it('elimina el estudiante correctamente', async () => {
    const res = await request(app)
      .delete(`${BASE}/${estudianteParaEliminar.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('retorna 404 para estudiante inexistente', async () => {
    const res = await request(app)
      .delete(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('rechaza sin permiso con 403', async () => {
    const res = await request(app)
      .delete(`${BASE}/${estudianteFixture.id}`)
      .set('Authorization', `Bearer ${tokenSinPermiso}`)
    expect(res.status).toBe(403)
  })
})
