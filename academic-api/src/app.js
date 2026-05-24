const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const pinoHttp = require('pino-http')

const estudiantesRoutes = require('./routes/estudiantes.routes')
const certificadosRoutes = require('./routes/certificados.routes')

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(pinoHttp())

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Academic API funcionando correctamente',
  })
})

app.use('/api/estudiantes', estudiantesRoutes)
app.use('/api/certificados', certificadosRoutes)

module.exports = app