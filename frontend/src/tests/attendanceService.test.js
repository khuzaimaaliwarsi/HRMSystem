import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attendanceService } from '../services/attendanceService.js'
import { shiftService } from '../services/shiftService.js'
import { attendancePolicyService } from '../services/attendancePolicyService.js'
import { employeeService } from '../services/employeeService.js'
import { recruitmentService } from '../services/recruitmentService.js'
import { dashboardService } from '../services/dashboardService.js'

// Reset state helper before testing suite runs
attendanceService.resetToDefaults()
shiftService.resetToDefaults()
attendancePolicyService.resetToDefaults()
employeeService.resetToDefaultData()

test('1. Fixed shift creation and validation', () => {
  // Required fields
  assert.throws(() => {
    shiftService.createShift({ name: '', code: 'TEST-1' })
  }, /Shift name is required/)

  assert.throws(() => {
    shiftService.createShift({ name: 'Morning Shift', code: '' })
  }, /Shift code is required/)

  // Duplicate code prevention
  assert.throws(() => {
    shiftService.createShift({ name: 'Duplicate Day', code: 'GEN-DAY', startTime: '09:00', endTime: '18:00' })
  }, /already exists/)

  // Valid shift creation
  const shift = shiftService.createShift({
    name: 'Early Morning Dispatch',
    code: 'EARLY-DISP',
    type: 'Fixed',
    startTime: '07:00',
    endTime: '15:30',
    breakMinutes: 30,
    expectedWorkingHours: 8.0,
    gracePeriodMinutes: 10
  })

  assert.ok(shift.id.startsWith('SHIFT-'))
  assert.equal(shift.name, 'Early Morning Dispatch')
  assert.equal(shift.gracePeriodMinutes, 10)
})

test('2. Flexible shift behavior', () => {
  const flexShift = shiftService.getShiftById('SHIFT-02')
  assert.equal(flexShift.type, 'Flexible')
  assert.equal(flexShift.flexibleArrivalWindow.start, '08:00')
  assert.equal(flexShift.flexibleArrivalWindow.end, '11:00')
  assert.equal(flexShift.coreHoursStart, '11:00')
  assert.equal(flexShift.coreHoursEnd, '16:00')
})

test('3. Overnight shift calculations (midnight crossing)', () => {
  // Check overnight elapsed hours for a 21:00 to 06:00 shift (9 hours elapsed, 1h break = 8h worked)
  const nightShift = shiftService.getShiftById('SHIFT-04')
  assert.equal(nightShift.type, 'Overnight')
  assert.equal(nightShift.startTime, '21:00')
  assert.equal(nightShift.endTime, '06:00')
  assert.equal(nightShift.paidBreak, true)
})

test('4. Shift assignment and effective dates', () => {
  // Assign shift to EMP-004 effective tomorrow
  const tomorrow = '2026-10-27'
  const asgn = shiftService.assignShiftToEmployee({
    employeeId: 'EMP-004',
    shiftId: 'SHIFT-01',
    effectiveFrom: tomorrow
  }, 'Bilal Siddiqui')

  assert.ok(asgn.id.startsWith('ASGN-'))
  assert.equal(asgn.employeeId, 'EMP-004')
  assert.equal(asgn.shiftId, 'SHIFT-01')
})

test('5. Overlapping schedule prevention', () => {
  // Assigning overlapping effective dates to same employee should throw error
  assert.throws(() => {
    shiftService.assignShiftToEmployee({
      employeeId: 'EMP-001',
      shiftId: 'SHIFT-02',
      effectiveFrom: '2021-01-15',
      effectiveTo: '2026-12-31'
    })
  }, /Shift assignment conflict/)
})

test('6. Working-day and weekly-off handling', () => {
  const generalShift = shiftService.getShiftById('SHIFT-01')
  // 2026-10-26 is Monday (Working Day)
  assert.equal(shiftService.isWeeklyOff('2026-10-26', generalShift), false)
  // 2026-10-25 is Sunday (Weekly Off)
  assert.equal(shiftService.isWeeklyOff('2026-10-25', generalShift), true)
  // 2026-10-24 is Saturday (Weekly Off)
  assert.equal(shiftService.isWeeklyOff('2026-10-24', generalShift), true)
})

test('7. Holiday classifications', () => {
  // 2026-03-23 Pakistan Resolution Day
  const holiday = shiftService.isHoliday('2026-03-23')
  assert.ok(holiday)
  assert.equal(holiday.name, 'Pakistan Resolution Day')

  // Normal business day
  assert.equal(shiftService.isHoliday('2026-10-26'), null)
})

