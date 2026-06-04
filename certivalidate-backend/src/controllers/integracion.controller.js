const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const { sendSuccess, sendError } = require('../utils/response.utils')
const integrationConfigService = require('../services/integration-config.service')
const academicApiService = require('../services/academic-api.service')
const integracionService = require('../services/integracion.service')
const { encrypt } = require('../utils/crypto')

/**
 * POST /api/instituciones/:id/probar-conexion
 *
 * Prueba la conexión con la API académica externa configurada para la institución.
 * Actualiza ultima_verificacion en la BD tras el intento.
 */
const probarConexion = async (req, res) => {
  const { id } = req.params
  const requestId = req.requestId

  // Validar acceso del usuario a la institución
  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(id)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  try {
    // Obtener config sin caché para reflejar el estado real
    const config = await integrationConfigService.obtenerConfiguracion(id, {
      usarCache: false,
    })

    // Sin integración externa configurada → pendiente
    if (!config || config.provider === 'local-db' || !config.url_base) {
      logger.info(
        { institucionId: id, provider: config?.provider, requestId },
        '[Integracion] Prueba de conexión: integración no configurada',
      )

      return res.status(200).json({
        success: false,
        message: 'Integración pendiente o no disponible',
        data: {
          institucion_id: id,
          estado: 'pendiente',
          disponible: false,
        },
      })
    }

    // Probar health check contra la URL real de la institución
    const disponible = await academicApiService.verificarDisponibilidad({
      url_base: config.url_base,
      api_key: config.api_key,
    })

    // Actualizar ultima_verificacion en BD (tanto éxito como fallo)
    if (config.id) {
      await prisma.integracion.update({
        where: { id: config.id },
        data: { ultima_verificacion: new Date() },
      })
      integrationConfigService.limpiarCache(id)
    }

    if (!disponible) {
      logger.warn(
        { institucionId: id, url_base: config.url_base, requestId },
        '[Integracion] Prueba de conexión fallida: API no responde',
      )

      return res.status(200).json({
        success: false,
        message: 'Integración pendiente o no disponible',
        data: {
          institucion_id: id,
          estado: 'pendiente',
          disponible: false,
        },
      })
    }

    const ultimaVerificacion = new Date().toISOString()

    logger.info(
      { institucionId: id, url_base: config.url_base, requestId },
      '[Integracion] Prueba de conexión exitosa',
    )

    return sendSuccess(
      res,
      {
        institucion_id: id,
        provider: 'academic-api',
        tipo: 'REST',
        url_base: config.url_base,
        estado: 'conectado',
        disponible: true,
        ultima_verificacion: ultimaVerificacion,
      },
      'Conexión verificada correctamente',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, institucionId: id, requestId },
      '[Integracion] Error al probar conexión',
    )
    return sendError(res, 'Error al probar la conexión', 500)
  }
}

/**
 * GET /api/integraciones/:institucionId/resumen
 */
const getResumen = async (req, res) => {
  const { institucionId } = req.params
  const requestId = req.requestId

  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(institucionId)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  try {
    const resumen = await integracionService.obtenerResumen(institucionId, requestId)
    return sendSuccess(res, resumen, 'Resumen de integración obtenido correctamente')
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, error.message, 404)
    }
    logger.error({ err: error, institucionId, requestId }, '[Integracion] Error al obtener resumen')
    return sendError(res, 'Error al obtener resumen de integración', 500)
  }
}

/**
 * GET /api/integraciones/:institucionId/estudiantes
 */
const getEstudiantes = async (req, res) => {
  const { institucionId } = req.params
  const requestId = req.requestId

  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(institucionId)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  try {
    const resultado = await integracionService.obtenerEstudiantes(institucionId, {}, requestId)
    return sendSuccess(res, resultado, 'Estudiantes externos obtenidos correctamente')
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, error.message, 404)
    }
    logger.error({ err: error, institucionId, requestId }, '[Integracion] Error al obtener estudiantes externos')
    return sendError(res, 'Error al obtener estudiantes desde la API externa', 500)
  }
}

/**
 * GET /api/integraciones/:institucionId/certificados
 */
const getCertificados = async (req, res) => {
  const { institucionId } = req.params
  const requestId = req.requestId

  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(institucionId)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  try {
    const resultado = await integracionService.obtenerCertificados(institucionId, {}, requestId)
    return sendSuccess(res, resultado, 'Certificados externos obtenidos correctamente')
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, error.message, 404)
    }
    logger.error({ err: error, institucionId, requestId }, '[Integracion] Error al obtener certificados externos')
    return sendError(res, 'Error al obtener certificados desde la API externa', 500)
  }
}

