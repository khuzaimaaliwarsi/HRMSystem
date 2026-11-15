/**
 * iSysware HRMS — Backend Environment Configuration & Validation
 * Centralized, validated environment configuration using safe fallbacks.
 * Prevents application startup with invalid configurations.
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Explicitly load .env from backend root without overriding caller-supplied env vars
// (so NODE_ENV=test and isolated TEST_DATABASE_URL / DATABASE_URL are always respected).
const envPath = path.resolve(__dirname, '../../.env')
dotenv.config({ path: envPath, override: false })

function resolveEffectiveDatabaseUrl(nodeEnv) {
  const explicitDbUrl = process.env.DATABASE_URL || ''
  const isTestCtx =
    nodeEnv === 'test' || Boolean(process.env.NODE_TEST_CONTEXT)

  if (!isTestCtx) {
    return explicitDbUrl
  }

  // In test runs, NEVER silently target the main development DB unless explicitly allowed.
  let testDbUrl = process.env.TEST_DATABASE_URL || ''
  if (!testDbUrl && explicitDbUrl) {
    try {
      const parsed = new URL(explicitDbUrl)
      if (parsed.pathname === '/aliyan_hrms_dev' || parsed.pathname.endsWith('_dev')) {
        parsed.pathname = parsed.pathname.replace(/_dev$/, '_test')
        testDbUrl = parsed.toString()
      } else {
        testDbUrl = explicitDbUrl
      }
    } catch {
      testDbUrl = explicitDbUrl
    }
  }

  const effective = testDbUrl || explicitDbUrl
  if (effective && process.env.ALLOW_DEV_DB_FOR_TESTS !== 'true') {
    try {
      const parsed = new URL(effective)
      if (parsed.pathname === '/aliyan_hrms_dev') {
        throw new Error(
          'SAFETY BLOCK: Automated tests attempted to connect to development database "aliyan_hrms_dev". Configure TEST_DATABASE_URL.'
        )
      }
    } catch (err) {
      if (err.message.includes('SAFETY BLOCK')) throw err
    }
  }

  if (effective) {
    process.env.DATABASE_URL = effective
  }
  return effective
}

/**
 * Validates and sanitizes environment variables.
 * @returns {object} validated config object
 */
export function validateEnv() {
  const nodeEnv =
    process.env.NODE_ENV || (process.env.NODE_TEST_CONTEXT ? 'test' : 'development')
  if (process.env.NODE_TEST_CONTEXT && !process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test'
  }
  const port = parseInt(process.env.PORT || '5000', 10)
  const apiVersion = process.env.API_VERSION || 'v1'
  const dbUrl = resolveEffectiveDatabaseUrl(nodeEnv)
  const dbTimeoutMs = parseInt(process.env.DATABASE_TIMEOUT_MS || '5000', 10)

  // Authentication & Security Settings
  const jwtSecret = process.env.JWT_SECRET || 'isysware_hrms_enterprise_jwt_secret_dev_key_2026'
  const jwtAccessExpiry = process.env.JWT_ACCESS_EXPIRY || '15m'
  const refreshTokenExpiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10)
  const cookieSecret = process.env.COOKIE_SECRET || 'isysware_hrms_cookie_secret_dev_2026'

  // Protected Super Admin Bootstrap Defaults
  const bootstrapAdminUsername = process.env.BOOTSTRAP_ADMIN_USERNAME || 'superadmin'
  const bootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || 'superadmin@isysware.com'
  const bootstrapAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin123456!'

  const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000'
  const corsOrigins = corsOriginRaw.split(',').map((origin) => origin.trim()).filter(Boolean)

  const warnings = []
  const errors = []

  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT configured: '${process.env.PORT}'. Must be between 1 and 65535.`)
  }

  if (!dbUrl) {
    warnings.push('DATABASE_URL is not set. Database features will be unavailable.')
  } else if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    warnings.push(`DATABASE_URL does not use a standard postgresql:// prefix: '${dbUrl.slice(0, 15)}...'`)
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    isTest: nodeEnv === 'test',
    port: isNaN(port) ? 5000 : port,
    apiVersion,
    apiPrefix: `/api/${apiVersion}`,
    corsOrigins,
    databaseUrl: dbUrl,
    databaseTimeoutMs: isNaN(dbTimeoutMs) ? 5000 : dbTimeoutMs,
    jwtSecret,
    jwtAccessExpiry,
    refreshTokenExpiryDays: isNaN(refreshTokenExpiryDays) ? 7 : refreshTokenExpiryDays,
    cookieSecret,
    bootstrapAdmin: {
      username: bootstrapAdminUsername,
      email: bootstrapAdminEmail,
      password: bootstrapAdminPassword
    },
    warnings,
    errors,
    isValid: errors.length === 0
  }
}

export const env = validateEnv()
export default env

