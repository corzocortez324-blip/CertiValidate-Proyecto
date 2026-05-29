const { Resend } = require('resend')
const QRCode = require('qrcode')
const { generarPDFBuffer } = require('./pdf.generator')
const { generarImagenCertificado } = require('./certificate.image')
const logger = require('./logger')
const { escapeHtml } = require('./sanitize')

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY no configurado')
  return new Resend(apiKey)
}

const emailFrom    = () => process.env.EMAIL_FROM    || 'codex@certivalidate.online'
const resolveRecipient = (email) => process.env.EMAIL_DEV_TO || email
const frontendBase = () => process.env.FRONTEND_URL  || 'http://localhost:5173'

// Logo PNG alojado en el dominio público (debe existir en certivalidate.online/logo.png)
const LOGO_URL = 'https://certivalidate.online/logo.png'

// QR externo via API pública — funciona en todos los clientes de email (no CID)
const qrEmailUrl = (verifyUrl) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=111827&bgcolor=ffffff&data=${encodeURIComponent(verifyUrl)}`

// ── Ícono HTML puro (sin SVG, sin flexbox) ────────────────────────────────────
const icon = (symbol, label) => `
<td style="padding:0 8px;text-align:center;">
  <table cellpadding="0" cellspacing="0" align="center">
    <tr>
      <td width="42" height="42"
        style="text-align:center;vertical-align:middle;font-size:18px;color:#00cdd8;
               border-radius:50%;border:2px solid #00cdd8;background:#071e2e;
               font-family:Arial,sans-serif;">
        ${symbol}
      </td>
    </tr>
  </table>
  <div style="font-size:7px;color:#00cdd8;margin-top:5px;letter-spacing:1.5px;
              font-weight:700;font-family:Arial,sans-serif;">${label}</div>
</td>`

const BANNER_URL = 'https://certivalidate.online/banner-email.png'

// ── Cabecera con imagen banner real ───────────────────────────────────────────
const HEADER = `
<table width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px 16px 0 0;overflow:hidden;">
  <tr>
    <td style="padding:0;line-height:0;">
      <img src="${BANNER_URL}" width="560" alt="CertiValidate — Verifica. Valida. Confía."
        style="display:block;width:100%;max-width:560px;border-radius:16px 16px 0 0;"
        border="0"/>
    </td>
  </tr>
</table>`

// ── Footer reutilizable ───────────────────────────────────────────────────────
const FOOTER = `
<table width="100%" cellpadding="0" cellspacing="0"
  style="background:#020c1b;border-radius:0 0 16px 16px;border-top:1px solid #0a2a3a;">
  <tr>
    <td style="padding:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#00cdd8;letter-spacing:1px;font-family:Arial,sans-serif;">
        CERTI<strong>VALIDATE</strong>
      </p>
      <p style="margin:0;font-size:10px;color:#334155;font-family:Arial,sans-serif;">
        Sistema de Certificados Digitales &copy; 2026 &mdash;
        <a href="https://certivalidate.online" style="color:#00cdd8;text-decoration:none;">certivalidate.online</a>
      </p>
    </td>
  </tr>
