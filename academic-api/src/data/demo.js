const DEMO_ESTUDIANTES = [
  {
    documento: '1002003000',
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'juan.perez@demo.edu.co',
    programa: 'Ingeniería de Sistemas',
    estado: 'GRADUADO',
  },
  {
    documento: '1055443322',
    nombre: 'María',
    apellido: 'González',
    email: 'maria.gonzalez@demo.edu.co',
    programa: 'Administración de Empresas',
    estado: 'ACTIVO',
  },
  {
    documento: '1098765432',
    nombre: 'Carlos',
    apellido: 'Rodríguez',
    email: 'carlos.rodriguez@demo.edu.co',
    programa: 'Contaduría Pública',
    estado: 'GRADUADO',
  },
]

const DEMO_CERTIFICADOS = [
  {
    codigo: 'CERT-DEMO-001',
    estudiante_documento: '1002003000',
    estudiante_nombre: 'Juan Pérez',
    curso: 'Certificado de Grado - Ingeniería de Sistemas',
    fecha_emision: '2025-06-01T00:00:00.000Z',
    estado: 'DISPONIBLE',
    plantilla_id: 'tpl-001',
  },
  {
    codigo: 'CERT-DEMO-002',
    estudiante_documento: '1002003000',
    estudiante_nombre: 'Juan Pérez',
    curso: 'Curso Backend Avanzado con Node.js',
    fecha_emision: '2025-08-15T00:00:00.000Z',
    estado: 'DISPONIBLE',
    plantilla_id: 'tpl-001',
  },
  {
    codigo: 'CERT-DEMO-003',
    estudiante_documento: '1055443322',
    estudiante_nombre: 'María González',
    curso: 'Diplomado en Gestión de Proyectos',
    fecha_emision: '2025-09-20T00:00:00.000Z',
    estado: 'DISPONIBLE',
    plantilla_id: 'tpl-001',
  },
  {
    codigo: 'CERT-DEMO-004',
    estudiante_documento: '1098765432',
    estudiante_nombre: 'Carlos Rodríguez',
    curso: 'Certificado de Grado - Contaduría Pública',
    fecha_emision: '2025-05-10T00:00:00.000Z',
    estado: 'DISPONIBLE',
    plantilla_id: 'tpl-001',
  },
  {
    codigo: 'CERT-DEMO-005',
    estudiante_documento: '1098765432',
    estudiante_nombre: 'Carlos Rodríguez',
    curso: 'Curso de Tributación Avanzada',
    fecha_emision: '2025-07-01T00:00:00.000Z',
    estado: 'DISPONIBLE',
    plantilla_id: 'tpl-001',
  },
  {
    codigo: 'CERT-DEMO-006',
    estudiante_documento: '1098765432',
    estudiante_nombre: 'Carlos Rodríguez',
    curso: 'Curso de Auditoría Financiera',
    fecha_emision: '2025-10-05T00:00:00.000Z',
    estado: 'DISPONIBLE',
    plantilla_id: 'tpl-001',
  },
]

const DEMO_PLANTILLAS = [
  {
    id: 'tpl-001',
    nombre: 'Certificado de Curso Aprobado',
    descripcion: 'Plantilla académica estándar',
    template_html: '<h1>{{nombre}}</h1><p>Certificado en {{curso}}</p>',
    variables: ['nombre', 'curso', 'fecha_emision', 'codigo_verificacion'],
    activa: true,
  },
  {
    id: 'tpl-002',
    nombre: 'Certificado de Grado',
    descripcion: 'Plantilla para certificados de graduación',
    template_html:
      '<h1>{{nombre}}</h1><p>Certifica haber completado el programa de {{programa}}</p><p>Fecha: {{fecha_emision}}</p>',
    variables: ['nombre', 'programa', 'fecha_emision', 'codigo_verificacion'],
    activa: true,
  },
  {
    id: 'tpl-003',
    nombre: 'Certificado de Diplomado',
    descripcion: 'Plantilla para diplomados y cursos de extensión',
    template_html:
      '<h1>{{nombre}}</h1><p>Ha completado el diplomado: {{curso}} con {{horas}} horas académicas</p>',
    variables: ['nombre', 'curso', 'horas', 'fecha_emision', 'codigo_verificacion'],
    activa: true,
  },
]

module.exports = { DEMO_ESTUDIANTES, DEMO_CERTIFICADOS, DEMO_PLANTILLAS }
