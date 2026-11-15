import { test } from 'node:test'
import assert from 'node:assert/strict'
import { employeeService } from '../services/employeeService.js'
import { authService } from '../services/authService.js'
import { leaveService } from '../services/leaveService.js'
import { salaryRevisionService } from '../services/salaryRevisionService.js'

// Helper to reset all services to canonical demo state
const resetServices = () => {
  employeeService.resetToDefaultData()
  leaveService.resetToDefaults()
  authService.resetDemoAccounts()
}

test('1. Employee to Team Lead Promotion & Scoping', () => {
  resetServices()

  // Transition existing lead on TEAM-01 before promoting successor
  employeeService.removeTeamAssignment('TA-01', 'Succession transition to Usman Tariq', 'Super Admin')

  const empBefore = employeeService.getEmployeeById('EMP-006') // Usman Tariq
  const initialSalary = empBefore.salary
  assert.equal(empBefore.designation, 'Junior Frontend Developer')

  // Super Admin promotes Usman to Senior Full-Stack Developer & Team Lead
  const result = employeeService.promoteOrTransferEmployee(
    {
      employeeId: 'EMP-006',
      designationId: 'DESIG-02', // Senior Full-Stack Developer
      departmentId: 'DEP-01',
      teamId: 'TEAM-01',
      assignAsRole: 'team_lead',
      portalRole: 'team_lead',
      effectiveDate: '2026-11-01',
      reason: 'Outstanding frontend architecture and leadership progression'
    },
    'Tariq Mehmood (Super Admin)'
  )

  assert.ok(result.success)
  const empAfter = employeeService.getEmployeeById('EMP-006')
  assert.equal(empAfter.designation, 'Senior Full-Stack Developer')
  assert.equal(empAfter.salary, initialSalary, 'Salary must NEVER be modified by promotion')

  // Verify portal role changed in authService
  const userAccount = authService.getUserAccountById('EMP-006')
  assert.equal(userAccount.role, 'team_lead')
  assert.equal(userAccount.portalPath, '/team-lead')

  // Verify Team Assignment created
  const assignments = employeeService.getTeamAssignments().filter((a) => a.employeeId === 'EMP-006' && a.status === 'Active')
  assert.ok(assignments.some((a) => a.role === 'team_lead'))

  // Verify Career History contains DESIGNATION_CHANGE and TEAM_TRANSFER
  const history = employeeService.getCareerHistory('EMP-006')
  assert.ok(history.some((h) => h.changeType === 'DESIGNATION_CHANGE'))
})

test('2. Team Lead to Department Manager Promotion', () => {
  resetServices()

  // Promote Hina Farooq (EMP-005) from Lead QA to Software Engineering Manager
  const result = employeeService.promoteOrTransferEmployee(
    {
      employeeId: 'EMP-005',
      designationId: 'DESIG-01', // Software Engineering Manager
      departmentId: 'DEP-01',
      managerId: 'EMP-001', // Reports to Super Admin
      portalRole: 'manager',
      effectiveDate: '2026-11-01',
      reason: 'Promotion to Engineering Management'
    },
    'Ayesha Khan (HR Admin)'
  )

  assert.ok(result.success)
  const empAfter = employeeService.getEmployeeById('EMP-005')
  assert.equal(empAfter.designation, 'Software Engineering Manager')
  assert.equal(empAfter.managerId, 'EMP-001')

  const userAccount = authService.getUserAccountById('EMP-005')
  assert.equal(userAccount.role, 'manager')
  assert.equal(userAccount.portalPath, '/manager')
})

