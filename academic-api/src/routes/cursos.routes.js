const express = require('express')
const router = express.Router()

const validarApiKey = require('../middlewares/apiKey.middleware')
const cursosController = require('../controllers/cursos.controller')

router.get('/', validarApiKey, cursosController.listar)
router.get('/:id', validarApiKey, cursosController.buscarPorId)

module.exports = router
