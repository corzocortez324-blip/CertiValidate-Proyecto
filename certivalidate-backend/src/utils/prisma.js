require('./load-env')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const databaseUrl = process.env.DATABASE_URL

if (isTest) {
  if (!databaseUrl) {
    throw new Error('Modo test requiere DATABASE_URL.')
  }

  if (!/test|localhost|127\.0\.0\.1/i.test(databaseUrl)) {
    throw new Error(
      `Modo test inseguro: DATABASE_URL debe apuntar a una base de pruebas/local. Valor actual: ${databaseUrl}`,
    )
  }
}

const connectionString =
  databaseUrl || (isTest ? null : process.env.DIRECT_URL) || null

let prisma

if (connectionString) {
  const isLocalDatabase = /localhost|127\.0\.0\.1/i.test(connectionString)
  const poolConfig = { connectionString }

  if (!isTest && !isLocalDatabase) {
    poolConfig.ssl = isProduction
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false }

    if (!isProduction) {
      console.warn(
        'PostgreSQL SSL está usando rejectUnauthorized=false solo en entorno no productivo',
      )
    }
  }

  const pool = new Pool(poolConfig)
  const adapter = new PrismaPg(pool)

  prisma = new PrismaClient({ adapter })
} else {
  prisma = new PrismaClient()
}

module.exports = prisma
