import React, { useState } from 'react'

export default function EnrollmentProgressTable({
  enrollments = [],
  onUpdateProgress,
  onOpenAssessment,
  canEvaluate = false,
  canUpdateProgress = false
}) {
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = enrollments.filter((e) => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    return true
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-left">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-600"
          >
            <option value="all">All Learning Statuses</option>
            <option value="Enrolled">Enrolled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed (Passed)</option>
            <option value="Failed">Failed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filtered.length}</strong> of {enrollments.length} participant tracks
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
              <th className="py-2.5 px-4">Participant</th>
              <th className="py-2.5 px-4">Course Program</th>
              <th className="py-2.5 px-4">Enrollment Date</th>
              <th className="py-2.5 px-4">Syllabus Progress</th>
              <th className="py-2.5 px-4">Assessment Score</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Evaluator Feedback</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-400">
                  No learning progress records found.
                </td>
              </tr>
            ) : (
              filtered.map((enr) => {
                const pct = enr.progressPercent || 0
                const passMark = Number(enr.passingScore) || 70
                const todayStr = new Date().toISOString().slice(0, 10)
                const startDateStr = enr.startDate ? String(enr.startDate).slice(0, 10) : ''
                const isBeforeStart = Boolean(startDateStr && startDateStr > todayStr)
                const isCancelled = enr.status === 'Cancelled' || enr.sessionStatus === 'Cancelled'
                const canStepUpdate =
                  canUpdateProgress &&
                  !['Completed', 'Failed', 'Cancelled'].includes(enr.status) &&
                  !isCancelled &&
                  !isBeforeStart
                return (
                  <tr key={enr.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-950 text-xs">
                        {enr.employeeName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {enr.employeeId} • {enr.designation}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-[200px] truncate" title={enr.programTitle}>
                      <div>{enr.programTitle}</div>
                      {enr.sessionCode && (
                        <div className="text-[10px] font-mono text-slate-400">
                          {enr.sessionCode} ({enr.sessionStatus || 'Scheduled'})
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                      <div>{enr.enrollmentDate}</div>
                      {isBeforeStart && (
                        <div className="text-[10px] text-amber-700 font-sans font-medium">
                          Starts {startDateStr}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 w-44">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-1">
                        <span>Progress</span>
                        <span className="font-bold">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full transition-all duration-300 ${
                            pct === 100
                              ? 'bg-emerald-500'
                              : pct >= 50
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {canStepUpdate ? (
                        <div className="flex gap-1 mt-1.5">
                          {[25, 50, 75, 100].map((step) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => onUpdateProgress?.(enr.id, step)}
                              className="px-1.5 py-0.2 bg-slate-100 hover:bg-slate-200 rounded text-[9px] font-bold text-slate-600 font-mono"
                            >
                              {step}%
                            </button>
                          ))}
                        </div>
                      ) : canUpdateProgress && isBeforeStart ? (
                        <div className="text-[10px] text-amber-700 mt-1">
                          Locked until {startDateStr}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {enr.score !== null && enr.score !== undefined ? (
                        <span className={`font-bold ${enr.score >= passMark ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {enr.score}%
                        </span>
                      ) : (
                        <span className="text-slate-400">Not Graded</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        enr.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : enr.status === 'In Progress'
                          ? 'bg-blue-100 text-blue-800'
                          : enr.status === 'Enrolled'
                          ? 'bg-purple-100 text-purple-800'
                          : enr.status === 'Failed'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {enr.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] max-w-[180px] truncate" title={enr.evaluatorFeedback || ''}>
                      {enr.evaluatorFeedback || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canEvaluate && (
                        enr.status === 'Completed' ? (
                          <span className="inline-block px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                            {enr.certificateNumber ? `Certified` : 'Completed'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenAssessment?.(enr)}
                            className="px-2.5 py-1 text-xs font-bold bg-navy-950 text-white hover:bg-navy-900 rounded transition-colors shadow-2xs"
                          >
                            Grade / Certify
                          </button>
                        )
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
  )
}
