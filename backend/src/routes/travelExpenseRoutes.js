/**
 * iSysware HRMS — Travel, Logistics & Expense Management API Routes
 */

import { Router } from 'express'
import travelExpenseService from '../services/travelExpenseService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()
router.use(authenticate)

// ============================================================================
// 1. OFFICIAL TRAVEL REQUESTS & APPROVALS
// ============================================================================

router.get('/travel/requests', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getTravelRequests(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/travel/requests', async (req, res, next) => {
  try {
    const item = await travelExpenseService.createTravelRequest(req.body, req.user)
    const msg = item.status === 'DRAFT' ? 'Travel request saved as draft' : 'Travel request submitted'
    return sendSuccess(res, item, { message: msg }, 201)
  } catch (err) { next(err) }
})

router.patch('/travel/requests/:id', async (req, res, next) => {
  try {
    const item = await travelExpenseService.updateTravelRequest(req.params.id, req.body, req.user)
    const msg = item.status === 'DRAFT' ? 'Travel draft updated' : 'Travel request updated'
    return sendSuccess(res, item, { message: msg })
  } catch (err) { next(err) }
})

router.post('/travel/requests/:id/submit', async (req, res, next) => {
  try {
    const item = await travelExpenseService.submitTravelRequest(req.params.id, req.body || {}, req.user)
    const msg = item.status === 'APPROVED' ? 'Travel request directly authorized' : 'Travel request submitted for approval'
    return sendSuccess(res, item, { message: msg })
  } catch (err) { next(err) }
})

router.patch('/travel/requests/:id/review', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const item = await travelExpenseService.reviewTravelRequest(req.params.id, req.body, req.user)
    return sendSuccess(res, item, { message: 'Travel request review saved' })
  } catch (err) { next(err) }
})

router.post('/travel/requests/:id/cancel', async (req, res, next) => {
  try {
    const item = await travelExpenseService.cancelTravelRequest(req.params.id, req.user)
    return sendSuccess(res, item, { message: 'Travel request cancelled' })
  } catch (err) { next(err) }
})

router.patch('/travel/requests/:id/booking', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const item = await travelExpenseService.attachBookingPnr(req.params.id, req.body.bookingReferencePnr, req.user)
    return sendSuccess(res, item, { message: 'Booking details attached' })
  } catch (err) { next(err) }
})

// ============================================================================
// 2. TRAVEL PLANS & BOOKINGS
// ============================================================================

router.get('/travel/plans', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getTravelPlans(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/travel/plans', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const plan = await travelExpenseService.createTravelPlan(req.body, req.user)
    return sendSuccess(res, plan, { message: 'Travel plan created' }, 201)
  } catch (err) { next(err) }
})

router.patch('/travel/plans/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const plan = await travelExpenseService.updateTravelPlan(req.params.id, req.body, req.user)
    return sendSuccess(res, plan, { message: 'Travel plan updated' })
  } catch (err) { next(err) }
})

router.patch('/travel/plans/:id/status', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const plan = await travelExpenseService.updateTravelPlanStatus(req.params.id, req.body.status, req.user)
    return sendSuccess(res, plan, { message: 'Travel plan status updated' })
  } catch (err) { next(err) }
})

// ============================================================================
// 3. TRAVEL ADVANCES & INCURRED EXPENSE RECONCILIATION
// ============================================================================

router.get('/travel/advances', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getTravelAdvancesLedger(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.get('/travel/reconciliations', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getTravelExpenseReconciliations(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/travel/requests/:id/disburse-advance', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await travelExpenseService.disburseTravelAdvance(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Travel advance disbursed' })
  } catch (err) { next(err) }
})

router.post('/travel/requests/:id/receipts', async (req, res, next) => {
  try {
    const updated = await travelExpenseService.submitTravelExpenseReceipts(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Travel expense receipts recorded' })
  } catch (err) { next(err) }
})

router.post('/travel/requests/:id/reconcile', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await travelExpenseService.reconcileTravelExpense(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Travel expense reconciled' })
  } catch (err) { next(err) }
})

// ============================================================================
// 4. PICK-AND-DROP MANAGEMENT & FLEET MASTER (VEHICLES, DRIVERS, ROUTES)
// ============================================================================

router.get('/transport/vehicles', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getVehicles()
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/transport/vehicles', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const item = await travelExpenseService.saveVehicle(req.body, req.user)
    return sendSuccess(res, item, { message: 'Fleet vehicle saved' }, req.body.id || req.body.vehicleId ? 200 : 201)
  } catch (err) { next(err) }
})

router.get('/transport/drivers', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getDrivers()
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/transport/drivers', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const item = await travelExpenseService.saveDriver(req.body, req.user)
    return sendSuccess(res, item, { message: 'Fleet driver saved' }, req.body.id || req.body.driverId ? 200 : 201)
  } catch (err) { next(err) }
})

