import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TravelRequestsTable({
  requests = [],
  currentUser = null,
  onViewDetails,
  onEditRequest,
  onApprove,
  onReject,
  onCancel,
  onCreatePlan,
  onManageExpenses
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase()
    switch (s) {
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'submitted':
      case 'under review':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'planned':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'in progress':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      case 'completed':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'rejected':
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'draft':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.requestId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.travelPurpose?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || r.status?.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  // Role checks for permissions
  const normalizedRole = String(currentUser?.role || '').toLowerCase()
  const isSuperAdmin = normalizedRole === 'super_admin'

  const canApprove = (req) => {
    if (!currentUser) return false
    if (isSuperAdmin) return true

    const isOwner =
      req.employeeId === (currentUser.employeeId || currentUser.id) ||
      (req.employeeCuid && req.employeeCuid === currentUser.employeeId)
    if (isOwner) return false // Anti-self-approval rule for non-Super Admin roles

    if (normalizedRole === 'hr_admin') return true
    if (normalizedRole === 'manager' && req.department === currentUser.department) {
      return req.status === 'Submitted'
    }
    return false
  }

  const canCancel = (req) => {
    if (!currentUser) return false
    const isOwner =
      req.employeeId === (currentUser.employeeId || currentUser.id) ||
      (req.employeeCuid && req.employeeCuid === currentUser.employeeId)
    const isHrOrSuper =
      normalizedRole === 'super_admin' || normalizedRole === 'hr_admin'
    return (
      (isOwner || isHrOrSuper) &&
      ['Draft', 'Submitted', 'Under Review'].includes(req.status)
    )
  }

  const canEdit = (req) => {
    if (!currentUser) return false
    if (req.isSettled || req.settlementStatus === 'Settled') return false
    const isOwner =
      req.employeeId === (currentUser.employeeId || currentUser.id) ||
      (req.employeeCuid && req.employeeCuid === currentUser.employeeId)
    if (isSuperAdmin) {
      return ['Draft', 'Returned', 'Submitted', 'Under Review', 'Approved'].includes(req.status)
    }
    if (normalizedRole === 'hr_admin') {
      return ['Draft', 'Returned', 'Submitted', 'Under Review'].includes(req.status)
    }
    return isOwner && ['Draft', 'Returned', 'Submitted'].includes(req.status)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <AppIcon
              name="search"
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder="Search requests, destination, employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="under review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {(filteredRequests || []).length} of {(requests || []).length} requests
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Request ID</th>
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-4">Destination & Purpose</th>
              <th className="py-3 px-4">Schedule</th>
              <th className="py-3 px-4">Mode / Stay</th>
              <th className="py-3 px-4">Budget / Advance</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(filteredRequests || []).length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-400">
                  <AppIcon name="plane" className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No travel requests found.
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => (
                <tr
                  key={req.requestId || req.id}
                  className={`transition-colors ${
                    req.hasConflict ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">
                    {req.requestId}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{req.employeeName}</div>
                    <div className="text-[11px] text-slate-500">
                      {req.employeeId} • {req.department}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">
                      {req.destination || <span className="italic text-slate-400">Destination TBD</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                      {req.travelPurpose || <span className="italic text-slate-400">Draft purpose TBD</span>}
                    </div>
                    {req.clientProjectRef && (
                      <span className="inline-block text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mt-0.5">
                        Ref: {req.clientProjectRef}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {req.departureDate && req.returnDate ? (
                      <>
                        <div className="text-slate-800 font-medium">
                          {req.departureDate} <span className="text-slate-400">to</span> {req.returnDate}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Dep: {req.departureTime} | Ret: {req.returnTime}
                        </div>
                      </>
                    ) : (
                      <span className="italic text-slate-400 text-[11px]">Dates TBD</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-700 font-medium">{req.travelMode}</div>
                    <div className="text-[11px] text-slate-500">
                      {req.accommodationRequired ? 'Hotel Required' : 'No Stay'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">
                      {req.estimatedBudget > 0 ? (
                        `Rs. ${req.estimatedBudget.toLocaleString()}`
                      ) : (
                        <span className="italic font-normal text-slate-400">Budget TBD</span>
                      )}
                    </div>
                    {req.requestedAdvance > 0 && (
                      <div className="text-[11px] text-purple-700 font-medium">
                        Adv: Rs. {req.requestedAdvance.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col items-start gap-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(
                          req.status
                        )}`}
                      >
                        {req.status}
                      </span>
                      {req.hasConflict && (
                        <span
                          title={req.conflictMessage || 'Overlapping travel dates'}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300"
                        >
                          <AppIcon name="alertTriangle" className="w-3 h-3" />
                          Conflict: {(req.conflictWithCodes || []).join(', ')}
                        </span>
                      )}
                      {!req.hasConflict && req.overlappingDraftCodes?.length > 0 && (
                        <span
                          title={req.conflictMessage || 'Overlapping draft'}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          Draft Overlap: {req.overlappingDraftCodes.join(', ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onViewDetails && onViewDetails(req)}
                        title="View Full Details"
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <AppIcon name="eye" className="w-3.5 h-3.5" />
                      </button>

                      {canEdit(req) ? (
                        <button
                          onClick={() => (onEditRequest ? onEditRequest(req) : onViewDetails && onViewDetails(req))}
                          title={req.status === 'Approved' ? 'Authorized Edit / Correction' : 'Edit Travel Request'}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        >
                          <AppIcon name="edit" className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        req.status === 'Approved' &&
                        (req.isSettled || req.settlementStatus === 'Settled') &&
                        (isSuperAdmin || normalizedRole === 'hr_admin') && (
                          <button
                            type="button"
                            disabled
                            title="Locked: Settled travel records cannot be edited"
                            className="p-1.5 text-slate-300 cursor-not-allowed rounded"
                          >
                            <AppIcon name="edit" className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}

                      {canApprove(req) &&
                        (isSuperAdmin
                          ? ['Draft', 'Submitted', 'Under Review', 'Returned'].includes(req.status)
                          : ['Submitted', 'Under Review'].includes(req.status)) && (
                        <>
                          <button
                            onClick={() => Promise.resolve(onApprove && onApprove(req)).catch(() => {})}
                            title="Approve Travel Request"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          >
                            <AppIcon name="check" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onReject && onReject(req)}
                            title="Reject Travel Request"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <AppIcon name="xmark" className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {req.status === 'Approved' && (
                        <>
                          {(normalizedRole === 'super_admin' || normalizedRole === 'hr_admin') && (
                            <button
                              onClick={() => onCreatePlan && onCreatePlan(req)}
                              title="Generate Official Travel Plan"
                              className="px-2 py-1 text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors"
                            >
                              Plan Trip
                            </button>
                          )}
                          <button
                            onClick={() => onManageExpenses && onManageExpenses(req)}
                            title="Advance & Expenses"
                            className="px-2 py-1 text-[11px] font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 rounded transition-colors"
                          >
                            Expenses
                          </button>
                        </>
                      )}

                      {canCancel(req) && (
                        <button
                          onClick={() => onCancel && onCancel(req)}
                          title="Cancel Request"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        >
                          <AppIcon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
