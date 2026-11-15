import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { attendanceService } from '../services/attendanceService.js'

describe('Aliyan_HRMS — Attendance Correction Approval & Workflow Verification', () => {
  beforeEach(() => {
    // Clear demo storage so each test is atomic
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('1. Team Lead can approve attendance correction for assigned team employee and regularize attendance', () => {
    // Submit a correction request
    const corr = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-005',
      attendanceDate: '2026-10-30',
      correctionType: 'Missed Check-In / Out',
      requestedCheckIn: '09:00',
      requestedCheckOut: '18:00',
      reason: 'Biometric gate failure'
    }, 'Ahmed Khan')

    assert.ok(corr.id)
    assert.ok(corr.status.toLowerCase().includes('pending'))

    // Team Lead Ali Raza approves regularization
    const approved = attendanceService.approveAttendanceCorrection(
      corr.id,
      'Verified biometric logs with security gate',
      'Ali Raza',
      'team_lead',
      'EMP-004',
      { isFinalApproval: true }
    )

    assert.strictEqual(approved.status, 'Approved')
    assert.ok(approved.decidedBy.includes('Ali Raza'))
    assert.ok(approved.decidedBy.includes('Team Lead'))
    assert.ok(approved.approvalHistory.some(h => h.status === 'Approved'))

    // Verify official attendance record is regularized
    const records = attendanceService.getAttendanceRecords({ employeeId: 'EMP-005', date: '2026-10-30' })
    const rec = records.find(r => r.date === '2026-10-30')
    assert.ok(rec, 'Attendance record for 2026-10-30 must exist')
    assert.strictEqual(rec.primaryClassification, 'Present')
    assert.strictEqual(rec.status, 'Present')
    assert.strictEqual(rec.checkInTime, '09:00')
    assert.strictEqual(rec.checkOutTime, '18:00')
    assert.strictEqual(rec.correctionStatus, 'Regularized')
  })

  it('2. Team Lead can reject attendance correction with audit remarks and without modifying attendance', () => {
    const corr = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-005',
      attendanceDate: '2026-10-29',
      correctionType: 'Incorrect Absent Marking',
      requestedCheckIn: '09:00',
      requestedCheckOut: '18:00',
      reason: 'Forgot badge'
    }, 'Ahmed Khan')

    const rejected = attendanceService.rejectAttendanceCorrection(
      corr.id,
      'Badge check did not confirm attendance',
      'Ali Raza',
      'team_lead',
      'EMP-004'
    )

    assert.strictEqual(rejected.status, 'Rejected')
    assert.ok(rejected.decidedBy.includes('Ali Raza'))
    assert.ok(rejected.approvalHistory.some(h => h.status === 'Rejected'))
  })

  it('3. Team Lead can forward / escalate correction to HR Admin', () => {
    const corr = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-005',
      attendanceDate: '2026-10-28',
      correctionType: 'Unusual Out-of-Shift Hours',
      requestedCheckIn: '14:00',
      requestedCheckOut: '23:00',
      reason: 'Emergency shift override'
    }, 'Ahmed Khan')

    const escalated = attendanceService.escalateCorrection(
      corr.id,
      'Exceeds team lead policy threshold; requires HR decision',
      'Ali Raza',
      'team_lead'
    )

    assert.strictEqual(escalated.status, 'Pending HR Review')
    assert.strictEqual(escalated.currentApproverRole, 'HR Admin')
    assert.ok(escalated.approvalHistory.some(h => h.status === 'Forwarded to HR Admin'))
  })

  it('4. Anti-Self-Approval guard strictly blocks a Team Lead from approving their own correction', () => {
    const corr = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-004',
      attendanceDate: '2026-10-27',
      correctionType: 'Missed Punch',
      requestedCheckIn: '09:00',
      requestedCheckOut: '18:00',
      reason: 'Self punch correction'
    }, 'Ali Raza')

    assert.throws(
      () => attendanceService.approveAttendanceCorrection(
        corr.id,
        'Trying to approve own request',
        'Ali Raza',
        'team_lead',
        'EMP-004',
        { isFinalApproval: true }
      ),
      /Self-approval prohibited/
    )
  })

  it('5. Finalized correction cannot be re-approved or duplicate posted', () => {
    const corr = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-005',
      attendanceDate: '2026-10-26',
      correctionType: 'Missed Punch',
      requestedCheckIn: '09:00',
      requestedCheckOut: '18:00',
      reason: 'Valid regularization'
    }, 'Ahmed Khan')

    // First approval
    attendanceService.approveAttendanceCorrection(
      corr.id,
      'Initial approval',
      'Ali Raza',
      'team_lead',
      'EMP-004',
      { isFinalApproval: true }
    )

    // Second approval attempt should throw duplicate/already finalized error
    assert.throws(
      () => attendanceService.approveAttendanceCorrection(
        corr.id,
        'Duplicate attempt',
        'Ali Raza',
        'team_lead',
        'EMP-004',
        { isFinalApproval: true }
      ),
      /already finalized/
    )
  })

  it('6. Ahmed Khan requests route canonically to Ali Raza (EMP-004), never Bilal Ahmed (EMP-006)', () => {
    // Attendance correction
    const corr = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-005',
      attendanceDate: '2026-10-31',
      correctionType: 'Missed Check-In',
      requestedCheckIn: '09:00',
      requestedCheckOut: '18:00',
      reason: 'Biometric device offline'
    }, 'Ahmed Khan')

    assert.strictEqual(corr.currentApproverId, 'EMP-004', 'Correction must route to canonical lead (EMP-004)')
    assert.ok(corr.currentApproverName.includes('Ali') || corr.currentApproverName.includes('Raza'), 'Approver name must be canonical lead')
    assert.strictEqual(corr.currentApproverRole, 'Team Lead')

    // Overtime submission
    const ot = attendanceService.submitOvertimeRequest({
      employeeId: 'EMP-005',
      overtimeDate: '2026-10-31',
      requestedMinutes: 90,
      reason: 'Release sprint deployment testing'
    }, 'Ahmed Khan')

    assert.strictEqual(ot.currentApproverId, 'EMP-004', 'Overtime must route to canonical lead (EMP-004)')
    assert.ok(ot.approverName.includes('Ali') || ot.approverName.includes('Raza'))
    assert.strictEqual(ot.status, 'Pending Team Lead Review')
  })

  it('7. Bilal Ahmed (EMP-006) cannot approve Ahmed Khan requests without explicit delegation', () => {
    const corr = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-005',
      attendanceDate: '2026-10-25',
      correctionType: 'Missed Punch',
      requestedCheckIn: '09:00',
      requestedCheckOut: '18:00',
      reason: 'Regular punch'
    }, 'Ahmed Khan')

    // Bilal attempts approval -> must throw Unauthorized
    assert.throws(
      () => attendanceService.approveAttendanceCorrection(
        corr.id,
        'Bilal attempting approval',
        'Bilal Ahmed',
        'team_lead',
        'EMP-006',
        { isFinalApproval: true }
      ),
      /Unauthorized/
    )

    const ot = attendanceService.submitOvertimeRequest({
      employeeId: 'EMP-005',
      overtimeDate: '2026-10-25',
      requestedMinutes: 60,
      reason: 'Documentation update'
    }, 'Ahmed Khan')

    assert.throws(
      () => attendanceService.approveOvertimeRequest(
        ot.id,
        60,
        'Bilal attempting overtime approval',
        'Bilal Ahmed',
        'EMP-006',
        'team_lead'
      ),
      /Unauthorized/
    )
  })

  it('8. Overtime duration minimum 60-minute policy validation is strictly enforced', () => {
    // 30 minutes must be rejected
    assert.throws(
      () => attendanceService.submitOvertimeRequest({
        employeeId: 'EMP-005',
        overtimeDate: '2026-10-31',
        requestedMinutes: 30,
        reason: 'Short 30 min overtime'
      }, 'Ahmed Khan'),
      /Minimum overtime request duration is 60 minutes/
    )

    // 60 minutes succeeds
    const validOt = attendanceService.submitOvertimeRequest({
      employeeId: 'EMP-005',
      overtimeDate: '2026-10-31',
      requestedMinutes: 60,
      reason: 'Valid 60 min overtime'
    }, 'Ahmed Khan')

    assert.ok(validOt.id)
    assert.strictEqual(validOt.requestedMinutes, 60)
    assert.strictEqual(validOt.requestedHours, 1.0)
  })

  it('9. Existing pending requests are safely reconciled with preserved audit history', () => {
    // Trigger reconciliation
    attendanceService._reconcilePendingApproverRouting()
    const corrections = attendanceService.getAttendanceCorrections()
    const corr1 = corrections.find(c => c.id === 'CORR-001')
    if (corr1 && corr1.employeeId === 'EMP-005') {
      assert.strictEqual(corr1.currentApproverId, 'EMP-004')
      assert.strictEqual(corr1.currentApproverName, 'Ali Raza')
      assert.ok(corr1.approvalHistory.some(h => h.status === 'Re-routed'))
    }

    const overtimes = attendanceService.getOvertimeRequests()
    const ot1 = overtimes.find(o => o.id === 'OT-001')
    if (ot1 && ot1.employeeId === 'EMP-005') {
      assert.strictEqual(ot1.currentApproverId, 'EMP-004')
      assert.strictEqual(ot1.approverName, 'Ali Raza')
      assert.strictEqual(ot1.requestedMinutes, 30, 'OT-001 original 30-minute claim must be preserved without silent alteration')
      assert.strictEqual(ot1.approvalHistory.some(h => h.status === 'Policy Reconciled'), false, 'Synthetic Policy Reconciled entry must not be present')
    }
  })
})
