require('dotenv').config()
BigInt.prototype.toJSON = function () {
  return this.toString()
}

const { validateRequiredEnv } = require('./utils/env')
const logger = require('./utils/logger')
const app = require('./app')

const PORT = process.env.PORT || 3000
let server

try {
  validateRequiredEnv()
} catch (error) {
  logger.fatal(error.message)
  process.exit(1)
}

const prisma = require('./utils/prisma')

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
  if (connectionString) {
    await prisma.$connect()
  } else {
    logger.warn(
      'No se encontró DATABASE_URL ni DIRECT_URL — arrancando sin conexión a la base de datos',
    )
  }
  server = app.listen(PORT, () => {
    logger.info(
      { port: PORT, env: process.env.NODE_ENV || 'development' },
      'CertiValidate API v1.1.0 iniciada',
    )
  })
}

async function shutdown(signal) {
  try {
    logger.info({ signal }, 'Cerrando servidor...')

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    }

    await prisma.$disconnect()
    process.exit(0)
  } catch (err) {
    logger.error({ err, signal }, 'Error durante el apagado del servidor')
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled Promise Rejection')
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception')
  process.exit(1)
})

main().catch((err) => {
  logger.fatal({ err }, 'Error al iniciar el servidor')
  process.exit(1)
})
