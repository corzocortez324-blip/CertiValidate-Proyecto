/**
 * Prepara la BD local de las pruebas de aceptación (pruebas_aceptacion/).
 * Idempotente: se puede ejecutar antes de cada corrida.
 *
 *   npx dotenv -e .env.e2e -e .env -- node scripts/preparar-e2e.js
 *
 * Usuarios que deja listos (deben coincidir con pruebas_aceptacion/config.py):
 *   juan@unicesar.edu.co            admin  → CA001, CA005–CA015
 *   bloqueo.e2e@certivalidate.test  lector → CA002 (queda bloqueado ~15 min)
 *   totp.e2e@certivalidate.test     lector → CA003 (2FA activo)
 */
require('../src/utils/load-env')
const bcrypt = require('bcrypt')
const prisma = require('../src/utils/prisma')

const URL_DB = process.env.DATABASE_URL || ''
if (!/localhost|127\.0\.0\.1/.test(URL_DB) || !/e2e/.test(URL_DB)) {
  console.error('Este script solo corre contra la BD local *_e2e (revisa .env.e2e).')
  process.exit(1)
}

const INSTITUCION = 'Universidad Popular del Cesar'
const CLAVE = 'Clave1234'
const TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' // otplib exige ≥ 128 bits

const USUARIOS = [
  { email: 'juan@unicesar.edu.co', nombre: 'Juan', apellido: 'Pérez', rol: 'admin' },
  { email: 'bloqueo.e2e@certivalidate.test', nombre: 'Bloqueo', apellido: 'E2E', rol: 'lector' },
  { email: 'totp.e2e@certivalidate.test', nombre: 'Totp', apellido: 'E2E', rol: 'lector', totp: true },
]

;(async () => {
  const institucion =
    (await prisma.institucion.findFirst({ where: { nombre: INSTITUCION } })) ??
    (await prisma.institucion.create({ data: { nombre: INSTITUCION } }))

  const password_hash = await bcrypt.hash(CLAVE, 10)

  for (const u of USUARIOS) {
    const datos = {
      nombre: u.nombre,
      apellido: u.apellido,
      password_hash,
      activo: true,
      email_verificado: true,
      totp_enabled: !!u.totp,
      totp_secret: u.totp ? TOTP_SECRET : null,
    }
    const usuario = await prisma.usuario.upsert({
      where: { email: u.email },
      update: datos,
      create: { email: u.email, ...datos },
    })

    const rol = await prisma.rol.findUnique({ where: { nombre: u.rol } })
    const vinculo = await prisma.usuarioInstitucion.findFirst({
      where: { usuario_id: usuario.id, institucion_id: institucion.id },
    })
    if (vinculo) {
      await prisma.usuarioInstitucion.update({ where: { id: vinculo.id }, data: { rol_id: rol.id } })
    } else {
      await prisma.usuarioInstitucion.create({
        data: { usuario_id: usuario.id, institucion_id: institucion.id, rol_id: rol.id },
      })
    }
    console.log(`✓ ${u.email} (${u.rol})`)
  }

  // Reinicia contadores de bloqueo de corridas anteriores
  await prisma.intentoLogin.deleteMany({ where: { email: { in: USUARIOS.map((u) => u.email) } } })

  // CA014 deja una integración hacia una URL de ejemplo; sin limpiarla, CA007 fallaría
  await prisma.integracion.deleteMany({ where: { institucion_id: institucion.id } })

  console.log(`Institución: ${INSTITUCION} (${institucion.id})`)
  await prisma.$disconnect()
})().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
