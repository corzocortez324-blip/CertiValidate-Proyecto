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
 * - Config dinámica por institución (url_base, api_key)
 */

const DEFAULT_TIMEOUT = parseInt(process.env.ACADEMIC_API_TIMEOUT || 5000)
const MAX_RETRIES = parseInt(process.env.ACADEMIC_API_MAX_RETRIES || 3)
const BACKOFF_MULTIPLIER = 1.5

/**
 * Construir URL base para llamadas a la API de estudiantes/certificados.
 * - Config dinámica: url_base apunta a la raíz (http://host:4000) → agrega /api
 * - Env var: ACADEMIC_API_URL ya incluye /api
 */
function getApiBase(config = {}) {
  return config.url_base
    ? `${config.url_base}/api`
    : process.env.ACADEMIC_API_URL
}

/**
 * Construir URL del health check.
 * - Config dinámica: url_base/health (sin /api)
 * - Env var: ACADEMIC_API_URL/health (comportamiento legacy)
 */
function getHealthUrl(config = {}) {
  return config.url_base
    ? `${config.url_base}/health`
    : `${process.env.ACADEMIC_API_URL}/health`
}

/**
 * Obtener el valor de api_key a usar: config dinámica tiene prioridad sobre env var.
 */
function getApiKey(config = {}) {
  return config.api_key !== undefined
    ? config.api_key
    : process.env.ACADEMIC_API_KEY
}

/**
 * Buscar estudiante por documento con retry y timeout
 *
 * @param {string} documento - Documento del estudiante
 * @param {object} opciones - Configuración (timeout, maxRetries, url_base, api_key)
 * @returns {Promise<object>} Datos del estudiante
 */
