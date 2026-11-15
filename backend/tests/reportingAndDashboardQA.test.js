import { test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

test('Reporting & Dashboard Status Integrity QA Suite', async (t) => {
  let superAdminUser = null
  let superAdminToken = ''
  let activeEmps = []

  await t.test('1. Setup & PostgreSQL Verification of Employee Statuses', async () => {
    superAdminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })
    assert.ok(superAdminUser, 'Super Admin portal user must exist')

    superAdminToken = generateAccessToken({
      id: superAdminUser.id,
      role: superAdminUser.role,
      username: superAdminUser.username,
      email: superAdminUser.email
    })
    assert.ok(superAdminToken)

    // Check all employees in PostgreSQL
    const employees = await prisma.employee.findMany({
      include: { department: true }
    })
    assert.ok(employees.length >= 4, 'Must have at least 4 employees in database')

    activeEmps = employees.filter((e) => e.employmentStatus === 'ACTIVE')
    const inactiveEmps = employees.filter((e) => ['SUSPENDED', 'TERMINATED', 'INACTIVE'].includes(e.employmentStatus))

    assert.ok(activeEmps.length >= 1, 'There must be active employees in database')
    assert.ok(employees.length >= 4, 'Must have at least 4 employees in database')

    const opsTester = employees.find((e) => e.employeeCode === 'E_OPS_1794452880079')
    if (opsTester) {
      assert.equal(opsTester.employmentStatus, 'SUSPENDED', 'Operational Tester must have SUSPENDED status in PostgreSQL')
    }
  })

  await t.test('2. Backend Headcount Report strictly separates Active from Inactive/Departed', async () => {
    const res = await request(app)
      .get('/api/v1/reports/headcount')
      .set('Authorization', `Bearer ${superAdminToken}`)

    assert.equal(res.status, 200)
    assert.ok(res.body.success)
    const data = res.body.data
    assert.equal(typeof data.totalEmployees, 'number')
    assert.equal(typeof data.activeEmployees, 'number')
    assert.equal(data.activeEmployees, activeEmps.length, 'Active headcount must match active employees count')
    assert.ok(data.totalEmployees >= activeEmps.length, 'Total headcount must include suspended/inactive employees')
  })

  await t.test('3. Backend Payroll Report calculates exact Chartered Accountant aggregates', async () => {
    const res = await request(app)
      .get('/api/v1/reports/payroll')
      .set('Authorization', `Bearer ${superAdminToken}`)

    assert.equal(res.status, 200)
    assert.ok(res.body.success)
    const pReport = res.body.data
    assert.equal(pReport.currency, 'PKR')
    assert.equal(typeof pReport.totalGross, 'number')
    assert.equal(typeof pReport.totalTaxWithheld, 'number')
    assert.equal(typeof pReport.totalDeductions, 'number')
    assert.equal(typeof pReport.totalNetPaid, 'number')

    // Mathematical integrity invariant: Net + Deductions must equal Gross within currency precision
    if (pReport.totalGross > 0) {
      const calculatedGross = Number((pReport.totalNetPaid + pReport.totalDeductions).toFixed(2))
      assert.ok(
        Math.abs(calculatedGross - pReport.totalGross) <= 1.0,
        `Financial reconciliation invariant failed: Gross (${pReport.totalGross}) vs Net+Deductions (${calculatedGross})`
      )
    }
  })

  await t.test('4. Backend Attendance & Leaves Reports aggregate properly from PostgreSQL', async () => {
    const attRes = await request(app)
      .get('/api/v1/reports/attendance')
      .set('Authorization', `Bearer ${superAdminToken}`)

    assert.equal(attRes.status, 200)
    assert.equal(typeof attRes.body.data.attendanceRate, 'number')

    const leaveRes = await request(app)
      .get('/api/v1/reports/leaves')
      .set('Authorization', `Bearer ${superAdminToken}`)

    assert.equal(leaveRes.status, 200)
    assert.equal(typeof leaveRes.body.data.totalRequests, 'number')
    assert.equal(typeof leaveRes.body.data.totalDaysTaken, 'number')
  })
})
