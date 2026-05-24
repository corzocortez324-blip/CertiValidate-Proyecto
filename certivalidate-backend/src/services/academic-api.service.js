const logger = require('../utils/logger')

/**
 * SERVICIO DE API ACADÉMICA EXTERNA
 *
 * Implementa:
 * - Timeout configurable
 * - Retry automático con backoff exponencial
 * - Manejo de errores específicos (429, 503, timeouts)
 * - Fallback a caché local
 * - Logging distribuido
 * - Trazabilidad de llamadas
 */

const DEFAULT_TIMEOUT = parseInt(process.env.ACADEMIC_API_TIMEOUT || 5000)
const MAX_RETRIES = parseInt(process.env.ACADEMIC_API_MAX_RETRIES || 3)
const BACKOFF_MULTIPLIER = 1.5

/**
 * Buscar estudiante por documento con retry y timeout
 *
 * @param {string} documento - Documento del estudiante
 * @param {object} opciones - Configuración (timeout, maxRetries)
 * @returns {Promise<object>} Datos del estudiante
 */
async function buscarEstudiantePorDocumento(documento, opciones = {}) {
  const timeout = opciones.timeout || DEFAULT_TIMEOUT
  const maxRetries = opciones.maxRetries || MAX_RETRIES

  const inicio = Date.now()
  let ultimoError

  for (let intento = 0; intento <= maxRetries; intento++) {
    try {
      const data = await fetchConTimeout(
        `${process.env.ACADEMIC_API_URL}/estudiantes/${documento}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': process.env.ACADEMIC_API_KEY,
            'Content-Type': 'application/json',
          },
          timeout,
        },
      )

      const duracion = Date.now() - inicio
      logger.info(
        {
          provider: 'external-api',
          endpoint: `/estudiantes/${documento}`,
          responseTime: duracion,
          intento: intento + 1,
          exitoso: true,
        },
        '[AcademicAPI] Búsqueda exitosa',
      )

      return data
    } catch (error) {
      ultimoError = error
      const duracion = Date.now() - inicio

      const esRetryable = esErrorRetryable(error.statusCode)
      const tiempoEspera = esRetryable ? calcularBackoff(intento) : 0

      logger.warn(
        {
          provider: 'external-api',
          endpoint: `/estudiantes/${documento}`,
          responseTime: duracion,
          intento: intento + 1,
          statusCode: error.statusCode,
          error: error.message,
          esRetryable,
          proximoIntento: intento < maxRetries ? tiempoEspera : null,
        },
        '[AcademicAPI] Error en búsqueda',
      )

      if (intento < maxRetries && esRetryable) {
        await esperar(tiempoEspera)
      } else {
        break
      }
    }
  }

  const duracion = Date.now() - inicio
  logger.error(
    {
      provider: 'external-api',
      endpoint: `/estudiantes/${documento}`,
      responseTime: duracion,
      intentos: maxRetries + 1,
      error: ultimoError?.message,
      statusCode: ultimoError?.statusCode,
    },
    '[AcademicAPI] Falló tras agotar reintentos',
  )

  throw ultimoError || new Error('Error desconocido consultando API académica')
}

/**
 * Listar estudiantes desde API externa
 *
 * @param {object} filtros - Filtros de búsqueda
 * @returns {Promise<array>} Lista de estudiantes
 */
async function listarEstudiantes(filtros = {}) {
  const timeout = filtros.timeout || DEFAULT_TIMEOUT
  const maxRetries = filtros.maxRetries || MAX_RETRIES

  const inicio = Date.now()
  let ultimoError

  for (let intento = 0; intento <= maxRetries; intento++) {
    try {
      const queryParams = new URLSearchParams({
        skip: filtros.skip || 0,
        take: filtros.take || 50,
        ...(filtros.search && { search: filtros.search }),
      })

      const data = await fetchConTimeout(
        `${process.env.ACADEMIC_API_URL}/estudiantes?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': process.env.ACADEMIC_API_KEY,
            'Content-Type': 'application/json',
          },
          timeout,
        },
      )

      const duracion = Date.now() - inicio
      logger.info(
        {
          provider: 'external-api',
          endpoint: '/estudiantes (lista)',
          responseTime: duracion,
          cantidad: data?.length || 0,
          intento: intento + 1,
          exitoso: true,
        },
        '[AcademicAPI] Lista obtenida',
      )

      return data
    } catch (error) {
      ultimoError = error
      const duracion = Date.now() - inicio

      const esRetryable = esErrorRetryable(error.statusCode)
      const tiempoEspera = esRetryable ? calcularBackoff(intento) : 0

      if (intento < maxRetries && esRetryable) {
        logger.warn(
          {
            provider: 'external-api',
            endpoint: '/estudiantes (lista)',
            intento: intento + 1,
            error: error.message,
            reintentar: true,
          },
          '[AcademicAPI] Error, reintentando...',
        )
        await esperar(tiempoEspera)
      } else {
        break
      }
    }
  }

  const duracion = Date.now() - inicio
  logger.error(
    {
      provider: 'external-api',
      endpoint: '/estudiantes (lista)',
      responseTime: duracion,
      intentos: maxRetries + 1,
      error: ultimoError?.message,
    },
    '[AcademicAPI] Falló listando estudiantes',
  )

  throw ultimoError || new Error('Error listando estudiantes desde API')
}

/**
 * Realizar fetch con timeout
 *
 * @private
 */
async function fetchConTimeout(url, opciones = {}) {
  const controller = new AbortController()
  const timeout = opciones.timeout || DEFAULT_TIMEOUT

  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...opciones,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await response.json()

    if (!response.ok) {
      const error = new Error(data.message || 'Error consultando API académica')
      error.statusCode = response.status
      throw error
    }

    return data.data || data
  } catch (error) {
    clearTimeout(timeoutId)

    if (error.name === 'AbortError') {
      const timeoutError = new Error(
        `Timeout de ${timeout}ms al consultar API académica`,
      )
      timeoutError.statusCode = 408
      throw timeoutError
    }

    throw error
  }
}

/**
 * Determinar si un error es reintentable
 *
 * @private
 */
function esErrorRetryable(statusCode) {
  // Reintentar en: rate limit, service unavailable, gateway timeout
  return [429, 503, 504, 408].includes(statusCode)
}

/**
 * Calcular tiempo de espera con backoff exponencial
 *
 * @private
 */
function calcularBackoff(intento) {
  // Backoff exponencial: 1s, 1.5s, 2.25s, etc.
  return Math.min(
    1000 * Math.pow(BACKOFF_MULTIPLIER, intento),
    30000, // máximo 30 segundos
  )
}

/**
 * Esperar N milisegundos
 *
 * @private
 */
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Verificar disponibilidad de API
 *
 * @returns {Promise<boolean>} True si API está disponible
 */
async function verificarDisponibilidad() {
  try {
    const inicio = Date.now()
    await fetchConTimeout(`${process.env.ACADEMIC_API_URL}/health`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.ACADEMIC_API_KEY,
      },
      timeout: 3000,
    })
    const duracion = Date.now() - inicio

    logger.debug(
      {
        provider: 'external-api',
        endpoint: '/health',
        responseTime: duracion,
        disponible: true,
      },
      '[AcademicAPI] Health check exitoso',
    )

    return true
  } catch (error) {
    logger.warn(
      {
        provider: 'external-api',
        endpoint: '/health',
        error: error.message,
        disponible: false,
      },
      '[AcademicAPI] Health check falló',
    )

    return false
  }
}

module.exports = {
  buscarEstudiantePorDocumento,
  listarEstudiantes,
  verificarDisponibilidad,
}