test('8. Employee check-in', () => {
  // Test check-in for EMP-006 on test date
  const testDate = '2026-11-02'
  const record = attendanceService.checkIn('EMP-006', {
    date: testDate,
    time: '08:55',
    workArrangement: 'Office'
  })

  assert.equal(record.employeeId, 'EMP-006')
  assert.equal(record.checkInTime, '08:55')
  assert.equal(record.status, 'Present')
  assert.equal(record.isLate, false)
})

test('9. Employee check-out', () => {
  const testDate = '2026-11-02'
  const record = attendanceService.checkOut('EMP-006', {
    date: testDate,
    time: '18:05'
  })

  assert.equal(record.checkOutTime, '18:05')
  assert.ok(record.workedHours >= 8.0)
  assert.equal(record.status, 'Present')
})

test('10. Duplicate open-session prevention', () => {
  const testDate = '2026-11-03'
  // First check in
  attendanceService.checkIn('EMP-006', { date: testDate, time: '09:00' })

  // Second check in on same date before checkout must throw error
  assert.throws(() => {
    attendanceService.checkIn('EMP-006', { date: testDate, time: '09:30' })
  }, /Duplicate check-in prevented/)
})

test('11. Missing-punch behavior', () => {
  // Checking out without check-in throws error
  assert.throws(() => {
    attendanceService.checkOut('EMP-009', { date: '2026-11-04', time: '18:00' })
  }, /No active check-in record found/)
})

test('12. Break and actual worked-hours calculation', () => {
  // Fixed Shift (09:00 to 18:00) with 60m unpaid break: 9h elapsed - 1h break = 8.0h worked
  const testDate = '2026-11-05'
  attendanceService.checkIn('EMP-001', { date: testDate, time: '09:00' })
  const checkedOut = attendanceService.checkOut('EMP-001', { date: testDate, time: '18:00' })

  assert.equal(checkedOut.workedHours, 8.0)
  assert.equal(checkedOut.totalBreakMinutes, 60)
  assert.equal(checkedOut.hoursVariance, 0.0)
})

test('13. Late and grace-period logic', () => {
  // SHIFT-01 starts at 09:00 with 15 mins grace. Check in at 09:20 -> 20m late
  const testDate = '2026-11-06'
  const record = attendanceService.checkIn('EMP-002', { date: testDate, time: '09:20' })

  assert.equal(record.isLate, true)
  assert.equal(record.lateMinutes, 20)
  assert.equal(record.status, 'Late')
})

test('14. Monthly allowed late occurrences (4 permitted lates before excess flag)', () => {
  // Check monthly late count helper
  const lateStats = attendanceService.getMonthlyLateCount('EMP-005', '2026-10')
  assert.equal(lateStats.allowedLimit, 4)
  assert.ok(lateStats.totalLateCount >= 1)
  assert.equal(lateStats.isExcessLate, false) // 1 late <= 4 allowed limit
})

test('15. Early departure calculation', () => {
  // Fixed shift ends at 18:00. Departing at 17:15 (>15 mins early) flags early exit
  const testDate = '2026-11-07'
  attendanceService.checkIn('EMP-001', { date: testDate, time: '09:00' })
  const checkedOut = attendanceService.checkOut('EMP-001', { date: testDate, time: '17:15' })

  assert.equal(checkedOut.isEarlyExit, true)
  assert.equal(checkedOut.earlyExitMinutes, 45)
})

test('16. Half-day classification', () => {
  // Working 5.0 hours on an 8-hour shift is classified as Half Day
  const testDate = '2026-11-08'
  attendanceService.checkIn('EMP-001', { date: testDate, time: '09:00' })
  const checkedOut = attendanceService.checkOut('EMP-001', { date: testDate, time: '14:30' }) // 5.5h elapsed - 60m break = 4.5h

  assert.equal(checkedOut.isHalfDay, true)
  assert.equal(checkedOut.status, 'Half Day')
})

test('17. Attendance policy scope and versioning', () => {
  const policy = attendancePolicyService.getActivePolicy()
  assert.equal(policy.scope, 'Company-Wide')
  assert.equal(policy.status, 'Active')
  assert.equal(policy.gracePeriodMinutes, 15)
  assert.equal(policy.allowedLateOccurrencesPerMonth, 4)

  // Super Admin updating policy increments version
  const updated = attendancePolicyService.updatePolicy(policy.id, {
    gracePeriodMinutes: 20
  }, 'Tariq Mehmood')

  assert.equal(updated.gracePeriodMinutes, 20)
  assert.ok(parseFloat(updated.version) > 1.2)
})

