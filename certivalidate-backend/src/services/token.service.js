const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')
const { getEnv } = require('../utils/env')

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

const buildAccessToken = (usuario) =>
  jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      type: 'access',
    },
    getEnv('JWT_SECRET'),
    { expiresIn: getEnv('JWT_EXPIRES_IN', '1h') },
  )

const buildRefreshToken = (usuario) =>
  jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
    },
    getEnv('JWT_REFRESH_SECRET'),
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      jwtid: crypto.randomUUID(),
    },
  )

const persistRefreshToken = async ({ token, usuarioId, ip, userAgent }) => {
  const decoded = jwt.decode(token)
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : null

  if (!expiresAt) {
    throw new Error('No fue posible determinar la expiración del refresh token')
  }

  return prisma.refreshToken.create({
    data: {
      usuario_id: usuarioId,
      token_hash: hashToken(token),
      expires_at: expiresAt,
      created_by_ip: ip || null,
      user_agent: userAgent || null,
    },
  })
}

const verifyStoredRefreshToken = async ({ token, usuarioId }) => {
  const tokenHash = hashToken(token)

  return prisma.refreshToken.findFirst({
    where: {
      usuario_id: usuarioId,
      token_hash: tokenHash,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
  })
}

const rotateRefreshToken = async ({ currentToken, usuario, ip, userAgent }) => {
  const currentTokenHash = hashToken(currentToken)
  const nuevoRefreshToken = buildRefreshToken(usuario)
  const decoded = jwt.decode(nuevoRefreshToken)
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : null

  if (!expiresAt) {
    throw new Error('No fue posible determinar la expiración del refresh token rotado')
  }

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: {
        usuario_id: usuario.id,
        token_hash: currentTokenHash,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    })

    await tx.refreshToken.create({
      data: {
        usuario_id: usuario.id,
        token_hash: hashToken(nuevoRefreshToken),
        expires_at: expiresAt,
        created_by_ip: ip || null,
        user_agent: userAgent || null,
      },
    })
  })

  return nuevoRefreshToken
}

const revokeRefreshToken = async ({ token, usuarioId = null }) => {
  const where = {
    token_hash: hashToken(token),
    revoked_at: null,
  }

  if (usuarioId) {
    where.usuario_id = usuarioId
  }

  return prisma.refreshToken.updateMany({
    where,
    data: {
      revoked_at: new Date(),
    },
  })
}

const revokeAllUserRefreshTokens = async (usuarioId) =>
  prisma.refreshToken.updateMany({
    where: {
      usuario_id: usuarioId,
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
    },
  })

const buildPartialToken = (usuarioId) =>
  jwt.sign({ id: usuarioId, type: 'partial_2fa' }, getEnv('JWT_SECRET'), { expiresIn: '5m' })

module.exports = {
  buildAccessToken,
  buildRefreshToken,
  buildPartialToken,
  persistRefreshToken,
  verifyStoredRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
}
