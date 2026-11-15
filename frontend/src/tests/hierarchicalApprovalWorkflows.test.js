import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceService } from '../services/attendanceService.js'
import { leaveService } from '../services/leaveService.js'
import { employeeService } from '../services/employeeService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'
import { attendancePolicyService } from '../services/attendancePolicyService.js'

test('Hierarchy Setup: Usman Tariq (EMP-006) reports to Team Lead Zeeshan Ali (EMP-004), who reports to Manager Bilal Siddiqui (EMP-003)', () => {
  const hierarchy = employeeService.getReportingHierarchy('EMP-006')
  assert.ok(hierarchy.length >= 2, 'Hierarchy should have Team Lead and Manager')
  assert.equal(hierarchy[0].role, 'team_lead')
  assert.equal(hierarchy[0].employee.id, 'EMP-004') // Zeeshan Ali
  assert.equal(hierarchy[1].role, 'manager')
  assert.equal(hierarchy[1].employee.id, 'EMP-003') // Bilal Siddiqui
})

test('Attendance Correction: Multi-tier routing (Employee EMP-006 -> Team Lead EMP-004 -> Manager EMP-003)', () => {
  // 1. Usman Tariq (EMP-006) submits a missed punch correction
  const corr = attendanceService.submitAttendanceCorrection({
    employeeId: 'EMP-006',
    attendanceDate: '2026-10-30',
    correctionType: 'Missed Punch',
    requestedCheckIn: '09:00',
    requestedCheckOut: '18:00',
    reason: 'Fingerprint scanner network failure'
  }, 'Usman Tariq')

  assert.equal(corr.status, 'Pending Team Lead Review', 'Initial status for employee with TL should be Pending Team Lead Review')
  assert.equal(corr.currentApproverRole, 'Team Lead')
  assert.equal(corr.currentApproverId, 'EMP-004')

  // 2. Anti-Self-Approval: Usman Tariq cannot approve his own correction
  assert.throws(
    () => attendanceService.approveAttendanceCorrection(corr.id, 'Self approval attempt', 'Usman Tariq', 'team_lead', 'EMP-006'),
    /Self-approval prohibited/,
    'Self-approval must be blocked'
  )

  // 3. Cross-Department Guard: Kamran Raza (EMP-007, Sales) cannot approve Dev correction
  assert.throws(
    () => attendanceService.approveAttendanceCorrection(corr.id, 'Cross dept attempt', 'Kamran Raza', 'manager', 'EMP-007'),
    /Cross-department authorization violation/,
    'Cross-department approval must be blocked'
  )

  // 4. Team Lead (Zeeshan Ali EMP-004) endorses request -> advances to Department Manager
  const endorsed = attendanceService.approveAttendanceCorrection(
    corr.id,
    'Verified punch card log with security gate',
    'Zeeshan Ali',
    'team_lead',
    'EMP-004'
  )

  assert.equal(endorsed.status, 'Pending Manager Review', 'Status must advance to Pending Manager Review')
  assert.equal(endorsed.currentApproverRole, 'Manager')
  assert.ok(endorsed.approvalHistory.some((h) => h.status === 'Endorsed by Team Lead'))

  // 5. Team Lead cannot approve when status is Pending Manager Review
  assert.throws(
    () => attendanceService.approveAttendanceCorrection(corr.id, 'Duplicate TL approval', 'Zeeshan Ali', 'team_lead', 'EMP-004'),
    /Insufficient authority/,
    'Team Lead cannot approve a request requiring Manager approval'
  )

  // 6. Department Manager (Bilal Siddiqui EMP-003) finalizes approval
  const finalized = attendanceService.approveAttendanceCorrection(
    corr.id,
    'Regularized official shift record',
    'Bilal Siddiqui',
    'manager',
    'EMP-003'
  )

  assert.equal(finalized.status, 'Approved')
  assert.equal(finalized.decidedBy, 'Bilal Siddiqui')
  assert.ok(finalized.decidedAt)

  // 7. Verify synchronization with attendance record
  const records = attendanceService.getAttendanceRecords({ date: '2026-10-30' })
  const rec = records.find((r) => r.employeeId === 'EMP-006' && r.date === '2026-10-30')
  assert.ok(rec, 'Attendance record must exist for EMP-006')
  assert.equal(rec.checkInTime, '09:00')
  assert.equal(rec.checkOutTime, '18:00')
  assert.equal(rec.workedHours, 8.0, 'Worked hours calculated deducting unpaid break')
  assert.equal(rec.status, 'Present')

  // 8. Prevent duplicate approval once finalized
  assert.throws(
    () => attendanceService.approveAttendanceCorrection(corr.id, 'Duplicate approval attempt', 'Bilal Siddiqui', 'manager', 'EMP-003'),
    /already finalized/,
    'Cannot re-approve already finalized correction'
  )
})

