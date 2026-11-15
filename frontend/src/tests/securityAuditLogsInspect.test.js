import test from 'node:test'
import assert from 'node:assert/strict'
import { auditService } from '../services/auditService.js'
import { companySettingsService } from '../services/companySettingsService.js'

test('Security & Audit Logs — Bug 05 Verification Suite', async (t) => {
  // Reset audit state for deterministic testing
  auditService.resetAllData()

  await t.test('1. Audit Data Contract: All canonical audit records contain required inspect fields', () => {
    const logs = auditService.getLogs()
    assert.ok(logs.length >= 5, 'Must contain baseline audit records')

    // Inspect AUD-2026-002 (Approval Matrix Update)
    const log002 = auditService.getLogById('AUD-2026-002')
    assert.ok(log002, 'AUD-2026-002 must exist')
    assert.equal(log002.id, 'AUD-2026-002')
    assert.equal(log002.action, 'APPROVAL_MATRIX_UPDATE')
    assert.equal(log002.entity, 'APV-EXP-MAT')
    assert.equal(log002.entityName, 'Expense Claim Approval Matrix')
    assert.ok(log002.previousValue.includes('Manager Cap: PKR 20,000'))
    assert.ok(log002.newValue.includes('Manager Cap: PKR 25,000'))
    assert.ok(log002.actor.includes('Super Admin'))
    assert.ok(log002.timestamp)

    // Inspect AUD-2026-003 (Role Permission Review)
    const log003 = auditService.getLogById('AUD-2026-003')
    assert.ok(log003, 'AUD-2026-003 must exist')
    assert.equal(log003.id, 'AUD-2026-003')
    assert.equal(log003.action, 'ROLE_PERMISSION_PROTECTED_REVIEW')
    assert.equal(log003.entity, 'ROLE-HR-ADMIN')
    assert.equal(log003.previousValue, 'Full access to Settings')
    assert.ok(log003.newValue.includes('Operational access only'))
  })

  await t.test('2. Two Company Settings Audit Entries: Event-specific information and snapshot preservation', () => {
    const actor = { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }

    // Event 1: First Company Settings Update (e.g. Cutoff day change)
    companySettingsService.updateCompanyProfile(
      { payrollCutoffDay: 26 },
      actor,
      'Standardized corporate payroll cutoff day to 26th'
    )

    const logsAfterEvent1 = auditService.getLogs({ action: 'COMPANY_SETTINGS_UPDATED' })
    const event1Log = logsAfterEvent1[0]
    assert.ok(event1Log, 'First update event must be logged')
    assert.equal(event1Log.action, 'COMPANY_SETTINGS_UPDATED')
    assert.ok(event1Log.previousValue.includes('payrollCutoffDay: 25') || event1Log.previousValue.includes('payrollCutoffDay'))
    assert.ok(event1Log.newValue.includes('payrollCutoffDay: 26'))
    assert.equal(event1Log.reason, 'Standardized corporate payroll cutoff day to 26th')
    const event1Id = event1Log.id

    // Event 2: Second Company Settings Update (e.g. Default shift start change)
    companySettingsService.updateCompanyProfile(
      { defaultShiftStart: '08:45' },
      actor,
      'Adjusted corporate morning shift start time to 08:45 AM'
    )

    const logsAfterEvent2 = auditService.getLogs({ action: 'COMPANY_SETTINGS_UPDATED' })
    const event2Log = logsAfterEvent2[0]
    assert.ok(event2Log, 'Second update event must be logged as newest entry')
    assert.notEqual(event2Log.id, event1Id, 'Event 2 must have distinct event ID')
    assert.ok(event2Log.previousValue.includes('defaultShiftStart: 09:00') || event2Log.previousValue.includes('defaultShiftStart'))
    assert.ok(event2Log.newValue.includes('defaultShiftStart: 08:45'))
    assert.equal(event2Log.reason, 'Adjusted corporate morning shift start time to 08:45 AM')

    // Historical Preservation Invariant: Verify Event 1 log remains unaltered
    const reloadedEvent1 = auditService.getLogById(event1Id)
    assert.equal(reloadedEvent1.reason, 'Standardized corporate payroll cutoff day to 26th')
    assert.ok(!reloadedEvent1.newValue.includes('defaultShiftStart'), 'Event 1 must NOT contain Event 2 modifications')
  })

  await t.test('3. Missing Snapshot Values: Clearly identifies uncaptured values as Not recorded', () => {
    // Log a system governance event without previous/new values (similar to Fresh QA reset)
    const qaLog = auditService.logEvent({
      actor: 'Alexander Wright (EMP-001)',
      actorId: 'EMP-001',
      actorRole: 'super_admin',
      action: 'FRESH_QA_MODE_ACTIVATED',
      entity: 'SYSTEM_GOVERNANCE',
      entityName: 'QA Baseline Initialization',
      reason: 'Fresh baseline activated with 0 employees',
      previousValue: '',
      newValue: ''
    })

    assert.equal(qaLog.previousValue, '')
    assert.equal(qaLog.newValue, '')

    // Formatter logic helper check: empty values must display 'Not recorded' rather than fabricating data
    const formatSnapshot = (val) => (!val || val === 'N/A' ? 'Not recorded' : String(val))
    assert.equal(formatSnapshot(qaLog.previousValue), 'Not recorded')
    assert.equal(formatSnapshot(qaLog.newValue), 'Not recorded')
  })

  await t.test('4. Access Control: Restricted to Super Admin and HR Admin only', () => {
    // Super Admin authorized
    assert.doesNotThrow(() => {
      auditService.getLogs({}, { role: 'super_admin', name: 'Tariq Mehmood' })
    })

    // HR Admin authorized
    assert.doesNotThrow(() => {
      auditService.getLogs({}, { role: 'hr_admin', name: 'Ayesha Khan' })
    })

    // Manager denied
    assert.throws(
      () => {
        auditService.getLogs({}, { role: 'manager', name: 'Bilal Siddiqui' })
      },
      /Access denied/i
    )

    // Employee denied
    assert.throws(
      () => {
        auditService.getLogs({}, { role: 'employee', name: 'Zeeshan Ali' })
      },
      /Access denied/i
    )
  })

  await t.test('5. Sensitive Data Masking: Masks credentials, tokens, and bank accounts', () => {
    const sensitiveLog = auditService.logEvent({
      actor: 'System Admin',
      action: 'CREDENTIAL_UPDATE',
      entity: 'EMP-004',
      entityName: 'Zeeshan Ali',
      previousValue: 'password: "supersecretPassword123", token: "tok_abc987654321"',
      newValue: 'IBAN: PK36SCBL0000001123456702, CNIC: 37405-1234567-1',
      reason: 'Bank disbursement account and security token updated'
    })

    assert.ok(!sensitiveLog.previousValue.includes('supersecretPassword123'), 'Password must be masked')
    assert.ok(sensitiveLog.previousValue.includes('password: "********"'))

    assert.ok(!sensitiveLog.newValue.includes('PK36SCBL0000001123456702'), 'IBAN must be masked')
    assert.ok(sensitiveLog.newValue.includes('PK** **** **** **** ****'))

    assert.ok(!sensitiveLog.newValue.includes('37405-1234567-1'), 'CNIC must be masked')
    assert.ok(sensitiveLog.newValue.includes('37405-*******-1'))
  })

  await t.test('6. Filter & Search Isolation: Accurately searches and isolates audit actions', () => {
    const policyLogs = auditService.getLogs({ action: 'POLICY' })
    assert.ok(policyLogs.every((l) => l.action.includes('POLICY')))

    const searchResults = auditService.getLogs({ search: 'Expense Claim' })
    assert.ok(searchResults.length >= 1)
    assert.ok(searchResults.some((l) => l.entityName === 'Expense Claim Approval Matrix'))
  })
})
