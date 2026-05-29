require('../src/utils/load-env')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const ROLES = [
  { nombre: 'admin', descripcion: 'Acceso total a todos los recursos' },
  {
    nombre: 'editor',
    descripcion: 'Puede crear y editar recursos, sin acceso administrativo',
  },
  { nombre: 'lector', descripcion: 'Solo lectura' },
]

const PERMISOS = [
  { recurso: 'certificado', accion: 'emitir' },
  { recurso: 'certificado', accion: 'revocar' },
  { recurso: 'certificado', accion: 'listar' },
  { recurso: 'certificado', accion: 'ver' },
  { recurso: 'certificado', accion: 'descargar' },
  { recurso: 'estudiante', accion: 'crear' },
  { recurso: 'estudiante', accion: 'actualizar' },
  { recurso: 'estudiante', accion: 'eliminar' },
  { recurso: 'estudiante', accion: 'listar' },
  { recurso: 'estudiante', accion: 'ver' },
  { recurso: 'institucion', accion: 'crear' },
  { recurso: 'institucion', accion: 'actualizar' },
  { recurso: 'institucion', accion: 'ver' },
  { recurso: 'institucion', accion: 'estadisticas' },
  { recurso: 'plantilla', accion: 'crear' },
  { recurso: 'plantilla', accion: 'actualizar' },
  { recurso: 'plantilla', accion: 'archivar' },
  { recurso: 'plantilla', accion: 'ver' },
  { recurso: 'plantilla', accion: 'listar' },
  { recurso: 'auditoria', accion: 'ver' },
  { recurso: 'admin', accion: 'stats' },
  { recurso: 'usuario', accion: 'listar' },
  { recurso: 'usuario', accion: 'ver' },
  { recurso: 'usuario', accion: 'crear' },
  { recurso: 'usuario', accion: 'actualizar' },
  { recurso: 'usuario', accion: 'eliminar' },
]

const PERMISOS_POR_ROL = {
  admin: PERMISOS.map((p) => `${p.recurso}:${p.accion}`),
  editor: [
    'certificado:emitir',
    'certificado:revocar',
    'certificado:listar',
    'certificado:ver',
    'certificado:descargar',
    'estudiante:crear',
    'estudiante:actualizar',
    'estudiante:listar',
    'estudiante:ver',
    'institucion:ver',
    'institucion:estadisticas',
    'plantilla:crear',
    'plantilla:actualizar',
    'plantilla:archivar',
    'plantilla:ver',
    'plantilla:listar',
    'auditoria:ver',
  ],
  lector: [
    'certificado:listar',
    'certificado:ver',
    'certificado:descargar',
    'estudiante:listar',
    'estudiante:ver',
    'institucion:ver',
    'institucion:estadisticas',
    'plantilla:ver',
    'plantilla:listar',
    'auditoria:ver',
  ],
}

const DEMO_INSTITUCION = {
  nombre: 'Institución Demo CertiValidate',
  dominio: 'certivalidate.com',
  activa: true,
}

const DEMO_USUARIOS = [
  {
    email: 'admin@certivalidate.com',
    nombre: 'Admin',
    apellido: 'Demo',
    password: 'Admin1234!',
    rol: 'admin',
    es_platform_admin: true,
    email_verificado: true,
  },
  {
    email: 'emisor@certivalidate.com',
    nombre: 'Emisor',
    apellido: 'Demo',
    password: 'Emisor1234!',
    rol: 'editor',
    es_platform_admin: false,
    email_verificado: true,
  },
  {
    email: 'lector@certivalidate.com',
    nombre: 'Lector',
    apellido: 'Demo',
    password: 'Lector1234!',
    rol: 'lector',
    es_platform_admin: false,
    email_verificado: true,
  },
]

