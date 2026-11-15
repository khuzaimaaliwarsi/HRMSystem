import React, { useState } from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Alert from '@/components/common/Alert'
import { getKarachiToday } from '@/lib/dateUtils'

export function OvertimeRequestModal({
  isOpen,
  onClose,
  onSubmit,
  currentUser = null
}) {
  const [overtimeDate, setOvertimeDate] = useState(() => getKarachiToday())
  const [requestedMinutes, setRequestedMinutes] = useState(120) // 2 hours default
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('20:00')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleStartTimeChange = (val) => {
    setStartTime(val)
    if (val && endTime) {
      const [sh, sm] = val.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      let d = (eh * 60 + em) - (sh * 60 + sm)
      if (d <= 0) d += 1440
      setRequestedMinutes(d)
    }
  }

  const handleEndTimeChange = (val) => {
    setEndTime(val)
    if (startTime && val) {
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = val.split(':').map(Number)
      let d = (eh * 60 + em) - (sh * 60 + sm)
      if (d <= 0) d += 1440
      setRequestedMinutes(d)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (Number(requestedMinutes) < 60) {
      setError('Minimum overtime request duration is 60 minutes (1 hour) as per company policy.')
      return
    }
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)

    let duration = (eh * 60 + em) - (sh * 60 + sm)
    if (duration <= 0) duration += 1440

    if (!startTime || !endTime || duration < 60 || duration > 480) {
      setError('Overtime duration must be between 60 and 480 minutes.')
      return
    }
    if (!reason.trim()) {
      setError('Operational reason and justification for overtime are required.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSubmit?.({
        employeeId: currentUser?.employeeCuid || currentUser?.employeeId,
        employeeCuid: currentUser?.employeeCuid || currentUser?.employee?.id,
        employeeCode: currentUser?.employeeCode || currentUser?.employeeId,
        overtimeDate,
        startTime,
        endTime,
        requestedMinutes: duration,
        durationMinutes: duration,
        reason: reason.trim()
      })
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Claim Overtime Working Hours"
      description="Submit extra worked time for manager authorization. Approved overtime quantities feed into future payroll."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-left text-xs">
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Overtime Date *</label>
          <input
            type="date"
            required
            value={overtimeDate}
            onChange={(e) => setOvertimeDate(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Overtime Start Time *
            </label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Overtime End Time *
            </label>
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Extra Working Time (Minutes) *
          </label>
          <input
            type="number"
            step="15"
            min="60"
            max="480"
            required
            value={requestedMinutes}
            onChange={(e) => setRequestedMinutes(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Equivalent to <strong>{(Number(requestedMinutes) / 60).toFixed(1)} hours</strong> (Min 60m required by company policy)
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Operational Justification *
          </label>
          <textarea
            rows="3"
            required
            placeholder="Emergency hotfix deployment, weekend client migration, server incident response..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-hrms-accent"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={loading}>
            Submit Overtime
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default OvertimeRequestModal
