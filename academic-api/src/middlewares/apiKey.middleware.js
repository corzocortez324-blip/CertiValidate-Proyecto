function validarApiKey(req, res, next) {
  const apiKey = req.header('x-api-key')

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'API Key inválida o ausente',
    })
  }

  next()
}

module.exports = validarApiKey