test('Leave Request: Multi-tier routing & Leave Ledger balance synchronization', () => {
  // 1. Usman Tariq (EMP-006) submits a 2-day leave request
  const leaveReq = leaveService.submitLeaveRequest({
    employeeId: 'EMP-006',
    leaveTypeId: 'LT-CASUAL',
    startDate: '2026-11-10',
    endDate: '2026-11-11',
    reason: 'Family wedding event in Lahore'
  }, 'Usman Tariq')

  assert.equal(leaveReq.status, 'Pending Team Lead Review', 'Initial status for EMP-006 is Pending Team Lead Review')
  assert.equal(leaveReq.currentApproverRole, 'team_lead')
  assert.equal(leaveReq.currentApproverId, 'EMP-004')

  // 2. Anti-Self-Approval
  assert.throws(
    () => leaveService.approveLeaveRequest(leaveReq.id, 'Self approve', 'Usman Tariq', 'team_lead', 'EMP-006'),
    /Self-approval prohibited/,
    'Self approval on leave must be blocked'
  )

  // 3. Team Lead Zeeshan Ali (EMP-004) endorses 2-day leave -> routes to Department Manager
  const endorsed = leaveService.approveLeaveRequest(
    leaveReq.id,
    'Sprint backlog covered by backup developer',
    'Zeeshan Ali',
    'team_lead',
    'EMP-004'
  )

  assert.equal(endorsed.status, 'Pending Manager Review', 'Multi-day leave routes to Manager after TL endorsement')

  // 4. Department Manager Bilal Siddiqui (EMP-003) approves
  const approved = leaveService.approveLeaveRequest(
    leaveReq.id,
    'Authorized department leave',
    'Bilal Siddiqui',
    'manager',
    'EMP-003'
  )

  assert.equal(approved.status, 'Approved')
  assert.equal(approved.integratedWithAttendance, true, 'Integrated with attendance engine')

  // 5. Verify attendance record is marked 'On Leave' on those dates
  const records = attendanceService.getAttendanceRecords({ date: '2026-11-10' })
  const attRecord = records.find((r) => r.employeeId === 'EMP-006')
  assert.ok(attRecord, 'Record must exist on leave date')
  assert.equal(attRecord.status, 'On Leave')
})

test('WFH Approval: 1-Day WFH approved directly by Team Lead without unnecessary escalation', () => {
  const wfh = attendanceService.submitWfhRequest({
    employeeId: 'EMP-006',
    requestedDate: '2026-11-05',
    reason: 'Home utility maintenance work',
    deliverablesPlanned: 'Complete frontend responsive bug fixes'
  }, 'Usman Tariq')

  assert.equal(wfh.status, 'Pending Team Lead Review')

  // Anti-self-approval
  assert.throws(
    () => attendanceService.approveWfhRequest(wfh.id, 'Self approval', 'Usman Tariq', 'EMP-006', 'team_lead'),
    /Self-approval prohibited/
  )

  // Team Lead approves 1-day WFH directly
  const approved = attendanceService.approveWfhRequest(
    wfh.id,
    'Approved for 1 day',
    'Zeeshan Ali',
    'EMP-004',
    'team_lead'
  )

  assert.equal(approved.status, 'Approved')
  assert.equal(approved.decidedBy, 'Zeeshan Ali (Team Lead)')

  // Attendance record updated
  const records = attendanceService.getAttendanceRecords({ date: '2026-11-05' })
  const rec = records.find((r) => r.employeeId === 'EMP-006')
  if (rec) {
    assert.equal(rec.workArrangement, 'WFH')
  }
})

