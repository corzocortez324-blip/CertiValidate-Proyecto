const prisma = require('../utils/prisma')
const logger = require('../utils/logger')

const VENTANA_MS = 15 * 60 * 1000   // 15 minutos
const MAX_EMAIL  = 5
const MAX_IP     = 20

const registrarIntento = async ({ email, ip, exitoso }) => {
  try {
    await prisma.intentoLogin.create({
      data: {
        email:      email.toLowerCase(),
        ip_address: ip || null,
        exitoso,
      },
    })
  } catch (err) {
    logger.warn({ err }, 'No se pudo registrar intento de login')
  }
}

const verificarBloqueo = async ({ email, ip }) => {
  const desde = new Date(Date.now() - VENTANA_MS)

  const [porEmail, porIp] = await Promise.all([
    prisma.intentoLogin.count({
      where: { email: email.toLowerCase(), exitoso: false, fecha: { gte: desde } },
    }),
    ip
      ? prisma.intentoLogin.count({
          where: { ip_address: ip, exitoso: false, fecha: { gte: desde } },
        })
      : Promise.resolve(0),
  ])

  if (porEmail >= MAX_EMAIL) {
    return {
      bloqueado: true,
      status:    423,
      message:   'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Inténtalo en 15 minutos.',
    }
  }
  if (porIp >= MAX_IP) {
    return {
      bloqueado: true,
      status:    429,
      message:   'Demasiados intentos desde esta dirección IP. Inténtalo en 15 minutos.',
    }
  }
  return { bloqueado: false }
}

module.exports = { registrarIntento, verificarBloqueo }
