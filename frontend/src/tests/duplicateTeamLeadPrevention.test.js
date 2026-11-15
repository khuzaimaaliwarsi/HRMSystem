import { test } from 'node:test'
import assert from 'node:assert/strict'
import { employeeService } from '../services/employeeService.js'
import { authService } from '../services/authService.js'
import { leaveService } from '../services/leaveService.js'
import { dashboardService } from '../services/dashboardService.js'

// Helper to reset test environment
const resetState = () => {
  employeeService.resetToDefaultData()
  leaveService.resetToDefaults()
  authService.resetDemoAccounts()
}

test('Bug 07: 1. Multiple active Team Leads per team are permitted for shared leadership/coverage', () => {
  resetState()

  // TEAM-01 (Frontend Engineering) already has active lead EMP-004 (Ali Raza / Zeeshan Ali)
  const existingLead = employeeService.getTeamAssignments().find(
    (a) => a.teamId === 'TEAM-01' && a.role === 'team_lead' && a.status === 'Active'
  )
  assert.ok(existingLead, 'TEAM-01 must have an existing active lead')
  assert.equal(existingLead.employeeId, 'EMP-004')

  // Super Admin promotes/assigns Bilal Ahmed (EMP-006) as co-Team Lead on TEAM-01
  const bilalAssignmentId = employeeService.assignTeamLeadOrManager(
    {
      teamId: 'TEAM-01',
      employeeId: 'EMP-006',
      role: 'team_lead',
      effectiveDate: '2026-11-01',
      notes: 'Co-Team Lead assignment for Frontend Team'
    },
    'Tariq Mehmood (Super Admin)'
  )
  assert.ok(bilalAssignmentId, 'Assignment must succeed without throwing single-lead block')

  // Both Ali Raza and Bilal Ahmed must have active assignments
  const activeLeads = employeeService.getTeamAssignments().filter(
    (a) => a.teamId === 'TEAM-01' && a.role === 'team_lead' && a.status === 'Active'
  )
  assert.equal(activeLeads.length, 2, 'Both Team Leads must remain active')
  assert.ok(activeLeads.some((a) => a.employeeId === 'EMP-004'))
  assert.ok(activeLeads.some((a) => a.employeeId === 'EMP-006'))
})

test('Bug 07: 2. Team Lead Direct Reports derived strictly from canonical managerId relationship', () => {
  resetState()

  // Setup reproduction hierarchy:
  // Hamza (EMP-003, Dept Manager)
  // Ali Raza (EMP-004, Frontend Team Lead, managerId: EMP-003)
  // Ahmed Khan (EMP-005, Frontend Developer, managerId: EMP-004)
  // Bilal Ahmed (EMP-006, Frontend Team Lead, managerId: EMP-004)
  const employees = employeeService.getEmployees()
  const ahmed = employees.find((e) => e.id === 'EMP-005')
  const bilal = employees.find((e) => e.id === 'EMP-006')
  const ali = employees.find((e) => e.id === 'EMP-004')

  if (ahmed) {
    ahmed.teamId = 'TEAM-01'
    ahmed.managerId = 'EMP-004'
  }
  if (bilal) {
    bilal.teamId = 'TEAM-01'
    bilal.managerId = 'EMP-004'
  }
  if (ali) {
    ali.teamId = 'TEAM-01'
    ali.managerId = 'EMP-003'
  }
  employeeService._setItem('isysware_hrms_f02_employees_v1', employees)

  // Ensure both Ali and Bilal have active lead assignments on TEAM-01
  employeeService.assignTeamLeadOrManager(
    { teamId: 'TEAM-01', employeeId: 'EMP-006', role: 'team_lead', effectiveDate: '2026-11-01' },
    'Super Admin'
  )

  // 1. Bilal Ahmed (EMP-006) scope check:
  // Bilal has ZERO direct reports because no employee reports to EMP-006
  const bilalReports = employeeService.getTeamLeadScope('EMP-006')
  assert.equal(bilalReports.length, 0, 'Bilal must have exactly 0 direct reports')
  assert.equal(bilalReports.some((m) => m.id === 'EMP-005'), false, 'Ahmed Khan must NOT leak into Bilal scope')
  assert.equal(bilalReports.some((m) => m.id === 'EMP-004'), false, 'Ali Raza must NOT leak into Bilal scope')

  // 2. Ali Raza (EMP-004) scope check:
  // Ali Raza has Ahmed Khan (EMP-005) and Bilal Ahmed (EMP-006) reporting directly to him
  const aliReports = employeeService.getTeamLeadScope('EMP-004')
  assert.ok(aliReports.some((m) => m.id === 'EMP-005'), 'Ahmed Khan must report to Ali Raza')
  assert.ok(aliReports.some((m) => m.id === 'EMP-006'), 'Bilal Ahmed must report to Ali Raza')
  assert.equal(aliReports.some((m) => m.id === 'EMP-003'), false, 'Manager Hamza must never appear as subordinate')
})

