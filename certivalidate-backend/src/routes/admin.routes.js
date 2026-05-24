const express = require('express')
const router = express.Router()

const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const { cargarInstitucionesUsuario, requirePermission } = require('../utils/authorization')
const { getStats, getReporteMotivos, getStatsMV } = require('../controllers/admin.controller')

router.get(
  '/stats',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('admin', 'stats'),
  getStats,
)

router.get(
  '/stats/mv',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('admin', 'stats'),
  getStatsMV,
)

router.get(
  '/revocaciones/motivos',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('admin', 'stats'),
  getReporteMotivos,
)

module.exports = router