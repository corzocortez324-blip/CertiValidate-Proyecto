const prisma = require('../utils/prisma')

async function listar(req, res) {
  try {
    const estudiantes = await prisma.estudiante.findMany({
      include: {
        certificados: true,
      },
    })

    return res.json({
      success: true,
      data: estudiantes,
    })
  } catch (error) {
    console.error('ERROR REAL listar:')
    console.error(error)

    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

async function buscarPorDocumento(req, res) {
  try {
    console.log('ENTRÓ A buscarPorDocumento')

    const { documento } = req.params

    console.log('DOCUMENTO:', documento)

    const estudiante = await prisma.estudiante.findFirst({
      where: {
        documento,
      },
      include: {
        certificados: true,
      },
    })

    console.log('ESTUDIANTE:', estudiante)

    if (!estudiante) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado',
      })
    }

    return res.json({
      success: true,
      data: estudiante,
    })
  } catch (error) {
    console.error('ERROR REAL buscarPorDocumento:')
    console.error(error)

    return res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack,
    })
  }
}

module.exports = {
  listar,
  buscarPorDocumento,
}