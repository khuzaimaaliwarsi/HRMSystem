/**
 * iSysware HRMS — Authentication & Multi-Method Login Regression Unit Test Suite
 * Validates:
 * 1. Login via exact Email (case-insensitive).
 * 2. Login via exact Username (case-insensitive).
 * 3. Login via exact Employee Code (case-insensitive, e.g. EMP-003).
 * 4. Login via exact Display Name (case-insensitive, e.g. 'UAT Employee').
 * 5. Rejection of unsafe partial-name matches (e.g. 'UAT' or 'Employee' alone -> 401).
 * 6. Ambiguous login rejection when multiple accounts share the same Display Name -> 400 AMBIGUOUS_LOGIN.
 * 7. Inactive account rejection (isActive: false) -> 403 ACCOUNT_DISABLED.
 * 8. Invalid password rejection -> 401 INVALID_CREDENTIALS.
 * 9. Missing identifier or password validation -> 400 VALIDATION_ERROR.
 * 10. Super Admin auto-recovery restores access if Super Admin account was wiped.
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import authService from '../src/services/authService.js'
import { prisma } from '../src/config/database.js'
import { hashPassword } from '../src/utils/crypto.js'

describe('Authentication & Multi-Method Login Regression Suite', () => {
  const commonPassword = 'Password123!'
  let sampleHash = null

  beforeEach(async () => {
    if (!sampleHash) {
      sampleHash = await hashPassword(commonPassword)
    }
  })

  it('1. Validation: Rejects empty or missing identifier and password with 400 VALIDATION_ERROR', async () => {
    await assert.rejects(
      async () => authService.login('', commonPassword),
      (err) => {
        assert.strictEqual(err.status, 400)
        assert.strictEqual(err.code, 'VALIDATION_ERROR')
        return true
      }
    )

    await assert.rejects(
      async () => authService.login('superadmin', ''),
      (err) => {
        assert.strictEqual(err.status, 400)
        assert.strictEqual(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  it('2. Exact Username Login: Authenticates user with exact case-insensitive username', async () => {
    const mockUser = {
      id: 'usr_001',
      username: 'superadmin',
      email: 'superadmin@isysware.com',
      displayName: 'Super Admin',
      passwordHash: sampleHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      employee: null
    }

    const originalFindMany = prisma.user.findMany
    const originalFindCount = prisma.user.count
    const originalUpdate = prisma.user.update
    const originalSessionCreate = prisma.session.create
    const originalAuditLog = prisma.auditLog.create

    try {
      prisma.user.findMany = async ({ where }) => {
        const match = where.OR.some(
          (cond) => cond.username?.equals?.toLowerCase() === 'superadmin'
        )
        return match ? [mockUser] : []
      }
      prisma.user.count = async () => 1
      prisma.user.update = async () => mockUser
      prisma.session.create = async () => ({ id: 'sess_1' })
      prisma.auditLog.create = async () => ({ id: 'aud_1' })

      const result = await authService.login('SuperAdmin', commonPassword)
      assert.ok(result.accessToken)
      assert.strictEqual(result.user.username, 'superadmin')
      assert.strictEqual(result.user.role, 'SUPER_ADMIN')
    } finally {
      prisma.user.findMany = originalFindMany
      prisma.user.count = originalFindCount
      prisma.user.update = originalUpdate
      prisma.session.create = originalSessionCreate
      prisma.auditLog.create = originalAuditLog
    }
  })

  it('3. Exact Email Login: Authenticates user with exact case-insensitive email', async () => {
    const mockUser = {
      id: 'usr_002',
      username: 'alex.wright',
      email: 'alex.wright@isysware.com',
      displayName: 'Alexander Wright',
      passwordHash: sampleHash,
      role: 'HR_ADMIN',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      employee: {
        id: 'emp_002',
        employeeCode: 'EMP-002',
        firstName: 'Alexander',
        lastName: 'Wright'
      }
    }

    const originalFindMany = prisma.user.findMany
    const originalUpdate = prisma.user.update
    const originalSessionCreate = prisma.session.create
    const originalAuditLog = prisma.auditLog.create

    try {
      prisma.user.findMany = async ({ where }) => {
        const match = where.OR.some(
          (cond) => cond.email?.equals?.toLowerCase() === 'alex.wright@isysware.com'
        )
        return match ? [mockUser] : []
      }
      prisma.user.update = async () => mockUser
      prisma.session.create = async () => ({ id: 'sess_2' })
      prisma.auditLog.create = async () => ({ id: 'aud_2' })

      const result = await authService.login('ALEX.WRIGHT@ISYSWARE.COM', commonPassword)
      assert.ok(result.accessToken)
      assert.strictEqual(result.user.email, 'alex.wright@isysware.com')
      assert.strictEqual(result.user.role, 'HR_ADMIN')
    } finally {
      prisma.user.findMany = originalFindMany
      prisma.user.update = originalUpdate
      prisma.session.create = originalSessionCreate
      prisma.auditLog.create = originalAuditLog
    }
  })

  it('4. Exact Employee Code Login: Authenticates user with employeeCode (e.g. EMP-003)', async () => {
    const mockUser = {
      id: 'usr_003',
      username: 'uat.employee',
      email: 'uat.employee@isysware.com',
      displayName: 'UAT Employee',
      passwordHash: sampleHash,
      role: 'EMPLOYEE',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      employee: {
        id: 'emp_003',
        employeeCode: 'EMP-003',
        firstName: 'UAT',
        lastName: 'Employee'
      }
    }

    const originalFindMany = prisma.user.findMany
    const originalUpdate = prisma.user.update
    const originalSessionCreate = prisma.session.create
    const originalAuditLog = prisma.auditLog.create

    try {
      prisma.user.findMany = async ({ where }) => {
        const match = where.OR.some(
          (cond) => cond.employee?.employeeCode?.equals?.toLowerCase() === 'emp-003'
        )
        return match ? [mockUser] : []
      }
      prisma.user.update = async () => mockUser
      prisma.session.create = async () => ({ id: 'sess_3' })
      prisma.auditLog.create = async () => ({ id: 'aud_3' })

      const result = await authService.login('emp-003', commonPassword)
      assert.ok(result.accessToken)
      assert.strictEqual(result.user.username, 'uat.employee')
      assert.strictEqual(result.user.role, 'EMPLOYEE')
    } finally {
      prisma.user.findMany = originalFindMany
      prisma.user.update = originalUpdate
      prisma.session.create = originalSessionCreate
      prisma.auditLog.create = originalAuditLog
    }
  })

  it('5. Exact Display Name Login (Acceptance Criteria): "UAT Employee" logs in using exact Display Name', async () => {
    const mockUser = {
      id: 'usr_003',
      username: 'uat.employee',
      email: 'uat.employee@isysware.com',
      displayName: 'UAT Employee',
      passwordHash: sampleHash,
      role: 'EMPLOYEE',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      employee: {
        id: 'emp_003',
        employeeCode: 'EMP-003',
        firstName: 'UAT',
        lastName: 'Employee'
      }
    }

    const originalFindMany = prisma.user.findMany
    const originalUpdate = prisma.user.update
    const originalSessionCreate = prisma.session.create
    const originalAuditLog = prisma.auditLog.create

    try {
      prisma.user.findMany = async ({ where }) => {
        const match = where.OR.some(
          (cond) => cond.displayName?.equals?.toLowerCase() === 'uat employee'
        )
        return match ? [mockUser] : []
      }
      prisma.user.update = async () => mockUser
      prisma.session.create = async () => ({ id: 'sess_3' })
      prisma.auditLog.create = async () => ({ id: 'aud_3' })

      const result = await authService.login('UAT Employee', commonPassword)
      assert.ok(result.accessToken)
      assert.strictEqual(result.user.displayName, 'UAT Employee')
      assert.strictEqual(result.user.username, 'uat.employee')
    } finally {
      prisma.user.findMany = originalFindMany
      prisma.user.update = originalUpdate
      prisma.session.create = originalSessionCreate
      prisma.auditLog.create = originalAuditLog
    }
  })

  it('6. Rejection of Partial Name Matches: Searching "UAT" alone fails with 401 INVALID_CREDENTIALS', async () => {
    const originalFindMany = prisma.user.findMany
    const originalAuditLog = prisma.auditLog.create

    try {
      prisma.user.findMany = async () => []
      prisma.auditLog.create = async () => ({ id: 'aud_4' })

      await assert.rejects(
        async () => authService.login('UAT', commonPassword),
        (err) => {
          assert.strictEqual(err.status, 401)
          assert.strictEqual(err.code, 'INVALID_CREDENTIALS')
          return true
        }
      )
    } finally {
      prisma.user.findMany = originalFindMany
      prisma.auditLog.create = originalAuditLog
    }
  })

  it('7. Ambiguous Display Name Rejection: Rejects login with 400 AMBIGUOUS_LOGIN when multiple accounts share the Display Name', async () => {
    const mockUserA = {
      id: 'usr_dup_1',
      username: 'john.first',
      email: 'john1@isysware.com',
      displayName: 'John Doe',
      passwordHash: sampleHash,
      role: 'EMPLOYEE',
      isActive: true,
      employee: { employeeCode: 'EMP-010' }
    }
    const mockUserB = {
      id: 'usr_dup_2',
      username: 'john.second',
      email: 'john2@isysware.com',
      displayName: 'John Doe',
      passwordHash: sampleHash,
      role: 'EMPLOYEE',
      isActive: true,
      employee: { employeeCode: 'EMP-011' }
    }

    const originalFindMany = prisma.user.findMany
    const originalAuditLog = prisma.auditLog.create

    try {
      prisma.user.findMany = async () => [mockUserA, mockUserB]
      prisma.auditLog.create = async () => ({ id: 'aud_5' })

      await assert.rejects(
        async () => authService.login('John Doe', commonPassword),
        (err) => {
          assert.strictEqual(err.status, 400)
          assert.strictEqual(err.code, 'AMBIGUOUS_LOGIN')
          assert.ok(err.message.includes('Multiple accounts found with this display name'))
          return true
        }
      )
    } finally {
      prisma.user.findMany = originalFindMany
      prisma.auditLog.create = originalAuditLog
    }
  })

  it('8. Inactive Account Rejection: Rejects login with 403 ACCOUNT_DISABLED if isActive is false', async () => {
    const inactiveUser = {
      id: 'usr_inactive',
      username: 'inactive.user',
      email: 'inactive@isysware.com',
      displayName: 'Inactive User',
      passwordHash: sampleHash,
      role: 'EMPLOYEE',
      isActive: false,
      employee: null
    }

    const originalFindMany = prisma.user.findMany
    const originalAuditLog = prisma.auditLog.create

    try {
      prisma.user.findMany = async () => [inactiveUser]
      prisma.auditLog.create = async () => ({ id: 'aud_6' })

      await assert.rejects(
        async () => authService.login('inactive.user', commonPassword),
        (err) => {
          assert.strictEqual(err.status, 403)
          assert.strictEqual(err.code, 'ACCOUNT_DISABLED')
          return true
        }
      )
    } finally {
      prisma.user.findMany = originalFindMany
      prisma.auditLog.create = originalAuditLog
    }
  })

  it('9. Invalid Password Rejection: Rejects wrong password with 401 INVALID_CREDENTIALS', async () => {
    const mockUser = {
      id: 'usr_valid',
      username: 'valid.user',
      email: 'valid@isysware.com',
      displayName: 'Valid User',
      passwordHash: sampleHash,
      role: 'EMPLOYEE',
      isActive: true,
      employee: null
    }

    const originalFindMany = prisma.user.findMany
    const originalAuditLog = prisma.auditLog.create

    try {
      prisma.user.findMany = async () => [mockUser]
      prisma.auditLog.create = async () => ({ id: 'aud_7' })

      await assert.rejects(
        async () => authService.login('valid.user', 'WrongPassword999!'),
        (err) => {
          assert.strictEqual(err.status, 401)
          assert.strictEqual(err.code, 'INVALID_CREDENTIALS')
          return true
        }
      )
    } finally {
      prisma.user.findMany = originalFindMany
      prisma.auditLog.create = originalAuditLog
    }
  })

  it('10. Super Admin Auto-Recovery: Restores Super Admin access if database account was wiped', async () => {
    let bootstrapCalled = false
    const originalBootstrap = authService.bootstrapSuperAdmin
    const originalCount = prisma.user.count
    const originalFindMany = prisma.user.findMany
    const originalUpdate = prisma.user.update
    const originalSessionCreate = prisma.session.create
    const originalAuditLog = prisma.auditLog.create

    const restoredAdmin = {
      id: 'usr_restored_sa',
      username: 'superadmin',
      email: 'superadmin@isysware.com',
      displayName: 'Super Admin',
      passwordHash: sampleHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      employee: null
    }

    try {
      authService.bootstrapSuperAdmin = async () => {
        bootstrapCalled = true
        return { created: true, username: 'superadmin' }
      }
      prisma.user.count = async () => 0 // 0 Super Admins currently in database!
      prisma.user.findMany = async () => [restoredAdmin]
      prisma.user.update = async () => restoredAdmin
      prisma.session.create = async () => ({ id: 'sess_sa' })
      prisma.auditLog.create = async () => ({ id: 'aud_sa' })

      const result = await authService.login('superadmin', commonPassword)
      assert.strictEqual(bootstrapCalled, true, 'bootstrapSuperAdmin must be triggered on demand')
      assert.strictEqual(result.user.username, 'superadmin')
      assert.strictEqual(result.user.role, 'SUPER_ADMIN')
    } finally {
      authService.bootstrapSuperAdmin = originalBootstrap
      prisma.user.count = originalCount
      prisma.user.findMany = originalFindMany
      prisma.user.update = originalUpdate
      prisma.session.create = originalSessionCreate
      prisma.auditLog.create = originalAuditLog
    }
  })
})
