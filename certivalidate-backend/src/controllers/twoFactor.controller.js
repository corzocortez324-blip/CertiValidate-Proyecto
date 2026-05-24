const { generateSync, verifySync, generateSecret, generateURI } = require('otplib')
const QRCode = require('qrcode')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')
const { sendSuccess, sendError } = require('../utils/response.utils')
const { getEnv } = require('../utils/env')
const logger = require('../utils/logger')
const { buildAccessToken, buildRefreshToken, buildPartialToken, persistRefreshToken } = require('../services/token.service')
const { crearSesion } = require('../services/sesion.service')
const { registrarIntento } = require('../services/intentoLogin.service')
const { obtenerAccesosUsuario } = require('../utils/authorization')
const { getClientIp } = require('../utils/validators')

const ISSUER = 'CertiValidate'

const verifyTotp = (token, secret) => {
  const result = verifySync({ secret, token })
  return result?.valid === true
}

const setup2FA = async (req, res) => {
  try {
    const usuarioId = req.usuario.id
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
    if (!usuario) return sendError(res, 'Usuario no encontrado', 404)
    if (usuario.totp_enabled) return sendError(res, '2FA ya está habilitado', 400)

    const secret = generateSecret()
    const uri = generateURI({ issuer: ISSUER, label: usuario.email, secret })
    const qrDataUrl = await QRCode.toDataURL(uri)

    await prisma.usuario.update({ where: { id: usuarioId }, data: { totp_secret: secret } })

    return sendSuccess(res, { qrDataUrl, secret }, '2FA configurado. Escanea el QR y verifica con tu app autenticadora.', 200)
  } catch (error) {
    logger.error({ err: error }, 'Error en setup2FA')
    return sendError(res, 'Error al configurar 2FA', 500)
  }
}

const enable2FA = async (req, res) => {
  try {
    const usuarioId = req.usuario.id
    const { code } = req.body
    if (!code) return sendError(res, 'Código TOTP requerido', 400)

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
    if (!usuario || !usuario.totp_secret) return sendError(res, 'Primero configura el 2FA', 400)
    if (usuario.totp_enabled) return sendError(res, '2FA ya está habilitado', 400)

    if (!verifyTotp(code, usuario.totp_secret)) return sendError(res, 'Código TOTP inválido', 400)

    await prisma.usuario.update({ where: { id: usuarioId }, data: { totp_enabled: true } })

    return sendSuccess(res, null, '2FA activado correctamente', 200)
  } catch (error) {
    logger.error({ err: error }, 'Error en enable2FA')
    return sendError(res, 'Error al activar 2FA', 500)
  }
}

const disable2FA = async (req, res) => {
  try {
    const usuarioId = req.usuario.id
    const { password, code } = req.body
    if (!password || !code) return sendError(res, 'Contraseña y código TOTP requeridos', 400)

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
    if (!usuario) return sendError(res, 'Usuario no encontrado', 404)
    if (!usuario.totp_enabled) return sendError(res, '2FA no está habilitado', 400)

    const passwordValida = await bcrypt.compare(password, usuario.password_hash)
    if (!passwordValida) return sendError(res, 'Contraseña incorrecta', 401)

    if (!verifyTotp(code, usuario.totp_secret)) return sendError(res, 'Código TOTP inválido', 400)

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { totp_enabled: false, totp_secret: null },
    })

    return sendSuccess(res, null, '2FA desactivado correctamente', 200)
  } catch (error) {
    logger.error({ err: error }, 'Error en disable2FA')
    return sendError(res, 'Error al desactivar 2FA', 500)
  }
}

const verify2FA = async (req, res) => {
  try {
    const { partial_token, code } = req.body
    if (!partial_token || !code) return sendError(res, 'Token parcial y código TOTP requeridos', 400)

    let decoded
    try {
      decoded = jwt.verify(partial_token, getEnv('JWT_SECRET'))
    } catch {
      return sendError(res, 'Token parcial inválido o expirado', 401)
    }

    if (decoded.type !== 'partial_2fa') return sendError(res, 'Token inválido', 401)

    const usuario = await prisma.usuario.findUnique({ where: { id: decoded.id } })
    if (!usuario || usuario.deleted_at) return sendError(res, 'Usuario no encontrado', 404)
    if (!usuario.activo) return sendError(res, 'Usuario desactivado', 403)
    if (!usuario.totp_enabled || !usuario.totp_secret) return sendError(res, '2FA no configurado', 400)

    if (!verifyTotp(code, usuario.totp_secret)) return sendError(res, 'Código TOTP inválido', 401)

    await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimo_acceso: new Date() } })

    const ip        = getClientIp(req)
    const userAgent = req.headers['user-agent'] || null
    const token        = buildAccessToken(usuario)
    const refreshToken = buildRefreshToken(usuario)
    await persistRefreshToken({ token: refreshToken, usuarioId: usuario.id, ip, userAgent })
    await crearSesion({ token: refreshToken, usuarioId: usuario.id, ip, userAgent })
    await registrarIntento({ email: usuario.email, ip, exitoso: true })

    const accesos = await obtenerAccesosUsuario(usuario.id)
    const ROL_PRIORIDAD = { admin: 3, editor: 2, lector: 1 }
    const rolPrincipal = accesos
      .map((a) => a.rol)
      .sort((a, b) => (ROL_PRIORIDAD[b] || 0) - (ROL_PRIORIDAD[a] || 0))[0] || null

    const { password_hash, token_verificacion, token_verificacion_expira, totp_secret, ...usuarioData } = usuario
    return sendSuccess(res, {
      token,
      refreshToken,
      usuario: { ...usuarioData, rol: rolPrincipal },
      accesos,
    }, 'Login con 2FA exitoso', 200)
  } catch (error) {
    logger.error({ err: error }, 'Error en verify2FA')
    return sendError(res, 'Error al verificar 2FA', 500)
  }
}

module.exports = { setup2FA, enable2FA, disable2FA, verify2FA }
