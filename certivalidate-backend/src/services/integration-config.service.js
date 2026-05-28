const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const { decrypt } = require('../utils/crypto')

/**
 * SERVICIO DE CONFIGURACIÓN DE INTEGRACIONES POR INSTITUCIÓN
 *
 * Permite que cada institución tenga su propio proveedor académico:
 * - Institución A → external-api
 * - Institución B → local-db
 * - Institución C → graphql (futuro)
 *
 * Cachea configuraciones para evitar consultas repetidas.
 */

// Caché en memoria (limpiar cada 5 minutos)
const CACHE_TTL = 5 * 60 * 1000
const configCache = new Map()

/**
 * Obtener configuración de integración para institución
 *
 * @param {string} institucionId - ID de institución
 * @param {object} opciones - Opciones (usarCache, tipoIntegracion)
 * @returns {Promise<object>} Configuración de integración
 *
 * Ejemplo retorno:
 * {
 *   tipo: 'external-api',
 *   url_base: 'http://localhost:4000/api',
 *   api_key: 'sk_live_...',
 *   activa: true,
 *   ultimaVerificacion: Date,
 *   provider: 'external-api'
 * }
 */
async function obtenerConfiguracion(institucionId, opciones = {}) {
  const { usarCache = true, tipoIntegracion = null } = opciones

  if (!institucionId) {
    throw new Error('institucionId es obligatorio')
  }

  // Buscar en caché
  if (usarCache) {
    const cached = configCache.get(institucionId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug(
        {
          institucionId,
          provider: cached.config.provider,
          desde: 'cache',
        },
        '[IntegrationConfig] Configuración recuperada de caché',
      )
      return cached.config
    }
  }

  try {
    const integracion = await prisma.integracion.findFirst({
      where: {
        institucion_id: institucionId,
        activa: true,
        ...(tipoIntegracion && { tipo: tipoIntegracion }),
      },
    })

    if (!integracion) {
      logger.warn(
        {
          institucionId,
          tipoIntegracion,
        },
        '[IntegrationConfig] No se encontró integración activa',
      )

      // Retornar configuración por defecto (local-db)
      const configDefault = {
        tipo: 'local-db',
        url_base: null,
        api_key: null,
        activa: true,
        ultimaVerificacion: null,
        provider: 'local-db',
      }

      // Cachear
      configCache.set(institucionId, {
        config: configDefault,
        timestamp: Date.now(),
      })

      return configDefault
    }

    // Desencriptar api_key si existe
    let apiKeyDescifrada = null
    if (integracion.api_key) {
      try {
        apiKeyDescifrada = decrypt(integracion.api_key)
      } catch (err) {
        logger.error(
          {
            institucionId,
            error: err.message,
          },
          '[IntegrationConfig] Error descifrando api_key',
        )
      }
    }

    // Detección de provider:
    // Si tiene url_base → siempre academic-api (independiente del valor del campo tipo)
    // Si no tiene url_base → usar el tipo almacenado para determinar el provider
    const provider = (integracion.activa && integracion.url_base)
      ? 'academic-api'
      : mapearTipoAProvider(integracion.tipo)

    const config = {
      id: integracion.id,
      tipo: integracion.tipo,
      url_base: integracion.url_base,
      api_key: apiKeyDescifrada,
      activa: integracion.activa,
      ultimaVerificacion: integracion.ultima_verificacion,
      provider,
    }

    // Cachear
    configCache.set(institucionId, {
      config,
      timestamp: Date.now(),
    })

    logger.info(
      {
        institucionId,
        provider: config.provider,
        url_base: config.url_base,
        tipo: integracion.tipo,
      },
      '[IntegrationConfig] Configuración de integración cargada',
    )

    return config
  } catch (error) {
    logger.error(
      {
        institucionId,
        error: error.message,
      },
      '[IntegrationConfig] Error al obtener configuración',
    )
    throw error
  }
}

/**
 * Mapear tipo de integración a provider interno.
 * Los valores 'REST', 'rest', 'REST/HTTP' y 'external-api' todos mapean a 'academic-api'.
 *
 * @private
 */
function mapearTipoAProvider(tipo) {
  const mapa = {
    // Variantes de API REST externa → academic-api
    'REST': 'academic-api',
    'rest': 'academic-api',
    'REST/HTTP': 'academic-api',
    'external-api': 'academic-api',
    // Otros proveedores
    graphql: 'graphql',
    'supabase-direct': 'supabase-direct',
    'sql-server': 'sql-server',
    oracle: 'oracle',
    soap: 'soap',
    moodle: 'moodle',
    'local-db': 'local-db',
  }

  return mapa[tipo] || 'local-db'
}

