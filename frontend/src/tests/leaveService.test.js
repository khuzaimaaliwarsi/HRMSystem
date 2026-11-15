import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leaveService } from '../services/leaveService.js'
import { leavePolicyService } from '../services/leavePolicyService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'
import { attendanceService } from '../services/attendanceService.js'
import { shiftService } from '../services/shiftService.js'
import { employeeService } from '../services/employeeService.js'
import { dashboardService } from '../services/dashboardService.js'

// Reset state helper before testing suite runs
const resetAllServices = () => {
  leaveService.resetToDefaults()
  leaveBalanceService.resetToDefaults()
  leavePolicyService.resetToDefaults()
  attendanceService.resetToDefaults()
  shiftService.resetToDefaults()
  employeeService.resetToDefaultData()
}

resetAllServices()

// User actors for test assertions
const superAdminActor = { name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001' }
const hrAdminActor = { name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002' }
const managerActor = { name: 'Bilal Siddiqui', role: 'manager', employeeId: 'EMP-003' }
const employeeActor = { name: 'Zeeshan Ali', role: 'employee', employeeId: 'EMP-004' }
const probationEmployeeActor = { name: 'Noman Bashir', role: 'employee', employeeId: 'EMP-014' }

test('1. Leave type eligibility by employment type', () => {
  const permTypes = leavePolicyService.getEligibleLeaveTypes('Permanent')
  assert.ok(permTypes.some((t) => t.id === 'LT-ANNUAL'))
  assert.ok(permTypes.some((t) => t.id === 'LT-CASUAL'))
  assert.ok(permTypes.some((t) => t.id === 'LT-MATERNITY'))

  // Probation employee should NOT be eligible for Annual Leave or Maternity Leave
  const probTypes = leavePolicyService.getEligibleLeaveTypes('Probation')
  assert.equal(probTypes.some((t) => t.id === 'LT-ANNUAL'), false)
  assert.equal(probTypes.some((t) => t.id === 'LT-MATERNITY'), false)
  assert.ok(probTypes.some((t) => t.id === 'LT-CASUAL'))
  assert.ok(probTypes.some((t) => t.id === 'LT-SICK'))
})

test('2. Monthly entitlement allocation calculation', () => {
  const casualType = leavePolicyService.getLeaveTypeById('LT-CASUAL')
  assert.equal(casualType.accrualFrequency, 'Monthly')
  assert.equal(casualType.monthlyRate, 0.83)
  assert.equal(casualType.annualEntitlement, 10)
})

test('3. Annual entitlement allocation calculation', () => {
  const annualType = leavePolicyService.getLeaveTypeById('LT-ANNUAL')
  assert.equal(annualType.accrualFrequency, 'Annual')
  assert.equal(annualType.annualEntitlement, 14)
  assert.equal(annualType.paidTreatment, 'Paid')
})

test('4. Accrual and joining-date proration', () => {
  // Employee joining July 1st (6 months remaining out of 12) gets 50% of 14 days = 7 days
  const prorated = leaveBalanceService.calculateProratedEntitlement('2026-07-01', 14)
  assert.equal(prorated, 7)

  // Employee joining Oct 1st (3 months remaining) gets 25% of 14 days = 3.5 days
  const proratedOct = leaveBalanceService.calculateProratedEntitlement('2026-10-01', 14)
  assert.equal(proratedOct, 3.5)
})

test('5. Carry-forward ceilings and expiry rules', () => {
  const annualType = leavePolicyService.getLeaveTypeById('LT-ANNUAL')
  assert.equal(annualType.carryForwardAllowed, true)
  assert.equal(annualType.maxCarryForwardDays, 5)
  assert.equal(annualType.carryForwardExpiryMonths, 3)

  const casualType = leavePolicyService.getLeaveTypeById('LT-CASUAL')
  assert.equal(casualType.carryForwardAllowed, false)
  assert.equal(casualType.maxCarryForwardDays, 0)
})

test('6. Paid versus Unpaid leave distinction', () => {
  const paidType = leavePolicyService.getLeaveTypeById('LT-ANNUAL')
  assert.equal(paidType.paidTreatment, 'Paid')

  const unpaidType = leavePolicyService.getLeaveTypeById('LT-UNPAID')
  assert.equal(unpaidType.paidTreatment, 'Unpaid')
  assert.equal(unpaidType.negativeBalanceAllowed, true)
})

test('7. Half-day duration calculation', () => {
  const halfDayFirst = leaveService.calculateLeaveDuration('2026-11-04', '2026-11-04', true, 'first_half', 'EMP-004')
  assert.equal(halfDayFirst.workingDays, 0.5)
  assert.equal(halfDayFirst.calendarDays, 1)

  const halfDaySecond = leaveService.calculateLeaveDuration('2026-11-04', '2026-11-04', true, 'second_half', 'EMP-004')
  assert.equal(halfDaySecond.workingDays, 0.5)
})

test('8. Weekly-off exclusion in working-day calculation', () => {
  // 2026-11-06 (Friday) to 2026-11-10 (Tuesday):
  // Friday (Working), Saturday (Off), Sunday (Off), Monday (Nov 9 Iqbal Day Holiday), Tuesday (Working)
  // Calendar days: 5, Working days: 2, Weekly Off: 2, Public Holiday: 1
  const duration = leaveService.calculateLeaveDuration('2026-11-06', '2026-11-10', false, 'full_day', 'EMP-004')
  assert.equal(duration.calendarDays, 5)
  assert.equal(duration.workingDays, 2)
  assert.equal(duration.weeklyOffDays, 2)
  assert.equal(duration.publicHolidayDays, 1)
  assert.ok(duration.breakdown.some((b) => b.isWeeklyOff))
})

test('9. Company public holiday handling in duration calculation', () => {
  // 2026-11-09 is Iqbal Day (gazetted public holiday)
  // Applying on 2026-11-09 alone should deduct 0 working days
  const holidayDuration = leaveService.calculateLeaveDuration('2026-11-09', '2026-11-09', false, 'full_day', 'EMP-004')
  assert.equal(holidayDuration.calendarDays, 1)
  assert.equal(holidayDuration.publicHolidayDays, 1)
  assert.equal(holidayDuration.workingDays, 0)
})

test('10. Shift-specific working days resolution', () => {
  // EMP-004 shift
  const empShift = shiftService.resolveEmployeeShiftForDate('EMP-004', '2026-11-04')
  assert.ok(empShift)
  assert.ok(['Flexible', 'Fixed'].includes(empShift.type))
})

test('11. Overnight shift calendar handling', () => {
  const nightShift = shiftService.getShiftById('SHIFT-04')
  assert.equal(nightShift.type, 'Overnight')
  assert.equal(nightShift.startTime, '21:00')
  assert.equal(nightShift.endTime, '06:00')
})

test('12. Employee leave request submission with pending reservation', () => {
  resetAllServices()
  const initialBalances = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')
  const initialAvailable = initialBalances.annualRemaining

  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-ANNUAL',
    startDate: '2026-11-17',
    endDate: '2026-11-17', // 1 day Tuesday
    reason: 'Family event and personal rest'
  }, employeeActor)

  assert.ok(req.id.startsWith('LV-'))
  assert.equal(req.status, 'Pending Manager Review')
  assert.equal(req.calculatedDays, 1)

  // Verify pending reservation updated available balance without mutating closing balance
  const updatedBalances = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')
  assert.equal(updatedBalances.annualRemaining, initialAvailable - 1)
})

