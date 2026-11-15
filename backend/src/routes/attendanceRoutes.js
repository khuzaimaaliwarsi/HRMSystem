/**
 * iSysware HRMS — Attendance, Regularization, Overtime, WFH & Field Duty API Routes
 * Mounts check-in/out, register, corrections, overtime, and remote work workflows.
 */

import { Router } from 'express'
import attendanceService from '../services/attendanceService.js'
import regularizationService from '../services/regularizationService.js'
import overtimeService from '../services/overtimeService.js'
import wfhFieldDutyService from '../services/wfhFieldDutyService.js'
import { authenticate, requireRoles, requireEmployeeScope, requireLinkedEmployee } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()

router.use(authenticate)

function resolveTargetEmployeeId(req) {
  // If employeeId is provided in body and caller has elevated role, allow admin proxy
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

// ==============================================================================
// 1. WEB PUNCH & REGISTER
// ==============================================================================

/**
 * POST /api/v1/attendance/check-in
 * Records employee check-in and punch IN event
 */
router.post('/check-in', async (req, res, next) => {
  try {
    const employeeId = resolveTargetEmployeeId(req)
    const result = await attendanceService.checkIn(
      employeeId,
      req.body.punchTime,
      req.body.source || 'WEB',
      {
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'],
        workArrangement: req.body.workArrangement,
        notes: req.body.notes
      }
    )
    return sendSuccess(res, result, undefined, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/attendance/check-out
 * Records employee check-out and punch OUT event
 */
router.post('/check-out', async (req, res, next) => {
  try {
    const employeeId = resolveTargetEmployeeId(req)
    const result = await attendanceService.checkOut(
      employeeId,
      req.body.punchTime,
      req.body.source || 'WEB',
      {
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'],
        notes: req.body.notes
      }
    )
    return sendSuccess(res, result, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/attendance/register
 * Returns Attendance Register for a given date with SHIFT-ISOLATION-01 compliance
 */
router.get('/register', async (req, res, next) => {
  try {
    const register = await attendanceService.getAttendanceRegister(
      req.query.date,
      req.query,
      req.user
    )
    return sendSuccess(res, register, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/attendance/history/:employeeId
 * Returns attendance and punch history for a specific employee
 */
router.get('/history/:employeeId', requireEmployeeScope((req) => req.params.employeeId), async (req, res, next) => {
  try {
    const history = await attendanceService.getEmployeeAttendance(
      req.params.employeeId,
      req.query.startDate,
      req.query.endDate,
      req.user
    )
    return sendSuccess(res, history, undefined, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 2. ATTENDANCE REGULARIZATION / CORRECTIONS
// ==============================================================================

router.post(['/corrections', '/regularizations'], async (req, res, next) => {
  try {
    const employeeId = resolveTargetEmployeeId(req)
    const correction = await regularizationService.requestCorrection(employeeId, req.body)
    return sendSuccess(res, correction, { message: 'Correction request submitted' }, 201)
  } catch (err) {
    next(err)
  }
})

router.patch(['/corrections/:id/review', '/regularizations/:id/review'], requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const reviewed = await regularizationService.reviewCorrection(
      req.params.id,
      req.body.decision,
      req.user,
      req.body.remarks
    )
    return sendSuccess(res, reviewed, { message: `Correction ${req.body.decision.toLowerCase()}` }, 200)
  } catch (err) {
    next(err)
  }
})

router.get(['/corrections', '/regularizations'], async (req, res, next) => {
  try {
    const corrections = await regularizationService.getCorrections(req.query, req.user)
    return sendSuccess(res, corrections, undefined, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 3. OVERTIME REQUESTS
// ==============================================================================

router.post('/overtime', async (req, res, next) => {
  try {
    const employeeId = resolveTargetEmployeeId(req)
    const ot = await overtimeService.requestOvertime(employeeId, req.body)
    return sendSuccess(res, ot, { message: 'Overtime request submitted' }, 201)
  } catch (err) {
    next(err)
  }
})

router.patch('/overtime/:id/review', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const reviewed = await overtimeService.reviewOvertime(
      req.params.id,
      req.body.decision,
      req.user,
      req.body.remarks
    )
    return sendSuccess(res, reviewed, { message: `Overtime ${req.body.decision.toLowerCase()}` }, 200)
  } catch (err) {
    next(err)
  }
})

router.get('/overtime', async (req, res, next) => {
  try {
    const list = await overtimeService.getOvertimeRequests(req.query, req.user)
    return sendSuccess(res, list, undefined, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 4. WORK FROM HOME (WFH)
// ==============================================================================

router.post('/wfh', async (req, res, next) => {
  try {
    const employeeId = resolveTargetEmployeeId(req)
    const wfh = await wfhFieldDutyService.requestWfh(employeeId, req.body)
    return sendSuccess(res, wfh, { message: 'WFH request submitted' }, 201)
  } catch (err) {
    next(err)
  }
})

router.patch('/wfh/:id/review', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const reviewed = await wfhFieldDutyService.reviewWfh(
      req.params.id,
      req.body.decision,
      req.user,
      req.body.remarks
    )
    return sendSuccess(res, reviewed, { message: `WFH ${req.body.decision.toLowerCase()}` }, 200)
  } catch (err) {
    next(err)
  }
})

router.get('/wfh', async (req, res, next) => {
  try {
    const list = await wfhFieldDutyService.getWfhRequests(req.query, req.user)
    return sendSuccess(res, list, undefined, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 5. FIELD DUTY
// ==============================================================================

router.post('/field-duty', async (req, res, next) => {
  try {
    const employeeId = resolveTargetEmployeeId(req)
    const fd = await wfhFieldDutyService.requestFieldDuty(employeeId, req.body)
    return sendSuccess(res, fd, { message: 'Field duty request submitted' }, 201)
  } catch (err) {
    next(err)
  }
})

router.patch('/field-duty/:id/review', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const reviewed = await wfhFieldDutyService.reviewFieldDuty(
      req.params.id,
      req.body.decision,
      req.user,
      req.body.remarks
    )
    return sendSuccess(res, reviewed, { message: `Field duty ${req.body.decision.toLowerCase()}` }, 200)
  } catch (err) {
    next(err)
  }
})

router.get('/field-duty', async (req, res, next) => {
  try {
    const list = await wfhFieldDutyService.getFieldDutyRequests(req.query, req.user)
    return sendSuccess(res, list, undefined, 200)
  } catch (err) {
    next(err)
  }
})

export default router

