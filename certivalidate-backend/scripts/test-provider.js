require('../src/utils/load-env')
// Lo recibido de la API externa se registra sin saltos de línea ni caracteres de control
const limpiarLog = (v) => String(v).replace(/[\r\n\t\u0000-\u001f\u007f]/g, ' ')

const provider = require('../src/services/academic-provider.service')

async function test() {
  try {
    const estudiante = await provider.buscarEstudiante({
      provider: 'external-api',
      documento: '1002003000',
    })

    console.log(limpiarLog(JSON.stringify(estudiante, null, 2)))
  } catch (error) {
    console.error(error.message)
  }
}

test().catch((err) => {
  console.error(err)
  process.exit(1)
})