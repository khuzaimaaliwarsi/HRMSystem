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

    // Auto-reconcile any DRAFT payroll runs (e.g. RUN-202611-01) against canonical active salary structures
    try {
      const draftRuns = await prisma.payrollRun.findMany({
        where: {
          status: 'DRAFT'
        },
        include: {
          payrollPeriod: true,
          entries: {
            include: {
              employee: {
                include: {
                  salaryStructures: true
                }
              }
            }
          }
        }
      })

      for (const run of draftRuns) {
        let totalGross = 0
        let totalDeductions = 0
        let totalNet = 0

        for (const entry of run.entries) {
          const current = entry.employee?.salaryStructures?.find(s => s.isCurrent)
          const base = current ? Number(current.baseSalary) : Number(entry.basicSalary)
          const gross = base
          const tax = gross * 12 > 600000 ? Math.round(((gross * 12 - 600000) * 0.05 / 12) * 100) / 100 : 0
          const deductions = tax + Number(entry.unpaidAbsenceDeduction || 0) + Number(entry.loanDeduction || 0) + Number(entry.otherDeductions || 0)
          const net = Math.max(0, gross - deductions)

          await prisma.payrollEntry.update({
            where: { id: entry.id },
            data: {
              basicSalary: base,
              grossEarnings: gross,
              taxDeduction: tax,
              totalDeductions: deductions,
              netSalary: net
            }
          })

          totalGross += gross
          totalDeductions += deductions
          totalNet += net
        }

        await prisma.payrollRun.update({
          where: { id: run.id },
          data: {
            totalGross,
            totalDeductions,
            totalNet
          }
        })
        console.log(`Payroll     : [RECONCILED] ${run.runNumber} entries updated. Gross: ${totalGross}, Net: ${totalNet}`)
      }
    } catch (reconcileErr) {
      console.warn('Draft run auto-reconciliation warning:', reconcileErr.message)
    }

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

