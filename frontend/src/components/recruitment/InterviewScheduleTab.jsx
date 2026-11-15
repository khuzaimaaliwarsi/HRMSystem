import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Alert from '@/components/common/Alert'
import { cn } from '@/lib/utils'
import { formatTimeTo12Hour } from '@/lib/dateUtils'

export function InterviewScheduleTab({
  interviews = [],
  candidates = [],
  vacancies = [],
  employees = [],
  currentUser: _currentUser = null,
  onScheduleInterview,
  onSubmitEvaluation
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [evaluatingInterview, setEvaluatingInterview] = useState(null)
  const [viewingEvaluation, setViewingEvaluation] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  // Scheduling Form
  const [schedForm, setSchedForm] = useState(() => ({
    candidateId: candidates[0]?.id || '',
    vacancyId: vacancies[0]?.id || '',
    round: 'Round 1 - Technical Screening',
    type: 'Online',
    scheduledDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    startTime: '11:00',
    endTime: '12:00',
    interviewerIds: ['EMP-003'],
    venueMeetingLink: 'https://meet.google.com/isys-interview-room',
    notes: ''
  }))

  // Evaluation Form
  const [evalForm, setEvalForm] = useState({
    technicalCompetency: 4,
    communication: 4,
    relevantExperience: 4,
    problemSolving: 4,
    jobSpecificSkills: 4,
    recommendation: 'Hire',
    interviewerComments: ''
  })

  const filteredInterviews = interviews
    .filter((i) => {
      if (statusFilter !== 'all' && i.status.toLowerCase() !== statusFilter.toLowerCase()) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        i.candidateName.toLowerCase().includes(q) ||
        i.jobTitle.toLowerCase().includes(q) ||
        i.round.toLowerCase().includes(q) ||
        i.interviewerNames.some((n) => n.toLowerCase().includes(q))
      )
    })
    .sort((a, b) => {
      const dateA = a.scheduledDate || a.date || a.id || ''
      const dateB = b.scheduledDate || b.date || b.id || ''
      return dateB.localeCompare(dateA)
    })

  const handleScheduleSubmit = (e) => {
    e.preventDefault()
    try {
      setErrorMsg(null)
      onScheduleInterview(schedForm)
      setIsScheduleModalOpen(false)
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleEvalSubmit = (e) => {
    e.preventDefault()
    if (!evalForm.interviewerComments.trim()) {
      setErrorMsg('Interviewer evaluation comments are required.')
      return
    }
    try {
      setErrorMsg(null)
      onSubmitEvaluation(evaluatingInterview.id, evalForm)
      setEvaluatingInterview(null)
      setEvalForm({
        technicalCompetency: 4,
        communication: 4,
        relevantExperience: 4,
        problemSolving: 4,
        jobSpecificSkills: 4,
        recommendation: 'Hire',
        interviewerComments: ''
      })
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Submodule Header & Aligned Action Button — One Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            Interviews & Evaluations
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            Scheduled interview rounds, interviewer scorecards, ratings, and feedback evaluation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null)
            setIsScheduleModalOpen(true)
          }}
          className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-hrms-accent text-white hover:bg-blue-700 shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
        >
          <AppIcon name="plus" className="w-3.5 h-3.5" />
          <span>Schedule Interview</span>
        </button>
      </div>

      {errorMsg && (
        <Alert variant="danger" dismissible onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-hrms-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search candidate, job, interviewer..."
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
            <option value="all">All Interviews</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed & Evaluated</option>
          </select>
        </div>
      </div>

      {/* Interviews Table */}
      <div className="bg-white rounded-lg border border-hrms-border overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Candidate & Job</th>
                <th className="py-2.5 px-3">Interview Round</th>
                <th className="py-2.5 px-3">Type & Venue</th>
                <th className="py-2.5 px-3">Assigned Interviewers</th>
                <th className="py-2.5 px-3">Status / Score</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredInterviews.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">
                    No scheduled interviews found.
                  </td>
                </tr>
              ) : (
                filteredInterviews.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* Date and Time */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 font-mono">{item.scheduledDate}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{formatTimeTo12Hour(item.startTime)} - {formatTimeTo12Hour(item.endTime)}</div>
                    </td>

                    {/* Candidate */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{item.candidateName}</div>
                      <div className="text-[11px] text-slate-500">{item.jobTitle}</div>
                    </td>

                    {/* Round */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-700">{item.round}</span>
                    </td>

                    {/* Type and Venue */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 font-semibold text-slate-800">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          item.type === 'Online' ? "bg-emerald-500" : "bg-blue-500"
                        )} />
                        {item.type}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[150px] font-mono">
                        {item.venueMeetingLink}
                      </div>
                    </td>

                    {/* Interviewers */}
                    <td className="py-3 px-3">
                      <div className="text-slate-800 font-semibold">{item.interviewerNames.join(', ')}</div>
                    </td>

                    {/* Status / Evaluation Score */}
                    <td className="py-3 px-3">
                      {item.status === 'Completed' && item.evaluation ? (
                        <div>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold",
                            item.evaluation.recommendation === 'Strong Hire' ? "bg-emerald-100 text-emerald-800" :
                            item.evaluation.recommendation === 'Hire' ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                          )}>
                            Score: {item.evaluation.overallScore}/5 ({item.evaluation.recommendation})
                          </span>
                        </div>
                      ) : (
                        <StatusBadge status={item.status} />
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      {item.status === 'Scheduled' && (
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg(null)
                            setEvaluatingInterview(item)
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded bg-hrms-accent text-white hover:bg-blue-700 shadow-2xs inline-flex items-center gap-1.5 transition-colors"
                        >
                          <AppIcon name="edit" className="w-3.5 h-3.5" />
                          <span>Evaluate</span>
                        </button>
                      )}
                      {item.status === 'Completed' && item.evaluation && (
                        <button
                          type="button"
                          onClick={() => setViewingEvaluation(item)}
                          className="px-2.5 py-1 text-[11px] font-bold text-hrms-accent hover:bg-blue-50 rounded border border-blue-200 inline-flex items-center gap-1.5 transition-colors"
                        >
                          <AppIcon name="info" className="w-3.5 h-3.5" />
                          <span>View Scorecard</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SCHEDULE INTERVIEW MODAL */}
      {/* ============================================================== */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-lg w-full max-h-[90vh] overflow-y-auto border border-hrms-border text-left">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-hrms-primary">Schedule Evaluation Interview</h3>
                <p className="text-xs text-slate-500">Automated conflict check detects overlapping interviewer time slots</p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Candidate *</label>
                <select
                  required
                  value={schedForm.candidateId}
                  onChange={(e) => {
                    const c = candidates.find(cand => cand.id === e.target.value)
                    setSchedForm({
                      ...schedForm,
                      candidateId: e.target.value,
                      vacancyId: c ? c.vacancyId : schedForm.vacancyId
                    })
                  }}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                >
                  {candidates.filter(c => c.status === 'Active').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} — {c.vacancyTitle} ({c.stage})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Evaluation Round *</label>
                <select
                  value={schedForm.round}
                  onChange={(e) => setSchedForm({ ...schedForm, round: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                >
                  <option value="Round 1 - Technical Screening">Round 1 - Technical Screening</option>
                  <option value="Round 2 - Technical Coding & Architecture">Round 2 - Technical Coding & Architecture</option>
                  <option value="Round 3 - HR & Culture Fit Assessment">Round 3 - HR & Culture Fit Assessment</option>
                  <option value="Final Management Round">Final Management Round</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Interview Type</label>
                  <select
                    value={schedForm.type}
                    onChange={(e) => setSchedForm({ ...schedForm, type: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="Online">Online (Video Meet)</option>
                    <option value="Onsite">Onsite (Islamabad Office)</option>
                    <option value="Phone">Phone Call</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={schedForm.scheduledDate}
                    onChange={(e) => setSchedForm({ ...schedForm, scheduledDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={schedForm.startTime}
                    onChange={(e) => setSchedForm({ ...schedForm, startTime: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={schedForm.endTime}
                    onChange={(e) => setSchedForm({ ...schedForm, endTime: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Interviewer *</label>
                <select
                  value={schedForm.interviewerIds[0] || 'EMP-003'}
                  onChange={(e) => setSchedForm({ ...schedForm, interviewerIds: [e.target.value] })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                >
                  {employees.filter(e => e.status !== 'Separated').map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.designation} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Venue / Online Meeting Link</label>
                <input
                  type="text"
                  placeholder="e.g. https://meet.google.com/isys-interview"
                  value={schedForm.venueMeetingLink}
                  onChange={(e) => setSchedForm({ ...schedForm, venueMeetingLink: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-hrms-accent text-white font-bold rounded-md hover:bg-blue-700 shadow-xs"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5-POINT EVALUATION SCORECARD MODAL */}
      {/* ============================================================== */}
      {evaluatingInterview && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-xl w-full max-h-[90vh] overflow-y-auto border border-hrms-border text-left">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-hrms-primary">Interview Evaluation Scorecard</h3>
                <p className="text-xs text-slate-500">
                  Candidate: <strong>{evaluatingInterview.candidateName}</strong> ({evaluatingInterview.round})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEvaluatingInterview(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEvalSubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-800 text-xs">5-Point Competency Ratings (1 = Unsatisfactory, 5 = Exceptional)</h4>

                {[
                  { key: 'technicalCompetency', label: '1. Technical Competency & Depth' },
                  { key: 'communication', label: '2. Communication & Clarity of Thought' },
                  { key: 'relevantExperience', label: '3. Relevant Hands-on Architecture Experience' },
                  { key: 'problemSolving', label: '4. Problem Solving & Analytical Aptitude' },
                  { key: 'jobSpecificSkills', label: '5. Specific Framework & Tool Mastery' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-slate-700">{label}</span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setEvalForm({ ...evalForm, [key]: score })}
                          className={cn(
                            "w-7 h-7 rounded text-xs font-bold transition-all",
                            evalForm[key] === score
                              ? "bg-hrms-accent text-white shadow-xs"
                              : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                          )}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Final Hiring Recommendation *</label>
                <select
                  value={evalForm.recommendation}
                  onChange={(e) => setEvalForm({ ...evalForm, recommendation: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-bold"
                >
                  <option value="Strong Hire">Strong Hire (Top 10% Candidate)</option>
                  <option value="Hire">Hire (Meets All Role Criteria)</option>
                  <option value="Consider">Consider (Borderline / Second Review Needed)</option>
                  <option value="Do Not Hire">Do Not Hire (Does Not Meet Standards)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Interviewer Feedback & Observations *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Document specific technical questions answered, algorithmic strengths, code cleanliness, and leadership fit..."
                  value={evalForm.interviewerComments}
                  onChange={(e) => setEvalForm({ ...evalForm, interviewerComments: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-hrms-accent"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEvaluatingInterview(null)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-md hover:bg-emerald-700 shadow-xs"
                >
                  Submit Official Scorecard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW COMPLETED SCORECARD MODAL */}
      {viewingEvaluation && viewingEvaluation.evaluation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-md w-full p-5 border border-hrms-border text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Official Evaluation Scorecard</h3>
                <p className="text-xs text-slate-500">{viewingEvaluation.candidateName} • {viewingEvaluation.round}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingEvaluation(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div>
                  <span className="text-[11px] text-blue-700 font-semibold uppercase">Overall Assessment</span>
                  <div className="text-lg font-black text-blue-900">
                    {viewingEvaluation.evaluation.overallScore} / 5.0
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-blue-800 border border-blue-300 shadow-2xs">
                  {viewingEvaluation.evaluation.recommendation}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                <div>Technical: <strong>{viewingEvaluation.evaluation.technicalCompetency}/5</strong></div>
                <div>Communication: <strong>{viewingEvaluation.evaluation.communication}/5</strong></div>
                <div>Experience: <strong>{viewingEvaluation.evaluation.relevantExperience}/5</strong></div>
                <div>Problem Solving: <strong>{viewingEvaluation.evaluation.problemSolving}/5</strong></div>
                <div>Skills Mastery: <strong>{viewingEvaluation.evaluation.jobSpecificSkills}/5</strong></div>
              </div>

              <div>
                <span className="font-bold text-slate-700">Interviewer Comments:</span>
                <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 italic">
                  "{viewingEvaluation.evaluation.interviewerComments}"
                </p>
              </div>

              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 flex justify-between">
                <span>Evaluated By: <strong>{viewingEvaluation.evaluation.evaluatedBy}</strong></span>
                <span>{viewingEvaluation.evaluation.evaluatedAt}</span>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingEvaluation(null)}
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

export default InterviewScheduleTab