async function main() {
  console.log('Seeding roles y permisos...')

  // 1. Upsert roles
  const rolesCreados = {}
  for (const rol of ROLES) {
    const r = await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: { descripcion: rol.descripcion },
      create: rol,
    })
    rolesCreados[r.nombre] = r.id
    console.log(`  Rol: ${r.nombre} (${r.id})`)
  }

  // 2. Upsert permisos
  const permisosCreados = {}
  for (const permiso of PERMISOS) {
    const p = await prisma.permiso.upsert({
      where: {
        recurso_accion: { recurso: permiso.recurso, accion: permiso.accion },
      },
      update: {},
      create: permiso,
    })
    permisosCreados[`${p.recurso}:${p.accion}`] = p.id
  }
  console.log(`  ${PERMISOS.length} permisos sincronizados`)

  // 3. Upsert RolPermiso
  for (const [rolNombre, permisoKeys] of Object.entries(PERMISOS_POR_ROL)) {
    const rolId = rolesCreados[rolNombre]
    for (const key of permisoKeys) {
      const permisoId = permisosCreados[key]
      await prisma.rolPermiso.upsert({
        where: { rol_id_permiso_id: { rol_id: rolId, permiso_id: permisoId } },
        update: {},
        create: { rol_id: rolId, permiso_id: permisoId },
      })
    }
    console.log(`  ${rolNombre}: ${permisoKeys.length} permisos asignados`)
  }

  // 4. Upsert institución demo
  console.log('\nSeeding institución demo...')
  let institucionDemo = await prisma.institucion.findFirst({
    where: { dominio: DEMO_INSTITUCION.dominio },
  })
  if (!institucionDemo) {
    institucionDemo = await prisma.institucion.create({ data: DEMO_INSTITUCION })
    console.log(`  Institución creada: ${institucionDemo.nombre} (${institucionDemo.id})`)
  } else {
    console.log(`  Institución existente: ${institucionDemo.nombre} (${institucionDemo.id})`)
  }

  // 5. Upsert usuarios demo y su relación UsuarioInstitucion
  console.log('\nSeeding usuarios demo...')
  for (const demoUser of DEMO_USUARIOS) {
    const rolId = rolesCreados[demoUser.rol]

    // Upsert usuario (no tocar password si ya existe para no romper sesiones activas)
    let usuario = await prisma.usuario.findUnique({ where: { email: demoUser.email } })
    if (!usuario) {
      const passwordHash = await bcrypt.hash(demoUser.password, 12)
      usuario = await prisma.usuario.create({
        data: {
          email: demoUser.email,
          nombre: demoUser.nombre,
          apellido: demoUser.apellido,
          password_hash: passwordHash,
          activo: true,
          email_verificado: demoUser.email_verificado,
          es_platform_admin: demoUser.es_platform_admin,
        },
      })
      console.log(`  Usuario creado: ${usuario.email}`)
    } else {
      // Asegurar que el usuario esté activo y con email verificado
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          activo: true,
          email_verificado: true,
          es_platform_admin: demoUser.es_platform_admin,
          deleted_at: null,
        },
      })
      console.log(`  Usuario existente: ${usuario.email}`)
    }

    // Upsert UsuarioInstitucion (relación usuario → institución → rol)
    const relacionExistente = await prisma.usuarioInstitucion.findUnique({
      where: {
        usuario_id_institucion_id: {
          usuario_id: usuario.id,
          institucion_id: institucionDemo.id,
        },
      },
    })

    if (!relacionExistente) {
      await prisma.usuarioInstitucion.create({
        data: {
          usuario_id: usuario.id,
          institucion_id: institucionDemo.id,
          rol_id: rolId,
        },
      })
      console.log(`    → Relación creada: ${demoUser.email} | ${demoUser.rol} | ${institucionDemo.nombre}`)
    } else if (relacionExistente.rol_id !== rolId) {
      // Si el rol cambió, actualizarlo
      await prisma.usuarioInstitucion.update({
        where: { id: relacionExistente.id },
        data: { rol_id: rolId },
      })
      console.log(`    → Rol actualizado: ${demoUser.email} | ${demoUser.rol}`)
    } else {
      console.log(`    → Relación ya existente: ${demoUser.email} | ${demoUser.rol}`)
    }
  }

  console.log('\nSeed completado exitosamente.')
  console.log('\nUsuarios demo disponibles:')
  console.log('  admin@certivalidate.com  → rol: admin  → contraseña: Admin1234!')
  console.log('  emisor@certivalidate.com → rol: editor → contraseña: Emisor1234!')
  console.log('  lector@certivalidate.com → rol: lector → contraseña: Lector1234!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
