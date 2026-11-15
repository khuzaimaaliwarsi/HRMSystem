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

const BASE_URL = '/api/v1'

describe('Backend Task Delete, Department Cancel, RBAC & Audit History QA Suite', () => {
  const suffix = `QA_TDEL_${Date.now()}`
  let deptA
  let deptB
  let desig
  let superAdminUser
  let hrAdminUser
  let managerUser
  let empAUser
  let empA
  let empB

  let tokenSuperAdmin
  let tokenHrAdmin
  let tokenManager
  let tokenEmployee

  const createdTaskIds = []
  const createdEmpIds = []

  before(async () => {
    assertIsolatedTestDatabase(prisma, getSanitizedDbDetails)
    deptA = await prisma.department.create({
      data: {
        name: `QA Task Dept A ${suffix}`,
        code: `TDA_${suffix}`,
        status: 'ACTIVE'
      }
    })
    deptB = await prisma.department.create({
      data: {
        name: `QA Task Dept B ${suffix}`,
        code: `TDB_${suffix}`,
        status: 'ACTIVE'
      }
    })
    desig = await prisma.designation.create({
      data: {
        code: `TDES_${suffix}`,
        title: 'QA Task Engineer',
        level: 'SENIOR'
      }
    })

    const mkEmpAndUser = async (tag, deptId, role) => {
      const emp = await prisma.employee.create({
        data: {
          employeeCode: `E_${tag}_${suffix}`,
          firstName: tag,
          lastName: 'Tester',
          email: `${tag.toLowerCase()}.${suffix}@qa.isysware.local`,
          departmentId: deptId,
          designationId: desig.id,
          employmentStatus: 'ACTIVE',
          joiningDate: new Date('2026-01-01')
        }
      })
      createdEmpIds.push(emp.id)
      const user = await prisma.user.create({
        data: {
          username: `u_${tag.toLowerCase()}_${suffix}`,
          email: `u_${tag.toLowerCase()}.${suffix}@qa.isysware.local`,
          passwordHash: 'qa_hash_not_used',
          role,
          employeeId: emp.id,
          isActive: true
        }
      })
      const token = generateAccessToken({
        userId: user.id,
        role: user.role,
        employeeId: emp.id,
        username: user.username,
        email: user.email
      })
      return { emp, user, token }
    }

    const sa = await mkEmpAndUser('SA', deptA.id, 'SUPER_ADMIN')
    const hr = await mkEmpAndUser('HR', deptA.id, 'HR_ADMIN')
    const mgr = await mkEmpAndUser('MGR', deptA.id, 'DEPT_MANAGER')
    const ea = await mkEmpAndUser('EMPA', deptA.id, 'EMPLOYEE')
    empB = await prisma.employee.create({
      data: {
        employeeCode: `E_EMPB_${suffix}`,
        firstName: 'EmpB',
        lastName: 'Tester',
        email: `empb.${suffix}@qa.isysware.local`,
        departmentId: deptB.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE',
        joiningDate: new Date('2026-01-01')
      }
    })
    createdEmpIds.push(empB.id)

    superAdminUser = sa.user
    hrAdminUser = hr.user
    managerUser = mgr.user
    empAUser = ea.user
    empA = ea.emp

    tokenSuperAdmin = sa.token
    tokenHrAdmin = hr.token
    tokenManager = mgr.token
    tokenEmployee = ea.token
  })

  after(async () => {
    await cleanupTestFixtures(prisma, {
      userIds: [superAdminUser?.id, hrAdminUser?.id, managerUser?.id, empAUser?.id],
      employeeIds: createdEmpIds,
      departmentIds: [deptA?.id, deptB?.id],
      designationIds: [desig?.id],
      taskIds: createdTaskIds
    })
    await prisma.$disconnect()
  })

  async function createQaTask(assigneeId, title) {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSuperAdmin}`
      },
      body: JSON.stringify({
        title,
        description: 'Dedicated QA test task for deletion/cancellation verification',
        assigneeId,
        priority: 'HIGH',
        dueDate: '2026-11-30',
        estimatedHours: 6,
        comments: [
          {
            id: `CMT-INIT-${Date.now()}`,
            authorName: 'SA Tester',
            author: 'SA Tester',
            text: 'Preserved initial comment',
            date: '2026-11-12',
            createdAt: new Date().toISOString()
          }
        ]
      })
    })
    const body = await res.json()
    assert.equal(res.status, 201, `Create task failed: ${JSON.stringify(body)}`)
    createdTaskIds.push(body.data.id)
    return body.data
  }

  test('1. Enforces mandatory reason & blocks Employee/Manager from permanent/soft delete (400 / 403)', async () => {
    const t = await createQaTask(empA.id, `QA Delete Guard ${suffix}`)

    // Employee cannot delete
    const empDel = await fetch(`${BASE_URL}/tasks/${t.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmployee}` },
      body: JSON.stringify({ reason: 'Employee trying to delete' })
    })
    assert.equal(empDel.status, 403)

    // Employee cannot cancel
    const empCancel = await fetch(`${BASE_URL}/tasks/${t.id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmployee}` },
      body: JSON.stringify({ reason: 'Employee trying to cancel' })
    })
    assert.equal(empCancel.status, 403)

    // Department Manager cannot permanently/soft delete via DELETE endpoint
    const mgrDel = await fetch(`${BASE_URL}/tasks/${t.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenManager}` },
      body: JSON.stringify({ reason: 'Manager attempting delete' })
    })
    assert.equal(mgrDel.status, 403)

    // Super Admin cannot delete without reason
    const missingReason = await fetch(`${BASE_URL}/tasks/${t.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
      body: JSON.stringify({ reason: '' })
    })
    assert.equal(missingReason.status, 400)
  })

  test('2. Department Manager can cancel same-dept tasks only and cannot cancel other-dept tasks', async () => {
    const deptATask = await createQaTask(empA.id, `QA DeptA Cancel ${suffix}`)
    const deptBTask = await createQaTask(empB.id, `QA DeptB Protected ${suffix}`)

    // Cross-department cancel rejected with 403
    const crossDeptCancel = await fetch(`${BASE_URL}/tasks/${deptBTask.id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenManager}` },
      body: JSON.stringify({ reason: 'Cross-department attempt' })
    })
    assert.equal(crossDeptCancel.status, 403)

    // Same-department cancel succeeds
    const sameDeptCancel = await fetch(`${BASE_URL}/tasks/${deptATask.id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenManager}` },
      body: JSON.stringify({ reason: 'Sprint reprioritized by department head' })
    })
    const cancelBody = await sameDeptCancel.json()
    assert.equal(sameDeptCancel.status, 200, JSON.stringify(cancelBody))
    assert.equal(cancelBody.data.status, 'CANCELLED')

    const audit = await prisma.auditLog.findFirst({
      where: { sourceModule: 'TASKS', entityId: deptATask.id, actionType: 'CANCEL' }
    })
    assert.ok(audit, 'AuditLog CANCEL record must exist in PostgreSQL')
    assert.equal(audit.actorUserId, managerUser.id)
    assert.equal(audit.reasonOrNotes, 'Sprint reprioritized by department head')
  })

  test('3. HR Admin and Super Admin soft-delete preserves PostgreSQL record/comments/audit & excludes from active list', async () => {
    const hrTarget = await createQaTask(empA.id, `QA HR SoftDelete ${suffix}`)
    const saTarget = await createQaTask(empB.id, `QA SA SoftDelete ${suffix}`)

    const hrDelRes = await fetch(`${BASE_URL}/tasks/${hrTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenHrAdmin}` },
      body: JSON.stringify({ reason: 'Duplicate HR compliance deliverable' })
    })
    assert.equal(hrDelRes.status, 200)

    const saDelRes = await fetch(`${BASE_URL}/tasks/${saTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
      body: JSON.stringify({ reason: 'Obsolete QA test task cleanup' })
    })
    assert.equal(saDelRes.status, 200)

    // Active GET /tasks must NOT return soft-deleted tasks (refresh persistence)
    const activeRes = await fetch(`${BASE_URL}/tasks`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
    })
    const activeBody = await activeRes.json()
    assert.equal(activeRes.status, 200)
    assert.equal(activeBody.data.some((x) => x.id === hrTarget.id), false)
    assert.equal(activeBody.data.some((x) => x.id === saTarget.id), false)

    // Cannot update or comment on soft-deleted task
    const editDeleted = await fetch(`${BASE_URL}/tasks/${hrTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
      body: JSON.stringify({ progress: 90 })
    })
    assert.equal(editDeleted.status, 400)

    // Preserved in PostgreSQL + AuditLog
    const dbDeleted = await prisma.taskAssignment.findUnique({ where: { id: saTarget.id } })
    assert.ok(dbDeleted, 'Soft-deleted task row must remain in PostgreSQL')
    assert.equal(dbDeleted.attachments?.isDeleted, true)
    assert.equal(dbDeleted.attachments?.deletionReason, 'Obsolete QA test task cleanup')
    assert.equal(dbDeleted.comments?.length, 1)

    const auditSa = await prisma.auditLog.findFirst({
      where: { sourceModule: 'TASKS', entityId: saTarget.id, actionType: 'DELETE' }
    })
    assert.ok(auditSa)
    assert.equal(auditSa.actorUserId, superAdminUser.id)
    assert.equal(auditSa.reasonOrNotes, 'Obsolete QA test task cleanup')

    // History endpoint RBAC & visibility
    const empHist = await fetch(`${BASE_URL}/tasks/history`, {
      headers: { Authorization: `Bearer ${tokenEmployee}` }
    })
    assert.equal(empHist.status, 403)

    const saHistRes = await fetch(`${BASE_URL}/tasks/history`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
    })
    const saHist = await saHistRes.json()
    assert.equal(saHistRes.status, 200)
    const saEntry = saHist.data.find((h) => h.id === saTarget.id)
    assert.ok(saEntry, 'Deleted task must appear in Super Admin history')
    assert.equal(saEntry.reason, 'Obsolete QA test task cleanup')
    assert.equal(saEntry.comments?.length, 1)

    const mgrHistRes = await fetch(`${BASE_URL}/tasks/history`, {
      headers: { Authorization: `Bearer ${tokenManager}` }
    })
    const mgrHist = await mgrHistRes.json()
    assert.equal(mgrHistRes.status, 200)
    assert.ok(mgrHist.data.some((h) => h.id === hrTarget.id), 'Manager sees Dept A history')
    assert.equal(mgrHist.data.some((h) => h.id === saTarget.id), false, 'Manager must not see Dept B history')
  })
})
