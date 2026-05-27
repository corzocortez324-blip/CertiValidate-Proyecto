import path from 'path'
import { config as dotenvConfig } from 'dotenv'
import { defineConfig } from 'prisma/config'

if (process.env.NODE_ENV !== 'test') {
  dotenvConfig({
    path: path.resolve(process.cwd(), '.env'),
    override: false,
  })
}

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: directUrl,
  },
})
