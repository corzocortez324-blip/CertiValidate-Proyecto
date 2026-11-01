/**
 * Pruebas de integración basadas en hilos H12–H22 (apartado 2.4.2). Cada `it`
 * corresponde a un caso CI-Hxx-yy y comprueba la salida esperada de su diseño.
 * La exportación a Excel/PDF (H14-03, H22-01/02) y la validación de formato del
 * formulario (H16-03) se completan en el frontend (src/__tests__/integracion).
 */
jest.mock('../../src/services/blockchain.service', () => {
  const actual = jest.requireActual('../../src/services/blockchain.service')
  return { ...actual, registerHashOnBlockchain: jest.fn(actual.registerHashOnBlockchain) }
})

const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { generateSync } = require('otplib')
const { iniciarBlockchainLocal } = require('./blockchain-local')
const { app, prisma, request, auth, login, emailDe, PASSWORD, crearEscenario, crearApiAcademica } = require('./escenario')
const { emitirValido, verificarCodigo, revocarComo, configurarIntegracion, asegurarIntegracion } = require('./pasos')
const blockchainService = require('../../src/services/blockchain.service')
const { procesarTransaccionesPendientes } = require('../../src/services/blockchain-worker.service')
const { decrypt } = require('../../src/utils/crypto')
const { createTestUser, createTestInstitucion, linkUserToInstitucion, cleanupTestData } = require('../helpers/db')

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex')

let ctx
let api
let red

beforeAll(async () => {
  red = await iniciarBlockchainLocal()
  ctx = await crearEscenario(`hilos2_${Date.now()}`)
  api = await crearApiAcademica()
}, 60000)
afterAll(async () => { await api.cerrar(); await red.detener(); await cleanupTestData() })
beforeEach(() => api.reiniciar())

const nuevoUsuario = async (nombre, { rol = 'admin', inst = ctx.inst } = {}) => {
  const sufijo = `${nombre}_${ctx.tag}_${Date.now()}`.toLowerCase()
  const u = await createTestUser(sufijo)
  if (rol) await linkUserToInstitucion(u.id, inst.id, rol)
  return { ...u, sufijo, email: emailDe(sufijo) }
}

const probarConexion = (escenario) =>
  request(app).post(`/api/instituciones/${escenario.inst.id}/probar-conexion`).set(auth(escenario.usuarios.admin.token))

// ── H12 · Configuración de integración (AES-256-GCM) ────────────────────────
describe('H12 Configuración de integración', () => {
  let esc
  beforeAll(async () => { esc = await crearEscenario(`h12_${Date.now()}`) })

  it('CI-H12-01 Guardar integración con cifrado de la API key', async () => {
    const data = await configurarIntegracion(esc, api, 'clave-secreta-h12')
    expect(JSON.stringify(data)).not.toContain('clave-secreta-h12')
    const integ = await prisma.integracion.findUnique({ where: { institucion_id: esc.inst.id } })
    expect(integ.api_key.split(':')).toHaveLength(3)
    expect(decrypt(integ.api_key)).toBe('clave-secreta-h12')
    expect(integ.activa).toBe(true)
    const audit = await prisma.auditoria.findFirst({ where: { accion: 'CREAR_INTEGRACION', entidad_id: integ.id } })
    expect(audit.valores_despues).toContain('[CIFRADA]')
  })

  it('CI-H12-02 Probar conexión exitosa', async () => {
    await asegurarIntegracion(esc, api, 'clave-secreta-h12')
    const antes = (await prisma.integracion.findUnique({ where: { institucion_id: esc.inst.id } })).ultima_verificacion
    const res = await probarConexion(esc)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ estado: 'conectado', disponible: true })
    expect(api.rutas).toContain('GET /health')
    expect(api.apiKeys).toContain('clave-secreta-h12') // descifrada antes de llamar
    const despues = (await prisma.integracion.findUnique({ where: { institucion_id: esc.inst.id } })).ultima_verificacion
    expect(despues).not.toEqual(antes)
    // Solo quien administra la institución puede probar la conexión
    const lector = await request(app).post(`/api/instituciones/${esc.inst.id}/probar-conexion`).set(auth(esc.usuarios.lector.token))
    expect(lector.status).toBe(403)
  })

  it('CI-H12-03 Probar conexión sin respuesta (timeout de 5 s)', async () => {
    await asegurarIntegracion(esc, api, 'clave-secreta-h12')
    api.modo = 'lento'
    const inicio = Date.now()
    const res = await probarConexion(esc)
    expect(Date.now() - inicio).toBeLessThan(6500)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ estado: 'sin_conexion', disponible: false, error: 'Timeout' })
  }, 30000)
})

