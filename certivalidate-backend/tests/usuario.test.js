const request = require('supertest')
const app = require('../src/app')
const prisma = require('../src/utils/prisma')

const {
  cleanupTestData,
  createTestUser,
  createTestInstitucion,
  linkUserToInstitucion,
} = require('./helpers/db')

const BASE = '/api/usuarios'
const BASE_AUTH = '/api/auth'
const UNIQUE = Date.now()

let tokenAdmin
let tokenEditor
let tokenLector
let adminUser
let usuarioTarget
let instFixture

beforeAll(async () => {
  adminUser = await createTestUser(`usr_admin_${UNIQUE}`)
  instFixture = await createTestInstitucion(`usr_inst_${UNIQUE}`)
  await linkUserToInstitucion(adminUser.id, instFixture.id, 'admin')

  usuarioTarget = await createTestUser(`usr_target_${UNIQUE}`)
  await linkUserToInstitucion(usuarioTarget.id, instFixture.id, 'lector')

  const editorUser = await createTestUser(`usr_editor_${UNIQUE}`)
  await linkUserToInstitucion(editorUser.id, instFixture.id, 'editor')

  const lectorUser = await createTestUser(`usr_lector2_${UNIQUE}`)
  await linkUserToInstitucion(lectorUser.id, instFixture.id, 'lector')

  tokenAdmin = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: adminUser.email, password: 'TestPass123' })
  ).body.data.token

  tokenEditor = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: editorUser.email, password: 'TestPass123' })
  ).body.data.token

  tokenLector = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: lectorUser.email, password: 'TestPass123' })
  ).body.data.token
})

afterAll(async () => {
  await cleanupTestData()
})

describe('GET /api/usuarios (listar)', () => {
  it('admin obtiene lista de usuarios con campo rol definido', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.usuarios).toBeInstanceOf(Array)
    const target = res.body.data.usuarios.find((u) => u.id === usuarioTarget.id)
    expect(target).toBeDefined()
    expect(target.rol).toBeDefined()
  })

  it('rechaza sin token con 401', async () => {
    const res = await request(app).get(BASE)
    expect(res.status).toBe(401)
  })

  it('editor no puede listar usuarios (403)', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${tokenEditor}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/usuarios/:id (obtener por id)', () => {
  it('admin obtiene usuario con rol correcto (lector inicial)', async () => {
    const res = await request(app)
      .get(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(usuarioTarget.id)
    expect(res.body.data.rol).toBe('lector')
  })

  it('retorna 400 para id no UUID', async () => {
    const res = await request(app)
      .get(`${BASE}/no-es-uuid`)
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

describe('PUT /api/usuarios/:id — asignación de roles', () => {
  it('admin asigna rol editor y respuesta incluye rol: editor', async () => {
    const res = await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'editor' })

    expect(res.status).toBe(200)
    expect(res.body.data.rol).toBe('editor')
  })

  it('el cambio de rol persiste — GET devuelve rol actualizado', async () => {
    await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'admin' })

    const res = await request(app)
      .get(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    expect(res.status).toBe(200)
    expect(res.body.data.rol).toBe('admin')
  })

  it('GET /usuarios lista devuelve rol actualizado tras el cambio', async () => {
    await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'editor' })

    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${tokenAdmin}`)

    const target = res.body.data.usuarios.find((u) => u.id === usuarioTarget.id)
    expect(target).toBeDefined()
    expect(target.rol).toBe('editor')
  })

  it('admin asigna rol lector correctamente', async () => {
    const res = await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'lector' })

    expect(res.status).toBe(200)
    expect(res.body.data.rol).toBe('lector')
  })

  it('admin asigna rol admin correctamente', async () => {
    const res = await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'admin' })

    expect(res.status).toBe(200)
    expect(res.body.data.rol).toBe('admin')
  })

  it('rol inválido "docente" devuelve 400 con mensaje claro', async () => {
    const res = await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'docente' })

    expect(res.status).toBe(400)
    expect(JSON.stringify(res.body)).toContain('Roles permitidos')
  })

  it('rol inválido "viewer" devuelve 400', async () => {
    const res = await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'viewer' })

    expect(res.status).toBe(400)
  })

  it('rol inválido "validador" devuelve 400', async () => {
    const res = await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'validador' })

    expect(res.status).toBe(400)
  })

  it('editor no puede cambiar roles (403)', async () => {
    const res = await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenEditor}`)
      .send({ rol: 'lector' })

    expect(res.status).toBe(403)
  })

  it('lector no puede cambiar roles (403)', async () => {
    const res = await request(app)
      .put(`${BASE}/${usuarioTarget.id}`)
      .set('Authorization', `Bearer ${tokenLector}`)
      .send({ rol: 'lector' })

    expect(res.status).toBe(403)
  })

  it('retorna 400 para id no UUID', async () => {
    const res = await request(app)
      .put(`${BASE}/no-es-uuid`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'editor' })

    expect(res.status).toBe(400)
  })
})
