/**
 * Biblioteca de pasos de la integración incremental (apartado 2.4.1). Cada clave
 * es el código del paso en el documento — módulo hoja (N1, T3…) o interfaz entre
 * módulos (SN-N1, G1-ST…) — y la función comprueba su «Salida esperada».
 * Los pasos de interfaz web (P*, P1-*, CP-P1, SIS-CP) están en el frontend.
 */
const crypto = require('crypto')
const path = require('path')
const { spawn, execFileSync } = require('child_process')
const jwt = require('jsonwebtoken')
const { app, prisma, request, auth, emailDe } = require('./escenario')
const logger = require('../../src/utils/logger')
const { encrypt, decrypt } = require('../../src/utils/crypto')
const blockchainService = require('../../src/services/blockchain.service')
const academicApi = require('../../src/services/academic-api.service')
const academicProvider = require('../../src/services/academic-provider.service')
const { generarPDFBuffer } = require('../../src/utils/pdf.generator')

const BACKEND = path.resolve(__dirname, '../..')
let contador = 0
const unico = () => `${Date.now()}${++contador}`

/** Cadena canónica con la que se calcula hash_sha256 al emitir (y al verificar). */
const cadenaCanonica = (c) =>
  `${c.estudiante.id}|${c.estudiante.nombre}|${c.estudiante.apellido}|${c.estudiante.email || ''}|${c.institucion.id}|${c.institucion.nombre}|${c.plantilla.id}|${c.plantilla.nombre}|${c.codigo_unico}|${c.fecha_emision.toISOString()}`

const certCompleto = (id) =>
  prisma.certificado.findUnique({ where: { id }, include: { estudiante: true, institucion: true, plantilla: true } })

const configurarIntegracion = async (ctx, api, apiKey = 'clave-sandbox') => {
  const res = await request(app).post('/api/integraciones').set(auth(ctx.usuarios.admin.token))
    .send({ institucion_id: ctx.inst.id, tipo: 'REST', url_base: api.url, api_key: apiKey })
  expect(res.status).toBe(201)
  return res.body.data
}

const crearUsuarioEditor = async (ctx) => {
  const res = await request(app).post('/api/usuarios').set(auth(ctx.usuarios.admin.token))
    .send({ nombre: 'Emisor', apellido: 'Driver', email: emailDe(`n2_${ctx.tag}_${unico()}`), password: 'Clave1234', rol: 'editor' })
  expect(res.status).toBe(201)
  const vinculo = await prisma.usuarioInstitucion.findFirst({ where: { usuario_id: res.body.data.id }, include: { rol: true } })
  expect(vinculo.rol.nombre).toBe('editor')
  return res.body.data
}

const emitirValido = async (ctx) => {
  const res = await ctx.emitir()
  expect(res.status).toBe(201)
  expect(res.body.data.codigo_unico).toMatch(/^[0-9A-F]{16}$/i)
  expect(res.body.data.hash_sha256).toMatch(/^[0-9a-f]{64}$/)
  return res.body.data
}

const verificarCodigo = async (codigo) => {
  const res = await request(app).post('/api/certificados/verificar').send({ codigo })
  expect(res.status).toBe(200)
  return res.body.data
}

const revocarComo = (token, id) =>
  request(app).post(`/api/certificados/${id}/revocar`).set(auth(token))
    .send({ motivo_codigo: 'ERROR_DATOS', motivo_detalle: 'Prueba de integración' })

const espiarLogEmision = async (ctx) => {
  const spy = jest.spyOn(logger, 'info')
  try {
    const cert = await emitirValido(ctx)
    const llamada = spy.mock.calls.find(([obj, msg]) => /emitido exitosamente/.test(msg || '') && obj?.certificado_id === cert.id)
    expect(llamada).toBeDefined()
    return cert
  } finally {
    spy.mockRestore()
  }
}

