const express = require('express')
const router = express.Router()

const validarApiKey = require('../middlewares/apiKey.middleware')
const certificadosController = require('../controllers/certificados.controller')

router.get('/', validarApiKey, certificadosController.listar)

module.exports = router