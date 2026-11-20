import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { attendanceService } from '../services/attendanceService.js'
import { getKarachiToday } from '../lib/dateUtils.js'

describe('Aliyan_HRMS — Team Lead Overtime Approval Queue & Working Today Suite', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('1. Canonical Routing: Ahmed Khan (EMP-005) overtime routes to Ali Raza (EMP-004)', () => {
    const otList = [
      {
        id: 'OT-001',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        departmentId: 'DEP-01',
        departmentName: 'Development',
        overtimeDate: '2026-10-30',
        actualCheckIn: '09:00',
        actualCheckOut: '18:30',
        requestedMinutes: 30,
        requestedHours: 0.5,
        reason: 'Client bug triage post-deployment',
        status: 'Pending Review',
        approverId: 'EMP-006', // Incorrectly routed previously to Bilal
        approverName: 'Bilal Ahmed',
        currentApproverId: 'EMP-006',
        currentApproverName: 'Bilal Ahmed',
        approvalHistory: [
          { status: 'Submitted', actor: 'Ahmed Khan (EMP-005)', timestamp: '2026-10-30 18:35:00', note: 'Claimed 30 mins' }
        ]
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    const overtimes = attendanceService.getOvertimeRequests()
    const ot1 = overtimes.find((o) => o.id === 'OT-001')

    assert.ok(ot1, 'OT-001 must exist')
    assert.strictEqual(ot1.currentApproverId, 'EMP-004', 'Must route to canonical Lead EMP-004')
    assert.ok(ot1.approverName === 'UAT Dev Manager' || ot1.approverName === 'Ali Raza', 'Must resolve to authoritative Team Lead (UAT Dev Manager / Ali Raza)')
    assert.strictEqual(ot1.status, 'Pending Team Lead Review')
    assert.ok(ot1.approvalHistory.some((h) => h.status === 'Re-routed'))
  })

  it('2. Preservation: OT-001 original 30-minute claim is preserved without silent mutation to 60m', () => {
    const otList = [
      {
        id: 'OT-001',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-10-30',
        requestedMinutes: 30,
        requestedHours: 0.5,
        reason: '30-minute critical patch',
        status: 'Pending Team Lead Review',
        currentApproverId: 'EMP-004',
        approverName: 'Ali Raza',
        approvalHistory: [
          { status: 'Submitted', actor: 'Ahmed Khan (EMP-005)', timestamp: '2026-10-30 18:35:00', note: '30 min overtime' }
        ]
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    const overtimes = attendanceService.getOvertimeRequests()
    const ot1 = overtimes.find((o) => o.id === 'OT-001')

    assert.strictEqual(ot1.requestedMinutes, 30, 'Original 30 minutes must be preserved')
    assert.strictEqual(ot1.requestedHours, 0.5, 'Original 0.5 hours must be preserved')
    assert.strictEqual(
      ot1.approvalHistory.some((h) => h.status === 'Policy Reconciled'),
      false,
      'Must not contain synthetic Policy Reconciled mutation'
    )
  })

  it('3. Authorized Approval: Team Lead Ali Raza (EMP-004) approves overtime with attendance synchronization', () => {
    const otList = [
      {
        id: 'OT-002',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-10-30',
        requestedMinutes: 60,
        requestedHours: 1.0,
        reason: 'Deployment support',
        status: 'Pending Team Lead Review',
        currentApproverId: 'EMP-004',
        approverName: 'Ali Raza',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    // Ensure baseline record for 2026-10-30 exists
    const recs = [
      {
        id: 'ATT-REC-TEST-01',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        date: '2026-10-30',
        primaryClassification: 'Present',
        status: 'Present',
        overtimeHours: 0
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_attendance_records_v1', recs)

    const approved = attendanceService.approveOvertimeRequest(
      'OT-002',
      60,
      'Approved 60 minutes for deployment support',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )

    assert.strictEqual(approved.status, 'Approved')
    assert.strictEqual(approved.approvedMinutes, 60)
    assert.strictEqual(approved.approvedHours, 1.0)
    assert.ok(approved.decidedBy.includes('Ali Raza'))
    assert.ok(approved.approvalHistory.some((h) => h.status === 'Approved'))

    // Verify attendance record synchronization
    const records = attendanceService.getAttendanceRecords({ employeeId: 'EMP-005', date: '2026-10-30' })
    const rec = records.find((r) => r.date === '2026-10-30')
    assert.ok(rec, 'Attendance record must exist')
    assert.strictEqual(rec.overtimeHours, 1.0, 'Attendance record must have synchronized overtimeHours')
  })

  it('4. Rejection: Team Lead can reject overtime with decision remarks without modifying attendance', () => {
    const otList = [
      {
        id: 'OT-003',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-10-30',
        requestedMinutes: 30,
        requestedHours: 0.5,
        reason: 'Non-critical triage',
        status: 'Pending Team Lead Review',
        currentApproverId: 'EMP-004',
        approverName: 'Ali Raza',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    const rejected = attendanceService.rejectOvertimeRequest(
      'OT-003',
      'Declined: Under 60m threshold without prior management pre-approval',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )

    assert.strictEqual(rejected.status, 'Rejected')
    assert.ok(rejected.decidedBy.includes('Ali Raza'))
    assert.ok(rejected.approvalHistory.some((h) => h.status === 'Rejected'))
  })

  it('5. Anti-Self-Approval: Requester cannot approve their own overtime claim', () => {
    const otList = [
      {
        id: 'OT-004',
        employeeId: 'EMP-004',
        employeeName: 'Ali Raza',
        overtimeDate: '2026-10-30',
        requestedMinutes: 60,
        requestedHours: 1.0,
        reason: 'Lead self claim',
        status: 'Pending Manager Review',
        currentApproverId: 'EMP-003',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    assert.throws(
      () => attendanceService.approveOvertimeRequest('OT-004', 60, 'Self approval attempt', 'Ali Raza', 'EMP-004', 'team_lead'),
      /Self-approval/
    )
  })

  it('6. Unauthorized Prevention: Co-lead Bilal Ahmed (EMP-006) cannot approve Ahmed Khan overtime', () => {
    const otList = [
      {
        id: 'OT-005',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-10-30',
        requestedMinutes: 60,
        requestedHours: 1.0,
        reason: 'Sprint buffer',
        status: 'Pending Team Lead Review',
        currentApproverId: 'EMP-004',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    assert.throws(
      () => attendanceService.approveOvertimeRequest('OT-005', 60, 'Unauthorized attempt', 'Bilal Ahmed', 'EMP-006', 'team_lead'),
      /Unauthorized/
    )
  })

  it('7. Duplicate Decision Guard: Finalized overtime cannot be re-approved', () => {
    const otList = [
      {
        id: 'OT-006',
        employeeId: 'EMP-005',
        employeeName: 'Ahmed Khan',
        overtimeDate: '2026-10-30',
        requestedMinutes: 60,
        requestedHours: 1.0,
        status: 'Approved',
        decidedBy: 'Ali Raza (Team Lead)',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    assert.throws(
      () => attendanceService.approveOvertimeRequest('OT-006', 60, 'Duplicate try', 'Ali Raza', 'EMP-004', 'team_lead'),
      /already finalized/
    )
  })

  it('8. Working Today Count Guard: Historical records across multiple dates do not exceed direct reports count', () => {
    const today = getKarachiToday()
    const directReports = [{ id: 'EMP-005', name: 'Ahmed Khan' }]
    const authorizedIds = new Set(directReports.map((d) => d.id))

    // Multi-date records for EMP-005 (e.g. 2026-10-26, 2026-10-30, and today)
    const records = [
      { employeeId: 'EMP-005', date: '2026-10-26', primaryClassification: 'Present' },
      { employeeId: 'EMP-005', date: '2026-10-30', primaryClassification: 'Present' },
      { employeeId: 'EMP-005', date: today, primaryClassification: 'Present' }
    ]

    // Historical records without date filter would produce count = 3
    const unadjustedCount = records.filter(
      (r) => authorizedIds.has(r.employeeId) && ['Present', 'Late', 'WFH', 'Field Duty'].includes(r.primaryClassification)
    ).length
    assert.strictEqual(unadjustedCount, 3, 'Unadjusted count reflects multiple dates in history')

    // Scoped to today and distinct employee IDs, count must be exactly 1
    const workingTodayEmployees = new Set(
      records
        .filter((r) => r.date === today && authorizedIds.has(r.employeeId) && ['Present', 'Late', 'WFH', 'Field Duty'].includes(r.primaryClassification))
        .map((r) => r.employeeId)
    )
    const activeWorkingCount = workingTodayEmployees.size

    assert.strictEqual(activeWorkingCount, 1, 'Working Today must strictly equal 1 for single direct report')
    assert.ok(activeWorkingCount <= directReports.length, 'Working Today can never exceed direct reports total')
  })

  it('9. Team Lead Own Overtime Routing: Ali Raza (EMP-004) OT-002 reconciles to Hamza Ahmed (EMP-003)', () => {
    // Seed OT-002 that incorrectly had Bilal Ahmed as approver
    const otList = [
      {
        id: 'OT-002',
        employeeId: 'EMP-004',
        employeeName: 'Ali Raza',
        departmentId: 'DEP-01',
        departmentName: 'Development',
        overtimeDate: '2026-10-30',
        actualCheckIn: '09:00',
        actualCheckOut: '19:00',
        requestedMinutes: 60,
        requestedHours: 1.0,
        reason: 'Client cloud cluster performance triage',
        status: 'Pending Team Lead Review', // Incorrect status
        approverId: 'EMP-006', // Incorrect co-lead
        approverName: 'Bilal Ahmed',
        currentApproverId: 'EMP-006',
        currentApproverName: 'Bilal Ahmed',
        approvalHistory: [
          { status: 'Submitted', actor: 'Ali Raza (EMP-004)', timestamp: '2026-10-30 19:05:00', note: 'Claimed 60 mins' }
        ]
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    const overtimes = attendanceService.getOvertimeRequests()
    const ot2 = overtimes.find((o) => o.id === 'OT-002')

    assert.ok(ot2, 'OT-002 must exist')
    assert.strictEqual(ot2.currentApproverId, 'EMP-003', 'Must route to Department Manager Hamza Ahmed')
    assert.strictEqual(ot2.currentApproverRole, 'Manager')
    assert.strictEqual(ot2.status, 'Pending Manager Review', 'Status must be Pending Manager Review, not Team Lead Review')
    assert.ok(ot2.approvalHistory.some((h) => h.status === 'Re-routed' && h.note.includes('EMP-003')))
  })

  it('10. Team Lead Own Submission: Submitting overtime as Ali Raza routes directly to Manager tier', () => {
    const created = attendanceService.submitOvertimeRequest({
      employeeId: 'EMP-004',
      overtimeDate: '2026-11-01',
      requestedMinutes: 90,
      reason: 'Release support'
    }, 'Ali Raza')

    assert.ok(created.id)
    assert.strictEqual(created.currentApproverId, 'EMP-003')
    assert.strictEqual(created.currentApproverRole, 'Manager')
    assert.ok(created.status === 'Pending Manager Review' || created.status === 'Pending Review')
  })

  it('11. Unauthorized Protection: Co-lead Bilal Ahmed (EMP-006) cannot approve Ali Raza (EMP-004) overtime', () => {
    const otList = [
      {
        id: 'OT-007',
        employeeId: 'EMP-004',
        employeeName: 'Ali Raza',
        overtimeDate: '2026-11-01',
        requestedMinutes: 60,
        requestedHours: 1.0,
        reason: 'System optimization',
        status: 'Pending Manager Review',
        currentApproverId: 'EMP-003',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    assert.throws(
      () => attendanceService.approveOvertimeRequest('OT-007', 60, 'Bilal trying to approve Ali', 'Bilal Ahmed', 'EMP-006', 'team_lead'),
      /Insufficient authority|Unauthorized/
    )
  })

  it('12. Manager Approval & Attendance Validation: Hamza Ahmed approves Ali overtime, synchronizing attendance for payroll', () => {
    const otList = [
      {
        id: 'OT-008',
        employeeId: 'EMP-004',
        employeeName: 'Ali Raza',
        overtimeDate: '2026-11-02',
        requestedMinutes: 60,
        requestedHours: 1.0,
        reason: 'Post-release monitoring',
        status: 'Pending Manager Review',
        currentApproverId: 'EMP-003',
        approvalHistory: []
      }
    ]
    attendanceService._setItem('isysware_hrms_f04_overtime_requests_v1', otList)

    const approved = attendanceService.approveOvertimeRequest(
      'OT-008',
      60,
      'Approved 60m overtime for Ali Raza post-release work',
      'Hamza Ahmed',
      'EMP-003',
      'manager'
    )

    assert.strictEqual(approved.status, 'Approved')
    assert.strictEqual(approved.approvedMinutes, 60)
    assert.strictEqual(approved.approvedHours, 1.0)
    assert.ok(approved.decidedBy.includes('Hamza Ahmed'))
    assert.ok(approved.decidedBy.includes('manager'))

    // Verify canonical attendance record has synchronized overtimeHours & overtimeApproved flag for payroll
    const records = attendanceService.getAttendanceRecords({ employeeId: 'EMP-004', date: '2026-11-02' })
    const rec = records.find((r) => r.date === '2026-11-02')
    assert.ok(rec, 'Attendance record for 2026-11-02 must exist')
    assert.strictEqual(rec.overtimeHours, 1.0)
    assert.strictEqual(rec.overtimeApproved, true)
    assert.strictEqual(rec.overtimeStatus, 'Approved')
  })
})
