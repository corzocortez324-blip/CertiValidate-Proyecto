import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// ── Renderiza el HTML del certificado en un iframe y devuelve jsPDF ──
async function renderToPdf(renderedHtml) {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1122px;background:#fff;z-index:-1;'

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'width:1122px;height:1px;border:none;overflow:hidden;'
  container.appendChild(iframe)
  document.body.appendChild(container)

  await new Promise(resolve => { iframe.onload = resolve; iframe.srcdoc = renderedHtml })

  const iframeDoc = iframe.contentDocument
  const images = Array.from(iframeDoc.querySelectorAll('img'))
  await Promise.all(images.map(img =>
    img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
  ))

  const body = iframeDoc.body
  const scrollW = Math.max(body.scrollWidth, body.offsetWidth, iframeDoc.documentElement.offsetWidth)
  const scrollH = Math.max(body.scrollHeight, body.offsetHeight, iframeDoc.documentElement.offsetHeight)

  iframe.style.width  = `${scrollW}px`
  iframe.style.height = `${scrollH}px`
  await new Promise(r => setTimeout(r, 150))

  const canvas = await html2canvas(iframeDoc.body, {
    scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
    width: scrollW, height: scrollH, windowWidth: scrollW, windowHeight: scrollH,
  })

  document.body.removeChild(container)

  const pxToMm = 0.264583
  const pdfW = scrollW * pxToMm
  const pdfH = scrollH * pxToMm

  const pdf = new jsPDF({
    orientation: pdfW >= pdfH ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pdfW, pdfH],
  })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW, pdfH)
  return pdf
}

/** Descarga el PDF del certificado renderizado desde una plantilla HTML. */
export async function downloadCertificatePdf(renderedHtml, filename = 'certificado') {
  const pdf = await renderToPdf(renderedHtml)
  pdf.save(`${filename}.pdf`)
}

/** Retorna el PDF del certificado como string base64 (para enviar por email). */
export async function certificatePdfToBase64(renderedHtml) {
  const pdf = await renderToPdf(renderedHtml)
  return pdf.output('datauristring').split(',')[1]
}

// ── Diploma institucional sin plantilla personalizada ─────────────

function formatLongDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * Construye el HTML de un diploma institucional a partir de los datos del certificado.
 * Usa snapshot_* si existen, con fallback a los datos relacionales.
 * El código único queda en texto plano para que extractCodigoFromPDF lo encuentre.
 */
