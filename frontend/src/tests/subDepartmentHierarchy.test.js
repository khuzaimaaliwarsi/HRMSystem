import test from 'node:test'
import assert from 'node:assert/strict'

import { employeeService } from '../services/employeeService.js'

test('Sub-Department Hierarchy: Read initial sub-departments', () => {
  const subDepts = employeeService.getSubDepartments()
  assert.ok(Array.isArray(subDepts), 'Sub-departments must be an array')
  assert.ok(subDepts.length >= 3, 'Must have at least 3 initial sub-departments')

  const sub1 = subDepts.find((s) => s.id === 'SUBDEP-01')
  assert.ok(sub1, 'SUBDEP-01 must exist')
  assert.equal(sub1.departmentId, 'DEP-01')
  assert.equal(sub1.name, 'Web Applications & UI')
})

test('Sub-Department Hierarchy: Create and Update sub-department', () => {
  // Create
  const createdId = employeeService.saveSubDepartment(
    {
      name: 'Mobile Engineering',
      code: 'DEV-MOB',
      departmentId: 'DEP-01',
      managerId: 'EMP-003',
      description: 'iOS and Android native apps'
    },
    'Test Actor'
  )
  assert.ok(typeof createdId === 'string' && createdId.startsWith('SUBDEP-'), 'New ID must be generated')
  const created = employeeService.getSubDepartmentById(createdId)
  assert.equal(created.name, 'Mobile Engineering')
  assert.equal(created.code, 'DEV-MOB')

  // Update
  employeeService.saveSubDepartment(
    {
      id: createdId,
      name: 'Mobile & Device Engineering',
      code: 'DEV-MOB',
      departmentId: 'DEP-01',
      managerId: 'EMP-003',
      description: 'iOS, Android and edge clients'
    },
    'Test Actor'
  )
  const updated = employeeService.getSubDepartmentById(createdId)
  assert.equal(updated.name, 'Mobile & Device Engineering')

  // Status toggle
  const newStatus = employeeService.toggleSubDepartmentStatus(createdId, 'Test Actor')
  assert.equal(newStatus, 'Inactive')

  // Clean up
  employeeService.deleteSubDepartment(createdId, 'Test Actor')
  const afterDelete = employeeService.getSubDepartmentById(createdId)
  assert.equal(afterDelete, null, 'Deleted sub-department must no longer exist')
})

test('Sub-Department Hierarchy: Parent-child relationship validation on Teams', () => {
  // Valid team with matching sub-department
  const valid = employeeService.validateDepartmentTeamConsistency('DEP-01', 'TEAM-01', 'SUBDEP-01')
  assert.equal(valid.valid, true)

  // Incompatible sub-department belonging to different department
  const invalid = employeeService.validateDepartmentTeamConsistency('DEP-02', 'TEAM-04', 'SUBDEP-01')
  assert.equal(invalid.valid, false)
})

test('Sub-Department Hierarchy: Optional Sub-departments (Teams without Sub-department)', () => {
  // Teams in Sales (DEP-02), HR (DEP-04), Finance (DEP-05) have no sub-department
  const salesTeam = employeeService.getTeamById('TEAM-04')
  assert.ok(salesTeam)
  assert.ok(!salesTeam.subDepartmentId, 'Sales Team should have no subDepartmentId')

  // Consistency check without sub-department succeeds
  const valid = employeeService.validateDepartmentTeamConsistency('DEP-02', 'TEAM-04', null)
  assert.equal(valid.valid, true)
})

test('Sub-Department Hierarchy: Scoped Teams for Sub-Department and Department Heads', () => {
  // Department Head Bilal Siddiqui (EMP-003) manages DEP-01
  const scopedTeams = employeeService.getScopedTeams('EMP-003', 'manager')
  assert.ok(scopedTeams.length >= 3, 'Bilal should manage all teams under DEP-01')

  // Scope includes sub-department metadata
  const webTeam = scopedTeams.find((t) => t.id === 'TEAM-01')
  assert.ok(webTeam, 'TEAM-01 Frontend Web Team must be included')
  assert.equal(webTeam.subDepartmentId, 'SUBDEP-01')

  // Department Manager Scope returns authorized employees
  const deptScopeEmps = employeeService.getDepartmentManagerScope('EMP-003')
  assert.ok(deptScopeEmps.length >= 3, 'Bilal should see authorized department employees')
  assert.ok(deptScopeEmps.every((e) => e.departmentId === 'DEP-01' || e.teamId.startsWith('TEAM-0')))
})

test('Sub-Department Hierarchy: Team Lead scope restricted to assigned team only', () => {
  // Team Lead Hina Farooq (EMP-005) leads TEAM-03
  const tlScope = employeeService.getTeamLeadScope('EMP-005')
  assert.equal(tlScope.length, 1, 'Hina Farooq must only see 1 direct report (Ahmed Raza QA)')
  assert.equal(tlScope[0].id, 'EMP-016')

  // Scoped teams for team lead
  const tlTeams = employeeService.getScopedTeams('EMP-005', 'team_lead')
  assert.equal(tlTeams.length, 1, 'Hina should only manage TEAM-03')
  assert.equal(tlTeams[0].id, 'TEAM-03')
})

test('Sub-Department Hierarchy: Employee creation and editing with Sub-department', () => {
  // Create employee with sub-department
  const testEmail = `hierarchy_qa_${Date.now()}@isysware.com`
  const newEmp = employeeService.createEmployee(
    {
      name: 'Farhan Zaidi',
      email: testEmail,
      departmentId: 'DEP-01',
      subDepartmentId: 'SUBDEP-01',
      teamId: 'TEAM-01',
      designationId: 'DESIG-04',
      managerId: 'EMP-004',
      employmentType: 'Permanent',
      joinDate: '2026-10-31'
    },
    'Test HR Admin'
  )

  assert.ok(newEmp.id.startsWith('EMP-'))
  assert.equal(newEmp.subDepartmentId, 'SUBDEP-01')
  assert.equal(newEmp.subDepartmentName, 'Web Applications & UI')
  assert.equal(newEmp.departmentId, 'DEP-01')
  assert.equal(newEmp.teamId, 'TEAM-01')

  // Edit employee: transfer to SUBDEP-02 with matching TEAM-02
  const updated = employeeService.updateEmployee(
    newEmp.id,
    {
      subDepartmentId: 'SUBDEP-02',
      teamId: 'TEAM-02'
    },
    'Test HR Admin',
    'Organizational Realignment',
    '2026-10-31'
  )

  assert.equal(updated.subDepartmentId, 'SUBDEP-02')
  assert.equal(updated.subDepartmentName, 'Backend & Platform Services')
  assert.equal(updated.teamId, 'TEAM-02')

  // Incompatible transfer: Team from another department fails validation
  assert.throws(
    () => {
      employeeService.updateEmployee(
        newEmp.id,
        {
          teamId: 'TEAM-04' // Sales team in DEP-02
        },
        'Test HR Admin'
      )
    },
    /belongs to department/i,
    'Incompatible team transfer must be rejected'
  )

  // Verify Career History recorded SUB_DEPARTMENT_TRANSFER
  const history = employeeService.getCareerHistory(newEmp.id)
  const subDeptTransfer = history.find((h) => h.changeType === 'SUB_DEPARTMENT_TRANSFER')
  assert.ok(subDeptTransfer, 'SUB_DEPARTMENT_TRANSFER must be recorded in career history')
  assert.equal(subDeptTransfer.previousValue, 'Web Applications & UI')
  assert.equal(subDeptTransfer.newValue, 'Backend & Platform Services')
})
