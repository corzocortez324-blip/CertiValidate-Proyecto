/**
 * Graba los contratos JSON que usa el stub HTTP de las pruebas de interfaz del
 * frontend (certivalidate-frontend/src/__tests__/integracion/contratos.json),
 * a partir de respuestas reales del backend sobre la BD de pruebas.
 *
 *   npx cross-env NODE_ENV=test dotenv -e .env.test -- node tests/integracion-doc/grabar-contratos.js
 */
const fs = require('fs')
const path = require('path')
const { app, prisma, request, auth, crearEscenario } = require('./escenario')
const { cleanupTestData } = require('../helpers/db')

const DESTINO = path.resolve(__dirname, '../../../certivalidate-frontend/src/__tests__/integracion/contratos.json')

;(async () => {
  const ctx = await crearEscenario(`contratos_${Date.now()}`)
  const admin = auth(ctx.usuarios.admin.token)
  const lector = auth(ctx.usuarios.lector.token)

  // Datos: 3 certificados (uno revocado) y eventos de auditoría
  const emitidos = []
  for (let i = 0; i < 3; i++) emitidos.push((await ctx.emitir()).body.data)
  await request(app).post(`/api/certificados/${emitidos[1].id}/revocar`).set(admin)
    .send({ motivo_codigo: 'ERROR_DATOS', motivo_detalle: 'Contrato de prueba' })

  const get = async (url, headers = admin) => (await request(app).get(url).set(headers)).body
  const contratos = {
    perfil_admin: await get('/api/auth/perfil'),
    permisos_admin: await get('/api/auth/permisos'),
    perfil_lector: await get('/api/auth/perfil', lector),
    permisos_lector: await get('/api/auth/permisos', lector),
    usuarios: await get('/api/usuarios?page=1&limit=10'),
    roles: await get('/api/admin/roles'),
    instituciones: await get('/api/instituciones?page=1&limit=10'),
    certificados: await get('/api/certificados/listar?page=1&limit=10'),
    certificados_revocados: await get('/api/certificados/listar?page=1&limit=10&estado=revocado'),
    estudiantes: await get(`/api/estudiantes/?page=1&limit=100&institucion_id=${ctx.inst.id}`),
    plantillas: await get('/api/plantillas/?page=1&limit=100'),
    auditoria: await get('/api/auditoria/?page=1&limit=20'),
    stats: await get('/api/admin/stats?period=30d'),
    verificar_no_encontrado: (await request(app).post('/api/certificados/verificar').send({ codigo: 'XXXX0000XXXX0000' })).body,
    verificar_valido: (await request(app).post('/api/certificados/verificar').send({ codigo: emitidos[0].codigo_unico })).body,
    login_2fa: { success: true, statusCode: 200, message: 'Se requiere verificación 2FA', data: { requires2FA: true, partial_token: 'token.parcial.prueba' } },
  }

  // Los contratos no deben llevar tokens reales
  const texto = JSON.stringify(contratos, null, 1)
    .replaceAll(ctx.usuarios.admin.token, 'TOKEN_ADMIN')
    .replaceAll(ctx.usuarios.lector.token, 'TOKEN_LECTOR')
  fs.mkdirSync(path.dirname(DESTINO), { recursive: true })
  fs.writeFileSync(DESTINO, texto + '\n')
  console.log('Contratos grabados en', DESTINO, Object.keys(contratos).length, 'rutas')

  await cleanupTestData()
  await prisma.$disconnect()
  process.exit(0)
})().catch(async (e) => { console.error(e); process.exit(1) })
