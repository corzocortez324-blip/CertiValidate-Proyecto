require('dotenv').config()

const request = require('supertest')
const app = require('../src/app')

// Mock Prisma so tests run without a real database
jest.mock('../src/utils/prisma', () => ({
  estudiante: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  certificado: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
}))

const prisma = require('../src/utils/prisma')

const TEST_API_KEY = 'test-key'

beforeAll(() => {
  process.env.API_KEY = TEST_API_KEY
})

afterEach(() => {
  jest.clearAllMocks()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const estudianteDemo = {
  id: 'uuid-estudiante-1',
  documento: '1002003000',
  nombre: 'Juan',
  apellido: 'Pérez',
  email: 'juan.perez@demo.edu.co',
  programa: 'Ingeniería de Sistemas',
  estadoAcademico: 'GRADUADO',
  certificados: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const certificadoDemo = {
  id: 'uuid-cert-1',
  estudianteId: 'uuid-estudiante-1',
  tipo: 'DIPLOMA',
  titulo: 'Certificado de Grado',
  horas: null,
  promedio: 4.5,
  estado: 'DISPONIBLE',
  fechaEmision: new Date().toISOString(),
  estudiante: estudianteDemo,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ── GET /health ───────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok (no auth required)', async () => {
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.service).toBe('academic-api')
    expect(res.body.timestamp).toBeDefined()
  })

  it('returns valid ISO timestamp', async () => {
    const res = await request(app).get('/health')
    expect(() => new Date(res.body.timestamp)).not.toThrow()
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp)
  })
})

// ── GET /api/estudiantes ──────────────────────────────────────────────────────

describe('GET /api/estudiantes', () => {
  it('returns 401 when API key is missing', async () => {
    const res = await request(app).get('/api/estudiantes')
    expect(res.status).toBe(401)
  })

  it('returns 401 when API key is wrong', async () => {
    const res = await request(app)
      .get('/api/estudiantes')
      .set('x-api-key', 'wrong-key')
    expect(res.status).toBe(401)
  })

  it('returns list of estudiantes with valid API key', async () => {
    prisma.estudiante.findMany.mockResolvedValue([estudianteDemo])

    const res = await request(app)
      .get('/api/estudiantes')
      .set('x-api-key', TEST_API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].documento).toBe('1002003000')
  })
})

// ── GET /api/estudiantes/:documento ──────────────────────────────────────────

describe('GET /api/estudiantes/:documento', () => {
  it('returns 401 when API key is missing', async () => {
    const res = await request(app).get('/api/estudiantes/1002003000')
    expect(res.status).toBe(401)
  })

  it('returns the estudiante when found', async () => {
    prisma.estudiante.findFirst.mockResolvedValue(estudianteDemo)

    const res = await request(app)
      .get('/api/estudiantes/1002003000')
      .set('x-api-key', TEST_API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.documento).toBe('1002003000')
    expect(res.body.data.nombre).toBe('Juan')
  })

  it('returns 404 when estudiante is not found', async () => {
    prisma.estudiante.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/estudiantes/9999999999')
      .set('x-api-key', TEST_API_KEY)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})

// ── GET /api/certificados ─────────────────────────────────────────────────────

describe('GET /api/certificados', () => {
  it('returns 401 when API key is missing', async () => {
    const res = await request(app).get('/api/certificados')
    expect(res.status).toBe(401)
  })

  it('returns list of certificados with valid API key', async () => {
    prisma.certificado.findMany.mockResolvedValue([certificadoDemo])

    const res = await request(app)
      .get('/api/certificados')
      .set('x-api-key', TEST_API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data[0].tipo).toBe('DIPLOMA')
  })
})

// ── GET /api/certificados/:codigo ─────────────────────────────────────────────

describe('GET /api/certificados/:codigo', () => {
  it('returns the certificado when found by id', async () => {
    prisma.certificado.findFirst.mockResolvedValue(certificadoDemo)

    const res = await request(app)
      .get('/api/certificados/uuid-cert-1')
      .set('x-api-key', TEST_API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('uuid-cert-1')
  })

  it('returns 404 when certificado is not found', async () => {
    prisma.certificado.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/certificados/no-existe')
      .set('x-api-key', TEST_API_KEY)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})
