const express = require('express')
const router = express.Router()

const validarApiKey = require('../middlewares/apiKey.middleware')
const firmantesController = require('../controllers/firmantes.controller')

router.get('/', validarApiKey, firmantesController.listar)
router.get('/:id', validarApiKey, firmantesController.buscarPorId)

module.exports = router
