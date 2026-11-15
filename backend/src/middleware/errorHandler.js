/**
 * iSysware HRMS — Centralized Express Error Handler
 * Standardizes error responses across all controllers and catches unhandled exceptions.
 * Never leaks raw stack traces or internal secrets in production.
 */

import { sendError } from '../utils/response.js'
import env from '../config/env.js'

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.status = statusCode
    this.code = code
    this.details = details
  }
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err.status || err.statusCode || 500
  const isProd = env.isProduction

  // Default error message and code
  let message = err.message || 'An unexpected internal error occurred.'
  let code = err.code || 'INTERNAL_SERVER_ERROR'
  let details = err.details || null

  // Prisma specific error code mapping
  if (err.name === 'PrismaClientInitializationError') {
    code = 'DATABASE_CONNECTION_ERROR'
    message = 'Unable to establish connection to PostgreSQL database.'
    details = isProd ? null : err.message
  } else if (err.name === 'PrismaClientKnownRequestError') {
    code = `PRISMA_${err.code}`
    message = isProd ? 'A database operation failed.' : err.message
    details = isProd ? null : err.meta
  } else if (err.name === 'ValidationError' || err.name === 'CastError') {
    code = 'VALIDATION_ERROR'
    message = err.message
  }

  // In production, mask unexpected 500 server errors
  if (statusCode === 500 && isProd) {
    message = 'Internal Server Error'
    details = null
  } else if (!isProd && !details && err.stack) {
    details = { stack: err.stack.split('\n').slice(0, 4).map(s => s.trim()) }
  }

  return sendError(res, message, code, details, statusCode)
}

export default errorHandler

