const { PLANTILLAS } = require('../data/demo-data')

function listar(req, res) {
  console.log(`[academic-api] GET /api/plantillas — ${new Date().toISOString()}`)
  return res.json({ success: true, total: PLANTILLAS.length, data: PLANTILLAS })
}

function buscarPorId(req, res) {
  const { id } = req.params
  console.log(`[academic-api] GET /api/plantillas/${id} — ${new Date().toISOString()}`)
  const plantilla = PLANTILLAS.find((p) => p.id === id)
  if (!plantilla) {
    return res.status(404).json({ success: false, message: 'Registro no encontrado' })
  }
  return res.json({ success: true, data: plantilla })
}

module.exports = { listar, buscarPorId }
