const request = require('supertest')
const app = require('../src/app')
const {
  cleanupTestData,
  createTestUser,
  createTestInstitucion,
  linkUserToInstitucion,
} = require('./helpers/db')

const BASE = '/api/instituciones'
const BASE_AUTH = '/api/auth'
const UNIQUE = Date.now()

let token
let tokenSinPermiso
let instFixture
let instParaDesactivar
let instCreada

beforeAll(async () => {
  const userAdmin = await createTestUser(`inst_admin_${UNIQUE}`)
  await createTestUser(`inst_noperm_${UNIQUE}`)

  instFixture = await createTestInstitucion(`inst_fix_${UNIQUE}`)
  instParaDesactivar = await createTestInstitucion(`inst_deact_${UNIQUE}`)

  await linkUserToInstitucion(userAdmin.id, instFixture.id, 'admin')
  await linkUserToInstitucion(userAdmin.id, instParaDesactivar.id, 'admin')

  token = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: `__test__inst_admin_${UNIQUE}@certivalidate.test`, password: 'TestPass123' })
  ).body.data.token

  tokenSinPermiso = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: `__test__inst_noperm_${UNIQUE}@certivalidate.test`, password: 'TestPass123' })
  ).body.data.token
})

afterAll(async () => {
  await cleanupTestData()
})

describe('POST /api/instituciones (crear)', () => {
  it('crea una institución y se vincula el usuario creador como admin', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: `__test__Inst_post_${UNIQUE}` })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.nombre).toBe(`__test__Inst_post_${UNIQUE}`)
    instCreada = res.body.data
  })

  it('rechaza body sin nombre con 400', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ dominio: 'sinombre.com' })
    expect(res.status).toBe(400)
  })

  it('rechaza request sin token con 401', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ nombre: `__test__Inst_noauth_${UNIQUE}` })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/instituciones (listar)', () => {
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

  it('incluye instFixture en los resultados', async () => {
    const res = await request(app).get(BASE).set('Authorization', `Bearer ${token}`)
    const ids = res.body.data.data.map((i) => i.id)
    expect(ids).toContain(instFixture.id)
  })

  it('respeta query param limit=1', async () => {
    const res = await request(app).get(`${BASE}?limit=1`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.data.length).toBeLessThanOrEqual(1)
    expect(res.body.data.meta.limit).toBe(1)
  })

  it('rechaza sin permiso (usuario sin institución) con 403', async () => {
    const res = await request(app).get(BASE).set('Authorization', `Bearer ${tokenSinPermiso}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/instituciones/:id (obtener por id)', () => {
  it('retorna la institución por ID con _count', async () => {
    const res = await request(app)
      .get(`${BASE}/${instFixture.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(instFixture.id)
    expect(res.body.data._count).toBeDefined()
  })

  it('rechaza acceso a institución ajena con 403', async () => {
    const res = await request(app)
      .get(`${BASE}/${instFixture.id}`)
      .set('Authorization', `Bearer ${tokenSinPermiso}`)
    expect(res.status).toBe(403)
  })

  it('retorna 403 para UUID inexistente (no está en institucionIds del usuario)', async () => {
    const res = await request(app)
      .get(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/instituciones/:id (actualizar)', () => {
  it('actualiza el nombre de la institución', async () => {
    const nuevoNombre = `__test__Inst_upd_${UNIQUE}`
    const res = await request(app)
      .put(`${BASE}/${instFixture.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: nuevoNombre })
    expect(res.status).toBe(200)
    expect(res.body.data.nombre).toBe(nuevoNombre)
  })

  it('retorna 404 para id inexistente (pasa auth, falla en DB)', async () => {
    const res = await request(app)
      .put(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Fantasma' })
    expect(res.status).toBe(404)
  })

  it('rechaza actualización de institución ajena con 403', async () => {
    const res = await request(app)
      .put(`${BASE}/${instFixture.id}`)
      .set('Authorization', `Bearer ${tokenSinPermiso}`)
      .send({ nombre: 'Hackeada' })
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/instituciones/:id/desactivar', () => {
  it('desactiva la institución correctamente', async () => {
    const res = await request(app)
      .patch(`${BASE}/${instParaDesactivar.id}/desactivar`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.activa).toBe(false)
  })

  it('es idempotente: desactivar una institución ya inactiva retorna 200', async () => {
    const res = await request(app)
      .patch(`${BASE}/${instParaDesactivar.id}/desactivar`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.activa).toBe(false)
  })

  it('rechaza desactivar institución ajena con 403', async () => {
    const res = await request(app)
      .patch(`${BASE}/${instParaDesactivar.id}/desactivar`)
      .set('Authorization', `Bearer ${tokenSinPermiso}`)
    expect(res.status).toBe(403)
  })
})
