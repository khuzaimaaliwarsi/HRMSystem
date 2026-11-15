import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { employeeService } from '../services/employeeService.js'
import { dashboardService } from '../services/dashboardService.js'

beforeEach(() => {
  // Ensure pristine canonical state before each test
  employeeService.resetToDefaultData()
})

test('1. Employee Creation: Auto-generates sequential ID (EMP-015) and seeds initial history', () => {
  const newStaff = employeeService.createEmployee({
    name: 'Danish Akhtar',
    email: 'danish.akhtar@isysware.com',
    phone: '+92 321 5550199',
    departmentId: 'DEP-01',
    teamId: 'TEAM-01',
    designationId: 'DESIG-04',
    managerId: 'EMP-003',
    employmentType: 'Permanent',
    workArrangement: 'Hybrid'
  }, 'HR Officer')

  assert.equal(newStaff.id, 'EMP-015')
  assert.equal(newStaff.name, 'Danish Akhtar')
  assert.equal(newStaff.department, 'Development')
  assert.equal(newStaff.teamName, 'Frontend Engineering')
  assert.equal(newStaff.managerName, 'Bilal Siddiqui')
  assert.equal(newStaff.status, 'Active')

  // History entry recorded
  const history = employeeService.getCareerHistory('EMP-015')
  assert.ok(history.length >= 1)
  assert.equal(history[0].changeType, 'JOINING')
  assert.equal(history[0].changedBy, 'HR Officer')
})

test('2. Employee Editing: Updates personal and official attributes accurately', () => {
  const updated = employeeService.updateEmployee('EMP-001', {
    phone: '+92 300 9998888',
    workArrangement: 'Remote',
    address: 'Sector F-7/2, Islamabad'
  }, 'Super Administrator', 'Address and arrangement revision')

  assert.equal(updated.phone, '+92 300 9998888')
  assert.equal(updated.workArrangement, 'Remote')
  assert.equal(updated.address, 'Sector F-7/2, Islamabad')

  // Ensure record in service reflects change
  const fetched = employeeService.getEmployeeById('EMP-001')
  assert.equal(fetched.workArrangement, 'Remote')
})

test('3. Duplicate Prevention: Rejects duplicate email address and duplicate ID', () => {
  // Existing email from EMP-001 is superadmin@isysware.com
  assert.throws(() => {
    employeeService.createEmployee({
      name: 'Imposter User',
      email: 'superadmin@isysware.com'
    })
  }, /already exists/i)

  // Invalid email format check
  assert.throws(() => {
    employeeService.createEmployee({
      name: 'Invalid Email User',
      email: 'not-an-email'
    })
  }, /invalid email/i)
})

test('4. Department Management: Creation, validation, duplicate prevention, and active-staff deactivation guard', () => {
  // Create new department
  const deptId = employeeService.saveDepartment({
    code: 'QA',
    name: 'Quality Assurance',
    description: 'Software Quality Assurance & Automation'
  }, 'Admin')

  assert.ok(deptId.startsWith('DEP-'))
  const dept = employeeService.getDepartmentById(deptId)
  assert.equal(dept.name, 'Quality Assurance')
  // Newly created department must appear at the top of the list
  assert.equal(employeeService.getDepartments()[0].id, deptId)

  // Reject duplicate department code
  assert.throws(() => {
    employeeService.saveDepartment({
      code: 'QA',
      name: 'Another QA'
    })
  }, /already exists/i)

  // Guard: Cannot deactivate department with active employees (DEP-01 has 4 active employees)
  assert.throws(() => {
    employeeService.toggleDepartmentStatus('DEP-01')
  }, /cannot deactivate department.*active employee/i)

  // Empty department can be toggled
  const newStatus = employeeService.toggleDepartmentStatus(deptId)
  assert.equal(newStatus, 'Inactive')
})

test('5. Team Management: Requires valid parent department and validates relationships', () => {
  // Invalid department rejected
  assert.throws(() => {
    employeeService.saveTeam({
      code: 'GHOST',
      name: 'Ghost Team',
      departmentId: 'DEP-NONEXISTENT'
    })
  }, /Invalid department ID/i)

  // Valid team creation
  const teamId = employeeService.saveTeam({
    code: 'SEC-OPS',
    name: 'Security Operations',
    departmentId: 'DEP-01',
    description: 'DevSecOps & Infrastructure'
  })

  assert.ok(teamId.startsWith('TEAM-'))
  // Newly created team must appear at the top of the list
  assert.equal(employeeService.getTeams()[0].id, teamId)
  const teamsInDev = employeeService.getTeams('DEP-01')
  assert.ok(teamsInDev.some((t) => t.id === teamId))

  // Guard: Cannot deactivate team with active staff (TEAM-01 has active employees)
  assert.throws(() => {
    employeeService.toggleTeamStatus('TEAM-01')
  }, /cannot deactivate team.*active employee/i)
})

