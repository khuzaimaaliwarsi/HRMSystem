/**
 * iSysware HRMS — Recruitment & Onboarding API Routes
 */

import { Router } from 'express'
import recruitmentService from '../services/recruitmentService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()
router.use(authenticate)

// 1. Requisitions
router.get('/requisitions', async (req, res, next) => {
  try {
    const list = await recruitmentService.getRequisitions(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/requisitions', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const item = await recruitmentService.createRequisition(req.body, req.user)
    return sendSuccess(res, item, { message: 'Job requisition created' }, 201)
  } catch (err) { next(err) }
})

router.patch('/requisitions/:id/review', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const reviewed = await recruitmentService.reviewRequisition(req.params.id, req.body, req.user)
    return sendSuccess(res, reviewed, { message: 'Requisition review processed' })
  } catch (err) { next(err) }
})

router.patch('/requisitions/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const updated = await recruitmentService.updateRequisition(req.params.id, req.body, req.user.id)
    return sendSuccess(res, updated, { message: 'Requisition updated successfully' })
  } catch (err) { next(err) }
})

router.delete('/requisitions/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await recruitmentService.deleteRequisition(req.params.id)
    return sendSuccess(res, result, { message: 'Requisition deleted successfully' })
  } catch (err) { next(err) }
})

// 2. Job Openings
router.get('/openings', async (req, res, next) => {
  try {
    const list = await recruitmentService.getJobOpenings(req.query)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.get('/openings/:id', async (req, res, next) => {
  try {
    const opening = await recruitmentService.getJobOpeningById(req.params.id)
    return sendSuccess(res, opening)
  } catch (err) { next(err) }
})

router.post('/openings', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const item = await recruitmentService.createJobOpening(req.body, req.user.id)
    return sendSuccess(res, item, { message: 'Job opening published' }, 201)
  } catch (err) { next(err) }
})

router.patch('/openings/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await recruitmentService.updateJobOpening(req.params.id, req.body, req.user.id)
    return sendSuccess(res, updated, { message: 'Job opening updated' })
  } catch (err) { next(err) }
})

router.delete('/openings/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await recruitmentService.deleteJobOpening(req.params.id)
    return sendSuccess(res, result, { message: 'Job opening deleted successfully' })
  } catch (err) { next(err) }
})

// 3. Candidates
router.get('/candidates', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const list = await recruitmentService.getCandidates(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.get('/candidates/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const candidate = await recruitmentService.getCandidateById(req.params.id, req.user)
    return sendSuccess(res, candidate)
  } catch (err) { next(err) }
})

router.post('/candidates', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const item = await recruitmentService.createCandidate(req.body, req.user.id)
    return sendSuccess(res, item, { message: 'Candidate registered successfully' }, 201)
  } catch (err) { next(err) }
})

router.delete('/candidates/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await recruitmentService.deleteCandidate(req.params.id)
    return sendSuccess(res, result, { message: 'Candidate removed successfully' })
  } catch (err) { next(err) }
})

router.get('/candidates/:id/notes', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const notes = await recruitmentService.getCandidateNotes(req.params.id, req.user)
    return sendSuccess(res, notes)
  } catch (err) { next(err) }
})

router.post('/candidates/:id/notes', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const note = await recruitmentService.addCandidateNote(req.params.id, req.body, req.user)
    return sendSuccess(res, note, { message: 'Internal note recorded successfully' }, 201)
  } catch (err) { next(err) }
})

// 4. Applications & Pipeline
router.post('/openings/:id/apply', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const app = await recruitmentService.applyJob(req.params.id, req.body.candidateId, req.body.stageNotes)
    return sendSuccess(res, app, { message: 'Application submitted' }, 201)
  } catch (err) { next(err) }
})

router.patch('/applications/:id/status', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const app = await recruitmentService.updateApplicationStatus(req.params.id, req.body.status, req.body.stageNotes, req.user.id)
    return sendSuccess(res, app, { message: 'Pipeline stage updated' })
  } catch (err) { next(err) }
})

// 5. Interviews & Evaluation
router.post('/applications/:id/interviews', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const interview = await recruitmentService.scheduleInterview(req.params.id, req.body, req.user.id)
    return sendSuccess(res, interview, { message: 'Interview scheduled' }, 201)
  } catch (err) { next(err) }
})

router.post('/interviews/:id/evaluate', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const evalResult = await recruitmentService.evaluateInterview(req.params.id, req.body, req.user.id)
    return sendSuccess(res, evalResult, { message: 'Interview evaluation submitted' }, 201)
  } catch (err) { next(err) }
})

router.get('/interviews', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const list = await recruitmentService.getInterviews(req.query)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

// 6. Job Offers
router.get('/offers', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const list = await recruitmentService.getJobOffers(req.query)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/applications/:id/offers', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const offer = await recruitmentService.createJobOffer(req.params.id, req.body, req.user.id)
    return sendSuccess(res, offer, { message: 'Job offer drafted' }, 201)
  } catch (err) { next(err) }
})

router.patch('/offers/:id/review', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const offer = await recruitmentService.reviewJobOffer(req.params.id, req.body, req.user.id)
    return sendSuccess(res, offer, { message: 'Offer review saved' })
  } catch (err) { next(err) }
})

router.patch('/offers/:id/accept', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const offer = await recruitmentService.acceptJobOffer(req.params.id, req.body.acceptedAt)
    return sendSuccess(res, offer, { message: 'Candidate accepted offer' })
  } catch (err) { next(err) }
})

// 7. Hire Candidate -> Canonical Employee
router.post('/candidates/:id/hire', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await recruitmentService.hireCandidateToEmployee(req.params.id, req.body, req.user.id)
    return sendSuccess(res, result.employee, { message: result.message, checklistId: result.checklistId }, 201)
  } catch (err) { next(err) }
})

// 8. Onboarding
router.get('/onboarding/:employeeId', async (req, res, next) => {
  try {
    const checklist = await recruitmentService.getOnboardingChecklist(req.params.employeeId, req.user)
    return sendSuccess(res, checklist)
  } catch (err) { next(err) }
})

router.patch('/onboarding/tasks/:taskId', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const task = await recruitmentService.updateOnboardingTask(req.params.taskId, req.body, req.user.id)
    return sendSuccess(res, task, { message: 'Onboarding task updated' })
  } catch (err) { next(err) }
})

export default router