// ── H13 · Sincronización desde la API académica ─────────────────────────────
describe('H13 Sincronización', () => {
  let esc
  beforeAll(async () => { esc = await crearEscenario(`h13_${Date.now()}`) })
  const sincronizar = (entidades) =>
    request(app).post(`/api/integraciones/${esc.inst.id}/sincronizar`).set(auth(esc.usuarios.admin.token)).send({ entidades })

  it('CI-H13-01 Sincronización exitosa de dos entidades', async () => {
    await configurarIntegracion(esc, api, 'clave-h13')
    api.estudiantes = [
      { documento: `S1${esc.tag}`, nombre: 'Sara', apellido: 'Uno' },
      { documento: `S2${esc.tag}`, nombre: 'Saul', apellido: 'Dos' },
    ]
    api.plantillas = []
    api.certificados = [{ codigo: `C${Date.now()}`.slice(0, 16), estudiante_documento: `S1${esc.tag}`, plantilla_nombre: esc.plantilla.nombre, fecha_emision: new Date().toISOString(), estado: 'valido' }]
    api.reiniciar()
    const res = await sincronizar(['estudiantes', 'certificados'])
    expect(res.status).toBe(200)
    expect(api.apiKeys).toContain('clave-h13')
    expect(res.body.data.estudiantes).toMatchObject({ recibidos: 2, created: 2, updated: 0 })
    expect(res.body.data.certificados).toMatchObject({ recibidos: 1, created: 1, updated: 0 })
    expect(await prisma.auditoria.findFirst({ where: { accion: 'SINCRONIZAR_DATOS', entidad_id: esc.inst.id } })).not.toBeNull()
  })

  it('CI-H13-02 Sincronización parcial (una entidad no disponible)', async () => {
    await asegurarIntegracion(esc, api, 'clave-h13')
    api.modo = 'certificadosCaidos'
    api.estudiantes = [{ documento: `S3${esc.tag}`, nombre: 'Sol', apellido: 'Tres' }]
    api.certificados = []
    const res = await sincronizar(['estudiantes', 'certificados'])
    expect(res.status).toBe(200)
    expect(res.body.data.estudiantes.recibidos).toBe(1)
    expect(res.body.data.certificados.error).toBeDefined()
    expect(res.body.message).toMatch(/parciales/)
  })

  it('CI-H13-03 Institución sin integración', async () => {
    const otra = await crearEscenario(`h13b_${Date.now()}`)
    const antes = await prisma.estudiante.count({ where: { institucion_id: otra.inst.id } })
    const res = await request(app).post(`/api/integraciones/${otra.inst.id}/sincronizar`).set(auth(otra.usuarios.admin.token)).send({ entidades: ['estudiantes'] })
    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/No hay integración activa/)
    expect(await prisma.estudiante.count({ where: { institucion_id: otra.inst.id } })).toBe(antes)
  })
})

