import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import LeaveDetailModal from './LeaveDetailModal'
import { cn } from '@/lib/utils'

export function LeaveApprovalQueue({
  requests = [],
  currentUser = null,
  currentUserId = 'EMP-001',
  currentUserRole = 'super_admin',
  onApprove,
  onReject,
  onReturn,
  onCancelApproved,
  onViewDetails
}) {
  const effectiveUserId = currentUser?.employeeId || currentUser?.id || currentUserId
  const effectiveUserRole = currentUser?.role || currentUserRole

  const [selectedRequest, setSelectedRequest] = useState(null)
  const [rejectingRequest, setRejectingRequest] = useState(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [rejectError, setRejectError] = useState(null)

  // Filter pending requests awaiting review and sort sequentially by Request ID
  const pendingRequests = requests
    .filter((r) =>
      ['Pending Team Lead Review', 'Pending Manager Review', 'Pending HR Review', 'Pending Super Admin Review', 'Returned for Information'].includes(r.status) ||
      r.backendStatus === 'PENDING'
    )
    .sort((a, b) => {
      const idA = a.requestCode || a.id || ''
      const idB = b.requestCode || b.id || ''
      return idA.localeCompare(idB, undefined, { numeric: true })
    })

  const handleQuickApprove = (req) => {
    onApprove?.(req.id, 'Approved via Quick Review')
  }

  const handleConfirmReject = () => {
    if (!rejectRemarks.trim()) {
      setRejectError('Mandatory remarks are required to decline.')
      return
    }
    onReject?.(rejectingRequest.id, rejectRemarks.trim())
    setRejectingRequest(null)
    setRejectRemarks('')
    setRejectError(null)
  }

  if (pendingRequests.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 p-8 shadow-xs">
        <EmptyState
          icon="check"
          title="Leave Queue is Clear"
          description="There are currently no leave requests awaiting your review in this scope."
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden text-left">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs border border-amber-200">
            <AppIcon name="alerts" className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pending Review Queue</h3>
            <p className="text-xs text-slate-500">
              {pendingRequests.length} request(s) awaiting approval or policy verification
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Working Days</th>
              <th className="px-4 py-3">Authority Route</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pendingRequests.map((req) => {
              const normalizedRole = String(effectiveUserRole || '').toLowerCase()
              const isSuperAdmin = normalizedRole === 'super_admin'
              const isSelf = req.employeeId === effectiveUserId

              // Can user act on this request?
              const canAct = (() => {
                if (isSelf && !isSuperAdmin) return false
                if (isSuperAdmin) return true
                if (normalizedRole === 'hr_admin') {
                  return req.currentApproverTier === 'HR Admin' || req.currentApproverRole === 'HR Admin'
                }
                if (normalizedRole === 'manager') {
                  return req.currentApproverTier === 'Manager' || req.currentApproverRole === 'Manager'
                }
                if (normalizedRole === 'team_lead') {
                  return req.currentApproverTier === 'Team Lead' || req.currentApproverRole === 'Team Lead' || req.status === 'Pending Team Lead Review' || req.status === 'Pending Review'
                }
                return false
              })()

              return (
                <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Applicant */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{req.employeeName || 'Staff Member'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {req.requestCode || req.id} • {req.employeeCode || req.employeeId} {req.departmentName ? `• ${req.departmentName}` : ''}
                      </span>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">{req.leaveTypeName || req.leaveType || req.category || 'Ops Leave'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {req.paidTreatment || (req.isPaid ? 'Paid' : 'Unpaid')}
                      </span>
                    </div>
                  </td>

                  {/* Dates */}
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {req.startDate}
                    {req.startDate !== req.endDate && ` → ${req.endDate}`}
                  </td>

                  {/* Working Days */}
                  <td className="px-4 py-3">
                    <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {req.eligibleWorkingDays ?? req.calculatedDays ?? req.totalDays ?? req.durationDays ?? 1}d
                    </span>
                    {req.isHalfDay && (
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {req.halfDayType || 'Half-Day'}
                      </span>
                    )}
                  </td>

                  {/* Authority Route */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className={cn(
                        "font-semibold text-xs",
                        req.escalatedDueTo ? "text-amber-700" : "text-slate-800"
                      )}>
                        {req.currentApproverName
                          ? `${req.currentApproverName} (${req.currentApproverRole || req.currentApproverTier || 'Team Lead'})`
                          : (req.currentApproverRole || req.currentApproverTier || 'Team Lead')}
                      </span>
                      {req.escalatedDueTo && (
                        <span className="text-[9px] text-amber-600 font-medium truncate max-w-[150px]" title={req.escalationReason || req.escalatedDueTo}>
                          ⚠️ Escalated
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => (onViewDetails ? onViewDetails(req) : setSelectedRequest(req))}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                      >
                        Details
                      </Button>

                      {canAct && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectingRequest(req)
                              setRejectRemarks('')
                              setRejectError(null)
                            }}
                            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                          >
                            Decline
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => handleQuickApprove(req)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          >
                            Approve
                          </Button>
                        </>
                      )}

                      {isSelf && !isSuperAdmin ? (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                          Self Request
                        </span>
                      ) : (
                        !canAct && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            Awaiting {req.currentApproverRole || req.currentApproverTier || 'Team Lead'}
                          </span>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Leave Detail Modal */}
      {selectedRequest && (
        <LeaveDetailModal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          request={selectedRequest}
          currentUser={currentUser}
          currentUserId={effectiveUserId}
          currentUserRole={effectiveUserRole}
          onApprove={onApprove}
          onReject={onReject}
          onReturn={onReturn}
          onCancelApproved={onCancelApproved}
        />
      )}

      {/* Decline Reason Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 text-left animate-in fade-in-50 zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900">Decline Leave Request</h3>
            <p className="text-xs text-slate-500 mt-1">
              Provide justification for declining {rejectingRequest.employeeName}'s {rejectingRequest.leaveTypeName} ({rejectingRequest.id}).
            </p>

            {rejectError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {rejectError}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Decline Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="State the operational reason or conflict (e.g. Sprint release deadline, team coverage)..."
                className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRejectingRequest(null)
                  setRejectRemarks('')
                  setRejectError(null)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmReject}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Confirm Decline
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveApprovalQueue
