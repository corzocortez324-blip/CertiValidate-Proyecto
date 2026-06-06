const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const pinoHttp = require('pino-http')

const estudiantesRoutes = require('./routes/estudiantes.routes')
const certificadosRoutes = require('./routes/certificados.routes')
const plantillasRoutes = require('./routes/plantillas.routes')
const cursosRoutes = require('./routes/cursos.routes')
const firmantesRoutes = require('./routes/firmantes.routes')

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  }),
)
app.use(express.json())
app.use(pinoHttp())

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'academic-api',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
  })
})

app.use('/api/estudiantes', estudiantesRoutes)
app.use('/api/certificados', certificadosRoutes)
app.use('/api/plantillas', plantillasRoutes)
app.use('/api/cursos', cursosRoutes)
app.use('/api/firmantes', firmantesRoutes)

module.exports = app
