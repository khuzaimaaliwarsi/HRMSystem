import React, { useState, useEffect } from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Select from '@/components/common/Select'
import Alert from '@/components/common/Alert'
import { formatTimeTo12Hour } from '@/lib/dateUtils'
import { shiftService } from '@/services/shiftService'

export function EditShiftAssignModal({
  isOpen,
  onClose,
  assignment = null,
  shifts = [],
  onSuccess
}) {
  const [shiftId, setShiftId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && assignment) {
      setShiftId(assignment.shiftId || assignment.shiftCuid || shifts[0]?.id || '')
      setEffectiveFrom(assignment.effectiveFrom || '')
      setEffectiveTo(assignment.effectiveTo || assignment.effectiveUntil || '')
      setNotes(assignment.notes || '')
      setError(null)
    }
  }, [isOpen, assignment, shifts])

  if (!isOpen || !assignment) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      if (!effectiveFrom) {
        throw new Error('Effective From date is required.')
      }

      if (effectiveTo && effectiveTo < effectiveFrom) {
        throw new Error('Effective Until date cannot precede Effective From date.')
      }

      const targetId = assignment.id || assignment.cuid
      await shiftService.updateShiftAssignmentAsync(targetId, {
        shiftId,
        effectiveFrom,
        effectiveUntil: effectiveTo || null,
        notes: notes?.trim() || null
      })

      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Failed to update shift assignment.')
    } finally {
      setLoading(false)
    }
  }

  const shiftOptions = shifts.map((s) => ({
    value: s.id,
    label: `${s.name} (${formatTimeTo12Hour(s.startTime)} – ${formatTimeTo12Hour(s.endTime)} • ${s.type})`
  }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Shift Assignment"
      description={`Update effective dates or shift schedule for ${assignment.employeeName || assignment.employeeId}.`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left text-xs">
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Staff Member Info Display */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Assigned Staff</span>
          <div className="font-bold text-slate-900 text-sm mt-0.5">{assignment.employeeName}</div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {assignment.employeeId} {assignment.department ? `• ${assignment.department}` : ''}
          </div>
        </div>

        {/* Shift Selector */}
        <Select
          label="Assigned Shift *"
          options={shiftOptions}
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
        />

        {/* Effective Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Effective From <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Effective Until</label>
              {effectiveTo && (
                <button
                  type="button"
                  onClick={() => setEffectiveTo('')}
                  className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                >
                  Clear (Indefinite)
                </button>
              )}
            </div>
            <input
              type="date"
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono"
              placeholder="Indefinite"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Leave blank for Indefinite</span>
          </div>
        </div>

        {/* Audit Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Notes / Reason for Change</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document reason for assignment modification (e.g., project rescheduling, rotation)..."
            className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={loading} className="bg-blue-600 text-white">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default EditShiftAssignModal

