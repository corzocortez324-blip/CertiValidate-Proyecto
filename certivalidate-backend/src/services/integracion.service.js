const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const academicApiService = require('./academic-api.service')
const integrationConfigService = require('./integration-config.service')

async function obtenerConfigActiva(institucionId) {
  const config = await integrationConfigService.obtenerConfiguracion(institucionId, {
    usarCache: true,
  })

  if (!config || config.provider === 'local-db' || !config.url_base) {
    const error = new Error(
      'No hay integración activa con API externa configurada para esta institución',
    )
    error.statusCode = 404
    throw error
  }

  logger.debug(
    { institucionId, provider: config.provider, has_api_key: !!config.api_key },
    '[IntegracionService] Configuración activa cargada',
  )

  return config
}

function normalizarLista(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.data)) return data.data
  if (data && Array.isArray(data.items)) return data.items
  if (data && Array.isArray(data.results)) return data.results
  return []
}

async function obtenerResumen(institucionId, requestId) {
  const config = await obtenerConfigActiva(institucionId)

  logger.info(
    { institucionId, requestId },
    '[IntegracionService] Obteniendo resumen desde API externa',
  )

  const [resultEst, resultCert, resultPlant] = await Promise.allSettled([
    academicApiService.listarEstudiantes({ url_base: config.url_base, api_key: config.api_key }),
    academicApiService.listarCertificados({ url_base: config.url_base, api_key: config.api_key }),
    academicApiService.listarPlantillas({ url_base: config.url_base, api_key: config.api_key }),
  ])

  const contar = (result) => {
    if (result.status !== 'fulfilled') return 0
    return normalizarLista(result.value).length
  }

  const resumen = {
    institucion_id: institucionId,
    estado: 'conectado',
    estudiantes_externos: contar(resultEst),
    certificados_externos: contar(resultCert),
    plantillas_externas: contar(resultPlant),
    ultima_verificacion: new Date().toISOString(),
  }

  logger.info({ institucionId, resumen, requestId }, '[IntegracionService] Resumen obtenido')

  return resumen
}

async function obtenerEstudiantes(institucionId, filtros = {}, requestId) {
  const config = await obtenerConfigActiva(institucionId)

  logger.info({ institucionId, requestId }, '[IntegracionService] Obteniendo estudiantes desde API externa')

  const raw = await academicApiService.listarEstudiantes({
    url_base: config.url_base,
    api_key: config.api_key,
    ...filtros,
  })

  const lista = normalizarLista(raw)

  return { data: lista, total: lista.length, origen: 'academic-api' }
}

async function obtenerCertificados(institucionId, filtros = {}, requestId) {
  const config = await obtenerConfigActiva(institucionId)

  logger.info({ institucionId, requestId }, '[IntegracionService] Obteniendo certificados desde API externa')

  const raw = await academicApiService.listarCertificados({
    url_base: config.url_base,
    api_key: config.api_key,
    ...filtros,
  })

  const lista = normalizarLista(raw)

  return { data: lista, total: lista.length, origen: 'academic-api' }
}

async function obtenerPlantillas(institucionId, filtros = {}, requestId) {
  const config = await obtenerConfigActiva(institucionId)

  logger.info({ institucionId, requestId }, '[IntegracionService] Obteniendo plantillas desde API externa')

  const raw = await academicApiService.listarPlantillas({
    url_base: config.url_base,
    api_key: config.api_key,
    ...filtros,
  })

  const lista = normalizarLista(raw)

  return { data: lista, total: lista.length, origen: 'academic-api' }
}

async function obtenerCursos(institucionId, filtros = {}, requestId) {
  const config = await obtenerConfigActiva(institucionId)

  logger.info({ institucionId, requestId }, '[IntegracionService] Obteniendo cursos desde API externa')

  const raw = await academicApiService.listarCursos({
    url_base: config.url_base,
    api_key: config.api_key,
    ...filtros,
  })

  const lista = normalizarLista(raw)

  return { data: lista, total: lista.length, origen: 'academic-api' }
}

async function obtenerFirmantes(institucionId, filtros = {}, requestId) {
  const config = await obtenerConfigActiva(institucionId)

  logger.info({ institucionId, requestId }, '[IntegracionService] Obteniendo firmantes desde API externa')

  const raw = await academicApiService.listarFirmantes({
    url_base: config.url_base,
    api_key: config.api_key,
    ...filtros,
  })

  const lista = normalizarLista(raw)

  return { data: lista, total: lista.length, origen: 'academic-api' }
}

/**
 * Sincronizar entidades externas hacia la base de datos local.
 * Orden fijo: estudiantes → plantillas → certificados.
 * Si certificados está en el lote, estudiantes y plantillas se sincronizan
 * primero aunque no hayan sido solicitados explícitamente.
 */
