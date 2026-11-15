import test from 'node:test'
import assert from 'node:assert/strict'

import { authService } from '../services/authService.js'
import { employeeService } from '../services/employeeService.js'
import { leaveService } from '../services/leaveService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'
import { DEMO_USERS } from '../mocks/demoUsers.js'
import { PORTAL_CONFIG } from '../config/navigation.js'

test('Team Lead Hierarchy & QA Login: Hina Farooq (EMP-005) has exactly 1 direct report (Ahmed Raza QA)', () => {
  // Scoped team roster for Team Lead Hina Farooq
  const tlScope = employeeService.getTeamLeadScope('EMP-005')
  assert.equal(tlScope.length, 1, 'Team Lead Hina Farooq must have exactly 1 direct report in canonical roster')
  assert.equal(tlScope[0].id, 'EMP-016', 'The direct report must be Ahmed Raza QA (EMP-016)')
  assert.equal(tlScope[0].managerId, 'EMP-005', 'Ahmed Raza QA managerId must be Hina Farooq (EMP-005)')

  // getAuthorizedTeamEmployees with role 'team_lead'
  const authorized = employeeService.getAuthorizedTeamEmployees('EMP-005', 'team_lead')
  assert.equal(authorized.length, 1, 'Authorized employees count for team lead must match 1')
  assert.equal(authorized[0].id, 'EMP-016')
})

test('Team Lead Hierarchy & QA Login: Leave Approvals queue is scoped to assigned team employee only', () => {
  const authorized = employeeService.getAuthorizedTeamEmployees('EMP-005', 'team_lead')
  const authorizedIds = new Set(authorized.map((e) => e.id))

  // Requests must be scoped strictly to authorized IDs
  const allRequests = leaveService.getLeaveRequests()
  const scopedRequests = allRequests.filter((r) => authorizedIds.has(r.employeeId))

  // Must only contain Ahmed Raza QA's requests
  assert.ok(scopedRequests.length > 0, 'Should have at least 1 leave request for Ahmed Raza QA')
  scopedRequests.forEach((req) => {
    assert.equal(req.employeeId, 'EMP-016', 'All scoped requests must belong to EMP-016')
  })

  // Scoped leave balances ledger
  const allBalances = leaveBalanceService.getLedger()
  const scopedBalances = allBalances.filter((b) => authorizedIds.has(b.employeeId))
  assert.ok(scopedBalances.length > 0, 'Should have ledger records for EMP-016')
  scopedBalances.forEach((b) => {
    assert.equal(b.employeeId, 'EMP-016', 'All scoped balances must belong to EMP-016')
  })
})

test('Team Lead Hierarchy & QA Login: Ahmed Raza QA (EMP-016) Demo Login and Identity Mapping', async () => {
  // 1. Check in DEMO_USERS
  const qaUser = DEMO_USERS.find((u) => u.id === 'EMP-016')
  assert.ok(qaUser, 'EMP-016 must exist in DEMO_USERS')
  assert.equal(qaUser.role, 'employee')
  assert.equal(qaUser.roleLabel, 'Employee (QA)')
  assert.equal(qaUser.portalPath, '/employee')
  assert.equal(qaUser.managerId, 'EMP-005')

  // 2. Login via email
  const session1 = await authService.login('ahmed.qa@isysware.com', 'password123')
  assert.equal(session1.id, 'EMP-016')
  assert.equal(session1.employeeId, 'EMP-016')
  assert.equal(session1.role, 'employee')

  // 3. Login via shortcut 'ahmed'
  const session2 = await authService.login('ahmed', 'password123')
  assert.equal(session2.id, 'EMP-016')
  assert.equal(session2.employeeId, 'EMP-016')

  // 4. Switch role directly
  const switched = authService.switchDemoRole('EMP-016')
  assert.equal(switched.id, 'EMP-016')
  assert.equal(switched.employeeId, 'EMP-016')

  const current = authService.getCurrentUser()
  assert.equal(current.id, 'EMP-016')
  assert.equal(current.employeeId, 'EMP-016')
})