/**
 * GET /api/integraciones/:institucionId/plantillas
 */
const getPlantillas = async (req, res) => {
  const { institucionId } = req.params
  const requestId = req.requestId

  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(institucionId)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  try {
    const resultado = await integracionService.obtenerPlantillas(institucionId, {}, requestId)
    return sendSuccess(res, resultado, 'Plantillas externas obtenidas correctamente')
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, error.message, 404)
    }
    logger.error({ err: error, institucionId, requestId }, '[Integracion] Error al obtener plantillas externas')
    return sendError(res, 'Error al obtener plantillas desde la API externa', 500)
  }
}

/**
 * GET /api/integraciones/:institucionId/cursos
 */
const getCursos = async (req, res) => {
  const { institucionId } = req.params
  const requestId = req.requestId

  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(institucionId)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  try {
    const resultado = await integracionService.obtenerCursos(institucionId, {}, requestId)
    return sendSuccess(res, resultado, 'Cursos externos obtenidos correctamente')
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, error.message, 404)
    }
    logger.error({ err: error, institucionId, requestId }, '[Integracion] Error al obtener cursos externos')
    return sendError(res, 'Error al obtener cursos desde la API externa', 500)
  }
}

/**
 * GET /api/integraciones/:institucionId/firmantes
 */
const getFirmantes = async (req, res) => {
  const { institucionId } = req.params
  const requestId = req.requestId

  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(institucionId)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  try {
    const resultado = await integracionService.obtenerFirmantes(institucionId, {}, requestId)
    return sendSuccess(res, resultado, 'Firmantes externos obtenidos correctamente')
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, error.message, 404)
    }
    logger.error({ err: error, institucionId, requestId }, '[Integracion] Error al obtener firmantes externos')
    return sendError(res, 'Error al obtener firmantes desde la API externa', 500)
  }
}

/**
 * POST /api/integraciones/:institucionId/sincronizar
 * Body: { "entidades": ["estudiantes", "certificados", "plantillas"] }
 */
const postSincronizar = async (req, res) => {
  const { institucionId } = req.params
  const requestId = req.requestId

  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(institucionId)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  const ENTIDADES_VALIDAS = ['estudiantes', 'certificados', 'plantillas']
  const entidades = req.body?.entidades

  if (!Array.isArray(entidades) || entidades.length === 0) {
    return sendError(
      res,
      'El campo entidades es obligatorio y debe ser un array no vacío. Valores permitidos: estudiantes, certificados, plantillas',
      400,
    )
  }

  const invalidas = entidades.filter((e) => !ENTIDADES_VALIDAS.includes(e))
  if (invalidas.length > 0) {
    return sendError(
      res,
      `Entidades no reconocidas: ${invalidas.join(', ')}. Valores permitidos: ${ENTIDADES_VALIDAS.join(', ')}`,
      400,
    )
  }

  try {
    const resultado = await integracionService.sincronizar(institucionId, entidades, requestId)
    return sendSuccess(res, resultado, 'Sincronización finalizada')
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, error.message, 404)
    }
    logger.error({ err: error, institucionId, entidades, requestId }, '[Integracion] Error al sincronizar')
    return sendError(res, 'Error al sincronizar con la API externa', 500)
  }
}

/**
 * POST /api/integraciones
 * Body: { institucion_id, tipo, url_base, api_key?, activa? }
 */
const crearIntegracion = async (req, res) => {
  const requestId = req.requestId
  const { institucion_id, tipo, url_base, api_key, activa } = req.body

  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(institucion_id)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  try {
    const integracion = await integrationConfigService.crearOActualizarIntegracion(
      institucion_id,
      { tipo, url_base, api_key, activa: activa !== undefined ? Boolean(activa) : true },
    )

    logger.info(
      { institucionId: institucion_id, tipo, id: integracion.id, requestId },
      '[Integracion] Integración creada',
    )

    return sendSuccess(
      res,
      {
        id: integracion.id,
        institucion_id: integracion.institucion_id,
        tipo: integracion.tipo,
        url_base: integracion.url_base,
        activa: integracion.activa,
        ultima_verificacion: integracion.ultima_verificacion,
      },
      'Integración creada correctamente',
      201,
    )
  } catch (error) {
    logger.error({ err: error, institucionId: institucion_id, requestId }, '[Integracion] Error al crear integración')
    return sendError(res, 'Error al crear la integración', 500)
  }
}

