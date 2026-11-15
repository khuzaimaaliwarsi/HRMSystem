import React, { useState, useEffect, useMemo } from 'react'
import { employeeService } from '@/services/employeeService'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'

export function SuccessionDeactivationModal({
  isOpen,
  onClose,
  employee,
  allEmployees = [],
  currentActor = 'HR Administrator',
  onSuccess
}) {
  const [dependencies, setDependencies] = useState(null)
  const [successorId, setSuccessorId] = useState('')
  const [reason, setReason] = useState('Resignation and management succession handover')
  const [exitDate, setExitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (employee && isOpen) {
      const deps = employeeService.analyzeManagementDependencies(employee.id)
      setDependencies(deps)
      setSuccessorId('')
      setReason('Resignation and management succession handover')
      setExitDate(new Date().toISOString().slice(0, 10))
      setError(null)
    }
  }, [employee, isOpen])

  // Eligible successors: active employees excluding outgoing manager
  const eligibleSuccessors = useMemo(() => {
    if (!employee) return []
    return allEmployees.filter((e) => e.id !== employee.id && e.status !== 'Separated')
  }, [employee, allEmployees])

  if (!isOpen || !employee) return null

  const hasDependencies = dependencies?.hasDependencies

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (hasDependencies && !successorId) {
      setError('Active management dependencies require assigning a successor before deactivation.')
      return
    }

    try {
      setLoading(true)
      await employeeService.deactivateEmployeeAsync(
        employee.id,
        reason,
        currentActor,
        exitDate,
        hasDependencies ? successorId : null,
        { enforceSuccession: true }
      )

      if (onSuccess) {
        await onSuccess({
          employeeId: employee.id,
          successorId: hasDependencies ? successorId : null
        })
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to separate employee.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-start pt-4 sm:pt-8 pb-8">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 text-left overflow-hidden flex flex-col max-h-[calc(100vh-3rem)] animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-[#102746] text-white flex items-center justify-between shrink-0 border-b border-slate-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center shadow-md shadow-rose-500/30">
              <AppIcon name="user-times" className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {hasDependencies ? 'Management Succession & Separation' : 'Confirm Employee Separation'}
              </h3>
              <p className="text-xs text-slate-300">
                {hasDependencies
                  ? 'Reassign direct reports, teams, and pending approvals to a successor'
                  : 'Mark employee as Separated and preserve historical employment records'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-700">
            {error && (
              <Alert variant="danger" title="Separation Blocked" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Outgoing Employee Info Card */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900 text-sm">{employee.name}</span>
                <div className="text-slate-500">{employee.id} • {employee.designation}</div>
              </div>
              <div className="text-right text-slate-500">
                <div>Department: <span className="font-semibold text-slate-800">{employee.department}</span></div>
                <div>Status: <span className="font-semibold text-emerald-600">{employee.status}</span></div>
              </div>
            </div>

            {/* Management Dependencies Detection Banner */}
            {hasDependencies ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-2 text-amber-800">
                  <AppIcon name="alert-triangle" className="w-4 h-4 text-amber-600" />
                  Active Management Dependencies Detected
                </div>
                <p className="text-amber-800">
                  This employee currently oversees organizational responsibilities. Under company policy, an active successor must be designated before separation:
                </p>
                <ul className="list-disc list-inside space-y-1 font-medium pl-1">
                  {(dependencies?.directReports || []).length > 0 && (
                    <li>
                      <span className="font-bold">{(dependencies?.directReports || []).length}</span> active direct report(s)
                    </li>
                  )}
                  {(dependencies?.managedTeams || []).length > 0 && (
                    <li>
                      <span className="font-bold">{(dependencies?.managedTeams || []).length}</span> managed team(s) / lead assignments
                    </li>
                  )}
                  {(dependencies?.managedDepartments || []).length > 0 && (
                    <li>
                      <span className="font-bold">{(dependencies?.managedDepartments || []).length}</span> managed department(s)
                    </li>
                  )}
                  {(dependencies?.managedSubDepartments || []).length > 0 && (
                    <li>
                      <span className="font-bold">{(dependencies?.managedSubDepartments || []).length}</span> managed sub-department(s)
                    </li>
                  )}
                  {(dependencies?.pendingApprovals || []).length > 0 && (
                    <li>
                      <span className="font-bold">{(dependencies?.pendingApprovals || []).length}</span> pending leave approval request(s)
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                No active management dependencies detected for this employee. The employee will be safely separated.
              </div>
            )}

            {/* Successor Selection (Mandatory if dependencies exist) */}
            {hasDependencies && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Designate Successor *
                </label>
                <select
                  value={successorId}
                  onChange={(e) => setSuccessorId(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="">-- Select Active Successor --</option>
                  {eligibleSuccessors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id}) — {s.designation} ({s.department})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Direct reports, team leads, and pending leave approvals will be atomically transferred to the successor upon separation.
                </p>
              </div>
            )}

            {/* Exit Date & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Separation Effective Date *
                </label>
                <input
                  type="date"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Authorized Actor
                </label>
                <input
                  type="text"
                  value={currentActor}
                  readOnly
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Separation Reason & Notes *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={2}
                placeholder="State the formal exit reason (e.g. Voluntary resignation, end of contract, retirement)..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Processing...' : hasDependencies ? 'Execute Succession & Separate' : 'Confirm Separation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SuccessionDeactivationModal

