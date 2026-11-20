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

  it('1. Canonical Routing: OT-261119-001 routes to UAT Dev Manager (EMP-004), not Ali Raza', () => {
    const list = attendanceService.getOvertimeRequests()
    const ot = list.find((o) => o.id === 'OT-261119-001' || o.requestCode === 'OT-261119-001')

    assert.ok(ot, 'OT-261119-001 must exist')
    assert.strictEqual(ot.employeeId, 'EMP-005', 'Target employee must be EMP-005')
    assert.strictEqual(ot.currentApproverId, 'EMP-004', 'Must route to Direct Reporting Team Lead EMP-004')
    assert.strictEqual(ot.approverName, 'UAT Dev Manager', 'Approver name must be UAT Dev Manager, not Ali Raza')
    assert.strictEqual(ot.currentApproverRole, 'Team Lead')
    assert.strictEqual(ot.status, 'Pending Team Lead Review')
    assert.notStrictEqual(ot.approverName, 'Ali Raza', 'Must never display hardcoded Ali Raza')
  })

  it('2. Super Admin Universal Authority: Super Admin can approve pending overtime assigned to Team Lead', () => {
    const approved = attendanceService.approveOvertimeRequest(
      'OT-261119-001',
      120,
      'Super Admin direct operational approval',
      'Super Admin',
      'EMP-001',
      'super_admin'
    )

    assert.strictEqual(approved.status, 'Approved')
    assert.strictEqual(approved.approvedMinutes, 120)
    assert.strictEqual(approved.approvedHours, 2.0)
    assert.ok(approved.decidedBy.includes('Super Admin'), 'DecidedBy must reflect Super Admin')
    assert.ok(approved.approvalHistory.some((h) => h.status === 'Approved' && h.actor.includes('Super Admin')))

    // Verify attendance synchronization
    const records = attendanceService.getAttendanceRecords({ employeeId: 'EMP-005', date: '2026-11-19' })
    const rec = records.find((r) => r.date === '2026-11-19')
    assert.ok(rec, 'Attendance record for 2026-11-19 must be synchronized')
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
})
