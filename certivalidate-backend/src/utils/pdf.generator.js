const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')
const logger = require('./logger')

/**
 * GENERADOR DE PDF CON SOPORTE MULTI-PROVEEDOR
 *
 * Soporta:
 * - Estudiantes locales (desde BD)
 * - Estudiantes externos (desde APIs académicas)
 * - Validación de datos académicos
 * - Renderizado robusto con fallbacks
 */

const sanitizeFilename = (value) =>
  String(value || 'certificado')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')

/**
 * Preparar datos para PDF
 * Soporta estudiantes locales y externos
 */
const prepararDatos = async (certificado) => {
  // Datos del estudiante (puede ser local o externo)
  const estudianteNombre = normalizarNombre(
    certificado.estudiante?.nombre,
    certificado.estudiante?.apellido,
  )

  const plantillaNombre =
    certificado.plantilla?.nombre || 'Plantilla no disponible'
  const institucionNombre =
    certificado.institucion?.nombre || 'Institución no disponible'

  // Información académica (puede venir de provider externo)
  const programaAcademico =
    certificado.estudiante?.programa ||
    certificado.estudiante?.programa_academico ||
    'Programa no especificado'

  const promedio = extraerPromedio(certificado.estudiante)
  const documentoEstudiante = certificado.estudiante?.documento || 'N/A'
  const correoEstudiante = certificado.estudiante?.email || 'No especificado'

  const fecha = certificado.fecha_emision
    ? new Date(certificado.fecha_emision)
    : new Date()
  const fechaFormato = fecha.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const hashTruncado = certificado.hash_sha256
    ? `${certificado.hash_sha256.substring(0, 16)}...`
    : 'N/A'

  const codigoUnico = certificado.codigo_unico || 'N/A'
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const qrUrl = `${frontendUrl}/?codigo=${codigoUnico}`

  let qrBuffer
  try {
    qrBuffer = await QRCode.toBuffer(qrUrl, {
      width: 140,
      margin: 1,
      color: { dark: '#111827', light: '#ffffff' },
    })
  } catch (err) {
    logger.warn(
      {
        certificado_id: certificado.id,
        error: err.message,
      },
      '[PDFGenerator] Error generando QR',
    )
    qrBuffer = null
  }

  return {
    estudianteNombre,
    plantillaNombre,
    institucionNombre,
    programaAcademico,
    promedio,
    documentoEstudiante,
    correoEstudiante,
    fechaFormato,
    hashTruncado,
    codigoUnico,
    qrUrl,
    qrBuffer,
    fechaEmision: fecha,
  }
}

/**
 * Normalizar nombre del estudiante
 * Maneja casos locales y externos
 *
 * @private
 */
function normalizarNombre(nombre, apellido) {
  const n = (nombre ?? '').trim()
  const a = (apellido ?? '').trim()

  if (!n && !a) return 'Estudiante'

  return `${n} ${a}`.trim()
}

/**
 * Extraer promedio del estudiante
 * Busca en múltiples campos según proveedor
 *
 * @private
 */
function extraerPromedio(estudiante) {
  if (!estudiante) return 'N/A'

  // Campos comunes
  const promedio =
    estudiante.promedio ||
    estudiante.gpa ||
    estudiante.calificacion_promedio ||
    estudiante.average ||
    null

  if (promedio) {
    return typeof promedio === 'number' ? promedio.toFixed(2) : String(promedio)
  }

  return 'N/A'
}

/**
 * Escribir contenido del PDF
 * Layout adaptativo para diferentes fuentes de datos
 */
