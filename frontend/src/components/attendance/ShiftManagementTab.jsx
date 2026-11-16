import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/common/Button'
import Alert from '@/components/common/Alert'
import Modal from '@/components/common/Modal'
import { formatTimeTo12Hour } from '@/lib/dateUtils'

export function ShiftManagementTab({
  shifts = [],
  onOpenCreateShiftModal,
  onOpenEditShiftModal,
  onToggleShiftStatus,
  onDeleteShift,
  canManageShifts = true
}) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [viewingShift, setViewingShift] = useState(null)
  const [deletingShift, setDeletingShift] = useState(null)

  const filteredShifts = shifts.filter((s) => {
    if (typeFilter !== 'all' && s.type.toLowerCase() !== typeFilter.toLowerCase()) return false
    if (statusFilter !== 'all' && s.status.toLowerCase() !== statusFilter.toLowerCase()) return false
    return true
  })

  const handleToggle = async (id) => {
    try {
      setErrorMessage(null)
      const newStatus = await onToggleShiftStatus?.(id)
      setSuccessMessage(`Shift status changed successfully.`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || err.message)
    }
  }

  const handleDelete = async (shift) => {
    try {
      setErrorMessage(null)
      if (shift.isDefault) {
        throw new Error(`Cannot delete default corporate shift '${shift.name}'. Designate another default shift first.`)
      }
      await onDeleteShift?.(shift.id)
      setDeletingShift(null)
      setSuccessMessage(`Shift '${shift.name}' deleted successfully.`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || err.message)
      setDeletingShift(null)
    }
  }

  return (
    <div className="space-y-4 text-left">
      {errorMessage && (
        <Alert variant="danger" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-hrms-border shadow-hrms-card">
        <div>
          <h3 className="text-sm font-bold text-hrms-primary">Company Shift Master Configurations</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable working schedules supporting Fixed, Flexible, Part-Time, Hourly, and Overnight arrangements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs p-2 border border-slate-300 rounded bg-white"
          >
            <option value="all">All Shift Types</option>
            <option value="Fixed">Fixed Schedule</option>
            <option value="Flexible">Flexible Arrival</option>
            <option value="Part-Time">Part-Time</option>
            <option value="Hourly">Hourly Schedule</option>
            <option value="Overnight">Overnight (Midnight-Crossing)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs p-2 border border-slate-300 rounded bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>

          {canManageShifts && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenCreateShiftModal}
              className="bg-hrms-primary text-white"
            >
              <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
              New Shift
            </Button>
          )}
        </div>
      </div>

      {/* Shifts Table */}
      <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3">Shift Title & Code</th>
                <th className="p-3">Schedule Type</th>
                <th className="p-3">Operating Hours</th>
                <th className="p-3">Break & Rules</th>
                <th className="p-3">Grace / Flex Window</th>
                <th className="p-3">Working Days</th>
                <th className="p-3 text-center">Status</th>
                {canManageShifts && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-slate-400 italic">
                    No shift configurations match selected filters.
                  </td>
                </tr>
              ) : (
                filteredShifts.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{s.name}</span>
                        {s.isDefault && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                          {s.code}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{s.id}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {(() => {
                        const rawType = String(s.type || '').toUpperCase().replace('-', '_')
                        const isOvernight = rawType === 'OVERNIGHT' || s.type === 'Overnight'
                        const isFlexible = rawType === 'FLEXIBLE' || s.type === 'Flexible'
                        const isPartTime = rawType === 'PART_TIME' || s.type === 'Part-Time'
                        const isHourly = rawType === 'HOURLY' || s.type === 'Hourly'
                        const isRotating = rawType === 'ROTATING' || s.type === 'Rotating'
                        const label = isOvernight ? 'Overnight' :
                          isFlexible ? 'Flexible' :
                          isPartTime ? 'Part-Time' :
                          isHourly ? 'Hourly' :
                          isRotating ? 'Rotating' : 'Fixed'
                        return (
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                            isOvernight ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            isFlexible ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            isPartTime ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            isHourly ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            isRotating ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700">
                      <div>{formatTimeTo12Hour(s.startTime)} – {formatTimeTo12Hour(s.endTime)}</div>
                      <div className="text-[10px] text-slate-500 font-sans font-normal">
                        Expected: {s.expectedWorkingHours}h
                      </div>
                    </td>
                    <td className="p-3 text-slate-600">
                      <div>{s.breakMinutes} mins ({s.paidBreak ? 'Paid' : 'Unpaid'})</div>
                      <div className="text-[10px] text-slate-400">{s.overtimeEligible ? 'Overtime Eligible' : 'No Overtime'}</div>
                    </td>
                    <td className="p-3 text-slate-600">
                      {s.type === 'Flexible' && s.flexibleArrivalWindow ? (
                        <div className="font-mono text-[11px] text-blue-700 font-semibold">
                          Arrival: {formatTimeTo12Hour(s.flexibleArrivalWindow.start)} – {formatTimeTo12Hour(s.flexibleArrivalWindow.end)}
                        </div>
                      ) : (
                        <div>Grace: <strong>{s.gracePeriodMinutes} mins</strong></div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-[11px] text-slate-600 font-medium">
                        {(s.weeklyWorkingDays || []).join(', ')}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={s.status} />
                    </td>
                    {canManageShifts && (
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. VIEW */}
                          <button
                            type="button"
                            onClick={() => setViewingShift(s)}
                            title="View Shift Details"
                            className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center justify-center transition border border-transparent hover:border-slate-300 cursor-pointer"
                          >
                            <AppIcon name="view" className="w-3.5 h-3.5" />
                          </button>

                          {/* 2. EDIT */}
                          <button
                            type="button"
                            onClick={() => onOpenEditShiftModal?.(s)}
                            title="Edit Shift"
                            className="w-7 h-7 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 inline-flex items-center justify-center transition border border-transparent hover:border-blue-200 cursor-pointer"
                          >
                            <AppIcon name="edit" className="w-3.5 h-3.5 text-blue-600" />
                          </button>

                          {/* 3. STATUS TOGGLE (PLAY / PAUSE) */}
                          <button
                            type="button"
                            onClick={() => handleToggle(s.id)}
                            title={s.status === 'Active' ? 'Deactivate Shift' : 'Activate Shift'}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border border-transparent cursor-pointer ${
                              s.status === 'Active'
                                ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200'
                                : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200'
                            }`}
                          >
                            <AppIcon name={s.status === 'Active' ? 'pause' : 'play'} className="w-3.5 h-3.5" />
                          </button>

                          {/* 4. DELETE */}
                          <button
                            type="button"
                            onClick={() => setDeletingShift(s)}
                            disabled={Boolean(s.isDefault)}
                            title={s.isDefault ? 'Default shift cannot be deleted' : 'Delete Shift'}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border border-transparent ${
                              s.isDefault
                                ? 'text-slate-300 cursor-not-allowed opacity-40'
                                : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 cursor-pointer'
                            }`}
                          >
                            <AppIcon name="trash" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW SHIFT MODAL */}
      {viewingShift && (
        <Modal
          isOpen={Boolean(viewingShift)}
          onClose={() => setViewingShift(null)}
          title={`Shift Details: ${viewingShift.name}`}
          description={`Configuration and policy parameters for code ${viewingShift.code}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs text-left">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Shift Code</span>
                <span className="font-mono font-bold text-slate-800">{viewingShift.code}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Schedule Type</span>
                <span className="font-semibold text-slate-800">{viewingShift.type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Operating Hours</span>
                <span className="font-semibold text-slate-800">
                  {formatTimeTo12Hour(viewingShift.startTime)} – {formatTimeTo12Hour(viewingShift.endTime)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Expected Hours</span>
                <span className="font-semibold text-slate-800">{viewingShift.expectedWorkingHours}h</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Break Duration</span>
                <span className="font-semibold text-slate-800">
                  {viewingShift.breakMinutes} mins ({viewingShift.paidBreak ? 'Paid' : 'Unpaid'})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Grace / Flex Window</span>
                <span className="font-semibold text-slate-800">
                  {viewingShift.type === 'Flexible' && viewingShift.flexibleArrivalWindow
                    ? `${formatTimeTo12Hour(viewingShift.flexibleArrivalWindow.start)} – ${formatTimeTo12Hour(viewingShift.flexibleArrivalWindow.end)}`
                    : `${viewingShift.gracePeriodMinutes || 0} mins`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Overtime Policy</span>
                <span className="font-semibold text-slate-800">
                  {viewingShift.overtimeEligible ? 'Eligible' : 'Not Eligible'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                <StatusBadge status={viewingShift.status} />
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Working Days</span>
              <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                {(viewingShift.weeklyWorkingDays || []).join(', ')}
              </p>
            </div>

            {viewingShift.description && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Description</span>
                <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                  {viewingShift.description}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setViewingShift(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE SHIFT CONFIRMATION MODAL */}
      {deletingShift && (
        <Modal
          isOpen={Boolean(deletingShift)}
          onClose={() => setDeletingShift(null)}
          title={`Confirm Shift Deletion`}
          description={`Are you sure you want to permanently delete '${deletingShift.name}' (${deletingShift.code})?`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs text-left">
            <p className="text-slate-600">
              This action will remove the shift configuration. Only shifts with zero currently assigned active employees can be deleted.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setDeletingShift(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(deletingShift)}>
                Delete Shift
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default ShiftManagementTab
