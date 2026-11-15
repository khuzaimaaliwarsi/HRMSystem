/**
 * iSysware HRMS — Leave Management API Routes
 * Leave types, policies, entitlements, annual threshold routing, approvals, and cancellations.
 */

import { Router } from 'express'
import leaveService from '../services/leaveService.js'
import { authenticate, requireRoles, requireEmployeeScope } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()

router.use(authenticate)

function resolveTargetEmployeeId(req) {
  if (req.body?.employeeId && ['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role)) {
    return req.body.employeeId
  }
  const selfEmpId = req.user.employee?.id || req.user.employeeId
  if (!selfEmpId && !req.body?.employeeId) {
    const error = new Error('Employee Self-Service actions are restricted to accounts linked to an active employee record.')
    error.status = 403
    error.code = 'UNLINKED_PORTAL_ACCOUNT'
    throw error
  }
  return selfEmpId || req.body?.employeeId
}

/**
 * GET /api/v1/leaves/types
 * List leave types
 */
router.get('/types', async (req, res, next) => {
  try {
    const types = await leaveService.getLeaveTypes(req.query)
    return sendSuccess(res, types, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/leaves/types
 * Create leave type master
 */
router.post('/types', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const type = await leaveService.createLeaveType(req.body)
    return sendSuccess(res, type, { message: 'Leave type created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/leaves/entitlements
 * List all leave entitlements across organization
 */
router.get('/entitlements', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const entitlements = await leaveService.getAllEntitlements(req.query)
    return sendSuccess(res, entitlements, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/leaves/entitlements/:employeeId
 * Get leave entitlements for employee
 */
router.get('/entitlements/:employeeId', requireEmployeeScope((req) => req.params.employeeId), async (req, res, next) => {
  try {
    const entitlements = await leaveService.getEmployeeEntitlements(
      req.params.employeeId,
      req.query.year
    )
    return sendSuccess(res, entitlements, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/leaves/entitlements
 * Set or adjust leave entitlement for employee
 */
router.post('/entitlements', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const entitlement = await leaveService.setEmployeeEntitlement(
      req.body.employeeId,
      req.body.leaveTypeId,
      req.body.year || new Date().getFullYear(),
      req.body.allocatedDays
    )
    return sendSuccess(res, entitlement, { message: 'Entitlement updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/leaves/apply
 * Applies for leave
 */
router.post('/apply', async (req, res, next) => {
  try {
    const employeeId = resolveTargetEmployeeId(req)
    const request = await leaveService.applyLeave(employeeId, req.body)
    return sendSuccess(res, request, { message: 'Leave request submitted successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/leaves/:id/review
 * Approves or rejects a leave request
 */
router.patch('/:id/review', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const reviewed = await leaveService.reviewLeave(
      req.params.id,
      req.body.decision,
      req.user,
      req.body.remarks
    )
    return sendSuccess(res, reviewed, { message: `Leave request ${req.body.decision.toLowerCase()}` }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/leaves/:id/cancel
 * Cancels a leave request and posts journal reversal
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const cancelled = await leaveService.cancelLeave(
      req.params.id,
      req.user.id,
      req.body.reason || 'User cancelled'
    )
    return sendSuccess(res, cancelled, { message: 'Leave request cancelled successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/leaves/requests
 * List leave requests
 */
router.get('/requests', async (req, res, next) => {
  try {
    const requests = await leaveService.getLeaveRequests(req.query, req.user)
    return sendSuccess(res, requests, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/leaves/calendar
 * Calendar view of approved leaves and public holidays
 */
router.get('/calendar', async (req, res, next) => {
  try {
    const calendar = await leaveService.getLeaveCalendar(req.query.year, req.query.month)
    return sendSuccess(res, calendar, undefined, 200)
  } catch (err) {
    next(err)
  }
})

export default router