/**
 * Obtener proveedor recomendado para institución
 *
 * @param {string} institucionId - ID de institución
 * @returns {Promise<string>} Nombre del provider (ej: external-api, local-db)
 */
async function obtenerProveedorPara(institucionId) {
  const config = await obtenerConfiguracion(institucionId, { usarCache: true })
  return config.provider
}

/**
 * Crear o actualizar integración
 *
 * @param {string} institucionId - ID de institución
 * @param {object} datos - {tipo, url_base, api_key}
 * @returns {Promise<object>} Integración creada/actualizada
 */
async function crearOActualizarIntegracion(institucionId, datos) {
  const { tipo, url_base, api_key } = datos

  if (!institucionId || !tipo) {
    throw new Error('institucionId y tipo son obligatorios')
  }

  // Encriptar api_key si existe
  let apiKeyEncriptada = null
  if (api_key) {
    try {
      const { encrypt } = require('../utils/crypto')
      apiKeyEncriptada = encrypt(api_key)
    } catch (err) {
      logger.error(
        {
          institucionId,
          error: err.message,
        },
        '[IntegrationConfig] Error cifrando api_key',
      )
      throw err
    }
  }

  const integracion = await prisma.integracion.upsert({
    where: {
      institucion_id: institucionId,
    },
    create: {
      institucion_id: institucionId,
      tipo,
      url_base,
      api_key: apiKeyEncriptada,
      activa: true,
      ultima_verificacion: new Date(),
    },
    update: {
      tipo,
      url_base,
      api_key: apiKeyEncriptada,
      activa: true,
      ultima_verificacion: new Date(),
    },
  })

  // Limpiar caché
  configCache.delete(institucionId)

  logger.info(
    {
      institucionId,
      tipo,
    },
    '[IntegrationConfig] Integración creada/actualizada',
  )

  return integracion
}

/**
 * Desactivar integración
 *
 * @param {string} institucionId - ID de institución
 */
async function desactivarIntegracion(institucionId) {
  await prisma.integracion.update({
    where: { institucion_id: institucionId },
    data: { activa: false },
  })

  // Limpiar caché
  configCache.delete(institucionId)

  logger.info(
    {
      institucionId,
    },
    '[IntegrationConfig] Integración desactivada',
  )
}

/**
 * Limpiar caché de configuración
 *
 * @param {string} institucionId - ID de institución (omitir para limpiar todo)
 */
function limpiarCache(institucionId = null) {
  if (institucionId) {
    configCache.delete(institucionId)
    logger.debug(
      { institucionId },
      '[IntegrationConfig] Caché limpiado para institución',
    )
  } else {
    configCache.clear()
    logger.debug('[IntegrationConfig] Caché limpiado completamente')
  }
}

/**
 * Verificar si integración está disponible
 *
 * @param {string} institucionId - ID de institución
 * @returns {Promise<boolean>} True si está disponible y activa
 */
async function verificarDisponibilidad(institucionId) {
  try {
    const config = await obtenerConfiguracion(institucionId)

    if (!config.activa) {
      logger.warn(
        {
          institucionId,
          provider: config.provider,
        },
        '[IntegrationConfig] Integración inactiva',
      )
      return false
    }

    // Si es academic-api, verificar health usando la config real de la institución
    if (config.provider === 'academic-api') {
      const academicApi = require('./academic-api.service')
      const disponible = await academicApi.verificarDisponibilidad({
        url_base: config.url_base,
        api_key: config.api_key,
      })

      if (!disponible) {
        logger.warn(
          {
            institucionId,
            provider: 'external-api',
          },
          '[IntegrationConfig] API académica no disponible',
        )
        return false
      }
    }

    logger.debug(
      {
        institucionId,
        provider: config.provider,
      },
      '[IntegrationConfig] Integración disponible',
    )

    return true
  } catch (error) {
    logger.error(
      {
        institucionId,
        error: error.message,
      },
      '[IntegrationConfig] Error verificando disponibilidad',
    )
    return false
  }
}

/**
 * Obtener todas las integraciones activas
 *
 * @returns {Promise<array>} Lista de integraciones
 */
async function obtenerTodasLasIntegraciones() {
  return prisma.integracion.findMany({
    where: { activa: true },
    include: {
      institucion: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
  })
}

module.exports = {
  obtenerConfiguracion,
  obtenerProveedorPara,
  crearOActualizarIntegracion,
  desactivarIntegracion,
  limpiarCache,
  verificarDisponibilidad,
  obtenerTodasLasIntegraciones,
}
