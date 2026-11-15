import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Alert from '@/components/common/Alert'
import { cn } from '@/lib/utils'

export function ProbationManagementTab({
  probationRecords = [],
  currentUser = null,
  onSubmitManagerAssessment,
  onSubmitHrReview,
  onFinalizeDecision
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [managerModalRecord, setManagerModalRecord] = useState(null)
  const [hrModalRecord, setHrModalRecord] = useState(null)
  const [decisionModalRecord, setDecisionModalRecord] = useState(null)
  const [viewHistoryRecord, setViewHistoryRecord] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Manager Assessment Form
  const [managerForm, setManagerForm] = useState({
    rating: 4,
    recommendation: 'Confirm Employment',
    comments: ''
  })

  // HR Review Form
  const [hrForm, setHrForm] = useState({
    recommendation: 'Support Confirmation',
    notes: ''
  })

  // Final Decision Form
  const [decisionForm, setDecisionForm] = useState({
    decisionType: 'Confirmed',
    approvalNotes: '',
    extensionMonths: 1,
    newEndDate: ''
  })

  const userRole = currentUser?.role || 'super_admin'
  const isSuperAdmin = userRole === 'super_admin'
  const isHrAdmin = userRole === 'hr_admin' || isSuperAdmin
  const isManager = userRole === 'manager'

  const filteredRecords = probationRecords
    .filter((p) => {
      if (statusFilter !== 'all' && p.currentStatus.toLowerCase() !== statusFilter.toLowerCase()) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        p.employeeName.toLowerCase().includes(q) ||
        p.employeeId.toLowerCase().includes(q) ||
        p.designation.toLowerCase().includes(q) ||
        p.departmentName.toLowerCase().includes(q) ||
        p.managerName.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const dateA = a.joiningDate || a.startDate || a.reviewDueDate || a.id || ''
      const dateB = b.joiningDate || b.startDate || b.reviewDueDate || b.id || ''
      return dateB.localeCompare(dateA)
    })

  const handleManagerSubmit = (e) => {
    e.preventDefault()
    if (!managerModalRecord) return
    try {
      setErrorMsg(null)
      onSubmitManagerAssessment(managerModalRecord.id, managerForm)
      setManagerModalRecord(null)
      setSuccessMsg('Manager probation assessment submitted. Case moved to HR Review queue.')
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleHrSubmit = (e) => {
    e.preventDefault()
    if (!hrModalRecord) return
    try {
      setErrorMsg(null)
      onSubmitHrReview(hrModalRecord.id, hrForm)
      setHrModalRecord(null)
      setSuccessMsg('HR recommendation recorded. Case escalated to Super Admin for final sign-off.')
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleDecisionSubmit = (e) => {
    e.preventDefault()
    if (!decisionModalRecord) return
    try {
      setErrorMsg(null)
      onFinalizeDecision(decisionModalRecord.id, decisionForm)
      setDecisionModalRecord(null)
      setSuccessMsg(
        decisionForm.decisionType === 'Confirmed'
          ? `Employment successfully confirmed! Employee career milestone updated to permanent status.`
          : `Probation decision '${decisionForm.decisionType}' finalized successfully.`
      )
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Submodule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            Probation & Confirmation
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            Probation tracking milestones, performance reviews, tenure confirmations, and extensions.
          </p>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="danger" dismissible onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success" dismissible onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-hrms-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search employee, manager, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-hrms-accent"
          />
          <AppIcon name="search" className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs rounded-md border border-slate-300 bg-white font-medium"
          >
            <option value="all">All Probation Records</option>
            <option value="active (under probation)">Active (Under Probation)</option>
            <option value="pending review">Pending Review</option>
            <option value="pending approval">Pending Approval</option>
            <option value="confirmed">Confirmed (Permanent)</option>
            <option value="extended">Extended</option>
          </select>
        </div>
      </div>

      {/* Probation Table */}
      <div className="bg-white rounded-lg border border-hrms-border overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Employee</th>
                <th className="py-2.5 px-3">Department & Role</th>
                <th className="py-2.5 px-3">Reviewing Manager</th>
                <th className="py-2.5 px-3">Tenure / Days Elapsed</th>
                <th className="py-2.5 px-3">Review Due Date</th>
                <th className="py-2.5 px-3">Lifecycle Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">
                    No matching probation milestone records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => {
                  const percentElapsed = Math.min(100, Math.round(((item.daysElapsed || 1) / (item.totalProbationDays || 90)) * 100))
                  const isConfirmed = item.currentStatus === 'Confirmed'

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Employee Name */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.employeeName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.employeeId} • Joined {item.joiningDate}</div>
                      </td>

                      {/* Dept & Designation */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{item.designation}</div>
                        <div className="text-[11px] text-slate-500">{item.departmentName}</div>
                      </td>

                      {/* Manager */}
                      <td className="py-3 px-3 text-slate-800">
                        {item.managerName}
                      </td>

                      {/* Days Elapsed & Progress Bar */}
                      <td className="py-3 px-3 min-w-[140px]">
                        <div className="flex justify-between text-[11px] font-mono font-semibold mb-1">
                          <span>{item.daysElapsed} days elapsed</span>
                          <span className="text-slate-400">/ {item.totalProbationDays || 90}d</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              isConfirmed ? "bg-emerald-500" :
                              percentElapsed > 75 ? "bg-amber-500" : "bg-blue-600"
                            )}
                            style={{ width: `${percentElapsed}%` }}
                          />
                        </div>
                      </td>

                      {/* Review Due Date */}
                      <td className="py-3 px-3 font-mono">
                        <div className="font-bold text-slate-800">{item.expectedProbationEndDate}</div>
                        <div className="text-[10px] text-amber-700">Due: {item.reviewDueDate}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <StatusBadge status={item.currentStatus} />
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* Manager Assessment Action */}
                          {(isManager || isHrAdmin) && !isConfirmed && !item.managerAssessment && (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMsg(null)
                                setManagerModalRecord(item)
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 whitespace-nowrap leading-tight transition-colors"
                            >
                              Manager Review
                            </button>
                          )}

                          {/* HR Recommendation Action */}
                          {isHrAdmin && !isConfirmed && item.managerAssessment && !item.hrRecommendation && (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMsg(null)
                                setHrModalRecord(item)
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 whitespace-nowrap leading-tight transition-colors"
                            >
                              HR Review
                            </button>
                          )}

                          {/* Super Admin Sign-off Action */}
                          {isSuperAdmin && !isConfirmed && (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMsg(null)
                                setDecisionModalRecord(item)
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs whitespace-nowrap leading-tight transition-colors"
                            >
                              Finalize
                            </button>
                          )}

                          {/* Decision Log View */}
                          <button
                            type="button"
                            onClick={() => setViewHistoryRecord(item)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 rounded whitespace-nowrap leading-tight transition-colors"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MANAGER ASSESSMENT MODAL */}
      {/* ============================================================== */}
      {managerModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-md w-full p-5 border border-hrms-border text-left">
            <h3 className="text-base font-bold text-slate-900 mb-1">Manager Probation Assessment</h3>
            <p className="text-xs text-slate-500 mb-3">
              Employee: <strong>{managerModalRecord.employeeName}</strong> ({managerModalRecord.designation})
            </p>

            <form onSubmit={handleManagerSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Performance Rating (1 - 5) *</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setManagerForm({ ...managerForm, rating: s })}
                      className={cn(
                        "w-8 h-8 rounded font-bold text-xs transition-all",
                        managerForm.rating === s ? "bg-hrms-accent text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Manager Recommendation *</label>
                <select
                  value={managerForm.recommendation}
                  onChange={(e) => setManagerForm({ ...managerForm, recommendation: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-bold"
                >
                  <option value="Confirm Employment">Confirm Employment (Passed Probation)</option>
                  <option value="Extend Probation">Extend Probation (Improvement Required)</option>
                  <option value="Do Not Confirm">Do Not Confirm (Unsatisfactory Performance)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Manager Comments & Evidence *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Detail work quality, delivery timeliness, attendance reliability and team integration..."
                  value={managerForm.comments}
                  onChange={(e) => setManagerForm({ ...managerForm, comments: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManagerModalRecord(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-hrms-accent text-white font-bold rounded-md hover:bg-blue-700 shadow-xs"
                >
                  Submit Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* HR RECOMMENDATION MODAL */}
      {/* ============================================================== */}
      {hrModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-md w-full p-5 border border-hrms-border text-left">
            <h3 className="text-base font-bold text-slate-900 mb-1">HR Operational Recommendation</h3>
            <p className="text-xs text-slate-500 mb-3">
              Employee: <strong>{hrModalRecord.employeeName}</strong> • Manager Rating: <strong>{hrModalRecord.managerAssessment?.rating || '—'}/5</strong>
            </p>

            <form onSubmit={handleHrSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">HR Recommendation *</label>
                <select
                  value={hrForm.recommendation}
                  onChange={(e) => setHrForm({ ...hrForm, recommendation: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-bold"
                >
                  <option value="Support Confirmation">Support Full Confirmation</option>
                  <option value="Support Extension">Support Probation Extension</option>
                  <option value="Recommend Non-Confirmation">Recommend Non-Confirmation</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">HR Compliance & Verification Notes</label>
                <textarea
                  rows="3"
                  placeholder="Verify attendance punctuality, background clearance and policy compliance..."
                  value={hrForm.notes}
                  onChange={(e) => setHrForm({ ...hrForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHrModalRecord(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 shadow-xs"
                >
                  Escalate to Super Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUPER ADMIN FINALIZE DECISION MODAL */}
      {/* ============================================================== */}
      {decisionModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-md w-full p-5 border border-hrms-border text-left">
            <h3 className="text-base font-bold text-slate-900 mb-1">Super Admin Final Decision</h3>
            <p className="text-xs text-slate-500 mb-3">
              Employee: <strong>{decisionModalRecord.employeeName}</strong> ({decisionModalRecord.departmentName})
            </p>

            <form onSubmit={handleDecisionSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Final Authorized Decision *</label>
                <select
                  value={decisionForm.decisionType}
                  onChange={(e) => setDecisionForm({ ...decisionForm, decisionType: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-bold"
                >
                  <option value="Confirmed">Confirm Employment (Permanent Status)</option>
                  <option value="Extended">Extend Probation</option>
                  <option value="Not Confirmed">Do Not Confirm (Separation Review)</option>
                </select>
              </div>

              {decisionForm.decisionType === 'Extended' && (
                <div className="grid grid-cols-2 gap-3 bg-amber-50/70 p-3 rounded-md border border-amber-200">
                  <div>
                    <label className="block font-semibold text-amber-900 mb-1">Extension Duration</label>
                    <select
                      value={decisionForm.extensionMonths}
                      onChange={(e) => setDecisionForm({ ...decisionForm, extensionMonths: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-bold"
                    >
                      <option value="1">1 Month Extension</option>
                      <option value="2">2 Months Extension</option>
                      <option value="3">3 Months Extension (Max)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-amber-900 mb-1">New End Date</label>
                    <input
                      type="date"
                      value={decisionForm.newEndDate}
                      onChange={(e) => setDecisionForm({ ...decisionForm, newEndDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Approval Notes & Terms</label>
                <textarea
                  rows="2"
                  placeholder="Record executive confirmation remarks or specific targets for extension period..."
                  value={decisionForm.approvalNotes}
                  onChange={(e) => setDecisionForm({ ...decisionForm, approvalNotes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-md"
                />
              </div>

              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded text-[11px] text-blue-900 flex items-start gap-2">
                <AppIcon name="info" className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Confirming employment updates the canonical Employee Master status to <strong>Permanent</strong> and creates a historical milestone entry in their Career History ledger.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDecisionModalRecord(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-md hover:bg-emerald-700 shadow-xs"
                >
                  Authorize Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PROBATION AUDIT LOG MODAL */}
      {viewHistoryRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-lg w-full p-5 border border-hrms-border text-left space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Probation Lifecycle Dossier</h3>
                <p className="text-xs text-slate-500">{viewHistoryRecord.employeeName} ({viewHistoryRecord.employeeId})</p>
              </div>
              <button
                type="button"
                onClick={() => setViewHistoryRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>Joining Date: <strong>{viewHistoryRecord.joiningDate}</strong></div>
                <div>Expected End: <strong>{viewHistoryRecord.expectedProbationEndDate}</strong></div>
                <div>Review Due: <strong>{viewHistoryRecord.reviewDueDate}</strong></div>
                <div>Reviewing Manager: <strong>{viewHistoryRecord.managerName}</strong></div>
              </div>

              {/* Manager Assessment */}
              <div className="p-3 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800">1. Manager Review</span>
                  {viewHistoryRecord.managerAssessment ? (
                    <span className="font-bold text-blue-700">{viewHistoryRecord.managerAssessment.recommendation} ({viewHistoryRecord.managerAssessment.rating}/5)</span>
                  ) : (
                    <span className="text-slate-400 italic">Pending</span>
                  )}
                </div>
                {viewHistoryRecord.managerAssessment && (
                  <p className="text-slate-600 italic mt-1">"{viewHistoryRecord.managerAssessment.comments}"</p>
                )}
              </div>

              {/* HR Review */}
              <div className="p-3 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800">2. HR Moderation</span>
                  {viewHistoryRecord.hrRecommendation ? (
                    <span className="font-bold text-indigo-700">{viewHistoryRecord.hrRecommendation.recommendation}</span>
                  ) : (
                    <span className="text-slate-400 italic">Pending</span>
                  )}
                </div>
                {viewHistoryRecord.hrRecommendation && (
                  <p className="text-slate-600 italic mt-1">{viewHistoryRecord.hrRecommendation.notes || 'Verified'}</p>
                )}
              </div>

              {/* Final Decision */}
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-emerald-900">3. Super Admin Final Sign-off</span>
                  {viewHistoryRecord.finalDecision ? (
                    <span className="font-bold text-emerald-800">{viewHistoryRecord.finalDecision.decisionType}</span>
                  ) : (
                    <span className="text-slate-400 italic">Pending Approval</span>
                  )}
                </div>
                {viewHistoryRecord.finalDecision && (
                  <p className="text-emerald-800 text-[11px] mt-1">{viewHistoryRecord.finalDecision.approvalNotes}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewHistoryRecord(null)}
                className="px-4 py-1.5 bg-slate-200 text-slate-800 font-bold rounded text-xs hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProbationManagementTab
