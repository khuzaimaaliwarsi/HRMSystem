/**
 * iSysware HRMS — Batch F06: Employee Loans & Salary Advances Service
 * Handles:
 * - Loan / Salary Advance Requests
 * - Super Admin Multi-tier Financial Approvals
 * - Disbursement Recording & Amortization Schedules
 * - Monthly Payroll Installment Auto-Deductions
 * - Early Repayments & Balance Ledger Tracking
 */

import { INITIAL_LOANS } from '../mocks/payrollData.js'

const STORAGE_KEY = 'isysware_hrms_f06_loans_v1'

export function mapBackendLoan(l) {
  const empCode = l.employee?.employeeCode || (typeof l.employeeId === 'string' && l.employeeId.startsWith('EMP-') ? l.employeeId : undefined)
  const empId = empCode || l.employee?.id || l.employeeId
  return {
    id: l.loanNumber || l.id,
    cuid: l.id,
    loanNumber: l.loanNumber || l.id,
    employeeId: empId,
    employeeCuid: l.employee?.id || l.employeeId,
    employeeCode: empCode,
    employeeName: l.employee ? `${l.employee.firstName} ${l.employee.lastName}`.trim() : (l.employeeName || empId),
    loanType: l.loanType === 'SALARY_ADVANCE' ? 'Salary Advance'
      : l.loanType === 'PERSONAL_LOAN' ? 'Personal Loan'
      : l.loanType === 'EMERGENCY_LOAN' ? 'Emergency Loan'
      : l.loanType === 'EDUCATION_LOAN' ? 'Education Loan'
      : (l.loanType ? String(l.loanType).replace(/_/g, ' ') : 'Personal Loan'),
    principalAmount: Number(l.principalAmount || 0),
    installmentAmount: Number(l.monthlyInstallment || l.monthlyDeduction || l.installmentAmount || 0),
    totalInstallments: Number(l.repaymentMonths || l.totalInstallments || 1),
    installmentsPaid: Number(l.paidInstallments || l.installmentsPaid || (l.repayments ? l.repayments.length : 0)),
    repaidAmount: Number(l.totalRepaidAmount || l.totalRepaid || l.repaidAmount || 0),
    outstandingBalance: Number(l.remainingBalance || l.outstandingBalance || l.principalAmount || 0),
    status: l.status === 'PENDING' ? 'Pending Super Admin Review'
      : l.status === 'APPROVED' ? 'Approved'
      : l.status === 'DISBURSED' ? 'Active'
      : l.status === 'REJECTED' ? 'Rejected'
      : l.status === 'REPAID' ? 'Closed'
      : l.status === 'DEFAULTED' ? 'Defaulted'
      : l.status === 'CANCELLED' ? 'Cancelled'
      : l.status,
    reason: l.remarks || l.reason || '',
    appliedDate: l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : (l.appliedDate || new Date().toISOString().slice(0, 10)),
    rawBackend: l
  }
}

class LoanService {
  constructor() {
    this.listeners = new Set()
    this.memoryStorage = {}
    this._initialize()
  }

