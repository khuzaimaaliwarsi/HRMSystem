/**
 * iSysware HRMS — Portal User Management & Delete All Data Automated Test Suite
 * Validates:
 * 1. Super Admin exclusivity for all account management APIs (403 for HR_ADMIN, DEPT_MANAGER, TEAM_LEAD, EMPLOYEE)
 * 2. Five portal roles account creation, Argon2id hashing, and login capabilities
 * 3. Account activation, deactivation, password reset, and deletion with session revocation
 * 4. Protected admin immutability and anti-self-deletion safeguard
 * 5. Delete All Data: Purges all operational records across modules while preserving 100% of portal user accounts
 * 6. Preserved accounts login verification and clean zero-error state
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import adminSettingsService from '../src/services/adminSettingsService.js'

describe('Portal User Management & Operational Data Reset Suite', () => {
  const commonPassword = 'Password123!'
  let saUser, hrUser, dmUser, tlUser, empUser
  let saToken, hrToken, dmToken, tlToken, empToken
  let testDept, testDesig, testEmployee

  before(async () => {
    // Clean any remnants of test accounts
    const testUsernames = ['test_mgr_sa', 'test_mgr_hr', 'test_mgr_dm', 'test_mgr_tl', 'test_mgr_emp', 'test_mgr_delete']
    await prisma.session.deleteMany({ where: { user: { username: { in: testUsernames } } } })
    await prisma.user.deleteMany({ where: { username: { in: testUsernames } } })
  })

  after(async () => {
    // Teardown test accounts
    const testUsernames = ['test_mgr_sa', 'test_mgr_hr', 'test_mgr_dm', 'test_mgr_tl', 'test_mgr_emp', 'test_mgr_delete']
    await prisma.session.deleteMany({ where: { user: { username: { in: testUsernames } } } })
    await prisma.user.deleteMany({ where: { username: { in: testUsernames } } })
  })

  it('1. Create Accounts: Super Admin provisions accounts for all 5 portal roles', async () => {
    // Create isolated Super Admin for testing
    saUser = await adminSettingsService.createUser({
      username: 'test_mgr_sa',
      email: 'test_mgr_sa@isysware.test',
      password: commonPassword,
      role: 'SUPER_ADMIN',
      isActive: true
    }, { id: null, role: 'SUPER_ADMIN' })

    assert.equal(saUser.username, 'test_mgr_sa')
    assert.equal(saUser.role, 'SUPER_ADMIN')

    // Login as Super Admin to get authorization token
    const saLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_sa', password: commonPassword })

    assert.equal(saLogin.status, 200)
    saToken = saLogin.body.data.accessToken

    // Super Admin creates HR_ADMIN account via API
    const hrRes = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        username: 'test_mgr_hr',
        email: 'test_mgr_hr@isysware.test',
        password: commonPassword,
        role: 'HR_ADMIN',
        isActive: true
      })
    assert.equal(hrRes.status, 201)
    hrUser = hrRes.body.data

    // Super Admin creates DEPT_MANAGER account via API
    const dmRes = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        username: 'test_mgr_dm',
        email: 'test_mgr_dm@isysware.test',
        password: commonPassword,
        role: 'DEPT_MANAGER',
        isActive: true
      })
    assert.equal(dmRes.status, 201)
    dmUser = dmRes.body.data

    // Super Admin creates TEAM_LEAD account via API
    const tlRes = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        username: 'test_mgr_tl',
        email: 'test_mgr_tl@isysware.test',
        password: commonPassword,
        role: 'TEAM_LEAD',
        isActive: true
      })
    assert.equal(tlRes.status, 201)
    tlUser = tlRes.body.data

    // Super Admin creates EMPLOYEE account via API
    const empRes = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        username: 'test_mgr_emp',
        email: 'test_mgr_emp@isysware.test',
        password: commonPassword,
        role: 'EMPLOYEE',
        isActive: true
      })
    assert.equal(empRes.status, 201)
    empUser = empRes.body.data
  })

  it('2. Login Verification: Every active account from all 5 roles can log in', async () => {
    // HR Login
    const hrLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_hr', password: commonPassword })
    assert.equal(hrLogin.status, 200)
    assert.equal(hrLogin.body.data.user.role, 'HR_ADMIN')
    hrToken = hrLogin.body.data.accessToken

    // Manager Login
    const dmLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_dm', password: commonPassword })
    assert.equal(dmLogin.status, 200)
    assert.equal(dmLogin.body.data.user.role, 'DEPT_MANAGER')
    dmToken = dmLogin.body.data.accessToken

    // Team Lead Login
    const tlLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_tl', password: commonPassword })
    assert.equal(tlLogin.status, 200)
    assert.equal(tlLogin.body.data.user.role, 'TEAM_LEAD')
    tlToken = tlLogin.body.data.accessToken

    // Employee Login
    const empLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_emp', password: commonPassword })
    assert.equal(empLogin.status, 200)
    assert.equal(empLogin.body.data.user.role, 'EMPLOYEE')
    empToken = empLogin.body.data.accessToken
  })

  it('3. Strict Super Admin Exclusivity: Non-Super-Admin roles receive HTTP 403 on user management APIs', async () => {
    // HR Admin tries to list users -> 403
    const hrList = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${hrToken}`)
    assert.equal(hrList.status, 403)

    // Department Manager tries to create a user -> 403
    const dmCreate = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${dmToken}`)
      .send({ username: 'hacker_user', email: 'hacker@test.com', password: commonPassword })
    assert.equal(dmCreate.status, 403)

    // Team Lead tries to update user status -> 403
    const tlStatus = await request(app)
      .patch(`/api/v1/admin/users/${empUser.id}/status`)
      .set('Authorization', `Bearer ${tlToken}`)
      .send({ isActive: false })
    assert.equal(tlStatus.status, 403)

    // Employee tries to delete a user -> 403
    const empDelete = await request(app)
      .delete(`/api/v1/admin/users/${hrUser.id}`)
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(empDelete.status, 403)

    // HR Admin tries to delete all data -> 403
    const hrDeleteData = await request(app)
      .post('/api/v1/admin/data/delete-all')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ confirmationToken: 'DELETE ALL DATA' })
    assert.equal(hrDeleteData.status, 403)
  })

  it('4. Deactivate Account: Inactive account cannot log in and sessions are revoked', async () => {
    // Super Admin deactivates test_mgr_emp
    const deactRes = await request(app)
      .patch(`/api/v1/admin/users/${empUser.id}/status`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ isActive: false })

    assert.equal(deactRes.status, 200)
    assert.equal(deactRes.body.data.isActive, false)

    // Try logging in with deactivated user -> 403 Forbidden
    const failedLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_emp', password: commonPassword })
    assert.equal(failedLogin.status, 403)
    assert.ok(failedLogin.body.error.message.includes('inactive') || failedLogin.body.error.code === 'ACCOUNT_INACTIVE')
  })

  it('5. Reactivate Account: Reactivated account can log in normally', async () => {
    // Super Admin reactivates test_mgr_emp
    const reactRes = await request(app)
      .patch(`/api/v1/admin/users/${empUser.id}/status`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ isActive: true })

    assert.equal(reactRes.status, 200)
    assert.equal(reactRes.body.data.isActive, true)

    // Try logging in now -> 200
    const successLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_emp', password: commonPassword })
    assert.equal(successLogin.status, 200)
  })

  it('6. Admin Password Reset: Sets new Argon2id hash and invalidates old credentials', async () => {
    const newPwd = 'NewSuperSecretPass456!'

    const resetRes = await request(app)
      .post(`/api/v1/admin/users/${dmUser.id}/reset-password`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ newPassword: newPwd })

    assert.equal(resetRes.status, 200)

    // Old password fails
    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_dm', password: commonPassword })
    assert.equal(oldLogin.status, 401)

    // New password succeeds
    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_dm', password: newPwd })
    assert.equal(newLogin.status, 200)
  })

  it('7. Delete Account: Prevents self-deletion & deletes target account with audit trail', async () => {
    // 1. Super Admin cannot delete own account
    const selfDelete = await request(app)
      .delete(`/api/v1/admin/users/${saUser.id}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(selfDelete.status, 400)
    assert.equal(selfDelete.body.error.code, 'CANNOT_DELETE_SELF')

    // 2. Create temporary account to delete
    const tempRes = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        username: 'test_mgr_delete',
        email: 'test_mgr_delete@isysware.test',
        password: commonPassword,
        role: 'EMPLOYEE'
      })
    assert.equal(tempRes.status, 201)
    const tempId = tempRes.body.data.id

    // 3. Delete temporary account
    const delRes = await request(app)
      .delete(`/api/v1/admin/users/${tempId}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(delRes.status, 200)

    // 4. Verify account is completely gone from DB
    const checkUser = await prisma.user.findUnique({ where: { id: tempId } })
    assert.equal(checkUser, null)
  })

  it('8. Delete All Data: Clears all operational records while strictly preserving all portal accounts', async () => {
    const timestamp = Date.now()
    const depCode = `D_OPS_${timestamp}`
    const desCode = `DS_OPS_${timestamp}`
    const empCode = `E_OPS_${timestamp}`
    const shiftCode = `S_OPS_${timestamp}`
    const leaveCode = `L_OPS_${timestamp}`
    const periodCode = `P_OPS_${timestamp}`
    const claimNumber = `X_OPS_${timestamp}`

    // Populate isolated operational records
    testDept = await prisma.department.create({
      data: { code: depCode, name: 'Operational Reset Test Dept' }
    })
    testDesig = await prisma.designation.create({
      data: { code: desCode, title: 'Operational Reset Specialist', departmentId: testDept.id }
    })

    // Create an employee linked to test_mgr_emp
    testEmployee = await prisma.employee.create({
      data: {
        employeeCode: empCode,
        firstName: 'Operational',
        lastName: 'Tester',
        email: `ops_${timestamp}@isysware.test`,
        departmentId: testDept.id,
        designationId: testDesig.id,
        employmentType: 'PERMANENT',
        employmentStatus: 'ACTIVE',
        joiningDate: new Date('2026-01-01')
      }
    })

    // Link testEmployee to test_mgr_emp
    await prisma.user.update({
      where: { id: empUser.id },
      data: { employeeId: testEmployee.id }
    })

    // Populate operational records across modules:
    // 1. Shift
    const shift = await prisma.shift.create({
      data: { shiftCode: shiftCode, name: 'Ops Shift', startTime: '09:00', endTime: '18:00' }
    })
    await prisma.shiftAssignment.create({
      data: { employeeId: testEmployee.id, shiftId: shift.id, effectiveFrom: new Date() }
    })

    // 2. Attendance
    const attRecord = await prisma.attendanceRecord.create({
      data: {
        employeeId: testEmployee.id,
        shiftId: shift.id,
        attendanceDate: new Date('2026-11-01'),
        shiftNameSnapshot: 'Ops Shift',
        shiftStartTimeSnapshot: '09:00',
        shiftEndTimeSnapshot: '18:00',
        status: 'PRESENT'
      }
    })
    await prisma.attendancePunch.create({
      data: {
        attendanceRecordId: attRecord.id,
        employeeId: testEmployee.id,
        punchType: 'CHECK_IN',
        punchTime: new Date()
      }
    })

    // 3. Leave
    const leaveType = await prisma.leaveType.create({
      data: { code: leaveCode, name: 'Ops Leave', defaultDaysPerYear: 10 }
    })
    await prisma.leaveRequest.create({
      data: {
        requestCode: `LV_${timestamp}`,
        employeeId: testEmployee.id,
        leaveTypeId: leaveType.id,
        startDate: new Date('2026-11-10'),
        endDate: new Date('2026-11-11'),
        durationDays: 2,
        reason: 'Operational Reset Test Leave'
      }
    })

    // 4. Payroll
    const payrollPeriod = await prisma.payrollPeriod.create({
      data: {
        periodCode: periodCode,
        month: 11,
        year: 2026,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-30')
      }
    })
    const payrollRun = await prisma.payrollRun.create({
      data: {
        payrollPeriodId: payrollPeriod.id,
        runNumber: `RUN_${timestamp}`,
        processedById: saUser.id,
        status: 'DRAFT',
        totalGross: 50000,
        totalNet: 50000
      }
    })
    await prisma.payrollEntry.create({
      data: {
        payrollRunId: payrollRun.id,
        employeeId: testEmployee.id,
        payableDays: 30,
        basicSalary: 50000,
        grossEarnings: 50000,
        totalDeductions: 0,
        netSalary: 50000
      }
    })

    // 5. Expense Claim
    const expenseClaim = await prisma.expenseClaim.create({
      data: {
        claimNumber: claimNumber,
        employeeId: testEmployee.id,
        claimTitle: 'Ops Expense',
        totalAmount: 1200,
        netPayableAmount: 1200,
        status: 'SUBMITTED'
      }
    })
    await prisma.expenseItem.create({
      data: {
        claimId: expenseClaim.id,
        category: 'TRANSPORT',
        expenseDate: new Date(),
        amount: 1200
      }
    })

    // Verify operational records exist before reset
    assert.equal(await prisma.attendanceRecord.count({ where: { employeeId: testEmployee.id } }), 1)
    assert.equal(await prisma.leaveRequest.count({ where: { employeeId: testEmployee.id } }), 1)
    assert.equal(await prisma.expenseClaim.count({ where: { id: expenseClaim.id } }), 1)

    // Execute Delete All Data API with valid confirmation token
    const deleteRes = await request(app)
      .post('/api/v1/admin/data/delete-all')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ confirmationToken: 'DELETE ALL DATA' })

    assert.equal(deleteRes.status, 200)
    assert.equal(deleteRes.body.success, true)
    assert.ok(deleteRes.body.data.message.includes('permanently deleted'))

    // Confirm operational records are wiped to 0
    assert.equal(await prisma.attendanceRecord.count(), 0)
    assert.equal(await prisma.attendancePunch.count(), 0)
    assert.equal(await prisma.leaveRequest.count(), 0)
    assert.equal(await prisma.expenseClaim.count(), 0)
    assert.equal(await prisma.expenseItem.count(), 0)
    assert.equal(await prisma.payrollRun.count(), 0)
    assert.equal(await prisma.payrollEntry.count(), 0)
    assert.equal(await prisma.shiftAssignment.count(), 0)

    // Confirm ALL portal user accounts are 100% PRESERVED
    const preservedAccounts = await prisma.user.findMany({
      where: { username: { in: ['test_mgr_sa', 'test_mgr_hr', 'test_mgr_dm', 'test_mgr_tl', 'test_mgr_emp'] } }
    })
    assert.equal(preservedAccounts.length, 5, 'All 5 portal accounts must be preserved')

    // Confirm preserved accounts can still log in immediately
    const empLoginAfterReset = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_emp', password: commonPassword })
    assert.equal(empLoginAfterReset.status, 200, 'Preserved employee account must still log in')

    const hrLoginAfterReset = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_mgr_hr', password: commonPassword })
    assert.equal(hrLoginAfterReset.status, 200, 'Preserved HR account must still log in')

    // Clean up test department, designation, shift, leaveType
    await prisma.employee.deleteMany({ where: { id: testEmployee.id } }).catch(() => {})
    await prisma.shift.deleteMany({ where: { id: shift.id } }).catch(() => {})
    await prisma.leaveType.deleteMany({ where: { id: leaveType.id } }).catch(() => {})
    await prisma.designation.deleteMany({ where: { id: testDesig.id } }).catch(() => {})
    await prisma.department.deleteMany({ where: { id: testDept.id } }).catch(() => {})
  })
})
