import './helpers/testIsolation.js'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import prisma, { getSanitizedDbDetails } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'
import { assertIsolatedTestDatabase, cleanupTestFixtures } from './helpers/testIsolation.js'

describe('Backend Feedback, IDP & Formal PIP End-to-End QA Suite', () => {
  const tag = `FD_QA_${Date.now()}`
  const createdIds = {
    userIds: [],
    employeeIds: [],
    departmentIds: [],
    designationIds: []
  }

  let deptEng = null
  let deptOps = null
  let desig = null
  let saUser = null
  let hrUser = null
  let mgrUser = null
  let leadUser = null
  let empEngUser = null
  let empOpsUser = null
  let saToken = ''
  let hrToken = ''
  let mgrToken = ''
  let leadToken = ''
  let empEngToken = ''
  let empOpsToken = ''
  let mgrEmp = null
  let empEng = null
  let empOps = null

  before(async () => {
    assertIsolatedTestDatabase(prisma, getSanitizedDbDetails)
    deptEng = await prisma.department.create({ data: { code: `D_ENG_${tag}`, name: 'QA Eng Dept', status: 'Active' } })
    deptOps = await prisma.department.create({ data: { code: `D_OPS_${tag}`, name: 'QA Ops Dept', status: 'Active' } })
    desig = await prisma.designation.create({ data: { code: `DS_${tag}`, title: 'QA Engineer', level: 'JUNIOR' } })
    createdIds.departmentIds.push(deptEng.id, deptOps.id)
    createdIds.designationIds.push(desig.id)

    const pw = '$2a$10$dummyhashfortestingonly000000000000000000000000000'
    const mkActor = async (roleKey, role, deptId, firstName) => {
      const emp = await prisma.employee.create({
        data: {
          employeeCode: `FD_${roleKey}_${tag}`,
          firstName,
          lastName: 'Tester',
          email: `fd.${roleKey.toLowerCase()}.${tag}@qa.isysware.local`,
          employmentType: 'PERMANENT',
          employmentStatus: 'ACTIVE',
          joiningDate: new Date('2026-01-01T00:00:00.000Z'),
          departmentId: deptId,
          designationId: desig.id
        }
      })
      createdIds.employeeIds.push(emp.id)
      const usr = await prisma.user.create({
        data: {
          username: `u_fd_${roleKey.toLowerCase()}_${tag}`,
          email: `u.fd.${roleKey.toLowerCase()}.${tag}@qa.isysware.local`,
          passwordHash: pw,
          role,
          employeeId: emp.id,
          isActive: true
        }
      })
      createdIds.userIds.push(usr.id)
      return { emp, usr, token: generateAccessToken({ userId: usr.id, role }) }
    }

    const sa = await mkActor('SA', 'SUPER_ADMIN', deptEng.id, 'SA')
    const hr = await mkActor('HR', 'HR_ADMIN', deptEng.id, 'HR')
    const mgr = await mkActor('MGR', 'DEPT_MANAGER', deptEng.id, 'MGR')
    const lead = await mkActor('LEAD', 'TEAM_LEAD', deptEng.id, 'LEAD')
    const empA = await mkActor('EMPA', 'EMPLOYEE', deptEng.id, 'EMPA')
    const empB = await mkActor('EMPB', 'EMPLOYEE', deptOps.id, 'EMPB')

    saUser = sa.usr; saToken = sa.token
    hrUser = hr.usr; hrToken = hr.token
    mgrUser = mgr.usr; mgrToken = mgr.token; mgrEmp = mgr.emp
    leadUser = lead.usr; leadToken = lead.token
    empEngUser = empA.usr; empEngToken = empA.token; empEng = empA.emp
    empOpsUser = empB.usr; empOpsToken = empB.token; empOps = empB.emp
  })

  after(async () => {
    await cleanupTestFixtures(prisma, createdIds)
  })

  it('1. Employee Feedback: create, validate RBAC/dept scoping, update comments, acknowledge & persist in PostgreSQL', async () => {
    // Employee cannot create feedback
    const empAttempt = await request(app)
      .post('/api/v1/performance/feedback')
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ employeeId: empEng.id, title: 'Self Praise', strengths: 'Good' })
    assert.equal(empAttempt.status, 403)

    // Manager cannot submit feedback on self
    const selfAttempt = await request(app)
      .post('/api/v1/performance/feedback')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ employeeId: mgrEmp.id, title: 'Self Note', strengths: 'Good' })
    assert.equal(selfAttempt.status, 403)

    // Manager cannot submit feedback to employee in another department
    const crossDept = await request(app)
      .post('/api/v1/performance/feedback')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ employeeId: empOps.id, title: 'Cross Dept', strengths: 'Great' })
    assert.equal(crossDept.status, 403)

    // Manager creates feedback for same-dept employee
    const createRes = await request(app)
      .post('/api/v1/performance/feedback')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        employeeId: empEng.id,
        feedbackType: 'CONSTRUCTIVE',
        title: 'Sprint 14 Delivery Review',
        strengths: 'Fast API architecture and test discipline',
        improvementAreas: 'Break down PRs into smaller commits',
        managerComments: 'Keep mentoring junior teammates.'
      })
    assert.equal(createRes.status, 201)
    const fb = createRes.body.data
    assert.ok(fb.feedbackCode.startsWith('FDB-'))
    assert.equal(fb.status, 'SHARED')

    // Manager updates comments
    const patchRes = await request(app)
      .patch(`/api/v1/performance/feedback/${fb.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ managerComments: 'Follow up again in December.' })
    assert.equal(patchRes.status, 200)
    assert.equal(patchRes.body.data.managerComments, 'Follow up again in December.')

    // Wrong employee cannot view or acknowledge
    const wrongEmpView = await request(app)
      .get(`/api/v1/performance/feedback/${fb.id}`)
      .set('Authorization', `Bearer ${empOpsToken}`)
    assert.equal(wrongEmpView.status, 403)

    const wrongEmpAck = await request(app)
      .post(`/api/v1/performance/feedback/${fb.id}/acknowledge`)
      .set('Authorization', `Bearer ${empOpsToken}`)
      .send({ employeeResponse: 'Not mine' })
    assert.equal(wrongEmpAck.status, 403)

    // Target employee acknowledges with response
    const ackRes = await request(app)
      .post(`/api/v1/performance/feedback/${fb.id}/acknowledge`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ employeeResponse: 'Understood, will split PRs cleanly.' })
    assert.equal(ackRes.status, 200)
    assert.equal(ackRes.body.data.status, 'ACKNOWLEDGED')
    assert.equal(ackRes.body.data.employeeResponse, 'Understood, will split PRs cleanly.')

    // Detail + Audit History persisted on reload
    const detailRes = await request(app)
      .get(`/api/v1/performance/feedback/${fb.id}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(detailRes.status, 200)
    assert.equal(detailRes.body.data.status, 'ACKNOWLEDGED')
    assert.ok(detailRes.body.data.auditHistory.length >= 3)
  })

  it('2. Individual Development Plans (IDP): separate from PIPs, mentor assignment, milestone toggles, & close', async () => {
    const createRes = await request(app)
      .post('/api/v1/performance/development-plans')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        planCategory: 'IDP',
        employeeId: empEng.id,
        mentorId: mgrEmp.id,
        title: 'PostgreSQL Performance Mastery',
        goalsSummary: 'Master query optimization and indexing',
        recommendedTraining: 'PostgreSQL Internals Workshop',
        startDate: '2026-11-01',
        targetEndDate: '2026-12-31',
        checkpoints: [
          { title: 'Analyze slow queries', dueDate: '2026-11-20', completed: false },
          { title: 'Lead indexing brown-bag', dueDate: '2026-12-15', completed: false }
        ]
      })
    assert.equal(createRes.status, 201)
    const idp = createRes.body.data
    assert.equal(idp.planCategory, 'IDP')
    assert.ok(idp.planCode.startsWith('IDP-'))
    assert.equal(idp.progressPercent, 0)

    // Strict separation check: querying PIPs must NOT return this IDP
    const pipOnlyList = await request(app)
      .get('/api/v1/performance/development-plans?planCategory=PIP')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(pipOnlyList.status, 200)
    assert.equal(pipOnlyList.body.data.some((p) => p.id === idp.id), false)

    // Employee blocked from editing governance deadline
    const forbiddenEdit = await request(app)
      .patch(`/api/v1/performance/development-plans/${idp.id}`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ targetEndDate: '2027-12-31' })
    assert.equal(forbiddenEdit.status, 403)

    // Employee toggles checkpoint 0 -> 50%
    const t1 = await request(app)
      .patch(`/api/v1/performance/development-plans/${idp.id}/checkpoints/0/toggle`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({})
    assert.equal(t1.status, 200)
    assert.equal(t1.body.data.progressPercent, 50)
    assert.equal(t1.body.data.status, 'IN_PROGRESS')

    // Manager closes IDP cleanly
    const closeRes = await request(app)
      .post(`/api/v1/performance/development-plans/${idp.id}/close`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ closureOutcome: 'SUCCESSFULLY_COMPLETED', closureNotes: 'Completed ahead of Q4 target.' })
    assert.equal(closeRes.status, 200)
    assert.equal(closeRes.body.data.status, 'COMPLETED')
    assert.equal(closeRes.body.data.progressPercent, 100)
  })

  it('3. Formal PIP Lifecycle: concerns validation, anti-self-approval, evaluation, employee ack & HR closure', async () => {
    // Missing concerns / targets rejected
    const badPip = await request(app)
      .post('/api/v1/performance/development-plans')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ planCategory: 'PIP', employeeId: empEng.id, title: 'Incomplete PIP' })
    assert.equal(badPip.status, 400)

    // Team Lead & Employee blocked from initiating formal PIP
    const leadPip = await request(app)
      .post('/api/v1/performance/development-plans')
      .set('Authorization', `Bearer ${leadToken}`)
      .send({
        planCategory: 'PIP',
        employeeId: empEng.id,
        title: 'Lead PIP Attempt',
        documentedConcerns: 'Concern',
        targetEndDate: '2026-12-20',
        improvementTargets: [{ area: 'SLA', metric: '100% on time' }]
      })
    assert.equal(leadPip.status, 403)

    // Manager cannot initiate PIP on self
    const selfPip = await request(app)
      .post('/api/v1/performance/development-plans')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        planCategory: 'PIP',
        employeeId: mgrEmp.id,
        title: 'Self PIP',
        documentedConcerns: 'Self concern',
        targetEndDate: '2026-12-20',
        improvementTargets: [{ area: 'SLA', metric: '100% on time' }]
      })
    assert.equal(selfPip.status, 403)

    // HR Admin initiates formal PIP for empEng
    const createPip = await request(app)
      .post('/api/v1/performance/development-plans')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        planCategory: 'PIP',
        employeeId: empEng.id,
        mentorId: mgrEmp.id,
        title: 'Code Quality & SLA Recovery PIP',
        documentedConcerns: 'Three consecutive missed sprint deadlines and elevated regression defects.',
        reviewFrequency: 'BIWEEKLY',
        startDate: '2026-11-12',
        targetEndDate: '2026-12-24',
        improvementTargets: [
          { area: 'Defect Rate', metric: '<= 1 reopened ticket per sprint', baseline: '4/sprint', target: '<=1/sprint', status: 'IN_PROGRESS' }
        ],
        reviewSchedule: [
          { reviewDate: '2026-11-26', focus: 'Mid-cycle defect audit' }
        ]
      })
    assert.equal(createPip.status, 201)
    const pip = createPip.body.data
    assert.equal(pip.planCategory, 'PIP')
    assert.ok(pip.planCode.startsWith('PIP-'))

    // Strict separation check: querying IDPs must NOT return this PIP
    const idpOnlyList = await request(app)
      .get('/api/v1/performance/development-plans?planCategory=IDP')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(idpOnlyList.status, 200)
    assert.equal(idpOnlyList.body.data.some((p) => p.id === pip.id), false)

    // Employee acknowledges formal PIP
    const ackRes = await request(app)
      .post(`/api/v1/performance/development-plans/${pip.id}/acknowledge`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ employeeStatement: 'I acknowledge the targets and review schedule.' })
    assert.equal(ackRes.status, 200)
    assert.equal(ackRes.body.data.employeeAcknowledged, true)
    assert.equal(ackRes.body.data.status, 'ACKNOWLEDGED')

    // Manager records formal evaluation
    const evalRes = await request(app)
      .post(`/api/v1/performance/development-plans/${pip.id}/evaluate`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        comments: 'Zero reopened tickets in last sprint; significant improvement.',
        rating: 4.0,
        progressAssessment: 'ON_TRACK',
        improvementTargets: [
          { area: 'Defect Rate', metric: '<= 1 reopened ticket per sprint', baseline: '4/sprint', target: '<=1/sprint', status: 'MET' }
        ]
      })
    assert.equal(evalRes.status, 200)
    assert.equal(evalRes.body.data.status, 'UNDER_REVIEW')
    assert.equal(evalRes.body.data.managerEvaluations.length, 1)

    // Employee blocked from closing own PIP
    const empClose = await request(app)
      .post(`/api/v1/performance/development-plans/${pip.id}/close`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ closureOutcome: 'SUCCESSFULLY_COMPLETED', closureNotes: 'Self closing' })
    assert.equal(empClose.status, 403)

    // HR Admin closes PIP with approved outcome
    const closePip = await request(app)
      .post(`/api/v1/performance/development-plans/${pip.id}/close`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        closureOutcome: 'SUCCESSFULLY_COMPLETED',
        closureNotes: 'Employee met all measurable targets and sustained zero regression defects.'
      })
    assert.equal(closePip.status, 200)
    assert.equal(closePip.body.data.status, 'COMPLETED_SUCCESS')
    assert.equal(closePip.body.data.closureOutcome, 'SUCCESSFULLY_COMPLETED')

    // Reload PIP detail + confirm audit trail persisted
    const finalDetail = await request(app)
      .get(`/api/v1/performance/development-plans/${pip.id}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(finalDetail.status, 200)
    assert.ok(finalDetail.body.data.auditHistory.length >= 4)
  })
})
