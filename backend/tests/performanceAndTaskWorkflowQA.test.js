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

async function apiReq(path, token, method = 'GET', body = undefined) {
  const agent = request(app)[method.toLowerCase()](`/api/v1${path}`)
    .set('Authorization', `Bearer ${token}`)
  if (body !== undefined) {
    agent.send(body)
  }
  const res = await agent
  return { status: res.status, json: res.body || {} }
}

describe('Backend Tasks Approval & Performance Review Lifecycle QA Suite', () => {
  const suffix = `QA_PR_${Date.now()}`
  let deptA
  let deptB
  let desig
  let saCtx
  let hrCtx
  let mgrCtx
  let empACtx
  let empBCtx

  const createdCycleIds = []
  const createdReviewIds = []
  const createdTaskIds = []
  const createdUserIds = []
  const createdEmpIds = []

  before(async () => {
    assertIsolatedTestDatabase(prisma, getSanitizedDbDetails)
    deptA = await prisma.department.create({
      data: { name: `QA Perf Dept A ${suffix}`, code: `PDA_${suffix}`, status: 'ACTIVE' }
    })
    deptB = await prisma.department.create({
      data: { name: `QA Perf Dept B ${suffix}`, code: `PDB_${suffix}`, status: 'ACTIVE' }
    })
    desig = await prisma.designation.create({
      data: { code: `PDES_${suffix}`, title: 'QA Perf Engineer', level: 'SENIOR' }
    })

    const mkActor = async (tag, deptId, role) => {
      const emp = await prisma.employee.create({
        data: {
          employeeCode: `PR_${tag}_${suffix}`,
          firstName: tag,
          lastName: 'Reviewer',
          email: `pr.${tag.toLowerCase()}.${suffix}@qa.isysware.local`,
          departmentId: deptId,
          designationId: desig.id,
          employmentStatus: 'ACTIVE',
          joiningDate: new Date('2026-01-01')
        }
      })
      createdEmpIds.push(emp.id)

      const user = await prisma.user.create({
        data: {
          username: `u_pr_${tag.toLowerCase()}_${suffix}`,
          email: `u.pr.${tag.toLowerCase()}.${suffix}@qa.isysware.local`,
          passwordHash: 'qa_hash',
          role,
          employeeId: emp.id,
          isActive: true
        }
      })
      createdUserIds.push(user.id)

      const token = generateAccessToken({
        userId: user.id,
        role: user.role,
        employeeId: emp.id,
        username: user.username,
        email: user.email
      })
      return { emp, user, token }
    }

    saCtx = await mkActor('SA', deptA.id, 'SUPER_ADMIN')
    hrCtx = await mkActor('HR', deptA.id, 'HR_ADMIN')
    mgrCtx = await mkActor('MGR', deptA.id, 'DEPT_MANAGER')
    empACtx = await mkActor('EMPA', deptA.id, 'EMPLOYEE')
    empBCtx = await mkActor('EMPB', deptB.id, 'EMPLOYEE')
  })

  after(async () => {
    await cleanupTestFixtures(prisma, {
      userIds: createdUserIds,
      employeeIds: createdEmpIds,
      departmentIds: [deptA?.id, deptB?.id],
      designationIds: [desig?.id],
      taskIds: createdTaskIds,
      cycleIds: createdCycleIds,
      reviewIds: createdReviewIds
    })
    await prisma.$disconnect()
  })

  test('1. Performance Review full PostgreSQL lifecycle: Cycle -> Initiate -> Self -> Manager -> HR Moderate -> Super Admin Finalize -> Acknowledge', async () => {
    // Employee cannot create cycle
    const forbiddenCycle = await apiReq('/performance/cycles', empACtx.token, 'POST', {
      title: `Forbidden Cycle ${suffix}`,
      startDate: '2026-10-01',
      endDate: '2026-12-31'
    })
    assert.equal(forbiddenCycle.status, 403)

    // HR Admin creates active cycle
    const cycleRes = await apiReq('/performance/cycles', hrCtx.token, 'POST', {
      title: `Q4 QA Cycle ${suffix}`,
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      status: 'ACTIVE'
    })
    assert.equal(cycleRes.status, 201)
    const cycle = cycleRes.json.data
    createdCycleIds.push(cycle.id)
    assert.equal(cycle.title, `Q4 QA Cycle ${suffix}`)

    // Cross-dept initiation rejected for Dept A Manager targeting Dept B employee
    const crossDeptInit = await apiReq('/performance/reviews/initiate', mgrCtx.token, 'POST', {
      cycleId: cycle.id,
      employeeId: empBCtx.emp.id
    })
    assert.equal(crossDeptInit.status, 403)

    // Initiate review for Emp A in Dept A
    const initRes = await apiReq('/performance/reviews/initiate', mgrCtx.token, 'POST', {
      cycleId: cycle.id,
      employeeId: empACtx.emp.id,
      reviewerId: mgrCtx.emp.id
    })
    assert.equal(initRes.status, 201)
    const review = initRes.json.data
    createdReviewIds.push(review.id)
    assert.equal(review.status, 'SELF_REVIEW')

    // Duplicate initiation blocked with 409
    const dupInit = await apiReq('/performance/reviews/initiate', hrCtx.token, 'POST', {
      cycleId: cycle.id,
      employeeId: empACtx.emp.id
    })
    assert.equal(dupInit.status, 409)

    // Wrong employee cannot submit self-review
    const wrongSelf = await apiReq(`/performance/reviews/${review.id}/self`, empBCtx.token, 'POST', {
      selfScore: 4.5
    })
    assert.equal(wrongSelf.status, 403)

    // Target employee submits self-assessment
    const selfRes = await apiReq(`/performance/reviews/${review.id}/self`, empACtx.token, 'POST', {
      selfScore: 4.0,
      selfComments: 'Delivered core QA modules on schedule.'
    })
    assert.equal(selfRes.status, 200)
    assert.equal(selfRes.json.data.status, 'MANAGER_REVIEW')
    assert.equal(selfRes.json.data.reviewMeta.selfComments, 'Delivered core QA modules on schedule.')

    // Anti-self-approval check even for self-review edge case (super admin/manager evaluating own if applicable)
    // Cross-department manager blocked from reviewing Emp A
    // Now Dept A Manager submits multi-stage evaluation (finalizeImmediately: false -> HR_MODERATION)
    const mgrRes = await apiReq(`/performance/reviews/${review.id}/manager-review`, mgrCtx.token, 'POST', {
      reviewerScore: 4.6,
      managerComments: 'Strong engineering ownership.',
      recommendationType: 'SALARY_INCREMENT',
      recommendedPercent: 10,
      justification: 'Exceeded quarterly delivery benchmarks',
      finalizeImmediately: false
    })
    assert.equal(mgrRes.status, 200)
    assert.equal(mgrRes.json.data.status, 'HR_MODERATION')
    // Weighted: 0.3 * 4.0 + 0.7 * 4.6 = 1.2 + 3.22 = 4.42 -> 4.4
    assert.equal(Number(mgrRes.json.data.finalNormalizedScore), 4.4)
    assert.equal(mgrRes.json.data.ratingCategory, 'EXCEEDS_EXPECTATIONS')

    // Manager cannot HR moderate (403)
    const mgrModForbidden = await apiReq(`/performance/reviews/${review.id}/hr-moderate`, mgrCtx.token, 'POST', {
      hrRating: 4.5,
      hrComments: 'Not allowed'
    })
    assert.equal(mgrModForbidden.status, 403)

    // HR Admin moderates review -> FINAL_APPROVAL
    const hrModRes = await apiReq(`/performance/reviews/${review.id}/hr-moderate`, hrCtx.token, 'POST', {
      hrRating: 4.5,
      hrComments: 'Attendance and policy compliance verified.'
    })
    assert.equal(hrModRes.status, 200)
    assert.equal(hrModRes.json.data.status, 'FINAL_APPROVAL')
    assert.equal(hrModRes.json.data.ratingCategory, 'OUTSTANDING')

    // HR Admin cannot Super-Admin finalize (403)
    const hrFinForbidden = await apiReq(`/performance/reviews/${review.id}/finalize`, hrCtx.token, 'POST', {})
    assert.equal(hrFinForbidden.status, 403)

    // Super Admin finalizes review -> COMPLETED + locked
    const finRes = await apiReq(`/performance/reviews/${review.id}/finalize`, saCtx.token, 'POST', {})
    assert.equal(finRes.status, 200)
    assert.equal(finRes.json.data.status, 'COMPLETED')
    assert.equal(finRes.json.data.reviewMeta.isLocked, true)

    // Employee acknowledges finalized review
    const ackRes = await apiReq(`/performance/reviews/${review.id}/acknowledge`, empACtx.token, 'POST', {})
    assert.equal(ackRes.status, 200)
    assert.equal(ackRes.json.data.reviewMeta.acknowledgedByEmployee, true)

    // Reload GET persistence check
    const listRes = await apiReq(`/performance/reviews?cycleId=${cycle.id}`, empACtx.token)
    assert.equal(listRes.status, 200)
    assert.equal(listRes.json.data.length, 1)
    assert.equal(listRes.json.data[0].id, review.id)
    assert.equal(listRes.json.data[0].reviewMeta.acknowledgedByEmployee, true)
  })

  test('2. Task Approval Workflow: 100% moves to UNDER_REVIEW, employee blocked from verify, Manager/Admin approves COMPLETED (100%)', async () => {
    const createRes = await apiReq('/tasks', mgrCtx.token, 'POST', {
      title: `QA Approval Task ${suffix}`,
      description: 'Verify 100% submission & manager sign-off',
      assigneeId: empACtx.emp.id,
      priority: 'HIGH',
      estimatedHours: 6
    })
    assert.equal(createRes.status, 201)
    const task = createRes.json.data
    createdTaskIds.push(task.id)

    // Employee moves task to 100% via PATCH progress (without status: COMPLETED) -> must become UNDER_REVIEW, not COMPLETED
    const prog100Res = await apiReq(`/tasks/${task.id}`, empACtx.token, 'PATCH', {
      progress: 100
    })
    assert.equal(prog100Res.status, 200)
    assert.equal(prog100Res.json.data.status, 'UNDER_REVIEW')
    assert.equal(prog100Res.json.data.progress, 100)

    // Employee cannot self-verify task completion (403)
    const empVerifyRes = await apiReq(`/tasks/${task.id}/verify`, empACtx.token, 'PATCH', {
      action: 'APPROVE',
      remarks: 'Self approval attempt'
    })
    assert.equal(empVerifyRes.status, 403)

    // Validation: Cannot force COMPLETED with progress < 100
    const badCompleteRes = await apiReq(`/tasks/${task.id}`, mgrCtx.token, 'PATCH', {
      status: 'COMPLETED',
      progress: 70
    })
    assert.equal(badCompleteRes.status, 400)

    // Manager requests revision -> moves back to IN_PROGRESS
    const revRes = await apiReq(`/tasks/${task.id}/verify`, mgrCtx.token, 'PATCH', {
      action: 'REVISION',
      remarks: 'Add unit tests before sign-off',
      progress: 80
    })
    assert.equal(revRes.status, 200)
    assert.equal(revRes.json.data.status, 'IN_PROGRESS')
    assert.equal(revRes.json.data.progress, 80)

    // Employee submits 100% again via /submit-review -> UNDER_REVIEW
    const submitRes = await apiReq(`/tasks/${task.id}/submit-review`, empACtx.token, 'POST', {
      notes: 'Unit tests added.'
    })
    assert.equal(submitRes.status, 200)
    assert.equal(submitRes.json.data.status, 'UNDER_REVIEW')
    assert.equal(submitRes.json.data.progress, 100)

    // Manager verifies and approves -> COMPLETED + 100% + completedAt + AuditLog
    const approveRes = await apiReq(`/tasks/${task.id}/verify`, mgrCtx.token, 'PATCH', {
      action: 'APPROVE',
      remarks: 'Verified clean delivery.'
    })
    assert.equal(approveRes.status, 200)
    assert.equal(approveRes.json.data.status, 'COMPLETED')
    assert.equal(approveRes.json.data.progress, 100)
    assert.ok(approveRes.json.data.completedAt)

    const audit = await prisma.auditLog.findFirst({
      where: { entityName: 'TaskAssignment', entityId: task.id, actionType: 'APPROVE' }
    })
    assert.ok(audit, 'AuditLog entry must exist for verified task completion')
  })
})
