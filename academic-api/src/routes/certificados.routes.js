const express = require('express')
const router = express.Router()

const validarApiKey = require('../middlewares/apiKey.middleware')
const certificadosController = require('../controllers/certificados.controller')

router.get('/', validarApiKey, certificadosController.listar)

router.get('/:codigo', validarApiKey, certificadosController.buscarPorCodigo)

module.exports = router