router.get('/transport/routes', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getRoutes()
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/transport/routes', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const item = await travelExpenseService.saveRoute(req.body, req.user)
    return sendSuccess(res, item, { message: 'Transport route saved' }, req.body.id || req.body.routeId ? 200 : 201)
  } catch (err) { next(err) }
})

router.get('/transport/assignments', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getTransportAssignments(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/transport/assignments', async (req, res, next) => {
  try {
    const item = await travelExpenseService.requestPickAndDrop(req.body, req.user)
    return sendSuccess(res, item, { message: 'Pick-and-drop request created' }, 201)
  } catch (err) { next(err) }
})

router.patch('/transport/assignments/:id', async (req, res, next) => {
  try {
    const item = await travelExpenseService.updateTransportAssignment(req.params.id, req.body, req.user)
    return sendSuccess(res, item, { message: 'Transport assignment updated' })
  } catch (err) { next(err) }
})

router.patch('/transport/assignments/:id/status', async (req, res, next) => {
  try {
    const item = await travelExpenseService.updateTransportAssignmentStatus(req.params.id, req.body.status, req.user)
    return sendSuccess(res, item, { message: 'Transport assignment status updated' })
  } catch (err) { next(err) }
})

// Legacy Transport Passes (preserved for Batch 6C API compatibility)
router.get('/transport/passes', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getTransportPasses(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.post('/transport/passes', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const pass = await travelExpenseService.createTransportPass(req.body, req.user.id)
    return sendSuccess(res, pass, { message: 'Transport pass issued' }, 201)
  } catch (err) { next(err) }
})

// ============================================================================
// 5. TRAVEL & TRANSPORT AUDIT LOGS
// ============================================================================

router.get('/travel/audit-logs', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getTravelAuditLogs(req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

// ============================================================================
// 6. EXPENSE CLAIMS & CATEGORIES (PRESERVED FOR BATCH 6C / 7A)
// ============================================================================

router.get('/claims', async (req, res, next) => {
  try {
    const list = await travelExpenseService.getExpenseClaims(req.query, req.user)
    return sendSuccess(res, list)
  } catch (err) { next(err) }
})

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await travelExpenseService.getExpenseCategories()
    return sendSuccess(res, categories)
  } catch (err) { next(err) }
})

router.get('/policies', async (req, res, next) => {
  try {
    const policies = await travelExpenseService.getExpensePolicies()
    return sendSuccess(res, policies)
  } catch (err) { next(err) }
})

router.get('/audit-logs', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const logs = await travelExpenseService.getExpenseAuditLogs(req.user, req.query)
    const pagination = logs.pagination || { total: logs.length, page: 1, limit: logs.length, totalPages: 1 }
    return sendSuccess(res, logs, { pagination })
  } catch (err) { next(err) }
})

router.post('/categories', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const cat = await travelExpenseService.createExpenseCategory(req.body, req.user)
    return sendSuccess(res, cat, { message: 'Expense category created successfully' }, 201)
  } catch (err) { next(err) }
})

router.patch('/categories/:code', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const cat = await travelExpenseService.updateExpenseCategory(req.params.code, req.body, req.user)
    return sendSuccess(res, cat, { message: 'Expense category updated successfully' })
  } catch (err) { next(err) }
})

router.delete('/categories/:code', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const result = await travelExpenseService.deleteExpenseCategory(req.params.code, req.user)
    return sendSuccess(res, result, { message: 'Expense category deleted successfully' })
  } catch (err) { next(err) }
})

router.get('/claims/:id', async (req, res, next) => {
  try {
    const claim = await travelExpenseService.getExpenseClaimById(req.params.id, req.user)
    return sendSuccess(res, claim)
  } catch (err) { next(err) }
})

router.post('/claims', async (req, res, next) => {
  try {
    const claim = await travelExpenseService.createExpenseClaim(req.body, req.user)
    return sendSuccess(res, claim, { message: 'Expense claim submitted' }, 201)
  } catch (err) { next(err) }
})

router.patch('/claims/:id/review', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const claim = await travelExpenseService.reviewExpenseClaim(req.params.id, req.body, req.user)
    return sendSuccess(res, claim, { message: 'Expense claim reviewed' })
  } catch (err) { next(err) }
})

router.post('/claims/:id/disburse', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const claim = await travelExpenseService.disburseReimbursement(req.params.id, req.body, req.user)
    return sendSuccess(res, claim, { message: 'Expense reimbursement successfully disbursed and recorded' })
  } catch (err) { next(err) }
})

router.post('/claims/:id/reverse', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const claim = await travelExpenseService.reverseReimbursement(req.params.id, req.body, req.user)
    return sendSuccess(res, claim, { message: 'Expense reimbursement reversed with audit trail' })
  } catch (err) { next(err) }
})

export default router
