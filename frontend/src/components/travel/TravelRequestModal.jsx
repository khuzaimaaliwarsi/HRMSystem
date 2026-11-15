import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'
import employeeService from '@/services/employeeService'

export default function TravelRequestModal({
  isOpen,
  onClose,
  request = null, // if provided, view/edit mode
  initialEditMode = false,
  currentUser = null,
  onSubmitRequest,
  onUpdateRequest,
  onApprove,
  onReject
}) {
  const isViewMode = Boolean(request)
  const normalizedRole = String(currentUser?.role || '').toLowerCase()
  const isSuperAdmin = normalizedRole === 'super_admin'
  const isHR = normalizedRole === 'hr_admin'
  const isHRorSuper = isSuperAdmin || isHR
  const isOwner = Boolean(
    request &&
      (request.employeeId === (currentUser?.employeeId || currentUser?.id) ||
        (request.employeeCuid && request.employeeCuid === currentUser?.employeeId))
  )
  const isSettled = Boolean(request?.isSettled || request?.settlementStatus === 'Settled')
  const isFinancialSnapshotLocked = Boolean(request?.isFinancialSnapshotLocked)
  const isDraftOrReturned = ['Draft', 'Returned'].includes(request?.status)
  const canEditScheduleOrDetails =
    isViewMode &&
    !isSettled &&
    (((isDraftOrReturned || request?.status === 'Submitted') && isOwner) ||
      (isHRorSuper && ['Draft', 'Returned', 'Submitted', 'Under Review'].includes(request?.status)) ||
      (isSuperAdmin && request?.status === 'Approved'))
  const [isEditingExisting, setIsEditingExisting] = useState(false)
  const [correctionReason, setCorrectionReason] = useState('')
  const fieldsDisabled = isViewMode && !isEditingExisting

  const [employees, setEmployees] = useState([])
  const [formData, setFormData] = useState({
    employeeId: currentUser?.employeeId || currentUser?.id || 'EMP-001',
    travelPurpose: '',
    clientProjectRef: '',
    destination: '',
    departureDate: '',
    departureTime: '08:00 AM',
    returnDate: '',
    returnTime: '08:00 PM',
    travelMode: 'Commercial Airline',
    accommodationRequired: true,
    estimatedBudget: '',
    requestedAdvance: '',
    supportingNotes: ''
  })
  const [errorMsg, setErrorMsg] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)

  useEffect(() => {
    if (isHRorSuper) {
      const syncEmps = () => {
        try {
          const emps = employeeService.getAllEmployees() || []
          setEmployees(emps.filter((e) => e.status === 'Active'))
        } catch {
          setEmployees([])
        }
      }
      syncEmps()
      if (typeof employeeService.loadEmployeesAsync === 'function') {
        employeeService.loadEmployeesAsync().then(syncEmps).catch(() => {})
      }
    }
  }, [isHRorSuper, isOpen])

  useEffect(() => {
    if (request) {
      setFormData({
        employeeId: request.employeeId || '',
        travelPurpose: request.travelPurpose || '',
        clientProjectRef: request.clientProjectRef || '',
        destination: request.destination || '',
        departureDate: request.departureDate || '',
        departureTime: request.departureTime || '08:00 AM',
        returnDate: request.returnDate || '',
        returnTime: request.returnTime || '08:00 PM',
        travelMode: request.travelMode || 'Commercial Airline',
        accommodationRequired: request.accommodationRequired ?? true,
        estimatedBudget: request.estimatedBudget > 0 ? String(request.estimatedBudget) : '',
        requestedAdvance: request.requestedAdvance > 0 ? String(request.requestedAdvance) : '',
        supportingNotes: request.supportingNotes || ''
      })
      setIsEditingExisting(
        !isSettled &&
          Boolean(
            (['Draft', 'Returned'].includes(request.status) && (isOwner || isHRorSuper)) ||
              (initialEditMode && canEditScheduleOrDetails)
          )
      )
      setCorrectionReason('')
    } else {
      setFormData({
        employeeId: currentUser?.employeeId || currentUser?.id || 'EMP-001',
        travelPurpose: '',
        clientProjectRef: '',
        destination: '',
        departureDate: '',
        departureTime: '08:00 AM',
        returnDate: '',
        returnTime: '08:00 PM',
        travelMode: 'Commercial Airline',
        accommodationRequired: true,
        estimatedBudget: '',
        requestedAdvance: '',
        supportingNotes: ''
      })
      setIsEditingExisting(false)
    }
    setErrorMsg('')
    setShowRejectBox(false)
  }, [request, isOpen, currentUser, isOwner, isHRorSuper])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleFormSubmit = async (asDraft = false, directApprove = false) => {
    setErrorMsg('')
    try {
      const hasDep = Boolean(formData.departureDate)
      const hasRet = Boolean(formData.returnDate)
      if (hasDep && hasRet && new Date(formData.departureDate) > new Date(formData.returnDate)) {
        throw new Error('Departure date cannot be after return date.')
      }

      const rawBudget = formData.estimatedBudget
      const hasBudget = rawBudget !== '' && rawBudget !== null && rawBudget !== undefined
      const numBudget = hasBudget ? Number(rawBudget) : 0
      const numAdvance = Number(formData.requestedAdvance || 0)

      if (hasBudget && (Number.isNaN(numBudget) || numBudget < 0)) {
        throw new Error('Estimated budget must be a valid non-negative amount.')
      }
      if (Number.isNaN(numAdvance) || numAdvance < 0) {
        throw new Error('Requested advance cannot be negative.')
      }
      if (hasBudget && numAdvance > numBudget) {
        throw new Error('Requested advance cannot exceed the estimated budget.')
      }

      // Full required-field validation ONLY on Submit / Direct Authorize (never on Save as Draft)
      if (!asDraft) {
        if (!formData.travelPurpose.trim() || formData.travelPurpose.trim().length < 3) {
          throw new Error('Travel purpose (minimum 3 characters) is required.')
        }
        if (!formData.destination.trim()) {
          throw new Error('Destination is required.')
        }
        if (!hasDep || !hasRet) {
          throw new Error('Both departure and return dates are required.')
        }
        if (!hasBudget || numBudget <= 0) {
          throw new Error('Estimated budget must be a positive amount.')
        }
      }

      const nextStatus = asDraft
        ? 'Draft'
        : directApprove && isSuperAdmin
          ? 'Approved'
          : isViewMode && !isDraftOrReturned && request?.status
            ? request.status
            : 'Submitted'

      const payload = {
        ...formData,
        status: nextStatus
      }
      if (directApprove && isSuperAdmin && !asDraft && request?.status !== 'Approved') {
        payload.directApprove = true
      }
      if (isEditingExisting && request?.status === 'Approved') {
        payload.correctionReason = correctionReason.trim() || 'Authorized correction by Super Admin'
      }

      if (isViewMode && request?.requestId) {
        if (onUpdateRequest) {
          await onUpdateRequest(request.requestId, payload)
        } else {
          await onSubmitRequest({ ...payload, existingRequestId: request.requestId })
        }
      } else {
        await onSubmitRequest(payload)
      }
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleApproveAction = async () => {
    if (onApprove && request) {
      setErrorMsg('')
      try {
        await onApprove(request)
      } catch (err) {
        setErrorMsg(err.message)
      }
    }
  }

  const handleRejectAction = async () => {
    if (!rejectReason.trim()) {
      setErrorMsg('Please specify a rejection reason.')
      return
    }
    if (onReject && request) {
      setErrorMsg('')
      try {
        await onReject(request, rejectReason.trim())
      } catch (err) {
        setErrorMsg(err.message)
      }
    }
  }

  const canApprove =
    isViewMode &&
    (isSuperAdmin || !isOwner) &&
    (isSuperAdmin
      ? ['Draft', 'Submitted', 'Under Review', 'Returned'].includes(request?.status)
      : ['Submitted', 'Under Review'].includes(request?.status)) &&
    (isSuperAdmin ||
      normalizedRole === 'hr_admin' ||
      (normalizedRole === 'manager' && request?.department === currentUser?.department))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name="plane" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isViewMode ? `Travel Request — ${request.requestId}` : 'New Official Travel Request'}
              </h3>
              <p className="text-xs text-slate-500">
                {isViewMode
                  ? `Status: ${request.status} • Field Duty Bridge: ${request.attendanceF04Ref || 'None'}`
                  : 'Save an incomplete draft anytime or fill all required fields (*) to submit.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEditScheduleOrDetails && !isDraftOrReturned && (
              <button
                type="button"
                onClick={() => setIsEditingExisting((prev) => !prev)}
                className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                {isEditingExisting ? 'Cancel Edit' : request?.status === 'Approved' ? 'Authorized Edit' : 'Edit Details'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <AppIcon name="close" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {isViewMode && isSettled && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-start gap-2">
              <AppIcon name="lock" className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <div>
                <div className="font-semibold">Financially Settled — Read-Only Record</div>
                <div>
                  Historical settlement snapshots are preserved; settled travel requests cannot be altered.
                </div>
              </div>
            </div>
          )}

          {isEditingExisting && request?.status === 'Approved' && !isSettled && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs rounded-xl space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <AppIcon name="edit" className="w-4 h-4 text-indigo-700" />
                Authorized Correction on Approved Travel Request
              </div>
              <p className="text-[11px] text-indigo-800">
                Original approval attribution and historical snapshots remain preserved in the audit log.
                {isFinancialSnapshotLocked
                  ? ' Budget & advance amounts are locked because an advance has already been disbursed or reconciled.'
                  : ''}
              </p>
              <input
                type="text"
                placeholder="Reason for authorized correction (logged to audit trail)..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full text-xs bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {isViewMode && (request?.hasConflict || request?.conflictMessage) && (
            <div className={`p-3 border text-xs rounded-xl flex items-start gap-2 ${
              request.hasConflict
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <AppIcon name="alertTriangle" className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">
                  {request.hasConflict ? 'Schedule Conflict Detected' : 'Schedule Notice'}
                </div>
                <div>{request.conflictMessage}</div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AppIcon name="alertCircle" className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Employee Selector */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Traveling Employee
              </label>
              {isViewMode ? (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800">
                  {request.employeeName} ({request.employeeId}) • Department: {request.department}
                </div>
              ) : isHRorSuper ? (
                <select
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                >
                  {employees.map((e) => (
                    <option key={e.employeeId || e.id} value={e.employeeId || e.id}>
                      {e.name} ({e.employeeId || e.id}) - {e.department} ({e.designation})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800">
                  {currentUser?.name} ({currentUser?.employeeId || currentUser?.id}) — {currentUser?.department}
                </div>
              )}
            </div>

            {/* Travel Purpose */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Travel Purpose / Business Justification *
              </label>
              <input
                type="text"
                name="travelPurpose"
                disabled={fieldsDisabled}
                placeholder="e.g. Client Architecture Review & On-site Deployment"
                value={formData.travelPurpose}
                onChange={handleChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
              />
            </div>

            {/* Destination & Client Reference */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination (City, Country) *
              </label>
              <input
                type="text"
                name="destination"
                disabled={fieldsDisabled}
                placeholder="e.g. Hyderabad, Pakistan"
                value={formData.destination}
                onChange={handleChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client / Project Reference
              </label>
              <input
                type="text"
                name="clientProjectRef"
                disabled={fieldsDisabled}
                placeholder="e.g. PRJ-FINTECH-09"
                value={formData.clientProjectRef}
                onChange={handleChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
              />
            </div>

            {/* Dates & Times */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Departure Date & Time *
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  name="departureDate"
                  disabled={fieldsDisabled}
                  value={formData.departureDate}
                  onChange={handleChange}
                  className="w-2/3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
                />
                <input
                  type="text"
                  name="departureTime"
                  disabled={fieldsDisabled}
                  value={formData.departureTime}
                  onChange={handleChange}
                  className="w-1/3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Date & Time *
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  name="returnDate"
                  disabled={fieldsDisabled}
                  value={formData.returnDate}
                  onChange={handleChange}
                  className="w-2/3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
                />
                <input
                  type="text"
                  name="returnTime"
                  disabled={fieldsDisabled}
                  value={formData.returnTime}
                  onChange={handleChange}
                  className="w-1/3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
                />
              </div>
            </div>

            {/* Mode & Accommodation */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Travel Mode
              </label>
              <select
                name="travelMode"
                disabled={fieldsDisabled}
                value={formData.travelMode}
                onChange={handleChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
              >
                <option value="Commercial Airline">Commercial Airline</option>
                <option value="Executive Train">Executive Train</option>
                <option value="Intercity AC Bus">Intercity AC Bus</option>
                <option value="Corporate Cab">Corporate Cab</option>
                <option value="Self / Rental Vehicle">Self / Rental Vehicle</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="accommodationRequired"
                  disabled={fieldsDisabled}
                  checked={formData.accommodationRequired}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                Hotel / Company Guest House Stay Required
              </label>
            </div>

            {/* Financials: Budget & Advance */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estimated Budget (PKR) * {isFinancialSnapshotLocked && <span className="text-[10px] text-amber-700 font-normal">(Locked)</span>}
              </label>
              <input
                type="number"
                name="estimatedBudget"
                disabled={fieldsDisabled || isFinancialSnapshotLocked}
                placeholder="e.g. 45000"
                value={formData.estimatedBudget}
                onChange={handleChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Requested Advance (PKR) {isFinancialSnapshotLocked && <span className="text-[10px] text-amber-700 font-normal">(Locked)</span>}
              </label>
              <input
                type="number"
                name="requestedAdvance"
                disabled={fieldsDisabled || isFinancialSnapshotLocked}
                placeholder="Optional, e.g. 20000"
                value={formData.requestedAdvance}
                onChange={handleChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supporting Notes & Justification
              </label>
              <textarea
                name="supportingNotes"
                disabled={fieldsDisabled}
                rows={2}
                placeholder="Provide itinerary notes, client contact or flight preferences..."
                value={formData.supportingNotes}
                onChange={handleChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
              />
            </div>
          </div>

          {/* View Mode: Approval History */}
          {isViewMode && request.approvalHistory && request.approvalHistory.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">
                Approval & Audit Trail
              </h4>
              <div className="space-y-2">
                {request.approvalHistory.map((h, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{h.action}</span> by{' '}
                      <span className="font-medium text-slate-700">{h.by}</span>
                      {h.remarks && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Remarks: {h.remarks}
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(h.at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejection input box if opened */}
          {showRejectBox && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-rose-800">
                Reason for Rejection *
              </label>
              <input
                type="text"
                placeholder="Enter policy or budget justification for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full text-xs bg-white border border-rose-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectBox(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectAction}
                  className="px-3 py-1 text-xs bg-rose-600 text-white rounded font-medium hover:bg-rose-700"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(!isViewMode || (isViewMode && isEditingExisting)) && (
              <>
                {(!isViewMode || isDraftOrReturned) && (
                  <button
                    type="button"
                    onClick={() => handleFormSubmit(true, false)}
                    className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    {isViewMode ? 'Save Draft' : 'Save as Draft'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleFormSubmit(false, false)}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                >
                  {isViewMode && !isDraftOrReturned ? 'Save Changes' : 'Submit Travel Request'}
                </button>
                {isSuperAdmin && (!isViewMode || isDraftOrReturned) && (
                  <button
                    type="button"
                    onClick={() => handleFormSubmit(false, true)}
                    className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                  >
                    {isViewMode ? 'Authorize Directly' : 'Create & Authorize Directly'}
                  </button>
                )}
              </>
            )}

            {isViewMode && canApprove && !isEditingExisting && (
              <>
                {!showRejectBox && (
                  <button
                    type="button"
                    onClick={() => setShowRejectBox(true)}
                    className="px-3 py-2 text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleApproveAction}
                  className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                >
                  Approve Travel Request
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
