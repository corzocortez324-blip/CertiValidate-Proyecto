const express = require('express')
const router = express.Router()

const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const {
  listarPlantillas,
  obtenerPlantilla,
  crearPlantilla,
  actualizarPlantilla,
  archivarPlantilla,
} = require('../controllers/plantilla.controller')
const { requirePermission, cargarInstitucionesUsuario } = require('../utils/authorization')
const {
  validatePlantilla,
  validateUUIDParam,
  handleValidationErrors,
} = require('../utils/validators')

router.get('/', verificarToken, requireEmailVerified, cargarInstitucionesUsuario, requirePermission('plantilla', 'listar'), listarPlantillas)
router.get(
  '/:id',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('plantilla', 'ver'),
  validateUUIDParam('id'),
  handleValidationErrors,
  obtenerPlantilla,
)
router.post(
  '/',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('plantilla', 'crear', {
    institucionIdResolver: (req) => req.body.institucion_id,
  }),
  validatePlantilla,
  handleValidationErrors,
  crearPlantilla,
)
router.put(
  '/:id',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('plantilla', 'actualizar'),
  validateUUIDParam('id'),
  validatePlantilla,
  handleValidationErrors,
  actualizarPlantilla,
)

router.delete(
  '/:id',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('plantilla', 'archivar'),
  validateUUIDParam('id'),
  handleValidationErrors,
  archivarPlantilla,
)

module.exports = router