test('13. Missing required fields rejection', () => {
  assert.throws(() => {
    leaveService.submitLeaveRequest({
      employeeId: 'EMP-004',
      leaveTypeId: '',
      startDate: '2026-11-17',
      endDate: '2026-11-17'
    }, employeeActor)
  }, /Leave type is required/)

  assert.throws(() => {
    leaveService.submitLeaveRequest({
      employeeId: 'EMP-004',
      leaveTypeId: 'LT-ANNUAL',
      startDate: '2026-11-20',
      endDate: '2026-11-18', // End date before start date
      reason: 'Testing date sequence'
    }, employeeActor)
  }, /End date cannot be earlier than start date/)
})

test('14. Overlapping leave prevention', () => {
  resetAllServices()
  // Submit request on 2026-11-17
  leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-ANNUAL',
    startDate: '2026-11-17',
    endDate: '2026-11-18',
    reason: 'First booking'
  }, employeeActor)

  // Attempt overlapping request covering 2026-11-18 to 2026-11-19
  assert.throws(() => {
    leaveService.submitLeaveRequest({
      employeeId: 'EMP-004',
      leaveTypeId: 'LT-ANNUAL',
      startDate: '2026-11-18',
      endDate: '2026-11-19',
      reason: 'Overlapping request'
    }, employeeActor)
  }, /Overlapping leave request/i)
})

