const request = require('supertest')
const app = require('../src/app')
const { cleanupTestData, TEST_PREFIX, createTestUser, enableTest2FA } = require('./helpers/db')

const BASE = '/api/auth'
const UNIQUE = Date.now()
const EMAIL = `${TEST_PREFIX}auth_${UNIQUE}@certivalidate.test`
const PASSWORD = 'TestPass123'

afterAll(async () => {
  await cleanupTestData()
})

describe('POST /api/auth/register', () => {
  it('registra un usuario nuevo correctamente', async () => {
    const res = await request(app).post(`${BASE}/register`).send({
      nombre: 'Test',
      apellido: 'Auth',
      email: EMAIL,
      password: PASSWORD,
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.email).toBe(EMAIL)
    expect(res.body.data.password_hash).toBeUndefined()
  })

  it('rechaza email duplicado con 409', async () => {
    const res = await request(app).post(`${BASE}/register`).send({
      nombre: 'Test',
      email: EMAIL,
      password: PASSWORD,
    })
    expect(res.status).toBe(409)
  })

  it('rechaza password débil sin mayúscula/número', async () => {
    const res = await request(app).post(`${BASE}/register`).send({
      nombre: 'Test',
      email: `${TEST_PREFIX}weak_${UNIQUE}@certivalidate.test`,
      password: 'solominusculas',
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  it('hace login y retorna access + refresh token', async () => {
    const res = await request(app).post(`${BASE}/login`).send({ email: EMAIL, password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.refreshToken).toBeDefined()
    expect(res.body.data.usuario.email).toBe(EMAIL)
  })

  it('rechaza credenciales incorrectas con 401', async () => {
    const res = await request(app).post(`${BASE}/login`).send({ email: EMAIL, password: 'WrongPass999' })
    expect(res.status).toBe(401)
  })

  it('rechaza email inexistente con 401', async () => {
    const res = await request(app).post(`${BASE}/login`).send({
      email: 'noexiste@certivalidate.test',
      password: PASSWORD,
    })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/refresh y logout', () => {
  let accessToken
  let refreshToken

  beforeAll(async () => {
    const res = await request(app).post(`${BASE}/login`).send({ email: EMAIL, password: PASSWORD })
    accessToken = res.body.data.token
    refreshToken = res.body.data.refreshToken
  })

  it('renueva tokens con refresh token válido', async () => {
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken })
    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.refreshToken).toBeDefined()
    // El refresh token original ya no debe servir (rotación)
    refreshToken = res.body.data.refreshToken
  })

  it('rechaza refresh token ya rotado (reuso detectado)', async () => {
    // Obtener un token fresco para rotar
    const loginRes = await request(app).post(`${BASE}/login`).send({ email: EMAIL, password: PASSWORD })
    const rt = loginRes.body.data.refreshToken
    // Usarlo una vez (rota)
    await request(app).post(`${BASE}/refresh`).send({ refreshToken: rt })
    // Intentar usarlo de nuevo → debe fallar
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken: rt })
    expect(res.status).toBe(401)
  })

  it('hace logout y revoca el refresh token', async () => {
    const loginRes = await request(app).post(`${BASE}/login`).send({ email: EMAIL, password: PASSWORD })
    const rt = loginRes.body.data.refreshToken
    const at = loginRes.body.data.token

    const logoutRes = await request(app)
      .post(`${BASE}/logout`)
      .set('Authorization', `Bearer ${at}`)
      .send({ refreshToken: rt })
    expect(logoutRes.status).toBe(200)

    // Intentar refresh con el token revocado
    const refreshRes = await request(app).post(`${BASE}/refresh`).send({ refreshToken: rt })
    expect(refreshRes.status).toBe(401)
  })
})

describe('C0 — partial_token no puede usarse como access token', () => {
  let partialToken

  beforeAll(async () => {
    const user2fa = await createTestUser(`2fa_bypass_${UNIQUE}`)
    await enableTest2FA(user2fa.id)

    const loginRes = await request(app)
      .post(`${BASE}/login`)
      .send({ email: `${TEST_PREFIX}2fa_bypass_${UNIQUE}@certivalidate.test`, password: PASSWORD })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.data.requires2FA).toBe(true)
    partialToken = loginRes.body.data.partial_token
  })

  it('el partial_token existe y es un JWT válido', () => {
    expect(partialToken).toBeDefined()
    expect(typeof partialToken).toBe('string')
    expect(partialToken.split('.')).toHaveLength(3)
  })

  it('partial_token rechazado en GET /api/auth/perfil con 401', async () => {
    const res = await request(app)
      .get(`${BASE}/perfil`)
      .set('Authorization', `Bearer ${partialToken}`)
    expect(res.status).toBe(401)
  })

  it('partial_token rechazado en GET /api/auth/permisos con 401', async () => {
    const res = await request(app)
      .get(`${BASE}/permisos`)
      .set('Authorization', `Bearer ${partialToken}`)
    expect(res.status).toBe(401)
  })

  it('partial_token rechazado en GET /api/usuarios con 401', async () => {
    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${partialToken}`)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/perfil', () => {
  let token

  beforeAll(async () => {
    const res = await request(app).post(`${BASE}/login`).send({ email: EMAIL, password: PASSWORD })
    token = res.body.data.token
  })

  it('retorna perfil del usuario autenticado sin password_hash', async () => {
    const res = await request(app).get(`${BASE}/perfil`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.email).toBe(EMAIL)
    expect(res.body.data.password_hash).toBeUndefined()
  })

  it('rechaza acceso sin token con 401', async () => {
    const res = await request(app).get(`${BASE}/perfil`)
    expect(res.status).toBe(401)
  })

  it('rechaza token inválido con 401', async () => {
    const res = await request(app).get(`${BASE}/perfil`).set('Authorization', 'Bearer token.invalido.xxx')
    expect(res.status).toBe(401)
  })
})
