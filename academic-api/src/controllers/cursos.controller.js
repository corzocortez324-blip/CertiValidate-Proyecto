const { CURSOS } = require('../data/demo-data')

function listar(req, res) {
  console.log(`[academic-api] GET /api/cursos — ${new Date().toISOString()}`)
  return res.json({ success: true, total: CURSOS.length, data: CURSOS })
}

function buscarPorId(req, res) {
  const { id } = req.params
  console.log(`[academic-api] GET /api/cursos/${id} — ${new Date().toISOString()}`)
  const curso = CURSOS.find((c) => c.id === id)
  if (!curso) {
    return res.status(404).json({ success: false, message: 'Registro no encontrado' })
  }
  return res.json({ success: true, data: curso })
}

module.exports = { listar, buscarPorId }
