const prisma = require('./prisma')
const logger = require('./logger')

const obtenerInstitucionesUsuario = async (usuarioId) => {
  if (!usuarioId) return []

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      instituciones: {
        select: {
          institucion_id: true,
        },
      },
    },
  })

  return usuario?.instituciones.map((item) => item.institucion_id) || []
}

const obtenerAccesosUsuario = async (usuarioId) => {
  if (!usuarioId) return []

  const accesos = await prisma.usuarioInstitucion.findMany({
    where: { usuario_id: usuarioId },
    include: {
      rol: {
        include: {
          permisos: {
            include: {
              permiso: true,
            },
          },
        },
      },
    },
  })

  return accesos.map((acceso) => ({
    institucion_id: acceso.institucion_id,
    rol: acceso.rol.nombre,
    permisos: acceso.rol.permisos.map(
      (rolPermiso) => `${rolPermiso.permiso.recurso}:${rolPermiso.permiso.accion}`,
    ),
  }))
}

const usuarioTienePermiso = async (
  usuarioId,
  recurso,
  accion,
  institucionId = null,
) => {
  const accesos = await obtenerAccesosUsuario(usuarioId)
  const permisoBuscado = `${recurso}:${accion}`

  return accesos.some((acceso) => {
    if (institucionId && acceso.institucion_id !== institucionId) {
      return false
    }
    return acceso.permisos.includes(permisoBuscado)
  })
}

const requirePermission = (
  recurso,
  accion,
  options = {},
) => async (req, res, next) => {
  try {
    const usuarioId = req.usuario?.id

    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Usuario no autenticado',
        timestamp: new Date().toISOString(),
      })
    }

    const institucionId = options.institucionIdResolver
      ? options.institucionIdResolver(req)
      : null

    const autorizado = await usuarioTienePermiso(
      usuarioId,
      recurso,
      accion,
      institucionId || null,
    )

    if (!autorizado) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: `No autorizado para ${accion} ${recurso}`,
        timestamp: new Date().toISOString(),
      })
    }

    next()
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error validando permisos')
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Error al validar permisos',
      timestamp: new Date().toISOString(),
    })
  }
}

const cargarInstitucionesUsuario = async (req, res, next) => {
  try {
    const usuarioId = req.usuario?.id
    if (!usuarioId) {
      req.institucionIds = []
      return next()
    }
    req.institucionIds = await obtenerInstitucionesUsuario(usuarioId)
    next()
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error cargando instituciones del usuario')
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Error al cargar permisos del usuario',
      timestamp: new Date().toISOString(),
    })
  }
}

module.exports = {
  obtenerInstitucionesUsuario,
  obtenerAccesosUsuario,
  usuarioTienePermiso,
  requirePermission,
  cargarInstitucionesUsuario,
}
