const express = require('express')
const router = express.Router()

const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const {
  listarEstudiantes,
  obtenerEstudiante,
  crearEstudiante,
  actualizarEstudiante,
  eliminarEstudiante,
} = require('../controllers/estudiante.controller')
const { requirePermission, cargarInstitucionesUsuario } = require('../utils/authorization')
const {
  validateEstudianteCrear,
  validateEstudianteActualizar,
  validateUUIDParam,
  handleValidationErrors,
} = require('../utils/validators')

router.get('/', verificarToken, requireEmailVerified, cargarInstitucionesUsuario, requirePermission('estudiante', 'listar'), listarEstudiantes)
router.get(
  '/:id',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('estudiante', 'ver'),
  validateUUIDParam('id'),
  handleValidationErrors,
  obtenerEstudiante,
)
router.post(
  '/',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('estudiante', 'crear', {
    institucionIdResolver: (req) => req.body.institucion_id,
  }),
  validateEstudianteCrear,
  handleValidationErrors,
  crearEstudiante,
)
router.put(
  '/:id',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('estudiante', 'actualizar'),
  validateUUIDParam('id'),
  validateEstudianteActualizar,
  handleValidationErrors,
  actualizarEstudiante,
)
router.delete(
  '/:id',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('estudiante', 'eliminar'),
  validateUUIDParam('id'),
  handleValidationErrors,
  eliminarEstudiante,
)

module.exports = router
