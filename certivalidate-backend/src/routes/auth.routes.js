const express = require('express')
const router = express.Router()

const {
  register,
  login,
  refreshToken,
  logout,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
  verificarEmail,
  obtenerPermisos,
  listarSesionesActivas,
  revocarSesionActiva,
  cerrarTodasLasSesiones,
} = require('../controllers/auth.controller')
const { setup2FA, enable2FA, disable2FA, verify2FA } = require('../controllers/twoFactor.controller')
const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateRefreshToken,
  handleValidationErrors,
} = require('../utils/validators')

router.post('/register', validateRegister, handleValidationErrors, register)
router.get('/verificar-email', verificarEmail)
router.post('/login', validateLogin, handleValidationErrors, login)
router.post('/refresh', validateRefreshToken, handleValidationErrors, refreshToken)
router.post('/logout', verificarToken, validateRefreshToken, handleValidationErrors, logout)
router.get('/perfil', verificarToken, obtenerPerfil)
router.get('/permisos', verificarToken, obtenerPermisos)
router.put(
  '/perfil',
  verificarToken,
  requireEmailVerified,
  validateUpdateProfile,
  handleValidationErrors,
  actualizarPerfil,
)
router.put(
  '/perfil/password',
  verificarToken,
  requireEmailVerified,
  validateChangePassword,
  handleValidationErrors,
  cambiarPassword,
)

// Sesiones activas
router.get('/sesiones',          verificarToken, listarSesionesActivas)
router.delete('/sesiones/todas', verificarToken, cerrarTodasLasSesiones)
router.delete('/sesiones/:id',   verificarToken, revocarSesionActiva)

// Rutas 2FA
router.get('/2fa/setup', verificarToken, setup2FA)
router.post('/2fa/enable', verificarToken, enable2FA)
router.post('/2fa/disable', verificarToken, disable2FA)
router.post('/2fa/verify', verify2FA)

module.exports = router
