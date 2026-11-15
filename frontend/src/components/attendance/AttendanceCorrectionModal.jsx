import React, { useState, useMemo } from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Select from '@/components/common/Select'
import Alert from '@/components/common/Alert'
import { getKarachiToday, formatTimeTo12Hour } from '@/lib/dateUtils'
import { shiftService } from '@/services/shiftService'

export function AttendanceCorrectionModal({
  isOpen,
  onClose,
  onSubmit,
  employeeRecord = null,
  currentUser = null
}) {
  const [attendanceDate, setAttendanceDate] = useState(() => employeeRecord?.date || employeeRecord?.attendanceDate || getKarachiToday())
  const [correctionType, setCorrectionType] = useState('Missing Check-Out')
  const [requestedCheckIn, setRequestedCheckIn] = useState(() => employeeRecord?.checkInTime || '09:00')
  const [requestedCheckOut, setRequestedCheckOut] = useState(() => employeeRecord?.checkOutTime || '18:00')
  const [reason, setReason] = useState('')
  const [supportingReference, setSupportingReference] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const availableShifts = useMemo(() => shiftService.getShifts() || [], [])
  const [intendedShiftId, setIntendedShiftId] = useState(() => {
    return employeeRecord?.shiftId || availableShifts[0]?.id || 'SHIFT-01'
  })

  // Synchronize modal state with employeeRecord when opened (Confirmed Bug 3 Fix)
  React.useEffect(() => {
    if (isOpen) {
      setAttendanceDate(employeeRecord?.date || employeeRecord?.attendanceDate || getKarachiToday())
      setRequestedCheckIn(employeeRecord?.checkInTime || employeeRecord?.checkIn || '09:00')
      setRequestedCheckOut(employeeRecord?.checkOutTime || employeeRecord?.checkOut || '18:00')
      if (employeeRecord?.shiftId) {
        setIntendedShiftId(employeeRecord.shiftId)
      } else if (availableShifts[0]?.id) {
        setIntendedShiftId(availableShifts[0].id)
      }
      setReason('')
      setSupportingReference('')
      setError(null)
    }
  }, [isOpen, employeeRecord, availableShifts])

  const shiftOptions = useMemo(() => {
    return availableShifts.map((s) => ({
      value: s.id,
      label: `${s.name} (${formatTimeTo12Hour(s.startTime)} - ${formatTimeTo12Hour(s.endTime)})`
    }))
  }, [availableShifts])

  const handleShiftChange = (newShiftId) => {
    setIntendedShiftId(newShiftId)
    const selected = availableShifts.find((s) => s.id === newShiftId)
    if (selected) {
      if (selected.startTime) setRequestedCheckIn(selected.startTime)
      if (selected.endTime) setRequestedCheckOut(selected.endTime)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Please provide a specific business or technical reason for this correction.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const selectedShift = availableShifts.find((s) => s.id === intendedShiftId)
      await onSubmit?.({
        employeeId: employeeRecord?.employeeId || currentUser?.employeeId || currentUser?.id || 'EMP-004',
        attendanceDate,
        correctionType,
        intendedShiftId: correctionType === 'Wrong Shift Applied' ? intendedShiftId : undefined,
        intendedShiftName: correctionType === 'Wrong Shift Applied' ? (selectedShift?.name || intendedShiftId) : undefined,
        requestedCheckIn,
        requestedCheckOut,
        reason: reason.trim(),
        supportingReference: supportingReference.trim()
      })
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const correctionOptions = [
    { value: 'Missing Check-Out', label: 'Missing Check-Out' },
    { value: 'Missing Check-In', label: 'Missing Check-In' },
    { value: 'Incorrect Punch Time', label: 'Incorrect Punch Time' },
    { value: 'Incorrect Absent Marking', label: 'Incorrect Absent Marking' },
    { value: 'Wrong Shift Applied', label: 'Wrong Shift Applied' },
    { value: 'WFH Regularization', label: 'WFH Regularization' },
    { value: 'Field Duty Regularization', label: 'Field Duty Regularization' }
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Attendance Regularization"
      description="Submit a missed-punch or status adjustment request for manager and HR review."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-left text-xs">
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Attendance Date *</label>
          <input
            type="date"
            required
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
          />
        </div>

        <Select
          label="Adjustment Type *"
          options={correctionOptions}
          value={correctionType}
          onChange={(e) => setCorrectionType(e.target.value)}
        />

        {correctionType === 'Wrong Shift Applied' && (
          <Select
            label="Intended / Correct Shift *"
            options={shiftOptions}
            value={intendedShiftId}
            onChange={handleShiftChange}
          />
        )}

        <div className="grid grid-cols-2 gap-3 items-start">
          <Input
            label="Requested Check-In"
            labelClassName="whitespace-nowrap"
            type="time"
            value={requestedCheckIn}
            onChange={(e) => setRequestedCheckIn(e.target.value)}
          />
          <Input
            label="Requested Check-Out"
            labelClassName="whitespace-nowrap"
            type="time"
            value={requestedCheckOut}
            onChange={(e) => setRequestedCheckOut(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Correction *
          </label>
          <textarea
            rows="3"
            required
            placeholder="Explain reason for missing punch (e.g. power failure, browser session termination, emergency client duty)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-hrms-accent"
          />
        </div>

        <Input
          label="Supporting Ticket / Reference"
          placeholder="e.g. IT Help Desk #992, Client Visitor Pass"
          value={supportingReference}
          onChange={(e) => setSupportingReference(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={loading}>
            Submit for Review
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default AttendanceCorrectionModal

