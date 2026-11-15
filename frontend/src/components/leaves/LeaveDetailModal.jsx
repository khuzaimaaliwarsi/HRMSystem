import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/utils'

export function LeaveDetailModal({
  isOpen,
  onClose,
  request,
  currentUser = null,
  currentUserId = 'EMP-001',
  currentUserRole = 'super_admin',
  onApprove,
  onReject,
  onReturn,
  onWithdraw,
  onCancelApproved
}) {
  const [rejectMode, setRejectMode] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  if (!isOpen || !request) return null

  const effectiveUserId = currentUser?.employeeId || currentUser?.id || currentUserId
  const effectiveUserRole = String(currentUser?.role || currentUserRole || '').toLowerCase()
  const isSuperAdmin = effectiveUserRole === 'super_admin'

  // Check if current user is the applicant
  const isApplicant = effectiveUserId === request.employeeId

  // Check if current user can approve/reject this request
  const canAct = (() => {
    if (isApplicant && !isSuperAdmin) return false // Anti-self-approval rule for non-Super Admin roles!
    if (['Approved', 'Rejected', 'Cancelled', 'Withdrawn'].includes(request.status)) return false

    if (isSuperAdmin) return true
    if (effectiveUserRole === 'hr_admin') {
      return request.currentApproverTier === 'HR Admin' || request.currentApproverRole === 'HR Admin'
    }
    if (effectiveUserRole === 'manager') {
      return request.currentApproverTier === 'Manager' || request.currentApproverRole === 'Manager'
    }
    return false
  })()

  // Can applicant withdraw pending request?
  const canWithdraw = isApplicant && ['Submitted', 'Pending Manager Review', 'Pending HR Review', 'Pending Super Admin Review', 'Returned for Information'].includes(request.status)

  // Can applicant request cancellation of approved future leave?
  const canCancel = (isApplicant || effectiveUserRole === 'super_admin' || effectiveUserRole === 'hr_admin') && request.status === 'Approved'

  const handleApprove = async () => {
    setError(null)
    setProcessing(true)
    try {
      await onApprove?.(request.id, remarks)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to approve leave request.')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!remarks.trim()) {
      setError('Mandatory rejection remarks/justification are required.')
      return
    }
    setError(null)
    setProcessing(true)
    try {
      await onReject?.(request.id, remarks)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to reject leave request.')
    } finally {
      setProcessing(false)
    }
  }

  const handleReturn = async () => {
    if (!remarks.trim()) {
      setError('Please provide questions/clarifications needed before returning.')
      return
    }
    setError(null)
    setProcessing(true)
    try {
      await onReturn?.(request.id, remarks)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to return request for information.')
    } finally {
      setProcessing(false)
    }
  }

  const handleWithdraw = async () => {
    setError(null)
    setProcessing(true)
    try {
      await onWithdraw?.(request.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to withdraw request.')
    } finally {
      setProcessing(false)
    }
  }

  const handleCancelApproved = async () => {
    setError(null)
    setProcessing(true)
    try {
      await onCancelApproved?.(request.id, remarks || 'Cancelled by authorized user')
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to cancel approved leave.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl text-left overflow-hidden my-8 animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xs shadow-md shadow-blue-500/30">
              {request.leaveTypeCode || (request.leaveTypeName ? request.leaveTypeName.slice(0, 3).toUpperCase() : 'LV')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">{request.requestCode || request.id}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold border border-white/20">
                  {request.paidTreatment || (request.isPaid ? 'Paid' : 'Unpaid')}
                </span>
                <span className="text-[11px] font-medium text-blue-200">
                  {request.leaveTypeName || request.leaveType || 'Ops Leave'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {request.employeeName} ({request.employeeCode || request.employeeId}) {request.departmentName ? `• ${request.departmentName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Top Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
              <div className="mt-1">
                <StatusBadge status={request.status} />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Working Days</span>
              <span className="text-sm font-black text-blue-700 mt-1 block">
                {(() => {
                  const days = request.eligibleWorkingDays ?? request.calculatedDays ?? request.totalDays ?? request.durationDays ?? 1
                  return `${days} ${days === 1 ? 'day' : 'days'}`
                })()} {request.isHalfDay && `(${request.halfDayType || 'Half-Day'})`}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date Range</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block">
                {request.startDate} {request.startDate !== request.endDate && `to ${request.endDate}`}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Approver</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                {request.currentApproverName
                  ? `${request.currentApproverName} (${request.currentApproverRole || request.currentApproverTier || 'Team Lead'})`
                  : (request.currentApproverRole || request.currentApproverTier || 'Team Lead')}
              </span>
            </div>
          </div>

          {/* Reason & Details */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">Application Purpose</h4>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
              {request.reason}
            </div>
          </div>

          {/* Escalation Notice (If applicable) */}
          {request.escalatedDueTo && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <AppIcon name="warning" className="w-3.5 h-3.5 text-amber-600" />
                <span>Policy Escalation Note</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">{request.escalatedDueTo}</p>
            </div>
          )}

          {/* Approval Timeline Audit History */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              Approval Journey &amp; Audit Trail
            </h4>
            {(!request.approvalHistory || request.approvalHistory.length === 0) ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                No additional audit events recorded for this application.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {request.approvalHistory.map((step, idx) => {
                  const s = (step.status || '').toLowerCase()
                  const dotColor = s.includes('approved') ? "bg-emerald-500 ring-emerald-300" :
                    s.includes('rejected') ? "bg-rose-500 ring-rose-300" :
                    s.includes('cancelled') ? "bg-slate-500 ring-slate-300" :
                    s.includes('escalat') ? "bg-amber-500 ring-amber-300" :
                    s.includes('pending') ? "bg-amber-500 ring-amber-300" : "bg-blue-500 ring-blue-300"

                  return (
                    <div key={idx} className="relative">
                      <div className={cn(
                        "absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white ring-1",
                        dotColor
                      )} />
                      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{step.status}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{step.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium mt-0.5">By: {step.actor}</p>
                        {step.note && <p className="text-[11px] text-slate-500 mt-1 italic leading-relaxed">"{step.note}"</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Action Remarks Input (Shown if approving, rejecting, or returning) */}
          {(canAct || canCancel) && (
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Decision Remarks / Audit Comments {rejectMode && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={rejectMode ? "Explain the specific reason for declining this request..." : "Add optional comments for employee and HR ledger..."}
                className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Anti-Self-Approval Safeguard Notice (non-Super Admin only) */}
          {isApplicant && !isSuperAdmin && ['Pending Manager Review', 'Pending HR Review', 'Pending Super Admin Review'].includes(request.status) && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
              <AppIcon name="lock" className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                <strong>Anti-Self-Approval Guard:</strong> You are the applicant. This request must be decided by {request.currentApproverName || request.currentApproverRole}.
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            {canWithdraw && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleWithdraw}
                disabled={processing}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs"
              >
                Withdraw Application
              </Button>
            )}

            {canCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancelApproved}
                disabled={processing}
                className="text-amber-700 hover:bg-amber-50 text-xs"
              >
                Cancel Approved Leave (Reverse Ledger)
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={processing}>
              Close
            </Button>

            {canAct && !rejectMode && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectMode(true)}
                  disabled={processing}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  Decline...
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReturn}
                  disabled={processing}
                  className="text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  Return for Info
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleApprove}
                  disabled={processing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {processing ? 'Processing...' : 'Approve Leave'}
                </Button>
              </>
            )}

            {canAct && rejectMode && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRejectMode(false)}
                  disabled={processing}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleReject}
                  disabled={processing || !remarks.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  {processing ? 'Processing...' : 'Confirm Decline'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeaveDetailModal
