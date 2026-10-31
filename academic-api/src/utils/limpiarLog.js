/**
 * Sanea un valor recibido en la petición antes de escribirlo en los logs: quita
 * saltos de línea y caracteres de control (evita inyectar líneas falsas en el log)
 * y limita la longitud.
 */
const limpiarLog = (valor) => String(valor).replace(/[\r\n\t\u0000-\u001f\u007f]/g, ' ').slice(0, 120)

module.exports = { limpiarLog }
