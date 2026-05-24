require('dotenv').config()

console.log('Probando conexión con Academic API...')
console.log('ACADEMIC_API_URL:', process.env.ACADEMIC_API_URL)

const academicApi = require('./services/academic-api.service')

async function test() {
  try {
    const estudiante = await academicApi.buscarEstudiantePorDocumento('1002003000')
    console.log('Estudiante recibido:')
    console.log(estudiante)
  } catch (error) {
    console.error('Error consultando API académica:')
    console.error(error.message)
  }
}

test()