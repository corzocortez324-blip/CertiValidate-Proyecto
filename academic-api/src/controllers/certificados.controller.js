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

async function buscarPorCodigo(req, res) {
  try {
    const { codigo } = req.params

    const certificado = await prisma.certificado.findFirst({
      where: { id: codigo },
      include: { estudiante: true },
    })

    if (!certificado) {
      return res.status(404).json({
        success: false,
        message: 'Certificado no encontrado',
      })
    }

    res.json({
      success: true,
      data: certificado,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error consultando certificado',
    })
  }
}

module.exports = {
  listar,
  buscarPorCodigo,
}