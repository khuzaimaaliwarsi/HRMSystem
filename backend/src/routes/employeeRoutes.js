/**
 * iSysware HRMS — Employee Management API Routes
 * CRUD, directory search, lateral transfers, promotions, status updates, and documents.
 */

import { Router } from 'express'
import employeeService from '../services/employeeService.js'
import { authenticate, requireRoles, requireEmployeeScope } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()

// All employee routes require authentication
router.use(authenticate)

/**
 * GET /api/v1/employees
 * Lists employees with role-aware scoping, search and pagination.
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await employeeService.getEmployees(req.query, req.user)
    return sendSuccess(res, result.employees, result.pagination, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/employees
 * Creates a new canonical employee profile.
 */
router.post('/', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const employee = await employeeService.createEmployee(req.body, req.user?.id)
    return sendSuccess(res, employee, { message: 'Employee created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/employees/:id
 * Retrieves full employee profile with sensitive data masking.
 */
router.get('/:id', requireEmployeeScope((req) => req.params.id), async (req, res, next) => {
  try {
    const employee = await employeeService.getEmployeeById(req.params.id, req.user)
    return sendSuccess(res, employee, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/employees/:id
 * Updates personal & contact details of an employee.
 */
router.patch('/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await employeeService.updateEmployee(req.params.id, req.body, req.user?.id)
    return sendSuccess(res, updated, { message: 'Employee profile updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/employees/:id/transfer
 * Lateral transfer across department, sub-department, or team.
 * Strict invariant: Never mutates compensation.
 */
router.post('/:id/transfer', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const transferred = await employeeService.transferEmployee(req.params.id, req.body, req.user?.id)
    return sendSuccess(res, transferred, { message: 'Employee transfer executed successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/employees/:id/promote
 * Upgrades designation.
 * Strict invariant: Never silently mutates salary.
 */
router.post('/:id/promote', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const promoted = await employeeService.promoteEmployee(req.params.id, req.body, req.user?.id)
    return sendSuccess(res, promoted, { message: 'Employee promotion executed successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/employees/:id/status
 * Updates employment status (e.g. NOTICE_PERIOD, RESIGNED, TERMINATED).
 */
router.patch('/:id/status', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const { status, reason } = req.body
    const updated = await employeeService.updateStatus(req.params.id, status, reason, req.user?.id)
    return sendSuccess(res, updated, { message: `Employee status updated to ${status}` }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/employees/:id/career-history
 * Returns career movement audit trail for an employee.
 */
router.get('/:id/career-history', requireEmployeeScope((req) => req.params.id), async (req, res, next) => {
  try {
    const history = await employeeService.getCareerHistory(req.params.id)
    return sendSuccess(res, history, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/employees/:id/documents
 * Lists document metadata for an employee.
 */
router.get('/:id/documents', requireEmployeeScope((req) => req.params.id), async (req, res, next) => {
  try {
    const documents = await employeeService.getDocuments(req.params.id)
    return sendSuccess(res, documents, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/employees/:id/documents
 * Records metadata for an uploaded employee document.
 */
router.post('/:id/documents', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const doc = await employeeService.addDocument(req.params.id, req.body, req.user?.id)
    return sendSuccess(res, doc, { message: 'Document record added successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/employees/documents/:documentId/verify
 * Marks document verified by HR/Admin.
 */
router.patch('/documents/:documentId/verify', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const verified = await employeeService.verifyDocument(req.params.documentId, req.user?.id)
    return sendSuccess(res, verified, { message: 'Document marked verified' }, 200)
  } catch (err) {
    next(err)
  }
})

export default router