/** Arranca `node src/index.js` con la BD de pruebas y consulta /health. */
const arrancarSistema = () => new Promise((resolve, reject) => {
  const port = 39000 + Math.floor(Math.random() * 900)
  const hijo = spawn(process.execPath, ['src/index.js'], {
    cwd: BACKEND, env: { ...process.env, NODE_ENV: 'test', PORT: String(port), LOG_LEVEL: 'info' },
  })
  const fin = setTimeout(() => { hijo.kill(); reject(new Error('El sistema no arrancó en 30 s')) }, 30000)
  hijo.stdout.on('data', async (d) => {
    if (!/iniciada/.test(String(d))) return
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`)
      resolve(await r.json())
    } catch (e) { reject(e) } finally { clearTimeout(fin); hijo.kill() }
  })
  hijo.on('error', reject)
})

const PASOS = {
  // ── Módulos hoja: Servicios de Negocio ────────────────────────────────────
  N1: async (ctx) => {
    const data = await (await request(app).post('/api/auth/login')
      .send({ email: emailDe(ctx.usuarios.lector.sufijo), password: 'TestPass123' })).body.data
    const access = jwt.decode(data.token)
    const refresh = jwt.decode(data.refreshToken)
    expect(access.exp - access.iat).toBe(15 * 60)
    expect(refresh.exp - refresh.iat).toBe(7 * 24 * 60 * 60)
  },
  N2: crearUsuarioEditor,
  N3: async (ctx) => { const c = await emitirValido(ctx); expect(c.estado).toBe('valido') },
  N4: async (ctx) => {
    const c = await emitirValido(ctx)
    const v = await verificarCodigo(c.codigo_unico)
    expect(v.estado).toBe('valido')
    expect(v.institucion).toBe(ctx.inst.nombre)
    expect(v.titular).toMatch(/\*/)
  },
  N5: async (ctx) => {
    const c = await emitirValido(ctx)
    const res = await revocarComo(ctx.usuarios.admin.token, c.id)
    expect(res.status).toBe(200)
    expect((await prisma.certificado.findUnique({ where: { id: c.id } })).estado).toBe('revocado')
    const rev = await prisma.revocacion.findFirst({ where: { certificado_id: c.id } })
    expect(rev.motivo_codigo).toBe('ERROR_DATOS')
  },
  N6: async (ctx) => {
    await emitirValido(ctx)
    const res = await request(app).get(`/api/instituciones/${ctx.inst.id}/estadisticas`).set(auth(ctx.usuarios.admin.token))
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.estudiantes).toBe(await prisma.estudiante.count({ where: { institucion_id: ctx.inst.id } }))
    expect(d.certificados).toBe(await prisma.certificado.count({ where: { institucion_id: ctx.inst.id, deleted_at: null } }))
    expect(d.certificados_revocados).toBe(await prisma.certificado.count({ where: { institucion_id: ctx.inst.id, estado: 'revocado', deleted_at: null } }))
  },
  N7: async (ctx) => {
    const c = await emitirValido(ctx)
    const a = await prisma.auditoria.findFirst({ where: { accion: 'EMITIR_CERTIFICADO', entidad_id: c.id } })
    expect(a.usuario_id).toBe(ctx.usuarios.admin.id)
    expect(a.fecha).toBeInstanceOf(Date)
  },

  // ── Módulos hoja: Servicios Transversales ─────────────────────────────────
  T1: async (ctx) => {
    const c = await certCompleto((await emitirValido(ctx)).id)
    const h1 = crypto.createHash('sha256').update(cadenaCanonica(c)).digest('hex')
    const h2 = crypto.createHash('sha256').update(cadenaCanonica(c)).digest('hex')
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
    expect(h1).toBe(h2)
    expect(h1).toBe(c.hash_sha256)
  },
  T2: async () => {
    expect(blockchainService.getBlockchainMode()).toBe('mock')
    const r = await blockchainService.registerHashOnBlockchain(crypto.randomBytes(32).toString('hex'))
    expect(r.txHash).toMatch(/^mock_tx_/)
    expect(r.status).toBe('confirmado')
  },
  T3: async () => {
    // En producción el logger escribe JSON (en desarrollo usa pino-pretty)
    const out = execFileSync(process.execPath, ['-e', "require('./src/utils/logger').info('mensaje de prueba')"], {
      cwd: BACKEND, env: { ...process.env, NODE_ENV: 'production', LOG_LEVEL: 'info' },
    }).toString().trim().split('\n').pop()
    const linea = JSON.parse(out)
    expect(linea).toMatchObject({ level: 30, msg: 'mensaje de prueba' })
    expect(typeof linea.time).toBe('number')
  },
  T4: async (ctx) => {
    const c = await certCompleto((await emitirValido(ctx)).id)
    const pdf = await generarPDFBuffer(c)
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(pdf.toString('latin1')).toMatch(/\/Subtype\s*\/Image/)
  },
  T5: async () => {
    const cifrada = encrypt('api-key-de-prueba')
    expect(cifrada.split(':')).toHaveLength(3)
    expect(decrypt(cifrada)).toBe('api-key-de-prueba')
  },

  // ── Módulos hoja: Persistencia y Sistemas Externos ────────────────────────
  D2: async () => {
    const filas = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    const tablas = filas.map((f) => f.table_name)
    for (const t of ['Usuario', 'Institucion', 'Certificado', 'Estudiante', 'PlantillaCertificado', 'Auditoria', 'Revocacion', 'Integracion', 'RefreshToken', 'SesionActiva']) {
      expect(tablas).toContain(t)
    }
  },
  E1: async (ctx, api) => {
    api.estudiantes = [{ documento: `E1${ctx.tag}`, nombre: 'Ana', apellido: 'Externa', email: 'ana@externa.test' }]
    api.reiniciar()
    const est = await academicApi.buscarEstudiantePorDocumento(`E1${ctx.tag}`, { url_base: api.url, api_key: 'sandbox' })
    expect(est.nombre).toBe('Ana')
    expect(api.apiKeys).toContain('sandbox')
  },
  E2: async () => PASOS.T2(),

  // ── Interfaces del nivel superior inmediato ───────────────────────────────
  'SN-N1': async (ctx) => {
    const res = await request(app).post('/api/auth/login').send({ email: emailDe(ctx.usuarios.editor.sufijo), password: 'TestPass123' })
    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeTruthy()
    expect(res.body.data.refreshToken).toBeTruthy()
  },
  'SN-N2': crearUsuarioEditor,
  'SN-N3': async (ctx) => {
    const c = await emitirValido(ctx)
    expect(c.pdf_url ?? null).toBeNull() // el PDF se genera bajo demanda (GET /descargar/:id)
  },
  'SN-N4': async (ctx) => expect((await verificarCodigo((await emitirValido(ctx)).codigo_unico)).estado).toBe('valido'),
  'SN-N5': async (ctx) => {
    const c = await emitirValido(ctx)
    expect((await revocarComo(ctx.usuarios.lector.token, c.id)).status).toBe(403)
    const res = await revocarComo(ctx.usuarios.admin.token, c.id)
    expect(res.status).toBe(200)
    expect(res.body.data.estado ?? (await prisma.certificado.findUnique({ where: { id: c.id } })).estado).toBe('revocado')
  },
  'SN-N6': async (ctx) => {
    const res = await request(app).get('/api/admin/stats').set(auth(ctx.usuarios.admin.token))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(expect.objectContaining({ totalEmitidos: expect.any(Number), tasaValidez: expect.any(Number), tendencia: expect.any(Array) }))
    // Las cifras corresponden a la institución del administrador, no al total global
    expect(res.body.data.totalEmitidos).toBe(await prisma.certificado.count({ where: { institucion_id: ctx.inst.id, deleted_at: null } }))
  },
  'SN-N7': async (ctx) => {
    const res = await request(app).get('/api/auditoria').set(auth(ctx.usuarios.admin.token))
    expect(res.status).toBe(200)
    expect(res.body.data.meta).toEqual({ page: 1, limit: 20, total: expect.any(Number), totalPages: expect.any(Number) })
    expect(res.body.data.meta.total).toBeGreaterThan(0) // el caso ya emitió y revocó certificados
    expect(Array.isArray(res.body.data.data)).toBe(true)
  },
  'ST-T1': async (ctx) => PASOS.T1(ctx),
  'ST-T2': async (ctx) => {
    const c = await emitirValido(ctx)
    const res = await request(app).post(`/api/certificados/${c.id}/blockchain/register`).set(auth(ctx.usuarios.admin.token))
    expect(res.status).toBe(201)
    expect(res.body.data.tx_hash).toMatch(/^mock_tx_/)
  },
  'ST-T3': espiarLogEmision,
  'ST-T4': async (ctx) => {
    const c = await emitirValido(ctx)
    const res = await request(app).get(`/api/certificados/descargar/${c.id}`).set(auth(ctx.usuarios.admin.token))
      .buffer(true).parse((r, cb) => { const b = []; r.on('data', (x) => b.push(x)); r.on('end', () => cb(null, Buffer.concat(b))) })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/pdf/)
    expect(res.body.toString('latin1')).toMatch(/\/Subtype\s*\/Image/)
  },
  'ST-T5': async (ctx, api) => {
    api.estudiantes = [{ documento: `T5${ctx.tag}`, nombre: 'Luis', apellido: 'Remoto' }]
    await configurarIntegracion(ctx, api, 'clave-t5')
    api.reiniciar()
    const res = await request(app).get(`/api/integraciones/${ctx.inst.id}/estudiantes`).set(auth(ctx.usuarios.admin.token))
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body.data)).toContain('Luis')
    expect(api.apiKeys).toContain('clave-t5') // descifrada internamente antes de llamar a la API
  },
  'D1-D2': async (ctx) => {
    const email = emailDe(`d1d2_${ctx.tag}_${unico()}`)
    const u = await prisma.usuario.create({ data: { nombre: 'Persistencia', apellido: 'Prueba', email, password_hash: 'x' } })
    expect((await prisma.usuario.findUnique({ where: { email } })).id).toBe(u.id)
    await expect(prisma.usuario.create({ data: { nombre: 'Dup', apellido: 'Dup', email, password_hash: 'x' } }))
      .rejects.toMatchObject({ code: 'P2002' })
  },
  'CE-E1': async (ctx, api) => {
    api.estudiantes = [{ documento: `CE${ctx.tag}`, nombre: 'Marta', apellido: 'Integrada' }]
    await configurarIntegracion(ctx, api, 'clave-ce')
    api.reiniciar()
    const est = await academicProvider.buscarEstudiante({ provider: 'external-api', documento: `CE${ctx.tag}`, institucionId: ctx.inst.id })
    expect(est.nombre).toBe('Marta')
    expect(api.apiKeys).toContain('clave-ce') // usa la integración de la institución
  },
  'CE-E2': async (ctx) => PASOS['ST-T2'](ctx),

  // ── Módulos intermedios y principal ───────────────────────────────────────
  'G1-SN': async (ctx) => {
    expect((await request(app).get('/api/auditoria')).status).toBe(401)
    expect((await request(app).get('/api/auditoria').set(auth(ctx.usuarios.admin.token))).status).toBe(200)
  },
  'G1-ST': espiarLogEmision,
  'CS-G1': async () => {
    const res = await request(app).get('/api/docs/').redirects(1)
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/swagger/i)
  },
  'CD-D1': async () => { await expect(prisma.$connect()).resolves.toBeUndefined() },
  'SIS-CS': async () => {
    expect((await request(app).get('/api/health')).status).toBe(404) // la ruta real es /health
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ status: 'online', db: 'ok' })
  },
  'SIS-CD': async () => { expect((await arrancarSistema()).data).toMatchObject({ status: 'online', db: 'ok' }) },
  'SIS-CE': async (ctx, api) => {
    await configurarIntegracion(ctx, api, 'clave-sis')
    const res = await request(app).post(`/api/instituciones/${ctx.inst.id}/probar-conexion`).set(auth(ctx.usuarios.admin.token))
    expect(res.body.data).toMatchObject({ estado: 'conectado', disponible: true })
    expect(blockchainService.getBlockchainMode()).toBe('mock')
  },
}

module.exports = { PASOS, emitirValido, verificarCodigo, revocarComo, configurarIntegracion, certCompleto, cadenaCanonica }
