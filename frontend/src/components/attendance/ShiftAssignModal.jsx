import React, { useState, useEffect } from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Select from '@/components/common/Select'
import Alert from '@/components/common/Alert'
import { formatTimeTo12Hour } from '@/lib/dateUtils'

export function ShiftAssignModal({
  isOpen,
  onClose,
  onSubmitIndividual,
  onSubmitTeam,
  employees = [],
  teams = [],
  shifts = []
}) {
  const [assignmentMode, setAssignmentMode] = useState('individual') // 'individual' | 'team'
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '')
  const [teamId, setTeamId] = useState(teams[0]?.id || '')
  const [shiftId, setShiftId] = useState('')
  useEffect(() => {
    if (isOpen && shifts.length > 0) {
      setShiftId(shifts[0].id)
    }
    if (isOpen && teams.length > 0 && !teamId) {
      setTeamId(teams[0].id)
    }
    if (isOpen && employees.length > 0 && !employeeId) {
      setEmployeeId(employees[0].id)
    }
  }, [isOpen, shifts, teams, employees])

  const [effectiveFrom, setEffectiveFrom] = useState('2026-10-27')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const selectedTeam = teams.find((t) => t.id === teamId || t.code === teamId)
  const teamEmployees = employees.filter(
    (e) => e.teamId === teamId || e.team === teamId || (selectedTeam?.code && e.teamCode === selectedTeam.code)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      if (effectiveTo && effectiveTo < effectiveFrom) {
        throw new Error('Effective Until date cannot precede Effective From date.')
      }

      if (assignmentMode === 'individual') {
        await onSubmitIndividual?.({
          employeeId,
          shiftId,
          effectiveFrom,
          effectiveTo: effectiveTo || null
        })
      } else {
        await onSubmitTeam?.({
          teamId,
          shiftId,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          overrideOverlapping: true
        })
      }
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.name} (${e.id} • ${e.department || 'Staff'})`
  }))

  const teamOptions = teams.map((t) => {
    const dept = t.departmentName || t.department?.name || t.code || 'Team'
    return {
      value: t.id,
      label: `${t.name} (${dept})`
    }
  })

  const shiftOptions = shifts.map((s) => ({
    value: s.id,
    label: `${s.name} (${formatTimeTo12Hour(s.startTime)} – ${formatTimeTo12Hour(s.endTime)} • ${s.type})`
  }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Shift to Staff or Team"
      description="Schedule an effective-dated shift assignment for an individual employee or an entire team roster."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-left text-xs">
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => setAssignmentMode('individual')}
            className={`w-1/2 py-1 text-xs font-bold rounded ${assignmentMode === 'individual' ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600'}`}
          >
            Individual Staff
          </button>
          <button
            type="button"
            onClick={() => setAssignmentMode('team')}
            className={`w-1/2 py-1 text-xs font-bold rounded ${assignmentMode === 'team' ? 'bg-white text-hrms-primary shadow-xs' : 'text-slate-600'}`}
          >
            Entire Team Roster
          </button>
        </div>

        {assignmentMode === 'individual' ? (
          <Select
            label="Select Staff Member *"
            options={employeeOptions}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        ) : (
          <div className="space-y-2">
            <Select
              label="Select Functional Team *"
              options={teamOptions}
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            />
            <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5">
              <div className="flex items-center justify-between text-blue-900 font-semibold mb-1">
                <span>Team Roster Preview</span>
                <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-[10px] font-bold">
                  {teamEmployees.length > 0 ? `${teamEmployees.length} Active Staff` : 'All Active Staff'}
                </span>
              </div>
              <p className="text-[11px] text-blue-700 leading-normal">
                Applying to <strong>{selectedTeam?.name || 'Selected Team'}</strong>. Existing assignments will be smoothly updated with effective-dating.
              </p>
            </div>
          </div>
        )}

        <Select
          label="Shift to Assign *"
          options={shiftOptions}
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Effective From *</label>
            <input
              type="date"
              required
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Until (Optional)</label>
            <input
              type="date"
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-500 italic">
          Note: If a future effective date is selected, current active shift assignments will remain unchanged until that date arrives.
        </p>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={loading}>
            Confirm Assignment
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ShiftAssignModal