test('Bug 07: 3. Bilal Dashboard and Roster KPIs reflect zero direct reports and empty roster', () => {
  resetState()

  // Query dashboard data for Bilal Ahmed (EMP-006) as Team Lead
  const bilalDashboard = dashboardService.getTeamLeadData('EMP-006')
  assert.equal(bilalDashboard.kpis.teamMembers, 0, 'Dashboard Direct Reports KPI must be 0')
  assert.equal(bilalDashboard.kpis.presentToday, 0, 'Dashboard Team Present KPI must be 0')
  assert.equal(bilalDashboard.teamMembers.length, 0, 'My Team Roster must be empty')
})

test('Bug 07: 4. Anti-unauthorized approval: Bilal cannot approve or modify Ahmed records', () => {
  resetState()

  // Configure Ahmed (EMP-005) reporting to Ali (EMP-004)
  const employees = employeeService.getEmployees()
  const ahmed = employees.find((e) => e.id === 'EMP-005')
  if (ahmed) {
    ahmed.teamId = 'TEAM-01'
    ahmed.managerId = 'EMP-004'
    employeeService._setItem('isysware_hrms_f02_employees_v1', employees)
  }

  // Bilal (EMP-006) attempting to approve Ahmed's leave must be blocked
  assert.throws(
    () => {
      employeeService.validateApprovalAuthorization('EMP-005', 'EMP-006', 'team_lead')
    },
    /Unauthorized: Team Leads can only review requests for employees/i,
    'Bilal must NOT have approval authority over Ahmed'
  )

  // Ali Raza (EMP-004) CAN approve Ahmed's leave
  const aliAuth = employeeService.validateApprovalAuthorization('EMP-005', 'EMP-004', 'team_lead')
  assert.ok(aliAuth.valid, 'Authoritative direct reporting manager Ali Raza CAN approve Ahmed')
})

test('Bug 07: 5. Hamza Manager Portal: Direct Reports = 1 (Ali Raza) and Total Department Staff = 3', () => {
  resetState()

  // Hierarchy:
  // Hamza Ahmed (EMP-003) — Department Manager
  // Ali Raza (EMP-004) — reports to Hamza (EMP-003)
  // Ahmed Khan (EMP-005) — reports to Ali (EMP-004)
  // Bilal Ahmed (EMP-006) — reports to Ali (EMP-004)
  const employees = employeeService.getEmployees()
  const hamza = employees.find((e) => e.id === 'EMP-003')
  const ali = employees.find((e) => e.id === 'EMP-004')
  const ahmed = employees.find((e) => e.id === 'EMP-005')
  const bilal = employees.find((e) => e.id === 'EMP-006')

  if (hamza) hamza.departmentId = 'DEP-01'
  if (ali) {
    ali.departmentId = 'DEP-01'
    ali.teamId = 'TEAM-01'
    ali.managerId = 'EMP-003'
  }
  if (ahmed) {
    ahmed.departmentId = 'DEP-01'
    ahmed.teamId = 'TEAM-01'
    ahmed.managerId = 'EMP-004'
  }
  if (bilal) {
    bilal.departmentId = 'DEP-01'
    bilal.teamId = 'TEAM-01'
    bilal.managerId = 'EMP-004'
  }
  employeeService._setItem('isysware_hrms_f02_employees_v1', employees)

  // 1. Direct Reports of Hamza (EMP-003) must be exactly 1 (Ali Raza)
  const directReports = employeeService.getDirectReports('EMP-003')
  assert.equal(directReports.length, 1, 'Hamza must have exactly 1 direct report')
  assert.equal(directReports[0].id, 'EMP-004', 'Hamza direct report must be Ali Raza')

  // 2. Department Manager Scope (Hamza can view and manage all 3 staff members)
  const deptStaff = employeeService.getDepartmentManagerScope('EMP-003')
  const deptStaffIds = deptStaff.map((e) => e.id)
  assert.ok(deptStaffIds.includes('EMP-004'), 'Must manage Ali Raza')
  assert.ok(deptStaffIds.includes('EMP-005'), 'Must manage Ahmed Khan')
  assert.ok(deptStaffIds.includes('EMP-006'), 'Must manage Bilal Ahmed')
  assert.equal(deptStaffIds.length, 3, 'Total Department Staff must be 3')

  // 3. Manager Dashboard KPIs
  const managerData = dashboardService.getManagerData('EMP-003')
  assert.equal(managerData.kpis.directReportsCount, 1, 'Direct Reports KPI must be 1')
  assert.equal(managerData.kpis.totalDepartmentStaff, 3, 'Total Department Staff KPI must be 3')
  assert.equal(managerData.teamMembers.length, 3, 'Manager team roster contains all 3 staff members')
})

test('Bug 07: 6. Idempotent re-saving of existing leadership assignment succeeds without duplicate', () => {
  resetState()

  // First save of EMP-004 on TEAM-01
  const id1 = employeeService.assignTeamLeadOrManager(
    { teamId: 'TEAM-01', employeeId: 'EMP-004', role: 'team_lead', effectiveDate: '2026-11-01' },
    'Super Admin'
  )

  // Idempotent re-save of exact same assignment
  const id2 = employeeService.assignTeamLeadOrManager(
    { teamId: 'TEAM-01', employeeId: 'EMP-004', role: 'team_lead', effectiveDate: '2026-11-01' },
    'Super Admin'
  )

  assert.equal(id1, id2, 'Re-saving same assignment must return existing id without creating duplicates')
})