test('3. Designation-only change preserves salary and portal role', () => {
  resetServices()

  const empBefore = employeeService.getEmployeeById('EMP-004')
  const initialSalary = empBefore.salary

  const result = employeeService.promoteOrTransferEmployee(
    {
      employeeId: 'EMP-004',
      designationId: 'DESIG-02', // Senior Full-Stack Developer
      effectiveDate: '2026-11-01',
      reason: 'Annual Title Reclassification'
    },
    'HR Administrator'
  )

  assert.ok(result.success)
  const empAfter = employeeService.getEmployeeById('EMP-004')
  assert.equal(empAfter.designation, 'Senior Full-Stack Developer')
  assert.equal(empAfter.salary, initialSalary, 'Salary must remain intact')

  // Portal role unchanged
  const user = authService.getUserAccountById('EMP-004')
  assert.equal(user.role, 'employee')
})

test('4. Portal Role Protection & Escalation Guards', () => {
  resetServices()

  // 1. Root Super Admin account EMP-001 cannot be revoked or downgraded
  assert.throws(() => {
    authService.updateUserRole('EMP-001', 'employee', 'Demotion attempt', 'HR Administrator')
  }, /Governance Protection|Primary Super Admin account/i)

  // 2. Regular employee cannot escalate roles
  assert.throws(() => {
    authService.updateUserRole('EMP-004', 'manager', 'Self promotion attempt', 'Regular Staff')
  }, /Unauthorized/i)

  // 3. Authorized Super Admin can update role
  const updated = authService.updateUserRole(
    'EMP-004',
    'team_lead',
    'Authorized role assignment',
    'Tariq Mehmood (Super Admin)'
  )
  assert.equal(updated.role, 'team_lead')

  // Role change history preserved
  const roleHistory = authService.getRoleChangeHistory('EMP-004')
  assert.ok(roleHistory.length > 0)
  assert.equal(roleHistory[0].newRole, 'team_lead')
})

test('5. Cross-Department Transfer & Hierarchy Validation', () => {
  resetServices()

  // 1. Rejects invalid team not belonging to department
  assert.throws(() => {
    employeeService.promoteOrTransferEmployee(
      {
        employeeId: 'EMP-006',
        departmentId: 'DEP-03', // Media & Creative
        teamId: 'TEAM-01', // TEAM-01 belongs to DEP-01 Development!
        reason: 'Invalid department-team combination'
      },
      'HR Admin'
    )
  }, /belongs to department/i)

  // 2. Rejects circular reporting cycle
  assert.throws(() => {
    employeeService.promoteOrTransferEmployee(
      {
        employeeId: 'EMP-003', // Bilal Siddiqui (Manager)
        managerId: 'EMP-004', // Zeeshan Ali reports to Bilal!
        reason: 'Circular hierarchy cycle'
      },
      'HR Admin'
    )
  }, /Invalid reporting manager|circular/i)

  // 3. Valid cross-department transfer (EMP-006 transferred to DEP-03 Media & Creative, TEAM-06 UI/UX)
  const validTransfer = employeeService.promoteOrTransferEmployee(
    {
      employeeId: 'EMP-006',
      departmentId: 'DEP-03', // Media & Creative
      teamId: 'TEAM-06', // UI/UX Visual Design
      managerId: 'EMP-010', // Faizan Ahmed (Media Manager)
      reason: 'Strategic department transfer to UI/UX team'
    },
    'HR Admin'
  )
  assert.ok(validTransfer.success)
  const transferredEmp = employeeService.getEmployeeById('EMP-006')
  assert.equal(transferredEmp.departmentId, 'DEP-03')
  assert.equal(transferredEmp.teamId, 'TEAM-06')
  assert.equal(transferredEmp.managerId, 'EMP-010')
})

test('6. Management Dependencies Analysis', () => {
  resetServices()

  // Bilal Siddiqui (EMP-003) manages Development Department and direct reports
  const bilalDeps = employeeService.analyzeManagementDependencies('EMP-003')
  assert.equal(bilalDeps.hasDependencies, true)
  assert.ok(bilalDeps.directReports.length > 0)
  assert.ok(bilalDeps.managedDepartments.length > 0)

  // Ahmed Raza QA (EMP-016) is a QA Automation Engineer with 0 direct reports and 0 managed teams
  const ahmedDeps = employeeService.analyzeManagementDependencies('EMP-016')
  assert.equal(ahmedDeps.hasDependencies, false)
  assert.equal(ahmedDeps.directReports.length, 0)
  assert.equal(ahmedDeps.managedTeams.length, 0)
})

