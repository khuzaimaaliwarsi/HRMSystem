/**
 * iSysware HRMS — Health & System Diagnostics Routes
 * Provides liveness, readiness and database connectivity checks.
 */

import { Router } from 'express'
import { verifyDatabaseConnection } from '../config/database.js'
import { sendSuccess } from '../utils/response.js'
import env from '../config/env.js'

const router = Router()
const processStartTime = Date.now()

/**
 * GET /api/v1/health
 * Primary system health-check. Always returns 200 with status: 'ok' or 'degraded'.
 */
router.get('/', async (_req, res, next) => {
  try {
    const dbStatus = await verifyDatabaseConnection()
    const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000)

    const healthData = {
      status: dbStatus.connected ? 'ok' : 'degraded',
      service: 'isysware-hrms-backend',
      version: '1.0.0',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptimeSeconds,
        formatted: `${Math.floor(uptimeSeconds / 60)}m ${uptimeSeconds % 60}s`
      },
      database: {
        connected: dbStatus.connected,
        latencyMs: dbStatus.latencyMs,
        engine: dbStatus.version,
        target: `${dbStatus.details.host}:${dbStatus.details.port}/${dbStatus.details.database}`,
        message: dbStatus.connected ? 'Database operational' : dbStatus.error
      }
    }

    return sendSuccess(res, healthData, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/health/db
 * Dedicated database connectivity probe.
 */
router.get('/db', async (_req, res, next) => {
  try {
    const dbStatus = await verifyDatabaseConnection()
    const payload = {
      connected: dbStatus.connected,
      latencyMs: dbStatus.latencyMs,
      engine: dbStatus.version,
      details: dbStatus.details,
      error: dbStatus.error
    }
    return sendSuccess(res, payload, undefined, dbStatus.connected ? 200 : 503)
  } catch (err) {
    next(err)
  }
})

export default router