test('Team Lead Hierarchy & QA Login: Canonical Reporting Chain EMP-016 -> EMP-005 -> EMP-003 -> EMP-001', () => {
  const hierarchy = employeeService.getReportingHierarchy('EMP-016')
  assert.ok(hierarchy.length >= 2, 'Must have at least Team Lead and Department Manager')

  // Level 1: Team Lead Hina Farooq (EMP-005)
  assert.equal(hierarchy[0].role, 'team_lead')
  assert.equal(hierarchy[0].employee.id, 'EMP-005')
  assert.equal(hierarchy[0].employee.name, 'Hina Farooq')

  // Level 2: Department Manager Bilal Siddiqui (EMP-003)
  assert.equal(hierarchy[1].role, 'manager')
  assert.equal(hierarchy[1].employee.id, 'EMP-003')
  assert.equal(hierarchy[1].employee.name, 'Bilal Siddiqui')

  // Level 3: Super Admin Tariq Mehmood (EMP-001)
  if (hierarchy[2]) {
    assert.equal(hierarchy[2].role, 'super_admin')
    assert.equal(hierarchy[2].employee.id, 'EMP-001')
  }
})

test('Team Lead Hierarchy & QA Login: Data Isolation and Zero Cross-Team Leakage', () => {
  // Hina Farooq's scope must not contain Zeeshan Ali (EMP-004) or Usman Tariq (EMP-006)
  const tlScope = employeeService.getTeamLeadScope('EMP-005')
  const tlScopeIds = new Set(tlScope.map((e) => e.id))
  assert.ok(!tlScopeIds.has('EMP-004'), 'Zeeshan Ali (TEAM-01) must NOT leak into Hina Farooq scope')
  assert.ok(!tlScopeIds.has('EMP-006'), 'Usman Tariq (TEAM-01) must NOT leak into Hina Farooq scope')
  assert.ok(!tlScopeIds.has('EMP-003'), 'Bilal Siddiqui must NOT leak into Hina Farooq scope')

  // Ahmed Raza QA cannot approve leaves or see other employees
  assert.throws(
    () => employeeService.validateApprovalAuthorization('EMP-004', 'EMP-016', 'employee'),
    /authority/i,
    'Employee EMP-016 cannot approve for other employees'
  )

  // No self-approval for Hina Farooq
  assert.throws(
    () => employeeService.validateApprovalAuthorization('EMP-005', 'EMP-005', 'team_lead'),
    /Self-approval prohibited/i,
    'Team Lead cannot self-approve'
  )
})

test('Employee Directory: Active to Inactive toggle and Navigation cleanup', () => {
  // 1. Verify Career & Position History removed from Employee My Profile submodules
  const empProfileItem = PORTAL_CONFIG.employee.menuGroups
    .flatMap((g) => g.items)
    .find((i) => i.key === 'profile')
  assert.ok(empProfileItem, 'Profile item must exist')
  const subKeys = (empProfileItem.submodules || []).map((s) => s.key)
  assert.ok(!subKeys.includes('career'), 'Career & Position History must be removed from My Profile submodules')

  // 2. Test status toggle Active <-> Inactive
  const targetId = 'EMP-007'
  const original = employeeService.getEmployeeById(targetId)
  assert.ok(original)

  // Toggle to Inactive
  employeeService.deactivateEmployee(targetId, 'Deactivated via Directory Action', 'Tariq Mehmood')
  const deactivated = employeeService.getEmployeeById(targetId)
  assert.equal(deactivated.status, 'Separated')

  // Toggle back to Active
  employeeService.activateEmployee(targetId, 'Reactivated via Directory Action', 'Tariq Mehmood')
  const reactivated = employeeService.getEmployeeById(targetId)
  assert.equal(reactivated.status, 'Active')
})

test('Bug 04: Reverse-Hierarchy Guard — Team Lead never sees their own manager, department head, or supervisors as subordinate', () => {
  // Setup: Simulate canonical hierarchy Hamza (EMP-003 Manager) -> Ali Raza (EMP-004 Team Lead, FE-01)
  // Ensure EMP-004 has managerId 'EMP-003' and teamId 'FE-01'
  const tlScope = employeeService.getTeamLeadScope('EMP-004')
  const tlMemberIds = tlScope.map((m) => m.id)

  // 1. Team Lead's own manager (EMP-003) must NEVER appear as a subordinate
  assert.equal(tlMemberIds.includes('EMP-003'), false, 'Team Lead manager (EMP-003) must never be in subordinate roster')

  // 2. Self (EMP-004) must NEVER appear in their own subordinate list
  assert.equal(tlMemberIds.includes('EMP-004'), false, 'Team Lead cannot include self in subordinate roster')

  // 3. Super Admin (EMP-001) and HR Admin (EMP-002) must NEVER appear as subordinates
  assert.equal(tlMemberIds.includes('EMP-001'), false, 'Super Admin EMP-001 must never appear as subordinate')
  assert.equal(tlMemberIds.includes('EMP-002'), false, 'HR Admin EMP-002 must never appear as subordinate')

  // 4. Department Heads must NEVER appear as subordinates
  const depts = employeeService.getDepartments()
  const headIds = depts.filter((d) => d.headId).map((d) => d.headId)
  headIds.forEach((hId) => {
    assert.equal(tlMemberIds.includes(hId), false, `Department Head ${hId} must not be in Team Lead scope`)
  })
})

test('Bug 04: Hierarchy Directionality — Department Manager sees Team Lead as subordinate, not the reverse', () => {
  // Manager scope for EMP-003
  const mgrScope = employeeService.getDepartmentManagerScope('EMP-003')
  const mgrMemberIds = mgrScope.map((m) => m.id)

  // Hamza EMP-003 MUST see Ali EMP-004 as his direct report
  assert.ok(mgrMemberIds.includes('EMP-004'), 'Department Manager must see Team Lead EMP-004 as subordinate')

  // But Ali EMP-004 must NOT see Hamza EMP-003
  const tlScope = employeeService.getTeamLeadScope('EMP-004')
  assert.equal(tlScope.some((m) => m.id === 'EMP-003'), false, 'Team Lead must not see Manager as subordinate')
})

test('Bug 04: Empty Team & Dynamic Subordinate Addition in Team Lead Scope', () => {
  // A newly created team with a Team Lead and 0 reports
  const dept = employeeService.getDepartments()[0]
  const newTeamId = employeeService.saveTeam(
    {
      code: 'QA-TEST-TL-TEAM',
      name: 'QA Test Isolated Team',
      departmentId: dept.id,
      status: 'Active'
    },
    'Super Admin'
  )

  // Assign an employee as team lead
  const testLeadId = 'EMP-008'
  employeeService.assignTeamLeadOrManager(
    {
      employeeId: testLeadId,
      teamId: newTeamId,
      role: 'team_lead',
      effectiveDate: '2026-11-01'
    },
    'Super Admin'
  )

  // Team currently has 0 subordinates
  const emptyScope = employeeService.getTeamLeadScope(testLeadId)
  // None of the members should be in the new isolated team
  const newTeamMembers = emptyScope.filter((m) => m.teamId === newTeamId)
  assert.equal(newTeamMembers.length, 0, 'New team with 0 reports must have empty subordinate scope')

  // Now onboard a new subordinate reporting to testLeadId in newTeam
  const newSubordinate = employeeService.createEmployee(
    {
      name: 'Junior Developer QA Test',
      email: 'junior.dev.qa@example.com',
      departmentId: dept.id,
      teamId: newTeamId,
      managerId: testLeadId,
      designation: 'Software Engineer',
      employmentType: 'Permanent'
    },
    'Super Admin'
  )

  // Now Team Lead scope must include the new subordinate
  const updatedScope = employeeService.getTeamLeadScope(testLeadId)
  assert.ok(updatedScope.some((m) => m.id === newSubordinate.id), 'Newly created subordinate must appear in Team Lead scope')
})
