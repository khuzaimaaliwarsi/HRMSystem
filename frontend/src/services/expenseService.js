/**
 * iSysware HRMS — Batch F12: Expense Management Service
 * Comprehensive service layer for:
 * - Expense Categories & Policy Enforcement
 * - Expense Claim Submission with Strict Validations (Receipts, Limits, Split-claims)
 * - Multi-tier Approval Routing with Anti-Self-Approval
 * - Separate Approval vs Reimbursement Payment Statuses
 * - Reimbursement Register with Bank Account Verification
 * - F10 Travel Expense Reconciliation Bridge
 * - Complete Audit Trail & Reactive Listeners
 */

import {
  INITIAL_EXPENSE_CATEGORIES,
  INITIAL_EXPENSE_CLAIMS,
  INITIAL_FINANCIAL_AUTHORITY_LIMITS
} from '../mocks/expenseData.js'
import { employeeService } from './employeeService.js'
import { travelService } from './travelService.js'
import apiClient from './apiClient.js'

const STORAGE_KEYS = {
  CATEGORIES: 'isysware_hrms_f12_expense_categories_v1',
  CLAIMS: 'isysware_hrms_f12_expense_claims_v1',
  AUTHORITY_LIMITS: 'isysware_hrms_f12_authority_limits_v1',
  AUDIT_LOGS: 'isysware_hrms_f12_expense_audits_v1',
  TRAVEL_REQUESTS: 'isysware_hrms_f12_travel_requests_v1',
  TRAVEL_RECONCILIATIONS: 'isysware_hrms_f12_travel_reconciliations_v1'
}

class ExpenseService {
  constructor() {
    this._listeners = new Set()
    this.memoryStorage = {}
    this._initializeStorage()
  }

