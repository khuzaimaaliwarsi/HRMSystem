import test from 'node:test'
import assert from 'node:assert/strict'
import { approvalRuleService } from '../services/approvalRuleService.js'
import { attendancePolicyService } from '../services/attendancePolicyService.js'
import { attendanceService } from '../services/attendanceService.js'
import { leaveService } from '../services/leaveService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'

test('Aliyan_HRMS — Configurable Field Duty & Leave Cancellation Reconciliation Master Suite', async (t) => {
  // Reset attendance policy to standard baseline before running
  attendancePolicyService.resetToDefaults()

  await t.test('1. Field Duty Simulator: Ahmed Khan (EMP-005) resolves to Hamza Ahmed (EMP-003) for 4.5h and 9h', () => {
    attendancePolicyService.setFieldDutyApprovalMode('duration_based', { teamLeadMaxHours: 4.0, managerMaxHours: 9.0 })
    // 4 hours (<= 4.0h) -> Team Lead / Ali Raza
    const res4h = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 4.0
    })
    assert.equal(res4h.currentApproverTier, 'Team Lead')
    assert.equal(res4h.currentApproverId, 'EMP-004')
    assert.equal(res4h.currentApproverName, 'Ali Raza')
    assert.equal(res4h.isEscalated, false)

    // 4.5 hours -> Department Manager / Hamza Ahmed (EMP-003)
    const res45h = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 4.5
    })
    assert.equal(res45h.currentApproverTier, 'Department Manager')
    assert.equal(res45h.currentApproverId, 'EMP-003')
    assert.equal(res45h.currentApproverName, 'Hamza Ahmed (EMP-003)')
    assert.equal(res45h.isEscalated, true)
    assert.ok(res45h.escalationReason.includes('exceeds Team Lead 4.0-hour direct limit'))

    // 9.0 hours -> Department Manager / Hamza Ahmed (EMP-003)
    const res9h = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 9.0
    })
    assert.equal(res9h.currentApproverTier, 'Department Manager')
    assert.equal(res9h.currentApproverId, 'EMP-003')
    assert.equal(res9h.currentApproverName, 'Hamza Ahmed (EMP-003)')
    assert.equal(res9h.isEscalated, true)

    // > 9.0 hours (e.g. 10.0 hours) -> HR Admin / Ayesha Khan (EMP-002)
    const res10h = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 10.0
    })
    assert.equal(res10h.currentApproverTier, 'HR Admin')
    assert.equal(res10h.currentApproverId, 'EMP-002')
    assert.equal(res10h.isEscalated, true)
  })

  await t.test('2. Configurable Mode: No Duration Limit allows Team Lead to approve for direct reports', () => {
    // Switch to No Duration Limit mode
    attendancePolicyService.setFieldDutyApprovalMode('no_limit')

    const res = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 9.0
    })
    assert.equal(res.currentApproverTier, 'Team Lead')
    assert.equal(res.currentApproverId, 'EMP-004')
    assert.equal(res.currentApproverName, 'Ali Raza')
    assert.equal(res.isEscalated, false)

    // Verify actual service permits Team Lead direct approval under no_limit mode
    const req = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005',
      visitDate: '2026-11-08',
      clientName: 'PTCL Operations',
      purpose: 'Technical integration audit',
      expectedStartTime: '09:00',
      expectedEndTime: '18:00' // 9 hours
    }, 'Ahmed Khan')

    const approved = attendanceService.approveFieldDutyRequest(
      req.id,
      'Direct authorized by Team Lead under No Limit policy',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )
    assert.equal(approved.status, 'Approved')
    assert.equal(approved.approverRole, 'Team Lead')
  })

  await t.test('3. Configurable Mode: Manager Approval Only blocks Team Lead and requires Department Manager', () => {
    attendancePolicyService.setFieldDutyApprovalMode('manager_only')

    const res = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 2.0
    })
    assert.equal(res.currentApproverTier, 'Department Manager')
    assert.equal(res.currentApproverId, 'EMP-003')
    assert.equal(res.currentApproverName, 'Hamza Ahmed (EMP-003)')

    // Verify service enforces manager_only
    const req = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005',
      visitDate: '2026-11-09',
      clientName: 'Jazz B2B',
      purpose: 'Consultation',
      expectedStartTime: '10:00',
      expectedEndTime: '12:00'
    }, 'Ahmed Khan')

    assert.throws(
      () => {
        attendanceService.approveFieldDutyRequest(
          req.id,
          'Unauthorized attempt',
          'Ali Raza',
          'EMP-004',
          'team_lead'
        )
      },
      /Policy requires Department Manager approval/
    )

    // Department Manager can approve
    const finalized = attendanceService.approveFieldDutyRequest(
      req.id,
      'Authorized by Department Manager',
      'Hamza Ahmed',
      'EMP-003',
      'manager'
    )
    assert.equal(finalized.status, 'Approved')
    assert.equal(finalized.approverRole, 'Manager')

    // Reset back to no_limit mode
    attendancePolicyService.setFieldDutyApprovalMode('no_limit')
  })

  await t.test('4. Leave Cancellation: Exact actor attribution, reason preservation, and balance reversal', () => {
    // Submit a fresh leave for test
    const req = leaveService.submitLeaveRequest({
      employeeId: 'EMP-006',
      leaveTypeId: 'LT-CASUAL',
      startDate: '2026-11-18',
      endDate: '2026-11-18',
      reason: 'Testing cancellation flow'
    }, { name: 'Usman Ghani', role: 'employee', employeeId: 'EMP-006' })

    // Approve the leave
    leaveService.approveLeaveRequest(req.id, 'Approved for testing', {
      name: 'Bilal Siddiqui',
      role: 'manager',
      employeeId: 'EMP-003'
    })

    const initialUsed = leaveBalanceService.getEmployeeBalanceSummary('EMP-006').casualUsed

    // Cancel approved leave
    const cancelled = leaveService.cancelApprovedLeave(
      req.id,
      'Doctor appointment cancelled; attending office',
      { name: 'Usman Ghani', role: 'employee', employeeId: 'EMP-006' }
    )

    assert.equal(cancelled.status, 'Cancelled')
    assert.equal(cancelled.cancelledBy, 'Usman Ghani (employee)')
    assert.equal(cancelled.cancellationReason, 'Doctor appointment cancelled; attending office')
    assert.ok(cancelled.cancelledAt)

    // Check balance reversal
    const postUsed = leaveBalanceService.getEmployeeBalanceSummary('EMP-006').casualUsed
    assert.equal(postUsed, initialUsed - 1, 'Utilized days must decrease by 1.0d upon cancellation')

    // Calendar check: cancelled leave must NOT appear in calendar
    const calendarEvents = leaveService.getCalendarEvents({ employeeId: 'EMP-006', name: 'Usman Ghani', role: 'employee' })
    const foundInCalendar = calendarEvents.find((e) => e.id === req.id)
    assert.equal(foundInCalendar, undefined, 'Cancelled leave must not appear as approved calendar event')
  })

  await t.test('5. Cancelled leave balance reconciliation is idempotent without double refunds', () => {
    const beforeBalances = leaveBalanceService.getEmployeeBalances('EMP-006')
    const beforeCL = beforeBalances.find((b) => b.leaveTypeId === 'LT-CASUAL' || b.leaveTypeCode === 'CL')

    // Call reconcileApprovedLeaves
    leaveBalanceService.reconcileApprovedLeaves('EMP-006')
    leaveBalanceService.reconcileApprovedLeaves('EMP-006')

    const afterBalances = leaveBalanceService.getEmployeeBalances('EMP-006')
    const afterCL = afterBalances.find((b) => b.leaveTypeId === 'LT-CASUAL' || b.leaveTypeCode === 'CL')

    assert.equal(beforeCL.availableBalance, afterCL.availableBalance, 'Idempotent reconcile must never double refund')
  })
})