</table>`

// ── Wrapper general ───────────────────────────────────────────────────────────
const wrap = (content) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#050f1e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050f1e;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td>${HEADER}</td></tr>
        <tr>
          <td style="background:#0d1f35;border-left:1px solid #0a2a3a;border-right:1px solid #0a2a3a;padding:32px 28px;">
            ${content}
          </td>
        </tr>
        <tr><td>${FOOTER}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

// ── Email de verificación ─────────────────────────────────────────────────────
const enviarEmailVerificacion = async ({ email, nombre, token }) => {
  const url = `${frontendBase()}/verificar-email?token=${token}`
  const safeNombre = escapeHtml(nombre)
  const safeUrl    = escapeHtml(url)

  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#f1f5f9;text-align:center;font-family:Arial,sans-serif;">
      Verifica tu correo electrónico
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;text-align:center;font-family:Arial,sans-serif;">
      Hola <strong style="color:#00cdd8;">${safeNombre}</strong>, confirma que este correo te pertenece.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#071e2e;border:1px solid #0a3a4a;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.7;font-family:Arial,sans-serif;">
          Haz clic en el botón para activar tu cuenta.<br/>
          Este enlace expira en <strong style="color:#f1f5f9;">24 horas</strong>.
        </p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td align="center">
        <a href="${safeUrl}"
          style="display:inline-block;background:#00cdd8;color:#020c1b;font-size:15px;
                 font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;
                 font-family:Arial,sans-serif;">
          Verificar mi correo
        </a>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="border-top:1px solid #0a2a3a;padding-top:18px;">
        <p style="margin:0;font-size:11px;color:#475569;text-align:center;font-family:Arial,sans-serif;line-height:1.7;">
          Si no puedes hacer clic, copia este enlace en tu navegador:<br/>
          <a href="${safeUrl}" style="color:#00cdd8;word-break:break-all;font-size:10px;">${safeUrl}</a>
        </p>
        <p style="margin:10px 0 0;font-size:11px;color:#334155;text-align:center;font-family:Arial,sans-serif;">
          Si no creaste esta cuenta, ignora este mensaje.
        </p>
      </td></tr>
    </table>`

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: emailFrom(),
      to: resolveRecipient(email),
      subject: 'Verifica tu correo — CertiValidate',
      html: wrap(content),
    })
    if (error) { logger.error({ error, email }, 'Resend rechazó email de verificación'); return }
    logger.info({ id: data?.id, email }, 'Email de verificación enviado')
  } catch (err) {
    logger.error({ err, email }, 'Error al enviar email de verificación')
  }
}

