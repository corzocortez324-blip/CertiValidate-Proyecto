const crypto = require('crypto')

const requestId = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID()
  res.setHeader('X-Request-ID', req.requestId)
  next()
}

module.exports = requestId
