import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import Alert from '@/components/common/Alert'
import { leaveService } from '@/services/leaveService'
import { leaveBalanceService } from '@/services/leaveBalanceService'
import { leavePolicyService } from '@/services/leavePolicyService'
import { employeeService } from '@/services/employeeService'
import { cn } from '@/lib/utils'

export function LeaveRequestModal({
  isOpen,
  onClose,
  onSuccess,
  currentUserId = 'EMP-005',
  currentUser = null,
  allowedEmployees = null,
  onSubmit = null
}) {
  const effectiveUserId = currentUser?.employeeId || currentUser?.id || currentUserId
  const [employeeId, setEmployeeId] = useState(effectiveUserId)
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [dynamicTypes, setDynamicTypes] = useState([])
  const [entitlementsRevision, setEntitlementsRevision] = useState(0)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [isHalfDay, setIsHalfDay] = useState(false)
  const [halfDayType, setHalfDayType] = useState('First-Half')
  const [useCustomDuration, setUseCustomDuration] = useState(false)
  const [customDays, setCustomDays] = useState('')
  const [reason, setReason] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const [prevUserId, setPrevUserId] = useState(effectiveUserId)
  if (effectiveUserId !== prevUserId) {
    setPrevUserId(effectiveUserId)
    setEmployeeId(effectiveUserId)
  }

  // Load Leave Types dynamically from PostgreSQL API on mount
  useEffect(() => {
    let mounted = true
    async function loadTypes() {
      try {
        const { apiClient } = await import('@/services/apiClient')
        const res = await apiClient.get('/leaves/types')
        const types = Array.isArray(res) ? res : (res?.data || [])
        if (mounted && Array.isArray(types) && types.length > 0) {
          leavePolicyService.setLeaveTypes(types)
          setDynamicTypes(types)
          setLeaveTypeId((prev) => (prev && types.some((t) => t.id === prev) ? prev : types[0].id))
        }
      } catch (err) {
        console.warn('[LeaveRequestModal] Failed to load dynamic leave types:', err)
      }
    }
    loadTypes()
    return () => { mounted = false }
  }, [isOpen])

  // Fetch actual PostgreSQL entitlements mapped by employeeId + leaveTypeId + calendarYear
  useEffect(() => {
    let mounted = true
    async function loadEntitlements() {
      if (!isOpen || !employeeId) return
      try {
        const data = await leaveBalanceService.fetchEmployeeEntitlementsAsync(employeeId)
        if (mounted && Array.isArray(data) && data.length > 0) {
          setEntitlementsRevision((prev) => prev + 1)
        }
      } catch (err) {
        console.warn('[LeaveRequestModal] Failed to load dynamic entitlements:', err)
      }
    }
    loadEntitlements()
    return () => { mounted = false }
  }, [isOpen, employeeId])

  // Get eligible leave types for selected employee
  const eligibleTypes = useMemo(() => {
    const policyTypes = leavePolicyService.getEligibleLeaveTypesForEmployee(employeeId)
    if (policyTypes && policyTypes.length > 0) return policyTypes
    if (dynamicTypes.length > 0) return dynamicTypes
    return leavePolicyService.getAllLeaveTypes() || []
  }, [employeeId, dynamicTypes])

  // Derive effective leave type
  const effectiveLeaveTypeId = useMemo(() => {
    if (leaveTypeId && eligibleTypes.some((t) => t.id === leaveTypeId || t.code === leaveTypeId)) {
      return leaveTypeId
    }
    const realType = eligibleTypes.find((t) => !t.id.startsWith('LT-'))
    return realType ? realType.id : (eligibleTypes[0]?.id || '')
  }, [leaveTypeId, eligibleTypes])

  // Calculate real-time shift-aware working duration (Excludes weekly offs & holidays)
  const duration = useMemo(() => {
    return leaveService.calculateLeaveDuration(
      employeeId,
      startDate,
      isHalfDay ? startDate : endDate,
      isHalfDay
    )
  }, [employeeId, startDate, endDate, isHalfDay])

  // Get current authoritative balance from PostgreSQL mapped ledger
  const currentBalance = useMemo(() => {
    if (!effectiveLeaveTypeId) return null
    return leaveBalanceService.getEmployeeBalanceForType(employeeId, effectiveLeaveTypeId)
  }, [employeeId, effectiveLeaveTypeId, entitlementsRevision])

  const selectedTypeObj = useMemo(() => {
    return eligibleTypes.find((t) => t.id === effectiveLeaveTypeId) || null
  }, [eligibleTypes, effectiveLeaveTypeId])

  // Working days to deduct (allows optional custom override)
  const requestedWorkingDays = useMemo(() => {
    if (useCustomDuration && Number(customDays) > 0) {
      return Math.round(Number(customDays) * 10) / 10
    }
    return duration.eligibleWorkingDays
  }, [useCustomDuration, customDays, duration.eligibleWorkingDays])

  // Evaluate projected approval authority
  const authorityPreview = useMemo(() => {
    try {
      const allRequests = leaveService.getLeaveRequests()
      return leavePolicyService.evaluateApprovalAuthority(
        employeeId,
        requestedWorkingDays,
        allRequests,
        startDate
      )
    } catch {
      return null
    }
  }, [employeeId, requestedWorkingDays, startDate])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!effectiveLeaveTypeId) {
      setError('Please select a valid Leave Type from the dropdown.')
      return
    }

    if (requestedWorkingDays <= 0) {
      setError('Selected dates result in 0 working days to deduct. Please adjust dates or specify custom days.')
      return
    }

    setSubmitting(true)

    try {
      let resolvedTypeId = effectiveLeaveTypeId
      if (resolvedTypeId.startsWith('LT-')) {
        const match = dynamicTypes.find(
          (d) => d.code === selectedTypeObj?.code || d.name?.toLowerCase() === selectedTypeObj?.name?.toLowerCase()
        )
        if (match?.id) resolvedTypeId = match.id
      }

      const payload = {
        employeeId,
        leaveTypeId: resolvedTypeId,
        startDate,
        endDate: isHalfDay ? startDate : endDate,
        durationDays: requestedWorkingDays,
        isHalfDay,
        halfDayType: isHalfDay ? halfDayType : null,
        reason,
        attachmentUrl: attachmentUrl || null
      }

      let created = null
      if (onSubmit) {
        created = await onSubmit(payload)
      } else {
        const actorEmployee = employeeService.getEmployeeById(effectiveUserId)
        const actorName = actorEmployee ? actorEmployee.name : 'Authorized User'
        created = await leaveService.applyLeaveAsync(payload, actorName)
      }

      // Re-fetch entitlements to reflect updated pending days immediately
      await leaveBalanceService.fetchEmployeeEntitlementsAsync(employeeId).catch(() => {})

      onSuccess?.(created)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to submit leave request.')
    } finally {
      setSubmitting(false)
    }
  }

  const available = currentBalance
    ? Number(currentBalance.availableBalance)
    : Number(selectedTypeObj?.defaultDaysPerYear ?? selectedTypeObj?.annualEntitlement ?? 10)
  const pending = currentBalance
    ? Number(currentBalance.pending ?? currentBalance.pendingDays ?? 0)
    : 0
  const projectedRemaining = selectedTypeObj?.paidTreatment === 'Unpaid'
    ? available
    : Math.max(0, Math.round((available - requestedWorkingDays) * 10) / 10)

  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-start pt-6 sm:pt-10 pb-10">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 text-left overflow-hidden flex flex-col max-h-[calc(100vh-4rem)] animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Header - Fixed Top Bar, Always Fully Visible */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-[#102746] text-white flex items-center justify-between shrink-0 border-b border-slate-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30">
              <AppIcon name="calendar" className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Apply for Leave</h3>
              <p className="text-xs text-slate-300">Submit a policy-compliant leave request</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <Alert variant="danger" title="Validation Failed" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Employee Selector (Only shown if applying for others, e.g. HR Admin) */}
            {allowedEmployees && allowedEmployees.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Staff Member
                </label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="">Select Staff Member...</option>
                  {allowedEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.id} • {emp.department})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Leave Type Selector: Required Functional Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Leave Type <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={effectiveLeaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              >
                <option value="">Select Leave Type...</option>
                {eligibleTypes.map((type) => {
                  const bal = leaveBalanceService.getEmployeeBalanceForType(employeeId, type.id)
                  const balAvail = bal ? Number(bal.availableBalance) : Number(type.defaultDaysPerYear ?? type.annualEntitlement ?? 10)
                  return (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.code || type.id.slice(-6)}) — {balAvail}d available ({type.paidTreatment || (type.isPaid ? 'Paid' : 'Unpaid')})
                    </option>
                  )
                })}
              </select>

              {/* Quick-select options with balance badges */}
              {eligibleTypes.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {eligibleTypes.map((type) => {
                    const bal = leaveBalanceService.getEmployeeBalanceForType(employeeId, type.id)
                    const isSelected = effectiveLeaveTypeId === type.id
                    const balAvail = bal ? Number(bal.availableBalance) : Number(type.defaultDaysPerYear ?? type.annualEntitlement ?? 10)
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setLeaveTypeId(type.id)}
                        className={cn(
                          "p-2 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer",
                          isSelected
                            ? "border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        <span className="text-xs font-bold text-slate-900 truncate">{type.name}</span>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                          <span className="text-[10px] text-slate-500 font-medium">{type.paidTreatment || (type.isPaid ? 'Paid' : 'Unpaid')}</span>
                          <span className="text-xs font-extrabold text-blue-700">
                            {balAvail}d left
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Date Range Selection & Half-Day Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (new Date(e.target.value) > new Date(endDate)) {
                      setEndDate(e.target.value)
                    }
                  }}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={isHalfDay ? startDate : endDate}
                  disabled={isHalfDay}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className={cn(
                    "w-full text-xs rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500",
                    isHalfDay && "opacity-50 cursor-not-allowed bg-slate-100"
                  )}
                  required
                />
              </div>
            </div>

            {/* Half Day Option */}
            {selectedTypeObj?.halfDayEligible && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isHalfDay}
                    onChange={(e) => setIsHalfDay(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Half-Day Leave (0.5 Day)</span>
                </label>

                {isHalfDay && (
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="halfDayType"
                        value="First-Half"
                        checked={halfDayType === 'First-Half'}
                        onChange={() => setHalfDayType('First-Half')}
                        className="text-blue-600"
                      />
                      <span>1st Half (Morning)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="halfDayType"
                        value="Second-Half"
                        checked={halfDayType === 'Second-Half'}
                        onChange={() => setHalfDayType('Second-Half')}
                        className="text-blue-600"
                      />
                      <span>2nd Half (Afternoon)</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Custom Working Days Option */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={useCustomDuration}
                    onChange={(e) => {
                      setUseCustomDuration(e.target.checked)
                      if (!e.target.checked) setCustomDays('')
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Enter Custom Working Days (Manual Duration Override)</span>
                </label>
              </div>
              {useCustomDuration && (
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max={available || 30}
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder={`e.g. ${duration.eligibleWorkingDays}`}
                    className="w-36 text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <span className="text-[11px] text-slate-500 italic">
                    Overrides calendar calculation ({duration.eligibleWorkingDays} working day(s) calculated)
                  </span>
                </div>
              )}
            </div>

            {/* Working-Day Calculation Badge & Calendar Reconciliation */}
            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-left space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>Working Days to Deduct:</span>
                <span className="text-sm font-black text-blue-700">
                  {requestedWorkingDays} working day(s)
                </span>
              </div>

              <div className="text-[11px] text-slate-600 flex items-center justify-between">
                <span>Calendar Span: {duration.calendarDays} day(s)</span>
                {(duration?.excludedDates || []).length > 0 && !useCustomDuration && (
                  <span className="text-emerald-700 font-semibold">
                    ✓ {(duration?.excludedDates || []).length} weekend/holiday days excluded
                  </span>
                )}
              </div>

              {/* Authority & Escalation Notice */}
              {authorityPreview && (
                <div className="pt-2 border-t border-blue-200/60 text-[11px] flex items-center justify-between">
                  <span className="text-slate-600">Approval Route:</span>
                  <span className={cn("font-bold", authorityPreview.isEscalated ? "text-amber-700" : "text-blue-700")}>
                    {authorityPreview.isEscalated ? `⚠️ Escalates to ${authorityPreview.currentApproverRole}` : `✓ ${authorityPreview.currentApproverName}`}
                  </span>
                </div>
              )}

              {authorityPreview?.isEscalated && (
                <p className="text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 leading-tight">
                  <strong>Policy Escalation Notice:</strong> {authorityPreview.escalationReason}
                </p>
              )}

              {/* Authoritative PostgreSQL Balance Projection Card */}
              <div className="pt-2 text-xs text-slate-700 grid grid-cols-3 gap-2 border-t border-blue-200/60 bg-white/70 p-2.5 rounded-lg text-center sm:text-left">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Available Balance</span>
                  <span className="font-extrabold text-blue-800 font-mono text-sm">{available}d</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Pending Requests</span>
                  <span className="font-bold text-amber-700 font-mono text-sm">{pending}d</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Projected Closing</span>
                  <strong className="text-slate-900 font-extrabold font-mono text-sm">{projectedRemaining}d</strong>
                </div>
              </div>
            </div>

            {/* Managerial Anti-Self-Approval & Upward Escalation Banner */}
            {(currentUser?.role === 'manager' || currentUser?.role === 'super_admin' || employeeId === 'EMP-003' || employeeId === 'EMP-001') && (
              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-xs text-amber-800 flex items-start gap-2">
                <AppIcon name="shield" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold">Managerial Routing Notice:</span> Under enterprise governance rules, supervisors cannot approve their own leaves. This request will automatically route upward to HR Administration / Super Admin for review.
                </div>
              </div>
            )}

            {/* Reason Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason &amp; Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State the purpose and work coverage arrangements during your leave..."
                className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Medical Certificate / Attachment for Sick Leave */}
            {selectedTypeObj?.requiresDocumentation && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Medical Certificate / Document URL
                </label>
                <input
                  type="text"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://isysware.documents/medical-certificate.pdf"
                  className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-500">
                  Required for sick leave exceeding {selectedTypeObj.docThresholdDays || 2} days.
                </span>
              </div>
            )}
          </div>

          {/* Actions - Sticky Footer, Always Visible */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !effectiveLeaveTypeId || requestedWorkingDays <= 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}

export default LeaveRequestModal
