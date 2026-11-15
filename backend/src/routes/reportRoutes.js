/**
 * iSysware HRMS — Reports & Analytics API Routes
 */

import { Router } from 'express'
import reportService from '../services/reportService.js'
import { authenticate } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()
router.use(authenticate)

router.get('/headcount', async (req, res, next) => {
  try {
    const report = await reportService.getHeadcountReport(req.query, req.user)
    return sendSuccess(res, report)
  } catch (err) { next(err) }
})

router.get('/attendance', async (req, res, next) => {
  try {
    const report = await reportService.getAttendanceReport(req.query, req.user)
    return sendSuccess(res, report)
  } catch (err) { next(err) }
})

router.get('/leaves', async (req, res, next) => {
  try {
    const report = await reportService.getLeaveReport(req.query, req.user)
    return sendSuccess(res, report)
  } catch (err) { next(err) }
})

router.get('/overtime-remote', async (req, res, next) => {
  try {
    const report = await reportService.getOvertimeRemoteReport(req.query, req.user)
    return sendSuccess(res, report)
  } catch (err) { next(err) }
})

router.get('/payroll/:periodCode?', async (req, res, next) => {
  try {
    const report = await reportService.getPayrollReport(req.params.periodCode, req.user)
    return sendSuccess(res, report)
  } catch (err) { next(err) }
})

router.get('/recruitment', async (req, res, next) => {
  try {
    const report = await reportService.getRecruitmentFunnel(req.query)
    return sendSuccess(res, report)
  } catch (err) { next(err) }
})

router.get('/tasks', async (req, res, next) => {
  try {
    const report = await reportService.getTaskProductivity(req.user)
    return sendSuccess(res, report)
  } catch (err) { next(err) }
})

router.get('/expenses', async (req, res, next) => {
  try {
    const report = await reportService.getExpenseSummary(req.user)
    return sendSuccess(res, report)
  } catch (err) { next(err) }
})

export default router

