#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')

const confirmFlag = process.argv.includes('--confirm')
const envFile = path.resolve(__dirname, '..', '.env')

if (process.env.NODE_ENV === 'production') {
  console.error('Abortado: no se permite ejecutar limpieza en producción.')
  process.exit(1)
}

if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: envFile })
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no está definida.')
  process.exit(1)
}

const isLocalDatabase = /localhost|127\.0\.0\.1|\.test/i.test(
  process.env.DATABASE_URL,
)
const needsExplicitConfirm = !isLocalDatabase

if (needsExplicitConfirm && !confirmFlag) {
  console.error(
    'Abortado: esta base apunta a desarrollo/Supabase. Requiere --confirm para ejecutar la limpieza.',
  )
  process.exit(1)
}

const prisma = new PrismaClient()

const TEST_PATTERNS = ['__test__', 'test', '@certivalidate.test', 'example.com']

const matchesTestPattern = (value = '') =>
  TEST_PATTERNS.some((pattern) =>
    String(value).toLowerCase().includes(pattern.toLowerCase()),
  )

const isSafeCandidate = (usuario) => {
  const hayTexto = [usuario.email, usuario.nombre, usuario.apellido].some(
    matchesTestPattern,
  )

  if (!hayTexto) return false

  if (usuario.activo === true) {
    return ['__test__', '@certivalidate.test', 'example.com'].some((pattern) =>
      String(usuario.email || '')
        .toLowerCase()
        .includes(pattern.toLowerCase()),
    )
  }

  return true
}

async function main() {
  console.log('Modo:', confirmFlag ? 'EJECUCIÓN REAL' : 'DRY-RUN')
  console.log(
    'DATABASE_URL:',
    process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'),
  )

  const usuarios = await prisma.usuario.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      activo: true,
      created_at: true,
      updated_at: true,
    },
  })

  const candidatos = usuarios.filter(isSafeCandidate)

  const activos = candidatos.filter((u) => u.activo).length
  const inactivos = candidatos.length - activos

  console.log(`Usuarios encontrados: ${candidatos.length}`)
  console.log(`Usuarios activos: ${activos}`)
  console.log(`Usuarios inactivos: ${inactivos}`)
  console.log('Primeros 20 emails:')
  candidatos
    .slice(0, 20)
    .forEach((usuario) => console.log(`  - ${usuario.email}`))

  if (candidatos.length === 0) {
    console.log('No hay usuarios candidatos para limpiar.')
    return
  }

  if (!confirmFlag) {
    console.log(
      'Sin --confirm: no se borrará nada. Ejecute: npm run cleanup:test-users:confirm',
    )
    return
  }

  const ids = candidatos.map((usuario) => usuario.id)

  await prisma.$transaction([
    prisma.auditoria.deleteMany({ where: { usuario_id: { in: ids } } }),
    prisma.revocacion.deleteMany({ where: { revocado_por: { in: ids } } }),
    prisma.refreshToken.deleteMany({ where: { usuario_id: { in: ids } } }),
    prisma.sesionActiva.deleteMany({ where: { usuario_id: { in: ids } } }),
    prisma.usuarioInstitucion.deleteMany({
      where: { usuario_id: { in: ids } },
    }),
  ])

  const deleted = await prisma.usuario.deleteMany({
    where: { id: { in: ids } },
  })

  console.log(`Usuarios eliminados: ${deleted.count}`)
}

main()
  .catch((error) => {
    console.error('Error al ejecutar la limpieza:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