async function sincronizar(institucionId, entidades = [], requestId) {
  const config = await obtenerConfigActiva(institucionId)
  const inicio = Date.now()

  const sincronizarCerts = entidades.includes('certificados')
  const sincronizarEstuds = entidades.includes('estudiantes') || sincronizarCerts
  const sincronizarPlants = entidades.includes('plantillas') || sincronizarCerts

  logger.info(
    { institucionId, entidades, sincronizarEstuds, sincronizarPlants, sincronizarCerts, requestId },
    '[Sincronizar] Iniciando sincronización',
  )

  const resultado = {
    estudiantes: { recibidos: 0, creados: 0, actualizados: 0, errores: 0 },
    plantillas: { recibidos: 0, creados: 0, actualizados: 0, errores: 0 },
    certificados: { recibidos: 0, creados: 0, actualizados: 0, errores: 0 },
  }

  if (sincronizarEstuds) {
    resultado.estudiantes = await _sincronizarEstudiantes(institucionId, config, requestId)
  }

  if (sincronizarPlants) {
    resultado.plantillas = await _sincronizarPlantillas(institucionId, config, requestId)
  }

  if (sincronizarCerts) {
    resultado.certificados = await _sincronizarCertificados(institucionId, config, requestId)
  }

  const duracion = Date.now() - inicio
  logger.info(
    { institucionId, duracion, resultado, requestId },
    '[Sincronizar] Fin sincronización',
  )

  return resultado
}

/**
 * Upsert de estudiantes externos.
 * Pre-carga todos los documentos existentes en una sola consulta para
 * evitar un findUnique por cada estudiante dentro del loop.
 * @private
 */
async function _sincronizarEstudiantes(institucionId, config, requestId) {
  logger.info({ institucionId, requestId }, '[Sincronizar] Iniciando — estudiantes')

  const raw = await academicApiService.listarEstudiantes({
    url_base: config.url_base,
    api_key: config.api_key,
    maxRetries: 1,
  })
  const lista = normalizarLista(raw)

  logger.info({ institucionId, recibidos: lista.length, requestId }, '[Sincronizar] Estudiantes recibidos')

  // Una sola consulta para saber qué documentos ya existen
  const existentesRaw = await prisma.estudiante.findMany({
    where: { institucion_id: institucionId },
    select: { id: true, documento: true },
  })
  const existentesMap = new Map(existentesRaw.map((e) => [e.documento, e.id]))

  let creados = 0
  let actualizados = 0
  let errores = 0

  for (const est of lista) {
    const documento = est.documento || est.cedula || est.id_estudiante || est.numero_documento
    const nombre = est.nombre || est.first_name || est.firstName || est.nombres
    const apellido = est.apellido || est.apellidos || est.last_name || est.lastName || ''

    if (!documento || !nombre) {
      errores++
      continue
    }

    const docStr = String(documento)

    try {
      if (existentesMap.has(docStr)) {
        await prisma.estudiante.update({
          where: { id: existentesMap.get(docStr) },
          data: { nombre, apellido, email: est.email || null },
        })
        actualizados++
      } else {
        await prisma.estudiante.create({
          data: {
            institucion_id: institucionId,
            nombre,
            apellido,
            documento: docStr,
            email: est.email || null,
          },
        })
        existentesMap.set(docStr, null) // evitar duplicados si la lista externa repite documentos
        creados++
      }
    } catch (err) {
      logger.warn(
        { documento: docStr, error: err.message, requestId },
        '[Sincronizar] Error estudiante — omitido',
      )
      errores++
    }
  }

  logger.info(
    { institucionId, recibidos: lista.length, creados, actualizados, errores, requestId },
    '[Sincronizar] Estudiantes sincronizados',
  )

  return { recibidos: lista.length, creados, actualizados, errores }
}

/**
 * Insert de plantillas externas que no existan localmente.
 * No actualiza plantillas existentes para evitar sobrescribir templates editados localmente.
 * Pre-carga todos los nombres existentes en una sola consulta.
 * @private
 */
async function _sincronizarPlantillas(institucionId, config, requestId) {
  logger.info({ institucionId, requestId }, '[Sincronizar] Iniciando — plantillas')

  const raw = await academicApiService.listarPlantillas({
    url_base: config.url_base,
    api_key: config.api_key,
    maxRetries: 1,
  })
  const lista = normalizarLista(raw)

  logger.info({ institucionId, recibidos: lista.length, requestId }, '[Sincronizar] Plantillas recibidas')

  // Una sola consulta para saber qué nombres ya existen
  const existentesRaw = await prisma.plantillaCertificado.findMany({
    where: { institucion_id: institucionId },
    select: { nombre: true },
  })
  const nombresExistentes = new Set(existentesRaw.map((p) => p.nombre))

  let creados = 0
  let actualizados = 0
  let errores = 0

  for (const plantilla of lista) {
    const nombre = plantilla.nombre || plantilla.name || plantilla.title

    if (!nombre) {
      errores++
      continue
    }

    try {
      if (nombresExistentes.has(nombre)) {
        actualizados++ // ya existe localmente, no se sobreescribe
      } else {
        await prisma.plantillaCertificado.create({
          data: {
            institucion_id: institucionId,
            nombre,
            template_html: plantilla.template_html || plantilla.html || plantilla.contenido || '',
            version: plantilla.version || 1,
            activa: plantilla.activa !== undefined ? Boolean(plantilla.activa) : true,
          },
        })
        nombresExistentes.add(nombre)
        creados++
      }
    } catch (err) {
      logger.warn(
        { nombre, error: err.message, requestId },
        '[Sincronizar] Error plantilla — omitida',
      )
      errores++
    }
  }

  logger.info(
    { institucionId, recibidos: lista.length, creados, actualizados, errores, requestId },
    '[Sincronizar] Plantillas sincronizadas',
  )

  return { recibidos: lista.length, creados, actualizados, errores }
}

