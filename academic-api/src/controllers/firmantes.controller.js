const { FIRMANTES } = require('../data/demo-data')

function listar(req, res) {
  console.log(`[academic-api] GET /api/firmantes — ${new Date().toISOString()}`)
  return res.json({ success: true, total: FIRMANTES.length, data: FIRMANTES })
}

function buscarPorId(req, res) {
  const { id } = req.params
  console.log(`[academic-api] GET /api/firmantes/${id} — ${new Date().toISOString()}`)
  const firmante = FIRMANTES.find((f) => f.id === id)
  if (!firmante) {
    return res.status(404).json({ success: false, message: 'Registro no encontrado' })
  }
  return res.json({ success: true, data: firmante })
}

module.exports = { listar, buscarPorId }
