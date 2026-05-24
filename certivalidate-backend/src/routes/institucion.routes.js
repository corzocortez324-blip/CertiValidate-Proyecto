const express = require('express')
const router = express.Router()

const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const {
  listarInstituciones,
  obtenerInstitucion,
  crearInstitucion,
  actualizarInstitucion,
  desactivarInstitucion,
  obtenerEstadisticasInstitucion,
} = require('../controllers/institucion.controller')
const { requirePermission, cargarInstitucionesUsuario } = require('../utils/authorization')
const {
  validateInstitucionCrear,
  validateInstitucionActualizar,
  validateUUIDParam,
  handleValidationErrors,
} = require('../utils/validators')

router.get('/', verificarToken, requireEmailVerified, cargarInstitucionesUsuario, requirePermission('institucion', 'ver'), listarInstituciones)
router.get(
  '/:id',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('institucion', 'ver'),
  validateUUIDParam('id'),
  handleValidationErrors,
  obtenerInstitucion,
)
router.get(
  '/:id/estadisticas',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('institucion', 'estadisticas'),
  validateUUIDParam('id'),
  handleValidationErrors,
  obtenerEstadisticasInstitucion,
)
router.post('/', verificarToken, requireEmailVerified, validateInstitucionCrear, handleValidationErrors, crearInstitucion)
router.put(
  '/:id',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('institucion', 'actualizar'),
  validateUUIDParam('id'),
  validateInstitucionActualizar,
  handleValidationErrors,
  actualizarInstitucion,
)
router.patch(
  '/:id/desactivar',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('institucion', 'actualizar'),
  validateUUIDParam('id'),
  handleValidationErrors,
  desactivarInstitucion,
)

module.exports = router