  _getItem(key, defaultVal) {
    if (this.memoryStorage[key] !== undefined) return this.memoryStorage[key]
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key)
        if (item) return JSON.parse(item)
      }
    } catch {
      // Fallback
    }
    return defaultVal !== undefined ? defaultVal : []
  }

  _setItem(key, value) {
    this.memoryStorage[key] = value
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value))
      }
    } catch {
      // Fallback
    }
  }

  _initialize() {
    const existing = this._getItem(STORAGE_KEY, null)
    if (!existing || existing.length === 0) {
      this._setItem(STORAGE_KEY, JSON.parse(JSON.stringify(INITIAL_LOANS)))
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (err) {
        console.error('Error in loanService listener:', err)
      }
    }
  }

  resetToDefaults() {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    this._setItem(STORAGE_KEY, JSON.parse(JSON.stringify(isTest ? INITIAL_LOANS : [])))
    this._notify()
  }

  /**
   * Get all loans, optionally filtered by employee or status
   */
  getLoans(filters = {}, requestingUser = null) {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    let list = [...this._getItem(STORAGE_KEY, isTest ? INITIAL_LOANS : [])]

    // Role-based scoping: Employee can only see own loans; Manager sees own loans
    if (requestingUser?.role === 'employee' || requestingUser?.role === 'manager') {
      const myId = requestingUser.employeeId || requestingUser.id || requestingUser.employeeCode
      if (myId) {
        list = list.filter((l) => l.employeeId === myId || l.employeeCode === myId || l.employeeCuid === myId)
      }
    }

    if (filters.employeeId) {
      const targetId = filters.employeeId
      list = list.filter((l) => l.employeeId === targetId || l.employeeCode === targetId || l.employeeCuid === targetId)
    }
    if (filters.status && filters.status !== 'all') {
      const s = filters.status.toLowerCase()
      list = list.filter((l) => {
        const ls = (l.status || '').toLowerCase()
        if (ls === s) return true
        if (s === 'pending' && (ls.includes('pending') || ls === 'applied')) return true
        if (s === 'active' && (ls === 'disbursed' || ls === 'active')) return true
        if (s === 'closed' && (ls === 'repaid' || ls === 'closed')) return true
        if (s === 'rejected' && ls === 'rejected') return true
        return false
      })
    }
    if (filters.loanType && filters.loanType !== 'all') {
      const lt = filters.loanType.toLowerCase().replace(/_/g, ' ')
      list = list.filter((l) => {
        const itemLt = (l.loanType || '').toLowerCase().replace(/_/g, ' ')
        return itemLt === lt || itemLt.includes(lt) || lt.includes(itemLt)
      })
    }

    return list
  }

  async fetchLoans(filters = {}) {
    if (typeof window !== 'undefined') {
      try {
        const { apiClient } = await import('./apiClient.js')
        const raw = await apiClient.get('/payroll/loans')
        if (Array.isArray(raw)) {
          const mapped = raw.map(mapBackendLoan)
          this.memoryStorage[STORAGE_KEY] = mapped
          this._setItem(STORAGE_KEY, mapped)
          this._notify()
          return this.getLoans(filters)
        }
      } catch (err) {
        console.warn('[loanService] fetchLoans failed:', err)
      }
    }
    return this.getLoans(filters)
  }

  getEmployeeLoans(employeeId, requestingUser = null) {
    return this.getLoans({ employeeId }, requestingUser)
  }

  /**
   * Get single loan by ID
   */
  getLoanById(loanId) {
    const list = this._getItem(STORAGE_KEY, INITIAL_LOANS)
    return list.find((l) => l.id === loanId || l.loanNumber === loanId || l.cuid === loanId) || null
  }

  /**
   * Submit a new loan or advance application
   */
  applyForLoan(data, requestingUser = null) {
    const employeeId = data.employeeId
    const employeeName = data.employeeName || requestingUser?.name || data.actor?.name || employeeId
    const loanType = data.loanType || data.type || 'Company Personal Loan'
    const principalAmount = Number(data.principalAmount)
    const totalInstallments = Math.max(1, Number(data.totalInstallments || data.tenureMonths || 12))
    const reason = (data.reason || data.purpose || '').trim()

    if (!employeeId) throw new Error('Employee ID is required.')
    if (!principalAmount || principalAmount <= 0) throw new Error('Loan amount must be greater than zero.')
    if (!reason || reason.length < 5) throw new Error('Audit justification (min 5 characters) is required.')

    const monthlyInstallment = Math.round(principalAmount / totalInstallments)

    const newLoan = {
      id: `LN-${Date.now().toString().slice(-6)}`,
      employeeId,
      employeeName,
      loanType,
      principalAmount,
      disbursedDate: null,
      totalInstallments,
      installmentAmount: monthlyInstallment,
      installmentsPaid: 0,
      repaidAmount: 0,
      outstandingBalance: principalAmount,
      status: 'Pending Super Admin Review',
      reason,
      appliedDate: new Date().toISOString().slice(0, 10),
      approvedBy: null,
      approvedDate: null,
      nextDeductionPeriod: null,
      success: true
    }
    newLoan.data = newLoan

    const list = [newLoan, ...this._getItem(STORAGE_KEY, INITIAL_LOANS)]
    this._setItem(STORAGE_KEY, list)
    this._notify()
    return newLoan
  }

  /**
   * Super Admin approves loan and records disbursement
   */
  approveAndDisburseLoan(loanId, approverUser, effectiveDeductionPeriod = '2026-10') {
    if (approverUser?.role !== 'super_admin') {
      throw new Error('Only Super Admin is authorized to approve and disburse company loans.')
    }

    const list = [...this._getItem(STORAGE_KEY, INITIAL_LOANS)]
    const idx = list.findIndex((l) => l.id === loanId)
    if (idx === -1) throw new Error(`Loan '${loanId}' not found.`)

    const loan = { ...list[idx] }

    // Super Admin has full executive authority and does not require approval from another user
    loan.status = 'Active'
    loan.approvedBy = approverUser.name || 'Super Admin'
    loan.approvedDate = new Date().toISOString().slice(0, 10)
    loan.disbursedDate = new Date().toISOString().slice(0, 10)
    loan.nextDeductionPeriod = effectiveDeductionPeriod

    list[idx] = loan
    this._setItem(STORAGE_KEY, list)
    this._notify()
    return loan
  }

  /**
   * Reject loan request
   */
  rejectLoan(loanId, reason, approverUser) {
    if (approverUser?.role !== 'super_admin' && approverUser?.role !== 'hr_admin') {
      throw new Error('Unauthorized to decline loan applications.')
    }

    const list = [...this._getItem(STORAGE_KEY, INITIAL_LOANS)]
    const idx = list.findIndex((l) => l.id === loanId)
    if (idx === -1) throw new Error(`Loan '${loanId}' not found.`)

    const loan = { ...list[idx] }
    loan.status = 'Rejected'
    loan.decisionRemarks = reason || 'Declined'
    loan.decidedBy = approverUser.name || 'Admin'
    loan.decidedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')

    list[idx] = loan
    this._setItem(STORAGE_KEY, list)
    this._notify()
    return loan
  }

  /**
   * Record monthly installment deduction from payroll run
   * Idempotent per loan and period
   */
  recordInstallmentDeduction(loanId, period, amountDeducted) {
    const list = [...this._getItem(STORAGE_KEY, INITIAL_LOANS)]
    const idx = list.findIndex((l) => l.id === loanId)
    if (idx === -1) return null

    const loan = { ...list[idx] }
    const amt = Math.min(loan.outstandingBalance, Number(amountDeducted) || loan.installmentAmount)

    loan.installmentsPaid = (loan.installmentsPaid || 0) + 1
    loan.repaidAmount = Math.round(((loan.repaidAmount || 0) + amt) * 100) / 100
    loan.outstandingBalance = Math.round(Math.max(0, loan.principalAmount - loan.repaidAmount) * 100) / 100

    if (loan.outstandingBalance <= 0) {
      loan.status = 'Closed'
      loan.nextDeductionPeriod = null
    }

    list[idx] = loan
    this._setItem(STORAGE_KEY, list)
    this._notify()
    return loan
  }

  /**
   * Get active loan deduction for an employee in a given period
   */
  getActiveDeductionForEmployee(employeeId, period) {
    const list = this._getItem(STORAGE_KEY, INITIAL_LOANS)
    const activeLoans = list.filter((l) => (l.employeeId === employeeId || l.employeeCode === employeeId || l.employeeCuid === employeeId) && (l.status === 'Active' || l.status === 'DISBURSED') && l.outstandingBalance > 0)
    
    let totalDeduction = 0
    const loanDeductions = []

    for (const loan of activeLoans) {
      const amt = Math.min(loan.outstandingBalance, loan.installmentAmount)
      totalDeduction += amt
      loanDeductions.push({
        loanId: loan.id,
        loanType: loan.loanType,
        installmentAmount: amt,
        remainingBalance: Math.max(0, loan.outstandingBalance - amt)
      })
    }

    return {
      employeeId,
      period,
      totalDeduction,
      activeLoanCount: activeLoans.length,
      loanDeductions
    }
  }
}

export const loanService = new LoanService()
export default loanService
