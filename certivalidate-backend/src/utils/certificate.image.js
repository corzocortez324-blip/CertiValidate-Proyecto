const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')
const QRCode = require('qrcode')

/**
 * Genera una imagen PNG del certificado para adjuntar en el correo.
 * Retorna un Buffer PNG.
 */
async function generarImagenCertificado(certificado) {
  const W = 820
  const H = 540

  const canvas = createCanvas(W, H)
  const ctx    = canvas.getContext('2d')

  const nombre      = `${certificado.estudiante?.nombre || ''} ${certificado.estudiante?.apellido || ''}`.trim()
  const programa    = certificado.plantilla?.nombre     || 'Programa académico'
  const institucion = certificado.institucion?.nombre   || 'Institución'
  const codigo      = certificado.codigo_unico          || ''
  const fechaEmision = certificado.fecha_emision
    ? new Date(certificado.fecha_emision).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── Fondo blanco ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ── Borde exterior teal ───────────────────────────────────────────────────────
  ctx.strokeStyle = '#00cdd8'
  ctx.lineWidth   = 6
  roundRect(ctx, 3, 3, W - 6, H - 6, 14, false, true)

  // ── Borde interior fino ───────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(0,205,216,0.3)'
  ctx.lineWidth   = 1.5
  roundRect(ctx, 14, 14, W - 28, H - 28, 10, false, true)

  // ── Cabecera oscura ───────────────────────────────────────────────────────────
  ctx.fillStyle = '#04192e'
  roundRect(ctx, 3, 3, W - 6, 90, { tl: 14, tr: 14, bl: 0, br: 0 }, true, false)

  // Línea teal bajo cabecera
  ctx.fillStyle = '#00cdd8'
  ctx.fillRect(3, 90, W - 6, 4)

  // ── Texto "CERTIVALIDATE" en cabecera ─────────────────────────────────────────
  ctx.font      = 'bold 22px Arial'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Certi', 34, 57)

  ctx.font      = 'bold 22px Arial'
  ctx.fillStyle = '#00cdd8'
  const certiW = ctx.measureText('Certi').width
  ctx.fillText('Validate', 34 + certiW, 57)

  ctx.font      = '10px Arial'
  ctx.fillStyle = 'rgba(0,205,216,0.7)'
  ctx.letterSpacing = '2px'
  ctx.fillText('BLOCKCHAIN CERTIFIED  ·  VERIFICA  ·  VALIDA  ·  CONFÍA', 34, 76)

  // ── Institución en cabecera ───────────────────────────────────────────────────
  ctx.font      = '12px Arial'
  ctx.fillStyle = '#94a3b8'
  ctx.textAlign = 'right'
  ctx.fillText(institucion, W - 34, 57)
  ctx.textAlign = 'left'

  // ── QR en esquina superior derecha ───────────────────────────────────────────
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const verifyUrl   = `${frontendUrl}/?codigo=${codigo}`
  const qrBuffer    = await QRCode.toBuffer(verifyUrl, {
    width: 90, margin: 1, color: { dark: '#04192e', light: '#ffffff' },
  })

  const qrImg = await loadImage(qrBuffer)
  const qrX   = W - 120
  const qrY   = 108

  // Marco blanco del QR
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, qrX - 5, qrY - 5, 100, 100, 6, true, false)
  ctx.strokeStyle = 'rgba(0,205,216,0.4)'
  ctx.lineWidth   = 1
  roundRect(ctx, qrX - 5, qrY - 5, 100, 100, 6, false, true)
  ctx.drawImage(qrImg, qrX, qrY, 90, 90)

  ctx.font      = '8px Arial'
  ctx.fillStyle = '#94a3b8'
  ctx.textAlign = 'center'
  ctx.fillText('Escanear para', qrX + 40, qrY + 100)
  ctx.fillText('verificar', qrX + 40, qrY + 112)
  ctx.textAlign = 'left'

  // ── Cuerpo del certificado ────────────────────────────────────────────────────
  const bodyX = 40
  let   y     = 130

  // "Se certifica que:"
  ctx.font      = '12px Arial'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Se certifica que:', bodyX, y)
  y += 36

  // Nombre del estudiante
  ctx.font      = 'bold 30px Arial'
  ctx.fillStyle = '#04192e'
  ctx.fillText(truncate(ctx, nombre, W - 180), bodyX, y)
  y += 12

  // Línea decorativa bajo el nombre
  ctx.fillStyle = '#00cdd8'
  ctx.fillRect(bodyX, y, 280, 3)
  y += 24

  // "ha completado satisfactoriamente:"
  ctx.font      = '12px Arial'
  ctx.fillStyle = '#64748b'
  ctx.fillText('ha completado satisfactoriamente el programa:', bodyX, y)
  y += 30

  // Nombre del programa
  ctx.font      = 'bold 18px Arial'
  ctx.fillStyle = '#008b96'
  ctx.fillText(truncate(ctx, programa, W - 180), bodyX, y)
  y += 40

  // ── Datos adicionales ─────────────────────────────────────────────────────────
  // Línea separadora
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(bodyX, y)
  ctx.lineTo(W - 40, y)
  ctx.stroke()
  y += 22

  // Fecha e institución
  ctx.font      = '12px Arial'
  ctx.fillStyle = '#64748b'
  ctx.fillText(`Fecha de emisión:`, bodyX, y)
  ctx.fillStyle = '#04192e'
  ctx.fillText(fechaEmision, bodyX + 120, y)
  y += 24

  ctx.fillStyle = '#64748b'
  ctx.fillText(`Institución:`, bodyX, y)
  ctx.fillStyle = '#04192e'
  ctx.fillText(truncate(ctx, institucion, W - 220), bodyX + 120, y)
  y += 30

  // ── Código único ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#f0fdff'
  roundRect(ctx, bodyX, y, 320, 36, 6, true, false)
  ctx.strokeStyle = 'rgba(0,205,216,0.4)'
  ctx.lineWidth   = 1
  roundRect(ctx, bodyX, y, 320, 36, 6, false, true)

  ctx.font      = '10px Arial'
  ctx.fillStyle = '#64748b'
  ctx.fillText('CÓDIGO ÚNICO:', bodyX + 12, y + 14)

  ctx.font      = 'bold 14px Arial'
  ctx.fillStyle = '#00848f'
  ctx.letterSpacing = '2px'
  ctx.fillText(codigo, bodyX + 12, y + 30)
  ctx.letterSpacing = '0px'

  // ── Footer ────────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(3, H - 40, W - 6, 37)

  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(3, H - 40)
  ctx.lineTo(W - 3, H - 40)
  ctx.stroke()

  ctx.font      = '10px Arial'
  ctx.fillStyle = '#94a3b8'
  ctx.textAlign = 'center'
  ctx.fillText('● certivalidate.online   ·   Verificación blockchain   ·   SHA-256   ·   Documento digital oficial', W / 2, H - 16)
  ctx.textAlign = 'left'

  return canvas.toBuffer('image/png')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  const radius = typeof r === 'number'
    ? { tl: r, tr: r, br: r, bl: r }
    : { tl: r.tl || 0, tr: r.tr || 0, br: r.br || 0, bl: r.bl || 0 }

  ctx.beginPath()
  ctx.moveTo(x + radius.tl, y)
  ctx.lineTo(x + w - radius.tr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius.tr)
  ctx.lineTo(x + w, y + h - radius.br)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h)
  ctx.lineTo(x + radius.bl, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius.bl)
  ctx.lineTo(x, y + radius.tl)
  ctx.quadraticCurveTo(x, y, x + radius.tl, y)
  ctx.closePath()
  if (fill)   ctx.fill()
  if (stroke) ctx.stroke()
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let truncated = text
  while (ctx.measureText(truncated + '…').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '…'
}

async function loadImage(buffer) {
  const { loadImage } = require('@napi-rs/canvas')
  return loadImage(buffer)
}

module.exports = { generarImagenCertificado }
