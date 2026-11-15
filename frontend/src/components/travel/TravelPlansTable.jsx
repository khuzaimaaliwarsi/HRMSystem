import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TravelPlansTable({
  plans = [],
  currentUser = null,
  onUpdateStatus,
  onViewPlan,
  onEditPlan
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase()
    switch (s) {
      case 'planned':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'in progress':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const filteredPlans = plans.filter((p) => {
    const matchesSearch =
      p.planId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.requestId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.bookingReference?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || p.status?.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const normalizedRole = String(currentUser?.role || '').toLowerCase()
  const isCoordinator =
    normalizedRole === 'super_admin' || normalizedRole === 'hr_admin'

  const getYmd = (val) => {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(val || '').trim())
    return m ? m[1] : null
  }
  const now = new Date()
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Search and Filters */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <AppIcon
              name="search"
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder="Search plan ID, PNR, destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Plan Statuses</option>
            <option value="planned">Planned</option>
            <option value="in progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredPlans.length} of {plans.length} itineraries
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Plan & Request ID</th>
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-4">Destination & Transport</th>
              <th className="py-3 px-4">Departure / Return</th>
              <th className="py-3 px-4">Booking Ref / PNR</th>
              <th className="py-3 px-4">Confirmed Cost</th>
              <th className="py-3 px-4">Status</th>
              {isCoordinator && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPlans.length === 0 ? (
              <tr>
                <td colSpan={isCoordinator ? 8 : 7} className="py-8 text-center text-slate-400">
                  <AppIcon name="calendar" className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No confirmed travel plans found.
                </td>
              </tr>
            ) : (
              filteredPlans.map((plan) => (
                <tr key={plan.planId || plan.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-medium text-slate-900">{plan.planId}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{plan.requestId}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{plan.employeeName}</div>
                    <div className="text-[11px] text-slate-500">{plan.department}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{plan.destination}</div>
                    <div className="text-[11px] text-slate-500">
                      {plan.transportationType} • {plan.vendorReference}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 font-medium">{plan.departureSchedule}</div>
                    <div className="text-[11px] text-slate-500">Return: {plan.returnSchedule}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono font-semibold text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded inline-block">
                      {plan.bookingReference}
                    </div>
                    {plan.hotelReference && (
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                        Hotel: {plan.hotelReference}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    Rs. {(plan.confirmedCost || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(
                        plan.status
                      )}`}
                    >
                      {plan.status}
                    </span>
                  </td>
                  {isCoordinator && (
                    <td className="py-3 px-4 text-right">
                      {(() => {
                        const depYmd = getYmd(plan.departureDate || plan.departureSchedule)
                        const retYmd = getYmd(plan.returnDate || plan.returnSchedule)
                        const canStart = !depYmd || todayYmd >= depYmd
                        const canComplete = !retYmd || todayYmd >= retYmd
                        return (
                          <div className="flex items-center justify-end gap-1.5">
                            {plan.status === 'Planned' && (
                              <button
                                disabled={!canStart}
                                onClick={() => onUpdateStatus && onUpdateStatus(plan.planId, 'In Progress')}
                                title={canStart ? 'Mark travel plan In Progress' : `Cannot start before departure date (${depYmd})`}
                                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                                  canStart
                                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                Mark In Transit
                              </button>
                            )}
                            {plan.status === 'In Progress' && (
                              <button
                                disabled={!canComplete}
                                onClick={() => onUpdateStatus && onUpdateStatus(plan.planId, 'Completed')}
                                title={canComplete ? 'Complete travel plan' : `Cannot complete before return date (${retYmd})`}
                                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                                  canComplete
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                Complete Trip
                              </button>
                            )}
                            {onViewPlan && (
                              <button
                                onClick={() => onViewPlan(plan)}
                                title="View Itinerary Details"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                <AppIcon name="eye" className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onEditPlan && !['Completed', 'Cancelled'].includes(plan.status) && (
                              <button
                                onClick={() => onEditPlan(plan)}
                                title="Edit Travel Plan"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              >
                                <AppIcon name="edit" className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      })()}
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
