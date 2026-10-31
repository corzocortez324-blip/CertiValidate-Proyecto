const express = require('express')
const router = express.Router()

const { verificarToken, requireEmailVerified } = require('../middlewares/auth.middleware')
const { cargarInstitucionesUsuario, requirePermission } = require('../utils/authorization')
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
// La institución se toma de la ruta o del cuerpo; con :id (integración) se valida en el controlador
const porInstitucion = (req) => req.params.institucionId || req.body?.institucion_id || null
const ver = requirePermission('institucion', 'ver', { institucionIdResolver: porInstitucion })
const gestionar = requirePermission('institucion', 'actualizar', { institucionIdResolver: porInstitucion })
const uuid = [validateUUIDParam('institucionId'), handleValidationErrors]
const uuidId = [validateUUIDParam('id'), handleValidationErrors]

// CRUD de configuración de integración
router.post('/', ...auth, gestionar, validateIntegracionCrear, handleValidationErrors, crearIntegracion)
router.get('/:institucionId', ...auth, ver, ...uuid, obtenerIntegracion)
router.put('/:id', ...auth, gestionar, ...uuidId, validateIntegracionActualizar, handleValidationErrors, actualizarIntegracion)
router.delete('/:id', ...auth, gestionar, ...uuidId, eliminarIntegracion)

// Datos y sincronización desde API externa
router.get('/:institucionId/resumen', ...auth, ver, ...uuid, getResumen)
router.get('/:institucionId/estudiantes', ...auth, ver, ...uuid, getEstudiantes)
router.get('/:institucionId/certificados', ...auth, ver, ...uuid, getCertificados)
router.get('/:institucionId/plantillas', ...auth, ver, ...uuid, getPlantillas)
router.get('/:institucionId/cursos', ...auth, ver, ...uuid, getCursos)
router.get('/:institucionId/firmantes', ...auth, ver, ...uuid, getFirmantes)
router.post('/:institucionId/sincronizar', ...auth, gestionar, ...uuid, postSincronizar)

module.exports = router
