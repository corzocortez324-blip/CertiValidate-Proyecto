const path = require('path')
const { config } = require('dotenv')

let loadedEnv = false

const assertTestDatabaseUrl = (databaseUrl) => {
  if (!databaseUrl) {
    throw new Error(
      'Modo test requiere DATABASE_URL definido en .env.test. No se permite fallback a .env.',
    )
  }

  if (/supabase|pooler\.supabase\.com/i.test(databaseUrl)) {
    throw new Error(
      `Seguridad de tests: DATABASE_URL apunta a Supabase o pooler.supabase.com (${databaseUrl}). Usa una base local/test.`,
    )
  }

  if (!/test|localhost|127\.0\.0\.1/i.test(databaseUrl)) {
    throw new Error(
      `Seguridad de tests: DATABASE_URL debe apuntar a localhost, 127.0.0.1 o contener 'test'. Valor actual: ${databaseUrl}`,
    )
  }
}

const loadEnv = () => {
  if (loadedEnv) return

  const env = process.env.NODE_ENV || 'development'
  process.env.NODE_ENV = env

  if (env === 'test') {
    const envFile = path.resolve(__dirname, '../../.env.test')
    const result = config({ path: envFile, override: true })
    if (result.error) {
      throw new Error(`Fallo cargando ${envFile}: ${result.error.message}`)
    }

    assertTestDatabaseUrl(process.env.DATABASE_URL)
  } else {
    const envFile = path.resolve(__dirname, '../../.env')
    const result = config({ path: envFile, override: false })
    if (result.error && result.error.code !== 'ENOENT') {
      throw new Error(`Fallo cargando ${envFile}: ${result.error.message}`)
    }
  }

  loadedEnv = true
}

loadEnv()

module.exports = {
  loadEnv,
}
