import React, { useState } from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Alert from '@/components/common/Alert'
import { getKarachiToday, normalizeTimeTo24Hour, calculateTimeDuration, formatTimeTo12Hour } from '@/lib/dateUtils'

export function FieldDutyRequestModal({
  isOpen,
  onClose,
  onSubmit,
  currentUser = null
}) {
  const [visitDate, setVisitDate] = useState(() => getKarachiToday())
  const [clientName, setClientName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [location, setLocation] = useState('')
  const [expectedStartTime, setExpectedStartTime] = useState('09:30')
  const [expectedEndTime, setExpectedEndTime] = useState('18:30')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const liveDuration = calculateTimeDuration(expectedStartTime, expectedEndTime)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clientName.trim()) {
      setError('Client or Organization name is required.')
      return
    }
    if (!purpose.trim()) {
      setError('Visit purpose is required.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const normStart = normalizeTimeTo24Hour(expectedStartTime)
      const normEnd = normalizeTimeTo24Hour(expectedEndTime)

      await onSubmit?.({
        employeeId: currentUser?.employeeId || currentUser?.id || 'EMP-001',
        visitDate,
        dutyDate: visitDate,
        date: visitDate,
        clientName: clientName.trim(),
        purpose: purpose.trim(),
        reason: purpose.trim(),
        location: location.trim() || 'Client Premises, Islamabad',
        siteLocation: location.trim() || 'Client Premises, Islamabad',
        clientLocation: location.trim() || 'Client Premises, Islamabad',
        expectedStartTime: normStart,
        expectedEndTime: normEnd,
        startTime: normStart,
        endTime: normEnd
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
      title="Request Client Field Duty"
      description="Authorize official commercial or technical client visits so working time is not marked absent."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-left text-xs">
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Date *</label>
          <input
            type="date"
            required
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
          />
        </div>

        <Input
          label="Client / Partner Organization *"
          required
          placeholder="e.g. Mobilink Microfinance Bank, Telenor Pakistan"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Official Purpose *</label>
          <textarea
            rows="2"
            required
            placeholder="Commercial demonstration, requirements discovery, SLA review..."
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-hrms-accent"
          />
        </div>

        <Input
          label="Visit Location / Address"
          placeholder="Client HQ, Blue Area, Islamabad"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Expected Start"
            type="text"
            placeholder="09:30 AM or 09:30"
            value={expectedStartTime}
            onChange={(e) => setExpectedStartTime(e.target.value)}
          />
          <Input
            label="Expected End"
            type="text"
            placeholder="11:30 AM or 18:30"
            value={expectedEndTime}
            onChange={(e) => setExpectedEndTime(e.target.value)}
          />
        </div>

        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 flex items-center justify-between">
          <span>Estimated Duration: <strong>{liveDuration.formatted}</strong></span>
          <span className="font-mono text-slate-400">({formatTimeTo12Hour(liveDuration.start24)} – {formatTimeTo12Hour(liveDuration.end24)})</span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={loading}>
            Submit Field Duty
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default FieldDutyRequestModal
