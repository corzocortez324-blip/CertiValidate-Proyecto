const prisma = require('../utils/prisma')
const { CERTIFICADOS } = require('../data/demo-data')

function mapCertificado(c) {
  return {
    codigo: c.id,
    estudiante_documento: c.estudiante?.documento ?? null,
    estudiante_nombre: c.estudiante
      ? `${c.estudiante.nombre} ${c.estudiante.apellido}`
      : null,
    curso_id: c.cursoId ?? null,
    curso: c.titulo,
    fecha_emision: c.fechaEmision,
    fecha_expiracion: c.fechaExpiracion ?? null,
    estado: c.estado,
    plantilla_id: c.plantillaId ?? null,
    intensidad_horaria: c.horas ?? null,
    promedio: c.promedio ?? null,
  }
}

async function listar(req, res) {
  console.log(`[academic-api] GET /api/certificados — ${new Date().toISOString()}`)
  try {
    const rows = await prisma.certificado.findMany({ include: { estudiante: true } })
    const data = rows.map(mapCertificado)
    return res.json({ success: true, total: data.length, data })
  } catch {
    return res.json({ success: true, total: CERTIFICADOS.length, data: CERTIFICADOS, demo: true })
  }
}

async function buscarPorCodigo(req, res) {
  const { codigo } = req.params
  console.log(`[academic-api] GET /api/certificados/${codigo} — ${new Date().toISOString()}`)

  try {
    const row = await prisma.certificado.findFirst({
      where: { id: codigo },
      include: { estudiante: true },
    })
    if (!row) {
      const demo = CERTIFICADOS.find((c) => c.codigo === codigo)
      if (demo) return res.json({ success: true, data: demo, demo: true })
      return res.status(404).json({ success: false, message: 'Registro no encontrado' })
    }
    return res.json({ success: true, data: mapCertificado(row) })
  } catch {
    const demo = CERTIFICADOS.find((c) => c.codigo === codigo)
    if (demo) return res.json({ success: true, data: demo, demo: true })
    return res.status(404).json({ success: false, message: 'Registro no encontrado' })
  }
}

module.exports = { listar, buscarPorCodigo }