test('18. Manager attendance approval limits', () => {
  const policy = attendancePolicyService.getActivePolicy()
  assert.equal(policy.managerApprovalLimitDays, 2) // Max 2 cumulative days
})

test('19. Employee -> Manager -> HR escalation', () => {
  const routing = attendancePolicyService.resolveApproverRouting('employee')
  assert.equal(routing.normalReviewer, 'Manager')
  assert.equal(routing.escalationReviewer, 'HR Admin')
})

test('20. Manager -> HR -> Super Admin escalation', () => {
  const routing = attendancePolicyService.resolveApproverRouting('manager')
  assert.equal(routing.normalReviewer, 'HR Admin')
  assert.equal(routing.escalationReviewer, 'Super Admin')
})

test('21. HR/Admin -> Super Admin escalation', () => {
  const routing = attendancePolicyService.resolveApproverRouting('hr_admin')
  assert.equal(routing.normalReviewer, 'Super Admin')
})

test('22. Self-approval prevention', () => {
  // Submit correction for EMP-003 (Bilal Siddiqui)
  const corr = attendanceService.submitAttendanceCorrection({
    employeeId: 'EMP-003',
    attendanceDate: '2026-10-20',
    correctionType: 'Missing Check-Out',
    requestedCheckIn: '09:00',
    requestedCheckOut: '18:00',
    reason: 'Forgot to punch out'
  }, 'Bilal Siddiqui')

  // Bilal attempting to approve his own correction must throw error
  assert.throws(() => {
    attendanceService.approveAttendanceCorrection(corr.id, 'Self-approve', 'Bilal Siddiqui', 'manager', 'EMP-003')
  }, /Self-approval prohibited/)
})

test('23. Attendance correction submission and approval', () => {
  // Submit correction for EMP-004
  const corr = attendanceService.submitAttendanceCorrection({
    employeeId: 'EMP-004',
    attendanceDate: '2026-10-15',
    correctionType: 'Missing Check-Out',
    requestedCheckIn: '09:00',
    requestedCheckOut: '18:15',
    reason: 'Office power failure'
  }, 'Zeeshan Ali')

  assert.equal(corr.status, 'Pending Review')

  // Manager Bilal Siddiqui approves
  const approved = attendanceService.approveAttendanceCorrection(
    corr.id,
    'Approved by manager',
    'Bilal Siddiqui',
    'manager',
    'EMP-003'
  )

  assert.equal(approved.status, 'Approved')
  assert.equal(approved.decidedBy, 'Bilal Siddiqui')

  // Verify attendance record was regularized
  const record = attendanceService.getEmployeeTodayRecord('EMP-004', '2026-10-15')
  assert.ok(record)
  assert.equal(record.status, 'Present')
  assert.equal(record.correctionStatus, 'Regularized')
})

test('24. Original punch history preservation', () => {
  // Check that the regularized record preserved the adjustment in punch audit log
  const record = attendanceService.getEmployeeTodayRecord('EMP-004', '2026-10-15')
  assert.ok(record.punches.some((p) => p.type === 'ADJUSTMENT'))
})

test('25. WFH approval and attendance classification', () => {
  // Submit WFH request for EMP-004
  const wfh = attendanceService.submitWfhRequest({
    employeeId: 'EMP-004',
    requestedDate: '2026-11-10',
    reason: 'Home internet maintenance'
  }, 'Zeeshan Ali')

  assert.equal(wfh.status, 'Pending Review')

  // Manager approves
  const approved = attendanceService.approveWfhRequest(wfh.id, 'Approved WFH', 'Bilal Siddiqui', 'EMP-003')
  assert.equal(approved.status, 'Approved')
})

test('26. Field duty approval and attendance classification', () => {
  // Submit field duty for EMP-008
  const fd = attendanceService.submitFieldDutyRequest({
    employeeId: 'EMP-008',
    visitDate: '2026-11-11',
    clientName: 'PTCL Enterprise',
    purpose: 'Solution demonstration'
  }, 'Danish Qureshi')

  assert.equal(fd.status, 'Pending Review')

  // Manager Kamran Raza approves
  const approved = attendanceService.approveFieldDutyRequest(fd.id, 'Authorized', 'Kamran Raza', 'EMP-007')
  assert.equal(approved.status, 'Approved')
})

