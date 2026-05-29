require('dotenv').config()
const { enviarEmailVerificacion, enviarEmailBienvenida, enviarEmailCertificado } = require('../src/utils/mailer')

async function main() {
  console.log('Enviando correos de prueba a keimpor@gmail.com...\n')

  // 1. Email de verificación
  await enviarEmailVerificacion({
    email: 'keimpor@gmail.com',
    nombre: 'Usuario Prueba',
    token: 'abc123token456def789',
  })
  console.log('✅ Email de verificación enviado')

  // 2. Email de bienvenida
  await enviarEmailBienvenida({
    email: 'keimpor@gmail.com',
    nombre: 'Usuario Prueba',
    password: 'Temporal#2026',
    rol: 'admin',
  })
  console.log('✅ Email de bienvenida enviado')

  // 3. Email de certificado
  await enviarEmailCertificado({
    codigo_unico: 'A1B2C3D4E5F6G7H8',
    fecha_emision: new Date(),
    estudiante: {
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'keimpor@gmail.com',
    },
    plantilla: { nombre: 'Desarrollo de Software' },
    institucion: { nombre: 'Universidad Ejemplo' },
  })
  console.log('✅ Email de certificado enviado')
}

main().catch(console.error)
