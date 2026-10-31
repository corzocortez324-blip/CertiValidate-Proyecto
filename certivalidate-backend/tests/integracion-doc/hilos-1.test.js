/**
 * Pruebas de integración basadas en hilos H01–H11 (apartado 2.4.2). Cada `it`
 * corresponde a un caso CI-Hxx-yy y comprueba la salida esperada de su diseño.
 * El proveedor de correo (Resend) se sustituye por un doble de prueba.
 */
const mockSend = jest.fn()
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }))

const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { generateSync } = require('otplib')
const { iniciarBlockchainLocal } = require('./blockchain-local')
const { app, prisma, request, auth, login, emailDe, PASSWORD, crearEscenario, crearApiAcademica } = require('./escenario')
const { emitirValido, verificarCodigo, revocarComo, configurarIntegracion } = require('./pasos')
const { createTestUser, createTestInstitucion, linkUserToInstitucion, cleanupTestData } = require('../helpers/db')

const SECRETO_TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex')
const PDF_B64 = Buffer.from('%PDF-1.4 certificado de prueba').toString('base64')

let ctx
let api
let red

beforeAll(async () => {
  red = await iniciarBlockchainLocal()
  process.env.RESEND_API_KEY = 're_test_doble'
  ctx = await crearEscenario(`hilos1_${Date.now()}`)
  api = await crearApiAcademica()
}, 60000)
afterAll(async () => { await api.cerrar(); await red.detener(); await cleanupTestData() })
beforeEach(() => { mockSend.mockReset(); mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null }); api.reiniciar() })

const nuevoUsuario = async (nombre, { rol = 'admin', inst = ctx.inst, password = PASSWORD } = {}) => {
  const sufijo = `${nombre}_${ctx.tag}_${Date.now()}`.toLowerCase()
  const u = await createTestUser(sufijo, password)
  if (rol) await linkUserToInstitucion(u.id, inst.id, rol)
  return { ...u, sufijo, email: emailDe(sufijo) }
}

// ── H01 · Inicio de sesión con verificación 2FA ──────────────────────────────
describe('H01 Inicio de sesión con 2FA', () => {
  it('CI-H01-01 Login exitoso sin 2FA', async () => {
    const u = await nuevoUsuario('h0101')
    const res = await request(app).post('/api/auth/login').send({ email: u.email, password: PASSWORD })
    expect(res.status).toBe(200)
    const { token, refreshToken } = res.body.data
    expect(token && refreshToken).toBeTruthy()
    expect(await prisma.intentoLogin.findFirst({ where: { email: u.email, exitoso: true } })).not.toBeNull()
    expect(await prisma.refreshToken.findFirst({ where: { usuario_id: u.id, token_hash: sha256(refreshToken) } })).not.toBeNull()
    expect(await prisma.sesionActiva.count({ where: { usuario_id: u.id } })).toBe(1)
    expect((await prisma.usuario.findUnique({ where: { id: u.id } })).ultimo_acceso).not.toBeNull()
    expect((await request(app).get('/api/auth/perfil').set(auth(token))).status).toBe(200)
  })

  it('CI-H01-02 Login con 2FA: código inválido y válido', async () => {
    const u = await nuevoUsuario('h0102')
    await prisma.usuario.update({ where: { id: u.id }, data: { totp_enabled: true, totp_secret: SECRETO_TOTP } })
    const paso1 = await request(app).post('/api/auth/login').send({ email: u.email, password: PASSWORD })
    expect(paso1.body.data.requires2FA).toBe(true)
    const { partial_token } = paso1.body.data
    const dec = jwt.decode(partial_token)
    expect(dec.exp - dec.iat).toBe(300)
    expect((await request(app).get('/api/auth/perfil').set(auth(partial_token))).status).toBe(401)

    const malo = await request(app).post('/api/auth/2fa/verify').send({ partial_token, code: '000000' })
    expect(malo.status).toBe(401)
    expect(await prisma.sesionActiva.count({ where: { usuario_id: u.id } })).toBe(0)

    const bueno = await request(app).post('/api/auth/2fa/verify').send({ partial_token, code: generateSync(SECRETO_TOTP) }) // firma del mock de otplib
    expect(bueno.status).toBe(200)
    expect(bueno.body.data.token).toBeTruthy()
    expect(await prisma.sesionActiva.count({ where: { usuario_id: u.id } })).toBe(1)
  })

  it('CI-H01-03 Credenciales inválidas y bloqueo por intentos', async () => {
    const u = await nuevoUsuario('h0103')
    for (let i = 1; i <= 4; i++) {
      const r = await request(app).post('/api/auth/login').send({ email: u.email, password: 'Incorrecta1' })
      expect(r.status).toBe(401)
    }
    // El quinto intento fallido bloquea la cuenta
    const quinto = await request(app).post('/api/auth/login').send({ email: u.email, password: 'Incorrecta1' })
    expect(quinto.status).toBe(423)
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: 'Incorrecta1' })).status).toBe(423)
    const correcta = await request(app).post('/api/auth/login').send({ email: u.email, password: PASSWORD })
    expect(correcta.status).toBe(423)
    expect(await prisma.intentoLogin.count({ where: { email: u.email, exitoso: false } })).toBeGreaterThanOrEqual(5)
    expect(await prisma.intentoLogin.count({ where: { email: u.email, exitoso: true } })).toBe(0)
  })
})