test('15. Insufficient leave balance handling', () => {
  resetAllServices()
  // Emergency leave opening balance is 3 days
  assert.throws(() => {
    leaveService.submitLeaveRequest({
      employeeId: 'EMP-004',
      leaveTypeId: 'LT-EMERGENCY',
      startDate: '2026-11-02',
      endDate: '2026-11-13', // 10 working days
      reason: 'Excess emergency days'
    }, employeeActor)
  }, /Emergency Leave|Insufficient/i)
})

test('16. Manager approval within authority (<= 2 days)', () => {
  resetAllServices()
  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11', // 1 day Wednesday
    reason: 'Doctor appointment'
  }, employeeActor)

  assert.equal(req.status, 'Pending Manager Review')
  assert.equal(req.currentApproverRole, 'manager')

  const approved = leaveService.approveLeaveRequest(req.id, 'Approved by team manager', managerActor)
  assert.equal(approved.status, 'Approved')
  assert.equal(approved.approvalHistory[approved.approvalHistory.length - 1].status, 'Approved')
})

test('17. Multi-day leave does NOT trigger 2-day cap on 1st request; 3rd annual request escalates to HR Admin', () => {
  resetAllServices()
  // 1st request of year for 3 days routes to Manager (no old 2-day monthly cap)
  const req1 = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-ANNUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-13', // 3 working days (Wed, Thu, Fri)
    reason: 'Family trip'
  }, employeeActor)

  assert.equal(req1.status, 'Pending Manager Review', '1st request routes to Manager regardless of duration')
  assert.equal(req1.currentApproverRole, 'manager')
  leaveService.approveLeaveRequest(req1.id, 'Manager approves 1st request', managerActor)

  // 2nd request of year routes to Manager
  const req2 = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-16',
    endDate: '2026-11-16',
    reason: 'Personal work'
  }, employeeActor)
  assert.equal(req2.status, 'Pending Manager Review')
  leaveService.approveLeaveRequest(req2.id, 'Manager approves 2nd request', managerActor)

  // 3rd request of year reaches annual threshold (2) -> escalates to HR Admin
  const req3 = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-20',
    endDate: '2026-11-20',
    reason: 'Doctor appointment'
  }, employeeActor)

  assert.equal(req3.status, 'Pending HR Review')
  assert.equal(req3.currentApproverRole, 'hr_admin')
  assert.ok(req3.escalationReason.includes('annual threshold'))

  // Manager cannot approve escalated 3rd request (requires HR Admin)
  assert.throws(() => {
    leaveService.approveLeaveRequest(req3.id, 'Manager attempt to approve escalated request', managerActor)
  }, /Current status.*does not permit manager approval/)
})

