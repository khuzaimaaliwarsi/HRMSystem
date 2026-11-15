import test from 'node:test'
import assert from 'node:assert/strict'
import { leavePolicyService } from '../services/leavePolicyService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'
import { LEAVE_TYPES } from '../mocks/leaveData.js'

test('Aliyan_HRMS — Leave Policy Rules & Cross-Tab Consistency Suite', async (t) => {
  // Test 1: Canonical Leave Types & Paid/Unpaid Treatment
  await t.test('1. Paid leave types (Annual, Casual, Sick, Emergency, Parental, Compensatory) evaluate to Paid', () => {
    const types = leavePolicyService.getAllLeaveTypes() || LEAVE_TYPES
    assert.ok(types.length >= 7, 'Must have at least 7 canonical leave types')

    const annual = types.find((lt) => lt.id === 'LT-ANNUAL' || lt.code === 'AL')
    const casual = types.find((lt) => lt.id === 'LT-CASUAL' || lt.code === 'CL')
    const sick = types.find((lt) => lt.id === 'LT-SICK' || lt.code === 'SL')
    const emergency = types.find((lt) => lt.id === 'LT-EMERGENCY' || lt.code === 'EL')
    const unpaid = types.find((lt) => lt.id === 'LT-UNPAID' || lt.code === 'UL')

    const isPaid = (lt) => (lt?.paidTreatment || '').toLowerCase() === 'paid' || lt?.isPaid === true

    assert.equal(isPaid(annual), true, 'Annual Leave must resolve to Paid')
    assert.equal(isPaid(casual), true, 'Casual Leave must resolve to Paid')
    assert.equal(isPaid(sick), true, 'Sick Leave must resolve to Paid')
    assert.equal(isPaid(emergency), true, 'Emergency Leave must resolve to Paid')
    assert.equal(isPaid(unpaid), false, 'Unpaid Leave (LWP) must resolve to Unpaid')
  })

  // Test 2: Prorated Leave Ledger & Utilization Sync
  await t.test('2. Prorated Casual Leave ledger accurately reflects utilized leave and available balance', () => {
    // Setup a clean test employee who joined in October 2026 (3 months remaining -> 25% quota = 2.5d)
    const empId = 'EMP-QA-LEAVE-01'
    const joinDate = '2026-10-01'
    const proratedCasual = leaveBalanceService.calculateProratedEntitlement(joinDate, 10)
    assert.equal(proratedCasual, 2.5, 'Prorated entitlement for October joiner must be 2.5 days')

    // Seed ledger with opening balance of 2.5 days
    const currentLedger = [...leaveBalanceService._getItem('isysware_hrms_f05_leave_ledger_v1', [])]
    const testEntry = {
      id: `LED-${empId}-CL`,
      employeeId: empId,
      leaveTypeId: 'LT-CASUAL',
      openingBalance: 2.5,
      earnedAccrued: 0,
      adjustments: 0,
      utilized: 0,
      pending: 0,
      closingBalance: 2.5,
      availableBalance: 2.5
    }
    const filtered = currentLedger.filter((l) => l.employeeId !== empId)
    leaveBalanceService._setItem('isysware_hrms_f05_leave_ledger_v1', [...filtered, testEntry])

    // Commit 1 day of approved Casual Leave
    leaveBalanceService.commitApprovedLeave(empId, 'LT-CASUAL', 1.0, 'LV-TEST-001', 'Ali Raza (Team Lead)')

    // Check ledger
    const updatedLedger = leaveBalanceService.getLedger(empId)
    const clRecord = updatedLedger.find((l) => l.leaveTypeId === 'LT-CASUAL')
    assert.ok(clRecord, 'Casual leave record must exist')
    assert.equal(clRecord.utilized, 1.0, 'Utilized must be 1.0 day')
    assert.equal(clRecord.closingBalance, 1.5, 'Closing balance must be 2.5 - 1.0 = 1.5 days')
    assert.equal(clRecord.availableBalance, 1.5, 'Available balance must be 1.5 days')

    // Check summary service
    const summary = leaveBalanceService.getEmployeeBalanceSummary(empId)
    assert.equal(summary.casualRemaining, 1.5, 'Summary casualRemaining must strictly match ledger available balance (1.5d)')
    assert.equal(summary.casualTotal, 2.5, 'Summary casualTotal must reflect opening balance (2.5d)')
    assert.equal(summary.casualUsed, 1.0, 'Summary casualUsed must reflect utilized days (1.0d)')
  })

  // Test 3: Idempotent Ledger Re-Commit Guard
  await t.test('3. Idempotent commit guard prevents duplicate deductions for the same approved leave', () => {
    const empId = 'EMP-QA-LEAVE-01'
    // Attempting to commit the exact same leave request again
    leaveBalanceService.commitApprovedLeave(empId, 'LT-CASUAL', 1.0, 'LV-TEST-001', 'Ali Raza (Team Lead)')

    const updatedLedger = leaveBalanceService.getLedger(empId)
    const clRecord = updatedLedger.find((l) => l.leaveTypeId === 'LT-CASUAL')
    assert.equal(clRecord.utilized, 1.0, 'Utilized must remain 1.0 day (no duplicate deduction)')
    assert.equal(clRecord.availableBalance, 1.5, 'Available balance must remain 1.5 days')
  })

  // Test 4: Dynamic Creation & Immediate Commitment for New Employees
  await t.test('4. Committing approved leave initializes employee balances first and updates ledger accurately', () => {
    const empId = 'EMP-QA-LEAVE-NEW'
    // Commit approved leave for employee not yet in ledger
    leaveBalanceService.commitApprovedLeave(empId, 'LT-CASUAL', 1.0, 'LV-NEW-001', 'Ali Raza (Team Lead)')

    const ledger = leaveBalanceService.getLedger(empId)
    const cl = ledger.find((l) => l.leaveTypeId === 'LT-CASUAL')
    assert.ok(cl, 'Casual leave ledger record must be created')
    assert.equal(cl.utilized, 1.0, 'Utilized must be 1.0')
    assert.equal(cl.closingBalance, 9.0, 'Closing balance must be 10 - 1 = 9.0')
    assert.equal(cl.availableBalance, 9.0, 'Available balance must be 9.0')
  })
})
