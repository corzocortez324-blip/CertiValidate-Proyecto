function validarApiKey(req, res, next) {
  const configuredKey = process.env.API_KEY

  // Demo mode: if no API_KEY is configured, allow all requests through
  if (!configuredKey) {
    return next()
  }

  const apiKey = req.header('x-api-key')

  if (!apiKey || apiKey !== configuredKey) {
    return res.status(401).json({
      success: false,
      message: 'API Key inválida o ausente',
    })
  }

  next()
}

module.exports = validarApiKey