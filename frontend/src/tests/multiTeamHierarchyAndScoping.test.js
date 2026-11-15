import test from 'node:test'
import assert from 'node:assert/strict'

import { employeeService } from '../services/employeeService.js'
import { leaveService } from '../services/leaveService.js'
import { authService } from '../services/authService.js'

test('Multi-Team Hierarchy: Initial team assignments loaded correctly', () => {
  const assignments = employeeService.getTeamAssignments()
  assert.ok(Array.isArray(assignments), 'Assignments must be an array')
  assert.ok(assignments.length >= 10, 'Must have at least 10 initial assignments')

  // Verify EMP-004 multi-team assignment (TEAM-01 and TEAM-02)
  const zeeshanAssignments = assignments.filter((a) => a.employeeId === 'EMP-004' && a.status === 'Active')
  assert.ok(zeeshanAssignments.length >= 2, 'EMP-004 must be assigned to multiple teams')
  const teamIds = zeeshanAssignments.map((a) => a.teamId)
  assert.ok(teamIds.includes('TEAM-01'), 'EMP-004 assigned to TEAM-01')
  assert.ok(teamIds.includes('TEAM-02'), 'EMP-004 assigned to TEAM-02')
})

test('Multi-Team Hierarchy: Multi-team scoping for Team Lead with strict employee deduplication', () => {
  // Get scoped teams for EMP-004 as team_lead
  const scopedTeams = employeeService.getScopedTeams('EMP-004', 'team_lead')
  const scopedTeamIds = scopedTeams.map((t) => t.id)
  assert.ok(scopedTeamIds.includes('TEAM-01'), 'Must include TEAM-01')
  assert.ok(scopedTeamIds.includes('TEAM-02'), 'Must include TEAM-02')

  // Get employee scope for EMP-004 (returns deduplicated array of direct and team subordinates)
  const leadEmployees = employeeService.getTeamLeadScope('EMP-004')
  assert.ok(Array.isArray(leadEmployees), 'Must return array of employees')
  assert.ok(leadEmployees.length >= 1, 'Lead scope must include reports from assigned teams')
  assert.equal(leadEmployees.some((m) => m.id === 'EMP-003'), false, 'Team Lead manager EMP-003 must never appear in subordinate scope')

  // Verify employee deduplication
  const employeeIds = leadEmployees.map((e) => e.id)
  const uniqueEmployeeIds = new Set(employeeIds)
  assert.equal(employeeIds.length, uniqueEmployeeIds.size, 'Employee list must not contain duplicates')
})

test('Multi-Team Hierarchy: Multi-team scoping for Department / Sub-dept Manager', () => {
  // EMP-007 Farhan Akhtar is assigned to TEAM-04 and TEAM-05
  const scopedTeams = employeeService.getScopedTeams('EMP-007', 'manager')
  const scopedTeamIds = scopedTeams.map((t) => t.id)
  assert.ok(scopedTeamIds.includes('TEAM-04'), 'Must include TEAM-04')
  assert.ok(scopedTeamIds.includes('TEAM-05'), 'Must include TEAM-05')

  // Scope deduplication for manager
  const mgrEmployees = employeeService.getDepartmentManagerScope('EMP-007')
  assert.ok(Array.isArray(mgrEmployees), 'Manager scope must be an array')
  const mgrEmpIds = mgrEmployees.map((e) => e.id)
  const uniqueMgrEmpIds = new Set(mgrEmpIds)
  assert.equal(mgrEmpIds.length, uniqueMgrEmpIds.size, 'Manager employee list must have zero duplicates')
})

test('Multi-Team Hierarchy: Cross-department assignment policy guard', () => {
  // Clear existing lead on TEAM-04 to test clean cross-department assignment
  employeeService.removeTeamAssignment('TA-07', 'Preparation for cross-dept test', 'Super Admin')

  // EMP-005 is in DEP-01. Assign to TEAM-04 (which is in DEP-02).
  // Without Super Admin or HR Admin authorization, this should fail.
  assert.throws(
    () => {
      employeeService.assignTeamLeadOrManager(
        {
          employeeId: 'EMP-005',
          role: 'team_lead',
          teamId: 'TEAM-04',
          effectiveDate: '2026-11-01'
        },
        'Regular User'
      )
    },
    /Cross-department assignment/i,
    'Unauthorized actor cannot assign across departments'
  )

  // With Super Admin authorization, cross-department assignment succeeds
  const createdAssignmentId = employeeService.assignTeamLeadOrManager(
    {
      employeeId: 'EMP-005',
      role: 'team_lead',
      teamId: 'TEAM-04',
      effectiveDate: '2026-11-01',
      notes: 'Cross-dept QA coverage authorized'
    },
    'Tariq Mehmood (Super Admin)'
  )
  const createdAssignment = employeeService.getTeamAssignmentById(createdAssignmentId)
  assert.ok(createdAssignment && createdAssignment.id, 'New assignment created')
  assert.equal(createdAssignment.employeeId, 'EMP-005')
  assert.equal(createdAssignment.teamId, 'TEAM-04')

  // Clean up by removing assignment
  employeeService.removeTeamAssignment(createdAssignment.id, 'Test cleanup', 'Super Admin')
  const cleaned = employeeService.getTeamAssignmentById(createdAssignment.id)
  assert.equal(cleaned.status, 'Inactive')
})