/**
 * GET /api/integraciones/:institucionId
 * Retorna la configuración de integración o { configurada: false } si no existe.
 */
const obtenerIntegracion = async (req, res) => {
  const { institucionId } = req.params
  const requestId = req.requestId

  const institucionIds = req.institucionIds || []
  if (!institucionIds.includes(institucionId)) {
    return sendError(res, 'No autorizado para acceder a esta institución', 403)
  }

  try {
    const integracion = await prisma.integracion.findUnique({
      where: { institucion_id: institucionId },
    })

    if (!integracion) {
      logger.info({ institucionId, requestId }, '[Integracion] Consulta de integración: sin configurar')
      return sendSuccess(
        res,
        { configurada: false, estado: 'sin_configurar' },
        'Sin configurar',
      )
    }

    return sendSuccess(
      res,
      {
        configurada: true,
        id: integracion.id,
        institucion_id: integracion.institucion_id,
        tipo: integracion.tipo,
        url_base: integracion.url_base,
        activa: integracion.activa,
        ultima_verificacion: integracion.ultima_verificacion,
      },
      'Integración obtenida correctamente',
    )
  } catch (error) {
    logger.error({ err: error, institucionId, requestId }, '[Integracion] Error al obtener integración')
    return sendError(res, 'Error al obtener la integración', 500)
  }
}

/**
 * PUT /api/integraciones/:id
 * Body: { tipo?, url_base?, api_key?, activa? }
 */
const actualizarIntegracion = async (req, res) => {
  const { id } = req.params
  const requestId = req.requestId
  const { tipo, url_base, api_key, activa } = req.body

  try {
    const existente = await prisma.integracion.findUnique({ where: { id } })

    if (!existente) {
      return sendError(res, 'Integración no encontrada', 404)
    }

    const institucionIds = req.institucionIds || []
    if (!institucionIds.includes(existente.institucion_id)) {
      return sendError(res, 'No autorizado para acceder a esta institución', 403)
    }

    const datos = {}
    if (tipo !== undefined) datos.tipo = tipo
    if (url_base !== undefined) datos.url_base = url_base
    if (activa !== undefined) datos.activa = Boolean(activa)

    if (api_key !== undefined) {
      datos.api_key = (api_key === null || api_key === '') ? null : encrypt(api_key)
    }

    const integracion = await prisma.integracion.update({ where: { id }, data: datos })
    integrationConfigService.limpiarCache(integracion.institucion_id)

    logger.info(
      { id, institucionId: integracion.institucion_id, requestId },
      '[Integracion] Integración actualizada',
    )

    return sendSuccess(
      res,
      {
        id: integracion.id,
        institucion_id: integracion.institucion_id,
        tipo: integracion.tipo,
        url_base: integracion.url_base,
        activa: integracion.activa,
        ultima_verificacion: integracion.ultima_verificacion,
      },
      'Integración actualizada correctamente',
    )
  } catch (error) {
    logger.error({ err: error, id, requestId }, '[Integracion] Error al actualizar integración')
    return sendError(res, 'Error al actualizar la integración', 500)
  }
}

/**
 * DELETE /api/integraciones/:id
 */
const eliminarIntegracion = async (req, res) => {
  const { id } = req.params
  const requestId = req.requestId

  try {
    const existente = await prisma.integracion.findUnique({ where: { id } })

    if (!existente) {
      return sendError(res, 'Integración no encontrada', 404)
    }

    const institucionIds = req.institucionIds || []
    if (!institucionIds.includes(existente.institucion_id)) {
      return sendError(res, 'No autorizado para acceder a esta institución', 403)
    }

    await integrationConfigService.eliminarIntegracion(id)

    logger.info(
      { id, institucionId: existente.institucion_id, requestId },
      '[Integracion] Integración eliminada',
    )

    return sendSuccess(res, { id }, 'Integración eliminada correctamente')
  } catch (error) {
    logger.error({ err: error, id, requestId }, '[Integracion] Error al eliminar integración')
    return sendError(res, 'Error al eliminar la integración', 500)
  }
}

module.exports = {
  probarConexion,
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
}
