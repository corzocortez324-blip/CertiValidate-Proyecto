const express = require('express')
const router = express.Router()

const validarApiKey = require('../middlewares/apiKey.middleware')
const estudiantesController = require('../controllers/estudiantes.controller')

router.get('/', validarApiKey, estudiantesController.listar)

router.get(
  '/:documento',
  validarApiKey,
  estudiantesController.buscarPorDocumento,
)

module.exports = router