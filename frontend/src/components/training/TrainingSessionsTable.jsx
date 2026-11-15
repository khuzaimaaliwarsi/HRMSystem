import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import { formatTimeTo12Hour } from '@/lib/dateUtils'

export default function TrainingSessionsTable({
  sessions = [],
  onOpenAttendance,
  onCancelSession,
  onCompleteSession,
  onEnrollParticipant,
  canManage = false
}) {
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = sessions.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    return true
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-left">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-600"
          >
            <option value="all">All Session Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filtered.length}</strong> of {sessions.length} sessions
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
              <th className="py-2.5 px-4">Session Ref &amp; Course</th>
              <th className="py-2.5 px-4">Trainer</th>
              <th className="py-2.5 px-4">Date &amp; Time Interval</th>
              <th className="py-2.5 px-4">Venue / Link</th>
              <th className="py-2.5 px-4">Enrolled / Capacity</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-400">
                  No cohort training sessions match your criteria.
                </td>
              </tr>
            ) : (
              filtered.map((session) => {
                const enrolledCount = (session.attendanceRecords || []).length
                const isFull = enrolledCount >= session.capacity

                return (
                  <tr key={session.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-navy-950 text-xs">
                        {session.programTitle}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {session.sessionCode || session.sessionId || session.id}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {session.trainer}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      <div>{session.startDate} to {session.endDate}</div>
                      <div className="text-slate-400">{formatTimeTo12Hour(session.startTime)} — {formatTimeTo12Hour(session.endTime)} PKT</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <span className="text-[11px] font-medium block truncate max-w-[180px]" title={session.locationOrLink}>
                        {session.locationOrLink}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                        {session.locationType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isFull ? 'text-amber-700' : 'text-slate-800'}`}>
                          {enrolledCount}
                        </span>
                        <span className="text-slate-400">/ {session.capacity}</span>
                      </div>
                      <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                          className={`h-full ${isFull ? 'bg-amber-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(100, Math.round((enrolledCount / session.capacity) * 100))}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        session.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : session.status === 'In Progress'
                          ? 'bg-blue-100 text-blue-800'
                          : session.status === 'Scheduled'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenAttendance?.(session)}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors flex items-center gap-1"
                          title="Record / View Attendance"
                        >
                          <AppIcon name="clock" className="w-3 h-3 text-slate-500" />
                          Roster
                        </button>
                        {canManage && session.status !== 'Completed' && session.status !== 'Cancelled' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEnrollParticipant?.(session)}
                              className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
                              title="Enroll Staff Member"
                            >
                              Enroll
                            </button>
                            <button
                              type="button"
                              onClick={() => onCompleteSession?.(session.id)}
                              className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
                              title="Mark Session Completed"
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => onCancelSession?.(session.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Cancel Session"
                            >
                              <AppIcon name="close" className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
