import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Backend Batch 6C — Recruitment, Tasks, Performance, Training, Expenses, Reports & Administration Suite', () => {
  let saUser = null
  let mgrUser = null
  let empUser = null
  let saToken = null
  let mgrToken = null
  let empToken = null

  let dept = null
  let desig = null
  let employee = null
  let manager = null

  // Fixtures generated during tests
  let requisition = null
  let opening = null
  let candidate = null
  let application = null
  let interview = null
  let offer = null
  let hiredEmployeeId = null

  let task = null
  let perfCycle = null
  let perfGoal = null
  let perfReview = null
  let trainingProg = null
  let enrollment = null
  let travelReq = null
  let transportPass = null
  let expenseClaim = null

  async function cleanupAllFixtures() {
    try {
      // 1. Expenses & Travel
      await prisma.expenseItem.deleteMany({ where: { claim: { claimNumber: { startsWith: 'EXP-6C' } } } }).catch(() => {})
      await prisma.expenseClaim.deleteMany({ where: { claimNumber: { startsWith: 'EXP-6C' } } }).catch(() => {})
      await prisma.transportPass.deleteMany({ where: { passNumber: { startsWith: 'PASS-6C' } } }).catch(() => {})
      await prisma.travelRequest.deleteMany({ where: { requestCode: { startsWith: 'TRV-6C' } } }).catch(() => {})

      // 2. Training
      await prisma.trainingEnrollment.deleteMany({ where: { program: { courseCode: { startsWith: 'TRN-6C' } } } }).catch(() => {})
      await prisma.trainingProgram.deleteMany({ where: { courseCode: { startsWith: 'TRN-6C' } } }).catch(() => {})

      // 3. Performance
      await prisma.performanceReview.deleteMany({ where: { cycle: { cycleCode: { startsWith: 'CYC-6C' } } } }).catch(() => {})
      await prisma.performanceGoal.deleteMany({ where: { cycle: { cycleCode: { startsWith: 'CYC-6C' } } } }).catch(() => {})
      await prisma.performanceCycle.deleteMany({ where: { cycleCode: { startsWith: 'CYC-6C' } } }).catch(() => {})

      // 4. Tasks
      await prisma.taskAssignment.deleteMany({ where: { taskCode: { startsWith: 'TSK-6C' } } }).catch(() => {})

      // 5. Onboarding & Recruitment
      if (hiredEmployeeId) {
        await prisma.onboardingTask.deleteMany({ where: { checklist: { employeeId: hiredEmployeeId } } }).catch(() => {})
        await prisma.onboardingChecklist.deleteMany({ where: { employeeId: hiredEmployeeId } }).catch(() => {})
        await prisma.salaryStructure.deleteMany({ where: { employeeId: hiredEmployeeId } }).catch(() => {})
      }
      await prisma.interviewEvaluation.deleteMany({ where: { interview: { roundTitle: 'TEST_ROUND_6C' } } }).catch(() => {})
      await prisma.interviewSchedule.deleteMany({ where: { roundTitle: 'TEST_ROUND_6C' } }).catch(() => {})
      await prisma.jobOffer.deleteMany({ where: { offerNumber: { startsWith: 'OFF-6C' } } }).catch(() => {})
      await prisma.jobApplication.deleteMany({ where: { opening: { openingCode: { startsWith: 'JOB-6C' } } } }).catch(() => {})
      await prisma.candidate.deleteMany({ where: { candidateCode: { startsWith: 'CAND-6C' } } }).catch(() => {})
      await prisma.jobOpening.deleteMany({ where: { openingCode: { startsWith: 'JOB-6C' } } }).catch(() => {})
      await prisma.jobRequisition.deleteMany({ where: { requisitionNumber: { startsWith: 'REQ-6C' } } }).catch(() => {})

      if (hiredEmployeeId) {
        await prisma.employee.deleteMany({ where: { id: hiredEmployeeId } }).catch(() => {})
      }

      // 6. Base fixtures
      const emps = await prisma.employee.findMany({
        where: { employeeCode: { in: ['EMP-6C-MGR', 'EMP-6C-EMP'] } },
        select: { id: true }
      })
      const empIds = emps.map((e) => e.id)
      if (empIds.length > 0) {
        await prisma.employee.deleteMany({ where: { id: { in: empIds } } }).catch(() => {})
      }

      await prisma.user.deleteMany({ where: { username: { in: ['usr_6c_sa', 'usr_6c_mgr', 'usr_6c_emp'] } } }).catch(() => {})
      await prisma.designation.deleteMany({ where: { code: 'DES-6C-ENG' } }).catch(() => {})
      await prisma.department.deleteMany({ where: { code: 'DEP-6C-ENG' } }).catch(() => {})
    } catch {
      // ignore
    }
  }

  before(async () => {
    await cleanupAllFixtures()

    // 1. Base Department and Designation
    dept = await prisma.department.create({
      data: { code: 'DEP-6C-ENG', name: 'Software Engineering 6C' }
    })
    desig = await prisma.designation.create({
      data: { code: 'DES-6C-ENG', title: 'Senior Software Engineer 6C', level: 'MID', departmentId: dept.id }
    })

    // 2. Manager Employee & User
    manager = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-6C-MGR',
        firstName: 'Imran',
        lastName: 'Manager',
        email: 'imran.mgr.6c@isysware.com',
        phone: '+923001116601',
        departmentId: dept.id,
        designationId: desig.id,
        joiningDate: new Date('2024-01-01')
      }
    })
    mgrUser = await prisma.user.create({
      data: {
        username: 'usr_6c_mgr',
        email: 'imran.mgr.6c@isysware.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        role: 'DEPT_MANAGER',
        employeeId: manager.id,
        isActive: true
      }
    })
    mgrToken = generateAccessToken({
      userId: mgrUser.id,
      role: mgrUser.role,
      employeeId: manager.id,
      email: mgrUser.email,
      username: mgrUser.username
    })

    // 3. Regular Employee & User
    employee = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-6C-EMP',
        firstName: 'Zainab',
        lastName: 'Developer',
        email: 'zainab.dev.6c@isysware.com',
        phone: '+923001116602',
        departmentId: dept.id,
        designationId: desig.id,
        joiningDate: new Date('2025-01-01')
      }
    })
    empUser = await prisma.user.create({
      data: {
        username: 'usr_6c_emp',
        email: 'zainab.dev.6c@isysware.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        role: 'EMPLOYEE',
        employeeId: employee.id,
        isActive: true
      }
    })
    empToken = generateAccessToken({
      userId: empUser.id,
      role: empUser.role,
      employeeId: employee.id,
      email: empUser.email,
      username: empUser.username
    })

    // 4. Super Admin User
    saUser = await prisma.user.create({
      data: {
        username: 'usr_6c_sa',
        email: 'sa.6c@isysware.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        role: 'SUPER_ADMIN',
        isActive: true,
        isProtected: false
      }
    })
    saToken = generateAccessToken({
      userId: saUser.id,
      role: saUser.role,
      email: saUser.email,
      username: saUser.username
    })
  })

  after(async () => {
    await cleanupAllFixtures()
  })

  // ============================================================================
  // 1. RECRUITMENT & ONBOARDING WORKFLOWS
  // ============================================================================

  it('1. Recruitment: Requisition Creation, Anti-Self-Approval Review, and Job Opening', async () => {
    // A. Create Requisition
    const reqRes = await request(app)
      .post('/api/v1/recruitment/requisitions')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        requisitionNumber: 'REQ-6C-001',
        departmentId: dept.id,
        designationId: desig.id,
        openingsCount: 2,
        justification: 'Need 2 senior engineers for cloud migration'
      })
    assert.equal(reqRes.status, 201)
    requisition = reqRes.body.data

    // B. Anti-Self-Approval Guard: Manager cannot approve their own requisition
    const selfApprove = await request(app)
      .patch(`/api/v1/recruitment/requisitions/${requisition.id}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ action: 'APPROVE', remarks: 'Self approve' })
    assert.equal(selfApprove.status, 403)
    assert.equal(selfApprove.body.error.code, 'SELF_APPROVAL_PROHIBITED')

    // C. Super Admin Approves Requisition
    const approveRes = await request(app)
      .patch(`/api/v1/recruitment/requisitions/${requisition.id}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ action: 'APPROVE', remarks: 'Budget approved for Q4' })
    assert.equal(approveRes.status, 200)
    assert.equal(approveRes.body.data.status, 'APPROVED')

    // D. Create Job Opening
    const openRes = await request(app)
      .post('/api/v1/recruitment/openings')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        openingCode: 'JOB-6C-001',
        requisitionId: requisition.id,
        title: 'Senior Cloud Engineer',
        departmentId: dept.id,
        experienceMinYears: 3.5,
        salaryMin: 150000,
        salaryMax: 220000
      })
    assert.equal(openRes.status, 201)
    opening = openRes.body.data
    assert.equal(opening.openingCode, 'JOB-6C-001')
  })

  it('2. Recruitment: Candidate Registration, Application, Interview & 5-Point Evaluation', async () => {
    // A. Register Candidate (Candidate remains distinct from employees)
    const candRes = await request(app)
      .post('/api/v1/recruitment/candidates')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        candidateCode: 'CAND-6C-001',
        firstName: 'Taha',
        lastName: 'Ahmed',
        email: 'taha.candidate.6c@example.com',
        phone: '+923114445555',
        currentCompany: 'Apex Tech Solutions',
        currentDesignation: 'Backend Developer',
        totalExperienceYears: 4.0
      })
    assert.equal(candRes.status, 201)
    candidate = candRes.body.data
    assert.equal(candidate.linkedEmployeeId, null)

    // B. Apply Candidate to Opening
    const applyRes = await request(app)
      .post(`/api/v1/recruitment/openings/${opening.id}/apply`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ candidateId: candidate.id, stageNotes: 'Shortlisted from direct portal' })
    assert.equal(applyRes.status, 201)
    application = applyRes.body.data
    assert.equal(application.status, 'APPLIED')

    // Duplicate application rejection
    const dupApply = await request(app)
      .post(`/api/v1/recruitment/openings/${opening.id}/apply`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ candidateId: candidate.id })
    assert.equal(dupApply.status, 409)

    // C. Schedule Interview
    const intRes = await request(app)
      .post(`/api/v1/recruitment/applications/${application.id}/interviews`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        interviewerId: manager.id,
        roundNumber: 1,
        roundTitle: 'TEST_ROUND_6C',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      })
    assert.equal(intRes.status, 201)
    interview = intRes.body.data
    assert.equal(interview.status, 'SCHEDULED')

    // D. Evaluate Interview (5-Point Rating Scorecard)
    const evalRes = await request(app)
      .post(`/api/v1/recruitment/interviews/${interview.id}/evaluate`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        technicalScore: 4,
        communicationScore: 5,
        culturalFitScore: 5,
        recommendation: 'STRONG_HIRE',
        strengths: 'Outstanding PostgreSQL indexing and Node.js async knowledge',
        notes: 'Highly recommended for backend lead team'
      })
    assert.equal(evalRes.status, 201)
    assert.equal(evalRes.body.data.recommendation, 'STRONG_HIRE')
    assert.equal(Number(evalRes.body.data.overallRating), 4.7)
  })

  it('3. Recruitment: Job Offer, Candidate Acceptance & Idempotent Canonical Employee Creation', async () => {
    // A. Create Job Offer
    const offerRes = await request(app)
      .post(`/api/v1/recruitment/applications/${application.id}/offers`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        offerNumber: 'OFF-6C-001',
        designationId: desig.id,
        offeredGrossSalary: 180000,
        offeredBaseSalary: 120000,
        proposedJoiningDate: '2026-12-01',
        probationMonths: 3
      })
    assert.equal(offerRes.status, 201)
    offer = offerRes.body.data
    assert.equal(offer.status, 'DRAFT')

    // B. Super Admin Approves Offer
    const reviewRes = await request(app)
      .patch(`/api/v1/recruitment/offers/${offer.id}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ action: 'APPROVE' })
    assert.equal(reviewRes.status, 200)
    assert.equal(reviewRes.body.data.status, 'APPROVED')

    // C. Candidate Accepts Offer
    const acceptRes = await request(app)
      .patch(`/api/v1/recruitment/offers/${offer.id}/accept`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ acceptedAt: '2026-11-04' })
    assert.equal(acceptRes.status, 200)
    assert.equal(acceptRes.body.data.status, 'ACCEPTED')

    // D. Explicit Hired Candidate Conversion to Canonical Employee
    const hireRes = await request(app)
      .post(`/api/v1/recruitment/candidates/${candidate.id}/hire`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        offerId: offer.id,
        departmentId: dept.id,
        employeeCode: 'EMP-6C-HIRED'
      })
    assert.equal(hireRes.status, 201)
    const hiredEmp = hireRes.body.data
    hiredEmployeeId = hiredEmp.id
    assert.equal(hiredEmp.employeeCode, 'EMP-6C-HIRED')
    assert.equal(hiredEmp.employmentStatus, 'PROBATION')

    // E. Verify NO User account was auto-created (security invariant)
    const linkedUser = await prisma.user.findFirst({ where: { employeeId: hiredEmp.id } })
    assert.equal(linkedUser, null, 'Employee creation must not automatically grant portal user account')

    // F. Verify Automatic Onboarding Checklist and 5 standard tasks
    const checklistRes = await request(app)
      .get(`/api/v1/recruitment/onboarding/${hiredEmp.id}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(checklistRes.status, 200)
    assert.equal(checklistRes.body.data.tasks.length, 5)

    // Complete one onboarding task
    const taskId = checklistRes.body.data.tasks[0].id
    const taskDoneRes = await request(app)
      .patch(`/api/v1/recruitment/onboarding/tasks/${taskId}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ isCompleted: true })
    assert.equal(taskDoneRes.status, 200)
    assert.equal(taskDoneRes.body.data.isCompleted, true)

    // G. Idempotency Check: Cannot convert candidate twice
    const secondHire = await request(app)
      .post(`/api/v1/recruitment/candidates/${candidate.id}/hire`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ offerId: offer.id })
    assert.equal(secondHire.status, 409)
    assert.equal(secondHire.body.error.code, 'ALREADY_CONVERTED')
  })

  // ============================================================================
  // 2. TASK MANAGEMENT
  // ============================================================================

  it('4. Task Management: Creation, Assignee Scoping, Overdue Detection & Activity Comments', async () => {
    // A. Manager assigns task to employee
    const taskRes = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        taskCode: 'TSK-6C-001',
        title: 'Implement Prisma 6C Integration',
        description: 'Verify relational joins and error handling',
        assigneeId: employee.id,
        priority: 'HIGH',
        dueDate: new Date(Date.now() - 3600000).toISOString(), // 1 hour in past -> Overdue!
        estimatedHours: 8.0
      })
    assert.equal(taskRes.status, 201)
    task = taskRes.body.data
    assert.equal(task.taskCode, 'TSK-6C-001')

    // B. Employee Scoping: Employee sees own task with isOverdue = true
    const empList = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(empList.status, 200)
    const myTask = empList.body.data.find((t) => t.id === task.id)
    assert.ok(myTask)
    assert.equal(myTask.isOverdue, true)

    // C. Add Comment to Task
    const cmtRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ commentText: 'Schema and route bindings are tested successfully' })
    assert.equal(cmtRes.status, 200)
    assert.equal(cmtRes.body.data.comments.length, 1)

    // D. Complete Task
    const updateRes = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ status: 'COMPLETED', actualHours: 7.5 })
    assert.equal(updateRes.status, 200)
    assert.equal(updateRes.body.data.status, 'COMPLETED')
    assert.ok(updateRes.body.data.completedAt)

    // E. Task Stats
    const statsRes = await request(app)
      .get('/api/v1/tasks/stats')
      .set('Authorization', `Bearer ${mgrToken}`)
    assert.equal(statsRes.status, 200)
    assert.ok(statsRes.body.data.total >= 1)
  })

  // ============================================================================
  // 3. PERFORMANCE MANAGEMENT
  // ============================================================================

  it('5. Performance Management: Cycle, KPIs, Self-Appraisal & Manager Evaluation with Anti-Self-Approval', async () => {
    // A. Super Admin creates cycle
    const cycRes = await request(app)
      .post('/api/v1/performance/cycles')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        cycleCode: 'CYC-6C-2026',
        title: 'Annual Performance Appraisal 2026',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'ACTIVE'
      })
    assert.equal(cycRes.status, 201)
    perfCycle = cycRes.body.data

    // B. Create KPI Goal
    const goalRes = await request(app)
      .post('/api/v1/performance/goals')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        cycleId: perfCycle.id,
        employeeId: employee.id,
        kpiTitle: 'Zero-downtime PostgreSQL DB Migrations',
        weightage: 30,
        targetMetric: '100% successful migrations'
      })
    assert.equal(goalRes.status, 201)
    perfGoal = goalRes.body.data

    // C. Update Goal Progress
    const progRes = await request(app)
      .patch(`/api/v1/performance/goals/${perfGoal.id}/progress`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ progressPercent: 100, achievedMetric: '100% completed' })
    assert.equal(progRes.status, 200)
    assert.equal(progRes.body.data.status, 'COMPLETED')

    // D. Initiate Review
    const initRes = await request(app)
      .post('/api/v1/performance/reviews/initiate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ cycleId: perfCycle.id, employeeId: employee.id, reviewerId: manager.id })
    assert.equal(initRes.status, 201)
    perfReview = initRes.body.data

    // E. Employee Submits Self-Appraisal
    const selfRes = await request(app)
      .post(`/api/v1/performance/reviews/${perfReview.id}/self`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        selfScore: 4.5,
        strengths: 'Architecture design and test automation',
        growthAreas: 'GraphQL and distributed caching'
      })
    assert.equal(selfRes.status, 200)
    assert.equal(selfRes.body.data.status, 'MANAGER_REVIEW')

    // F. Anti-Self-Approval: Manager cannot conduct manager evaluation on their own appraisal
    const mgrOwnReview = await prisma.performanceReview.create({
      data: {
        cycleId: perfCycle.id,
        employeeId: manager.id,
        status: 'MANAGER_REVIEW'
      }
    })
    const selfEval = await request(app)
      .post(`/api/v1/performance/reviews/${mgrOwnReview.id}/manager-review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ reviewerScore: 5.0, managerRecommendation: 'PROMOTION' })
    assert.equal(selfEval.status, 403)
    assert.equal(selfEval.body.error.code, 'SELF_APPROVAL_PROHIBITED')
    await prisma.performanceReview.delete({ where: { id: mgrOwnReview.id } }).catch(() => {})

    // G. Manager Submits Evaluation (Normalized: 30% self (4.5) + 70% manager (4.8) = 4.71 -> 4.7 -> OUTSTANDING)
    const mgrEval = await request(app)
      .post(`/api/v1/performance/reviews/${perfReview.id}/manager-review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        reviewerScore: 4.8,
        managerRecommendation: 'INCREMENT',
        strengths: 'Outstanding execution and code quality'
      })
    assert.equal(mgrEval.status, 200)
    assert.equal(mgrEval.body.data.status, 'COMPLETED')
    assert.equal(mgrEval.body.data.ratingCategory, 'OUTSTANDING')
    assert.equal(Number(mgrEval.body.data.finalNormalizedScore), 4.7)

    // H. Immutable Finalization: Cannot re-evaluate after finalization
    const lockedRes = await request(app)
      .post(`/api/v1/performance/reviews/${perfReview.id}/manager-review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ reviewerScore: 3.0 })
    assert.equal(lockedRes.status, 400)
    assert.equal(lockedRes.body.error.code, 'ALREADY_FINALIZED')
  })

  // ============================================================================
  // 4. TRAINING & DEVELOPMENT
  // ============================================================================

  it('6. Training & Development: Program Capacity, Duplicate Prevention & Passing Certification', async () => {
    // A. Create Training Program (Capacity = 1 for strict test)
    const progRes = await request(app)
      .post('/api/v1/training/programs')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        courseCode: 'TRN-6C-001',
        title: 'PostgreSQL Database Optimization & Indexing',
        trainerName: 'Dr. Tariq Database Architect',
        durationHours: 16.0,
        maxCapacity: 1,
        passingScore: 70,
        startDate: '2026-11-10',
        endDate: '2026-11-12'
      })
    assert.equal(progRes.status, 201)
    trainingProg = progRes.body.data

    // B. Enroll Employee
    const enrollRes = await request(app)
      .post(`/api/v1/training/programs/${trainingProg.id}/enroll`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ employeeId: employee.id })
    assert.equal(enrollRes.status, 201)
    enrollment = enrollRes.body.data
    assert.equal(enrollment.status, 'ENROLLED')

    // C. Duplicate Enrollment Rejection
    const dupEnroll = await request(app)
      .post(`/api/v1/training/programs/${trainingProg.id}/enroll`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ employeeId: employee.id })
    assert.equal(dupEnroll.status, 409)
    assert.equal(dupEnroll.body.error.code, 'ALREADY_ENROLLED')

    // D. Capacity Limit Rejection (manager cannot enroll because capacity = 1 is reached)
    const capRes = await request(app)
      .post(`/api/v1/training/programs/${trainingProg.id}/enroll`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ employeeId: manager.id })
    assert.equal(capRes.status, 400)
    assert.equal(capRes.body.error.code, 'CAPACITY_REACHED')

    // E. Record Attendance
    const attRes = await request(app)
      .post(`/api/v1/training/enrollments/${enrollment.id}/attendance`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ sessionsAttendedCount: 4 })
    assert.equal(attRes.status, 200)
    assert.equal(attRes.body.data.status, 'ATTENDED')

    // F. Assessment Passing -> Status COMPLETED & Unique Certificate Issued
    const passRes = await request(app)
      .post(`/api/v1/training/enrollments/${enrollment.id}/assessment`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ assessmentScore: 88 })
    assert.equal(passRes.status, 200)
    assert.equal(passRes.body.data.status, 'COMPLETED')
    assert.ok(passRes.body.data.certificateNumber)
    assert.ok(passRes.body.data.certificateNumber.startsWith('CERT-'))

    // G. Verify Employee Transcript
    const transcriptRes = await request(app)
      .get(`/api/v1/training/transcript/${employee.id}`)
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(transcriptRes.status, 200)
    assert.equal(transcriptRes.body.data.totalCompleted, 1)
    assert.equal(transcriptRes.body.data.certificates.length, 1)
  })

  // ============================================================================
  // 5. TRAVEL & EXPENSE MANAGEMENT
  // ============================================================================

  it('7. Travel & Expenses: Travel Approval, Itemized Claim, Anti-Self-Approval & Disbursement Integrity', async () => {
    // A. Submit Travel Request (with budget and advance amount)
    const trvRes = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        requestCode: 'TRV-6C-001',
        origin: 'Karachi HQ',
        destination: 'Islamabad Client Site',
        departureDate: '2026-11-20',
        returnDate: '2026-11-23',
        purpose: 'On-site enterprise deployment',
        estimatedBudget: 85000,
        advanceAmount: 30000
      })
    assert.equal(trvRes.status, 201)
    travelReq = trvRes.body.data

    // Anti-Self-Approval on Travel Request
    const selfTrv = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${travelReq.id}/review`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ action: 'APPROVE' })
    assert.equal(selfTrv.status, 403)

    // Manager Approves Travel Request
    const trvApprove = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${travelReq.id}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ action: 'APPROVE', decisionRemarks: 'Client trip approved' })
    assert.equal(trvApprove.status, 200)
    assert.equal(trvApprove.body.data.status, 'APPROVED')

    // Attach Booking PNR
    const pnrRes = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${travelReq.id}/booking`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ bookingReferencePnr: 'PK-AIR-88992' })
    assert.equal(pnrRes.status, 200)
    assert.equal(pnrRes.body.data.bookingReferencePnr, 'PK-AIR-88992')

    // B. Issue Transport Pass
    const passRes = await request(app)
      .post('/api/v1/expenses/transport/passes')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        passNumber: 'PASS-6C-001',
        employeeId: employee.id,
        routeName: 'Route 4 - Gulshan to Shahrah-e-Faisal',
        pickupPoint: 'Moti Mahal',
        dropoffPoint: 'Main Office Tower',
        shiftTiming: '09:00 AM - 06:00 PM',
        monthlyContribution: 2500
      })
    assert.equal(passRes.status, 201)
    transportPass = passRes.body.data

    // C. Submit Expense Claim with Multiple Items & Decimal Precision
    // Total: Flight (45,000) + Hotel (25,000) + Meals (8,500) = 78,500 PKR
    // Advance settlement = 30,000 PKR -> Net payable = 48,500 PKR
    const claimRes = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        claimNumber: 'EXP-6C-001',
        claimTitle: 'Islamabad Client Deployment Travel Settlement',
        travelRequestId: travelReq.id,
        items: [
          { category: 'TRANSPORT', amount: 45000, expenseDate: '2026-11-20', merchantName: 'AirBlue' },
          { category: 'LODGING', amount: 25000, expenseDate: '2026-11-21', merchantName: 'Serena Hotel' },
          { category: 'MEALS', amount: 8500, expenseDate: '2026-11-22', merchantName: 'Monal Restaurant' }
        ]
      })
    assert.equal(claimRes.status, 201)
    expenseClaim = claimRes.body.data
    assert.equal(Number(expenseClaim.totalAmount), 78500)
    assert.equal(Number(expenseClaim.advanceSettlementAmount), 30000)
    assert.equal(Number(expenseClaim.netPayableAmount), 48500)
    assert.equal(expenseClaim.status, 'SUBMITTED')

    // D. Anti-Self-Approval on Expense Claim Review
    const selfClaim = await request(app)
      .patch(`/api/v1/expenses/claims/${expenseClaim.id}/review`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ action: 'APPROVE' })
    assert.equal(selfClaim.status, 403)

    // Manager Approves Claim -> Status MANAGER_APPROVED (NOT PAID!)
    const claimApprove = await request(app)
      .patch(`/api/v1/expenses/claims/${expenseClaim.id}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ action: 'APPROVE', remarks: 'Receipts verified' })
    assert.equal(claimApprove.status, 200)
    assert.equal(claimApprove.body.data.status, 'MANAGER_APPROVED')
    assert.equal(claimApprove.body.data.disbursedAt, null, 'Approval is NOT payment disbursement')

    // E. Payment Disbursement with Validation & Duplicate Guard
    // Future date prohibited
    const futureDisburse = await request(app)
      .post(`/api/v1/expenses/claims/${expenseClaim.id}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'TRX-EXP-8899',
        paymentDate: '2099-01-01'
      })
    assert.equal(futureDisburse.status, 400)

    // Valid Disbursement
    const disburseRes = await request(app)
      .post(`/api/v1/expenses/claims/${expenseClaim.id}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'TRX-EXP-8899',
        paymentDate: '2026-11-04'
      })
    assert.equal(disburseRes.status, 200)
    assert.equal(disburseRes.body.data.status, 'DISBURSED')
    assert.ok(disburseRes.body.data.disbursedAt)
    assert.equal(disburseRes.body.data.transactionReference, 'TRX-EXP-8899')

    // Duplicate Disbursement Guard
    const dupDisburse = await request(app)
      .post(`/api/v1/expenses/claims/${expenseClaim.id}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'TRX-EXP-8899-DUP',
        paymentDate: '2026-11-04'
      })
    assert.equal(dupDisburse.status, 400)
    assert.equal(dupDisburse.body.error.code, 'NOT_APPROVED')
  })

  // ============================================================================
  // 6. REPORTS & ANALYTICS
  // ============================================================================

  it('8. Reports & Analytics: PostgreSQL Real Aggregates & Confidential Payroll Scoping', async () => {
    // A. Headcount Report
    const headRes = await request(app)
      .get('/api/v1/reports/headcount')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(headRes.status, 200)
    assert.ok(headRes.body.data.totalEmployees >= 2)
    assert.ok(Array.isArray(headRes.body.data.departmentBreakdown))

    // B. Recruitment Funnel Report
    const recRes = await request(app)
      .get('/api/v1/reports/recruitment')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(recRes.status, 200)
    assert.ok(recRes.body.data.totalApplications >= 1)
    assert.ok(recRes.body.data.hiredEmployees >= 1)

    // C. Task Productivity Report
    const taskRepRes = await request(app)
      .get('/api/v1/reports/tasks')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(taskRepRes.status, 200)
    assert.ok(taskRepRes.body.data.totalTasks >= 1)

    // D. Expense Summary Report
    const expRepRes = await request(app)
      .get('/api/v1/reports/expenses')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(expRepRes.status, 200)
    assert.ok(expRepRes.body.data.totalClaims >= 1)
    assert.ok(expRepRes.body.data.totalReimbursedAmount >= 48500)

    // E. Confidential Payroll Report Scoping
    // Super Admin can access
    const saPayroll = await request(app)
      .get('/api/v1/reports/payroll')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(saPayroll.status, 200)
    assert.equal(saPayroll.body.data.currency, 'PKR')

    // Employee is blocked with 403 Forbidden (prevent salary leakage)
    const empPayroll = await request(app)
      .get('/api/v1/reports/payroll')
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(empPayroll.status, 403)
  })

  // ============================================================================
  // 7. ADMINISTRATION & SETTINGS
  // ============================================================================

  it('9. Administration: Settings Upsert, Protected Super Admin Safeguards & Password Reset', async () => {
    // A. Update Organization Setting
    const setRes = await request(app)
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        companyName: 'iSysware Technologies Ltd.',
        ntnNumber: 'NTN-9988221',
        supportEmail: 'support@isysware.com'
      })
    assert.equal(setRes.status, 200)
    assert.equal(setRes.body.data.companyName, 'iSysware Technologies Ltd.')
    assert.equal(setRes.body.data.ntnNumber, 'NTN-9988221')

    // B. List Portal Users
    const usersRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(usersRes.status, 200)
    assert.ok(Array.isArray(usersRes.body.data))

    // C. Protected Super Admin Safeguard: Cannot deactivate protected super admin
    const protUser = await prisma.user.create({
      data: {
        username: 'usr_6c_protected_root',
        email: 'root.prot.6c@isysware.com',
        passwordHash: 'dummy',
        role: 'SUPER_ADMIN',
        isActive: true,
        isProtected: true
      }
    })

    const deactProt = await request(app)
      .patch(`/api/v1/admin/users/${protUser.id}/status`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ isActive: false })
    assert.equal(deactProt.status, 403)
    assert.equal(deactProt.body.error.code, 'PROTECTED_ADMIN_IMMUTABLE')

    // D. Admin Password Reset: Invalidate sessions & update hash
    const resetRes = await request(app)
      .post(`/api/v1/admin/users/${empUser.id}/reset-password`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ newPassword: 'BrandNewSecurePassword123!' })
    assert.equal(resetRes.status, 200)

    // Cleanup protected test user
    await prisma.user.delete({ where: { id: protUser.id } }).catch(() => {})

    // E. Security Audit Log Retrieval
    const auditRes = await request(app)
      .get('/api/v1/admin/audit-logs?limit=10')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(auditRes.status, 200)
    assert.ok(Array.isArray(auditRes.body.data))
    assert.ok(auditRes.body.meta)
    assert.ok(auditRes.body.meta.total >= 1)
  })
})
