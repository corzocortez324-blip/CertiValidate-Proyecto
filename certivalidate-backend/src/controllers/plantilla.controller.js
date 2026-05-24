const { sendSuccess, sendError } = require('../utils/response.utils')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')

// Listar plantillas activas
const listarPlantillas = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100)
    const institucionIds = req.institucionIds

    if (institucionIds.length === 0) {
      return sendError(res, 'No autorizado para ver plantillas', 403)
    }

    const where = {
      activa: true,
      institucion_id: { in: institucionIds },
    }

    const [plantillas, total] = await prisma.$transaction([
      prisma.plantillaCertificado.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.plantillaCertificado.count({ where }),
    ])

    const totalPages = Math.max(Math.ceil(total / limit), 1)

    return sendSuccess(
      res,
      { data: plantillas, meta: { total, page, limit, totalPages } },
      'Plantillas obtenidas correctamente',
      200,
    )
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en listarPlantillas')
    return sendError(res, 'Error al listar plantillas', 500)
  }
}

// Obtener plantilla por ID
const obtenerPlantilla = async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return sendError(res, 'ID de la plantilla es obligatorio', 400)
    }

    const institucionIds = req.institucionIds

    const plantilla = await prisma.plantillaCertificado.findUnique({
      where: { id },
    })

    if (!plantilla) {
      return sendError(res, 'Plantilla no encontrada', 404)
    }

    if (!institucionIds.includes(plantilla.institucion_id)) {
      return sendError(res, 'No autorizado para ver esta plantilla', 403)
    }

    return sendSuccess(res, plantilla, 'Plantilla obtenida correctamente', 200)
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en obtenerPlantilla')
    return sendError(res, 'Error al obtener plantilla', 500)
  }
}

// Crear plantilla
const crearPlantilla = async (req, res) => {
  try {
    const { institucion_id, nombre, template_html, version, activa } = req.body

    if (!institucion_id || !nombre || !template_html || version === undefined) {
      return sendError(
        res,
        'institucion_id, nombre, template_html y version son obligatorios',
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
        'No autorizado para crear plantilla en esta institución',
        403,
      )
    }

    const nuevaPlantilla = await prisma.plantillaCertificado.create({
      data: {
        institucion_id,
        nombre,
        template_html,
        version,
        activa: typeof activa === 'boolean' ? activa : true,
      },
    })

    return sendSuccess(
      res,
      nuevaPlantilla,
      'Plantilla creada correctamente',
      201,
    )
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en crearPlantilla')
    return sendError(res, 'Error al crear plantilla', 500)
  }
}

// Actualizar plantilla
const actualizarPlantilla = async (req, res) => {
  try {
    const { id } = req.params
    const { institucion_id, nombre, template_html, version, activa } = req.body

    if (!id) {
      return sendError(res, 'ID de la plantilla es obligatorio', 400)
    }

    const plantillaExistente = await prisma.plantillaCertificado.findUnique({
      where: { id },
    })

    if (!plantillaExistente) {
      return sendError(res, 'Plantilla no encontrada', 404)
    }

    const institucionIds = req.institucionIds

    if (institucionIds.length === 0) {
      return sendError(res, 'No autorizado para actualizar esta plantilla', 403)
    }

    if (!institucionIds.includes(plantillaExistente.institucion_id)) {
      return sendError(res, 'No autorizado para actualizar esta plantilla', 403)
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
          'No autorizado para mover plantilla a esta institución',
          403,
        )
      }
    }

    const plantillaActualizada = await prisma.plantillaCertificado.update({
      where: { id },
      data: {
        institucion_id: institucion_id || plantillaExistente.institucion_id,
        nombre: nombre || plantillaExistente.nombre,
        template_html: template_html || plantillaExistente.template_html,
        version: version !== undefined ? version : plantillaExistente.version,
        activa:
          typeof activa === 'boolean' ? activa : plantillaExistente.activa,
      },
    })

    return sendSuccess(
      res,
      plantillaActualizada,
      'Plantilla actualizada correctamente',
      200,
    )
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en actualizarPlantilla')
    return sendError(res, 'Error al actualizar plantilla', 500)
  }
}

const archivarPlantilla = async (req, res) => {
  try {
    const { id } = req.params

    const plantilla = await prisma.plantillaCertificado.findUnique({ where: { id } })
    if (!plantilla) return sendError(res, 'Plantilla no encontrada', 404)

    const institucionIds = req.institucionIds
    if (!institucionIds.includes(plantilla.institucion_id)) {
      return sendError(res, 'No autorizado para archivar esta plantilla', 403)
    }

    if (!plantilla.activa) {
      return sendSuccess(res, plantilla, 'La plantilla ya estaba inactiva', 200)
    }

    const certActivos = await prisma.certificado.count({
      where: {
        plantilla_id: id,
        estado: 'valido',
        deleted_at: null,
      },
    })

    const plantillaActualizada = await prisma.plantillaCertificado.update({
      where: { id },
      data: { activa: false },
    })

    const mensaje = certActivos > 0
      ? `Plantilla archivada. Advertencia: tiene ${certActivos} certificado(s) válido(s) emitido(s) con esta plantilla.`
      : 'Plantilla archivada correctamente'

    return sendSuccess(res, plantillaActualizada, mensaje, 200)
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en archivarPlantilla')
    return sendError(res, 'Error al archivar plantilla', 500)
  }
}

module.exports = {
  listarPlantillas,
  obtenerPlantilla,
  crearPlantilla,
  actualizarPlantilla,
  archivarPlantilla,
}
