const crypto = require('crypto')
const jwt    = require('jsonwebtoken')
const prisma = require('../utils/prisma')

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

const crearSesion = async ({ token, usuarioId, ip, userAgent }) => {
  const decoded   = jwt.decode(token)
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : null
  if (!expiresAt) return

  await prisma.sesionActiva.create({
    data: {
      usuario_id: usuarioId,
      token_hash: hashToken(token),
      ip:         ip        || null,
      user_agent: userAgent || null,
      expires_at: expiresAt,
    },
  })
}

const actualizarSesion = async ({ oldToken, newToken }) => {
  const oldHash   = hashToken(oldToken)
  const decoded   = jwt.decode(newToken)
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : null
  if (!expiresAt) return

  await prisma.sesionActiva.updateMany({
    where: { token_hash: oldHash },
    data:  { token_hash: hashToken(newToken), expires_at: expiresAt },
  })
}

const eliminarSesion = async (token) => {
  await prisma.sesionActiva.deleteMany({
    where: { token_hash: hashToken(token) },
  }).catch(() => {})
}

const eliminarTodasSesiones = async (usuarioId) => {
  await prisma.sesionActiva.deleteMany({ where: { usuario_id: usuarioId } })
}

const listarSesiones = async (usuarioId) =>
  prisma.sesionActiva.findMany({
    where:   { usuario_id: usuarioId, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
  })

const revocarSesionPorId = async (id, usuarioId) => {
  const sesion = await prisma.sesionActiva.findFirst({ where: { id, usuario_id: usuarioId } })
  if (!sesion) return null
  await prisma.sesionActiva.delete({ where: { id } })
  return sesion
}

module.exports = {
  crearSesion,
  actualizarSesion,
  eliminarSesion,
  eliminarTodasSesiones,
  listarSesiones,
  revocarSesionPorId,
  hashToken,
}
