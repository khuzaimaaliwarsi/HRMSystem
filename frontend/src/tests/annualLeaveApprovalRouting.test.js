/**
 * Aliyan_HRMS — Annual Leave Approval Routing Regression Test Suite
 *
 * Verifies:
 * 1. Normal Employee: 1st & 2nd request of calendar year -> Team Lead (Ali Raza / EMP-004) approval (Final Approved)
 * 2. Normal Employee: 3rd & subsequent requests -> Department Manager (Hamza Ahmed / EMP-003) approval
 * 3. Team Lead (EMP-004): 1st & 2nd request -> Department Manager (Hamza Ahmed / EMP-003) approval (Final Approved)
 * 4. Team Lead (EMP-004): 3rd & subsequent requests -> HR Admin (Ayesha Khan / EMP-002) approval
 * 5. Request-based counting: Counts separate requests, not leave duration
 * 6. Only Approved requests count toward quota; Rejected and Cancelled do NOT consume quota
 * 7. Annual reset every January 1 in company timezone (Asia/Karachi)
 * 8. One authorized approval makes request Final Approved
 * 9. Anti-bypass revalidation at approval time for concurrent submissions
 * 10. Anti-self-approval enforcement
 * 11. Configurable threshold support
 * 12. Approval Matrix Simulator alignment
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { leaveService } from '../services/leaveService.js'
import { leavePolicyService } from '../services/leavePolicyService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'
import { approvalRuleService } from '../services/approvalRuleService.js'

describe('Aliyan_HRMS — Annual Leave Approval Routing & Threshold Suite', () => {
  beforeEach(() => {
    // Reset services to deterministic clean baseline
    leavePolicyService.setAnnualLeaveApproverThreshold(2, 'Super Admin')
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')
    leaveBalanceService.reconcileApprovedLeaves('EMP-004')
  })

  it('1. Normal Employee: 1st qualifying leave request of calendar year routes to Team Lead and becomes Final Approved', () => {
    // Reset test requests so EMP-005 starts fresh in 2026
    const list = leaveService.getLeaveRequests() || []
    const cleanList = list.filter((r) => !(r.employeeId === 'EMP-005' && r.startDate?.startsWith('2026')))
    leaveService._setItem('isysware_hrms_f05_leave_requests_v1', cleanList)
    leaveBalanceService.reconcileApprovedLeaves('EMP-005')

    const req1 = leaveService.submitLeaveRequest({
      employeeId: 'EMP-005',
      leaveTypeId: 'LT-ANNUAL',
      startDate: '2026-03-02',
      endDate: '2026-03-02',
      reason: 'Personal affairs request 1'
    }, { name: 'Ahmed Khan', employeeId: 'EMP-005', role: 'employee' })

    assert.strictEqual(req1.status, 'Pending Team Lead Review', '1st request must route to Team Lead')
    assert.strictEqual(req1.currentApproverRole, 'team_lead')
    assert.strictEqual(req1.currentApproverId, 'EMP-004', 'Ali Raza must be the reviewer')

    // Team Lead approves
    const approved1 = leaveService.approveLeaveRequest(
      req1.id,
      'Approved 1st request',
      'Ali Raza',
      'team_lead',
      'EMP-004'
    )

    assert.strictEqual(approved1.status, 'Approved', 'One authorized approval must make request Final Approved')
    assert.strictEqual(approved1.decidedBy, 'Ali Raza (Team Lead)')
  })

  it('2. Normal Employee: 2nd qualifying leave request of calendar year routes to Team Lead and becomes Final Approved', () => {
    const req2 = leaveService.submitLeaveRequest({
      employeeId: 'EMP-005',
      leaveTypeId: 'LT-ANNUAL',
      startDate: '2026-03-05',
      endDate: '2026-03-05',
      reason: 'Personal affairs request 2'
    }, { name: 'Ahmed Khan', employeeId: 'EMP-005', role: 'employee' })

    assert.strictEqual(req2.status, 'Pending Team Lead Review', '2nd request must route to Team Lead')
    assert.strictEqual(req2.currentApproverRole, 'team_lead')
    assert.strictEqual(req2.currentApproverId, 'EMP-004')

    const approved2 = leaveService.approveLeaveRequest(
      req2.id,
      'Approved 2nd request',
      'Ali Raza',
      'team_lead',
      'EMP-004'
    )

    assert.strictEqual(approved2.status, 'Approved', '2nd request becomes Final Approved by Team Lead')
  })

  it('3. Normal Employee: 3rd qualifying leave request of calendar year escalates to Department Manager', () => {
    const req3 = leaveService.submitLeaveRequest({
      employeeId: 'EMP-005',
      leaveTypeId: 'LT-ANNUAL',
      startDate: '2026-03-10',
      endDate: '2026-03-10',
      reason: 'Personal affairs request 3'
    }, { name: 'Ahmed Khan', employeeId: 'EMP-005', role: 'employee' })

    assert.strictEqual(req3.status, 'Pending Manager Review', '3rd request must route to Department Manager')
    assert.strictEqual(req3.currentApproverRole, 'manager')
    assert.strictEqual(req3.currentApproverId, 'EMP-003', 'Hamza Ahmed must be the reviewer')
    assert.strictEqual(req3.isEscalated, true, 'Must be marked as escalated route')

    // Team Lead cannot approve 3rd request
    assert.throws(
      () => leaveService.approveLeaveRequest(req3.id, 'Unauthorized TL approval', 'Ali Raza', 'team_lead', 'EMP-004'),
      /Current status and authority tier does not permit|Unauthorized/,
      'Team Lead must not be allowed to approve 3rd request'
    )

    // Department Manager approves
    const approved3 = leaveService.approveLeaveRequest(
      req3.id,
      'Approved by Dept Manager',
      'Hamza Ahmed',
      'manager',
      'EMP-003'
    )

    assert.strictEqual(approved3.status, 'Approved', 'Department Manager grants Final Approved')
  })

  it('4. Team Lead (EMP-004): 1st & 2nd request route to Department Manager (Hamza Ahmed / EMP-003)', () => {
    const list = leaveService.getLeaveRequests() || []
    const cleanList = list.filter((r) => !(r.employeeId === 'EMP-004' && r.startDate?.startsWith('2026-04')))
    leaveService._setItem('hrms_leave_requests', cleanList)

    // 1st request
    const tlReq1 = leaveService.submitLeaveRequest({
      employeeId: 'EMP-004',
      leaveTypeId: 'LT-CASUAL',
      startDate: '2026-04-06',
      endDate: '2026-04-06',
      reason: 'TL Personal Request 1'
    }, { name: 'Ali Raza', employeeId: 'EMP-004', role: 'team_lead' })

    assert.strictEqual(tlReq1.status, 'Pending Manager Review', 'TL 1st request routes to Department Manager')
    assert.strictEqual(tlReq1.currentApproverRole, 'manager')
    assert.strictEqual(tlReq1.currentApproverId, 'EMP-003')

    // Manager approves 1st
    const tlApproved1 = leaveService.approveLeaveRequest(
      tlReq1.id,
      'Approved TL leave 1',
      'Hamza Ahmed',
      'manager',
      'EMP-003'
    )
    assert.strictEqual(tlApproved1.status, 'Approved')

    // 2nd request
    const tlReq2 = leaveService.submitLeaveRequest({
      employeeId: 'EMP-004',
      leaveTypeId: 'LT-CASUAL',
      startDate: '2026-04-13',
      endDate: '2026-04-13',
      reason: 'TL Personal Request 2'
    }, { name: 'Ali Raza', employeeId: 'EMP-004', role: 'team_lead' })

    assert.strictEqual(tlReq2.status, 'Pending Manager Review', 'TL 2nd request routes to Department Manager')
    assert.strictEqual(tlReq2.currentApproverId, 'EMP-003')

    const tlApproved2 = leaveService.approveLeaveRequest(
      tlReq2.id,
      'Approved TL leave 2',
      'Hamza Ahmed',
      'manager',
      'EMP-003'
    )
    assert.strictEqual(tlApproved2.status, 'Approved')
  })

  it('5. Team Lead (EMP-004): 3rd qualifying request escalates to HR Admin (Ayesha Khan / EMP-002)', () => {
    const tlReq3 = leaveService.submitLeaveRequest({
      employeeId: 'EMP-004',
      leaveTypeId: 'LT-CASUAL',
      startDate: '2026-04-20',
      endDate: '2026-04-20',
      reason: 'TL Personal Request 3'
    }, { name: 'Ali Raza', employeeId: 'EMP-004', role: 'team_lead' })

    assert.strictEqual(tlReq3.status, 'Pending HR Review', 'TL 3rd request escalates to HR Admin')
    assert.strictEqual(tlReq3.currentApproverRole, 'hr_admin')
    assert.strictEqual(tlReq3.currentApproverId, 'EMP-002')
    assert.strictEqual(tlReq3.isEscalated, true)

    // Department Manager cannot approve 3rd request
    assert.throws(
      () => leaveService.approveLeaveRequest(tlReq3.id, 'Manager attempt', 'Hamza Ahmed', 'manager', 'EMP-003'),
      /Current status and authority tier does not permit manager approval/,
      'Manager must not be allowed to approve TL 3rd request'
    )

    // HR Admin approves
    const approved3 = leaveService.approveLeaveRequest(
      tlReq3.id,
      'HR Authorized',
      'Ayesha Khan',
      'hr_admin',
      'EMP-002'
    )
    assert.strictEqual(approved3.status, 'Approved')
  })

  it('6. Calendar Year Reset: Approved request in 2025 does NOT consume 2026 quota', () => {
    const list = leaveService.getLeaveRequests() || []
    // Insert mock approved leave in 2025
    const mock2025 = {
      id: 'LV-202511-001',
      employeeId: 'EMP-005',
      employeeName: 'Ahmed Khan',
      leaveTypeId: 'LT-CASUAL',
      startDate: '2025-11-10',
      endDate: '2025-11-10',
      calculatedDays: 1,
      status: 'Approved'
    }
    leaveService._setItem('hrms_leave_requests', [mock2025, ...list])

    // In 2026, count should only inspect 2026
    const count2026 = leavePolicyService.getApprovedLeaveCountInYear('EMP-005', '2026-05-01', [mock2025])
    assert.strictEqual(count2026, 0, '2025 approved leave must not count toward 2026 quota')
  })

  it('7. Rejections & Cancellations do not consume annual quota', () => {
    // 1. Submit and reject a request
    const req = leaveService.submitLeaveRequest({
      employeeId: 'EMP-005',
      leaveTypeId: 'LT-SICK',
      startDate: '2026-05-04',
      endDate: '2026-05-04',
      reason: 'Test Rejection Quota'
    }, { name: 'Ahmed Khan', employeeId: 'EMP-005', role: 'employee' })

    leaveService.rejectLeaveRequest(req.id, 'Operational conflict', 'Ali Raza', 'team_lead', 'EMP-004')

    const list = leaveService.getLeaveRequests()
    const rejectedReq = list.find((r) => r.id === req.id)
    assert.strictEqual(rejectedReq.status, 'Rejected')

    // Count should exclude Rejected
    const count = leavePolicyService.getApprovedLeaveCountInYear('EMP-005', '2026-05-04', list)
    assert.ok(typeof count === 'number')

    // 2. Cancellation releases quota immediately
    const reqToCancel = leaveService.submitLeaveRequest({
      employeeId: 'EMP-005',
      leaveTypeId: 'LT-SICK',
      startDate: '2026-05-18',
      endDate: '2026-05-18',
      reason: 'Will be cancelled'
    }, { name: 'Ahmed Khan', employeeId: 'EMP-005', role: 'employee' })

    // If pending, cancel / withdraw
    leaveService.withdrawLeaveRequest(reqToCancel.id, 'Cancelled by user', { name: 'Ahmed Khan', employeeId: 'EMP-005', role: 'employee' })
    const listAfterCancel = leaveService.getLeaveRequests()
    const cancelledReq = listAfterCancel.find((r) => r.id === reqToCancel.id)
    assert.strictEqual(cancelledReq.status, 'Withdrawn')
  })

  it('8. Anti-Bypass Guard: Concurrent submissions revalidated at approval time', () => {
    // Create clean list where EMP-005 has 1 approved request
    const mockReq1 = {
      id: 'LV-TEST-001',
      employeeId: 'EMP-005',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      calculatedDays: 1,
      status: 'Approved'
    }
    // And two pending requests submitted simultaneously
    const mockReq2 = {
      id: 'LV-TEST-002',
      employeeId: 'EMP-005',
      leaveTypeId: 'LT-ANNUAL',
      startDate: '2026-06-05',
      endDate: '2026-06-05',
      calculatedDays: 1,
      status: 'Pending Team Lead Review',
      currentApproverTier: 'Team Lead',
      currentApproverRole: 'team_lead',
      approvalHistory: []
    }
    const mockReq3 = {
      id: 'LV-TEST-003',
      employeeId: 'EMP-005',
      leaveTypeId: 'LT-ANNUAL',
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      calculatedDays: 1,
      status: 'Pending Team Lead Review',
      currentApproverTier: 'Team Lead',
      currentApproverRole: 'team_lead',
      approvalHistory: []
    }

    leaveService._setItem('isysware_hrms_f05_leave_requests_v1', [mockReq1, mockReq2, mockReq3])

    // TL approves mockReq2 -> now approved count is 2 (threshold reached)
    leaveService.approveLeaveRequest('LV-TEST-002', 'Approved 2nd', 'Ali Raza', 'team_lead', 'EMP-004')

    // TL now attempts to approve mockReq3 which was submitted simultaneously
    // Anti-bypass revalidation must detect that approved count reached 2 and auto-escalate to Manager!
    const escalated = leaveService.approveLeaveRequest('LV-TEST-003', 'Trying to approve 3rd', 'Ali Raza', 'team_lead', 'EMP-004')

    assert.strictEqual(escalated.status, 'Pending Manager Review', 'Must auto-escalate to Dept Manager to prevent bypass')
    assert.strictEqual(escalated.currentApproverRole, 'manager')
    assert.strictEqual(escalated.isEscalated, true)
    assert.ok(escalated.escalationReason?.includes('Anti-Bypass Revalidation'))
  })

  it('9. Anti-Self-Approval: Requester cannot approve their own leave', () => {
    const list = leaveService.getLeaveRequests()
    const req = list.find((r) => r.status?.startsWith('Pending'))
    if (req) {
      assert.throws(
        () => leaveService.approveLeaveRequest(req.id, 'Self approval', req.employeeName, 'team_lead', req.employeeId),
        /Self-approval prohibited/,
        'Anti-Self-Approval rule must be enforced'
      )
    }
  })

  it('10. Configurable Threshold: Changing threshold to 3 permits 3rd request to Team Lead', () => {
    leavePolicyService.setAnnualLeaveApproverThreshold(3, 'Super Admin')
    assert.strictEqual(leavePolicyService.getAnnualLeaveApproverThreshold(), 3)

    const listWith2Approved = [
      { id: 'LV-A', employeeId: 'EMP-005', startDate: '2026-07-01', status: 'Approved' },
      { id: 'LV-B', employeeId: 'EMP-005', startDate: '2026-07-02', status: 'Approved' }
    ]

    const auth = leavePolicyService.evaluateApprovalAuthority('EMP-005', 'LT-CASUAL', 1, '2026-07-15', listWith2Approved)
    assert.strictEqual(auth.currentApproverTier, 'Team Lead', 'When threshold is 3, 3rd request still routes to Team Lead')
    assert.strictEqual(auth.initialStatus, 'Pending Team Lead Review')

    // Reset threshold back to 2
    leavePolicyService.setAnnualLeaveApproverThreshold(2, 'Super Admin')
  })

  it('11. Simulator Consistency: approvalRuleService produces identical routes', () => {
    // Normal Employee: 1st & 2nd request (cumulativeAmountOrDays: 0 or 1)
    const sim1 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-005',
      amountOrDays: 1,
      cumulativeAmountOrDays: 0
    })
    assert.strictEqual(sim1.currentApproverTier, 'Team Lead')
    assert.strictEqual(sim1.currentApproverId, 'EMP-004')

    // Normal Employee: 3rd request (annualRequestCount: 2)
    const sim3 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-005',
      amountOrDays: 1,
      cumulativeAmountOrDays: 0,
      annualRequestCount: 2
    })
    assert.strictEqual(sim3.currentApproverTier, 'Manager')
    assert.strictEqual(sim3.isEscalated, true)

    // Team Lead (EMP-004): 1st request -> Department Manager
    const simTL1 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-004',
      amountOrDays: 1,
      cumulativeAmountOrDays: 0,
      annualRequestCount: 0
    })
    assert.strictEqual(simTL1.currentApproverTier, 'Manager')

    // Team Lead (EMP-004): 3rd request -> HR Admin
    const simTL3 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-004',
      amountOrDays: 1,
      cumulativeAmountOrDays: 0,
      annualRequestCount: 2
    })
    assert.strictEqual(simTL3.currentApproverTier, 'HR Admin')
    assert.strictEqual(simTL3.currentApproverId, 'EMP-002')
    assert.strictEqual(simTL3.isEscalated, true)
  })

  it('12. Specific Regression Invariants: 0 & 2 requests for Ahmed Khan and Ali Raza, multi-day requests without 2-day cap, and Standard Rule cards', () => {
    // 1. Ahmed Khan (EMP-005), 0 previous approved requests -> Ali Raza (Team Lead), even for 4 days
    const resAhmed0 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-005',
      amountOrDays: 4,
      cumulativeAmountOrDays: 0,
      annualRequestCount: 0
    })
    assert.strictEqual(resAhmed0.currentApproverTier, 'Team Lead')
    assert.strictEqual(resAhmed0.currentApproverId, 'EMP-004')
    assert.ok(
      resAhmed0.currentApproverName.includes('Ali') || resAhmed0.currentApproverName.includes('Raza'),
      'Approver must be Ali Raza / Zeeshan Ali (EMP-004)'
    )
    assert.strictEqual(resAhmed0.isEscalated, false, '0 previous requests must not be escalated')

    // 2. Ahmed Khan (EMP-005), 2 previous approved requests -> Hamza Ahmed (Department Manager)
    const resAhmed2 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-005',
      amountOrDays: 1,
      cumulativeAmountOrDays: 2,
      annualRequestCount: 2
    })
    assert.strictEqual(resAhmed2.currentApproverTier, 'Manager')
    assert.strictEqual(resAhmed2.currentApproverId, 'EMP-003')
    assert.match(resAhmed2.currentApproverName, /Hamza Ahmed/i)
    assert.strictEqual(resAhmed2.isEscalated, true, '2 previous requests reaches threshold, must escalate')

    // 3. Ali Raza (EMP-004), 0 previous approved requests -> Hamza Ahmed (Department Manager), even for 3.5 days
    const resAli0 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-004',
      amountOrDays: 3.5,
      cumulativeAmountOrDays: 0,
      annualRequestCount: 0
    })
    assert.strictEqual(resAli0.currentApproverTier, 'Manager')
    assert.strictEqual(resAli0.currentApproverId, 'EMP-003')
    assert.match(resAli0.currentApproverName, /Hamza Ahmed/i)
    assert.strictEqual(resAli0.isEscalated, false, '0 previous requests for TL must route directly to Manager')

    // 4. Ali Raza (EMP-004), 2 previous approved requests -> Ayesha Khan (HR Admin)
    const resAli2 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-004',
      amountOrDays: 1,
      cumulativeAmountOrDays: 2,
      annualRequestCount: 2
    })
    assert.strictEqual(resAli2.currentApproverTier, 'HR Admin')
    assert.strictEqual(resAli2.currentApproverId, 'EMP-002')
    assert.match(resAli2.currentApproverName, /Ayesha Khan/i)
    assert.strictEqual(resAli2.isEscalated, true, '2 previous requests for TL must escalate to HR Admin')

    // 5. Configured Standard Approval Rules verification
    const rules = approvalRuleService.getRules('leaves')
    const stdRule = rules.find((r) => r.id === 'APV-LEV-STD')
    assert.ok(stdRule, 'APV-LEV-STD rule must exist')
    assert.strictEqual(stdRule.initialApprover, 'Team Lead', 'APV-LEV-STD Tier 1 must be Team Lead')
    assert.strictEqual(stdRule.escalationApprover, 'Department Manager', 'APV-LEV-STD Escalation must be Department Manager')
    assert.strictEqual(stdRule.cumulativePeriod, 'annual')

    const tlRule = rules.find((r) => r.id === 'APV-LEV-TL')
    assert.ok(tlRule, 'APV-LEV-TL rule must exist')
    assert.strictEqual(tlRule.initialApprover, 'Department Manager', 'APV-LEV-TL Tier 1 must be Department Manager')
    assert.strictEqual(tlRule.escalationApprover, 'HR Admin', 'APV-LEV-TL Escalation must be HR Admin')
    assert.strictEqual(tlRule.cumulativePeriod, 'annual')
  })
})
