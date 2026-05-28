const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const { sendSuccess, sendError } = require('../utils/response.utils')
const integrationConfigService = require('../services/integration-config.service')
const academicApiService = require('../services/academic-api.service')

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

    // Sin integración externa configurada → estado pendiente
    if (!config || config.provider === 'local-db' || !config.url_base) {
      logger.info(
        { institucionId: id, provider: config?.provider, requestId },
        '[Integracion] Prueba de conexión: integración no configurada',
      )

      return res.status(200).json({
        success: false,
        statusCode: 200,
        message: 'Integración pendiente o no disponible',
        data: {
          institucion_id: id,
          estado: 'pendiente',
          disponible: false,
        },
        timestamp: new Date().toISOString(),
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
        statusCode: 200,
        message: 'Integración pendiente o no disponible',
        data: {
          institucion_id: id,
          estado: 'pendiente',
          disponible: false,
        },
        timestamp: new Date().toISOString(),
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

module.exports = { probarConexion }