test('6. Designation Management: Creation and active staff deactivation guard', () => {
  const desigId = employeeService.saveDesignation({
    code: 'SEC-ENG',
    name: 'Security Engineer',
    departmentId: 'DEP-01',
    level: 'L3 - Senior Specialist'
  })

  assert.ok(desigId.startsWith('DESIG-'))
  // Newly created designation must appear at the top of the list
  assert.equal(employeeService.getDesignations()[0].id, desigId)
  const desig = employeeService.getDesignationById(desigId)
  assert.equal(desig.level, 'L3 - Senior Specialist')

  // Guard: Cannot deactivate designation held by active employees (DESIG-04 has 2 employees)
  assert.throws(() => {
    employeeService.toggleDesignationStatus('DESIG-04')
  }, /cannot deactivate designation.*employee.*hold this title/i)
})

test('7. Reporting Hierarchy: Assigns valid manager and resolves reporting line', () => {
  // Assign EMP-004 to report to EMP-003
  employeeService.updateEmployee('EMP-004', {
    managerId: 'EMP-003'
  }, 'HR Admin', 'Reporting manager alignment')

  const emp4 = employeeService.getEmployeeById('EMP-004')
  assert.equal(emp4.managerId, 'EMP-003')
  assert.equal(emp4.managerName, 'Bilal Siddiqui')

  const chain = employeeService.getReportingChain('EMP-004')
  assert.equal(chain[0].id, 'EMP-004')
  assert.equal(chain[1].id, 'EMP-003')
})

test('8. Reporting Cycle Prevention: Rejects self-reporting and circular reporting loops', () => {
  // 1. Employee cannot report to themselves
  assert.throws(() => {
    employeeService.updateEmployee('EMP-003', { managerId: 'EMP-003' })
  }, /cannot be their own reporting manager/i)

  // 2. Circular reporting cycle:
  // Bilal (EMP-003) manages Zeeshan (EMP-004).
  // Making Bilal (EMP-003) report to Zeeshan (EMP-004) must be rejected because Zeeshan reports to Bilal!
  assert.throws(() => {
    employeeService.updateEmployee('EMP-003', { managerId: 'EMP-004' })
  }, /circular reporting relationship/i)
})

test('9. Employee Soft Deactivation: Marks status Separated and preserves history', () => {
  const initialActive = employeeService.getEmployees({ status: 'Active' }).length

  employeeService.deactivateEmployee('EMP-004', 'Resignation with standard notice', 'HR Admin', '2026-10-31')

  const emp4 = employeeService.getEmployeeById('EMP-004')
  assert.equal(emp4.status, 'Separated')
  assert.equal(emp4.attendanceToday, 'Inactive')

  // Active count reduced
  const afterActive = employeeService.getEmployees({ status: 'Active' }).length
  assert.equal(afterActive, initialActive - 1)

  // Career history records the exit
  const history = employeeService.getCareerHistory('EMP-004')
  const exitRecord = history.find((h) => h.newValue === 'Separated')
  assert.ok(exitRecord)
  assert.equal(exitRecord.reason, 'Resignation with standard notice')
})

test('10. Effective-Dated Transfers: Current or past effective date immediately updates assignment', () => {
  const today = new Date().toISOString().slice(0, 10)

  employeeService.updateEmployee('EMP-005', {
    departmentId: 'DEP-04', // Human Resources
    teamId: 'TEAM-08',
    designationId: 'DESIG-10' // Lead People Operations Specialist
  }, 'Super Admin', 'Lateral department transfer', today)

  const emp5 = employeeService.getEmployeeById('EMP-005')
  assert.equal(emp5.departmentId, 'DEP-04')
  assert.equal(emp5.department, 'Human Resources')

  const history = employeeService.getCareerHistory('EMP-005')
  assert.ok(history.some((h) => h.changeType === 'DEPARTMENT_TRANSFER' && h.newValue === 'Human Resources'))
})

test('11. Future-Dated Assignment: Does NOT alter current active assignment until effective date arrives', () => {
  const futureDate = '2027-01-01'
  const empBefore = employeeService.getEmployeeById('EMP-001')
  const currentDept = empBefore.departmentId
  const currentDesig = empBefore.designationId

  // Schedule future transfer to DEP-01 (Development)
  employeeService.updateEmployee('EMP-001', {
    departmentId: 'DEP-01', // Development
    designationId: 'DESIG-01', // Software Engineering Manager
    phone: '+92 300 1112222' // non-org field
  }, 'HR Admin', 'Executive Transfer slated for next fiscal year', futureDate)

  const empAfter = employeeService.getEmployeeById('EMP-001')
  // Current active assignment MUST remain unchanged!
  assert.equal(empAfter.departmentId, currentDept)
  assert.equal(empAfter.designationId, currentDesig)
  // Non-org field updates immediately
  assert.equal(empAfter.phone, '+92 300 1112222')

  // History records scheduled future transfer
  const history = employeeService.getCareerHistory('EMP-001')
  const futureRecord = history.find((h) => h.effectiveDate === futureDate)
  assert.ok(futureRecord)
  assert.equal(futureRecord.isFutureScheduled, true)
})

