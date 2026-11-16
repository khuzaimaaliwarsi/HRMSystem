#!/usr/bin/env node
/**
 * iSysware HRMS — Backend Postinstall Deployment Hook
 * Runs automatically during 'npm install' on local and cloud environments (Vercel).
 * - Always runs 'prisma generate'
 * - When remote DATABASE_URL is present, automatically synchronizes schema via 'prisma db push'
 *   and bootstraps the protected root Super Admin account idempotently.
 */

import { execSync } from 'child_process'

console.log('='.repeat(65))
console.log('  iSysware HRMS — Backend Deployment & Postinstall Hook')
console.log('='.repeat(65))

// 1. Prisma Client Generation
try {
  console.log('[Step 1/3] Generating Prisma ORM Client...')
  execSync('npx prisma generate', { stdio: 'inherit' })
  console.log('[Step 1/3] Prisma Client generated successfully.')
} catch (err) {
  console.error('[Step 1/3] Error generating Prisma Client:', err.message)
  process.exit(1)
}

// 2. Automated Schema Sync for Remote Cloud Databases (e.g. Neon on Vercel)
const dbUrl = process.env.DATABASE_URL || ''
const isCloudDatabase = Boolean(
  dbUrl &&
  !dbUrl.includes('127.0.0.1') &&
  !dbUrl.includes('localhost') &&
  (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))
)

if (isCloudDatabase) {
  console.log('[Step 2/3] Remote PostgreSQL detected (Neon/Cloud).')
  console.log('[Step 2/3] Automatically synchronizing schema via prisma db push...')
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' })
    console.log('[Step 2/3] Schema synchronized successfully on remote database.')

    // 3. Automated Super Admin Account Provisioning
    console.log('[Step 3/3] Bootstrapping protected Super Admin account...')
    execSync('node src/scripts/bootstrapAdmin.js', { stdio: 'inherit' })
    console.log('[Step 3/3] Super Admin bootstrap step verified.')
  } catch (syncErr) {
    console.warn('[Step 2/3 WARNING] Remote database sync failed:', syncErr.message)
    // Don't fail the build so the application container can still deploy and report health diagnostics
  }
} else {
  console.log('[Step 2/3] Local or unconfigured database URL. Skipping remote db push during build.')
}

console.log('='.repeat(65))
