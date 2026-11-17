#!/usr/bin/env node
/**
 * iSysware HRMS — Protected Super Admin Bootstrap CLI
 * Provisions the initial root Super Admin account idempotently.
 * Never overwrites or modifies an existing protected Super Admin.
 * Run with: npm run admin:bootstrap
 */

import authService from '../services/authService.js'
import { prisma, disconnectDatabase } from '../config/database.js'
import env from '../config/env.js'

async function main() {
  console.log('='.repeat(65))
  console.log('  iSysware HRMS — Protected Super Admin Bootstrap')
  console.log('='.repeat(65))
  console.log(`Environment : ${env.nodeEnv}`)
  console.log(`Username    : ${env.bootstrapAdmin.username}`)
  console.log(`Email       : ${env.bootstrapAdmin.email}`)
  console.log('-'.repeat(65))

  try {
    const result = await authService.bootstrapSuperAdmin()

    if (result.created) {
      console.log('Status      : [SUCCESS] Protected Super Admin account created!')
      console.log(`Admin ID    : ${result.adminId}`)
      console.log(`Username    : ${result.username}`)
      console.log(`Email       : ${result.email}`)
      console.log('Notice      : Password configured from environment variable (BOOTSTRAP_ADMIN_PASSWORD).')
    } else {
      console.log('Status      : [INFO] Protected Super Admin already exists.')
      console.log(`Admin ID    : ${result.adminId}`)
      console.log(`Username    : ${result.username}`)
      console.log('Notice      : Bootstrap skipped. Existing protected account preserved.')
    }

    // Auto-unlock any accounts that were locked out due to previous failed attempts
    try {
      const unlocked = await prisma.user.updateMany({
        where: {
          OR: [
            { lockedUntil: { not: null } },
            { failedLoginAttempts: { gt: 0 } }
          ]
        },
        data: {
          lockedUntil: null,
          failedLoginAttempts: 0
        }
      })
      if (unlocked.count > 0) {
        console.log(`Lockout     : [CLEARED] Reset lockouts for ${unlocked.count} accounts.`)
      }
    } catch (_) {}

    console.log('='.repeat(65))
    await disconnectDatabase()
    process.exit(0)
  } catch (err) {
    console.error('Bootstrap Error:', err.message)
    await disconnectDatabase()
    process.exit(1)
  }
}

main()

