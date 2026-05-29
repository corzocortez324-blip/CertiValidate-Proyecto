import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// ── Renderiza el HTML del certificado en un iframe y devuelve jsPDF + canvas ──
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

/**
 * Renderiza el template HTML y lo descarga como PDF.
 */
/** Descarga el PDF del certificado renderizado. */
export async function downloadCertificatePdf(renderedHtml, filename = 'certificado') {
  const pdf = await renderToPdf(renderedHtml)
  pdf.save(`${filename}.pdf`)
}

/** Retorna el PDF del certificado como string base64 (para enviar por email). */
export async function certificatePdfToBase64(renderedHtml) {
  const pdf = await renderToPdf(renderedHtml)
  return pdf.output('datauristring').split(',')[1]
}
