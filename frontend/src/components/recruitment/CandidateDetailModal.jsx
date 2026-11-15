import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/utils'

export function CandidateDetailModal({
  candidate,
  isOpen,
  onClose,
  currentUser = null,
  onUpdateStage,
  onAddNote
}) {
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'stages' | 'notes'
  const [newNoteText, setNewNoteText] = useState('')
  const [isConfidential, setIsConfidential] = useState(false)
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)
  const [noteError, setNoteError] = useState(null)
  const [selectedNextStage, setSelectedNextStage] = useState('')
  const [stageTransitionNote, setStageTransitionNote] = useState('')

  if (!isOpen || !candidate) return null
  const fullName = (
    candidate.fullName ||
    [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
  ).trim() || 'Unknown Candidate'
  const isManager = currentUser?.role === 'manager'

  const STAGES = [
    'Application Received',
    'Initial Screening',
    'Shortlisted',
    'Interview Scheduled',
    'Interview Completed',
    'Final Evaluation',
    'Offer Stage',
    'Hired'
  ]

  const currentStageIndex = STAGES.indexOf(candidate.stage)

  const handleNoteSubmit = async (e) => {
    e.preventDefault()
    if (!newNoteText.trim() || isSubmittingNote) return
    try {
      setIsSubmittingNote(true)
      setNoteError(null)
      await onAddNote(
        candidate.id,
        newNoteText.trim(),
        isConfidential,
        currentUser?.name || 'Recruiter',
        currentUser?.role || 'HR Admin'
      )
      setNewNoteText('')
      setIsConfidential(false)
    } catch (err) {
      setNoteError(err.message || 'Failed to post note. Please try again.')
    } finally {
      setIsSubmittingNote(false)
    }
  }

  const handleStageSubmit = (e) => {
    e.preventDefault()
    if (!selectedNextStage) return
    onUpdateStage(candidate.id, selectedNextStage, stageTransitionNote.trim())
    setSelectedNextStage('')
    setStageTransitionNote('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-hrms-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-hrms-border text-left flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-800 text-white font-black flex items-center justify-center text-sm shadow-xs">
              {fullName.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-hrms-primary">{fullName}</h3>
                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {candidate.id}
                </span>
                <StatusBadge status={candidate.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Applied for <strong>{candidate.vacancyTitle}</strong> • {candidate.city} • Applied {candidate.applicationDate}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-4 sm:px-5 bg-white text-xs font-bold gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              "py-2.5 border-b-2 transition-all flex items-center gap-1.5",
              activeTab === 'overview'
                ? "border-hrms-accent text-hrms-accent"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <AppIcon name="user" className="w-3.5 h-3.5" />
            <span>Profile & CV</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stages')}
            className={cn(
              "py-2.5 border-b-2 transition-all flex items-center gap-1.5",
              activeTab === 'stages'
                ? "border-hrms-accent text-hrms-accent"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <AppIcon name="tasks" className="w-3.5 h-3.5" />
            <span>Hiring Pipeline ({candidate.stage})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={cn(
              "py-2.5 border-b-2 transition-all flex items-center gap-1.5",
              activeTab === 'notes'
                ? "border-hrms-accent text-hrms-accent"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <AppIcon name="letters" className="w-3.5 h-3.5" />
            <span>Internal Notes ({(candidate.notes || []).length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: OVERVIEW & QUALIFICATIONS */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium">Email Address:</span>
                  <div className="font-semibold text-slate-800 font-mono">{candidate.email}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Phone Number:</span>
                  <div className="font-semibold text-slate-800 font-mono">{candidate.phone || '—'}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Current Employer:</span>
                  <div className="font-semibold text-slate-800">{candidate.currentCompany || 'Not Specified'}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Current Role:</span>
                  <div className="font-semibold text-slate-800">{candidate.currentDesignation || 'Applicant'}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Relevant Experience:</span>
                  <div className="font-semibold text-slate-800">{candidate.experienceYears} Years</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Notice Period:</span>
                  <div className="font-semibold text-slate-800">{candidate.noticePeriodDays != null
                    ? `${candidate.noticePeriodDays} Days`
                    : 'Not Recorded'}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Candidate Source:</span>
                  <div className="font-semibold text-slate-800">{candidate.source}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Expected Salary:</span>
                  {isManager ? (
                    <div className="text-slate-400 italic flex items-center gap-1">
                      <AppIcon name="lock" className="w-3 h-3 text-slate-400" />
                      Confidential (Authorized HR Only)
                    </div>
                  ) : (
                    <div className="font-bold text-slate-900 font-mono">
                      {candidate.expectedSalary != null &&
                        Number.isFinite(Number(candidate.expectedSalary))
                        ? `${Number(candidate.expectedSalary).toLocaleString()} PKR / month`
                        : 'Not Recorded'}                    </div>
                  )}
                </div>
              </div>

              {/* Skills */}
              <div>
                <h4 className="font-bold text-slate-800 mb-1.5">Technical & Professional Competencies</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(Array.isArray(candidate.skills)
                    ? candidate.skills
                    : String(candidate.skills || '').split(',')
                  ).filter((skill) => String(skill).trim()).length > 0 ? (
                    (Array.isArray(candidate.skills)
                      ? candidate.skills
                      : String(candidate.skills || '').split(',')
                    ).filter((skill) => String(skill).trim()).map((skill, idx) => (
                      <span
                        key={idx}
                        className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-semibold"
                      >
                        {String(skill).trim()}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">Not Recorded</span>
                  )}
                </div>
              </div>

              {/* Resume Download / Preview */}
              {/* Resume Download / Preview */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                {candidate.resumeUrl || candidate.cvResumeRef ? (
                  <a
                    href={candidate.resumeUrl || candidate.cvResumeRef}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    View Attached CV
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">
                    No CV / Resume Attached
                  </span>
                )}
              </div>

              {candidate.rejectionReason && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-md text-rose-800">
                  <span className="font-bold">Rejection Note: </span>
                  {candidate.rejectionReason}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STAGE PROGRESSION & STEPPER */}
          {activeTab === 'stages' && (
            <div className="space-y-5">
              {/* Visual Pipeline Stepper */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-3 text-xs">Recruitment Pipeline Workflow</h4>
                <div className="flex items-center justify-between overflow-x-auto pb-2 gap-1">
                  {STAGES.map((s, index) => {
                    const isPassed = currentStageIndex > index
                    const isCurrent = candidate.stage === s
                    return (
                      <div key={s} className="flex flex-col items-center min-w-[70px] text-center">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] mb-1",
                          isCurrent ? "bg-hrms-accent text-white ring-2 ring-blue-300" :
                            isPassed ? "bg-emerald-600 text-white" :
                              "bg-slate-200 text-slate-500"
                        )}>
                          {isPassed ? <AppIcon name="check" className="w-2.5 h-2.5" /> : index + 1}
                        </div>
                        <span className={cn(
                          "text-[9px] leading-tight font-semibold",
                          isCurrent ? "text-hrms-accent font-bold" :
                            isPassed ? "text-emerald-800" : "text-slate-400"
                        )}>
                          {s}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Stage Transition Control */}
              {candidate.status === 'Active' && onUpdateStage && (
                <form onSubmit={handleStageSubmit} className="bg-white p-3.5 border border-slate-200 rounded-lg space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs">Advance Candidate Hiring Stage</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Select Next Stage *</label>
                      <select
                        required
                        value={selectedNextStage}
                        onChange={(e) => setSelectedNextStage(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium"
                      >
                        <option value="">-- Choose Stage --</option>
                        {STAGES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Transition Reason / Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Cleared technical screening round"
                        value={stageTransitionNote}
                        onChange={(e) => setStageTransitionNote(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!selectedNextStage}
                      className="px-3.5 py-1.5 text-xs font-bold rounded bg-hrms-accent text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Update Stage
                    </button>
                  </div>
                </form>
              )}

              {/* Stage History Log */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Stage Transition History</h4>
                <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                  {(candidate.stageHistory || []).map((h, idx) => (
                    <div key={idx} className="relative text-xs">
                      <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-hrms-accent" />
                      <div className="font-semibold text-slate-800">
                        {h.fromStage ? `${h.fromStage} → ` : ''}
                        <span className="text-hrms-accent font-bold">{h.toStage}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        By {h.actor} • {h.timestamp}
                      </div>
                      {h.note && (
                        <p className="text-slate-600 italic text-[11px] mt-0.5">{h.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INTERNAL NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <form onSubmit={handleNoteSubmit} className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-800 text-xs">Add Interviewer / HR Note</h4>
                <textarea
                  rows="2"
                  required
                  placeholder="Record internal feedback, salary expectations, interview impressions..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-hrms-accent"
                />
                {noteError && (
                  <p className="text-xs text-rose-600 font-semibold">{noteError}</p>
                )}
                <div className="flex items-center justify-between">
                  {!isManager && (
                    <label className="flex items-center gap-1.5 text-slate-600 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isConfidential}
                        onChange={(e) => setIsConfidential(e.target.checked)}
                        className="rounded text-hrms-accent"
                      />
                      <span className="flex items-center gap-1">
                        <AppIcon name="lock" className="w-3 h-3 text-amber-600" />
                        Confidential (HR Admin / Super Admin Only)
                      </span>
                    </label>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmittingNote}
                    className="px-3 py-1.5 bg-hrms-accent text-white font-bold rounded hover:bg-blue-700 ml-auto disabled:opacity-50 transition-opacity"
                  >
                    {isSubmittingNote ? 'Posting...' : 'Post Note'}
                  </button>
                </div>
              </form>

              {/* Notes List */}
              <div className="space-y-2.5">
                {(candidate.notes || []).length === 0 ? (
                  <p className="text-slate-400 italic text-center py-4">No internal notes recorded yet.</p>
                ) : (
                  (candidate.notes || []).map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "p-3 rounded-lg border text-xs",
                        n.isConfidentialHrOnly
                          ? "bg-amber-50/50 border-amber-200"
                          : "bg-white border-slate-200"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          {n.author} ({n.authorRole})
                          {n.isConfidentialHrOnly && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                              <AppIcon name="lock" className="w-2.5 h-2.5" />
                              Confidential
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{n.timestamp}</span>
                      </div>
                      <p className="text-slate-700">{n.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold rounded bg-slate-200 text-slate-800 hover:bg-slate-300 text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default CandidateDetailModal