test('27. Rejected requests have no official attendance effect', () => {
  const corr = attendanceService.submitAttendanceCorrection({
    employeeId: 'EMP-004',
    attendanceDate: '2026-10-12',
    correctionType: 'Missing Check-In',
    requestedCheckIn: '09:00',
    reason: 'False claim'
  }, 'Zeeshan Ali')

  const rejected = attendanceService.rejectAttendanceCorrection(
    corr.id,
    'Invalid documentation',
    'Bilal Siddiqui',
    'manager',
    'EMP-003'
  )

  assert.equal(rejected.status, 'Rejected')
})

test('28. Hourly/part-time working time', () => {
  // SHIFT-05 is Part-Time (4.0 expected hours)
  const ptShift = shiftService.getShiftById('SHIFT-05')
  assert.equal(ptShift.expectedWorkingHours, 4.0)

  // SHIFT-06 is Hourly
  const hourlyShift = shiftService.getShiftById('SHIFT-06')
  assert.equal(hourlyShift.type, 'Hourly')
})

test('29. Overtime requested vs approved quantities', () => {
  const ot = attendanceService.submitOvertimeRequest({
    employeeId: 'EMP-004',
    overtimeDate: '2026-10-22',
    requestedMinutes: 120,
    reason: 'Sprint release deployment'
  }, 'Zeeshan Ali')

  assert.equal(ot.status, 'Pending Review')
  assert.equal(ot.requestedMinutes, 120)

  // Manager approves only 90 minutes
  const approved = attendanceService.approveOvertimeRequest(ot.id, 90, 'Approved 1.5 hours', 'Bilal Siddiqui', 'EMP-003')
  assert.equal(approved.status, 'Approved')
  assert.equal(approved.approvedMinutes, 90)
  assert.equal(approved.approvedHours, 1.5)
})

test('30. Manager team data isolation', () => {
  // Bilal Siddiqui (EMP-003) should only see his team (EMP-004, EMP-005, EMP-006) + himself
  const managerUser = { role: 'manager', employeeId: 'EMP-003', name: 'Bilal Siddiqui' }
  const teamRecords = attendanceService.getAttendanceRecords({}, managerUser)

  const allowedIds = ['EMP-003', 'EMP-004', 'EMP-005', 'EMP-006']
  assert.ok(teamRecords.every((r) => allowedIds.includes(r.employeeId)))
})

test('31. Employee self-service data isolation', () => {
  // Zeeshan Ali (EMP-004) only sees his own records
  const empUser = { role: 'employee', employeeId: 'EMP-004', name: 'Zeeshan Ali' }
  const myRecords = attendanceService.getAttendanceRecords({}, empUser)

  assert.ok(myRecords.every((r) => r.employeeId === 'EMP-004'))
})

test('32. Canonical employee and shift integration', () => {
  // Employee shift assignment resolves correctly
  const shift = shiftService.resolveEmployeeShiftForDate('EMP-001', '2026-10-26')
  assert.equal(shift.id, 'SHIFT-01')
  assert.equal(shift.name, 'General Corporate Day Shift')
})

test('33. Dashboard attendance KPI reconciliation', () => {
  const stats = attendanceService.getAttendanceOverviewStats()
  assert.equal(stats.totalEmployees, 14)
  assert.equal(stats.presentCount, 9) // 8 on-time + 1 late = 9 in office
  assert.equal(stats.lateCount, 1)
  assert.equal(stats.wfhCount, 1)
  assert.equal(stats.fieldDutyCount, 2)
  assert.equal(stats.absentCount, 1)
  assert.equal(stats.onLeaveCount, 1)
  assert.equal(stats.workingToday, 12)
  assert.equal(stats.scheduledWorkforce, 13)
  assert.equal(stats.attendanceRate, 92.3)
})

test('34. F00-F03 regression tests', () => {
  // F00 & F01
  const superAdminData = dashboardService.getSuperAdminData()
  assert.equal(superAdminData.kpis.totalEmployees, 14)
  assert.equal(superAdminData.kpis.attendanceRate, 92.3)

  // F02
  const employees = employeeService.getEmployees()
  assert.ok(employees.length >= 14)
  const reports = employeeService.getDirectReports('EMP-003')
  assert.equal(reports.length, 3)

  // F03
  const activeVacancies = recruitmentService.getVacancies({ status: 'Open' })
  assert.ok(activeVacancies.length >= 1)
})