// ── H14 · Consulta del log de auditoría ─────────────────────────────────────
describe('H14 Log de auditoría', () => {
  let esc
  beforeAll(async () => {
    esc = await crearEscenario(`h14_${Date.now()}`)
    await prisma.auditoria.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        usuario_id: esc.usuarios.admin.id, accion: 'CONSULTA_PRUEBA', entidad: 'Prueba', entidad_id: crypto.randomUUID(),
        institucion_id: esc.inst.id, ip: '127.0.0.1', valores_despues: JSON.stringify({ i }),
      })),
    })
  })

  it('CI-H14-01 Listar auditoría con paginación y alcance por institución', async () => {
    const res = await request(app).get('/api/auditoria?page=1&limit=20').set(auth(esc.usuarios.admin.token))
    expect(res.status).toBe(200)
    const { data, meta } = res.body.data
    expect(data).toHaveLength(20)
    expect(meta.total).toBeGreaterThanOrEqual(25)
    expect(meta.totalPages).toBe(Math.ceil(meta.total / 20))
    for (const fila of data) {
      expect(fila.institucion_id === esc.inst.id || fila.usuario_id === esc.usuarios.admin.id).toBe(true)
    }
    const ajeno = await request(app).get('/api/auditoria?accion=CONSULTA_PRUEBA').set(auth(esc.usuarios.ajeno.token))
    expect(ajeno.body.data.meta.total).toBe(0) // otra institución no ve estos registros
  })

  it('CI-H14-02 Filtrar por entidad, acción y fechas, y ver el detalle', async () => {
    const certs = [await emitirValido(esc), await emitirValido(esc), await emitirValido(esc)]
    for (const c of certs) await revocarComo(esc.usuarios.admin.token, c.id)
    const hoy = new Date()
    const desde = new Date(hoy.getTime() - 3600000).toISOString()
    const hasta = new Date(hoy.getTime() + 3600000).toISOString()
    const res = await request(app).get(`/api/auditoria?entidad=Certificado&accion=REVOCAR_CERTIFICADO&fecha_desde=${desde}&fecha_hasta=${hasta}`)
      .set(auth(esc.usuarios.admin.token))
    expect(res.status).toBe(200)
    expect(res.body.data.meta.total).toBe(3)
    expect(res.body.data.data.every((a) => a.accion === 'REVOCAR_CERTIFICADO' && a.entidad === 'Certificado')).toBe(true)

    const detalle = await request(app).get(`/api/auditoria/Certificado/${certs[0].id}`).set(auth(esc.usuarios.admin.token))
    expect(detalle.status).toBe(200)
    const evento = JSON.stringify(detalle.body.data)
    for (const campo of ['usuario', 'ip', 'entidad', 'valores_antes', 'valores_despues']) expect(evento).toContain(campo)
  })

  it('CI-H14-03 Consulta sin permiso de auditoría', async () => {
    const sinPermiso = await nuevoUsuario('h1403', { rol: null })
    const { token } = await login(sinPermiso.sufijo)
    const res = await request(app).get('/api/auditoria').set(auth(token))
    expect(res.status).toBe(403)
    expect(res.body.data ?? null).toBeNull()
  })
})

