const { sendSuccess, sendError } = require('../utils/response.utils')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')

const construirFiltroAuditoriaAutorizada = (usuarioId, institucionIds) => {
  if (institucionIds.length === 0) {
    return null
  }

  return {
    OR: [
      { institucion_id: { in: institucionIds } },
      { entidad: 'Usuario', entidad_id: usuarioId },
    ],
  }
}

const listarAuditoria = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    )
    const { entidad, accion, usuario_id, fecha_desde, fecha_hasta } = req.query

    const filtroAutorizado = construirFiltroAuditoriaAutorizada(
      req.usuario?.id,
      req.institucionIds,
    )

    if (!filtroAutorizado) {
      return sendError(res, 'No autorizado para ver auditoría', 403)
    }

    const where = { AND: [filtroAutorizado] }

    if (entidad) {
      where.AND.push({ entidad })
    }

    if (accion) {
      where.AND.push({ accion })
    }

    if (usuario_id) {
      where.AND.push({ usuario_id })
    }

    if (fecha_desde || fecha_hasta) {
      const fecha = {}
      if (fecha_desde) fecha.gte = new Date(fecha_desde)
      if (fecha_hasta) fecha.lte = new Date(fecha_hasta)
      where.AND.push({ fecha })
    }

    const [auditorias, total] = await prisma.$transaction([
      prisma.auditoria.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fecha: 'desc' },
        include: {
          usuario: {
            select: { id: true, nombre: true, apellido: true, email: true },
          },
          institucion: {
            select: { id: true, nombre: true },
          },
        },
      }),
      prisma.auditoria.count({ where }),
    ])

    const totalPages = Math.max(Math.ceil(total / limit), 1)

    return sendSuccess(
      res,
      { data: auditorias, meta: { total, page, limit, totalPages } },
      'Registros de auditoría obtenidos correctamente',
      200,
    )
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en listarAuditoria')
    return sendError(res, 'Error al listar auditoría', 500)
  }
}

const obtenerAuditoriaPorEntidad = async (req, res) => {
  try {
    const { entidad, entidad_id } = req.params
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100)

    if (!entidad || !entidad_id) {
      return sendError(res, 'Entidad y entidad_id son obligatorios', 400)
    }

    const filtroAutorizado = construirFiltroAuditoriaAutorizada(
      req.usuario?.id,
      req.institucionIds,
    )

    if (!filtroAutorizado) {
      return sendError(res, 'No autorizado para ver auditoría', 403)
    }

    const where = {
      AND: [filtroAutorizado, { entidad, entidad_id }],
    }

    const total = await prisma.auditoria.count({ where })

    const auditorias = await prisma.auditoria.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { fecha: 'desc' },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    })

    const totalPages = Math.max(Math.ceil(total / limit), 1)

    return sendSuccess(
      res,
      {
        total,
        page,
        limit,
        totalPages,
        auditorias,
      },
      'Historial de auditoría obtenido correctamente',
      200,
    )
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en obtenerAuditoriaPorEntidad')
    return sendError(res, 'Error al obtener historial de auditoría', 500)
  }
}

module.exports = {
  listarAuditoria,
  obtenerAuditoriaPorEntidad,
}
