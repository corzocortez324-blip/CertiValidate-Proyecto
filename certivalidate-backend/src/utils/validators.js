const { body, param, validationResult } = require('express-validator')

const validateRegister = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ min: 3 })
    .withMessage('El nombre debe tener al menos 3 caracteres'),
  body('apellido')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('El apellido no puede estar vacío'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener mayúscula, minúscula y número'),
]

const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
]

const validateUpdateProfile = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('El nombre debe tener al menos 3 caracteres'),
  body('apellido')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('El apellido no puede estar vacío'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
]

const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es obligatoria'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'La nueva contraseña debe contener mayúscula, minúscula y número',
    ),
]

const validateRefreshToken = [
  body('refreshToken')
    .trim()
    .notEmpty()
    .withMessage('El refresh token es obligatorio'),
]

const validateCertificado = [
  body('estudiante_id')
    .trim()
    .notEmpty()
    .withMessage('estudiante_id es obligatorio')
    .isUUID()
    .withMessage('estudiante_id debe ser un UUID válido'),
  body('institucion_id')
    .trim()
    .notEmpty()
    .withMessage('institucion_id es obligatorio')
    .isUUID()
    .withMessage('institucion_id debe ser un UUID válido'),
  body('plantilla_id')
    .trim()
    .notEmpty()
    .withMessage('plantilla_id es obligatorio')
    .isUUID()
    .withMessage('plantilla_id debe ser un UUID válido'),
]

const validateRevocacion = [
  body('motivo_codigo')
    .trim()
    .notEmpty()
    .withMessage('motivo_codigo es obligatorio')
    .isIn([
      'FRAUDE',
      'ERROR_DATOS',
      'ERROR_EMISION',
      'DECISION_INSTITUCIONAL',
      'DUPLICADO',
      'CADUCIDAD',
      'OTRO',
    ])
    .withMessage(
      'motivo_codigo debe ser uno de: FRAUDE, ERROR_DATOS, ERROR_EMISION, DECISION_INSTITUCIONAL, DUPLICADO, CADUCIDAD, OTRO'
    ),
  body('motivo_detalle')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('motivo_detalle no puede exceder 500 caracteres'),
]

const validateInstitucionCrear = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre de la institución es obligatorio')
    .isLength({ min: 3 })
    .withMessage('El nombre debe tener al menos 3 caracteres'),
  body('dominio')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 3 })
    .withMessage('El dominio debe tener al menos 3 caracteres'),
  body('logo_url')
    .optional({ nullable: true })
    .trim()
    .isURL()
    .withMessage('logo_url debe ser una URL válida'),
  body('activa').optional().isBoolean().withMessage('activa debe ser booleano'),
]

const validateInstitucionActualizar = [
  body('nombre')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3 })
    .withMessage('El nombre debe tener al menos 3 caracteres'),
  body('dominio')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 3 })
    .withMessage('El dominio debe tener al menos 3 caracteres'),
  body('logo_url')
    .optional({ nullable: true })
    .trim()
    .isURL()
    .withMessage('logo_url debe ser una URL válida'),
  body('activa').optional().isBoolean().withMessage('activa debe ser booleano'),
]

const validateEstudianteCrear = [
  body('institucion_id')
    .trim()
    .notEmpty()
    .withMessage('institucion_id es obligatorio')
    .isUUID()
    .withMessage('institucion_id debe ser un UUID válido'),
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ min: 2 })
    .withMessage('El nombre debe tener al menos 2 caracteres'),
  body('apellido')
    .trim()
    .notEmpty()
    .withMessage('El apellido es obligatorio')
    .isLength({ min: 2 })
    .withMessage('El apellido debe tener al menos 2 caracteres'),
  body('documento')
    .trim()
    .notEmpty()
    .withMessage('El documento es obligatorio')
    .isLength({ min: 4 })
    .withMessage('El documento debe tener al menos 4 caracteres'),
  body('email')
    .optional({ nullable: true })
    .trim()
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
]

const validateEstudianteActualizar = [
  body('institucion_id')
    .optional()
    .trim()
    .isUUID()
    .withMessage('institucion_id debe ser un UUID válido'),
  body('nombre')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2 })
    .withMessage('El nombre debe tener al menos 2 caracteres'),
  body('apellido')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2 })
    .withMessage('El apellido debe tener al menos 2 caracteres'),
  body('documento')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 4 })
    .withMessage('El documento debe tener al menos 4 caracteres'),
  body('email')
    .optional({ nullable: true })
    .trim()
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
]

const validatePlantilla = [
  body('institucion_id')
    .optional()
    .trim()
    .isUUID()
    .withMessage('institucion_id debe ser un UUID válido'),
  body('nombre')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3 })
    .withMessage('El nombre debe tener al menos 3 caracteres'),
  body('template_html')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 10 })
    .withMessage('template_html debe tener al menos 10 caracteres'),
  body('version')
    .optional()
    .isInt({ min: 1 })
    .withMessage('version debe ser un entero mayor o igual a 1'),
  body('activa').optional().isBoolean().withMessage('activa debe ser booleano'),
]

const validateVerificarCertificado = [
  body('codigo')
    .optional()
    .trim()
    .isString()
    .isLength({ min: 1, max: 64 })
    .withMessage('codigo debe ser una cadena de máximo 64 caracteres'),
  body('hash')
    .optional()
    .trim()
    .isHexadecimal()
    .isLength({ min: 64, max: 64 })
    .withMessage('hash debe ser un hex SHA-256 de 64 caracteres'),
]

const validateUUIDParam = (name = 'id') => [
  param(name).trim().isUUID().withMessage(`${name} debe ser un UUID válido`),
]

const getClientIp = (req) => req.ip || null

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Errores de validación',
      errors: errors.array(),
      timestamp: new Date().toISOString(),
    })
  }
  next()
}

module.exports = {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateCertificado,
  validateRevocacion,
  validateVerificarCertificado,
  validateInstitucionCrear,
  validateInstitucionActualizar,
  validateEstudianteCrear,
  validateEstudianteActualizar,
  validatePlantilla,
  validateUUIDParam,
  handleValidationErrors,
  validateUpdateProfile,
  validateChangePassword,
  getClientIp,
}
