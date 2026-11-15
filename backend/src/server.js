/**
 * iSysware HRMS — Local Development & Standalone Server Entry
 * Boots the Express application and listens on the configured port.
 * Implements graceful shutdown for active database connections.
 */

import app from './app.js'
import env from './config/env.js'
import { verifyDatabaseConnection, disconnectDatabase } from './config/database.js'

const server = app.listen(env.port, async () => {
  console.log('='.repeat(65))
  console.log(`  iSysware HRMS — Backend API Server Started`)
  console.log('='.repeat(65))
  console.log(`  Local URL    : http://localhost:${env.port}`)
  console.log(`  Health API   : http://localhost:${env.port}${env.apiPrefix}/health`)
  console.log(`  Environment  : ${env.nodeEnv}`)
  console.log(`  Target DB    : aliyan_hrms_dev (PostgreSQL 18)`)
  console.log('-'.repeat(65))

  // Non-blocking connection check on startup
  const dbStatus = await verifyDatabaseConnection()
  if (dbStatus.connected) {
    console.log(`  Database     : [OK] Connected (${dbStatus.latencyMs}ms) - ${dbStatus.version}`)
  } else {
    console.warn(`  Database     : [DEGRADED] ${dbStatus.error}`)
    console.warn(`  Notice       : Backend is operational. Database-dependent endpoints will report degraded.`)
  }
  console.log('='.repeat(65))
})

// Graceful Shutdown Handling
async function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down HRMS backend server...`)
  server.close(async () => {
    console.log('HTTP server closed.')
    await disconnectDatabase()
    console.log('Database connections closed.')
    process.exit(0)
  })

  // Force shutdown after 10s timeout
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))

export default server