// ── H02 · Registro de usuario y verificación de correo ──────────────────────
describe('H02 Registro y verificación de correo', () => {
  const emailReg = () => emailDe(`h02_${ctx.tag}_${Date.now()}`)

  it('CI-H02-01 Registro exitoso', async () => {
    const email = emailReg()
    const res = await request(app).post('/api/auth/register').send({ nombre: 'Ana', apellido: 'Pérez', email, password: 'Clave1234' })
    expect(res.status).toBe(201)
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|token_verificacion/)
    const u = await prisma.usuario.findUnique({ where: { email } })
    expect(u.email_verificado).toBe(false)
    expect(u.password_hash).toMatch(/^\$2[aby]\$/)
    expect(u.token_verificacion).toBeTruthy()
    expect(u.token_verificacion_expira.getTime() - Date.now()).toBeGreaterThan(23 * 3600 * 1000)
    expect(await prisma.auditoria.findFirst({ where: { accion: 'CREAR_USUARIO', entidad_id: u.id } })).not.toBeNull()
  })

  it('CI-H02-02 Registro con email duplicado', async () => {
    const email = emailReg()
    const datos = { nombre: 'Ana', apellido: 'Pérez', email, password: 'Clave1234' }
    expect((await request(app).post('/api/auth/register').send(datos)).status).toBe(201)
    const res = await request(app).post('/api/auth/register').send(datos)
    expect(res.status).toBe(409)
    expect(await prisma.usuario.count({ where: { email } })).toBe(1)
  })

  it('CI-H02-03 Verificación de correo: token inválido, expirado y válido', async () => {
    const invalido = await request(app).get('/api/auth/verificar-email?token=xxx')
    expect(invalido.status).toBe(400)
    expect(invalido.body.message).toBe('Token de verificación inválido')

    const email = emailReg()
    await request(app).post('/api/auth/register').send({ nombre: 'Ana', apellido: 'Pérez', email, password: 'Clave1234' })
    const u = await prisma.usuario.findUnique({ where: { email } })
    await prisma.usuario.update({ where: { id: u.id }, data: { token_verificacion_expira: new Date(Date.now() - 25 * 3600 * 1000) } })
    const expirado = await request(app).get(`/api/auth/verificar-email?token=${u.token_verificacion}`)
    expect(expirado.status).toBe(400)
    expect(expirado.body.message).toBe('Token de verificación expirado')

    await prisma.usuario.update({ where: { id: u.id }, data: { token_verificacion_expira: new Date(Date.now() + 3600 * 1000) } })
    const ok = await request(app).get(`/api/auth/verificar-email?token=${u.token_verificacion}`)
    expect(ok.status).toBe(200)
    const despues = await prisma.usuario.findUnique({ where: { id: u.id } })
    expect(despues.email_verificado).toBe(true)
    expect(despues.token_verificacion).toBeNull()
  })
})