// ── H15 · Anclaje de certificado en blockchain ──────────────────────────────
describe('H15 Anclaje en blockchain', () => {
  const registrar = (id) => request(app).post(`/api/certificados/${id}/blockchain/register`).set(auth(ctx.usuarios.admin.token))
  const ultimaTx = (id) => prisma.blockchainTransaccion.findFirst({ where: { certificado_id: id }, orderBy: { created_at: 'desc' } })
  afterEach(() => blockchainService.registerHashOnBlockchain.mockImplementation(jest.requireActual('../../src/services/blockchain.service').registerHashOnBlockchain))

  it('CI-H15-01 Anclaje confirmado (pasa por estado pendiente)', async () => {
    const c = await emitirValido(ctx)
    let estadoDuranteEnvio
    blockchainService.registerHashOnBlockchain.mockImplementation(async (hash) => {
      estadoDuranteEnvio = (await ultimaTx(c.id)).estado
      return jest.requireActual('../../src/services/blockchain.service').registerHashOnBlockchain(hash)
    })
    const res = await registrar(c.id)
    expect(res.status).toBe(201)
    expect(estadoDuranteEnvio).toBe('pendiente')
    const tx = await ultimaTx(c.id)
    expect(tx).toMatchObject({ estado: 'confirmado', intentos: 0 })
    expect(tx.tx_hash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(tx.red).toBe('ganache-local')
    expect(tx.confirmado_en).not.toBeNull()

    // El worker confirma las transacciones que quedaron pendientes
    const otro = await emitirValido(ctx)
    const pendiente = await prisma.blockchainTransaccion.create({
      data: { certificado_id: otro.id, hash: blockchainService.generateCertificateHash(otro), red: 'ganache-local', estado: 'pendiente', intentos: 1 },
    })
    const resumen = await procesarTransaccionesPendientes()
    expect(resumen.confirmadas).toBeGreaterThanOrEqual(1)
    const procesada = await prisma.blockchainTransaccion.findUnique({ where: { id: pendiente.id } })
    expect(procesada).toMatchObject({ estado: 'confirmado', error_mensaje: null })
    expect(procesada.tx_hash).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('CI-H15-02 Error de red con reintentos hasta fallo', async () => {
    const c = await emitirValido(ctx)
    blockchainService.registerHashOnBlockchain.mockRejectedValue(Object.assign(new Error('Red no disponible'), { statusCode: 503 }))
    for (let intento = 1; intento <= 3; intento++) {
      expect((await registrar(c.id)).status).toBe(503)
      expect(await ultimaTx(c.id)).toMatchObject({ intentos: intento, estado: intento < 3 ? 'pendiente' : 'fallido' })
    }
  })

  it('CI-H15-03 Visualización pública del anclaje', async () => {
    const c = await emitirValido(ctx)
    await registrar(c.id)
    const tx = await ultimaTx(c.id)
    const v = await verificarCodigo(c.codigo_unico)
    expect(v.blockchain).toMatchObject({ registered: true, verified: true, integrityStatus: 'valid', network: 'ganache-local' })
    expect(v.blockchain.txHashMasked).toContain(tx.tx_hash.slice(0, 10))
    expect(v.blockchain.registeredAt).toBeTruthy()
  })
})

// ── H16 · Cambio de contraseña y cierre de sesiones ─────────────────────────
describe('H16 Cambio de contraseña', () => {
  const cambiar = (token, currentPassword, newPassword) =>
    request(app).put('/api/auth/perfil/password').set(auth(token)).send({ currentPassword, newPassword })

  it('CI-H16-01 Cambio de contraseña exitoso cierra todas las sesiones', async () => {
    const u = await nuevoUsuario('h1601')
    const d1 = await login(u.sufijo)
    const d2 = await login(u.sufijo) // segundo dispositivo
    expect(await prisma.sesionActiva.count({ where: { usuario_id: u.id } })).toBe(2)
    await new Promise((r) => setTimeout(r, 1100)) // el iat del JWT tiene resolución de segundos
    const res = await cambiar(d1.token, PASSWORD, 'Nueva1234')
    expect(res.status).toBe(200)
    // El access token emitido antes del cambio deja de ser válido
    const viejo = await request(app).get('/api/auth/perfil').set(auth(d2.token))
    expect(viejo.status).toBe(401)
    expect(await prisma.sesionActiva.count({ where: { usuario_id: u.id } })).toBe(0)
    expect(await prisma.refreshToken.count({ where: { usuario_id: u.id, revoked_at: null } })).toBe(0)
    expect(await prisma.auditoria.findFirst({ where: { accion: 'CAMBIAR_PASSWORD', usuario_id: u.id } })).not.toBeNull()
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: 'Nueva1234' })).status).toBe(200)
  })

  it('CI-H16-02 Contraseña actual incorrecta', async () => {
    const u = await nuevoUsuario('h1602')
    const { token } = await login(u.sufijo)
    const hashAntes = (await prisma.usuario.findUnique({ where: { id: u.id } })).password_hash
    const res = await cambiar(token, 'Erronea1', 'Nueva1234')
    expect(res.status).toBe(400)
    expect((await prisma.usuario.findUnique({ where: { id: u.id } })).password_hash).toBe(hashAntes)
    expect(await prisma.sesionActiva.count({ where: { usuario_id: u.id } })).toBe(1)
  })

  it('CI-H16-03 Nueva contraseña con formato inválido (valores límite)', async () => {
    const u = await nuevoUsuario('h1603')
    const { token } = await login(u.sufijo)
    expect((await cambiar(token, PASSWORD, 'Ab1')).status).toBe(400)
    expect((await cambiar(token, PASSWORD, 'Abcdef1')).status).toBe(400) // 7 caracteres
    expect((await cambiar(token, PASSWORD, 'Abcdefg1')).status).toBe(200) // 8 caracteres
  })
})

