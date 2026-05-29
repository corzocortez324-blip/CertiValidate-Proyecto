/**
 * Tests de autorización cross-institución.
 * Verifica que un usuario de la institución A no puede leer ni modificar
 * recursos de la institución B, incluso teniendo permisos en la suya.
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

const BASE_AUTH = '/api/auth'
const UNIQUE = Date.now()

let tokenA       // access token del admin de institución A
let tokenB       // access token del admin de institución B
let instA        // institución A
let instB        // institución B
let estudianteB  // estudiante que pertenece a institución B
let plantillaB   // plantilla que pertenece a institución B
let certificadoB // certificado que pertenece a institución B

const loginAs = async (email, password = 'TestPass123') => {
  const res = await request(app).post(`${BASE_AUTH}/login`).send({ email, password })
  return res.body.data.token
}

beforeAll(async () => {
  // Crear dos instituciones independientes
  instA = await createTestInstitucion(`A_${UNIQUE}`)
  instB = await createTestInstitucion(`B_${UNIQUE}`)

  // Crear un usuario admin para cada una
  const userA = await createTestUser(`admin_a_${UNIQUE}`)
  const userB = await createTestUser(`admin_b_${UNIQUE}`)

  await linkUserToInstitucion(userA.id, instA.id, 'admin')
  await linkUserToInstitucion(userB.id, instB.id, 'admin')

  tokenA = await loginAs(`__test__admin_a_${UNIQUE}@certivalidate.test`)
  tokenB = await loginAs(`__test__admin_b_${UNIQUE}@certivalidate.test`)

  // Crear recursos en institución B
  estudianteB = await createTestEstudiante(instB.id, `B_${UNIQUE}`)
  plantillaB = await createTestPlantilla(instB.id, `B_${UNIQUE}`)

  // Emitir un certificado en institución B usando el admin de B
  const certRes = await request(app)
    .post('/api/certificados/emitir')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({
      estudiante_id: estudianteB.id,
      institucion_id: instB.id,
      plantilla_id: plantillaB.id,
    })
  certificadoB = certRes.body.data
})

afterAll(async () => {
  await cleanupTestData()
})

describe('Autorización: estudiantes', () => {
  it('usuario A no puede ver estudiante de institución B', async () => {
    const res = await request(app)
      .get(`/api/estudiantes/${estudianteB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('usuario A no puede actualizar estudiante de institución B', async () => {
    const res = await request(app)
      .put(`/api/estudiantes/${estudianteB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: 'Hackeado' })
    expect(res.status).toBe(403)
  })

  it('usuario A no puede eliminar estudiante de institución B', async () => {
    const res = await request(app)
      .delete(`/api/estudiantes/${estudianteB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('usuario B puede ver su propio estudiante', async () => {
    const res = await request(app)
      .get(`/api/estudiantes/${estudianteB.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(estudianteB.id)
  })
})

describe('Autorización: plantillas', () => {
  it('usuario A no puede ver plantilla de institución B', async () => {
    const res = await request(app)
      .get(`/api/plantillas/${plantillaB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('usuario A no puede actualizar plantilla de institución B', async () => {
    const res = await request(app)
      .put(`/api/plantillas/${plantillaB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: 'Modificada' })
    expect(res.status).toBe(403)
  })
})

describe('Autorización: certificados', () => {
  it('usuario A no puede ver certificado de institución B', async () => {
    const res = await request(app)
      .get(`/api/certificados/${certificadoB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('usuario A no puede descargar PDF de certificado de institución B', async () => {
    const res = await request(app)
      .get(`/api/certificados/descargar/${certificadoB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('usuario A no puede ver verificaciones de certificado de institución B', async () => {
    // Este es el bug que corregimos en Fase 1 — ahora debe retornar 403
    const res = await request(app)
      .get(`/api/certificados/${certificadoB.id}/verificaciones`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('usuario A no puede ver revocaciones de certificado de institución B', async () => {
    const res = await request(app)
      .get(`/api/certificados/${certificadoB.id}/revocaciones`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('usuario A no puede revocar certificado de institución B', async () => {
    const res = await request(app)
      .post(`/api/certificados/${certificadoB.id}/revocar`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ motivo_codigo: 'ERROR_EMISION' })
    expect(res.status).toBe(403)
  })

  it('usuario B puede ver su propio certificado', async () => {
    const res = await request(app)
      .get(`/api/certificados/${certificadoB.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(certificadoB.id)
  })
})

describe('Autorización: instituciones', () => {
  it('usuario A no puede ver institución B', async () => {
    const res = await request(app)
      .get(`/api/instituciones/${instB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('usuario A no puede actualizar institución B', async () => {
    const res = await request(app)
      .put(`/api/instituciones/${instB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: 'Institución Hackeada' })
    expect(res.status).toBe(403)
  })

  it('usuario A no puede ver estadísticas de institución B', async () => {
    const res = await request(app)
      .get(`/api/instituciones/${instB.id}/estadisticas`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })
})

describe('Autorización: listados solo muestran recursos propios', () => {
  it('listar certificados no incluye certificados de institución B cuando se autentica como A', async () => {
    const res = await request(app)
      .get('/api/certificados/listar')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const ids = res.body.data.data.map((c) => c.id)
    expect(ids).not.toContain(certificadoB.id)
  })

  it('listar estudiantes no incluye estudiantes de institución B cuando se autentica como A', async () => {
    const res = await request(app)
      .get('/api/estudiantes')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const ids = res.body.data.data.map((e) => e.id)
    expect(ids).not.toContain(estudianteB.id)
  })

  it('usuario A no puede filtrar certificados por institución B', async () => {
    const res = await request(app)
      .get(`/api/certificados/listar?institucion_id=${instB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })
})