test('Field Duty: Team Lead verifies client details and advances to Manager authorization', () => {
  attendancePolicyService.setFieldDutyApprovalMode('duration_based', { teamLeadMaxHours: 4.0, managerMaxHours: 9.0 })
  const fd = attendanceService.submitFieldDutyRequest({
    employeeId: 'EMP-006',
    visitDate: '2026-11-06',
    clientName: 'Alfalah Bank Tech Hub',
    location: 'Blue Area, Islamabad',
    purpose: 'On-site API integration walkthrough',
    expectedStartTime: '10:00 AM',
    expectedEndTime: '02:00 PM'
  }, 'Usman Tariq')

  assert.equal(fd.status, 'Pending Team Lead Review')

  // Team Lead endorses visit
  const endorsed = attendanceService.approveFieldDutyRequest(
    fd.id,
    'Client NDA and agenda verified',
    'Zeeshan Ali',
    'EMP-004',
    'team_lead'
  )

  assert.equal(endorsed.status, 'Pending Manager Review')

  // Manager finalizes
  const finalized = attendanceService.approveFieldDutyRequest(
    fd.id,
    'Client visit authorized',
    'Bilal Siddiqui',
    'EMP-003',
    'manager'
  )

  assert.equal(finalized.status, 'Approved')
  assert.equal(finalized.expectedStartTime, '10:00')
  assert.equal(finalized.expectedEndTime, '14:00')
  assert.equal(finalized.durationHours, 4)

  // Restore active policy to No Duration Limit
  attendancePolicyService.setFieldDutyApprovalMode('no_limit')
})

test('Overtime: Team Lead verifies hours and updates attendance & payroll hours', () => {
  const ot = attendanceService.submitOvertimeRequest({
    employeeId: 'EMP-006',
    overtimeDate: '2026-10-30',
    requestedMinutes: 90,
    reason: 'Emergency production deployment release'
  }, 'Usman Tariq')

  assert.equal(ot.status, 'Pending Team Lead Review')

  // Team Lead approves <= 120m overtime directly
  const approved = attendanceService.approveOvertimeRequest(
    ot.id,
    90,
    'Overtime approved for release support',
    'Zeeshan Ali',
    'EMP-004',
    'team_lead'
  )

  assert.equal(approved.status, 'Approved')
  assert.equal(approved.approvedHours, 1.5)

  // Verify attendance record has overtimeHours synchronized
  const records = attendanceService.getAttendanceRecords({ date: '2026-10-30' })
  const rec = records.find((r) => r.employeeId === 'EMP-006' && r.date === '2026-10-30')
  assert.ok(rec)
  assert.equal(rec.overtimeHours, 1.5)
})

test('Timesheets Sign-off: Hierarchical timesheet verification and scoping', () => {
  // 1. Team Lead verifies team member timesheet
  const signoff = attendanceService.verifyTimesheetWeek(
    'EMP-006',
    '2026-10-26',
    'Verified logged hours for week 43',
    'Zeeshan Ali',
    'team_lead',
    'EMP-004'
  )

  assert.equal(signoff.status, 'Verified by Team Lead')
  assert.equal(signoff.actorId, 'EMP-004')

  // 2. Anti-Self-Verification: Zeeshan Ali cannot sign off his own timesheet as Team Lead
  assert.throws(
    () => attendanceService.verifyTimesheetWeek('EMP-004', '2026-10-26', 'Self verification', 'Zeeshan Ali', 'team_lead', 'EMP-004'),
    /Self-approval prohibited/
  )

  // 3. Department Manager signs off
  const mgrSignoff = attendanceService.verifyTimesheetWeek(
    'EMP-006',
    '2026-10-26',
    'Manager executive approval for payroll processing',
    'Bilal Siddiqui',
    'manager',
    'EMP-003'
  )

  assert.equal(mgrSignoff.status, 'Signed Off by Manager')
})
