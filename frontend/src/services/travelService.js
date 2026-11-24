/**
 * iSysware HRMS — Batch F10: Travel & Pick-and-Drop Management Service
 * Authoritative orchestrator for:
 * - Official Travel Requests, Multi-tier Approvals & Anti-Self-Approval
 * - Confirmed Travel Plans & Manual Booking References
 * - Travel Advance Disbursements & Expense Reconciliations (Distinct from F12)
 * - Corporate Pick-and-Drop Transport Roster & Route Capacity Control
 * - Fleet Vehicles, Drivers & Transport Routes Master
 * - Integration with F04 Attendance (Controlled Field Duty Reference)
 */

import {
  INITIAL_VEHICLES,
  INITIAL_DRIVERS,
  INITIAL_ROUTES,
  INITIAL_TRANSPORT_ASSIGNMENTS,
  INITIAL_TRAVEL_REQUESTS,
  INITIAL_TRAVEL_PLANS,
  INITIAL_TRAVEL_EXPENSES
} from '../mocks/travelData.js'
import { employeeService } from './employeeService.js'
import apiClient from './apiClient.js'

const STORAGE_KEYS = {
  VEHICLES: 'isysware_hrms_f10_vehicles_v1',
  DRIVERS: 'isysware_hrms_f10_drivers_v1',
  ROUTES: 'isysware_hrms_f10_routes_v1',
  ASSIGNMENTS: 'isysware_hrms_f10_assignments_v1',
  REQUESTS: 'isysware_hrms_f10_requests_v1',
  PLANS: 'isysware_hrms_f10_plans_v1',
  EXPENSES: 'isysware_hrms_f10_expenses_v1',
  AUDIT_LOGS: 'isysware_hrms_f10_audit_logs_v1'
}

const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)

class TravelService {
  constructor() {
    this.listeners = new Set()
    this.memoryStorage = {}
    this._loadPromise = null
    this._initialize()
  }

