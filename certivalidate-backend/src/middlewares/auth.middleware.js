const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')
const { sendError } = require('../utils/response.utils')
const { getEnv } = require('../utils/env')
const logger = require('../utils/logger')

const verificarToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return sendError(res, 'Token requerido', 401)
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader

    if (!token) {
      return sendError(res, 'Token inválido o malformado', 401)
    }

    const decoded = jwt.verify(token, getEnv('JWT_SECRET'))

    if (decoded.type === 'partial_2fa') {
      return sendError(res, 'Token inválido', 401)
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        email_verificado: true,
        deleted_at: true,
      },
    })

    if (!usuario || usuario.deleted_at) {
      return sendError(res, 'Usuario no encontrado', 401)
    }

    if (!usuario.activo) {
      return sendError(res, 'Usuario desactivado', 403)
    }

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      email_verificado: usuario.email_verificado,
    }

    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token expirado', 401)
    }
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 'Token inválido', 401)
    }
    logger.error({ err: error, requestId: req.requestId }, 'Error de autenticación')
    return sendError(res, 'Error de autenticación', 401)
  }
}

const requireEmailVerified = (req, res, next) => {
  if (!req.usuario?.email_verificado) {
    return sendError(res, 'Debes verificar tu email antes de continuar', 403)
  }
  next()
}

module.exports = { verificarToken, requireEmailVerified }
