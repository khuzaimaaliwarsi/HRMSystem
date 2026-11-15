import './helpers/testIsolation.js'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import prisma, { getSanitizedDbDetails } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'
import { assertIsolatedTestDatabase, cleanupTestFixtures } from './helpers/testIsolation.js'

describe('Backend Training & Development End-to-End Persistence QA Suite', () => {
  const tag = `TRN_QA_${Date.now()}`
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
  let empEngUser = null
  let empOpsUser = null

  let saToken = ''
  let hrToken = ''
  let mgrToken = ''
  let empEngToken = ''
  let empOpsToken = ''

  let empEng = null
  let empOps = null

  before(async () => {
    assertIsolatedTestDatabase(prisma, getSanitizedDbDetails)

    deptEng = await prisma.department.create({ data: { code: `D_ENG_${tag}`, name: 'QA Training Eng', status: 'Active' } })
    deptOps = await prisma.department.create({ data: { code: `D_OPS_${tag}`, name: 'QA Training Ops', status: 'Active' } })
    desig = await prisma.designation.create({ data: { code: `DS_${tag}`, title: 'Software Engineer', level: 'MID' } })
    createdIds.departmentIds.push(deptEng.id, deptOps.id)
    createdIds.designationIds.push(desig.id)

    const pw = '$2a$10$dummyhashfortestingonly000000000000000000000000000'
    const createActor = async (suffix, role, departmentId) => {
      const emp = await prisma.employee.create({
        data: {
          employeeCode: `EMP_${suffix}_${tag}`,
          firstName: suffix,
          lastName: 'TrainingQA',
          email: `${suffix.toLowerCase()}.${tag}@isysware.qa`,
          departmentId,
          designationId: desig.id,
          employmentType: 'PERMANENT',
          employmentStatus: 'ACTIVE',
          joiningDate: new Date('2025-01-01T00:00:00.000Z')
        }
      })
      const usr = await prisma.user.create({
        data: {
          username: `usr_${suffix.toLowerCase()}_${tag}`,
          email: `u.${suffix.toLowerCase()}.${tag}@isysware.qa`,
          passwordHash: pw,
          role,
          employeeId: emp.id,
          isActive: true
        }
      })
      createdIds.employeeIds.push(emp.id)
      createdIds.userIds.push(usr.id)
      return { emp, usr, token: generateAccessToken({ userId: usr.id, role: usr.role }) }
    }

    const sa = await createActor('SA', 'SUPER_ADMIN', deptEng.id)
    const hr = await createActor('HR', 'HR_ADMIN', deptEng.id)
    const mgr = await createActor('MGR', 'DEPT_MANAGER', deptEng.id)
    const e1 = await createActor('ENG1', 'EMPLOYEE', deptEng.id)
    const e2 = await createActor('OPS1', 'EMPLOYEE', deptOps.id)

    saUser = sa.usr; saToken = sa.token
    hrUser = hr.usr; hrToken = hr.token
    mgrUser = mgr.usr; mgrToken = mgr.token
    empEng = e1.emp; empEngUser = e1.usr; empEngToken = e1.token
    empOps = e2.emp; empOpsUser = e2.usr; empOpsToken = e2.token
  })

  after(async () => {
    try {
      await prisma.trainingEnrollment.deleteMany({
        where: { employeeId: { in: createdIds.employeeIds } }
      })
      await prisma.trainingPlan.deleteMany({
        where: {
          OR: [
            { targetEmployeeId: { in: createdIds.employeeIds } },
            { recommendedById: { in: createdIds.userIds } }
          ]
        }
      })
      await prisma.trainingSession.deleteMany({
        where: { program: { title: { startsWith: `QA_PROG_${tag}` } } }
      })
      await prisma.trainingProgram.deleteMany({
        where: { title: { startsWith: `QA_PROG_${tag}` } }
      })
      await prisma.auditLog.deleteMany({
        where: { actorUserId: { in: createdIds.userIds } }
      })
    } finally {
      await cleanupTestFixtures(prisma, createdIds)
      await prisma.$disconnect()
    }
  })

  it('1. Course Catalog & Programs: create, reload GET, edit, toggle-status, and archive persist in PostgreSQL', async () => {
    const createRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: `QA_PROG_${tag} Cloud Architecture`,
        category: 'Engineering & Technology',
        skills: ['AWS', 'Docker', 'PostgreSQL'],
        trainingType: 'Online',
        trainer: 'Dr. Architecture Lead',
        durationHours: 24,
        maxParticipants: 15,
        costPerParticipant: 45000,
        prerequisites: 'Linux basics',
        materials: 'Lab Workbook',
        description: 'End-to-end cloud workshop'
      })
    assert.equal(createRes.status, 201)
    const programId = createRes.body.data.id
    assert.equal(createRes.body.data.status, 'Active')
    assert.deepEqual(createRes.body.data.skills, ['AWS', 'Docker', 'PostgreSQL'])

    // Reload GET check
    const listRes = await request(app)
      .get('/api/v1/training/programs')
      .set('Authorization', `Bearer ${empEngToken}`)
    assert.equal(listRes.status, 200)
    const reloaded = listRes.body.data.find((p) => p.id === programId)
    assert.ok(reloaded)
    assert.equal(reloaded.trainerName, 'Dr. Architecture Lead')
    assert.equal(Number(reloaded.durationHours), 24)

    // Edit PATCH check
    const editRes = await request(app)
      .patch(`/api/v1/training/programs/${programId}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        title: `QA_PROG_${tag} Cloud Architecture v2`,
        durationHours: 32,
        skills: ['Kubernetes', 'Terraform']
      })
    assert.equal(editRes.status, 200)
    assert.equal(editRes.body.data.title, `QA_PROG_${tag} Cloud Architecture v2`)
    assert.equal(Number(editRes.body.data.durationHours), 32)
    assert.deepEqual(editRes.body.data.skills, ['Kubernetes', 'Terraform'])

    // Toggle status Active -> Draft -> Active
    const toggle1 = await request(app)
      .post(`/api/v1/training/programs/${programId}/toggle-status`)
      .set('Authorization', `Bearer ${hrToken}`)
    assert.equal(toggle1.status, 200)
    assert.equal(toggle1.body.data.status, 'Draft')

    const toggle2 = await request(app)
      .post(`/api/v1/training/programs/${programId}/toggle-status`)
      .set('Authorization', `Bearer ${hrToken}`)
    assert.equal(toggle2.status, 200)
    assert.equal(toggle2.body.data.status, 'Active')

    // Secondary course for archive check
    const arcCreate = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        title: `QA_PROG_${tag} Legacy Course`,
        trainer: 'Legacy Instructor',
        durationHours: 8
      })
    assert.equal(arcCreate.status, 201)
    const arcRes = await request(app)
      .post(`/api/v1/training/programs/${arcCreate.body.data.id}/archive`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(arcRes.status, 200)
    assert.equal(arcRes.body.data.status, 'Archived')
  })

  it('1b. Course Catalog validation, PLANNED status, empty-field fidelity (no fake fallbacks), duplicates, RBAC, audit attribution & enrollment preservation', async () => {
    const customCode = `TRN-QA-${String(Date.now()).slice(-4)}`
    // Create PLANNED course with omitted prerequisites/materials to verify NO fake fallbacks are injected
    const plannedRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        courseCode: customCode,
        title: `QA_PROG_${tag} Planned System Design`,
        category: 'Technical',
        trainingType: 'Internal',
        trainerName: 'Sarah System Lead',
        skills: ['Distributed Systems'],
        durationHours: 16,
        maxCapacity: 20,
        status: 'PLANNED'
      })
    assert.equal(plannedRes.status, 201)
    const plannedId = plannedRes.body.data.id
    assert.equal(plannedRes.body.data.courseCode, customCode)
    assert.equal(plannedRes.body.data.status, 'PLANNED')
    assert.equal(plannedRes.body.data.trainerName, 'Sarah System Lead')
    assert.equal(plannedRes.body.data.prerequisites, '')
    assert.equal(plannedRes.body.data.materials, '')

    // Reload GET must preserve PLANNED status and empty strings (not treat PLANNED as Active or inject fake defaults)
    const reloadRes = await request(app)
      .get('/api/v1/training/programs')
      .set('Authorization', `Bearer ${hrToken}`)
    assert.equal(reloadRes.status, 200)
    const foundPlanned = reloadRes.body.data.find((p) => p.id === plannedId)
    assert.ok(foundPlanned)
    assert.equal(foundPlanned.courseCode, customCode)
    assert.equal(foundPlanned.status, 'PLANNED')
    assert.equal(foundPlanned.category, 'Technical')
    assert.equal(foundPlanned.trainingType, 'Internal')
    assert.equal(foundPlanned.maxCapacity, 20)
    assert.equal(foundPlanned.trainerName, 'Sarah System Lead')
    assert.equal(foundPlanned.prerequisites, '')
    assert.equal(foundPlanned.materials, '')

    // Toggle status on PLANNED course -> promotes to Active (was NOT falsely treated as Active)
    const togglePlannedRes = await request(app)
      .post(`/api/v1/training/programs/${plannedId}/toggle-status`)
      .set('Authorization', `Bearer ${hrToken}`)
    assert.equal(togglePlannedRes.status, 200)
    assert.equal(togglePlannedRes.body.data.status, 'Active')

    // Full PATCH edit updating every persisted catalog field
    const fullPatchRes = await request(app)
      .patch(`/api/v1/training/programs/${plannedId}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        category: 'Leadership & Management',
        trainingType: 'Hybrid',
        skills: ['Architecture', 'Mentoring'],
        trainerName: 'Principal Architect',
        durationHours: 28,
        maxCapacity: 30,
        costPerParticipant: 15000,
        prerequisites: '3+ years backend engineering',
        materials: 'Architecture Blueprint PDF & Repo',
        description: 'Updated deep dive syllabus',
        status: 'Planned'
      })
    assert.equal(fullPatchRes.status, 200)
    assert.equal(fullPatchRes.body.data.category, 'Leadership & Management')
    assert.equal(fullPatchRes.body.data.trainingType, 'Hybrid')
    assert.equal(fullPatchRes.body.data.trainerName, 'Principal Architect')
    assert.equal(Number(fullPatchRes.body.data.durationHours), 28)
    assert.equal(fullPatchRes.body.data.maxCapacity, 30)
    assert.equal(Number(fullPatchRes.body.data.costPerParticipant), 15000)
    assert.equal(fullPatchRes.body.data.prerequisites, '3+ years backend engineering')
    assert.equal(fullPatchRes.body.data.materials, 'Architecture Blueprint PDF & Repo')
    assert.equal(fullPatchRes.body.data.description, 'Updated deep dive syllabus')
    assert.equal(fullPatchRes.body.data.status, 'Planned')

    // Duplicate courseCode & duplicate (title + trainerName) rejection
    const dupCodeRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        courseCode: customCode,
        title: `QA_PROG_${tag} Distinct Title`,
        trainerName: 'Another Trainer',
        durationHours: 8
      })
    assert.equal(dupCodeRes.status, 409)

    const dupComboRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: `QA_PROG_${tag} Planned System Design`,
        trainerName: 'Principal Architect',
        durationHours: 8
      })
    assert.equal(dupComboRes.status, 409)

    // Invalid input rejection (400)
    const badInputRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ title: `QA_PROG_${tag} Invalid Hours`, durationHours: -5, maxCapacity: 0 })
    assert.equal(badInputRes.status, 400)

    // RBAC checks: EMPLOYEE and DEPT_MANAGER forbidden (403) on create/edit/toggle/archive
    for (const token of [empEngToken, mgrToken]) {
      const r1 = await request(app).post('/api/v1/training/programs').set('Authorization', `Bearer ${token}`).send({ title: `QA_PROG_${tag} Denied` })
      assert.equal(r1.status, 403)
      const r2 = await request(app).patch(`/api/v1/training/programs/${plannedId}`).set('Authorization', `Bearer ${token}`).send({ description: 'Hacked' })
      assert.equal(r2.status, 403)
      const r3 = await request(app).post(`/api/v1/training/programs/${plannedId}/toggle-status`).set('Authorization', `Bearer ${token}`)
      assert.equal(r3.status, 403)
      const r4 = await request(app).post(`/api/v1/training/programs/${plannedId}/archive`).set('Authorization', `Bearer ${token}`)
      assert.equal(r4.status, 403)
    }

    // Preserve existing enrollment & plan relationships when editing/archiving
    const activateRes = await request(app)
      .patch(`/api/v1/training/programs/${plannedId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Active' })
    assert.equal(activateRes.status, 200)

    const enrRes = await request(app)
      .post('/api/v1/training/enrollments')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ programId: plannedId, employeeId: empEng.id })
    assert.equal(enrRes.status, 201)

    const editWithEnr = await request(app)
      .patch(`/api/v1/training/programs/${plannedId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ description: 'Updated while enrollment active' })
    assert.equal(editWithEnr.status, 200)

    const arcWithEnr = await request(app)
      .post(`/api/v1/training/programs/${plannedId}/archive`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(arcWithEnr.status, 200)
    assert.equal(arcWithEnr.body.data.status, 'Archived')

    const enrCheck = await prisma.trainingEnrollment.findUnique({ where: { id: enrRes.body.data.id } })
    assert.ok(enrCheck, 'Existing enrollment must remain intact after editing and archiving course')
    assert.equal(enrCheck.programId, plannedId)

    // AuditLog verification
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityName: 'TrainingProgram', entityId: plannedId }
    })
    assert.ok(auditLogs.length >= 4, 'Audit logs must record create, toggle, update, and archive actions')
    assert.ok(auditLogs.some((a) => a.actorUserId === saUser.id && a.actionType === 'ARCHIVE'))
  })

  it('2. Training Plans, Cohorts, Enrollments, Progress, Assessments & Certificates persist across reloads with RBAC', async () => {
    // A. Create Active Program
    const progRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        title: `QA_PROG_${tag} Security Engineering`,
        category: 'Security & Governance',
        skills: ['OWASP', 'Threat Modeling'],
        trainer: 'CISO Academy',
        durationHours: 16,
        maxParticipants: 10,
        passingScore: 70
      })
    assert.equal(progRes.status, 201)
    const prog = progRes.body.data

    const todayStr = new Date().toISOString().slice(0, 10)
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    // B. Schedule Cohort Session (active today so attendance & completion can be verified cleanly)
    const sesRes = await request(app)
      .post('/api/v1/training/sessions')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        programId: prog.id,
        trainer: 'CISO Lead',
        startDate: yesterdayStr,
        endDate: todayStr,
        startTime: '14:00',
        endTime: '17:00',
        locationType: 'Online',
        locationOrLink: 'https://meet.isysware.internal/sec-cohort',
        capacity: 10
      })
    assert.equal(sesRes.status, 201)
    const session = sesRes.body.data
    assert.equal(session.status, 'Scheduled')

    // Overlapping trainer schedule conflict check
    const conflictRes = await request(app)
      .post('/api/v1/training/sessions')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        programId: prog.id,
        trainer: 'CISO Lead',
        startDate: yesterdayStr,
        endDate: todayStr,
        startTime: '15:00',
        endTime: '16:30',
        capacity: 5
      })
    assert.equal(conflictRes.status, 409)

    // C. Manager cross-department recommendation must fail (403)
    const crossPlanRes = await request(app)
      .post('/api/v1/training/plans')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        title: 'Cross-dept forbidden',
        programId: prog.id,
        targetEmployeeId: empOps.id,
        justification: 'Cross department attempt should fail'
      })
    assert.equal(crossPlanRes.status, 403)

    // D. Manager recommends plan for same-department employee
    const mgrPlanRes = await request(app)
      .post('/api/v1/training/plans')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        title: 'Security Upskilling for Eng Employee',
        planType: 'Individual',
        programId: prog.id,
        targetEmployeeId: empEng.id,
        skillsGapSource: 'Performance Appraisal',
        justification: 'Strengthen application security design skills'
      })
    assert.equal(mgrPlanRes.status, 201)
    assert.equal(mgrPlanRes.body.data.status, 'Recommended')

    // E. Employee self-requests training plan
    const selfPlanRes = await request(app)
      .post('/api/v1/training/plans')
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({
        title: 'Self Security Request',
        programId: prog.id,
        justification: 'Want to deepen OWASP knowledge'
      })
    assert.equal(selfPlanRes.status, 201)
    assert.equal(selfPlanRes.body.data.status, 'Pending HR Review')

    // F. HR approves manager plan -> auto-enrolls empEng into scheduled cohort session!
    const approvePlanRes = await request(app)
      .post(`/api/v1/training/plans/${mgrPlanRes.body.data.id}/approve`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ remarks: 'Approved for December cohort' })
    assert.equal(approvePlanRes.status, 200)
    assert.equal(approvePlanRes.body.data.status, 'Approved')
    assert.equal(approvePlanRes.body.data.enrolledCount, 1)

    // HR rejects self-request plan
    const rejectPlanRes = await request(app)
      .post(`/api/v1/training/plans/${selfPlanRes.body.data.id}/reject`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ reason: 'Already covered via manager recommendation' })
    assert.equal(rejectPlanRes.status, 200)
    assert.equal(rejectPlanRes.body.data.status, 'Rejected')

    // Verify Employee & Cross-Dept RBAC isolation on plans GET
    const opsPlansRes = await request(app)
      .get('/api/v1/training/plans')
      .set('Authorization', `Bearer ${empOpsToken}`)
    assert.equal(opsPlansRes.status, 200)
    assert.equal(opsPlansRes.body.data.some((p) => p.id === mgrPlanRes.body.data.id), false)

    // G. Verify enrollment persisted on GET /enrollments and employee updates progress
    const enrListRes = await request(app)
      .get('/api/v1/training/enrollments')
      .set('Authorization', `Bearer ${empEngToken}`)
    assert.equal(enrListRes.status, 200)
    const enrollment = enrListRes.body.data.find((e) => e.programId === prog.id)
    assert.ok(enrollment)

    // Cross-employee progress tamper attempt rejected
    const opsTamperRes = await request(app)
      .patch(`/api/v1/training/enrollments/${enrollment.id}/progress`)
      .set('Authorization', `Bearer ${empOpsToken}`)
      .send({ progressPercent: 80 })
    assert.equal(opsTamperRes.status, 403)

    // Employee updates own progress
    const progUpdateRes = await request(app)
      .patch(`/api/v1/training/enrollments/${enrollment.id}/progress`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ progressPercent: 75 })
    assert.equal(progUpdateRes.status, 200)
    assert.equal(progUpdateRes.body.data.progressPercent, 75)
    assert.equal(progUpdateRes.body.data.status, 'IN_PROGRESS')

    // H. Record Session Attendance (must transition Scheduled -> In Progress, NOT auto-complete)
    const attRes = await request(app)
      .post(`/api/v1/training/sessions/${session.id}/attendance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        attendanceRecords: [
          {
            employeeId: empEng.id,
            employeeName: `${empEng.firstName} ${empEng.lastName}`,
            status: 'Present',
            attendedHours: 16,
            remarks: 'Active participation in lab'
          }
        ]
      })
    assert.equal(attRes.status, 200)
    assert.equal(attRes.body.data.status, 'In Progress')
    assert.equal(attRes.body.data.attendanceRecorded, true)
    assert.equal(attRes.body.data.completedAt, null)

    const completeRes = await request(app)
      .post(`/api/v1/training/sessions/${session.id}/complete`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({})
    assert.equal(completeRes.status, 200)
    assert.equal(completeRes.body.data.status, 'Completed')
    assert.ok(completeRes.body.data.completedAt)

    // I. Finalize Assessment -> Auto-issue Certificate & Verification Code
    const assessRes = await request(app)
      .post(`/api/v1/training/enrollments/${enrollment.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        score: 92,
        status: 'Completed',
        feedback: 'Excellent threat modeling presentation'
      })
    assert.equal(assessRes.status, 200)
    assert.equal(assessRes.body.data.status, 'COMPLETED')
    assert.equal(assessRes.body.data.progressPercent, 100)
    assert.ok(assessRes.body.data.certificateNumber.startsWith('CERT-'))
    assert.ok(assessRes.body.data.verificationCode.startsWith('VRF-'))

    // J. Verify Certificates Register GET + Verify Endpoint + Reload Check
    const certListRes = await request(app)
      .get('/api/v1/training/certificates')
      .set('Authorization', `Bearer ${empEngToken}`)
    assert.equal(certListRes.status, 200)
    const cert = certListRes.body.data.find((c) => c.id === enrollment.id)
    assert.ok(cert)

    const verifyRes = await request(app)
      .get(`/api/v1/training/certificates/verify/${cert.verificationCode}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(verifyRes.status, 200)
    assert.equal(verifyRes.body.data.valid, true)
    assert.equal(verifyRes.body.data.certificate.certificateNumber, cert.certificateNumber)

    // Fake verification code fails gracefully
    const badVerify = await request(app)
      .get('/api/v1/training/certificates/verify/VRF-0000-0000')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(badVerify.status, 200)
    assert.equal(badVerify.body.data.valid, false)

    // Ops employee sees 0 certificates from Eng employee
    const opsCerts = await request(app)
      .get('/api/v1/training/certificates')
      .set('Authorization', `Bearer ${empOpsToken}`)
    assert.equal(opsCerts.status, 200)
    assert.equal(opsCerts.body.data.some((c) => c.id === enrollment.id), false)
  })

  it('3. Cohorts & Attendance: no auto-complete, date/status guards, cancellation before end date, participation persistence & RBAC', async () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const plus2Str = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
    const plus5Str = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10)
    const plus8Str = new Date(Date.now() + 86400000 * 8).toISOString().slice(0, 10)

    const progRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        title: `QA_PROG_${tag} Cohort Lifecycle`,
        category: 'Engineering Delivery',
        skills: ['Architecture'],
        trainer: 'Principal Architect',
        durationHours: 12,
        maxParticipants: 15
      })
    assert.equal(progRes.status, 201)
    const prog = progRes.body.data

    // 1. Future Cohort: block attendance before startDate, block premature completion, allow cancellation
    const futureRes = await request(app)
      .post('/api/v1/training/sessions')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        programId: prog.id,
        trainer: 'Future Instructor',
        startDate: plus5Str,
        endDate: plus8Str,
        startTime: '10:00',
        endTime: '13:00',
        capacity: 10,
        participantIds: [empEng.id]
      })
    assert.equal(futureRes.status, 201)
    const futureSes = futureRes.body.data

    const earlyAttRes = await request(app)
      .post(`/api/v1/training/sessions/${futureSes.id}/attendance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        attendanceRecords: [{ employeeId: empEng.id, status: 'Present', attendedHours: 2, remarks: 'Too early' }]
      })
    assert.equal(earlyAttRes.status, 400)

    const earlyCompRes = await request(app)
      .post(`/api/v1/training/sessions/${futureSes.id}/complete`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({})
    assert.equal(earlyCompRes.status, 400)

    // Cancellation BEFORE endDate MUST be allowed (not blocked by completion checks)
    const cancelFutureRes = await request(app)
      .post(`/api/v1/training/sessions/${futureSes.id}/cancel`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ reason: 'Postponed by management' })
    assert.equal(cancelFutureRes.status, 200)
    assert.equal(cancelFutureRes.body.data.status, 'Cancelled')

    // Recording attendance or re-cancelling a Cancelled cohort MUST be blocked
    const cancelledAttRes = await request(app)
      .post(`/api/v1/training/sessions/${futureSes.id}/attendance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        attendanceRecords: [{ employeeId: empEng.id, status: 'Present', attendedHours: 1 }]
      })
    assert.equal(cancelledAttRes.status, 400)

    const reCancelRes = await request(app)
      .post(`/api/v1/training/sessions/${futureSes.id}/cancel`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ reason: 'Double cancel' })
    assert.equal(reCancelRes.status, 400)

    // 2. Ongoing Started Cohort (started yesterday, ends in +2 days): participation persistence + no auto-complete
    const ongoingRes = await request(app)
      .post('/api/v1/training/sessions')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        programId: prog.id,
        trainer: 'Lead Trainer',
        startDate: yesterdayStr,
        endDate: plus2Str,
        startTime: '09:00',
        endTime: '12:00',
        capacity: 10,
        participantIds: [empEng.id, empOps.id]
      })
    assert.equal(ongoingRes.status, 201)
    const ongoingSes = ongoingRes.body.data

    // Complete blocked before endDate & before attendance
    const compEarlyOngoing = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/complete`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({})
    assert.equal(compEarlyOngoing.status, 400)

    // Employee blocked from attendance/complete/cancel (403)
    const empAttRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/attendance`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ attendanceRecords: [{ employeeId: empEng.id, status: 'Present', attendedHours: 3 }] })
    assert.equal(empAttRes.status, 403)

    const empCompRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/complete`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({})
    assert.equal(empCompRes.status, 403)

    const empCancelRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/cancel`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ reason: 'Unauthorized' })
    assert.equal(empCancelRes.status, 403)

    // Record mixed participation statuses & remarks -> status becomes In Progress (NOT Completed)
    const saveMixedRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/attendance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        attendanceRecords: [
          {
            employeeId: empEng.id,
            attendanceStatus: 'Excused',
            attendedHours: 1.5,
            remarks: 'Release war-room duty'
          },
          {
            employeeId: empOps.id,
            attendanceStatus: 'Absent',
            attendedHours: 0,
            remarks: 'On medical leave'
          }
        ]
      })
    assert.equal(saveMixedRes.status, 200)
    assert.equal(saveMixedRes.body.data.status, 'In Progress')
    assert.equal(saveMixedRes.body.data.completedAt, null)

    // Update statuses (Registered & Present) and verify reload GET /sessions persists everything
    const updateAttRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/attendance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        attendanceRecords: [
          {
            employeeId: empEng.id,
            attendanceStatus: 'Registered',
            attendedHours: 0,
            remarks: 'Rescheduled to day 2'
          },
          {
            employeeId: empOps.id,
            attendanceStatus: 'Present',
            attendedHours: 6,
            remarks: 'Completed all lab modules'
          }
        ]
      })
    assert.equal(updateAttRes.status, 200)
    assert.equal(updateAttRes.body.data.status, 'In Progress')

    const reloadListRes = await request(app)
      .get('/api/v1/training/sessions')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(reloadListRes.status, 200)
    const reloaded = reloadListRes.body.data.find((s) => s.id === ongoingSes.id)
    assert.ok(reloaded)
    assert.equal(reloaded.status, 'In Progress')
    assert.equal(reloaded.completedAt, null)
    const recEng = reloaded.attendanceRecords.find((r) => r.employeeId === empEng.id)
    const recOps = reloaded.attendanceRecords.find((r) => r.employeeId === empOps.id)
    assert.equal(recEng.attendanceStatus, 'Registered')
    assert.equal(recEng.attendedHours, 0)
    assert.equal(recEng.remarks, 'Rescheduled to day 2')
    assert.equal(recOps.attendanceStatus, 'Present')
    assert.equal(recOps.attendedHours, 6)
    assert.equal(recOps.remarks, 'Completed all lab modules')

    // Manager cannot complete or cancel cohort (403)
    const mgrCompRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/complete`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({})
    assert.equal(mgrCompRes.status, 403)

    const mgrCancelRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/cancel`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({})
    assert.equal(mgrCancelRes.status, 403)

    // Reschedule endDate to today -> completion succeeds, then attendance & cancel are blocked
    const patchEndRes = await request(app)
      .patch(`/api/v1/training/sessions/${ongoingSes.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ endDate: todayStr })
    assert.equal(patchEndRes.status, 200)

    const compOngoingRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/complete`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({})
    assert.equal(compOngoingRes.status, 200)
    assert.equal(compOngoingRes.body.data.status, 'Completed')

    const completedAttRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/attendance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        attendanceRecords: [{ employeeId: empEng.id, status: 'Present', attendedHours: 4 }]
      })
    assert.equal(completedAttRes.status, 400)

    const cancelCompletedRes = await request(app)
      .post(`/api/v1/training/sessions/${ongoingSes.id}/cancel`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ reason: 'Cannot cancel completed' })
    assert.equal(cancelCompletedRes.status, 400)

    // 3. Unrecorded cohort with endDate <= today cannot be completed until attendance is saved
    const unrecordedRes = await request(app)
      .post('/api/v1/training/sessions')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        programId: prog.id,
        trainer: 'Audit Trainer',
        startDate: yesterdayStr,
        endDate: todayStr,
        startTime: '15:00',
        endTime: '17:00',
        capacity: 5,
        participantIds: [empEng.id]
      })
    assert.equal(unrecordedRes.status, 201)
    const compNoAttRes = await request(app)
      .post(`/api/v1/training/sessions/${unrecordedRes.body.data.id}/complete`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({})
    assert.equal(compNoAttRes.status, 400)
  })

  it('4. Learning Progress & Grades: block future progress/assessments, require completed training & valid attendance before certification, RBAC & audit persistence', async () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const futureStart = new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10)
    const futureEnd = new Date(Date.now() + 86400000 * 6).toISOString().slice(0, 10)

    // Program A for future-date validation
    const progFutureRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        title: `QA_PROG_${tag} Future Grades Guard`,
        category: 'Architecture',
        trainer: 'Lead Architect',
        durationHours: 10,
        maxParticipants: 10,
        passingScore: 75,
        startDate: futureStart,
        endDate: futureEnd
      })
    assert.equal(progFutureRes.status, 201)
    const progFuture = progFutureRes.body.data

    const futureSesRes = await request(app)
      .post('/api/v1/training/sessions')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        programId: progFuture.id,
        trainer: 'Future Proctor',
        startDate: futureStart,
        endDate: futureEnd,
        startTime: '10:00',
        endTime: '12:00',
        capacity: 10
      })
    assert.equal(futureSesRes.status, 201)

    const futureEnrRes = await request(app)
      .post('/api/v1/training/enrollments')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        programId: progFuture.id,
        sessionId: futureSesRes.body.data.id,
        employeeId: empEng.id
      })
    assert.equal(futureEnrRes.status, 201)
    const futureEnr = futureEnrRes.body.data

    // Future progress, attendance, and assessments (pass or fail) must all be blocked (400)
    const futProgUpdate = await request(app)
      .patch(`/api/v1/training/enrollments/${futureEnr.id}/progress`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ progressPercent: 50 })
    assert.equal(futProgUpdate.status, 400)
    assert.equal(futProgUpdate.body.error.code, 'FUTURE_PROGRESS_NOT_ALLOWED')

    const futAtt = await request(app)
      .post(`/api/v1/training/enrollments/${futureEnr.id}/attendance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ sessionsAttendedCount: 1 })
    assert.equal(futAtt.status, 400)
    assert.equal(futAtt.body.error.code, 'FUTURE_ATTENDANCE_NOT_ALLOWED')

    const futAssessPass = await request(app)
      .post(`/api/v1/training/enrollments/${futureEnr.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ score: 95, status: 'Completed', feedback: 'Too early' })
    assert.equal(futAssessPass.status, 400)
    assert.equal(futAssessPass.body.error.code, 'FUTURE_ASSESSMENT_NOT_ALLOWED')

    const futAssessFail = await request(app)
      .post(`/api/v1/training/enrollments/${futureEnr.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ score: 40, status: 'Failed', feedback: 'Still future dated' })
    assert.equal(futAssessFail.status, 400)

    // Program B for started cohort completion, valid attendance & certification checks
    const progActiveRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        title: `QA_PROG_${tag} Completed Grades Guard`,
        category: 'Data Systems',
        skills: ['PostgreSQL', 'Indexing'],
        trainer: 'DB Principal',
        durationHours: 12,
        maxParticipants: 10,
        passingScore: 75,
        startDate: yesterdayStr,
        endDate: todayStr
      })
    assert.equal(progActiveRes.status, 201)
    const progActive = progActiveRes.body.data

    const activeSesRes = await request(app)
      .post('/api/v1/training/sessions')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        programId: progActive.id,
        trainer: 'Active DB Proctor',
        startDate: yesterdayStr,
        endDate: todayStr,
        startTime: '13:00',
        endTime: '16:00',
        capacity: 10
      })
    assert.equal(activeSesRes.status, 201)
    const activeSes = activeSesRes.body.data

    const enrEngRes = await request(app)
      .post('/api/v1/training/enrollments')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ programId: progActive.id, sessionId: activeSes.id, employeeId: empEng.id })
    assert.equal(enrEngRes.status, 201)
    const enrEng = enrEngRes.body.data

    const enrOpsRes = await request(app)
      .post('/api/v1/training/enrollments')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ programId: progActive.id, sessionId: activeSes.id, employeeId: empOps.id })
    assert.equal(enrOpsRes.status, 201)
    const enrOps = enrOpsRes.body.data

    // RBAC: Employee & Manager blocked from grading assessments (403); Manager blocked from cross-dept progress (403)
    const empGradeForbidden = await request(app)
      .post(`/api/v1/training/enrollments/${enrEng.id}/assessment`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ score: 90, feedback: 'Self pass attempt' })
    assert.equal(empGradeForbidden.status, 403)

    const mgrGradeForbidden = await request(app)
      .post(`/api/v1/training/enrollments/${enrEng.id}/assessment`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ score: 90, feedback: 'Manager grade attempt' })
    assert.equal(mgrGradeForbidden.status, 403)

    const mgrCrossProgForbidden = await request(app)
      .patch(`/api/v1/training/enrollments/${enrOps.id}/progress`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ progressPercent: 60 })
    assert.equal(mgrCrossProgForbidden.status, 403)

    // Employee updates own progress on started cohort -> persists across reload
    const engProgOk = await request(app)
      .patch(`/api/v1/training/enrollments/${enrEng.id}/progress`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ progressPercent: 60 })
    assert.equal(engProgOk.status, 200)
    assert.equal(engProgOk.body.data.progressPercent, 60)

    // Cannot pass/certify before cohort is marked Completed (prevents premature certificates)
    const passBeforeComplete = await request(app)
      .post(`/api/v1/training/enrollments/${enrEng.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ score: 90, status: 'Completed', feedback: 'Cohort not completed yet' })
    assert.equal(passBeforeComplete.status, 400)
    assert.equal(passBeforeComplete.body.error.code, 'TRAINING_NOT_COMPLETED')

    // Record cohort attendance (empEng = Present, empOps = Absent) and complete cohort
    const markAttRes = await request(app)
      .post(`/api/v1/training/sessions/${activeSes.id}/attendance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        attendanceRecords: [
          { employeeId: empEng.id, attendanceStatus: 'Present', attendedHours: 12, remarks: 'Attended all days' },
          { employeeId: empOps.id, attendanceStatus: 'Absent', attendedHours: 0, remarks: 'Did not attend' }
        ]
      })
    assert.equal(markAttRes.status, 200)

    // Still cannot pass while cohort status is In Progress (not Completed)
    const passWhileInProg = await request(app)
      .post(`/api/v1/training/enrollments/${enrEng.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ score: 90, status: 'Completed', feedback: 'Cohort still In Progress' })
    assert.equal(passWhileInProg.status, 400)
    assert.equal(passWhileInProg.body.error.code, 'TRAINING_NOT_COMPLETED')

    const compSesRes = await request(app)
      .post(`/api/v1/training/sessions/${activeSes.id}/complete`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({})
    assert.equal(compSesRes.status, 200)
    assert.equal(compSesRes.body.data.status, 'Completed')

    // Absent participant CANNOT pass / earn certificate even after cohort completion
    const absentPassBlocked = await request(app)
      .post(`/api/v1/training/enrollments/${enrOps.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ score: 85, status: 'Completed', feedback: 'Absent attempt' })
    assert.equal(absentPassBlocked.status, 400)
    assert.equal(absentPassBlocked.body.error.code, 'VALID_ATTENDANCE_REQUIRED')

    // Below passing threshold (65 < 75) cannot force Completed
    const belowPassBlocked = await request(app)
      .post(`/api/v1/training/enrollments/${enrEng.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ score: 65, status: 'Completed', feedback: 'Force pass attempt' })
    assert.equal(belowPassBlocked.status, 400)
    assert.equal(belowPassBlocked.body.error.code, 'SCORE_BELOW_PASS_MARK')

    // Failed assessment for Absent learner persists FAILED without certificate
    const failRes = await request(app)
      .post(`/api/v1/training/enrollments/${enrOps.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ score: 50, status: 'Failed', feedback: 'Missed mandatory labs' })
    assert.equal(failRes.status, 200)
    assert.equal(failRes.body.data.status, 'FAILED')
    assert.equal(failRes.body.data.certificateNumber, null)

    // Present learner in Completed cohort passes (90 >= 75) -> certificate issued + persisted
    const passRes = await request(app)
      .post(`/api/v1/training/enrollments/${enrEng.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ score: 90, status: 'Completed', feedback: 'Demonstrated strong mastery' })
    assert.equal(passRes.status, 200)
    assert.equal(passRes.body.data.status, 'COMPLETED')
    assert.equal(passRes.body.data.progressPercent, 100)
    assert.ok(passRes.body.data.certificateNumber.startsWith('CERT-'))

    // Re-grading completed enrollment is blocked & finalized progress cannot be mutated
    const regradeBlocked = await request(app)
      .post(`/api/v1/training/enrollments/${enrEng.id}/assessment`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ score: 98, status: 'Completed', feedback: 'Tamper retry' })
    assert.equal(regradeBlocked.status, 400)

    const finalizedProgBlocked = await request(app)
      .patch(`/api/v1/training/enrollments/${enrEng.id}/progress`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ progressPercent: 40 })
    assert.equal(finalizedProgBlocked.status, 400)

    // Reload verification & AuditLog verification
    const certsRes = await request(app)
      .get('/api/v1/training/certificates')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(certsRes.status, 200)
    assert.equal(certsRes.body.data.some((c) => c.id === enrEng.id), true)
    assert.equal(certsRes.body.data.some((c) => c.id === enrOps.id), false)
    assert.equal(certsRes.body.data.some((c) => c.id === futureEnr.id), false)

    const assessmentAudit = await prisma.auditLog.findFirst({
      where: {
        entityName: 'TrainingEnrollment',
        entityId: enrEng.id,
        actionType: 'ASSESSMENT'
      }
    })
    assert.ok(assessmentAudit)
    assert.equal(assessmentAudit.actorUserId, hrUser.id)
  })
})
