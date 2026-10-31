/**
 * Pruebas de regresión de los defectos detectados en las pruebas de integración
 * basadas en hilos (documento de pruebas, apartado 2.4.2):
 * - CI-H08-03: falla del proveedor de correo → 502 (no 200)
 * - CI-H10-01: actualizar permisos de un rol registra auditoría
 * - CI-H12-01: crear integración registra auditoría con api_key '[CIFRADA]'
 * - CI-H12-03: API académica sin respuesta → estado 'sin_conexion'
 * - CI-H13-01: sincronizar registra auditoría SINCRONIZAR_DATOS
 * - CI-H13-02: el fallo de una entidad no aborta la sincronización
 * - CI-H15-02: los intentos fallidos de anclaje blockchain se persisten
 */
jest.mock('../src/services/blockchain.service', () => {
  const actual = jest.requireActual('../src/services/blockchain.service')
  return { ...actual, registerHashOnBlockchain: jest.fn(actual.registerHashOnBlockchain) }
})
jest.mock('../src/utils/mailer', () => {
  const actual = jest.requireActual('../src/utils/mailer')
  return { ...actual, enviarEmailCertificadoConPdf: jest.fn() }
})
jest.mock('../src/services/academic-api.service', () => ({
  verificarDisponibilidad: jest.fn(),
  listarEstudiantes: jest.fn(),
  listarCertificados: jest.fn(),
  listarPlantillas: jest.fn(),
  listarCursos: jest.fn(),
  listarFirmantes: jest.fn(),
}))

const request = require('supertest')
const app = require('../src/app')
const prisma = require('../src/utils/prisma')
const blockchainService = require('../src/services/blockchain.service')
const mailer = require('../src/utils/mailer')
const academicApiService = require('../src/services/academic-api.service')
const {
  cleanupTestData,
  createTestUser,
  createTestInstitucion,
  linkUserToInstitucion,
  createTestEstudiante,
  createTestPlantilla,
} = require('./helpers/db')

const UNIQUE = Date.now()
let token
let usuario
let inst
let certificado

beforeAll(async () => {
  inst = await createTestInstitucion(`REG_${UNIQUE}`)
  usuario = await createTestUser(`reg_${UNIQUE}`)
  await linkUserToInstitucion(usuario.id, inst.id, 'admin')

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: `__test__reg_${UNIQUE}@certivalidate.test`, password: 'TestPass123' })
  token = login.body.data.token

  const estudiante = await createTestEstudiante(inst.id, `REG_${UNIQUE}`)
  await prisma.estudiante.update({
    where: { id: estudiante.id },
    data: { email: `__test__est_reg_${UNIQUE}@certivalidate.test` },
  })
  const plantilla = await createTestPlantilla(inst.id, `REG_${UNIQUE}`)

  const certRes = await request(app)
    .post('/api/certificados/emitir')
    .set('Authorization', `Bearer ${token}`)
    .send({ estudiante_id: estudiante.id, institucion_id: inst.id, plantilla_id: plantilla.id })
  certificado = certRes.body.data
})

afterAll(async () => {
  await cleanupTestData()
})

afterEach(() => {
  jest.clearAllMocks()
})

const buscarAuditoria = (accion, entidad_id) =>
  prisma.auditoria.findFirst({ where: { accion, entidad_id, usuario_id: usuario.id } })

describe('CI-H08-03: falla del proveedor de correo', () => {
  it('responde 502 cuando Resend rechaza el envío', async () => {
    const err = new Error('Resend caído')
    err.code = 'EMAIL_PROVIDER_ERROR'
    mailer.enviarEmailCertificadoConPdf.mockRejectedValueOnce(err)

    const res = await request(app)
      .post(`/api/certificados/${certificado.id}/email`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pdf_base64: Buffer.from('%PDF-1.4 prueba').toString('base64') })

    expect(res.status).toBe(502)
    expect(res.body.success).toBe(false)
  })
})