async function buscarEstudiantePorDocumento(documento, opciones = {}) {
  const timeout = opciones.timeout || DEFAULT_TIMEOUT
  const maxRetries = opciones.maxRetries || MAX_RETRIES
  const apiBase = getApiBase(opciones)
  const apiKey = getApiKey(opciones)

  logger.debug(
    { provider: 'external-api', endpoint: `/estudiantes/${documento}`, has_api_key: !!apiKey },
    '[AcademicAPI] Iniciando búsqueda de estudiante',
  )

  const inicio = Date.now()
  let ultimoError

  for (let intento = 0; intento <= maxRetries; intento++) {
    try {
      const data = await fetchConTimeout(
        `${apiBase}/estudiantes/${documento}`,
        {
          method: 'GET',
          headers: {
            ...(apiKey && { 'x-api-key': apiKey }),
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
 * @param {object} filtros - Filtros de búsqueda (también acepta url_base, api_key para config dinámica)
 * @returns {Promise<array>} Lista de estudiantes
 */
async function listarEstudiantes(filtros = {}) {
  const timeout = filtros.timeout || DEFAULT_TIMEOUT
  const maxRetries = filtros.maxRetries || MAX_RETRIES
  const apiBase = getApiBase(filtros)
  const apiKey = getApiKey(filtros)

  logger.debug(
    { provider: 'external-api', endpoint: '/estudiantes', has_api_key: !!apiKey },
    '[AcademicAPI] Iniciando listado de estudiantes',
  )

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
        `${apiBase}/estudiantes?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            ...(apiKey && { 'x-api-key': apiKey }),
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
 * @param {object} config - Config dinámica opcional: { url_base, api_key }
 *   url_base debe ser la URL raíz (ej: http://localhost:4000); el health se prueba en {url_base}/health
 * @returns {Promise<boolean>} True si API está disponible
 */
async function verificarDisponibilidad(config = {}) {
  const healthUrl = getHealthUrl(config)
  const apiKey = getApiKey(config)

  logger.debug(
    { provider: 'external-api', endpoint: healthUrl, has_api_key: !!apiKey },
    '[AcademicAPI] Iniciando health check',
  )

  try {
    const inicio = Date.now()
    await fetchConTimeout(healthUrl, {
      method: 'GET',
      headers: {
        ...(apiKey && { 'x-api-key': apiKey }),
      },
      timeout: 5000,
    })
    const duracion = Date.now() - inicio

    logger.debug(
      {
        provider: 'external-api',
        endpoint: healthUrl,
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
        endpoint: healthUrl,
        error: error.message,
        disponible: false,
      },
      '[AcademicAPI] Health check falló',
    )

    return false
  }
}

/**
 * Listar certificados desde API externa
 *
 * @param {object} filtros - Filtros de búsqueda (también acepta url_base, api_key para config dinámica)
 * @returns {Promise<array>} Lista de certificados
 */
async function listarCertificados(filtros = {}) {
  const timeout = filtros.timeout || DEFAULT_TIMEOUT
  const maxRetries = filtros.maxRetries || MAX_RETRIES
  const apiBase = getApiBase(filtros)
  const apiKey = getApiKey(filtros)

  logger.debug(
    { provider: 'external-api', endpoint: '/certificados', has_api_key: !!apiKey },
    '[AcademicAPI] Iniciando listado de certificados',
  )

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
        `${apiBase}/certificados?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            ...(apiKey && { 'x-api-key': apiKey }),
            'Content-Type': 'application/json',
          },
          timeout,
        },
      )

      const duracion = Date.now() - inicio
      logger.info(
        {
          provider: 'external-api',
          endpoint: '/certificados (lista)',
          responseTime: duracion,
          cantidad: Array.isArray(data) ? data.length : 0,
          intento: intento + 1,
          exitoso: true,
        },
        '[AcademicAPI] Lista de certificados obtenida',
      )

      return data
    } catch (error) {
      ultimoError = error
      const esRetryable = esErrorRetryable(error.statusCode)
      const tiempoEspera = esRetryable ? calcularBackoff(intento) : 0

      if (intento < maxRetries && esRetryable) {
        logger.warn(
          {
            provider: 'external-api',
            endpoint: '/certificados (lista)',
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

  logger.error(
    {
      provider: 'external-api',
      endpoint: '/certificados (lista)',
      intentos: maxRetries + 1,
      error: ultimoError?.message,
    },
    '[AcademicAPI] Falló listando certificados',
  )

  throw ultimoError || new Error('Error listando certificados desde API')
}

/**
 * Listar plantillas desde API externa
 *
 * @param {object} filtros - Filtros de búsqueda (también acepta url_base, api_key para config dinámica)
 * @returns {Promise<array>} Lista de plantillas
 */
async function listarPlantillas(filtros = {}) {
  const timeout = filtros.timeout || DEFAULT_TIMEOUT
  const maxRetries = filtros.maxRetries || MAX_RETRIES
  const apiBase = getApiBase(filtros)
  const apiKey = getApiKey(filtros)

  logger.debug(
    { provider: 'external-api', endpoint: '/plantillas', has_api_key: !!apiKey },
    '[AcademicAPI] Iniciando listado de plantillas',
  )

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
        `${apiBase}/plantillas?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            ...(apiKey && { 'x-api-key': apiKey }),
            'Content-Type': 'application/json',
          },
          timeout,
        },
      )

      const duracion = Date.now() - inicio
      logger.info(
        {
          provider: 'external-api',
          endpoint: '/plantillas (lista)',
          responseTime: duracion,
          cantidad: Array.isArray(data) ? data.length : 0,
          intento: intento + 1,
          exitoso: true,
        },
        '[AcademicAPI] Lista de plantillas obtenida',
      )

      return data
    } catch (error) {
      ultimoError = error
      const esRetryable = esErrorRetryable(error.statusCode)
      const tiempoEspera = esRetryable ? calcularBackoff(intento) : 0

      if (intento < maxRetries && esRetryable) {
        logger.warn(
          {
            provider: 'external-api',
            endpoint: '/plantillas (lista)',
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

  logger.error(
    {
      provider: 'external-api',
      endpoint: '/plantillas (lista)',
      intentos: maxRetries + 1,
      error: ultimoError?.message,
    },
    '[AcademicAPI] Falló listando plantillas',
  )

  throw ultimoError || new Error('Error listando plantillas desde API')
}

/**
 * Listar cursos desde API externa
 *
 * @param {object} filtros - Filtros de búsqueda (también acepta url_base, api_key para config dinámica)
 * @returns {Promise<array>} Lista de cursos
 */
async function listarCursos(filtros = {}) {
  const timeout = filtros.timeout || DEFAULT_TIMEOUT
  const maxRetries = filtros.maxRetries || MAX_RETRIES
  const apiBase = getApiBase(filtros)
  const apiKey = getApiKey(filtros)

  logger.debug(
    { provider: 'external-api', endpoint: '/cursos', has_api_key: !!apiKey },
    '[AcademicAPI] Iniciando listado de cursos',
  )

  const inicio = Date.now()
  let ultimoError

  for (let intento = 0; intento <= maxRetries; intento++) {
    try {
      const data = await fetchConTimeout(
        `${apiBase}/cursos`,
        {
          method: 'GET',
          headers: {
            ...(apiKey && { 'x-api-key': apiKey }),
            'Content-Type': 'application/json',
          },
          timeout,
        },
      )

      const duracion = Date.now() - inicio
      logger.info(
        {
          provider: 'external-api',
          endpoint: '/cursos (lista)',
          responseTime: duracion,
          cantidad: Array.isArray(data) ? data.length : 0,
          intento: intento + 1,
          exitoso: true,
        },
        '[AcademicAPI] Lista de cursos obtenida',
      )

      return data
    } catch (error) {
      ultimoError = error
      const esRetryable = esErrorRetryable(error.statusCode)
      const tiempoEspera = esRetryable ? calcularBackoff(intento) : 0

      if (intento < maxRetries && esRetryable) {
        logger.warn(
          {
            provider: 'external-api',
            endpoint: '/cursos (lista)',
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

  logger.error(
    {
      provider: 'external-api',
      endpoint: '/cursos (lista)',
      intentos: maxRetries + 1,
      error: ultimoError?.message,
    },
    '[AcademicAPI] Falló listando cursos',
  )

  throw ultimoError || new Error('Error listando cursos desde API')
}

/**
 * Listar firmantes desde API externa
 *
 * @param {object} filtros - Filtros de búsqueda (también acepta url_base, api_key para config dinámica)
 * @returns {Promise<array>} Lista de firmantes
 */
async function listarFirmantes(filtros = {}) {
  const timeout = filtros.timeout || DEFAULT_TIMEOUT
  const maxRetries = filtros.maxRetries || MAX_RETRIES
  const apiBase = getApiBase(filtros)
  const apiKey = getApiKey(filtros)

  logger.debug(
    { provider: 'external-api', endpoint: '/firmantes', has_api_key: !!apiKey },
    '[AcademicAPI] Iniciando listado de firmantes',
  )

  const inicio = Date.now()
  let ultimoError

  for (let intento = 0; intento <= maxRetries; intento++) {
    try {
      const data = await fetchConTimeout(
        `${apiBase}/firmantes`,
        {
          method: 'GET',
          headers: {
            ...(apiKey && { 'x-api-key': apiKey }),
            'Content-Type': 'application/json',
          },
          timeout,
        },
      )

      const duracion = Date.now() - inicio
      logger.info(
        {
          provider: 'external-api',
          endpoint: '/firmantes (lista)',
          responseTime: duracion,
          cantidad: Array.isArray(data) ? data.length : 0,
          intento: intento + 1,
          exitoso: true,
        },
        '[AcademicAPI] Lista de firmantes obtenida',
      )

      return data
    } catch (error) {
      ultimoError = error
      const esRetryable = esErrorRetryable(error.statusCode)
      const tiempoEspera = esRetryable ? calcularBackoff(intento) : 0

      if (intento < maxRetries && esRetryable) {
        logger.warn(
          {
            provider: 'external-api',
            endpoint: '/firmantes (lista)',
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

  logger.error(
    {
      provider: 'external-api',
      endpoint: '/firmantes (lista)',
      intentos: maxRetries + 1,
      error: ultimoError?.message,
    },
    '[AcademicAPI] Falló listando firmantes',
  )

  throw ultimoError || new Error('Error listando firmantes desde API')
}

module.exports = {
  buscarEstudiantePorDocumento,
  listarEstudiantes,
  listarCertificados,
  listarPlantillas,
  listarCursos,
  listarFirmantes,
  verificarDisponibilidad,
}
