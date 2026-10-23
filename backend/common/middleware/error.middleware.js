import { randomUUID } from 'node:crypto'
import { ApiError } from '../utils/ApiError.js'

export function notFound(request, _response, next) {
  next(
    new ApiError(
      404,
      `Route ${request.method} ${request.originalUrl} was not found.`,
    ),
  )
}

export function errorHandler(error, request, response, next) {
  const statusCode = Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
    ? error.statusCode
    : 500

  if (statusCode >= 500) {
    const requestId = randomUUID()
    console.error(JSON.stringify({
      event: 'api_error',
      timestamp: new Date().toISOString(),
      requestId,
      statusCode,
      method: request.method,
      path: request.path,
      error: {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        code: error?.code,
        stack: error?.stack,
      },
    }))
    if (response.headersSent) return next(error)
    response.set('X-Request-ID', requestId)
    const message = statusCode === 500
      ? `Internal server error. Reference: ${requestId}`
      : error.message
    return response.status(statusCode).json({ message, requestId })
  }

  if (response.headersSent) return next(error)
  return response.status(statusCode).json({ message: error.message })
}
