require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const ROLES = [
  { nombre: 'admin', descripcion: 'Acceso total a todos los recursos' },
  { nombre: 'editor', descripcion: 'Puede crear y editar recursos, sin acceso administrativo' },
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
  { recurso: 'institucion', accion: 'actualizar' },
  { recurso: 'institucion', accion: 'ver' },
  { recurso: 'institucion', accion: 'estadisticas' },
  { recurso: 'plantilla', accion: 'crear' },
  { recurso: 'plantilla', accion: 'actualizar' },
  { recurso: 'plantilla', accion: 'archivar' },
  { recurso: 'plantilla', accion: 'ver' },
  { recurso: 'plantilla', accion: 'listar' },
  { recurso: 'auditoria', accion: 'ver' },
  { recurso: 'usuario', accion: 'listar' },
  { recurso: 'usuario', accion: 'ver' },
  { recurso: 'usuario', accion: 'crear' },
  { recurso: 'usuario', accion: 'actualizar' },
  { recurso: 'usuario', accion: 'eliminar' },
]

const PERMISOS_POR_ROL = {
  admin: PERMISOS.map((p) => `${p.recurso}:${p.accion}`),
  editor: [
    'certificado:emitir', 'certificado:revocar', 'certificado:listar',
    'certificado:ver', 'certificado:descargar',
    'estudiante:crear', 'estudiante:actualizar', 'estudiante:listar', 'estudiante:ver',
    'institucion:ver', 'institucion:estadisticas',
    'plantilla:crear', 'plantilla:actualizar', 'plantilla:archivar', 'plantilla:ver', 'plantilla:listar',
    'auditoria:ver',
  ],
  lector: [
    'certificado:listar', 'certificado:ver', 'certificado:descargar',
    'estudiante:listar', 'estudiante:ver',
    'institucion:ver', 'institucion:estadisticas',
    'plantilla:ver', 'plantilla:listar',
    'auditoria:ver',
  ],
}

async function main() {
  console.log('Seeding roles y permisos...')

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

  const permisosCreados = {}
  for (const permiso of PERMISOS) {
    const p = await prisma.permiso.upsert({
      where: { recurso_accion: { recurso: permiso.recurso, accion: permiso.accion } },
      update: {},
      create: permiso,
    })
    permisosCreados[`${p.recurso}:${p.accion}`] = p.id
  }
  console.log(`  ${PERMISOS.length} permisos sincronizados`)

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

  console.log('Seed completado.')
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