// ── H03 · Renovación de token (refresh) ──────────────────────────────────────
describe('H03 Renovación de token', () => {
  const accessExpirado = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: -10 })

  it('CI-H03-01 Renovación exitosa con rotación del refresh token', async () => {
    const u = await nuevoUsuario('h0301')
    const { refreshToken } = await login(u.sufijo)
    const expirado = await request(app).get('/api/auth/perfil').set(auth(accessExpirado(u.id)))
    expect(expirado.status).toBe(401)
    expect(expirado.body.message).toMatch(/expirado/i)

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken })
    expect(res.status).toBe(200)
    const viejo = await prisma.refreshToken.findFirst({ where: { token_hash: sha256(refreshToken) } })
    expect(viejo.revoked_at).not.toBeNull()
    expect(await prisma.refreshToken.count({ where: { usuario_id: u.id, revoked_at: null } })).toBe(1)
    expect(await prisma.sesionActiva.findFirst({ where: { usuario_id: u.id, token_hash: sha256(res.body.data.refreshToken) } })).not.toBeNull()
    expect((await request(app).get('/api/auth/perfil').set(auth(res.body.data.token))).status).toBe(200)
  })

  it('CI-H03-02 Refresh token revocado', async () => {
    const u = await nuevoUsuario('h0302')
    const { refreshToken } = await login(u.sufijo)
    await prisma.refreshToken.updateMany({ where: { token_hash: sha256(refreshToken) }, data: { revoked_at: new Date() } })
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken })
    expect(res.status).toBe(401)
    expect(res.body.data?.token).toBeUndefined()
  })

  it('CI-H03-03 Refresh token vencido', async () => {
    const u = await nuevoUsuario('h0303')
    const vencido = jwt.sign({ id: u.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: -10 })
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: vencido })
    expect(res.status).toBe(401)
    expect(await prisma.sesionActiva.count({ where: { usuario_id: u.id } })).toBe(0)
  })
})

