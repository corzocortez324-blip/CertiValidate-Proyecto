const express = require('express')
const router = express.Router()

const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const { cargarInstitucionesUsuario } = require('../utils/authorization')
const {
  validateUUIDParam,
  handleValidationErrors,
  validateIntegracionCrear,
  validateIntegracionActualizar,
} = require('../utils/validators')
const {
  getResumen,
  getEstudiantes,
  getCertificados,
  getPlantillas,
  getCursos,
  getFirmantes,
  postSincronizar,
  crearIntegracion,
  obtenerIntegracion,
  actualizarIntegracion,
  eliminarIntegracion,
} = require('../controllers/integracion.controller')

const auth = [verificarToken, requireEmailVerified, cargarInstitucionesUsuario]
const uuid = [validateUUIDParam('institucionId'), handleValidationErrors]
const uuidId = [validateUUIDParam('id'), handleValidationErrors]

// CRUD de configuración de integración
router.post('/', ...auth, validateIntegracionCrear, handleValidationErrors, crearIntegracion)
router.get('/:institucionId', ...auth, ...uuid, obtenerIntegracion)
router.put('/:id', ...auth, ...uuidId, validateIntegracionActualizar, handleValidationErrors, actualizarIntegracion)
router.delete('/:id', ...auth, ...uuidId, eliminarIntegracion)

// Datos y sincronización desde API externa
router.get('/:institucionId/resumen', ...auth, ...uuid, getResumen)
router.get('/:institucionId/estudiantes', ...auth, ...uuid, getEstudiantes)
router.get('/:institucionId/certificados', ...auth, ...uuid, getCertificados)
router.get('/:institucionId/plantillas', ...auth, ...uuid, getPlantillas)
router.get('/:institucionId/cursos', ...auth, ...uuid, getCursos)
router.get('/:institucionId/firmantes', ...auth, ...uuid, getFirmantes)
router.post('/:institucionId/sincronizar', ...auth, ...uuid, postSincronizar)

module.exports = router
