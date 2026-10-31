/**
 * Escenario común de las pruebas de integración del documento (apartado 2.4):
 * institución, usuarios por rol, estudiante, plantilla y un servidor HTTP local
 * que simula la API académica externa (E1). La red blockchain (E2) va en
 * BLOCKCHAIN_MODE = mock, igual que en la ejecución documentada.
 */
const crypto = require('crypto')
const http = require('http')
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

/**
 * Servidor que simula la API académica. `modo` controla su respuesta:
 *  ok | error500 | lento (> 5 s) | certificadosCaidos (solo falla /certificados)
 */
const crearApiAcademica = async () => {
  const estado = { modo: 'ok', apiKeys: [], rutas: [], estudiantes: [], certificados: [], plantillas: [] }
  const server = http.createServer((req, res) => {
    estado.apiKeys.push(req.headers['x-api-key'] || null)
    estado.rutas.push(`${req.method} ${req.url}`)
    const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (estado.modo === 'lento') { setTimeout(() => json(200, { status: 'ok' }), 6500); return }
    if (estado.modo === 'error500') return json(500, { error: 'falla simulada' })
    const url = req.url.split('?')[0]
    if (url === '/health') return json(200, { status: 'ok' })
    const m = url.match(/^\/api\/estudiantes\/([^/]+)$/)
    if (m) {
      const est = estado.estudiantes.find((e) => e.documento === decodeURIComponent(m[1]))
      return est ? json(200, est) : json(404, { error: 'no encontrado' })
    }
    if (url === '/api/estudiantes') return json(200, estado.estudiantes)
    if (url === '/api/plantillas') return json(200, estado.plantillas)
    if (url === '/api/certificados') {
      if (estado.modo === 'certificadosCaidos') return json(503, { error: 'No disponible' })
      return json(200, estado.certificados)
    }
    return json(404, { error: 'ruta desconocida' })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  estado.url = `http://127.0.0.1:${server.address().port}`
  estado.cerrar = () => new Promise((r) => { server.closeAllConnections?.(); server.close(r) })
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
