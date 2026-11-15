import React from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/common/Button'
import { calculateTimeDuration, formatTimeTo12Hour } from '@/lib/dateUtils'

/**
 * WfhFieldDutyDetailModal
 * Clean, read-only details modal for Work From Home (WFH) and Client Field Duty requests.
 * Displays:
 * - Request ID, employee, category, date, duration, purpose/deliverables, location
 * - Current approval status & assigned review tier
 * - Formal decision attribution (decidedBy, decidedAt, remarks)
 * - Complete chronological approval journey and audit history
 */
export function WfhFieldDutyDetailModal({ isOpen, onClose, request }) {
  if (!isOpen || !request) return null

  const isFieldDuty =
    request.requestCategory === 'Client Field Duty' ||
    (request.id && String(request.id).startsWith('FLD')) ||
    (request.requestCode && String(request.requestCode).startsWith('FLD')) ||
    !!request.clientName ||
    !!request.visitDate ||
    !!request.dutyDate

  const isOvertime =
    request.requestCategory === 'Overtime Claim' ||
    (request.id && String(request.id).startsWith('OT')) ||
    (request.requestCode && String(request.requestCode).startsWith('OT'))

  const requestId = request.requestCode || request.id || 'N/A'
  const employeeName = request.employeeName || request.name || 'Employee'
  const employeeId = request.employeeId || 'EMP-???'
  const departmentName = request.departmentName || request.department || 'Software Development'
  const targetDate = request.requestedDate || request.visitDate || request.dutyDate || request.targetDate || request.startDate || request.date || '—'
  const status = request.status || 'Pending'

  // Duration
  let durationDisplay = '1 day'
  if (isOvertime) {
    const mins = Number(request.durationMinutes || request.requestedMinutes || 60)
    const hrs = Number.isFinite(Number(request.requestedHours)) && Number(request.requestedHours) > 0
      ? Number(request.requestedHours)
      : Math.round((mins / 60) * 10) / 10
    durationDisplay = `${mins} mins (${hrs} hrs)`
  } else if (isFieldDuty) {
    if (request.durationFormatted) {
      durationDisplay = request.durationFormatted
    } else if (request.durationHours) {
      durationDisplay = `${request.durationHours} hrs`
    } else if (request.expectedStartTime || request.startTime) {
      const calc = calculateTimeDuration(request.expectedStartTime || request.startTime, request.expectedEndTime || request.endTime)
      durationDisplay = calc.formatted || `${calc.totalHours} hrs`
    }
  } else {
    durationDisplay = `${request.durationDays || request.totalDays || 1} day(s)`
  }

  // Approver Route
  const assignedApprover =
    request.currentApproverName ||
    request.approverName ||
    (request.currentApproverRole === 'team_lead' ? 'Team Lead' : 'Department Manager')
  const assignedTier =
    request.currentApproverTier ||
    request.currentApproverRole ||
    request.approverRole ||
    'Supervisor'

  // Decision details
  const decisionActor =
    request.decidedBy ||
    (status === 'Approved' ? request.approverName : null) ||
    (request.approvalHistory &&
      request.approvalHistory
        .filter((h) => ['Approved', 'Rejected', 'Declined'].includes(h.status))
        .map((h) => h.actor)
        .pop())

  const decisionTimestamp =
    request.decidedAt ||
    (request.approvalHistory &&
      request.approvalHistory
        .filter((h) => ['Approved', 'Rejected', 'Declined'].includes(h.status))
        .map((h) => h.timestamp)
        .pop())

  const decisionRemarks =
    request.decisionNotes ||
    request.decisionRemarks ||
    (request.approvalHistory &&
      request.approvalHistory
        .filter((h) => ['Approved', 'Rejected', 'Declined', 'Endorsed'].includes(h.status))
        .map((h) => h.note)
        .pop())

  const history = Array.isArray(request.approvalHistory) ? request.approvalHistory : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl text-left overflow-hidden my-8 animate-in fade-in-50 zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wfh-fd-modal-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-md ${
                isFieldDuty ? 'bg-amber-600 shadow-amber-500/30' : 'bg-blue-600 shadow-blue-500/30'
              }`}
            >
              <i className={`fa-solid ${isFieldDuty ? 'fa-briefcase' : 'fa-house-laptop'}`}></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="wfh-fd-modal-title" className="text-base font-bold text-white tracking-tight">
                  {requestId}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold border border-white/20">
                  {isFieldDuty ? 'Client Field Duty' : 'Work From Home (WFH)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {employeeName} ({employeeId}) • {departmentName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Close modal"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
          {/* Top Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
              <div className="mt-1">
                <StatusBadge status={status} />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {isFieldDuty ? 'Visit Date' : 'Requested Date'}
              </span>
              <span className="text-xs font-bold text-slate-800 mt-1 block font-mono">{targetDate}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
              <span className="text-xs font-bold text-blue-700 mt-1 block font-mono">{durationDisplay}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Route</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block truncate" title={`${assignedApprover} (${assignedTier})`}>
                {assignedApprover}
              </span>
              <span className="text-[10px] text-slate-500 font-sans block">({assignedTier})</span>
            </div>
          </div>

          {/* Field Duty Specifics */}
          {isFieldDuty && (
            <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200/80 space-y-3">
              <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-building-user text-amber-600"></i>
                Official Client Visit Specifications
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Client Name</span>
                  <span className="font-bold text-slate-900">{request.clientName || 'Direct Client Engagement'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Visit Timing</span>
                  <span className="font-mono text-slate-800">
                    {formatTimeTo12Hour(request.expectedStartTime || request.startTime || '09:30')} –{' '}
                    {formatTimeTo12Hour(request.expectedEndTime || request.endTime || '18:30')}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Client Site / Location</span>
                  <span className="text-slate-800 font-medium">{request.location || request.siteLocation || request.clientLocation || 'Client Premises'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Business Purpose</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-amber-200/60 leading-relaxed mt-0.5">
                    {request.purpose || request.reason || 'Official client visit and requirements review.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* WFH Specifics */}
          {!isFieldDuty && (
            <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200/80 space-y-3">
              <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-laptop-code text-blue-600"></i>
                Remote Work Plan &amp; Justification
              </h4>
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Operational Justification</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-blue-200/60 leading-relaxed mt-0.5">
                    {request.reason || 'Home office working arrangement requested.'}
                  </p>
                </div>
                {(request.deliverablesPlanned || request.deliverables) && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Planned Deliverables &amp; Output</span>
                    <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-blue-200/60 leading-relaxed mt-0.5 font-medium">
                      {request.deliverablesPlanned || request.deliverables}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Policy Escalation Notice */}
          {request.escalationReason && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0"></i>
              <div>
                <span className="font-bold block">Approval Authority Escalation</span>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">{request.escalationReason}</p>
              </div>
            </div>
          )}

          {/* Supervisor Decision Attribution (If completed) */}
          {(decisionActor || decisionRemarks) && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Supervisor Decision Panel</span>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Decided By: </span>
                  <strong className="text-slate-800">{decisionActor || 'Authorized Supervisor'}</strong>
                </div>
                {decisionTimestamp && (
                  <span className="text-slate-400 font-mono text-[11px]">{decisionTimestamp}</span>
                )}
              </div>
              {decisionRemarks && (
                <div className="text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200 mt-1 italic">
                  "{decisionRemarks}"
                </div>
              )}
            </div>
          )}

          {/* Chronological Audit Trail & Approval Journey */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <i className="fa-solid fa-timeline text-slate-500"></i>
              Approval Journey &amp; Audit Trail
            </h4>
            {history.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 italic text-center">
                Initial submission registered; pending formal supervisor action.
              </div>
            ) : (
              <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {history.map((step, idx) => {
                  const isApproved = step.status?.toLowerCase().includes('approved') || step.status?.toLowerCase().includes('authorized')
                  const isRejected = step.status?.toLowerCase().includes('rejected') || step.status?.toLowerCase().includes('declined')
                  const isEndorsed = step.status?.toLowerCase().includes('endorsed') || step.status?.toLowerCase().includes('re-routed')

                  const dotColor = isApproved
                    ? 'bg-emerald-500 ring-emerald-200'
                    : isRejected
                    ? 'bg-rose-500 ring-rose-200'
                    : isEndorsed
                    ? 'bg-amber-500 ring-amber-200'
                    : 'bg-blue-500 ring-blue-200'

                  return (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white ring-2 ${dotColor}`} />
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                          <span className="font-bold text-slate-800">{step.status}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{step.timestamp}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          <span className="font-semibold text-slate-700">{step.actor}</span>
                          {step.note && <span className="ml-1.5 text-slate-600">— {step.note}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">iSysware HRMS • Read-Only View</span>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs font-semibold">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export default WfhFieldDutyDetailModal

