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

describe('Backend Task Management PostgreSQL Integration Suite', () => {
  const suffix = `QA_TSK_${Date.now()}`
  let authToken
  let superAdminUser
  let deptRecord
  let desigRecord
  let empRecord
  let testTaskCode
  let testTaskId

  before(async () => {
    assertIsolatedTestDatabase(prisma, getSanitizedDbDetails)

    deptRecord = await prisma.department.create({
      data: { code: `TD_${suffix}`, name: `QA Task Dept ${suffix}`, status: 'ACTIVE' }
    })
    desigRecord = await prisma.designation.create({
      data: { code: `TGD_${suffix}`, title: 'QA Task Spec', level: 'MID' }
    })
    empRecord = await prisma.employee.create({
      data: {
        employeeCode: `ETSK_${suffix}`,
        firstName: 'Task',
        lastName: 'Tester',
        email: `task.tester.${suffix}@qa.isysware.local`,
        departmentId: deptRecord.id,
        designationId: desigRecord.id,
        employmentStatus: 'ACTIVE',
        joiningDate: new Date('2026-01-01')
      }
    })
    superAdminUser = await prisma.user.create({
      data: {
        username: `sa_tsk_${suffix}`,
        email: `sa.tsk.${suffix}@qa.isysware.local`,
        passwordHash: 'qa_hash',
        role: 'SUPER_ADMIN',
        employeeId: empRecord.id,
        isActive: true
      }
    })

    authToken = generateAccessToken({
      userId: superAdminUser.id,
      role: superAdminUser.role,
      employeeId: empRecord.id,
      username: superAdminUser.username,
      email: superAdminUser.email
    })
  })

  after(async () => {
    await cleanupTestFixtures(prisma, {
      userIds: [superAdminUser?.id],
      employeeIds: [empRecord?.id],
      departmentIds: [deptRecord?.id],
      designationIds: [desigRecord?.id],
      taskIds: [testTaskId]
    })
    await prisma.$disconnect()
  })

  test('1. POST /api/v1/tasks: creates and persists task in PostgreSQL', async () => {
    const res = await fetch('http://localhost:5000/api/v1/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: 'Integration Test Task for PostgreSQL',
        description: 'Verifying end-to-end task persistence',
        assignedToId: empRecord.employeeCode,
        priority: 'HIGH',
        status: 'TODO',
        dueDate: '2026-11-28',
        estimatedHours: 10,
        progress: 0
      })
    })

    const body = await res.json()
    assert.equal(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(body)}`)
    assert.equal(body.success, true)
    assert.ok(body.data.id)
    assert.ok(body.data.taskCode)
    assert.equal(body.data.title, 'Integration Test Task for PostgreSQL')

    testTaskId = body.data.id
    testTaskCode = body.data.taskCode

    // Direct PostgreSQL inspection
    const dbRecord = await prisma.taskAssignment.findUnique({
      where: { id: testTaskId }
    })
    assert.ok(dbRecord, 'Task record must exist in PostgreSQL task_assignments table')
    assert.equal(dbRecord.taskCode, testTaskCode)
    assert.equal(dbRecord.priority, 'HIGH')
    assert.equal(dbRecord.status, 'TODO')
  })

  test('2. PATCH /api/v1/tasks/:id: updates progress and persists in PostgreSQL attachments metadata', async () => {
    assert.ok(testTaskId, 'Test task must exist')

    const res = await fetch(`http://localhost:5000/api/v1/tasks/${testTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        progress: 75
      })
    })

    const body = await res.json()
    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}: ${JSON.stringify(body)}`)
    assert.equal(body.success, true)
    assert.equal(body.data.progress, 75)
    assert.equal(body.data.status, 'IN_PROGRESS')

    // Inspect PostgreSQL directly
    const dbRecord = await prisma.taskAssignment.findUnique({
      where: { id: testTaskId }
    })
    assert.equal(dbRecord.status, 'IN_PROGRESS')
    assert.equal(dbRecord.attachments?.progress, 75)
  })

  test('3. POST /api/v1/tasks/:id/comments: appends comments to PostgreSQL JSON array', async () => {
    assert.ok(testTaskId, 'Test task must exist')

    const res = await fetch(`http://localhost:5000/api/v1/tasks/${testTaskId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        commentText: 'Automated integration comment saved to PostgreSQL.'
      })
    })

    const body = await res.json()
    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}: ${JSON.stringify(body)}`)
    assert.equal(body.success, true)

    // Verify in PostgreSQL database
    const dbRecord = await prisma.taskAssignment.findUnique({
      where: { id: testTaskId }
    })
    assert.ok(Array.isArray(dbRecord.comments))
    assert.equal(dbRecord.comments.length, 1)
    assert.equal(dbRecord.comments[0].text, 'Automated integration comment saved to PostgreSQL.')
  })

  test('4. GET /api/v1/tasks: retrieves tasks from PostgreSQL with correct field mapping', async () => {
    const res = await fetch('http://localhost:5000/api/v1/tasks', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })

    const body = await res.json()
    assert.equal(res.status, 200)
    assert.equal(body.success, true)
    assert.ok(Array.isArray(body.data))

    const found = body.data.find((t) => t.id === testTaskId)
    assert.ok(found, 'Created task must be returned in task list')
    assert.equal(found.progress, 75)
    assert.equal(found.status, 'IN_PROGRESS')
    assert.ok(found.assignee)
    assert.equal(found.assignee.employeeCode, empRecord.employeeCode)
  })
})
