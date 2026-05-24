const prisma = require('./prisma')

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

module.exports = { getRolByNombre }