// ── H04 · Emisión de certificado ─────────────────────────────────────────────
describe('H04 Emisión de certificado', () => {
  it('CI-H04-01 Emisión exitosa', async () => {
    const sinToken = await request(app).post('/api/certificados/emitir').send({})
    expect(sinToken.status).toBe(401)
    const c = await emitirValido(ctx)
    expect(c.codigo_unico).toMatch(/^[0-9A-F]{16}$/) // nanoid(16)
    expect(c.hash_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(await prisma.certificadoMetadata.findFirst({ where: { certificado_id: c.id } })).not.toBeNull()
    expect(await prisma.auditoria.findFirst({ where: { accion: 'EMITIR_CERTIFICADO', entidad_id: c.id } })).not.toBeNull()
  })

  it('CI-H04-02 Emisión duplicada para el mismo estudiante y plantilla', async () => {
    const primero = await ctx.emitir({ estudianteId: ctx.estudiante.id })
    expect(primero.status).toBe(201)
    const res = await ctx.emitir({ estudianteId: ctx.estudiante.id })
    expect(res.status).toBe(409)
    expect(await prisma.certificado.count({ where: { estudiante_id: ctx.estudiante.id, plantilla_id: ctx.plantilla.id } })).toBe(1)
  })

  it('CI-H04-03 Usuario sin permiso o estudiante de otra institución', async () => {
    expect((await ctx.emitir({ token: ctx.usuarios.lector.token })).status).toBe(403)
    const res = await ctx.emitir({ estudianteId: ctx.estudianteAjeno.id })
    expect(res.status).toBe(404)
    expect(res.body.message).toBe('Estudiante no encontrado')
    expect(await prisma.certificado.count({ where: { estudiante_id: ctx.estudianteAjeno.id } })).toBe(0)
  })
})

// ── H05 · Emisión con API académica externa y fallback ──────────────────────
describe('H05 Emisión con API externa y fallback', () => {
  let escenario
  beforeAll(async () => { escenario = await crearEscenario(`h05_${Date.now()}`) })
  const emitirExterno = (documento) =>
    request(app).post('/api/certificados/emitir').set(auth(escenario.usuarios.admin.token))
      .send({ institucion_id: escenario.inst.id, plantilla_id: escenario.plantilla.id, provider: 'external-api', documento_estudiante: documento })
  const metadataDe = async (id) =>
    JSON.parse((await prisma.certificadoMetadata.findFirst({ where: { certificado_id: id, clave: 'origen_academico' } })).valor)

  it('CI-H05-01 API externa disponible (usa la integración de la institución)', async () => {
    api.estudiantes = [{ documento: `EXT${escenario.tag}`, nombre: 'Carla', apellido: 'Externa', email: 'carla@externa.test' }]
    await configurarIntegracion(escenario, api, 'clave-h05')
    api.reiniciar()
    const res = await emitirExterno(`EXT${escenario.tag}`)
    expect(res.status).toBe(201)
    expect(api.rutas).toContain(`GET /api/estudiantes/EXT${escenario.tag}`)
    expect(api.apiKeys).toContain('clave-h05')
    expect((await metadataDe(res.body.data.id)).fallback).toBe(false)
  })

  it('CI-H05-02 API externa caída: se usa la BD local (fallback)', async () => {
    await prisma.integracion.updateMany({ where: { institucion_id: escenario.inst.id }, data: { url_base: 'http://127.0.0.1:59999' } })
    require('../../src/services/integration-config.service').limpiarCache(escenario.inst.id)
    const local = await prisma.estudiante.create({ data: { institucion_id: escenario.inst.id, nombre: 'Local', apellido: 'Fallback', documento: `LOC${escenario.tag}` } })
    const res = await emitirExterno(local.documento)
    expect(res.status).toBe(201)
    expect((await metadataDe(res.body.data.id)).fallback).toBe(true)
  })

  it('CI-H05-03 Estudiante inexistente en la API y en la BD local', async () => {
    const res = await emitirExterno('0000000')
    expect(res.status).toBe(404)
    expect(await prisma.certificado.count({ where: { institucion_id: escenario.inst.id, estudiante: { documento: '0000000' } } })).toBe(0)
  })
})

// ── H06 · Verificación pública ───────────────────────────────────────────────
describe('H06 Verificación pública', () => {
  it('CI-H06-01 Verificación por código: certificado válido', async () => {
    const c = await emitirValido(ctx)
    const v = await verificarCodigo(c.codigo_unico)
    expect(v).toMatchObject({ estado: 'valido', hash_verificado: true, institucion: ctx.inst.nombre })
    expect(v.titular).toMatch(/\*/)
    const reg = await prisma.verificacionPublica.findFirst({ where: { certificado_id: c.id } })
    expect(reg).toMatchObject({ resultado: 'valido', metodo: 'codigo' })
  })

  it('CI-H06-02 Certificado inexistente, alterado, revocado o expirado', async () => {
    expect((await verificarCodigo('XXXXXXXXXXXXXXXX')).estado).toBe('no_encontrado')

    const alterado = await emitirValido(ctx)
    await prisma.certificado.update({ where: { id: alterado.id }, data: { hash_sha256: 'f'.repeat(64) } })
    expect((await verificarCodigo(alterado.codigo_unico)).estado).toBe('alterado')

    const revocado = await emitirValido(ctx)
    await revocarComo(ctx.usuarios.admin.token, revocado.id)
    const vr = await verificarCodigo(revocado.codigo_unico)
    expect(vr.estado).toBe('revocado')
    expect(vr.revocacion).toMatchObject({ motivo: 'ERROR_DATOS', fecha: expect.any(String) })

    const expirado = await emitirValido(ctx)
    await prisma.certificado.update({ where: { id: expirado.id }, data: { fecha_expiracion: new Date(Date.now() - 86400000) } })
    expect((await verificarCodigo(expirado.codigo_unico)).estado).toBe('expirado')
  })

  it('CI-H06-03 Límite de solicitudes (rate limiting)', async () => {
    // En NODE_ENV=test el limitador se omite salvo que se active explícitamente
    process.env.TEST_RATE_LIMIT = 'true'
    try {
      for (let i = 0; i < 50; i++) {
        expect((await request(app).post('/api/certificados/verificar').send({ codigo: 'LIMITE0000000000' })).status).toBe(404)
      }
      const res = await request(app).post('/api/certificados/verificar').send({ codigo: 'LIMITE0000000000' })
      expect(res.status).toBe(429)
      expect(res.body.message).toMatch(/Demasiadas solicitudes/)
      expect(res.headers).toHaveProperty('ratelimit-limit')
    } finally {
      delete process.env.TEST_RATE_LIMIT
    }
  }, 60000)
})

// ── H07 · Revocación de certificado ──────────────────────────────────────────
describe('H07 Revocación', () => {
  it('CI-H07-01 Revocación exitosa por administrador', async () => {
    const c = await emitirValido(ctx)
    const res = await revocarComo(ctx.usuarios.admin.token, c.id)
    expect(res.status).toBe(200)
    expect((await prisma.certificado.findUnique({ where: { id: c.id } })).estado).toBe('revocado')
    expect(await prisma.revocacion.findFirst({ where: { certificado_id: c.id, motivo_detalle: 'Prueba de integración' } })).not.toBeNull()
    expect(await prisma.auditoria.findFirst({ where: { accion: 'REVOCAR_CERTIFICADO', entidad_id: c.id } })).not.toBeNull()
  })

  it('CI-H07-02 El editor no puede revocar certificados ajenos (sí los propios)', async () => {
    const ajeno = await emitirValido(ctx) // emitido por el administrador
    const res = await revocarComo(ctx.usuarios.editor.token, ajeno.id)
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/tú mismo emitiste/)
    expect(await prisma.auditoria.findFirst({ where: { accion: 'INTENTO_REVOCACION_NO_AUTORIZADO', entidad_id: ajeno.id } })).not.toBeNull()

    const propio = await ctx.emitir({ token: ctx.usuarios.editor.token })
    expect(propio.status).toBe(201)
    expect((await revocarComo(ctx.usuarios.editor.token, propio.body.data.id)).status).toBe(200)
  })

  it('CI-H07-03 Certificado ya revocado o de otra institución', async () => {
    const c = await emitirValido(ctx)
    await revocarComo(ctx.usuarios.admin.token, c.id)
    expect((await revocarComo(ctx.usuarios.admin.token, c.id)).status).toBe(409)
    expect((await revocarComo(ctx.usuarios.ajeno.token, (await emitirValido(ctx)).id)).status).toBe(403)
  })
})