function buildDiplomaHtml(cert, verifyUrl) {
  const nombre     = [
    cert.snapshot_nombre   ?? cert.estudiante?.nombre   ?? '',
    cert.snapshot_apellido ?? cert.estudiante?.apellido ?? '',
  ].filter(Boolean).join(' ')

  const institucion  = cert.snapshot_institucion_nombre ?? cert.institucion?.nombre   ?? 'Institución'
  const programa     = cert.snapshot_plantilla_nombre   ?? cert.plantilla?.nombre     ?? cert.tipo_certificado ?? ''
  const documento    = cert.snapshot_documento          ?? cert.estudiante?.documento ?? ''
  const fechaEmision = formatLongDate(cert.fecha_emision)
  const codigo       = cert.codigo_unico ?? ''

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&color=1A4F8A&bgcolor=ffffff&data=${encodeURIComponent(verifyUrl)}`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 1060px;
      background: #fff;
      font-family: 'Inter', Arial, sans-serif;
      color: #1F2937;
      -webkit-print-color-adjust: exact;
    }

    .diploma {
      width: 1060px;
      min-height: 750px;
      display: flex;
      flex-direction: column;
      border: 10px solid #1A4F8A;
      position: relative;
    }

    /* Banda superior */
    .diploma-header {
      background: #1A4F8A;
      padding: 2rem 3rem 1.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
    }

    .diploma-inst {
      font-family: 'Outfit', Arial, sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.01em;
    }

    .diploma-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 1rem;
      border: 1.5px solid rgba(255,255,255,0.45);
      border-radius: 999px;
      font-size: 0.75rem;
      color: #bfdbfe;
      white-space: nowrap;
    }

    /* Cuerpo central */
    .diploma-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 4rem 2.5rem;
      text-align: center;
      gap: 1.5rem;
      background: #fff;
    }

    .diploma-otorga {
      font-size: 0.95rem;
      font-weight: 500;
      color: #6B7280;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .diploma-nombre {
      font-family: 'Outfit', Arial, sans-serif;
      font-size: 2.8rem;
      font-weight: 800;
      color: #0F2E5A;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }

    .diploma-divider {
      width: 80px;
      height: 3px;
      background: #1A4F8A;
      border-radius: 2px;
    }

    .diploma-hacompletado {
      font-size: 0.9rem;
      color: #6B7280;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .diploma-programa {
      font-family: 'Outfit', Arial, sans-serif;
      font-size: 1.6rem;
      font-weight: 700;
      color: #1A4F8A;
      line-height: 1.25;
      max-width: 680px;
    }

    .diploma-fecha {
      font-size: 0.95rem;
      color: #4B5563;
    }

    .diploma-fecha strong {
      color: #1F2937;
      font-weight: 600;
    }

    ${documento ? `.diploma-doc { font-size: 0.82rem; color: #9CA3AF; }` : ''}

    /* Separador ornamental */
    .diploma-ornament {
      display: flex;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 480px;
      margin: 0 auto;
    }
    .diploma-ornament-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, #CBD5E1, transparent);
    }
    .diploma-ornament-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #CBD5E1;
    }

    /* Pie del diploma */
    .diploma-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2rem;
      padding: 1.25rem 3rem;
      background: #F3F5F8;
      border-top: 1px solid #E5E7EB;
    }

    .diploma-footer-left {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .diploma-verify-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6B7280;
      font-weight: 600;
    }

    .diploma-codigo {
      font-family: monospace;
      font-size: 1rem;
      font-weight: 700;
      color: #1A4F8A;
      /* sin letter-spacing: pdfjs extrae el texto como bloque continuo para que
         extractCodigoFromPDF encuentre el patrón [A-F0-9]{16} sin espacios */
    }

    .diploma-verify-url {
      font-size: 0.72rem;
      color: #6B7280;
      word-break: break-all;
      max-width: 420px;
    }

    .diploma-qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      flex-shrink: 0;
    }

    .diploma-qr-wrap img {
      display: block;
      border: 1px solid #E5E7EB;
      border-radius: 4px;
    }

    .diploma-qr-label {
      font-size: 0.65rem;
      color: #9CA3AF;
      text-align: center;
    }
  </style>
</head>
<body>
<div class="diploma">

  <div class="diploma-header">
    <div class="diploma-inst">${institucion}</div>
    <div class="diploma-badge">&#9724; Verificado con CertiValidate</div>
  </div>

  <div class="diploma-body">
    <p class="diploma-otorga">Hace constar que</p>

    <h1 class="diploma-nombre">${nombre}</h1>

    <div class="diploma-divider"></div>

    ${programa ? `
    <p class="diploma-hacompletado">ha completado satisfactoriamente</p>
    <h2 class="diploma-programa">${programa}</h2>
    ` : ''}

    <div class="diploma-ornament">
      <div class="diploma-ornament-line"></div>
      <div class="diploma-ornament-dot"></div>
      <div class="diploma-ornament-line"></div>
    </div>

    <p class="diploma-fecha">
      Emitido el <strong>${fechaEmision}</strong>
    </p>

    ${documento ? `<p class="diploma-doc">Documento de identidad: ${documento}</p>` : ''}
  </div>

  <div class="diploma-footer">
    <div class="diploma-footer-left">
      <span class="diploma-verify-label">Código de verificación</span>
      <span class="diploma-codigo">${codigo}</span>
      <span class="diploma-verify-url">${verifyUrl}</span>
    </div>
    <div class="diploma-qr-wrap">
      <img src="${qrApiUrl}" width="110" height="110" alt="QR de verificación" />
      <span class="diploma-qr-label">Escanear para verificar</span>
    </div>
  </div>

</div>
</body>
</html>`
}

/**
 * Genera y descarga un diploma institucional a partir del objeto certificado.
 * Usa snapshot_* con fallback a datos relacionales.
 * El código único queda en texto plano (extraíble por extractCodigoFromPDF).
 */
export async function generateDiplomaPdf(cert, verifyUrl, filename) {
  const name = filename ?? `diploma-${cert.codigo_unico ?? 'certificado'}`
  const html = buildDiplomaHtml(cert, verifyUrl)
  const pdf  = await renderToPdf(html)
  pdf.save(`${name}.pdf`)
}

/** Igual que generateDiplomaPdf pero devuelve base64 en lugar de descargar. */
export async function diplomaPdfToBase64(cert, verifyUrl) {
  const html = buildDiplomaHtml(cert, verifyUrl)
  const pdf  = await renderToPdf(html)
  return pdf.output('datauristring').split(',')[1]
}
