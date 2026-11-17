/**
 * iSysware HRMS — Shift Management API Routes
 * Master shifts, assignments, and canonical effective-date shift resolution.
 */

import { Router } from 'express'
import shiftService from '../services/shiftService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()

router.use(authenticate)

/**
 * GET /api/v1/shifts
 * List all shifts
 */
router.get('/', async (req, res, next) => {
  try {
    const shifts = await shiftService.getShifts(req.query)
    return sendSuccess(res, shifts, undefined, 200)
  } catch (err) {
    next(err)
  }
})


/**
 * GET /api/v1/shifts/assignments
 * List persisted employee shift assignments
 */
router.get('/assignments', async (req, res, next) => {
  try {
    const assignments = await shiftService.getShiftAssignments(req.query)
    return sendSuccess(res, assignments, undefined, 200)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const shift = await shiftService.getShiftById(req.params.id)
    return sendSuccess(res, shift, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/shifts
 * Create new shift master
 */
router.post('/', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const shift = await shiftService.createShift(req.body)
    return sendSuccess(res, shift, { message: 'Shift created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/shifts/:id
 * Update shift master
 */
router.patch('/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const shift = await shiftService.updateShift(req.params.id, req.body)
    return sendSuccess(res, shift, { message: 'Shift updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/v1/shifts/:id
 * Delete shift master
 */
router.delete('/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await shiftService.deleteShift(req.params.id)
    return sendSuccess(res, result, { message: result.message }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/shifts/assignments/team/preview
 * Preview team shift assignment and detect overlapping assignments
 */
router.post('/assignments/team/preview', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const preview = await shiftService.previewTeamShiftAssignment(req.body)
    return sendSuccess(res, preview, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/shifts/assignments/team
 * Transactionally assign shift to entire team roster
 */
router.post('/assignments/team', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await shiftService.assignShiftToTeam(req.body, req.user?.id)
    return sendSuccess(res, result, { message: `Shift assigned to team ${result.teamName} (${result.assignedCount} employees)` }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/shifts/assignments/team/preview
 * Preview team shift assignment and detect overlapping assignments
 */
router.post('/assignments/team/preview', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const preview = await shiftService.previewTeamShiftAssignment(req.body)
    return sendSuccess(res, preview, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/shifts/assignments/team
 * Transactionally assign shift to entire team roster
 */
router.post('/assignments/team', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await shiftService.assignShiftToTeam(req.body, req.user?.id)
    return sendSuccess(res, result, { message: `Shift assigned to team ${result.teamName} (${result.assignedCount} employees)` }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/shifts/assignments
 * Assign shift to employee with effective dates
 */
router.post('/assignments', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const assignment = await shiftService.assignShift(req.body, req.user?.id)
    return sendSuccess(res, assignment, { message: 'Shift assigned successfully' }, 201)
  } catch (err) {
    next(err)
  }
})



/**
 * PATCH /api/v1/shifts/assignments/:id
 * Update shift assignment effective dates and properties
 */
router.patch('/assignments/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await shiftService.updateShiftAssignment(req.params.id, req.body, req.user?.id)
    return sendSuccess(res, updated, { message: 'Shift assignment updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/shifts/resolve/:employeeId
 * Resolves active shift for employee on specific date
 */
router.get('/resolve/:employeeId', async (req, res, next) => {
  try {
    const resolved = await shiftService.resolveEmployeeShift(req.params.employeeId, req.query.date)
    return sendSuccess(res, resolved, undefined, 200)
  } catch (err) {
    next(err)
  }
})

export default router

