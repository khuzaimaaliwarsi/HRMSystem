import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function AssessmentReviewModal({
  isOpen,
  onClose,
  enrollment = null,
  onFinalize
}) {
  const [score, setScore] = useState(85)
  const [status, setStatus] = useState('Completed')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const passMark = Number(enrollment?.passingScore) || 70

  React.useEffect(() => {
    setError('')
    setSaving(false)
    if (enrollment) {
      const s = enrollment.score !== null && enrollment.score !== undefined ? Number(enrollment.score) : 85
      const threshold = Number(enrollment.passingScore) || 70
      setScore(s)
      setStatus(s < threshold ? 'Failed' : 'Completed')
      setFeedback(enrollment.evaluatorFeedback || '')
    }
  }, [enrollment])

  if (!isOpen || !enrollment) return null

  const todayStr = new Date().toISOString().slice(0, 10)
  const startDateStr = enrollment.startDate ? String(enrollment.startDate).slice(0, 10) : ''
  const isBeforeStart = Boolean(startDateStr && startDateStr > todayStr)
  const isAlreadyCompleted = enrollment.status === 'Completed'
  const isCancelled = enrollment.status === 'Cancelled' || enrollment.sessionStatus === 'Cancelled'
  const isLocked = isBeforeStart || isAlreadyCompleted || isCancelled

  const handleScoreChange = (val) => {
    if (val === '') {
      setScore('')
      return
    }
    const num = Number(val)
    setScore(num)
    if (Number.isFinite(num)) {
      setStatus(num >= passMark ? 'Completed' : 'Failed')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving || isLocked) return
    setError('')

    const numericScore = Number(score)
    if (score === '' || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
      setError('Score must be a valid number between 0 and 100.')
      return
    }

    if (status === 'Completed' && numericScore < passMark) {
      setError(`Score (${numericScore}%) is below the required pass mark of ${passMark}%.`)
      return
    }

    setSaving(true)
    try {
      await onFinalize(enrollment.id, {
        score: numericScore,
        status,
        feedback: feedback.trim()
      })
      onClose()
    } catch (err) {
      setError(err?.message || 'Error saving assessment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg text-left overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-navy-950 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Grade Assessment &amp; Award Certificate</h3>
            <p className="text-xs text-slate-300">
              {enrollment.employeeName} ({enrollment.employeeId}) • {enrollment.programTitle}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-800 rounded-lg border border-rose-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
              <span>{error}</span>
            </div>
          )}

          {isBeforeStart && (
            <div className="p-3 text-xs bg-amber-50 text-amber-900 rounded-lg border border-amber-200 flex items-center gap-2">
              <i className="fa-solid fa-calendar-xmark text-amber-600"></i>
              <span>Assessments cannot be recorded before the training start date ({startDateStr}).</span>
            </div>
          )}

          {isAlreadyCompleted && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200 flex items-center gap-2">
              <i className="fa-solid fa-award text-emerald-600"></i>
              <span>This enrollment is already completed and certified.</span>
            </div>
          )}

          {isCancelled && (
            <div className="p-3 text-xs bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-2">
              <i className="fa-solid fa-ban text-slate-500"></i>
              <span>This enrollment or training cohort is cancelled.</span>
            </div>
          )}

          {!isLocked && enrollment.sessionId && enrollment.sessionStatus !== 'Completed' && (
            <div className="p-3 text-xs bg-amber-50 text-amber-900 rounded-lg border border-amber-200 flex items-center gap-2">
              <i className="fa-solid fa-clock text-amber-600"></i>
              <span>
                Cohort <strong>{enrollment.sessionCode || enrollment.sessionId}</strong> is currently <strong>{enrollment.sessionStatus || 'Scheduled'}</strong>. Passing and certification require cohort completion and Present attendance.
              </span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Course Title:</span>
              <span className="font-bold text-navy-950">{enrollment.programTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Employee:</span>
              <span className="font-semibold text-slate-800">{enrollment.employeeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Progress:</span>
              <span className="font-mono font-bold text-blue-700">{enrollment.progressPercent}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Assessment Score (0 — 100) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                required
                disabled={isLocked || saving}
                value={score}
                onChange={(e) => handleScoreChange(e.target.value)}
                className="w-full text-sm font-bold font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 disabled:opacity-60"
              />
              <span className="text-[10px] text-slate-400">Pass mark is {passMark}%</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Final Result Outcome
              </label>
              <select
                disabled={isLocked || saving}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 disabled:opacity-60"
              >
                <option value="Completed">Completed (Passed)</option>
                <option value="Failed">Failed (Retake Required)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Evaluator Feedback &amp; Practical Assessment Notes
            </label>
            <textarea
              rows="3"
              required
              disabled={isLocked || saving}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Detail observations on technical competency, practical execution, and areas for ongoing development..."
              className="w-full text-xs border border-slate-300 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 disabled:opacity-60"
            />
          </div>

          {status === 'Completed' && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-2">
              <i className="fa-solid fa-certificate text-emerald-600 text-sm"></i>
              <span>
                <strong>Digital Certificate Auto-Generation:</strong> Saving this passing evaluation will automatically award a verifiable corporate certificate with digital verification code.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLocked || saving}
              className="px-4 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Finalize Evaluation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