/**
 * Upsert de certificados externos.
 * Pre-carga estudiantes, plantillas y certificados existentes en mapas de memoria
 * para evitar consultas repetitivas dentro del loop de certificados.
 * @private
 */
async function _sincronizarCertificados(institucionId, config, requestId) {
  logger.info({ institucionId, requestId }, '[Sincronizar] Iniciando — certificados')

  const raw = await academicApiService.listarCertificados({
    url_base: config.url_base,
    api_key: config.api_key,
    maxRetries: 1,
  })
  const lista = normalizarLista(raw)

  logger.info({ institucionId, recibidos: lista.length, requestId }, '[Sincronizar] Certificados recibidos')

  // Pre-cargar todos los estudiantes de la institución (una sola consulta)
  const estudiantesRaw = await prisma.estudiante.findMany({
    where: { institucion_id: institucionId },
    select: { id: true, documento: true },
  })
  const estudiantesPorDocumento = new Map(estudiantesRaw.map((e) => [e.documento, e]))

  logger.info(
    { institucionId, totalEstudiantes: estudiantesRaw.length, requestId },
    '[Sincronizar] Mapa de estudiantes cargado',
  )

  // Pre-cargar todas las plantillas de la institución (una sola consulta)
  const plantillasRaw = await prisma.plantillaCertificado.findMany({
    where: { institucion_id: institucionId },
    select: { id: true, nombre: true, activa: true },
  })
  const plantillasPorNombre = new Map(plantillasRaw.map((p) => [p.nombre, p]))
  const plantillaFallback = plantillasRaw.find((p) => p.activa) || plantillasRaw[0] || null

  logger.info(
    { institucionId, totalPlantillas: plantillasRaw.length, requestId },
    '[Sincronizar] Mapa de plantillas cargado',
  )

  // Pre-cargar certificados existentes por codigo_unico (una sola consulta)
  const codigos = lista.map((c) => c.codigo).filter(Boolean)
  const certsExistentesRaw =
    codigos.length > 0
      ? await prisma.certificado.findMany({
          where: { codigo_unico: { in: codigos } },
          select: { id: true, codigo_unico: true },
        })
      : []
  const certsPorCodigo = new Map(certsExistentesRaw.map((c) => [c.codigo_unico, c]))

  let creados = 0
  let actualizados = 0
  let errores = 0

  for (const cert of lista) {
    const codigo = cert.codigo
    const documento = cert.estudiante_documento ? String(cert.estudiante_documento) : null

    if (!codigo) {
      errores++
      continue
    }

    const estudiante = documento ? estudiantesPorDocumento.get(documento) : null
    const plantilla =
      (cert.plantilla_nombre ? plantillasPorNombre.get(cert.plantilla_nombre) : null) ||
      plantillaFallback

    if (!estudiante) {
      logger.warn(
        { institucionId, codigo, documento, requestId },
        '[Sincronizar] Certificado omitido: estudiante no encontrado',
      )
      errores++
      continue
    }

    if (!plantilla) {
      logger.warn(
        { institucionId, codigo, requestId },
        '[Sincronizar] Certificado omitido: no hay plantilla activa',
      )
      errores++
      continue
    }

    const fechaEmision = cert.fecha_emision ? new Date(cert.fecha_emision) : new Date()
    const fechaExpiracion = cert.fecha_expiracion ? new Date(cert.fecha_expiracion) : null
    const estado = cert.estado || 'VIGENTE'

    try {
      const existente = certsPorCodigo.get(codigo)

      if (existente) {
        await prisma.certificado.update({
          where: { id: existente.id },
          data: { estado, fecha_emision: fechaEmision, fecha_expiracion: fechaExpiracion },
        })
        actualizados++
      } else {
        await prisma.certificado.create({
          data: {
            institucion_id: institucionId,
            estudiante_id: estudiante.id,
            plantilla_id: plantilla.id,
            codigo_unico: codigo,
            estado,
            fecha_emision: fechaEmision,
            fecha_expiracion: fechaExpiracion,
          },
        })
        creados++
      }
    } catch (err) {
      logger.warn(
        { institucionId, codigo, documento, error: err.message, requestId },
        '[Sincronizar] Error Prisma sincronizando certificado — omitido',
      )
      errores++
    }
  }

  logger.info(
    { institucionId, recibidos: lista.length, creados, actualizados, errores, requestId },
    '[Sincronizar] Certificados sincronizados',
  )

  return { recibidos: lista.length, creados, actualizados, errores }
}

module.exports = {
  obtenerResumen,
  obtenerEstudiantes,
  obtenerCertificados,
  obtenerPlantillas,
  obtenerCursos,
  obtenerFirmantes,
  sincronizar,
}