  _initializeStorage() {
    const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)
    if (isTest) {
      if (!this._getItem(STORAGE_KEYS.CATEGORIES, null)) {
        this._setItem(STORAGE_KEYS.CATEGORIES, JSON.parse(JSON.stringify(INITIAL_EXPENSE_CATEGORIES)))
      }
      if (!this._getItem(STORAGE_KEYS.CLAIMS, null)) {
        this._setItem(STORAGE_KEYS.CLAIMS, JSON.parse(JSON.stringify(INITIAL_EXPENSE_CLAIMS)))
      }
      if (!this._getItem(STORAGE_KEYS.AUTHORITY_LIMITS, null)) {
        this._setItem(STORAGE_KEYS.AUTHORITY_LIMITS, JSON.parse(JSON.stringify(INITIAL_FINANCIAL_AUTHORITY_LIMITS)))
      }
    } else {
      this.memoryStorage[STORAGE_KEYS.CATEGORIES] = []
      this.memoryStorage[STORAGE_KEYS.CLAIMS] = []
      this.memoryStorage[STORAGE_KEYS.TRAVEL_RECONCILIATIONS] = []
      this.memoryStorage[STORAGE_KEYS.AUTHORITY_LIMITS] = { managerMaxLimit: 0, hrAdminMaxLimit: 0, superAdminThreshold: 0 }
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(STORAGE_KEYS.CATEGORIES)
          window.localStorage.removeItem(STORAGE_KEYS.CLAIMS)
          window.localStorage.removeItem(STORAGE_KEYS.AUTHORITY_LIMITS)
          window.localStorage.removeItem('isysware_hrms_f12_expense_categories_v1')
          window.localStorage.removeItem('isysware_hrms_f12_expense_claims_v1')
          window.localStorage.removeItem('isysware_hrms_f12_authority_limits_v1')
        }
      } catch {
        // Safe fallback
      }
    }
    if (!this._getItem(STORAGE_KEYS.AUDIT_LOGS, null)) {
      this._setItem(STORAGE_KEYS.AUDIT_LOGS, [])
    }
  }

  // Safe in-memory storage abstraction — strictly zero business data in browser localStorage
  _getItem(key, defaultVal) {
    if (this.memoryStorage[key] !== undefined) return this.memoryStorage[key]
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(key)
        if (stored !== null) {
          try { return JSON.parse(stored) } catch { return stored }
        }
      } catch {
        // Memory fallback
      }
    }
    return defaultVal !== undefined ? defaultVal : []
  }

  _setItem(key, val) {
    this.memoryStorage[key] = JSON.parse(JSON.stringify(val))
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(val))
      } catch {
        // Memory fallback
      }
    }
  }

  subscribe(callback) {
    this._listeners.add(callback)
    return () => this._listeners.delete(callback)
  }

  _notify() {
    this._listeners.forEach((cb) => {
      try {
        cb()
      } catch (err) {
        console.error('ExpenseService listener error:', err)
      }
    })
  }

  resetAllData() {
    const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)
    this.memoryStorage = {}
    this._setItem(STORAGE_KEYS.CATEGORIES, JSON.parse(JSON.stringify(isTest ? INITIAL_EXPENSE_CATEGORIES : [])))
    this._setItem(STORAGE_KEYS.CLAIMS, JSON.parse(JSON.stringify(isTest ? INITIAL_EXPENSE_CLAIMS : [])))
    this._setItem(STORAGE_KEYS.AUTHORITY_LIMITS, JSON.parse(JSON.stringify(isTest ? INITIAL_FINANCIAL_AUTHORITY_LIMITS : { managerMaxLimit: 0, hrAdminMaxLimit: 0, superAdminThreshold: 0 })))
    this._setItem(STORAGE_KEYS.AUDIT_LOGS, [])
    this._notify()
  }


  // =========================================================================
  // 1. EXPENSE CATEGORIES & LIMIT POLICIES
  // =========================================================================

  getExpenseCategories(filterActive = false) {
    const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)
    const categories = this._getItem(STORAGE_KEYS.CATEGORIES, isTest ? INITIAL_EXPENSE_CATEGORIES : [])
    if (filterActive) {
      return categories.filter((c) => c.isActive)
    }
    return categories
  }

  getExpenseCategoryById(categoryId) {
    const categories = this.getExpenseCategories()
    return categories.find((c) => c.categoryId === categoryId || c.code === categoryId) || null
  }

  updateExpenseCategory(categoryId, updateData, actor = 'Super Admin') {
    const categories = [...this.getExpenseCategories()]
    const idx = categories.findIndex((c) => c.categoryId === categoryId)
    if (idx === -1) throw new Error(`Category ${categoryId} not found.`)

    categories[idx] = {
      ...categories[idx],
      ...updateData,
      updatedAt: new Date().toISOString(),
      updatedBy: actor
    }

    this._setItem(STORAGE_KEYS.CATEGORIES, categories)
    this._logAudit('CATEGORY_UPDATED', actor, `Category ${categories[idx].categoryName} limits updated.`, {
      categoryId,
      changes: updateData
    })
    this._notify()
    return categories[idx]
  }

  addExpenseCategory(categoryData, actor = 'Super Admin') {
    const categories = [...this.getExpenseCategories()]
    const name = (categoryData.categoryName || '').trim()
    const code = (categoryData.code || name.slice(0, 4).toUpperCase()).trim().toUpperCase()

    if (!name) throw new Error('Category name is required.')
    if (categories.some((c) => c.categoryName.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Expense category '${name}' already exists.`)
    }

    const nextNum =
      categories.reduce((max, c) => {
        const match = c.categoryId && c.categoryId.match(/\d+/)
        const num = match ? parseInt(match[0], 10) : 0
        return num > max ? num : max
      }, 0) + 1
    const nextId = `CAT-${code.replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'EXP'}-${String(nextNum).padStart(2, '0')}`

    const newCat = {
      categoryId: nextId,
      code,
      categoryName: name,
      description: categoryData.description || `Custom expense category for ${name}`,
      perClaimLimit: Number(categoryData.perClaimLimit) || 15000,
      monthlyLimit: Number(categoryData.monthlyLimit) || 50000,
      dailyLimit: Number(categoryData.dailyLimit) || 15000,
      receiptRequiredThreshold: Number(categoryData.receiptRequiredThreshold) || 1000,
      requiresTravelRequestRef: Boolean(categoryData.requiresTravelRequestRef),
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: actor
    }

    // Newest category on top
    categories.unshift(newCat)
    this._setItem(STORAGE_KEYS.CATEGORIES, categories)
    this._logAudit('CATEGORY_CREATED', actor, `Custom expense category '${name}' created.`, { categoryId: nextId })
    this._notify()
    return newCat
  }

  getFinancialAuthorityLimits() {
    const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)
    return this._getItem(STORAGE_KEYS.AUTHORITY_LIMITS, isTest ? INITIAL_FINANCIAL_AUTHORITY_LIMITS : { managerMaxLimit: 0, hrAdminMaxLimit: 0, superAdminThreshold: 0 })
  }

  // =========================================================================
  // 2. EXPENSE CLAIMS & WORKFLOWS
  // =========================================================================

  isClaimOwnedByUser(claim, user = {}) {
    if (!claim || !user) return false
    const userIds = [user.employeeId, user.id, user.employee?.id, user.employeeCode, user.employee?.employeeCode]
      .filter(Boolean)
      .map(String)
    const claimOwners = [claim.employeeId, claim.employeeCuid, claim.employeeCode].filter(Boolean).map(String)
    return claimOwners.some((id) => userIds.includes(id))
  }

  getExpenseClaims(filters = {}, requestingUser = {}) {
    let claims = [...this._getItem(STORAGE_KEYS.CLAIMS, [])]
    const role = (requestingUser.role || 'employee').toLowerCase()
    const userId = requestingUser.employeeId || requestingUser.id
    const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)

    // Role-based data isolation (authoritative in-test + defense-in-depth over API-scoped results)
    if (role === 'employee') {
      claims = claims.filter((c) => this.isClaimOwnedByUser(c, requestingUser))
    } else if (role === 'manager' && isTest) {
      // Manager sees own claims + claims of direct reports in offline test fixtures
      const allEmployees = employeeService?.getEmployees?.() || []
      const subordinateIds = new Set(
        allEmployees
          .filter((e) => e.managerId === userId || e.managerId === requestingUser.id)
          .map((e) => e.id)
      )
      subordinateIds.add(userId)
      if (requestingUser.id) subordinateIds.add(requestingUser.id)
      claims = claims.filter((c) => subordinateIds.has(c.employeeId))
    } else if (role === 'hr_admin') {
      claims = claims.filter((c) => c.employeeId !== 'EMP-001' || c.approvalStatus !== 'Draft')
    }
    // super_admin sees company-wide

    // Filters
    if (filters.status && filters.status !== 'all') {
      claims = claims.filter((c) => c.approvalStatus.toLowerCase() === filters.status.toLowerCase())
    }
    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      claims = claims.filter((c) => c.paymentStatus.toLowerCase() === filters.paymentStatus.toLowerCase())
    }
    if (filters.category && filters.category !== 'all') {
      claims = claims.filter((c) => c.category === filters.category || c.categoryId === filters.category)
    }
    if (filters.employeeId) {
      claims = claims.filter((c) => c.employeeId === filters.employeeId)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      claims = claims.filter((c) =>
        c.claimId.toLowerCase().includes(q) ||
        c.employeeName.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.receiptReference && c.receiptReference.toLowerCase().includes(q))
      )
    }

    return claims.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate))
  }

  getExpenseClaimById(claimId, requestingUser = null) {
    if (!requestingUser || requestingUser.role === 'super_admin') {
      const all = this._getItem(STORAGE_KEYS.CLAIMS, [])
      return all.find((c) => c.claimId === claimId) || null
    }
    const claims = this.getExpenseClaims({}, requestingUser)
    return claims.find((c) => c.claimId === claimId) || null
  }

  /**
   * Create an Expense Claim with strict corporate controls
   */
  createExpenseClaim(claimData, actorUser = {}) {
    if (!claimData.employeeId) throw new Error('Employee ID is required.')
    if (!claimData.expenseDate) throw new Error('Expense date is required.')
    if (!claimData.category) throw new Error('Expense category is required.')
    if (!claimData.amount || Number(claimData.amount) <= 0) {
      throw new Error('Valid expense amount greater than 0 PKR is required.')
    }
    if (!claimData.description || claimData.description.trim().length < 5) {
      throw new Error('Detailed business description (min 5 characters) is required.')
    }

    const amount = Number(claimData.amount)
    const category = this.getExpenseCategoryById(claimData.categoryId || claimData.category)
      || this.getExpenseCategories().find((c) => c.categoryName.toLowerCase() === claimData.category.toLowerCase())

    if (!category || !category.isActive) {
      throw new Error(`Expense category "${claimData.category}" is invalid or inactive.`)
    }

    // 1. Per-Claim Limit Enforcement
    if (amount > category.perClaimLimit) {
      throw new Error(
        `Claim amount PKR ${amount.toLocaleString()} exceeds the per-claim limit of PKR ${category.perClaimLimit.toLocaleString()} for ${category.categoryName}.`
      )
    }

    // 2. Receipt Required Threshold Validation
    if (amount >= category.receiptRequiredThreshold && (!claimData.receiptReference || claimData.receiptReference.trim() === '')) {
      throw new Error(
        `Receipt / invoice reference is mandatory for ${category.categoryName} expenses of PKR ${category.receiptRequiredThreshold.toLocaleString()} or above.`
      )
    }

    // 3. Duplicate Receipt Check
    const allClaims = this._getItem(STORAGE_KEYS.CLAIMS, [])
    if (claimData.receiptReference) {
      const receiptTrimmed = claimData.receiptReference.trim().toLowerCase()
      const duplicateReceipt = allClaims.find(
        (c) => c.receiptReference &&
               c.receiptReference.trim().toLowerCase() === receiptTrimmed &&
               ['Submitted', 'Under Review', 'Approved', 'Paid'].includes(c.approvalStatus)
      )
      if (duplicateReceipt) {
        throw new Error(
          `Duplicate receipt reference "${claimData.receiptReference}" detected. This invoice was already submitted under claim ${duplicateReceipt.claimId}.`
        )
      }
    }

    // 4. Split-Request Limit Bypass Detection (Multiple claims in same category on same date)
    const sameDateCategoryClaims = allClaims.filter(
      (c) => c.employeeId === claimData.employeeId &&
             c.expenseDate === claimData.expenseDate &&
             c.categoryId === category.categoryId &&
             ['Submitted', 'Under Review', 'Approved'].includes(c.approvalStatus)
    )
    const cumulativeDailyCategory = sameDateCategoryClaims.reduce((sum, c) => sum + c.amount, 0) + amount
    if (category.dailyLimit && sameDateCategoryClaims.length > 0 && cumulativeDailyCategory > category.dailyLimit) {
      throw new Error(
        `Potential split claim detected: Multiple claims submitted on ${claimData.expenseDate} for ${category.categoryName} totaling PKR ${cumulativeDailyCategory.toLocaleString()} exceed the daily cap of PKR ${category.dailyLimit.toLocaleString()}.`
      )
    }


    // 5. Cumulative Monthly Limit Validation
    const expenseMonth = claimData.expenseDate.slice(0, 7) // YYYY-MM
    const monthlyCategoryClaims = allClaims.filter(
      (c) => c.employeeId === claimData.employeeId &&
             c.expenseDate.startsWith(expenseMonth) &&
             c.categoryId === category.categoryId &&
             ['Submitted', 'Under Review', 'Approved'].includes(c.approvalStatus)
    )
    const cumulativeMonthTotal = monthlyCategoryClaims.reduce((sum, c) => sum + c.amount, 0) + amount
    if (cumulativeMonthTotal > category.monthlyLimit) {
      throw new Error(
        `Monthly limit exceeded: Total claims for ${category.categoryName} in ${expenseMonth} would reach PKR ${cumulativeMonthTotal.toLocaleString()}, which exceeds the monthly ceiling of PKR ${category.monthlyLimit.toLocaleString()}.`
      )
    }

    // 6. Travel Request Reference Verification if required
    if (category.requiresTravelRequestRef && !claimData.relatedTravelRequestId) {
      throw new Error(
        `Category ${category.categoryName} requires an approved official Travel Request Reference.`
      )
    }
    if (claimData.relatedTravelRequestId) {
      const travelReqs = travelService?.getTravelRequests?.() || []
      const matchedTravel = travelReqs.find((t) => t.requestId === claimData.relatedTravelRequestId)
      if (!matchedTravel) {
        throw new Error(`Referenced travel request "${claimData.relatedTravelRequestId}" does not exist.`)
      }
      if (!['Approved', 'Completed'].includes(matchedTravel.status)) {
        throw new Error(`Referenced travel request "${claimData.relatedTravelRequestId}" is not in Approved or Completed status.`)
      }
    }

    // 7. Employee Info & Bank Details from F02 canonical employee service
    const employee = employeeService?.getEmployeeById?.(claimData.employeeId)
    const employeeName = employee?.name || claimData.employeeName || 'Authorized Staff'
    const department = employee?.department || claimData.department || 'General Department'
    const departmentId = employee?.departmentId || claimData.departmentId || 'DEP-01'

    // Fetch verified bank details
    const bankDetails = employeeService?.getBankDetails?.(claimData.employeeId, 'super_admin', 'SYSTEM')
    const reimbursementAccount = claimData.requestedReimbursementAccount ||
      (bankDetails?.bankName ? `${bankDetails.bankName} - ${bankDetails.accountNumber || bankDetails.iban}` : 'Bank Transfer Advice (Pending Account Verification)')

    const nextIdNum = allClaims.length + 1
    const claimId = `EXP-2026-${String(nextIdNum).padStart(3, '0')}`

    const newClaim = {
      claimId,
      employeeId: claimData.employeeId,
      employeeName,
      department,
      departmentId,
      expenseDate: claimData.expenseDate,
      submissionDate: new Date().toISOString().slice(0, 10),
      category: category.categoryName,
      categoryId: category.categoryId,
      amount,
      currency: 'PKR',
      description: claimData.description.trim(),
      receiptReference: claimData.receiptReference ? claimData.receiptReference.trim() : null,
      receiptFileName: claimData.receiptFileName || null,
      projectClient: claimData.projectClient ? claimData.projectClient.trim() : null,
      relatedTravelRequestId: claimData.relatedTravelRequestId || null,
      paymentMethodUsed: claimData.paymentMethodUsed || 'Cash',
      requestedReimbursementAccount: reimbursementAccount,
      applicablePolicy: category.description,
      approvalStatus: 'Submitted',
      paymentStatus: 'Unapproved',
      paidAmount: 0,
      remainingPayable: amount,
      managerReviewerId: null,
      managerReviewerName: null,
      managerRemarks: null,
      managerReviewedAt: null,
      finalApproverId: null,
      finalApproverName: null,
      finalApprovalRemarks: null,
      finalApprovedAt: null,
      reimbursements: [],
      auditHistory: [
        {
          action: 'Claim Submitted',
          actor: actorUser.name || employeeName,
          timestamp: new Date().toISOString(),
          remarks: `Initial submission of PKR ${amount.toLocaleString()} under ${category.categoryName}.`
        }
      ]
    }

    allClaims.push(newClaim)
    this._setItem(STORAGE_KEYS.CLAIMS, allClaims)
    this._logAudit('CLAIM_SUBMITTED', actorUser.name || employeeName, `Claim ${claimId} submitted for PKR ${amount}.`, {
      claimId,
      amount,
      category: category.categoryName
    })
    this._notify()
    return newClaim
  }

  /**
   * Multi-tier Review & Approval with Anti-Self-Approval
   */
  reviewExpenseClaim(claimId, decision, remarks, actorUser = {}) {
    if (!['Approved', 'Rejected', 'Returned'].includes(decision)) {
      throw new Error(`Invalid decision "${decision}". Must be Approved, Rejected, or Returned.`)
    }
    if (!remarks || remarks.trim().length < 3) {
      throw new Error('Approval/Review remarks are mandatory.')
    }

    const allClaims = [...this._getItem(STORAGE_KEYS.CLAIMS, [])]
    const idx = allClaims.findIndex((c) => c.claimId === claimId)
    if (idx === -1) throw new Error(`Claim ${claimId} not found.`)

    const claim = allClaims[idx]
    const actorId = actorUser.id || actorUser.employeeId
    const actorRole = (actorUser.role || 'employee').toLowerCase()
    const actorName = actorUser.name || 'Authorized Approver'

    // 1. Anti-Self-Approval Safeguard: Non-Super-Admin requester CANNOT approve their own claim
    if (actorRole !== 'super_admin' && claim.employeeId === actorId) {
      throw new Error('Anti-Self-Approval Violation: You cannot approve or review your own expense claim.')
    }

    // 2. Financial Authority Thresholds
    const limits = this.getFinancialAuthorityLimits()

    if (decision === 'Approved') {
      if (actorRole === 'manager') {
        // Manager can only approve up to managerMaxLimit (PKR 25,000)
        if (claim.amount > limits.managerMaxLimit) {
          throw new Error(
            `Manager Authority Exceeded: Claim amount PKR ${claim.amount.toLocaleString()} exceeds your financial approval limit of PKR ${limits.managerMaxLimit.toLocaleString()}. Please escalate to HR / Finance.`
          )
        }
      } else if (actorRole === 'hr_admin') {
        // HR/Admin can approve up to hrAdminMaxLimit (PKR 75,000)
        if (claim.amount > limits.hrAdminMaxLimit) {
          throw new Error(
            `HR Admin Authority Exceeded: Claim amount PKR ${claim.amount.toLocaleString()} exceeds HR approval limit of PKR ${limits.hrAdminMaxLimit.toLocaleString()}. Super Admin authorization is required.`
          )
        }
      }
    }

    // Update claim status
    const previousStatus = claim.approvalStatus
    claim.approvalStatus = decision

    if (decision === 'Approved') {
      // Approval DOES NOT mean payment has happened!
      claim.paymentStatus = 'Payment Pending'
      claim.remainingPayable = claim.amount - (claim.paidAmount || 0)
      claim.finalApproverId = actorId
      claim.finalApproverName = actorName
      claim.finalApprovalRemarks = remarks
      claim.finalApprovedAt = new Date().toISOString()
    } else if (decision === 'Rejected') {
      claim.paymentStatus = 'Unapproved'
      claim.remainingPayable = 0
      claim.finalApproverId = actorId
      claim.finalApproverName = actorName
      claim.finalApprovalRemarks = remarks
      claim.finalApprovedAt = new Date().toISOString()
    } else if (decision === 'Returned') {
      claim.paymentStatus = 'Unapproved'
      claim.managerRemarks = remarks
    }

    claim.auditHistory.push({
      action: `Decision: ${decision}`,
      actor: `${actorName} (${actorRole})`,
      timestamp: new Date().toISOString(),
      previousStatus,
      newStatus: decision,
      remarks: remarks.trim()
    })

    allClaims[idx] = claim
    this._setItem(STORAGE_KEYS.CLAIMS, allClaims)
    this._logAudit(`CLAIM_${decision.toUpperCase()}`, actorName, `Claim ${claimId} marked as ${decision}.`, {
      claimId,
      decision,
      remarks
    })
    this._notify()
    return claim
  }

  // =========================================================================
  // 3. REIMBURSEMENT & PAYMENT REGISTER
  // =========================================================================

  /**
   * Explicit reimbursement recording - requires claim to be in Approved status
   */
  recordReimbursementPayment(claimId, paymentData, actorUser = {}) {
    const allClaims = [...this._getItem(STORAGE_KEYS.CLAIMS, [])]
    const idx = allClaims.findIndex((c) => c.claimId === claimId)
    if (idx === -1) throw new Error(`Claim ${claimId} not found.`)

    const claim = allClaims[idx]

    // Mandatory rule: Claim must be Approved
    if (claim.approvalStatus !== 'Approved') {
      throw new Error(`Cannot disburse reimbursement: Claim ${claimId} is ${claim.approvalStatus}, not Approved.`)
    }

    const payAmount = Number(paymentData.amount)
    if (!payAmount || payAmount <= 0) {
      throw new Error('Valid disbursement amount greater than 0 PKR is required.')
    }
    if (payAmount > claim.remainingPayable) {
      throw new Error(
        `Overpayment prevented: Requested amount PKR ${payAmount.toLocaleString()} exceeds remaining payable balance of PKR ${claim.remainingPayable.toLocaleString()}.`
      )
    }

    const transactionRef = (paymentData.transactionReference || `TXN-EXP-${Date.now()}`).trim()

    // Prevent duplicate transaction reference
    const duplicateTxn = allClaims.some((c) =>
      c.reimbursements && c.reimbursements.some((r) => r.transactionReference === transactionRef && !r.isReversed)
    )
    if (duplicateTxn) {
      throw new Error(`Duplicate transaction reference "${transactionRef}" already recorded.`)
    }

    const reimbursementRecord = {
      reimbursementId: `REIMB-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
      paymentDate: paymentData.paymentDate || new Date().toISOString().slice(0, 10),
      amount: payAmount,
      paymentMethod: paymentData.paymentMethod || 'Bank Transfer',
      bankAccountReference: paymentData.bankAccountReference || claim.requestedReimbursementAccount,
      transactionReference: transactionRef,
      paidBy: actorUser.name || 'Authorized Finance Officer',
      notes: paymentData.notes ? paymentData.notes.trim() : 'Reimbursement payment processed.',
      isReversed: false
    }

    claim.reimbursements.push(reimbursementRecord)
    claim.paidAmount = (claim.paidAmount || 0) + payAmount
    claim.remainingPayable = Math.max(claim.amount - claim.paidAmount, 0)

    if (claim.remainingPayable === 0) {
      claim.paymentStatus = 'Paid'
    } else {
      claim.paymentStatus = 'Partially Paid'
    }

    claim.auditHistory.push({
      action: 'Reimbursement Payment Recorded',
      actor: actorUser.name || 'Finance Officer',
      timestamp: new Date().toISOString(),
      remarks: `Paid PKR ${payAmount.toLocaleString()} via ${reimbursementRecord.paymentMethod} (Ref: ${transactionRef}). Remaining payable: PKR ${claim.remainingPayable.toLocaleString()}.`
    })

    allClaims[idx] = claim
    this._setItem(STORAGE_KEYS.CLAIMS, allClaims)
    this._logAudit('REIMBURSEMENT_PAID', actorUser.name || 'Finance', `Disbursed PKR ${payAmount} for claim ${claimId}.`, {
      claimId,
      amount: payAmount,
      transactionReference: transactionRef
    })
    this._notify()
    return claim
  }

  /**
   * Reversal of reimbursement payment - preserves original transaction
   */
  reverseReimbursementPayment(claimId, reimbursementId, reason, actorUser = {}) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Mandatory audit reason (min 5 characters) required for payment reversal.')
    }

    const allClaims = [...this._getItem(STORAGE_KEYS.CLAIMS, [])]
    const idx = allClaims.findIndex((c) => c.claimId === claimId)
    if (idx === -1) throw new Error(`Claim ${claimId} not found.`)

    const claim = allClaims[idx]
    const rIdx = claim.reimbursements.findIndex((r) => r.reimbursementId === reimbursementId)
    if (rIdx === -1) throw new Error(`Reimbursement record ${reimbursementId} not found.`)

    const targetReimb = claim.reimbursements[rIdx]
    if (targetReimb.isReversed) {
      throw new Error('This reimbursement has already been reversed.')
    }

    targetReimb.isReversed = true
    targetReimb.reversedAt = new Date().toISOString()
    targetReimb.reversedBy = actorUser.name || 'Authorized Supervisor'
    targetReimb.reversalReason = reason.trim()

    claim.paidAmount = Math.max((claim.paidAmount || 0) - targetReimb.amount, 0)
    claim.remainingPayable = claim.amount - claim.paidAmount

    if (claim.paidAmount === 0) {
      claim.paymentStatus = 'Payment Pending'
    } else {
      claim.paymentStatus = 'Partially Paid'
    }

    claim.auditHistory.push({
      action: 'Reimbursement Reversed',
      actor: actorUser.name || 'Supervisor',
      timestamp: new Date().toISOString(),
      remarks: `Reversed payment of PKR ${targetReimb.amount.toLocaleString()}. Reason: ${reason.trim()}`
    })

    allClaims[idx] = claim
    this._setItem(STORAGE_KEYS.CLAIMS, allClaims)
    this._logAudit('REIMBURSEMENT_REVERSED', actorUser.name || 'Supervisor', `Reversed PKR ${targetReimb.amount} for claim ${claimId}.`, {
      claimId,
      reimbursementId,
      reason
    })
    this._notify()
    return claim
  }

  // =========================================================================
  // 4. TRAVEL EXPENSE RECONCILIATION BRIDGE (F10 Integration)
  // =========================================================================

  _normalizeReconciliationFromRaw(trv, allClaims = [], f10ExpensesMap = new Map()) {
    const rawStatus = String(trv.rawStatus || trv.status || 'Pending').toUpperCase()
    const isEligible = ['APPROVED', 'COMPLETED'].includes(rawStatus)
    const tripCode = trv.requestId || trv.requestCode
    const tripCuid = trv.id
    const f10Exp = f10ExpensesMap.get(tripCode) || f10ExpensesMap.get(tripCuid) || null

    const linkedClaims = allClaims.filter(
      (c) => (c.relatedTravelRequestId && c.relatedTravelRequestId === tripCode) || (tripCuid && c.travelRequestId === tripCuid)
    )
    const activeF12Claims = linkedClaims.filter(
      (c) => !['REJECTED', 'DRAFT', 'CANCELLED'].includes(String(c.approvalStatus || c.status || '').toUpperCase())
    )
    const approvedF12Claims = activeF12Claims.filter((c) => {
      const s = String(c.approvalStatus || c.status || '').toUpperCase()
      return ['APPROVED', 'MANAGER_APPROVED', 'HR_APPROVED', 'DISBURSED'].includes(s)
    })
    const pendingF12Claims = activeF12Claims.filter((c) => {
      const s = String(c.approvalStatus || c.status || '').toUpperCase()
      return !['APPROVED', 'MANAGER_APPROVED', 'HR_APPROVED', 'DISBURSED'].includes(s)
    })

    const f12SubmittedTotal = activeF12Claims.reduce((sum, c) => sum + Number(c.amount || 0), 0)
    const f12ApprovedTotal = approvedF12Claims.reduce((sum, c) => sum + Number(c.amount || 0), 0)
    const f12DisbursedSurplus = approvedF12Claims.reduce((sum, c) => {
      const s = String(c.status || '').toUpperCase()
      const paid = s === 'DISBURSED' || c.paymentStatus === 'Paid'
      return paid ? sum + Number(c.netPayableAmount ?? c.paidAmount ?? 0) : sum
    }, 0)

    // Strict F10 fields: NEVER fall back to requestedAdvance / advanceAmount
    const f10Disbursed = Number(f10Exp?.disbursedAdvance ?? trv.disbursedAdvance ?? 0)
    const f10Submitted = Number(f10Exp?.employeeSubmittedExpenses ?? trv.employeeSubmittedExp ?? 0)
    const f10Approved = Number(f10Exp?.approvedExpenses ?? trv.approvedExpenses ?? 0)
    const f10ReceiptRefs = Array.isArray(f10Exp?.expenseReceiptReferences)
      ? f10Exp.expenseReceiptReferences
      : (Array.isArray(trv.expenseReceiptRefs) ? trv.expenseReceiptRefs : [])
    const f10Status = String(f10Exp?.settlementStatus || trv.settlementStatus || 'Not Initialized')
    const f10Settled = f10Status === 'Settled'
    const reconciledAt = f10Exp?.reconciledAt || (trv.reconciledAt ? String(trv.reconciledAt).slice(0, 10) : null)
    const hasF10Reconciliation = Boolean(reconciledAt) || f10Settled || f10Status === 'Pending Final Settlement'
    const hasF10Claim = Boolean(f10Exp?.claimSubmittedAt || trv.claimSubmittedAt) || f10Submitted > 0 || f10ReceiptRefs.length > 0

    const disbursedAdvance = isEligible ? f10Disbursed : 0
    const totalSubmittedClaims = isEligible ? Math.max(f10Submitted, f12SubmittedTotal) : 0
    const totalApprovedClaims = isEligible ? Math.max(f10Approved, f12ApprovedTotal) : 0

    const rawBalance = isEligible ? (totalApprovedClaims - disbursedAdvance) : 0
    const netSettlementBalance = isEligible
      ? (f10Settled
          ? Number(f10Exp?.settlementBalance ?? trv.settlementBalance ?? 0)
          : (rawBalance > 0 ? Math.max(rawBalance - f12DisbursedSurplus, 0) : rawBalance))
      : 0

    const hasPendingClaims =
      isEligible &&
      (pendingF12Claims.length > 0 || (hasF10Claim && !hasF10Reconciliation && totalSubmittedClaims > totalApprovedClaims))
    const hasFinancialActivity =
      isEligible &&
      (disbursedAdvance > 0 ||
        totalSubmittedClaims > 0 ||
        totalApprovedClaims > 0 ||
        hasF10Claim ||
        hasF10Reconciliation ||
        activeF12Claims.length > 0)

    let isSettled = false
    let isReconciled = false
    let reconciliationStatus = 'Not Initialized'

    if (!isEligible) {
      if (rawStatus === 'DRAFT' || rawStatus === 'RETURNED') {
        reconciliationStatus = 'Draft (Not Eligible)'
      } else if (rawStatus === 'REJECTED') {
        reconciliationStatus = 'Rejected (Excluded)'
      } else if (rawStatus === 'CANCELLED') {
        reconciliationStatus = 'Cancelled (Excluded)'
      } else {
        reconciliationStatus = 'Awaiting Trip Approval'
      }
    } else if (
      f10Settled ||
      (hasF10Reconciliation && netSettlementBalance === 0 && !hasPendingClaims) ||
      (f12DisbursedSurplus > 0 && netSettlementBalance === 0 && !hasPendingClaims && totalApprovedClaims > 0)
    ) {
      isSettled = true
      isReconciled = true
      reconciliationStatus = f10Settled || f12DisbursedSurplus > 0 ? 'Settled' : 'Reconciled & Balanced'
    } else if (hasPendingClaims) {
      reconciliationStatus = 'Claims Under Verification'
    } else if (disbursedAdvance > 0 && totalSubmittedClaims === 0 && totalApprovedClaims === 0) {
      reconciliationStatus = 'Advance Disbursed (Awaiting Claims)'
    } else if (!hasFinancialActivity) {
      reconciliationStatus = 'Not Initialized'
    } else if (netSettlementBalance > 0) {
      isReconciled = hasF10Reconciliation || approvedF12Claims.length > 0
      reconciliationStatus = 'Reimbursement Payable to Staff'
    } else if (netSettlementBalance < 0) {
      isReconciled = hasF10Reconciliation || approvedF12Claims.length > 0
      reconciliationStatus = 'Surplus Advance Return Due'
    } else if (netSettlementBalance === 0 && totalApprovedClaims > 0) {
      isSettled = true
      isReconciled = true
      reconciliationStatus = 'Reconciled & Balanced'
    }

    const empName =
      trv.employeeName ||
      `${trv.employee?.firstName || ''} ${trv.employee?.lastName || ''}`.trim() ||
      'Staff Member'
    const depDate = trv.departureDate ? String(trv.departureDate).slice(0, 10) : ''
    const retDate = trv.returnDate ? String(trv.returnDate).slice(0, 10) : ''

    return {
      id: tripCuid,
      tripId: tripCode,
      requestCode: tripCode,
      expenseCode: f10Exp?.expenseId || trv.expenseCode || (hasFinancialActivity ? `TRV-EXP-${tripCode}` : null),
      requestStatus: trv.requestStatus || trv.status || 'Pending',
      rawStatus,
      isEligibleForReconciliation: isEligible,
      employeeId: trv.employee?.employeeCode || trv.employeeId || trv.employeeCode,
      employeeCuid: trv.employeeId,
      employeeName: empName,
      destination: trv.destination,
      travelDates: depDate && retDate ? `${depDate} to ${retDate}` : 'Dates TBD',
      approvedBudget: Number(trv.estimatedBudget || 0),
      requestedAdvance: Number(trv.requestedAdvance ?? trv.advanceAmount ?? 0),
      disbursedAdvance,
      advanceDisbursedRef: f10Exp?.advanceDisbursedReference || trv.advanceDisbursedRef || null,
      totalSubmittedClaims,
      totalApprovedClaims,
      netSettlementBalance,
      reconciliationStatus,
      isReconciled,
      isSettled,
      hasFinancialActivity,
      reconciledAt,
      reconciledBy: f10Exp?.reconciledBy || trv.reconciledBy || null,
      reconciliationNotes: f10Exp?.notes || trv.reconciliationNotes || null,
      f10SettlementStatus: f10Status,
      f10ReceiptReferences: f10ReceiptRefs,
      linkedClaimCount: activeF12Claims.length,
      linkedClaimNumbers: activeF12Claims.map((c) => c.claimId || c.claimNumber),
      reconciliationSource:
        activeF12Claims.length > 0 && hasF10Reconciliation
          ? 'F10 + F12 Verified'
          : activeF12Claims.length > 0
            ? 'F12 Claims Bridge'
            : hasF10Reconciliation || hasF10Claim || disbursedAdvance > 0
              ? 'F10 Travel Settlement'
              : 'Not Initialized',
      claims: linkedClaims
    }
  }

  _getAllReconciliationItems(requestingUser = {}) {
    const backendRecon = this._getItem(STORAGE_KEYS.TRAVEL_RECONCILIATIONS, null)
    const role = (requestingUser.role || 'employee').toLowerCase()

    if (Array.isArray(backendRecon) && backendRecon.length > 0) {
      let rows = backendRecon
      if (role === 'employee') {
        rows = rows.filter((r) => this.isClaimOwnedByUser(r, requestingUser))
      }
      return rows
    }

    const backendTravel = this._getItem(STORAGE_KEYS.TRAVEL_REQUESTS, null)
    const hasBackendTravel = Array.isArray(backendTravel) && backendTravel.length > 0
    const travelRequests = hasBackendTravel
      ? backendTravel
      : (travelService?.getTravelRequests?.({}, requestingUser) || [])
    const allClaims = this.getExpenseClaims({}, requestingUser)
    const f10Map = new Map()
    if (!hasBackendTravel) {
      const f10List = travelService?.getTravelExpenses?.({}, requestingUser) || []
      f10List.forEach((e) => {
        if (e.requestId) f10Map.set(e.requestId, e)
        if (e.requestCuid) f10Map.set(e.requestCuid, e)
      })
    }

    return travelRequests.map((trv) => this._normalizeReconciliationFromRaw(trv, allClaims, f10Map))
  }

  getTravelReconciliationExcludedCounts(requestingUser = {}) {
    const all = this._getAllReconciliationItems(requestingUser)
    const excluded = all.filter((r) => !r.isEligibleForReconciliation)
    return {
      total: excluded.length,
      draft: excluded.filter((r) => ['DRAFT', 'RETURNED'].includes(r.rawStatus)).length,
      rejected: excluded.filter((r) => r.rawStatus === 'REJECTED').length,
      cancelled: excluded.filter((r) => r.rawStatus === 'CANCELLED').length,
      pendingApproval: excluded.filter((r) => ['PENDING', 'UNDER_REVIEW'].includes(r.rawStatus)).length
    }
  }

  getTravelExpenseReconciliations(filters = {}, requestingUser = {}) {
    let items = this._getAllReconciliationItems(requestingUser)
    if (!filters.includeIneligible) {
      items = items.filter((r) => r.isEligibleForReconciliation)
    }
    if (filters.status && filters.status !== 'all') {
      items = items.filter((r) => String(r.reconciliationStatus || '').toLowerCase() === String(filters.status).toLowerCase())
    }
    return items
  }

  // =========================================================================
  // 5. METRICS & AUDIT LOGS
  // =========================================================================

  getExpenseSummaryMetrics(filters = {}, requestingUser = {}) {
    const claims = this.getExpenseClaims(filters, requestingUser)

    const totalClaimsCount = claims.length
    const pendingApprovalCount = claims.filter((c) => ['Submitted', 'Under Review'].includes(c.approvalStatus)).length
    const approvedClaims = claims.filter((c) => c.approvalStatus === 'Approved')
    const totalApprovedAmount = approvedClaims.reduce((sum, c) => sum + c.amount, 0)
    const pendingReimbursementAmount = approvedClaims.reduce((sum, c) => sum + (c.remainingPayable || 0), 0)
    const totalReimbursedAmount = approvedClaims.reduce((sum, c) => sum + (c.paidAmount || 0), 0)

    // Category distribution
    const categoryTotals = {}
    claims.forEach((c) => {
      categoryTotals[c.category] = (categoryTotals[c.category] || 0) + c.amount
    })

    return {
      totalClaimsCount,
      pendingApprovalCount,
      totalApprovedAmount,
      pendingReimbursementAmount,
      totalReimbursedAmount,
      categoryTotals
    }
  }

  getAuditLogs(requestingUser = {}) {
    return this._getItem(STORAGE_KEYS.AUDIT_LOGS, [])
  }

  _logAudit(action, actor, summary, metadata = {}) {
    const logs = [...this._getItem(STORAGE_KEYS.AUDIT_LOGS, [])]
    logs.unshift({
      id: `AUDIT-EXP-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
      action,
      actor,
      summary,
      metadata,
      timestamp: new Date().toISOString()
    })
    // Keep last 300 logs
    if (logs.length > 300) logs.length = 300
    this._setItem(STORAGE_KEYS.AUDIT_LOGS, logs)
  }

  // =========================================================================
  // 6. POSTGRESQL BACKEND ASYNC INTEGRATION
  // =========================================================================

  _unwrapList(res) {
    if (Array.isArray(res)) return res
    if (Array.isArray(res?.data)) return res.data
    return []
  }

  _unwrapItem(res) {
    if (!res) return null
    if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data
    return res
  }

  _normalizeCategory(c) {
    const perClaim = Number(c.perClaimLimit ?? c.maxLimit ?? 15000)
    const name = c.categoryName || c.name || c.code || ''
    return {
      ...c,
      categoryId: c.categoryId || c.code,
      code: String(c.code || '').toUpperCase(),
      name,
      categoryName: name,
      description: c.description || `Corporate policy for ${name}`,
      maxLimit: perClaim,
      perClaimLimit: perClaim,
      dailyLimit: Number(c.dailyLimit ?? perClaim),
      monthlyLimit: Number(c.monthlyLimit ?? perClaim * 3),
      receiptRequired: Boolean(c.receiptRequired),
      receiptRequiredThreshold:
        c.receiptRequiredThreshold !== undefined && c.receiptRequiredThreshold !== null
          ? Number(c.receiptRequiredThreshold)
          : (c.receiptRequired ? 0 : 1000),
      requiresTravelRequestRef: Boolean(c.requiresTravelRequestRef),
      isActive: c.isActive !== false
    }
  }

  _normalizeClaim(c) {
    if (!c) return c
    return {
      ...c,
      id: c.id,
      claimId: c.claimId || c.claimNumber,
      claimNumber: c.claimNumber || c.claimId,
      employeeId: c.employeeCuid || c.employeeId || c.employee?.id,
      employeeCuid: c.employeeCuid || c.employeeId || c.employee?.id,
      employeeCode: c.employeeCode || c.employee?.employeeCode || null,
      employeeName: c.employeeName || `${c.employee?.firstName || ''} ${c.employee?.lastName || ''}`.trim() || 'Staff Member',
      department: c.department || c.employee?.department?.name || 'General',
      category: c.category || c.items?.[0]?.category || 'Other Expenses',
      categoryId: c.categoryId || c.items?.[0]?.category || 'OTHER',
      amount: Number(c.amount ?? c.totalAmount ?? 0),
      paidAmount: Number(c.paidAmount ?? 0),
      remainingPayable: Number(c.remainingPayable ?? c.netPayableAmount ?? 0),
      expenseDate: c.expenseDate ? String(c.expenseDate).slice(0, 10) : String(c.submissionDate || new Date().toISOString()).slice(0, 10),
      submissionDate: c.submissionDate ? String(c.submissionDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: c.description || c.claimTitle || '',
      reimbursements: Array.isArray(c.reimbursements) ? c.reimbursements : [],
      auditHistory: Array.isArray(c.auditHistory) ? c.auditHistory : []
    }
  }

  _upsertLocalClaim(claim) {
    if (!claim) return claim
    const normalized = this._normalizeClaim(claim)
    const list = [...this._getItem(STORAGE_KEYS.CLAIMS, [])]
    const idx = list.findIndex((c) => c.claimId === normalized.claimId || (normalized.id && c.id === normalized.id))
    if (idx >= 0) list[idx] = normalized
    else list.unshift(normalized)
    this._setItem(STORAGE_KEYS.CLAIMS, list)
    this._notify()
    return normalized
  }

  getAvailableTravelRequests(currentUser = {}) {
    const backendTravel = this._getItem(STORAGE_KEYS.TRAVEL_REQUESTS, null)
    const list = Array.isArray(backendTravel) && backendTravel.length > 0
      ? backendTravel
      : (travelService?.getTravelRequests?.() || [])
    return list
      .filter((t) => ['Approved', 'Completed', 'APPROVED', 'COMPLETED'].includes(t.status))
      .filter((t) => String(t.settlementStatus || '').trim() !== 'Settled')
      .filter((t) => {
        if (String(currentUser?.role || '').toLowerCase() === 'super_admin') return true
        return this.isClaimOwnedByUser(t, currentUser)
      })
      .map((t) => ({
        ...t,
        requestId: t.requestId || t.requestCode,
        departureDate: t.departureDate ? String(t.departureDate).slice(0, 10) : ''
      }))
  }

  async _refreshTravelReconciliationsSafeAsync() {
    try {
      const res = await apiClient.get('/expenses/travel/reconciliations?includeIneligible=true')
      this._setItem(STORAGE_KEYS.TRAVEL_RECONCILIATIONS, this._unwrapList(res))
      this._notify()
    } catch {
      // Non-fatal fallback
    }
  }

  async _refreshAuditLogsSafeAsync() {
    try {
      const res = await apiClient.get('/expenses/audit-logs')
      this._setItem(STORAGE_KEYS.AUDIT_LOGS, this._unwrapList(res))
      this._notify()
    } catch {
      // Employee role does not have company audit endpoint access
    }
  }

  async loadExpensesDataAsync() {
    const [catRes, polRes, claimRes, trvRes, reconRes, auditRes] = await Promise.allSettled([
      apiClient.get('/expenses/categories'),
      apiClient.get('/expenses/policies'),
      apiClient.get('/expenses/claims'),
      apiClient.get('/expenses/travel/requests'),
      apiClient.get('/expenses/travel/reconciliations?includeIneligible=true'),
      apiClient.get('/expenses/audit-logs')
    ])

    if (catRes.status === 'fulfilled') {
      this._setItem(STORAGE_KEYS.CATEGORIES, this._unwrapList(catRes.value).map((c) => this._normalizeCategory(c)))
    }
    if (polRes.status === 'fulfilled' && polRes.value) {
      const pol = this._unwrapItem(polRes.value)
      this._setItem(STORAGE_KEYS.AUTHORITY_LIMITS, {
        managerMaxLimit: Number(pol.managerMaxLimit ?? pol.managerLimit ?? 0),
        hrAdminMaxLimit: Number(pol.hrAdminMaxLimit ?? pol.hrAdminLimit ?? 0),
        superAdminThreshold: Number(pol.superAdminThreshold ?? pol.superAdminRequiredAbove ?? 0)
      })
    }
    if (claimRes.status === 'fulfilled') {
      this._setItem(STORAGE_KEYS.CLAIMS, this._unwrapList(claimRes.value).map((c) => this._normalizeClaim(c)))
    }
    if (trvRes.status === 'fulfilled') {
      this._setItem(STORAGE_KEYS.TRAVEL_REQUESTS, this._unwrapList(trvRes.value))
    }
    if (reconRes.status === 'fulfilled') {
      this._setItem(STORAGE_KEYS.TRAVEL_RECONCILIATIONS, this._unwrapList(reconRes.value))
    }
    if (auditRes.status === 'fulfilled') {
      this._setItem(STORAGE_KEYS.AUDIT_LOGS, this._unwrapList(auditRes.value))
    }
    this._notify()
    return {
      categories: this.getExpenseCategories(),
      claims: this._getItem(STORAGE_KEYS.CLAIMS, []),
      limits: this.getFinancialAuthorityLimits(),
      auditLogs: this.getAuditLogs()
    }
  }

  async createExpenseClaimAsync(claimData, actorUser = {}) {
    const payload = {
      employeeId: claimData.employeeId || actorUser?.employeeId || actorUser?.id,
      categoryId: claimData.categoryId || claimData.category,
      category: claimData.category || claimData.categoryId,
      expenseDate: claimData.expenseDate,
      amount: Number(claimData.amount),
      description: claimData.description ? String(claimData.description).trim() : '',
      claimTitle: claimData.claimTitle || (claimData.description ? String(claimData.description).trim() : ''),
      receiptReference: claimData.receiptReference ? String(claimData.receiptReference).trim() : '',
      receiptFileName: claimData.receiptFileName || null,
      projectClient: claimData.projectClient ? String(claimData.projectClient).trim() : '',
      relatedTravelRequestId: claimData.relatedTravelRequestId || claimData.travelRequestId || null,
      paymentMethodUsed: claimData.paymentMethodUsed || 'Cash'
    }
    const res = await apiClient.post('/expenses/claims', payload)
    const saved = this._upsertLocalClaim(this._unwrapItem(res))
    await Promise.all([this._refreshAuditLogsSafeAsync(), this._refreshTravelReconciliationsSafeAsync()])
    return saved
  }

  async reviewExpenseClaimAsync(claimId, decision, remarks) {
    const res = await apiClient.patch(`/expenses/claims/${encodeURIComponent(claimId)}/review`, {
      action: decision,
      decision,
      remarks
    })
    const updated = this._upsertLocalClaim(this._unwrapItem(res))
    await Promise.all([this._refreshAuditLogsSafeAsync(), this._refreshTravelReconciliationsSafeAsync()])
    return updated
  }

  async recordReimbursementPaymentAsync(claimId, paymentData) {
    const res = await apiClient.post(`/expenses/claims/${encodeURIComponent(claimId)}/disburse`, {
      amount: Number(paymentData.amount),
      paymentMethod: paymentData.paymentMethod,
      transactionReference: paymentData.transactionReference,
      paymentDate: paymentData.paymentDate || new Date().toISOString().slice(0, 10),
      paymentAccount: paymentData.bankAccountReference || 'Corporate Primary Disbursement A/C',
      notes: paymentData.notes
    })
    const updated = this._upsertLocalClaim(this._unwrapItem(res))
    await Promise.all([this._refreshAuditLogsSafeAsync(), this._refreshTravelReconciliationsSafeAsync()])
    return updated
  }

  async reverseReimbursementPaymentAsync(claimId, reimbursementId, reason) {
    const res = await apiClient.post(`/expenses/claims/${encodeURIComponent(claimId)}/reverse`, {
      reimbursementId,
      reason
    })
    const updated = this._upsertLocalClaim(this._unwrapItem(res))
    await Promise.all([this._refreshAuditLogsSafeAsync(), this._refreshTravelReconciliationsSafeAsync()])
    return updated
  }

  async addExpenseCategoryAsync(categoryData) {
    const res = await apiClient.post('/expenses/categories', {
      code: categoryData.code,
      name: categoryData.categoryName || categoryData.name,
      categoryName: categoryData.categoryName || categoryData.name,
      description: categoryData.description,
      maxLimit: Number(categoryData.perClaimLimit ?? categoryData.maxLimit ?? 15000),
      perClaimLimit: Number(categoryData.perClaimLimit ?? categoryData.maxLimit ?? 15000),
      dailyLimit: Number(categoryData.dailyLimit ?? categoryData.perClaimLimit ?? 15000),
      monthlyLimit: Number(categoryData.monthlyLimit ?? 50000),
      receiptRequired: Boolean(categoryData.receiptRequired ?? true),
      receiptRequiredThreshold:
        categoryData.receiptRequiredThreshold !== undefined && categoryData.receiptRequiredThreshold !== ''
          ? Number(categoryData.receiptRequiredThreshold)
          : undefined,
      requiresTravelRequestRef: Boolean(categoryData.requiresTravelRequestRef),
      isActive: categoryData.isActive !== false
    })
    const created = this._normalizeCategory(this._unwrapItem(res))
    const list = [...this.getExpenseCategories()]
    list.push(created)
    this._setItem(STORAGE_KEYS.CATEGORIES, list)
    await this._refreshAuditLogsSafeAsync()
    this._notify()
    return created
  }

  async updateExpenseCategoryAsync(code, updateData) {
    const res = await apiClient.patch(`/expenses/categories/${encodeURIComponent(code)}`, updateData)
    const updated = this._normalizeCategory(this._unwrapItem(res))
    const list = this.getExpenseCategories().map((c) => (c.code === updated.code ? updated : c))
    this._setItem(STORAGE_KEYS.CATEGORIES, list)
    await this._refreshAuditLogsSafeAsync()
    this._notify()
    return updated
  }

  async deleteExpenseCategoryAsync(code) {
    const res = await apiClient.delete(`/expenses/categories/${encodeURIComponent(code)}`)
    const list = this.getExpenseCategories().filter((c) => c.code !== String(code).toUpperCase())
    this._setItem(STORAGE_KEYS.CATEGORIES, list)
    await this._refreshAuditLogsSafeAsync()
    this._notify()
    return this._unwrapItem(res)
  }
}

export const expenseService = new ExpenseService()
export default expenseService