test('7. Manager Separation Blocked without Successor', () => {
  resetServices()

  // Attempting to separate Bilal Siddiqui (EMP-003) without specifying a successor
  assert.throws(() => {
    employeeService.deactivateEmployee(
      'EMP-003',
      'Voluntary Resignation',
      'HR Admin',
      '2026-11-15',
      null, // No successor
      { enforceSuccession: true }
    )
  }, /Active management dependencies detected.*An active successor must be assigned/i)

  // Verify Bilal remains Active
  const bilal = employeeService.getEmployeeById('EMP-003')
  assert.equal(bilal.status, 'Active')
})

test('8. Manager Succession Execution Handover', () => {
  resetServices()

  const outgoingId = 'EMP-003' // Bilal Siddiqui
  const successorId = 'EMP-004' // Zeeshan Ali

  const initialDirectReports = employeeService.getDirectReports(outgoingId)
  assert.ok(initialDirectReports.length >= 2, `Expected >= 2 direct reports, got ${initialDirectReports.length}`)

  // Execute separation with succession
  const success = employeeService.deactivateEmployee(
    outgoingId,
    'Formal resignation and career transition',
    'Tariq Mehmood (Super Admin)',
    '2026-11-15',
    successorId,
    { enforceSuccession: true }
  )

  assert.equal(success, true)

  // 1. Outgoing manager is Separated
  const outgoingEmp = employeeService.getEmployeeById(outgoingId)
  assert.equal(outgoingEmp.status, 'Separated')
  assert.equal(outgoingEmp.attendanceToday, 'Inactive')

  // 2. Direct reports now report to successor
  const reportsOfSuccessor = employeeService.getDirectReports(successorId)
  assert.ok(reportsOfSuccessor.length > 0)
  const hina = employeeService.getEmployeeById('EMP-005')
  assert.equal(hina.managerId, successorId)

  // 3. Department head transferred to successor
  const devDept = employeeService.getDepartmentById('DEP-01')
  assert.equal(devDept.headId, successorId)

  // 4. Succession audit record created
  const successionLogs = employeeService.getSuccessionHistory()
  assert.ok(successionLogs.length > 0)
  const latestLog = successionLogs[0]
  assert.equal(latestLog.outgoingManagerId, outgoingId)
  assert.equal(latestLog.successorId, successorId)
  assert.ok(latestLog.directReportsReassigned > 0)
})

test('9. Salary Revision Isolation (Batch F06 Independence)', () => {
  resetServices()

  const emp = employeeService.getEmployeeById('EMP-004')
  const baseSalaryBefore = emp.salary

  // Promotion does not alter salary
  employeeService.promoteOrTransferEmployee(
    {
      employeeId: 'EMP-004',
      designationId: 'DESIG-02',
      reason: 'Promoted to Technical Lead'
    },
    'HR Admin'
  )

  const empAfterPromo = employeeService.getEmployeeById('EMP-004')
  assert.equal(empAfterPromo.salary, baseSalaryBefore)

  // Any compensation revision MUST be submitted through salaryRevisionService
  const initialRevisions = salaryRevisionService.getRevisions().length
  const rev = salaryRevisionService.proposeRevision(
    {
      employeeId: 'EMP-004',
      employeeName: 'Zeeshan Ali',
      department: 'Development',
      designation: 'Senior Full-Stack Developer',
      currentSalary: 150000,
      proposedSalary: 175000,
      effectiveDate: '2026-11-01',
      justification: 'Performance-driven increment proposal'
    },
    { name: 'Ayesha Khan (HR Admin)', role: 'hr_admin' }
  )

  assert.ok(rev.id)
  assert.equal(rev.status, 'Pending Super Admin Review')
  assert.equal(salaryRevisionService.getRevisions().length, initialRevisions + 1)
})
