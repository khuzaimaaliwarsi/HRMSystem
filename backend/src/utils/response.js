/**
 * iSysware HRMS — Standard API Response Formatter
 * Enforces consistent API payload structure across all endpoints.
 * 
 * Success payload:
 * {
 *   success: true,
 *   data: <payload>,
 *   meta: { timestamp, ... } (optional)
 * }
 * 
 * Error payload:
 * {
 *   success: false,
 *   error: {
 *     code: 'ERROR_CODE',
 *     message: 'Human-readable message',
 *     details: <optional object or array>
 *   }
 * }
 */

/**
 * Send a standardized success JSON response.
 * @param {import('express').Response} res - Express response object
 * @param {*} data - Payload data
 * @param {object} [meta] - Optional metadata (pagination, filters, timestamps)
 * @param {number} [statusCode=200] - HTTP status code
 */
export function sendSuccess(res, data = null, meta = undefined, statusCode = 200) {
  const payload = {
    success: true,
    data
  }

  if (meta !== undefined) {
    payload.meta = meta
  }

  return res.status(statusCode).json(payload)
}

/**
 * Send a standardized error JSON response.
 * @param {import('express').Response} res - Express response object
 * @param {string} message - Human-readable error message
 * @param {string} [code='INTERNAL_ERROR'] - Machine-readable error code
 * @param {*} [details=null] - Additional error details (field errors, validation arrays)
 * @param {number} [statusCode=500] - HTTP status code
 */
export function sendError(
  res,
  message = 'An unexpected internal error occurred.',
  code = 'INTERNAL_ERROR',
  details = null,
  statusCode = 500
) {
  const payload = {
    success: false,
    error: {
      code,
      message
    }
  }

  if (details !== null && details !== undefined) {
    payload.error.details = details
  }

  return res.status(statusCode).json(payload)
}

