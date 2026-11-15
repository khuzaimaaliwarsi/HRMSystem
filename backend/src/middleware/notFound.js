/**
 * iSysware HRMS — 404 Not Found Middleware
 * Intercepts requests that do not match any registered route and returns standard JSON error.
 */

import { sendError } from '../utils/response.js'

export function notFoundHandler(req, res, _next) {
  return sendError(
    res,
    `Route not found: ${req.method} ${req.originalUrl}`,
    'NOT_FOUND',
    null,
    404
  )
}

export default notFoundHandler

