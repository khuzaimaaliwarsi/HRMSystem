import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { permissionService } from '../services/permissionService.js'
import { authService } from '../services/authService.js'
import { employeeService } from '../services/employeeService.js'
import { DEMO_USERS } from '../mocks/demoUsers.js'

describe('Five-Portal RBAC Matrix & Team Lead Identity Mapping Suite', () => {
  beforeEach(() => {
    permissionService.resetAllData()
  })

  it('1. Roles & Permissions service registers all 5 role definitions with accurate scopes', () => {
    const roles = permissionService.getAllRolePermissions()
    const roleKeys = Object.keys(roles)

    assert.ok(roleKeys.includes('super_admin'), 'Super Admin role must exist')
    assert.ok(roleKeys.includes('hr_admin'), 'HR / Admin role must exist')
    assert.ok(roleKeys.includes('manager'), 'Department Manager role must exist')
    assert.ok(roleKeys.includes('team_lead'), 'Team Lead role must exist')
    assert.ok(roleKeys.includes('employee'), 'Employee role must exist')

    // Verify scopes
    assert.strictEqual(roles.super_admin.defaultScope, 'company_wide')
    assert.strictEqual(roles.hr_admin.defaultScope, 'company_wide')
    assert.strictEqual(roles.manager.defaultScope, 'department_teams')
    assert.strictEqual(roles.team_lead.defaultScope, 'assigned_team')
    assert.strictEqual(roles.employee.defaultScope, 'own')

    // Verify getRoles() helper
    const roleList = permissionService.getRoles()
    assert.strictEqual(roleList.length, 5)
    const tlEntry = roleList.find((r) => r.key === 'team_lead')
    assert.ok(tlEntry, 'Team Lead metadata must be present in getRoles()')
    assert.strictEqual(tlEntry.label, 'Team Lead')
    assert.strictEqual(tlEntry.scope, 'Assigned Teams')
  })

  it('2. Data access scoping isolates Team Lead to assigned team and Manager to authorized department teams', () => {
    const teamLeadUser = {
      id: 'EMP-005',
      employeeId: 'EMP-005',
      role: 'team_lead',
      name: 'Hina Farooq',
      teamId: 'TEAM-03',
      departmentId: 'DEP-01'
    }

    const deptManagerUser = {
      id: 'EMP-003',
      employeeId: 'EMP-003',
      role: 'manager',
      name: 'Bilal Siddiqui',
      departmentId: 'DEP-01'
    }

    // Team Lead accessing self
    assert.strictEqual(
      permissionService.canAccessData(teamLeadUser, 'EMP-005'),
      true,
      'Team Lead can access own data'
    )

    // Team Lead cannot access employee from another department (e.g. EMP-007 Kamran Raza in Sales)
    assert.strictEqual(
      permissionService.canAccessData(teamLeadUser, 'EMP-007', 'DEP-02'),
      false,
      'Team Lead cannot access cross-department employees outside assigned scope'
    )

    // Department Manager can access direct reports and employees in authorized department teams
    assert.strictEqual(
      permissionService.canAccessData(deptManagerUser, 'EMP-004', 'DEP-01'),
      true,
      'Department Manager can access employee in authorized department teams'
    )

    // Department Manager cannot access employees in another department (e.g. Sales)
    assert.strictEqual(
      permissionService.canAccessData(deptManagerUser, 'EMP-007', 'DEP-02'),
      false,
      'Department Manager cannot access employees in unauthorized departments'
    )

    // Employee can strictly only access self
    const employeeUser = { id: 'EMP-004', employeeId: 'EMP-004', role: 'employee' }
    assert.strictEqual(permissionService.canAccessData(employeeUser, 'EMP-004'), true)
    assert.strictEqual(permissionService.canAccessData(employeeUser, 'EMP-005'), false)
  })

  it('3. Authenticated Team Lead (EMP-005 Hina Farooq) resolves authentic identity and self-service records', () => {
    const demoHina = DEMO_USERS.find((u) => u.id === 'EMP-005')
    assert.ok(demoHina, 'Demo user EMP-005 must exist')
    assert.strictEqual(demoHina.employeeId, 'EMP-005')
    assert.strictEqual(demoHina.name, 'Hina Farooq')
    assert.strictEqual(demoHina.role, 'team_lead')

    // Profile lookup
    const empRecord = employeeService.getEmployeeById(demoHina.employeeId)
    assert.ok(empRecord, 'Employee record for EMP-005 must exist')
    assert.strictEqual(empRecord.name, 'Hina Farooq')
    assert.strictEqual(empRecord.designation, 'Lead QA Automation Engineer')

    // Bank Details isolation: Hina Farooq gets her own bank record, not Zeeshan Ali's
    const bankDetails = employeeService.getBankDetails(demoHina.employeeId, 'team_lead', demoHina.employeeId)
    assert.ok(bankDetails, 'Bank details must resolve for EMP-005')
    assert.strictEqual(bankDetails.employeeId, 'EMP-005')
    assert.strictEqual(bankDetails.accountTitle, 'Hina Farooq')
    assert.strictEqual(bankDetails.bankName, 'Bank Alfalah')

    // Career History isolation
    const careerHistory = employeeService.getCareerHistory(demoHina.employeeId)
    assert.ok(Array.isArray(careerHistory))
    assert.ok(careerHistory.length > 0)
    assert.strictEqual(careerHistory[0].employeeId, 'EMP-005')

    // Reporting Chain resolution
    const reportingChain = employeeService.getReportingChain(demoHina.employeeId)
    assert.ok(Array.isArray(reportingChain) && reportingChain.length >= 2)
    assert.strictEqual(reportingChain[0].id, 'EMP-005')
    assert.strictEqual(reportingChain[1].id, 'EMP-003')
    assert.strictEqual(reportingChain[1].name, 'Bilal Siddiqui')

    // Reporting Hierarchy resolution
    const reportingHierarchy = employeeService.getReportingHierarchy(demoHina.employeeId)
    const mgrLevel = reportingHierarchy.find((h) => h.role === 'manager')
    assert.ok(mgrLevel, 'Hina Farooq must report to Department Manager Bilal Siddiqui')
    assert.strictEqual(mgrLevel.employee.id, 'EMP-003')
  })

  it('4. Super Admin safeguards prevent tampering with Super Admin root permissions', () => {
    const superAdminActor = { id: 'EMP-001', role: 'super_admin', name: 'Alexander Wright' }
    const hrActor = { id: 'EMP-002', role: 'hr_admin', name: 'Ayesha Khan' }

    // HR Admin cannot modify role permissions
    assert.throws(
      () => {
        permissionService.updateRolePermissions('team_lead', 'attendance', ['view'], hrActor)
      },
      /Unauthorized: Only Super Admin has authority to modify role permissions/,
      'Non-Super-Admin cannot alter role permissions'
    )

    // Cannot strip manage_config from Super Admin
    assert.throws(
      () => {
        permissionService.updateRolePermissions('super_admin', 'settings', ['view'], superAdminActor)
      },
      /Safeguard Violation: Super Admin root administrative permissions cannot be stripped/,
      'Super Admin root permissions cannot be revoked'
    )

    // Super Admin CAN update team_lead permissions and audit is generated
    const updated = permissionService.updateRolePermissions(
      'team_lead',
      'tasks',
      ['view', 'create', 'edit', 'submit', 'approve'],
      superAdminActor,
      'Calibrating Team Lead delegation authority'
    )
    assert.ok(updated.modules.tasks.includes('approve'))
  })

  it('5. Login and role switching persistently preserves employeeId for all 5 roles', async () => {
    // Test login for all 5 roles
    const rolesToTest = [
      { role: 'super_admin', expectedId: 'EMP-001' },
      { role: 'hr_admin', expectedId: 'EMP-002' },
      { role: 'manager', expectedId: 'EMP-003' },
      { role: 'team_lead', expectedId: 'EMP-005' },
      { role: 'employee', expectedId: 'EMP-004' }
    ]

    for (const testCase of rolesToTest) {
      const user = authService.switchDemoRole(testCase.role)
      assert.ok(user, `Switching to ${testCase.role} should succeed`)
      assert.strictEqual(user.employeeId, testCase.expectedId, `employeeId must be ${testCase.expectedId}`)
      assert.strictEqual(user.id, testCase.expectedId, `id must be ${testCase.expectedId}`)
    }
  })
})