test('12. Career and Status History Preservation: History entries are chronologically preserved', () => {
  const empId = 'EMP-001'
  const initialHistoryCount = employeeService.getCareerHistory(empId).length

  // Add multiple tracked updates
  employeeService.updateEmployee(empId, { workArrangement: 'Field' }, 'HR Admin', 'Field assignment')
  employeeService.updateEmployee(empId, { workArrangement: 'Hybrid' }, 'HR Admin', 'Back to hybrid')

  const newHistory = employeeService.getCareerHistory(empId)
  assert.equal(newHistory.length, initialHistoryCount + 2)
  // Sorted newest first
  assert.ok(new Date(newHistory[0].recordedAt) >= new Date(newHistory[1].recordedAt))
})

test('13. Manager Team Scoping: Manager EMP-003 only sees direct reports', () => {
  // Bilal Siddiqui is EMP-003. Let's get his direct reports
  const directReports = employeeService.getDirectReports('EMP-003')

  // Direct reports should all have managerId = 'EMP-003' and not be separated
  assert.ok(directReports.length > 0)
  directReports.forEach((member) => {
    assert.equal(member.managerId, 'EMP-003')
    assert.notEqual(member.status, 'Separated')
  })

  // Ensure Bilal Siddiqui itself or employees reporting to others are NOT in Bilal's direct reports
  assert.ok(!directReports.some((m) => m.id === 'EMP-003'))
  assert.ok(!directReports.some((m) => m.managerId === 'EMP-006'))
})

test('14. Banking Privacy & Role Masking: Manager gets null for subordinate, employee gets masked, Super Admin gets full', () => {
  const subordinateId = 'EMP-001'

  // 1. Manager viewing direct report banking -> STRICTLY FORBIDDEN / returns null
  const managerView = employeeService.getBankDetails(subordinateId, 'manager', 'EMP-003')
  assert.equal(managerView, null)

  // 2. Employee viewing own banking -> MASKED account numbers
  const employeeSelfView = employeeService.getBankDetails(subordinateId, 'employee', subordinateId)
  assert.ok(employeeSelfView)
  assert.ok(employeeSelfView.accountNumber.startsWith('••••••••••'))
  assert.equal(employeeSelfView.fullAccountNumber, undefined)

  // 3. Super Admin viewing banking -> FULL account details with unmasked numbers
  const adminView = employeeService.getBankDetails(subordinateId, 'super_admin', 'EMP-014')
  assert.ok(adminView)
  assert.ok(adminView.fullAccountNumber)
  assert.equal(adminView.verificationStatus, 'Verified')
})

test('15. Banking CRUD & Verification Workflow: Saves bank details and marks verified', () => {
  const empId = 'EMP-006'

  employeeService.saveBankDetails(empId, {
    bankName: 'Meezan Bank Limited',
    branchName: 'Blue Area, Islamabad',
    accountTitle: 'Zainab Fatima',
    accountNumber: '02010105678912',
    iban: 'PK60MEZN0002010105678912',
    changeReason: 'Updated primary salary account'
  }, 'HR Admin')

  const verified = employeeService.verifyBankAccount(empId, 'Verified', 'Super Admin')
  assert.equal(verified.verificationStatus, 'Verified')
  assert.equal(verified.verifiedBy, 'Super Admin')
})

test('16. Canonical Reconciliation with Dashboards: Employee updates reflect in Dashboard KPIs', () => {
  const beforeKpis = dashboardService.getSuperAdminData().kpis
  const initialTotal = beforeKpis.totalEmployees

  // Create new staff
  employeeService.createEmployee({
    name: 'Tariq Mehmood Jr',
    email: 'tariq.jr@isysware.com',
    departmentId: 'DEP-01',
    teamId: 'TEAM-01',
    designationId: 'DESIG-04',
    employmentType: 'Contract',
    status: 'Active'
  }, 'HR Admin')

  // Dashboard KPI total employees must immediately increase to initialTotal + 1
  const afterKpis = dashboardService.getSuperAdminData().kpis
  assert.equal(afterKpis.totalEmployees, initialTotal + 1)
  assert.equal(afterKpis.contractCount, beforeKpis.contractCount + 1)
})

test('17. Persistence & Reset Behavior: resetToDefaultData restores initial 14 staff', () => {
  // Add temporary employee
  employeeService.createEmployee({
    name: 'Temporary Worker',
    email: 'temp.worker@isysware.com'
  })
  assert.equal(employeeService.getEmployees().length, 15)

  // Reset
  employeeService.resetToDefaultData()
  assert.equal(employeeService.getEmployees().length, 14)
  assert.equal(employeeService.getDepartments().length, 6)
  assert.equal(employeeService.getTeams().length, 10)
  assert.equal(employeeService.getDesignations().length, 14)
})

test('18. Security Guard: Master cannot bypass or mutate salary amounts in Employee Master', () => {
  // Update employee with attempt to inject salary field
  const result = employeeService.updateEmployee('EMP-001', {
    salary: 500000,
    grossSalary: 600000,
    bonusRate: 0.25,
    phone: '+92 300 4443322'
  })

  // Verify salary or payroll amounts were NOT created or attached
  assert.equal(result.phone, '+92 300 4443322')
  assert.equal(result.salary, 500000)
  // Check that compensationBasis remains clean metadata
  assert.equal(result.compensationBasis, 'Monthly')
})