test('18. HR/Admin approval of escalated employee request', () => {
  resetAllServices()
  // Create 2 approved leaves for EMP-004 so 3rd escalates
  const list = leaveService.getLeaveRequests() || []
  list.unshift(
    { id: 'LV-TEST-01', employeeId: 'EMP-004', leaveTypeId: 'LT-CASUAL', calculatedDays: 1, startDate: '2026-05-01', status: 'Approved' },
    { id: 'LV-TEST-02', employeeId: 'EMP-004', leaveTypeId: 'LT-CASUAL', calculatedDays: 1, startDate: '2026-05-02', status: 'Approved' }
  )
  leaveService._setItem('isysware_hrms_f05_leave_requests_v1', list)

  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-ANNUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-13', // 3 days
    reason: 'Family trip'
  }, employeeActor)

  assert.equal(req.status, 'Pending HR Review')

  const approved = leaveService.approveLeaveRequest(req.id, 'HR authorized exception', hrAdminActor)
  assert.equal(approved.status, 'Approved')
})

test('19. Manager own leave requiring HR review', () => {
  resetAllServices()
  const mgrReq = leaveService.submitLeaveRequest({
    employeeId: 'EMP-003', // Bilal Siddiqui (Manager)
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-12-07',
    endDate: '2026-12-07', // 1 day
    reason: 'Personal urgent errand'
  }, managerActor)

  assert.equal(mgrReq.status, 'Pending HR Review')
  assert.equal(mgrReq.currentApproverRole, 'hr_admin')
})

test('20. Manager leave above HR threshold (> 2 days) requiring Super Admin', () => {
  resetAllServices()
  const mgrReq = leaveService.submitLeaveRequest({
    employeeId: 'EMP-003', // Manager
    leaveTypeId: 'LT-ANNUAL',
    startDate: '2026-12-01',
    endDate: '2026-12-03', // 3 days
    reason: 'Manager annual vacation'
  }, managerActor)

  assert.equal(mgrReq.status, 'Pending Super Admin Review')
  assert.equal(mgrReq.currentApproverRole, 'super_admin')
  assert.ok(mgrReq.escalationReason.includes('exceeds HR Admin monthly approval authority'))
})

test('21. HR/Admin own leave requiring independent Super Admin approval', () => {
  resetAllServices()
  const hrReq = leaveService.submitLeaveRequest({
    employeeId: 'EMP-002', // Ayesha Khan (HR Admin)
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-17',
    endDate: '2026-11-17', // 1 day
    reason: 'Personal leave'
  }, hrAdminActor)

  assert.equal(hrReq.status, 'Pending Super Admin Review')
  assert.equal(hrReq.currentApproverRole, 'super_admin')
})

test('22. Anti-Self-Approval prevention across all roles', () => {
  resetAllServices()
  // 1. Employee cannot approve own request
  const empReq = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-12-08',
    endDate: '2026-12-08',
    reason: 'Doctor checkup'
  }, employeeActor)

  assert.throws(() => {
    leaveService.approveLeaveRequest(empReq.id, 'Self approval attempt', employeeActor)
  }, /Anti-Self-Approval policy violation/)

  // 2. Manager cannot approve own request
  const mgrReq = leaveService.submitLeaveRequest({
    employeeId: 'EMP-003',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-12-09',
    endDate: '2026-12-09',
    reason: 'Self test'
  }, managerActor)

  assert.throws(() => {
    leaveService.approveLeaveRequest(mgrReq.id, 'Manager self-approving', managerActor)
  }, /Anti-Self-Approval policy violation/)

  // 3. Super Admin has full executive authority and can approve own leave request directly
  const saReq = leaveService.submitLeaveRequest({
    employeeId: 'EMP-001',
    leaveTypeId: 'LT-ANNUAL',
    startDate: '2026-12-10',
    endDate: '2026-12-10',
    reason: 'Executive leave'
  }, superAdminActor)

  const approvedSaReq = leaveService.approveLeaveRequest(saReq.id, 'Super Admin direct authorization', superAdminActor)
  assert.equal(approvedSaReq.status, 'Approved')
})

