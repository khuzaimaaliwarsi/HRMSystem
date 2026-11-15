/**
 * iSysware HRMS — Task Management API Routes
 */

import { Router } from 'express'
import taskService from '../services/taskService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()
router.use(authenticate)

// Task stats / dashboard overview
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await taskService.getTaskStats(req.user)
    return sendSuccess(res, stats)
  } catch (err) { next(err) }
})

// Authorized deleted/cancelled task audit history
router.get('/history', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const history = await taskService.getTaskHistory(req.user)
    return sendSuccess(res, history)
  } catch (err) { next(err) }
})

// List tasks (role-scoped)
router.get('/', async (req, res, next) => {
  try {
    const tasks = await taskService.getTasks(req.query, req.user)
    return sendSuccess(res, tasks)
  } catch (err) { next(err) }
})

// Get single task
router.get('/:id', async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id, req.user)
    return sendSuccess(res, task)
  } catch (err) { next(err) }
})

// Create task
router.post('/', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.body, req.user)
    return sendSuccess(res, task, { message: 'Task assigned successfully' }, 201)
  } catch (err) { next(err) }
})

// Submit task at 100% for Manager/Admin review
router.post('/:id/submit-review', async (req, res, next) => {
  try {
    const updated = await taskService.submitForReview(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Task submitted for review at 100% progress' })
  } catch (err) { next(err) }
})

// Verify and mark task Completed (or return for revision)
router.patch('/:id/verify', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const updated = await taskService.verifyTaskCompletion(req.params.id, req.body, req.user, {
      ipAddress: req.ip
    })
    return sendSuccess(res, updated, { message: 'Task verification status updated' })
  } catch (err) { next(err) }
})

// Cancel department-scoped task (Department Manager, HR Admin, Super Admin)
router.patch('/:id/cancel', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const cancelled = await taskService.cancelTask(req.params.id, req.body?.reason, req.user, {
      ipAddress: req.ip
    })
    return sendSuccess(res, cancelled, { message: 'Task cancelled successfully' })
  } catch (err) { next(err) }
})

// Update task
router.patch('/:id', async (req, res, next) => {
  try {
    const updated = await taskService.updateTask(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Task updated successfully' })
  } catch (err) { next(err) }
})

// Soft-delete / archive task (Super Admin & HR Admin only)
router.delete('/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const reason = req.body?.reason ?? req.query?.reason
    const deleted = await taskService.deleteTask(req.params.id, reason, req.user, {
      ipAddress: req.ip
    })
    return sendSuccess(res, deleted, { message: 'Task archived and removed from active list' })
  } catch (err) { next(err) }
})

// Add comment to task
router.post('/:id/comments', async (req, res, next) => {
  try {
    const updated = await taskService.addComment(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Comment added' })
  } catch (err) { next(err) }
})

export default router

