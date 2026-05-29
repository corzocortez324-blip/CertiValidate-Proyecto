function validarApiKey(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production'
  const expectedKey = process.env.ACADEMIC_API_KEY
  const providedKey = req.headers['x-api-key']

  if (providedKey && expectedKey && providedKey === expectedKey) {
    req.log.info({ authMode: 'api-key' }, 'Autorizado por API Key')
    return next()
  }

  if (!isProduction) {
    req.log.info({ authMode: 'demo' }, 'Autorizado por modo demo/desarrollo')
    return next()
  }

  return res.status(401).json({
    success: false,
    message: 'API Key inválida o ausente',
  })
}

module.exports = validarApiKey
