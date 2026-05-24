const prisma = require('../utils/prisma')
const { sendSuccess, sendError } = require('../utils/response.utils')
const logger = require('../utils/logger')

// GET /api/admin/roles
// Devuelve todos los roles con sus permisos actuales y todos los permisos disponibles
const getRoles = async (req, res) => {
  try {
    const [roles, permisos] = await Promise.all([
      prisma.rol.findMany({
        include: {
          permisos: {
            include: { permiso: true },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      prisma.permiso.findMany({
        orderBy: [{ recurso: 'asc' }, { accion: 'asc' }],
      }),
    ])

    const rolesFormateados = roles.map((rol) => ({
      id: rol.id,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      permisos: rol.permisos.map((rp) => ({
        id: rp.permiso.id,
        clave: `${rp.permiso.recurso}:${rp.permiso.accion}`,
        recurso: rp.permiso.recurso,
        accion: rp.permiso.accion,
      })),
    }))

    const permisosFormateados = permisos.map((p) => ({
      id: p.id,
      clave: `${p.recurso}:${p.accion}`,
      recurso: p.recurso,
      accion: p.accion,
    }))

    return sendSuccess(res, { roles: rolesFormateados, permisos: permisosFormateados }, 'Roles obtenidos correctamente')
  } catch (error) {
    logger.error({ err: error }, 'Error en getRoles')
    return sendError(res, 'Error al obtener roles', 500)
  }
}

// PUT /api/admin/roles/:rolId/permisos
// Reemplaza atómicamente los permisos de un rol
const actualizarRolPermisos = async (req, res) => {
  try {
    const { rolId } = req.params
    const { permisoIds } = req.body // array de IDs de Permiso

    if (!Array.isArray(permisoIds)) {
      return sendError(res, 'permisoIds debe ser un array', 400)
    }

    const rol = await prisma.rol.findUnique({ where: { id: rolId } })
    if (!rol) return sendError(res, 'Rol no encontrado', 404)

    // Verificar que no se estén quitando todos los permisos del rol admin
    // para evitar bloquear el sistema
    if (rol.nombre === 'admin' && permisoIds.length === 0) {
      return sendError(res, 'No se pueden quitar todos los permisos del rol Administrador', 400)
    }

    // Verificar que todos los permisoIds existen
    if (permisoIds.length > 0) {
      const existentes = await prisma.permiso.count({ where: { id: { in: permisoIds } } })
      if (existentes !== permisoIds.length) {
        return sendError(res, 'Uno o más permisoIds no son válidos', 400)
      }
    }

    // Reemplazo atómico en transacción
    await prisma.$transaction([
      prisma.rolPermiso.deleteMany({ where: { rol_id: rolId } }),
      ...(permisoIds.length > 0
        ? [prisma.rolPermiso.createMany({
            data: permisoIds.map((permiso_id) => ({ rol_id: rolId, permiso_id })),
          })]
        : []),
    ])

    // Devolver el rol actualizado
    const rolActualizado = await prisma.rol.findUnique({
      where: { id: rolId },
      include: {
        permisos: { include: { permiso: true } },
      },
    })

    return sendSuccess(res, {
      id: rolActualizado.id,
      nombre: rolActualizado.nombre,
      permisos: rolActualizado.permisos.map((rp) => ({
        id: rp.permiso.id,
        clave: `${rp.permiso.recurso}:${rp.permiso.accion}`,
      })),
    }, `Permisos del rol "${rol.nombre}" actualizados correctamente`)
  } catch (error) {
    logger.error({ err: error }, 'Error en actualizarRolPermisos')
    return sendError(res, 'Error al actualizar permisos del rol', 500)
  }
}

module.exports = { getRoles, actualizarRolPermisos }
