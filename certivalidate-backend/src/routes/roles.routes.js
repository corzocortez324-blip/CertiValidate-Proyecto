const express = require('express')
const router = express.Router()
const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const { cargarInstitucionesUsuario, requirePermission } = require('../utils/authorization')
const { getRoles, actualizarRolPermisos } = require('../controllers/roles.controller')

router.get(
  '/',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('usuario', 'listar'),
  getRoles,
)

router.put(
  '/:rolId/permisos',
  verificarToken,
  requireEmailVerified,
  cargarInstitucionesUsuario,
  requirePermission('usuario', 'actualizar'),
  actualizarRolPermisos,
)

module.exports = router