describe('CI-H10-01: auditoría al actualizar permisos de un rol', () => {
  it('registra ACTUALIZAR_ROL_PERMISOS con valores antes/después', async () => {
    const editor = await prisma.rol.findUnique({
      where: { nombre: 'editor' },
      include: { permisos: true },
    })
    // Se reenvían los mismos permisos para no alterar el RBAC compartido
    const permisoIds = editor.permisos.map((rp) => rp.permiso_id)

    const res = await request(app)
      .put(`/api/admin/roles/${editor.id}/permisos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permisoIds })

    expect(res.status).toBe(200)
    const audit = await buscarAuditoria('ACTUALIZAR_ROL_PERMISOS', editor.id)
    expect(audit).not.toBeNull()
    expect(JSON.parse(audit.valores_antes).permisoIds.sort()).toEqual([...permisoIds].sort())
  })
})

describe('Integración académica', () => {
  let integracionId

  it('CI-H12-01: crear integración registra auditoría sin exponer la api_key', async () => {
    const res = await request(app)
      .post('/api/integraciones')
      .set('Authorization', `Bearer ${token}`)
      .send({ institucion_id: inst.id, tipo: 'REST', url_base: 'http://academic.test/api', api_key: 'clave-secreta' })

    expect(res.status).toBe(201)
    integracionId = res.body.data.id
    const audit = await buscarAuditoria('CREAR_INTEGRACION', integracionId)
    expect(audit).not.toBeNull()
    expect(audit.valores_despues).toContain('[CIFRADA]')
    expect(audit.valores_despues).not.toContain('clave-secreta')
  })

  it('CI-H12-03: API sin respuesta devuelve estado sin_conexion', async () => {
    academicApiService.verificarDisponibilidad.mockResolvedValue(false)

    const res = await request(app)
      .post(`/api/instituciones/${inst.id}/probar-conexion`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ estado: 'sin_conexion', disponible: false })
  })

  it('CI-H13-01: sincronizar registra auditoría SINCRONIZAR_DATOS', async () => {
    academicApiService.listarEstudiantes.mockResolvedValue([])

    const res = await request(app)
      .post(`/api/integraciones/${inst.id}/sincronizar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entidades: ['estudiantes'] })

    expect(res.status).toBe(200)
    expect(await buscarAuditoria('SINCRONIZAR_DATOS', inst.id)).not.toBeNull()
  })

  it('CI-H13-02: una entidad caída no aborta la sincronización', async () => {
    academicApiService.listarEstudiantes.mockResolvedValue([
      { documento: `REG${UNIQUE}`, nombre: 'Sync', apellido: 'Parcial' },
    ])
    academicApiService.listarPlantillas.mockResolvedValue([])
    academicApiService.listarCertificados.mockRejectedValue(new Error('Endpoint de certificados caído'))

    const res = await request(app)
      .post(`/api/integraciones/${inst.id}/sincronizar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entidades: ['certificados'] })

    expect(res.status).toBe(200)
    expect(res.body.data.estudiantes.creados).toBe(1)
    expect(res.body.data.certificados.error).toBeDefined()
  })
})

describe('CI-H15-02: reintentos de anclaje blockchain', () => {
  const errorRed = () => Object.assign(new Error('Red blockchain no disponible'), { statusCode: 503 })

  it('persiste cada intento fallido y marca fallido al tercero', async () => {
    blockchainService.registerHashOnBlockchain.mockRejectedValue(errorRed())

    for (let intento = 1; intento <= 3; intento++) {
      const res = await request(app)
        .post(`/api/certificados/${certificado.id}/blockchain/register`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(503)

      const tx = await prisma.blockchainTransaccion.findFirst({
        where: { certificado_id: certificado.id },
        orderBy: { created_at: 'desc' },
      })
      expect(tx.intentos).toBe(intento)
      expect(tx.estado).toBe(intento < 3 ? 'pendiente' : 'fallido')
      expect(tx.error_mensaje).toContain('no disponible')
    }
  })

  it('tras un fallo definitivo, un nuevo registro se confirma', async () => {
    blockchainService.registerHashOnBlockchain.mockImplementation(
      jest.requireActual('../src/services/blockchain.service').registerHashOnBlockchain,
    )

    const res = await request(app)
      .post(`/api/certificados/${certificado.id}/blockchain/register`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('confirmado')
  })
})

// ── Hallazgos de las pruebas unitarias (apartado 2.7.1) ─────────────────────
describe('Hallazgos unitarios', () => {
  it('documento de estudiante duplicado responde 409 (no 500)', async () => {
    const datos = { institucion_id: inst.id, nombre: 'Dup', apellido: 'Licado', documento: `DUP${UNIQUE}` }
    const primero = await request(app).post('/api/estudiantes').set('Authorization', `Bearer ${token}`).send(datos)
    expect(primero.status).toBe(201)

    const res = await request(app).post('/api/estudiantes').set('Authorization', `Bearer ${token}`).send(datos)
    expect(res.status).toBe(409)
  })

  it('crear usuario institucional aplica la política de contraseñas', async () => {
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Débil', email: `__test__debil_${UNIQUE}@certivalidate.test`, password: 'abc', institucion_id: inst.id })

    expect(res.status).toBe(400)
  })

  it('el cambio de contraseña rechaza reutilizar la actual', async () => {
    await createTestUser(`pwd_${UNIQUE}`)
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: `__test__pwd_${UNIQUE}@certivalidate.test`, password: 'TestPass123' })

    const res = await request(app)
      .put('/api/auth/perfil/password')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ currentPassword: 'TestPass123', newPassword: 'TestPass123' })

    expect(res.status).toBe(400)
  })
})

// ── Seguridad multi-institución en la gestión de usuarios ───────────────────
describe('Alcance de /api/usuarios', () => {
  let otraInst
  let ajeno
  beforeAll(async () => {
    otraInst = await createTestInstitucion(`REG_OTRA_${UNIQUE}`)
    ajeno = await createTestUser(`reg_ajeno_${UNIQUE}`)
    await linkUserToInstitucion(ajeno.id, otraInst.id, 'admin')
  })

  it('el listado solo incluye usuarios de las instituciones propias y sin totp_secret', async () => {
    const res = await request(app).get('/api/usuarios?limit=100').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const ids = res.body.data.usuarios.map((u) => u.id)
    expect(ids).toContain(usuario.id)
    expect(ids).not.toContain(ajeno.id)
    for (const u of res.body.data.usuarios) expect(u).not.toHaveProperty('totp_secret')
  })

  it('no permite ver, editar ni eliminar un usuario de otra institución', async () => {
    const h = { Authorization: `Bearer ${token}` }
    expect((await request(app).get(`/api/usuarios/${ajeno.id}`).set(h)).status).toBe(404)
    expect((await request(app).put(`/api/usuarios/${ajeno.id}`).set(h).send({ activo: false })).status).toBe(404)
    expect((await request(app).delete(`/api/usuarios/${ajeno.id}`).set(h)).status).toBe(404)
    const intacto = await prisma.usuario.findUnique({ where: { id: ajeno.id } })
    expect(intacto).toMatchObject({ activo: true, deleted_at: null })
  })
})

// ── Hallazgos de SonarQube Cloud ─────────────────────────────────────────────
describe('Reporte de motivos de revocación (sin SQL directo)', () => {
  const h = () => ({ Authorization: `Bearer ${token}` })

  it('agrupa por motivo solo las revocaciones de la institución propia', async () => {
    const res = await request(app).get(`/api/admin/revocaciones/motivos?institucion_id=${inst.id}`).set(h())
    expect(res.status).toBe(200)
    const total = await prisma.revocacion.count({ where: { certificado: { institucion_id: inst.id } } })
    expect(res.body.data.total_revocaciones).toBe(total)
    const suma = res.body.data.reporte.reduce((s, r) => s + r.total, 0)
    expect(suma).toBe(total)
  })

  it('rechaza una institución ajena y fechas inválidas', async () => {
    const otra = await createTestInstitucion(`REG_MOT_${UNIQUE}`)
    expect((await request(app).get(`/api/admin/revocaciones/motivos?institucion_id=${otra.id}`).set(h())).status).toBe(403)
    expect((await request(app).get('/api/admin/revocaciones/motivos?fecha_desde=no-es-fecha').set(h())).status).toBe(400)
  })
})

describe('Documento del estudiante en la URL de la API académica', () => {
  it('se codifica: un «../» no cambia la ruta consultada', async () => {
    const academicApi = jest.requireActual('../src/services/academic-api.service')
    const original = global.fetch
    let urlPedida
    global.fetch = jest.fn(async (url) => { urlPedida = String(url); return new Response(JSON.stringify({ documento: 'x', nombre: 'A' }), { status: 200 }) })
    try {
      await academicApi.buscarEstudiantePorDocumento('../admin', { url_base: 'http://academica.test', api_key: 'k', maxRetries: 0 })
    } finally {
      global.fetch = original
    }
    expect(urlPedida).toBe('http://academica.test/api/estudiantes/..%2Fadmin')
  })
})
