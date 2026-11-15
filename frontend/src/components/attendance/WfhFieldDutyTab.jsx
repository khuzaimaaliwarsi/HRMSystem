import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/common/Button'
import Alert from '@/components/common/Alert'
import WfhFieldDutyDetailModal from '@/components/attendance/WfhFieldDutyDetailModal'
import { calculateTimeDuration, formatTimeTo12Hour } from '@/lib/dateUtils'
import { attendancePolicyService } from '@/services/attendancePolicyService'

export function WfhFieldDutyTab({
  wfhRequests = [],
  fieldDutyRequests = [],
  currentUser = null,
  onOpenWfhModal,
  onOpenFieldDutyModal,
  onApproveWfh,
  onRejectWfh,
  onApproveFieldDuty,
  onRejectFieldDuty
}) {
  const [activeSubTab, setActiveSubTab] = useState('wfh') // 'wfh' | 'fieldDuty'
  const [statusFilter, setStatusFilter] = useState('all')
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [selectedDetailRequest, setSelectedDetailRequest] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [activePolicy, setActivePolicy] = useState(() => attendancePolicyService.getActivePolicy())

  useEffect(() => {
    return attendancePolicyService.subscribe(() => {
      setActivePolicy(attendancePolicyService.getActivePolicy())
    })
  }, [])

  const fieldLimits = activePolicy?.fieldDutyApprovalLimits || {}
  const policyMode = fieldLimits.mode || 'no_limit'
  const tlLimit = fieldLimits.teamLeadMaxHours !== undefined ? fieldLimits.teamLeadMaxHours : 4.0

  const isEmployee = currentUser?.role === 'employee'

  const handleApproveWfhClick = (id) => {
    try {
      setErrorMessage(null)
      const note = currentUser?.role === 'team_lead' ? 'WFH approved by Team Lead' : 'Approved by manager'
      onApproveWfh?.(id, note, currentUser?.name, currentUser?.employeeId, currentUser?.role)
      setSuccessMessage('WFH request approved successfully.')
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const handleRejectWfhClick = (id) => {
    try {
      setErrorMessage(null)
      const note = currentUser?.role === 'team_lead' ? 'WFH declined by Team Lead' : 'Declined by manager'
      onRejectWfh?.(id, note, currentUser?.name, currentUser?.employeeId, currentUser?.role)
      setSuccessMessage('WFH request declined.')
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const handleApproveFdClick = (id) => {
    try {
      setErrorMessage(null)
      onApproveFieldDuty?.(id, 'Official client visit authorized', currentUser?.name, currentUser?.employeeId, currentUser?.role)
      setSuccessMessage('Field duty visit authorized.')
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const handleRejectFdClick = (id) => {
    try {
      setErrorMessage(null)
      onRejectFieldDuty?.(id, 'Client visit declined', currentUser?.name, currentUser?.employeeId, currentUser?.role)
      setSuccessMessage('Field duty request declined.')
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const filteredWfh = wfhRequests.filter((w) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        if (!w.status?.toLowerCase().includes('pending')) return false
      } else if (w.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
    }
    return true
  })

  // Default Latest First (descending) sorting
  const sortedWfh = [...filteredWfh].sort((a, b) => {
    const dateA = a.requestedDate || a.date || a.createdAt || ''
    const dateB = b.requestedDate || b.date || b.createdAt || ''
    return dateB.localeCompare(dateA)
  })

  const filteredFieldDuty = fieldDutyRequests.filter((f) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        if (!f.status?.toLowerCase().includes('pending')) return false
      } else if (f.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
    }
    return true
  })

  // Default Latest First (descending) sorting
  const sortedFieldDuty = [...filteredFieldDuty].sort((a, b) => {
    const dateA = a.visitDate || a.date || a.createdAt || ''
    const dateB = b.visitDate || b.date || b.createdAt || ''
    return dateB.localeCompare(dateA)
  })

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

      {/* Subtab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-hrms-border shadow-hrms-card">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('wfh')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              activeSubTab === 'wfh'
                ? 'bg-hrms-primary text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AppIcon name="dashboard" className="w-3.5 h-3.5 mr-1.5" />
            Work From Home ({(wfhRequests || []).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('fieldDuty')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              activeSubTab === 'fieldDuty'
                ? 'bg-hrms-primary text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AppIcon name="travel" className="w-3.5 h-3.5 mr-1.5" />
            Client Field Duty ({(fieldDutyRequests || []).length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs p-1.5 border border-slate-300 rounded bg-white"
          >
            <option value="all">All Request Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          {activeSubTab === 'wfh' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenWfhModal}
              className="bg-hrms-primary text-white"
            >
              <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
              Request WFH
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenFieldDutyModal}
              className="bg-hrms-primary text-white"
            >
              <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
              New Client Visit
            </Button>
          )}
        </div>
      </div>

      {/* SUBTAB 1: WFH REQUESTS */}
      {activeSubTab === 'wfh' && (
        <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-3">Request ID & Staff</th>
                  <th className="p-3">Requested Date</th>
                  <th className="p-3">Reason & Planned Deliverables</th>
                  <th className="p-3">Submitted At</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(sortedWfh || []).length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-slate-400 italic">
                      No WFH requests recorded.
                    </td>
                  </tr>
                ) : (
                  sortedWfh.map((w) => {
                    const isSuperAdmin = String(currentUser?.role || '').toLowerCase() === 'super_admin'
                    const isSelf = !isSuperAdmin && currentUser?.employeeId === w.employeeId
                    const isPending = w?.status?.toLowerCase().includes('pending')
                    const canApprove = !isEmployee && isPending

                    return (
                      <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{w.employeeName || 'Staff Member'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{w.id} • {w.departmentName || 'Department'}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">
                          {w.requestedDate || w.startDate || w.date || '—'}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-slate-800">{w.reason || 'Remote Work Request'}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            <strong>Deliverables:</strong> {w.deliverablesPlanned || w.deliverables || '—'}
                          </div>
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">{w.submittedAt || w.appliedAt || '—'}</td>
                        <td className="p-3 text-center">
                          <StatusBadge status={w.status} />
                        </td>
                        <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDetailRequest(w)
                              setIsDetailModalOpen(true)
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                            title="View request details and audit history"
                          >
                            View Details
                          </button>
                          {canApprove && (
                            <>
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => handleApproveWfhClick(w.id)}
                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 disabled:opacity-40"
                                title={isSelf ? 'Self-approval prohibited' : 'Approve WFH request'}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => handleRejectWfhClick(w.id)}
                                className="px-2.5 py-1 text-[11px] font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 disabled:opacity-40"
                                title={isSelf ? 'Self-approval prohibited' : 'Decline WFH request'}
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: FIELD DUTY REQUESTS */}
      {activeSubTab === 'fieldDuty' && (
        <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-3">Staff Member</th>
                  <th className="p-3">Visit Date & Hours</th>
                  <th className="p-3">Client & Purpose</th>
                  <th className="p-3">Location</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(sortedFieldDuty || []).length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-slate-400 italic">
                      No official client visits recorded.
                    </td>
                  </tr>
                ) : (
                  sortedFieldDuty.map((f) => {
                    const isSuperAdmin = String(currentUser?.role || '').toLowerCase() === 'super_admin'
                    const isSelf = !isSuperAdmin && currentUser?.employeeId === f.employeeId
                    const isPending = f?.status?.toLowerCase().includes('pending')
                    const durHours = f.durationHours || calculateTimeDuration(f.expectedStartTime, f.expectedEndTime).totalHours || 0
                    const isTeamLead = currentUser?.role === 'team_lead'
                    const isManager = currentUser?.role === 'manager'
                    const isHrOrAdmin = currentUser?.role === 'hr_admin' || currentUser?.role === 'super_admin'

                    let canApprove = false
                    let isEscalating = false

                    if (!isEmployee && isPending) {
                      if (isTeamLead) {
                        if (policyMode === 'manager_only') {
                          canApprove = false
                        } else if (f.status === 'Pending Team Lead Review') {
                          canApprove = true
                          isEscalating = policyMode === 'duration_based' && durHours > tlLimit
                        } else {
                          canApprove = false
                        }
                      } else if (isManager || isHrOrAdmin) {
                        canApprove = true
                        isEscalating = false
                      }
                    }

                    return (
                      <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{f.employeeName || 'Staff Member'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{f.id} • {f.departmentName || 'Department'}</div>
                        </td>
                        <td className="p-3 font-mono">
                          <div className="font-bold text-slate-800">{f.visitDate || f.dutyDate || f.date || '—'}</div>
                          <div className="text-[11px] text-slate-700 font-medium">
                            {formatTimeTo12Hour(f.expectedStartTime || f.startTime || f.actualStartTime || '09:30')} – {formatTimeTo12Hour(f.expectedEndTime || f.endTime || f.actualEndTime || '18:30')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">
                            ({f.durationFormatted || (f.durationHours ? `${f.durationHours} hrs` : calculateTimeDuration(f.expectedStartTime || f.startTime, f.expectedEndTime || f.endTime).formatted)})
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-hrms-primary">{f.clientName || 'Client Visit'}</div>
                          <div className="text-[11px] text-slate-600 mt-0.5">{f.purpose || f.reason || 'Official client visit'}</div>
                          {f.escalationReason && (
                            <div className="mt-1.5 text-[10px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1.5">
                              <i className="fa-solid fa-triangle-exclamation text-amber-600 shrink-0"></i>
                              <span>{f.escalationReason}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 text-[11px]">{f.location || f.siteLocation || f.clientLocation || 'Client Premises'}</td>
                        <td className="p-3 text-center">
                          <StatusBadge status={f.status} />
                        </td>
                        <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDetailRequest(f)
                              setIsDetailModalOpen(true)
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                            title="View visit specifications and audit history"
                          >
                            View Details
                          </button>
                          {canApprove && (
                            <>
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => handleApproveFdClick(f.id)}
                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 disabled:opacity-40"
                                title={
                                  isSelf
                                    ? 'Self-approval prohibited'
                                    : isEscalating
                                    ? `Endorse client visit and escalate to Department Manager (> ${tlLimit}h)`
                                    : 'Approve client field visit'
                                }
                              >
                                {isEscalating ? 'Endorse to Manager' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => handleRejectFdClick(f.id)}
                                className="px-2.5 py-1 text-[11px] font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 disabled:opacity-40"
                                title={isSelf ? 'Self-approval prohibited' : 'Decline client visit'}
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {isDetailModalOpen && (
        <WfhFieldDutyDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false)
            setSelectedDetailRequest(null)
          }}
          request={selectedDetailRequest}
        />
      )}
    </div>
  )
}

export default WfhFieldDutyTab