// ── H08 · Envío de certificado por correo ────────────────────────────────────
describe('H08 Envío por correo', () => {
  const enviar = (id, token = ctx.usuarios.admin.token) =>
    request(app).post(`/api/certificados/${id}/email`).set(auth(token)).send({ pdf_base64: PDF_B64 })

  it('CI-H08-01 Envío exitoso', async () => {
    const c = await ctx.emitir({ estudianteId: (await prisma.estudiante.create({ data: { institucion_id: ctx.inst.id, nombre: 'Con', apellido: 'Email', documento: `H0801${Date.now()}`, email: 'destino@prueba.test' } })).id })
    expect((await request(app).post(`/api/certificados/${c.body.data.id}/email`).send({ pdf_base64: PDF_B64 })).status).toBe(401)
    const res = await enviar(c.body.data.id)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ email_id: 'email_123' }) // id devuelto por Resend
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend.mock.calls[0][0].attachments[0].filename).toMatch(/\.pdf$/)
  })

  it('CI-H08-02 Estudiante sin email registrado', async () => {
    const sinEmail = await prisma.estudiante.create({ data: { institucion_id: ctx.inst.id, nombre: 'Sin', apellido: 'Email', documento: `H0802${Date.now()}` } })
    const c = await ctx.emitir({ estudianteId: sinEmail.id })
    const res = await enviar(c.body.data.id)
    expect(res.status).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('CI-H08-03 Falla del proveedor de correo', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'Resend caído', statusCode: 500 } })
    const c = await ctx.emitir({ estudianteId: (await prisma.estudiante.create({ data: { institucion_id: ctx.inst.id, nombre: 'Falla', apellido: 'Proveedor', documento: `H0803${Date.now()}`, email: 'falla@prueba.test' } })).id })
    const res = await enviar(c.body.data.id)
    expect(res.status).toBe(502)
    expect(res.body.success).toBe(false)
  })
})

