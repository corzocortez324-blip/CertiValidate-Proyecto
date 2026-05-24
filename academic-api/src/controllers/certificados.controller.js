const prisma = require('../utils/prisma')

async function listar(req, res) {
  try {
    const certificados = await prisma.certificado.findMany({
      include: {
        estudiante: true,
      },
    })

    res.json({
      success: true,
      data: certificados,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error consultando certificados',
    })
  }
}

module.exports = {
  listar,
}