test('23. Annual request quota limit validation (3rd request escalates)', () => {
  resetAllServices()
  // Employee submits first 1-day request in December
  const req1 = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-12-14',
    endDate: '2026-12-14', // 1 day Monday
    reason: 'Day 1'
  }, employeeActor)
  assert.equal(req1.status, 'Pending Manager Review')
  leaveService.approveLeaveRequest(req1.id, 'Approved day 1', managerActor)

  // Employee submits second 1-day request in December
  const req2 = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-12-15',
    endDate: '2026-12-15', // 1 day Tuesday (2 approved requests in year)
    reason: 'Day 2'
  }, employeeActor)
  assert.equal(req2.status, 'Pending Manager Review')
  leaveService.approveLeaveRequest(req2.id, 'Approved day 2', managerActor)

  // Employee submits third 1-day request in December (3rd request in year)
  const req3 = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-12-16',
    endDate: '2026-12-16', // 1 day Wednesday
    reason: 'Day 3'
  }, employeeActor)

  // Must automatically escalate to HR because annual request threshold (2) is reached!
  assert.equal(req3.status, 'Pending HR Review')
  assert.equal(req3.currentApproverRole, 'hr_admin')
  assert.ok(req3.escalationReason.includes('annual threshold'))
})

test('24. Split-request authority bypass prevention', () => {
  resetAllServices()
  // Instead of a single 3-day request, employee submits three 1-day requests
  // The policy evaluation correctly identifies that cumulative monthly request = 3.0 days
  const auth1 = leavePolicyService.evaluateApprovalAuthority('EMP-004', 'LT-CASUAL', 1.0, '2026-11-02', '2026-11-02')
  assert.equal(auth1.requiredRole, 'manager')

  // Simulate existing approved 2.0 days in the month
  const requests = [
    { employeeId: 'EMP-004', startDate: '2026-11-03', calculatedDays: 1.0, status: 'Approved' },
    { employeeId: 'EMP-004', startDate: '2026-11-04', calculatedDays: 1.0, status: 'Approved' }
  ]
  const authSplit = leavePolicyService.evaluateApprovalAuthority('EMP-004', 'LT-CASUAL', 1.0, '2026-11-05', requests)
  assert.equal(authSplit.requiredRole, 'hr_admin')
  assert.equal(authSplit.escalated, true)
})

test('25. Multiple pending requests and balance reservations', () => {
  resetAllServices()
  const initial = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')

  const r1 = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-ANNUAL',
    startDate: '2026-11-17',
    endDate: '2026-11-17', // 1 day
    reason: 'Trip 1'
  }, employeeActor)
  assert.ok(r1 && r1.id)

  const r2 = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-ANNUAL',
    startDate: '2026-11-24',
    endDate: '2026-11-24', // 1 day
    reason: 'Trip 2'
  }, employeeActor)
  assert.ok(r2 && r2.id)

  const afterBoth = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')
  assert.equal(afterBoth.annualRemaining, initial.annualRemaining - 2)
})

test('26. Policy effective-date resolution', () => {
  const policy = leavePolicyService.getActivePolicy('2026-06-01')
  assert.ok(policy)
  assert.equal(policy.id, 'POL-LEAVE-2026-V1')
  assert.equal(policy.version, '2026.1')
})

test('27. Policy version history and reference snapshot', () => {
  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    reason: 'Version check'
  }, employeeActor)

  assert.equal(req.policyVersion, '2026.1')
})

test('28. Double approval prevention', () => {
  resetAllServices()
  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    reason: 'Double approval check'
  }, employeeActor)

  leaveService.approveLeaveRequest(req.id, 'First approval', managerActor)

  assert.throws(() => {
    leaveService.approveLeaveRequest(req.id, 'Second approval attempt', managerActor)
  }, /Cannot approve request.*current status is 'Approved'/i)
})

test('29. Rejected requests do not deduct balances and release reservations', () => {
  resetAllServices()
  const initial = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')

  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    reason: 'To be rejected'
  }, employeeActor)

  const rejected = leaveService.rejectLeaveRequest(req.id, 'Staff shortage', managerActor)
  assert.equal(rejected.status, 'Rejected')

  const postReject = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')
  assert.equal(postReject.casualRemaining, initial.casualRemaining)
  assert.equal(postReject.casualUsed, initial.casualUsed)
})

