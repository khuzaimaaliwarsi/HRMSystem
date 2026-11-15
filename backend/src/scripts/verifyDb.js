#!/usr/bin/env node
/**
 * iSysware HRMS — PostgreSQL Connectivity Verification CLI
 * Run with: npm run db:verify (or node src/scripts/verifyDb.js)
 */

import { verifyDatabaseConnection, disconnectDatabase } from '../config/database.js'
import env from '../config/env.js'

async function main() {
  console.log('='.repeat(60))
  console.log('  iSysware HRMS — PostgreSQL Database Connectivity Test')
  console.log('='.repeat(60))
  console.log(`Environment : ${env.nodeEnv}`)
  console.log(`Target DB   : aliyan_hrms_dev`)
  console.log(`Checking connection (timeout: ${env.databaseTimeoutMs}ms)...`)
  console.log('-'.repeat(60))

  const status = await verifyDatabaseConnection()

  if (status.connected) {
    console.log('Status      : [SUCCESS] Connected to PostgreSQL')
    console.log(`Engine      : ${status.version}`)
    console.log(`Latency     : ${status.latencyMs} ms`)
    console.log(`Host        : ${status.details.host}:${status.details.port}`)
    console.log(`Database    : ${status.details.database}`)
    console.log('='.repeat(60))
    console.log('Database verification passed. Ready for Batch 2 schema migrations.')
    await disconnectDatabase()
    process.exit(0)
  } else {
    console.warn('Status      : [DEGRADED] Database is unreachable or requires configuration')
    console.warn(`Host        : ${status.details.host}:${status.details.port}`)
    console.warn(`Database    : ${status.details.database}`)
    console.warn(`Diagnostic  : ${status.error}`)
    console.log('-'.repeat(60))
    console.log('NOTE: The backend Express API will still operate in DEGRADED mode.')
    console.log('To connect to your local PostgreSQL 18 instance:')
    console.log('1. Verify your PostgreSQL password in pgAdmin 4.')
    console.log('2. Update DATABASE_URL in backend/.env:')
    console.log('   DATABASE_URL="postgresql://<user>:<password>@localhost:5432/aliyan_hrms_dev?schema=public"')
    console.log('3. Ensure the database "aliyan_hrms_dev" has been created.')
    console.log('='.repeat(60))
    await disconnectDatabase()
    process.exit(1)
  }
}

main().catch(async (err) => {
  console.error('Fatal CLI Error:', err.message)
  await disconnectDatabase()
  process.exit(1)
})

