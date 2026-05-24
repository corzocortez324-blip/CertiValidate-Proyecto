const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const connectionString =
  process.env.DATABASE_URL || process.env.DIRECT_URL || null

const isProduction = process.env.NODE_ENV === 'production'

let prisma

if (connectionString) {
  const sslConfig = isProduction
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false }

  if (!isProduction) {
    console.warn(
      'PostgreSQL SSL está usando rejectUnauthorized=false solo en entorno no productivo',
    )
  }

  const pool = new Pool({
    connectionString,
    ssl: sslConfig,
  })

  const adapter = new PrismaPg(pool)
  prisma = new PrismaClient({ adapter })
} else {
  prisma = new PrismaClient()
}

module.exports = prisma

