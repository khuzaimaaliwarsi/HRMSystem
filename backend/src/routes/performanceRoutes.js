/**
 * iSysware HRMS — Performance Management API Routes
 */

import { Router } from 'express'
import performanceService from '../services/performanceService.js'
import feedbackDevelopmentService from '../services/feedbackDevelopmentService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()
router.use(authenticate)

// 1. Cycles
router.get('/cycles', async (req, res, next) => {
  try {
    const cycles = await performanceService.getCycles(req.query)
    return sendSuccess(res, cycles)
  } catch (err) { next(err) }
})

router.post('/cycles', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const cycle = await performanceService.createCycle(req.body, req.user.id)
    return sendSuccess(res, cycle, { message: 'Performance cycle created' }, 201)
  } catch (err) { next(err) }
})

router.patch('/cycles/:id/status', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const cycle = await performanceService.updateCycleStatus(req.params.id, req.body.status)
    return sendSuccess(res, cycle, { message: 'Cycle status updated' })
  } catch (err) { next(err) }
})

// 2. Goals & KPIs
router.get('/goals', async (req, res, next) => {
  try {
    const goals = await performanceService.getGoals(req.query, req.user)
    return sendSuccess(res, goals)
  } catch (err) { next(err) }
})

router.post('/goals', async (req, res, next) => {
  try {
    const goal = await performanceService.createGoal(req.body, req.user)
    return sendSuccess(res, goal, { message: 'Performance goal created' }, 201)
  } catch (err) { next(err) }
})

router.patch('/goals/:id/progress', async (req, res, next) => {
  try {
    const goal = await performanceService.updateGoalProgress(req.params.id, req.body, req.user)
    return sendSuccess(res, goal, { message: 'Goal progress updated' })
  } catch (err) { next(err) }
})

router.get('/kpis', async (req, res, next) => {
  try {
    const kpis = await performanceService.getKpis(req.query, req.user)
    return sendSuccess(res, kpis)
  } catch (err) {
    next(err)
  }
})

router.post(
  '/kpis',
  requireRoles('SUPER_ADMIN', 'HR_ADMIN'),
  async (req, res, next) => {
    try {
      const kpi = await performanceService.createKpi(
        req.body,
        req.user
      )
      return sendSuccess(
        res,
        kpi,
        { message: 'Department KPI created' },
        201
      )
    } catch (err) {
      next(err)
    }
  }
)

// 3. Reviews & Appraisals
router.get('/reviews', async (req, res, next) => {
  try {
    const reviews = await performanceService.getReviews(req.query, req.user)
    return sendSuccess(res, reviews)
  } catch (err) { next(err) }
})

router.get('/reviews/:id', async (req, res, next) => {
  try {
    const review = await performanceService.getReviewById(req.params.id, req.user)
    return sendSuccess(res, review)
  } catch (err) { next(err) }
})

router.post('/reviews/initiate', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const review = await performanceService.initiateReview(req.body, req.user)
    return sendSuccess(res, review, { message: 'Performance review initiated' }, 201)
  } catch (err) { next(err) }
})

router.post('/reviews/:id/self', async (req, res, next) => {
  try {
    const review = await performanceService.submitSelfReview(req.params.id, req.body, req.user)
    return sendSuccess(res, review, { message: 'Self-appraisal submitted' })
  } catch (err) { next(err) }
})

router.post('/reviews/:id/manager-review', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const review = await performanceService.submitManagerReview(req.params.id, req.body, req.user)
    return sendSuccess(res, review, { message: 'Manager evaluation submitted and review finalized' })
  } catch (err) { next(err) }
})

router.post('/reviews/:id/hr-moderate', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const review = await performanceService.hrModerateReview(req.params.id, req.body, req.user)
    return sendSuccess(res, review, { message: 'HR moderation saved' })
  } catch (err) { next(err) }
})

router.post('/reviews/:id/finalize', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const review = await performanceService.finalizeReview(req.params.id, req.user)
    return sendSuccess(res, review, { message: 'Performance review finalized and locked' })
  } catch (err) { next(err) }
})

