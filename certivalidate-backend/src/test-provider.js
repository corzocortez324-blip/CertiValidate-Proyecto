require('dotenv').config()

const provider = require('./services/academic-provider.service')

async function test() {
  try {
    const estudiante = await provider.buscarEstudiante({
      provider: 'external-api',
      documento: '1002003000',
    })

    console.log(estudiante)
  } catch (error) {
    console.error(error.message)
  }
}

test()