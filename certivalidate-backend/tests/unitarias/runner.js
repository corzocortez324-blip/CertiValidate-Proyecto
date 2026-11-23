/**
 * Ejecutor de las pruebas unitarias del documento (sección 2.3).
 *
 * casos.json se genera desde la especificación del documento y contiene, por módulo:
 *  - casos: los casos de prueba de caja negra (clases de equivalencia y valores límite),
 *    que se ejecutan con una petición HTTP real (validadores, permisos y controlador);
 *  - caminos: los caminos independientes del método (caja blanca), que se ejecutan
 *    llamando directamente al método del controlador.
 *
 * Uso: npm run test:caso -- tests/unitarias/01-login.test.js -t "CP-005"
 */
const crypto = require('crypto')
const request = require('supertest')
const app = require('../../src/app')
const prisma = require('../../src/utils/prisma')
const {
  cleanupTestData,
  createTestUser,
  createTestInstitucion,
  linkUserToInstitucion,
  createTestPlantilla,
  enableTest2FA,
} = require('../helpers/db')
const CASOS = require('./casos.json')

const P = 'TestPass123'
const DOMINIO = 'certivalidate.test'

module.exports = (numero) => {
  const mod = CASOS[String(numero)]
  const U = `${Date.now()}`
  const fx = {}
  const tokens = {}
  const institucionesCreadas = []
  let ipSeq = 0

  const ipNueva = () => {
    ipSeq += 1
    return `10.${numero}.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}`
  }

  const reemplazar = (valor, ctx) => {
    if (typeof valor === 'string') {
      return valor.replace(/\$\{(\w+)\}/g, (_, k) => {
        if (k in ctx) return ctx[k]
        if (k in fx) return fx[k]
        throw new Error(`Marcador sin valor: ${k}`)
      })
    }
    if (Array.isArray(valor)) return valor.map((v) => reemplazar(v, ctx))
    if (valor && typeof valor === 'object') {
      return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, reemplazar(v, ctx)]))
    }
    return valor
  }

  const login = async (email, password = P) => {
    const r = await request(app).post('/api/auth/login').set('X-Forwarded-For', ipNueva()).send({ email, password })
    return r.body?.data?.token
  }

  const emitir = async (estudiante) => {
    const r = await request(app)
      .post('/api/certificados/emitir')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ estudiante_id: estudiante, institucion_id: fx.inst, plantilla_id: fx.pla, provider: 'local-db' })
    if (r.status !== 201) throw new Error(`No se pudo emitir el certificado previo (${r.status})`)
  }

  const integrar = async (institucion) => {
    const r = await request(app)
      .post('/api/integraciones')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ institucion_id: institucion, tipo: 'REST', url_base: 'https://api.previa.edu.co', api_key: 'previa-1' })
    if (r.status !== 201) throw new Error(`No se pudo crear la integración previa (${r.status})`)
  }

  /** Prepara el estado que pide el caso (usuario propio, intentos fallidos, etc.). */
  const preparar = async (id, previo = {}) => {
    const ctx = { U, ip: ipNueva() }
    if (previo.usuario) {
      // en minúsculas: el validador del login normaliza el correo
      const sufijo = `u${numero}_${id.replace(/\W/g, '').toLowerCase()}_${crypto.randomBytes(3).toString('hex')}_${U}`
      const u = await createTestUser(sufijo)
      if (previo.usuario.activo === false) await prisma.usuario.update({ where: { id: u.id }, data: { activo: false } })
      if (previo.usuario.eliminado) await prisma.usuario.update({ where: { id: u.id }, data: { deleted_at: new Date() } })
      if (previo.usuario.totp) await enableTest2FA(u.id)
      ctx.email = u.email
      ctx.usuarioId = u.id
    }
    if (previo.fallidos) {
      await prisma.intentoLogin.createMany({
        data: Array.from({ length: previo.fallidos }, () => ({ email: ctx.email.toLowerCase(), ip_address: ipNueva(), exitoso: false })),
      })
    }
    if (previo.fallidosIp) {
      await prisma.intentoLogin.createMany({
        data: Array.from({ length: previo.fallidosIp }, (_, k) => ({ email: `__test__ip${k}_${U}@${DOMINIO}`, ip_address: ctx.ip, exitoso: false })),
      })
    }
    if (previo.emitirAntes) await emitir(fx.estB)
    if (previo.emitirAntesC) await emitir(fx.estC)
    if (previo.integracionPrevia) await integrar(fx.inst)
    if (previo.integracionPreviaC) await integrar(fx.instC)
    return ctx
  }

  const leer = (obj, ruta) => ruta.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)

  beforeAll(async () => {
    // Intentos de inicio de sesión de corridas anteriores (solo base de pruebas)
    await prisma.intentoLogin.deleteMany({ where: { OR: [{ email: { startsWith: '__test__' } }, { ip_address: { startsWith: `10.${numero}.` } }] } })

    const inst = await createTestInstitucion(`u${numero}_${U}`)
    await prisma.institucion.update({ where: { id: inst.id }, data: { dominio: DOMINIO } })
    const instOtra = await createTestInstitucion(`u${numero}_otra_${U}`)
    const extra = await Promise.all(['b', 'c', 'd'].map((s) => createTestInstitucion(`u${numero}_${s}_${U}`)))
    Object.assign(fx, { inst: inst.id, instOtra: instOtra.id, instB: extra[0].id, instC: extra[1].id, instD: extra[2].id })

    const admin = await createTestUser(`u${numero}_admin_${U}`)
    for (const i of [inst, ...extra]) await linkUserToInstitucion(admin.id, i.id, 'admin')
    const lector = await createTestUser(`u${numero}_lector_${U}`)
    await linkUserToInstitucion(lector.id, inst.id, 'lector')
    const noVerif = await createTestUser(`u${numero}_noverif_${U}`)
    await prisma.usuario.update({ where: { id: noVerif.id }, data: { email_verificado: false } })
    fx.emailAdmin = admin.email
    fx.adminId = admin.id
    tokens.admin = await login(admin.email)
    tokens.lector = await login(lector.email)
    tokens.noVerif = await login(noVerif.email)

    const est = (i, sufijo, documento) =>
      prisma.estudiante.create({ data: { institucion_id: i, nombre: 'Estudiante', apellido: `Prueba ${sufijo}`, documento: documento || `EST${sufijo}${U}` } })
    fx.doc3 = 'D03'
    fx.doc4 = 'D004'
    fx.doc49 = 'D'.padEnd(49, '9')
    fx.doc50 = 'D'.padEnd(50, '5')
    const [e1, e2, e3, e4, eo, d3, d4, d49, d50, ex] = await Promise.all([
      est(inst.id, 'a'), est(inst.id, 'b'), est(inst.id, 'c'), est(inst.id, 'd'), est(instOtra.id, 'o'),
      est(inst.id, 'd3', fx.doc3), est(inst.id, 'd4', fx.doc4), est(inst.id, 'd49', fx.doc49), est(inst.id, 'd50', fx.doc50),
      est(inst.id, 'ex', `DOCEX-${U}`),
    ])
    Object.assign(fx, {
      est: e1.id, estB: e2.id, estC: e3.id, estD: e4.id, estOtra: eo.id,
      estDoc3: d3.id, estDoc4: d4.id, estDoc49: d49.id, estDoc50: d50.id, docExistente: ex.documento,
    })
    const pla = await createTestPlantilla(inst.id, `u${numero}_${U}`)
    const plaInactiva = await createTestPlantilla(inst.id, `u${numero}_inactiva_${U}`)
    await prisma.plantillaCertificado.update({ where: { id: plaInactiva.id }, data: { activa: false } })
    const plaOtra = await createTestPlantilla(instOtra.id, `u${numero}_otra_${U}`)
    Object.assign(fx, { pla: pla.id, plaInactiva: plaInactiva.id, plaOtra: plaOtra.id, noexiste: crypto.randomUUID() })
  })

  afterAll(async () => {
    if (institucionesCreadas.length) {
      await prisma.auditoria.deleteMany({ where: { institucion_id: { in: institucionesCreadas } } }).catch(() => {})
      await prisma.usuarioInstitucion.deleteMany({ where: { institucion_id: { in: institucionesCreadas } } })
      await prisma.institucion.deleteMany({ where: { id: { in: institucionesCreadas } } })
    }
    await prisma.intentoLogin.deleteMany({ where: { OR: [{ email: { startsWith: '__test__' } }, { ip_address: { startsWith: `10.${numero}.` } }] } })
    await cleanupTestData()
    await prisma.$disconnect()
  })

  describe(`Módulo ${numero}`, () => {
    describe('Caja negra', () => {
      for (const c of mod.casos) {
        it(`${c.id} - ${c.desc}`, async () => {
          const ctx = await preparar(c.id, c.previo)
          const auth = c.auth === 'nuevo' ? await login(ctx.email) : c.auth ? tokens[c.auth] : null
          let req = request(app)[mod.metodo](mod.endpoint).set('X-Forwarded-For', ctx.ip)
          if (auth) req = req.set('Authorization', `Bearer ${auth}`)
          const res = await req.send(reemplazar(c.body, ctx))
          if (mod.endpoint === '/api/instituciones' && res.status === 201) institucionesCreadas.push(res.body.data.id)
          expect(res.status).toBe(c.status)
          if (c.msg) expect(JSON.stringify(res.body)).toContain(c.msg)
          for (const [ruta, valor] of Object.entries(c.campo || {})) expect(leer(res.body, ruta)).toBe(valor)
        })
      }
    })

    describe('Camino básico', () => {
      const [archivo, metodo] = mod.ctrl
      const controlador = require(`../../src/controllers/${archivo}`)
      for (const c of mod.caminos) {
        it(`${c.camino} (${c.ref}) - nodos ${c.nodos.join('-')}: ${c.escenario}`, async () => {
          const ctx = await preparar(c.ref, c.previo)
          const usuarioId = c.usuario === 'nuevo' ? ctx.usuarioId : c.usuario === 'inexistente' ? crypto.randomUUID() : fx.adminId
          const req = {
            body: reemplazar(c.body, ctx),
            ip: ctx.ip,
            headers: { 'user-agent': 'jest-camino-basico' },
            usuario: { id: usuarioId },
            institucionIds: c.institucionIds ? reemplazar(c.institucionIds, ctx) : [fx.inst, fx.instB, fx.instC, fx.instD],
            requestId: `camino-${c.camino}`,
          }
          const res = {
            statusCode: null,
            body: null,
            status(code) { this.statusCode = code; return this },
            json(b) { this.body = b; return this },
            setHeader() {}, set() { return this }, send(b) { this.body = b; return this },
          }
          await controlador[metodo](req, res)
          if (archivo === 'institucion.controller' && res.statusCode === 201) institucionesCreadas.push(res.body.data.id)
          expect(res.statusCode).toBe(c.status)
        })
      }
    })
  })
}
