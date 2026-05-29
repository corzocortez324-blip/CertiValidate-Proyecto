const prisma = require('../utils/prisma')
const { ESTUDIANTES } = require('../data/demo-data')

function mapEstudiante(e) {
  return {
    documento: e.documento,
    tipo_documento: e.tipo_documento ?? 'CC',
    nombres: e.nombres ?? e.nombre,
    apellidos: e.apellidos ?? e.apellido,
    email: e.email ?? null,
    programa: e.programa,
    estado: e.estadoAcademico ?? e.estado,
    fecha_registro: e.fecha_registro ?? e.createdAt ?? null,
  }
}

async function listar(req, res) {
  console.log(`[academic-api] GET /api/estudiantes — ${new Date().toISOString()}`)
  try {
    const rows = await prisma.estudiante.findMany()
    const data = rows.map(mapEstudiante)
    return res.json({ success: true, total: data.length, data })
  } catch {
    return res.json({ success: true, total: ESTUDIANTES.length, data: ESTUDIANTES, demo: true })
  }
}

async function buscarPorDocumento(req, res) {
  const { documento } = req.params
  console.log(`[academic-api] GET /api/estudiantes/${documento} — ${new Date().toISOString()}`)

  try {
    const row = await prisma.estudiante.findFirst({ where: { documento } })
    if (!row) {
      const demo = ESTUDIANTES.find((e) => e.documento === documento)
      if (demo) return res.json({ success: true, data: demo, demo: true })
      return res.status(404).json({ success: false, message: 'Registro no encontrado' })
    }
    return res.json({ success: true, data: mapEstudiante(row) })
  } catch {
    const demo = ESTUDIANTES.find((e) => e.documento === documento)
    if (demo) return res.json({ success: true, data: demo, demo: true })
    return res.status(404).json({ success: false, message: 'Registro no encontrado' })
  }
}

module.exports = { listar, buscarPorDocumento }
