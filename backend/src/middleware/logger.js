/**
 * iSysware HRMS — Request Logger Middleware
 * Integrates morgan with sensible formatting per environment.
 * Skips logging in test environment.
 */

import morgan from 'morgan'
import env from '../config/env.js'

export const requestLogger = morgan(
  env.isProduction ? 'combined' : ':method :url :status :res[content-length] - :response-time ms',
  {
    skip: () => env.isTest
  }
)

export default requestLogger