// ── H09 · Creación de usuario institucional y correo de bienvenida ──────────
describe('H09 Creación de usuario institucional', () => {
  let inst
  let admin
  beforeAll(async () => {
    inst = await createTestInstitucion(`H09_${ctx.tag}`)
    await prisma.institucion.update({ where: { id: inst.id }, data: { dominio: 'universidad.test' } })
    admin = await nuevoUsuario('h09admin', { inst })
    admin.token = (await login(admin.sufijo)).token
  })
  const crear = (body, token = admin.token) => request(app).post('/api/usuarios').set(auth(token)).send(body)

  it('CI-H09-01 Creación exitosa de usuario', async () => {
    const email = `__test__luis.${Date.now()}@universidad.test`
    const res = await crear({ nombre: 'Luis', apellido: 'Gómez', email, password: 'Clave1234', rol: 'editor' })
    expect(res.status).toBe(201)
    const u = await prisma.usuario.findUnique({ where: { email } })
    expect(u).toMatchObject({ email_verificado: true, activo: true })
    expect(await prisma.usuarioInstitucion.findFirst({ where: { usuario_id: u.id, institucion_id: inst.id } })).not.toBeNull()
    expect(await prisma.auditoria.findFirst({ where: { accion: 'CREAR_USUARIO', entidad_id: u.id } })).not.toBeNull()
    expect(mockSend).toHaveBeenCalled() // correo de bienvenida
  })

  it('CI-H09-02 Rechazo por dominio, duplicado o campo prohibido', async () => {
    expect((await crear({ nombre: 'Luis', email: `__test__luis${Date.now()}@gmail.com`, password: 'Clave1234' })).status).toBe(400)
    const email = `__test__dup.${Date.now()}@universidad.test`
    expect((await crear({ nombre: 'Luis', email, password: 'Clave1234' })).status).toBe(201)
    expect((await crear({ nombre: 'Luis', email, password: 'Clave1234' })).status).toBe(409)
    const prohibido = await crear({ nombre: 'Luis', email: `__test__adm.${Date.now()}@universidad.test`, password: 'Clave1234', es_platform_admin: true })
    expect(prohibido.status).toBe(400)
  })

  it('CI-H09-03 Usuario sin permiso de creación', async () => {
    const email = `__test__lector.${Date.now()}@universidad.test`
    const res = await crear({ nombre: 'Luis', email, password: 'Clave1234' }, ctx.usuarios.lector.token)
    expect(res.status).toBe(403)
    expect(await prisma.usuario.findUnique({ where: { email } })).toBeNull()
  })
})

