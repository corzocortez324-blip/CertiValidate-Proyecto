require('../src/utils/load-env')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const nodeCrypto = require('node:crypto')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ── Encryption helper (graceful fallback if ENCRYPTION_KEY is absent) ──────────
let encryptFn = (text) => text
try {
  const { encrypt } = require('../src/utils/crypto')
  encryptFn = encrypt
} catch {
  // crypto.js requires ENCRYPTION_KEY; if missing we store plain text
}

function tryEncrypt(text) {
  try {
    return encryptFn(text)
  } catch {
    console.warn('    [WARN] ENCRYPTION_KEY no disponible — api_key se guardará en texto plano')
    return text
  }
}

// ── SHA-256 hash matching blockchain.service.js generateCertificateHash ────────
function generateCertHash(cert) {
  const payload = {
    certificado_id: cert.id,
    codigo_unico: cert.codigo_unico,
    estado: cert.estado,
    estudiante_id: cert.estudiante_id,
    fecha_emision: cert.fecha_emision instanceof Date
      ? cert.fecha_emision.toISOString()
      : cert.fecha_emision,
    institucion_id: cert.institucion_id,
    plantilla_id: cert.plantilla_id,
  }
  const stable = JSON.stringify(
    Object.fromEntries(Object.keys(payload).sort().map((k) => [k, payload[k]])),
  )
  return nodeCrypto.createHash('sha256').update(stable).digest('hex')
}

// ── Mock tx_hash matching blockchain.service.js mock mode ─────────────────────
function mockTxHash(hash) {
  return `mock_tx_${hash.slice(0, 16)}_${Date.now()}`
}

// ══════════════════════════════════════════════════════════════════════════════
// RBAC — Roles, Permisos, Usuarios
// ══════════════════════════════════════════════════════════════════════════════

const ROLES = [
  { nombre: 'admin', descripcion: 'Acceso total a todos los recursos' },
  { nombre: 'editor', descripcion: 'Puede crear y editar recursos, sin acceso administrativo' },
  { nombre: 'lector', descripcion: 'Solo lectura' },
]

const PERMISOS = [
  { recurso: 'certificado', accion: 'emitir' },
  { recurso: 'certificado', accion: 'revocar' },
  { recurso: 'certificado', accion: 'listar' },
  { recurso: 'certificado', accion: 'ver' },
  { recurso: 'certificado', accion: 'descargar' },
  { recurso: 'estudiante', accion: 'crear' },
  { recurso: 'estudiante', accion: 'actualizar' },
  { recurso: 'estudiante', accion: 'eliminar' },
  { recurso: 'estudiante', accion: 'listar' },
  { recurso: 'estudiante', accion: 'ver' },
  { recurso: 'institucion', accion: 'crear' },
  { recurso: 'institucion', accion: 'actualizar' },
  { recurso: 'institucion', accion: 'ver' },
  { recurso: 'institucion', accion: 'estadisticas' },
  { recurso: 'plantilla', accion: 'crear' },
  { recurso: 'plantilla', accion: 'actualizar' },
  { recurso: 'plantilla', accion: 'archivar' },
  { recurso: 'plantilla', accion: 'ver' },
  { recurso: 'plantilla', accion: 'listar' },
  { recurso: 'auditoria', accion: 'ver' },
  { recurso: 'admin', accion: 'stats' },
  { recurso: 'usuario', accion: 'listar' },
  { recurso: 'usuario', accion: 'ver' },
  { recurso: 'usuario', accion: 'crear' },
  { recurso: 'usuario', accion: 'actualizar' },
  { recurso: 'usuario', accion: 'eliminar' },
]

