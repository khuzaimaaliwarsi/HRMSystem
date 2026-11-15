/**
 * iSysware HRMS — Training & Development API Routes
 */

import { Router } from 'express'
import trainingService from '../services/trainingService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()
router.use(authenticate)

// 1. Course Catalog & Programs
router.get('/programs', async (req, res, next) => {
  try {
    const list = await trainingService.getPrograms(req.query)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.get('/programs/:id', async (req, res, next) => {
  try {
    const program = await trainingService.getProgramById(req.params.id)
    return sendSuccess(res, program)
  } catch (err) { next(err) }
})

router.post('/programs', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const program = await trainingService.createProgram(req.body, req.user)
    return sendSuccess(res, program, { message: 'Training program created' }, 201)
  } catch (err) { next(err) }
})

router.patch('/programs/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const program = await trainingService.updateProgram(req.params.id, req.body, req.user)
    return sendSuccess(res, program, { message: 'Training program updated' })
  } catch (err) { next(err) }
})

router.post('/programs/:id/archive', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const program = await trainingService.archiveProgram(req.params.id, req.user)
    return sendSuccess(res, program, { message: 'Training program archived' })
  } catch (err) { next(err) }
})

router.post('/programs/:id/toggle-status', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const program = await trainingService.toggleProgramStatus(req.params.id, req.user)
    return sendSuccess(res, program, { message: 'Training program status updated' })
  } catch (err) { next(err) }
})

// 2. Training Plans & Skill-Gap Recommendations
router.get('/plans', async (req, res, next) => {
  try {
    const list = await trainingService.getPlans(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/plans', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const plan = await trainingService.createTrainingPlan(req.body, req.user)
    return sendSuccess(res, plan, { message: 'Training plan submitted' }, 201)
  } catch (err) { next(err) }
})

router.post('/plans/:id/approve', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const plan = await trainingService.approveTrainingPlan(req.params.id, req.body, req.user)
    return sendSuccess(res, plan, { message: 'Training plan approved' })
  } catch (err) { next(err) }
})

router.post('/plans/:id/reject', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const plan = await trainingService.rejectTrainingPlan(req.params.id, req.body, req.user)
    return sendSuccess(res, plan, { message: 'Training plan rejected' })
  } catch (err) { next(err) }
})

// 3. Cohorts & Training Scheduling / Sessions
router.get('/sessions', async (req, res, next) => {
  try {
    const list = await trainingService.getSessions(req.query)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/sessions', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const session = await trainingService.scheduleSession(req.body, req.user)
    return sendSuccess(res, session, { message: 'Training session scheduled' }, 201)
  } catch (err) { next(err) }
})

router.patch('/sessions/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const session = await trainingService.updateSession(req.params.id, req.body, req.user)
    return sendSuccess(res, session, { message: 'Training session updated' })
  } catch (err) { next(err) }
})

router.post('/sessions/:id/attendance', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const records = req.body.attendanceRecords || req.body.records || req.body
    const session = await trainingService.recordSessionAttendance(req.params.id, records, req.user)
    return sendSuccess(res, session, { message: 'Session attendance recorded' })
  } catch (err) { next(err) }
})

router.post('/sessions/:id/complete', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const session = await trainingService.markSessionCompleted(req.params.id, req.user)
    return sendSuccess(res, session, { message: 'Training session completed' })
  } catch (err) { next(err) }
})

router.post('/sessions/:id/cancel', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const session = await trainingService.cancelSession(req.params.id, req.body?.reason, req.user)
    return sendSuccess(res, session, { message: 'Training session cancelled' })
  } catch (err) { next(err) }
})

// 4. Enrollments, Progress & Assessments
router.get('/enrollments', async (req, res, next) => {
  try {
    const list = await trainingService.getEnrollments(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/enrollments', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const enrollment = await trainingService.enrollEmployee(
      req.body.programId,
      req.body.employeeId,
      req.user,
      { sessionId: req.body.sessionId }
    )
    return sendSuccess(res, enrollment, { message: 'Employee enrolled in training' }, 201)
  } catch (err) { next(err) }
})

router.post('/programs/:id/enroll', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const enrollment = await trainingService.enrollEmployee(
      req.params.id,
      req.body.employeeId,
      req.user,
      { sessionId: req.body.sessionId }
    )
    return sendSuccess(res, enrollment, { message: 'Employee enrolled in training' }, 201)
  } catch (err) { next(err) }
})

router.patch('/enrollments/:id/progress', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const enrollment = await trainingService.updateEnrollmentProgress(req.params.id, req.body, req.user)
    return sendSuccess(res, enrollment, { message: 'Learning progress updated' })
  } catch (err) { next(err) }
})

router.post('/enrollments/:id/attendance', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const enrollment = await trainingService.recordAttendance(req.params.id, req.body.sessionsAttendedCount, req.user)
    return sendSuccess(res, enrollment, { message: 'Attendance recorded' })
  } catch (err) { next(err) }
})

router.post('/enrollments/:id/assessment', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const enrollment = await trainingService.recordAssessment(req.params.id, req.body, req.user)
    return sendSuccess(res, enrollment, { message: 'Assessment recorded & outcome updated' })
  } catch (err) { next(err) }
})

// 5. Verified Certificates Register & Transcripts
router.get('/certificates', async (req, res, next) => {
  try {
    const list = await trainingService.getCertificates(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.get('/certificates/verify/:code', async (req, res, next) => {
  try {
    const result = await trainingService.verifyCertificate(req.params.code)
    return sendSuccess(res, result)
  } catch (err) { next(err) }
})

router.get('/transcript/:employeeId', async (req, res, next) => {
  try {
    const transcript = await trainingService.getEmployeeTranscript(req.params.employeeId, req.user)
    return sendSuccess(res, transcript)
  } catch (err) { next(err) }
})

export default router
