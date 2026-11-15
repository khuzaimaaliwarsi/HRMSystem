import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function PickAndDropRosterTable({
  assignments = [],
  currentUser = null,
  onEditAssignment,
  onApprove,
  onSuspend,
  onCancel,
  onActivate
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [routeFilter, setRouteFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const isHRorSuper =
    currentUser?.role === 'super_admin' || currentUser?.role === 'hr_admin'

  const canEditAssignment = (asn) => {
    if (!currentUser || !['Pending Approval', 'Active', 'Suspended'].includes(asn.status)) return false
    if (isHRorSuper) return true
    const actorId = currentUser.employeeId || currentUser.id
    return asn.employeeId === actorId && asn.status === 'Pending Approval'
  }

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase()
    switch (s) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'pending approval':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'suspended':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  // Extract distinct route names for filtering
  const distinctRoutes = Array.from(new Set(assignments.map((a) => a.routeName).filter(Boolean)))

  const filteredAssignments = assignments.filter((a) => {
    const matchesSearch =
      a.assignmentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.pickupPoint?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.routeName?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRoute = routeFilter === 'all' || a.routeName === routeFilter
    const matchesStatus =
      statusFilter === 'all' || a.status?.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesRoute && matchesStatus
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <AppIcon
              name="search"
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder="Search employee, route, pickup..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-60 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Routes</option>
            {distinctRoutes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending approval">Pending Approval</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredAssignments.length} of {assignments.length} assignments
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Assignment ID</th>
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-4">Route & Boarding Point</th>
              <th className="py-3 px-4">Morning Pick / Evening Drop</th>
              <th className="py-3 px-4">Facility Type & Contribution</th>
              <th className="py-3 px-4">Effective Date</th>
              <th className="py-3 px-4">Status</th>
              {(isHRorSuper || (onEditAssignment && assignments.some(canEditAssignment))) && (
                <th className="py-3 px-4 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssignments.length === 0 ? (
              <tr>
                <td
                  colSpan={isHRorSuper || (onEditAssignment && assignments.some(canEditAssignment)) ? 8 : 7}
                  className="py-8 text-center text-slate-400"
                >
                  <AppIcon name="bus" className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No pick-and-drop assignments found.
                </td>
              </tr>
            ) : (
              filteredAssignments.map((asn) => (
                <tr key={asn.assignmentId || asn.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">
                    {asn.assignmentId}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{asn.employeeName}</div>
                    <div className="text-[11px] text-slate-500">
                      {asn.employeeId} • {asn.department}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{asn.routeName}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <AppIcon name="location" className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{asn.pickupPoint}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 font-medium">{asn.pickupTime}</div>
                    <div className="text-[11px] text-slate-500">Drop: {asn.dropTime}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 font-medium">{asn.facilityType}</div>
                    <div className="text-[11px] text-slate-500">
                      {asn.monthlyContribution > 0
                        ? `Rs. ${asn.monthlyContribution.toLocaleString()}/mo`
                        : 'Fully Subsidized'}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {asn.effectiveFrom || 'Immediate'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(
                        asn.status
                      )}`}
                    >
                      {asn.status}
                    </span>
                  </td>
                  {(isHRorSuper || (onEditAssignment && assignments.some(canEditAssignment))) && (
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEditAssignment && canEditAssignment(asn) && (
                          <button
                            onClick={() => onEditAssignment(asn)}
                            title="Edit Pick-and-Drop Assignment"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <AppIcon name="edit" className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isHRorSuper && asn.status === 'Pending Approval' && (
                          <button
                            onClick={() => onApprove && onApprove(asn.assignmentId)}
                            title="Approve Assignment"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <AppIcon name="check" className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isHRorSuper && asn.status === 'Active' && (
                          <button
                            onClick={() => onSuspend && onSuspend(asn.assignmentId)}
                            title="Suspend Facility"
                            className="px-2 py-1 text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded"
                          >
                            Suspend
                          </button>
                        )}
                        {isHRorSuper && asn.status === 'Suspended' && (
                          <button
                            onClick={() => onActivate && onActivate(asn.assignmentId)}
                            title="Reactivate Facility"
                            className="px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded"
                          >
                            Activate
                          </button>
                        )}
                        {isHRorSuper && ['Active', 'Pending Approval', 'Suspended'].includes(asn.status) && (
                          <button
                            onClick={() => onCancel && onCancel(asn.assignmentId)}
                            title="Cancel Assignment"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <AppIcon name="trash" className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
