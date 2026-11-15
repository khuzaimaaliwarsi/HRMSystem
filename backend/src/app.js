/**
 * iSysware HRMS — Express Application Factory
 * Configures middleware, security, CORS, routes and centralized error handlers.
 * Exported as a standalone module without calling listen(), enabling:
 * - Integration testing with Supertest
 * - Serverless deployment (e.g. Vercel)
 * - Local server execution via server.js
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'

import env from './config/env.js'
import requestLogger from './middleware/logger.js'
import notFoundHandler from './middleware/notFound.js'
import errorHandler from './middleware/errorHandler.js'
import apiRouter from './routes/index.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)

  // Security Headers via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: env.isProduction ? undefined : false
    })
  )

  // Safe CORS Configuration
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true)

      // In development or test, allow localhost origins
      if (!env.isProduction) {
        if (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
          return callback(null, true)
        }
      }

      if (env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
        return callback(null, true)
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  }

  app.use(cors(corsOptions))

  // Request Body Parsers & Cookie Parser
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))
  app.use(cookieParser(env.cookieSecret))

  // Request Logging
  app.use(requestLogger)

  // Root redirect/status
  app.get('/', (_req, res) => {
    res.json({
      name: 'iSysware HRMS Backend API',
      version: '1.0.0',
      apiDocs: `${env.apiPrefix}/health`,
      status: 'active'
    })
  })

  // Primary API Router (/api/v1)
  app.use(env.apiPrefix, apiRouter)

  // 404 Handler for undefined routes
  app.use(notFoundHandler)

  // Centralized Error Handler
  app.use(errorHandler)

  return app
}

export const app = createApp()
export default app

