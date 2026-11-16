import React, { useState } from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Select from '@/components/common/Select'
import Alert from '@/components/common/Alert'
import { formatTimeTo12Hour } from '@/lib/dateUtils'

function ShiftFormInner({ initialShift = null, onClose, onSubmit }) {
  const [name, setName] = useState(initialShift?.name || '')
  const [code, setCode] = useState(initialShift?.code || '')
  const [type, setType] = useState(initialShift?.type || 'Fixed')
  const [startTime, setStartTime] = useState(initialShift?.startTime || '09:00')
  const [endTime, setEndTime] = useState(initialShift?.endTime || '18:00')
  const [breakMinutes, setBreakMinutes] = useState(initialShift?.breakMinutes ?? 60)
  const [paidBreak, setPaidBreak] = useState(Boolean(initialShift?.paidBreak))
  const [expectedWorkingHours, setExpectedWorkingHours] = useState(initialShift?.expectedWorkingHours ?? 8.0)
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(initialShift?.gracePeriodMinutes ?? 15)
  const [flexStart, setFlexStart] = useState(initialShift?.flexibleArrivalWindow?.start || '08:00')
  const [flexEnd, setFlexEnd] = useState(initialShift?.flexibleArrivalWindow?.end || '11:00')
  const [coreStart, setCoreStart] = useState(initialShift?.coreHoursStart || '11:00')
  const [coreEnd, setCoreEnd] = useState(initialShift?.coreHoursEnd || '16:00')
  const [overtimeEligible, setOvertimeEligible] = useState(initialShift?.overtimeEligible !== undefined ? initialShift.overtimeEligible : true)
  const [isDefault, setIsDefault] = useState(Boolean(initialShift?.isDefault))
  const [description, setDescription] = useState(initialShift?.description || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Shift name is required.')
      return
    }
    if (!code.trim()) {
      setError('Shift code is required.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSubmit?.({
        id: initialShift?.id,
        cuid: initialShift?.cuid,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes),
        paidBreak,
        expectedWorkingHours: Number(expectedWorkingHours),
        gracePeriodMinutes: Number(gracePeriodMinutes),
        flexibleArrivalWindow: type === 'Flexible' ? { start: flexStart, end: flexEnd } : null,
        coreHoursStart: type === 'Flexible' ? coreStart : null,
        coreHoursEnd: type === 'Flexible' ? coreEnd : null,
        overtimeEligible,
        isDefault,
        description: description.trim()
      })
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs text-left">
      {error && <Alert type="error">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Shift Name *"
          placeholder="e.g. Engineering Regular Shift"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Shift Code *"
          placeholder="e.g. S-DEV-01"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Select
          label="Shift Type *"
          placeholder=""
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={[
            { value: 'Fixed', label: 'Fixed Shift' },
            { value: 'Flexible', label: 'Flexible Shift' },
            { value: 'Part-Time', label: 'Part-Time Shift' },
            { value: 'Hourly', label: 'Hourly Schedule' },
            { value: 'Overnight', label: 'Overnight Shift' },
            { value: 'Rotating', label: 'Rotating Shift' }
          ]}
        />
        <Input
          type="time"
          label={`Start Time * ${startTime ? `(${formatTimeTo12Hour(startTime)})` : ''}`}
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
        <Input
          type="time"
          label={`End Time * ${endTime ? `(${formatTimeTo12Hour(endTime)})` : ''}`}
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />
      </div>

      {type === 'Flexible' && (
        <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2">
          <div className="font-bold text-hrms-accent flex items-center gap-1.5">
            <span>Flexible Hours Configuration</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="time"
              label={`Arrival Window (From) ${flexStart ? `(${formatTimeTo12Hour(flexStart)})` : ''}`}
              value={flexStart}
              onChange={(e) => setFlexStart(e.target.value)}
            />
            <Input
              type="time"
              label={`Arrival Window (To) ${flexEnd ? `(${formatTimeTo12Hour(flexEnd)})` : ''}`}
              value={flexEnd}
              onChange={(e) => setFlexEnd(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="time"
              label={`Mandatory Core (From) ${coreStart ? `(${formatTimeTo12Hour(coreStart)})` : ''}`}
              value={coreStart}
              onChange={(e) => setCoreStart(e.target.value)}
            />
            <Input
              type="time"
              label={`Mandatory Core (To) ${coreEnd ? `(${formatTimeTo12Hour(coreEnd)})` : ''}`}
              value={coreEnd}
              onChange={(e) => setCoreEnd(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Input
          type="number"
          label="Expected Work Hours"
          step="0.5"
          min="1"
          max="16"
          value={expectedWorkingHours}
          onChange={(e) => setExpectedWorkingHours(e.target.value)}
        />
        <Input
          type="number"
          label="Grace Period (Minutes)"
          min="0"
          max="60"
          value={gracePeriodMinutes}
          onChange={(e) => setGracePeriodMinutes(e.target.value)}
        />
        <Input
          type="number"
          label="Break Duration (Min)"
          min="0"
          max="180"
          value={breakMinutes}
          onChange={(e) => setBreakMinutes(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-6 p-2.5 bg-slate-50 rounded border border-slate-200">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded text-hrms-accent"
          />
          <span className="font-bold text-hrms-primary">Set as Default Shift</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
          <input
            type="checkbox"
            checked={paidBreak}
            onChange={(e) => setPaidBreak(e.target.checked)}
            className="rounded text-hrms-accent"
          />
          <span>Break is Paid</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
          <input
            type="checkbox"
            checked={overtimeEligible}
            onChange={(e) => setOvertimeEligible(e.target.checked)}
            className="rounded text-hrms-accent"
          />
          <span>Eligible for Overtime</span>
        </label>
      </div>

      <Input
        label="Shift Description / Policy Notes"
        placeholder="Applicable teams, operational scope..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
        <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" loading={loading}>
          {initialShift ? 'Save Changes' : 'Create Shift'}
        </Button>
      </div>
    </form>
  )
}

export function ShiftFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialShift = null
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialShift ? `Edit Shift: ${initialShift.name}` : 'Create New Shift Definition'}
      description="Configure shift timings, grace periods, flexible arrival window, and overtime rules."
      maxWidth="max-w-xl"
    >
      {isOpen && (
        <ShiftFormInner
          key={initialShift?.id || 'new'}
          initialShift={initialShift}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </Modal>
  )
}

export default ShiftFormModal
