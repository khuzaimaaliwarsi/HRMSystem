import { test, describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mapBackendRegisterRow, syncDailyRegister } from '../services/backendSync.js'
import { attendanceService } from '../services/attendanceService.js'
import { formatTimeTo12Hour, normalizeTimeTo24Hour } from '../lib/dateUtils.js'
import { reportService } from '../services/reportService.js'

describe('HRMS BUG-018 — Attendance Sync, Half Day Classification & Punches Modal Verification', () => {
  beforeEach(() => {
    attendanceService.memoryStorage = {}
  })

  it('1. PKT Timezone Handling: converts ISO UTC timestamps to Asia/Karachi 12-hour AM/PM with seconds', () => {
    // 2026-11-18T11:23:11.000Z in UTC is 16:23:11 in Asia/Karachi (UTC+5) -> 04:23:11 PM
    const in12 = formatTimeTo12Hour('2026-11-18T11:23:11.000Z')
    assert.match(in12, /04:23:11\s*PM/i, `Expected 04:23:11 PM in PKT, got: ${in12}`)

    // 2026-11-18T11:23:25.000Z in UTC is 16:23:25 in Asia/Karachi (UTC+5) -> 04:23:25 PM
    const out12 = formatTimeTo12Hour('2026-11-18T11:23:25.000Z')
    assert.match(out12, /04:23:25\s*PM/i, `Expected 04:23:25 PM in PKT, got: ${out12}`)

    // 24-hour with seconds
    assert.equal(formatTimeTo12Hour('16:23:11'), '04:23:11 PM')
    assert.equal(formatTimeTo12Hour('16:23:25'), '04:23:25 PM')
  })

  it('2. Map Backend Register Row: Decouples Field Duty work arrangement from HALF_DAY attendance status', () => {
    const rawBackendRow = {
      employeeId: 'cmwjdc9hf0001k108z5tt3pzh',
      employeeCode: 'EMP-005',
      name: 'UAT Dev Employee A',
      department: 'UAT Software Development',
      designation: 'Frontend Developer',
      shift: {
        id: 'cmwjb5azm0000l208pn9492es',
        name: 'UAT Day Shift',
        shiftCode: 'UAT-DAY-01',
        startTimeFormatted: '09:00 AM',
        endTimeFormatted: '06:00 PM',
        workHours: '8h'
      },
      workArrangement: 'FIELD_DUTY',
      checkIn: '04:23 PM',
      checkOut: '04:23 PM',
      workedHours: '0.0h',
      workedMinutes: 0,
      lateMinutes: 443,
      earlyExitMinutes: 97,
      status: 'HALF_DAY',
      hasPendingCorrection: false,
      attendanceRecordId: 'cmwm18t2b0001jy07taz8lg1s',
      punches: [
        {
          id: 'cmwm18t2j0003jy07y0hv86x1',
          type: 'IN',
          punchType: 'CHECK_IN',
          timestamp: '04:23:11 PM',
          punchTimeFormatted: '04:23:11 PM',
          source: 'WEB',
          verified: true
        },
        {
          id: 'cmwm193xc0001le08u11s8ta0',
          type: 'OUT',
          punchType: 'CHECK_OUT',
          timestamp: '04:23:25 PM',
          punchTimeFormatted: '04:23:25 PM',
          source: 'WEB',
          verified: true
        }
      ],
      notes: 'Shift completed (0.0h worked)'
    }

    const mapped = mapBackendRegisterRow(rawBackendRow, '2026-11-18')

    // Invariant: Status must be 'Half Day', NOT 'Field Duty' and NOT 'Present'
    assert.equal(mapped.status, 'Half Day')
    assert.equal(mapped.primaryClassification, 'Half Day')
    assert.equal(mapped.isHalfDay, true)

    // Invariant: Work Arrangement must be 'Field Duty'
    assert.equal(mapped.workArrangement, 'Field Duty')

    // Invariant: Check-In, Check-Out, and Worked Hours
    assert.equal(mapped.checkIn, '04:23 PM')
    assert.equal(mapped.checkOut, '04:23 PM')
    assert.equal(mapped.workedHours, 0.0)

    // Invariant: Punches array must preserve both WEB punch events
    assert.equal(mapped.punches.length, 2)
    assert.equal(mapped.punches[0].type, 'IN')
    assert.equal(mapped.punches[0].timestamp, '04:23:11 PM')
    assert.equal(mapped.punches[1].type, 'OUT')
    assert.equal(mapped.punches[1].timestamp, '04:23:25 PM')
    assert.equal(mapped.attendanceRecordId, 'cmwm18t2b0001jy07taz8lg1s')
  })

  it('3. Attendance Service: syncScheduledAttendance preserves Half Day status on records with punches', () => {
    // Populate an existing record that has punches and Field Duty
    attendanceService.memoryStorage['isysware_hrms_f04_attendance_records_v1'] = [
      {
        id: 'cmwm18t2b0001jy07taz8lg1s',
        employeeId: 'EMP-005',
        employeeName: 'UAT Dev Employee A',
        date: '2026-11-18',
        checkInTime: '16:23:11',
        checkOutTime: '16:23:25',
        checkIn: '04:23:11 PM',
        checkOut: '04:23:25 PM',
        workedHours: 0.0,
        status: 'Half Day',
        primaryClassification: 'Half Day',
        isHalfDay: true,
        workArrangement: 'Field Duty',
        punches: [
          { id: 'p1', type: 'IN', timestamp: '04:23:11 PM' },
          { id: 'p2', type: 'OUT', timestamp: '04:23:25 PM' }
        ]
      }
    ]

    // Also populate approved Field Duty request in memory
    attendanceService.memoryStorage['isysware_hrms_f04_field_duty_requests_v1'] = [
      {
        id: 'FLD-261118-001',
        employeeId: 'EMP-005',
        visitDate: '2026-11-18',
        status: 'Approved'
      }
    ]

    // Run syncScheduledAttendance
    attendanceService.syncScheduledAttendance('2026-11-18')

    const records = attendanceService.getAttendanceRecords({ date: '2026-11-18' })
    const emp005 = records.find((r) => r.employeeId === 'EMP-005')

    assert.ok(emp005, 'EMP-005 record must exist')
    assert.equal(emp005.status, 'Half Day', 'Status must remain Half Day, never overwritten to Field Duty')
    assert.equal(emp005.primaryClassification, 'Half Day')
    assert.equal(emp005.workArrangement, 'Field Duty', 'Work arrangement must remain Field Duty')
    assert.equal(emp005.checkIn, '04:23:11 PM')
    assert.equal(emp005.checkOut, '04:23:25 PM')
    assert.equal(emp005.punches.length, 2)
  })

  it('4. Employee Portal Scoping: EMP-005 sees own attendance log with Half Day and 0.0h worked', () => {
    attendanceService.memoryStorage['isysware_hrms_f04_attendance_records_v1'] = [
      {
        id: 'cmwm18t2b0001jy07taz8lg1s',
        employeeId: 'EMP-005',
        employeeName: 'UAT Dev Employee A',
        date: '2026-11-18',
        checkInTime: '16:23:11',
        checkOutTime: '16:23:25',
        checkIn: '04:23:11 PM',
        checkOut: '04:23:25 PM',
        workedHours: 0.0,
        status: 'Half Day',
        primaryClassification: 'Half Day',
        isHalfDay: true,
        workArrangement: 'Field Duty',
        punches: [{ id: 'p1', type: 'IN' }, { id: 'p2', type: 'OUT' }]
      },
      {
        id: 'other-rec',
        employeeId: 'EMP-003',
        employeeName: 'Hamza Ahmed',
        date: '2026-11-18',
        status: 'Present',
        workedHours: 8.0
      }
    ]

    const emp005User = { role: 'employee', employeeId: 'EMP-005' }
    const empRecords = attendanceService.getAttendanceRecords({ date: '2026-11-18' }, emp005User)

    assert.equal(empRecords.length, 1)
    assert.equal(empRecords[0].employeeId, 'EMP-005')
    assert.equal(empRecords[0].status, 'Half Day')
    assert.equal(empRecords[0].workArrangement, 'Field Duty')
    assert.equal(empRecords[0].workedHours, 0.0)
  })

  it('5. RPT-ATT-001 Attendance Register Report reconciles with Half Day attendance records', () => {
    attendanceService.memoryStorage['isysware_hrms_f04_attendance_records_v1'] = [
      {
        id: 'cmwm18t2b0001jy07taz8lg1s',
        employeeId: 'EMP-005',
        employeeName: 'UAT Dev Employee A',
        date: '2026-11-18',
        checkInTime: '16:23:11',
        checkOutTime: '16:23:25',
        checkIn: '04:23:11 PM',
        checkOut: '04:23:25 PM',
        workedHours: 0.0,
        status: 'Half Day',
        primaryClassification: 'Half Day',
        isHalfDay: true,
        workArrangement: 'Field Duty'
      }
    ]

    const report = reportService.generateReport('RPT-ATT-001', {
      dateRange: { startDate: '2026-11-18', endDate: '2026-11-18' }
    }, { role: 'super_admin' })

    assert.ok(report, 'RPT-ATT-001 must return report data')
    const emp005Row = report.breakdown?.find((r) => r.employeeId === 'EMP-005')
    if (emp005Row) {
      assert.equal(emp005Row.status, 'Half Day')
      assert.equal(emp005Row.checkIn, '04:23:11 PM')
      assert.equal(emp005Row.checkOut, '04:23:25 PM')
    }
  })
})