const PERMISOS_POR_ROL = {
  admin: PERMISOS.map((p) => `${p.recurso}:${p.accion}`),
  editor: [
    'certificado:emitir',
    'certificado:revocar',
    'certificado:listar',
    'certificado:ver',
    'certificado:descargar',
    'estudiante:crear',
    'estudiante:actualizar',
    'estudiante:listar',
    'estudiante:ver',
    'institucion:ver',
    'institucion:estadisticas',
    'plantilla:crear',
    'plantilla:actualizar',
    'plantilla:archivar',
    'plantilla:ver',
    'plantilla:listar',
    'auditoria:ver',
  ],
  lector: [
    'certificado:listar',
    'certificado:ver',
    'certificado:descargar',
    'estudiante:listar',
    'estudiante:ver',
    'institucion:ver',
    'institucion:estadisticas',
    'plantilla:ver',
    'plantilla:listar',
    'auditoria:ver',
  ],
}

const DEMO_INSTITUCION = {
  nombre: 'Institución Demo CertiValidate',
  dominio: 'certivalidate.com',
  activa: true,
}

const DEMO_USUARIOS = [
  {
    email: 'admin@certivalidate.com',
    nombre: 'Admin',
    apellido: 'Demo',
    password: 'Admin1234!',
    rol: 'admin',
    es_platform_admin: true,
    email_verificado: true,
  },
  {
    email: 'emisor@certivalidate.com',
    nombre: 'Emisor',
    apellido: 'Demo',
    password: 'Emisor1234!',
    rol: 'editor',
    es_platform_admin: false,
    email_verificado: true,
  },
  {
    email: 'lector@certivalidate.com',
    nombre: 'Lector',
    apellido: 'Demo',
    password: 'Lector1234!',
    rol: 'lector',
    es_platform_admin: false,
    email_verificado: true,
  },
]

// ══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — Instituciones, Integraciones, Estudiantes, Plantillas, Certificados
// ══════════════════════════════════════════════════════════════════════════════

const INSTITUCIONES_DEMO = [
  { nombre: 'Universidad Popular del Cesar', dominio: 'unicesar.edu.co', activa: true },
  { nombre: 'Instituto Técnico Demo', dominio: 'itecnicodemo.edu.co', activa: true },
  { nombre: 'Corporación Académica Demo', dominio: 'corpdemo.edu.co', activa: true },
]

const INTEGRACIONES_DEMO = {
  'unicesar.edu.co': {
    tipo: 'REST',
    url_base: 'https://api.unicesar.edu.co/v1',
    api_key: 'demo-key-unicesar-abc123secure',
    activa: true,
  },
  'itecnicodemo.edu.co': {
    tipo: 'REST',
    url_base: 'https://api.itecnico.demo/v2',
    api_key: 'demo-key-itecnico-xyz789secure',
    activa: true,
  },
  'corpdemo.edu.co': {
    tipo: 'REST',
    url_base: 'https://api.corpdemo.edu.co/v1',
    api_key: 'demo-key-corp-mno456secure',
    activa: true,
  },
}

const ESTUDIANTES_DEMO = {
  'unicesar.edu.co': [
    { nombre: 'Laura', apellido: 'Martínez Ruiz', documento: '1093412301', email: 'laura.martinez@unicesar.edu.co' },
    { nombre: 'Carlos', apellido: 'Pérez Hernández', documento: '1094512302', email: 'carlos.perez@unicesar.edu.co' },
    { nombre: 'Sofía', apellido: 'González López', documento: '1095612303', email: 'sofia.gonzalez@unicesar.edu.co' },
    { nombre: 'Andrés', apellido: 'Ramírez Castro', documento: '1096712304', email: 'andres.ramirez@unicesar.edu.co' },
    { nombre: 'Valentina', apellido: 'Torres Díaz', documento: '1097812305', email: 'valentina.torres@unicesar.edu.co' },
  ],
  'itecnicodemo.edu.co': [
    { nombre: 'Miguel', apellido: 'Vargas Suárez', documento: '1098912306', email: 'miguel.vargas@itecnico.demo' },
    { nombre: 'Isabella', apellido: 'Ramos Molina', documento: '1090012307', email: 'isabella.ramos@itecnico.demo' },
    { nombre: 'Sebastián', apellido: 'Mora Fuentes', documento: '1091112308', email: 'sebastian.mora@itecnico.demo' },
    { nombre: 'Camila', apellido: 'Ortiz Navarro', documento: '1092212309', email: 'camila.ortiz@itecnico.demo' },
  ],
  'corpdemo.edu.co': [
    { nombre: 'Daniel', apellido: 'Reyes Agudelo', documento: '1093312310', email: 'daniel.reyes@corpdemo.edu.co' },
    { nombre: 'Mariana', apellido: 'Silva Ospina', documento: '1094412311', email: 'mariana.silva@corpdemo.edu.co' },
    { nombre: 'Juan Pablo', apellido: 'Cárdenas Muñoz', documento: '1095512312', email: 'juanpablo.cardenas@corpdemo.edu.co' },
    { nombre: 'Natalia', apellido: 'Mendoza Cruz', documento: '1096612313', email: 'natalia.mendoza@corpdemo.edu.co' },
  ],
}