// ── H17 · Configuración y activación de 2FA ─────────────────────────────────
describe('H17 Activación de 2FA', () => {
  it('CI-H17-01 Activación exitosa de 2FA', async () => {
    const u = await nuevoUsuario('h1701')
    const { token } = await login(u.sufijo)
    const setup = await request(app).get('/api/auth/2fa/setup').set(auth(token))
    expect(setup.status).toBe(200)
    expect(setup.body.data.qrDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(setup.body.data.secret).toBeTruthy()
    const enable = await request(app).post('/api/auth/2fa/enable').set(auth(token)).send({ code: generateSync(setup.body.data.secret) })
    expect(enable.status).toBe(200)
    expect((await prisma.usuario.findUnique({ where: { id: u.id } })).totp_enabled).toBe(true)
    const siguiente = await request(app).post('/api/auth/login').send({ email: u.email, password: PASSWORD })
    expect(siguiente.body.data.requires2FA).toBe(true)
  })

  it('CI-H17-02 Código inválido al activar', async () => {
    const u = await nuevoUsuario('h1702')
    const { token } = await login(u.sufijo)
    await request(app).get('/api/auth/2fa/setup').set(auth(token))
    const res = await request(app).post('/api/auth/2fa/enable').set(auth(token)).send({ code: '000000' })
    expect(res.status).toBe(400)
    expect((await prisma.usuario.findUnique({ where: { id: u.id } })).totp_enabled).toBe(false)
  })

  it('CI-H17-03 Solicitud sin sesión válida', async () => {
    const u = await nuevoUsuario('h1703')
    expect((await request(app).get('/api/auth/2fa/setup')).status).toBe(401)
    const expirado = jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: -10 })
    expect((await request(app).get('/api/auth/2fa/setup').set(auth(expirado))).status).toBe(401)
    expect((await prisma.usuario.findUnique({ where: { id: u.id } })).totp_secret).toBeNull()
  })
})

