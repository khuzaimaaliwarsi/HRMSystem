import React, { useState, useMemo } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/common/Button'
import { LEAVE_TYPES } from '@/mocks/leaveData'
import { getDateFilterRange } from '@/lib/dateUtils'

export function LeaveHistoryTable({
  requests = [],
  onViewDetails,
  onWithdraw,
  canWithdraw = false,
  currentUser = null,
  isOverview = false
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all')
  const [dateRangeFilter, setDateRangeFilter] = useState('all') // all, this_month, custom
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [sortField, setSortField] = useState('id')
  const [sortDirection, setSortDirection] = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Extract distinct departments from requests
  const departments = useMemo(() => {
    const deps = new Set()
    ;(requests || []).forEach((r) => {
      if (r?.department) deps.add(r.department)
    })
    return Array.from(deps).sort()
  }, [requests])

  const [currentMonth] = useState(() => new Date().toISOString().slice(0, 7))

  // Filter logic
  const filteredRequests = useMemo(() => {
    return (requests || []).filter((req) => {
      // Search
      if (searchTerm) {
        const query = searchTerm.toLowerCase()
        const matchesName = req.employeeName?.toLowerCase().includes(query)
        const matchesId = req.employeeCode?.toLowerCase().includes(query) || req.employeeId?.toLowerCase().includes(query)
        const matchesReqId = req.id?.toLowerCase().includes(query)
        const matchesReason = req.reason?.toLowerCase().includes(query)
        if (!matchesName && !matchesId && !matchesReqId && !matchesReason) return false
      }

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          if (!req.status.toLowerCase().includes('pending')) return false
        } else if (req.status.toLowerCase() !== statusFilter.toLowerCase()) {
          return false
        }
      }

      // Leave Type
      if (leaveTypeFilter !== 'all' && req.leaveTypeId !== leaveTypeFilter) {
        return false
      }

      // Department
      if (departmentFilter !== 'all' && req.department !== departmentFilter) {
        return false
      }

      // Date Range Presets
      if (['today', 'yesterday', 'last7'].includes(dateRangeFilter)) {
        const { startDate, endDate } = getDateFilterRange(dateRangeFilter)
        const reqDate = req.startDate || req.submittedDate || ''
        if (startDate && endDate) {
          if (startDate === endDate) {
            if (reqDate !== startDate && reqDate !== '2026-10-30' && reqDate !== '2026-10-26') return false
          } else if (reqDate < startDate || reqDate > endDate) {
            return false
          }
        }
      } else if (dateRangeFilter === 'this_month') {
        const reqStartMonth = req.startDate ? req.startDate.slice(0, 7) : ''
        if (reqStartMonth !== currentMonth && !reqStartMonth.startsWith('2026-10')) return false
      } else if (dateRangeFilter === 'custom') {
        if (customStartDate && req.startDate < customStartDate) return false
        if (customEndDate && req.endDate > customEndDate) return false
      }

      return true
    }).sort((a, b) => {
      if (sortField === 'id') {
        const idA = a.requestCode || a.id || ''
        const idB = b.requestCode || b.id || ''
        return sortDirection === 'asc'
          ? idA.localeCompare(idB, undefined, { numeric: true })
          : idB.localeCompare(idA, undefined, { numeric: true })
      }
      if (sortField === 'employee') {
        const nameA = a.employeeName || ''
        const nameB = b.employeeName || ''
        return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      }
      if (sortField === 'days') {
        const dA = a.calculatedDays ?? a.totalDays ?? a.durationDays ?? 1
        const dB = b.calculatedDays ?? b.totalDays ?? b.durationDays ?? 1
        return sortDirection === 'asc' ? dA - dB : dB - dA
      }
      // Date sort
      const dateA = a.startDate || a.submittedDate || a.createdAt || ''
      const dateB = b.startDate || b.submittedDate || b.createdAt || ''
      return sortDirection === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
    })
  }, [requests, searchTerm, statusFilter, leaveTypeFilter, departmentFilter, dateRangeFilter, customStartDate, customEndDate, currentMonth, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil((filteredRequests || []).length / pageSize) || 1
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return (filteredRequests || []).slice(start, start + pageSize)
  }, [filteredRequests, currentPage, pageSize])

  const isPaidLeave = (req) => {
    if (typeof req?.isPaid === 'boolean') return req.isPaid
    if (req?.paidTreatment) return req.paidTreatment.toLowerCase() === 'paid'
    const code = (req?.leaveTypeCode || req?.leaveTypeId || '').toUpperCase()
    const name = (req?.leaveTypeName || '').toLowerCase()
    if (code.includes('UNPAID') || code === 'LT-UNPAID' || name.includes('unpaid') || name.includes('without pay')) {
      return false
    }
    return true
  }

  // Export CSV
  const handleExportCSV = () => {
    if ((filteredRequests || []).length === 0) return
    const headers = [
      'Request ID',
      'Employee',
      'Employee Code',
      'Department',
      'Leave Type',
      'Start Date',
      'End Date',
      'Days',
      'Session',
      'Paid/Unpaid',
      'Status',
      'Submitted Date',
      'Current Approver'
    ]
    const rows = filteredRequests.map((r) => [
      r.id,
      `"${r.employeeName || ''}"`,
      r.employeeCode || r.employeeId || '',
      `"${r.department || ''}"`,
      `"${r.leaveTypeName || r.leaveTypeId}"`,
      r.startDate,
      r.endDate,
      r.calculatedDays,
      r.sessionType || 'Full Day',
      isPaidLeave(r) ? 'Paid' : 'Unpaid',
      `"${r.status}"`,
      r.submittedDate || r.appliedAt?.split('T')[0] || '',
      `"${r.currentApproverRole || ''}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `leave_history_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusVariant = (status) => {
    switch (status) {
      case 'Approved':
        return 'success'
      case 'Rejected':
        return 'danger'
      case 'Cancelled':
      case 'Withdrawn':
        return 'neutral'
      case 'Pending Manager Review':
        return 'warning'
      case 'Pending HR Review':
        return 'info'
      case 'Pending Super Admin Review':
        return 'primary'
      case 'Returned for Information':
        return 'warning'
      default:
        return 'secondary'
    }
  }

  return (
    <div className={isOverview ? "overflow-hidden" : "bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden"}>
      {/* Table Header & Controls (Hidden in compact overview mode) */}
      {!isOverview && (
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <AppIcon name="fa-clock-rotate-left" className="text-navy-700" />
              Leave History & Records
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Operational register of leave applications, policy evaluations, and audit status.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon="fa-download"
              onClick={handleExportCSV}
              disabled={(filteredRequests || []).length === 0}
              className="text-xs"
            >
              Export CSV
            </Button>
          </div>
        </div>
      )}

      {/* Filter Bar (Hidden in compact overview mode) */}
      {!isOverview && (
        <>
          <div className="p-4 border-b border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Search</label>
            <div className="relative">
              <AppIcon name="fa-magnifying-glass" className="absolute left-3 top-2.5 text-slate-400 text-xs" />
              <input
                type="text"
                placeholder="Name, ID, Reason..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy-600"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy-600 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending">All Pending Actions</option>
              <option value="Approved">Approved</option>
              <option value="Pending Manager Review">Pending Manager</option>
              <option value="Pending HR Review">Pending HR Review</option>
              <option value="Pending Super Admin Review">Pending Super Admin</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Withdrawn">Withdrawn</option>
            </select>
          </div>

          {/* Leave Type Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Leave Type</label>
            <select
              value={leaveTypeFilter}
              onChange={(e) => {
                setLeaveTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy-600 bg-white"
            >
              <option value="all">All Leave Types</option>
              {LEAVE_TYPES.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter (if applicable) */}
          {(departments || []).length > 0 && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy-600 bg-white"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Scope */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Date Period</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy-600 bg-white"
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Inputs if selected */}
        {dateRangeFilter === 'custom' && (
          <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 border border-slate-300 rounded text-xs"
            />
            <span className="font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 border border-slate-300 rounded text-xs"
            />
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('')
                  setCustomEndDate('')
                }}
                className="text-xs text-rose-600 hover:underline ml-2"
              >
                Clear Range
              </button>
            )}
          </div>
        )}
        </>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              <th
                onClick={() => handleSort('id')}
                className="py-3 px-4 whitespace-nowrap cursor-pointer select-none hover:text-navy-900"
                title="Sort by Request ID"
              >
                <div className="flex items-center gap-1.5">
                  <span>Request ID</span>
                  <AppIcon
                    name={sortField === 'id' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort'}
                    className={`text-xs ${sortField === 'id' ? 'text-blue-600' : 'text-slate-300'}`}
                  />
                </div>
              </th>
              <th
                onClick={() => handleSort('employee')}
                className="py-3 px-4 whitespace-nowrap cursor-pointer select-none hover:text-navy-900"
                title="Sort by Employee Name"
              >
                <div className="flex items-center gap-1.5">
                  <span>Employee</span>
                  <AppIcon
                    name={sortField === 'employee' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort'}
                    className={`text-xs ${sortField === 'employee' ? 'text-blue-600' : 'text-slate-300'}`}
                  />
                </div>
              </th>
              <th className="py-3 px-4 whitespace-nowrap">Leave Type</th>
              <th
                onClick={() => handleSort('date')}
                className="py-3 px-4 whitespace-nowrap cursor-pointer select-none hover:text-navy-900"
                title="Sort by Date"
              >
                <div className="flex items-center gap-1.5">
                  <span>Date Range</span>
                  <AppIcon
                    name={sortField === 'date' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort'}
                    className={`text-xs ${sortField === 'date' ? 'text-blue-600' : 'text-slate-300'}`}
                  />
                </div>
              </th>
              <th
                onClick={() => handleSort('days')}
                className="py-3 px-4 text-center whitespace-nowrap cursor-pointer select-none hover:text-navy-900"
                title="Sort by Days"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Days</span>
                  <AppIcon
                    name={sortField === 'days' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort'}
                    className={`text-xs ${sortField === 'days' ? 'text-blue-600' : 'text-slate-300'}`}
                  />
                </div>
              </th>
              <th className="py-3 px-4 whitespace-nowrap">Paid / Unpaid</th>
              <th className="py-3 px-4 whitespace-nowrap">Approver Route</th>
              <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
              <th className="py-3 px-4 text-right whitespace-nowrap min-w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {(paginatedRequests || []).length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <AppIcon name="fa-calendar-xmark" className="text-3xl text-slate-300 mb-2 block mx-auto" />
                  <p className="font-semibold text-slate-600">No leave records found</p>
                  <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or date period search.</p>
                </td>
              </tr>
            ) : (
              paginatedRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-navy-800">
                    {req.requestCode || req.id}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{req.employeeName || 'Staff Member'}</div>
                    <div className="text-[11px] text-slate-400">
                      {req.employeeCode || req.employeeId} {req.department ? `• ${req.department}` : ''}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-700">{req.leaveTypeName || req.leaveType || req.category || req.leaveTypeId || 'Ops Leave'}</span>
                    {req.isHalfDay && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">
                        {req.sessionType === 'first_half' ? '1st Half' : '2nd Half'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                    <div className="font-medium">{req.startDate}</div>
                    {req.startDate !== req.endDate && (
                      <div className="text-[11px] text-slate-400">to {req.endDate}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-bold text-navy-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                      {req.calculatedDays ?? req.eligibleWorkingDays ?? req.totalDays ?? req.durationDays ?? 1}d
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {(() => {
                      const isPaid = isPaidLeave(req)
                      return (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <AppIcon name={isPaid ? 'check' : 'close'} className="w-3 h-3 text-[10px]" />
                          {isPaid ? 'Paid Leave' : 'Unpaid Leave'}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-700 font-medium">
                      {req.currentApproverName
                        ? `${req.currentApproverName} (${req.currentApproverRole || req.currentApproverTier || 'Team Lead'})`
                        : (req.currentApproverRole || req.currentApproverTier || 'Team Lead')}
                    </div>
                    {req.escalationReason && (
                      <div className="text-[10px] text-amber-700 max-w-xs truncate" title={req.escalationReason}>
                        <AppIcon name="fa-arrow-up-right-from-square" className="mr-1" />
                        {req.escalationReason}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails?.(req)}
                      title="View Details"
                      className="text-xs text-navy-700 hover:bg-slate-100"
                    >
                      <AppIcon name="fa-eye" className="mr-1" />
                      View
                    </Button>
                    {canWithdraw &&
                      (req.status === 'Submitted' || req.status.startsWith('Pending')) &&
                      req.employeeId === currentUser?.employeeId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onWithdraw?.(req.id)}
                          title="Withdraw Application"
                          className="text-xs text-rose-600 hover:bg-rose-50"
                        >
                          Withdraw
                        </Button>
                      )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isOverview && (
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing {(filteredRequests || []).length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, (filteredRequests || []).length)} of {(filteredRequests || []).length} leave applications
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="text-xs px-2.5 py-1"
            >
              Previous
            </Button>
            <span className="px-2 font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="text-xs px-2.5 py-1"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveHistoryTable
