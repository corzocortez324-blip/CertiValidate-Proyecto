const { sendSuccess, sendError } = require('../utils/response.utils')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const academicProvider = require('../services/academic-provider.service')
const integrationConfig = require('../services/integration-config.service')

// Listar estudiantes con paginación
const listarEstudiantes = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    )

    const institucionIds = req.institucionIds

    const search = (req.query.search || '').trim()
    const institucionId = req.query.institucion_id

    if (institucionIds.length === 0) {
      return sendError(res, 'No autorizado para ver estudiantes', 403)
    }

    const where = {
      institucion_id: { in: institucionIds },
    }

    if (institucionId) {
      if (!institucionIds.includes(institucionId)) {
        return sendError(
          res,
          'No autorizado para ver estudiantes de esta institución',
          403,
        )
      }

      where.institucion_id = { in: [institucionId] }
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { documento: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [estudiantes, total] = await prisma.$transaction([
      prisma.estudiante.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.estudiante.count({ where }),
    ])

    const totalPages = Math.max(Math.ceil(total / limit), 1)

    return sendSuccess(
      res,
      { data: estudiantes, meta: { total, page, limit, totalPages } },
      'Estudiantes obtenidos correctamente',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en listarEstudiantes',
    )
    return sendError(res, 'Error al listar estudiantes', 500)
  }
}

// Obtener estudiante por ID
const obtenerEstudiante = async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return sendError(res, 'ID del estudiante es obligatorio', 400)
    }

    const institucionIds = req.institucionIds

    const estudiante = await prisma.estudiante.findUnique({
      where: { id },
    })

    if (!estudiante) {
      return sendError(res, 'Estudiante no encontrado', 404)
    }

    if (institucionIds.length === 0) {
      return sendError(res, 'No autorizado para ver este estudiante', 403)
    }

    if (!institucionIds.includes(estudiante.institucion_id)) {
      return sendError(res, 'No autorizado para ver este estudiante', 403)
    }

    return sendSuccess(
      res,
      estudiante,
      'Estudiante obtenido correctamente',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en obtenerEstudiante',
    )
    return sendError(res, 'Error al obtener estudiante', 500)
  }
}

// Crear estudiante
const crearEstudiante = async (req, res) => {
  try {
    const { institucion_id, nombre, apellido, documento, email } = req.body

    if (!institucion_id || !nombre || !apellido || !documento) {
      return sendError(
        res,
        'institucion_id, nombre, apellido y documento son obligatorios',
        400,
      )
    }

    const institucion = await prisma.institucion.findUnique({
      where: { id: institucion_id },
    })

    if (!institucion) {
      return sendError(res, 'Institución no encontrada', 404)
    }

    const institucionIds = req.institucionIds

    if (!institucionIds.includes(institucion_id)) {
      return sendError(
        res,
        'No autorizado para crear estudiante en esta institución',
        403,
      )
    }

    const nuevoEstudiante = await prisma.estudiante.create({
      data: {
        institucion_id,
        nombre,
        apellido,
        documento,
        email: email || null,
      },
    })

    return sendSuccess(
      res,
      nuevoEstudiante,
      'Estudiante creado correctamente',
      201,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en crearEstudiante',
    )
    return sendError(res, 'Error al crear estudiante', 500)
  }
}

// Actualizar estudiante
const actualizarEstudiante = async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, apellido, documento, email, institucion_id } = req.body

    if (!id) {
      return sendError(res, 'ID del estudiante es obligatorio', 400)
    }

    const institucionIds = req.institucionIds

    const estudianteExistente = await prisma.estudiante.findUnique({
      where: { id },
    })

    if (!estudianteExistente) {
      return sendError(res, 'Estudiante no encontrado', 404)
    }

    if (institucionIds.length === 0) {
      return sendError(
        res,
        'No autorizado para actualizar este estudiante',
        403,
      )
    }

    if (!institucionIds.includes(estudianteExistente.institucion_id)) {
      return sendError(
        res,
        'No autorizado para actualizar este estudiante',
        403,
      )
    }

    if (institucion_id) {
      const institucion = await prisma.institucion.findUnique({
        where: { id: institucion_id },
      })

      if (!institucion) {
        return sendError(res, 'Institución no encontrada', 404)
      }

      if (!institucionIds.includes(institucion_id)) {
        return sendError(
          res,
          'No autorizado para mover estudiante a esta institución',
          403,
        )
      }
    }

    const estudianteActualizado = await prisma.estudiante.update({
      where: { id },
      data: {
        institucion_id: institucion_id || estudianteExistente.institucion_id,
        nombre: nombre || estudianteExistente.nombre,
        apellido: apellido || estudianteExistente.apellido,
        documento: documento || estudianteExistente.documento,
        email: email || estudianteExistente.email,
      },
    })

    return sendSuccess(
      res,
      estudianteActualizado,
      'Estudiante actualizado correctamente',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en actualizarEstudiante',
    )
    return sendError(res, 'Error al actualizar estudiante', 500)
  }
}

// Eliminar estudiante
const eliminarEstudiante = async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return sendError(res, 'ID del estudiante es obligatorio', 400)
    }

    const institucionIds = req.institucionIds

    const estudianteExistente = await prisma.estudiante.findUnique({
      where: { id },
    })

    if (!estudianteExistente) {
      return sendError(res, 'Estudiante no encontrado', 404)
    }

    if (institucionIds.length === 0) {
      return sendError(res, 'No autorizado para eliminar este estudiante', 403)
    }

    if (!institucionIds.includes(estudianteExistente.institucion_id)) {
      return sendError(res, 'No autorizado para eliminar este estudiante', 403)
    }

    const certificadosAsociados = await prisma.certificado.count({
      where: { estudiante_id: id },
    })

    if (certificadosAsociados > 0) {
      return sendError(
        res,
        'No se puede eliminar el estudiante porque tiene certificados asociados',
        409,
      )
    }

    await prisma.estudiante.delete({ where: { id } })

    return sendSuccess(res, null, 'Estudiante eliminado correctamente', 200)
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en eliminarEstudiante',
    )
    return sendError(res, 'Error al eliminar estudiante', 500)
  }
}

module.exports = {
  listarEstudiantes,
  obtenerEstudiante,
  crearEstudiante,
  actualizarEstudiante,
  eliminarEstudiante,
}