router.post('/reviews/:id/acknowledge', async (req, res, next) => {
  try {
    const review = await performanceService.acknowledgeReview(req.params.id, req.user)
    return sendSuccess(res, review, { message: 'Performance appraisal acknowledged' })
  } catch (err) { next(err) }
})

// 4. Employee Feedback
router.get('/feedback', async (req, res, next) => {
  try {
    const rows = await feedbackDevelopmentService.getFeedbacks(req.query, req.user)
    return sendSuccess(res, rows)
  } catch (err) { next(err) }
})

router.get('/feedback/:id', async (req, res, next) => {
  try {
    const row = await feedbackDevelopmentService.getFeedbackById(req.params.id, req.user)
    return sendSuccess(res, row)
  } catch (err) { next(err) }
})

router.post(
  '/feedback',
  requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'),
  async (req, res, next) => {
    try {
      const created = await feedbackDevelopmentService.createFeedback(req.body, req.user)
      return sendSuccess(res, created, { message: 'Employee feedback recorded' }, 201)
    } catch (err) { next(err) }
  }
)

router.patch(
  '/feedback/:id',
  requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'),
  async (req, res, next) => {
    try {
      const updated = await feedbackDevelopmentService.updateFeedback(req.params.id, req.body, req.user)
      return sendSuccess(res, updated, { message: 'Feedback updated' })
    } catch (err) { next(err) }
  }
)

router.post('/feedback/:id/acknowledge', async (req, res, next) => {
  try {
    const updated = await feedbackDevelopmentService.acknowledgeFeedback(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Feedback acknowledged' })
  } catch (err) { next(err) }
})

// 5. Individual Development Plans (IDP) & Performance Improvement Plans (PIP)
router.get('/development-plans', async (req, res, next) => {
  try {
    const plans = await feedbackDevelopmentService.getDevelopmentPlans(req.query, req.user)
    return sendSuccess(res, plans)
  } catch (err) { next(err) }
})

router.get('/development-plans/:id', async (req, res, next) => {
  try {
    const plan = await feedbackDevelopmentService.getDevelopmentPlanById(req.params.id, req.user)
    return sendSuccess(res, plan)
  } catch (err) { next(err) }
})

router.post(
  '/development-plans',
  requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'),
  async (req, res, next) => {
    try {
      const created = await feedbackDevelopmentService.createDevelopmentPlan(req.body, req.user)
      return sendSuccess(
        res,
        created,
        { message: `${created.planCategory === 'PIP' ? 'Performance Improvement Plan' : 'Development Plan'} created` },
        201
      )
    } catch (err) { next(err) }
  }
)

router.patch('/development-plans/:id', async (req, res, next) => {
  try {
    const updated = await feedbackDevelopmentService.updateDevelopmentPlan(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Plan updated' })
  } catch (err) { next(err) }
})

router.patch('/development-plans/:id/checkpoints/:index/toggle', async (req, res, next) => {
  try {
    const updated = await feedbackDevelopmentService.togglePlanCheckpoint(req.params.id, req.params.index, req.user)
    return sendSuccess(res, updated, { message: 'Checkpoint progress updated' })
  } catch (err) { next(err) }
})

router.post(
  '/development-plans/:id/evaluate',
  requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'),
  async (req, res, next) => {
    try {
      const updated = await feedbackDevelopmentService.addPlanEvaluation(req.params.id, req.body, req.user)
      return sendSuccess(res, updated, { message: 'Evaluation recorded' })
    } catch (err) { next(err) }
  }
)

router.post('/development-plans/:id/acknowledge', async (req, res, next) => {
  try {
    const updated = await feedbackDevelopmentService.acknowledgeDevelopmentPlan(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Plan acknowledged by employee' })
  } catch (err) { next(err) }
})

router.post(
  '/development-plans/:id/close',
  requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'),
  async (req, res, next) => {
    try {
      const updated = await feedbackDevelopmentService.closeDevelopmentPlan(req.params.id, req.body, req.user)
      return sendSuccess(res, updated, { message: 'Plan closure approved' })
    } catch (err) { next(err) }
  }
)

export default router