const escribirContenido = (doc, datos) => {
  const {
    estudianteNombre,
    plantillaNombre,
    institucionNombre,
    programaAcademico,
    promedio,
    documentoEstudiante,
    correoEstudiante,
    fechaFormato,
    hashTruncado,
    codigoUnico,
    qrUrl,
    qrBuffer,
  } = datos

  // ── Título ──────────────────────────────────────────────────────
  doc
    .fontSize(28)
    .font('Helvetica-Bold')
    .fillColor('#1f2937')
    .text('CERTIFICADO DE LOGRO', { align: 'center' })
  doc.moveDown(0.5)
  doc
    .fontSize(12)
    .font('Helvetica')
    .fillColor('#4b5563')
    .text(`Emitido por ${institucionNombre}`, { align: 'center' })

  doc.moveDown(1)
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .stroke()
  doc.moveDown(1)

  // ── Cuerpo ──────────────────────────────────────────────────────
  doc
    .fontSize(12)
    .font('Helvetica')
    .fillColor('#374151')
    .text('Se certifica que:')
  doc.moveDown(0.5)
  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text(estudianteNombre, { align: 'center' })

  doc.moveDown(0.8)
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text(`Documento: ${documentoEstudiante}`, { align: 'center' })
  doc.moveDown(0.4)
  doc.text(`Correo: ${correoEstudiante}`, { align: 'center' })

  doc.moveDown(1.2)
  doc
    .fontSize(12)
    .font('Helvetica')
    .fillColor('#374151')
    .text('Ha completado satisfactoriamente el programa:')
  doc.moveDown(0.5)
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text(plantillaNombre, { align: 'center' })

  // ── Datos académicos ────────────────────────────────────────────
  doc.moveDown(1)
  doc
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#374151')
    .text(`Programa: ${programaAcademico}`)
  doc.moveDown(0.3)

  if (promedio !== 'N/A') {
    doc.text(`Promedio: ${promedio}`)
    doc.moveDown(0.3)
  }

  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .stroke()
  doc.moveDown(1)

  // ── Datos de emisión ────────────────────────────────────────────
  doc
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#374151')
    .text(`Fecha de emisión: ${fechaFormato}`)
  doc.moveDown(0.4)
  doc.text(`Código único: ${codigoUnico}`)
  doc.moveDown(0.4)
  doc.text(`Hash SHA-256: ${hashTruncado}`)

  // ── QR Code ─────────────────────────────────────────────────────
  doc.moveDown(1.5)
  if (qrBuffer) {
    const qrSize = 130
    const qrX = (595 - qrSize) / 2
    doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize })
    doc.y += qrSize + 10
  }

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text(
      'Escanea este código para verificar la autenticidad del certificado',
      { align: 'center' },
    )
  doc.moveDown(0.4)
  doc.fontSize(8).fillColor('#9ca3af').text(qrUrl, { align: 'center' })

  // ── Footer ──────────────────────────────────────────────────────
  doc.moveDown(2)
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor('#e5e7eb')
    .lineWidth(0.5)
    .stroke()
  doc.moveDown(0.75)
  doc
    .fontSize(8)
    .font('Helvetica-Oblique')
    .fillColor('#9ca3af')
    .text('CertiValidate © 2026 — Todos los derechos reservados', {
      align: 'center',
    })
}

// Devuelve Buffer — para adjuntar en emails
const generarPDFBuffer = async (certificado) => {
  try {
    const datos = await prepararDatos(certificado)

    return new Promise((resolve, reject) => {
      const chunks = []
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
      escribirContenido(doc, datos)
      doc.end()
    })
  } catch (error) {
    logger.error(
      {
        certificado_id: certificado.id,
        error: error.message,
      },
      '[PDFGenerator] Error en generarPDFBuffer',
    )
    throw error
  }
}

// Streama directo a la respuesta HTTP — para descarga
const generarPDF = async (certificado, res) => {
  try {
    const datos = await prepararDatos(certificado)
    const filename = `certificado_${sanitizeFilename(certificado.id)}_${sanitizeFilename(datos.estudianteNombre)}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    doc.pipe(res)
    escribirContenido(doc, datos)
    doc.end()

    logger.debug(
      {
        certificado_id: certificado.id,
        filename,
      },
      '[PDFGenerator] PDF generado y enviado',
    )
  } catch (error) {
    logger.error(
      {
        certificado_id: certificado.id,
        error: error.message,
      },
      '[PDFGenerator] Error generando PDF',
    )
    if (!res.headersSent) {
      res
        .status(500)
        .json({
          success: false,
          statusCode: 500,
          message: 'Error al generar el PDF',
        })
    }
  }
}

module.exports = { generarPDF, generarPDFBuffer }