// ── H18 · Gestión de sesiones activas ───────────────────────────────────────
describe('H18 Sesiones activas', () => {
  it('CI-H18-01 Listar sesiones activas sin exponer token_hash', async () => {
    const u = await nuevoUsuario('h1801')
    const { token } = await login(u.sufijo)
    await login(u.sufijo)
    await login(u.sufijo)
    const res = await request(app).get('/api/auth/sesiones').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.sesiones).toHaveLength(3)
    for (const s of res.body.data.sesiones) {
      expect(s).toEqual(expect.objectContaining({ id: expect.any(String), ip: expect.anything(), created_at: expect.any(String) }))
      expect(s).not.toHaveProperty('token_hash')
    }
  })

  it('CI-H18-02 Cerrar sesión propia; la ajena no se cierra', async () => {
    const u = await nuevoUsuario('h1802')
    const { token } = await login(u.sufijo)
    const otraSesion = await login(u.sufijo)
    const propia = await prisma.sesionActiva.findFirst({ where: { usuario_id: u.id, token_hash: sha256(otraSesion.refreshToken) } })
    const res = await request(app).delete(`/api/auth/sesiones/${propia.id}`).set(auth(token))
    expect(res.status).toBe(200)
    expect(await prisma.sesionActiva.findUnique({ where: { id: propia.id } })).toBeNull()
    expect((await prisma.refreshToken.findFirst({ where: { token_hash: sha256(otraSesion.refreshToken) } })).revoked_at).not.toBeNull()

    const ajena = await prisma.sesionActiva.findFirst({ where: { usuario_id: ctx.usuarios.ajeno.id } })
    const intento = await request(app).delete(`/api/auth/sesiones/${ajena.id}`).set(auth(token))
    expect(intento.status).toBe(403)
    expect(await prisma.sesionActiva.findUnique({ where: { id: ajena.id } })).not.toBeNull()
  })

  it('CI-H18-03 Cerrar todas las sesiones', async () => {
    const u = await nuevoUsuario('h1803')
    const { token } = await login(u.sufijo)
    await login(u.sufijo)
    const res = await request(app).delete('/api/auth/sesiones/todas').set(auth(token))
    expect(res.status).toBe(200)
    expect(await prisma.sesionActiva.count({ where: { usuario_id: u.id } })).toBe(0)
    expect(await prisma.refreshToken.count({ where: { usuario_id: u.id, revoked_at: null } })).toBe(0)
  })
})

// ── H19 · Descarga de certificado en PDF ────────────────────────────────────
describe('H19 Descarga en PDF', () => {
  const descargar = (id, token) => {
    const r = request(app).get(`/api/certificados/descargar/${id}`)
    return (token ? r.set(auth(token)) : r).buffer(true)
      .parse((res, cb) => { const b = []; res.on('data', (x) => b.push(x)); res.on('end', () => cb(null, Buffer.concat(b))) })
  }

  it('CI-H19-01 Descarga exitosa del PDF', async () => {
    const c = await emitirValido(ctx)
    expect((await descargar(c.id)).status).toBe(401)
    const res = await descargar(c.id, ctx.usuarios.admin.token)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/pdf/)
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=.*\.pdf/)
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF')
    expect(res.body.toString('latin1')).toMatch(/\/Subtype\s*\/Image/)
  })

  it('CI-H19-02 Certificado de otra institución', async () => {
    const res = await descargar((await emitirValido(ctx)).id, ctx.usuarios.ajeno.token)
    expect(res.status).toBe(403)
    expect(res.headers['content-type']).not.toMatch(/pdf/)
  })

  it('CI-H19-03 Usuario sin permiso de descarga', async () => {
    const sinPermiso = await nuevoUsuario('h1903', { rol: null })
    const res = await descargar((await emitirValido(ctx)).id, (await login(sinPermiso.sufijo)).token)
    expect(res.status).toBe(403)
  })
})

