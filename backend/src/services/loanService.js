/**
 * iSysware HRMS — Employee Loans & Salary Advances Service
 * Handles formal loan applications, multi-tier approvals, disbursement,
 * and automated payroll deduction repayments with full balance ledger history.
 */

import { prisma } from '../config/database.js'
import { Prisma } from '@prisma/client'
import adminSettingsService from './adminSettingsService.js'

export const loanService = {
  /**
   * Retrieves loans with privacy and role scoping.
   */
  async getLoans(filters = {}, requestingUser = null) {
    const where = {}
    if (filters.status && filters.status !== 'all') {
      const s = String(filters.status).toUpperCase()
      const normalizedStatus = s.includes('PENDING') ? 'PENDING'
        : s.includes('APPROV') ? 'APPROVED'
        : s.includes('DISBURS') || s.includes('ACTIVE') ? 'DISBURSED'
        : s.includes('REJECT') ? 'REJECTED'
        : s.includes('REPAID') || s.includes('CLOSE') ? 'REPAID'
        : s
      where.status = normalizedStatus
    }
    if (filters.loanType && filters.loanType !== 'all') where.loanType = filters.loanType

    if (requestingUser) {
      if (requestingUser.role === 'EMPLOYEE') {
        const empId = requestingUser.employee?.id || requestingUser.employeeId
        if (!empId) return []
        where.OR = [
          { employeeId: empId },
          { employee: { employeeCode: requestingUser.employee?.employeeCode || empId } }
        ]
      } else if (requestingUser.role === 'DEPT_MANAGER') {
        if (filters.employeeId) {
          where.OR = [
            { employeeId: filters.employeeId },
            { employee: { employeeCode: filters.employeeId } }
          ]
        } else if (requestingUser.employee?.departmentId) {
          where.employee = { departmentId: requestingUser.employee.departmentId }
        }
      }
    }

    if (filters.employeeId && !where.OR) {
      where.OR = [
        { employeeId: filters.employeeId },
        { employee: { employeeCode: filters.employeeId } }
      ]
    }

    return prisma.employeeLoan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        },
        repayments: {
          orderBy: { repaymentDate: 'desc' },
          take: 5
        }
      }
    })
  },

  /**
   * Retrieves a single loan with repayment transaction history.
   */
  async getLoanById(id, requestingUser = null) {
    const loan = await prisma.employeeLoan.findFirst({
      where: {
        OR: [{ id }, { loanNumber: id }]
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        },
        repayments: {
          orderBy: { repaymentDate: 'desc' }
        }
      }
    })

    if (!loan) {
      const error = new Error(`Loan with ID '${id}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (requestingUser?.role === 'EMPLOYEE' && requestingUser.employee?.id !== loan.employeeId) {
      const error = new Error('Access denied: You are not authorized to view another employee’s loan records.')
      error.code = 'FORBIDDEN'
      error.status = 403
      throw error
    }

    return loan
  },

  /**
   * Applies for an employee loan or salary advance.
   */
  async applyLoan(employeeId, data) {
    const {
      loanType = 'SALARY_ADVANCE',
      principalAmount,
      repaymentMonths = 6,
      remarks
    } = data

    if (!employeeId || !principalAmount) {
      const error = new Error('employeeId and principalAmount are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    // Resolve employee by CUID or employeeCode to guarantee valid PostgreSQL FK
    const resolvedEmployee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeId },
          { employeeCode: employeeId }
        ]
      },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, employmentStatus: true }
    })

    if (!resolvedEmployee) {
      const error = new Error(`Employee '${employeeId}' not found in database.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Financial eligibility is enforced on the server, not just in dropdown options.
    // Historical loans and repayments remain accessible when an employee becomes inactive.
    if (resolvedEmployee.employmentStatus !== 'ACTIVE') {
      const error = new Error(`Employee '${resolvedEmployee.employeeCode}' is not ACTIVE and cannot apply for a new loan or salary advance.`)
      error.code = 'EMPLOYEE_NOT_ELIGIBLE'
      error.status = 422
      throw error
    }

    const targetEmployeeId = resolvedEmployee.id

    const principal = Number(principalAmount)
    const months = Number(repaymentMonths)
    if (!Number.isFinite(principal) || principal < 5000) {
      const error = new Error('Principal amount must be at least PKR 5,000.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    if (!Number.isInteger(months) || months < 1 || months > 24) {
      const error = new Error('Repayment tenure must be between 1 and 24 months.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const monthlyInstallment = Math.round(principal / months)

    // Enforce POL-PAY-001 Loan Ceilings and Installment Caps
    try {
      const structure = await prisma.salaryStructure.findFirst({
        where: { employeeId: targetEmployeeId, isCurrent: true },
        orderBy: { effectiveFrom: 'desc' }
      })
      const basicSalary = structure ? Number(structure.baseSalary) : 0
      if (basicSalary > 0) {
        const policies = await adminSettingsService.getCompanyPolicies()
        const payPolicy = policies.find((p) => p.id === 'POL-PAY-001')
        const multiplier = Number(payPolicy?.rules?.loanMaxAmountMultiplier ?? 3.0)
        const deductionCapPct = Number(payPolicy?.rules?.loanMaxDeductionPercent ?? 30.0)

        const maxPrincipal = basicSalary * multiplier
        if (principal > maxPrincipal) {
          const error = new Error(
            `Requested loan of PKR ${principal.toLocaleString()} exceeds policy limit of ${multiplier}x basic salary (maximum allowed: PKR ${maxPrincipal.toLocaleString()}).`
          )
          error.code = 'LOAN_EXCEEDS_POLICY_CEILING'
          error.status = 400
          throw error
        }

        const maxInstallment = (basicSalary * deductionCapPct) / 100
        if (monthlyInstallment > maxInstallment) {
          const error = new Error(
            `Monthly installment of PKR ${monthlyInstallment.toLocaleString()} exceeds policy deduction cap of ${deductionCapPct}% of basic salary (maximum allowed: PKR ${maxInstallment.toLocaleString()}/month). Consider increasing repayment tenure.`
          )
          error.code = 'INSTALLMENT_EXCEEDS_CAP'
          error.status = 400
          throw error
        }
      }
    } catch (err) {
      if (err.code === 'LOAN_EXCEEDS_POLICY_CEILING' || err.code === 'INSTALLMENT_EXCEEDS_CAP') throw err
    }

    // Generate loan number e.g. LN-2026-001
    const year = new Date().getFullYear()
    const countTotal = await prisma.employeeLoan.count()
    const loanNumber = `LN-${year}-${String(countTotal + 1).padStart(3, '0')}`

    const loan = await prisma.employeeLoan.create({
      data: {
        loanNumber,
        employeeId: targetEmployeeId,
        loanType,
        principalAmount: new Prisma.Decimal(principal.toFixed(2)),
        repaymentMonths: months,
        monthlyInstallment: new Prisma.Decimal(monthlyInstallment.toFixed(2)),
        totalRepaidAmount: new Prisma.Decimal('0.00'),
        remainingBalance: new Prisma.Decimal(principal.toFixed(2)),
        status: 'PENDING',
        remarks: remarks?.trim() || null
      },
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      }
    })

    return loan
  },

  /**
   * Reviews loan application.
   * Enforces Anti-Self-Approval.
   */
  async reviewLoan(loanId, decision, reviewerUser, remarks = '') {
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      const error = new Error("Decision must be either 'APPROVED' or 'REJECTED'.")
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const loan = await prisma.employeeLoan.findFirst({
      where: {
        OR: [{ id: loanId }, { loanNumber: loanId }]
      },
      include: { employee: true }
    })

    if (!loan) {
      const error = new Error(`Loan '${loanId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (loan.status !== 'PENDING') {
      const error = new Error(`Cannot review loan already marked as '${loan.status}'.`)
      error.code = 'ALREADY_PROCESSED'
      error.status = 400
      throw error
    }

    if (decision === 'APPROVED' && loan.employee?.employmentStatus !== 'ACTIVE') {
      const error = new Error('Cannot approve a new loan for an employee who is not ACTIVE.')
      error.code = 'EMPLOYEE_NOT_ELIGIBLE'
      error.status = 422
      throw error
    }

    // ANTI-SELF-APPROVAL GUARD (bypassed for SUPER_ADMIN universal authority)
    const isSuperAdmin = String(reviewerUser?.role || '').toUpperCase() === 'SUPER_ADMIN'
    if (!isSuperAdmin && reviewerUser?.employee?.id && reviewerUser.employee.id === loan.employeeId) {
      const error = new Error('Anti-Self-Approval Violation: You cannot approve or reject your own loan application.')
      error.code = 'SELF_APPROVAL_PROHIBITED'
      error.status = 403
      throw error
    }

    return prisma.employeeLoan.update({
      where: { id: loan.id },
      data: {
        status: decision,
        approvedById: reviewerUser.id,
        remarks: remarks ? `${loan.remarks || ''} | Review: ${remarks}`.trim() : loan.remarks
      },
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      }
    })
  },

  /**
   * Disburses approved loan to employee.
   * Activates loan for monthly payroll deduction recovery.
   */
  async disburseLoan(loanId, actorUser, disbursementData = {}) {
    const loan = await prisma.employeeLoan.findFirst({
      where: {
        OR: [{ id: loanId }, { loanNumber: loanId }]
      }
    })
    if (!loan) {
      const error = new Error(`Loan '${loanId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (loan.status !== 'APPROVED') {
      const error = new Error(`Only APPROVED loans can be disbursed. Current status: '${loan.status}'.`)
      error.code = 'INVALID_STATE'
      error.status = 400
      throw error
    }

    const beneficiary = await prisma.employee.findUnique({
      where: { id: loan.employeeId },
      select: { employmentStatus: true }
    })
    if (beneficiary?.employmentStatus !== 'ACTIVE') {
      const error = new Error('Cannot disburse a new loan to an employee who is not ACTIVE.')
      error.code = 'EMPLOYEE_NOT_ELIGIBLE'
      error.status = 422
      throw error
    }

    return prisma.employeeLoan.update({
      where: { id: loan.id },
      data: {
        status: 'DISBURSED',
        disbursementDate: new Date(disbursementData.disbursementDate || new Date()),
        remarks: disbursementData.notes ? `${loan.remarks || ''} | Disbursed: ${disbursementData.notes}`.trim() : loan.remarks
      },
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      }
    })
  },

  /**
   * Records a loan repayment transaction.
   * Transaction-safe deduction from remainingBalance.
   */
  async recordRepayment(loanId, amount, paymentSource = 'DIRECT_PAYMENT', payrollEntryId = null, notes = '') {
    const repayAmount = Number(amount)
    if (repayAmount <= 0) {
      const error = new Error('Repayment amount must be positive.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    return prisma.$transaction(async (tx) => {
      const loan = await tx.employeeLoan.findFirst({
        where: {
          OR: [{ id: loanId }, { loanNumber: loanId }]
        }
      })
      if (!loan) {
        const error = new Error(`Loan '${loanId}' not found.`)
        error.code = 'NOT_FOUND'
        error.status = 404
        throw error
      }

      const curRemaining = Number(loan.remainingBalance)
      const actualDeduct = Math.min(repayAmount, curRemaining)
      const newBalance = Math.max(0, curRemaining - actualDeduct)
      const newTotalRepaid = Number(loan.totalRepaidAmount) + actualDeduct

      const repayment = await tx.loanRepayment.create({
        data: {
          loanId: loan.id,
          payrollEntryId,
          amount: new Prisma.Decimal(actualDeduct.toFixed(2)),
          balanceAfter: new Prisma.Decimal(newBalance.toFixed(2)),
          paymentSource,
          notes: notes?.trim() || null
        }
      })

      await tx.employeeLoan.update({
        where: { id: loan.id },
        data: {
          totalRepaidAmount: new Prisma.Decimal(newTotalRepaid.toFixed(2)),
          remainingBalance: new Prisma.Decimal(newBalance.toFixed(2)),
          status: newBalance <= 0 ? 'REPAID' : loan.status
        }
      })

      return repayment
    })
  }
}

export default loanService

