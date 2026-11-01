process.env.NODE_ENV = 'test'
// Sin logs HTTP del servidor durante las pruebas (se puede activar con LOG_LEVEL=info).
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent'
require('../src/utils/load-env')
