const express = require('express')
const router = express.Router()

const validarApiKey = require('../middlewares/apiKey.middleware')
const plantillasController = require('../controllers/plantillas.controller')

router.get('/', validarApiKey, plantillasController.listar)
router.get('/:id', validarApiKey, plantillasController.buscarPorId)

module.exports = router