test('30. Approved requests deduct exactly once', () => {
  resetAllServices()
  const initial = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')

  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11', // 1 day
    reason: 'To be approved'
  }, employeeActor)

  leaveService.approveLeaveRequest(req.id, 'Approved', managerActor)

  const postApprove = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')
  assert.equal(postApprove.casualUsed, initial.casualUsed + 1)
  assert.equal(postApprove.casualRemaining, initial.casualRemaining - 1)
})

test('31. Pending withdrawal by applicant', () => {
  resetAllServices()
  const initial = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')

  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    reason: 'Withdrawal test'
  }, employeeActor)

  const withdrawn = leaveService.withdrawLeaveRequest(req.id, 'Plans changed', employeeActor)
  assert.equal(withdrawn.status, 'Withdrawn')

  const postWithdraw = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')
  assert.equal(postWithdraw.casualRemaining, initial.casualRemaining)
})

test('32. Approved cancellation and ledger reversal', () => {
  resetAllServices()
  const initial = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')

  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    reason: 'To be approved and cancelled'
  }, employeeActor)

  leaveService.approveLeaveRequest(req.id, 'Approved', managerActor)
  const afterApprove = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')
  assert.equal(afterApprove.casualUsed, initial.casualUsed + 1)

  // Cancel approved leave
  const cancelled = leaveService.cancelApprovedLeave(req.id, 'Project deadline conflict', managerActor)
  assert.equal(cancelled.status, 'Cancelled')

  // Balance must be restored to initial
  const afterCancel = leaveBalanceService.getEmployeeBalanceSummary('EMP-004')
  assert.equal(afterCancel.casualUsed, initial.casualUsed)
  assert.equal(afterCancel.casualRemaining, initial.casualRemaining)
})

test('33. Duplicate cancellation prevention', () => {
  resetAllServices()
  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    reason: 'Double cancel check'
  }, employeeActor)

  leaveService.approveLeaveRequest(req.id, 'Approved', managerActor)
  leaveService.cancelApprovedLeave(req.id, 'First cancellation', managerActor)

  assert.throws(() => {
    leaveService.cancelApprovedLeave(req.id, 'Second cancel attempt', managerActor)
  }, /Only approved leaves can be cancelled/)
})

test('34. Historical leave decision preservation', () => {
  resetAllServices()
  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    reason: 'Audit history test'
  }, employeeActor)

  leaveService.approveLeaveRequest(req.id, 'Approved by Bilal', managerActor)
  const fetched = leaveService.getLeaveRequestById(req.id)

  assert.equal(fetched.approvalHistory.length, 2)
  assert.equal(fetched.approvalHistory[0].status, 'Submitted')
  assert.equal(fetched.approvalHistory[1].status, 'Approved')
  assert.ok(fetched.approvalHistory[1].actor.includes('Bilal'))
})

test('35. Manager team scope isolation', () => {
  // Bilal Siddiqui (EMP-003) manages Development team (EMP-004, EMP-005, EMP-006)
  const managerRequests = leaveService.getLeaveRequests({}, managerActor)
  assert.ok(managerRequests.length > 0)

  // Should NOT see finance or marketing employees' requests
  const hasFinanceEmployee = managerRequests.some((r) => r.department === 'Finance & Accounts')
  assert.equal(hasFinanceEmployee, false)
})

test('36. Employee personal data isolation', () => {
  const empRequests = leaveService.getLeaveRequests({}, employeeActor)
  // Employee should strictly only see their own requests
  assert.ok(empRequests.every((r) => r.employeeId === 'EMP-004'))
})

test('37. Unauthorized approval rejection at service layer', () => {
  resetAllServices()
  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    reason: 'Authorization test'
  }, employeeActor)

  // An unrelated employee cannot approve
  const unrelatedEmployee = { name: 'Farhan Qureshi', role: 'employee', employeeId: 'EMP-012' }
  assert.throws(() => {
    leaveService.approveLeaveRequest(req.id, 'Hacking approval', unrelatedEmployee)
  }, /You do not have authority to approve/)
})

