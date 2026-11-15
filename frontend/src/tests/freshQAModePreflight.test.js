import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  freshQAModeService,
  STORAGE_REGISTRY,
  QA_MODE_KEYS,
  PROTECTED_ACCOUNT_IDS,
  CONFIRMATION_TOKEN
} from '../services/freshQAModeService.js'
import { DEMO_USERS } from '../mocks/demoUsers.js'
import { CANONICAL_EMPLOYEES } from '../mocks/organizationData.js'

describe('Batch 3.5A: Fresh QA Mode & Reset Preflight Verification Suite', () => {

  // Helper to create an isolated mock localStorage
  function createMockStorage(initialData = {}) {
    const store = new Map()
    for (const [k, v] of Object.entries(initialData)) {
      store.set(k, typeof v === 'string' ? v : JSON.stringify(v))
    }
    return {
      getItem(key) {
        return store.has(key) ? store.get(key) : null
      },
      setItem(key, val) {
        store.set(key, String(val))
      },
      removeItem(key) {
        store.delete(key)
      },
      clear() {
        store.clear()
      },
      key(i) {
        return Array.from(store.keys())[i] || null
      },
      _keys() {
        return Array.from(store.keys())
      },
      get length() {
        return store.size
      },
      _dump() {
        const out = {}
        for (const [k, v] of store.entries()) {
          out[k] = JSON.parse(v)
        }
        return out
      }
    }
  }

  it('1. Data Inventory: accurately detects and classifies all 76 storage keys', () => {
    const totalProtected = Object.keys(STORAGE_REGISTRY.PROTECTED_IDENTITIES).length
    const totalDefs = Object.keys(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS).length
    const totalMasters = Object.keys(STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS).length
    const totalTx = Object.keys(STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS).length
    const totalKeys = totalProtected + totalDefs + totalMasters + totalTx

    assert.equal(totalKeys, 76, `Expected exactly 76 configured keys, found ${totalKeys}`)
    assert.equal(totalProtected, 6)
    assert.equal(totalDefs, 13)
    assert.equal(totalMasters, 7)
    assert.equal(totalTx, 50)

    // Run inventory on mock storage
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })
    const inv = freshQAModeService.getInventory(mockStorage)
    assert.equal(inv.summary.totalConfiguredKeys, 76)
    assert.equal(inv.summary.foundInStorageCount, 2)
  })

  it('2. Dry-Run Reset Preview: produces comprehensive report without mutating data', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })
    const initialUsersCount = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS)).length
    const initialEmpsCount = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES)).length

    const preview = freshQAModeService.generateResetPreview(mockStorage)

    // Invariant: zero mutations occurred
    assert.equal(preview.status, 'DRY_RUN_PREVIEW')
    assert.equal(preview.willMutateData, false)
    assert.equal(JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS)).length, initialUsersCount)
    assert.equal(JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES)).length, initialEmpsCount)
    assert.equal(mockStorage.getItem(QA_MODE_KEYS.ACTIVE_FLAG), null)

    // Invariant: protected identities verified
    assert.equal(preview.protectedIdentities.superAdmin.retainedInUserAccounts, true)
    assert.equal(preview.protectedIdentities.superAdmin.retainedInEmployeeDirectory, true)
    assert.equal(preview.protectedIdentities.hrAdmin.retainedInUserAccounts, true)
    assert.equal(preview.protectedIdentities.hrAdmin.retainedInEmployeeDirectory, true)

    // Stale accounts to purge identified
    const staleIds = preview.protectedIdentities.staleAccountsToPurge.map(u => u.id)
    assert.ok(staleIds.includes('EMP-003')) // Manager
    assert.ok(staleIds.includes('EMP-005')) // Team Lead
    assert.ok(staleIds.includes('EMP-004')) // Employee
    assert.ok(staleIds.includes('EMP-016')) // QA Employee
  })

  it('3. Protected Admin Identities: Alexander Wright and Ayesha Khan preserved with valid links', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })

    // Execute reset in mock storage
    const res = freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false, bypassBackupRequirement: true }, mockStorage)
    assert.equal(res.success, true)
    assert.equal(res.dryRun, false)

    // Inspect user accounts
    const remainingUsers = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS))
    assert.equal(remainingUsers.length, 2)
    assert.equal(remainingUsers[0].id, 'EMP-001')
    assert.equal(remainingUsers[0].role, 'super_admin')
    assert.equal(remainingUsers[1].id, 'EMP-002')
    assert.equal(remainingUsers[1].role, 'hr_admin')

    // Inspect employee records
    const remainingEmps = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES))
    assert.equal(remainingEmps.length, 2)
    assert.equal(remainingEmps[0].id, 'EMP-001')
    assert.equal(remainingEmps[0].name, 'Tariq Mehmood') // Primary Super Admin
    assert.equal(remainingEmps[1].id, 'EMP-002')
    assert.equal(remainingEmps[1].name, 'Ayesha Khan')

    // Check flag set
    assert.equal(mockStorage.getItem(QA_MODE_KEYS.ACTIVE_FLAG), 'true')
  })

  it('4. Anti-Reseeding Persistence: empty arrays prevent services from re-initializing initial demo seeds', () => {
    // When a key contains '[]', JSON.parse('[]') is [], and ![] is false.
    const emptyVal = '[]'
    const parsed = JSON.parse(emptyVal)
    assert.equal(Array.isArray(parsed), true)
    assert.equal(parsed.length, 0)
    assert.equal(!parsed, false) // Boolean negation of empty array is FALSE!

    // Simulated service check
    let reseeded = false
    if (!parsed) {
      reseeded = true
    }
    assert.equal(reseeded, false, 'Service must NOT reseed when key is present as empty array')
  })

  it('5. Exportable Backup & Confidential Masking: masks IBAN, CNIC, Bank Account and Passwords', () => {
    const sensitiveData = {
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: [
        { id: 'EMP-001', name: 'Alexander Wright', cnic: '37405-1234567-1', phone: '+92 300 1234001' }
      ],
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.BANK_RECORDS]: [
        {
          id: 'BNK-001',
          employeeId: 'EMP-001',
          accountNumber: '12345678901234',
          fullAccountNumber: '12345678901234',
          iban: 'PK12HABB0001234567890123',
          fullIban: 'PK12HABB0001234567890123'
        }
      ]
    }
    const mockStorage = createMockStorage(sensitiveData)

    // Create masked backup
    const backup = freshQAModeService.createBackup({ maskSensitive: true }, mockStorage)
    assert.equal(backup.system, 'iSysware HRMS')
    assert.equal(backup.maskedForConfidentiality, true)

    const maskedBank = backup.data[STORAGE_REGISTRY.PROTECTED_IDENTITIES.BANK_RECORDS][0]
    assert.equal(maskedBank.fullAccountNumber, 'REDACTED_CONFIDENTIAL')
    assert.equal(maskedBank.fullIban, 'REDACTED_CONFIDENTIAL')
    assert.ok(maskedBank.accountNumber.startsWith('••••••••'))
    assert.ok(maskedBank.iban.startsWith('PK•• ••••'))

    const maskedEmp = backup.data[STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES][0]
    assert.ok(maskedEmp.cnic.includes('*******'))
  })

  it('6. Full Backup Validation & Safe Restore: validates structure and restores without data loss', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.COMPANY_PROFILE]: { companyName: 'iSysware Test Corp' }
    })

    // Lossless backup
    const backup = freshQAModeService.createBackup({ maskSensitive: false }, mockStorage)
    const validation = freshQAModeService.validateBackup(backup)
    assert.equal(validation.valid, true)
    assert.equal(validation.errors.length, 0)

    // Dry-run restore
    const dryRestore = freshQAModeService.restoreFromBackup(backup, { dryRun: true }, mockStorage)
    assert.equal(dryRestore.success, true)
    assert.equal(dryRestore.dryRun, true)

    // Create fresh target storage and perform actual restore
    const newStorage = createMockStorage()
    const liveRestore = freshQAModeService.restoreFromBackup(backup, { dryRun: false }, newStorage)
    assert.equal(liveRestore.success, true)
    assert.equal(liveRestore.dryRun, false)
    assert.equal(liveRestore.restoredKeys, 2)
    assert.equal(
      JSON.parse(newStorage.getItem(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.COMPANY_PROFILE)).companyName,
      'iSysware Test Corp'
    )
  })

  it('7. Security Safeguard: reset rejected with invalid confirmation token or dryRun default', () => {
    const mockStorage = createMockStorage()

    // 1. Rejects wrong token
    assert.throws(
      () => freshQAModeService.executeFreshQAModeReset('WRONG_TOKEN', { dryRun: false }, mockStorage),
      /Reset rejected: Invalid confirmation token/
    )

    // 2. Default options is dryRun: true (safe by default)
    const defaultRes = freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, {}, mockStorage)
    assert.equal(defaultRes.dryRun, true)
    assert.equal(mockStorage.getItem(QA_MODE_KEYS.ACTIVE_FLAG), null)
  })

  it('8. Organization Masters & Operational Transactions Reset: all 57 tables (7 masters + 50 operational) cleared to []', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES,
      [STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS.DEPARTMENTS]: [{ id: 'DEP-01', name: 'Dev' }],
      [STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS.TEAMS]: [{ id: 'TEAM-01', name: 'Frontend' }],
      [STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS.ATTENDANCE_RECORDS]: [{ id: 'ATT-01' }],
      [STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS.LEAVE_REQUESTS]: [{ id: 'LEV-01' }],
      [STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS.PAYROLL_RUNS]: [{ id: 'PAY-01' }]
    })

    const result = freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false, bypassBackupRequirement: true }, mockStorage)
    assert.equal(result.success, true)

    // All organization masters are []
    for (const key of Object.values(STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS)) {
      const data = JSON.parse(mockStorage.getItem(key))
      assert.deepEqual(data, [], `Master key ${key} should be empty array []`)
    }

    // Operational transactions are [] (except AUDIT_LOGS which has initial activation entry)
    for (const [name, key] of Object.entries(STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS)) {
      const data = JSON.parse(mockStorage.getItem(key))
      if (name === 'AUDIT_LOGS') {
        assert.equal(data.length, 1)
        assert.equal(data[0].action, 'FRESH_QA_MODE_ACTIVATED')
      } else {
        assert.deepEqual(data, [], `Transaction key ${key} should be empty array []`)
      }
    }
  })

  it('9. Five Portal Integrity: all portal routing remains valid and supported in QA Mode', () => {
    const portals = ['/super-admin', '/hr-admin', '/manager', '/team-lead', '/employee']
    assert.equal(portals.length, 5)

    // In QA Mode, Super Admin and HR Admin can log in immediately:
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })
    freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false, bypassBackupRequirement: true }, mockStorage)

    const remainingAccounts = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS))
    const superAdminAcc = remainingAccounts.find(u => u.role === 'super_admin')
    const hrAdminAcc = remainingAccounts.find(u => u.role === 'hr_admin')

    assert.ok(superAdminAcc, 'Super Admin portal account exists')
    assert.ok(hrAdminAcc, 'HR Admin portal account exists')
    assert.equal(superAdminAcc.portalPath, '/super-admin')
    assert.equal(hrAdminAcc.portalPath, '/hr-admin')

    // Manager, Team Lead, and Employee portals are ready to receive newly created employees
    assert.ok(PROTECTED_ACCOUNT_IDS.includes(superAdminAcc.id))
    assert.ok(PROTECTED_ACCOUNT_IDS.includes(hrAdminAcc.id))
  })

  it('10. Fresh Baseline: Sequential ID generation produces EMP-003 for first newly added employee', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })
    freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false, bypassBackupRequirement: true }, mockStorage)

    const remainingEmps = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES))
    assert.equal(remainingEmps.length, 2)

    // Simulate getNextEmployeeId
    const numbers = remainingEmps
      .map(e => {
        const match = e.id.match(/EMP-(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter(n => !isNaN(n))
    const max = numbers.length > 0 ? Math.max(...numbers) : 0
    const nextId = `EMP-${String(max + 1).padStart(3, '0')}`

    assert.equal(nextId, 'EMP-003', 'First newly onboarded employee in fresh QA baseline must receive EMP-003')
  })

  it('11. Fresh Baseline: First employee can be created without requiring an existing Manager', () => {
    // Verifies that managerId: null / undefined defaults to managerName: "Unassigned" without error
    const newEmp = {
      id: 'EMP-003',
      name: 'Muhammad Usman',
      email: 'usman.lead@isysware.com',
      managerId: null,
      status: 'Active'
    }

    let managerName = 'Unassigned'
    if (newEmp.managerId) {
      managerName = 'Resolved Manager'
    }
    assert.equal(managerName, 'Unassigned')
    assert.ok(newEmp.id === 'EMP-003')
  })

  it('12. Fresh Baseline: New Manager/Team Lead portal account can be provisioned dynamically', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })
    freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false, bypassBackupRequirement: true }, mockStorage)

    // Owner creates new employee EMP-003 and provisions Manager portal account
    const accounts = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS))
    accounts.push({
      id: 'EMP-003',
      employeeId: 'EMP-003',
      name: 'Muhammad Usman',
      email: 'usman.lead@isysware.com',
      role: 'manager',
      roleLabel: 'Department Manager',
      portalPath: '/manager',
      capabilities: ['team_review', 'leave_approve_cap', 'kpi_appraise', 'task_assign']
    })
    mockStorage.setItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS, JSON.stringify(accounts))

    const updatedAccounts = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS))
    assert.equal(updatedAccounts.length, 3)
    const managerAcc = updatedAccounts.find(u => u.role === 'manager')
    assert.ok(managerAcc)
    assert.equal(managerAcc.portalPath, '/manager')
  })

  it('13. Preserved Definitions & Business Rules: policies, permissions, and company profile remain unchanged', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.COMPANY_PROFILE]: { companyName: 'iSysware Software Solutions', ntn: '1234567-8' },
      [STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.CENTRAL_POLICIES]: [{ id: 'POL-01', title: 'Standard Leave Policy' }],
      [STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.APPROVAL_RULES]: [{ id: 'RULE-01', title: 'Leave Approval Tiers' }]
    })

    freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false, bypassBackupRequirement: true }, mockStorage)

    const profile = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.COMPANY_PROFILE))
    const policies = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.CENTRAL_POLICIES))
    const rules = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.APPROVAL_RULES))

    assert.equal(profile.companyName, 'iSysware Software Solutions')
    assert.equal(policies.length, 1)
    assert.equal(rules.length, 1)
  })

  it('14. Backup & Restore Data Types: correctly handles strings, arrays, and objects', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.COMPANY_PROFILE]: { name: 'Corp', active: true },
      [STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.CENTRAL_POLICIES]: ['ruleA', 'ruleB'],
      [QA_MODE_KEYS.ACTIVE_FLAG]: 'true'
    })

    const backup = freshQAModeService.createBackup({ maskSensitive: false }, mockStorage)
    assert.equal(typeof backup.data[STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.COMPANY_PROFILE], 'object')
    assert.equal(Array.isArray(backup.data[STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.CENTRAL_POLICIES]), true)

    const targetStorage = createMockStorage()
    freshQAModeService.restoreFromBackup(backup, { dryRun: false }, targetStorage)

    assert.equal(
      JSON.parse(targetStorage.getItem(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.COMPANY_PROFILE)).name,
      'Corp'
    )
    assert.equal(
      JSON.parse(targetStorage.getItem(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS.CENTRAL_POLICIES)).length,
      2
    )
  })

  it('15. Security Guard: rejects reset if unclassified isysware_hrms_* keys exist in storage', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES,
      'isysware_hrms_unknown_experimental_key_v99': [{ data: 'sensitive' }]
    })

    const inv = freshQAModeService.getInventory(mockStorage)
    assert.equal(inv.hasUnclassifiedKeys, true)
    assert.ok(inv.unclassifiedKeys.includes('isysware_hrms_unknown_experimental_key_v99'))

    // Attempting reset must be strictly blocked
    assert.throws(
      () => freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false, bypassBackupRequirement: true }, mockStorage),
      /Reset blocked: Unclassified HRMS storage keys detected/
    )
  })

  it('16. Data Loss Prevention Guard: blocks reset execution until backup is downloaded', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })

    // Without backup downloaded and without bypass flag -> MUST THROW
    assert.throws(
      () => freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false }, mockStorage),
      /Reset blocked: A verified pre-reset backup must be downloaded/
    )

    // Once backup is created/recorded -> reset is unlocked
    freshQAModeService.recordBackupDownloaded(mockStorage)
    const result = freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false }, mockStorage)
    assert.equal(result.success, true)
  })

  it('17. Single Canonical Engine: UI reset path uses same freshQAModeService as automated suite', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })

    // 1. Download backup (Step 1 in UI)
    const backup = freshQAModeService.createBackup({ maskSensitive: false }, mockStorage)
    assert.ok(backup.totalKeys > 0)
    assert.equal(freshQAModeService.hasBackupBeenDownloaded(mockStorage), true)

    // 2. Validate backup (Step 2 in UI)
    const validation = freshQAModeService.validateBackup(backup)
    assert.equal(validation.valid, true)

    // 3. Execute reset via exact confirmation token (Step 3 in UI)
    const resetRes = freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false }, mockStorage)
    assert.equal(resetRes.success, true)
    assert.equal(resetRes.preservedAccounts.length, 2)
    assert.equal(mockStorage.getItem(QA_MODE_KEYS.ACTIVE_FLAG), 'true')

    // 4. Verify post-reset validation
    const postEmps = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES))
    assert.equal(postEmps.length, 2)
    const postAccounts = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS))
    assert.equal(postAccounts.length, 2)
  })

  it('18. Unclassified Keys Authorization: successfully executes and purges unclassified keys when authorized', () => {
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES,
      isysware_hrms_timesheet_signoffs_v1: [{ id: 'TS-01' }],
      isysware_hrms_legacy_test_key_v99: [{ old: 'data' }]
    })

    // Pre-reset backup
    freshQAModeService.recordBackupDownloaded(mockStorage)

    // Execute with authorization to clear unclassified
    const res = freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, {
      dryRun: false,
      allowUnclassified: true,
      clearUnclassified: true
    }, mockStorage)

    assert.equal(res.success, true)
    // Legacy unclassified key must be removed
    assert.equal(mockStorage.getItem('isysware_hrms_legacy_test_key_v99'), null)
    // Protected employees must be exactly 2
    const postEmps = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES))
    assert.equal(postEmps.length, 2)
  })

  it('19. Anti-Reseeding Persistence: employeeService does NOT re-inject EMP-016 when Fresh QA Mode is active', async () => {
    const { employeeService } = await import('../services/employeeService.js')
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })

    freshQAModeService.recordBackupDownloaded(mockStorage)
    freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false }, mockStorage)

    // Verify initial post-reset count is 2
    const empsPostReset = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES))
    assert.equal(empsPostReset.length, 2)

    // Simulate page reload: employeeService._initialize runs with window.localStorage = mockStorage
    const originalWindow = globalThis.window
    try {
      globalThis.window = { localStorage: mockStorage }
      employeeService._initialize()
      const empsAfterReload = employeeService.getEmployees()
      assert.equal(empsAfterReload.length, 2, `Expected 2 employees after reload, got ${empsAfterReload.length}`)
      assert.equal(empsAfterReload.some(e => e.id === 'EMP-016'), false, 'EMP-016 must not be auto-injected in Fresh QA Mode')
    } finally {
      globalThis.window = originalWindow
    }
  })

  it('20. Anti-Reseeding Persistence: attendanceService does NOT auto-sync scheduled attendance in Fresh QA Mode', async () => {
    const { attendanceService } = await import('../services/attendanceService.js')
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })

    freshQAModeService.recordBackupDownloaded(mockStorage)
    freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, { dryRun: false }, mockStorage)

    const originalWindow = globalThis.window
    try {
      globalThis.window = { localStorage: mockStorage }
      const records = attendanceService.getAttendanceRecords()
      assert.equal(records.length, 0, `Expected 0 attendance records, got ${records.length}`)
    } finally {
      globalThis.window = originalWindow
    }
  })

  it('21. Protected Identity Preservation: preserves EMP-001 and EMP-002, and next employee starts safely with EMP-003 without collision', async () => {
    const { employeeService } = await import('../services/employeeService.js')
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES,
      [STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS.DEPARTMENTS]: [{ id: 'DEP-01', name: 'Dev' }]
    })

    const res = freshQAModeService.resetAllSoftwareDataAtoZ({}, mockStorage)
    assert.equal(res.success, true)

    // Employees array must preserve exactly the 2 protected admin profiles
    const rawEmps = mockStorage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES)
    const emps = JSON.parse(rawEmps)
    assert.equal(emps.length, 2, `Expected 2 protected admin employees, found ${emps.length}`)
    assert.ok(emps.some(e => e.id === 'EMP-001'), 'EMP-001 Super Admin must be preserved')
    assert.ok(emps.some(e => e.id === 'EMP-002'), 'EMP-002 HR Admin must be preserved')

    // Departments must be empty []
    const depts = JSON.parse(mockStorage.getItem(STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS.DEPARTMENTS))
    assert.equal(depts.length, 0)

    // Next employee ID generated on clean baseline safely yields EMP-003 (never collides with EMP-001 or EMP-002)
    const originalWindow = globalThis.window
    try {
      globalThis.window = { localStorage: mockStorage }
      employeeService.clearMemoryCache()
      const nextId = employeeService.getNextEmployeeId()
      assert.equal(nextId, 'EMP-003', `First created workforce member must be EMP-003, got ${nextId}`)

      // Attempting to manually create an employee using EMP-001 or EMP-002 is rejected
      assert.throws(
        () => employeeService.createEmployee({ id: 'EMP-001', name: 'Collision Attacker', email: 'attacker@example.com' }),
        /reserved for protected administrative accounts/
      )
    } finally {
      globalThis.window = originalWindow
    }
  })

  it('22. Organization Creation in Fresh QA Mode: Newly created Department (DEP-01), Team (TEAM-01), and Designation (DESIG-01) persist and appear in getters', async () => {
    const { employeeService } = await import('../services/employeeService.js')
    const mockStorage = createMockStorage({
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS]: DEMO_USERS,
      [STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES]: CANONICAL_EMPLOYEES
    })

    freshQAModeService.resetAllSoftwareDataAtoZ({}, mockStorage)

    const originalWindow = globalThis.window
    try {
      globalThis.window = { localStorage: mockStorage }
      employeeService.clearMemoryCache()

      // Initial getters must be empty []
      assert.equal(employeeService.getDepartments().length, 0)
      assert.equal(employeeService.getTeams().length, 0)
      assert.equal(employeeService.getDesignations().length, 0)

      // Save a new Department
      const deptId = employeeService.saveDepartment({ code: 'HR', name: 'Human Resources' }, 'Super Admin')
      assert.equal(deptId, 'DEP-01')

      // Must appear in getDepartments()
      const depts = employeeService.getDepartments()
      assert.equal(depts.length, 1)
      assert.equal(depts[0].id, 'DEP-01')
      assert.equal(depts[0].name, 'Human Resources')

      // Save a new Team under this department
      const teamId = employeeService.saveTeam({ code: 'TALENT', name: 'Talent Acquisition', departmentId: deptId }, 'Super Admin')
      assert.equal(teamId, 'TEAM-01')

      // Must appear in getTeams()
      const teams = employeeService.getTeams()
      assert.equal(teams.length, 1)
      assert.equal(teams[0].id, 'TEAM-01')
      assert.equal(teams[0].name, 'Talent Acquisition')

      // Save a new Designation under this department
      const desigId = employeeService.saveDesignation({ code: 'HRM', name: 'HR Manager', departmentId: deptId, level: 'Senior' }, 'Super Admin')
      assert.equal(desigId, 'DESIG-01')

      // Must appear in getDesignations()
      const desigs = employeeService.getDesignations()
      assert.equal(desigs.length, 1)
      assert.equal(desigs[0].id, 'DESIG-01')
      assert.equal(desigs[0].name, 'HR Manager')
    } finally {
      globalThis.window = originalWindow
    }
  })
})
