require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  await prisma.certificado.deleteMany()
  await prisma.estudiante.deleteMany()

  const juan = await prisma.estudiante.create({
    data: {
      documento: '1002003000',
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan.perez@demo.edu.co',
      programa: 'Ingeniería de Sistemas',
      estadoAcademico: 'GRADUADO',
      certificados: {
        create: [
          {
            tipo: 'DIPLOMA',
            titulo: 'Certificado de Grado - Ingeniería de Sistemas',
            promedio: 4.5,
            estado: 'DISPONIBLE',
          },
          {
            tipo: 'CURSO',
            titulo: 'Curso Backend Avanzado con Node.js',
            horas: 40,
            promedio: 4.8,
            estado: 'DISPONIBLE',
          },
        ],
      },
    },
    include: { certificados: true },
  })

  const maria = await prisma.estudiante.create({
    data: {
      documento: '1055443322',
      nombre: 'María',
      apellido: 'González',
      email: 'maria.gonzalez@demo.edu.co',
      programa: 'Administración de Empresas',
      estadoAcademico: 'ACTIVO',
      certificados: {
        create: [
          {
            tipo: 'CURSO',
            titulo: 'Diplomado en Gestión de Proyectos',
            horas: 80,
            promedio: 4.2,
            estado: 'DISPONIBLE',
          },
        ],
      },
    },
    include: { certificados: true },
  })

  const carlos = await prisma.estudiante.create({
    data: {
      documento: '1098765432',
      nombre: 'Carlos',
      apellido: 'Rodríguez',
      email: 'carlos.rodriguez@demo.edu.co',
      programa: 'Contaduría Pública',
      estadoAcademico: 'GRADUADO',
      certificados: {
        create: [
          {
            tipo: 'DIPLOMA',
            titulo: 'Certificado de Grado - Contaduría Pública',
            promedio: 4.0,
            estado: 'DISPONIBLE',
          },
          {
            tipo: 'CURSO',
            titulo: 'Curso de Tributación Avanzada',
            horas: 60,
            promedio: 4.6,
            estado: 'DISPONIBLE',
          },
          {
            tipo: 'CURSO',
            titulo: 'Curso de Auditoría Financiera',
            horas: 50,
            promedio: 4.3,
            estado: 'DISPONIBLE',
          },
        ],
      },
    },
    include: { certificados: true },
  })

  console.log('\n✅ Seed ejecutado correctamente\n')
  console.log('Estudiantes creados:')
  console.log(`  - ${juan.nombre} ${juan.apellido} (doc: ${juan.documento}) — ${juan.certificados.length} certificados`)
  console.log(`  - ${maria.nombre} ${maria.apellido} (doc: ${maria.documento}) — ${maria.certificados.length} certificados`)
  console.log(`  - ${carlos.nombre} ${carlos.apellido} (doc: ${carlos.documento}) — ${carlos.certificados.length} certificados`)
  console.log('\nCódigos de certificado para pruebas (ID):')
  ;[...juan.certificados, ...maria.certificados, ...carlos.certificados].forEach((c) => {
    console.log(`  ${c.id}  →  ${c.titulo}`)
  })
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
  