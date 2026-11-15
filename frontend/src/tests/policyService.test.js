/**
 * iSysware HRMS — Batch F13 Comprehensive Automated Test Suite
 * Authoritative verification for Administration, Central Policy Engine,
 * RBAC Permissions, Approval Authority Matrix, Working Calendar & Scheduled Alerts.
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { policyService } from '../services/policyService.js'
import { approvalRuleService } from '../services/approvalRuleService.js'
import { permissionService } from '../services/permissionService.js'
import { companySettingsService } from '../services/companySettingsService.js'
import { holidayCalendarService } from '../services/holidayCalendarService.js'
import { scheduledAlertService } from '../services/scheduledAlertService.js'
import { auditService } from '../services/auditService.js'

describe('Batch F13: Centralized Policy Engine, Permissions & Administration', () => {
  beforeEach(() => {
    policyService.resetAllData()
    approvalRuleService.resetAllData()
    permissionService.resetAllData()
    companySettingsService.resetAllData()
    holidayCalendarService.resetAllData()
    scheduledAlertService.resetAllData()
    auditService.resetAllData()
  })

  // 1. Policy creation and validation
  it('1. Policy creation and validation: Super Admin can create policy with valid fields', () => {
    const newPolicy = policyService.createPolicy(
      {
        name: 'Media Department Remote Infrastructure Policy',
        category: 'attendance',
        description: 'Defines stipend and connectivity parameters for full-time media specialists.',
        appliesTo: 'Department',
        scopeValue: 'DEP-03',
        allowedLimit: 5,
        calculationMethod: 'fixed',
        rules: { stipendMonthly: 8000 }
      },
      { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }
    )

    assert.ok(newPolicy.id.startsWith('POL-ATT-'))
    assert.equal(newPolicy.name, 'Media Department Remote Infrastructure Policy')
    assert.equal(newPolicy.version, '1.0')
    assert.equal(newPolicy.status, 'Active')
    assert.equal(newPolicy.precedence, 2) // Department precedence
  })

  // 2. Policy versioning
  it('2. Policy versioning: increments version number and updates audit metadata', () => {
    const updated = policyService.versionPolicy(
      'POL-ATT-001',
      { allowedLimit: 5 },
      { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' },
      'Increased allowed monthly late grace from 4 to 5'
    )

    assert.equal(updated.version, '2.2')
    assert.equal(updated.allowedLimit, 5)
    assert.equal(updated.changeReason, 'Increased allowed monthly late grace from 4 to 5')
  })

  // 3. Effective-dated policy activation
  it('3. Effective-dated policy activation: resolves policy based on effective date range', () => {
    // Schedule a future policy for 2027
    const futurePolicy = policyService.createPolicy(
      {
        name: 'Future Fiscal 2027 Leave Policy',
        category: 'leaves',
        appliesTo: 'Company-Wide',
        scopeValue: 'all',
        effectiveFrom: '2027-01-01',
        effectiveTo: '2027-12-31',
        allowedLimit: 3.0,
        rules: { managerMonthlyApprovalCap: 3.0 }
      },
      { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }
    )

    // Current date (2026) resolves active 2026 policy
    const activeCurrent = policyService.resolveEffectivePolicy('leaves', { date: '2026-06-15' })
    assert.equal(activeCurrent.id, 'POL-LEV-001')

    // 2027 date resolves future policy
    const activeFuture = policyService.resolveEffectivePolicy('leaves', { date: '2027-02-10' })
    assert.equal(activeFuture.id, futurePolicy.id)
  })

  // 4. Employee-specific exception precedence
  it('4. Precedence: Employee exception (1) overrides Department (2) and Company (4)', () => {
    // Create an employee-specific exception for EMP-004
    const empException = policyService.createPolicy(
      {
        name: 'Special Medical WFH Exception for Zeeshan Ali',
        category: 'attendance',
        appliesTo: 'Employee-Specific',
        scopeValue: 'EMP-004',
        allowedLimit: 10,
        rules: { wfhMonthlyAllowanceDays: 10 }
      },
      { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }
    )

    // For EMP-004 (Zeeshan), should resolve the employee-specific exception (precedence 1)
    const effectiveEmp = policyService.resolveEffectivePolicy('attendance', { employeeId: 'EMP-004', departmentId: 'DEP-01' })
    assert.equal(effectiveEmp.id, empException.id)
    assert.equal(effectiveEmp.precedence, 1)

    // For another employee in DEP-01, should resolve the department-specific policy (precedence 2)
    const effectiveDept = policyService.resolveEffectivePolicy('attendance', { employeeId: 'EMP-003', departmentId: 'DEP-01' })
    assert.equal(effectiveDept.id, 'POL-ATT-DEV-002')
    assert.equal(effectiveDept.precedence, 2)

    // For an employee in DEP-02 (Sales), should resolve the company-wide policy (precedence 4)
    const effectiveCompany = policyService.resolveEffectivePolicy('attendance', { employeeId: 'EMP-005', departmentId: 'DEP-02' })
    assert.equal(effectiveCompany.id, 'POL-ATT-001')
    assert.equal(effectiveCompany.precedence, 4)
  })

  // 5. Conflicting policy detection
  it('5. Conflicting policy detection: prevents overlapping active policies with identical scope and dates', () => {
    assert.throws(
      () => {
        policyService.createPolicy(
          {
            name: 'Conflicting Corporate Attendance Policy',
            category: 'attendance',
            appliesTo: 'Company-Wide',
            scopeValue: 'all',
            effectiveFrom: '2026-03-01',
            effectiveTo: '2026-09-30'
          },
          { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }
        )
      },
      /Policy Conflict Detected/
    )
  })

  // 6. Role permission assignment
  it('6. Role permission assignment: Super Admin can update role permissions', () => {
    const updated = permissionService.updateRolePermissions(
      'manager',
      'expenses',
      ['view', 'submit', 'approve', 'export'],
      { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }
    )

    assert.ok(updated.modules.expenses.includes('export'))
    assert.equal(permissionService.hasPermission('manager', 'expenses', 'export'), true)
  })

  // 7. Unauthorized privilege escalation rejection
  it('7. Unauthorized privilege escalation rejection: HR Admin cannot modify role permissions', () => {
    assert.throws(
      () => {
        permissionService.updateRolePermissions(
          'hr_admin',
          'settings',
          ['view', 'create', 'manage_config'],
          { name: 'Ayesha Khan', role: 'hr_admin', id: 'EMP-002' }
        )
      },
      /Unauthorized/
    )
  })

  // 8. Protected Super Admin safeguards
  it('8. Protected Super Admin safeguards: cannot strip root administrative permissions', () => {
    assert.throws(
      () => {
        permissionService.updateRolePermissions(
          'super_admin',
          'settings',
          ['view'], // Stripping manage_config
          { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }
        )
      },
      /Safeguard Violation/
    )
  })

  // 9. No self-approval
  it('9. No self-approval: HR Admin applicant cannot self-approve personal requests', () => {
    const routing = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-002', // Ayesha Khan (HR Admin)
      amountOrDays: 1
    })

    assert.equal(routing.currentApproverRole, 'super_admin')
    assert.equal(routing.isEscalated, true)
    assert.match(routing.escalationReason, /Anti-Self-Approval/i)
  })

  // 10. Employee leave approval routing
  it('10. Employee leave approval routing: 1-day request routes to Manager', () => {
    const routing = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-004', // Zeeshan Ali (Employee)
      amountOrDays: 1,
      cumulativeAmountOrDays: 0
    })

    assert.equal(routing.currentApproverTier, 'Manager')
    assert.equal(routing.currentApproverRole, 'manager')
    assert.equal(routing.isEscalated, false)
  })

  // 11. Manager leave approval routing
  it('11. Manager leave approval routing: routes to HR Admin up to 2 days', () => {
    const routing = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-003', // Bilal Siddiqui (Manager)
      amountOrDays: 2,
      cumulativeAmountOrDays: 0
    })

    assert.equal(routing.currentApproverTier, 'HR Admin')
    assert.equal(routing.currentApproverRole, 'hr_admin')
    assert.equal(routing.isEscalated, false)
  })

  // 12. HR/Admin own leave routing
  it('12. HR/Admin own leave routing: always routes to Super Admin regardless of duration', () => {
    const routing = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-002',
      amountOrDays: 0.5
    })

    assert.equal(routing.currentApproverRole, 'super_admin')
    assert.equal(routing.currentApproverId, 'EMP-001')
  })

  // 13. Annual request quota approval limits & escalation
  it('13. Annual request quota: 3rd request in calendar year escalates Team Lead to HR Admin', () => {
    const routing = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-004',
      amountOrDays: 1,
      cumulativeAmountOrDays: 2 // 2 previous approved requests in year
    })

    assert.equal(routing.currentApproverTier, 'HR Admin')
    assert.equal(routing.currentApproverRole, 'hr_admin')
    assert.equal(routing.isEscalated, true)
    assert.match(routing.escalationReason, /annual threshold/i)
  })

  // 14. Attendance late allowance configuration
  it('14. Attendance late configuration: retrieves active policy rules', () => {
    const policy = policyService.resolveEffectivePolicy('attendance')
    assert.equal(policy.rules.allowedLatesPerMonth, 4)
    assert.equal(policy.rules.graceMinutes, 15)
    assert.equal(policy.rules.halfDayHourThreshold, 4.0)
  })

  // 15. Leave entitlement updates for new periods
  it('15. Leave entitlements: verified against centralized policy definitions', () => {
    const policy = policyService.resolveEffectivePolicy('leaves')
    assert.equal(policy.rules.annualLeaveEntitlement, 14)
    assert.equal(policy.rules.casualLeaveEntitlement, 10)
    assert.equal(policy.rules.sickLeaveEntitlement, 8)
  })

  // 16. Salary revision Super Admin authorization
  it('16. Salary revision: strictly requires Super Admin final authorization', () => {
    const routing = approvalRuleService.evaluateApprovalRouting({
      module: 'payroll',
      requestType: 'salary_revision',
      applicantId: 'EMP-004',
      amountOrDays: 15 // 15% increment
    })

    assert.equal(routing.currentApproverRole, 'super_admin')
    assert.equal(routing.isEscalated, true)
  })

  // 17. Allowance eligibility configuration
  it('17. Allowance eligibility: fuel allowance excludes reimbursement policy rule', () => {
    const payPolicy = policyService.resolveEffectivePolicy('payroll')
    assert.equal(payPolicy.rules.fuelAllowanceExcludesReimbursement, true)
  })

  // 18. Travel and expense threshold updates
  it('18. Expense routing thresholds: Manager <= 25k, HR <= 75k, Super Admin > 75k', () => {
    const rManager = approvalRuleService.evaluateApprovalRouting({
      module: 'expenses',
      applicantId: 'EMP-004',
      amountOrDays: 15000
    })
    assert.equal(rManager.currentApproverRole, 'manager')

    const rHR = approvalRuleService.evaluateApprovalRouting({
      module: 'expenses',
      applicantId: 'EMP-004',
      amountOrDays: 45000
    })
    assert.equal(rHR.currentApproverRole, 'hr_admin')

    const rSuperAdmin = approvalRuleService.evaluateApprovalRouting({
      module: 'expenses',
      applicantId: 'EMP-004',
      amountOrDays: 95000
    })
    assert.equal(rSuperAdmin.currentApproverRole, 'super_admin')
  })

  // 19. Help Desk SLA policy integration
  it('19. Help Desk SLA policy: defines resolution hours by ticket severity', () => {
    const policy = policyService.resolveEffectivePolicy('helpdesk')
    assert.equal(policy.rules.slaHoursUrgent, 4)
    assert.equal(policy.rules.slaHoursHigh, 12)
    assert.equal(policy.rules.slaHoursMedium, 24)
    assert.equal(policy.rules.slaHoursLow, 48)
  })

  // 20. Working-calendar configuration
  it('20. Working-calendar configuration: accurately checks holidays and working days', () => {
    // 2026-03-23 is Pakistan Day (official holiday)
    const holCheck = holidayCalendarService.isHoliday('2026-03-23')
    assert.equal(holCheck.isHoliday, true)
    assert.equal(holCheck.holiday.name, 'Pakistan Day')
    assert.equal(holidayCalendarService.isWorkingDay('2026-03-23'), false)

    // Calculate working days between 2026-03-20 (Fri Eid) and 2026-03-24 (Tue)
    // 2026-03-20 (Eid - Hol), 2026-03-21 (Sat - Weekend), 2026-03-22 (Sun - Weekend), 2026-03-23 (Pakistan Day - Hol), 2026-03-24 (Tue - Working)
    const workingDays = holidayCalendarService.calculateWorkingDays('2026-03-20', '2026-03-24')
    assert.equal(workingDays, 1) // Only Tuesday March 24 is a working day!
  })

  // 21. Scheduled alert trigger preview
  it('21. Scheduled alert trigger preview: returns preview entities for triggerEvent', () => {
    const preview = scheduledAlertService.previewTriggerResults('ALT-PROB')
    assert.ok(Array.isArray(preview))
    assert.ok(preview.length > 0)
    assert.equal(preview[0].status, 'Trigger Met')
  })

  // 22. Alert recipient scoping
  it('22. Alert recipient scoping: correctly scopes target recipients', () => {
    const recipients = scheduledAlertService.previewRecipients('ALT-SAL-REV')
    assert.ok(Array.isArray(recipients))
    // Salary revision alert targets super_admin (EMP-001)
    assert.ok(recipients.some((r) => r.id === 'EMP-001' || r.role === 'super_admin'))
  })

  // 23. Duplicate notification prevention & read status
  it('23. Notification management: marks notification as read and preserves count', () => {
    const user = { id: 'EMP-001', role: 'super_admin' }
    const initial = scheduledAlertService.getNotificationsForUser(user)
    const unreadBefore = initial.filter((n) => !n.isRead).length

    assert.ok(unreadBefore > 0)
    scheduledAlertService.markAsRead(initial[0].id)

    const updated = scheduledAlertService.getNotificationsForUser(user)
    const target = updated.find((n) => n.id === initial[0].id)
    assert.equal(target.isRead, true)
  })

  // 24. Policy/audit history preservation
  it('24. Audit history preservation: log entries are appended and retrievable', () => {
    auditService.logEvent({
      actor: 'Tariq Mehmood (Super Admin)',
      actorId: 'EMP-001',
      actorRole: 'super_admin',
      action: 'SECURITY_TEST_LOG',
      entity: 'TEST-001',
      entityName: 'Automated Test',
      reason: 'Batch F13 verification test'
    })

    const logs = auditService.getLogs({ action: 'SECURITY_TEST_LOG' })
    assert.equal(logs.length, 1)
    assert.equal(logs[0].entity, 'TEST-001')
  })

  // 25. Historical finalized transaction immutability
  it('25. Historical finalized transactions: policy version change does not alter past records', () => {
    const p1 = policyService.getPolicyById('POL-EXP-001')
    assert.equal(p1.version, '2.0')

    // Version the policy
    policyService.versionPolicy('POL-EXP-001', { allowedLimit: 30000 }, { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' })

    const pUpdated = policyService.getPolicyById('POL-EXP-001')
    assert.equal(pUpdated.version, '2.1')
    assert.equal(pUpdated.allowedLimit, 30000)

    // Verify audit record contains the snapshot of prior version
    const auditRecord = auditService.getLogs().find((l) => l.action === 'POLICY_VERSIONED')
    assert.ok(auditRecord)
    assert.match(auditRecord.previousValue, /v2\.0/i)
  })

  // 26. Four portal access restrictions
  it('26. Four portal access restrictions: verifies RBAC boundaries across roles', () => {
    // Super Admin has all permissions
    assert.equal(permissionService.hasPermission('super_admin', 'settings', 'manage_config'), true)

    // HR Admin has operational view/edit, but cannot manage root config
    assert.equal(permissionService.hasPermission('hr_admin', 'settings', 'view'), true)
    assert.equal(permissionService.hasPermission('hr_admin', 'settings', 'manage_config'), false)

    // Manager can view team leaves and approve, but cannot edit settings
    assert.equal(permissionService.hasPermission('manager', 'leaves', 'approve'), true)
    assert.equal(permissionService.hasPermission('manager', 'settings', 'edit'), false)

    // Employee cannot approve leaves or manage settings
    assert.equal(permissionService.hasPermission('employee', 'leaves', 'approve'), false)
    assert.equal(permissionService.hasPermission('employee', 'settings', 'edit'), false)
    assert.equal(permissionService.hasPermission('employee', 'leaves', 'create'), true)
  })
})
