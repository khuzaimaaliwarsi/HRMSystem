/**
 * iSysware HRMS — Database Client & Connection Manager
 * Manages PrismaClient singleton and database health checks for PostgreSQL 18.
 * Provides graceful degraded state detection if PostgreSQL is not reachable.
 */

import { PrismaClient } from '@prisma/client'
import env from './env.js'

let prismaInstance = null

/**
 * Returns or creates the singleton PrismaClient instance.
 * @returns {PrismaClient}
 */
export function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: env.isDevelopment ? ['warn', 'error'] : ['error'],
      errorFormat: 'minimal'
    })
  }
  return prismaInstance
}

export const prisma = getPrismaClient()

/**
 * Parses connection details safely without leaking credentials.
 * @param {string} url
 * @returns {object} sanitized database connection details
 */
export function getSanitizedDbDetails(url = env.databaseUrl) {
  try {
    const parsed = new URL(url)
    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.hostname || 'localhost',
      port: parsed.port || '5432',
      database: parsed.pathname.replace(/^\//, '') || 'aliyan_hrms_dev',
      user: parsed.username ? '***configured***' : 'none'
    }
  } catch {
    return {
      protocol: 'postgresql',
      host: 'localhost',
      port: '5432',
      database: 'aliyan_hrms_dev',
      user: 'unknown'
    }
  }
}

/**
 * Verifies live PostgreSQL database connectivity.
 * Uses a non-blocking timeout to prevent server hanging when PostgreSQL is offline.
 * 
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<{
 *   connected: boolean,
 *   latencyMs: number,
 *   version: string|null,
 *   details: object,
 *   error: string|null
 * }>}
 */
export async function verifyDatabaseConnection(timeoutMs = env.databaseTimeoutMs) {
  const details = getSanitizedDbDetails(env.databaseUrl)
  const client = getPrismaClient()
  const startTime = Date.now()

  try {
    // Race database query against a timeout promise
    const probePromise = client.$queryRaw`SELECT 1 as alive, version() as pg_version`
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Database connection timed out after ${timeoutMs}ms`)), timeoutMs)
    )

    const result = await Promise.race([probePromise, timeoutPromise])
    const latencyMs = Date.now() - startTime
    const versionString = Array.isArray(result) && result[0]?.pg_version ? String(result[0].pg_version) : null

    return {
      connected: true,
      latencyMs,
      version: versionString ? versionString.split(' on ')[0] : 'PostgreSQL',
      details,
      error: null
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime
    let errorMessage = err.message || 'Unknown database connection error'

    // Provide friendly diagnostic guidance
    if (errorMessage.includes('password authentication failed')) {
      errorMessage = 'PostgreSQL authentication failed. Check credentials in backend/.env (DATABASE_URL).'
    } else if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
      errorMessage = `Database '${details.database}' does not exist on PostgreSQL server. Please create it in pgAdmin or via psql.`
    } else if (errorMessage.includes("Can't reach database server") || errorMessage.includes('ECONNREFUSED')) {
      errorMessage = `Cannot reach PostgreSQL server at ${details.host}:${details.port}. Ensure the PostgreSQL 18 service is running.`
    }

    return {
      connected: false,
      latencyMs,
      version: null,
      details,
      error: errorMessage
    }
  }
}

/**
 * Gracefully disconnects Prisma on application shutdown.
 */
export async function disconnectDatabase() {
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect()
    } catch {
      // Ignored during shutdown
    }
  }
}

export default prisma

