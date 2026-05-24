const express = require('express')
const router = express.Router()

const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const { getStats, getReporteMotivos, getStatsMV } = require('../controllers/admin.controller')

router.get('/stats',               verificarToken, requireEmailVerified, getStats)
router.get('/stats/mv',            verificarToken, requireEmailVerified, getStatsMV)
router.get('/revocaciones/motivos', verificarToken, requireEmailVerified, getReporteMotivos)

module.exports = router