// ── Professional HTML templates ────────────────────────────────────────────────

const TEMPLATE_PREGRADO_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Georgia', serif; margin: 0; padding: 40px; background: #fdfaf5; color: #2c2c2c; }
  .certificate { border: 8px solid #1a3a5c; border-radius: 8px; padding: 48px 60px; text-align: center; max-width: 800px; margin: auto; background: linear-gradient(135deg,#fff 0%,#f8f4ec 100%); box-shadow: 0 4px 24px rgba(0,0,0,.15); }
  .header-label { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #1a3a5c; margin-bottom: 4px; }
  .institution-name { font-size: 26px; font-weight: bold; color: #1a3a5c; margin: 0 0 8px; }
  .divider { border: none; border-top: 2px solid #c9a84c; width: 60%; margin: 16px auto; }
  .cert-title { font-size: 40px; color: #c9a84c; font-style: italic; margin: 16px 0; }
  .body-text { font-size: 16px; line-height: 1.9; color: #4a4a4a; }
  .student-name { font-size: 28px; font-weight: bold; color: #1a3a5c; margin: 12px 0; border-bottom: 1px solid #c9a84c; display: inline-block; padding-bottom: 4px; }
  .program { font-size: 18px; font-style: italic; color: #2c2c2c; margin: 8px 0; }
  .footer { margin-top: 48px; display: flex; justify-content: space-around; }
  .sig-block { text-align: center; }
  .sig-line { border-top: 1px solid #2c2c2c; width: 180px; margin: 0 auto 4px; }
  .sig-name { font-size: 13px; font-weight: bold; }
  .sig-title { font-size: 11px; color: #666; }
  .cert-code { font-size: 10px; color: #999; margin-top: 32px; }
</style>
</head>
<body>
<div class="certificate">
  <div class="header-label">República de Colombia</div>
  <div class="institution-name">{{institucion_nombre}}</div>
  <div class="header-label">Institución de Educación Superior</div>
  <hr class="divider">
  <div class="cert-title">Diploma de Grado</div>
  <div class="body-text">La institución certifica que el/la estudiante:</div>
  <div class="student-name">{{estudiante_nombre}} {{estudiante_apellido}}</div>
  <div class="body-text">
    identificado/a con documento N.° <strong>{{estudiante_documento}}</strong>,<br>
    habiendo cumplido satisfactoriamente todos los requisitos académicos,<br>
    recibe el título de
  </div>
  <div class="program"><strong>{{programa}}</strong></div>
  <div class="body-text">Expedido en Valledupar, el {{fecha_emision}}.</div>
  <div class="footer">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">Rector(a)</div>
      <div class="sig-title">Rectoría</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">Secretaria/o General</div>
      <div class="sig-title">Secretaría General</div>
    </div>
  </div>
  <div class="cert-code">Código de verificación: {{codigo_unico}} | Emitido por CertiValidate</div>
</div>
</body>
</html>`

const TEMPLATE_DIPLOMADO_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Helvetica Neue', sans-serif; margin: 0; padding: 40px; background: #f0f4f8; }
  .certificate { background: #fff; border-radius: 12px; padding: 48px; max-width: 780px; margin: auto; box-shadow: 0 2px 20px rgba(0,0,0,.1); border-top: 6px solid #0066cc; }
  .badge { background: #0066cc; color: #fff; display: inline-block; padding: 6px 20px; border-radius: 20px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 24px; }
  .institution { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #666; margin-bottom: 32px; }
  .certifies { font-size: 15px; color: #444; }
  .student-name { font-size: 32px; font-weight: 700; color: #0066cc; margin: 12px 0; }
  .completion-text { font-size: 15px; color: #444; line-height: 1.7; }
  .program-box { background: #f0f4f8; border-left: 4px solid #0066cc; padding: 12px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .program-name { font-size: 18px; font-weight: 600; color: #1a1a2e; }
  .hours { font-size: 13px; color: #666; }
  .date-row { color: #444; font-size: 14px; margin-top: 24px; }
  .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
  .verify { font-size: 11px; color: #999; }
</style>
</head>
<body>
<div class="certificate">
  <div class="badge">Certificado de Diplomado</div>
  <div class="institution">{{institucion_nombre}}</div>
  <div class="subtitle">División de Educación Continua y Postgrado</div>
  <div class="certifies">Certifica que:</div>
  <div class="student-name">{{estudiante_nombre}} {{estudiante_apellido}}</div>
  <div class="completion-text">con documento N.° <strong>{{estudiante_documento}}</strong>, completó exitosamente el:</div>
  <div class="program-box">
    <div class="program-name">{{programa}}</div>
    <div class="hours">Intensidad horaria: 120 horas académicas</div>
  </div>
  <div class="date-row">Valledupar, {{fecha_emision}}</div>
  <div class="footer">
    <div>
      <strong>Director/a Académico/a</strong><br>
      <span style="font-size:12px;color:#666">División de Educación Continua</span>
    </div>
    <div class="verify">Verificar en: certivalidate.com/v/{{codigo_unico}}</div>
  </div>
</div>
</body>
</html>`

const TEMPLATE_ASISTENCIA_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Arial', sans-serif; margin: 0; padding: 32px; background: #fff; }
  .certificate { border: 3px double #2d6a4f; padding: 40px; max-width: 720px; margin: auto; background: #f8fffe; }
  .inst-name { font-size: 20px; font-weight: bold; color: #1b4332; text-align: center; }
  .cert-type { font-size: 30px; color: #2d6a4f; font-style: italic; text-align: center; margin: 8px 0 24px; }
  .body-text { font-size: 15px; line-height: 2; color: #333; text-align: center; }
  .highlight { font-size: 24px; font-weight: bold; color: #1b4332; }
  .event { font-size: 17px; font-style: italic; color: #2d6a4f; }
  .seal { text-align: center; margin-top: 32px; }
  .seal-circle { display: inline-block; border: 3px solid #2d6a4f; border-radius: 50%; width: 80px; height: 80px; line-height: 74px; font-size: 10px; color: #2d6a4f; font-weight: bold; text-align: center; }
  .qr-hint { font-size: 10px; color: #999; text-align: center; margin-top: 16px; }
</style>
</head>
<body>
<div class="certificate">
  <div class="inst-name">{{institucion_nombre}}</div>
  <div class="cert-type">Constancia de Asistencia</div>
  <div class="body-text">
    La presente institución hace constar que:<br>
    <span class="highlight">{{estudiante_nombre}} {{estudiante_apellido}}</span><br>
    documento N.° {{estudiante_documento}}<br>
    participó activamente en el evento académico:<br>
    <span class="event">{{programa}}</span><br>
    celebrado el {{fecha_emision}}.
  </div>
  <div class="seal">
    <div class="seal-circle">SELLO<br>OFICIAL</div>
  </div>
  <div class="qr-hint">Código: {{codigo_unico}} — Verificar en certivalidate.com</div>
</div>
</body>
</html>`

const PLANTILLAS_DEF = [
  { nombre: 'Diploma de Pregrado', template_html: TEMPLATE_PREGRADO_HTML, version: 1, activa: true },
  { nombre: 'Certificado de Diplomado', template_html: TEMPLATE_DIPLOMADO_HTML, version: 1, activa: true },
  { nombre: 'Constancia de Asistencia', template_html: TEMPLATE_ASISTENCIA_HTML, version: 1, activa: true },
]

// withBlockchain: true  → crea BlockchainTransaccion confirmada (registrado en BC)
// withBlockchain: false → sin registro BC (aparece como "Pendiente BC" en el frontend)
const CERTIFICADOS_DEMO = [
  // Universidad Popular del Cesar
  { codigoUnico: 'CERT-UPC-2024-0001', dominio: 'unicesar.edu.co', estIdx: 0, plIdx: 0, estado: 'vigente',  emision: '2024-06-15', expiracion: '2028-06-15', withBlockchain: true },
  { codigoUnico: 'CERT-UPC-2024-0002', dominio: 'unicesar.edu.co', estIdx: 1, plIdx: 1, estado: 'vigente',  emision: '2024-08-20', expiracion: null,         withBlockchain: true },
  { codigoUnico: 'CERT-UPC-2024-0003', dominio: 'unicesar.edu.co', estIdx: 2, plIdx: 2, estado: 'vigente',  emision: '2024-09-10', expiracion: '2025-09-10', withBlockchain: false },
  { codigoUnico: 'CERT-UPC-2025-0001', dominio: 'unicesar.edu.co', estIdx: 0, plIdx: 1, estado: 'vigente',  emision: '2025-01-15', expiracion: '2029-01-15', withBlockchain: false },
  { codigoUnico: 'CERT-UPC-2023-0001', dominio: 'unicesar.edu.co', estIdx: 3, plIdx: 0, estado: 'expirado', emision: '2023-03-01', expiracion: '2024-03-01', withBlockchain: true },
  { codigoUnico: 'CERT-UPC-2023-0002', dominio: 'unicesar.edu.co', estIdx: 4, plIdx: 1, estado: 'revocado', emision: '2023-06-01', expiracion: null,         withBlockchain: false, motivoRevocacion: 'ERROR_DATOS' },
  // Instituto Técnico Demo
  { codigoUnico: 'CERT-ITD-2024-0001', dominio: 'itecnicodemo.edu.co', estIdx: 0, plIdx: 0, estado: 'vigente',  emision: '2024-04-10', expiracion: '2027-04-10', withBlockchain: true },
  { codigoUnico: 'CERT-ITD-2024-0002', dominio: 'itecnicodemo.edu.co', estIdx: 1, plIdx: 2, estado: 'vigente',  emision: '2024-07-20', expiracion: null,         withBlockchain: false },
  { codigoUnico: 'CERT-ITD-2024-0003', dominio: 'itecnicodemo.edu.co', estIdx: 2, plIdx: 1, estado: 'expirado', emision: '2023-11-05', expiracion: '2024-11-05', withBlockchain: true },
  { codigoUnico: 'CERT-ITD-2025-0001', dominio: 'itecnicodemo.edu.co', estIdx: 3, plIdx: 0, estado: 'vigente',  emision: '2025-02-01', expiracion: '2028-02-01', withBlockchain: false },
  // Corporación Académica Demo
  { codigoUnico: 'CERT-CAD-2024-0001', dominio: 'corpdemo.edu.co', estIdx: 0, plIdx: 0, estado: 'vigente',  emision: '2024-05-22', expiracion: '2028-05-22', withBlockchain: true },
  { codigoUnico: 'CERT-CAD-2024-0002', dominio: 'corpdemo.edu.co', estIdx: 1, plIdx: 1, estado: 'vigente',  emision: '2024-10-15', expiracion: null,         withBlockchain: false },
  { codigoUnico: 'CERT-CAD-2024-0003', dominio: 'corpdemo.edu.co', estIdx: 2, plIdx: 2, estado: 'expirado', emision: '2022-08-01', expiracion: '2023-08-01', withBlockchain: true },
  { codigoUnico: 'CERT-CAD-2024-0004', dominio: 'corpdemo.edu.co', estIdx: 3, plIdx: 0, estado: 'revocado', emision: '2024-01-10', expiracion: null,         withBlockchain: false, motivoRevocacion: 'SOLICITUD_INSTITUCION' },
  { codigoUnico: 'CERT-CAD-2025-0001', dominio: 'corpdemo.edu.co', estIdx: 0, plIdx: 2, estado: 'vigente',  emision: '2025-03-05', expiracion: '2027-03-05', withBlockchain: false },
]

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n================================================')
  console.log('  CertiValidate — seed completo')
  console.log('================================================\n')

  // ────────────────────────────────────────────────────────────────────────────
  // 1. ROLES
  // ────────────────────────────────────────────────────────────────────────────
  console.log('1. Roles...')
  const rolesCreados = {}
  for (const rol of ROLES) {
    const r = await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: { descripcion: rol.descripcion },
      create: rol,
    })
    rolesCreados[r.nombre] = r.id
    console.log(`   ✓ ${r.nombre}`)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 2. PERMISOS
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n2. Permisos...')
  const permisosCreados = {}
  for (const permiso of PERMISOS) {
    const p = await prisma.permiso.upsert({
      where: { recurso_accion: { recurso: permiso.recurso, accion: permiso.accion } },
      update: {},
      create: permiso,
    })
    permisosCreados[`${p.recurso}:${p.accion}`] = p.id
  }
  console.log(`   ✓ ${PERMISOS.length} permisos sincronizados`)

  // ────────────────────────────────────────────────────────────────────────────
  // 3. ROL-PERMISO
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n3. Asignaciones rol → permiso...')
  for (const [rolNombre, permisoKeys] of Object.entries(PERMISOS_POR_ROL)) {
    const rolId = rolesCreados[rolNombre]
    for (const key of permisoKeys) {
      const permisoId = permisosCreados[key]
      await prisma.rolPermiso.upsert({
        where: { rol_id_permiso_id: { rol_id: rolId, permiso_id: permisoId } },
        update: {},
        create: { rol_id: rolId, permiso_id: permisoId },
      })
    }
    console.log(`   ✓ ${rolNombre}: ${permisoKeys.length} permisos`)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4. INSTITUCIÓN BASE + USUARIOS DEMO
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n4. Institución base y usuarios demo...')
  let institucionBase = await prisma.institucion.findFirst({ where: { dominio: DEMO_INSTITUCION.dominio } })
  if (!institucionBase) {
    institucionBase = await prisma.institucion.create({ data: DEMO_INSTITUCION })
    console.log(`   + Institución creada: ${institucionBase.nombre}`)
  } else {
    console.log(`   · Institución existente: ${institucionBase.nombre}`)
  }

  for (const demoUser of DEMO_USUARIOS) {
    const rolId = rolesCreados[demoUser.rol]

    let usuario = await prisma.usuario.findUnique({ where: { email: demoUser.email } })
    if (!usuario) {
      const passwordHash = await bcrypt.hash(demoUser.password, 12)
      usuario = await prisma.usuario.create({
        data: {
          email: demoUser.email,
          nombre: demoUser.nombre,
          apellido: demoUser.apellido,
          password_hash: passwordHash,
          activo: true,
          email_verificado: demoUser.email_verificado,
          es_platform_admin: demoUser.es_platform_admin,
        },
      })
      console.log(`   + Usuario creado: ${usuario.email}`)
    } else {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { activo: true, email_verificado: true, es_platform_admin: demoUser.es_platform_admin, deleted_at: null },
      })
      console.log(`   · Usuario existente: ${usuario.email}`)
    }

    const relExistente = await prisma.usuarioInstitucion.findUnique({
      where: { usuario_id_institucion_id: { usuario_id: usuario.id, institucion_id: institucionBase.id } },
    })
    if (!relExistente) {
      await prisma.usuarioInstitucion.create({
        data: { usuario_id: usuario.id, institucion_id: institucionBase.id, rol_id: rolId },
      })
      console.log(`     → Relación creada: ${demoUser.email} | ${demoUser.rol}`)
    } else if (relExistente.rol_id !== rolId) {
      await prisma.usuarioInstitucion.update({
        where: { id: relExistente.id },
        data: { rol_id: rolId },
      })
      console.log(`     → Rol actualizado: ${demoUser.email} | ${demoUser.rol}`)
    } else {
      console.log(`     → Relación ya existente: ${demoUser.email} | ${demoUser.rol}`)
    }
  }

  // Obtener el admin para las revocaciones
  const adminUser = await prisma.usuario.findUnique({ where: { email: 'admin@certivalidate.com' } })

  // ────────────────────────────────────────────────────────────────────────────
  // 5. INSTITUCIONES DEMO
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n5. Instituciones demo...')
  const instMap = {}

  for (const inst of INSTITUCIONES_DEMO) {
    let record = await prisma.institucion.findFirst({ where: { dominio: inst.dominio } })
    if (!record) {
      record = await prisma.institucion.create({ data: inst })
      console.log(`   + Creada:    ${record.nombre}`)
    } else {
      console.log(`   · Existente: ${record.nombre}`)
    }
    instMap[inst.dominio] = record
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 6. INTEGRACIONES
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n6. Integraciones REST...')

  for (const [dominio, intData] of Object.entries(INTEGRACIONES_DEMO)) {
    const inst = instMap[dominio]
    if (!inst) continue
    const encryptedKey = tryEncrypt(intData.api_key)
    await prisma.integracion.upsert({
      where: { institucion_id: inst.id },
      update: { tipo: intData.tipo, url_base: intData.url_base, api_key: encryptedKey, activa: intData.activa },
      create: { institucion_id: inst.id, tipo: intData.tipo, url_base: intData.url_base, api_key: encryptedKey, activa: intData.activa },
    })
    console.log(`   ✓ ${inst.nombre}  →  ${intData.url_base}`)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 7. ESTUDIANTES
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n7. Estudiantes...')
  const estMap = {}

  for (const [dominio, lista] of Object.entries(ESTUDIANTES_DEMO)) {
    const inst = instMap[dominio]
    if (!inst) continue
    estMap[dominio] = []
    for (const est of lista) {
      const record = await prisma.estudiante.upsert({
        where: { institucion_id_documento: { institucion_id: inst.id, documento: est.documento } },
        update: { nombre: est.nombre, apellido: est.apellido, email: est.email },
        create: { ...est, institucion_id: inst.id },
      })
      estMap[dominio].push(record)
    }
    console.log(`   ✓ ${inst.nombre}  →  ${lista.length} estudiantes`)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 8. PLANTILLAS
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n8. Plantillas...')
  const plantMap = {}

  for (const { dominio } of INSTITUCIONES_DEMO) {
    const inst = instMap[dominio]
    if (!inst) continue
    plantMap[dominio] = []
    for (const pl of PLANTILLAS_DEF) {
      let record = await prisma.plantillaCertificado.findFirst({
        where: { institucion_id: inst.id, nombre: pl.nombre },
      })
      if (!record) {
        record = await prisma.plantillaCertificado.create({ data: { ...pl, institucion_id: inst.id } })
      }
      plantMap[dominio].push(record)
    }
    console.log(`   ✓ ${inst.nombre}  →  ${PLANTILLAS_DEF.length} plantillas`)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 9. CERTIFICADOS + BLOCKCHAIN
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n9. Certificados y registros blockchain...')

  for (const spec of CERTIFICADOS_DEMO) {
    const { codigoUnico, dominio, estIdx, plIdx, estado, emision, expiracion, withBlockchain, motivoRevocacion } = spec

    const inst = instMap[dominio]
    const estudiantes = estMap[dominio] || []
    const plantillas = plantMap[dominio] || []
    if (!inst || !estudiantes.length || !plantillas.length) continue

    const estudiante = estudiantes[estIdx % estudiantes.length]
    const plantilla = plantillas[plIdx % plantillas.length]
    const fechaEmision = new Date(emision)
    const fechaExpiracion = expiracion ? new Date(expiracion) : null

    let cert = await prisma.certificado.findUnique({ where: { codigo_unico: codigoUnico } })

    if (!cert) {
      // Paso 1: crear sin hash para obtener cert.id
      cert = await prisma.certificado.create({
        data: {
          codigo_unico: codigoUnico,
          estudiante_id: estudiante.id,
          institucion_id: inst.id,
          plantilla_id: plantilla.id,
          estado,
          fecha_emision: fechaEmision,
          fecha_expiracion: fechaExpiracion,
        },
      })
      // Paso 2: calcular hash con cert.id (idéntico a blockchain.service.js)
      const hash = generateCertHash(cert)
      cert = await prisma.certificado.update({ where: { id: cert.id }, data: { hash_sha256: hash } })
      console.log(`   + [${estado.padEnd(8)}] ${codigoUnico}`)
    } else {
      console.log(`   · [${estado.padEnd(8)}] ${codigoUnico}  (existente)`)
    }

    // Revocación
    if (estado === 'revocado' && adminUser) {
      const revExistente = await prisma.revocacion.findFirst({ where: { certificado_id: cert.id } })
      if (!revExistente) {
        await prisma.revocacion.create({
          data: {
            certificado_id: cert.id,
            revocado_por: adminUser.id,
            motivo_codigo: motivoRevocacion || 'SOLICITUD_INSTITUCION',
            motivo_detalle: 'Revocación de demostración generada por el seed.',
            fecha_revocacion: fechaEmision,
          },
        })
        console.log(`     → Revocación: ${motivoRevocacion || 'SOLICITUD_INSTITUCION'}`)
      }
    }

    // BlockchainTransaccion
    if (withBlockchain) {
      const bcExistente = await prisma.blockchainTransaccion.findFirst({ where: { certificado_id: cert.id } })
      if (!bcExistente) {
        const hash = cert.hash_sha256 || generateCertHash(cert)
        const txHash = mockTxHash(hash)
        await prisma.blockchainTransaccion.create({
          data: {
            certificado_id: cert.id,
            hash,
            tx_hash: txHash,
            red: 'polygon-amoy-mock',
            estado: 'confirmado',
            intentos: 1,
            confirmado_en: new Date(fechaEmision.getTime() + 5 * 60 * 1000),
          },
        })
        console.log(`     → BC: ${txHash.substring(0, 44)}...`)
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RESUMEN
  // ────────────────────────────────────────────────────────────────────────────
  const totalEstudiantes = Object.values(ESTUDIANTES_DEMO).flat().length
  const totalPlantillas = PLANTILLAS_DEF.length * INSTITUCIONES_DEMO.length
  const conBC = CERTIFICADOS_DEMO.filter((c) => c.withBlockchain).length
  const sinBC = CERTIFICADOS_DEMO.filter((c) => !c.withBlockchain).length

  console.log('\n================================================')
  console.log('  Seed completado')
  console.log('================================================')
  console.log('\nUsuarios demo:')
  console.log('  admin@certivalidate.com   → admin   → Admin1234!')
  console.log('  emisor@certivalidate.com  → editor  → Emisor1234!')
  console.log('  lector@certivalidate.com  → lector  → Lector1234!')
  console.log('\nDatos demo:')
  console.log(`  Instituciones:  ${INSTITUCIONES_DEMO.length}  (+ 1 institución base)`)
  console.log(`  Integraciones:  ${INSTITUCIONES_DEMO.length}  (REST, api_key cifrada)`)
  console.log(`  Estudiantes:    ${totalEstudiantes}`)
  console.log(`  Plantillas:     ${totalPlantillas}  (${PLANTILLAS_DEF.length} tipos × ${INSTITUCIONES_DEMO.length} instituciones)`)
  console.log(`  Certificados:   ${CERTIFICADOS_DEMO.length}  (vigente / expirado / revocado)`)
  console.log(`  Blockchain:     ${conBC} confirmados  |  ${sinBC} pendientes`)
  console.log()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
