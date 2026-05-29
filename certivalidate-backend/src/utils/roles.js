const prisma = require('./prisma')

const ROL_PRIORIDAD = { admin: 3, editor: 2, lector: 1 }

/**
 * Dado un array de accesos ({rol: string}), devuelve el rol de mayor prioridad.
 * @param {Array<{rol: string}>} accesos
 * @returns {string|null}
 */
const resolverRolPrincipal = (accesos) =>
  accesos
    .map((a) => a.rol)
    .sort((a, b) => (ROL_PRIORIDAD[b] || 0) - (ROL_PRIORIDAD[a] || 0))[0] || null

/**
 * Obtiene un rol por nombre. Lanza error si no existe (seed no ejecutado).
 * @param {string} nombre
 */
const getRolByNombre = async (nombre) => {
  const rol = await prisma.rol.findUnique({ where: { nombre } })
  if (!rol) {
    throw new Error(
      `Rol '${nombre}' no encontrado en la BD. Ejecuta: npm run seed`,
    )
  }
  return rol
}

module.exports = { ROL_PRIORIDAD, resolverRolPrincipal, getRolByNombre }
