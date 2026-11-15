import test from 'node:test'
import assert from 'node:assert/strict'
import { leaveService } from '../services/leaveService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'

test('1. Calendar Events derivation includes approved leave LV-202611-002 for Ahmed Khan', () => {
  const currentUser = { employeeId: 'EMP-005', name: 'Ahmed Khan', role: 'employee' }
  const events = leaveService.getCalendarEvents(currentUser)

  assert.ok(Array.isArray(events), 'Events should be an array')
  const ahmedLeave = events.find((e) => e.id === 'LV-202611-002')
  assert.ok(ahmedLeave, 'LV-202611-002 must exist in calendar events')
  assert.equal(ahmedLeave.employeeId, 'EMP-005')
  assert.equal(ahmedLeave.startDate, '2026-11-02')
  assert.equal(ahmedLeave.endDate, '2026-11-02')
  assert.equal(ahmedLeave.type, 'leave')
  assert.equal(ahmedLeave.status, 'Approved')
})

test('2. Calendar Events include company-wide approved leaves and public holidays without duplicates', () => {
  const currentUser = { employeeId: 'EMP-004', name: 'Ali Raza', role: 'employee' }
  const events = leaveService.getCalendarEvents(currentUser)

  // Ahmed Khan's approved leave must be visible company-wide on calendar
  const ahmedLeave = events.find((e) => e.id === 'LV-202611-002')
  assert.ok(ahmedLeave, 'Company calendar must show approved leave to peers')
  assert.equal(ahmedLeave.type, 'leave')

  // Holidays must have type 'holiday'
  const holidays = events.filter((e) => e.type === 'holiday')
  assert.ok(holidays.length > 0, 'Public holidays should be mapped in calendar events')

  // Deduplication check
  const idSet = new Set()
  for (const ev of events) {
    assert.ok(!idSet.has(ev.id), `Duplicate event ID encountered: ${ev.id}`)
    idSet.add(ev.id)
  }
})

test('3. Ahmed Khan (EMP-005) Casual Leave reflects 1.5d available without double deduction', () => {
  const balances = leaveBalanceService.getEmployeeBalances('EMP-005')
  const cl = balances.find((b) => b.leaveTypeId === 'LT-CASUAL' || b.leaveTypeCode === 'CL')

  assert.ok(cl, 'Casual leave entry must exist for EMP-005')
  assert.equal(cl.openingBalance, 2.5, 'Opening balance should be 2.5d')
  assert.equal(cl.utilized, 1.0, 'Utilized days should be 1.0d for approved LV-202611-002')
  assert.equal(cl.availableBalance, 1.5, 'Available balance must be exactly 1.5d')

  // Summary check
  const summary = leaveBalanceService.getEmployeeBalanceSummary('EMP-005')
  assert.equal(summary.casualRemaining, 1.5, 'Summary casualRemaining must match ledger available 1.5d')
})

test('4. ReconcileApprovedLeaves is idempotent and safe against repeated calls', () => {
  const beforeJournal = leaveBalanceService.getJournal('EMP-005').length

  // Multiple reconcile calls
  leaveBalanceService.reconcileApprovedLeaves('EMP-005')
  leaveBalanceService.reconcileApprovedLeaves('EMP-005')

  const afterJournal = leaveBalanceService.getJournal('EMP-005').length
  assert.equal(beforeJournal, afterJournal, 'Idempotent reconcile must not generate duplicate journal postings')

  const balances = leaveBalanceService.getEmployeeBalances('EMP-005')
  const cl = balances.find((b) => b.leaveTypeId === 'LT-CASUAL' || b.leaveTypeCode === 'CL')
  assert.equal(cl.availableBalance, 1.5, 'Balance must remain stable at 1.5d')
})