// ── H20 · Estadísticas de institución ───────────────────────────────────────
describe('H20 Estadísticas de institución', () => {
  it('CI-H20-01 Consulta de estadísticas (categorías disjuntas)', async () => {
    const esc = await crearEscenario(`h20_${Date.now()}`)
    const validos = [await emitirValido(esc), await emitirValido(esc), await emitirValido(esc)]
    await revocarComo(esc.usuarios.admin.token, validos[1].id)
    await prisma.certificado.update({ where: { id: validos[2].id }, data: { fecha_expiracion: new Date(Date.now() - 86400000) } })
    const res = await request(app).get(`/api/instituciones/${esc.inst.id}/estadisticas`).set(auth(esc.usuarios.admin.token))
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d).toMatchObject({ certificados: 3, certificados_validos: 1, certificados_revocados: 1, certificados_expirados: 1 })
    expect(d.certificados_validos + d.certificados_revocados + d.certificados_expirados).toBe(d.certificados)
    expect(d.estudiantes).toBe(await prisma.estudiante.count({ where: { institucion_id: esc.inst.id } }))
    expect(d.plantillas).toBe(await prisma.plantillaCertificado.count({ where: { institucion_id: esc.inst.id } }))
  })

  it('CI-H20-02 Institución ajena', async () => {
    const res = await request(app).get(`/api/instituciones/${ctx.inst.id}/estadisticas`).set(auth(ctx.usuarios.ajeno.token))
    expect(res.status).toBe(403)
    expect(res.body.data ?? null).toBeNull()
  })

  it('CI-H20-03 Institución sin datos', async () => {
    const vacia = await createTestInstitucion(`H20_VACIA_${Date.now()}`)
    const adm = await nuevoUsuario('h2003', { inst: vacia })
    const res = await request(app).get(`/api/instituciones/${vacia.id}/estadisticas`).set(auth((await login(adm.sufijo)).token))
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ estudiantes: 0, plantillas: 0, certificados: 0, certificados_validos: 0, certificados_revocados: 0, certificados_expirados: 0, verificaciones_publicas: 0 })
  })
})

// ── H21 · Prueba de conexión con la API académica ───────────────────────────
describe('H21 Prueba de conexión', () => {
  let esc
  beforeAll(async () => { esc = await crearEscenario(`h21_${Date.now()}`) })

  it('CI-H21-01 Conexión exitosa', async () => {
    await configurarIntegracion(esc, api, 'clave-h21')
    api.reiniciar()
    const res = await probarConexion(esc)
    expect(res.body.data).toMatchObject({ estado: 'conectado', disponible: true })
    expect(api.apiKeys).toContain('clave-h21')
    expect((await prisma.integracion.findUnique({ where: { institucion_id: esc.inst.id } })).ultima_verificacion).not.toBeNull()
  })

  it('CI-H21-02 Timeout o error HTTP de la API externa', async () => {
    await asegurarIntegracion(esc, api, 'clave-h21')
    api.modo = 'lento'
    expect((await probarConexion(esc)).body.data).toMatchObject({ estado: 'sin_conexion', disponible: false, error: 'Timeout' })
    api.modo = 'error500'
    expect((await probarConexion(esc)).body.data).toMatchObject({ estado: 'sin_conexion', disponible: false, error: 'HTTP 500' })
  }, 30000)

  it('CI-H21-03 Institución sin integración', async () => {
    const otra = await crearEscenario(`h21b_${Date.now()}`)
    const res = await probarConexion(otra)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ estado: 'sin_configurar', disponible: false })
  })
})

// ── H22 · Exportación del reporte del dashboard (datos del backend) ─────────
describe('H22 Exportación del reporte', () => {
  it('CI-H22-01 Datos del reporte ejecutivo para el período elegido', async () => {
    const res = await request(app).get('/api/admin/stats?period=30d').set(auth(ctx.usuarios.admin.token))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(expect.objectContaining({ totalEmitidos: expect.any(Number), topEmisores: expect.any(Array), ultimasRevocaciones: expect.any(Array), tendencia: expect.any(Array) }))
    // Solo datos de la institución del administrador
    expect(res.body.data.totalEmitidos).toBe(await prisma.certificado.count({ where: { institucion_id: ctx.inst.id, deleted_at: null } }))
  })

  it('CI-H22-02 Datos del reporte completo (otro período)', async () => {
    const res = await request(app).get('/api/admin/stats?period=90d').set(auth(ctx.usuarios.admin.token))
    expect(res.status).toBe(200)
    expect(res.body.data.tendencia).toHaveLength(7) // 6 meses anteriores + el mes actual
  })

  it('CI-H22-03 Exportar sin permiso', async () => {
    const res = await request(app).get('/api/admin/stats?period=30d').set(auth(ctx.usuarios.lector.token))
    expect(res.status).toBe(403)
  })
})
