import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceService } from '../services/attendanceService.js'
import { approvalRuleService } from '../services/approvalRuleService.js'
import { attendancePolicyService } from '../services/attendancePolicyService.js'
import { INITIAL_FIELD_DUTY_REQUESTS } from '../mocks/attendanceData.js'

test('Aliyan_HRMS — Field Duty Approval Authority & Escalation Review Suite', async (t) => {
  attendancePolicyService.setFieldDutyApprovalMode('duration_based', { teamLeadMaxHours: 4.0, managerMaxHours: 9.0 })
  // Test 1: Preserved Approved FLD-002 & Audit History
  await t.test('1. Preserved approved FLD-002 for Ahmed Khan (EMP-005) and complete historical audit', () => {
    const list = attendanceService.getFieldDutyRequests()
    const fld002 = list.find((f) => f.id === 'FLD-002') || INITIAL_FIELD_DUTY_REQUESTS.find((f) => f.id === 'FLD-002')

    assert.ok(fld002, 'FLD-002 must exist in field duty requests')
    assert.equal(fld002.employeeId, 'EMP-005')
    assert.equal(fld002.employeeName, 'Ahmed Khan')
    assert.equal(fld002.status, 'Approved')
    assert.equal(fld002.durationHours, 9.0)
    assert.equal(fld002.approverName, 'Hamza Ahmed')
    assert.equal(fld002.approverRole, 'Manager')
    assert.equal(fld002.isEscalated, true)
    assert.ok(fld002.escalationReason.includes('4.0-hour'), 'Must explain why Team Lead could not directly approve')

    // Verify historical audit stages
    assert.ok(fld002.approvalHistory.length >= 3, 'Must have submission, TL endorsement, and Manager approval')
    const submission = fld002.approvalHistory.find((h) => h.status === 'Submitted')
    const endorsement = fld002.approvalHistory.find((h) => h.status === 'Endorsed by Team Lead')
    const approval = fld002.approvalHistory.find((h) => h.status === 'Approved')

    assert.ok(submission && submission.actor.includes('Ahmed Khan'), 'Submitted by Ahmed Khan')
    assert.ok(endorsement && endorsement.actor.includes('Ali Raza'), 'Endorsed by Ali Raza')
    assert.ok(approval && approval.actor.includes('Hamza Ahmed'), 'Approved by Hamza Ahmed')
  })

  // Test 2: Approval Matrix Standard Rule Registration
  await t.test('2. Approval Matrix has APV-ATT-FLD rule with 4.0h Team Lead and 9.0h Manager limits', () => {
    const rules = approvalRuleService.getRules()
    const fldRule = rules.find((r) => r.id === 'APV-ATT-FLD')

    assert.ok(fldRule, 'APV-ATT-FLD rule must be registered in Approval Authority Matrix')
    assert.equal(fldRule.module, 'attendance')
    assert.equal(fldRule.threshold, 4.0)
    assert.equal(fldRule.initialApproverRole, 'team_lead')
    assert.equal(fldRule.escalationApproverRole, 'manager')
    assert.equal(fldRule.finalAuthorityRole, 'hr_admin')
    assert.ok(fldRule.description.includes('FLD-002'), 'Rule description references 9-hour limit')
  })

  // Test 3: Central Attendance Policy Authority Limits
  await t.test('3. Attendance Policy includes Field Duty approval limits (4.0h TL, 9.0h Manager)', () => {
    const activePolicy = attendancePolicyService.getActivePolicy()
    assert.ok(activePolicy, 'Active attendance policy must exist')
    assert.ok(activePolicy.fieldDutyApprovalLimits, 'Policy must have fieldDutyApprovalLimits')
    assert.equal(activePolicy.fieldDutyApprovalLimits.teamLeadMaxHours, 4.0)
    assert.equal(activePolicy.fieldDutyApprovalLimits.managerMaxHours, 9.0)
    assert.equal(activePolicy.fieldDutyApprovalLimits.escalateToHRThresholdHours, 9.0)
  })

  // Test 4: Approval Rule Engine Evaluation
  await t.test('4. Universal Routing Evaluator routes 9h Field Duty to Manager with escalation reason', () => {
    // 9.0 hours for Ahmed Khan (EMP-005) who has Team Lead Ali Raza
    const res9h = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 9.0
    })

    assert.equal(res9h.currentApproverTier, 'Department Manager')
    assert.equal(res9h.currentApproverRole, 'manager')
    assert.equal(res9h.isEscalated, true)
    assert.ok(res9h.escalationReason.includes('exceeds Team Lead 4.0-hour direct limit'))

    // 3.0 hours (short visit) routes to Team Lead without escalation
    const res3h = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 3.0
    })

    assert.equal(res3h.currentApproverTier, 'Team Lead')
    assert.equal(res3h.currentApproverRole, 'team_lead')
    assert.equal(res3h.isEscalated, false)
    assert.equal(res3h.escalationReason, null)

    // > 9.0 hours escalates to HR Admin
    const res12h = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 12.0
    })

    assert.equal(res12h.currentApproverTier, 'HR Admin')
    assert.equal(res12h.isEscalated, true)
  })

  // Test 5: End-to-End Workflow & 9-Hour Escalation
  await t.test('5. 9-Hour field duty submitted, endorsed by Ali Raza, and approved by Hamza Ahmed', () => {
    const req = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005',
      visitDate: '2026-11-04',
      clientName: 'NADRA B2B Integration Center',
      location: 'Islamabad G-5',
      purpose: 'Full-day on-site biometric middleware deployment',
      expectedStartTime: '09:00',
      expectedEndTime: '18:00'
    }, 'Ahmed Khan')

    assert.equal(req.status, 'Pending Team Lead Review')
    assert.equal(req.durationHours, 9.0)

    // Ali Raza reviews 9-hour request -> advances to Manager with escalation reason
    const endorsed = attendanceService.approveFieldDutyRequest(
      req.id,
      'Client visit verified; routed to Department Manager',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )

    assert.equal(endorsed.status, 'Pending Manager Review')
    assert.equal(endorsed.isEscalated, true)
    assert.ok(endorsed.escalationReason.includes('exceeds Team Lead 4.0-hour direct limit'))
    assert.equal(endorsed.currentApproverRole, 'Manager')

    // Department Manager approves
    const finalized = attendanceService.approveFieldDutyRequest(
      req.id,
      'Authorized full-day client on-site deployment',
      'Hamza Ahmed',
      'EMP-003',
      'manager'
    )

    assert.equal(finalized.status, 'Approved')
    assert.equal(finalized.approverRole, 'Manager')
    assert.equal(finalized.decidedBy, 'Hamza Ahmed')
  })

  // Test 6: Short Visit Direct Approval by Team Lead
  await t.test('6. Short visit (<= 4.0h) can be directly approved by Team Lead', () => {
    const shortReq = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005',
      visitDate: '2026-11-05',
      clientName: 'Zong HQ',
      location: 'Islamabad',
      purpose: 'Brief requirement gathering session',
      expectedStartTime: '10:00',
      expectedEndTime: '12:30' // 2.5 hours
    }, 'Ahmed Khan')

    assert.equal(shortReq.status, 'Pending Team Lead Review')
    assert.equal(shortReq.durationHours, 2.5)

    const approved = attendanceService.approveFieldDutyRequest(
      shortReq.id,
      'Direct authorized by Team Lead',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )

    assert.equal(approved.status, 'Approved')
    assert.equal(approved.approverRole, 'Team Lead')
    assert.equal(approved.decidedBy, 'Ali Raza')
  })

  // Restore active policy to No Duration Limit
  attendancePolicyService.setFieldDutyApprovalMode('no_limit')
})
