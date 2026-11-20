import React, { useState, useMemo } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import Alert from '@/components/common/Alert'
import { attendanceService } from '@/services/attendanceService'
import { getDateFilterRange, sortByDateDescending, sortByDateAscending, getKarachiToday, formatTimeTo12Hour } from '@/lib/dateUtils'

export function TimesheetsTab({
  records = [],
  currentUser = null,
  overtimeRequests = [],
  onOpenOvertimeModal
}) {
  const isEmployee = currentUser?.role === 'employee'
  const isSupervisor = !isEmployee // team_lead, manager, hr_admin, super_admin

  // Sub-view toggle: 'ledger' (Timesheets) vs 'overtime' (Overtime Queue)
  const [activeSubView, setActiveSubView] = useState('ledger')

  // Timesheets Ledger State
  const [dateRange, setDateRange] = useState('month') // 'today' | 'yesterday' | 'last7' | 'month' | 'custom'
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' (Latest First) | 'asc' (Oldest First)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Overtime Queue State
  const [otStatusFilter, setOtStatusFilter] = useState('all')
  const [otSearchQuery, setOtSearchQuery] = useState('')
  const [selectedOvertime, setSelectedOvertime] = useState(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [approvedMinutesInput, setApprovedMinutesInput] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [decisionPending, setDecisionPending] = useState(false)

  // Pending count for overtime
  const pendingOvertimeCount = useMemo(() => {
    return (overtimeRequests || []).filter(
      (o) => o?.status?.toLowerCase().includes('pending') && o.employeeId !== currentUser?.employeeId
    ).length
  }, [overtimeRequests, currentUser?.employeeId])

  // Timesheets Filtered & Sorted
  const filteredRecords = useMemo(() => {
    let result = (records || []).filter((r) => {
      const { startDate, endDate } = getDateFilterRange(dateRange, customStart, customEnd)
      if (startDate && endDate) {
        if (startDate === endDate) {
          return r.date === startDate
        }
        return r.date >= startDate && r.date <= endDate
      }
      return r.date.startsWith('2026-10') || r.date.startsWith('2026-11') || r.date.startsWith(getKarachiToday().slice(0, 7))
    })

    return sortOrder === 'desc'
      ? sortByDateDescending(result, 'date')
      : sortByDateAscending(result, 'date')
  }, [records, dateRange, customStart, customEnd, sortOrder])

  const totalWorked = (filteredRecords || []).reduce((sum, r) => sum + (r.workedHours || 0), 0)
  const totalExpected = (filteredRecords || []).reduce((sum, r) => sum + (r.expectedHours || 0), 0)
  const totalVariance = Math.round((totalWorked - totalExpected) * 10) / 10
  const daysPresent = (filteredRecords || []).filter((r) => ['Present', 'Late', 'WFH', 'Field Duty'].includes(r?.primaryClassification))?.length || 0
  const daysLate = (filteredRecords || []).filter((r) => r?.isLate)?.length || 0

  // Overtime Filtered & Sorted
  const filteredOvertime = useMemo(() => {
    return (overtimeRequests || []).filter((o) => {
      if (otStatusFilter !== 'all') {
        if (otStatusFilter === 'pending') {
          if (!o?.status?.toLowerCase().includes('pending')) return false
        } else if (o?.status?.toLowerCase() !== otStatusFilter.toLowerCase()) {
          return false
        }
      }
      if (otSearchQuery.trim()) {
        const q = otSearchQuery.toLowerCase().trim()
        const matchesEmp = o.employeeName?.toLowerCase().includes(q) || o.employeeId?.toLowerCase().includes(q)
        const matchesId = o.id?.toLowerCase().includes(q)
        const matchesReason = o.reason?.toLowerCase().includes(q)
        if (!matchesEmp && !matchesId && !matchesReason) return false
      }
      return true
    }).sort((a, b) => {
      const dateA = a.overtimeDate || a.submittedAt || ''
      const dateB = b.overtimeDate || b.submittedAt || ''
      return dateB.localeCompare(dateA)
    })
  }, [overtimeRequests, otStatusFilter, otSearchQuery])

  const handleOpenDecisionModal = (ot) => {
    setSelectedOvertime(ot)
    setDecisionNotes('')
    setApprovedMinutesInput(ot.durationMinutes ?? ot.requestedMinutes ?? 0)
    setFeedback(null)
  }

  const handleApproveOvertime = async (ot) => {
    setFeedback(null)
    const requestedMins = Number(ot.durationMinutes ?? ot.requestedMinutes)
    if (!Number.isInteger(requestedMins) || requestedMins < 60) {
      setFeedback({ type: 'danger', message: 'Invalid overtime duration. A valid 60+ minute claim is required.' })
      return
    }
    setDecisionPending(true)
    try {
      await attendanceService.approveOvertimeRequestAsync(
        ot.id, requestedMins, decisionNotes || `Overtime authorized for ${requestedMins} minutes`,
        currentUser?.name, currentUser?.employeeId, currentUser?.role
      )
      setFeedback({ type: 'success', message: `Overtime ${ot.id}: backend approval confirmed. Refreshing authoritative records.` })
      setSelectedOvertime(null)
      setDecisionNotes('')
    } catch (err) {
      setFeedback({ type: 'danger', message: err?.message || 'Backend overtime approval failed.' })
    } finally {
      setDecisionPending(false)
    }
  }

  const handleRejectOvertime = async (ot) => {
    setFeedback(null)
    setDecisionPending(true)
    try {
      await attendanceService.rejectOvertimeRequestAsync(
        ot.id, decisionNotes || 'Overtime claim declined by supervisor',
        currentUser?.name, currentUser?.employeeId, currentUser?.role
      )
      setFeedback({ type: 'success', message: `Overtime ${ot.id}: backend rejection confirmed.` })
      setSelectedOvertime(null)
      setDecisionNotes('')
    } catch (err) {
      setFeedback({ type: 'danger', message: err?.message || 'Backend overtime rejection failed.' })
    } finally {
      setDecisionPending(false)
    }
  }

  return (
    <div className="space-y-4 text-left">
      {/* Feedback banner */}
      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Primary Sub-view Switcher (Clean navigation strip for Timesheets & Overtime) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('ledger')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${activeSubView === 'ledger'
              ? 'bg-hrms-primary text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
          >
            <AppIcon name="shifts" className="w-3.5 h-3.5" />
            <span>Timesheets & Working Hours</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('overtime')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${activeSubView === 'overtime'
              ? 'bg-hrms-primary text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
          >
            <AppIcon name="alerts" className="w-3.5 h-3.5" />
            <span>Overtime Approval Queue</span>
            {pendingOvertimeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-mono text-[10px] font-black">
                {pendingOvertimeCount}
              </span>
            )}
          </button>
        </div>

        {onOpenOvertimeModal && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenOvertimeModal}
            className="text-xs font-bold shrink-0"
          >
            <AppIcon name="shifts" className="w-3.5 h-3.5 mr-1.5" />
            Claim Overtime
          </Button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: WORKING HOURS & TIMESHEETS LEDGER */}
      {/* ========================================================================= */}
      {activeSubView === 'ledger' && (
        <div className="space-y-4">
          {/* Action alert if supervisor has pending overtime */}
          {isSupervisor && pendingOvertimeCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-medium">
                <AppIcon name="fa-triangle-exclamation" className="text-amber-600 shrink-0" />
                <span>
                  <strong>Action Required:</strong> You have {pendingOvertimeCount} pending overtime claim(s) awaiting your authorization.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubView('overtime')}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0"
              >
                View Overtime Queue
              </button>
            </div>
          )}

          {/* Top Header & Range Bar */}
          <div className="bg-white p-4 rounded-lg border border-hrms-border shadow-hrms-card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-hrms-primary">Working Hours & Timesheet Ledger</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Summarized daily working hours, unpaid breaks, and variance calculations against shift targets (Asia/Karachi).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Presets */}
              <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                <button
                  type="button"
                  onClick={() => setDateRange('today')}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${dateRange === 'today' ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600'}`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateRange('yesterday')}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${dateRange === 'yesterday' ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600'}`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => setDateRange('last7')}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${dateRange === 'last7' ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600'}`}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setDateRange('month')}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${dateRange === 'month' ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600'}`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setDateRange('custom')}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${dateRange === 'custom' ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600'}`}
                >
                  Custom
                </button>
              </div>

              {/* Sort Order Selector */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="text-xs font-semibold px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-700 focus:outline-none"
              >
                <option value="desc">Latest First ↓</option>
                <option value="asc">Oldest First ↑</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range Picker */}
          {dateRange === 'custom' && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-slate-600">Custom Date Range:</span>
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500 text-[11px]">From:</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500 text-[11px]">To:</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                />
              </div>
            </div>
          )}

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Worked</span>
              <div className="text-xl font-black text-hrms-primary font-mono mt-1">
                {Math.round(totalWorked * 10) / 10} hrs
              </div>
              <span className="text-[10px] text-slate-400">Net logged working hours</span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Expected Hours</span>
              <div className="text-xl font-black text-slate-700 font-mono mt-1">
                {Math.round(totalExpected * 10) / 10} hrs
              </div>
              <span className="text-[10px] text-slate-400">Shift target hours</span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Hours Variance</span>
              <div className={`text-xl font-black font-mono mt-1 ${totalVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {totalVariance >= 0 ? `+${totalVariance}h` : `${totalVariance}h`}
              </div>
              <span className="text-[10px] text-slate-400">Difference from target</span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Days Present / Late</span>
              <div className="text-xl font-black text-hrms-primary font-mono mt-1">
                {daysPresent} / {daysLate}
              </div>
              <span className="text-[10px] text-slate-400">Working days vs Late flags</span>
            </div>
          </div>

          {/* Timesheets Table */}
          <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="p-3">Staff Member</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Shift</th>
                    <th className="p-3 font-mono">In - Out</th>
                    <th className="p-3">Break</th>
                    <th className="p-3 text-right">Worked</th>
                    <th className="p-3 text-right">Target</th>
                    <th className="p-3 text-right">Variance</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(filteredRecords || []).length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-6 text-center text-slate-400 italic">
                        No timesheet entries for this selected range.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">
                          {r.employeeName}
                          <span className="block text-[10px] font-mono text-slate-400">{r.employeeId}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">{r.date}</td>
                        <td className="p-3 text-slate-600 font-medium">{r.shiftName}</td>
                        <td className="p-3 font-mono text-slate-700">
                          {r.checkInTime ? formatTimeTo12Hour(r.checkInTime) : '—'} - {r.checkOutTime ? formatTimeTo12Hour(r.checkOutTime) : '—'}
                        </td>
                        <td className="p-3 text-slate-500">{r.totalBreakMinutes || 0}m</td>
                        <td className="p-3 text-right font-mono font-bold text-hrms-primary">{r.workedHours}h</td>
                        <td className="p-3 text-right font-mono text-slate-500">{r.expectedHours}h</td>
                        <td className={`p-3 text-right font-mono font-bold ${r.hoursVariance >= 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {Number.isFinite(Number(r.hoursVariance)) ? `${Number(r.hoursVariance) > 0 ? '+' : ''}${r.hoursVariance}h` : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <StatusBadge status={r.primaryClassification || r.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: OVERTIME APPROVAL QUEUE */}
      {/* ========================================================================= */}
      {activeSubView === 'overtime' && (
        <div className="space-y-4">
          {/* Header & Filter Controls */}
          <div className="bg-white p-4 rounded-lg border border-hrms-border shadow-hrms-card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-hrms-primary">Team Overtime Authorizations & Approval Queue</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review, verify, and decide extra working hours claims submitted by team members (Asia/Karachi canonical routing).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <input
                type="text"
                placeholder="Search staff, ID, reason..."
                value={otSearchQuery}
                onChange={(e) => setOtSearchQuery(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56"
              />

              {/* Status Filter */}
              <select
                value={otStatusFilter}
                onChange={(e) => setOtStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium focus:outline-none"
              >
                <option value="all">All Overtime Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Overtime Queue Table */}
          <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="px-2.5 py-2 whitespace-nowrap">Overtime ID & Staff</th>
                    <th className="px-2 py-2 whitespace-nowrap">Date</th>
                    <th className="px-2 py-2 whitespace-nowrap font-mono">Claimed Start – End</th>
                    <th className="px-2 py-2 whitespace-nowrap">Claimed Duration</th>
                    <th className="px-2 py-2">Justification</th>
                    <th className="px-2 py-2 whitespace-nowrap">Approver Route</th>
                    <th className="px-2 py-2 text-center whitespace-nowrap">Status</th>
                    <th className="px-2.5 py-2 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOvertime.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400 italic">
                        <AppIcon name="shifts" className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No overtime requests found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your filters or date query.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOvertime.map((o) => {
                      const isPending = o?.status?.toLowerCase().includes('pending')
                      const isSelf = o.employeeId === currentUser?.employeeId
                      const blockSelf = isSelf
                      const canDecide = isSupervisor && isPending && !blockSelf
                      const rawMins = o.durationMinutes ?? o.requestedMinutes
                      const otMins = Number.isFinite(Number(rawMins)) && Number(rawMins) > 0 ? Number(rawMins) : 0
                      const otHours = Number.isFinite(Number(o.requestedHours)) && Number(o.requestedHours) > 0
                        ? Number(o.requestedHours)
                        : Math.round((otMins / 60) * 10) / 10
                      const timeIn = o.startTime || '—'
                      const timeOut = o.endTime || '—'

                      return (
                        <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-2.5 py-2">
                            <div className="font-bold text-slate-800">{o.employeeName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {o.id} • {o.employeeId} {o.departmentName ? `• ${o.departmentName}` : ''}
                            </div>
                          </td>
                          <td className="px-2 py-2 font-mono font-bold text-slate-700 whitespace-nowrap">
                            {o.overtimeDate}
                          </td>
                          <td className="px-2 py-2 font-mono text-slate-700 whitespace-nowrap">
                            {timeIn === '—' ? '—' : formatTimeTo12Hour(timeIn)} – {timeOut === '—' ? '—' : formatTimeTo12Hour(timeOut)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className="font-bold text-slate-900 font-mono">
                              {otMins} mins
                            </span>{' '}
                            <span className="text-[11px] text-slate-500">
                              ({otHours}h)
                            </span>
                            {otMins > 0 && otMins < 60 && (
                              <span className="ml-1 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Sub-60m
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 max-w-[150px]">
                            <p className="text-slate-600 truncate" title={o.reason}>
                              {o.reason}
                            </p>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div className="font-medium text-slate-700">
                              {o.approverName || o.currentApproverName || 'Canonical Approver'}
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {o.approverRole || o.currentApproverRole || 'Team Lead'}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="px-2.5 py-2 text-right whitespace-nowrap space-x-1">
                            {canDecide ? (
                              <button
                                type="button"
                                onClick={() => handleOpenDecisionModal(o)}
                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition cursor-pointer"
                                title="Review & Decide Overtime Claim"
                              >
                                Review & Decide
                              </button>
                            ) : blockSelf && isPending ? (
                              <div className="flex items-center gap-1 justify-end">
                                <span
                                  className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 rounded border border-slate-200 cursor-not-allowed"
                                  title="Self-approval prohibited as per company policy"
                                >
                                  Self Blocked
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDecisionModal(o)}
                                  className="px-2 py-0.5 text-[10px] font-bold text-hrms-accent bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition cursor-pointer"
                                  title="View Request Details & Audit History"
                                >
                                  Details
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenDecisionModal(o)}
                                className="px-2 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition cursor-pointer"
                                title="View Decision Details & Audit History"
                              >
                                Details
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DECISION & AUDIT TRAIL MODAL */}
      {/* ========================================================================= */}
      {selectedOvertime && (
        <Modal
          isOpen={Boolean(selectedOvertime)}
          onClose={() => {
            setSelectedOvertime(null)
            setDecisionNotes('')
            setFeedback(null)
          }}
          title={`Overtime Claim: ${selectedOvertime.id}`}
          description={`Applicant: ${selectedOvertime.employeeName} (${selectedOvertime.employeeId}) • Date: ${selectedOvertime.overtimeDate}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs text-left">
            {/* Summary Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Overtime Date</span>
                <span className="font-bold text-slate-800 font-mono text-sm">{selectedOvertime.overtimeDate}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Claimed Start – End</span>
                <span className="font-bold text-slate-700 font-mono">
                  {selectedOvertime.startTime ? formatTimeTo12Hour(selectedOvertime.startTime) : '—'} – {selectedOvertime.endTime ? formatTimeTo12Hour(selectedOvertime.endTime) : '—'}
                </span>
                <span className="text-slate-500 text-[10px] uppercase font-bold block mt-2">Verified Punches</span>
                <span className="font-bold text-slate-700 font-mono">
                  {selectedOvertime.attendanceVerified === true && selectedOvertime.actualCheckIn && selectedOvertime.actualCheckOut
                    ? `${formatTimeTo12Hour(selectedOvertime.actualCheckIn)} – ${formatTimeTo12Hour(selectedOvertime.actualCheckOut)}`
                    : 'Not verified / no confirmed punch evidence'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Claimed Duration</span>
                <span className="font-bold text-hrms-primary font-mono text-sm">
                  {Number(selectedOvertime.durationMinutes || selectedOvertime.requestedMinutes || 0)} mins ({Number.isFinite(Number(selectedOvertime.requestedHours)) && Number(selectedOvertime.requestedHours) > 0 ? Number(selectedOvertime.requestedHours) : Math.round((Number(selectedOvertime.durationMinutes || selectedOvertime.requestedMinutes || 0) / 60) * 10) / 10}h)
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Current Status</span>
                <StatusBadge status={selectedOvertime.status} />
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Approver Route</span>
                <span className="font-medium text-slate-800">
                  {selectedOvertime.approverName || selectedOvertime.currentApproverName || 'Canonical Approver'} (
                  {selectedOvertime.approverRole || selectedOvertime.currentApproverRole || 'Team Lead'})
                </span>
              </div>
            </div>

            {/* Operational Reason */}
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
                Operational Justification / Employee Reason
              </span>
              <p className="text-slate-700 leading-relaxed italic bg-slate-50 p-2.5 rounded border border-slate-100">
                "{selectedOvertime.reason}"
              </p>
            </div>

            {/* Action Decision Controls (Only for authorized reviewers on pending requests) */}
            {isSupervisor && selectedOvertime.status?.toLowerCase().includes('pending') && selectedOvertime.employeeId !== currentUser?.employeeId && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <AppIcon name="fa-stamp" className="text-blue-600" />
                  Supervisor Decision Panel
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-bold text-[11px] mb-1">
                      Approved Duration (minutes):
                    </label>
                    <input
                      type="number"
                      min="60"
                      max="360"
                      step="15"
                      readOnly
                       value={approvedMinutesInput}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold text-[11px] mb-1">
                      Calculated Working Hours:
                    </label>
                    <div className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono font-bold text-slate-700">
                       {Math.round((Number(selectedOvertime.durationMinutes ?? selectedOvertime.requestedMinutes ?? 0) / 60) * 10) / 10} hrs
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold text-[11px] mb-1">
                    Decision Remarks / Audit Note:
                  </label>
                  <textarea
                    rows={2}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Enter decision rationale or operational justification..."
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <p className="text-[11px] text-amber-800">Server-verified attendance is required for approval. Partial approval is disabled until supported by the backend.</p>
                 <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                     onClick={() => handleRejectOvertime(selectedOvertime)}
                     disabled={decisionPending}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Reject Overtime
                  </button>
                  <button
                    type="button"
                     onClick={() => handleApproveOvertime(selectedOvertime)}
                     disabled={decisionPending}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Approve Overtime
                  </button>
                </div>
              </div>
            )}

            {/* Audit Trail / History Section */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase font-bold block flex items-center gap-1.5">
                <AppIcon name="fa-clock-rotate-left" className="text-slate-400" />
                Immutable Decision Audit Trail ({selectedOvertime.approvalHistory?.length || 0} events)
              </span>

              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {(selectedOvertime.approvalHistory || []).length === 0 ? (
                  <div className="p-3 text-center text-slate-400 italic">No server-provided audit events available. This does not prove that no historical events exist.</div>
                ) : (
                  (selectedOvertime.approvalHistory || []).map((h, idx) => (
                    <div key={idx} className="p-2.5 flex items-start justify-between gap-3 text-[11px]">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${h.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : h.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : h.status === 'Re-routed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                          >
                            {h.status}
                          </span>
                          <span className="font-semibold text-slate-800">{h.actor}</span>
                        </div>
                        <p className="text-slate-600 italic">"{h.note || 'No notes attached'}"</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{h.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Close */}
            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedOvertime(null)
                  setDecisionNotes('')
                }}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default TimesheetsTab