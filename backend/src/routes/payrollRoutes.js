/**
 * iSysware HRMS — Payroll & Compensation API Routes
 * Endpoints for salary structures, salary revisions, monthly payroll runs,
 * approvals, disbursements, payslips, and executive summaries.
 */

import { Router } from 'express'
import compensationService from '../services/compensationService.js'
import payrollService from '../services/payrollService.js'
import loanService from '../services/loanService.js'
import { payrollTaxService } from '../services/payrollTaxService.js'
import { authenticate, requireRoles, requireEmployeeScope } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()

router.use(authenticate)

// ==============================================================================
// 1. COMPENSATION & SALARY STRUCTURES
// ==============================================================================

/**
 * GET /api/v1/payroll/structures
 * Lists salary structures with role-based privacy scoping.
 */
router.get('/structures', async (req, res, next) => {
  try {
    const list = await compensationService.getSalaryStructures(req.query, req.user)
    return sendSuccess(res, list, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/structures/:employeeId
 * Retrieves salary structures and history for an employee.
 */
router.get('/structures/:employeeId', requireEmployeeScope((req) => req.params.employeeId), async (req, res, next) => {
  try {
    const data = await compensationService.getSalaryStructureByEmployeeId(req.params.employeeId, req.user)
    return sendSuccess(res, data, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/structures
 * Creates or updates an employee salary structure.
 */
router.post('/structures', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const structure = await compensationService.createSalaryStructure(req.body, req.user.id)
    return sendSuccess(res, structure, { message: 'Salary structure assigned successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/revisions
 * Lists salary revision proposals.
 */
router.get('/revisions', async (req, res, next) => {
  try {
    const revisions = await compensationService.getSalaryRevisions(req.query, req.user)
    return sendSuccess(res, revisions, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/revisions
 * Proposes a new salary revision.
 */
router.post('/revisions', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const actorId = req.user?.id || req.body?.actorUserId || 'cmw316bzw000fu8noerxd49tc'
    const revision = await compensationService.proposeSalaryRevision(req.body, actorId, req.user)
    return sendSuccess(res, revision, { message: 'Salary revision proposed successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/payroll/revisions/:id/review
 * Approves or rejects a proposed salary revision (Super Admin only).
 */
router.patch('/revisions/:id/review', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const reviewed = await compensationService.reviewSalaryRevision(
      req.params.id,
      req.body.decision,
      req.user,
      req.body.remarks
    )
    return sendSuccess(res, reviewed, { message: `Salary revision ${req.body.decision.toLowerCase()} successfully` }, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 1B. CORPORATE ALLOWANCE MASTER & EMPLOYEE ALLOCATIONS
// ==============================================================================

/**
 * GET /api/v1/payroll/allowances
 * Lists corporate allowance master definitions.
 */
router.get('/allowances', async (req, res, next) => {
  try {
    const list = await compensationService.getAllowances(req.query)
    return sendSuccess(res, list, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/allowances/:id
 * Retrieves single allowance definition.
 */
router.get('/allowances/:id', async (req, res, next) => {
  try {
    const allowance = await compensationService.getAllowanceById(req.params.id)
    return sendSuccess(res, allowance, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/allowances
 * Creates a corporate allowance category.
 */
router.post('/allowances', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const created = await compensationService.createAllowance(req.body, req.user.id)
    return sendSuccess(res, created, { message: 'Allowance category created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /api/v1/payroll/allowances/:id
 * Updates an allowance category.
 */
router.put('/allowances/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await compensationService.updateAllowance(req.params.id, req.body, req.user.id)
    return sendSuccess(res, updated, { message: 'Allowance category updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/v1/payroll/allowances/:id
 * Deactivates an allowance category.
 */
router.delete('/allowances/:id', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const deleted = await compensationService.deleteAllowance(req.params.id, req.user.id)
    return sendSuccess(res, deleted, { message: 'Allowance category deactivated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/employee-allowances
 * Lists employee allowance allocations with role-based scoping.
 */
router.get('/employee-allowances', async (req, res, next) => {
  try {
    const list = await compensationService.getEmployeeAllowances(req.query, req.user)
    return sendSuccess(res, list, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/employee-allowances/:employeeId
 * Retrieves allowance allocations for a specific employee.
 */
router.get('/employee-allowances/:employeeId', requireEmployeeScope((req) => req.params.employeeId), async (req, res, next) => {
  try {
    const list = await compensationService.getEmployeeAllowances({ employeeId: req.params.employeeId, ...req.query }, req.user)
    return sendSuccess(res, list, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/employee-allowances
 * Allocates an allowance to an employee.
 */
router.post('/employee-allowances', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const allocation = await compensationService.assignEmployeeAllowance(req.body, req.user)
    return sendSuccess(res, allocation, { message: 'Allowance allocated to employee successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /api/v1/payroll/employee-allowances/:id
 * Updates an employee allowance allocation.
 */
router.put('/employee-allowances/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await compensationService.updateEmployeeAllowance(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Employee allowance allocation updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/v1/payroll/employee-allowances/:id
 * Revokes/deactivates an employee allowance allocation.
 */
router.delete('/employee-allowances/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const reason = req.body?.reason || req.body?.remarks || ''
    const revoked = await compensationService.revokeEmployeeAllowance(req.params.id, req.user, reason)
    return sendSuccess(res, revoked, { message: 'Employee allowance allocation revoked successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 2. PAYROLL PERIODS
// ==============================================================================

/**
 * GET /api/v1/payroll/periods
 * Lists payroll periods.
 */
router.get('/periods', async (req, res, next) => {
  try {
    const periods = await payrollService.getPayrollPeriods(req.query)
    return sendSuccess(res, periods, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/periods
 * Creates a new payroll period.
 */
router.post('/periods', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const period = await payrollService.createPayrollPeriod(req.body)
    return sendSuccess(res, period, { message: 'Payroll period created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 3. PAYROLL RUNS & PROCESSING
// ==============================================================================

/**
 * GET /api/v1/payroll/runs
 * Lists payroll runs.
 */
router.get('/runs', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const runs = await payrollService.getPayrollRuns(req.query)
    return sendSuccess(res, runs, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/runs/:id
 * Retrieves full details and breakdown of a specific payroll run.
 */
router.get('/runs/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const run = await payrollService.getPayrollRunById(req.params.id)
    return sendSuccess(res, run, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/runs/generate
 * Generates a draft payroll run with attendance, leave, overtime, and tax calculations.
 */
router.post('/runs/generate', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const run = await payrollService.generateDraftPayrollRun(req.body.periodCode, req.user)
    return sendSuccess(res, run, { message: 'Draft payroll run generated successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/payroll/runs/:id/submit
 * Submits draft payroll run for Super Admin approval.
 */
router.patch('/runs/:id/submit', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const run = await payrollService.submitPayrollRun(req.params.id, req.user)
    return sendSuccess(res, run, { message: 'Payroll run submitted for approval' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/payroll/runs/:id/approve
 * Approves payroll run and freezes calculation snapshots (Super Admin only).
 */
router.patch('/runs/:id/approve', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const approved = await payrollService.approvePayrollRun(req.params.id, req.user)
    return sendSuccess(res, approved, { message: 'Payroll run approved successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/payroll/runs/:id/disburse
 * Disburses approved payroll run and marks paymentStatus = 'PAID'.
 */
router.patch('/runs/:id/disburse', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const disbursed = await payrollService.disbursePayrollRun(req.params.id, req.user, req.body)
    return sendSuccess(res, disbursed, { message: 'Payroll disbursed and marked as PAID' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/runs/:id/refresh
 * Recalculates DRAFT payroll run against canonical PostgreSQL records.
 * Supports preview diff (?preview=true or body.preview=true) without mutations.
 * Preserves the exact same Payroll Run ID and Run Number.
 */
router.post('/runs/:id/refresh', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const isPreview = req.query.preview === 'true' || req.body?.preview === true
    const refreshed = await payrollService.refreshDraftPayrollRun(req.params.id, req.user, {
      preview: isPreview,
      reason: req.body?.reason
    })
    return sendSuccess(res, refreshed, { message: isPreview ? 'Refresh draft preview calculated' : 'Draft payroll run refreshed successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/payroll/runs/:runId/entries/:entryId/approve
 * Approves an individual employee payroll entry.
 */
router.patch('/runs/:runId/entries/:entryId/approve', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await payrollService.approvePayrollEntry(req.params.runId, req.params.entryId, req.user, req.body?.remarks)
    return sendSuccess(res, result, { message: result.message }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/payroll/runs/:runId/entries/:entryId/reject
 * Rejects an individual employee payroll entry.
 */
router.patch('/runs/:runId/entries/:entryId/reject', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await payrollService.rejectPayrollEntry(req.params.runId, req.params.entryId, req.body?.reason, req.user)
    return sendSuccess(res, result, { message: result.message }, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 4. EMPLOYEE LOANS & SALARY ADVANCES
// ==============================================================================

router.get('/loans', async (req, res, next) => {
  try {
    const loans = await loanService.getLoans(req.query, req.user)
    return sendSuccess(res, loans, undefined, 200)
  } catch (err) {
    next(err)
  }
})

router.get('/loans/:id', async (req, res, next) => {
  try {
    const loan = await loanService.getLoanById(req.params.id, req.user)
    return sendSuccess(res, loan, undefined, 200)
  } catch (err) {
    next(err)
  }
})

router.post('/loans', async (req, res, next) => {
  try {
    const targetEmployeeId = ['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role) && req.body.employeeId
      ? req.body.employeeId
      : req.user.employee?.id

    const loan = await loanService.applyLoan(targetEmployeeId, req.body)
    return sendSuccess(res, loan, { message: 'Loan application submitted successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

router.patch('/loans/:id/review', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const reviewed = await loanService.reviewLoan(
      req.params.id,
      req.body.decision,
      req.user,
      req.body.remarks
    )
    return sendSuccess(res, reviewed, { message: `Loan ${req.body.decision.toLowerCase()} successfully` }, 200)
  } catch (err) {
    next(err)
  }
})

router.post('/loans/:id/disburse', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const disbursed = await loanService.disburseLoan(req.params.id, req.user, req.body)
    return sendSuccess(res, disbursed, { message: 'Loan disbursed successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

router.post('/loans/:id/repay', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const repayment = await loanService.recordRepayment(
      req.params.id,
      req.body.amount,
      'DIRECT_PAYMENT',
      null,
      req.body.notes
    )
    return sendSuccess(res, repayment, { message: 'Loan repayment recorded successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/runs/:id/void
 * Voids an un-disbursed payroll run.
 */
router.post('/runs/:id/void', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const voided = await payrollService.voidPayrollRun(req.params.id, req.user, req.body.reason)
    return sendSuccess(res, voided, { message: 'Payroll run voided successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/runs/:id/reconcile
 * Safely voids an invalid/stale draft (preserving audit history) and regenerates a canonical draft.
 */
router.post('/runs/:id/reconcile', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const result = await payrollService.reconcilePayrollRun(req.params.id, req.user, req.body?.reason)
    return sendSuccess(res, result, { message: 'Payroll run reconciled and regenerated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/runs/:id/bank-advice
 * Server-validated bank transfer advice. Blocks DRAFT, PENDING_APPROVAL, VOID, and unreconciled runs.
 */
router.get('/runs/:id/bank-advice', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const strictExport = req.query.strict === 'true'
    const advice = await payrollService.getBankAdvice(req.params.id, req.user, { strictExport })
    return sendSuccess(res, advice, undefined, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 4. PAYSLIPS & REPORTING
// ==============================================================================

/**
 * GET /api/v1/payroll/payslips
 * Lists payslips (filtered for Employee self-service to own records).
 */
router.get('/payslips', async (req, res, next) => {
  try {
    const payslips = await payrollService.getPayslips(req.query, req.user)
    return sendSuccess(res, payslips, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/payslips/:id
 * Retrieves individual payslip breakdown.
 */
router.get('/payslips/:id', async (req, res, next) => {
  try {
    const payslip = await payrollService.getPayslipById(req.params.id, req.user)
    return sendSuccess(res, payslip, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/summary/:periodCode
 * Retrieves executive payroll summary for period.
 */
router.get('/summary/:periodCode', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const summary = await payrollService.getPayrollSummary(req.params.periodCode, req.user)
    return sendSuccess(res, summary, undefined, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 6. MANUAL PAYROLL TAX SETTINGS & STATUTORY COMPLIANCE
// ==============================================================================

/**
 * GET /api/v1/payroll/tax-config
 * Retrieves current manual payroll tax configuration and change history.
 */
router.get('/tax-config', async (req, res, next) => {
  try {
    const config = await payrollTaxService.getTaxConfig()
    return sendSuccess(res, config, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /api/v1/payroll/tax-config
 * Authoritative Super Admin configuration for manual payroll tax policy.
 */
router.put('/tax-config', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const updated = await payrollTaxService.updateTaxConfig(req.body, req.user)
    return sendSuccess(res, updated, { message: 'Payroll tax configuration updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/payroll/runs/:id/recalculate-tax
 * Recalculates tax deductions for DRAFT or PENDING_APPROVAL payroll runs.
 * Historical Approved, Paid, and Void runs are strictly immutable.
 */
router.post('/runs/:id/recalculate-tax', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updatedRun = await payrollService.recalculateDraftTax(req.params.id, req.user)
    return sendSuccess(res, updatedRun, { message: 'Payroll tax recalculated and snapshot recorded' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/payroll/tax-compliance/:periodCode
 * Retrieves statutory FBR Section 149 obligation vs actual tax withheld variance.
 */
router.get('/tax-compliance/:periodCode', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), async (req, res, next) => {
  try {
    const compliance = await payrollTaxService.getTaxComplianceSummary(req.params.periodCode)
    return sendSuccess(res, compliance, undefined, 200)
  } catch (err) {
    next(err)
  }
})

export default router

