import test from 'node:test'
import assert from 'node:assert/strict'
import { leaveService } from '../services/leaveService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'

test('Aliyan_HRMS — Approved Leave Balance Reconciliation Suite', async (t) => {
  await t.test('1. Ahmed Khan (EMP-005) LV-202611-002 is Approved and reflects in ledger as Opening 2.5d, Utilized 1d, Available 1.5d', () => {
    // Reconcile approved leaves for Ahmed Khan
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')

    // 1. Verify Request in Leave Service
    const requests = leaveService.getLeaveRequests({ employeeId: 'EMP-005' }, { employeeId: 'EMP-005', role: 'employee' })
    const lv002 = requests.find((r) => r.id === 'LV-202611-002')
    assert.ok(lv002, 'Request LV-202611-002 must exist for EMP-005')
    assert.equal(lv002.status, 'Approved')
    assert.equal(lv002.leaveTypeId, 'LT-CASUAL')
    assert.equal(lv002.eligibleWorkingDays, 1.0)

    // 2. Verify Ledger in Entitlements & Balances
    const ledger = leaveBalanceService.getLedger('EMP-005')
    const clRecord = ledger.find((l) => l.leaveTypeId === 'LT-CASUAL' || l.leaveTypeCode === 'CL')
    assert.ok(clRecord, 'Casual leave record must exist in ledger')
    assert.equal(clRecord.openingBalance, 2.5, 'Opening balance must be 2.5d for October joiner')
    assert.equal(clRecord.utilized, 1.0, 'Utilized must reflect the 1d approved leave')
    assert.equal(clRecord.closingBalance, 1.5, 'Closing balance must be 2.5 - 1 = 1.5d')
    assert.equal(clRecord.availableBalance, 1.5, 'Available balance must be 1.5d')

    // 3. Verify Balance Summary
    const summary = leaveBalanceService.getEmployeeBalanceSummary('EMP-005')
    assert.equal(summary.casualTotal, 2.5)
    assert.equal(summary.casualUsed, 1.0)
    assert.equal(summary.casualRemaining, 1.5)
  })

  await t.test('2. Idempotent Reconciliation: Multiple executions never duplicate deduct', () => {
    // Execute multiple reconciliation passes
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')

    const ledger = leaveBalanceService.getLedger('EMP-005')
    const clRecord = ledger.find((l) => l.leaveTypeId === 'LT-CASUAL' || l.leaveTypeCode === 'CL')
    assert.equal(clRecord.utilized, 1.0, 'Utilized must remain strictly 1.0d without double deduction')
    assert.equal(clRecord.availableBalance, 1.5, 'Available must remain strictly 1.5d')

    const summary = leaveBalanceService.getEmployeeBalanceSummary('EMP-005')
    assert.equal(summary.casualUsed, 1.0)
    assert.equal(summary.casualRemaining, 1.5)
  })

  await t.test('3. Dynamic employee creation with approved request immediately posts utilization', () => {
    const testEmpId = 'EMP-006'
    const initialSummary = leaveBalanceService.getEmployeeBalanceSummary(testEmpId)

    // Submit leave request for EMP-006 (Monday weekday)
    const req = leaveService.submitLeaveRequest({
      employeeId: testEmpId,
      leaveTypeId: 'LT-CASUAL',
      startDate: '2026-11-16',
      endDate: '2026-11-16',
      reason: 'Reconciliation test'
    }, { employeeId: testEmpId, role: 'employee', name: 'Usman Ghani' })

    assert.ok(req)

    // Approve the request
    leaveService.approveLeaveRequest(
      req.id,
      'Approved for test',
      { name: 'Bilal Siddiqui', role: 'manager', employeeId: 'EMP-003' },
      'manager',
      'EMP-003'
    )

    const approvedSummary = leaveBalanceService.getEmployeeBalanceSummary(testEmpId)
    assert.equal(approvedSummary.casualUsed, initialSummary.casualUsed + 1.0, 'Utilized must increment by 1.0d')
    assert.equal(approvedSummary.casualRemaining, initialSummary.casualRemaining - 1.0)
  })
})
