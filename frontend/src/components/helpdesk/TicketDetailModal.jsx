import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TicketDetailModal({
  ticket = null,
  currentUser = null,
  canManageSupport = false,
  employees = [],
  teams = [],
  onClose = () => {},
  onAddReply = () => {},
  onAssign = () => {},
  onEscalate = () => {},
  onUpdateStatus = () => {},
  onResolve = () => {},
  onCloseTicket = () => {},
  onReopen = () => {}
}) {
  const [activeTab, setActiveTab] = useState('conversation') // 'conversation' | 'timeline'
  const [replyMessage, setReplyMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  // Resolution modal state
  const [showResolveDialog, setShowResolveDialog] = useState(false)
  const [resolutionSummary, setResolutionSummary] = useState('')

  // Escalation modal state
  const [showEscalateDialog, setShowEscalateDialog] = useState(false)
  const [escalationReasonInput, setEscalationReasonInput] = useState('')

  // Close & Rating dialog state
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [satisfactionRating, setSatisfactionRating] = useState(5)
  const [satisfactionFeedback, setSatisfactionFeedback] = useState('')

  // Reopen dialog state
  const [showReopenDialog, setShowReopenDialog] = useState(false)
  const [reopenReason, setReopenReason] = useState('')

  // Assignment dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedResolverId, setSelectedResolverId] = useState('')
  const [resolverNameInput, setResolverNameInput] = useState(currentUser?.name || '')
  const [selectedTeamId, setSelectedTeamId] = useState('')

  if (!ticket) return null

  const currentUserIds = new Set(
    [currentUser?.employeeId, currentUser?.employeeCode, currentUser?.id, currentUser?.userId].filter(Boolean)
  )
  const isTicketCreator =
    (ticket.employeeId && currentUserIds.has(ticket.employeeId)) ||
    (ticket.employeeCode && currentUserIds.has(ticket.employeeCode)) ||
    (ticket.createdByUserId && currentUserIds.has(ticket.createdByUserId))

  const handleSendReply = async (e) => {
    e.preventDefault()
    if (!replyMessage.trim() || isBusy) return
    try {
      setIsBusy(true)
      await onAddReply(ticket.ticketId, {
        message: replyMessage.trim(),
        isInternalNote: canManageSupport ? isInternalNote : false
      })
      setReplyMessage('')
      setIsInternalNote(false)
    } finally {
      setIsBusy(false)
    }
  }

  const handleResolveSubmit = async (e) => {
    e.preventDefault()
    if (!resolutionSummary.trim() || isBusy) return
    try {
      setIsBusy(true)
      await onResolve(ticket.ticketId, { resolutionSummary: resolutionSummary.trim() })
      setShowResolveDialog(false)
      setResolutionSummary('')
    } finally {
      setIsBusy(false)
    }
  }

  const handleEscalateSubmit = async (e) => {
    e.preventDefault()
    if (!escalationReasonInput.trim() || isBusy) return
    try {
      setIsBusy(true)
      await onEscalate(ticket.ticketId, escalationReasonInput.trim())
      setShowEscalateDialog(false)
      setEscalationReasonInput('')
    } finally {
      setIsBusy(false)
    }
  }

  const handleCloseSubmit = async (e) => {
    e.preventDefault()
    if (isBusy) return
    try {
      setIsBusy(true)
      await onCloseTicket(ticket.ticketId, {
        rating: satisfactionRating,
        feedback: satisfactionFeedback.trim()
      })
      setShowCloseDialog(false)
    } finally {
      setIsBusy(false)
    }
  }

  const handleReopenSubmit = async (e) => {
    e.preventDefault()
    if (!reopenReason.trim() || isBusy) return
    try {
      setIsBusy(true)
      await onReopen(ticket.ticketId, reopenReason.trim())
      setShowReopenDialog(false)
      setReopenReason('')
    } finally {
      setIsBusy(false)
    }
  }

  const openAssignDialog = () => {
    setSelectedTeamId(ticket.assignedTeamId || teams[0]?.teamId || '')
    setSelectedResolverId(ticket.assignedResolverId || '')
    setResolverNameInput(ticket.assignedResolverName || currentUser?.name || '')
    setShowAssignDialog(true)
  }

  const handleAssignSubmit = async (e) => {
    e.preventDefault()
    if ((!resolverNameInput.trim() && !selectedResolverId) || isBusy) return
    try {
      setIsBusy(true)
      await onAssign(ticket.ticketId, {
        resolverId: selectedResolverId || currentUser?.employeeId || null,
        resolverName: resolverNameInput.trim(),
        teamId: selectedTeamId || undefined
      })
      setShowAssignDialog(false)
    } finally {
      setIsBusy(false)
    }
  }

  const resolutionDueStr = ticket.resolutionDue || ticket.slaDueDate
  const isReopenedTicket = Boolean(ticket.isReopened || ticket.reopenedAt)
  const isReopenedActive =
    typeof ticket.isReopenedActive === 'boolean'
      ? ticket.isReopenedActive
      : isReopenedTicket && ticket.status !== 'Resolved' && ticket.status !== 'Closed'
  const showCurrentResolution = Boolean(ticket.resolutionSummary && !isReopenedActive)
  const showCurrentFeedback = Boolean(ticket.satisfactionRating && !isReopenedActive)
  const resolutionHistory = Array.isArray(ticket.resolutionHistory) ? ticket.resolutionHistory : []
  const escalationHistory = Array.isArray(ticket.escalationHistory) ? ticket.escalationHistory : []
  const hasHistoricalSection = Boolean(
    ticket.previousResolutionSummary ||
      ticket.previousSatisfactionRating ||
      resolutionHistory.length > 0
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
              {ticket.ticketId}
            </span>
            <span className="text-sm font-semibold truncate max-w-md">
              {ticket.subject}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close ticket details"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <AppIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata & Status Strip */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block">Category & Team</span>
            <span className="font-medium text-slate-800">{ticket.category}</span>
            <div className="text-[10px] text-slate-500">{ticket.assignedTeamName}</div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Requester</span>
            <span className="font-medium text-slate-800">{ticket.employeeName}</span>
            <div className="text-[10px] text-slate-500">{ticket.employeeDepartment}</div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Priority &amp; SLA</span>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                ticket.priority === 'Critical' ? 'bg-rose-100 text-rose-800' :
                ticket.priority === 'High' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {ticket.priority}
              </span>
              {ticket.isEscalated && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  Escalated
                </span>
              )}
              <span className={`text-[10px] font-medium ${
                ticket.isSlaBreached ? 'text-rose-600 font-bold' :
                ticket.isSlaWarning ? 'text-amber-600 font-bold' :
                ticket.slaStatus === 'Satisfied' ? 'text-emerald-700 font-semibold' : 'text-slate-600'
              }`}>
                {ticket.isSlaBreached
                  ? (ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'SLA Breached (Late)' : 'SLA Breached')
                  : ticket.isSlaWarning
                  ? 'SLA Approaching'
                  : ticket.slaStatus === 'Satisfied'
                  ? 'SLA Met'
                  : 'Within SLA'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
              {ticket.firstResponseDue && (
                <div>
                  Resp Due: {new Date(ticket.firstResponseDue).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}{' '}
                  <span className={`font-semibold ${
                    ticket.isResponseSlaBreached ? 'text-rose-600' :
                    ticket.firstResponseSlaStatus === 'Met' ? 'text-emerald-700' : 'text-slate-600'
                  }`}>
                    ({ticket.firstResponseSlaStatus || (ticket.firstResponseAt ? 'Met' : 'Pending')})
                  </span>
                </div>
              )}
              {resolutionDueStr && (
                <div>
                  Res Due: {new Date(resolutionDueStr).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}{' '}
                  <span className={`font-semibold ${
                    ticket.isResolutionSlaBreached ? 'text-rose-600' :
                    ticket.resolutionSlaStatus === 'Met' ? 'text-emerald-700' : 'text-slate-600'
                  }`}>
                    ({ticket.resolutionSlaStatus || ((ticket.status === 'Resolved' || ticket.status === 'Closed') && !isReopenedActive ? 'Met' : 'Pending')})
                  </span>
                </div>
              )}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Status &amp; Resolver</span>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                ticket.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                ticket.status === 'In Progress' ? 'bg-purple-100 text-purple-800' :
                ticket.status === 'Pending Employee' ? 'bg-amber-100 text-amber-800' :
                ticket.status === 'Closed' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-800'
              }`}>
                {ticket.status}
              </span>
              {isReopenedTicket && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  Reopened
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {ticket.assignedResolverName ? `Resolver: ${ticket.assignedResolverName}` : 'Unassigned'}
            </div>
          </div>
        </div>

        {/* Active Reopen Notice Banner */}
        {isReopenedActive && ticket.reopenReason && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
            <i className="fa-solid fa-rotate-left text-amber-600 text-sm mt-0.5"></i>
            <div className="flex-1">
              <span className="font-semibold">Ticket Reopened for Active Investigation:</span> {ticket.reopenReason}
              {ticket.reopenedAt && (
                <span className="text-[11px] text-amber-800 ml-2">
                  ({new Date(ticket.reopenedAt).toLocaleString()})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Current Resolution Banner (ONLY when actively Resolved or Closed, never on reopened active tickets) */}
        {showCurrentResolution && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
            <i className="fa-solid fa-circle-check text-emerald-600 text-sm mt-0.5"></i>
            <div className="flex-1">
              <span className="font-semibold">Current Resolution Summary:</span> {ticket.resolutionSummary}
              {ticket.resolvedByName && (
                <span className="text-[11px] text-emerald-800 ml-2">
                  • By {ticket.resolvedByName}
                  {ticket.resolvedAt ? ` (${new Date(ticket.resolvedAt).toLocaleString()})` : ''}
                </span>
              )}
              {showCurrentFeedback && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-800 font-medium">
                  <span>Rating:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <i
                      key={star}
                      className={`fa-solid fa-star text-[10px] ${
                        star <= ticket.satisfactionRating ? 'text-amber-500' : 'text-slate-300'
                      }`}
                    ></i>
                  ))}
                  {ticket.satisfactionFeedback && <span className="italic ml-1">&quot;{ticket.satisfactionFeedback}&quot;</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Historical Prior-Cycle Resolution & Feedback (Before Reopen) */}
        {hasHistoricalSection && (
          <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-slate-700 text-xs flex items-start gap-2.5">
            <i className="fa-solid fa-clock-rotate-left text-slate-500 text-sm mt-0.5"></i>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">
                  Historical Resolution &amp; Feedback (Prior Cycle — Not Current Resolution)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold">
                  Archived Before Reopen
                </span>
              </div>
              {ticket.previousResolutionSummary && (
                <div className="text-slate-700">
                  <span className="font-medium">Prior Fix:</span> {ticket.previousResolutionSummary}
                  {ticket.previousResolvedByName && (
                    <span className="text-[11px] text-slate-500 ml-1.5">
                      • By {ticket.previousResolvedByName}
                      {ticket.previousResolvedAt ? ` (${new Date(ticket.previousResolvedAt).toLocaleString()})` : ''}
                    </span>
                  )}
                </div>
              )}
              {ticket.previousSatisfactionRating && (
                <div className="flex items-center gap-1 text-[11px] text-slate-600">
                  <span className="font-medium">Prior Cycle Feedback:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <i
                      key={star}
                      className={`fa-solid fa-star text-[10px] ${
                        star <= ticket.previousSatisfactionRating ? 'text-amber-500' : 'text-slate-300'
                      }`}
                    ></i>
                  ))}
                  {ticket.previousSatisfactionFeedback && (
                    <span className="italic ml-1">&quot;{ticket.previousSatisfactionFeedback}&quot;</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('conversation')}
            className={`pb-2 px-2 border-b-2 transition ${
              activeTab === 'conversation'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <i className="fa-regular fa-comments mr-1.5"></i>
            Conversation Thread ({ticket.conversations?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-2 px-2 border-b-2 transition ${
              activeTab === 'timeline'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <i className="fa-solid fa-timeline mr-1.5"></i>
            Activity Timeline ({ticket.timeline?.length || 0})
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {activeTab === 'conversation' && (
            <div className="space-y-3">
              {(ticket.conversations || []).map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-xl border text-xs shadow-2xs ${
                    msg.isInternalNote
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                      : (currentUserIds.has(msg.senderId) || (msg.senderEmployeeCode && currentUserIds.has(msg.senderEmployeeCode)))
                      ? 'bg-indigo-50/70 border-indigo-200 text-slate-800 ml-8'
                      : 'bg-white border-slate-200 text-slate-800 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200/50">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{msg.senderName}</span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {msg.senderRole}
                      </span>
                      {msg.isInternalNote && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <i className="fa-solid fa-lock text-[9px]"></i>
                          INTERNAL NOTE (HIDDEN FROM EMPLOYEE)
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-slate-700 leading-relaxed">{msg.message}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4 max-w-2xl mx-auto py-2">
              {escalationHistory.length > 0 && (
                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-800">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-fire text-rose-600"></i>
                      Escalation History ({escalationHistory.length})
                    </span>
                    <span className="text-[10px] font-medium text-rose-700">
                      Current Priority: {ticket.priority}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {escalationHistory.map((esc, idx) => (
                      <div key={idx} className="bg-white/90 border border-rose-100 rounded-lg p-2 text-xs">
                        <div className="font-medium text-slate-800">{esc.reason}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          By {esc.escalatedBy || 'Support Lead'}
                          {esc.escalatedAt ? ` • ${new Date(esc.escalatedAt).toLocaleString()}` : ''}
                          {esc.previousPriority && esc.priority ? ` • Priority: ${esc.previousPriority} → ${esc.priority}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {(ticket.timeline || []).map((evt, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <i className="fa-solid fa-circle-check text-[10px]"></i>
                    </div>
                    <div className="flex-1 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="font-medium text-slate-800">{evt.action}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        By {evt.by} • {new Date(evt.at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Bottom Bar */}
        <div className="p-4 bg-white border-t border-slate-200 space-y-3">
          {/* Support Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {canManageSupport && ticket.status !== 'Closed' && (
                <>
                  <button
                    onClick={openAssignDialog}
                    disabled={isBusy}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition"
                  >
                    <i className="fa-solid fa-user-check mr-1"></i>
                    {ticket.assignedResolverName ? 'Reassign' : 'Assign Resolver'}
                  </button>
                  {ticket.status !== 'Resolved' && (
                    <button
                      onClick={() =>
                        onUpdateStatus(
                          ticket.ticketId,
                          ticket.status === 'Pending Employee' ? 'In Progress' : 'Pending Employee'
                        )
                      }
                      disabled={isBusy}
                      className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition"
                    >
                      <i className="fa-regular fa-clock mr-1"></i>
                      {ticket.status === 'Pending Employee' ? 'Resume In Progress' : 'Mark Pending Employee'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowEscalateDialog(true)}
                    disabled={isBusy}
                    className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition"
                  >
                    <i className="fa-solid fa-fire text-rose-600 mr-1"></i>
                    Escalate
                  </button>
                  <button
                    onClick={() => setShowResolveDialog(true)}
                    disabled={isBusy}
                    className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition"
                  >
                    <i className="fa-solid fa-check mr-1"></i>
                    Mark Resolved
                  </button>
                </>
              )}

              {/* Employee Actions when Resolved */}
              {(isTicketCreator || canManageSupport) && ticket.status === 'Resolved' && (
                <>
                  <button
                    onClick={() => setShowCloseDialog(true)}
                    disabled={isBusy}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition shadow-sm"
                  >
                    <i className="fa-solid fa-star mr-1"></i>
                    Confirm Closure & Rate Support
                  </button>
                  <button
                    onClick={() => setShowReopenDialog(true)}
                    disabled={isBusy}
                    className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition"
                  >
                    <i className="fa-solid fa-rotate-left mr-1"></i>
                    Reopen Ticket
                  </button>
                </>
              )}
              {(isTicketCreator || canManageSupport) && ticket.status === 'Closed' && (
                <button
                  onClick={() => setShowReopenDialog(true)}
                  disabled={isBusy}
                  className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition"
                >
                  <i className="fa-solid fa-rotate-left mr-1"></i>
                  Reopen Closed Ticket
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-400">
              {ticket.attachmentRef && (
                <span>
                  <i className="fa-solid fa-paperclip mr-1 text-slate-500"></i>
                  Attachment Ref: <span className="font-mono text-slate-700">{ticket.attachmentRef}</span>
                </span>
              )}
            </div>
          </div>

          {/* Reply Form */}
          {ticket.status !== 'Closed' && (
            <form onSubmit={handleSendReply} className="space-y-2">
              <div className="flex gap-2">
                <textarea
                  rows="2"
                  placeholder="Type your response or update here..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="flex-1 p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                ></textarea>
                <button
                  type="submit"
                  disabled={!replyMessage.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition self-end"
                >
                  <i className="fa-solid fa-paper-plane mr-1"></i>
                  Send
                </button>
              </div>

              {canManageSupport && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="internalNoteCheck"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded text-amber-600 accent-amber-600"
                  />
                  <label htmlFor="internalNoteCheck" className="text-[11px] font-medium text-amber-900 cursor-pointer">
                    <i className="fa-solid fa-lock text-amber-600 mr-1"></i>
                    Post as Internal Support Note (Visible ONLY to support engineers, hidden from employee)
                  </label>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Resolve Dialog */}
      {showResolveDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm">Record Ticket Resolution</h3>
            <p className="text-xs text-slate-500">
              Summarize the actions taken to resolve this ticket. The employee will be prompted to confirm closure.
            </p>
            <form onSubmit={handleResolveSubmit} className="space-y-3">
              <textarea
                rows="3"
                placeholder="e.g., Re-configured SSL gateway certificate, restarted service, and verified successful client handshake."
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              ></textarea>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResolveDialog(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close & Rating Dialog */}
      {showCloseDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm">Confirm Closure & Rate Support</h3>
            <p className="text-xs text-slate-500">
              Please rate your experience with the support team for this request.
            </p>
            <form onSubmit={handleCloseSubmit} className="space-y-3">
              <div className="flex items-center justify-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSatisfactionRating(star)}
                    className="p-1 focus:outline-none"
                  >
                    <i
                      className={`fa-solid fa-star text-2xl ${
                        star <= satisfactionRating ? 'text-amber-400' : 'text-slate-200'
                      } transition`}
                    ></i>
                  </button>
                ))}
              </div>
              <textarea
                rows="2"
                placeholder="Optional feedback comments..."
                value={satisfactionFeedback}
                onChange={(e) => setSatisfactionFeedback(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              ></textarea>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseDialog(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded"
                >
                  Close Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Dialog */}
      {showReopenDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm">Reopen Ticket</h3>
            <p className="text-xs text-slate-500">
              If the resolution did not resolve the issue, explain why so the support team can continue work.
            </p>
            <form onSubmit={handleReopenSubmit} className="space-y-3">
              <textarea
                rows="3"
                placeholder="e.g., The issue reoccurred after rebooting the machine..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                required
              ></textarea>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReopenDialog(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium rounded"
                >
                  Reopen Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Resolver Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm">Assign Ticket Resolver &amp; Queue</h3>
            <p className="text-xs text-slate-500">
              Route to a support team and assign a designated resolver from the active employee directory.
            </p>
            <form onSubmit={handleAssignSubmit} className="space-y-3">
              {teams.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Support Team
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {teams.map((tm) => (
                      <option key={tm.teamId} value={tm.teamId}>
                        {tm.teamName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {employees.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Active Employee (Optional)
                  </label>
                  <select
                    value={selectedResolverId}
                    onChange={(e) => {
                      const val = e.target.value
                      setSelectedResolverId(val)
                      const match = employees.find((emp) => emp.id === val || emp.employeeCode === val)
                      if (match) {
                        setResolverNameInput(
                          match.name || `${match.firstName || ''} ${match.lastName || ''}`.trim()
                        )
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Custom / Manual Resolver Name --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()} ({emp.employeeCode || emp.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolver Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={resolverNameInput}
                  onChange={(e) => setResolverNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignDialog(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded"
                >
                  {isBusy ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Escalate Dialog */}
      {showEscalateDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-3">
            <h3 className="font-semibold text-rose-700 text-sm">Escalate Support Ticket</h3>
            <p className="text-xs text-slate-500">
              Provide a mandatory escalation reason (min 5 characters) to elevate priority to High/Critical SLA monitoring.
            </p>
            <form onSubmit={handleEscalateSubmit} className="space-y-3">
              <textarea
                rows="3"
                placeholder="e.g., Blocking payroll finalization / executive production outage..."
                value={escalationReasonInput}
                onChange={(e) => setEscalationReasonInput(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                required
              ></textarea>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEscalateDialog(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium rounded"
                >
                  {isBusy ? 'Escalating...' : 'Confirm Escalation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
