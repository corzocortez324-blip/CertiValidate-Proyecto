const { Resend } = require('resend')
const QRCode = require('qrcode')
const { generarPDFBuffer } = require('./pdf.generator')
const logger = require('./logger')

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY no configurado')
  return new Resend(apiKey)
}

const emailFrom = () => process.env.EMAIL_FROM || 'onboarding@resend.dev'
const resolveRecipient = (email) => process.env.EMAIL_DEV_TO || email

const enviarEmailVerificacion = async ({ email, nombre, token }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const url = `${frontendUrl}/verificar-email?token=${token}`

  if (process.env.NODE_ENV !== 'production') {
    logger.info({ email, url }, '[DEV] Enviando email de verificación via Resend')
  }

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verifica tu correo — CertiValidate</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.25);border-radius:12px;padding:10px 22px;">
                    <span style="color:#00f0ff;font-size:18px;font-weight:700;letter-spacing:0.5px;">
                      &#x2714; CertiValidate
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 36px;">

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f8fafc;text-align:center;">
                Verifica tu correo electrónico
              </h1>
              <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;text-align:center;">
                Hola <strong style="color:#e2e8f0;">${nombre}</strong>, una cuenta fue creada con este correo.
              </p>

              <!-- Divider -->
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:28px;"></div>

              <p style="margin:0 0 24px;font-size:14px;color:#cbd5e1;line-height:1.7;text-align:center;">
                Haz clic en el botón de abajo para activar tu cuenta.
                Este enlace expira en <strong style="color:#f8fafc;">24 horas</strong>.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${url}"
                       style="display:inline-block;background:#00f0ff;color:#030712;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Verificar mi correo
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:20px;"></div>

              <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;text-align:center;">
                Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:<br/>
                <a href="${url}" style="color:#00f0ff;word-break:break-all;">${url}</a>
              </p>

              <p style="margin:16px 0 0;font-size:12px;color:#475569;text-align:center;">
                Si no creaste esta cuenta, puedes ignorar este mensaje.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:#334155;">
                CertiValidate &copy; 2026 &mdash; Sistema de Certificados Digitales
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: emailFrom(),
      to: resolveRecipient(email),
      subject: 'Verifica tu correo — CertiValidate',
      html,
    })

    if (error) {
      logger.error({ error, email }, 'Resend rechazó el email de verificación')
      return
    }

    logger.info({ id: data?.id, email }, 'Email de verificación enviado')
  } catch (err) {
    logger.error({ err, email }, 'Error al enviar email de verificación')
  }
}

const enviarEmailBienvenida = async ({ email, nombre, password, rol }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const loginUrl = `${frontendUrl}/login`

  const rolLabel = { admin: 'Administrador', editor: 'Editor', lector: 'Lector' }[rol] || rol

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu cuenta en CertiValidate</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.25);border-radius:12px;padding:10px 22px;">
                    <span style="color:#00f0ff;font-size:18px;font-weight:700;letter-spacing:0.5px;">
                      &#x2714; CertiValidate
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 36px;">

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f8fafc;text-align:center;">
                ¡Bienvenido a CertiValidate!
              </h1>
              <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;text-align:center;">
                Hola <strong style="color:#e2e8f0;">${nombre}</strong>, un administrador creó una cuenta para ti.
              </p>

              <!-- Divider -->
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:24px;"></div>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.15);border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">TUS CREDENCIALES</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#94a3b8;width:90px;">Correo</td>
                        <td style="padding:6px 0;font-size:13px;color:#e2e8f0;font-weight:600;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Contraseña</td>
                        <td style="padding:6px 0;font-size:14px;color:#00f0ff;font-weight:700;font-family:monospace;">${password}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#94a3b8;">Rol</td>
                        <td style="padding:6px 0;font-size:13px;color:#e2e8f0;">${rolLabel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;text-align:center;line-height:1.6;">
                Te recomendamos cambiar tu contraseña después de iniciar sesión por primera vez desde tu perfil.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${loginUrl}"
                       style="display:inline-block;background:#00f0ff;color:#030712;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Iniciar sesión
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:16px;"></div>

              <p style="margin:0;font-size:12px;color:#475569;text-align:center;">
                Si tienes algún problema para acceder, contacta al administrador de tu institución.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:#334155;">
                CertiValidate &copy; 2026 &mdash; Sistema de Certificados Digitales
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: emailFrom(),
      to: resolveRecipient(email),
      subject: 'Tu cuenta en CertiValidate — Credenciales de acceso',
      html,
    })

    if (error) {
      logger.error({ error, email }, 'Resend rechazó el email de bienvenida')
      return
    }

    logger.info({ id: data?.id, email }, 'Email de bienvenida enviado')
  } catch (err) {
    logger.error({ err, email }, 'Error al enviar email de bienvenida')
  }
}

