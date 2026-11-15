/**
 * iSysware HRMS — Portal Identity, Role Access & Employee Linking Verification Suite
 * Verifies:
 * 1. All 5 Portal Roles (SUPER_ADMIN, HR_ADMIN, DEPT_MANAGER, TEAM_LEAD, EMPLOYEE).
 * 2. Separation of Portal Accounts from Employee Records (standalone accounts support).
 * 3. First-class displayName field persistence and fallback hierarchy.
 * 4. Protected Super Admin safeguards & editable displayName/unlinking.
 * 5. Preservation of EMP-001 (Khuzaima Senior Developer) records and structures.
 * 6. EMPLOYEE role employeeId validation.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/config/database.js'
import adminSettingsService from '../src/services/adminSettingsService.js'
import authService from '../src/services/authService.js'

test.describe('Portal Identity, Role Access & Employee Linking Suite', () => {
  let superAdminUser = null
  let emp001Record = null
  let testStandaloneHr = null
  let testStandaloneDept = null
  let testStandaloneLead = null
  let testEmployeeUser = null

  test.before(async () => {
    // 1. Fetch Super Admin account
    superAdminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', isProtected: true }
    })
    assert.ok(superAdminUser, 'Protected Super Admin account must exist')

    // 2. Fetch EMP-001 employee
    emp001Record = await prisma.employee.findFirst({
      where: { employeeCode: 'EMP-001' }
    })
    assert.ok(emp001Record, 'EMP-001 employee record must exist in PostgreSQL')
    assert.equal(emp001Record.employmentStatus, 'ACTIVE', 'EMP-001 must be ACTIVE')
  })

  test.after(async () => {
    // Clean up any test users created during test runs
    const testUsernames = [
      'qa.standalone.hr',
      'qa.standalone.dept',
      'qa.standalone.lead',
      'qa.linked.emp'
    ]
    await prisma.user.deleteMany({
      where: { username: { in: testUsernames } }
    })
    await prisma.employee.deleteMany({
      where: { employeeCode: 'QA-EMP-005' }
    })
    await prisma.$disconnect()
  })

  test('1. Confirm all 5 Portal Roles exist and are valid in PostgreSQL enum', async () => {
    const enumRes = await prisma.$queryRawUnsafe(`
      SELECT enum_range(NULL::"PortalRole") as roles;
    `)
    const roles = enumRes[0]?.roles || []
    assert.ok(roles.includes('SUPER_ADMIN'), 'Must include SUPER_ADMIN')
    assert.ok(roles.includes('HR_ADMIN'), 'Must include HR_ADMIN')
    assert.ok(roles.includes('DEPT_MANAGER'), 'Must include DEPT_MANAGER')
    assert.ok(roles.includes('TEAM_LEAD'), 'Must include TEAM_LEAD')
    assert.ok(roles.includes('EMPLOYEE'), 'Must include EMPLOYEE')
    assert.equal(roles.length, 5, 'Must contain exactly 5 portal roles')
  })

  test('2. Super Admin account has persistent displayName and preserves EMP-001 employee record intact', async () => {
    const admin = await prisma.user.findUnique({
      where: { id: superAdminUser.id },
      include: { employee: true }
    })

    assert.equal(admin.role, 'SUPER_ADMIN')
    assert.equal(admin.isProtected, true)
    assert.ok(admin.displayName, 'Super Admin must have a displayName')

    // Ensure EMP-001 employee record itself is intact
    const emp001 = await prisma.employee.findFirst({
      where: { employeeCode: 'EMP-001' }
    })
    assert.ok(emp001, 'EMP-001 must exist')
    assert.equal(emp001.firstName, 'Khuzaima')
    assert.equal(emp001.lastName, 'Senior Developer')
    assert.equal(emp001.employeeCode, 'EMP-001')
    assert.equal(emp001.employmentStatus, 'ACTIVE')
  })

  test('3. Super Admin displayName is editable and persists in PostgreSQL', async () => {
    const originalDisplayName = superAdminUser.displayName || 'Super Admin'
    const newTestName = 'Super Admin (System Core)'

    const updated = await adminSettingsService.updateUser(
      superAdminUser.id,
      { displayName: newTestName },
      { id: superAdminUser.id, role: 'SUPER_ADMIN' }
    )

    assert.equal(updated.displayName, newTestName)

    const fromDb = await prisma.user.findUnique({ where: { id: superAdminUser.id } })
    assert.equal(fromDb.displayName, newTestName)

    // Revert back to original clean name
    const reverted = await adminSettingsService.updateUser(
      superAdminUser.id,
      { displayName: originalDisplayName },
      { id: superAdminUser.id, role: 'SUPER_ADMIN' }
    )
    assert.equal(reverted.displayName, originalDisplayName)
  })

  test('4. Protected Super Admin safeguards: cannot be demoted, deactivated, or deleted', async () => {
    // A. Cannot change role
    await assert.rejects(
      async () => {
        await adminSettingsService.updateUser(
          superAdminUser.id,
          { role: 'HR_ADMIN' },
          { id: superAdminUser.id, role: 'SUPER_ADMIN' }
        )
      },
      (err) => err.code === 'PROTECTED_ADMIN_IMMUTABLE'
    )

    // B. Cannot deactivate
    await assert.rejects(
      async () => {
        await adminSettingsService.updateUser(
          superAdminUser.id,
          { isActive: false },
          { id: superAdminUser.id, role: 'SUPER_ADMIN' }
        )
      },
      (err) => err.code === 'PROTECTED_ADMIN_IMMUTABLE'
    )

    // C. Cannot delete
    await assert.rejects(
      async () => {
        await adminSettingsService.deleteUser(
          superAdminUser.id,
          { id: 'another_user', role: 'SUPER_ADMIN' }
        )
      },
      (err) => err.code === 'PROTECTED_ADMIN_IMMUTABLE'
    )
  })

  test('5. Can create standalone HR_ADMIN, DEPT_MANAGER, and TEAM_LEAD accounts without employee links', async () => {
    // A. Standalone HR_ADMIN
    testStandaloneHr = await adminSettingsService.createUser(
      {
        displayName: 'HR Operations Lead',
        username: 'qa.standalone.hr',
        email: 'qa.standalone.hr@isysware.com',
        password: 'Password123!',
        role: 'HR_ADMIN',
        employeeId: null
      },
      { id: superAdminUser.id, role: 'SUPER_ADMIN' }
    )
    assert.equal(testStandaloneHr.displayName, 'HR Operations Lead')
    assert.equal(testStandaloneHr.employeeId, null)
    assert.equal(testStandaloneHr.role, 'HR_ADMIN')

    // B. Standalone DEPT_MANAGER
    testStandaloneDept = await adminSettingsService.createUser(
      {
        displayName: 'Engineering Dept Manager',
        username: 'qa.standalone.dept',
        email: 'qa.standalone.dept@isysware.com',
        password: 'Password123!',
        role: 'DEPT_MANAGER',
        employeeId: null
      },
      { id: superAdminUser.id, role: 'SUPER_ADMIN' }
    )
    assert.equal(testStandaloneDept.displayName, 'Engineering Dept Manager')
    assert.equal(testStandaloneDept.employeeId, null)
    assert.equal(testStandaloneDept.role, 'DEPT_MANAGER')

    // C. Standalone TEAM_LEAD
    testStandaloneLead = await adminSettingsService.createUser(
      {
        displayName: 'Core Team Lead',
        username: 'qa.standalone.lead',
        email: 'qa.standalone.lead@isysware.com',
        password: 'Password123!',
        role: 'TEAM_LEAD',
        employeeId: null
      },
      { id: superAdminUser.id, role: 'SUPER_ADMIN' }
    )
    assert.equal(testStandaloneLead.displayName, 'Core Team Lead')
    assert.equal(testStandaloneLead.employeeId, null)
    assert.equal(testStandaloneLead.role, 'TEAM_LEAD')
  })

  test('6. EMPLOYEE role strictly requires an active linked employee record', async () => {
    // Missing employeeId must fail
    await assert.rejects(
      async () => {
        await adminSettingsService.createUser(
          {
            displayName: 'Standalone Employee Should Fail',
            username: 'qa.invalid.emp',
            email: 'qa.invalid.emp@isysware.com',
            password: 'Password123!',
            role: 'EMPLOYEE',
            employeeId: null
          },
          { id: superAdminUser.id, role: 'SUPER_ADMIN' }
        )
      },
      (err) => err.code === 'EMPLOYEE_LINK_REQUIRED'
    )

    // Valid employeeId must succeed: find or create an active test employee
    let targetEmp = await prisma.employee.findFirst({
      where: { employmentStatus: 'ACTIVE', userAccount: null }
    })
    if (!targetEmp) {
      targetEmp = await prisma.employee.create({
        data: {
          employeeCode: 'QA-EMP-005',
          firstName: 'QA',
          lastName: 'Tester',
          email: 'qa.tester@example.com',
          employmentStatus: 'ACTIVE',
          joiningDate: new Date()
        }
      })
    }

    testEmployeeUser = await adminSettingsService.createUser(
      {
        displayName: 'QA Employee Self-Service',
        username: 'qa.linked.emp',
        email: 'qa.linked.emp@isysware.com',
        password: 'Password123!',
        role: 'EMPLOYEE',
        employeeId: targetEmp.id
      },
      { id: superAdminUser.id, role: 'SUPER_ADMIN' }
    )

    assert.equal(testEmployeeUser.role, 'EMPLOYEE')
    assert.equal(testEmployeeUser.employeeId, targetEmp.id)
    assert.equal(testEmployeeUser.displayName, 'QA Employee Self-Service')
  })

  test('7. getUsers returns displayName and all 5 roles correctly', async () => {
    const allUsers = await adminSettingsService.getUsers()
    assert.ok(Array.isArray(allUsers))
    assert.ok(allUsers.length >= 4)

    const foundAdmin = allUsers.find((u) => u.id === superAdminUser.id)
    assert.ok(foundAdmin)
    assert.ok(foundAdmin.displayName)

    const foundHr = allUsers.find((u) => u.username === 'qa.standalone.hr')
    assert.ok(foundHr)
    assert.equal(foundHr.displayName, 'HR Operations Lead')
    assert.equal(foundHr.employeeId, null)
  })

  test('8. authService.getMe returns sanitized user with displayName and proper profile', async () => {
    const me = await authService.getMe(superAdminUser.id)
    assert.ok(me)
    assert.equal(me.username, superAdminUser.username)
    assert.ok(me.displayName)
    assert.equal(me.passwordHash, undefined, 'passwordHash must never be exposed')
  })

  test('9. EMP-001 (Khuzaima Senior Developer) remains fully active and unaltered in PostgreSQL', async () => {
    const emp = await prisma.employee.findFirst({
      where: { employeeCode: 'EMP-001' },
      include: { salaryStructures: true, allowanceAllocations: true }
    })
    assert.ok(emp, 'EMP-001 must be preserved in PostgreSQL')
    assert.equal(emp.firstName, 'Khuzaima')
    assert.equal(emp.lastName, 'Senior Developer')
    assert.equal(emp.employmentStatus, 'ACTIVE')
    assert.ok(emp.salaryStructures.length > 0, 'EMP-001 salary structures must remain intact')
  })

  test('10. Super Admin account supports unlinking and re-linking employeeId without corrupting employee record', async () => {
    const originalEmpId = superAdminUser.employeeId

    // Unlink
    const unlinked = await adminSettingsService.updateUser(
      superAdminUser.id,
      { employeeId: null },
      { id: superAdminUser.id, role: 'SUPER_ADMIN' }
    )
    assert.equal(unlinked.employeeId, null)

    const fromDbUnlinked = await prisma.user.findUnique({ where: { id: superAdminUser.id } })
    assert.equal(fromDbUnlinked.employeeId, null)

    // Verify EMP-001 is completely untouched
    const empStillActive = await prisma.employee.findFirst({
      where: { employeeCode: 'EMP-001' }
    })
    assert.ok(empStillActive)
    assert.equal(empStillActive.employmentStatus, 'ACTIVE')

    // If original Super Admin had an employee link, restore it cleanly
    if (originalEmpId) {
      const relinked = await adminSettingsService.updateUser(
        superAdminUser.id,
        { employeeId: originalEmpId },
        { id: superAdminUser.id, role: 'SUPER_ADMIN' }
      )
      assert.equal(relinked.employeeId, originalEmpId)
    }
  })
})
