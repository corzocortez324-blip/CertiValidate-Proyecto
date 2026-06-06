const prisma = require('../utils/prisma')
const { CERTIFICADOS } = require('../data/demo-data')

function mapCertificado(c) {
  const docEstudiante = c.estudiante?.documento ?? c.estudiante_documento ?? null
  const cursoRef = c.cursoId ?? c.curso_id ?? null

  return {
    codigo: c.codigo ?? c.id,
    certificate_source_id: c.certificate_source_id ?? c.codigo ?? c.id,
    enrollment_id: c.enrollment_id ?? (docEstudiante && cursoRef ? `ENR-${docEstudiante}-${cursoRef}` : null),
    academic_record_id: c.academic_record_id ?? (docEstudiante ? `AR-${docEstudiante}` : null),
    estudiante_documento: docEstudiante,
    estudiante_nombre: c.estudiante
      ? `${c.estudiante.nombre} ${c.estudiante.apellido}`
      : c.estudiante_nombre ?? null,
    curso_id: cursoRef,
    curso: c.titulo ?? c.curso,
    fecha_emision: c.fechaEmision ?? c.fecha_emision,
    fecha_expiracion: c.fechaExpiracion ?? c.fecha_expiracion ?? null,
    estado: c.estado,
    plantilla_id: c.plantillaId ?? c.plantilla_id ?? null,
    intensidad_horaria: c.horas ?? c.intensidad_horaria ?? null,
    promedio: c.promedio ?? null,
    updated_at: c.updated_at ?? (c.updatedAt ? new Date(c.updatedAt).toISOString() : null),
    data_version: c.data_version ?? 1,
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
