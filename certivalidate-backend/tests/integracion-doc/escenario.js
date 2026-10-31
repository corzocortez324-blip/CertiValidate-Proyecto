/**
 * Escenario común de las pruebas de integración del documento (apartado 2.4):
 * institución, usuarios por rol, estudiante, plantilla y la API académica externa
 * (E1): la academic-api del proyecto con su propia base local. La red blockchain
 * (E2) es un nodo Ethereum local con el contrato CertiValidateRegistry
 * (ver tests/integracion-doc/blockchain-local.js).
 */
const crypto = require('crypto')
const http = require('http')
const net = require('net')
const path = require('path')
const { spawn } = require('child_process')
const { Client } = require('pg')
const request = require('supertest')
const app = require('../../src/app')
const prisma = require('../../src/utils/prisma')
const {
  createTestUser,
  createTestInstitucion,
  linkUserToInstitucion,
  createTestEstudiante,
  createTestPlantilla,
} = require('../helpers/db')

const PASSWORD = 'TestPass123'
// El login normaliza el correo a minúsculas: los sufijos también deben estarlo
const emailDe = (sufijo) => `__test__${String(sufijo).toLowerCase()}@certivalidate.test`

const login = async (sufijo, password = PASSWORD) => {
  const res = await request(app).post('/api/auth/login').send({ email: emailDe(sufijo), password })
  return res.body.data
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

const ACADEMIC_API_DIR = path.resolve(__dirname, '../../../academic-api')
const academicDbUrl = () =>
  process.env.ACADEMIC_TEST_DATABASE_URL ||
  process.env.DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/certivalidate_academic_test$1')

const puertoLibre = () => new Promise((resolve, reject) => {
  const srv = net.createServer()
  srv.once('error', reject)
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
})

/** Arranca la academic-api del proyecto (E1) con su propia base de datos local. */
const arrancarAcademicApi = async () => {
  const port = await puertoLibre()
  const hijo = spawn(process.execPath, ['src/index.js'], {
    cwd: ACADEMIC_API_DIR,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DATABASE_URL: academicDbUrl(), PORT: String(port), NODE_ENV: 'test' },
    stdio: 'ignore',
  })
  const url = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${url}/health`)).ok) return { url, hijo } } catch { /* aún arrancando */ }
    await new Promise((r) => setTimeout(r, 100))
  }
  hijo.kill()
  throw new Error('La academic-api no arrancó')
}

/** Deja la base de la academic-api con exactamente los estudiantes y certificados del caso. */
const sincronizarDatosAcademicos = async (db, estado) => {
  const firma = JSON.stringify([estado.estudiantes, estado.certificados])
  if (firma === estado.firmaDatos) return
  await db.query('DELETE FROM "Certificado"')
  await db.query('DELETE FROM "Estudiante"')
  const ids = new Map()
  const asegurarEstudiante = async (e) => {
    if (ids.has(e.documento)) return ids.get(e.documento)
    const id = crypto.randomUUID()
    await db.query(
      'INSERT INTO "Estudiante" (id, documento, nombre, apellido, email, programa, "estadoAcademico", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())',
      [id, e.documento, e.nombre, e.apellido, e.email ?? null, e.programa ?? 'Programa de prueba', e.estado ?? 'ACTIVO'],
    )
    ids.set(e.documento, id)
    return id
  }
  for (const e of estado.estudiantes) await asegurarEstudiante(e)
  for (const c of estado.certificados) {
    const estudianteId = await asegurarEstudiante({ documento: c.estudiante_documento, nombre: 'Titular', apellido: 'Certificado' })
    await db.query(
      'INSERT INTO "Certificado" (id, "estudianteId", tipo, titulo, estado, "fechaEmision", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW())',
      [c.codigo, estudianteId, 'CERTIFICADO', c.plantilla_nombre ?? 'Certificado', c.estado ?? 'DISPONIBLE', c.fecha_emision ? new Date(c.fecha_emision) : new Date()],
    )
  }
  estado.firmaDatos = firma
}

/**
 * API académica real (academic-api del proyecto) detrás de un proxy de pruebas
 * que registra rutas y x-api-key recibidas e inyecta fallos según `modo`:
 *  ok | error500 | lento (> 5 s) | certificadosCaidos (solo falla /certificados)
 */
const crearApiAcademica = async () => {
  const estado = { modo: 'ok', apiKeys: [], rutas: [], estudiantes: [], certificados: [], plantillas: [] }
  const real = await arrancarAcademicApi()
  const db = new Client({ connectionString: academicDbUrl() })
  await db.connect()

  const server = http.createServer(async (req, res) => {
    estado.apiKeys.push(req.headers['x-api-key'] || null)
    estado.rutas.push(`${req.method} ${req.url}`)
    const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (estado.modo === 'lento') { setTimeout(() => json(200, { status: 'ok' }), 6500); return }
    if (estado.modo === 'error500') return json(500, { error: 'falla simulada' })
    if (estado.modo === 'certificadosCaidos' && req.url.startsWith('/api/certificados')) return json(503, { error: 'No disponible' })
    try {
      await sincronizarDatosAcademicos(db, estado)
      const r = await fetch(`${real.url}${req.url}`, {
        method: req.method,
        headers: req.headers['x-api-key'] ? { 'x-api-key': req.headers['x-api-key'] } : {},
      })
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json' })
      res.end(Buffer.from(await r.arrayBuffer()))
    } catch (err) {
      json(502, { error: err.message })
    }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  estado.url = `http://127.0.0.1:${server.address().port}`
  estado.urlReal = real.url
  estado.cerrar = async () => {
    await new Promise((r) => { server.closeAllConnections?.(); server.close(r) })
    await db.end()
    real.hijo.kill()
  }
  estado.reiniciar = () => { estado.modo = 'ok'; estado.apiKeys = []; estado.rutas = [] }
  return estado
}