test('Multi-Team Hierarchy: Team assignment removal and audit history tracking', () => {
  // Clear existing lead on TEAM-03 to test assignment and removal
  employeeService.removeTeamAssignment('TA-03', 'Preparation for assignment removal test', 'Super Admin')

  // Create a temporary assignment
  const assignmentId = employeeService.assignTeamLeadOrManager(
    {
      employeeId: 'EMP-006',
      role: 'team_lead',
      teamId: 'TEAM-03',
      effectiveDate: '2026-11-01'
    },
    'Super Admin'
  )

  const initialHistory = employeeService.getTeamAssignmentHistory()
  const historyForEmp = initialHistory.filter((h) => h.employeeId === 'EMP-006' && h.teamId === 'TEAM-03')
  assert.ok(historyForEmp.some((h) => h.role === 'team_lead'), 'History must record team lead assignment')

  // Remove the assignment
  employeeService.removeTeamAssignment(assignmentId, 'Role rotation', 'Super Admin')
  const afterRemove = employeeService.getTeamAssignmentById(assignmentId)
  assert.equal(afterRemove.status, 'Inactive', 'Status must be Inactive')

  const updatedHistory = employeeService.getTeamAssignmentHistory()
  const deassignedRecord = updatedHistory.find(
    (h) => h.teamId === 'TEAM-03' && (h.changeType === 'TEAM_LEAD_REMOVED' || h.changeType === 'TEAM_DEASSIGNMENT')
  )
  assert.ok(deassignedRecord, 'History must record removal action')
  assert.equal(deassignedRecord.reason, 'Role rotation')
})

test('Multi-Team Hierarchy: Dynamic eligible reporting manager resolution', () => {
  // Query eligible managers for an employee in DEP-01, SUBDEP-01, TEAM-01
  const eligible = employeeService.getEligibleReportingManagers('DEP-01', 'SUBDEP-01', 'TEAM-01', 'EMP-016')
  assert.ok(eligible.length > 0, 'Must have eligible managers')

  // None of the eligible managers should be the employee themselves
  assert.ok(!eligible.some((m) => m.id === 'EMP-016'), 'Self cannot be an eligible manager')

  // None of the eligible managers should be inactive or separated
  assert.ok(!eligible.some((m) => m.status === 'Separated' || m.status === 'Inactive'), 'Separated staff cannot be eligible managers')

  // Assigned team lead (EMP-004) should be present and marked as team lead
  const teamLead = eligible.find((m) => m.id === 'EMP-004')
  assert.ok(teamLead, 'Assigned team lead EMP-004 must be eligible')
  assert.equal(teamLead.isAssignedLead, true)

  // There should be a recommended manager
  const recommended = eligible.find((m) => m.isRecommended)
  assert.ok(recommended, 'A recommended manager must be designated')
})

test('Multi-Team Hierarchy: Approval integrity and anti-self-approval', () => {
  // Anti-self approval policy violation check
  assert.throws(
    () => {
      employeeService.validateApprovalAuthorization('EMP-003', 'EMP-003', 'manager')
    },
    /Anti-Self-Approval policy violation/i,
    'Manager cannot approve their own request'
  )

  // Multi-team lead can review leave requests from any of their assigned teams
  const leadTeams = employeeService.getScopedTeams('EMP-004', 'team_lead')
  assert.ok(leadTeams.length >= 2, 'EMP-004 leads multiple teams')
  const teamMemberAuth = employeeService.validateApprovalAuthorization('EMP-016', 'EMP-005', 'team_lead')
  assert.ok(teamMemberAuth.valid, 'Team Lead can approve direct report in assigned team')
})

test('Bug 03: Re-saving existing active Team Lead assignment is idempotent and does not throw duplicate error', () => {
  // First assignment / existing active assignment on TEAM-03 (led by EMP-005)
  const firstId = employeeService.assignTeamLeadOrManager(
    {
      employeeId: 'EMP-005',
      teamId: 'TEAM-03',
      role: 'team_lead',
      effectiveDate: '2026-11-01'
    },
    'Tariq Mehmood (Super Admin)'
  )
  assert.ok(firstId, 'First assignment succeeded')

  // Re-saving exact same active assignment should return existing id without throwing
  const secondId = employeeService.assignTeamLeadOrManager(
    {
      employeeId: 'EMP-005',
      teamId: 'TEAM-03',
      role: 'team_lead',
      effectiveDate: '2026-11-01'
    },
    'Tariq Mehmood (Super Admin)'
  )
  assert.equal(secondId, firstId, 'Second call must return identical assignment id')

  // promoteOrTransferEmployee with existing leadership role succeeds without error
  const res = employeeService.promoteOrTransferEmployee(
    {
      employeeId: 'EMP-005',
      assignAsRole: 'team_lead',
      teamId: 'TEAM-03',
      reason: 'Periodic role confirmation'
    },
    'HR Administrator'
  )
  assert.ok(res.success, 'Promotion/transfer with existing leadership role must succeed')
})

test('Bug 03: Authorized Team Lead can authenticate using provisioned credentials', async () => {
  const users = authService.getUserAccounts()
  const teamLeadUser = users.find((u) => u.role === 'team_lead')
  assert.ok(teamLeadUser, 'A Team Lead user account must exist')

  // Authenticate by ID
  const sessionById = await authService.login(teamLeadUser.id, 'password123')
  assert.equal(sessionById.role, 'team_lead')

  // Authenticate by Email
  const sessionByEmail = await authService.login(teamLeadUser.email, 'password123')
  assert.equal(sessionByEmail.role, 'team_lead')

  // Authenticate by Role shortcut 'team lead'
  const sessionByRole = await authService.login('team lead', 'password123')
  assert.equal(sessionByRole.role, 'team_lead')
})
