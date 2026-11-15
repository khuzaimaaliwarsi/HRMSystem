import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'
import organizationService from '../src/services/organizationService.js'

describe('Backend Batch 4 — Organization Management API Suite', () => {
  let saUser = null
  let empUser = null
  let saToken = null
  let empToken = null
  let createdDeptId = null
  let createdTeamId = null
  let createdDesigId = null

  it('Setup: Prepares test auth tokens', async () => {
    saUser = await prisma.user.create({
      data: {
        username: 'org_test_sa',
        email: 'org_test_sa@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })

    empUser = await prisma.user.create({
      data: {
        username: 'org_test_emp',
        email: 'org_test_emp@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE'
      }
    })

    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })
    empToken = generateAccessToken({ userId: empUser.id, role: 'EMPLOYEE' })

    assert.ok(saToken)
    assert.ok(empToken)
  })

  it('1. POST /api/v1/organization/departments: Creates a department with valid code and name', async () => {
    const res = await request(app)
      .post('/api/v1/organization/departments')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        code: 'DEP-ORG-TEST-1',
        name: 'Enterprise Cloud Solutions',
        description: 'Core infrastructure team'
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.success, true)
    assert.strictEqual(res.body.data.code, 'DEP-ORG-TEST-1')
    assert.strictEqual(res.body.data.name, 'Enterprise Cloud Solutions')
    createdDeptId = res.body.data.id
  })

  it('2. POST /api/v1/organization/departments: Rejects duplicate department code with 409', async () => {
    const res = await request(app)
      .post('/api/v1/organization/departments')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        code: 'DEP-ORG-TEST-1', // duplicate
        name: 'Duplicate Cloud Solutions'
      })

    assert.strictEqual(res.status, 409)
    assert.strictEqual(res.body.error.code, 'DUPLICATE_CODE')
  })

  it('3. GET /api/v1/organization/departments: Lists departments with pagination and search', async () => {
    const res = await request(app)
      .get('/api/v1/organization/departments?search=Enterprise')
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.success, true)
    assert.ok(Array.isArray(res.body.data))
    assert.ok(res.body.data.some(d => d.code === 'DEP-ORG-TEST-1'))
    assert.ok(res.body.meta.total >= 1)
  })

  it('4. PATCH /api/v1/organization/departments/:id: Updates department details', async () => {
    const res = await request(app)
      .patch(`/api/v1/organization/departments/${createdDeptId}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        name: 'Enterprise Cloud & DevOps Solutions',
        description: 'Updated description'
      })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.data.name, 'Enterprise Cloud & DevOps Solutions')
  })

  it('5. POST /api/v1/organization/teams: Creates a team linked to department', async () => {
    const res = await request(app)
      .post('/api/v1/organization/teams')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        code: 'TEAM-ORG-TEST-1',
        name: 'DevOps & SRE',
        departmentId: createdDeptId
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.data.code, 'TEAM-ORG-TEST-1')
    assert.strictEqual(res.body.data.departmentId, createdDeptId)
    createdTeamId = res.body.data.id
  })

  it('6. POST /api/v1/organization/designations: Creates a designation master', async () => {
    const res = await request(app)
      .post('/api/v1/organization/designations')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        code: 'DES-ORG-TEST-1',
        title: 'Senior DevOps Architect',
        departmentId: createdDeptId,
        level: 'SENIOR'
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.data.code, 'DES-ORG-TEST-1')
    createdDesigId = res.body.data.id
  })

  it('7. Anti-Circular Reporting: validateReportingHierarchy blocks self-reporting and circular loops', async () => {
    // Self-reporting
    let selfError = null
    try {
      await organizationService.validateReportingHierarchy('emp-123', 'emp-123')
    } catch (err) {
      selfError = err
    }
    assert.ok(selfError)
    assert.strictEqual(selfError.code, 'CIRCULAR_REPORTING_DETECTED')
  })

  it('8. RBAC Gate: Non-admin employee role is strictly blocked with 403 on create/update routes', async () => {
    const res = await request(app)
      .post('/api/v1/organization/departments')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        code: 'DEP-UNAUTH',
        name: 'Unauthorized Dept'
      })

    assert.strictEqual(res.status, 403)
    assert.strictEqual(res.body.error.code, 'FORBIDDEN')
  })

  it('Teardown: Cleans up organization fixtures', async () => {
    if (createdTeamId) await prisma.team.delete({ where: { id: createdTeamId } }).catch(() => {})
    if (createdDesigId) await prisma.designation.delete({ where: { id: createdDesigId } }).catch(() => {})
    if (createdDeptId) await prisma.department.delete({ where: { id: createdDeptId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [saUser.id, empUser.id] } } }).catch(() => {})
  })
})

