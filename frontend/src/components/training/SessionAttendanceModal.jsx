import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function SessionAttendanceModal({
  isOpen,
  onClose,
  session = null,
  onSaveAttendance,
  canEdit = false
}) {
  const [records, setRecords] = useState([])
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  React.useEffect(() => {
    setError('')
    setSuccess('')
    if (session?.attendanceRecords?.length > 0) {
      setRecords(JSON.parse(JSON.stringify(session.attendanceRecords)))
    } else {
      setRecords([])
    }
  }, [session])

  if (!isOpen || !session) return null

  const isClosedCohort = ['Completed', 'Cancelled'].includes(session.status)
  const todayStr = new Date().toISOString().slice(0, 10)
  const startDateStr = session.startDate ? String(session.startDate).slice(0, 10) : ''
  const isBeforeStartDate = Boolean(startDateStr && startDateStr > todayStr)
  const editable = Boolean(canEdit) && !isClosedCohort && !isBeforeStartDate

  const handleUpdateRecord = (index, field, value) => {
    if (!editable) return
    setRecords((prev) =>
      prev.map((record, i) => {
        if (i !== index) return record

        if (field === 'status') {
          return {
            ...record,
            status: value,
            attendanceStatus: value
          }
        }

        if (field === 'attendedHours') {
          const safeHours = Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0)
          return {
            ...record,
            attendedHours: safeHours,
            participationHours: safeHours
          }
        }

        return {
          ...record,
          [field]: value
        }
      })
    )
  }

  const handleSave = async () => {
    if (saving || !editable) return

    setSaving(true)
    setSuccess('')
    setError('')

    try {
      const normalizedRecords = records.map((r) => {
        const safeHours = Math.max(
          0,
          Number.isFinite(Number(r.attendedHours)) ? Number(r.attendedHours) : 0
        )
        const normalizedStatus = r.attendanceStatus || r.status || 'Registered'
        return {
          ...r,
          status: normalizedStatus,
          attendanceStatus: normalizedStatus,
          attendedHours: safeHours,
          participationHours: safeHours,
          remarks: r.remarks || ''
        }
      })

      await onSaveAttendance(session.id, normalizedRecords)
      setSuccess('Attendance saved successfully.')
      onClose()
    } catch (err) {
      setSuccess('')
      setError(err?.message || 'Failed to save cohort attendance.')
      console.error('Attendance save failed:', err)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl text-left overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-navy-950 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Training Cohort Attendance Roster</h3>
            <p className="text-xs text-slate-300">
              {session.programTitle} ({session.sessionCode || session.sessionId || session.id}) — {session.startDate} to {session.endDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <AppIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-blue-600 mt-0.5"></i>
            <div>
              <strong>Controlled Training-Duty Separation:</strong> Training session attendance tracks syllabus participation hours and is distinct from F04 regular biometric office attendance. It does not overwrite worked hours.
            </div>
          </div>

          {isClosedCohort && (
            <div className="p-3 bg-amber-50 text-amber-900 rounded-lg text-xs border border-amber-200 flex items-center gap-2">
              <i className="fa-solid fa-lock text-amber-600"></i>
              <span>This cohort is <strong>{session.status}</strong>. Attendance records are locked in read-only mode.</span>
            </div>
          )}

          {!isClosedCohort && isBeforeStartDate && (
            <div className="p-3 bg-amber-50 text-amber-900 rounded-lg text-xs border border-amber-200 flex items-center gap-2">
              <i className="fa-solid fa-calendar-xmark text-amber-600"></i>
              <span>Attendance cannot be recorded before the cohort start date ({startDateStr}).</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 rounded-lg text-xs border border-rose-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs border border-emerald-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-check text-emerald-600"></i>
              <span>{success}</span>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Participant</th>
                  <th className="py-2.5 px-3">Participation Status</th>
                  <th className="py-2.5 px-3">Attended Hours</th>
                  <th className="py-2.5 px-3">Trainer Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-slate-400">
                      No participants registered in this session roster yet.
                    </td>
                  </tr>
                ) : (
                  records.map((r, idx) => (
                    <tr key={r.employeeId} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        <div>{r.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.employeeCode || r.employeeId}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {editable ? (
                          <select
                            value={r.attendanceStatus || r.status || 'Registered'} onChange={(e) => handleUpdateRecord(idx, 'status', e.target.value)}
                            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white font-medium"
                          >
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                            <option value="Excused">Excused (Duty Call)</option>
                            <option value="Registered">Registered</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${(r.attendanceStatus || r.status) === 'Present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (r.attendanceStatus || r.status) === 'Absent'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                            }`}>
                            {r.attendanceStatus || r.status || 'Registered'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {editable ? (
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={r.attendedHours !== undefined ? r.attendedHours : 0}
                            onChange={(e) => handleUpdateRecord(idx, 'attendedHours', Number(e.target.value))}
                            className="w-16 border border-slate-300 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          <span>{r.attendedHours || 0} Hours</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {editable ? (
                          <input
                            type="text"
                            value={r.remarks || ''}
                            onChange={(e) => handleUpdateRecord(idx, 'remarks', e.target.value)}
                            placeholder="Add evaluation note..."
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          <span className="text-slate-600 text-[11px]">{r.remarks || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Close
            </button>
            {editable && records.length > 0 && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm transition-all"
              >
                {saving ? 'Saving...' : 'Save Attendance Record'}
              </button>)}
          </div>
        </div>
      </div>
    </div>
  )
}