/** Crea institución, usuarios (admin, editor, lector), estudiante y plantilla. */
const crearEscenario = async (tagOriginal) => {
  const tag = String(tagOriginal).toLowerCase()
  const inst = await createTestInstitucion(`DOC_${tag}`)
  const otra = await createTestInstitucion(`DOC_OTRA_${tag}`)
  const usuarios = {}
  for (const rol of ['admin', 'editor', 'lector']) {
    const sufijo = `doc_${rol}_${tag}`
    const u = await createTestUser(sufijo)
    await linkUserToInstitucion(u.id, inst.id, rol)
    usuarios[rol] = { ...u, sufijo, ...(await login(sufijo)) }
  }
  const ajeno = await createTestUser(`doc_ajeno_${tag}`)
  await linkUserToInstitucion(ajeno.id, otra.id, 'admin')
  usuarios.ajeno = { ...ajeno, sufijo: `doc_ajeno_${tag}`, ...(await login(`doc_ajeno_${tag}`)) }

  const estudiante = await createTestEstudiante(inst.id, `DOC_${tag}`)
  await prisma.estudiante.update({ where: { id: estudiante.id }, data: { email: emailDe(`est_${tag}`) } })
  const plantilla = await createTestPlantilla(inst.id, `DOC_${tag}`)
  const estudianteAjeno = await createTestEstudiante(otra.id, `DOC_OTRA_${tag}`)

  const ctx = { tag, inst, otra, usuarios, estudiante, plantilla, estudianteAjeno }

  /** Emite un certificado (por defecto con el admin) y devuelve la respuesta. */
  ctx.emitir = async ({ token = usuarios.admin.token, estudianteId, plantillaId } = {}) => {
    let est = estudianteId
    if (!est) est = (await createTestEstudiante(inst.id, `DOC_${tag}_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`)).id
    return request(app).post('/api/certificados/emitir').set(auth(token))
      .send({ estudiante_id: est, institucion_id: inst.id, plantilla_id: plantillaId || plantilla.id })
  }
  return ctx
}

module.exports = { app, prisma, request, auth, login, emailDe, PASSWORD, crearEscenario, crearApiAcademica }
