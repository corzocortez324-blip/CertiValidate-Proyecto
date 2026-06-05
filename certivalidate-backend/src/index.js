require('./utils/load-env')
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

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.fatal(
        { port: PORT },
        `Puerto ${PORT} ya está en uso. Detén el proceso que lo ocupa (ej: docker stop certivalidate-backendactualizado-api-1) y vuelve a intentarlo.`,
      )
    } else {
      logger.fatal({ err }, 'Error al arrancar el servidor HTTP')
    }
    process.exit(1)
  })
}

async function shutdown(signal) {
  const SHUTDOWN_TIMEOUT_MS = 5000

  const forceExit = setTimeout(() => {
    logger.warn({ signal }, 'Apagado forzado: el servidor tardó demasiado en cerrar')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  forceExit.unref()

  try {
    logger.info({ signal }, 'Cerrando servidor...')

    if (server) {
      // Cierra conexiones keep-alive inmediatamente para liberar el puerto
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections()
      }
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    }

    await prisma.$disconnect()
    clearTimeout(forceExit)
    process.exit(0)
  } catch (err) {
    logger.error({ err, signal }, 'Error durante el apagado del servidor')
    clearTimeout(forceExit)
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

function startServer() {
  main().catch((err) => {
    logger.fatal({ err }, 'Error al iniciar el servidor')
    process.exit(1)
  })
}

if (require.main === module) {
  startServer()
}
