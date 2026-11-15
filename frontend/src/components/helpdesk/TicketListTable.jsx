import React, { useState, useMemo } from 'react'

export default function TicketListTable({
  tickets = [],
  onViewTicket = () => {},
  categories = []
}) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedPriority, setSelectedPriority] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const match =
          t.ticketId.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.employeeName?.toLowerCase().includes(q)
        if (!match) return false
      }
      if (selectedCategory !== 'all' && t.categoryId !== selectedCategory && t.category !== selectedCategory) {
        return false
      }
      if (selectedPriority !== 'all' && t.priority?.toLowerCase() !== selectedPriority.toLowerCase()) {
        return false
      }
      if (selectedStatus !== 'all' && t.status?.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false
      }
      return true
    })
  }, [tickets, search, selectedCategory, selectedPriority, selectedStatus])

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'Critical':
        return 'bg-rose-100 text-rose-800 border-rose-200'
      case 'High':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'Medium':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Low':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Open':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'Assigned':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      case 'In Progress':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'Pending Employee':
      case 'Pending Department':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'Resolved':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'Closed':
        return 'bg-slate-100 text-slate-600 border-slate-200'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  const getSlaBadge = (ticket) => {
    const isResolvedOrClosed =
      !ticket.isReopenedActive && (ticket.status === 'Resolved' || ticket.status === 'Closed')
    const dueStr = ticket.resolutionDue || ticket.slaDueDate

    let badge = (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
        <i className="fa-regular fa-clock text-xs"></i> On Track
      </span>
    )

    if (ticket.isSlaBreached) {
      badge = (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <i className="fa-solid fa-triangle-exclamation text-xs"></i>{' '}
          {isResolvedOrClosed ? 'Breached (Late)' : 'Breached'}
        </span>
      )
    } else if (isResolvedOrClosed) {
      badge = (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
          <i className="fa-solid fa-check-circle text-xs"></i> Met
        </span>
      )
    } else if (ticket.isSlaWarning) {
      badge = (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <i className="fa-solid fa-clock text-xs"></i> Approaching
        </span>
      )
    }

    return (
      <div className="space-y-0.5">
        {badge}
        {dueStr && (
          <div className="text-[10px] text-slate-400">
            Due {new Date(dueStr).toLocaleDateString()}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3.5">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            placeholder="Search by ticket ID, subject, requester..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.categoryName}
              </option>
            ))}
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Employee">Pending Employee</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Ticket ID</th>
              <th className="py-2.5 px-3">Subject & Details</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Priority</th>
              <th className="py-2.5 px-3">Requester</th>
              <th className="py-2.5 px-3">Assigned Resolver</th>
              <th className="py-2.5 px-3">SLA Status</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-slate-400">
                  <i className="fa-solid fa-inbox text-3xl mb-2"></i>
                  <p className="font-medium text-slate-600">No support tickets found</p>
                  <p className="text-[11px]">Adjust your search query or filter options</p>
                </td>
              </tr>
            ) : (
              filteredTickets.map((t) => (
                <tr key={t.ticketId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 whitespace-nowrap font-mono font-medium text-indigo-700">
                    {t.ticketId}
                    <div className="text-[10px] text-slate-400 font-sans">
                      {new Date(t.createdDate).toLocaleDateString()}
                    </div>
                  </td>

                  <td className="py-3 px-3 max-w-xs">
                    <div className="font-medium text-slate-800 truncate" title={t.subject}>
                      {t.subject}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {t.subcategory || 'Support Inquiry'}
                    </div>
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="text-xs text-slate-700 font-medium">{t.category}</span>
                    <div className="text-[10px] text-slate-400">{t.assignedTeamName}</div>
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getPriorityBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                      {t.isEscalated && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Escalated
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="font-medium text-slate-800">{t.employeeName}</div>
                    <div className="text-[10px] text-slate-400">{t.employeeDepartment}</div>
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    {t.assignedResolverName ? (
                      <div>
                        <span className="font-medium text-slate-700">{t.assignedResolverName}</span>
                        <div className="text-[10px] text-slate-400">Resolver</div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Unassigned
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    {getSlaBadge(t)}
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                      {(t.isReopened || t.reopenedAt) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Reopened
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap text-right">
                    <button
                      onClick={() => onViewTicket(t)}
                      className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition"
                    >
                      <i className="fa-regular fa-folder-open mr-1"></i>
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-right text-[11px] text-slate-400">
        Showing {filteredTickets.length} of {tickets.length} tickets
      </div>
    </div>
  )
}
