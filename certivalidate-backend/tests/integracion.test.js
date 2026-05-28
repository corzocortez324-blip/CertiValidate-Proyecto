/**
 * Tests para POST /api/instituciones/:id/probar-conexion
 *
 * Se mockea academic-api.service para no depender de la API externa real.
 */

jest.mock('../src/services/academic-api.service', () => ({
  verificarDisponibilidad: jest.fn(),
  buscarEstudiantePorDocumento: jest.fn(),
  listarEstudiantes: jest.fn(),
}))

const request = require('supertest')
const app = require('../src/app')
const prisma = require('../src/utils/prisma')
const academicApiService = require('../src/services/academic-api.service')

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
let tokenSinAcceso
let instConIntegracion
let instSinIntegracion

beforeAll(async () => {
  const userAdmin = await createTestUser(`integ_admin_${UNIQUE}`)
  const userOtro = await createTestUser(`integ_otro_${UNIQUE}`)

  instConIntegracion = await createTestInstitucion(`integ_con_${UNIQUE}`)
  instSinIntegracion = await createTestInstitucion(`integ_sin_${UNIQUE}`)

  await linkUserToInstitucion(userAdmin.id, instConIntegracion.id, 'admin')
  await linkUserToInstitucion(userAdmin.id, instSinIntegracion.id, 'admin')
  // userOtro no está vinculado a ninguna institución de test

  // Crear configuración de integración solo para instConIntegracion
  await prisma.integracion.create({
    data: {
      institucion_id: instConIntegracion.id,
      tipo: 'external-api',
      url_base: 'http://localhost:4000',
      activa: true,
    },
  })

  token = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: userAdmin.email, password: 'TestPass123' })
  ).body.data.token

  tokenSinAcceso = (
    await request(app)
      .post(`${BASE_AUTH}/login`)
      .send({ email: userOtro.email, password: 'TestPass123' })
  ).body.data.token
})

afterAll(async () => {
  await cleanupTestData()
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/instituciones/:id/probar-conexion', () => {
  it('retorna conexión exitosa cuando la API académica responde', async () => {
    academicApiService.verificarDisponibilidad.mockResolvedValue(true)

    const res = await request(app)
      .post(`${BASE}/${instConIntegracion.id}/probar-conexion`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toBe('Conexión verificada correctamente')
    expect(res.body.data).toMatchObject({
      institucion_id: instConIntegracion.id,
      provider: 'academic-api',
      tipo: 'REST',
      url_base: 'http://localhost:4000',
      estado: 'conectado',
      disponible: true,
    })
    expect(res.body.data.ultima_verificacion).toBeDefined()

    // Debe haber llamado a verificarDisponibilidad con la url_base correcta
    expect(academicApiService.verificarDisponibilidad).toHaveBeenCalledWith(
      expect.objectContaining({ url_base: 'http://localhost:4000' }),
    )
  })

  it('retorna estado pendiente cuando la institución no tiene integración configurada', async () => {
    const res = await request(app)
      .post(`${BASE}/${instSinIntegracion.id}/probar-conexion`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe('Integración pendiente o no disponible')
    expect(res.body.data).toMatchObject({
      institucion_id: instSinIntegracion.id,
      estado: 'pendiente',
      disponible: false,
    })

    // No debe llamar al servicio externo
    expect(academicApiService.verificarDisponibilidad).not.toHaveBeenCalled()
  })

  it('retorna 403 cuando el usuario no tiene acceso a la institución', async () => {
    const res = await request(app)
      .post(`${BASE}/${instConIntegracion.id}/probar-conexion`)
      .set('Authorization', `Bearer ${tokenSinAcceso}`)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('retorna estado pendiente cuando la API académica está caída', async () => {
    academicApiService.verificarDisponibilidad.mockResolvedValue(false)

    const res = await request(app)
      .post(`${BASE}/${instConIntegracion.id}/probar-conexion`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe('Integración pendiente o no disponible')
    expect(res.body.data).toMatchObject({
      institucion_id: instConIntegracion.id,
      estado: 'pendiente',
      disponible: false,
    })
  })

  it('retorna 400 para un :id que no es UUID válido', async () => {
    const res = await request(app)
      .post(`${BASE}/no-es-un-uuid/probar-conexion`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('retorna 401 cuando no se envía token de autenticación', async () => {
    const res = await request(app).post(
      `${BASE}/${instConIntegracion.id}/probar-conexion`,
    )

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })
})