// ── H10 · Actualización de permisos por rol (RBAC) ──────────────────────────
describe('H10 Permisos por rol', () => {
  it('CI-H10-01 Actualizar permisos del rol editor', async () => {
    const roles = await request(app).get('/api/admin/roles').set(auth(ctx.usuarios.admin.token))
    expect(roles.status).toBe(200)
    const editor = await prisma.rol.findUnique({ where: { nombre: 'editor' }, include: { permisos: { include: { permiso: true } } } })
    const originales = editor.permisos.map((rp) => rp.permiso_id)
    const sinAuditoria = editor.permisos.filter((rp) => `${rp.permiso.recurso}:${rp.permiso.accion}` !== 'auditoria:ver').map((rp) => rp.permiso_id)
    try {
      const res = await request(app).put(`/api/admin/roles/${editor.id}/permisos`).set(auth(ctx.usuarios.admin.token)).send({ permisoIds: sinAuditoria })
      expect(res.status).toBe(200)
      expect((await request(app).get('/api/auditoria').set(auth(ctx.usuarios.editor.token))).status).toBe(403) // efecto inmediato
      const a = await prisma.auditoria.findFirst({ where: { accion: 'ACTUALIZAR_ROL_PERMISOS', entidad_id: editor.id }, orderBy: { fecha: 'desc' } })
      expect(JSON.parse(a.valores_antes).permisoIds.length).toBe(originales.length)
      expect(JSON.parse(a.valores_despues).permisoIds.length).toBe(sinAuditoria.length)
    } finally {
      await request(app).put(`/api/admin/roles/${editor.id}/permisos`).set(auth(ctx.usuarios.admin.token)).send({ permisoIds: originales })
    }
  })

  it('CI-H10-02 Rol admin sin permisos', async () => {
    const adminRol = await prisma.rol.findUnique({ where: { nombre: 'admin' } })
    const antes = await prisma.rolPermiso.count({ where: { rol_id: adminRol.id } })
    const res = await request(app).put(`/api/admin/roles/${adminRol.id}/permisos`).set(auth(ctx.usuarios.admin.token)).send({ permisoIds: [] })
    expect(res.status).toBe(400)
    expect(await prisma.rolPermiso.count({ where: { rol_id: adminRol.id } })).toBe(antes)
  })

  it('CI-H10-03 Usuario sin permiso de actualizar', async () => {
    const editor = await prisma.rol.findUnique({ where: { nombre: 'editor' } })
    const antes = await prisma.rolPermiso.count({ where: { rol_id: editor.id } })
    const res = await request(app).put(`/api/admin/roles/${editor.id}/permisos`).set(auth(ctx.usuarios.lector.token)).send({ permisoIds: [] })
    expect(res.status).toBe(403)
    expect(await prisma.rolPermiso.count({ where: { rol_id: editor.id } })).toBe(antes)
  })
})

// ── H11 · Creación de institución con autoasignación de administrador ───────
describe('H11 Creación de institución', () => {
  it('CI-H11-01 Creación exitosa de institución', async () => {
    const res = await request(app).post('/api/instituciones').set(auth(ctx.usuarios.lector.token))
      .send({ nombre: `__test__Universidad H11 ${Date.now()}`, dominio: 'unicesar.edu.co', logo_url: 'https://unicesar.edu.co/logo.png' })
    expect(res.status).toBe(201)
    const vinculo = await prisma.usuarioInstitucion.findFirst({ where: { usuario_id: ctx.usuarios.lector.id, institucion_id: res.body.data.id }, include: { rol: true } })
    expect(vinculo.rol.nombre).toBe('admin')
    expect(await prisma.auditoria.findFirst({ where: { accion: 'CREAR_INSTITUCION', entidad_id: res.body.data.id } })).not.toBeNull()
  })

  it('CI-H11-02 Institución sin nombre', async () => {
    const antes = await prisma.institucion.count()
    const res = await request(app).post('/api/instituciones').set(auth(ctx.usuarios.admin.token)).send({ nombre: '' })
    expect(res.status).toBe(400)
    expect(await prisma.institucion.count()).toBe(antes)
  })

  it('CI-H11-03 Usuario con email no verificado', async () => {
    const u = await nuevoUsuario('h1103', { rol: null })
    const { token } = await login(u.sufijo)
    await prisma.usuario.update({ where: { id: u.id }, data: { email_verificado: false } })
    const res = await request(app).post('/api/instituciones').set(auth(token)).send({ nombre: '__test__Sin verificar' })
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/verificar tu email/)
  })
})
