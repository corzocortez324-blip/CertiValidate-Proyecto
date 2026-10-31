require('../src/utils/load-env')
// Lo recibido de la API externa se registra sin saltos de línea ni caracteres de control
const limpiarLog = (v) => String(v).replace(/[\r\n\t\u0000-\u001f\u007f]/g, ' ')

console.log('Probando conexión con Academic API...')
console.log('ACADEMIC_API_URL:', process.env.ACADEMIC_API_URL)

const academicApi = require('../src/services/academic-api.service')

async function test() {
  try {
    const estudiante =
      await academicApi.buscarEstudiantePorDocumento('1002003000')
    console.log('Estudiante recibido:')
    console.log(limpiarLog(JSON.stringify(estudiante, null, 2)))
  } catch (error) {
    console.error('Error consultando API académica:')
    console.error(limpiarLog(error.message))
  }
}

test().catch((err) => {
  console.error(limpiarLog(err?.stack || err))
  process.exit(1)
})