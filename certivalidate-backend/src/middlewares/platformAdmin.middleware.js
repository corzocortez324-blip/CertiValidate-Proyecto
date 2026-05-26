const { sendError } = require('../utils/response.utils')
const prisma = require('../utils/prisma')

const requirePlatformAdmin = async (req, res, next) => {
  try {
    const usuarioId = req.usuario?.id

    if (!usuarioId) {
      return sendError(res, 'No autenticado', 401)
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { es_platform_admin: true },
    })

    if (!usuario?.es_platform_admin) {
      return sendError(
        res,
        'Se requieren privilegios de platform admin',
        403,
      )
    }

    next()
  } catch (_error) {
    return sendError(res, 'Error validando privilegios de platform admin', 500)
  }
}

module.exports = {
  requirePlatformAdmin,
}