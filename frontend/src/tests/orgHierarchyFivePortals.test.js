import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { employeeService } from '../services/employeeService.js'
import { dashboardService } from '../services/dashboardService.js'
import { attendanceService } from '../services/attendanceService.js'
import { leaveService } from '../services/leaveService.js'
import { permissionService } from '../services/permissionService.js'
import { PORTAL_CONFIG } from '../config/navigation.js'

describe('Five Role-Based Portals & Organizational Hierarchy Foundation Suite', () => {
  beforeEach(() => {
    employeeService.resetToDefaultData()
    permissionService.resetAllData()
  })

  test('1. Organization Master Teams: Supports Team Lead assignment', () => {
    const teams = employeeService.getTeams()
    assert.ok(teams.length >= 10, 'Must have at least 10 seeded teams')

    // Verify initial team lead assignments
    const feTeam = teams.find((t) => t.id === 'TEAM-01')
    assert.ok(feTeam, 'TEAM-01 (Frontend) must exist')
    assert.equal(feTeam.managerId, 'EMP-003', 'Department Manager must be Bilal Siddiqui (EMP-003)')
    assert.equal(feTeam.teamLeadId, 'EMP-004', 'Team Lead must be Zeeshan Ali (EMP-004)')
    assert.equal(feTeam.teamLeadName, 'Zeeshan Ali')

    const qaTeam = teams.find((t) => t.id === 'TEAM-03')
    assert.ok(qaTeam, 'TEAM-03 (QA) must exist')
    assert.equal(qaTeam.managerId, 'EMP-003')
    assert.equal(qaTeam.teamLeadId, 'EMP-005', 'Team Lead must be Hina Farooq (EMP-005)')
    assert.equal(qaTeam.teamLeadName, 'Hina Farooq')

    // Create a new team with Team Lead assignment
    const newTeamId = employeeService.saveTeam({
      code: 'DEV-AI',
      name: 'AI & Data Engineering',
      departmentId: 'DEP-01',
      managerId: 'EMP-003',
      teamLeadId: 'EMP-004',
      description: 'Applied machine learning and analytical pipelines'
    })

    const createdTeam = employeeService.getTeamById(newTeamId)
    assert.ok(createdTeam)
    assert.equal(createdTeam.teamLeadId, 'EMP-004')
    assert.equal(createdTeam.teamLeadName, 'Zeeshan Ali')

    // Update team lead
    employeeService.saveTeam({
      id: newTeamId,
      code: 'DEV-AI',
      name: 'AI & Data Engineering',
      departmentId: 'DEP-01',
      managerId: 'EMP-003',
      teamLeadId: 'EMP-005',
      description: 'Applied machine learning and analytical pipelines'
    })

    const updatedTeam = employeeService.getTeamById(newTeamId)
    assert.equal(updatedTeam.teamLeadId, 'EMP-005')
    assert.equal(updatedTeam.teamLeadName, 'Hina Farooq')
  })

  test('2. Company → Department Manager → Teams → Team Leads → Employees reporting hierarchy', () => {
    // 1. Employee reports to Team Lead
    // Set EMP-006 (Usman Tariq) to report to Team Lead EMP-004 (Zeeshan Ali)
    employeeService.updateEmployee('EMP-006', {
      managerId: 'EMP-004',
      managerName: 'Zeeshan Ali'
    })

    const emp006 = employeeService.getEmployeeById('EMP-006')
    assert.equal(emp006.managerId, 'EMP-004', 'EMP-006 must report to Team Lead EMP-004')

    // 2. Team Lead reports to Department Manager
    const emp004 = employeeService.getEmployeeById('EMP-004')
    assert.equal(emp004.managerId, 'EMP-003', 'Team Lead EMP-004 must report to Department Manager EMP-003')

    // 3. Department Manager reports to Company Head
    const emp003 = employeeService.getEmployeeById('EMP-003')
    assert.equal(emp003.managerId, 'EMP-001', 'Department Manager EMP-003 must report to Managing Director EMP-001')

    // 4. Verify complete reporting chain from Employee up to Company Head
    const chain = employeeService.getReportingChain('EMP-006')
    assert.equal(chain.length, 4, 'Full reporting chain must have 4 tiers')
    assert.equal(chain[0].id, 'EMP-006', 'Tier 1: Employee')
    assert.equal(chain[1].id, 'EMP-004', 'Tier 2: Team Lead')
    assert.equal(chain[2].id, 'EMP-003', 'Tier 3: Department Manager')
    assert.equal(chain[3].id, 'EMP-001', 'Tier 4: Company Head')
  })

  test('3. Scoped Access: Department Manager sees all authorized teams; Team Lead sees assigned teams only', () => {
    // EMP-003 (Bilal Siddiqui) is Department Manager of DEP-01 (Development)
    const managerTeams = employeeService.getScopedTeams('EMP-003', 'manager')
    const managerTeamIds = managerTeams.map((t) => t.id)
    assert.ok(managerTeamIds.includes('TEAM-01'), 'Manager must see TEAM-01 (Frontend)')
    assert.ok(managerTeamIds.includes('TEAM-02'), 'Manager must see TEAM-02 (Backend)')
    assert.ok(managerTeamIds.includes('TEAM-03'), 'Manager must see TEAM-03 (QA)')

    const managerStaff = employeeService.getAuthorizedTeamEmployees('EMP-003', 'manager')
    const managerStaffIds = managerStaff.map((s) => s.id)
    assert.ok(managerStaffIds.includes('EMP-004'), 'Manager must see Team Lead EMP-004')
    assert.ok(managerStaffIds.includes('EMP-005'), 'Manager must see Team Lead EMP-005')
    assert.ok(managerStaffIds.includes('EMP-006'), 'Manager must see Employee EMP-006')

    // EMP-005 (Hina Farooq) is Team Lead for TEAM-03 (Quality Assurance & Testing) only
    const leadTeams = employeeService.getScopedTeams('EMP-005', 'team_lead')
    assert.equal(leadTeams.length, 1, 'Team Lead EMP-005 should only have 1 assigned team')
    assert.equal(leadTeams[0].id, 'TEAM-03', 'Assigned team must be TEAM-03 (QA)')

    const leadStaff = employeeService.getAuthorizedTeamEmployees('EMP-005', 'team_lead')
    const leadStaffIds = leadStaff.map((s) => s.id)
    // EMP-005 only oversees QA, not Frontend (EMP-006) or Backend (EMP-004)
    assert.ok(!leadStaffIds.includes('EMP-004'), 'Team Lead EMP-005 must NOT see Frontend/Backend staff EMP-004')
    assert.ok(!leadStaffIds.includes('EMP-006'), 'Team Lead EMP-005 must NOT see Frontend/Backend staff EMP-006')
  })

  test('4. Department & Team Consistency Validation: Rejects mismatched department/team assignments', () => {
    // Valid assignment: TEAM-01 belongs to DEP-01 (Development)
    const validCheck = employeeService.validateDepartmentTeamConsistency('DEP-01', 'TEAM-01')
    assert.equal(validCheck.valid, true, 'Matching department and team must be valid')

    // Invalid assignment: TEAM-04 belongs to DEP-02 (Sales), not DEP-01 (Development)
    const invalidCheck = employeeService.validateDepartmentTeamConsistency('DEP-01', 'TEAM-04')
    assert.equal(invalidCheck.valid, false, 'Mismatched department and team must be rejected')
    assert.ok(invalidCheck.error.includes('Department and Team consistency check failed'))

    // Rejection on createEmployee
    assert.throws(
      () => {
        employeeService.createEmployee({
          name: 'Invalid Org Staff',
          email: 'invalid.org@isysware.com',
          departmentId: 'DEP-01', // Development
          teamId: 'TEAM-04' // Sales & Business Team!
        })
      },
      /Department and Team consistency check failed/
    )

    // Rejection on updateEmployee
    assert.throws(
      () => {
        employeeService.updateEmployee('EMP-004', {
          departmentId: 'DEP-01', // Development
          teamId: 'TEAM-04' // Sales Team!
        })
      },
      /Department and Team consistency check failed/
    )
  })

  test('5. Cycle Prevention & Anti-Self-Approval: Rejects self-management and circular loops', () => {
    // Self-reporting prevention
    assert.throws(
      () => {
        employeeService.updateEmployee('EMP-003', { managerId: 'EMP-003' })
      },
      /An employee cannot be their own reporting manager/
    )

    // Circular loop prevention: EMP-003 manages EMP-004. Making EMP-003 report to EMP-004 must be blocked!
    assert.throws(
      () => {
        employeeService.updateEmployee('EMP-003', { managerId: 'EMP-004' })
      },
      /Circular reporting relationship detected/
    )
  })

  test('6. Dashboard Scoping: Department Manager vs Team Lead', () => {
    // Department Manager Dashboard (EMP-003)
    const mgrDashboard = dashboardService.getManagerData('EMP-003')
    assert.equal(mgrDashboard.teamMembers.length, 3, 'Department Manager oversees all 3 Development staff')
    const mgrIds = mgrDashboard.teamMembers.map((m) => m.id)
    assert.deepEqual(mgrIds.sort(), ['EMP-004', 'EMP-005', 'EMP-006'].sort())

    // Team Lead Dashboard (EMP-005 QA Lead)
    const tlDashboard = dashboardService.getTeamLeadData('EMP-005')
    assert.ok(tlDashboard.kpis, 'Team Lead dashboard must have KPIs')
    // Assigned team only (no leaking of other development teams)
    assert.ok(!tlDashboard.teamMembers.some((m) => m.id === 'EMP-004'))
    assert.ok(!tlDashboard.teamMembers.some((m) => m.id === 'EMP-006'))
  })

  test('7. Five Role-Based Portals: Complete Registry & Scoped Boundaries', () => {
    const portalKeys = Object.keys(PORTAL_CONFIG)
    assert.equal(portalKeys.length, 5, 'Exact 5 portals must exist')
    assert.deepEqual(
      portalKeys.sort(),
      ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'].sort()
    )

    // Team Lead portal configuration verification
    const tl = PORTAL_CONFIG.team_lead
    assert.equal(tl.portalName, 'Team Lead Portal')
    assert.equal(tl.defaultRoute, '/team-lead/dashboard')

    const modules = tl.menuGroups.flatMap((g) => g.items).map((i) => i.key)
    const expectedModules = ['dashboard', 'team', 'attendance', 'leaves', 'tasks', 'performance', 'reports']
    expectedModules.forEach((mod) => {
      assert.ok(modules.includes(mod), `Team Lead portal must include module: ${mod}`)
    })

    // Dynamic RBAC permissions for team_lead
    const tlPerms = permissionService.getPermissionsForRole('team_lead')
    assert.ok(tlPerms, 'Permissions for team_lead role must exist')
    assert.equal(tlPerms.defaultScope, 'assigned_team')
    assert.ok(tlPerms.modules.tasks.includes('create'))
    assert.ok(tlPerms.modules.leaves.includes('approve'))
  })
})
