import React, { useState, useMemo } from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'
import { LEAVE_TYPES } from '@/mocks/leaveData'
import { leavePolicyService } from '@/services/leavePolicyService'

export function LeaveAdjustmentModal({
  isOpen,
  onClose,
  employees = [],
  onApplyAdjustment,
  currentUser = null
}) {
  const availableTypes = useMemo(() => {
    const raw = leavePolicyService?.getAllLeaveTypes?.() || []
    const types = raw.length > 0 ? raw : LEAVE_TYPES
    const nameGroups = new Map()
    types.forEach((t) => {
      const baseName = t.name || 'Ops Leave'
      if (!nameGroups.has(baseName)) nameGroups.set(baseName, [])
      nameGroups.get(baseName).push(t)
    })
    return types.map((t) => {
      const baseName = t.name || 'Ops Leave'
      const group = nameGroups.get(baseName) || []
      let displayName = baseName
      if (group.length > 1) {
        const idx = group.findIndex((g) => g.id === t.id)
        displayName = idx !== -1 ? `${baseName} (Slot ${idx + 1})` : `${baseName} (${t.code || t.id.slice(-4)})`
      }
      return { ...t, displayName }
    })
  }, [])

  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '')
  const [leaveTypeId, setLeaveTypeId] = useState('')

  // Keep leaveTypeId initialized when types load
  React.useEffect(() => {
    if (!leaveTypeId && availableTypes.length > 0) {
      setLeaveTypeId(availableTypes[0].id)
    }
  }, [availableTypes, leaveTypeId])
  const [type, setType] = useState('credit') // credit, debit, correction
  const [days, setDays] = useState(1.0)
  const [reason, setReason] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0])
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)

    if (!employeeId) {
      setError('Please select an employee.')
      return
    }
    if (!leaveTypeId) {
      setError('Please select a leave type.')
      return
    }
    const numDays = parseFloat(days)
    if (isNaN(numDays) || numDays <= 0) {
      setError('Days must be a positive number greater than 0.')
      return
    }
    if (!reason || reason.trim().length < 5) {
      setError('Please enter a clear audit justification (minimum 5 characters).')
      return
    }

    try {
      setIsSubmitting(true)
      const adjustedAmount = type === 'debit' ? -Math.abs(numDays) : Math.abs(numDays)

      onApplyAdjustment?.({
        employeeId,
        leaveTypeId,
        type,
        days: adjustedAmount,
        reason: reason.trim(),
        effectiveDate,
        adjustedBy: currentUser?.name || 'Super Admin',
        adjustedByRole: currentUser?.role || 'super_admin'
      })

      setIsSubmitting(false)
      onClose?.()
    } catch (err) {
      setIsSubmitting(false)
      setError(err.message || 'Failed to apply balance adjustment.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Authorized Leave Balance Adjustment"
      subtitle="Manual ledger adjustment under Super Admin policy governance with mandatory audit logging."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger" icon="fa-triangle-exclamation">
            {error}
          </Alert>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AppIcon name="fa-shield-halved" className="text-amber-600 text-lg mt-0.5" />
          <div className="text-xs text-amber-800 space-y-0.5">
            <p className="font-semibold">Audited Ledger Operation</p>
            <p>
              Balance adjustments directly mutate the employee's canonical closing balance and entitlement ledger.
              All actions are recorded in the permanent audit trail with your identity, timestamp, and justification.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Target Employee <span className="text-rose-500">*</span>
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-600"
              required
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeId || emp.id}) — {emp.designation || emp.department}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Leave Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-600"
              required
            >
              {availableTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.displayName || lt.name} ({lt.paidTreatment === 'paid' || lt.isPaid ? 'Paid' : 'Unpaid'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Adjustment Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
            >
              <option value="credit">Credit (+) Grant Days</option>
              <option value="debit">Debit (−) Deduct Days</option>
              <option value="correction">Correction / Audit Fix</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Magnitude (Days) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="30"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-600 font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Effective Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-600"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Mandatory Justification / Audit Remark <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="E.g., Approved compensatory off for weekend server migration, statutory leave reconciliation, or onboarding probation adjustment."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-600"
            required
          />
        </div>

        <div className="pt-2 flex justify-end gap-3 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            icon="fa-check"
            className="bg-hrms-primary hover:bg-hrms-primary-hover text-white shadow-xs"
          >
            {isSubmitting ? 'Posting Ledger...' : 'Commit Adjustment'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default LeaveAdjustmentModal
