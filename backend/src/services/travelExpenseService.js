/**
 * iSysware HRMS — Travel, Logistics & Expense Management Backend Service
 * PostgreSQL-backed service implementing all 6 Travel & Transport submodules + Expense Claims:
 * - Official Travel Requests & Multi-Tier Approval Routing
 * - Travel Plans & Bookings (PNR, itineraries, schedules)
 * - Travel Advances & Reconciliation + Itemized Expense Claims (Decimal Precision)
 * - Pick-and-Drop Assignments & Capacity Management
 * - Fleet Vehicles, Drivers & Transport Routes
 * - Travel & Transport Audit Trail (AuditLog sourceModule: 'TRAVEL')
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { Prisma } from '@prisma/client'
import adminSettingsService from './adminSettingsService.js'

export class TravelExpenseService {
  async _generateRequestCode(prefix, modelName, fieldName, pad = 3) {
    const existing = await prisma[modelName].findMany({
      select: { [fieldName]: true }
    })
    let maxNum = 0
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^${escapedPrefix}-(\\d+)$`)
    for (const row of existing) {
      const match = re.exec(String(row[fieldName] || ''))
      if (match) {
        const n = Number(match[1])
        if (n > maxNum) maxNum = n
      }
    }
    return `${prefix}-${String(Math.max(maxNum + 1, existing.length + 1)).padStart(pad, '0')}`
  }

  _isSuperAdmin(user) {
    return String(user?.role || '').toUpperCase() === 'SUPER_ADMIN'
  }

  _actorName(user) {
    if (user?.employee?.firstName || user?.employee?.lastName) {
      return `${user.employee.firstName || ''} ${user.employee.lastName || ''}`.trim()
    }
    return user?.name || user?.username || 'System User'
  }

  _deptId(user) {
    return user?.employee?.departmentId || user?.departmentId || null
  }

  async _resolveEmployee(idOrCode) {
    if (!idOrCode) return null
    return prisma.employee.findFirst({
      where: { OR: [{ id: idOrCode }, { employeeCode: idOrCode }] },
      include: { department: { select: { id: true, name: true } } }
    })
  }

  async _findTravelRequest(idOrCode) {
    return prisma.travelRequest.findFirst({
      where: { OR: [{ id: idOrCode }, { requestCode: idOrCode }] },
      include: {
        employee: {
          include: { department: { select: { id: true, name: true } } }
        },
        plans: true,
        expenseClaims: {
          select: { id: true, claimNumber: true, totalAmount: true, status: true }
        }
      }
    })
  }

  async _logAudit(client, { user, actionType, entityName, entityId, before = null, after = null, notes = null, employeeId = null, sourceModule = 'TRAVEL' }) {
    await client.auditLog.create({
      data: {
        actorUserId: user?.id || null,
        actorEmployeeCode: user?.employee?.employeeCode || null,
        actorRole: user?.role || 'SYSTEM',
        sourceModule,
        actionType,
        entityName,
        entityId: String(entityId),
        recordSnapshotBefore: before || undefined,
        recordSnapshotAfter: {
          ...(after || {}),
          ...(employeeId ? { targetEmployeeId: employeeId } : {})
        },
        reasonOrNotes: notes || null
      }
    })
  }

  _buildScopeWhere(user, employeeField = 'employeeId') {
    const role = String(user?.role || '').toUpperCase()
    if (role === 'EMPLOYEE' || role === 'TEAM_LEAD') {
      if (user?.employeeId) return { [employeeField]: user.employeeId }
      return { [employeeField]: '__NONE__' }
    }
    if (role === 'DEPT_MANAGER') {
      const deptId = this._deptId(user)
      if (deptId && user?.employeeId) {
        return {
          OR: [{ [employeeField]: user.employeeId }, { employee: { departmentId: deptId } }]
        }
      }
      if (user?.employeeId) return { [employeeField]: user.employeeId }
    }
    return {}
  }

  // ============================================================================
  // 1. TRAVEL REQUESTS & APPROVALS
  // ============================================================================

  _parseUtcDate(value, label = 'date') {
    if (value === undefined || value === null || String(value).trim() === '') return null
    const ymd = this._extractYmd(value)
    if (!ymd) {
      throw new AppError(`Valid ${label} is required`, 400, 'VALIDATION_FAILED')
    }
    const parsed = new Date(`${ymd}T00:00:00.000Z`)
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(`Valid ${label} is required`, 400, 'VALIDATION_FAILED')
    }
    return parsed
  }

  _validateTravelRequestPayload(data, { requireComplete = true } = {}) {
    const purpose = String(data.purpose ?? data.travelPurpose ?? '').trim()
    const origin = String(data.origin || 'iSysware HQ').trim() || 'iSysware HQ'
    const destination = String(data.destination ?? '').trim()

    const departureDate = this._parseUtcDate(data.departureDate, 'departure date')
    const returnDate = this._parseUtcDate(data.returnDate, 'return date')
    if (departureDate && returnDate && departureDate > returnDate) {
      throw new AppError('Departure date cannot be after return date', 400, 'INVALID_DATE_RANGE')
    }

    const rawBudget = data.estimatedBudget
    const hasBudgetInput =
      rawBudget !== undefined &&
      rawBudget !== null &&
      String(rawBudget).trim() !== '' &&
      !( !requireComplete && Number(rawBudget) === 0 )

    let estimatedBudget = null
    if (hasBudgetInput) {
      try {
        estimatedBudget = new Prisma.Decimal(rawBudget)
      } catch {
        throw new AppError('Estimated travel budget must be a valid number', 400, 'VALIDATION_FAILED')
      }
      if (estimatedBudget.lt(0)) {
        throw new AppError('Estimated travel budget cannot be negative', 400, 'VALIDATION_FAILED')
      }
    }

    const rawAdvance = data.advanceAmount !== undefined ? data.advanceAmount : (data.requestedAdvance || 0)
    let advanceAmount = new Prisma.Decimal(0)
    if (rawAdvance !== undefined && rawAdvance !== null && String(rawAdvance).trim() !== '') {
      try {
        advanceAmount = new Prisma.Decimal(rawAdvance)
      } catch {
        throw new AppError('Requested advance must be a valid number', 400, 'VALIDATION_FAILED')
      }
    }
    if (advanceAmount.lt(0)) {
      throw new AppError('Requested advance cannot be negative', 400, 'VALIDATION_FAILED')
    }
    if (estimatedBudget !== null && advanceAmount.greaterThan(estimatedBudget)) {
      throw new AppError('Requested travel advance cannot exceed estimated budget', 400, 'BUDGET_EXCEEDED')
    }

    if (requireComplete) {
      if (!purpose || purpose.length < 3) {
        throw new AppError('Travel purpose (minimum 3 characters) is required before submission', 400, 'VALIDATION_FAILED')
      }
      if (!destination) {
        throw new AppError('Destination is required before submission', 400, 'VALIDATION_FAILED')
      }
      if (!departureDate || !returnDate) {
        throw new AppError('Both departure date and return date are required before submission', 400, 'VALIDATION_FAILED')
      }
      if (!estimatedBudget || estimatedBudget.lte(0)) {
        throw new AppError('Estimated travel budget must be greater than zero before submission', 400, 'VALIDATION_FAILED')
      }
    }

    return {
      purpose,
      origin,
      destination,
      departureDate,
      returnDate,
      estimatedBudget,
      advanceAmount
    }
  }

  async _findOverlappingActiveRequests(employeeId, departureDate, returnDate, { excludeId = null, client = prisma } = {}) {
    const depYmd = this._extractYmd(departureDate)
    const retYmd = this._extractYmd(returnDate)
    if (!employeeId || !depYmd || !retYmd) return []

    const candidates = await client.travelRequest.findMany({
      where: {
        employeeId,
        status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        departureDate: { not: null },
        returnDate: { not: null }
      },
      orderBy: { departureDate: 'asc' }
    })

    return candidates.filter((row) => {
      const rowDep = this._extractYmd(row.departureDate)
      const rowRet = this._extractYmd(row.returnDate)
      return rowDep && rowRet && rowDep <= retYmd && rowRet >= depYmd
    })
  }

  async _assertNoOverlappingActiveRequest(employeeId, departureDate, returnDate, opts = {}) {
    const conflicts = await this._findOverlappingActiveRequests(employeeId, departureDate, returnDate, opts)
    if (conflicts.length > 0) {
      const first = conflicts[0]
      const firstDep = this._extractYmd(first.departureDate)
      const firstRet = this._extractYmd(first.returnDate)
      throw new AppError(
        `Overlapping travel conflict: Employee already has active trip '${first.requestCode}' (${first.status}) from ${firstDep} to ${firstRet}.`,
        409,
        'OVERLAPPING_TRAVEL_REQUEST'
      )
    }
  }

  async _attachConflictMetadata(requests = []) {
    if (!Array.isArray(requests) || requests.length === 0) return requests
    const employeeIds = [...new Set(
      requests
        .filter((r) => r?.employeeId && r.departureDate && r.returnDate && !['REJECTED', 'CANCELLED'].includes(r.status))
        .map((r) => r.employeeId)
    )]

    if (employeeIds.length === 0) {
      return requests.map((r) => ({ ...r, hasConflict: false, conflictWithCodes: [], overlappingDraftCodes: [], conflictMessage: null }))
    }

    const pool = await prisma.travelRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: { in: ['DRAFT', 'RETURNED', 'PENDING', 'UNDER_REVIEW', 'APPROVED'] },
        departureDate: { not: null },
        returnDate: { not: null }
      },
      select: {
        id: true,
        requestCode: true,
        employeeId: true,
        status: true,
        departureDate: true,
        returnDate: true
      }
    })

    return requests.map((req) => {
      const dep = this._extractYmd(req.departureDate)
      const ret = this._extractYmd(req.returnDate)
      if (!dep || !ret || ['REJECTED', 'CANCELLED'].includes(req.status)) {
        return { ...req, hasConflict: false, conflictWithCodes: [], overlappingDraftCodes: [], conflictMessage: null }
      }

      const activeOverlaps = pool.filter((o) => {
        if (o.id === req.id || o.employeeId !== req.employeeId) return false
        if (!['PENDING', 'UNDER_REVIEW', 'APPROVED'].includes(o.status)) return false
        const oDep = this._extractYmd(o.departureDate)
        const oRet = this._extractYmd(o.returnDate)
        return oDep && oRet && oDep <= ret && oRet >= dep
      })

      const draftOverlaps = pool.filter((o) => {
        if (o.id === req.id || o.employeeId !== req.employeeId) return false
        if (!['DRAFT', 'RETURNED'].includes(o.status)) return false
        const oDep = this._extractYmd(o.departureDate)
        const oRet = this._extractYmd(o.returnDate)
        return oDep && oRet && oDep <= ret && oRet >= dep
      })

      const hasConflict = activeOverlaps.length > 0
      const conflictWithCodes = activeOverlaps.map((c) => c.requestCode)
      const overlappingDraftCodes = draftOverlaps.map((c) => c.requestCode)
      let conflictMessage = null
      if (hasConflict) {
        const detail = activeOverlaps
          .map((c) => `${c.requestCode} (${c.status}: ${this._extractYmd(c.departureDate)} to ${this._extractYmd(c.returnDate)})`)
          .join(', ')
        conflictMessage = `Date conflict with active request(s): ${detail}. Update dates before submitting or approving.`
      } else if (overlappingDraftCodes.length > 0) {
        conflictMessage = `Notice: Draft(s) ${overlappingDraftCodes.join(', ')} share overlapping dates with this request.`
      }

      return {
        ...req,
        hasConflict,
        conflictWithCodes,
        overlappingDraftCodes,
        conflictMessage
      }
    })
  }

  async getTravelRequests(filters = {}, user) {
    const scopeWhere = this._buildScopeWhere(user)
    const where = { ...scopeWhere }
    if (filters.status) where.status = filters.status
    if (filters.employeeId) where.employeeId = filters.employeeId

    const rows = await prisma.travelRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            departmentId: true,
            department: { select: { id: true, name: true } }
          }
        },
        plans: true,
        expenseClaims: {
          select: { id: true, claimNumber: true, totalAmount: true, status: true }
        }
      },
      orderBy: { appliedAt: 'desc' }
    })
    return this._attachConflictMetadata(rows)
  }

  async createTravelRequest(data, user) {
    const requestedEmpIdentifier = data.employeeId || user?.employeeId
    if (!requestedEmpIdentifier) {
      throw new AppError('Employee ID is required', 400, 'VALIDATION_FAILED')
    }

    const role = String(user?.role || '').toUpperCase()
    const emp = await this._resolveEmployee(requestedEmpIdentifier)
    if (!emp) {
      throw new AppError(`Employee '${requestedEmpIdentifier}' not found`, 404, 'EMPLOYEE_NOT_FOUND')
    }

    // Employees/Managers cannot submit travel requests on behalf of unrelated employees
    if ((role === 'EMPLOYEE' || role === 'TEAM_LEAD') && user?.employeeId && emp.id !== user.employeeId) {
      throw new AppError('You can only submit travel requests for yourself.', 403, 'FORBIDDEN')
    }

    const isDraft = String(data.status || '').toUpperCase() === 'DRAFT'
    const wantsDirectApprove =
      Boolean(data.directApprove || data.autoApprove) ||
      String(data.status || '').toUpperCase() === 'APPROVED'
    const isSuperAdmin = this._isSuperAdmin(user)

    if (wantsDirectApprove && !isDraft && !isSuperAdmin) {
      throw new AppError('Only Super Admin can directly authorize a travel request upon creation', 403, 'FORBIDDEN')
    }

    const {
      purpose,
      origin,
      destination,
      departureDate,
      returnDate,
      estimatedBudget,
      advanceAmount
    } = this._validateTravelRequestPayload(data, { requireComplete: !isDraft })

    // Server-side overlap enforcement on creation whenever dates are present (full check for active submissions/approvals & dated drafts)
    if (departureDate && returnDate) {
      await this._assertNoOverlappingActiveRequest(emp.id, departureDate, returnDate)
    }

    // Enforce POL-TRV-001: Maximum Travel Advance Ceiling
    if (estimatedBudget && estimatedBudget.gt(0) && advanceAmount && advanceAmount.gt(0)) {
      let maxAdvancePct = 80
      try {
        const policies = await adminSettingsService.getCompanyPolicies()
        const trvPolicy = policies.find((p) => p.id === 'POL-TRV-001')
        if (trvPolicy?.rules?.maxAdvancePercentage !== undefined) {
          maxAdvancePct = Number(trvPolicy.rules.maxAdvancePercentage)
        }
      } catch {}
      const maxAllowed = estimatedBudget.mul(maxAdvancePct).div(100)
      if (advanceAmount.greaterThan(maxAllowed)) {
        throw new AppError(
          `Requested travel advance (PKR ${advanceAmount.toString()}) exceeds ${maxAdvancePct}% of estimated budget (max PKR ${maxAllowed.toString()}) under POL-TRV-001.`,
          400,
          'ADVANCE_EXCEEDS_BUDGET_CAP'
        )
      }
    }

    const year = new Date().getFullYear()
    const requestCode = data.requestCode || await this._generateRequestCode(`TRV-${year}`, 'travelRequest', 'requestCode')
    const isDirectApproved = isSuperAdmin && wantsDirectApprove && !isDraft
    const initialStatus = isDraft ? 'DRAFT' : isDirectApproved ? 'APPROVED' : 'PENDING'
    const actorName = this._actorName(user)
    const now = new Date()
    const nowIso = now.toISOString()
    const directRemarks = String(data.decisionRemarks || data.approvalRemarks || 'Directly authorized by Super Admin').trim()
    const dutyDateCode = departureDate ? departureDate.toISOString().slice(0, 10).replace(/-/g, '') : ''
    const historyEntries = [
      {
        action: isDraft ? 'Draft' : 'Submitted',
        by: actorName,
        remarks: isDraft ? 'Saved as travel draft' : 'Official trip request submitted',
        at: nowIso
      }
    ]
    if (isDirectApproved) {
      historyEntries.push({
        action: 'Approved',
        by: actorName,
        remarks: directRemarks,
        at: nowIso
      })
    }

    const created = await prisma.$transaction(async (tx) => {
      const record = await tx.travelRequest.create({
        data: {
          requestCode,
          employeeId: emp.id,
          travelType: data.travelType || 'DOMESTIC',
          origin,
          destination,
          departureDate,
          departureTime: data.departureTime || '08:00 AM',
          returnDate,
          returnTime: data.returnTime || '08:00 PM',
          purpose,
          clientProjectRef: data.clientProjectRef?.trim() || 'Internal Company Engagement',
          travelMode: data.travelMode || 'Commercial Airline',
          accommodationRequired: data.accommodationRequired !== undefined ? Boolean(data.accommodationRequired) : true,
          supportingNotes: data.supportingNotes?.trim() || null,
          estimatedBudget,
          advanceAmount,
          bookingReferencePnr: data.bookingReferencePnr || null,
          status: initialStatus,
          ...(isDirectApproved
            ? {
                reviewedById: user.id,
                reviewedAt: now,
                decisionRemarks: directRemarks,
                finalApproverId: user.employeeId || user.id,
                finalApproverName: actorName,
                finalApprovalRemarks: directRemarks,
                finalApprovedAt: now,
                attendanceF04Ref: `DUTY-FLD-${dutyDateCode}-${requestCode}`,
                expenseCode: `TRV-EXP-${requestCode}`,
                settlementStatus: 'Advance Pending'
              }
            : {}),
          approvalHistory: historyEntries
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          plans: true
        }
      })

      await this._logAudit(tx, {
        user,
        actionType: isDirectApproved ? 'APPROVE' : isDraft ? 'CREATE_DRAFT' : 'CREATE',
        entityName: 'TravelRequest',
        entityId: record.requestCode,
        after: {
          requestCode: record.requestCode,
          destination: record.destination,
          estimatedBudget: record.estimatedBudget !== null ? Number(record.estimatedBudget) : null,
          status: record.status,
          ...(isDirectApproved ? { attendanceF04Ref: record.attendanceF04Ref, directAuthorized: true } : {})
        },
        notes: isDirectApproved
          ? `${record.requestCode} created and directly authorized by Super Admin for ${record.destination}`
          : isDraft
            ? `${record.requestCode} saved as draft`
            : `${record.requestCode} submitted for ${record.destination}`,
        employeeId: emp.id
      })

      return record
    })

    const [enriched] = await this._attachConflictMetadata([created])
    return enriched
  }

  async updateTravelRequest(idOrCode, data = {}, actorUser) {
    const request = await this._findTravelRequest(idOrCode)
    if (!request) throw new AppError('Travel request not found', 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isSuperAdmin = this._isSuperAdmin(actorUser)
    const isHrAdmin = role === 'HR_ADMIN'
    const isOwner = Boolean(actorUser?.employeeId && request.employeeId === actorUser.employeeId)

    if (!isOwner && !isHrAdmin && !isSuperAdmin) {
      throw new AppError('Unauthorized to modify this travel request', 403, 'FORBIDDEN')
    }

    const ownerEditable = ['DRAFT', 'RETURNED', 'PENDING']
    const adminEditable = ['DRAFT', 'RETURNED', 'PENDING', 'UNDER_REVIEW', ...(isSuperAdmin ? ['APPROVED'] : [])]
    const editableStatuses = (isSuperAdmin || isHrAdmin) ? adminEditable : ownerEditable
    if (!editableStatuses.includes(request.status)) {
      throw new AppError(`Cannot edit travel request in status '${request.status}'`, 400, 'INVALID_STATUS')
    }

    if (request.settlementStatus === 'Settled') {
      throw new AppError(
        `Travel request '${request.requestCode}' is financially Settled and locked to preserve historical settlement records.`,
        409,
        'EXPENSE_ALREADY_SETTLED'
      )
    }

    const financialSnapshotLocked =
      request.status === 'APPROVED' &&
      (Number(request.disbursedAdvance || 0) > 0 ||
        request.advanceDisbursedDate != null ||
        request.reconciledAt != null ||
        Number(request.approvedExpenses || 0) > 0 ||
        ['Advance Disbursed', 'Claims Submitted', 'Pending Final Settlement'].includes(request.settlementStatus))

    const oldBudgetNum = request.estimatedBudget !== null ? Number(request.estimatedBudget) : null
    const oldAdvanceNum = request.advanceAmount !== null ? Number(request.advanceAmount) : 0
    if (financialSnapshotLocked) {
      if (
        ('estimatedBudget' in data && data.estimatedBudget !== undefined && data.estimatedBudget !== null && Number(data.estimatedBudget) !== oldBudgetNum) ||
        (('advanceAmount' in data || 'requestedAdvance' in data) &&
          Number(data.advanceAmount !== undefined ? data.advanceAmount : data.requestedAdvance) !== oldAdvanceNum)
      ) {
        throw new AppError(
          `Cannot alter approved budget or advance on '${request.requestCode}' after disbursement/reconciliation; financial snapshot is locked.`,
          409,
          'FINANCIAL_SNAPSHOT_LOCKED'
        )
      }
    }

    const requestedStatusRaw = data.status ? String(data.status).toUpperCase() : null
    const wantsSubmit = requestedStatusRaw === 'PENDING' || requestedStatusRaw === 'SUBMITTED'
    const wantsDirectApprove =
      Boolean(data.directApprove || data.autoApprove) || (requestedStatusRaw === 'APPROVED' && request.status !== 'APPROVED')

    if (wantsDirectApprove && !isSuperAdmin) {
      throw new AppError('Only Super Admin can directly authorize a travel request', 403, 'FORBIDDEN')
    }

    let targetStatus = request.status
    if (requestedStatusRaw === 'DRAFT') {
      if (request.status !== 'DRAFT' && !isSuperAdmin) {
        throw new AppError('Submitted requests cannot be reverted to Draft directly', 400, 'INVALID_STATUS')
      }
      targetStatus = 'DRAFT'
    } else if (isSuperAdmin && wantsDirectApprove) {
      targetStatus = 'APPROVED'
    } else if (wantsSubmit) {
      if (['DRAFT', 'RETURNED'].includes(request.status)) {
        targetStatus = 'PENDING'
      }
    }

    const mergedInput = {
      purpose: ('purpose' in data || 'travelPurpose' in data) ? (data.purpose ?? data.travelPurpose) : request.purpose,
      origin: 'origin' in data ? data.origin : request.origin,
      destination: 'destination' in data ? data.destination : request.destination,
      departureDate: 'departureDate' in data ? data.departureDate : request.departureDate,
      returnDate: 'returnDate' in data ? data.returnDate : request.returnDate,
      estimatedBudget: 'estimatedBudget' in data ? data.estimatedBudget : request.estimatedBudget,
      advanceAmount: ('advanceAmount' in data || 'requestedAdvance' in data)
        ? (data.advanceAmount !== undefined ? data.advanceAmount : data.requestedAdvance)
        : request.advanceAmount
    }

    const requireComplete = targetStatus !== 'DRAFT'
    const validated = this._validateTravelRequestPayload(mergedInput, { requireComplete })

    const oldDepYmd = this._extractYmd(request.departureDate)
    const oldRetYmd = this._extractYmd(request.returnDate)
    const newDepYmd = this._extractYmd(validated.departureDate)
    const newRetYmd = this._extractYmd(validated.returnDate)
    const datesChanged = oldDepYmd !== newDepYmd || oldRetYmd !== newRetYmd

    if ((targetStatus !== 'DRAFT' || datesChanged) && validated.departureDate && validated.returnDate) {
      await this._assertNoOverlappingActiveRequest(
        request.employeeId,
        validated.departureDate,
        validated.returnDate,
        { excludeId: request.id }
      )
    }

    const actorName = this._actorName(actorUser)
    const now = new Date()
    const nowIso = now.toISOString()
    const history = Array.isArray(request.approvalHistory) ? [...request.approvalHistory] : []
    const isTransitionToApproved = targetStatus === 'APPROVED' && request.status !== 'APPROVED'
    const isTransitionToSubmitted = targetStatus === 'PENDING' && request.status !== 'PENDING'

    if (isTransitionToSubmitted) {
      history.push({
        action: 'Submitted',
        by: actorName,
        remarks: String(data.remarks || 'Draft completed and submitted for review').trim(),
        at: nowIso
      })
    } else if (isTransitionToApproved) {
      history.push({
        action: 'Approved',
        by: actorName,
        remarks: String(data.decisionRemarks || data.approvalRemarks || 'Directly authorized by Super Admin').trim(),
        at: nowIso
      })
    } else if (request.status === 'APPROVED') {
      history.push({
        action: 'Authorized Correction',
        by: actorName,
        remarks: String(data.correctionReason || data.remarks || 'Authorized correction applied by Super Admin').trim(),
        at: nowIso
      })
    } else if (datesChanged) {
      history.push({
        action: 'Dates Updated',
        by: actorName,
        remarks: `Schedule updated (${oldDepYmd || 'unset'}..${oldRetYmd || 'unset'} -> ${newDepYmd || 'unset'}..${newRetYmd || 'unset'})`,
        at: nowIso
      })
    } else {
      history.push({
        action: 'Updated',
        by: actorName,
        remarks: String(data.remarks || data.correctionReason || 'Travel request details updated').trim(),
        at: nowIso
      })
    }

    const dutyDateCode = validated.departureDate ? validated.departureDate.toISOString().slice(0, 10).replace(/-/g, '') : null
    const directRemarks = String(data.decisionRemarks || data.approvalRemarks || 'Directly authorized by Super Admin').trim()

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.travelRequest.update({
        where: { id: request.id },
        data: {
          purpose: validated.purpose,
          origin: validated.origin,
          destination: validated.destination,
          departureDate: validated.departureDate,
          departureTime: 'departureTime' in data ? (data.departureTime || '08:00 AM') : request.departureTime,
          returnDate: validated.returnDate,
          returnTime: 'returnTime' in data ? (data.returnTime || '08:00 PM') : request.returnTime,
          clientProjectRef: ('clientProjectRef' in data || 'clientReference' in data)
            ? ((data.clientProjectRef ?? data.clientReference)?.trim() || 'Internal Company Engagement')
            : request.clientProjectRef,
          travelMode: 'travelMode' in data ? (data.travelMode || 'Commercial Airline') : request.travelMode,
          accommodationRequired: 'accommodationRequired' in data
            ? Boolean(data.accommodationRequired)
            : request.accommodationRequired,
          supportingNotes: 'supportingNotes' in data ? (data.supportingNotes?.trim() || null) : request.supportingNotes,
          estimatedBudget: validated.estimatedBudget,
          advanceAmount: validated.advanceAmount,
          status: targetStatus,
          ...(isTransitionToApproved
            ? {
                reviewedById: actorUser.id,
                reviewedAt: now,
                decisionRemarks: directRemarks,
                finalApproverId: actorUser.employeeId || actorUser.id,
                finalApproverName: actorName,
                finalApprovalRemarks: directRemarks,
                finalApprovedAt: now,
                attendanceF04Ref: `DUTY-FLD-${dutyDateCode}-${request.requestCode}`,
                expenseCode: request.expenseCode || `TRV-EXP-${request.requestCode}`,
                settlementStatus: request.settlementStatus === 'Not Initialized' ? 'Advance Pending' : request.settlementStatus
              }
            : {}),
          approvalHistory: history
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          plans: true
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: isTransitionToApproved ? 'APPROVE' : isTransitionToSubmitted ? 'SUBMIT' : 'UPDATE',
        entityName: 'TravelRequest',
        entityId: request.requestCode,
        before: {
          status: request.status,
          purpose: request.purpose,
          destination: request.destination,
          departureDate: oldDepYmd,
          returnDate: oldRetYmd,
          estimatedBudget: request.estimatedBudget !== null ? Number(request.estimatedBudget) : null,
          advanceAmount: request.advanceAmount !== null ? Number(request.advanceAmount) : 0
        },
        after: {
          status: record.status,
          purpose: record.purpose,
          destination: record.destination,
          departureDate: newDepYmd,
          returnDate: newRetYmd,
          estimatedBudget: record.estimatedBudget !== null ? Number(record.estimatedBudget) : null,
          advanceAmount: record.advanceAmount !== null ? Number(record.advanceAmount) : 0
        },
        notes: isTransitionToApproved
          ? `${request.requestCode} updated and directly authorized by ${actorName}`
          : isTransitionToSubmitted
            ? `${request.requestCode} submitted by ${actorName}`
            : request.status === 'APPROVED'
              ? `${request.requestCode} authorized correction applied by ${actorName}`
              : `${request.requestCode} updated by ${actorName}`,
        employeeId: request.employeeId
      })

      return record
    })

    const [enriched] = await this._attachConflictMetadata([updated])
    return enriched
  }

  async submitTravelRequest(idOrCode, data = {}, actorUser) {
    const request = await this._findTravelRequest(idOrCode)
    if (!request) throw new AppError('Travel request not found', 404, 'NOT_FOUND')
    if (!['DRAFT', 'RETURNED'].includes(request.status)) {
      throw new AppError(`Only Draft or Returned travel requests can be submitted (current status: '${request.status}')`, 400, 'INVALID_STATUS')
    }

    const wantsDirectApprove = Boolean(data.directApprove || data.autoApprove) && this._isSuperAdmin(actorUser)
    return this.updateTravelRequest(
      request.id,
      {
        ...data,
        status: wantsDirectApprove ? 'APPROVED' : 'PENDING',
        directApprove: wantsDirectApprove
      },
      actorUser
    )
  }

  async reviewTravelRequest(idOrCode, { action, remarks, decisionRemarks }, reviewerUser) {
    const request = await this._findTravelRequest(idOrCode)
    if (!request) throw new AppError('Travel request not found', 404, 'NOT_FOUND')

    const isSuperAdmin = this._isSuperAdmin(reviewerUser)
    const allowedStatuses = isSuperAdmin
      ? ['DRAFT', 'PENDING', 'UNDER_REVIEW', 'RETURNED']
      : ['PENDING', 'UNDER_REVIEW']
    if (!allowedStatuses.includes(request.status)) {
      throw new AppError('Travel request has already been reviewed', 400, 'ALREADY_REVIEWED')
    }

    // Critical Anti-Self-Approval (bypassed for SUPER_ADMIN universal authority)
    if (!isSuperAdmin && reviewerUser?.employeeId && request.employeeId === reviewerUser.employeeId) {
      throw new AppError('Anti-self-approval: You cannot approve or review your own official travel request', 403, 'SELF_APPROVAL_PROHIBITED')
    }

    const role = String(reviewerUser?.role || '').toUpperCase()
    if (role === 'DEPT_MANAGER') {
      const mgrDept = this._deptId(reviewerUser)
      if (mgrDept && request.employee?.departmentId !== mgrDept) {
        throw new AppError('Managers can only review travel requests within their own department', 403, 'FORBIDDEN')
      }
    }

    const normalizedAction = String(action || '').toUpperCase()
    if (!['APPROVE', 'RECOMMEND', 'REJECT', 'RETURN'].includes(normalizedAction)) {
      throw new AppError('Invalid review action. Must be APPROVE, RECOMMEND, REJECT, or RETURN', 400, 'VALIDATION_FAILED')
    }

    // Enforce completeness and overlap guard before approving or recommending
    if (normalizedAction === 'APPROVE' || normalizedAction === 'RECOMMEND') {
      this._validateTravelRequestPayload(request, { requireComplete: true })
      await this._assertNoOverlappingActiveRequest(
        request.employeeId,
        request.departureDate,
        request.returnDate,
        { excludeId: request.id }
      )
    }

    const actorName = this._actorName(reviewerUser)
    const now = new Date()
    const nowIso = now.toISOString()
    const noteText = (decisionRemarks || remarks || '').trim()
    const history = Array.isArray(request.approvalHistory) ? [...request.approvalHistory] : []

    let updateData = {
      reviewedById: reviewerUser.id,
      reviewedAt: now,
      decisionRemarks: noteText || null
    }

    let actionLabel = 'Approved'
    if (normalizedAction === 'REJECT') {
      updateData.status = 'REJECTED'
      updateData.rejectedBy = actorName
      updateData.rejectedAt = now
      updateData.decisionRemarks = noteText || 'Declined under policy review'
      actionLabel = 'Rejected'
    } else if (normalizedAction === 'RETURN') {
      updateData.status = 'RETURNED'
      actionLabel = 'Returned'
    } else if (normalizedAction === 'RECOMMEND') {
      updateData.status = 'UNDER_REVIEW'
      updateData.managerReviewerId = reviewerUser.employeeId || reviewerUser.id
      updateData.managerReviewerName = actorName
      updateData.managerRemarks = noteText || 'Recommended by Line Manager'
      updateData.managerReviewedAt = now
      actionLabel = 'Under Review'
    } else {
      updateData.status = 'APPROVED'
      updateData.finalApproverId = reviewerUser.employeeId || reviewerUser.id
      updateData.finalApproverName = actorName
      updateData.finalApprovalRemarks = noteText || 'Approved for official company travel'
      updateData.finalApprovedAt = now
      const dutyDateCode = request.departureDate.toISOString().slice(0, 10).replace(/-/g, '')
      updateData.attendanceF04Ref = `DUTY-FLD-${dutyDateCode}-${request.requestCode}`
      if (!request.expenseCode) {
        updateData.expenseCode = `TRV-EXP-${request.requestCode}`
        updateData.settlementStatus = 'Advance Pending'
      }
      actionLabel = 'Approved'
    }

    history.push({
      action: actionLabel,
      by: actorName,
      remarks: noteText || `${actionLabel} applied`,
      at: nowIso
    })
    updateData.approvalHistory = history

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.travelRequest.update({
        where: { id: request.id },
        data: updateData,
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          plans: true
        }
      })

      await this._logAudit(tx, {
        user: reviewerUser,
        actionType: normalizedAction,
        entityName: 'TravelRequest',
        entityId: request.requestCode,
        before: { status: request.status },
        after: { status: record.status, attendanceF04Ref: record.attendanceF04Ref },
        notes: noteText || `${actionLabel} by ${actorName}`,
        employeeId: request.employeeId
      })

      return record
    })

    const [enriched] = await this._attachConflictMetadata([updated])
    return enriched
  }

  async cancelTravelRequest(idOrCode, actorUser) {
    const request = await this._findTravelRequest(idOrCode)
    if (!request) throw new AppError('Travel request not found', 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = actorUser?.employeeId && request.employeeId === actorUser.employeeId

    if (!isOwner && !isAdmin) {
      throw new AppError('Unauthorized to cancel this travel request', 403, 'FORBIDDEN')
    }
    if (!['DRAFT', 'PENDING', 'UNDER_REVIEW'].includes(request.status)) {
      throw new AppError(`Cannot cancel travel request in status '${request.status}'`, 400, 'INVALID_STATUS')
    }

    const actorName = this._actorName(actorUser)
    const now = new Date()
    const history = Array.isArray(request.approvalHistory) ? [...request.approvalHistory] : []
    history.push({
      action: 'Cancelled',
      by: actorName,
      remarks: 'Request withdrawn / cancelled',
      at: now.toISOString()
    })

    return prisma.$transaction(async (tx) => {
      const updated = await tx.travelRequest.update({
        where: { id: request.id },
        data: {
          status: 'CANCELLED',
          cancelledBy: actorName,
          cancelledAt: now,
          approvalHistory: history
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          plans: true
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'CANCEL',
        entityName: 'TravelRequest',
        entityId: request.requestCode,
        before: { status: request.status },
        after: { status: 'CANCELLED' },
        notes: `Travel request ${request.requestCode} cancelled by ${actorName}`,
        employeeId: request.employeeId
      })

      return updated
    })
  }

  async updateTransportAssignment(idOrCode, data = {}, actorUser) {
    const assignment = await prisma.transportAssignment.findFirst({
      where: { OR: [{ id: idOrCode }, { assignmentCode: idOrCode }] },
      include: { route: true }
    })
    if (!assignment) throw new AppError(`Transport assignment '${idOrCode}' not found`, 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = Boolean(actorUser?.employeeId && assignment.employeeId === actorUser.employeeId)

    if (!isAdmin && !isOwner) {
      throw new AppError('Unauthorized to edit this transport assignment', 403, 'FORBIDDEN')
    }
    if (!isAdmin && assignment.status !== 'Pending Approval') {
      throw new AppError('Only HR Admin or Super Admin can edit active or suspended transport assignments', 403, 'FORBIDDEN')
    }
    if (['Cancelled', 'Rejected'].includes(assignment.status)) {
      throw new AppError(`Cannot edit transport assignment in status '${assignment.status}'`, 400, 'INVALID_STATUS')
    }

    let targetRoute = assignment.route
    if (data.routeId && data.routeId !== assignment.routeId && data.routeId !== assignment.route?.routeCode) {
      targetRoute = await prisma.transportRoute.findFirst({
        where: { OR: [{ id: data.routeId }, { routeCode: data.routeId }] }
      })
      if (!targetRoute) throw new AppError(`Route '${data.routeId}' not found`, 404, 'NOT_FOUND')
      if (targetRoute.status !== 'Active') {
        throw new AppError(`Route '${targetRoute.routeName}' is currently ${targetRoute.status} and cannot accept assignments`, 400, 'ROUTE_INACTIVE')
      }
      if (assignment.status === 'Active') {
        const activeCount = await prisma.transportAssignment.count({
          where: { routeId: targetRoute.id, status: 'Active' }
        })
        if (activeCount >= targetRoute.capacity) {
          throw new AppError(`Route '${targetRoute.routeName}' is at full capacity (${targetRoute.capacity})`, 400, 'CAPACITY_EXCEEDED')
        }
      }
    }

    const pickupPoint = 'pickupPoint' in data ? String(data.pickupPoint || '').trim() : assignment.pickupPoint
    if (!pickupPoint) throw new AppError('Pickup point is required', 400, 'VALIDATION_FAILED')

    const nextContribution =
      data.monthlyContribution !== undefined && data.monthlyContribution !== null && String(data.monthlyContribution).trim() !== ''
        ? Number(data.monthlyContribution)
        : Number(assignment.monthlyContribution)
    if (!Number.isFinite(nextContribution) || nextContribution < 0) {
      throw new AppError('Monthly contribution must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.transportAssignment.update({
        where: { id: assignment.id },
        data: {
          routeId: targetRoute.id,
          pickupPoint,
          dropPoint: 'dropPoint' in data ? (String(data.dropPoint || '').trim() || assignment.dropPoint) : assignment.dropPoint,
          pickupTime: 'pickupTime' in data && data.pickupTime ? String(data.pickupTime).trim() : assignment.pickupTime,
          dropTime: 'dropTime' in data && data.dropTime ? String(data.dropTime).trim() : targetRoute.eveningDepartureTime || assignment.dropTime,
          facilityType: 'facilityType' in data && data.facilityType ? String(data.facilityType).trim() : assignment.facilityType,
          monthlyContribution: new Prisma.Decimal(nextContribution),
          effectiveFrom: 'effectiveFrom' in data && data.effectiveFrom ? new Date(data.effectiveFrom) : assignment.effectiveFrom,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TransportAssignment',
        entityId: assignment.assignmentCode,
        before: {
          routeId: assignment.routeId,
          pickupPoint: assignment.pickupPoint,
          pickupTime: assignment.pickupTime,
          facilityType: assignment.facilityType,
          monthlyContribution: Number(assignment.monthlyContribution)
        },
        after: {
          routeId: updated.routeId,
          pickupPoint: updated.pickupPoint,
          pickupTime: updated.pickupTime,
          facilityType: updated.facilityType,
          monthlyContribution: Number(updated.monthlyContribution)
        },
        notes: `Transport assignment ${assignment.assignmentCode} updated by ${actorName}`,
        employeeId: assignment.employeeId
      })

      return updated
    })
  }

  async attachBookingPnr(idOrCode, bookingReferencePnr, user) {
    const request = await this._findTravelRequest(idOrCode)
    if (!request) throw new AppError('Travel request not found', 404, 'NOT_FOUND')

    if (request.status !== 'APPROVED') {
      throw new AppError('Booking details can only be attached to approved travel requests', 400, 'NOT_APPROVED')
    }

    return prisma.travelRequest.update({
      where: { id: request.id },
      data: { bookingReferencePnr }
    })
  }

  // ============================================================================
  // 2. TRAVEL PLANS & BOOKINGS
  // ============================================================================

  async getTravelPlans(filters = {}, user) {
    const scopeWhere = this._buildScopeWhere(user)
    const where = { ...scopeWhere }
    if (filters.status && filters.status !== 'all') {
      where.status = filters.status
    }

    return prisma.travelPlan.findMany({
      where,
      include: {
        travelRequest: {
          select: { id: true, requestCode: true, destination: true, status: true, departureDate: true, returnDate: true }
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async createTravelPlan(data, actorUser) {
    const targetReqId = data.requestId || data.travelRequestId
    if (!targetReqId) throw new AppError('Target travel request ID is required', 400, 'VALIDATION_FAILED')
    if (!data.bookingReference || !String(data.bookingReference).trim()) {
      throw new AppError('Booking reference or PNR number is required', 400, 'VALIDATION_FAILED')
    }

    const travelReq = await this._findTravelRequest(targetReqId)
    if (!travelReq) throw new AppError(`Travel request '${targetReqId}' does not exist`, 404, 'NOT_FOUND')
    if (travelReq.status !== 'APPROVED') {
      throw new AppError(`Cannot create travel plan for request '${travelReq.requestCode}' with status '${travelReq.status}'. Must be Approved.`, 400, 'NOT_APPROVED')
    }

    const planCode = await this._generateRequestCode('TRV-PLAN', 'travelPlan', 'planCode')
    const actorName = this._actorName(actorUser)
    const defaultDep = `${travelReq.departureDate.toISOString().slice(0, 10)} ${travelReq.departureTime || '08:00 AM'}`
    const defaultRet = `${travelReq.returnDate.toISOString().slice(0, 10)} ${travelReq.returnTime || '08:00 PM'}`

    return prisma.$transaction(async (tx) => {
      const plan = await tx.travelPlan.create({
        data: {
          planCode,
          travelRequestId: travelReq.id,
          employeeId: travelReq.employeeId,
          departureSchedule: data.departureSchedule || defaultDep,
          returnSchedule: data.returnSchedule || defaultRet,
          transportationType: data.transportationType || travelReq.travelMode || 'Commercial Airline',
          vendorReference: data.vendorReference?.trim() || 'Corporate Logistics Desk',
          bookingReference: String(data.bookingReference).trim(),
          hotelReference: data.hotelReference?.trim() || 'Corporate Accommodation Booking',
          confirmedCost: data.confirmedCost ? new Prisma.Decimal(data.confirmedCost) : travelReq.estimatedBudget,
          responsibleCoordinator: actorName,
          status: 'Planned',
          notes: data.notes?.trim() || null
        },
        include: {
          travelRequest: { select: { id: true, requestCode: true, destination: true, status: true, departureDate: true, returnDate: true } },
          employee: { include: { department: { select: { id: true, name: true } } } }
        }
      })

      await tx.travelRequest.update({
        where: { id: travelReq.id },
        data: { bookingReferencePnr: plan.bookingReference }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'CREATE',
        entityName: 'TravelPlan',
        entityId: plan.planCode,
        after: {
          planCode: plan.planCode,
          requestCode: travelReq.requestCode,
          bookingReference: plan.bookingReference,
          confirmedCost: Number(plan.confirmedCost)
        },
        notes: `Travel itinerary ${plan.planCode} (PNR: ${plan.bookingReference}) created for ${travelReq.requestCode}`,
        employeeId: travelReq.employeeId
      })

      return plan
    })
  }

  async updateTravelPlan(idOrCode, data = {}, actorUser) {
    const role = String(actorUser?.role || '').toUpperCase()
    if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(role)) {
      throw new AppError('Only Super Admin or HR Admin can edit travel plans and bookings', 403, 'FORBIDDEN')
    }

    const plan = await prisma.travelPlan.findFirst({
      where: { OR: [{ id: idOrCode }, { planCode: idOrCode }] },
      include: { travelRequest: true }
    })
    if (!plan) throw new AppError(`Travel plan '${idOrCode}' not found`, 404, 'NOT_FOUND')

    if (['Completed', 'Cancelled'].includes(plan.status)) {
      throw new AppError(`Cannot edit travel plan '${plan.planCode}' once status is '${plan.status}'`, 400, 'INVALID_STATUS')
    }

    const nextBookingRef = 'bookingReference' in data ? String(data.bookingReference || '').trim() : plan.bookingReference
    if (!nextBookingRef) {
      throw new AppError('Booking reference or PNR number is required', 400, 'VALIDATION_FAILED')
    }

    const nextConfirmedCost =
      data.confirmedCost !== undefined && data.confirmedCost !== null && String(data.confirmedCost).trim() !== ''
        ? Number(data.confirmedCost)
        : Number(plan.confirmedCost)
    if (!Number.isFinite(nextConfirmedCost) || nextConfirmedCost < 0) {
      throw new AppError('Confirmed cost must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    if (
      plan.travelRequest?.settlementStatus === 'Settled' &&
      nextConfirmedCost !== Number(plan.confirmedCost)
    ) {
      throw new AppError(
        `Cannot alter confirmed cost on '${plan.planCode}' because linked request '${plan.travelRequest.requestCode}' is financially Settled.`,
        409,
        'EXPENSE_ALREADY_SETTLED'
      )
    }

    const nextDep = 'departureSchedule' in data && data.departureSchedule ? String(data.departureSchedule).trim() : plan.departureSchedule
    const nextRet = 'returnSchedule' in data && data.returnSchedule ? String(data.returnSchedule).trim() : plan.returnSchedule
    const depYmd = this._extractYmd(nextDep)
    const retYmd = this._extractYmd(nextRet)
    if (depYmd && retYmd && retYmd < depYmd) {
      throw new AppError('Return schedule date cannot be earlier than departure schedule date', 400, 'INVALID_DATES')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.travelPlan.update({
        where: { id: plan.id },
        data: {
          departureSchedule: nextDep,
          returnSchedule: nextRet,
          transportationType: 'transportationType' in data && data.transportationType
            ? String(data.transportationType).trim()
            : plan.transportationType,
          vendorReference: 'vendorReference' in data
            ? (String(data.vendorReference || '').trim() || plan.vendorReference)
            : plan.vendorReference,
          bookingReference: nextBookingRef,
          hotelReference: 'hotelReference' in data
            ? (String(data.hotelReference || '').trim() || plan.hotelReference)
            : plan.hotelReference,
          confirmedCost: new Prisma.Decimal(nextConfirmedCost),
          notes: 'notes' in data ? (data.notes ? String(data.notes).trim() : null) : plan.notes
        },
        include: {
          travelRequest: { select: { id: true, requestCode: true, destination: true, status: true, departureDate: true, returnDate: true } },
          employee: { include: { department: { select: { id: true, name: true } } } }
        }
      })

      if (plan.travelRequestId && nextBookingRef !== plan.bookingReference) {
        await tx.travelRequest.update({
          where: { id: plan.travelRequestId },
          data: { bookingReferencePnr: nextBookingRef }
        })
      }

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TravelPlan',
        entityId: plan.planCode,
        before: {
          departureSchedule: plan.departureSchedule,
          returnSchedule: plan.returnSchedule,
          bookingReference: plan.bookingReference,
          hotelReference: plan.hotelReference,
          confirmedCost: Number(plan.confirmedCost)
        },
        after: {
          departureSchedule: updated.departureSchedule,
          returnSchedule: updated.returnSchedule,
          bookingReference: updated.bookingReference,
          hotelReference: updated.hotelReference,
          confirmedCost: Number(updated.confirmedCost)
        },
        notes: `Travel itinerary ${plan.planCode} updated by ${actorName}`,
        employeeId: plan.employeeId
      })

      return updated
    })
  }

  async updateTravelPlan(idOrCode, data = {}, actorUser) {
    const role = String(actorUser?.role || '').toUpperCase()
    if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(role)) {
      throw new AppError('Only Super Admin or HR Admin can edit travel plans and bookings', 403, 'FORBIDDEN')
    }

    const plan = await prisma.travelPlan.findFirst({
      where: { OR: [{ id: idOrCode }, { planCode: idOrCode }] },
      include: { travelRequest: true }
    })
    if (!plan) throw new AppError(`Travel plan '${idOrCode}' not found`, 404, 'NOT_FOUND')

    if (['Completed', 'Cancelled'].includes(plan.status)) {
      throw new AppError(`Cannot edit travel plan '${plan.planCode}' once status is '${plan.status}'`, 400, 'INVALID_STATUS')
    }

    const nextBookingRef = 'bookingReference' in data ? String(data.bookingReference || '').trim() : plan.bookingReference
    if (!nextBookingRef) {
      throw new AppError('Booking reference or PNR number is required', 400, 'VALIDATION_FAILED')
    }

    const nextConfirmedCost =
      data.confirmedCost !== undefined && data.confirmedCost !== null && String(data.confirmedCost).trim() !== ''
        ? Number(data.confirmedCost)
        : Number(plan.confirmedCost)
    if (!Number.isFinite(nextConfirmedCost) || nextConfirmedCost < 0) {
      throw new AppError('Confirmed cost must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    if (
      plan.travelRequest?.settlementStatus === 'Settled' &&
      nextConfirmedCost !== Number(plan.confirmedCost)
    ) {
      throw new AppError(
        `Cannot alter confirmed cost on '${plan.planCode}' because linked request '${plan.travelRequest.requestCode}' is financially Settled.`,
        409,
        'EXPENSE_ALREADY_SETTLED'
      )
    }

    const nextDep = 'departureSchedule' in data && data.departureSchedule ? String(data.departureSchedule).trim() : plan.departureSchedule
    const nextRet = 'returnSchedule' in data && data.returnSchedule ? String(data.returnSchedule).trim() : plan.returnSchedule
    const depYmd = this._extractYmd(nextDep)
    const retYmd = this._extractYmd(nextRet)
    if (depYmd && retYmd && retYmd < depYmd) {
      throw new AppError('Return schedule date cannot be earlier than departure schedule date', 400, 'INVALID_DATES')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.travelPlan.update({
        where: { id: plan.id },
        data: {
          departureSchedule: nextDep,
          returnSchedule: nextRet,
          transportationType: 'transportationType' in data && data.transportationType
            ? String(data.transportationType).trim()
            : plan.transportationType,
          vendorReference: 'vendorReference' in data
            ? (String(data.vendorReference || '').trim() || plan.vendorReference)
            : plan.vendorReference,
          bookingReference: nextBookingRef,
          hotelReference: 'hotelReference' in data
            ? (String(data.hotelReference || '').trim() || plan.hotelReference)
            : plan.hotelReference,
          confirmedCost: new Prisma.Decimal(nextConfirmedCost),
          notes: 'notes' in data ? (data.notes ? String(data.notes).trim() : null) : plan.notes
        },
        include: {
          travelRequest: { select: { id: true, requestCode: true, destination: true, status: true, departureDate: true, returnDate: true } },
          employee: { include: { department: { select: { id: true, name: true } } } }
        }
      })

      if (plan.travelRequestId && nextBookingRef !== plan.bookingReference) {
        await tx.travelRequest.update({
          where: { id: plan.travelRequestId },
          data: { bookingReferencePnr: nextBookingRef }
        })
      }

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TravelPlan',
        entityId: plan.planCode,
        before: {
          departureSchedule: plan.departureSchedule,
          returnSchedule: plan.returnSchedule,
          bookingReference: plan.bookingReference,
          hotelReference: plan.hotelReference,
          confirmedCost: Number(plan.confirmedCost)
        },
        after: {
          departureSchedule: updated.departureSchedule,
          returnSchedule: updated.returnSchedule,
          bookingReference: updated.bookingReference,
          hotelReference: updated.hotelReference,
          confirmedCost: Number(updated.confirmedCost)
        },
        notes: `Travel itinerary ${plan.planCode} updated by ${actorName}`,
        employeeId: plan.employeeId
      })

      return updated
    })
  }

  async updateTransportAssignment(idOrCode, data = {}, actorUser) {
    const assignment = await prisma.transportAssignment.findFirst({
      where: { OR: [{ id: idOrCode }, { assignmentCode: idOrCode }] },
      include: { route: true }
    })
    if (!assignment) throw new AppError(`Transport assignment '${idOrCode}' not found`, 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = Boolean(actorUser?.employeeId && assignment.employeeId === actorUser.employeeId)

    if (!isAdmin && !isOwner) {
      throw new AppError('Unauthorized to edit this transport assignment', 403, 'FORBIDDEN')
    }
    if (!isAdmin && assignment.status !== 'Pending Approval') {
      throw new AppError('Only HR Admin or Super Admin can edit active or suspended transport assignments', 403, 'FORBIDDEN')
    }
    if (['Cancelled', 'Rejected'].includes(assignment.status)) {
      throw new AppError(`Cannot edit transport assignment in status '${assignment.status}'`, 400, 'INVALID_STATUS')
    }

    let targetRoute = assignment.route
    if (data.routeId && data.routeId !== assignment.routeId && data.routeId !== assignment.route?.routeCode) {
      targetRoute = await prisma.transportRoute.findFirst({
        where: { OR: [{ id: data.routeId }, { routeCode: data.routeId }] }
      })
      if (!targetRoute) throw new AppError(`Route '${data.routeId}' not found`, 404, 'NOT_FOUND')
      if (targetRoute.status !== 'Active') {
        throw new AppError(`Route '${targetRoute.routeName}' is currently ${targetRoute.status} and cannot accept assignments`, 400, 'ROUTE_INACTIVE')
      }
      if (assignment.status === 'Active') {
        const activeCount = await prisma.transportAssignment.count({
          where: { routeId: targetRoute.id, status: 'Active' }
        })
        if (activeCount >= targetRoute.capacity) {
          throw new AppError(`Route '${targetRoute.routeName}' is at full capacity (${targetRoute.capacity})`, 400, 'CAPACITY_EXCEEDED')
        }
      }
    }

    const pickupPoint = 'pickupPoint' in data ? String(data.pickupPoint || '').trim() : assignment.pickupPoint
    if (!pickupPoint) throw new AppError('Pickup point is required', 400, 'VALIDATION_FAILED')

    const nextContribution =
      data.monthlyContribution !== undefined && data.monthlyContribution !== null && String(data.monthlyContribution).trim() !== ''
        ? Number(data.monthlyContribution)
        : Number(assignment.monthlyContribution)
    if (!Number.isFinite(nextContribution) || nextContribution < 0) {
      throw new AppError('Monthly contribution must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.transportAssignment.update({
        where: { id: assignment.id },
        data: {
          routeId: targetRoute.id,
          pickupPoint,
          dropPoint: 'dropPoint' in data ? (String(data.dropPoint || '').trim() || assignment.dropPoint) : assignment.dropPoint,
          pickupTime: 'pickupTime' in data && data.pickupTime ? String(data.pickupTime).trim() : assignment.pickupTime,
          dropTime: 'dropTime' in data && data.dropTime ? String(data.dropTime).trim() : targetRoute.eveningDepartureTime || assignment.dropTime,
          facilityType: 'facilityType' in data && data.facilityType ? String(data.facilityType).trim() : assignment.facilityType,
          monthlyContribution: new Prisma.Decimal(nextContribution),
          effectiveFrom: 'effectiveFrom' in data && data.effectiveFrom ? new Date(data.effectiveFrom) : assignment.effectiveFrom,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TransportAssignment',
        entityId: assignment.assignmentCode,
        before: {
          routeId: assignment.routeId,
          pickupPoint: assignment.pickupPoint,
          pickupTime: assignment.pickupTime,
          facilityType: assignment.facilityType,
          monthlyContribution: Number(assignment.monthlyContribution)
        },
        after: {
          routeId: updated.routeId,
          pickupPoint: updated.pickupPoint,
          pickupTime: updated.pickupTime,
          facilityType: updated.facilityType,
          monthlyContribution: Number(updated.monthlyContribution)
        },
        notes: `Transport assignment ${assignment.assignmentCode} updated by ${actorName}`,
        employeeId: assignment.employeeId
      })

      return updated
    })
  }

  _extractYmd(value) {
    if (!value) return null
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10)
    }
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

  _validateTravelPlanTransition(plan, nextStatus) {
    const validStatuses = ['Planned', 'In Progress', 'Completed', 'Cancelled']
    if (!validStatuses.includes(nextStatus)) {
      throw new AppError(`Invalid travel plan status '${nextStatus}'`, 400, 'VALIDATION_FAILED')
    }

    if (plan.status === nextStatus) {
      throw new AppError(
        `Repeated transition blocked: Travel plan '${plan.planCode}' is already '${nextStatus}'.`,
        400,
        'INVALID_STATUS_TRANSITION'
      )
    }

    const allowedTransitions = {
      Planned: ['In Progress', 'Cancelled'],
      'In Progress': ['Completed', 'Cancelled'],
      Completed: [],
      Cancelled: []
    }
    const allowedNext = allowedTransitions[plan.status] || []
    if (!allowedNext.includes(nextStatus)) {
      throw new AppError(
        `Invalid status transition: Cannot change travel plan '${plan.planCode}' from '${plan.status}' to '${nextStatus}'.`,
        400,
        'INVALID_STATUS_TRANSITION'
      )
    }

    if ((nextStatus === 'In Progress' || nextStatus === 'Completed') && plan.travelRequest && plan.travelRequest.status !== 'APPROVED') {
      throw new AppError(
        `Cannot move travel plan '${plan.planCode}' to '${nextStatus}' while linked travel request is '${plan.travelRequest.status}'.`,
        400,
        'NOT_APPROVED'
      )
    }

    const todayYmd = this._todayYmd()
    const depYmd = this._extractYmd(plan.departureSchedule) || this._extractYmd(plan.travelRequest?.departureDate)
    const retYmd = this._extractYmd(plan.returnSchedule) || this._extractYmd(plan.travelRequest?.returnDate)

    if (nextStatus === 'In Progress') {
      if (!depYmd) {
        throw new AppError(`Travel plan '${plan.planCode}' is missing a valid departure date.`, 400, 'VALIDATION_FAILED')
      }
      if (todayYmd < depYmd) {
        throw new AppError(
          `Cannot start travel plan '${plan.planCode}' before scheduled departure date (${depYmd}). Current date: ${todayYmd}.`,
          400,
          'PREMATURE_START_BLOCKED'
        )
      }
    }

    if (nextStatus === 'Completed') {
      if (!retYmd) {
        throw new AppError(`Travel plan '${plan.planCode}' is missing a valid return date.`, 400, 'VALIDATION_FAILED')
      }
      if (todayYmd < retYmd) {
        throw new AppError(
          `Cannot complete travel plan '${plan.planCode}' before scheduled return date (${retYmd}). Current date: ${todayYmd}.`,
          400,
          'PREMATURE_COMPLETION_BLOCKED'
        )
      }
    }
  }

  async updateTravelPlanStatus(idOrCode, status, actorUser) {
    const role = String(actorUser?.role || '').toUpperCase()
    if (role !== 'SUPER_ADMIN' && role !== 'HR_ADMIN') {
      throw new AppError('Only Super Admin or HR Admin can update travel plan status.', 403, 'FORBIDDEN')
    }

    const plan = await prisma.travelPlan.findFirst({
      where: { OR: [{ id: idOrCode }, { planCode: idOrCode }] },
      include: { travelRequest: true }
    })
    if (!plan) throw new AppError(`Travel plan '${idOrCode}' not found`, 404, 'NOT_FOUND')

    this._validateTravelPlanTransition(plan, status)

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.travelPlan.update({
        where: { id: plan.id },
        data: { status, updatedBy: actorName },
        include: {
          travelRequest: { select: { id: true, requestCode: true, destination: true, status: true, departureDate: true, returnDate: true } },
          employee: { include: { department: { select: { id: true, name: true } } } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TravelPlan',
        entityId: plan.planCode,
        before: { status: plan.status },
        after: { status: updated.status },
        notes: `Travel plan ${plan.planCode} moved from '${plan.status}' to '${status}'`,
        employeeId: plan.employeeId
      })

      return updated
    })
  }

  async updateTransportAssignment(idOrCode, data = {}, actorUser) {
    const assignment = await prisma.transportAssignment.findFirst({
      where: { OR: [{ id: idOrCode }, { assignmentCode: idOrCode }] },
      include: { route: true }
    })
    if (!assignment) throw new AppError(`Transport assignment '${idOrCode}' not found`, 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = Boolean(actorUser?.employeeId && assignment.employeeId === actorUser.employeeId)

    if (!isAdmin && !isOwner) {
      throw new AppError('Unauthorized to edit this transport assignment', 403, 'FORBIDDEN')
    }
    if (!isAdmin && assignment.status !== 'Pending Approval') {
      throw new AppError('Only HR Admin or Super Admin can edit active or suspended transport assignments', 403, 'FORBIDDEN')
    }
    if (['Cancelled', 'Rejected'].includes(assignment.status)) {
      throw new AppError(`Cannot edit transport assignment in status '${assignment.status}'`, 400, 'INVALID_STATUS')
    }

    let targetRoute = assignment.route
    if (data.routeId && data.routeId !== assignment.routeId && data.routeId !== assignment.route?.routeCode) {
      targetRoute = await prisma.transportRoute.findFirst({
        where: { OR: [{ id: data.routeId }, { routeCode: data.routeId }] }
      })
      if (!targetRoute) throw new AppError(`Route '${data.routeId}' not found`, 404, 'NOT_FOUND')
      if (targetRoute.status !== 'Active') {
        throw new AppError(`Route '${targetRoute.routeName}' is currently ${targetRoute.status} and cannot accept assignments`, 400, 'ROUTE_INACTIVE')
      }
      if (assignment.status === 'Active') {
        const activeCount = await prisma.transportAssignment.count({
          where: { routeId: targetRoute.id, status: 'Active' }
        })
        if (activeCount >= targetRoute.capacity) {
          throw new AppError(`Route '${targetRoute.routeName}' is at full capacity (${targetRoute.capacity})`, 400, 'CAPACITY_EXCEEDED')
        }
      }
    }

    const pickupPoint = 'pickupPoint' in data ? String(data.pickupPoint || '').trim() : assignment.pickupPoint
    if (!pickupPoint) throw new AppError('Pickup point is required', 400, 'VALIDATION_FAILED')

    const nextContribution =
      data.monthlyContribution !== undefined && data.monthlyContribution !== null && String(data.monthlyContribution).trim() !== ''
        ? Number(data.monthlyContribution)
        : Number(assignment.monthlyContribution)
    if (!Number.isFinite(nextContribution) || nextContribution < 0) {
      throw new AppError('Monthly contribution must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.transportAssignment.update({
        where: { id: assignment.id },
        data: {
          routeId: targetRoute.id,
          pickupPoint,
          dropPoint: 'dropPoint' in data ? (String(data.dropPoint || '').trim() || assignment.dropPoint) : assignment.dropPoint,
          pickupTime: 'pickupTime' in data && data.pickupTime ? String(data.pickupTime).trim() : assignment.pickupTime,
          dropTime: 'dropTime' in data && data.dropTime ? String(data.dropTime).trim() : targetRoute.eveningDepartureTime || assignment.dropTime,
          facilityType: 'facilityType' in data && data.facilityType ? String(data.facilityType).trim() : assignment.facilityType,
          monthlyContribution: new Prisma.Decimal(nextContribution),
          effectiveFrom: 'effectiveFrom' in data && data.effectiveFrom ? new Date(data.effectiveFrom) : assignment.effectiveFrom,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TransportAssignment',
        entityId: assignment.assignmentCode,
        before: {
          routeId: assignment.routeId,
          pickupPoint: assignment.pickupPoint,
          pickupTime: assignment.pickupTime,
          facilityType: assignment.facilityType,
          monthlyContribution: Number(assignment.monthlyContribution)
        },
        after: {
          routeId: updated.routeId,
          pickupPoint: updated.pickupPoint,
          pickupTime: updated.pickupTime,
          facilityType: updated.facilityType,
          monthlyContribution: Number(updated.monthlyContribution)
        },
        notes: `Transport assignment ${assignment.assignmentCode} updated by ${actorName}`,
        employeeId: assignment.employeeId
      })

      return updated
    })
  }

  // ============================================================================
  // 3. TRAVEL ADVANCES & EXPENSE RECONCILIATION (SUBMODULE 3)
  // ============================================================================

  async getTravelAdvancesLedger(filters = {}, user) {
    const scopeWhere = this._buildScopeWhere(user)
    const where = {
      ...scopeWhere,
      status: 'APPROVED'
    }
    if (filters.requestId) {
      where.OR = [{ id: filters.requestId }, { requestCode: filters.requestId }]
    }

    return prisma.travelRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { appliedAt: 'desc' }
    })
  }

  _normalizeTravelLifecycleStatus(rawStatus) {
    const map = {
      DRAFT: 'Draft',
      RETURNED: 'Returned',
      PENDING: 'Pending',
      UNDER_REVIEW: 'Under Review',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled'
    }
    return map[String(rawStatus || '').toUpperCase()] || rawStatus || 'Pending'
  }

  _buildTravelReconciliationItem(trv) {
    const rawStatus = String(trv.status || '').toUpperCase()
    const requestStatus = this._normalizeTravelLifecycleStatus(rawStatus)
    const isEligible = ['APPROVED', 'COMPLETED'].includes(rawStatus)

    const empName = trv.employee
      ? `${trv.employee.firstName || ''} ${trv.employee.lastName || ''}`.trim() || 'Authorized Staff'
      : 'Authorized Staff'
    const depDate = trv.departureDate ? String(trv.departureDate).slice(0, 10) : ''
    const retDate = trv.returnDate ? String(trv.returnDate).slice(0, 10) : ''

    const linkedClaims = Array.isArray(trv.expenseClaims) ? trv.expenseClaims : []
    const activeF12Claims = linkedClaims.filter(
      (c) => !['REJECTED', 'DRAFT', 'CANCELLED'].includes(String(c.status || '').toUpperCase())
    )
    const approvedF12Claims = activeF12Claims.filter((c) =>
      ['MANAGER_APPROVED', 'HR_APPROVED', 'DISBURSED'].includes(String(c.status || '').toUpperCase())
    )
    const pendingF12Claims = activeF12Claims.filter(
      (c) => !['MANAGER_APPROVED', 'HR_APPROVED', 'DISBURSED'].includes(String(c.status || '').toUpperCase())
    )

    const f12SubmittedTotal = activeF12Claims.reduce((s, c) => s + Number(c.totalAmount || 0), 0)
    const f12ApprovedTotal = approvedF12Claims.reduce((s, c) => s + Number(c.totalAmount || 0), 0)
    const f12DisbursedSurplus = approvedF12Claims
      .filter((c) => String(c.status || '').toUpperCase() === 'DISBURSED')
      .reduce((s, c) => s + Number(c.netPayableAmount || 0), 0)

    const f10Disbursed = Number(trv.disbursedAdvance || 0)
    const f10Submitted = Number(trv.employeeSubmittedExp || 0)
    const f10Approved = Number(trv.approvedExpenses || 0)
    const f10ReceiptRefs = Array.isArray(trv.expenseReceiptRefs) ? trv.expenseReceiptRefs : []
    const f10Settled = String(trv.settlementStatus || '').trim() === 'Settled'
    const hasF10Reconciliation = Boolean(trv.reconciledAt) || f10Settled || trv.settlementStatus === 'Pending Final Settlement'
    const hasF10Claim = Boolean(trv.claimSubmittedAt) || f10Submitted > 0 || f10ReceiptRefs.length > 0

    // Never leak requested advance (advanceAmount) as disbursed advance on Draft/Rejected/Pending trips
    const disbursedAdvance = isEligible ? f10Disbursed : 0
    const totalSubmittedClaims = isEligible ? Math.max(f10Submitted, f12SubmittedTotal) : 0
    const totalApprovedClaims = isEligible ? Math.max(f10Approved, f12ApprovedTotal) : 0

    const rawBalance = isEligible ? (totalApprovedClaims - disbursedAdvance) : 0
    const netSettlementBalance = isEligible
      ? (f10Settled
          ? Number(trv.settlementBalance ?? 0)
          : (rawBalance > 0 ? Math.max(rawBalance - f12DisbursedSurplus, 0) : rawBalance))
      : 0

    const hasPendingClaims =
      isEligible &&
      (pendingF12Claims.length > 0 ||
        (hasF10Claim && !hasF10Reconciliation && totalSubmittedClaims > totalApprovedClaims))

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

    return {
      id: trv.id,
      tripId: trv.requestCode,
      requestCode: trv.requestCode,
      expenseCode: hasFinancialActivity || f10Settled ? this._expenseCode(trv) : (trv.expenseCode || null),
      requestStatus,
      rawStatus,
      isEligibleForReconciliation: isEligible,
      employeeId: trv.employee?.employeeCode || trv.employeeId,
      employeeCuid: trv.employeeId,
      employeeName: empName,
      department: trv.employee?.department?.name || 'General',
      destination: trv.destination,
      travelDates: depDate && retDate ? `${depDate} to ${retDate}` : 'Dates TBD',
      approvedBudget: Number(trv.estimatedBudget || 0),
      requestedAdvance: Number(trv.advanceAmount || 0),
      disbursedAdvance,
      advanceDisbursedRef: trv.advanceDisbursedRef || null,
      advanceDisbursedDate: trv.advanceDisbursedDate ? String(trv.advanceDisbursedDate).slice(0, 10) : null,
      totalSubmittedClaims,
      totalApprovedClaims,
      netSettlementBalance,
      reconciliationStatus,
      isReconciled,
      isSettled,
      hasFinancialActivity,
      reconciledAt: trv.reconciledAt ? String(trv.reconciledAt).slice(0, 10) : null,
      reconciledBy: trv.reconciledBy || null,
      reconciliationNotes: trv.reconciliationNotes || null,
      f10SettlementStatus: trv.settlementStatus || 'Not Initialized',
      f10ReceiptReferences: f10ReceiptRefs,
      linkedClaimCount: activeF12Claims.length,
      linkedClaimNumbers: activeF12Claims.map((c) => c.claimNumber),
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

  async getTravelExpenseReconciliations(filters = {}, user) {
    const scopeWhere = this._buildScopeWhere(user)
    const where = { ...scopeWhere }
    if (filters.requestId) {
      where.OR = [{ id: filters.requestId }, { requestCode: filters.requestId }]
    }
    const includeIneligible =
      filters.includeIneligible === true || String(filters.includeIneligible || '').toLowerCase() === 'true'
    if (!includeIneligible) {
      where.status = 'APPROVED'
    }

    const rows = await prisma.travelRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            departmentId: true,
            department: { select: { id: true, name: true } }
          }
        },
        expenseClaims: {
          select: {
            id: true,
            claimNumber: true,
            totalAmount: true,
            advanceSettlementAmount: true,
            netPayableAmount: true,
            status: true,
            disbursedAt: true,
            submissionDate: true
          }
        }
      },
      orderBy: { appliedAt: 'desc' }
    })

    return rows.map((row) => this._buildTravelReconciliationItem(row))
  }

  _expenseCode(request) {
    return request.expenseCode || `TRV-EXP-${request.requestCode}`
  }

  _isExpenseSettled(request) {
    return String(request?.settlementStatus || '').trim() === 'Settled'
  }

  _assertNotSettled(request, actionLabel = 'modify') {
    if (this._isExpenseSettled(request)) {
      const code = this._expenseCode(request)
      const reconciledYmd = this._extractYmd(request.reconciledAt)
      throw new AppError(
        `Financial lock: Travel expense '${code}' is already Settled${reconciledYmd ? ` (finalized on ${reconciledYmd})` : ''}. Cannot ${actionLabel} after final settlement.`,
        409,
        'EXPENSE_ALREADY_SETTLED'
      )
    }
  }

  async disburseTravelAdvance(requestIdOrCode, { disbursedAmount, voucherReference, notes = '' }, actorUser) {
    const request = await this._findTravelRequest(requestIdOrCode)
    if (!request) throw new AppError(`Travel request '${requestIdOrCode}' not found`, 404, 'NOT_FOUND')
    if (request.status !== 'APPROVED') {
      throw new AppError('Advances can only be disbursed for approved travel requests', 400, 'NOT_APPROVED')
    }

    this._assertNotSettled(request, 'disburse additional travel advance')

    if (request.reconciledAt || request.settlementStatus === 'Pending Final Settlement') {
      throw new AppError(
        `Financial lock: Travel expense '${this._expenseCode(request)}' has already been reconciled (${request.settlementStatus}). Advance disbursement is closed.`,
        409,
        'EXPENSE_ALREADY_RECONCILED'
      )
    }

    if (
      Number(request.disbursedAdvance || 0) > 0 ||
      Boolean(request.advanceDisbursedDate || request.advanceDisbursedRef) ||
      request.settlementStatus === 'Advance Disbursed'
    ) {
      throw new AppError(
        `Duplicate advance blocked: Advance of Rs. ${Number(request.disbursedAdvance || 0).toLocaleString()} was already disbursed under voucher '${request.advanceDisbursedRef || 'N/A'}'. Double disbursement is prohibited.`,
        409,
        'ADVANCE_ALREADY_DISBURSED'
      )
    }

    const numAmount = Number(disbursedAmount)
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      throw new AppError('Disbursed advance amount must be greater than zero', 400, 'VALIDATION_FAILED')
    }
    const cleanVoucher = String(voucherReference || '').trim()
    if (!cleanVoucher) {
      throw new AppError('Petty cash or payment voucher reference is required', 400, 'VALIDATION_FAILED')
    }
    if (request.estimatedBudget !== null && numAmount > Number(request.estimatedBudget)) {
      throw new AppError('Disbursed advance cannot exceed approved travel budget', 400, 'BUDGET_EXCEEDED')
    }

    const duplicateVoucher = await prisma.travelRequest.findFirst({
      where: {
        id: { not: request.id },
        advanceDisbursedRef: { equals: cleanVoucher, mode: 'insensitive' }
      },
      select: { requestCode: true, expenseCode: true }
    })
    if (duplicateVoucher) {
      throw new AppError(
        `Duplicate voucher blocked: Payment voucher '${cleanVoucher}' is already posted against '${duplicateVoucher.expenseCode || duplicateVoucher.requestCode}'.`,
        409,
        'DUPLICATE_VOUCHER_REFERENCE'
      )
    }

    const actorName = this._actorName(actorUser)
    const balance = Number(request.approvedExpenses || 0) - numAmount
    const history = Array.isArray(request.approvalHistory) ? [...request.approvalHistory] : []
    history.push({
      action: 'Advance Disbursed',
      by: actorName,
      remarks: `Rs. ${numAmount} under voucher ${cleanVoucher}`,
      at: new Date().toISOString()
    })

    return prisma.$transaction(async (tx) => {
      // Atomic idempotency guard against concurrent duplicate advance disbursement
      const lockRes = await tx.travelRequest.updateMany({
        where: {
          id: request.id,
          status: 'APPROVED',
          advanceDisbursedDate: null,
          advanceDisbursedRef: null,
          reconciledAt: null,
          NOT: {
            settlementStatus: { in: ['Settled', 'Advance Disbursed', 'Pending Final Settlement'] }
          }
        },
        data: {
          expenseCode: this._expenseCode(request),
          disbursedAdvance: new Prisma.Decimal(numAmount),
          advanceDisbursedDate: new Date(),
          advanceDisbursedRef: cleanVoucher,
          advanceDisbursedBy: actorName,
          settlementStatus: 'Advance Disbursed',
          settlementBalance: new Prisma.Decimal(balance),
          reconciliationNotes: notes?.trim() || request.reconciliationNotes,
          approvalHistory: history
        }
      })

      if (lockRes.count === 0) {
        throw new AppError(
          `Duplicate financial posting blocked: Travel advance for '${this._expenseCode(request)}' was already processed.`,
          409,
          'DUPLICATE_FINANCIAL_POSTING'
        )
      }

      const updated = await tx.travelRequest.findUnique({
        where: { id: request.id },
        include: { employee: { include: { department: { select: { id: true, name: true } } } } }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'DISBURSE_ADVANCE',
        entityName: 'TravelAdvance',
        entityId: request.requestCode,
        before: {
          disbursedAdvance: Number(request.disbursedAdvance || 0),
          voucherReference: request.advanceDisbursedRef || null,
          settlementStatus: request.settlementStatus
        },
        after: {
          disbursedAdvance: numAmount,
          voucherReference: cleanVoucher,
          settlementStatus: updated.settlementStatus
        },
        notes: `Advance Rs. ${numAmount} disbursed (${cleanVoucher})`,
        employeeId: request.employeeId
      })

      return updated
    })
  }

  async updateTransportAssignment(idOrCode, data = {}, actorUser) {
    const assignment = await prisma.transportAssignment.findFirst({
      where: { OR: [{ id: idOrCode }, { assignmentCode: idOrCode }] },
      include: { route: true }
    })
    if (!assignment) throw new AppError(`Transport assignment '${idOrCode}' not found`, 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = Boolean(actorUser?.employeeId && assignment.employeeId === actorUser.employeeId)

    if (!isAdmin && !isOwner) {
      throw new AppError('Unauthorized to edit this transport assignment', 403, 'FORBIDDEN')
    }
    if (!isAdmin && assignment.status !== 'Pending Approval') {
      throw new AppError('Only HR Admin or Super Admin can edit active or suspended transport assignments', 403, 'FORBIDDEN')
    }
    if (['Cancelled', 'Rejected'].includes(assignment.status)) {
      throw new AppError(`Cannot edit transport assignment in status '${assignment.status}'`, 400, 'INVALID_STATUS')
    }

    let targetRoute = assignment.route
    if (data.routeId && data.routeId !== assignment.routeId && data.routeId !== assignment.route?.routeCode) {
      targetRoute = await prisma.transportRoute.findFirst({
        where: { OR: [{ id: data.routeId }, { routeCode: data.routeId }] }
      })
      if (!targetRoute) throw new AppError(`Route '${data.routeId}' not found`, 404, 'NOT_FOUND')
      if (targetRoute.status !== 'Active') {
        throw new AppError(`Route '${targetRoute.routeName}' is currently ${targetRoute.status} and cannot accept assignments`, 400, 'ROUTE_INACTIVE')
      }
      if (assignment.status === 'Active') {
        const activeCount = await prisma.transportAssignment.count({
          where: { routeId: targetRoute.id, status: 'Active' }
        })
        if (activeCount >= targetRoute.capacity) {
          throw new AppError(`Route '${targetRoute.routeName}' is at full capacity (${targetRoute.capacity})`, 400, 'CAPACITY_EXCEEDED')
        }
      }
    }

    const pickupPoint = 'pickupPoint' in data ? String(data.pickupPoint || '').trim() : assignment.pickupPoint
    if (!pickupPoint) throw new AppError('Pickup point is required', 400, 'VALIDATION_FAILED')

    const nextContribution =
      data.monthlyContribution !== undefined && data.monthlyContribution !== null && String(data.monthlyContribution).trim() !== ''
        ? Number(data.monthlyContribution)
        : Number(assignment.monthlyContribution)
    if (!Number.isFinite(nextContribution) || nextContribution < 0) {
      throw new AppError('Monthly contribution must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.transportAssignment.update({
        where: { id: assignment.id },
        data: {
          routeId: targetRoute.id,
          pickupPoint,
          dropPoint: 'dropPoint' in data ? (String(data.dropPoint || '').trim() || assignment.dropPoint) : assignment.dropPoint,
          pickupTime: 'pickupTime' in data && data.pickupTime ? String(data.pickupTime).trim() : assignment.pickupTime,
          dropTime: 'dropTime' in data && data.dropTime ? String(data.dropTime).trim() : targetRoute.eveningDepartureTime || assignment.dropTime,
          facilityType: 'facilityType' in data && data.facilityType ? String(data.facilityType).trim() : assignment.facilityType,
          monthlyContribution: new Prisma.Decimal(nextContribution),
          effectiveFrom: 'effectiveFrom' in data && data.effectiveFrom ? new Date(data.effectiveFrom) : assignment.effectiveFrom,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TransportAssignment',
        entityId: assignment.assignmentCode,
        before: {
          routeId: assignment.routeId,
          pickupPoint: assignment.pickupPoint,
          pickupTime: assignment.pickupTime,
          facilityType: assignment.facilityType,
          monthlyContribution: Number(assignment.monthlyContribution)
        },
        after: {
          routeId: updated.routeId,
          pickupPoint: updated.pickupPoint,
          pickupTime: updated.pickupTime,
          facilityType: updated.facilityType,
          monthlyContribution: Number(updated.monthlyContribution)
        },
        notes: `Transport assignment ${assignment.assignmentCode} updated by ${actorName}`,
        employeeId: assignment.employeeId
      })

      return updated
    })
  }

  async submitTravelExpenseReceipts(requestIdOrCode, { submittedExpenses, receiptReferences = [], notes = '' }, actorUser) {
    const request = await this._findTravelRequest(requestIdOrCode)
    if (!request) throw new AppError(`Travel request '${requestIdOrCode}' not found`, 404, 'NOT_FOUND')
    if (request.status !== 'APPROVED') {
      throw new AppError('Receipts can only be submitted for approved travel requests', 400, 'NOT_APPROVED')
    }

    this._assertNotSettled(request, 'submit or modify expense claims')
    if (request.reconciledAt || request.settlementStatus === 'Pending Final Settlement') {
      throw new AppError(
        `Financial lock: Travel expense '${this._expenseCode(request)}' has already been reconciled (${request.settlementStatus}). Expense claims are locked.`,
        409,
        'EXPENSE_ALREADY_RECONCILED'
      )
    }

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = actorUser?.employeeId && request.employeeId === actorUser.employeeId
    if (!isOwner && !isAdmin) {
      throw new AppError('Unauthorized to submit receipts for another employee trip', 403, 'FORBIDDEN')
    }

    const numExpenses = Number(submittedExpenses)
    if (Number.isNaN(numExpenses) || numExpenses < 0) {
      throw new AppError('Submitted expense amount must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    const refs = Array.isArray(receiptReferences)
      ? receiptReferences.map((r) => String(r).trim()).filter(Boolean)
      : String(receiptReferences || '').split(',').map((r) => r.trim()).filter(Boolean)
    if (refs.length === 0) {
      throw new AppError('At least one receipt or invoice reference is required', 400, 'VALIDATION_FAILED')
    }

    const existingRefs = Array.isArray(request.expenseReceiptRefs)
      ? request.expenseReceiptRefs.map((r) => String(r).trim()).filter(Boolean)
      : []
    if (
      request.claimSubmittedAt &&
      Number(request.employeeSubmittedExp || 0) === numExpenses &&
      existingRefs.length === refs.length &&
      existingRefs.every((v, i) => v === refs[i])
    ) {
      throw new AppError(
        `Duplicate claim blocked: Identical expense claim (Rs. ${numExpenses.toLocaleString()} with ${refs.join(', ')}) has already been submitted for '${this._expenseCode(request)}'.`,
        409,
        'DUPLICATE_EXPENSE_CLAIM'
      )
    }

    const actorName = this._actorName(actorUser)
    const history = Array.isArray(request.approvalHistory) ? [...request.approvalHistory] : []
    history.push({
      action: 'Receipts Submitted',
      by: actorName,
      remarks: `Claimed Rs. ${numExpenses} (${refs.join(', ')})`,
      at: new Date().toISOString()
    })

    return prisma.$transaction(async (tx) => {
      const lockRes = await tx.travelRequest.updateMany({
        where: {
          id: request.id,
          status: 'APPROVED',
          reconciledAt: null,
          NOT: { settlementStatus: { in: ['Settled', 'Pending Final Settlement'] } }
        },
        data: {
          expenseCode: this._expenseCode(request),
          employeeSubmittedExp: new Prisma.Decimal(numExpenses),
          expenseReceiptRefs: refs,
          claimSubmittedAt: new Date(),
          claimSubmittedBy: actorName,
          settlementStatus: request.settlementStatus === 'Not Initialized' ? 'Receipts Submitted' : request.settlementStatus,
          reconciliationNotes: notes?.trim() || request.reconciliationNotes,
          approvalHistory: history
        }
      })

      if (lockRes.count === 0) {
        throw new AppError(
          `Financial lock: Travel expense '${this._expenseCode(request)}' was settled or reconciled before this claim could be recorded.`,
          409,
          'EXPENSE_ALREADY_SETTLED'
        )
      }

      const updated = await tx.travelRequest.findUnique({
        where: { id: request.id },
        include: { employee: { include: { department: { select: { id: true, name: true } } } } }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'SUBMIT_RECEIPTS',
        entityName: 'TravelAdvance',
        entityId: request.requestCode,
        after: {
          submittedExpenses: numExpenses,
          receiptReferences: refs
        },
        notes: `Employee submitted Rs. ${numExpenses} travel receipts`,
        employeeId: request.employeeId
      })

      return updated
    })
  }

  async updateTransportAssignment(idOrCode, data = {}, actorUser) {
    const assignment = await prisma.transportAssignment.findFirst({
      where: { OR: [{ id: idOrCode }, { assignmentCode: idOrCode }] },
      include: { route: true }
    })
    if (!assignment) throw new AppError(`Transport assignment '${idOrCode}' not found`, 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = Boolean(actorUser?.employeeId && assignment.employeeId === actorUser.employeeId)

    if (!isAdmin && !isOwner) {
      throw new AppError('Unauthorized to edit this transport assignment', 403, 'FORBIDDEN')
    }
    if (!isAdmin && assignment.status !== 'Pending Approval') {
      throw new AppError('Only HR Admin or Super Admin can edit active or suspended transport assignments', 403, 'FORBIDDEN')
    }
    if (['Cancelled', 'Rejected'].includes(assignment.status)) {
      throw new AppError(`Cannot edit transport assignment in status '${assignment.status}'`, 400, 'INVALID_STATUS')
    }

    let targetRoute = assignment.route
    if (data.routeId && data.routeId !== assignment.routeId && data.routeId !== assignment.route?.routeCode) {
      targetRoute = await prisma.transportRoute.findFirst({
        where: { OR: [{ id: data.routeId }, { routeCode: data.routeId }] }
      })
      if (!targetRoute) throw new AppError(`Route '${data.routeId}' not found`, 404, 'NOT_FOUND')
      if (targetRoute.status !== 'Active') {
        throw new AppError(`Route '${targetRoute.routeName}' is currently ${targetRoute.status} and cannot accept assignments`, 400, 'ROUTE_INACTIVE')
      }
      if (assignment.status === 'Active') {
        const activeCount = await prisma.transportAssignment.count({
          where: { routeId: targetRoute.id, status: 'Active' }
        })
        if (activeCount >= targetRoute.capacity) {
          throw new AppError(`Route '${targetRoute.routeName}' is at full capacity (${targetRoute.capacity})`, 400, 'CAPACITY_EXCEEDED')
        }
      }
    }

    const pickupPoint = 'pickupPoint' in data ? String(data.pickupPoint || '').trim() : assignment.pickupPoint
    if (!pickupPoint) throw new AppError('Pickup point is required', 400, 'VALIDATION_FAILED')

    const nextContribution =
      data.monthlyContribution !== undefined && data.monthlyContribution !== null && String(data.monthlyContribution).trim() !== ''
        ? Number(data.monthlyContribution)
        : Number(assignment.monthlyContribution)
    if (!Number.isFinite(nextContribution) || nextContribution < 0) {
      throw new AppError('Monthly contribution must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.transportAssignment.update({
        where: { id: assignment.id },
        data: {
          routeId: targetRoute.id,
          pickupPoint,
          dropPoint: 'dropPoint' in data ? (String(data.dropPoint || '').trim() || assignment.dropPoint) : assignment.dropPoint,
          pickupTime: 'pickupTime' in data && data.pickupTime ? String(data.pickupTime).trim() : assignment.pickupTime,
          dropTime: 'dropTime' in data && data.dropTime ? String(data.dropTime).trim() : targetRoute.eveningDepartureTime || assignment.dropTime,
          facilityType: 'facilityType' in data && data.facilityType ? String(data.facilityType).trim() : assignment.facilityType,
          monthlyContribution: new Prisma.Decimal(nextContribution),
          effectiveFrom: 'effectiveFrom' in data && data.effectiveFrom ? new Date(data.effectiveFrom) : assignment.effectiveFrom,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TransportAssignment',
        entityId: assignment.assignmentCode,
        before: {
          routeId: assignment.routeId,
          pickupPoint: assignment.pickupPoint,
          pickupTime: assignment.pickupTime,
          facilityType: assignment.facilityType,
          monthlyContribution: Number(assignment.monthlyContribution)
        },
        after: {
          routeId: updated.routeId,
          pickupPoint: updated.pickupPoint,
          pickupTime: updated.pickupTime,
          facilityType: updated.facilityType,
          monthlyContribution: Number(updated.monthlyContribution)
        },
        notes: `Transport assignment ${assignment.assignmentCode} updated by ${actorName}`,
        employeeId: assignment.employeeId
      })

      return updated
    })
  }

  async reconcileTravelExpense(requestIdOrCode, { approvedExpenses, notes = '' }, actorUser) {
    const request = await this._findTravelRequest(requestIdOrCode)
    if (!request) throw new AppError(`Travel request '${requestIdOrCode}' not found`, 404, 'NOT_FOUND')
    if (request.status !== 'APPROVED') {
      throw new AppError('Reconciliation requires an approved travel request', 400, 'NOT_APPROVED')
    }

    this._assertNotSettled(request, 'reconcile travel expenses')

    // Anti-self-reconciliation (bypassed for SUPER_ADMIN universal authority)
    if (!this._isSuperAdmin(actorUser) && actorUser?.employeeId && request.employeeId === actorUser.employeeId) {
      throw new AppError('Anti-self-approval: You cannot reconcile or approve your own travel expenses', 403, 'SELF_APPROVAL_PROHIBITED')
    }

    const numApproved = Number(approvedExpenses)
    if (Number.isNaN(numApproved) || numApproved < 0) {
      throw new AppError('Approved expense amount must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    if (
      request.reconciledAt &&
      request.settlementStatus === 'Pending Final Settlement' &&
      Number(request.approvedExpenses || 0) === numApproved
    ) {
      throw new AppError(
        `Duplicate reconciliation blocked: Travel expense '${this._expenseCode(request)}' has already been reconciled at Rs. ${numApproved.toLocaleString()}.`,
        409,
        'DUPLICATE_RECONCILIATION'
      )
    }

    const disbursed = Number(request.disbursedAdvance || 0)
    const balance = numApproved - disbursed
    const settlementStatus = balance === 0 ? 'Settled' : 'Pending Final Settlement'
    const actorName = this._actorName(actorUser)
    const history = Array.isArray(request.approvalHistory) ? [...request.approvalHistory] : []
    history.push({
      action: 'Expense Reconciled',
      by: actorName,
      remarks: `Approved Rs. ${numApproved}, Balance Rs. ${balance} (${settlementStatus})`,
      at: new Date().toISOString()
    })

    return prisma.$transaction(async (tx) => {
      const lockRes = await tx.travelRequest.updateMany({
        where: {
          id: request.id,
          status: 'APPROVED',
          NOT: { settlementStatus: 'Settled' }
        },
        data: {
          expenseCode: this._expenseCode(request),
          approvedExpenses: new Prisma.Decimal(numApproved),
          settlementBalance: new Prisma.Decimal(balance),
          settlementStatus,
          reconciledAt: new Date(),
          reconciledBy: actorName,
          reconciliationNotes: notes?.trim() || request.reconciliationNotes,
          approvalHistory: history
        }
      })

      if (lockRes.count === 0) {
        throw new AppError(
          `Financial lock: Travel expense '${this._expenseCode(request)}' is already Settled. Duplicate reconciliation is prohibited.`,
          409,
          'EXPENSE_ALREADY_SETTLED'
        )
      }

      const updated = await tx.travelRequest.findUnique({
        where: { id: request.id },
        include: { employee: { include: { department: { select: { id: true, name: true } } } } }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'RECONCILE_EXPENSE',
        entityName: 'TravelAdvance',
        entityId: request.requestCode,
        before: { settlementStatus: request.settlementStatus, approvedExpenses: Number(request.approvedExpenses || 0) },
        after: {
          approvedExpenses: numApproved,
          settlementBalance: balance,
          settlementStatus
        },
        notes: notes?.trim() || `Reconciled at Rs. ${numApproved} (${settlementStatus})`,
        employeeId: request.employeeId
      })

      return updated
    })
  }

  async updateTransportAssignment(idOrCode, data = {}, actorUser) {
    const assignment = await prisma.transportAssignment.findFirst({
      where: { OR: [{ id: idOrCode }, { assignmentCode: idOrCode }] },
      include: { route: true }
    })
    if (!assignment) throw new AppError(`Transport assignment '${idOrCode}' not found`, 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = Boolean(actorUser?.employeeId && assignment.employeeId === actorUser.employeeId)

    if (!isAdmin && !isOwner) {
      throw new AppError('Unauthorized to edit this transport assignment', 403, 'FORBIDDEN')
    }
    if (!isAdmin && assignment.status !== 'Pending Approval') {
      throw new AppError('Only HR Admin or Super Admin can edit active or suspended transport assignments', 403, 'FORBIDDEN')
    }
    if (['Cancelled', 'Rejected'].includes(assignment.status)) {
      throw new AppError(`Cannot edit transport assignment in status '${assignment.status}'`, 400, 'INVALID_STATUS')
    }

    let targetRoute = assignment.route
    if (data.routeId && data.routeId !== assignment.routeId && data.routeId !== assignment.route?.routeCode) {
      targetRoute = await prisma.transportRoute.findFirst({
        where: { OR: [{ id: data.routeId }, { routeCode: data.routeId }] }
      })
      if (!targetRoute) throw new AppError(`Route '${data.routeId}' not found`, 404, 'NOT_FOUND')
      if (targetRoute.status !== 'Active') {
        throw new AppError(`Route '${targetRoute.routeName}' is currently ${targetRoute.status} and cannot accept assignments`, 400, 'ROUTE_INACTIVE')
      }
      if (assignment.status === 'Active') {
        const activeCount = await prisma.transportAssignment.count({
          where: { routeId: targetRoute.id, status: 'Active' }
        })
        if (activeCount >= targetRoute.capacity) {
          throw new AppError(`Route '${targetRoute.routeName}' is at full capacity (${targetRoute.capacity})`, 400, 'CAPACITY_EXCEEDED')
        }
      }
    }

    const pickupPoint = 'pickupPoint' in data ? String(data.pickupPoint || '').trim() : assignment.pickupPoint
    if (!pickupPoint) throw new AppError('Pickup point is required', 400, 'VALIDATION_FAILED')

    const nextContribution =
      data.monthlyContribution !== undefined && data.monthlyContribution !== null && String(data.monthlyContribution).trim() !== ''
        ? Number(data.monthlyContribution)
        : Number(assignment.monthlyContribution)
    if (!Number.isFinite(nextContribution) || nextContribution < 0) {
      throw new AppError('Monthly contribution must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.transportAssignment.update({
        where: { id: assignment.id },
        data: {
          routeId: targetRoute.id,
          pickupPoint,
          dropPoint: 'dropPoint' in data ? (String(data.dropPoint || '').trim() || assignment.dropPoint) : assignment.dropPoint,
          pickupTime: 'pickupTime' in data && data.pickupTime ? String(data.pickupTime).trim() : assignment.pickupTime,
          dropTime: 'dropTime' in data && data.dropTime ? String(data.dropTime).trim() : targetRoute.eveningDepartureTime || assignment.dropTime,
          facilityType: 'facilityType' in data && data.facilityType ? String(data.facilityType).trim() : assignment.facilityType,
          monthlyContribution: new Prisma.Decimal(nextContribution),
          effectiveFrom: 'effectiveFrom' in data && data.effectiveFrom ? new Date(data.effectiveFrom) : assignment.effectiveFrom,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TransportAssignment',
        entityId: assignment.assignmentCode,
        before: {
          routeId: assignment.routeId,
          pickupPoint: assignment.pickupPoint,
          pickupTime: assignment.pickupTime,
          facilityType: assignment.facilityType,
          monthlyContribution: Number(assignment.monthlyContribution)
        },
        after: {
          routeId: updated.routeId,
          pickupPoint: updated.pickupPoint,
          pickupTime: updated.pickupTime,
          facilityType: updated.facilityType,
          monthlyContribution: Number(updated.monthlyContribution)
        },
        notes: `Transport assignment ${assignment.assignmentCode} updated by ${actorName}`,
        employeeId: assignment.employeeId
      })

      return updated
    })
  }

  // ============================================================================
  // 4. FLEET VEHICLES, DRIVERS & TRANSPORT ROUTES (SUBMODULE 5)
  // ============================================================================

  async getVehicles() {
    return prisma.transportVehicle.findMany({ orderBy: { createdAt: 'asc' } })
  }

  async saveVehicle(data, actorUser) {
    if (!data.registrationNumber || !String(data.registrationNumber).trim()) {
      throw new AppError('Vehicle registration number is required', 400, 'VALIDATION_FAILED')
    }
    if (!data.vehicleName || !String(data.vehicleName).trim()) {
      throw new AppError('Vehicle name is required', 400, 'VALIDATION_FAILED')
    }
    const capacity = Number(data.capacity)
    if (!capacity || Number.isNaN(capacity) || capacity <= 0) {
      throw new AppError('Vehicle passenger capacity must be greater than zero', 400, 'VALIDATION_FAILED')
    }

    const reg = String(data.registrationNumber).trim()
    const actorName = this._actorName(actorUser)
    const targetId = data.id || data.vehicleId

    if (targetId) {
      const existing = await prisma.transportVehicle.findFirst({
        where: { OR: [{ id: targetId }, { vehicleCode: targetId }] }
      })
      if (!existing) throw new AppError(`Vehicle '${targetId}' not found`, 404, 'NOT_FOUND')

      const dupReg = await prisma.transportVehicle.findFirst({
        where: { registrationNumber: reg, id: { not: existing.id } }
      })
      if (dupReg) throw new AppError(`Registration '${reg}' already exists`, 409, 'DUPLICATE_VEHICLE')

      return prisma.$transaction(async (tx) => {
        const updated = await tx.transportVehicle.update({
          where: { id: existing.id },
          data: {
            vehicleName: String(data.vehicleName).trim(),
            registrationNumber: reg,
            vehicleType: data.vehicleType || existing.vehicleType,
            ownershipType: data.ownershipType || existing.ownershipType,
            capacity,
            status: data.status || existing.status,
            updatedBy: actorName
          }
        })
        await this._logAudit(tx, {
          user: actorUser,
          actionType: 'UPDATE',
          entityName: 'TransportVehicle',
          entityId: updated.vehicleCode,
          after: { vehicleName: updated.vehicleName, registrationNumber: updated.registrationNumber, capacity: updated.capacity },
          notes: `Vehicle ${updated.vehicleCode} updated`
        })
        return updated
      })
    }

    const dupReg = await prisma.transportVehicle.findUnique({ where: { registrationNumber: reg } })
    if (dupReg) throw new AppError(`Vehicle with registration '${reg}' already exists`, 409, 'DUPLICATE_VEHICLE')

    const vehicleCode = await this._generateRequestCode('VEH', 'transportVehicle', 'vehicleCode')
    return prisma.$transaction(async (tx) => {
      const created = await tx.transportVehicle.create({
        data: {
          vehicleCode,
          vehicleName: String(data.vehicleName).trim(),
          registrationNumber: reg,
          vehicleType: data.vehicleType || 'Van / HiAce',
          ownershipType: data.ownershipType || 'Company Owned',
          capacity,
          status: data.status || 'Active',
          updatedBy: actorName
        }
      })
      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'CREATE',
        entityName: 'TransportVehicle',
        entityId: created.vehicleCode,
        after: { vehicleCode: created.vehicleCode, vehicleName: created.vehicleName, registrationNumber: created.registrationNumber },
        notes: `Vehicle ${created.vehicleCode} added to fleet`
      })
      return created
    })
  }

  async getDrivers() {
    return prisma.transportDriver.findMany({
      include: { assignedVehicle: { select: { id: true, vehicleCode: true, vehicleName: true, registrationNumber: true } } },
      orderBy: { createdAt: 'asc' }
    })
  }

  async saveDriver(data, actorUser) {
    if (!data.driverName || !String(data.driverName).trim()) {
      throw new AppError('Driver name is required', 400, 'VALIDATION_FAILED')
    }
    if (!data.contactNumber || !String(data.contactNumber).trim()) {
      throw new AppError('Driver contact number is required', 400, 'VALIDATION_FAILED')
    }

    let resolvedVehicleId = null
    if (data.assignedVehicleId) {
      const veh = await prisma.transportVehicle.findFirst({
        where: { OR: [{ id: data.assignedVehicleId }, { vehicleCode: data.assignedVehicleId }] }
      })
      if (!veh) throw new AppError(`Assigned vehicle '${data.assignedVehicleId}' not found`, 404, 'NOT_FOUND')
      resolvedVehicleId = veh.id
    }

    const actorName = this._actorName(actorUser)
    const targetId = data.id || data.driverId

    if (targetId) {
      const existing = await prisma.transportDriver.findFirst({
        where: { OR: [{ id: targetId }, { driverCode: targetId }] }
      })
      if (!existing) throw new AppError(`Driver '${targetId}' not found`, 404, 'NOT_FOUND')

      return prisma.$transaction(async (tx) => {
        const updated = await tx.transportDriver.update({
          where: { id: existing.id },
          data: {
            driverName: String(data.driverName).trim(),
            contactNumber: String(data.contactNumber).trim(),
            licenseNumber: data.licenseNumber?.trim() || existing.licenseNumber,
            assignedVehicleId: data.assignedVehicleId === '' ? null : (resolvedVehicleId || existing.assignedVehicleId),
            status: data.status || existing.status,
            updatedBy: actorName
          },
          include: { assignedVehicle: { select: { id: true, vehicleCode: true, vehicleName: true } } }
        })
        await this._logAudit(tx, {
          user: actorUser,
          actionType: 'UPDATE',
          entityName: 'TransportDriver',
          entityId: updated.driverCode,
          after: { driverName: updated.driverName, contactNumber: updated.contactNumber },
          notes: `Driver ${updated.driverCode} updated`
        })
        return updated
      })
    }

    const driverCode = await this._generateRequestCode('DRV', 'transportDriver', 'driverCode')
    return prisma.$transaction(async (tx) => {
      const created = await tx.transportDriver.create({
        data: {
          driverCode,
          driverName: String(data.driverName).trim(),
          contactNumber: String(data.contactNumber).trim(),
          licenseNumber: data.licenseNumber?.trim() || null,
          assignedVehicleId: resolvedVehicleId,
          status: data.status || 'Active',
          updatedBy: actorName
        },
        include: { assignedVehicle: { select: { id: true, vehicleCode: true, vehicleName: true } } }
      })
      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'CREATE',
        entityName: 'TransportDriver',
        entityId: created.driverCode,
        after: { driverCode: created.driverCode, driverName: created.driverName },
        notes: `Driver ${created.driverCode} (${created.driverName}) registered`
      })
      return created
    })
  }

  async getRoutes() {
    const routes = await prisma.transportRoute.findMany({
      include: {
        assignedVehicle: true,
        assignedDriver: true,
        _count: {
          select: {
            assignments: { where: { status: 'Active' } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return routes.map((r) => ({
      ...r,
      assignedCount: r._count?.assignments || 0
    }))
  }

  async saveRoute(data, actorUser) {
    if (!data.routeName || !String(data.routeName).trim()) {
      throw new AppError('Route name is required', 400, 'VALIDATION_FAILED')
    }

    const targetId = data.id || data.routeId
    let existing = null
    if (targetId) {
      existing = await prisma.transportRoute.findFirst({
        where: { OR: [{ id: targetId }, { routeCode: targetId }] }
      })
      if (!existing) throw new AppError(`Transport route '${targetId}' not found`, 404, 'NOT_FOUND')
    }

    let vehicle = null
    if (data.assignedVehicleId) {
      vehicle = await prisma.transportVehicle.findFirst({
        where: { OR: [{ id: data.assignedVehicleId }, { vehicleCode: data.assignedVehicleId }] }
      })
      if (!vehicle) throw new AppError(`Vehicle '${data.assignedVehicleId}' not found`, 404, 'NOT_FOUND')
    }

    let driver = null
    if (data.assignedDriverId) {
      driver = await prisma.transportDriver.findFirst({
        where: { OR: [{ id: data.assignedDriverId }, { driverCode: data.assignedDriverId }] }
      })
      if (!driver) throw new AppError(`Driver '${data.assignedDriverId}' not found`, 404, 'NOT_FOUND')
    }

    const capacity = Number(data.capacity) || vehicle?.capacity || 14
    if (capacity <= 0) {
      throw new AppError('Route capacity must be greater than zero', 400, 'VALIDATION_FAILED')
    }
    if (vehicle && capacity > vehicle.capacity) {
      throw new AppError(`Route capacity (${capacity}) exceeds assigned vehicle capacity (${vehicle.capacity})`, 400, 'CAPACITY_EXCEEDED')
    }
    if (existing) {
      const activePassengers = await prisma.transportAssignment.count({
        where: { routeId: existing.id, status: 'Active' }
      })
      if (capacity < activePassengers) {
        throw new AppError(
          `Cannot reduce capacity of '${existing.routeName}' to ${capacity}; ${activePassengers} active passengers are currently assigned`,
          400,
          'CAPACITY_BELOW_ACTIVE_ASSIGNMENTS'
        )
      }
    }

    const morningDepartureTime = data.morningDepartureTime || existing?.morningDepartureTime || '07:30 AM'
    const eveningDepartureTime = data.eveningDepartureTime || existing?.eveningDepartureTime || '06:15 PM'
    const routeStatus = data.status || existing?.status || 'Active'

    if (routeStatus === 'Active' && vehicle) {
      const conflictVeh = await prisma.transportRoute.findFirst({
        where: {
          assignedVehicleId: vehicle.id,
          status: 'Active',
          morningDepartureTime,
          ...(existing ? { id: { not: existing.id } } : {})
        }
      })
      if (conflictVeh) {
        throw new AppError(`Schedule conflict: Vehicle '${vehicle.vehicleCode}' is already assigned to active route '${conflictVeh.routeName}' at ${morningDepartureTime}`, 409, 'VEHICLE_SCHEDULE_CONFLICT')
      }
    }

    if (routeStatus === 'Active' && driver) {
      const conflictDrv = await prisma.transportRoute.findFirst({
        where: {
          assignedDriverId: driver.id,
          status: 'Active',
          morningDepartureTime,
          ...(existing ? { id: { not: existing.id } } : {})
        }
      })
      if (conflictDrv) {
        throw new AppError(`Schedule conflict: Driver '${driver.driverCode}' is already scheduled on route '${conflictDrv.routeName}' at ${morningDepartureTime}`, 409, 'DRIVER_SCHEDULE_CONFLICT')
      }
    }

    const pickupPoints = Array.isArray(data.pickupPoints)
      ? data.pickupPoints.map((p) => String(p).trim()).filter(Boolean)
      : String(data.pickupPoints || '').split(',').map((p) => p.trim()).filter(Boolean)
    if (pickupPoints.length === 0) {
      throw new AppError('At least one pickup stop is required', 400, 'VALIDATION_FAILED')
    }

    const actorName = this._actorName(actorUser)

    if (existing) {
      return prisma.$transaction(async (tx) => {
        const updated = await tx.transportRoute.update({
          where: { id: existing.id },
          data: {
            routeName: String(data.routeName).trim(),
            pickupPoints,
            dropPoint: data.dropPoint?.trim() || existing.dropPoint,
            morningDepartureTime,
            eveningDepartureTime,
            assignedVehicleId: vehicle ? vehicle.id : (data.assignedVehicleId === '' ? null : existing.assignedVehicleId),
            assignedDriverId: driver ? driver.id : (data.assignedDriverId === '' ? null : existing.assignedDriverId),
            capacity,
            status: routeStatus,
            updatedBy: actorName
          },
          include: {
            assignedVehicle: true,
            assignedDriver: true,
            _count: { select: { assignments: { where: { status: 'Active' } } } }
          }
        })
        await this._logAudit(tx, {
          user: actorUser,
          actionType: 'UPDATE',
          entityName: 'TransportRoute',
          entityId: updated.routeCode,
          before: {
            routeName: existing.routeName,
            capacity: existing.capacity,
            status: existing.status,
            morningDepartureTime: existing.morningDepartureTime,
            pickupPoints: existing.pickupPoints
          },
          after: {
            routeName: updated.routeName,
            capacity: updated.capacity,
            status: updated.status,
            morningDepartureTime: updated.morningDepartureTime,
            pickupPoints: updated.pickupPoints
          },
          notes: `Route ${updated.routeCode} (${updated.routeName}) updated by ${actorName}`
        })
        return { ...updated, assignedCount: updated._count?.assignments || 0 }
      })
    }

    const routeCode = await this._generateRequestCode('ROUTE', 'transportRoute', 'routeCode', 2)
    return prisma.$transaction(async (tx) => {
      const created = await tx.transportRoute.create({
        data: {
          routeCode,
          routeName: String(data.routeName).trim(),
          pickupPoints,
          dropPoint: data.dropPoint?.trim() || 'iSysware HQ Tech Park',
          morningDepartureTime,
          eveningDepartureTime,
          assignedVehicleId: vehicle?.id || null,
          assignedDriverId: driver?.id || null,
          capacity,
          status: routeStatus,
          updatedBy: actorName
        },
        include: { assignedVehicle: true, assignedDriver: true }
      })
      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'CREATE',
        entityName: 'TransportRoute',
        entityId: created.routeCode,
        after: { routeCode: created.routeCode, routeName: created.routeName, capacity: created.capacity },
        notes: `Transport route ${created.routeCode} (${created.routeName}) created`
      })
      return { ...created, assignedCount: 0 }
    })
  }

  // ============================================================================
  // 5. PICK-AND-DROP MANAGEMENT (SUBMODULE 4) & LEGACY PASSES
  // ============================================================================

  async getTransportAssignments(filters = {}, user) {
    const scopeWhere = this._buildScopeWhere(user)
    const where = { ...scopeWhere }
    if (filters.status && filters.status !== 'all') where.status = filters.status
    if (filters.routeId && filters.routeId !== 'all') {
      where.route = { OR: [{ id: filters.routeId }, { routeCode: filters.routeId }] }
    }

    return prisma.transportAssignment.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } }
          }
        },
        route: {
          include: {
            assignedVehicle: true,
            assignedDriver: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async requestPickAndDrop(data, actorUser) {
    const targetEmpIdent = data.employeeId || actorUser?.employeeId
    if (!targetEmpIdent) throw new AppError('Employee ID is required', 400, 'VALIDATION_FAILED')
    if (!data.routeId) throw new AppError('Target transport route must be selected', 400, 'VALIDATION_FAILED')
    if (!data.pickupPoint || !String(data.pickupPoint).trim()) {
      throw new AppError('Pickup point is required', 400, 'VALIDATION_FAILED')
    }

    const emp = await this._resolveEmployee(targetEmpIdent)
    if (!emp) throw new AppError(`Employee '${targetEmpIdent}' not found`, 404, 'EMPLOYEE_NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    if ((role === 'EMPLOYEE' || role === 'TEAM_LEAD') && actorUser?.employeeId && emp.id !== actorUser.employeeId) {
      throw new AppError('Employees can only apply for their own pick-and-drop transport pass', 403, 'FORBIDDEN')
    }

    if (['RESIGNED', 'TERMINATED', 'RETIRED', 'INACTIVE'].includes(String(emp.employmentStatus || '').toUpperCase())) {
      throw new AppError(`Cannot assign transport facility to inactive or separated employee '${emp.firstName} ${emp.lastName}'`, 400, 'INACTIVE_EMPLOYEE')
    }

    const existingActive = await prisma.transportAssignment.findFirst({
      where: { employeeId: emp.id, status: { in: ['Active', 'Pending Approval'] } },
      include: { route: true }
    })
    if (existingActive) {
      throw new AppError(
        `Employee already has an ${existingActive.status.toLowerCase()} transport assignment (${existingActive.assignmentCode}) on '${existingActive.route?.routeName}'.`,
        409,
        'ACTIVE_ASSIGNMENT_EXISTS'
      )
    }

    const route = await prisma.transportRoute.findFirst({
      where: { OR: [{ id: data.routeId }, { routeCode: data.routeId }] }
    })
    if (!route) throw new AppError(`Transport route '${data.routeId}' not found`, 404, 'NOT_FOUND')
    if (route.status !== 'Active') throw new AppError('Selected route is not active', 400, 'INACTIVE_ROUTE')

    const activeCount = await prisma.transportAssignment.count({
      where: { routeId: route.id, status: 'Active' }
    })
    if (activeCount >= route.capacity) {
      throw new AppError(`Route capacity exceeded: '${route.routeName}' has reached its maximum capacity of ${route.capacity} passengers`, 400, 'CAPACITY_EXCEEDED')
    }

    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const assignmentCode = await this._generateRequestCode('TRANS-ASN', 'transportAssignment', 'assignmentCode')
    const actorName = this._actorName(actorUser)
    const status = isAdmin ? 'Active' : 'Pending Approval'

    return prisma.$transaction(async (tx) => {
      const created = await tx.transportAssignment.create({
        data: {
          assignmentCode,
          employeeId: emp.id,
          routeId: route.id,
          pickupPoint: String(data.pickupPoint).trim(),
          dropPoint: data.dropPoint?.trim() || route.dropPoint || 'iSysware HQ Tech Park',
          pickupTime: data.pickupTime || route.morningDepartureTime || '07:45 AM',
          dropTime: route.eveningDepartureTime || '06:15 PM',
          applicableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          facilityType: data.facilityType || 'Company Subsidized',
          monthlyContribution: data.monthlyContribution !== undefined ? new Prisma.Decimal(data.monthlyContribution) : new Prisma.Decimal(3000),
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
          status,
          approvedBy: isAdmin ? actorName : null,
          approvedDate: isAdmin ? new Date() : null,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'CREATE',
        entityName: 'TransportAssignment',
        entityId: created.assignmentCode,
        after: {
          assignmentCode: created.assignmentCode,
          routeCode: route.routeCode,
          pickupPoint: created.pickupPoint,
          status: created.status
        },
        notes: `Pick-and-drop ${created.assignmentCode} (${created.status}) on ${route.routeName}`,
        employeeId: emp.id
      })

      return created
    })
  }

  async updateTransportAssignmentStatus(idOrCode, status, actorUser) {
    const assignment = await prisma.transportAssignment.findFirst({
      where: { OR: [{ id: idOrCode }, { assignmentCode: idOrCode }] },
      include: { route: true }
    })
    if (!assignment) throw new AppError(`Transport assignment '${idOrCode}' not found`, 404, 'NOT_FOUND')

    const validStatuses = ['Active', 'Suspended', 'Cancelled', 'Rejected']
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid transport assignment status '${status}'`, 400, 'VALIDATION_FAILED')
    }

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = actorUser?.employeeId && assignment.employeeId === actorUser.employeeId

    if (!isAdmin && !(isOwner && status === 'Cancelled')) {
      throw new AppError('Only HR Admin or Super Admin can approve or suspend transport assignments', 403, 'FORBIDDEN')
    }

    if (status === 'Active' && assignment.status !== 'Active') {
      const activeCount = await prisma.transportAssignment.count({
        where: { routeId: assignment.routeId, status: 'Active' }
      })
      if (activeCount >= assignment.route.capacity) {
        throw new AppError(`Route '${assignment.route.routeName}' is at full capacity (${assignment.route.capacity})`, 400, 'CAPACITY_EXCEEDED')
      }
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.transportAssignment.update({
        where: { id: assignment.id },
        data: {
          status,
          approvedBy: status === 'Active' ? actorName : assignment.approvedBy,
          approvedDate: status === 'Active' ? new Date() : assignment.approvedDate,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TransportAssignment',
        entityId: assignment.assignmentCode,
        before: { status: assignment.status },
        after: { status: updated.status },
        notes: `Transport assignment ${assignment.assignmentCode} updated to '${status}'`,
        employeeId: assignment.employeeId
      })

      return updated
    })
  }

  async updateTransportAssignment(idOrCode, data = {}, actorUser) {
    const assignment = await prisma.transportAssignment.findFirst({
      where: { OR: [{ id: idOrCode }, { assignmentCode: idOrCode }] },
      include: { route: true }
    })
    if (!assignment) throw new AppError(`Transport assignment '${idOrCode}' not found`, 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = Boolean(actorUser?.employeeId && assignment.employeeId === actorUser.employeeId)

    if (!isAdmin && !isOwner) {
      throw new AppError('Unauthorized to edit this transport assignment', 403, 'FORBIDDEN')
    }
    if (!isAdmin && assignment.status !== 'Pending Approval') {
      throw new AppError('Only HR Admin or Super Admin can edit active or suspended transport assignments', 403, 'FORBIDDEN')
    }
    if (['Cancelled', 'Rejected'].includes(assignment.status)) {
      throw new AppError(`Cannot edit transport assignment in status '${assignment.status}'`, 400, 'INVALID_STATUS')
    }

    let targetRoute = assignment.route
    if (data.routeId && data.routeId !== assignment.routeId && data.routeId !== assignment.route?.routeCode) {
      targetRoute = await prisma.transportRoute.findFirst({
        where: { OR: [{ id: data.routeId }, { routeCode: data.routeId }] }
      })
      if (!targetRoute) throw new AppError(`Route '${data.routeId}' not found`, 404, 'NOT_FOUND')
      if (targetRoute.status !== 'Active') {
        throw new AppError(`Route '${targetRoute.routeName}' is currently ${targetRoute.status} and cannot accept assignments`, 400, 'ROUTE_INACTIVE')
      }
      if (assignment.status === 'Active') {
        const activeCount = await prisma.transportAssignment.count({
          where: { routeId: targetRoute.id, status: 'Active' }
        })
        if (activeCount >= targetRoute.capacity) {
          throw new AppError(`Route '${targetRoute.routeName}' is at full capacity (${targetRoute.capacity})`, 400, 'CAPACITY_EXCEEDED')
        }
      }
    }

    const pickupPoint = 'pickupPoint' in data ? String(data.pickupPoint || '').trim() : assignment.pickupPoint
    if (!pickupPoint) throw new AppError('Pickup point is required', 400, 'VALIDATION_FAILED')

    const nextContribution =
      data.monthlyContribution !== undefined && data.monthlyContribution !== null && String(data.monthlyContribution).trim() !== ''
        ? Number(data.monthlyContribution)
        : Number(assignment.monthlyContribution)
    if (!Number.isFinite(nextContribution) || nextContribution < 0) {
      throw new AppError('Monthly contribution must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.transportAssignment.update({
        where: { id: assignment.id },
        data: {
          routeId: targetRoute.id,
          pickupPoint,
          dropPoint: 'dropPoint' in data ? (String(data.dropPoint || '').trim() || assignment.dropPoint) : assignment.dropPoint,
          pickupTime: 'pickupTime' in data && data.pickupTime ? String(data.pickupTime).trim() : assignment.pickupTime,
          dropTime: 'dropTime' in data && data.dropTime ? String(data.dropTime).trim() : targetRoute.eveningDepartureTime || assignment.dropTime,
          facilityType: 'facilityType' in data && data.facilityType ? String(data.facilityType).trim() : assignment.facilityType,
          monthlyContribution: new Prisma.Decimal(nextContribution),
          effectiveFrom: 'effectiveFrom' in data && data.effectiveFrom ? new Date(data.effectiveFrom) : assignment.effectiveFrom,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TransportAssignment',
        entityId: assignment.assignmentCode,
        before: {
          routeId: assignment.routeId,
          pickupPoint: assignment.pickupPoint,
          pickupTime: assignment.pickupTime,
          facilityType: assignment.facilityType,
          monthlyContribution: Number(assignment.monthlyContribution)
        },
        after: {
          routeId: updated.routeId,
          pickupPoint: updated.pickupPoint,
          pickupTime: updated.pickupTime,
          facilityType: updated.facilityType,
          monthlyContribution: Number(updated.monthlyContribution)
        },
        notes: `Transport assignment ${assignment.assignmentCode} updated by ${actorName}`,
        employeeId: assignment.employeeId
      })

      return updated
    })
  }

  async getTransportPasses(filters = {}, user) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.employeeId) where.employeeId = filters.employeeId

    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      where.employeeId = user.employeeId
    }

    return prisma.transportPass.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async createTransportPass(data, actorUserId) {
    if (!data.employeeId || !data.routeName || !data.pickupPoint || !data.dropoffPoint || !data.shiftTiming) {
      throw new AppError('Employee, Route, Pickup, Dropoff, and Shift Timing are required', 400, 'VALIDATION_FAILED')
    }

    const existing = await prisma.transportPass.findFirst({
      where: { employeeId: data.employeeId, status: 'ACTIVE' }
    })
    if (existing) {
      throw new AppError('Employee already holds an active transport pass', 409, 'ACTIVE_PASS_EXISTS')
    }

    const passNumber = data.passNumber || await this._generateRequestCode('PASS', 'transportPass', 'passNumber')

    return prisma.transportPass.create({
      data: {
        passNumber,
        employeeId: data.employeeId,
        routeName: data.routeName,
        pickupPoint: data.pickupPoint,
        dropoffPoint: data.dropoffPoint,
        shiftTiming: data.shiftTiming,
        vehicleNumber: data.vehicleNumber || null,
        seatNumber: data.seatNumber || null,
        monthlyContribution: data.monthlyContribution ? new Prisma.Decimal(data.monthlyContribution) : new Prisma.Decimal(0),
        status: 'ACTIVE',
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveUntil: data.effectiveUntil ? new Date(data.effectiveUntil) : null
      },
      include: { employee: true }
    })
  }

  // ============================================================================
  // 6. TRAVEL & TRANSPORT HISTORY / AUDIT TRAIL (SUBMODULE 6)
  // ============================================================================

  async getTravelAuditLogs(user) {
    const role = String(user?.role || '').toUpperCase()
    const logs = await prisma.auditLog.findMany({
      where: { sourceModule: 'TRAVEL' },
      include: {
        actorUser: {
          select: {
            username: true,
            role: true,
            employee: { select: { firstName: true, lastName: true, employeeCode: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 250
    })

    if (role === 'SUPER_ADMIN' || role === 'HR_ADMIN') {
      return logs
    }
    if (user?.employeeId) {
      return logs.filter(
        (log) => log.actorUserId === user.id || log.recordSnapshotAfter?.targetEmployeeId === user.employeeId
      )
    }
    return []
  }

  // ============================================================================
  // 7. ITEMIZED EXPENSE CLAIMS & CATEGORIES (PRESERVED FOR BATCH 6C / 7A)
  // ============================================================================

  _parseItemMeta(notes) {
    if (!notes || typeof notes !== 'string') return {}
    if (!notes.startsWith('{')) return { description: notes }
    try {
      const parsed = JSON.parse(notes)
      return parsed && typeof parsed === 'object' ? parsed : { description: notes }
    } catch {
      return { description: notes }
    }
  }

  _buildCategoryLookup(categories = []) {
    const map = new Map()
    for (const c of categories) {
      if (c.code) map.set(String(c.code).toUpperCase(), c)
      if (c.categoryId) map.set(String(c.categoryId).toUpperCase(), c)
      if (c.name) map.set(String(c.name).trim().toLowerCase(), c)
      if (c.categoryName) map.set(String(c.categoryName).trim().toLowerCase(), c)
    }
    return map
  }

  _findCategoryConfig(lookupMap, value) {
    if (!value) return null
    const raw = String(value).trim()
    return lookupMap.get(raw.toUpperCase()) || lookupMap.get(raw.toLowerCase()) || null
  }

  async _resolveExpenseClaim(idOrNumber) {
    if (!idOrNumber) return null
    return prisma.expenseClaim.findFirst({
      where: { OR: [{ id: idOrNumber }, { claimNumber: idOrNumber }] },
      include: {
        employee: {
          include: { department: { select: { id: true, name: true } } }
        },
        items: true,
        travelRequest: {
          select: { id: true, requestCode: true, destination: true, advanceAmount: true }
        }
      }
    })
  }

  async _decorateExpenseClaims(rows = [], categories = null) {
    if (!Array.isArray(rows) || rows.length === 0) return []
    const catList = categories || await this.getExpenseCategories()
    const catLookup = this._buildCategoryLookup(catList)
    const claimIds = rows.map((r) => r.id)

    const auditRows = await prisma.auditLog.findMany({
      where: {
        sourceModule: 'EXPENSES',
        entityName: 'ExpenseClaim',
        entityId: { in: claimIds }
      },
      orderBy: { createdAt: 'asc' }
    })

    const auditByClaim = new Map()
    for (const log of auditRows) {
      if (!auditByClaim.has(log.entityId)) auditByClaim.set(log.entityId, [])
      auditByClaim.get(log.entityId).push(log)
    }

    return rows.map((row) => {
      const items = Array.isArray(row.items) ? row.items : []
      const firstItem = items[0] || {}
      const meta = this._parseItemMeta(firstItem.notes)
      const matchedCat =
        this._findCategoryConfig(catLookup, meta.categoryCode) ||
        this._findCategoryConfig(catLookup, meta.categoryName) ||
        this._findCategoryConfig(catLookup, firstItem.category)

      const claimAudits = auditByClaim.get(row.id) || []
      const reversedIds = new Set()
      for (const a of claimAudits) {
        if (a.actionType === 'REIMBURSEMENT_REVERSED' && a.recordSnapshotAfter?.reimbursementId) {
          reversedIds.add(a.recordSnapshotAfter.reimbursementId)
        }
      }

      const reimbursements = []
      let reviewMeta = null
      const auditHistory = []

      for (const a of claimAudits) {
        const after = a.recordSnapshotAfter || {}
        auditHistory.push({
          action: a.actionType,
          actor: after.actorName || a.actorRole || 'System',
          timestamp: a.createdAt.toISOString(),
          remarks: a.reasonOrNotes || after.remarks || ''
        })

        if (a.actionType === 'DISBURSE_REIMBURSEMENT') {
          const reimbId = after.reimbursementId || a.id
          const isReversed = reversedIds.has(reimbId)
          const revLog = isReversed
            ? claimAudits.find(
                (x) => x.actionType === 'REIMBURSEMENT_REVERSED' && x.recordSnapshotAfter?.reimbursementId === reimbId
              )
            : null
          const amountVal = Number(after.amount ?? after.netPayableAmount ?? row.netPayableAmount ?? 0)
          reimbursements.push({
            reimbursementId: reimbId,
            paymentDate: String(after.disbursedAt || a.createdAt.toISOString()).slice(0, 10),
            amount: amountVal,
            paymentMethod: after.paymentMethod || row.paymentMethod || 'BANK_TRANSFER',
            bankAccountReference: after.paymentAccount || meta.requestedReimbursementAccount || 'Corporate Bank Advice',
            transactionReference: after.transactionReference || row.transactionReference || '',
            paidBy: after.actorName || a.actorRole || 'Finance Officer',
            notes: a.reasonOrNotes || after.notes || 'Reimbursement payment processed.',
            isReversed,
            reversedAt: revLog ? revLog.createdAt.toISOString() : null,
            reversedBy: revLog?.recordSnapshotAfter?.actorName || null,
            reversalReason: revLog?.reasonOrNotes || null
          })
        } else if (['CLAIM_APPROVED', 'CLAIM_REJECTED', 'CLAIM_RETURNED'].includes(a.actionType)) {
          reviewMeta = {
            actionType: a.actionType,
            decision: after.decision,
            approverName: after.actorName || a.actorRole,
            remarks: after.remarks || a.reasonOrNotes || '',
            reviewedAt: a.createdAt.toISOString()
          }
        }
      }

      if (reimbursements.length === 0 && row.status === 'DISBURSED' && row.disbursedAt) {
        reimbursements.push({
          reimbursementId: `REIMB-${row.id}`,
          paymentDate: row.disbursedAt.toISOString().slice(0, 10),
          amount: Number(row.netPayableAmount),
          paymentMethod: row.paymentMethod || 'BANK_TRANSFER',
          bankAccountReference: meta.requestedReimbursementAccount || 'Corporate Primary Disbursement A/C',
          transactionReference: row.transactionReference || '',
          paidBy: 'Finance Administration',
          notes: 'Disbursed',
          isReversed: false
        })
      }

      const paidAmount = reimbursements
        .filter((r) => !r.isReversed)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0)
      const totalAmt = Number(row.totalAmount || 0)
      const netPayable = Number(row.netPayableAmount ?? totalAmt)
      const remainingPayable = row.status === 'REJECTED' || row.status === 'DRAFT'
        ? 0
        : Math.max(netPayable - paidAmount, 0)

      let approvalStatus = 'Submitted'
      if (row.status === 'MANAGER_APPROVED' || row.status === 'HR_APPROVED' || row.status === 'DISBURSED') {
        approvalStatus = 'Approved'
      } else if (row.status === 'REJECTED') {
        approvalStatus = 'Rejected'
      } else if (row.status === 'DRAFT') {
        approvalStatus = reviewMeta?.actionType === 'CLAIM_RETURNED' ? 'Returned' : 'Draft'
      }

      let paymentStatus = 'Unapproved'
      if (approvalStatus === 'Approved') {
        if (row.status === 'DISBURSED' || (remainingPayable === 0 && paidAmount > 0)) {
          paymentStatus = 'Paid'
        } else if (paidAmount > 0 && remainingPayable > 0) {
          paymentStatus = 'Partially Paid'
        } else {
          paymentStatus = 'Payment Pending'
        }
      }

      const emp = row.employee || {}
      const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Authorized Staff'
      const expDate = firstItem.expenseDate
        ? new Date(firstItem.expenseDate).toISOString().slice(0, 10)
        : row.submissionDate.toISOString().slice(0, 10)

      return {
        ...row,
        claimId: row.claimNumber,
        employeeCuid: row.employeeId,
        employeeCode: emp.employeeCode || null,
        employeeName: empName,
        department: emp.department?.name || meta.department || 'General',
        departmentId: emp.departmentId || null,
        category: matchedCat?.name || matchedCat?.categoryName || meta.categoryName || firstItem.category || 'Other Expenses',
        categoryId: matchedCat?.code || meta.categoryCode || firstItem.category || 'OTHER',
        amount: totalAmt,
        paidAmount,
        remainingPayable,
        expenseDate: expDate,
        submissionDate: row.submissionDate.toISOString().slice(0, 10),
        description: meta.description || row.claimTitle,
        receiptReference: meta.receiptReference || firstItem.receiptUrl || null,
        receiptFileName: meta.receiptFileName || null,
        projectClient: meta.projectClient || firstItem.merchantName || null,
        relatedTravelRequestId: row.travelRequest?.requestCode || meta.relatedTravelRequestId || null,
        paymentMethodUsed: meta.paymentMethodUsed || 'Cash',
        requestedReimbursementAccount: meta.requestedReimbursementAccount || 'Bank Transfer Advice (On File)',
        approvalStatus,
        paymentStatus,
        finalApproverName: reviewMeta?.approverName || null,
        finalApprovalRemarks: reviewMeta?.remarks || null,
        finalApprovedAt: reviewMeta?.reviewedAt || null,
        reimbursements,
        auditHistory
      }
    })
  }

  async getExpensePolicies() {
    const settings = await prisma.organizationSetting.findFirst()
    const thresholds = settings?.settingsJson?.policies?.expenseApprovalThresholds || {}
    const managerLimit = thresholds.managerLimit !== undefined ? Number(thresholds.managerLimit) : 0
    const hrAdminLimit = thresholds.hrAdminLimit !== undefined ? Number(thresholds.hrAdminLimit) : 0
    const superAdminThreshold =
      thresholds.superAdminRequiredAbove !== undefined
        ? Number(thresholds.superAdminRequiredAbove)
        : (thresholds.superAdminThreshold !== undefined ? Number(thresholds.superAdminThreshold) : 0)
    return {
      managerLimit,
      managerMaxLimit: managerLimit,
      hrAdminLimit,
      hrAdminMaxLimit: hrAdminLimit,
      superAdminRequiredAbove: superAdminThreshold,
      superAdminThreshold
    }
  }

  async getExpenseAuditLogs(user, query = {}) {
    const role = String(user?.role || '').toUpperCase()
    const where = { sourceModule: 'EXPENSES' }

    if (role === 'EMPLOYEE' || role === 'TEAM_LEAD') {
      where.actorUserId = user?.id
    }

    if (query.action && query.action !== 'ALL') {
      where.actionType = query.action
    }

    if (query.claimId) {
      where.entityId = query.claimId
    }

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500
    })

    let mapped = rows.map((r) => {
      const after = r.recordSnapshotAfter && typeof r.recordSnapshotAfter === 'object' ? r.recordSnapshotAfter : {}
      const claimNo = after.claimNumber || (r.entityName === 'ExpenseClaim' ? r.entityId : null)
      const amountVal = after.amount ?? after.netPayableAmount ?? null
      const txnRef = after.transactionReference || null

      let summary = r.reasonOrNotes || after.summary
      if (!summary) {
        if (r.actionType === 'DISBURSE_REIMBURSEMENT') {
          summary = `Disbursed PKR ${amountVal ? Number(amountVal).toLocaleString() : ''} for ${claimNo || 'claim'} ${txnRef ? `(Ref: ${txnRef})` : ''}`.trim()
        } else if (r.actionType === 'REIMBURSEMENT_REVERSED') {
          summary = `Reversed reimbursement for ${claimNo || 'claim'} ${after.reversalReason ? `— ${after.reversalReason}` : ''}`.trim()
        } else if (r.actionType === 'CLAIM_APPROVED') {
          summary = `Approved claim ${claimNo || ''} (${after.decision || 'Approved'})`.trim()
        } else if (r.actionType === 'CLAIM_REJECTED') {
          summary = `Rejected claim ${claimNo || ''} (${after.decision || 'Rejected'})`.trim()
        } else if (r.actionType === 'CLAIM_SUBMITTED') {
          summary = `Submitted claim ${claimNo || ''} for PKR ${amountVal ? Number(amountVal).toLocaleString() : ''}`.trim()
        } else {
          summary = `${r.actionType} on ${r.entityName} (${claimNo || r.entityId})`
        }
      }

      return {
        id: r.id,
        action: r.actionType,
        actor: after.actorName || r.actorRole || 'System',
        claimNumber: claimNo,
        entityId: r.entityId,
        amount: amountVal ? Number(amountVal) : null,
        transactionReference: txnRef,
        summary,
        metadata: after,
        timestamp: r.createdAt.toISOString()
      }
    })

    // Search filter
    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase()
      mapped = mapped.filter((item) =>
        item.action.toLowerCase().includes(q) ||
        (item.actor && item.actor.toLowerCase().includes(q)) ||
        (item.summary && item.summary.toLowerCase().includes(q)) ||
        (item.claimNumber && item.claimNumber.toLowerCase().includes(q)) ||
        (item.transactionReference && item.transactionReference.toLowerCase().includes(q))
      )
    }

    if (query.claimNumber && query.claimNumber.trim()) {
      const cn = query.claimNumber.trim().toLowerCase()
      mapped = mapped.filter((item) => item.claimNumber && item.claimNumber.toLowerCase() === cn)
    }

    if (query.startDate) {
      const start = new Date(query.startDate)
      mapped = mapped.filter((item) => new Date(item.timestamp) >= start)
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      end.setHours(23, 59, 59, 999)
      mapped = mapped.filter((item) => new Date(item.timestamp) <= end)
    }

    // Attach pagination metadata on the array
    const page = Math.max(1, parseInt(query.page || '1', 10))
    const limit = query.limit ? Math.max(1, parseInt(query.limit, 10)) : mapped.length
    const total = mapped.length
    const totalPages = Math.ceil(total / (limit || 1)) || 1

    mapped.pagination = { total, page, limit, totalPages }
    return mapped
  }

  async getExpenseClaims(filters = {}, user) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.employeeId) {
      const targetEmp = await this._resolveEmployee(filters.employeeId)
      where.employeeId = targetEmp ? targetEmp.id : filters.employeeId
    }

    const deptId = this._deptId(user)
    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      where.employeeId = user.employeeId
    } else if ((user?.role === 'DEPT_MANAGER' || user?.role === 'TEAM_LEAD') && deptId) {
      where.employee = { departmentId: deptId }
    }

    const rows = await prisma.expenseClaim.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            departmentId: true,
            department: { select: { id: true, name: true } }
          }
        },
        items: true,
        travelRequest: {
          select: { id: true, requestCode: true, destination: true, advanceAmount: true }
        }
      },
      orderBy: { submissionDate: 'desc' }
    })

    return this._decorateExpenseClaims(rows)
  }

  async getExpenseClaimById(id, user) {
    const claim = await this._resolveExpenseClaim(id)
    if (!claim) throw new AppError('Expense claim not found', 404, 'NOT_FOUND')

    if (user?.role === 'EMPLOYEE' && user?.employeeId && claim.employeeId !== user.employeeId) {
      throw new AppError('Access denied: You can only view your own expense claims', 403, 'FORBIDDEN')
    }

    const [decorated] = await this._decorateExpenseClaims([claim])
    return decorated
  }

  async createExpenseClaim(data, user) {
    const requestedEmpRef = data.employeeId || user?.employeeId
    const resolvedEmployee = await this._resolveEmployee(requestedEmpRef)
    const employeeId = resolvedEmployee?.id || (!data.employeeId ? user?.employeeId : null)
    if (!employeeId || !resolvedEmployee) {
      throw new AppError('Valid Employee ID is required', 400, 'VALIDATION_FAILED')
    }

    // Normalize single-claim modal payload OR multi-item API payload
    const hasItemsArray = Array.isArray(data.items) && data.items.length > 0
    const normalizedItems = hasItemsArray
      ? data.items
      : (data.amount !== undefined && (data.categoryId || data.category))
        ? [
            {
              category: data.categoryId || data.category,
              categoryName: data.category,
              amount: data.amount,
              expenseDate: data.expenseDate || new Date().toISOString().slice(0, 10),
              merchantName: data.projectClient || data.merchantName || null,
              receiptUrl: data.receiptReference || data.receiptUrl || null,
              notes: data.description || data.notes || null
            }
          ]
        : []

    const claimTitle = String(data.claimTitle || data.description || data.vendorOrDescription || data.merchantName || '').trim()
    if (!claimTitle || normalizedItems.length === 0) {
      throw new AppError('Claim title/description and at least one expense item are required', 400, 'VALIDATION_FAILED')
    }

    const configuredCategories = await this.getExpenseCategories()
    const categoryLookup = this._buildCategoryLookup(configuredCategories)
    const validEnumCategories = ['MEALS', 'LODGING', 'TRANSPORT', 'FUEL', 'CLIENT_ENTERTAINMENT', 'SUPPLIES', 'OTHER']

    // Load non-rejected existing claims for this employee + duplicate receipt check across all active claims
    const activeStatuses = ['SUBMITTED', 'MANAGER_APPROVED', 'HR_APPROVED', 'DISBURSED']
    const existingEmployeeClaims = await prisma.expenseClaim.findMany({
      where: { employeeId, status: { in: activeStatuses } },
      include: { items: true }
    })

    const receiptRefToCheck = String(data.receiptReference || normalizedItems[0]?.receiptUrl || '').trim()
    if (receiptRefToCheck) {
      const existingReceiptClaims = await prisma.expenseClaim.findMany({
        where: { status: { in: activeStatuses } },
        include: { items: { select: { receiptUrl: true, notes: true } } }
      })
      const lowerRec = receiptRefToCheck.toLowerCase()
      const dupClaim = existingReceiptClaims.find((c) =>
        c.items.some((it) => {
          const itemMeta = this._parseItemMeta(it.notes)
          const r1 = String(it.receiptUrl || '').trim().toLowerCase()
          const r2 = String(itemMeta.receiptReference || '').trim().toLowerCase()
          return (r1 && r1 === lowerRec) || (r2 && r2 === lowerRec)
        })
      )
      if (dupClaim) {
        throw new AppError(
          `Duplicate receipt reference "${receiptRefToCheck}" detected. Already used in claim ${dupClaim.claimNumber}.`,
          409,
          'DUPLICATE_RECEIPT'
        )
      }
    }

    // Resolve travel request if provided (accepts CUID or requestCode like TRV-2026-001)
    let travelReq = null
    const travelRef = data.travelRequestId || data.relatedTravelRequestId || data.travelRequestRef || null
    if (travelRef) {
      travelReq = await this._findTravelRequest(travelRef)
      if (!travelReq) {
        throw new AppError(`Referenced travel request "${travelRef}" does not exist.`, 404, 'TRAVEL_REQUEST_NOT_FOUND')
      }
      if (!['APPROVED', 'COMPLETED'].includes(travelReq.status)) {
        throw new AppError(`Referenced travel request "${travelReq.requestCode}" must be Approved or Completed.`, 400, 'TRAVEL_REQUEST_NOT_APPROVED')
      }
      if (this._isExpenseSettled(travelReq)) {
        throw new AppError(
          `Financial lock: Travel request "${travelReq.requestCode}" (${this._expenseCode(travelReq)}) is already Settled. Submitting duplicate expense claims against a settled trip is prohibited.`,
          409,
          'EXPENSE_ALREADY_SETTLED'
        )
      }
    }

    let total = new Prisma.Decimal(0)
    const preparedItems = []

    let expPolicy = null
    try {
      const policies = await adminSettingsService.getCompanyPolicies()
      expPolicy = policies.find((p) => p.id === 'POL-EXP-001')
    } catch {}
    const requiredReceiptThreshold = Number(expPolicy?.rules?.requiredReceiptThreshold ?? 1000)
    const dailyFuelLimit = Number(expPolicy?.rules?.dailyFuelLimit ?? 6000)
    const dailyMealLimit = Number(expPolicy?.rules?.dailyMealLimit ?? 4000)
    const restrictDuplicateFuelAllowance = expPolicy?.rules?.restrictDuplicateFuelAllowance !== false

    for (const it of normalizedItems) {
      const numericAmt = Number(it.amount)
      if (!Number.isFinite(numericAmt) || numericAmt <= 0) {
        throw new AppError('Each item amount must be greater than zero', 400, 'INVALID_ITEM_AMOUNT')
      }

      const catConfig = this._findCategoryConfig(categoryLookup, it.category) || this._findCategoryConfig(categoryLookup, it.categoryName)
      if (!hasItemsArray && !catConfig) {
        throw new AppError(`Expense category "${it.category}" is invalid or inactive.`, 400, 'INVALID_CATEGORY')
      }

      const receiptProvided = String(it.receiptUrl || it.receiptAttachment || data.receiptReference || '').trim()

      if (catConfig) {
        if (!catConfig.isActive) {
          throw new AppError(`Expense category '${catConfig.code || it.category}' is currently deactivated`, 400, 'CATEGORY_DEACTIVATED')
        }
        if (catConfig.maxLimit && numericAmt > Number(catConfig.maxLimit)) {
          throw new AppError(
            `Item amount PKR ${numericAmt} exceeds category '${catConfig.name}' maximum limit of PKR ${catConfig.maxLimit}`,
            400,
            'CATEGORY_LIMIT_EXCEEDED'
          )
        }
      }

      // Enforce POL-EXP-001 Mandatory Receipt Threshold
      if (numericAmt >= requiredReceiptThreshold && !receiptProvided) {
        throw new AppError(
          `Receipt reference/attachment is mandatory for expense claims of PKR ${requiredReceiptThreshold.toLocaleString()} or above under POL-EXP-001.`,
          400,
          'RECEIPT_REQUIRED'
        )
      }

      // Enforce POL-EXP-001 Category Ceilings & Duplicate Checks
      const rawCatCode = String(it.category || catConfig?.code || '').toUpperCase()
      if (rawCatCode === 'FUEL') {
        if (numericAmt > dailyFuelLimit) {
          throw new AppError(
            `Fuel expense PKR ${numericAmt.toLocaleString()} exceeds the daily fuel reimbursement limit of PKR ${dailyFuelLimit.toLocaleString()} under POL-EXP-001.`,
            400,
            'DAILY_FUEL_LIMIT_EXCEEDED'
          )
        }
        if (restrictDuplicateFuelAllowance) {
          const activeFuelAllowance = await prisma.allowanceAllocation.findFirst({
            where: {
              employeeId,
              status: 'ACTIVE',
              OR: [
                { category: { in: ['TRANSPORT', 'FUEL', 'CONVEYANCE'] } },
                { code: { contains: 'FUEL', mode: 'insensitive' } },
                { name: { contains: 'Fuel', mode: 'insensitive' } }
              ]
            }
          })
          if (activeFuelAllowance && !it.clientBillingRef && !data.clientBillingRef && !data.projectClient) {
            throw new AppError(
              'Cannot claim fuel reimbursement while receiving active monthly fuel/transport allowance without explicit client billing reference under POL-EXP-001.',
              400,
              'DUPLICATE_FUEL_ALLOWANCE_PROHIBITED'
            )
          }
        }
      }

      if (['MEALS', 'CLIENT_ENTERTAINMENT', 'MEALS_ENTERTAINMENT'].includes(rawCatCode) && numericAmt > dailyMealLimit) {
        throw new AppError(
          `Meals expense PKR ${numericAmt.toLocaleString()} exceeds the daily meals limit of PKR ${dailyMealLimit.toLocaleString()} under POL-EXP-001.`,
          400,
          'DAILY_MEAL_LIMIT_EXCEEDED'
        )
      }
      if (catConfig) {
        if (!catConfig.isActive) {
          throw new AppError(`Expense category '${catConfig.code || it.category}' is currently deactivated`, 400, 'CATEGORY_DEACTIVATED')
        }
        const threshold =
          catConfig.receiptRequiredThreshold !== undefined && catConfig.receiptRequiredThreshold !== null
            ? Number(catConfig.receiptRequiredThreshold)
            : null
        const needsReceipt =
          threshold !== null
            ? Boolean(catConfig.receiptRequired !== false && numericAmt >= threshold)
            : Boolean(catConfig.receiptRequired)
        if (needsReceipt && !receiptProvided) {
          throw new AppError(
            threshold !== null
              ? `Receipt reference is required for '${catConfig.name}' amounts of PKR ${threshold.toLocaleString()} or above`
              : `Receipt attachment is required for category '${catConfig.name}'`,
            400,
            'RECEIPT_REQUIRED'
          )
        }
        if (catConfig.maxLimit && numericAmt > Number(catConfig.maxLimit)) {
          throw new AppError(
            `Item amount PKR ${numericAmt} exceeds category '${catConfig.name}' maximum limit of PKR ${catConfig.maxLimit}`,
            400,
            'CATEGORY_LIMIT_EXCEEDED'
          )
        }
        if (catConfig.requiresTravelRequestRef && !travelReq) {
          throw new AppError(
            `Category '${catConfig.name}' requires an approved official Travel Request Reference.`,
            400,
            'TRAVEL_REFERENCE_REQUIRED'
          )
        }

        // Daily split & Monthly cap checks when explicitly configured
        const expDateStr = it.expenseDate ? new Date(it.expenseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
        const expMonthStr = expDateStr.slice(0, 7)
        const targetCode = String(catConfig.code).toUpperCase()
        if (catConfig.dailyLimit && Number(catConfig.dailyLimit) > 0) {
          let sameDayCount = 0
          let sameDaySum = 0
          for (const ec of existingEmployeeClaims) {
            for (const ei of ec.items) {
              const eiMeta = this._parseItemMeta(ei.notes)
              const eiCode = String(eiMeta.categoryCode || ei.category || '').toUpperCase()
              const eiDate = ei.expenseDate ? new Date(ei.expenseDate).toISOString().slice(0, 10) : ''
              if (eiCode === targetCode && eiDate === expDateStr) {
                sameDayCount += 1
                sameDaySum += Number(ei.amount || 0)
              }
            }
          }
          if (sameDayCount > 0 && sameDaySum + numericAmt > Number(catConfig.dailyLimit)) {
            throw new AppError(
              `Potential split claim detected: daily total PKR ${(sameDaySum + numericAmt).toLocaleString()} exceeds daily cap of PKR ${Number(catConfig.dailyLimit).toLocaleString()} for ${catConfig.name}.`,
              400,
              'DAILY_LIMIT_EXCEEDED'
            )
          }
        }
        if (catConfig.monthlyLimit && Number(catConfig.monthlyLimit) > 0) {
          let monthSum = 0
          for (const ec of existingEmployeeClaims) {
            for (const ei of ec.items) {
              const eiMeta = this._parseItemMeta(ei.notes)
              const eiCode = String(eiMeta.categoryCode || ei.category || '').toUpperCase()
              const eiDate = ei.expenseDate ? new Date(ei.expenseDate).toISOString().slice(0, 10) : ''
              if (eiCode === targetCode && eiDate.startsWith(expMonthStr)) {
                monthSum += Number(ei.amount || 0)
              }
            }
          }
          if (monthSum + numericAmt > Number(catConfig.monthlyLimit)) {
            throw new AppError(
              `Monthly limit exceeded: total for ${catConfig.name} in ${expMonthStr} would reach PKR ${(monthSum + numericAmt).toLocaleString()} (ceiling PKR ${Number(catConfig.monthlyLimit).toLocaleString()}).`,
              400,
              'MONTHLY_LIMIT_EXCEEDED'
            )
          }
        }
      }

      total = total.plus(new Prisma.Decimal(numericAmt))
      const rawCode = String(catConfig?.code || it.category || 'OTHER').toUpperCase()
      const enumCat = validEnumCategories.includes(rawCode) ? rawCode : 'OTHER'
      const richNotes = hasItemsArray
        ? (it.notes || null)
        : JSON.stringify({
            description: String(data.description || claimTitle).trim(),
            categoryCode: rawCode,
            categoryName: catConfig?.name || it.categoryName || rawCode,
            receiptReference: receiptProvided || null,
            receiptFileName: data.receiptFileName || null,
            projectClient: data.projectClient ? String(data.projectClient).trim() : null,
            paymentMethodUsed: data.paymentMethodUsed || 'Cash',
            requestedReimbursementAccount: data.requestedReimbursementAccount || 'Bank Transfer Advice (On File)',
            relatedTravelRequestId: travelReq?.requestCode || null,
            department: resolvedEmployee.department?.name || null
          })

      preparedItems.push({
        category: enumCat,
        expenseDate: it.expenseDate ? new Date(it.expenseDate) : new Date(),
        merchantName: it.merchantName || data.projectClient || null,
        amount: new Prisma.Decimal(numericAmt),
        currency: it.currency || 'PKR',
        receiptUrl: receiptProvided || null,
        notes: richNotes
      })
    }

    let advanceSettlement = new Prisma.Decimal(0)
    if (travelReq && travelReq.advanceAmount) {
      advanceSettlement = Prisma.Decimal.min(travelReq.advanceAmount, total)
    }

    const netPayable = total.minus(advanceSettlement)
    const claimNumber = data.claimNumber || await this._generateRequestCode('EXP-2026', 'expenseClaim', 'claimNumber', 3)
    const actorName = this._actorName(user)

    const createdId = await prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.create({
        data: {
          claimNumber,
          employeeId,
          travelRequestId: travelReq?.id || null,
          claimTitle,
          totalAmount: total,
          advanceSettlementAmount: advanceSettlement,
          netPayableAmount: netPayable,
          status: 'SUBMITTED'
        }
      })

      for (const itemData of preparedItems) {
        await tx.expenseItem.create({
          data: {
            claimId: claim.id,
            ...itemData
          }
        })
      }

      await this._logAudit(tx, {
        user,
        sourceModule: 'EXPENSES',
        actionType: 'CLAIM_SUBMITTED',
        entityName: 'ExpenseClaim',
        entityId: claim.id,
        after: {
          claimNumber: claim.claimNumber,
          totalAmount: total.toString(),
          netPayableAmount: netPayable.toString(),
          category: preparedItems[0]?.category,
          actorName,
          summary: `Claim ${claim.claimNumber} submitted for PKR ${total.toString()}`
        },
        notes: `Submitted claim ${claim.claimNumber} (${claimTitle}) for PKR ${Number(total).toLocaleString()}`,
        employeeId
      })

      return claim.id
    })

    return this.getExpenseClaimById(createdId, user)
  }

  async reviewExpenseClaim(id, { action, decision, remarks }, reviewerUser) {
    const claim = await this._resolveExpenseClaim(id)
    if (!claim) throw new AppError('Expense claim not found', 404, 'NOT_FOUND')

    if (claim.status !== 'SUBMITTED') {
      throw new AppError('Expense claim has already been reviewed', 400, 'ALREADY_REVIEWED')
    }

    if (!this._isSuperAdmin(reviewerUser) && reviewerUser?.employeeId && claim.employeeId === reviewerUser.employeeId) {
      throw new AppError('Anti-self-approval: You cannot approve your own expense claim', 403, 'SELF_APPROVAL_PROHIBITED')
    }

    const rawDecision = String(action || decision || '').trim().toUpperCase()
    const isApprove = rawDecision === 'APPROVE' || rawDecision === 'APPROVED'
    const isReject = rawDecision === 'REJECT' || rawDecision === 'REJECTED'
    const isReturn = rawDecision === 'RETURN' || rawDecision === 'RETURNED'

    if (!isApprove && !isReject && !isReturn) {
      throw new AppError('Invalid review decision. Must be Approved, Rejected, or Returned.', 400, 'VALIDATION_FAILED')
    }

    const policies = await this.getExpensePolicies()
    if (isApprove) {
      if (reviewerUser?.role === 'DEPT_MANAGER' || reviewerUser?.role === 'TEAM_LEAD') {
        if (Number(claim.totalAmount) > policies.managerLimit) {
          throw new AppError(
            `Claim total of PKR ${claim.totalAmount} exceeds Department Manager approval limit of PKR ${policies.managerLimit}. HR Admin or Super Admin authorization is required.`,
            403,
            'APPROVAL_THRESHOLD_EXCEEDED'
          )
        }
      } else if (reviewerUser?.role === 'HR_ADMIN') {
        if (Number(claim.totalAmount) > policies.hrAdminLimit) {
          throw new AppError(
            `Claim total of PKR ${claim.totalAmount} exceeds HR Admin approval limit of PKR ${policies.hrAdminLimit}. Super Admin authorization is required.`,
            403,
            'APPROVAL_THRESHOLD_EXCEEDED'
          )
        }
      }
    }

    const newStatus = isApprove
      ? ((reviewerUser?.role === 'DEPT_MANAGER' || reviewerUser?.role === 'TEAM_LEAD') ? 'MANAGER_APPROVED' : 'HR_APPROVED')
      : isReject
        ? 'REJECTED'
        : 'DRAFT'

    const auditAction = isApprove ? 'CLAIM_APPROVED' : isReject ? 'CLAIM_REJECTED' : 'CLAIM_RETURNED'
    const decisionLabel = isApprove ? 'Approved' : isReject ? 'Rejected' : 'Returned'
    const actorName = this._actorName(reviewerUser)
    const cleanRemarks = String(remarks || '').trim()

    await prisma.$transaction(async (tx) => {
      await tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          status: newStatus,
          approvedById: reviewerUser.id
        }
      })

      await this._logAudit(tx, {
        user: reviewerUser,
        sourceModule: 'EXPENSES',
        actionType: auditAction,
        entityName: 'ExpenseClaim',
        entityId: claim.id,
        before: { status: claim.status },
        after: {
          claimNumber: claim.claimNumber,
          status: newStatus,
          decision: decisionLabel,
          remarks: cleanRemarks,
          actorName,
          summary: `Claim ${claim.claimNumber} marked as ${decisionLabel}`
        },
        notes: cleanRemarks || `Claim ${claim.claimNumber} ${decisionLabel.toLowerCase()} by ${actorName}`,
        employeeId: claim.employeeId
      })
    })

    return this.getExpenseClaimById(claim.id, reviewerUser)
  }

  async disburseReimbursement(id, { paymentMethod, transactionReference, paymentDate, paymentAccount, amount, notes, reimbursementId: customReimbId, idempotencyKey }, financeUser) {
    const claim = await this._resolveExpenseClaim(id)
    if (!claim) throw new AppError('Expense claim not found', 404, 'NOT_FOUND')

    const cleanTxnRef = String(transactionReference || '').trim()
    if (!cleanTxnRef) {
      throw new AppError('Transaction reference is required for payment disbursement audit', 400, 'VALIDATION_FAILED')
    }

    // Idempotency Safeguard: If claim is already disbursed with same transactionReference, return idempotently
    if (claim.status === 'DISBURSED') {
      if (claim.transactionReference && claim.transactionReference.trim().toLowerCase() === cleanTxnRef.toLowerCase()) {
        return this.getExpenseClaimById(claim.id, financeUser)
      }
      throw new AppError(
        `Expense claim ${claim.claimNumber} has already been fully disbursed.`,
        400,
        'CLAIM_ALREADY_DISBURSED'
      )
    }

    if (!['MANAGER_APPROVED', 'HR_APPROVED'].includes(claim.status)) {
      throw new AppError(`Cannot disburse reimbursement for claim with status ${claim.status}. Claim must be approved first.`, 400, 'NOT_APPROVED')
    }

    const methodMap = {
      BANK_TRANSFER: 'BANK_TRANSFER',
      'BANK TRANSFER': 'BANK_TRANSFER',
      CHEQUE: 'CHEQUE',
      CASH: 'CASH'
    }
    const normalizedMethod = methodMap[String(paymentMethod || '').trim().toUpperCase()]
    if (!normalizedMethod) {
      throw new AppError('Valid paymentMethod (BANK_TRANSFER, CHEQUE, CASH) is required', 400, 'VALIDATION_FAILED')
    }

    const accountRef = (paymentAccount || 'Corporate Primary Disbursement A/C').trim()
    if (!accountRef) {
      throw new AppError('Payment disbursement account reference is required to prevent unverified PAID status', 400, 'PAYMENT_ACCOUNT_REQUIRED')
    }

    const dateVal = paymentDate ? new Date(paymentDate) : new Date()
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (dateVal > today) {
      throw new AppError('Disbursement paymentDate cannot be in the future', 400, 'FUTURE_DATE_PROHIBITED')
    }

    const [decorated] = await this._decorateExpenseClaims([claim])
    const remaining = Number(decorated.remainingPayable ?? claim.netPayableAmount)
    const payAmount = amount !== undefined && amount !== null && String(amount).trim() !== ''
      ? Number(amount)
      : remaining

    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      throw new AppError('Valid disbursement amount greater than 0 PKR is required.', 400, 'VALIDATION_FAILED')
    }
    if (payAmount > remaining) {
      throw new AppError(
        `Overpayment prevented: Requested PKR ${payAmount.toLocaleString()} exceeds remaining payable balance of PKR ${remaining.toLocaleString()}.`,
        400,
        'OVERPAYMENT_PROHIBITED'
      )
    }

    // Prevent duplicate transaction reference across existing non-reversed claims
    const existingClaimRows = await prisma.expenseClaim.findMany({
      where: { status: { not: 'REJECTED' } },
      select: { id: true, transactionReference: true }
    })
    const existingClaimIds = new Set(existingClaimRows.map((c) => c.id))
    const allDisbLogs = await prisma.auditLog.findMany({
      where: {
        sourceModule: 'EXPENSES',
        entityName: 'ExpenseClaim',
        entityId: { in: [...existingClaimIds] },
        actionType: { in: ['DISBURSE_REIMBURSEMENT', 'REIMBURSEMENT_REVERSED'] }
      }
    })
    const reversedReimbIds = new Set(
      allDisbLogs
        .filter((l) => l.actionType === 'REIMBURSEMENT_REVERSED' && l.recordSnapshotAfter?.reimbursementId)
        .map((l) => l.recordSnapshotAfter.reimbursementId)
    )
    const duplicateTxn =
      allDisbLogs.some((l) => {
        if (l.actionType !== 'DISBURSE_REIMBURSEMENT') return false
        const rid = l.recordSnapshotAfter?.reimbursementId || l.id
        if (reversedReimbIds.has(rid)) return false
        return String(l.recordSnapshotAfter?.transactionReference || '').trim().toLowerCase() === cleanTxnRef.toLowerCase()
      }) ||
      existingClaimRows.some(
        (c) =>
          c.transactionReference &&
          c.transactionReference.trim().toLowerCase() === cleanTxnRef.toLowerCase() &&
          !allDisbLogs.some(
            (l) =>
              l.entityId === c.id &&
              l.actionType === 'DISBURSE_REIMBURSEMENT' &&
              reversedReimbIds.has(l.recordSnapshotAfter?.reimbursementId || l.id)
          )
      )
    if (duplicateTxn) {
      throw new AppError(`Duplicate transaction reference "${cleanTxnRef}" already recorded.`, 409, 'DUPLICATE_TRANSACTION_REFERENCE')
    }

    const reimbursementId = customReimbId || idempotencyKey || `REIMB-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`
    const isFullPayment = decorated.paidAmount + payAmount >= Number(claim.netPayableAmount)
    const actorName = this._actorName(financeUser)

    await prisma.$transaction(async (tx) => {
      // Re-read with atomic check inside transaction
      const freshClaim = await tx.expenseClaim.findUnique({ where: { id: claim.id } })
      if (!freshClaim) throw new AppError('Expense claim not found', 404, 'NOT_FOUND')

      await tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          status: isFullPayment ? 'DISBURSED' : claim.status,
          disbursedAt: isFullPayment ? dateVal : claim.disbursedAt,
          disbursedById: financeUser.id,
          paymentMethod: normalizedMethod,
          transactionReference: cleanTxnRef
        }
      })

      const summaryText = notes
        ? String(notes).trim()
        : `Disbursed PKR ${payAmount.toLocaleString()} for ${claim.claimNumber} via ${normalizedMethod} (Ref: ${cleanTxnRef})`

      await tx.auditLog.create({
        data: {
          actorUserId: financeUser.id,
          actorEmployeeCode: financeUser?.employee?.employeeCode || null,
          actorRole: financeUser.role || 'HR_ADMIN',
          actionType: 'DISBURSE_REIMBURSEMENT',
          sourceModule: 'EXPENSES',
          entityName: 'ExpenseClaim',
          entityId: claim.id,
          reasonOrNotes: summaryText,
          recordSnapshotAfter: {
            reimbursementId,
            idempotencyKey: idempotencyKey || null,
            claimNumber: claim.claimNumber,
            amount: payAmount,
            netPayableAmount: claim.netPayableAmount.toString(),
            paymentMethod: normalizedMethod,
            transactionReference: cleanTxnRef,
            paymentAccount: accountRef,
            disbursedAt: dateVal.toISOString(),
            actorName,
            summary: summaryText,
            notes: notes ? String(notes).trim() : 'Reimbursement payment processed.'
          }
        }
      })
    })

    return this.getExpenseClaimById(claim.id, financeUser)
  }

  async reverseReimbursement(id, { reimbursementId, reason }, actorUser) {
    const cleanReason = String(reason || '').trim()
    if (cleanReason.length < 5) {
      throw new AppError('Mandatory audit reason (min 5 characters) required for payment reversal.', 400, 'VALIDATION_FAILED')
    }

    const claim = await this._resolveExpenseClaim(id)
    if (!claim) throw new AppError('Expense claim not found', 404, 'NOT_FOUND')

    const [decorated] = await this._decorateExpenseClaims([claim])
    const target = (decorated.reimbursements || []).find((r) => r.reimbursementId === reimbursementId)
    if (!target) {
      throw new AppError(`Reimbursement record '${reimbursementId}' not found on claim ${claim.claimNumber}.`, 404, 'NOT_FOUND')
    }
    if (target.isReversed) {
      throw new AppError('This reimbursement has already been reversed.', 400, 'ALREADY_REVERSED')
    }

    const actorName = this._actorName(actorUser)
    await prisma.$transaction(async (tx) => {
      if (claim.status === 'DISBURSED') {
        await tx.expenseClaim.update({
          where: { id: claim.id },
          data: {
            status: 'HR_APPROVED',
            disbursedAt: null
          }
        })
      }

      await this._logAudit(tx, {
        user: actorUser,
        sourceModule: 'EXPENSES',
        actionType: 'REIMBURSEMENT_REVERSED',
        entityName: 'ExpenseClaim',
        entityId: claim.id,
        after: {
          reimbursementId,
          claimNumber: claim.claimNumber,
          amount: target.amount,
          actorName,
          summary: `Reversed PKR ${Number(target.amount).toLocaleString()} for claim ${claim.claimNumber}`
        },
        notes: cleanReason,
        employeeId: claim.employeeId
      })
    })

    return this.getExpenseClaimById(claim.id, actorUser)
  }

  async updateTransportAssignment(idOrCode, data = {}, actorUser) {
    const assignment = await prisma.transportAssignment.findFirst({
      where: { OR: [{ id: idOrCode }, { assignmentCode: idOrCode }] },
      include: { route: true }
    })
    if (!assignment) throw new AppError(`Transport assignment '${idOrCode}' not found`, 404, 'NOT_FOUND')

    const role = String(actorUser?.role || '').toUpperCase()
    const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN'
    const isOwner = Boolean(actorUser?.employeeId && assignment.employeeId === actorUser.employeeId)

    if (!isAdmin && !isOwner) {
      throw new AppError('Unauthorized to edit this transport assignment', 403, 'FORBIDDEN')
    }
    if (!isAdmin && assignment.status !== 'Pending Approval') {
      throw new AppError('Only HR Admin or Super Admin can edit active or suspended transport assignments', 403, 'FORBIDDEN')
    }
    if (['Cancelled', 'Rejected'].includes(assignment.status)) {
      throw new AppError(`Cannot edit transport assignment in status '${assignment.status}'`, 400, 'INVALID_STATUS')
    }

    let targetRoute = assignment.route
    if (data.routeId && data.routeId !== assignment.routeId && data.routeId !== assignment.route?.routeCode) {
      targetRoute = await prisma.transportRoute.findFirst({
        where: { OR: [{ id: data.routeId }, { routeCode: data.routeId }] }
      })
      if (!targetRoute) throw new AppError(`Route '${data.routeId}' not found`, 404, 'NOT_FOUND')
      if (targetRoute.status !== 'Active') {
        throw new AppError(`Route '${targetRoute.routeName}' is currently ${targetRoute.status} and cannot accept assignments`, 400, 'ROUTE_INACTIVE')
      }
      if (assignment.status === 'Active') {
        const activeCount = await prisma.transportAssignment.count({
          where: { routeId: targetRoute.id, status: 'Active' }
        })
        if (activeCount >= targetRoute.capacity) {
          throw new AppError(`Route '${targetRoute.routeName}' is at full capacity (${targetRoute.capacity})`, 400, 'CAPACITY_EXCEEDED')
        }
      }
    }

    const pickupPoint = 'pickupPoint' in data ? String(data.pickupPoint || '').trim() : assignment.pickupPoint
    if (!pickupPoint) throw new AppError('Pickup point is required', 400, 'VALIDATION_FAILED')

    const nextContribution =
      data.monthlyContribution !== undefined && data.monthlyContribution !== null && String(data.monthlyContribution).trim() !== ''
        ? Number(data.monthlyContribution)
        : Number(assignment.monthlyContribution)
    if (!Number.isFinite(nextContribution) || nextContribution < 0) {
      throw new AppError('Monthly contribution must be a valid non-negative number', 400, 'VALIDATION_FAILED')
    }

    const actorName = this._actorName(actorUser)
    return prisma.$transaction(async (tx) => {
      const updated = await tx.transportAssignment.update({
        where: { id: assignment.id },
        data: {
          routeId: targetRoute.id,
          pickupPoint,
          dropPoint: 'dropPoint' in data ? (String(data.dropPoint || '').trim() || assignment.dropPoint) : assignment.dropPoint,
          pickupTime: 'pickupTime' in data && data.pickupTime ? String(data.pickupTime).trim() : assignment.pickupTime,
          dropTime: 'dropTime' in data && data.dropTime ? String(data.dropTime).trim() : targetRoute.eveningDepartureTime || assignment.dropTime,
          facilityType: 'facilityType' in data && data.facilityType ? String(data.facilityType).trim() : assignment.facilityType,
          monthlyContribution: new Prisma.Decimal(nextContribution),
          effectiveFrom: 'effectiveFrom' in data && data.effectiveFrom ? new Date(data.effectiveFrom) : assignment.effectiveFrom,
          updatedBy: actorName
        },
        include: {
          employee: { include: { department: { select: { id: true, name: true } } } },
          route: { include: { assignedVehicle: true, assignedDriver: true } }
        }
      })

      await this._logAudit(tx, {
        user: actorUser,
        actionType: 'UPDATE',
        entityName: 'TransportAssignment',
        entityId: assignment.assignmentCode,
        before: {
          routeId: assignment.routeId,
          pickupPoint: assignment.pickupPoint,
          pickupTime: assignment.pickupTime,
          facilityType: assignment.facilityType,
          monthlyContribution: Number(assignment.monthlyContribution)
        },
        after: {
          routeId: updated.routeId,
          pickupPoint: updated.pickupPoint,
          pickupTime: updated.pickupTime,
          facilityType: updated.facilityType,
          monthlyContribution: Number(updated.monthlyContribution)
        },
        notes: `Transport assignment ${assignment.assignmentCode} updated by ${actorName}`,
        employeeId: assignment.employeeId
      })

      return updated
    })
  }

  _enrichCategory(c) {
    const maxLimit = Number(c.maxLimit ?? c.perClaimLimit ?? 15000)
    const name = String(c.name || c.categoryName || c.code || '').trim()
    return {
      ...c,
      categoryId: c.categoryId || c.code,
      code: String(c.code || '').toUpperCase(),
      name,
      categoryName: name,
      description: c.description || `Corporate spending policy for ${name}`,
      maxLimit,
      perClaimLimit: maxLimit,
      dailyLimit: Number(c.dailyLimit ?? maxLimit),
      monthlyLimit: Number(c.monthlyLimit ?? maxLimit * 3),
      receiptRequired: Boolean(c.receiptRequired),
      receiptRequiredThreshold:
        c.receiptRequiredThreshold !== undefined && c.receiptRequiredThreshold !== null
          ? Number(c.receiptRequiredThreshold)
          : undefined,
      requiresTravelRequestRef: Boolean(c.requiresTravelRequestRef),
      isActive: c.isActive !== false
    }
  }

  getDefaultExpenseCategories() {
    return [
      { code: 'MEALS', name: 'Meals & Food', maxLimit: 20000, receiptRequired: false, isActive: true },
      { code: 'LODGING', name: 'Lodging & Hotel', maxLimit: 50000, receiptRequired: false, isActive: true },
      { code: 'TRANSPORT', name: 'Transport & Cab', maxLimit: 50000, receiptRequired: false, isActive: true },
      { code: 'FUEL', name: 'Fuel & Mileage', maxLimit: 20000, receiptRequired: false, isActive: true },
      { code: 'CLIENT_ENTERTAINMENT', name: 'Client Entertainment', maxLimit: 30000, receiptRequired: false, isActive: true },
      { code: 'SUPPLIES', name: 'Office Supplies', maxLimit: 25000, receiptRequired: false, isActive: true },
      { code: 'OTHER', name: 'Other Expenses', maxLimit: 15000, receiptRequired: false, isActive: true }
    ].map((c) => this._enrichCategory(c))
  }

  async getExpenseCategories() {
    const settings = await prisma.organizationSetting.findFirst()
    if (!settings || !Array.isArray(settings.settingsJson?.expenseCategories)) {
      return []
    }
    return settings.settingsJson.expenseCategories.map((c) => this._enrichCategory(c))
  }

  async _saveExpenseCategoriesSetting(updatedList) {
    const settings = await prisma.organizationSetting.findFirst()
    if (!settings) {
      await prisma.organizationSetting.create({
        data: { companyName: 'iSysware Software Solutions', settingsJson: { expenseCategories: updatedList } }
      })
    } else {
      await prisma.organizationSetting.update({
        where: { id: settings.id },
        data: {
          settingsJson: {
            ...(settings.settingsJson || {}),
            expenseCategories: updatedList
          }
        }
      })
    }
  }

  async createExpenseCategory(data, actorUser) {
    const name = String(data.name || data.categoryName || '').trim()
    const rawCode = String(data.code || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)).trim().toUpperCase()
    if (!rawCode || !name) {
      throw new AppError('Category code and name are required', 400, 'VALIDATION_FAILED')
    }

    const categories = await this.getExpenseCategories()
    if (categories.some((c) => c.code === rawCode || c.name.toLowerCase() === name.toLowerCase())) {
      throw new AppError(`Expense category '${rawCode}' or name '${name}' already exists`, 409, 'CATEGORY_ALREADY_EXISTS')
    }

    const maxLimit = Number(data.maxLimit ?? data.perClaimLimit ?? 15000)
    const threshold =
      data.receiptRequiredThreshold !== undefined && data.receiptRequiredThreshold !== ''
        ? Number(data.receiptRequiredThreshold)
        : undefined
    const newCat = this._enrichCategory({
      code: rawCode,
      name,
      description: data.description ? String(data.description).trim() : `Custom corporate category for ${name}`,
      maxLimit,
      dailyLimit: data.dailyLimit !== undefined && data.dailyLimit !== '' ? Number(data.dailyLimit) : maxLimit,
      monthlyLimit: data.monthlyLimit !== undefined && data.monthlyLimit !== '' ? Number(data.monthlyLimit) : maxLimit * 3,
      receiptRequired: data.receiptRequired !== undefined ? Boolean(data.receiptRequired) : true,
      ...(threshold !== undefined ? { receiptRequiredThreshold: threshold } : {}),
      requiresTravelRequestRef: Boolean(data.requiresTravelRequestRef),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
    })

    const updatedList = [...categories, newCat]
    await this._saveExpenseCategoriesSetting(updatedList)
    await this._logAudit(prisma, {
      user: actorUser,
      sourceModule: 'EXPENSES',
      actionType: 'CATEGORY_CREATED',
      entityName: 'ExpenseCategory',
      entityId: rawCode,
      after: { code: rawCode, name, maxLimit, actorName: this._actorName(actorUser), summary: `Created category '${name}' (${rawCode})` },
      notes: `Created custom expense category '${name}' (${rawCode})`
    })

    return newCat
  }

  async updateExpenseCategory(code, data, actorUser) {
    const categories = await this.getExpenseCategories()
    const normalizedCode = code.trim().toUpperCase()
    const idx = categories.findIndex((c) => c.code === normalizedCode)
    if (idx === -1) {
      throw new AppError(`Expense category '${code}' not found`, 404, 'NOT_FOUND')
    }

    const current = categories[idx]
    const nextMax = data.maxLimit !== undefined
      ? Number(data.maxLimit)
      : (data.perClaimLimit !== undefined ? Number(data.perClaimLimit) : current.maxLimit)
    const updatedCat = this._enrichCategory({
      ...current,
      name: (data.name ?? data.categoryName) !== undefined ? String(data.name ?? data.categoryName).trim() : current.name,
      description: data.description !== undefined ? String(data.description).trim() : current.description,
      maxLimit: nextMax,
      dailyLimit: data.dailyLimit !== undefined ? Number(data.dailyLimit) : current.dailyLimit,
      monthlyLimit: data.monthlyLimit !== undefined ? Number(data.monthlyLimit) : current.monthlyLimit,
      receiptRequired: data.receiptRequired !== undefined ? Boolean(data.receiptRequired) : current.receiptRequired,
      ...(data.receiptRequiredThreshold !== undefined
        ? { receiptRequiredThreshold: Number(data.receiptRequiredThreshold) }
        : current.receiptRequiredThreshold !== undefined
          ? { receiptRequiredThreshold: current.receiptRequiredThreshold }
          : {}),
      requiresTravelRequestRef:
        data.requiresTravelRequestRef !== undefined ? Boolean(data.requiresTravelRequestRef) : current.requiresTravelRequestRef,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : current.isActive
    })
    categories[idx] = updatedCat

    await this._saveExpenseCategoriesSetting(categories)
    await this._logAudit(prisma, {
      user: actorUser,
      sourceModule: 'EXPENSES',
      actionType: 'CATEGORY_UPDATED',
      entityName: 'ExpenseCategory',
      entityId: normalizedCode,
      before: { name: current.name, maxLimit: current.maxLimit, isActive: current.isActive },
      after: { name: updatedCat.name, maxLimit: updatedCat.maxLimit, isActive: updatedCat.isActive, actorName: this._actorName(actorUser), summary: `Updated category '${updatedCat.name}'` },
      notes: `Updated expense category '${updatedCat.name}' (${normalizedCode})`
    })

    return updatedCat
  }

  async deleteExpenseCategory(code, actorUser) {
    const normalizedCode = code.trim().toUpperCase()
    const categories = await this.getExpenseCategories()
    const idx = categories.findIndex((c) => c.code === normalizedCode)
    if (idx === -1) {
      throw new AppError(`Expense category '${code}' not found`, 404, 'NOT_FOUND')
    }

    const validEnums = ['MEALS', 'LODGING', 'TRANSPORT', 'FUEL', 'CLIENT_ENTERTAINMENT', 'SUPPLIES', 'OTHER']
    let usedCount = 0
    if (validEnums.includes(normalizedCode)) {
      usedCount = await prisma.expenseItem.count({
        where: { category: normalizedCode }
      })
    } else {
      usedCount = await prisma.expenseItem.count({
        where: { notes: { contains: `"categoryCode":"${normalizedCode}"` } }
      })
    }

    if (usedCount > 0) {
      throw new AppError(
        `Cannot delete expense category '${normalizedCode}' because it has ${usedCount} claim history record(s). Please deactivate it instead.`,
        400,
        'CATEGORY_IN_USE_SAFE_DELETE_ENFORCED'
      )
    }

    const removed = categories[idx]
    categories.splice(idx, 1)
    await this._saveExpenseCategoriesSetting(categories)
    await this._logAudit(prisma, {
      user: actorUser,
      sourceModule: 'EXPENSES',
      actionType: 'CATEGORY_DELETED',
      entityName: 'ExpenseCategory',
      entityId: normalizedCode,
      before: { name: removed.name, maxLimit: removed.maxLimit },
      after: { deleted: true, actorName: this._actorName(actorUser), summary: `Deleted category '${removed.name}'` },
      notes: `Deleted unused expense category '${removed.name}' (${normalizedCode})`
    })

    return { deleted: true, code: normalizedCode }
  }
}

export default new TravelExpenseService()
