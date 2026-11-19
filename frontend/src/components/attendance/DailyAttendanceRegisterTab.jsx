import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Modal from '@/components/common/Modal'
import { attendanceService } from '@/services/attendanceService'
import { shiftService } from '@/services/shiftService'
import { getKarachiToday, getDateFilterRange, formatTimeTo12Hour, formatLateDuration } from '@/lib/dateUtils'
import apiClient from '@/services/apiClient'

export function DailyAttendanceRegisterTab({
  records = [],
  departments = [],
  shifts = [],
  onOpenRegularizeModal,
  userRole = 'super_admin',
  onDateChange
}) {
  const [selectedDate, setSelectedDate] = useState(() => getKarachiToday())
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null)

  const handleOpenPunchesModal = async (r) => {
    let effectivePunches = Array.isArray(r.punches) && r.punches.length > 0 ? [...r.punches] : []
    const hasIn = Boolean(r.checkInTime || (r.checkIn && r.checkIn !== '--:--'))
    const hasOut = Boolean(r.checkOutTime || (r.checkOut && r.checkOut !== '--:--'))
    const inVal = r.checkInTime || (r.checkIn !== '--:--' ? r.checkIn : null)
    const outVal = r.checkOutTime || (r.checkOut !== '--:--' ? r.checkOut : null)

    if (effectivePunches.length === 0 && hasIn) {
      effectivePunches.push({
        id: `${r.id || r.employeeId}-in`,
        type: 'IN',
        punchType: 'CHECK_IN',
        timestamp: formatTimeTo12Hour(inVal),
        source: 'WEB',
        verified: true
      })
      if (hasOut) {
        effectivePunches.push({
          id: `${r.id || r.employeeId}-out`,
          type: 'OUT',
          punchType: 'CHECK_OUT',
          timestamp: formatTimeTo12Hour(outVal),
          source: 'WEB',
          verified: true
        })
      }
    }

    let displayNotes = r.notes
    if (hasIn && hasOut) {
      displayNotes = `Shift completed (${r.workedHours || '0.0h'} worked)`
    } else if (hasIn) {
      displayNotes = 'Shift in progress (Checked In)'
    }

    const detailObj = {
      ...r,
      punches: effectivePunches,
      notes: displayNotes
    }
    setSelectedRecordForDetail(detailObj)

    // Fetch live authoritative punches from backend API
    const recId = r.attendanceRecordId || r.cuid || (r.id && !String(r.id).startsWith('ATT-') ? r.id : null)
    if (recId) {
      try {
        const res = await apiClient.get(`/attendance/records/${recId}/punches`)
        const livePunches = res?.punches || res?.data?.punches
        if (Array.isArray(livePunches) && livePunches.length > 0) {
          setSelectedRecordForDetail((prev) => (prev ? { ...prev, punches: livePunches } : prev))
        }
      } catch (_) {}
    }
  }

  useEffect(() => {
    if (selectedDate) {
      attendanceService.syncScheduledAttendance(selectedDate)
      attendanceService.syncDailyRegister?.(selectedDate)
      onDateChange?.(selectedDate)
    }
  }, [selectedDate, onDateChange])

  const filteredRecords = records.filter((r) => {
    if (selectedDate && r.date !== selectedDate) return false
    if (departmentFilter !== 'all' && r.departmentId !== departmentFilter) return false
    if (shiftFilter !== 'all' && r.shiftId !== shiftFilter) return false
    if (statusFilter !== 'all') {
      const sf = statusFilter.toLowerCase()
      const rStatus = (r.status || '').toLowerCase()
      const rClass = (r.primaryClassification || '').toLowerCase()
      const rArr = (r.workArrangement || '').toLowerCase()
      const matchStatus = rStatus === sf || rClass === sf ||
        (sf === 'wfh' && (rArr === 'wfh' || rArr === 'remote_wfh' || rStatus === 'wfh')) ||
        (sf === 'field duty' && (rArr === 'field duty' || rArr === 'field_duty' || rStatus === 'field_duty'))
      if (!matchStatus) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const match = r.employeeName.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q) ||
        r.departmentName.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  // Default Latest First (descending) sorting
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const cmp = (b.date || '').localeCompare(a.date || '')
    if (cmp !== 0) return cmp
    return (a.employeeName || '').localeCompare(b.employeeName || '')
  })

  return (
    <div className="space-y-4 text-left">
      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-lg border border-hrms-border shadow-hrms-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker & Quick Presets */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Attendance Date</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const newDate = e.target.value
                  setSelectedDate(newDate)
                  if (newDate) attendanceService.syncScheduledAttendance(newDate)
                }}
                className="text-xs font-semibold p-1.5 border border-slate-300 rounded bg-white"
              />
              <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const today = getKarachiToday()
                    setSelectedDate(today)
                    attendanceService.syncScheduledAttendance(today)
                  }}
                  className={`px-2 py-1 text-[10px] font-bold rounded ${selectedDate === getKarachiToday() ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const yest = getDateFilterRange('yesterday').startDate
                    setSelectedDate(yest)
                    attendanceService.syncScheduledAttendance(yest)
                  }}
                  className={`px-2 py-1 text-[10px] font-bold rounded ${selectedDate === getDateFilterRange('yesterday').startDate ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('2026-10-30')
                    attendanceService.syncScheduledAttendance('2026-10-30')
                  }}
                  className={`px-2 py-1 text-[10px] font-bold rounded ${selectedDate === '2026-10-30' ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Oct 30
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('2026-10-26')
                    attendanceService.syncScheduledAttendance('2026-10-26')
                  }}
                  className={`px-2 py-1 text-[10px] font-bold rounded ${selectedDate === '2026-10-26' ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Oct 26
                </button>
              </div>
            </div>
          </div>

          {/* Department Filter */}
          {userRole !== 'manager' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs p-1.5 border border-slate-300 rounded bg-white min-w-[130px]"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Shift Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Shift</label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="text-xs p-1.5 border border-slate-300 rounded bg-white min-w-[130px]"
            >
              <option value="all">All Shifts</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs p-1.5 border border-slate-300 rounded bg-white min-w-[110px]"
            >
              <option value="all">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="WFH">WFH / Remote</option>
              <option value="Field Duty">Field Duty</option>
              <option value="Absent">Absent</option>
              <option value="On Leave">On Leave</option>
              <option value="Half Day">Half Day</option>
              <option value="Holiday">Holiday</option>
              <option value="Weekly Off">Weekly Off</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">Search Staff</label>
          <div className="relative flex items-center">
            <AppIcon name="search" className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by name, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white"
            />
          </div>
        </div>
      </div>

      {/* Table Roster */}
      <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3">Staff Member</th>
                <th className="p-3">Department</th>
                <th className="p-3">Shift & Arrangement</th>
                <th className="p-3">Check-In</th>
                <th className="p-3">Check-Out</th>
                <th className="p-3 text-right">Worked Hours</th>
                <th className="p-3">Exceptions</th>
                <th className="p-3 text-center">Classification</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(sortedRecords || []).length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-400 italic">
                    No attendance records found matching current date and filters.
                  </td>
                </tr>
              ) : (
                sortedRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{r.employeeName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{r.employeeId}</div>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{r.departmentName}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800 text-[11px]">
                        {(() => {
                          const effectiveShift = shiftService.resolveEmployeeShiftForDate(r.employeeId || r.employeeCuid || r.employeeCode, r.date)
                          return effectiveShift?.name || r.shift?.name || r.shiftName || 'General Corporate Day Shift'
                        })()}
                      </div>
                      {(() => {
                        const arr = r.workArrangement === 'REMOTE_WFH' ? 'WFH' : (r.workArrangement === 'FIELD_DUTY' ? 'Field Duty' : (r.workArrangement || 'Office'))
                        const isWfh = arr === 'WFH'
                        const isFd = arr === 'Field Duty'
                        return (
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                            isWfh
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : isFd
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {arr}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700">
                      {r.checkInTime
                        ? formatTimeTo12Hour(r.checkInTime)
                        : ((r.checkIn && r.checkIn !== '--:--') ? formatTimeTo12Hour(r.checkIn) : '— : —')}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700">
                      {r.checkOutTime
                        ? formatTimeTo12Hour(r.checkOutTime)
                        : ((r.checkOut && r.checkOut !== '--:--') ? formatTimeTo12Hour(r.checkOut) : '— : —')}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-hrms-primary">
                      {r.workedHours > 0 ? `${r.workedHours}h` : '0.0h'}
                      {r.hoursVariance !== 0 && (
                        <span className={`block text-[10px] ${r.hoursVariance > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {r.hoursVariance > 0 ? `+${r.hoursVariance}h` : `${r.hoursVariance}h`}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {r.isLate ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <AppIcon name="warning" className="w-2.5 h-2.5" />
                          {formatLateDuration(r.lateMinutes, 'Late')}
                        </span>
                      ) : r.isEarlyExit ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          <AppIcon name="warning" className="w-2.5 h-2.5" />
                          {formatLateDuration(r.earlyExitMinutes, 'Early')}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={r.primaryClassification || r.status} />
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenPunchesModal(r)}
                        className="px-2 py-1 text-[11px] font-bold text-hrms-accent bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                        title="View raw punch logs and audit details"
                      >
                        Punches
                      </button>
                      {onOpenRegularizeModal && (
                        <button
                          type="button"
                          onClick={() => onOpenRegularizeModal(r)}
                          className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
                          title="Submit attendance adjustment"
                        >
                          Regularize
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Strip */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>Showing {(filteredRecords || []).length} staff record(s) for <strong>{selectedDate}</strong></span>
          <span className="text-[11px] text-slate-400">Canonical Live Workforce Register</span>
        </div>
      </div>

      {/* Detail & Punch Events Modal */}
      {selectedRecordForDetail && (
        <Modal
          isOpen={Boolean(selectedRecordForDetail)}
          onClose={() => setSelectedRecordForDetail(null)}
          title={`Attendance Audit: ${selectedRecordForDetail.employeeName}`}
          description={`Record ID: ${selectedRecordForDetail.id} • Date: ${selectedRecordForDetail.date}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 text-[11px]">Employee:</span>
                <div className="font-bold text-slate-800">{selectedRecordForDetail.employeeName} ({selectedRecordForDetail.employeeId})</div>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Department:</span>
                <div className="font-bold text-slate-800">{selectedRecordForDetail.departmentName}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Assigned Shift:</span>
                <div className="font-bold text-slate-800">{selectedRecordForDetail.shiftName}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Work Arrangement:</span>
                <div className="font-bold text-slate-800">
                  {selectedRecordForDetail.workArrangement === 'REMOTE_WFH' ? 'WFH' : (selectedRecordForDetail.workArrangement === 'FIELD_DUTY' ? 'Field Duty' : (selectedRecordForDetail.workArrangement || 'Office'))}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Check-In / Out:</span>
                <div className="font-mono font-bold text-slate-800">
                  {selectedRecordForDetail.checkInTime
                    ? formatTimeTo12Hour(selectedRecordForDetail.checkInTime)
                    : ((selectedRecordForDetail.checkIn && selectedRecordForDetail.checkIn !== '--:--') ? formatTimeTo12Hour(selectedRecordForDetail.checkIn) : '—')} / {selectedRecordForDetail.checkOutTime
                    ? formatTimeTo12Hour(selectedRecordForDetail.checkOutTime)
                    : ((selectedRecordForDetail.checkOut && selectedRecordForDetail.checkOut !== '--:--') ? formatTimeTo12Hour(selectedRecordForDetail.checkOut) : '—')}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Worked Hours:</span>
                <div className="font-mono font-bold text-hrms-primary">
                  {typeof selectedRecordForDetail.workedHours === 'string' && selectedRecordForDetail.workedHours.includes('h')
                    ? selectedRecordForDetail.workedHours
                    : `${parseFloat(selectedRecordForDetail.workedHours || 0).toFixed(1)} hrs`}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-2">Immutable Raw Punch Audit Events</h4>
              <div className="space-y-2 border-l-2 border-hrms-accent/30 pl-3">
                {(() => {
                  const effectivePunches = (selectedRecordForDetail?.punches || []).length > 0
                    ? selectedRecordForDetail.punches
                    : [
                        (selectedRecordForDetail?.checkInTime || (selectedRecordForDetail?.checkIn && selectedRecordForDetail?.checkIn !== '--:--'))
                          ? {
                              id: 'p-in',
                              type: 'IN',
                              timestamp: formatTimeTo12Hour(selectedRecordForDetail.checkInTime || selectedRecordForDetail.checkIn),
                              source: 'WEB',
                              verified: true
                            }
                          : null,
                        (selectedRecordForDetail?.checkOutTime || (selectedRecordForDetail?.checkOut && selectedRecordForDetail?.checkOut !== '--:--'))
                          ? {
                              id: 'p-out',
                              type: 'OUT',
                              timestamp: formatTimeTo12Hour(selectedRecordForDetail.checkOutTime || selectedRecordForDetail.checkOut),
                              source: 'WEB',
                              verified: true
                            }
                          : null
                      ].filter(Boolean)

                  return effectivePunches.length > 0 ? (
                    effectivePunches.map((p, idx) => (
                      <div key={idx} className="relative text-xs">
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${p.type === 'IN' ? 'bg-emerald-100 text-emerald-800' : p.type === 'OUT' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'}`}>
                            PUNCH {p.type}
                          </span>
                          <span className="font-mono text-slate-700">{p.timestamp || p.punchTimeFormatted}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Source: {p.source || 'WEB'} • Verified: {p.verified !== false ? 'Yes' : 'No'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic">No punch events recorded for this session.</p>
                  )
                })()}
              </div>
            </div>

            {(() => {
              const hasIn = Boolean(selectedRecordForDetail.checkInTime || (selectedRecordForDetail.checkIn && selectedRecordForDetail.checkIn !== '--:--'))
              const hasOut = Boolean(selectedRecordForDetail.checkOutTime || (selectedRecordForDetail.checkOut && selectedRecordForDetail.checkOut !== '--:--'))
              let noteText = selectedRecordForDetail.notes
              if (hasIn && (!noteText || noteText.includes('not started'))) {
                noteText = hasOut ? `Shift completed (${selectedRecordForDetail.workedHours || '0.0h'} worked)` : 'Shift in progress (Checked In)'
              }
              if (!noteText) return null
              return (
                <div className="bg-blue-50 p-2.5 rounded border border-blue-200 text-blue-900 text-xs">
                  <strong>System Note: </strong> {noteText}
                </div>
              )
            })()}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default DailyAttendanceRegisterTab