const enviarEmailCertificado = async (certificado) => {
  const email = certificado.estudiante?.email
  if (!email) return

  const nombre          = certificado.estudiante?.nombre    || ''
  const apellido        = certificado.estudiante?.apellido  || ''
  const codigoUnico     = certificado.codigo_unico          || ''
  const plantillaNombre = certificado.plantilla?.nombre     || ''
  const institucionNombre = certificado.institucion?.nombre || ''
  const fechaEmision    = certificado.fecha_emision

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const verifyUrl   = `${frontendUrl}/?codigo=${codigoUnico}`

  const fechaFormato = fechaEmision
    ? new Date(fechaEmision).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu certificado — CertiValidate</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.25);border-radius:12px;padding:10px 22px;">
                    <span style="color:#00f0ff;font-size:18px;font-weight:700;letter-spacing:0.5px;">
                      &#x2714; CertiValidate
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 36px;">

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f8fafc;text-align:center;">
                ¡Felicitaciones, ${nombre}!
              </h1>
              <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;text-align:center;">
                Has recibido un certificado digital verificable
              </p>

              <!-- Divider -->
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:24px;"></div>

              <!-- Certificate details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.15);border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">DETALLES DEL CERTIFICADO</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#94a3b8;width:110px;">Estudiante</td>
                        <td style="padding:5px 0;font-size:13px;color:#e2e8f0;font-weight:600;">${nombre} ${apellido}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#94a3b8;">Programa</td>
                        <td style="padding:5px 0;font-size:13px;color:#e2e8f0;font-weight:600;">${plantillaNombre}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#94a3b8;">Institución</td>
                        <td style="padding:5px 0;font-size:13px;color:#e2e8f0;">${institucionNombre}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#94a3b8;">Fecha</td>
                        <td style="padding:5px 0;font-size:13px;color:#e2e8f0;">${fechaFormato}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#94a3b8;">Código único</td>
                        <td style="padding:5px 0;font-size:13px;color:#00f0ff;font-family:monospace;font-weight:700;">${codigoUnico}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- QR Code -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 12px;font-size:13px;color:#94a3b8;">Escanea el QR para verificar tu certificado</p>
                    <div style="background:#ffffff;display:inline-block;padding:10px;border-radius:10px;">
                      <img src="cid:qr_verificacion" width="140" height="140" alt="QR verificación" style="display:block;" />
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;background:#00f0ff;color:#030712;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Verificar certificado
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="border-top:1px solid rgba(255,255,255,0.07);margin-bottom:16px;"></div>

              <p style="margin:0;font-size:12px;color:#64748b;text-align:center;line-height:1.6;">
                También puedes verificarlo ingresando el código <span style="color:#00f0ff;font-family:monospace;">${codigoUnico}</span>
                en <a href="${frontendUrl}" style="color:#00f0ff;">${frontendUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:#334155;">
                CertiValidate &copy; 2026 &mdash; Sistema de Certificados Digitales
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const [resend, pdfBuffer, qrBuffer] = await Promise.all([
      Promise.resolve(getResend()),
      generarPDFBuffer(certificado),
      QRCode.toBuffer(verifyUrl, { width: 160, margin: 2, color: { dark: '#111827', light: '#ffffff' } }),
    ])

    const filename = `certificado-${codigoUnico}.pdf`

    const { data, error } = await resend.emails.send({
      from: emailFrom(),
      to: resolveRecipient(email),
      subject: `Tu certificado de ${plantillaNombre} — CertiValidate`,
      html,
      attachments: [
        { filename, content: pdfBuffer },
        { filename: 'qr.png', content: qrBuffer, content_id: 'qr_verificacion' },
      ],
    })

    if (error) {
      logger.error({ error, email }, 'Resend rechazó el email de certificado')
      return
    }

    logger.info({ id: data?.id, email, codigoUnico }, 'Email de certificado con PDF enviado al estudiante')
  } catch (err) {
    logger.error({ err, email }, 'Error al enviar email de certificado')
  }
}

module.exports = { enviarEmailVerificacion, enviarEmailBienvenida, enviarEmailCertificado }