  _getItem(key, defaultVal) {
    if (this.memoryStorage[key] !== undefined) return this.memoryStorage[key]
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(key)
        return item ? JSON.parse(item) : defaultVal
      } catch {
        // Fallback
      }
    }
    return defaultVal !== undefined ? defaultVal : []
  }

  _setItem(key, value) {
    this.memoryStorage[key] = value
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Fallback
      }
    }
  }

  _initialize() {
    const existingVehicles = this._getItem(STORAGE_KEYS.VEHICLES, null)
    if (!existingVehicles || existingVehicles.length === 0) {
      this._setItem(STORAGE_KEYS.VEHICLES, JSON.parse(JSON.stringify(INITIAL_VEHICLES)))
    }
    const existingDrivers = this._getItem(STORAGE_KEYS.DRIVERS, null)
    if (!existingDrivers || existingDrivers.length === 0) {
      this._setItem(STORAGE_KEYS.DRIVERS, JSON.parse(JSON.stringify(INITIAL_DRIVERS)))
    }
    const existingRoutes = this._getItem(STORAGE_KEYS.ROUTES, null)
    if (!existingRoutes || existingRoutes.length === 0) {
      this._setItem(STORAGE_KEYS.ROUTES, JSON.parse(JSON.stringify(INITIAL_ROUTES)))
    }
    const existingAssignments = this._getItem(STORAGE_KEYS.ASSIGNMENTS, null)
    if (!existingAssignments || existingAssignments.length === 0) {
      this._setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.parse(JSON.stringify(INITIAL_TRANSPORT_ASSIGNMENTS)))
    }
    const existingRequests = this._getItem(STORAGE_KEYS.REQUESTS, null)
    if (!existingRequests || existingRequests.length === 0) {
      this._setItem(STORAGE_KEYS.REQUESTS, JSON.parse(JSON.stringify(INITIAL_TRAVEL_REQUESTS)))
    }
    const existingPlans = this._getItem(STORAGE_KEYS.PLANS, null)
    if (!existingPlans || existingPlans.length === 0) {
      this._setItem(STORAGE_KEYS.PLANS, JSON.parse(JSON.stringify(INITIAL_TRAVEL_PLANS)))
    }
    const existingExpenses = this._getItem(STORAGE_KEYS.EXPENSES, null)
    if (!existingExpenses || existingExpenses.length === 0) {
      this._setItem(STORAGE_KEYS.EXPENSES, JSON.parse(JSON.stringify(INITIAL_TRAVEL_EXPENSES)))
    }
    if (!this._getItem(STORAGE_KEYS.AUDIT_LOGS, null)) {
      this._setItem(STORAGE_KEYS.AUDIT_LOGS, [])
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
        console.error('Error in travelService listener:', err)
      }
    }
  }

  resetToDefaults() {
    this._setItem(STORAGE_KEYS.VEHICLES, JSON.parse(JSON.stringify(isTest ? INITIAL_VEHICLES : [])))
    this._setItem(STORAGE_KEYS.DRIVERS, JSON.parse(JSON.stringify(isTest ? INITIAL_DRIVERS : [])))
    this._setItem(STORAGE_KEYS.ROUTES, JSON.parse(JSON.stringify(isTest ? INITIAL_ROUTES : [])))
    this._setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.parse(JSON.stringify(isTest ? INITIAL_TRANSPORT_ASSIGNMENTS : [])))
    this._setItem(STORAGE_KEYS.REQUESTS, JSON.parse(JSON.stringify(isTest ? INITIAL_TRAVEL_REQUESTS : [])))
    this._setItem(STORAGE_KEYS.PLANS, JSON.parse(JSON.stringify(isTest ? INITIAL_TRAVEL_PLANS : [])))
    this._setItem(STORAGE_KEYS.EXPENSES, JSON.parse(JSON.stringify(isTest ? INITIAL_TRAVEL_EXPENSES : [])))
    this._notify()
  }

  // ==========================================
  // SUBMODULE 2: TRAVEL REQUESTS & APPROVALS
  // ==========================================

  getTravelRequests(filters = {}, requestingUser = null) {
    let list = [...this._getItem(STORAGE_KEYS.REQUESTS, isTest ? INITIAL_TRAVEL_REQUESTS : [])]

    const currentEmpId = requestingUser?.employeeId || requestingUser?.id

    // Role-based Scoping
    if (requestingUser?.role === 'employee') {
      list = list.filter((r) => r.employeeId === currentEmpId)
    } else if (requestingUser?.role === 'manager') {
      let directReports = []
      try {
        directReports = employeeService.getDirectReports(currentEmpId).map((e) => e.id || e.employeeId)
      } catch {
        directReports = []
      }
      list = list.filter(
        (r) =>
          r.employeeId === currentEmpId ||
          directReports.includes(r.employeeId) ||
          r.department === requestingUser.department
      )
    }
    // HR Admin and Super Admin have company-wide access

    const { status, destination, employeeId, search } = filters

    if (status && status !== 'all') {
      list = list.filter((r) => r.status.toLowerCase() === status.toLowerCase())
    }
    if (destination && destination !== 'all') {
      list = list.filter((r) => r.destination.toLowerCase().includes(destination.toLowerCase()))
    }
    if (employeeId) {
      list = list.filter((r) => r.employeeId === employeeId)
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.requestId.toLowerCase().includes(q) ||
          r.travelPurpose.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          r.employeeName.toLowerCase().includes(q) ||
          (r.clientReference && r.clientReference.toLowerCase().includes(q))
      )
    }

    return list
  }

  getTravelRequestById(requestId) {
    const list = this._getItem(STORAGE_KEYS.REQUESTS, isTest ? INITIAL_TRAVEL_REQUESTS : [])
    return list.find((r) => r.requestId === requestId || r.id === requestId) || null
  }

  _validateLocalRequestPayload(requestData, { requireComplete = true } = {}) {
    const travelPurpose = String(requestData.travelPurpose ?? requestData.purpose ?? '').trim()
    const destination = String(requestData.destination ?? '').trim()
    const departureDate = requestData.departureDate ? String(requestData.departureDate).slice(0, 10) : ''
    const returnDate = requestData.returnDate ? String(requestData.returnDate).slice(0, 10) : ''

    if (departureDate && returnDate && new Date(departureDate) > new Date(returnDate)) {
      throw new Error('Departure date cannot be after return date.')
    }

    const rawBudget = requestData.estimatedBudget
    const hasBudgetInput =
      rawBudget !== undefined &&
      rawBudget !== null &&
      String(rawBudget).trim() !== '' &&
      !(!requireComplete && Number(rawBudget) === 0)
    const numBudget = hasBudgetInput ? Number(rawBudget) : 0
    const numAdvance = Number(requestData.requestedAdvance ?? requestData.advanceAmount ?? 0) || 0

    if (Number.isNaN(numBudget) || numBudget < 0) {
      throw new Error('Estimated travel budget must be a valid non-negative amount.')
    }
    if (Number.isNaN(numAdvance) || numAdvance < 0) {
      throw new Error('Requested advance cannot be negative.')
    }
    if (hasBudgetInput && numAdvance > numBudget) {
      throw new Error('Requested travel advance cannot exceed total estimated budget.')
    }

    if (requireComplete) {
      if (!travelPurpose || travelPurpose.length < 3) {
        throw new Error('Travel purpose is required and must be at least 3 characters.')
      }
      if (!destination || destination.length < 2) {
        throw new Error('Destination is required.')
      }
      if (!departureDate || !returnDate) {
        throw new Error('Departure and return dates are required.')
      }
      if (numBudget <= 0) {
        throw new Error('Estimated travel budget must be greater than zero.')
      }
    }

    return {
      travelPurpose,
      destination,
      departureDate,
      returnDate,
      numBudget,
      numAdvance
    }
  }

  _findLocalActiveOverlap(list, employeeId, departureDate, returnDate, excludeRequestId = null) {
    if (!employeeId || !departureDate || !returnDate) return null
    const activeStatuses = new Set(['Submitted', 'Under Review', 'Approved'])
    return list.find((r) => {
      if (excludeRequestId && (r.requestId === excludeRequestId || r.id === excludeRequestId)) return false
      if (r.employeeId !== employeeId) return false
      if (!activeStatuses.has(r.status)) return false
      if (!r.departureDate || !r.returnDate) return false
      return (
        (departureDate >= r.departureDate && departureDate <= r.returnDate) ||
        (returnDate >= r.departureDate && returnDate <= r.returnDate) ||
        (departureDate <= r.departureDate && returnDate >= r.returnDate)
      )
    }) || null
  }

  createTravelRequest(requestData, actorUser) {
    const {
      clientReference,
      clientProjectRef,
      origin = 'iSysware HQ',
      departureTime = '09:00',
      returnTime = '18:00',
      travelMode = 'Flight',
      accommodationRequired = true,
      supportingNotes = ''
    } = requestData

    const actorRole = String(actorUser?.role || '').toLowerCase()
    const isSuperAdmin = actorRole === 'super_admin'
    const isDraft = String(requestData.status || '').toLowerCase() === 'draft'
    const wantsDirectApprove =
      Boolean(requestData.directApprove || requestData.autoApprove) ||
      String(requestData.status || '').toLowerCase() === 'approved'

    if (wantsDirectApprove && !isDraft && !isSuperAdmin) {
      throw new Error('Only Super Admin can directly authorize a travel request upon creation.')
    }

    const {
      travelPurpose,
      destination,
      departureDate,
      returnDate,
      numBudget,
      numAdvance
    } = this._validateLocalRequestPayload(requestData, { requireComplete: !isDraft })

    const targetEmpId = requestData.employeeId || actorUser?.employeeId || actorUser?.id || 'EMP-001'
    let emp = null
    try {
      emp = employeeService.getEmployeeById(targetEmpId)
    } catch {
      emp = null
    }

    const empName = requestData.employeeName || emp?.name || actorUser?.name || 'Employee'
    const empDept = requestData.department || emp?.department || actorUser?.department || 'General'

    const list = [...this._getItem(STORAGE_KEYS.REQUESTS, isTest ? INITIAL_TRAVEL_REQUESTS : [])]

    // Prevent overlapping active travel requests for the same employee whenever dates are set
    const activeOverlap = this._findLocalActiveOverlap(list, targetEmpId, departureDate, returnDate)
    if (activeOverlap) {
      throw new Error(
        `Overlapping travel conflict: Employee '${empName}' already has an active trip '${activeOverlap.requestId}' (${activeOverlap.status}) scheduled from ${activeOverlap.departureDate} to ${activeOverlap.returnDate}.`
      )
    }

    const nextSeq = list.length + 1
    const requestId = `TRV-${new Date().getFullYear()}-${String(nextSeq).padStart(3, '0')}`
    const isDirectApproved = isSuperAdmin && wantsDirectApprove && !isDraft
    const nowIso = new Date().toISOString()
    const actorId = actorUser?.employeeId || actorUser?.id
    const dutyDateCode = departureDate ? departureDate.replace(/-/g, '') : ''
    const historyEntries = [
      {
        action: isDraft ? 'Draft' : 'Submitted',
        by: actorUser?.name || emp?.name || 'Staff Member',
        remarks: isDraft ? 'Saved as travel draft' : 'Official trip request submitted',
        at: nowIso
      }
    ]
    if (isDirectApproved) {
      historyEntries.push({
        action: 'Approved',
        by: actorUser?.name || 'Super Admin',
        remarks: requestData.decisionRemarks || 'Directly authorized by Super Admin',
        at: nowIso
      })
    }

    const newRequest = {
      id: requestId,
      requestId,
      employeeId: targetEmpId,
      employeeName: empName,
      department: empDept,
      travelPurpose,
      clientReference: (clientReference || clientProjectRef)?.trim() || 'Internal Company Engagement',
      origin,
      destination,
      departureDate,
      departureTime,
      returnDate,
      returnTime,
      travelMode,
      accommodationRequired: Boolean(accommodationRequired),
      estimatedBudget: numBudget,
      requestedAdvance: numAdvance,
      supportingNotes: supportingNotes.trim(),
      status: isDraft ? 'Draft' : isDirectApproved ? 'Approved' : 'Submitted',
      submittedAt: nowIso,
      hasConflict: false,
      conflictWithCodes: [],
      overlappingDraftCodes: [],
      conflictMessage: null,
      approvalHistory: historyEntries,
      managerReviewerId: null,
      managerReviewerName: null,
      managerRemarks: null,
      managerReviewedAt: null,
      finalApproverId: isDirectApproved ? actorId : null,
      finalApproverName: isDirectApproved ? (actorUser?.name || 'Super Admin') : null,
      finalApprovalRemarks: isDirectApproved ? (requestData.decisionRemarks || 'Directly authorized by Super Admin') : null,
      finalApprovedAt: isDirectApproved ? nowIso : null,
      attendanceF04Ref: isDirectApproved ? `DUTY-FLD-${dutyDateCode}-${requestId}` : null
    }

    list.unshift(newRequest)
    this._setItem(STORAGE_KEYS.REQUESTS, list)
    if (isDirectApproved) {
      this._createInitialTravelExpense(newRequest)
    }
    this._notify()
    return newRequest
  }

  updateTravelRequest(requestId, patchData = {}, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.REQUESTS, isTest ? INITIAL_TRAVEL_REQUESTS : [])]
    const idx = list.findIndex((r) => r.requestId === requestId || r.id === requestId)
    if (idx === -1) throw new Error(`Travel request '${requestId}' not found.`)

    const req = { ...list[idx] }
    const role = String(actorUser?.role || '').toLowerCase()
    const isSuper = role === 'super_admin'
    const isHr = role === 'hr_admin'
    const actorId = actorUser?.employeeId || actorUser?.id
    const isOwner = req.employeeId === actorId

    if (!isOwner && !isHr && !isSuper) {
      throw new Error('Unauthorized to modify this travel request.')
    }
    const editable = (isSuper || isHr)
      ? ['Draft', 'Returned', 'Submitted', 'Under Review', ...(isSuper ? ['Approved'] : [])]
      : ['Draft', 'Returned', 'Submitted']
    if (!editable.includes(req.status)) {
      throw new Error(`Cannot edit travel request in status '${req.status}'.`)
    }

    const expenses = this._getItem(STORAGE_KEYS.EXPENSES, isTest ? INITIAL_TRAVEL_EXPENSES : [])
    const linkedExp = expenses.find((e) => e.requestId === req.requestId)
    const isSettled = req.settlementStatus === 'Settled' || linkedExp?.settlementStatus === 'Settled'
    if (isSettled) {
      throw new Error(`Travel request '${req.requestId}' is financially Settled and locked from edits.`)
    }

    const financialSnapshotLocked =
      req.status === 'Approved' &&
      (Number(req.disbursedAdvance || linkedExp?.disbursedAdvance || 0) > 0 ||
        Boolean(linkedExp?.reconciledAt || req.reconciledAt) ||
        Number(linkedExp?.approvedExpenses || req.approvedExpenses || 0) > 0)

    if (financialSnapshotLocked) {
      if (
        ('estimatedBudget' in patchData && patchData.estimatedBudget !== undefined && patchData.estimatedBudget !== null && Number(patchData.estimatedBudget) !== Number(req.estimatedBudget)) ||
        (('requestedAdvance' in patchData || 'advanceAmount' in patchData) &&
          Number(patchData.requestedAdvance ?? patchData.advanceAmount) !== Number(req.requestedAdvance))
      ) {
        throw new Error(
          `Cannot modify approved budget or advance on '${req.requestId}' after advance disbursement or reconciliation.`
        )
      }
    }

    const reqStatusRaw = String(patchData.status || '').toLowerCase()
    const wantsSubmit = reqStatusRaw === 'submitted' || reqStatusRaw === 'pending'
    const wantsDirectApprove = Boolean(patchData.directApprove || patchData.autoApprove) || reqStatusRaw === 'approved'
    if (wantsDirectApprove && !isSuper) {
      throw new Error('Only Super Admin can directly authorize a travel request.')
    }

    let nextStatus = req.status
    if (reqStatusRaw === 'draft') nextStatus = 'Draft'
    else if (wantsDirectApprove && isSuper) nextStatus = 'Approved'
    else if (wantsSubmit && ['Draft', 'Returned'].includes(req.status)) nextStatus = 'Submitted'

    const merged = {
      travelPurpose: ('travelPurpose' in patchData || 'purpose' in patchData)
        ? (patchData.travelPurpose ?? patchData.purpose)
        : req.travelPurpose,
      destination: 'destination' in patchData ? patchData.destination : req.destination,
      departureDate: 'departureDate' in patchData ? patchData.departureDate : req.departureDate,
      returnDate: 'returnDate' in patchData ? patchData.returnDate : req.returnDate,
      estimatedBudget: 'estimatedBudget' in patchData ? patchData.estimatedBudget : req.estimatedBudget,
      requestedAdvance: ('requestedAdvance' in patchData || 'advanceAmount' in patchData)
        ? (patchData.requestedAdvance ?? patchData.advanceAmount)
        : req.requestedAdvance
    }

    const validated = this._validateLocalRequestPayload(merged, { requireComplete: nextStatus !== 'Draft' })
    const datesChanged =
      (validated.departureDate || '') !== (req.departureDate || '') ||
      (validated.returnDate || '') !== (req.returnDate || '')

    if ((nextStatus !== 'Draft' || datesChanged) && validated.departureDate && validated.returnDate) {
      const overlap = this._findLocalActiveOverlap(list, req.employeeId, validated.departureDate, validated.returnDate, req.requestId)
      if (overlap) {
        throw new Error(
          `Overlapping travel conflict: Employee '${req.employeeName}' already has an active trip '${overlap.requestId}' (${overlap.status}) scheduled from ${overlap.departureDate} to ${overlap.returnDate}.`
        )
      }
    }

    const now = new Date().toISOString()
    req.travelPurpose = validated.travelPurpose
    req.destination = validated.destination
    req.departureDate = validated.departureDate
    req.returnDate = validated.returnDate
    req.estimatedBudget = validated.numBudget
    req.requestedAdvance = validated.numAdvance
    if ('departureTime' in patchData) req.departureTime = patchData.departureTime || '08:00 AM'
    if ('returnTime' in patchData) req.returnTime = patchData.returnTime || '08:00 PM'
    if ('travelMode' in patchData) req.travelMode = patchData.travelMode || 'Commercial Airline'
    if ('supportingNotes' in patchData) req.supportingNotes = patchData.supportingNotes || ''
    if ('clientProjectRef' in patchData || 'clientReference' in patchData) {
      req.clientReference = (patchData.clientProjectRef ?? patchData.clientReference) || 'Internal Company Engagement'
    }

    const prevStatus = req.status
    req.status = nextStatus
    req.approvalHistory = req.approvalHistory || []
    if (nextStatus === 'Submitted' && prevStatus !== 'Submitted') {
      req.approvalHistory.push({ action: 'Submitted', by: actorUser?.name || 'Requester', remarks: 'Draft submitted for review', at: now })
    } else if (nextStatus === 'Approved' && prevStatus !== 'Approved') {
      const dutyDateCode = validated.departureDate.replace(/-/g, '')
      req.finalApproverId = actorId
      req.finalApproverName = actorUser?.name || 'Super Admin'
      req.finalApprovedAt = now
      req.attendanceF04Ref = `DUTY-FLD-${dutyDateCode}-${req.requestId}`
      this._createInitialTravelExpense(req)
      req.approvalHistory.push({ action: 'Approved', by: actorUser?.name || 'Super Admin', remarks: 'Directly authorized', at: now })
    } else if (prevStatus === 'Approved') {
      req.approvalHistory.push({
        action: 'Authorized Correction',
        by: actorUser?.name || 'Super Admin',
        remarks: String(patchData.correctionReason || patchData.remarks || 'Authorized correction applied').trim(),
        at: now
      })
    }

    list[idx] = req
    this._setItem(STORAGE_KEYS.REQUESTS, list)
    this._notify()
    return req
  }

  submitTravelRequest(requestId, actorUser, patchData = {}) {
    const req = this.getTravelRequestById(requestId)
    if (!req) throw new Error(`Travel request '${requestId}' not found.`)
    if (!['Draft', 'Returned'].includes(req.status)) {
      throw new Error(`Only Draft or Returned travel requests can be submitted (current: '${req.status}').`)
    }
    const wantsDirect = Boolean(patchData.directApprove || patchData.autoApprove) && String(actorUser?.role || '').toLowerCase() === 'super_admin'
    return this.updateTravelRequest(requestId, { ...patchData, status: wantsDirect ? 'Approved' : 'Submitted' }, actorUser)
  }

  reviewTravelRequest(requestId, reviewData, actorUser) {
    const { action, remarks = '' } = reviewData // action: 'approve' | 'recommend' | 'reject' | 'return'
    const list = [...this._getItem(STORAGE_KEYS.REQUESTS, isTest ? INITIAL_TRAVEL_REQUESTS : [])]
    const idx = list.findIndex((r) => r.requestId === requestId || r.id === requestId)
    if (idx === -1) throw new Error(`Travel request '${requestId}' not found.`)

    const req = { ...list[idx] }
    const actorId = actorUser?.employeeId || actorUser?.id
    const now = new Date().toISOString()
    const normalizedRole = String(actorUser?.role || '').toLowerCase()
    const isManager = normalizedRole === 'manager'
    const isSuper = normalizedRole === 'super_admin'

    // CRITICAL ANTI-SELF-APPROVAL RULE (bypassed for Super Admin universal authority)
    if (!isSuper && req.employeeId === actorId) {
      throw new Error('Anti-Self-Approval: You cannot approve or review your own official travel request.')
    }

    if (action === 'approve' || action === 'recommend') {
      this._validateLocalRequestPayload(req, { requireComplete: true })
      const overlap = this._findLocalActiveOverlap(list, req.employeeId, req.departureDate, req.returnDate, req.requestId)
      if (overlap) {
        throw new Error(
          `Overlapping travel conflict: Employee '${req.employeeName}' already has an active trip '${overlap.requestId}' (${overlap.status}) scheduled from ${overlap.departureDate} to ${overlap.returnDate}.`
        )
      }
    }

    if (action === 'reject') {
      req.status = 'Rejected'
      req.rejectionReason = remarks || 'Declined under policy review'
      req.rejectedBy = actorUser?.name || 'Authorized Reviewer'
      req.rejectedAt = now
    } else if (action === 'return') {
      req.status = 'Returned'
      req.returnRemarks = remarks || 'Returned for budget clarification'
      req.returnedBy = actorUser?.name || 'Authorized Reviewer'
      req.returnedAt = now
    } else if (action === 'recommend' || (isManager && !isSuper)) {
      // Manager recommending to HR
      req.status = 'Under Review'
      req.managerReviewerId = actorId
      req.managerReviewerName = actorUser?.name || 'Line Manager'
      req.managerRemarks = remarks || 'Recommended by Line Manager'
      req.managerReviewedAt = now
    } else if (action === 'approve') {
      // Final approval
      req.status = 'Approved'
      req.finalApproverId = actorId
      req.finalApproverName = actorUser?.name || (isSuper ? 'Super Admin' : 'HR Administrator')
      req.finalApprovalRemarks = remarks || 'Approved for official company travel'
      req.finalApprovedAt = now

      // F04 Attendance Bridge: Record field duty reference
      const dutyDateCode = req.departureDate.replace(/-/g, '')
      req.attendanceF04Ref = `DUTY-FLD-${dutyDateCode}-${req.requestId}`

      // Auto-create initial travel expense tracking entry
      this._createInitialTravelExpense(req)
    }

    req.approvalHistory = req.approvalHistory || []
    req.approvalHistory.push({
      action: req.status,
      by: actorUser?.name || 'Authorized Reviewer',
      remarks: remarks || `${action} action applied`,
      at: now
    })

    list[idx] = req
    this._setItem(STORAGE_KEYS.REQUESTS, list)
    this._notify()
    return req
  }

  approveTravelRequest(requestId, actorUser, remarks = '') {
    return this.reviewTravelRequest(requestId, { action: 'approve', remarks }, actorUser)
  }

  rejectTravelRequest(requestId, actorUser, remarks = '') {
    return this.reviewTravelRequest(requestId, { action: 'reject', remarks }, actorUser)
  }

  recommendTravelRequest(requestId, actorUser, remarks = '') {
    return this.reviewTravelRequest(requestId, { action: 'recommend', remarks }, actorUser)
  }

  cancelTravelRequest(requestId, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.REQUESTS, isTest ? INITIAL_TRAVEL_REQUESTS : [])]
    const idx = list.findIndex((r) => r.requestId === requestId || r.id === requestId)
    if (idx === -1) throw new Error(`Travel request '${requestId}' not found.`)

    const req = { ...list[idx] }
    const actorId = actorUser?.employeeId || actorUser?.id
    const isHrOrSuper = actorUser?.role === 'super_admin' || actorUser?.role === 'hr_admin'
    const isOwner = req.employeeId === actorId

    if (!isOwner && !isHrOrSuper) {
      throw new Error('Unauthorized to cancel this travel request.')
    }

    req.status = 'Cancelled'
    req.cancelledBy = actorUser?.name || 'User'
    req.cancelledAt = new Date().toISOString()
    req.approvalHistory = req.approvalHistory || []
    req.approvalHistory.push({
      action: 'Cancelled',
      by: actorUser?.name || 'User',
      remarks: 'Request withdrawn / cancelled',
      at: new Date().toISOString()
    })

    list[idx] = req
    this._setItem(STORAGE_KEYS.REQUESTS, list)
    this._notify()
    return req
  }

  // ==========================================
  // SUBMODULE 3: TRAVEL PLANS & BOOKINGS
  // ==========================================

  getTravelPlans(filters = {}, requestingUser = null) {
    let list = [...this._getItem(STORAGE_KEYS.PLANS, isTest ? INITIAL_TRAVEL_PLANS : [])]

    const currentEmpId = requestingUser?.employeeId || requestingUser?.id

    if (requestingUser?.role === 'employee') {
      list = list.filter((p) => p.employeeId === currentEmpId)
    } else if (requestingUser?.role === 'manager') {
      list = list.filter((p) => p.employeeId === currentEmpId || p.department === requestingUser.department)
    }

    if (filters.status && filters.status !== 'all') {
      list = list.filter((p) => p.status.toLowerCase() === filters.status.toLowerCase())
    }

    return list
  }

  createTravelPlan(planData, actorUser) {
    const {
      requestId,
      departureSchedule,
      returnSchedule,
      transportationType = 'Commercial Airline',
      vendorReference = 'Corporate Desk',
      bookingReference,
      hotelReference = 'Corporate Accommodation Booking',
      confirmedCost = 0,
      notes = ''
    } = planData

    if (!requestId) throw new Error('Target travel request ID is required.')
    if (!bookingReference || !bookingReference.trim()) {
      throw new Error('Booking reference or PNR number is required.')
    }

    const travelReq = this.getTravelRequestById(requestId)
    if (!travelReq) throw new Error(`Travel request '${requestId}' does not exist.`)
    if (travelReq.status !== 'Approved') {
      throw new Error(`Cannot create travel plan for request '${requestId}' with status '${travelReq.status}'. Must be Approved.`)
    }

    const list = [...this._getItem(STORAGE_KEYS.PLANS, isTest ? INITIAL_TRAVEL_PLANS : [])]
    const planId = `TRV-PLAN-${String(list.length + 1).padStart(3, '0')}`

    const newPlan = {
      id: planId,
      planId,
      requestId,
      employeeId: travelReq.employeeId,
      employeeName: travelReq.employeeName,
      department: travelReq.department,
      destination: travelReq.destination,
      departureSchedule: departureSchedule || `${travelReq.departureDate} ${travelReq.departureTime}`,
      returnSchedule: returnSchedule || `${travelReq.returnDate} ${travelReq.returnTime}`,
      transportationType,
      vendorReference,
      bookingReference: bookingReference.trim(),
      hotelReference: hotelReference.trim(),
      confirmedCost: Number(confirmedCost) || travelReq.estimatedBudget,
      responsibleCoordinator: actorUser?.name || 'HR Travel Coordinator',
      status: 'Planned',
      notes: notes.trim(),
      createdAt: new Date().toISOString()
    }

    list.unshift(newPlan)
    this._setItem(STORAGE_KEYS.PLANS, list)
    this._notify()
    return newPlan
  }

  updateTravelPlan(planId, patchData = {}, actorUser) {
    const role = String(actorUser?.role || '').toLowerCase()
    if (role && role !== 'super_admin' && role !== 'hr_admin') {
      throw new Error('Only Super Admin or HR Admin can edit travel plans and bookings.')
    }
    const list = [...this._getItem(STORAGE_KEYS.PLANS, isTest ? INITIAL_TRAVEL_PLANS : [])]
    const idx = list.findIndex((p) => p.planId === planId || p.id === planId)
    if (idx === -1) throw new Error(`Travel plan '${planId}' not found.`)

    const current = { ...list[idx] }
    if (['Completed', 'Cancelled'].includes(current.status)) {
      throw new Error(`Cannot edit travel plan '${current.planId}' once status is '${current.status}'.`)
    }

    const nextBookingRef = 'bookingReference' in patchData ? String(patchData.bookingReference || '').trim() : current.bookingReference
    if (!nextBookingRef) {
      throw new Error('Booking reference or PNR number is required.')
    }

    const nextCost =
      patchData.confirmedCost !== undefined && patchData.confirmedCost !== null && String(patchData.confirmedCost).trim() !== ''
        ? Number(patchData.confirmedCost)
        : Number(current.confirmedCost || 0)
    if (!Number.isFinite(nextCost) || nextCost < 0) {
      throw new Error('Confirmed cost must be a valid non-negative number.')
    }

    const expenses = this._getItem(STORAGE_KEYS.EXPENSES, isTest ? INITIAL_TRAVEL_EXPENSES : [])
    const linkedExp = expenses.find((e) => e.requestId === current.requestId)
    if (linkedExp?.settlementStatus === 'Settled' && nextCost !== Number(current.confirmedCost || 0)) {
      throw new Error(`Cannot alter confirmed cost on '${current.planId}' because linked request '${current.requestId}' is Settled.`)
    }

    const nextDep = 'departureSchedule' in patchData && patchData.departureSchedule ? String(patchData.departureSchedule).trim() : current.departureSchedule
    const nextRet = 'returnSchedule' in patchData && patchData.returnSchedule ? String(patchData.returnSchedule).trim() : current.returnSchedule
    const depYmd = this._extractYmd(nextDep)
    const retYmd = this._extractYmd(nextRet)
    if (depYmd && retYmd && retYmd < depYmd) {
      throw new Error('Return schedule date cannot be earlier than departure schedule date.')
    }

    list[idx] = {
      ...current,
      departureSchedule: nextDep,
      returnSchedule: nextRet,
      transportationType: patchData.transportationType || current.transportationType,
      vendorReference: patchData.vendorReference !== undefined ? (String(patchData.vendorReference || '').trim() || current.vendorReference) : current.vendorReference,
      bookingReference: nextBookingRef,
      hotelReference: patchData.hotelReference !== undefined ? (String(patchData.hotelReference || '').trim() || current.hotelReference) : current.hotelReference,
      confirmedCost: nextCost,
      notes: patchData.notes !== undefined ? String(patchData.notes || '').trim() : current.notes,
      updatedBy: actorUser?.name || 'Coordinator',
      updatedAt: new Date().toISOString()
    }

    this._setItem(STORAGE_KEYS.PLANS, list)
    this._notify()
    return list[idx]
  }

  _extractYmd(value) {
    if (!value) return null
    const str = String(value).trim()
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(str)
    if (m) return m[1]
    const parsed = new Date(str)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
  }

  _todayYmd() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  _validateTravelPlanStatusTransition(plan, nextStatus) {
    const validStatuses = ['Planned', 'In Progress', 'Completed', 'Cancelled']
    if (!validStatuses.includes(nextStatus)) {
      throw new Error(`Invalid travel plan status '${nextStatus}'.`)
    }
    if (plan.status === nextStatus) {
      throw new Error(`Repeated transition blocked: Travel plan '${plan.planId}' is already '${nextStatus}'.`)
    }
    const allowedTransitions = {
      Planned: ['In Progress', 'Cancelled'],
      'In Progress': ['Completed', 'Cancelled'],
      Completed: [],
      Cancelled: []
    }
    if (!(allowedTransitions[plan.status] || []).includes(nextStatus)) {
      throw new Error(`Invalid status transition: Cannot move travel plan from '${plan.status}' to '${nextStatus}'.`)
    }

    const todayYmd = this._todayYmd()
    const depYmd = this._extractYmd(plan.departureDate || plan.departureSchedule)
    const retYmd = this._extractYmd(plan.returnDate || plan.returnSchedule)

    if (nextStatus === 'In Progress' && depYmd && todayYmd < depYmd) {
      throw new Error(`Cannot start travel plan '${plan.planId}' before scheduled departure date (${depYmd}).`)
    }
    if (nextStatus === 'Completed' && retYmd && todayYmd < retYmd) {
      throw new Error(`Cannot complete travel plan '${plan.planId}' before scheduled return date (${retYmd}).`)
    }
  }

  updateTravelPlanStatus(planId, status, actorUser) {
    const role = String(actorUser?.role || '').toLowerCase()
    if (role && role !== 'super_admin' && role !== 'hr_admin') {
      throw new Error('Only Super Admin or HR Admin can update travel plan status.')
    }
    const list = [...this._getItem(STORAGE_KEYS.PLANS, isTest ? INITIAL_TRAVEL_PLANS : [])]
    const idx = list.findIndex((p) => p.planId === planId || p.id === planId)
    if (idx === -1) throw new Error(`Travel plan '${planId}' not found.`)

    this._validateTravelPlanStatusTransition(list[idx], status)

    list[idx].status = status
    list[idx].updatedBy = actorUser?.name || 'Coordinator'
    list[idx].updatedAt = new Date().toISOString()

    this._setItem(STORAGE_KEYS.PLANS, list)
    this._notify()
    return list[idx]
  }

  // ==========================================
  // SUBMODULE 4: TRAVEL ADVANCES & EXPENSES
  // ==========================================

  getTravelExpenses(filters = {}, requestingUser = null) {
    let list = [...this._getItem(STORAGE_KEYS.EXPENSES, isTest ? INITIAL_TRAVEL_EXPENSES : [])]
    const currentEmpId = requestingUser?.employeeId || requestingUser?.id

    if (requestingUser?.role === 'employee') {
      list = list.filter((e) => e.employeeId === currentEmpId)
    } else if (requestingUser?.role === 'manager') {
      list = list.filter((e) => e.employeeId === currentEmpId)
    }

    if (filters.requestId) {
      list = list.filter((e) => e.requestId === filters.requestId)
    }

    return list
  }

  _createInitialTravelExpense(travelReq) {
    const list = [...this._getItem(STORAGE_KEYS.EXPENSES, isTest ? INITIAL_TRAVEL_EXPENSES : [])]
    const existing = list.find((e) => e.requestId === travelReq.requestId)
    if (existing) return existing

    const newExp = {
      id: `TRV-EXP-${String(list.length + 1).padStart(3, '0')}`,
      expenseId: `TRV-EXP-${String(list.length + 1).padStart(3, '0')}`,
      requestId: travelReq.requestId,
      employeeId: travelReq.employeeId,
      employeeName: travelReq.employeeName,
      department: travelReq.department,
      approvedBudget: travelReq.estimatedBudget,
      requestedAdvance: travelReq.requestedAdvance,
      disbursedAdvance: 0,
      advanceDisbursedDate: null,
      advanceDisbursedReference: null,
      employeeSubmittedExpenses: 0,
      expenseReceiptReferences: [],
      approvedExpenses: 0,
      settlementBalance: 0,
      settlementStatus: 'Advance Pending',
      notes: 'Record initialized upon travel request approval.'
    }

    list.unshift(newExp)
    this._setItem(STORAGE_KEYS.EXPENSES, list)
    return newExp
  }

  disburseAdvance(requestId, disbursementData, actorUser) {
    const { disbursedAmount, voucherReference, notes = '' } = disbursementData
    const list = [...this._getItem(STORAGE_KEYS.EXPENSES, isTest ? INITIAL_TRAVEL_EXPENSES : [])]
    const idx = list.findIndex((e) => e.requestId === requestId)
    if (idx === -1) throw new Error(`Travel expense record for '${requestId}' not found.`)

    const exp = { ...list[idx] }
    if (exp.settlementStatus === 'Settled') {
      throw new Error(`Financial lock: Travel expense '${exp.expenseId}' is already Settled. Cannot disburse additional travel advance.`)
    }
    if (exp.reconciledAt || exp.settlementStatus === 'Pending Final Settlement') {
      throw new Error(`Financial lock: Travel expense '${exp.expenseId}' is already reconciled. Advance disbursement is closed.`)
    }
    if (Number(exp.disbursedAdvance || 0) > 0 || exp.advanceDisbursedReference || exp.advanceDisbursedDate || exp.settlementStatus === 'Advance Disbursed') {
      throw new Error(`Duplicate advance blocked: Advance already disbursed under voucher '${exp.advanceDisbursedReference || 'N/A'}'.`)
    }

    const numAmount = Number(disbursedAmount)
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Disbursed advance amount must be greater than zero.')
    }
    const cleanVoucher = String(voucherReference || '').trim()
    if (!cleanVoucher) {
      throw new Error('Petty cash or payment voucher reference is required.')
    }
    if (exp.approvedBudget > 0 && numAmount > Number(exp.approvedBudget)) {
      throw new Error('Disbursed advance cannot exceed approved travel budget.')
    }
    const duplicateVoucher = list.find(
      (e) => e.requestId !== exp.requestId && String(e.advanceDisbursedReference || '').trim().toLowerCase() === cleanVoucher.toLowerCase()
    )
    if (duplicateVoucher) {
      throw new Error(`Duplicate voucher blocked: Voucher '${cleanVoucher}' already used for '${duplicateVoucher.expenseId}'.`)
    }

    exp.disbursedAdvance = numAmount
    exp.advanceDisbursedDate = new Date().toISOString().slice(0, 10)
    exp.advanceDisbursedReference = cleanVoucher
    exp.settlementStatus = 'Advance Disbursed'
    exp.settlementBalance = -numAmount // Currently held by employee
    exp.notes = notes.trim()
    exp.disbursedBy = actorUser?.name || 'Finance Officer'

    list[idx] = exp
    this._setItem(STORAGE_KEYS.EXPENSES, list)
    this._notify()
    return exp
  }

  submitExpenseReceipts(requestId, claimData, actorUser) {
    const { submittedExpenses, receiptReferences = [], notes = '' } = claimData
    const list = [...this._getItem(STORAGE_KEYS.EXPENSES, isTest ? INITIAL_TRAVEL_EXPENSES : [])]
    const idx = list.findIndex((e) => e.requestId === requestId)
    if (idx === -1) throw new Error(`Travel expense record for '${requestId}' not found.`)

    const exp = { ...list[idx] }
    if (exp.settlementStatus === 'Settled' || exp.reconciledAt || exp.settlementStatus === 'Pending Final Settlement') {
      throw new Error(`Financial lock: Travel expense '${exp.expenseId}' is already reconciled/settled. Expense claims are locked.`)
    }

    const numExpenses = Number(submittedExpenses)
    if (isNaN(numExpenses) || numExpenses < 0) {
      throw new Error('Submitted expense amount must be a valid non-negative number.')
    }

    const refs = Array.isArray(receiptReferences)
      ? receiptReferences.map((r) => String(r).trim()).filter(Boolean)
      : String(receiptReferences || '').split(',').map((r) => r.trim()).filter(Boolean)
    if (refs.length === 0) {
      throw new Error('At least one receipt or invoice reference is required.')
    }

    exp.employeeSubmittedExpenses = numExpenses
    exp.expenseReceiptReferences = refs
    exp.claimSubmittedAt = new Date().toISOString()
    exp.claimSubmittedBy = actorUser?.name || 'Employee'
    exp.notes = notes.trim() || exp.notes

    list[idx] = exp
    this._setItem(STORAGE_KEYS.EXPENSES, list)
    this._notify()
    return exp
  }

  reconcileTravelExpense(requestId, reconciliationData, actorUser) {
    const { approvedExpenses, notes = '' } = reconciliationData
    const list = [...this._getItem(STORAGE_KEYS.EXPENSES, isTest ? INITIAL_TRAVEL_EXPENSES : [])]
    const idx = list.findIndex((e) => e.requestId === requestId)
    if (idx === -1) throw new Error(`Travel expense record for '${requestId}' not found.`)

    const exp = { ...list[idx] }
    if (exp.settlementStatus === 'Settled') {
      throw new Error(`Financial lock: Travel expense '${exp.expenseId}' is already Settled. Duplicate reconciliation is prohibited.`)
    }

    const numApproved = Number(approvedExpenses)
    if (isNaN(numApproved) || numApproved < 0) {
      throw new Error('Approved expense amount must be valid.')
    }
    if (exp.reconciledAt && exp.settlementStatus === 'Pending Final Settlement' && Number(exp.approvedExpenses) === numApproved) {
      throw new Error(`Duplicate reconciliation blocked: '${exp.expenseId}' was already reconciled at Rs. ${numApproved}.`)
    }

    exp.approvedExpenses = numApproved
    const balance = numApproved - (exp.disbursedAdvance || 0)
    exp.settlementBalance = balance
    exp.settlementStatus = balance === 0 ? 'Settled' : 'Pending Final Settlement'
    exp.reconciledAt = new Date().toISOString().slice(0, 10)
    exp.reconciledBy = actorUser?.name || 'HR / Finance Auditor'
    if (notes) exp.notes = notes.trim()

    list[idx] = exp
    this._setItem(STORAGE_KEYS.EXPENSES, list)
    this._notify()
    return exp
  }

  // ==========================================
  // SUBMODULE 5: PICK-AND-DROP MANAGEMENT
  // ==========================================

  getTransportAssignments(filters = {}, requestingUser = null) {
    let list = [...this._getItem(STORAGE_KEYS.ASSIGNMENTS, isTest ? INITIAL_TRANSPORT_ASSIGNMENTS : [])]

    const currentEmpId = requestingUser?.employeeId || requestingUser?.id

    if (requestingUser?.role === 'employee') {
      list = list.filter((a) => a.employeeId === currentEmpId)
    } else if (requestingUser?.role === 'manager') {
      list = list.filter((a) => a.employeeId === currentEmpId || a.department === requestingUser.department)
    }

    if (filters.routeId && filters.routeId !== 'all') {
      list = list.filter((a) => a.routeId === filters.routeId)
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter((a) => a.status.toLowerCase() === filters.status.toLowerCase())
    }

    return list
  }

  requestPickAndDrop(assignmentData, actorUser) {
    const {
      employeeId,
      routeId,
      pickupPoint,
      dropPoint = 'iSysware HQ Tech Park',
      pickupTime = '07:45 AM',
      facilityType = 'Company Subsidized',
      monthlyContribution = 3000,
      effectiveFrom
    } = assignmentData

    const targetEmpId = employeeId || actorUser?.employeeId || actorUser?.id
    if (!targetEmpId) throw new Error('Employee ID is required.')
    if (!routeId) throw new Error('Target transport route must be selected.')
    if (!pickupPoint || !pickupPoint.trim()) throw new Error('Pickup point is required.')

    // Inactive employee check
    let emp = null
    try {
      emp = employeeService.getEmployeeById(targetEmpId)
    } catch {
      emp = null
    }
    if (emp && (emp.status === 'Separated' || emp.status === 'Inactive')) {
      throw new Error(`Cannot assign transport facility to inactive or separated employee '${emp.name}'.`)
    }

    // Check conflicting active transport assignment
    const assignments = [...this._getItem(STORAGE_KEYS.ASSIGNMENTS, isTest ? INITIAL_TRANSPORT_ASSIGNMENTS : [])]
    const existingActive = assignments.find(
      (a) => a.employeeId === targetEmpId && a.status === 'Active'
    )
    if (existingActive) {
      throw new Error(
        `Employee '${emp?.name || targetEmpId}' already has an active transport assignment on '${existingActive.routeName}'. Please change or suspend the existing assignment first.`
      )
    }

    // Route capacity check
    const routes = [...this._getItem(STORAGE_KEYS.ROUTES, isTest ? INITIAL_ROUTES : [])]
    const rIdx = routes.findIndex((r) => r.routeId === routeId)
    if (rIdx === -1) throw new Error(`Transport route '${routeId}' not found.`)

    const route = routes[rIdx]
    const currentOnRoute = assignments.filter((a) => a.routeId === routeId && a.status === 'Active')

    if (currentOnRoute.length >= route.capacity) {
      throw new Error(`Route capacity exceeded: '${route.routeName}' has reached its maximum vehicle capacity of ${route.capacity} passengers.`)
    }

    const nextId = `TRANS-ASN-${String(assignments.length + 1).padStart(3, '0')}`
    const isHrOrSuper = actorUser?.role === 'super_admin' || actorUser?.role === 'hr_admin'

    const newAssignment = {
      id: nextId,
      assignmentId: nextId,
      employeeId: targetEmpId,
      employeeName: emp?.name || actorUser?.name || 'Staff Member',
      department: emp?.department || actorUser?.department || 'General',
      routeId,
      routeName: route.routeName,
      pickupPoint: pickupPoint.trim(),
      dropPoint: dropPoint.trim(),
      pickupTime,
      dropTime: route.eveningDepartureTime || '06:15 PM',
      applicableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      facilityType,
      monthlyContribution: Number(monthlyContribution) || 0,
      effectiveFrom: effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: null,
      status: isHrOrSuper ? 'Active' : 'Pending Approval',
      approvedBy: isHrOrSuper ? actorUser?.name : null,
      approvedDate: isHrOrSuper ? new Date().toISOString().slice(0, 10) : null
    }

    assignments.unshift(newAssignment)
    this._setItem(STORAGE_KEYS.ASSIGNMENTS, assignments)

    // Update route assigned count
    if (newAssignment.status === 'Active') {
      route.assignedCount = (route.assignedCount || 0) + 1
      routes[rIdx] = route
      this._setItem(STORAGE_KEYS.ROUTES, routes)
    }

    this._notify()
    return newAssignment
  }

  updateTransportAssignment(assignmentId, patchData = {}, actorUser) {
    const assignments = [...this._getItem(STORAGE_KEYS.ASSIGNMENTS, isTest ? INITIAL_TRANSPORT_ASSIGNMENTS : [])]
    const idx = assignments.findIndex((a) => a.assignmentId === assignmentId || a.id === assignmentId)
    if (idx === -1) throw new Error(`Transport assignment '${assignmentId}' not found.`)

    const current = { ...assignments[idx] }
    const role = String(actorUser?.role || '').toLowerCase()
    const isAdmin = role === 'super_admin' || role === 'hr_admin'
    const actorId = actorUser?.employeeId || actorUser?.id
    const isOwner = Boolean(actorId && current.employeeId === actorId)

    if (!isAdmin && !isOwner) {
      throw new Error('Unauthorized to edit this transport assignment.')
    }
    if (!isAdmin && current.status !== 'Pending Approval') {
      throw new Error('Only HR Admin or Super Admin can edit active or suspended transport assignments.')
    }
    if (['Cancelled', 'Rejected'].includes(current.status)) {
      throw new Error(`Cannot edit transport assignment in status '${current.status}'.`)
    }

    const routes = [...this._getItem(STORAGE_KEYS.ROUTES, isTest ? INITIAL_ROUTES : [])]
    const nextRouteId = patchData.routeId || current.routeId
    const route = routes.find((r) => r.routeId === nextRouteId || r.id === nextRouteId)
    if (!route) throw new Error(`Transport route '${nextRouteId}' not found.`)

    if (nextRouteId !== current.routeId) {
      if (route.status !== 'Active') {
        throw new Error(`Route '${route.routeName}' is ${route.status} and cannot accept assignments.`)
      }
      if (current.status === 'Active') {
        const activeOnTarget = assignments.filter((a) => a.routeId === route.routeId && a.status === 'Active').length
        if (activeOnTarget >= route.capacity) {
          throw new Error(`Route capacity exceeded: '${route.routeName}' has reached capacity ${route.capacity}.`)
        }
      }
    }

    const pickupPoint = 'pickupPoint' in patchData ? String(patchData.pickupPoint || '').trim() : current.pickupPoint
    if (!pickupPoint) throw new Error('Pickup point is required.')

    const contribution =
      patchData.monthlyContribution !== undefined && patchData.monthlyContribution !== null && String(patchData.monthlyContribution).trim() !== ''
        ? Number(patchData.monthlyContribution)
        : Number(current.monthlyContribution || 0)
    if (!Number.isFinite(contribution) || contribution < 0) {
      throw new Error('Monthly contribution must be a valid non-negative number.')
    }

    assignments[idx] = {
      ...current,
      routeId: route.routeId,
      routeName: route.routeName,
      pickupPoint,
      dropPoint: 'dropPoint' in patchData ? (String(patchData.dropPoint || '').trim() || current.dropPoint) : current.dropPoint,
      pickupTime: patchData.pickupTime || current.pickupTime,
      dropTime: patchData.dropTime || route.eveningDepartureTime || current.dropTime,
      facilityType: patchData.facilityType || current.facilityType,
      monthlyContribution: contribution,
      effectiveFrom: patchData.effectiveFrom || current.effectiveFrom,
      updatedBy: actorUser?.name || 'HR Admin',
      updatedAt: new Date().toISOString()
    }

    this._setItem(STORAGE_KEYS.ASSIGNMENTS, assignments)

    if (nextRouteId !== current.routeId && current.status === 'Active') {
      const oldIdx = routes.findIndex((r) => r.routeId === current.routeId)
      const newIdx = routes.findIndex((r) => r.routeId === route.routeId)
      if (oldIdx !== -1) routes[oldIdx].assignedCount = Math.max(0, (routes[oldIdx].assignedCount || 1) - 1)
      if (newIdx !== -1) routes[newIdx].assignedCount = (routes[newIdx].assignedCount || 0) + 1
      this._setItem(STORAGE_KEYS.ROUTES, routes)
    }

    this._notify()
    return assignments[idx]
  }

  updateTransportAssignmentStatus(assignmentId, status, actorUser) {
    const assignments = [...this._getItem(STORAGE_KEYS.ASSIGNMENTS, isTest ? INITIAL_TRANSPORT_ASSIGNMENTS : [])]
    const idx = assignments.findIndex((a) => a.assignmentId === assignmentId || a.id === assignmentId)
    if (idx === -1) throw new Error(`Transport assignment '${assignmentId}' not found.`)

    const current = assignments[idx]
    const oldStatus = current.status
    current.status = status
    current.updatedBy = actorUser?.name || 'HR Admin'
    current.updatedAt = new Date().toISOString()

    assignments[idx] = current
    this._setItem(STORAGE_KEYS.ASSIGNMENTS, assignments)

    // Refresh route assigned count
    const routes = [...this._getItem(STORAGE_KEYS.ROUTES, isTest ? INITIAL_ROUTES : [])]
    const rIdx = routes.findIndex((r) => r.routeId === current.routeId)
    if (rIdx !== -1) {
      if (oldStatus !== 'Active' && status === 'Active') {
        routes[rIdx].assignedCount = (routes[rIdx].assignedCount || 0) + 1
      } else if (oldStatus === 'Active' && status !== 'Active') {
        routes[rIdx].assignedCount = Math.max(0, (routes[rIdx].assignedCount || 1) - 1)
      }
      this._setItem(STORAGE_KEYS.ROUTES, routes)
    }

    this._notify()
    return current
  }

  // ==========================================
  // SUBMODULE 6: VEHICLES, DRIVERS & ROUTES
  // ==========================================

  getVehicles() {
    return this._getItem(STORAGE_KEYS.VEHICLES, isTest ? INITIAL_VEHICLES : [])
  }

  saveVehicle(vehicleData, actorUser) {
    const list = [...this.getVehicles()]
    if (!vehicleData.registrationNumber || !vehicleData.registrationNumber.trim()) {
      throw new Error('Vehicle registration number is required.')
    }
    if (!vehicleData.capacity || Number(vehicleData.capacity) <= 0) {
      throw new Error('Vehicle passenger capacity must be greater than zero.')
    }

    const isEdit = Boolean(vehicleData.vehicleId || vehicleData.id)
    const targetId = vehicleData.vehicleId || vehicleData.id

    if (isEdit) {
      const idx = list.findIndex((v) => v.vehicleId === targetId || v.id === targetId)
      if (idx === -1) throw new Error(`Vehicle '${targetId}' not found.`)
      list[idx] = {
        ...list[idx],
        ...vehicleData,
        capacity: Number(vehicleData.capacity),
        updatedBy: actorUser?.name || 'Transport Admin'
      }
      this._setItem(STORAGE_KEYS.VEHICLES, list)
      this._notify()
      return list[idx]
    } else {
      const vehicleId = `VEH-${String(list.length + 1).padStart(3, '0')}`
      const newVeh = {
        ...vehicleData,
        id: vehicleId,
        vehicleId,
        capacity: Number(vehicleData.capacity),
        status: vehicleData.status || 'Active',
        createdAt: new Date().toISOString()
      }
      list.push(newVeh)
      this._setItem(STORAGE_KEYS.VEHICLES, list)
      this._notify()
      return newVeh
    }
  }

  getDrivers() {
    return this._getItem(STORAGE_KEYS.DRIVERS, isTest ? INITIAL_DRIVERS : [])
  }

  saveDriver(driverData, actorUser) {
    const list = [...this.getDrivers()]
    if (!driverData.driverName || !driverData.driverName.trim()) {
      throw new Error('Driver name is required.')
    }
    if (!driverData.contactNumber || !driverData.contactNumber.trim()) {
      throw new Error('Driver contact number is required.')
    }

    const isEdit = Boolean(driverData.driverId || driverData.id)
    const targetId = driverData.driverId || driverData.id

    if (isEdit) {
      const idx = list.findIndex((d) => d.driverId === targetId || d.id === targetId)
      if (idx === -1) throw new Error(`Driver '${targetId}' not found.`)
      list[idx] = {
        ...list[idx],
        ...driverData,
        updatedBy: actorUser?.name || 'Transport Admin'
      }
      this._setItem(STORAGE_KEYS.DRIVERS, list)
      this._notify()
      return list[idx]
    } else {
      const driverId = `DRV-${String(list.length + 1).padStart(3, '0')}`
      const newDrv = {
        ...driverData,
        id: driverId,
        driverId,
        status: driverData.status || 'Active',
        createdAt: new Date().toISOString()
      }
      list.push(newDrv)
      this._setItem(STORAGE_KEYS.DRIVERS, list)
      this._notify()
      return newDrv
    }
  }

  getRoutes() {
    return this._getItem(STORAGE_KEYS.ROUTES, isTest ? INITIAL_ROUTES : [])
  }

  saveRoute(routeData, actorUser) {
    const list = [...this.getRoutes()]
    if (!routeData.routeName || !routeData.routeName.trim()) {
      throw new Error('Route name is required.')
    }

    const vehicles = this.getVehicles()
    const drivers = this.getDrivers()

    // Conflict detection: cannot assign vehicle if already assigned to another active route with overlapping departure schedule
    if (routeData.assignedVehicleId) {
      const veh = vehicles.find((v) => v.vehicleId === routeData.assignedVehicleId)
      if (veh && Number(routeData.capacity) > veh.capacity) {
        throw new Error(`Route capacity (${routeData.capacity}) exceeds assigned vehicle capacity (${veh.capacity}).`)
      }

      const conflictRoute = list.find(
        (r) =>
          r.assignedVehicleId === routeData.assignedVehicleId &&
          r.routeId !== routeData.routeId &&
          r.status === 'Active' &&
          r.morningDepartureTime === routeData.morningDepartureTime
      )
      if (conflictRoute) {
        throw new Error(
          `Schedule conflict: Vehicle '${routeData.assignedVehicleId}' is already assigned to active route '${conflictRoute.routeName}' at ${conflictRoute.morningDepartureTime}.`
        )
      }
    }

    if (routeData.assignedDriverId) {
      const conflictDriver = list.find(
        (r) =>
          r.assignedDriverId === routeData.assignedDriverId &&
          r.routeId !== routeData.routeId &&
          r.status === 'Active' &&
          r.morningDepartureTime === routeData.morningDepartureTime
      )
      if (conflictDriver) {
        throw new Error(
          `Schedule conflict: Driver '${routeData.assignedDriverId}' is already scheduled on route '${conflictDriver.routeName}' at ${conflictDriver.morningDepartureTime}.`
        )
      }
    }

    const isEdit = Boolean(routeData.routeId || routeData.id)
    const targetId = routeData.routeId || routeData.id

    const vehObj = vehicles.find((v) => v.vehicleId === routeData.assignedVehicleId)
    const drvObj = drivers.find((d) => d.driverId === routeData.assignedDriverId)

    if (isEdit) {
      const idx = list.findIndex((r) => r.routeId === targetId || r.id === targetId)
      if (idx === -1) throw new Error(`Route '${targetId}' not found.`)
      list[idx] = {
        ...list[idx],
        ...routeData,
        assignedVehicleName: vehObj?.vehicleName || list[idx].assignedVehicleName,
        assignedDriverName: drvObj?.driverName || list[idx].assignedDriverName,
        capacity: Number(routeData.capacity) || list[idx].capacity,
        updatedBy: actorUser?.name || 'Transport Admin'
      }
      this._setItem(STORAGE_KEYS.ROUTES, list)
      this._notify()
      return list[idx]
    } else {
      const routeId = `ROUTE-${String(list.length + 1).padStart(2, '0')}`
      const newRoute = {
        ...routeData,
        id: routeId,
        routeId,
        assignedVehicleName: vehObj?.vehicleName || 'Unassigned Vehicle',
        assignedDriverName: drvObj?.driverName || 'Unassigned Driver',
        capacity: Number(routeData.capacity) || 14,
        assignedCount: 0,
        status: routeData.status || 'Active',
        createdAt: new Date().toISOString()
      }
      list.push(newRoute)
      this._setItem(STORAGE_KEYS.ROUTES, list)
      this._notify()
      return newRoute
    }
  }

  // ==========================================
  // OPERATIONAL KPIS & SUMMARY METRICS
  // ==========================================

  getTravelKPIs(requestingUser = null) {
    const requests = this.getTravelRequests({}, requestingUser)
    const plans = this.getTravelPlans({}, requestingUser)
    const expenses = this.getTravelExpenses({}, requestingUser)
    const assignments = this.getTransportAssignments({}, requestingUser)
    const routes = this.getRoutes()

    const totalRequests = requests.length
    const pendingApprovals = requests.filter((r) => r.status === 'Submitted' || r.status === 'Under Review').length
    const approvedTrips = requests.filter((r) => r.status === 'Approved').length
    const activeTrips = plans.filter((p) => p.status === 'Planned' || p.status === 'In Progress').length
    const completedTrips = requests.filter((r) => r.status === 'Completed').length

    let totalBudget = 0
    let totalAdvancesDisbursed = 0
    expenses.forEach((e) => {
      totalBudget += Number(e.approvedBudget || 0)
      totalAdvancesDisbursed += Number(e.disbursedAdvance || 0)
    })

    const activeAssignments = assignments.filter((a) => a.status === 'Active').length
    let totalCapacity = 0
    routes.forEach((r) => {
      if (r.status === 'Active') totalCapacity += Number(r.capacity || 0)
    })

    const routeUtilization = totalCapacity > 0 ? Math.round((activeAssignments / totalCapacity) * 100) : 0

    return {
      totalRequests,
      pendingApprovals,
      approvedTrips,
      activeTrips,
      completedTrips,
      totalBudget,
      totalAdvancesDisbursed,
      activeAssignments,
      totalRoutes: routes.length,
      routeUtilization
    }
  }

  getTravelAuditLogs() {
    return this._getItem(STORAGE_KEYS.AUDIT_LOGS, [])
  }

  // ==========================================
  // POSTGRESQL API HYDRATION & ASYNC MUTATIONS
  // ==========================================

  _unwrapApiList(res) {
    if (Array.isArray(res)) return res
    if (Array.isArray(res?.data)) return res.data
    if (Array.isArray(res?.data?.items)) return res.data.items
    return []
  }

  _unwrapApiItem(res) {
    return res?.data !== undefined ? res.data : res
  }

  _mapStatusFromApi(status) {
    switch (String(status || '').toUpperCase()) {
      case 'DRAFT': return 'Draft'
      case 'PENDING': return 'Submitted'
      case 'UNDER_REVIEW': return 'Under Review'
      case 'RETURNED': return 'Returned'
      case 'APPROVED': return 'Approved'
      case 'REJECTED': return 'Rejected'
      case 'CANCELLED': return 'Cancelled'
      default: return status || 'Submitted'
    }
  }

  _mapTravelRequestFromApi(r) {
    const empName = r.employee
      ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim()
      : 'Employee'
    return {
      id: r.id,
      requestId: r.requestCode || r.id,
      employeeId: r.employee?.employeeCode || r.employeeId,
      employeeCuid: r.employeeId,
      employeeName: empName,
      department: r.employee?.department?.name || 'General',
      destination: r.destination || '',
      travelPurpose: r.purpose || '',
      clientProjectRef: r.clientProjectRef || '',
      clientReference: r.clientProjectRef || '',
      origin: r.origin || 'iSysware HQ',
      departureDate: r.departureDate ? String(r.departureDate).slice(0, 10) : '',
      departureTime: r.departureTime || '08:00 AM',
      returnDate: r.returnDate ? String(r.returnDate).slice(0, 10) : '',
      returnTime: r.returnTime || '08:00 PM',
      travelMode: r.travelMode || 'Commercial Airline',
      accommodationRequired: Boolean(r.accommodationRequired),
      estimatedBudget: r.estimatedBudget !== null && r.estimatedBudget !== undefined ? Number(r.estimatedBudget) : 0,
      requestedAdvance: Number(r.advanceAmount || 0),
      supportingNotes: r.supportingNotes || '',
      bookingReferencePnr: r.bookingReferencePnr || null,
      status: this._mapStatusFromApi(r.status),
      hasConflict: Boolean(r.hasConflict),
      conflictWithCodes: Array.isArray(r.conflictWithCodes) ? r.conflictWithCodes : [],
      overlappingDraftCodes: Array.isArray(r.overlappingDraftCodes) ? r.overlappingDraftCodes : [],
      conflictMessage: r.conflictMessage || null,
      submittedAt: r.appliedAt,
      approvalHistory: Array.isArray(r.approvalHistory) ? r.approvalHistory : [],
      managerReviewerId: r.managerReviewerId || null,
      managerReviewerName: r.managerReviewerName || null,
      managerRemarks: r.managerRemarks || null,
      managerReviewedAt: r.managerReviewedAt || null,
      finalApproverId: r.finalApproverId || null,
      finalApproverName: r.finalApproverName || null,
      finalApprovalRemarks: r.finalApprovalRemarks || r.decisionRemarks || null,
      finalApprovedAt: r.finalApprovedAt || r.reviewedAt || null,
      rejectionReason: r.status === 'REJECTED' ? (r.decisionRemarks || '') : null,
      rejectedBy: r.rejectedBy || null,
      rejectedAt: r.rejectedAt || null,
      attendanceF04Ref: r.attendanceF04Ref || null,
      settlementStatus: r.settlementStatus || 'Not Initialized',
      isSettled: r.settlementStatus === 'Settled',
      disbursedAdvance: Number(r.disbursedAdvance || 0),
      approvedExpenses: Number(r.approvedExpenses || 0),
      reconciledAt: r.reconciledAt ? String(r.reconciledAt).slice(0, 10) : null,
      isFinancialSnapshotLocked:
        r.status === 'APPROVED' &&
        (r.settlementStatus === 'Settled' ||
          Number(r.disbursedAdvance || 0) > 0 ||
          Boolean(r.advanceDisbursedDate || r.reconciledAt) ||
          Number(r.approvedExpenses || 0) > 0)
    }
  }

  _mapTravelExpenseFromApi(r) {
    const empName = r.employee
      ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim()
      : 'Employee'
    return {
      id: r.id,
      expenseId: r.expenseCode || `TRV-EXP-${r.requestCode || r.id}`,
      requestId: r.requestCode || r.id,
      requestCuid: r.id,
      employeeId: r.employee?.employeeCode || r.employeeId,
      employeeName: empName,
      department: r.employee?.department?.name || 'General',
      approvedBudget: Number(r.estimatedBudget || 0),
      requestedAdvance: Number(r.advanceAmount || 0),
      disbursedAdvance: Number(r.disbursedAdvance || 0),
      advanceDisbursedDate: r.advanceDisbursedDate ? String(r.advanceDisbursedDate).slice(0, 10) : null,
      advanceDisbursedReference: r.advanceDisbursedRef || null,
      disbursedBy: r.advanceDisbursedBy || null,
      employeeSubmittedExpenses: Number(r.employeeSubmittedExp || 0),
      expenseReceiptReferences: Array.isArray(r.expenseReceiptRefs) ? r.expenseReceiptRefs : [],
      claimSubmittedAt: r.claimSubmittedAt || null,
      claimSubmittedBy: r.claimSubmittedBy || null,
      approvedExpenses: Number(r.approvedExpenses || 0),
      settlementBalance: Number(r.settlementBalance || 0),
      settlementStatus: r.settlementStatus || 'Advance Pending',
      isSettled: r.settlementStatus === 'Settled',
      isAdvanceDisbursed:
        Number(r.disbursedAdvance || 0) > 0 ||
        Boolean(r.advanceDisbursedDate || r.advanceDisbursedRef) ||
        r.settlementStatus === 'Advance Disbursed',
      isReconciled: Boolean(r.reconciledAt),
      reconciledAt: r.reconciledAt ? String(r.reconciledAt).slice(0, 10) : null,
      reconciledBy: r.reconciledBy || null,
      notes: r.reconciliationNotes || ''
    }
  }

  _mapTravelPlanFromApi(p) {
    const empName = p.employee
      ? `${p.employee.firstName || ''} ${p.employee.lastName || ''}`.trim()
      : 'Employee'
    return {
      id: p.id,
      planId: p.planCode || p.id,
      requestId: p.travelRequest?.requestCode || p.travelRequestId,
      employeeId: p.employee?.employeeCode || p.employeeId,
      employeeName: empName,
      department: p.employee?.department?.name || 'General',
      destination: p.travelRequest?.destination || '',
      departureDate: this._extractYmd(p.travelRequest?.departureDate || p.departureSchedule),
      returnDate: this._extractYmd(p.travelRequest?.returnDate || p.returnSchedule),
      departureSchedule: p.departureSchedule,
      returnSchedule: p.returnSchedule,
      transportationType: p.transportationType,
      vendorReference: p.vendorReference || '',
      bookingReference: p.bookingReference,
      hotelReference: p.hotelReference || '',
      confirmedCost: Number(p.confirmedCost || 0),
      responsibleCoordinator: p.responsibleCoordinator || 'HR Travel Coordinator',
      status: p.status,
      notes: p.notes || '',
      createdAt: p.createdAt
    }
  }

  _mapVehicleFromApi(v) {
    return {
      id: v.id,
      vehicleId: v.vehicleCode || v.id,
      vehicleName: v.vehicleName,
      registrationNumber: v.registrationNumber,
      vehicleType: v.vehicleType,
      ownershipType: v.ownershipType,
      capacity: Number(v.capacity || 14),
      status: v.status
    }
  }

  _mapDriverFromApi(d) {
    return {
      id: d.id,
      driverId: d.driverCode || d.id,
      driverName: d.driverName,
      licenseNumber: d.licenseNumber || '',
      contactNumber: d.contactNumber,
      assignedVehicleId: d.assignedVehicle?.vehicleCode || d.assignedVehicleId || '',
      assignedVehicleName: d.assignedVehicle?.vehicleName || 'Unassigned Vehicle',
      status: d.status
    }
  }

  _mapRouteFromApi(r) {
    return {
      id: r.id,
      routeId: r.routeCode || r.id,
      routeName: r.routeName,
      pickupPoints: Array.isArray(r.pickupPoints) ? r.pickupPoints : [],
      dropPoint: r.dropPoint || 'iSysware HQ Tech Park',
      morningDepartureTime: r.morningDepartureTime || '07:30 AM',
      eveningDepartureTime: r.eveningDepartureTime || '06:15 PM',
      assignedVehicleId: r.assignedVehicle?.vehicleCode || r.assignedVehicleId || '',
      assignedVehicleName: r.assignedVehicle?.vehicleName || 'Unassigned Vehicle',
      assignedDriverId: r.assignedDriver?.driverCode || r.assignedDriverId || '',
      assignedDriverName: r.assignedDriver?.driverName || 'Unassigned Driver',
      assignedDriverContact: r.assignedDriver?.contactNumber || '',
      capacity: Number(r.capacity || 14),
      assignedCount: Number(r.assignedCount || 0),
      status: r.status
    }
  }

  _mapAssignmentFromApi(a) {
    const empName = a.employee
      ? `${a.employee.firstName || ''} ${a.employee.lastName || ''}`.trim()
      : 'Employee'
    return {
      id: a.id,
      assignmentId: a.assignmentCode || a.id,
      employeeId: a.employee?.employeeCode || a.employeeId,
      employeeName: empName,
      department: a.employee?.department?.name || 'General',
      routeId: a.route?.routeCode || a.routeId,
      routeName: a.route?.routeName || '',
      assignedVehicleName: a.route?.assignedVehicle?.vehicleName || '',
      assignedDriverName: a.route?.assignedDriver?.driverName || '',
      assignedDriverContact: a.route?.assignedDriver?.contactNumber || '',
      pickupPoint: a.pickupPoint,
      dropPoint: a.dropPoint,
      pickupTime: a.pickupTime,
      dropTime: a.dropTime,
      applicableDays: Array.isArray(a.applicableDays) ? a.applicableDays : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      facilityType: a.facilityType,
      monthlyContribution: Number(a.monthlyContribution || 0),
      effectiveFrom: a.effectiveFrom ? String(a.effectiveFrom).slice(0, 10) : '',
      status: a.status,
      approvedBy: a.approvedBy || null,
      approvedDate: a.approvedDate ? String(a.approvedDate).slice(0, 10) : null
    }
  }

  _mapAuditLogFromApi(log) {
    const actorEmp = log.actorUser?.employee
    const actorName = actorEmp
      ? `${actorEmp.firstName || ''} ${actorEmp.lastName || ''}`.trim()
      : (log.actorUser?.username || log.actorRole || 'System')
    return {
      id: log.id,
      requestId: log.entityId,
      entityName: log.entityName,
      action: `${log.entityName}: ${log.actionType}`,
      by: actorName,
      remarks: log.reasonOrNotes || '',
      at: log.createdAt
    }
  }

  async loadTravelDataAsync() {
    if (this._loadPromise) return this._loadPromise
    this._loadPromise = (async () => {
      try {
        const [reqRes, planRes, advRes, vehRes, drvRes, routeRes, asnRes, auditRes] = await Promise.allSettled([
          apiClient.get('/expenses/travel/requests'),
          apiClient.get('/expenses/travel/plans'),
          apiClient.get('/expenses/travel/advances'),
          apiClient.get('/expenses/transport/vehicles'),
          apiClient.get('/expenses/transport/drivers'),
          apiClient.get('/expenses/transport/routes'),
          apiClient.get('/expenses/transport/assignments'),
          apiClient.get('/expenses/travel/audit-logs')
        ])

        if (reqRes.status === 'fulfilled') {
          this.memoryStorage[STORAGE_KEYS.REQUESTS] = this._unwrapApiList(reqRes.value).map((r) => this._mapTravelRequestFromApi(r))
        }
        if (planRes.status === 'fulfilled') {
          this.memoryStorage[STORAGE_KEYS.PLANS] = this._unwrapApiList(planRes.value).map((p) => this._mapTravelPlanFromApi(p))
        }
        if (advRes.status === 'fulfilled') {
          this.memoryStorage[STORAGE_KEYS.EXPENSES] = this._unwrapApiList(advRes.value).map((e) => this._mapTravelExpenseFromApi(e))
        }
        if (vehRes.status === 'fulfilled') {
          this.memoryStorage[STORAGE_KEYS.VEHICLES] = this._unwrapApiList(vehRes.value).map((v) => this._mapVehicleFromApi(v))
        }
        if (drvRes.status === 'fulfilled') {
          this.memoryStorage[STORAGE_KEYS.DRIVERS] = this._unwrapApiList(drvRes.value).map((d) => this._mapDriverFromApi(d))
        }
        if (routeRes.status === 'fulfilled') {
          this.memoryStorage[STORAGE_KEYS.ROUTES] = this._unwrapApiList(routeRes.value).map((r) => this._mapRouteFromApi(r))
        }
        if (asnRes.status === 'fulfilled') {
          this.memoryStorage[STORAGE_KEYS.ASSIGNMENTS] = this._unwrapApiList(asnRes.value).map((a) => this._mapAssignmentFromApi(a))
        }
        if (auditRes.status === 'fulfilled') {
          this.memoryStorage[STORAGE_KEYS.AUDIT_LOGS] = this._unwrapApiList(auditRes.value).map((l) => this._mapAuditLogFromApi(l))
        }

        this._notify()
        return {
          requests: this.memoryStorage[STORAGE_KEYS.REQUESTS],
          plans: this.memoryStorage[STORAGE_KEYS.PLANS],
          expenses: this.memoryStorage[STORAGE_KEYS.EXPENSES],
          vehicles: this.memoryStorage[STORAGE_KEYS.VEHICLES],
          drivers: this.memoryStorage[STORAGE_KEYS.DRIVERS],
          routes: this.memoryStorage[STORAGE_KEYS.ROUTES],
          assignments: this.memoryStorage[STORAGE_KEYS.ASSIGNMENTS],
          auditLogs: this.memoryStorage[STORAGE_KEYS.AUDIT_LOGS]
        }
      } finally {
        this._loadPromise = null
      }
    })()
    return this._loadPromise
  }

  async createTravelRequestAsync(requestData, actorUser) {
    const rawBudget = requestData.estimatedBudget
    const budgetPayload =
      rawBudget === undefined || rawBudget === null || String(rawBudget).trim() === ''
        ? null
        : Number(rawBudget)
    const res = await apiClient.post('/expenses/travel/requests', {
      employeeId: requestData.employeeId || actorUser?.employeeId || actorUser?.id,
      travelPurpose: requestData.travelPurpose || requestData.purpose || '',
      purpose: requestData.travelPurpose || requestData.purpose || '',
      clientProjectRef: requestData.clientProjectRef || requestData.clientReference || '',
      origin: requestData.origin || 'iSysware HQ',
      destination: requestData.destination || '',
      departureDate: requestData.departureDate || null,
      departureTime: requestData.departureTime || '08:00 AM',
      returnDate: requestData.returnDate || null,
      returnTime: requestData.returnTime || '08:00 PM',
      travelMode: requestData.travelMode || 'Commercial Airline',
      accommodationRequired: requestData.accommodationRequired ?? true,
      estimatedBudget: budgetPayload,
      requestedAdvance: Number(requestData.requestedAdvance || 0),
      supportingNotes: requestData.supportingNotes || '',
      status: requestData.status || 'Submitted',
      directApprove: Boolean(
        requestData.directApprove ||
          requestData.autoApprove ||
          String(requestData.status || '').toUpperCase() === 'APPROVED'
      )
    })
    const created = this._mapTravelRequestFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return created
  }

  async updateTravelRequestAsync(requestId, requestData) {
    const rawBudget = requestData.estimatedBudget
    const budgetPayload =
      rawBudget === undefined || rawBudget === null || String(rawBudget).trim() === ''
        ? null
        : Number(rawBudget)
    const payload = {
      travelPurpose: requestData.travelPurpose ?? requestData.purpose ?? '',
      purpose: requestData.travelPurpose ?? requestData.purpose ?? '',
      clientProjectRef: requestData.clientProjectRef ?? requestData.clientReference ?? '',
      origin: requestData.origin || 'iSysware HQ',
      destination: requestData.destination ?? '',
      departureDate: requestData.departureDate || null,
      departureTime: requestData.departureTime || '08:00 AM',
      returnDate: requestData.returnDate || null,
      returnTime: requestData.returnTime || '08:00 PM',
      travelMode: requestData.travelMode || 'Commercial Airline',
      accommodationRequired: requestData.accommodationRequired ?? true,
      estimatedBudget: budgetPayload,
      requestedAdvance: Number(requestData.requestedAdvance || 0),
      supportingNotes: requestData.supportingNotes || ''
    }
    if (requestData.status) payload.status = requestData.status
    if (requestData.directApprove || requestData.autoApprove) payload.directApprove = true
    if (requestData.correctionReason) payload.correctionReason = requestData.correctionReason
    if (requestData.remarks) payload.remarks = requestData.remarks

    const res = await apiClient.patch(`/expenses/travel/requests/${encodeURIComponent(requestId)}`, payload)
    const updated = this._mapTravelRequestFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async submitTravelRequestAsync(requestId, requestData = {}) {
    const res = await apiClient.post(`/expenses/travel/requests/${encodeURIComponent(requestId)}/submit`, requestData)
    const updated = this._mapTravelRequestFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async reviewTravelRequestAsync(requestId, { action, remarks = '' }) {
    const actionMap = { approve: 'APPROVE', recommend: 'RECOMMEND', reject: 'REJECT', return: 'RETURN' }
    const res = await apiClient.patch(`/expenses/travel/requests/${encodeURIComponent(requestId)}/review`, {
      action: actionMap[String(action || '').toLowerCase()] || String(action || '').toUpperCase(),
      decisionRemarks: remarks
    })
    const updated = this._mapTravelRequestFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async approveTravelRequestAsync(requestId, actorUser, remarks = '') {
    return this.reviewTravelRequestAsync(requestId, { action: 'APPROVE', remarks }, actorUser)
  }

  async rejectTravelRequestAsync(requestId, actorUser, remarks = '') {
    return this.reviewTravelRequestAsync(requestId, { action: 'REJECT', remarks }, actorUser)
  }

  async recommendTravelRequestAsync(requestId, actorUser, remarks = '') {
    return this.reviewTravelRequestAsync(requestId, { action: 'RECOMMEND', remarks }, actorUser)
  }

  async cancelTravelRequestAsync(requestId) {
    const res = await apiClient.post(`/expenses/travel/requests/${encodeURIComponent(requestId)}/cancel`, {})
    const updated = this._mapTravelRequestFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async createTravelPlanAsync(planData) {
    const res = await apiClient.post('/expenses/travel/plans', planData)
    const created = this._mapTravelPlanFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return created
  }

  async updateTravelPlanAsync(planId, planData) {
    const res = await apiClient.patch(`/expenses/travel/plans/${encodeURIComponent(planId)}`, planData)
    const updated = this._mapTravelPlanFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async updateTravelPlanStatusAsync(planId, status) {
    const existing = this.getTravelPlans({}, { role: 'super_admin' }).find((p) => p.planId === planId || p.id === planId)
    if (existing) {
      this._validateTravelPlanStatusTransition(existing, status)
    }
    const res = await apiClient.patch(`/expenses/travel/plans/${encodeURIComponent(planId)}/status`, { status })
    const updated = this._mapTravelPlanFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async disburseAdvanceAsync(requestId, disbursementData) {
    const res = await apiClient.post(`/expenses/travel/requests/${encodeURIComponent(requestId)}/disburse-advance`, disbursementData)
    const updated = this._mapTravelExpenseFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async submitExpenseReceiptsAsync(requestId, claimData) {
    const res = await apiClient.post(`/expenses/travel/requests/${encodeURIComponent(requestId)}/receipts`, claimData)
    const updated = this._mapTravelExpenseFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async reconcileTravelExpenseAsync(requestId, reconData) {
    const res = await apiClient.post(`/expenses/travel/requests/${encodeURIComponent(requestId)}/reconcile`, reconData)
    const updated = this._mapTravelExpenseFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async requestPickAndDropAsync(asnData, actorUser) {
    const res = await apiClient.post('/expenses/transport/assignments', {
      ...asnData,
      employeeId: asnData.employeeId || actorUser?.employeeId || actorUser?.id
    })
    const created = this._mapAssignmentFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return created
  }

  async updateTransportAssignmentAsync(assignmentId, asnData) {
    const res = await apiClient.patch(`/expenses/transport/assignments/${encodeURIComponent(assignmentId)}`, asnData)
    const updated = this._mapAssignmentFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async updateTransportAssignmentStatusAsync(assignmentId, status) {
    const res = await apiClient.patch(`/expenses/transport/assignments/${encodeURIComponent(assignmentId)}/status`, { status })
    const updated = this._mapAssignmentFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return updated
  }

  async saveVehicleAsync(vehicleData) {
    const res = await apiClient.post('/expenses/transport/vehicles', vehicleData)
    const saved = this._mapVehicleFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return saved
  }

  async saveDriverAsync(driverData) {
    const res = await apiClient.post('/expenses/transport/drivers', driverData)
    const saved = this._mapDriverFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return saved
  }

  async saveRouteAsync(routeData) {
    const res = await apiClient.post('/expenses/transport/routes', routeData)
    const saved = this._mapRouteFromApi(this._unwrapApiItem(res))
    await this.loadTravelDataAsync()
    return saved
  }
}

export const travelService = new TravelService()
export default travelService