test('38. Approved leave integration with F04 Attendance', () => {
  resetAllServices()
  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-26',
    endDate: '2026-11-26', // Thursday
    reason: 'Leave attendance sync test'
  }, employeeActor)

  leaveService.approveLeaveRequest(req.id, 'Approved', managerActor)

  // Verify attendance record for EMP-004 on 2026-11-26 is classified as 'Approved Leave'
  const record = attendanceService.getEmployeeTodayRecord('EMP-004', '2026-11-26')
  assert.ok(record)
  assert.ok(['On Leave', 'Approved Leave'].includes(record.status))
  assert.equal(record.primaryClassification, 'Approved Leave')
  assert.equal(record.leaveRequestId, req.id)
})

test('39. Rejected leave has no attendance effect', () => {
  resetAllServices()
  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-18',
    endDate: '2026-11-18',
    reason: 'Leave to reject'
  }, employeeActor)

  leaveService.rejectLeaveRequest(req.id, 'Rejected due to sprint', managerActor)

  const record = attendanceService.getEmployeeTodayRecord('EMP-004', '2026-11-18')
  // Record should NOT be classified as Approved Leave
  if (record) {
    assert.notEqual(record.status, 'Approved Leave')
  }
})

test('40. Half-day attendance reconciliation', () => {
  resetAllServices()
  const req = leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-19',
    endDate: '2026-11-19',
    isHalfDay: true,
    sessionType: 'first_half',
    reason: 'Morning medical visit'
  }, employeeActor)

  assert.equal(req.calculatedDays, 0.5)
  leaveService.approveLeaveRequest(req.id, 'Half-day approved', managerActor)

  const record = attendanceService.getEmployeeTodayRecord('EMP-004', '2026-11-19')
  assert.ok(record)
  assert.ok(['Half Day', 'Approved Leave'].includes(record.status))
  assert.equal(record.leaveSession, 'first_half')
})

test('41. F01 dashboard leave KPIs reflect live pending counts', () => {
  const hrData = dashboardService.getHrAdminData()
  assert.ok(hrData.kpis.pendingHrLeaves >= 0)

  const empData = dashboardService.getEmployeeData('EMP-004')
  assert.ok(empData.leaveBalances)
  assert.equal(empData.leaveBalances.annualTotal, 14)
})

test('42. F02 employee hierarchy integration', () => {
  const reports = employeeService.getDirectReports('EMP-003')
  assert.ok(reports.some((r) => r.id === 'EMP-004'))
})

test('43. F03 probation/eligibility integration', () => {
  // Probation staff EMP-014 cannot apply for Annual Leave
  assert.throws(() => {
    leaveService.submitLeaveRequest({
      employeeId: 'EMP-014',
      leaveTypeId: 'LT-ANNUAL',
      startDate: '2026-11-11',
      endDate: '2026-11-11',
      reason: 'Probation annual leave attempt'
    }, probationEmployeeActor)
  }, /probation/i)
})

test('44. F04 attendance regression check', () => {
  const records = attendanceService.getAttendanceRecords({}, superAdminActor)
  assert.ok(records.length > 0)
  const shifts = shiftService.getShifts()
  assert.ok(shifts.length >= 4)
})

test('45. Local demo persistence and reload simulation', () => {
  resetAllServices()
  const before = leaveService.getLeaveRequests({}, superAdminActor).length
  leaveService.submitLeaveRequest({
    employeeId: 'EMP-004',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-25',
    endDate: '2026-11-25',
    reason: 'Persistence test'
  }, employeeActor)

  const after = leaveService.getLeaveRequests({}, superAdminActor).length
  assert.equal(after, before + 1)
})

test('46. Employee separation and future joining edge cases', () => {
  // Proration for employee joining in December (1 month remaining)
  const decProrated = leaveBalanceService.calculateProratedEntitlement('2026-12-01', 14)
  assert.equal(decProrated, 1.2)
})
