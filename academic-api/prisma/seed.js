require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  await prisma.certificado.deleteMany()
  await prisma.estudiante.deleteMany()

  const estudiante = await prisma.estudiante.create({
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
            titulo: 'Certificado de Grado',
            promedio: 4.5,
          },
          {
            tipo: 'CURSO',
            titulo: 'Curso Backend Avanzado',
            horas: 40,
            promedio: 4.8,
          },
        ],
      },
    },
  })

  console.log('Seed ejecutado correctamente')
  console.log(estudiante)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
  