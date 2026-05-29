const academicApi = require('./academic-api.service')
const logger = require('../utils/logger')

/**
 * CAPA EXTENSIBLE DE PROVEEDORES ACADÉMICOS
 *
 * Arquitectura desacoplada que permite múltiples integraciones académicas:
 * - external-api: API REST externa
 * - local-db: Caché local en Prisma
 * - graphql: APIs GraphQL (futuro)
 * - supabase-direct: Supabase directo (futuro)
 * - sql-server: SQL Server académico (futuro)
 * - oracle: Oracle académico (futuro)
 * - soap: SOAP legacy (futuro)
 * - moodle: Moodle LMS (futuro)
 *
 * Nunca depende directamente de una tecnología específica.
 */

const prisma = require('../utils/prisma')

/**
 * Buscar estudiante por documento
 *
 * @param {string} provider - Tipo de proveedor (external-api, local-db, etc.)
 * @param {string} documento - Documento del estudiante
 * @param {string} institucionId - ID de institución (para caché local)
 * @returns {Promise<object>} Datos del estudiante
 */
async function buscarEstudiante({
  provider = 'external-api',
  documento,
  institucionId = null,
}) {
  if (!documento) {
    throw new Error('Documento es obligatorio para buscar estudiante')
  }

  const inicio = Date.now()

  try {
    let estudiante

    switch (provider) {
      case 'academic-api':
      case 'external-api':
        estudiante = await academicApi.buscarEstudiantePorDocumento(documento)
        break

      case 'local-db':
        estudiante = await buscarEstudianteLocal({ documento, institucionId })
        break

      case 'graphql':
        const errGraphQL = new Error('Proveedor GraphQL aún no implementado')
        errGraphQL.statusCode = 501
        throw errGraphQL

      case 'supabase-direct':
        const errSupabase = new Error('Proveedor Supabase aún no implementado')
        errSupabase.statusCode = 501
        throw errSupabase

      case 'sql-server':
        const errSQLServer = new Error('Proveedor SQL Server aún no implementado')
        errSQLServer.statusCode = 501
        throw errSQLServer

      case 'oracle':
        const errOracle = new Error('Proveedor Oracle aún no implementado')
        errOracle.statusCode = 501
        throw errOracle

      case 'soap':
        const errSOAP = new Error('Proveedor SOAP aún no implementado')
        errSOAP.statusCode = 501
        throw errSOAP

      case 'moodle':
        const errMoodle = new Error('Proveedor Moodle aún no implementado')
        errMoodle.statusCode = 501
        throw errMoodle

      default:
        const errDefault = new Error(`Proveedor académico no soportado: ${provider}`)
        errDefault.statusCode = 501
        throw errDefault
    }

    const duracion = Date.now() - inicio
    logger.debug(
      {
        provider,
        documento,
        institucionId,
        duracion,
        encontrado: !!estudiante,
      },
      `[AcademicProvider] Búsqueda exitosa en ${provider}`,
    )

    return estudiante
  } catch (error) {
    const duracion = Date.now() - inicio
    logger.warn(
      {
        provider,
        documento,
        institucionId,
        duracion,
        error: error.message,
      },
      `[AcademicProvider] Error en ${provider}`,
    )
    throw error
  }
}

/**
 * Buscar estudiante en base de datos local
 *
 * @private
 */
async function buscarEstudianteLocal({ documento, institucionId }) {
  const estudiante = await prisma.estudiante.findFirst({
    where: {
      documento,
      ...(institucionId && { institucion_id: institucionId }),
    },
  })

  return estudiante
}

/**
 * Listar estudiantes desde proveedor
 *
 * @param {string} provider - Tipo de proveedor
 * @param {string} institucionId - ID de institución (requerido para local-db)
 * @param {object} filtros - Filtros de búsqueda (search, skip, take)
 * @returns {Promise<array>} Lista de estudiantes
 */
async function listarEstudiantes({
  provider = 'external-api',
  institucionId,
  filtros = {},
}) {
  const inicio = Date.now()

  try {
    if (provider === 'local-db' && !institucionId) {
      throw new Error('institucionId es obligatorio para proveedor local-db')
    }

    let estudiantes

    switch (provider) {
      case 'academic-api':
      case 'external-api':
        estudiantes = await academicApi.listarEstudiantes(filtros)
        break

      case 'local-db':
        estudiantes = await listarEstudiantesLocal({ institucionId, filtros })
        break

      default:
        throw new Error(`Listar no soportado para proveedor: ${provider}`)
    }

    const duracion = Date.now() - inicio
    logger.debug(
      {
        provider,
        institucionId,
        cantidad: estudiantes?.length || 0,
        duracion,
      },
      `[AcademicProvider] Lista obtenida desde ${provider}`,
    )

    return estudiantes
  } catch (error) {
    const duracion = Date.now() - inicio
    logger.warn(
      {
        provider,
        institucionId,
        duracion,
        error: error.message,
      },
      `[AcademicProvider] Error listando desde ${provider}`,
    )
    throw error
  }
}

/**
 * Listar estudiantes de base de datos local
 *
 * @private
 */
async function listarEstudiantesLocal({ institucionId, filtros = {} }) {
  const { search, skip = 0, take = 50 } = filtros

  const where = {
    institucion_id: institucionId,
  }

  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { apellido: { contains: search, mode: 'insensitive' } },
      { documento: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  return prisma.estudiante.findMany({
    where,
    skip,
    take,
    orderBy: { created_at: 'desc' },
  })
}

/**
 * Validar disponibilidad del proveedor
 * Solo retorna true para proveedores IMPLEMENTADOS
 *
 * @param {string} provider - Tipo de proveedor
 * @returns {boolean} True si está implementado y disponible
 */
function esProveedorValido(provider) {
  const proveedoresImplementados = [
    'academic-api',
    'external-api',
    'local-db',
  ]
  return proveedoresImplementados.includes(provider)
}

/**
 * Obtener lista de proveedores disponibles (implementados)
 *
 * @returns {array<string>} Proveedores implementados
 */
function obtenerProveedoresDisponibles() {
  return [
    'academic-api',
    'external-api',
    'local-db',
  ]
}

module.exports = {
  buscarEstudiante,
  listarEstudiantes,
  esProveedorValido,
  obtenerProveedoresDisponibles,
}
