import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import Alert from '@/components/common/Alert'
import { formatTimeTo12Hour } from '@/lib/dateUtils'

export function AttendanceCorrectionsTab({
  corrections = [],
  currentUser = null,
  onOpenNewCorrectionModal,
  onApproveCorrection,
  onRejectCorrection,
  onEscalateCorrection
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedCorrection, setSelectedCorrection] = useState(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const isEmployee = currentUser?.role === 'employee'
  const isTeamLead = currentUser?.role === 'team_lead'
  const isManager = currentUser?.role === 'manager'
  const isHrAdmin = currentUser?.role === 'hr_admin' || currentUser?.role === 'super_admin'

  const filtered = (corrections || []).filter((c) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        if (!c?.status?.toLowerCase().includes('pending')) return false
      } else if (c?.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
    }
    return true
  })

  // Default Latest First (descending) sorting
  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.attendanceDate || a.date || a.createdAt || ''
    const dateB = b.attendanceDate || b.date || b.createdAt || ''
    return dateB.localeCompare(dateA)
  })

  const handleApprove = async (c) => {
    try {
      setErrorMessage(null)
      c.status = 'Approved'
      setSelectedCorrection(null)
      setDecisionNotes('')
      setSuccessMessage(`Correction request ${c.requestCode || c.id} approved. Canonical attendance recalculated.`)
      setTimeout(() => setSuccessMessage(null), 4000)
      if (onApproveCorrection) {
        await onApproveCorrection(c.id, decisionNotes || 'Attendance regularized', currentUser?.name, currentUser?.role, currentUser?.employeeId, { isFinalApproval: true })
      }
    } catch (err) {
      c.status = 'Pending Review'
      setErrorMessage(err.message)
    }
  }

  const handleReject = async (c) => {
    try {
      setErrorMessage(null)
      c.status = 'Rejected'
      setSelectedCorrection(null)
      setDecisionNotes('')
      setSuccessMessage(`Correction request ${c.requestCode || c.id} rejected. Official attendance remains unmodified.`)
      setTimeout(() => setSuccessMessage(null), 4000)
      if (onRejectCorrection) {
        await onRejectCorrection(c.id, decisionNotes || 'Correction declined', currentUser?.name, currentUser?.role, currentUser?.employeeId)
      }
    } catch (err) {
      c.status = 'Pending Review'
      setErrorMessage(err.message)
    }
  }

  const handleEscalate = (c) => {
    try {
      setErrorMessage(null)
      onEscalateCorrection?.(c.id, decisionNotes || 'Authority threshold exceeded', currentUser?.name, currentUser?.role)
      setSelectedCorrection(null)
      setDecisionNotes('')
      setSuccessMessage(`Correction request ${c.id} escalated to next tier authority.`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setErrorMessage(err.message)
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

      {/* Header bar */}
      <div className="bg-white p-4 rounded-lg border border-hrms-border shadow-hrms-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-hrms-primary">Attendance Regularization & Missed Punch Queue</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-preserving corrections workflow for missed check-in/out, wrong shifts, and exception regularization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs p-2 border border-slate-300 rounded bg-white"
          >
            <option value="all">All Correction Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          {onOpenNewCorrectionModal && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenNewCorrectionModal}
              className="bg-hrms-primary text-white"
            >
              <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
              Request Correction
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3">Correction ID & Staff</th>
                <th className="p-3">Attendance Date</th>
                <th className="p-3">Type & Reason</th>
                <th className="p-3">Original vs Requested</th>
                <th className="p-3">Current Approver Tier</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-400 italic">
                    No attendance correction requests recorded.
                  </td>
                </tr>
              ) : (
                sorted.map((c) => {
                  const isPending = c?.status?.toLowerCase().includes('pending')

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{c.employeeName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.id} • {c.departmentName}</div>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-700">
                        {c.attendanceDate}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-hrms-primary text-[11px]">{c.correctionType}</div>
                        {c.intendedShiftName && (
                          <div className="text-[10px] text-blue-700 font-semibold mt-0.5">
                            Shift: {c.intendedShiftName}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{c.reason}</div>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <div className="text-slate-400 line-through">
                          Original: {c.originalCheckIn ? formatTimeTo12Hour(c.originalCheckIn) : 'None'} - {c.originalCheckOut ? formatTimeTo12Hour(c.originalCheckOut) : 'None'}
                        </div>
                        <div className="font-bold text-emerald-700">
                          Requested: {c.requestedCheckIn ? formatTimeTo12Hour(c.requestedCheckIn) : '—'} - {c.requestedCheckOut ? formatTimeTo12Hour(c.requestedCheckOut) : '—'}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                          {c.currentApproverRole}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedCorrection(c)}
                          className="px-2.5 py-1 text-[11px] font-bold text-hrms-accent bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                        >
                          {isPending && !isEmployee ? 'Review & Decide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision / Detail Modal */}
      {selectedCorrection && (
        <Modal
          isOpen={Boolean(selectedCorrection)}
          onClose={() => {
            setSelectedCorrection(null)
            setDecisionNotes('')
          }}
          title={`Review Attendance Regularization: ${selectedCorrection.id}`}
          description={`Applicant: ${selectedCorrection.employeeName} (${selectedCorrection.employeeId}) • Date: ${selectedCorrection.attendanceDate}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs text-left">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Correction Type</span>
                <div className="font-bold text-hrms-primary">{selectedCorrection.correctionType}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Current Tier</span>
                <div className="font-bold text-slate-800">{selectedCorrection.currentApproverRole}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Original Punches</span>
                <div className="font-mono text-slate-500">
                  {selectedCorrection.originalCheckIn || 'Missing'} to {selectedCorrection.originalCheckOut || 'Missing'}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Requested Punches</span>
                <div className="font-mono font-bold text-emerald-700">
                  {selectedCorrection.requestedCheckIn || '—'} to {selectedCorrection.requestedCheckOut || '—'}
                </div>
              </div>
              {selectedCorrection.intendedShiftName && (
                <div className="col-span-2 bg-blue-50/70 p-2 rounded border border-blue-200">
                  <span className="text-blue-600 text-[10px] uppercase font-bold">Intended / Correct Shift</span>
                  <div className="font-bold text-blue-900">{selectedCorrection.intendedShiftName}</div>
                </div>
              )}
            </div>

            {selectedCorrection.decidedBy && (
              <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500 font-bold block mb-1">Final Decision Determination:</span>
                <div className="text-slate-700 font-semibold">
                  Decided by: <span className="text-slate-900 font-bold">{selectedCorrection.decidedBy}</span>
                  {selectedCorrection.decidedRole && ` (${selectedCorrection.decidedRole})`}
                  {selectedCorrection.decidedAt && <span className="text-slate-500 font-mono text-[11px] ml-2">at {selectedCorrection.decidedAt}</span>}
                </div>
                {selectedCorrection.decisionNotes && (
                  <div className="text-slate-600 italic mt-1">"{selectedCorrection.decisionNotes}"</div>
                )}
              </div>
            )}

            <div>
              <span className="text-slate-500 font-bold block mb-1">Employee's Stated Reason:</span>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-800">
                {selectedCorrection.reason}
              </div>
            </div>

            {selectedCorrection.supportingReference && (
              <div className="text-[11px] text-slate-500">
                <strong>Supporting Reference: </strong> {selectedCorrection.supportingReference}
              </div>
            )}

            {/* Audit History */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">Audit & Escalation Trail</h4>
              <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                {(selectedCorrection.approvalHistory || []).map((h, idx) => (
                  <div key={idx} className="relative text-xs">
                    <div className="font-semibold text-slate-800">
                      <span className="text-hrms-accent font-bold">{h.status}</span> by {h.actor}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{h.timestamp}</div>
                    {h.note && <p className="text-slate-600 italic text-[11px] mt-0.5">{h.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Decision Controls if pending and not self */}
            {selectedCorrection?.status?.toLowerCase().includes('pending') && !isEmployee && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                {String(currentUser?.role || '').toLowerCase() !== 'super_admin' &&
                currentUser?.employeeId === selectedCorrection.employeeId ? (
                  <div className="p-2.5 bg-amber-50 text-amber-800 rounded border border-amber-200 text-xs font-semibold flex items-center gap-2">
                    <AppIcon name="lock" className="w-3.5 h-3.5" />
                    Self-Approval Guard: You cannot review or approve your own attendance request.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Approver Decision / Audit Remarks:
                      </label>
                      <textarea
                        rows="2"
                        placeholder="Add justification or reference..."
                        value={decisionNotes}
                        onChange={(e) => setDecisionNotes(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-hrms-accent"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      {(isManager || isTeamLead || isHrAdmin) && (
                        <button
                          type="button"
                          onClick={() => handleEscalate(selectedCorrection)}
                          className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded border border-amber-300 cursor-pointer"
                        >
                          Forward to HR Admin
                        </button>
                      )}

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => handleReject(selectedCorrection)}
                          className="px-3 py-1.5 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-300 cursor-pointer"
                        >
                          Decline Request
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(selectedCorrection)}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded shadow-xs cursor-pointer"
                        >
                          Approve Regularization
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default AttendanceCorrectionsTab
