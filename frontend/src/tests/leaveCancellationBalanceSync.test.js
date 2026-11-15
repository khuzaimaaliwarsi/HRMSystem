import { describe, it } from 'node:test'
import assert from 'node:assert'
import { leaveService } from '../services/leaveService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'
import { INITIAL_LEAVE_REQUESTS, INITIAL_LEAVE_LEDGER } from '../mocks/leaveData.js'

describe('Aliyan_HRMS — Leave Cancellation & Balance Sync (Persisted & Refresh Resilient)', () => {
  it('1. Persisted LocalStorage Migration: Cancelled LV-202611-002 restores Available to 2.5d and Utilized to 0d', () => {
    // Simulate persistent LocalStorage containing Cancelled LV-202611-002 with unreversed ledger
    const mockStorage = {}
    const mockRequests = JSON.parse(JSON.stringify(INITIAL_LEAVE_REQUESTS))
    const targetReq = mockRequests.find((r) => r.id === 'LV-202611-002')
    assert.ok(targetReq, 'LV-202611-002 must exist in requests')

    // Mark as Cancelled with actor attribution
    targetReq.status = 'Cancelled'
    targetReq.cancelledBy = 'Ahmed Khan (employee)'
    targetReq.cancelledAt = '2026-11-01 14:00:00'
    targetReq.cancellationReason = 'Employee requested cancellation before leave commencement'

    mockStorage['isysware_hrms_f05_leave_requests_v1'] = mockRequests

    // Existing ledger had utilized: 1.0 (unreversed state from browser)
    const mockLedger = JSON.parse(JSON.stringify(INITIAL_LEAVE_LEDGER))
    const cl005 = mockLedger.find((l) => l.employeeId === 'EMP-005' && (l.leaveTypeId === 'LT-CASUAL' || l.leaveTypeCode === 'CL'))
    cl005.openingBalance = 2.5
    cl005.utilized = 1.0
    cl005.closingBalance = 1.5
    cl005.availableBalance = 1.5
    mockStorage['isysware_hrms_f05_leave_ledger_v1'] = mockLedger

    // Configure service storage
    leaveBalanceService.memoryStorage = mockStorage
    leaveService.memoryStorage = mockStorage

    // Reconcile
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')

    const ledgerAfter = leaveBalanceService.getLedger('EMP-005')
    const casual = ledgerAfter.find((l) => l.leaveTypeId === 'LT-CASUAL' || l.leaveTypeCode === 'CL')

    assert.strictEqual(casual.openingBalance, 2.5, 'Casual leave opening balance must be 2.5d')
    assert.strictEqual(casual.utilized, 0.0, 'Cancelled leave must NOT retain utilized days in ledger')
    assert.strictEqual(casual.closingBalance, 2.5, 'Casual leave closing balance must be restored to 2.5d')
    assert.strictEqual(casual.availableBalance, 2.5, 'Casual leave available balance must be restored to 2.5d')
  })

  it('2. Repeated Refresh / Ctrl + F5 Simulation: Balance remains 2.5d and does not revert to 1.5d', () => {
    // Re-run initialization simulating Ctrl + F5 page reload
    leaveBalanceService._initialize()
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')

    const ledgerAfterReload = leaveBalanceService.getLedger('EMP-005')
    const casual = ledgerAfterReload.find((l) => l.leaveTypeId === 'LT-CASUAL' || l.leaveTypeCode === 'CL')

    assert.strictEqual(casual.utilized, 0.0, 'Utilized must remain 0d after page reload / Ctrl+F5')
    assert.strictEqual(casual.availableBalance, 2.5, 'Available must remain 2.5d after page reload / Ctrl+F5')

    // Second reload simulation
    leaveBalanceService._initialize()
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')

    const secondReloadLedger = leaveBalanceService.getLedger('EMP-005')
    const casualSecond = secondReloadLedger.find((l) => l.leaveTypeId === 'LT-CASUAL' || l.leaveTypeCode === 'CL')

    assert.strictEqual(casualSecond.utilized, 0.0, 'Repeated Ctrl+F5 must remain idempotent at 0d utilized')
    assert.strictEqual(casualSecond.availableBalance, 2.5, 'Repeated Ctrl+F5 must remain idempotent at 2.5d available')
  })

  it('3. Calendar Exclusion: Cancelled leave LV-202611-002 is strictly omitted from Company Leave Calendar', () => {
    const events = leaveService.getCalendarEvents({ employeeId: 'EMP-005', role: 'employee' })
    const ahmedCancelledEvent = events.find((e) => e.id === 'LV-202611-002')

    assert.strictEqual(ahmedCancelledEvent, undefined, 'Cancelled leave LV-202611-002 must not appear in Calendar')
  })

  it('4. Reversal Audit Journal: Cancellation Reversal entry is logged with actor and timestamp', () => {
    const journal = leaveBalanceService.getJournal('EMP-005')
    const reversalEntry = journal.find((j) => j.referenceId === 'LV-202611-002' && j.eventType === 'Cancellation Reversal')

    assert.ok(reversalEntry, 'Cancellation Reversal journal entry must exist for LV-202611-002')
    assert.strictEqual(reversalEntry.amount, 1.0, 'Reversal amount must be positive 1.0 day credit')
  })

  it('5. Live Cancel Workflow: Cancelling an Approved leave dynamically credits ledger and sets audit attribution', () => {
    // Reset to clean defaults
    leaveBalanceService.memoryStorage = {}
    leaveService.memoryStorage = {}
    leaveService.resetToDefaults()

    const managerActor = { name: 'Bilal Siddiqui', role: 'manager', employeeId: 'EMP-003' }

    // Initial state: LV-202611-002 is Approved
    const reqInitial = leaveService.getLeaveRequestById('LV-202611-002')
    assert.strictEqual(reqInitial.status, 'Approved')

    // Reconcile approved state
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')
    const initialLedger = leaveBalanceService.getLedger('EMP-005')
    const clInitial = initialLedger.find((l) => l.leaveTypeId === 'LT-CASUAL')
    assert.strictEqual(clInitial.utilized, 1.0, 'Approved leave must have 1.0d utilized')
    assert.strictEqual(clInitial.availableBalance, 1.5, 'Approved leave must leave 1.5d available')

    // Now execute cancel
    const cancelledReq = leaveService.cancelApprovedLeave(
      'LV-202611-002',
      'Client demo rescheduled',
      managerActor
    )

    assert.strictEqual(cancelledReq.status, 'Cancelled')
    assert.strictEqual(cancelledReq.cancelledBy, 'Bilal Siddiqui (manager)')
    assert.ok(cancelledReq.cancelledAt)
    assert.strictEqual(cancelledReq.cancellationReason, 'Client demo rescheduled')

    // Verify ledger balance was dynamically updated
    const afterCancelLedger = leaveBalanceService.getLedger('EMP-005')
    const clAfter = afterCancelLedger.find((l) => l.leaveTypeId === 'LT-CASUAL')
    assert.strictEqual(clAfter.utilized, 0.0, 'Utilized must be restored to 0d upon cancellation')
    assert.strictEqual(clAfter.availableBalance, 2.5, 'Available must be restored to 2.5d upon cancellation')

    // Verify multiple reconciliations do NOT duplicate reverse
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')
    const recheckedLedger = leaveBalanceService.getLedger('EMP-005')
    const clRecheck = recheckedLedger.find((l) => l.leaveTypeId === 'LT-CASUAL')
    assert.strictEqual(clRecheck.utilized, 0.0, 'Reconciliation must be idempotent (0d utilized)')
    assert.strictEqual(clRecheck.availableBalance, 2.5, 'Reconciliation must be idempotent (2.5d available)')
  })
})

