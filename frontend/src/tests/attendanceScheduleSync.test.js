import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceService } from '../services/attendanceService.js'
import { shiftService } from '../services/shiftService.js'
import { employeeService } from '../services/employeeService.js'

test('Attendance Register: Ahmed Raza QA (EMP-016) with active shift QA-SHIFT-01 appears on 2026-10-30 without punches', () => {
  // 1. Ensure employee EMP-016 exists or create them
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

  // 2. Assign shift QA-SHIFT-01 effective 2026-10-30
  try {
    shiftService.assignShiftToEmployee({
      employeeId: 'EMP-016',
      shiftId: 'QA-SHIFT-01',
      effectiveFrom: '2026-10-30',
      effectiveTo: null
    }, 'HR Administrator')
  } catch (err) {
    // Overlapping or already assigned is fine
  }

  // 3. Query Attendance Register for 2026-10-30
  const records = attendanceService.getAttendanceRecords({ date: '2026-10-30' })
  assert.ok(records.length > 0, 'Records should not be empty')

  const ahmedRecord = records.find((r) => r.employeeId === 'EMP-016' && r.date === '2026-10-30')
  assert.ok(ahmedRecord, 'Ahmed Raza QA (EMP-016) must appear in attendance records for 2026-10-30')
  assert.equal(ahmedRecord.shiftId, 'QA-SHIFT-01')
  assert.equal(ahmedRecord.employeeName, 'Ahmed Raza QA')

  // 4. Verify no duplicates upon re-query
  const recordsSecondCall = attendanceService.getAttendanceRecords({ date: '2026-10-30' })
  const matchingRecords = recordsSecondCall.filter((r) => r.employeeId === 'EMP-016' && r.date === '2026-10-30')
  assert.equal(matchingRecords.length, 1, 'There must be exactly 1 attendance entry (no duplicates)')

  // 5. Verify filter by shift QA-SHIFT-01 works
  const filteredByShift = attendanceService.getAttendanceRecords({ date: '2026-10-30', shiftId: 'QA-SHIFT-01' })
  assert.ok(filteredByShift.some((r) => r.employeeId === 'EMP-016'))
})

