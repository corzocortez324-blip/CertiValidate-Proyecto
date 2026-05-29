const express = require('express')
const router = express.Router()

const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const { requirePermission, cargarInstitucionesUsuario } = require('../utils/authorization')
const {
  validateUUIDParam,
  validateCrearUsuario,
  validateActualizarUsuario,
  handleValidationErrors,
} = require('../utils/validators')
const {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
} = require('../controllers/usuario.controller')

const auth = [verificarToken, requireEmailVerified, cargarInstitucionesUsuario]

router.get(
  '/',
  ...auth,
  requirePermission('usuario', 'listar'),
  listarUsuarios,
)

router.get(
  '/:id',
  ...auth,
  requirePermission('usuario', 'ver'),
  validateUUIDParam('id'),
  handleValidationErrors,
  obtenerUsuario,
)

router.post(
  '/',
  ...auth,
  requirePermission('usuario', 'crear'),
  validateCrearUsuario,
  handleValidationErrors,
  crearUsuario,
)

router.put(
  '/:id',
  ...auth,
  requirePermission('usuario', 'actualizar'),
  validateUUIDParam('id'),
  validateActualizarUsuario,
  handleValidationErrors,
  actualizarUsuario,
)

router.delete(
  '/:id',
  ...auth,
  requirePermission('usuario', 'eliminar'),
  validateUUIDParam('id'),
  handleValidationErrors,
  eliminarUsuario,
)

module.exports = router
