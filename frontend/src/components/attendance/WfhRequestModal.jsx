import React, { useState, useMemo } from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Alert from '@/components/common/Alert'
import shiftService from '@/services/shiftService'
import employeeService from '@/services/employeeService'
import { getKarachiToday, formatTimeTo12Hour } from '@/lib/dateUtils'

export function WfhRequestModal({
  isOpen,
  onClose,
  onSubmit,
  currentUser = null
}) {
  const [requestedDate, setRequestedDate] = useState(() => getKarachiToday())
  const [reason, setReason] = useState('')
  const [deliverablesPlanned, setDeliverablesPlanned] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const resolvedEmployee = useMemo(() => {
    try {
      const emps = employeeService.getEmployees() || []
      const targetId = currentUser?.employeeId || currentUser?.id
      const found = emps.find(
        (e) =>
          e.cuid === targetId ||
          e.id === targetId ||
          e.employeeCode === targetId ||
          (currentUser?.email && e.email?.toLowerCase() === currentUser.email?.toLowerCase())
      )
      if (found) return found
      if (emps.length > 0) return emps[0]
      return null
    } catch {
      return null
    }
  }, [currentUser])

  const employeeId = resolvedEmployee?.cuid || resolvedEmployee?.id || currentUser?.employeeId || currentUser?.id || 'EMP-001'

  const effectiveShift = useMemo(() => {
    try {
      const shiftId = resolvedEmployee?.shiftId || employeeId
      return shiftService.resolveEmployeeShiftForDate(shiftId, requestedDate) || shiftService.getShiftById('DEV-01') || shiftService.getShiftById('SHF-GEN')
    } catch {
      return shiftService.getShiftById('DEV-01') || shiftService.getShiftById('SHF-GEN')
    }
  }, [resolvedEmployee, employeeId, requestedDate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Please provide a reason for the Work From Home request.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSubmit?.({
        employeeId: resolvedEmployee?.cuid || employeeId,
        employeeCuid: resolvedEmployee?.cuid,
        employeeCode: resolvedEmployee?.employeeCode,
        requestedDate,
        startDate: requestedDate,
        endDate: requestedDate,
        reason: reason.trim(),
        deliverables: deliverablesPlanned.trim() || null,
        deliverablesPlanned: deliverablesPlanned.trim() || null,
        shiftId: effectiveShift?.id || 'DEV-01',
        shiftName: effectiveShift?.name || 'QA Evening Shift',
        shiftStartTime: effectiveShift?.startTime || '16:00',
        shiftEndTime: effectiveShift?.endTime || '00:00',
        expectedWorkingHours: effectiveShift?.expectedWorkingHours || 8.0
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
      title="Request Work From Home (WFH)"
      description="Submit a remote work day request for manager review under the 4-day monthly policy."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-left text-xs">
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Requested WFH Date *</label>
          <input
            type="date"
            required
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
          />
        </div>

        {/* Read-Only Assigned Shift Schedule for Effective Date */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Assigned Shift Schedule</span>
            <span className="text-[11px] font-bold text-navy-800">{effectiveShift?.name || 'General Corporate Day Shift'}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Shift Timings:</span>
            <span className="font-semibold text-navy-900">
              {formatTimeTo12Hour(effectiveShift?.startTime || '09:00')} – {formatTimeTo12Hour(effectiveShift?.endTime || '18:00')}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Target Working Hours:</span>
            <span className="font-semibold text-navy-900">{effectiveShift?.expectedWorkingHours || 8} hrs</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Remote Work *</label>
          <textarea
            rows="2"
            required
            placeholder="Explain context (e.g. focused development, heavy workstation rendering, utility work)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-hrms-accent"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Planned Work Deliverables</label>
          <textarea
            rows="2"
            placeholder="List specific milestones, commits, tasks, or tickets planned for this remote session..."
            value={deliverablesPlanned}
            onChange={(e) => setDeliverablesPlanned(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-hrms-accent"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={loading}>
            Submit WFH Request
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default WfhRequestModal
