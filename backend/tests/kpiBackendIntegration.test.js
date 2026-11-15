import {
  assertIsolatedTestDatabase,
  cleanupTestFixtures
} from './helpers/testIsolation.js'
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import prisma, { getSanitizedDbDetails } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

async function fetch(url, options = {}) {
  const pathOnly = String(url).replace(/^http:\/\/localhost:5000/, '')
  const method = (options.method || 'GET').toLowerCase()
  let req = request(app)[method](pathOnly)
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      req = req.set(k, v)
    }
  }
  if (options.body !== undefined) {
    req = req.send(typeof options.body === 'string' ? JSON.parse(options.body) : options.body)
  }
  const res = await req
  return {
    status: res.status,
    json: async () => res.body
  }
}

describe('Backend KPI PostgreSQL Integration Suite', () => {
  const suffix = `QA_KPI_${Date.now()}`
  let superAdminToken
  let employeeToken
  let activeDept
  let inactiveDept
  let adminUser
  let empUser
  let empRecord
  let empRecord2
  let desigRecord
  let testKpiCode = 'TEST_KPI_' + Date.now().toString().slice(-4)

  before(async () => {
    assertIsolatedTestDatabase(prisma, getSanitizedDbDetails)

    activeDept = await prisma.department.create({
      data: { code: `ACT_${suffix}`, name: `Active KPI Dept ${suffix}`, status: 'Active' }
    })
    inactiveDept = await prisma.department.create({
      data: { code: `INACT_${suffix}`, name: `Inactive KPI Dept ${suffix}`, status: 'Inactive' }
    })
    desigRecord = await prisma.designation.create({
      data: { code: `KDES_${suffix}`, title: 'QA KPI Analyst', level: 'JUNIOR' }
    })
    empRecord = await prisma.employee.create({
      data: {
        employeeCode: `EKPI_${suffix}`,
        firstName: 'KPI',
        lastName: 'Tester',
        email: `kpi.tester.${suffix}@qa.isysware.local`,
        departmentId: activeDept.id,
        designationId: desigRecord.id,
        employmentStatus: 'ACTIVE',
        joiningDate: new Date('2026-01-01')
      }
    })
    empRecord2 = await prisma.employee.create({
      data: {
        employeeCode: `EKPI2_${suffix}`,
        firstName: 'KPI2',
        lastName: 'Tester',
        email: `kpi2.tester.${suffix}@qa.isysware.local`,
        departmentId: activeDept.id,
        designationId: desigRecord.id,
        employmentStatus: 'ACTIVE',
        joiningDate: new Date('2026-01-01')
      }
    })
    adminUser = await prisma.user.create({
      data: {
        username: `sa_kpi_${suffix}`,
        email: `sa.kpi.${suffix}@qa.isysware.local`,
        passwordHash: 'qa_hash',
        role: 'SUPER_ADMIN',
        employeeId: empRecord.id,
        isActive: true
      }
    })
    empUser = await prisma.user.create({
      data: {
        username: `emp_kpi_${suffix}`,
        email: `emp.kpi.${suffix}@qa.isysware.local`,
        passwordHash: 'qa_hash',
        role: 'EMPLOYEE',
        employeeId: empRecord2.id,
        isActive: true
      }
    })

    superAdminToken = generateAccessToken({
      userId: adminUser.id,
      role: adminUser.role,
      employeeId: empRecord.id,
      username: adminUser.username,
      email: adminUser.email
    })

    employeeToken = generateAccessToken({
      userId: empUser.id,
      role: empUser.role,
      employeeId: empRecord2.id,
      username: empUser.username,
      email: empUser.email
    })
  })

  after(async () => {
    await cleanupTestFixtures(prisma, {
      userIds: [adminUser?.id, empUser?.id],
      employeeIds: [empRecord?.id, empRecord2?.id],
      departmentIds: [activeDept?.id, inactiveDept?.id],
      designationIds: [desigRecord?.id]
    })
    await prisma.$disconnect()
  })

  test('1. POST /api/v1/performance/kpis: creates and persists KPI in PostgreSQL for active department', async () => {
    const res = await fetch('http://localhost:5000/api/v1/performance/kpis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        code: testKpiCode,
        name: 'Automated Test Delivery Rate',
        departmentId: activeDept.id,
        metricType: 'Percentage',
        targetValue: 95,
        weightPercent: 30,
        reviewCycle: 'Quarterly',
        description: 'Verifying PostgreSQL persistence'
      })
    })

    const body = await res.json()
    assert.equal(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(body)}`)
    assert.equal(body.success, true)
    assert.ok(body.data.id)
    assert.equal(body.data.code, testKpiCode)
    assert.equal(body.data.departmentId, activeDept.id)

    // Direct PostgreSQL inspection
    const dbRecord = await prisma.departmentKpi.findUnique({
      where: {
        departmentId_code: {
          departmentId: activeDept.id,
          code: testKpiCode
        }
      }
    })
    assert.ok(dbRecord, 'Record must exist in department_kpis table')
    assert.equal(dbRecord.name, 'Automated Test Delivery Rate')
    assert.equal(dbRecord.targetValue, 95)
  })

  test('2. POST /api/v1/performance/kpis: rejects duplicate KPI code for same department with 409', async () => {
    const res = await fetch('http://localhost:5000/api/v1/performance/kpis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        code: testKpiCode,
        name: 'Duplicate KPI Test',
        departmentId: activeDept.id,
        metricType: 'Percentage',
        targetValue: 80,
        weightPercent: 20
      })
    })

    const body = await res.json()
    assert.equal(res.status, 409, `Expected 409 Conflict, got ${res.status}: ${JSON.stringify(body)}`)
    assert.equal(body.success, false)
    assert.equal(body.error?.code, 'DUPLICATE_KPI')
  })

  test('3. POST /api/v1/performance/kpis: blocks KPI creation for inactive department with 400', async () => {
    const res = await fetch('http://localhost:5000/api/v1/performance/kpis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        code: 'INACT_KPI_' + Date.now().toString().slice(-4),
        name: 'Inactive Dept KPI',
        departmentId: inactiveDept.id,
        metricType: 'Percentage',
        targetValue: 85,
        weightPercent: 25
      })
    })

    const body = await res.json()
    assert.equal(res.status, 400, `Expected 400 Bad Request, got ${res.status}: ${JSON.stringify(body)}`)
    assert.equal(body.success, false)
    assert.equal(body.error?.code, 'INACTIVE_DEPARTMENT')
  })

  test('4. GET /api/v1/performance/kpis: returns persisted KPIs from PostgreSQL', async () => {
    const res = await fetch('http://localhost:5000/api/v1/performance/kpis', {
      headers: {
        'Authorization': `Bearer ${superAdminToken}`
      }
    })

    const body = await res.json()
    assert.equal(res.status, 200)
    assert.equal(body.success, true)
    assert.ok(Array.isArray(body.data))

    const found = body.data.find((k) => k.code === testKpiCode)
    assert.ok(found, 'Created KPI must be in GET response')
    assert.equal(found.departmentId, activeDept.id)
  })

  test('5. RBAC Enforcement: non-admin is blocked from creating KPI with 403', async () => {
    if (!employeeToken) return

    const res = await fetch('http://localhost:5000/api/v1/performance/kpis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeToken}`
      },
      body: JSON.stringify({
        code: 'UNAUTH_KPI',
        name: 'Unauthorized KPI',
        departmentId: activeDept.id,
        targetValue: 90,
        weightPercent: 20
      })
    })

    const body = await res.json()
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`)
    assert.equal(body.success, false)
  })
})

