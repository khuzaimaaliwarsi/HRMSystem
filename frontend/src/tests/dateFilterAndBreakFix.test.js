import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceService } from '../services/attendanceService.js'
import { shiftService } from '../services/shiftService.js'
import { employeeService } from '../services/employeeService.js'
import {
  getKarachiToday,
  getDateFilterRange,
  sortByDateDescending,
  sortByDateAscending,
  normalizeTimeTo24Hour,
  calculateTimeDuration
} from '../lib/dateUtils.js'

test('Break Calculation: Ahmed Raza QA (EMP-016) with 09:00-18:00 shift and 60m unpaid break synchronizes 8.0h and 60m break', () => {
  // 1. Ensure employee EMP-016 exists
  let emp = employeeService.getEmployeeById('EMP-016')
  if (!emp) {
    emp = employeeService.createEmployee({
      id: 'EMP-016',
      name: 'Ahmed Raza QA',
      email: 'ahmed.raza.qa@isysware.com',
      departmentId: 'DEP-01',
      designationId: 'DES-003',
      joinDate: '2026-10-30',
      status: 'Active'
    }, 'HR Administrator')
  }

  // 2. Ensure QA-SHIFT-01 is assigned with 60m unpaid break
  let shift = shiftService.getShiftById('QA-SHIFT-01')
  if (!shift) {
    shift = shiftService.createShift({
      name: 'QA General Shift',
      code: 'QA-SHIFT-01',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      paidBreak: false,
      expectedWorkingHours: 8.0,
      graceMinutesLate: 15,
      graceMinutesEarly: 15
    }, 'HR Administrator')
  }

  try {
    shiftService.assignShiftToEmployee({
      employeeId: 'EMP-016',
      shiftId: 'QA-SHIFT-01',
      effectiveFrom: '2026-10-30',
      effectiveTo: null
    }, 'HR Administrator')
  } catch (err) {
    // fine if already assigned
  }

  // 3. Simulate existing attendance record for 2026-10-30 with check-in 09:00 and check-out 18:00
  // First clean any prior record
  const records = attendanceService.getAttendanceRecords({ date: '2026-10-30' })
  const target = records.find((r) => r.employeeId === 'EMP-016' && r.date === '2026-10-30')

  assert.ok(target, 'Ahmed Raza QA record must exist for 2026-10-30')

  // Now submit or regularize punches: 09:00 to 18:00
  const correction = attendanceService.submitAttendanceCorrection({
    employeeId: 'EMP-016',
    attendanceDate: '2026-10-30',
    correctionType: 'Missed Punch',
    requestedCheckIn: '09:00',
    requestedCheckOut: '18:00',
    reason: 'QA Testing Shift Attendance Regularization'
  }, 'Ahmed Raza QA')

  // Approve the correction
  attendanceService.approveAttendanceCorrection(correction.id, 'Approved for test', 'Super Admin', 'super_admin')

  // 4. Retrieve updated attendance records
  const updatedRecords = attendanceService.getAttendanceRecords({ date: '2026-10-30' })
  const verifiedRecord = updatedRecords.find((r) => r.employeeId === 'EMP-016' && r.date === '2026-10-30')

  assert.ok(verifiedRecord, 'Record must exist')
  assert.equal(verifiedRecord.checkInTime, '09:00', 'Actual check-in punch must be 09:00')
  assert.equal(verifiedRecord.checkOutTime, '18:00', 'Actual check-out punch must be 18:00')
  assert.equal(verifiedRecord.workedHours, 8.0, 'Worked hours must be exactly 8.0h (9h span - 60m break)')
  assert.equal(verifiedRecord.totalBreakMinutes, 60, 'Total break minutes must be 60m')
  assert.equal(verifiedRecord.hoursVariance, 0.0, 'Variance against 8h target should be 0.0')

  // 5. Verify break is deducted only once (re-querying does not double-deduct break)
  const refetched = attendanceService.getAttendanceRecords({ date: '2026-10-30' })
  const secondCheck = refetched.find((r) => r.employeeId === 'EMP-016' && r.date === '2026-10-30')
  assert.equal(secondCheck.workedHours, 8.0, 'Break must be deducted only once, retaining 8.0h')
  assert.equal(secondCheck.totalBreakMinutes, 60, 'Total break minutes must remain 60m')
})

test('Date Filtering: getDateFilterRange produces valid Asia/Karachi date intervals', () => {
  const today = getKarachiToday()
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'getKarachiToday returns YYYY-MM-DD')

  // Today
  const todayRange = getDateFilterRange('today')
  assert.equal(todayRange.startDate, today)
  assert.equal(todayRange.endDate, today)

  // Yesterday
  const yestRange = getDateFilterRange('yesterday')
  assert.ok(yestRange.startDate < today, 'Yesterday must be earlier than today')
  assert.equal(yestRange.startDate, yestRange.endDate)

  // Last 7 days
  const last7Range = getDateFilterRange('last7')
  assert.ok(last7Range.startDate < today, 'Last 7 days start must be before today')
  assert.equal(last7Range.endDate, today)

  // This Month
  const monthRange = getDateFilterRange('this_month')
  assert.equal(monthRange.startDate, `${today.slice(0, 7)}-01`)
  assert.equal(monthRange.endDate, today)

  // Custom Range
  const customRange = getDateFilterRange('custom', '2026-10-01', '2026-10-15')
  assert.equal(customRange.startDate, '2026-10-01')
  assert.equal(customRange.endDate, '2026-10-15')
})

test('Date Sorting: sortByDateDescending and sortByDateAscending order correctly', () => {
  const items = [
    { id: '1', date: '2026-10-10' },
    { id: '2', date: '2026-10-30' },
    { id: '3', date: '2026-10-01' },
    { id: '4', date: '2026-10-25' }
  ]

  const desc = sortByDateDescending(items, 'date')
  assert.deepEqual(desc.map((x) => x.id), ['2', '4', '1', '3'], 'Latest first descending order')

  const asc = sortByDateAscending(items, 'date')
  assert.deepEqual(asc.map((x) => x.id), ['3', '1', '4', '2'], 'Oldest first ascending order')
})

test('Time Parsing: 12-hour AM/PM and 24-hour conversions preserve exact durations', () => {
  assert.equal(normalizeTimeTo24Hour('09:30 AM'), '09:30')
  assert.equal(normalizeTimeTo24Hour('11:30 AM'), '11:30')
  assert.equal(normalizeTimeTo24Hour('09:30 PM'), '21:30')
  assert.equal(normalizeTimeTo24Hour('12:00 PM'), '12:00')
  assert.equal(normalizeTimeTo24Hour('12:00 AM'), '00:00')

  const dur1 = calculateTimeDuration('09:30 AM', '11:30 AM')
  assert.equal(dur1.totalHours, 2)
  assert.equal(dur1.totalMinutes, 120)
  assert.equal(dur1.formatted, '2h')

  const dur2 = calculateTimeDuration('09:00', '18:00')
  assert.equal(dur2.totalHours, 9)
  assert.equal(dur2.totalMinutes, 540)
  assert.equal(dur2.formatted, '9h')
})
