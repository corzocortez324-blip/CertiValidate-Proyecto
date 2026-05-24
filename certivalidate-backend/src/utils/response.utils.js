const sendSuccess = (
  res,
  data,
  message = 'Operación exitosa',
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}

const sendError = (
  res,
  message = 'Error interno del servidor',
  statusCode = 500,
  errors = null,
) => {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(errors && { errors }),
    timestamp: new Date().toISOString(),
  })
}

module.exports = { sendSuccess, sendError }