// ── Email de bienvenida ───────────────────────────────────────────────────────
const enviarEmailBienvenida = async ({ email, nombre, password, rol }) => {
  const loginUrl   = `${frontendBase()}/login`
  const rolLabel   = { admin: 'Administrador', editor: 'Editor', lector: 'Lector' }[rol] || rol
  const safeNombre = escapeHtml(nombre)
  const safeEmail  = escapeHtml(email)
  const safePwd    = escapeHtml(password)
  const safeRol    = escapeHtml(rolLabel)
  const safeLogin  = escapeHtml(loginUrl)

  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#f1f5f9;text-align:center;font-family:Arial,sans-serif;">
      ¡Bienvenido a CertiValidate!
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;text-align:center;font-family:Arial,sans-serif;">
      Hola <strong style="color:#00cdd8;">${safeNombre}</strong>, un administrador creó una cuenta para ti.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#071e2e;border:1px solid #0a3a4a;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:10px;color:#00cdd8;letter-spacing:2px;
                  font-weight:700;font-family:Arial,sans-serif;">TUS CREDENCIALES DE ACCESO</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;font-size:12px;color:#64748b;width:110px;
                       font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">Correo</td>
            <td style="padding:8px 0;font-size:13px;color:#e2e8f0;font-weight:600;
                       font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">${safeEmail}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:12px;color:#64748b;
                       font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">Contrase&ntilde;a</td>
            <td style="padding:8px 0;font-size:15px;color:#00cdd8;font-weight:700;
                       font-family:'Courier New',monospace;border-bottom:1px solid #0a2a3a;">${safePwd}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:12px;color:#64748b;font-family:Arial,sans-serif;">Rol</td>
            <td style="padding:8px 0;font-family:Arial,sans-serif;">
              <span style="background:#071e2e;border:1px solid #00cdd8;color:#00cdd8;
                           font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">
                ${safeRol}
              </span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 20px;font-size:12px;color:#64748b;text-align:center;font-family:Arial,sans-serif;">
      Te recomendamos cambiar tu contrase&ntilde;a tras el primer inicio de sesi&oacute;n.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td align="center">
        <a href="${safeLogin}"
          style="display:inline-block;background:#00cdd8;color:#020c1b;font-size:15px;
                 font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;
                 font-family:Arial,sans-serif;">
          Iniciar sesi&oacute;n
        </a>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="border-top:1px solid #0a2a3a;padding-top:16px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#334155;font-family:Arial,sans-serif;">
          Si tienes problemas para acceder, contacta al administrador de tu institución.
        </p>
      </td></tr>
    </table>`

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: emailFrom(),
      to: resolveRecipient(email),
      subject: 'Tu cuenta en CertiValidate — Credenciales de acceso',
      html: wrap(content),
    })
    if (error) { logger.error({ error, email }, 'Resend rechazó email de bienvenida'); return }
    logger.info({ id: data?.id, email }, 'Email de bienvenida enviado')
  } catch (err) {
    logger.error({ err, email }, 'Error al enviar email de bienvenida')
  }
}

// ── Email de certificado ──────────────────────────────────────────────────────
const enviarEmailCertificado = async (certificado) => {
  const email = certificado.estudiante?.email
  if (!email) return

  const nombre          = certificado.estudiante?.nombre || ''
  const apellido        = certificado.estudiante?.apellido || ''
  const codigoUnico     = certificado.codigo_unico || ''
  const plantillaNombre = certificado.plantilla?.nombre || ''
  const institucionNombre = certificado.institucion?.nombre || ''
  const fechaEmision    = certificado.fecha_emision

  const verifyUrl = `${frontendBase()}/?codigo=${codigoUnico}`
  const fechaFormato = fechaEmision
    ? new Date(fechaEmision).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

  const safeNombre      = escapeHtml(nombre)
  const safeApellido    = escapeHtml(apellido)
  const safeCodigo      = escapeHtml(codigoUnico)
  const safePlantilla   = escapeHtml(plantillaNombre)
  const safeInstitucion = escapeHtml(institucionNombre)
  const safeFecha       = escapeHtml(fechaFormato)
  const safeVerifyUrl   = escapeHtml(verifyUrl)
  const safeFrontend    = escapeHtml(frontendBase())

  try {
    const resend = getResend()

    // Generar imagen del certificado y PDF en paralelo
    const [certImageBuffer, pdfBuffer] = await Promise.all([
      generarImagenCertificado(certificado),
      generarPDFBuffer(certificado),
    ])

    const content = `
    <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#f1f5f9;text-align:center;font-family:Arial,sans-serif;">
      &#161;Felicitaciones, ${safeNombre}!
    </h1>
    <p style="margin:0 0 20px;font-size:13px;color:#64748b;text-align:center;font-family:Arial,sans-serif;">
      Has recibido un certificado digital verificable. Ac&#233;ptalo, ingresa y comp&#225;rtelo.
    </p>

    <!-- Imagen del certificado (CID inline) -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="text-align:center;">
        <img src="cid:cert_preview"
          width="500" alt="Certificado de ${safePlantilla}"
          style="display:block;max-width:100%;border-radius:10px;
                 border:2px solid #00cdd8;margin:0 auto;"/>
      </td></tr>
    </table>

    <!-- Botón verificar -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr><td align="center">
        <a href="${safeVerifyUrl}"
          style="display:inline-block;background:#00cdd8;color:#020c1b;font-size:15px;
                 font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;
                 font-family:Arial,sans-serif;">
          Verificar certificado
        </a>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="border-top:1px solid #0a2a3a;padding-top:16px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#475569;font-family:Arial,sans-serif;line-height:1.7;">
          O ingresa el c&#243;digo <strong style="color:#00cdd8;font-family:'Courier New',monospace;">${safeCodigo}</strong>
          en <a href="${safeFrontend}" style="color:#00cdd8;">${safeFrontend}</a>
        </p>
      </td></tr>
    </table>`

    const filename = `certificado-${codigoUnico}.pdf`
    const { data, error } = await resend.emails.send({
      from: emailFrom(),
      to: resolveRecipient(email),
      subject: `Tu certificado de ${safePlantilla} — CertiValidate`,
      html: wrap(content),
      attachments: [
        {
          filename: 'cert-preview.png',
          content: certImageBuffer,
          content_type: 'image/png',
          content_id: 'cert_preview',
        },
        { filename, content: pdfBuffer },
      ],
    })

    if (error) { logger.error({ error, email }, 'Resend rechazó email de certificado'); return }
    logger.info({ id: data?.id, email, codigoUnico }, 'Email de certificado enviado')
  } catch (err) {
    logger.error({ err, email }, 'Error al enviar email de certificado')
  }
}

// ── Enviar email con PDF ya generado (desde frontend) ────────────────────────
const enviarEmailCertificadoConPdf = async (certificado, pdfBuffer) => {
  const email = certificado.estudiante?.email
  if (!email) return

  const codigoUnico     = certificado.codigo_unico || ''
  const nombre          = certificado.estudiante?.nombre || ''
  const apellido        = certificado.estudiante?.apellido || ''
  const plantillaNombre = certificado.plantilla?.nombre || ''
  const institucionNombre = certificado.institucion?.nombre || ''
  const fechaEmision    = certificado.fecha_emision
  const verifyUrl       = `${frontendBase()}/?codigo=${codigoUnico}`
  const qrImgUrl        = qrEmailUrl(verifyUrl)

  const fechaFormato = fechaEmision
    ? new Date(fechaEmision).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

  const safe = (v) => escapeHtml(String(v || ''))

  const content = `
    <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#f1f5f9;text-align:center;font-family:Arial,sans-serif;">
      ¡Felicitaciones, ${safe(nombre)}!
    </h1>
    <p style="margin:0 0 20px;font-size:13px;color:#64748b;text-align:center;font-family:Arial,sans-serif;">
      Has recibido un certificado digital verificable. Enc&uacute;entralo adjunto a este correo.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#071e2e;border:1px solid #0a3a4a;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:10px;color:#00cdd8;letter-spacing:2px;font-weight:700;font-family:Arial,sans-serif;">DETALLES DEL CERTIFICADO</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:7px 0;font-size:12px;color:#64748b;width:110px;font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">Estudiante</td>
            <td style="padding:7px 0;font-size:13px;color:#e2e8f0;font-weight:600;font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">${safe(nombre)} ${safe(apellido)}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;font-size:12px;color:#64748b;font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">Programa</td>
            <td style="padding:7px 0;font-size:13px;color:#e2e8f0;font-weight:600;font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">${safe(plantillaNombre)}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;font-size:12px;color:#64748b;font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">Institución</td>
            <td style="padding:7px 0;font-size:13px;color:#e2e8f0;font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">${safe(institucionNombre)}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;font-size:12px;color:#64748b;font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">Fecha</td>
            <td style="padding:7px 0;font-size:13px;color:#e2e8f0;font-family:Arial,sans-serif;border-bottom:1px solid #0a2a3a;">${safe(fechaFormato)}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;font-size:12px;color:#64748b;font-family:Arial,sans-serif;">Código único</td>
            <td style="padding:7px 0;font-family:Arial,sans-serif;">
              <span style="font-size:13px;color:#00cdd8;font-weight:700;font-family:'Courier New',monospace;">${safe(codigoUnico)}</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr><td style="text-align:center;">
        <p style="margin:0 0 10px;font-size:12px;color:#64748b;font-family:Arial,sans-serif;">Escanea el QR para verificar tu certificado</p>
        <table cellpadding="0" cellspacing="0" align="center">
          <tr><td style="padding:8px;background:#fff;border-radius:10px;border:2px solid #00cdd8;">
            <img src="${qrImgUrl}" width="150" height="150" alt="QR verificación" style="display:block;border-radius:4px;"/>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr><td align="center">
        <a href="${safe(verifyUrl)}" style="display:inline-block;background:#00cdd8;color:#020c1b;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;font-family:Arial,sans-serif;">
          Verificar certificado
        </a>
      </td></tr>
    </table>`

  try {
    const resend = getResend()
    const filename = `certificado-${codigoUnico}.pdf`
    const { data, error } = await resend.emails.send({
      from: emailFrom(),
      to: resolveRecipient(email),
      subject: `Tu certificado de ${safe(plantillaNombre)} — CertiValidate`,
      html: wrap(content),
      attachments: [
        { filename, content: pdfBuffer },
      ],
    })
    if (error) { logger.error({ error, email }, 'Resend rechazó email con PDF adjunto'); return }
    logger.info({ id: data?.id, email, codigoUnico }, 'Email de certificado con PDF enviado')
  } catch (err) {
    logger.error({ err, email }, 'Error al enviar email de certificado con PDF')
  }
}

module.exports = {
  enviarEmailVerificacion,
  enviarEmailBienvenida,
  enviarEmailCertificado,
  enviarEmailCertificadoConPdf,
}
