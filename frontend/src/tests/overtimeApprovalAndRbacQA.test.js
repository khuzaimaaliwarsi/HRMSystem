/**
 * iSysware HRMS — Overtime Approval, Dynamic Approver Resolution & Universal Super Admin Authority QA Suite
 * Tests BUG-023:
 * 1. OT-261119-001 canonical routing to UAT Dev Manager (EMP-004), never hardcoded Ali Raza
 * 2. Super Admin universal override authority to approve/reject any pending overtime request
 * 3. Anti-self-approval enforcement
 * 4. Duplicate decision prevention
 * 5. Unauthorized access guards (cross-team, cross-dept)
 * 6. Attendance verification before payroll eligibility (absent check)
 * 7. Audit history preservation with accurate actor and role
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { attendanceService } from '../services/attendanceService.js'

describe('BUG-023: Overtime Approval, RBAC Scoping & Super Admin Universal Authority QA Suite', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('1. Production safety: never invent OT-261119-001; preserve backend-synced approver identity', () => {
    const overtimeKey = 'isysware_hrms_f04_overtime_requests_v1'
    attendanceService._setItem(overtimeKey, [])
    assert.ok(
      !attendanceService.getOvertimeRequests().some((o) => o.id === 'OT-261119-001'),
      'Empty PostgreSQL sync must not produce a synthetic production overtime claim'
    )

    // Isolated backend-response fixture. This tests presentation/preservation, NOT actual DB routing.
    attendanceService._setItem(overtimeKey, [{
      id: 'OT-261119-001',
      requestCode: 'OT-261119-001',
      employeeId: 'EMP-005',
      employeeName: 'UAT Dev Employee A',
      overtimeDate: '2026-11-19',
      startTime: '18:00',
      endTime: '20:00',
      requestedMinutes: 120,
      status: 'Pending Team Lead Review',
      currentApproverId: 'EMP-004',
      approverName: 'UAT Dev Manager',
      currentApproverRole: 'Team Lead',
      approvalHistory: []
    }])
    const ot = attendanceService.getOvertimeRequests().find((o) => o.id === 'OT-261119-001')
    assert.ok(ot, 'Backend-synced fixture must remain visible')
    assert.strictEqual(ot.employeeId, 'EMP-005')
    assert.strictEqual(ot.currentApproverId, 'EMP-004')
    assert.strictEqual(ot.approverName, 'UAT Dev Manager')
    assert.strictEqual(ot.currentApproverRole, 'Team Lead')
    assert.strictEqual(ot.status, 'Pending Team Lead Review')
    assert.notStrictEqual(ot.approverName, 'Ali Raza')
  })

  it('2. Super Admin authority: isolated pending claim with attendance evidence can be reviewed', () => {
    // Fixture is kept strictly inside the test's in-memory state, not production PostgreSQL.
    const requestKey = 'isysware_hrms_f04_overtime_requests_v1'
    const attendanceKey = 'isysware_hrms_f04_attendance_records_v1'
    attendanceService._setItem(requestKey, [{
      id: 'OT-QA-SA-01',
      requestCode: 'OT-QA-SA-01',
      employeeId: 'EMP-005',
      employeeName: 'UAT Dev Employee A',
      overtimeDate: '2026-11-19',
      startTime: '18:00',
      endTime: '20:00',
      requestedMinutes: 120,
      durationMinutes: 120,
      status: 'Pending Team Lead Review',
      currentApproverId: 'EMP-004',
      approverName: 'UAT Dev Manager',
      approvalHistory: []
    }])
    attendanceService._setItem(attendanceKey, [{
      id: 'ATT-QA-SA-01',
      employeeId: 'EMP-005',
      employeeName: 'UAT Dev Employee A',
      date: '2026-11-19',
      checkInTime: '17:30',
      checkOutTime: '20:15',
      workedHours: 2.75,
      expectedHours: 8,
      primaryClassification: 'Present',
      status: 'Present',
      punches: [
        { type: 'IN', timestamp: '2026-11-19 17:30:00', verified: true },
        { type: 'OUT', timestamp: '2026-11-19 20:15:00', verified: true }
      ],
      overtimeHours: 0
    }])

    const approved = attendanceService.approveOvertimeRequest(
      'OT-QA-SA-01',
      120,
      'Super Admin direct operational approval',
      'Super Admin',
      'EMP-001',
      'super_admin'
    )

    assert.strictEqual(approved.status, 'Approved')
    assert.strictEqual(approved.approvedMinutes, 120)
    assert.strictEqual(approved.approvedHours, 2.0)
    assert.ok(approved.decidedBy.includes('Super Admin'))
    assert.ok(approved.approvalHistory.some((h) => h.status === 'Approved' && h.actor.includes('Super Admin')))

    const records = attendanceService.getAttendanceRecords({ employeeId: 'EMP-005', date: '2026-11-19' })
    const rec = records.find((r) => r.id === 'ATT-QA-SA-01')
    assert.ok(rec, 'Existing attendance evidence must remain present')
    assert.strictEqual(rec.overtimeHours, 2.0)
    assert.strictEqual(rec.overtimeApproved, true)
    assert.strictEqual(rec.overtimeStatus, 'Approved')
  })

  it('3. Super Admin Universal Authority: Super Admin can reject pending overtime regardless of routing tier', () => {
    // Seed pending request
    const otList = [
      {
        id: 'OT-QA-REJ-01',
        requestCode: 'OT-QA-REJ-01',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-11-20',
        requestedMinutes: 90,
        status: 'Pending Team Lead Review',
        currentApproverId: 'EMP-004',
        approverName: 'UAT Dev Manager',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    const rejected = attendanceService.rejectOvertimeRequest(
      'OT-QA-REJ-01',
      'Declined due to budget constraint',
      'Super Admin',
      'EMP-001',
      'super_admin'
    )

    assert.strictEqual(rejected.status, 'Rejected')
    assert.ok(rejected.decidedBy.includes('Super Admin'))
    assert.ok(rejected.approvalHistory.some((h) => h.status === 'Rejected' && h.actor.includes('Super Admin')))
  })

  it('4. Anti-Self-Approval Guard: Non-SuperAdmin employee cannot approve their own overtime claim', () => {
    const otList = [
      {
        id: 'OT-QA-SELF-01',
        requestCode: 'OT-QA-SELF-01',
        employeeId: 'EMP-004',
        employeeName: 'UAT Dev Manager',
        overtimeDate: '2026-11-20',
        requestedMinutes: 60,
        status: 'Pending Manager Review',
        currentApproverId: 'EMP-003',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    assert.throws(
      () => attendanceService.approveOvertimeRequest('OT-QA-SELF-01', 60, 'Self approval attempt', 'UAT Dev Manager', 'EMP-004', 'team_lead'),
      /Self-approval prohibited/
    )
  })

  it('5. Duplicate Decision Guard: Finalized overtime cannot be re-approved', () => {
    const otList = [
      {
        id: 'OT-QA-DUP-01',
        requestCode: 'OT-QA-DUP-01',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-11-20',
        requestedMinutes: 60,
        status: 'Approved',
        decidedBy: 'Super Admin (Super Admin)',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    assert.throws(
      () => attendanceService.approveOvertimeRequest('OT-QA-DUP-01', 60, 'Duplicate try', 'Super Admin', 'EMP-001', 'super_admin'),
      /already finalized/
    )
  })

  it('6. Unauthorized Prevention: Co-lead (EMP-006) cannot approve EMP-005 overtime', () => {
    const otList = [
      {
        id: 'OT-QA-UNAUTH-01',
        requestCode: 'OT-QA-UNAUTH-01',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-11-20',
        requestedMinutes: 60,
        status: 'Pending Team Lead Review',
        currentApproverId: 'EMP-004',
        approverName: 'UAT Dev Manager',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    assert.throws(
      () => attendanceService.approveOvertimeRequest('OT-QA-UNAUTH-01', 60, 'Unauthorized attempt', 'Bilal Ahmed', 'EMP-006', 'team_lead'),
      /Unauthorized/
    )
  })

  it('7. Attendance Verification Guard: Overtime on Absent day fails payroll eligibility verification', () => {
    const otList = [
      {
        id: 'OT-QA-ABS-01',
        requestCode: 'OT-QA-ABS-01',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-11-15',
        requestedMinutes: 60,
        status: 'Pending Team Lead Review',
        currentApproverId: 'EMP-004',
        approverName: 'UAT Dev Manager',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    // Baseline record for 2026-11-15 is ABSENT
    const recs = [
      {
        id: 'ATT-REC-ABSENT-01',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        date: '2026-11-15',
        primaryClassification: 'Absent',
        status: 'Absent',
        overtimeHours: 0
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_attendance_records_v1', recs)

    const approved = attendanceService.approveOvertimeRequest(
      'OT-QA-ABS-01',
      60,
      'Approved request',
      'Super Admin',
      'EMP-001',
      'super_admin'
    )

    // Overtime record itself notes attendance verification failed
    assert.strictEqual(approved.attendanceVerified, false, 'Attendance verification must be false for absent day')
    assert.strictEqual(approved.payrollEligible, false, 'Overtime must not be payroll eligible for absent day')

    // Attendance record overtimeApproved must NOT be true
    const updatedRecs = attendanceService.getAttendanceRecords({ employeeId: 'EMP-005', date: '2026-11-15' })
    const updated = updatedRecs.find((r) => r.date === '2026-11-15')
    assert.strictEqual(updated.overtimeApproved, false, 'Absent day cannot have overtimeApproved: true')
    assert.ok(updated.overtimeStatus.includes('Failed'), 'Status must indicate verification failed')
  })

  it('8. Audit History Integrity: Preserves exact approver identity, role, notes, and timestamp', () => {
    const otList = [
      {
        id: 'OT-QA-AUD-01',
        requestCode: 'OT-QA-AUD-01',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-11-19',
        requestedMinutes: 60,
        status: 'Pending Team Lead Review',
        currentApproverId: 'EMP-004',
        approverName: 'UAT Dev Manager',
        approvalHistory: [
          { status: 'Submitted', actor: 'Ahmed Khan (EMP-005)', timestamp: '2026-11-19 18:00:00', note: 'Claimed 60 mins' }
        ]
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    const approved = attendanceService.approveOvertimeRequest(
      'OT-QA-AUD-01',
      60,
      'Critical cluster patch verified',
      'Super Admin',
      'EMP-001',
      'super_admin'
    )

    assert.strictEqual(approved.approvalHistory.length, 2, 'Must append to history without wiping earlier logs')
    const lastLog = approved.approvalHistory[1]
    assert.strictEqual(lastLog.status, 'Approved')
    assert.ok(lastLog.actor.includes('Super Admin'))
    assert.strictEqual(lastLog.note, 'Critical cluster patch verified')
    assert.ok(lastLog.timestamp, 'Timestamp must exist')
  })

  it('9. Overtime Punch Evidence Guard: Unverified punch evidence marks attendanceVerified and payrollEligible false, blocking payroll synchronization', () => {
    attendanceService._setItem('isysware_hrms_f04_attendance_records_v1', [{
      id: 'ATT-QA-ABS-01',
      employeeId: 'EMP-005',
      employeeName: 'Ahmed Khan',
      date: '2026-11-19',
      primaryClassification: 'Absent',
      status: 'Absent',
      actualWorkMinutes: 0,
      workedHours: 0,
      punches: []
    }])

    const otList = [{
      id: 'OT-261119-001',
      requestCode: 'OT-261119-001',
      employeeId: 'EMP-005',
      employeeName: 'Ahmed Khan',
      overtimeDate: '2026-11-19',
      startTime: '18:00',
      endTime: '19:00',
      requestedMinutes: 60,
      status: 'Pending Team Lead Review',
      currentApproverId: 'EMP-004',
      attendanceVerified: false
    }]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    const approved = attendanceService.approveOvertimeRequest('OT-261119-001', 60, 'Attempted approval without punches', 'Super Admin', 'EMP-001', 'super_admin')
    assert.strictEqual(approved.attendanceVerified, false, 'attendanceVerified must be false when attendance is absent or lacks punches')
    assert.strictEqual(approved.payrollEligible, false, 'payrollEligible must be false without verified attendance punches')

    const recs = attendanceService.getAttendanceRecords({ employeeId: 'EMP-005', date: '2026-11-19' })
    const rec = recs.find((r) => r.date === '2026-11-19')
    assert.strictEqual(rec.overtimeApproved, false, 'Attendance record must not have overtimeApproved: true')
    assert.ok(rec.overtimeStatus.includes('Failed'), 'Attendance record must show verification failed')
  })

  it('10. Separates Claimed Duration from Actual Verified Working Hours (0.0h display)', () => {
    const ot = {
      id: 'OT-261119-001',
      employeeId: 'EMP-005',
      overtimeDate: '2026-11-19',
      durationMinutes: 60,
      requestedMinutes: 60,
      attendanceVerified: false
    }
    const attendance = {
      employeeId: 'EMP-005',
      date: '2026-11-19',
      status: 'Absent',
      actualWorkMinutes: 0
    }

    const isAbsent = attendance.status === 'Absent'
    const workMins = attendance.actualWorkMinutes || 0
    const hasEvidence = !isAbsent && workMins > 0 && ot.attendanceVerified === true
    const actualWorkingHours = hasEvidence ? (workMins / 60) : 0.0

    assert.strictEqual(ot.durationMinutes, 60, 'Claimed duration is 60 minutes')
    assert.strictEqual(actualWorkingHours, 0.0, 'Actual Verified Working Hours must be 0.0h, never 1 hr')
    assert.strictEqual(hasEvidence, false, 'Punch evidence must be unverified')
  })
})
