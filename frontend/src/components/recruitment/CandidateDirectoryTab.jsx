import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'
import { cn } from '@/lib/utils'

export function CandidateDirectoryTab({
  candidates = [],
  vacancies = [],
  departments: _departments = [],
  currentUser = null,
  initialVacancyFilter = 'all',
  onSelectCandidate,
  onCreateCandidate,
  onUpdateCandidateStage,
  onAddCandidateNote: _onAddCandidateNote
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [vacancyFilter, setVacancyFilter] = useState(initialVacancyFilter)
  const [stageFilter, setStageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [rejectingCandidate, setRejectingCandidate] = useState(null)
  const [rejectionReasonInput, setRejectionReasonInput] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  // New Candidate Form State
  const [candidateForm, setCandidateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: 'Islamabad',
    currentCompany: '',
    currentDesignation: '',
    experienceYears: 3,
    education: 'BS Computer Science',
    skills: '',
    expectedSalary: 200000,
    noticePeriodDays: 30,
    source: 'LinkedIn Direct',
    vacancyId: ''
  })

  const isManager = currentUser?.role === 'manager'

  // Stages array for pipeline filtering
  const STAGES = [
    'Application Received',
    'Initial Screening',
    'Shortlisted',
    'Interview Scheduled',
    'Interview Completed',
    'Final Evaluation',
    'Offer Stage',
    'Hired',
    'Rejected'
  ]

  const filteredCandidates = candidates
    .filter((c) => {
      if (vacancyFilter !== 'all' && c.vacancyId !== vacancyFilter) return false
      if (stageFilter !== 'all' && c.stage.toLowerCase() !== stageFilter.toLowerCase()) return false
      if (statusFilter !== 'all' && c.status.toLowerCase() !== statusFilter.toLowerCase()) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.vacancyTitle && c.vacancyTitle.toLowerCase().includes(q)) ||
        (Array.isArray(c.skills) && c.skills.some((s) => s.toLowerCase().includes(q)))
      )
    })
    .sort((a, b) => {
      // Latest First (descending) by applicationDate / id
      const dateA = a.applicationDate || a.createdDate || a.createdAt || a.id || ''
      const dateB = b.applicationDate || b.createdDate || b.createdAt || b.id || ''
      return dateB.localeCompare(dateA)
    })

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    try {
      setErrorMsg(null)
      await onCreateCandidate({
        ...candidateForm,
        experienceYears: Number(candidateForm.experienceYears),
        expectedSalary: Number(candidateForm.expectedSalary),
        noticePeriodDays: Number(candidateForm.noticePeriodDays)
      })
      setIsAddModalOpen(false)
      setCandidateForm({
        fullName: '',
        email: '',
        phone: '',
        city: 'Islamabad',
        currentCompany: '',
        currentDesignation: '',
        experienceYears: 3,
        education: 'BS Computer Science',
        skills: '',
        expectedSalary: 200000,
        noticePeriodDays: 30,
        source: 'LinkedIn Direct',
        vacancyId: ''
      })
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleRejectConfirm = () => {
    if (!rejectingCandidate) return
    if (!rejectionReasonInput.trim()) {
      setErrorMsg('Rejection reason is required.')
      return
    }
    try {
      setErrorMsg(null)
      onUpdateCandidateStage(
        rejectingCandidate.id,
        'Rejected',
        'Candidate rejected with formal reason.',
        rejectionReasonInput.trim()
      )
      setRejectingCandidate(null)
      setRejectionReasonInput('')
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
            Candidates & Applications
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            Active talent pipeline, resume screening, candidate profiles, and application statuses.
          </p>
        </div>
        {!isManager && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-hrms-accent text-white hover:bg-blue-700 shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5" />
            <span>Add Candidate</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <Alert variant="danger" dismissible onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-white p-3 rounded-lg border border-hrms-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search candidate name, email, skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-hrms-accent"
          />
          <AppIcon name="search" className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>

        {/* Filter by Vacancy */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium shrink-0">Vacancy:</span>
          <select
            value={vacancyFilter}
            onChange={(e) => setVacancyFilter(e.target.value)}
            className="w-full py-1.5 px-2 text-xs rounded-md border border-slate-300 bg-white font-medium truncate"
          >
            <option value="all">All Vacancies</option>
            {vacancies.map((v) => (
              <option key={v.id} value={v.id}>{v.title} ({v.openPositions} open)</option>
            ))}
          </select>
        </div>

        {/* Filter by Pipeline Stage */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium shrink-0">Stage:</span>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="w-full py-1.5 px-2 text-xs rounded-md border border-slate-300 bg-white font-medium"
          >
            <option value="all">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Filter by Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium shrink-0">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-1.5 px-2 text-xs rounded-md border border-slate-300 bg-white font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active In Pipeline</option>
            <option value="hired">Hired (Onboarded)</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>
      </div>

      {/* Candidate Records Table */}
      <div className="bg-white rounded-lg border border-hrms-border overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Candidate</th>
                <th className="py-2.5 px-3">Applied Vacancy</th>
                <th className="py-2.5 px-3">Hiring Stage</th>
                <th className="py-2.5 px-3">Experience & Skills</th>
                <th className="py-2.5 px-3">Expected Compensation</th>
                <th className="py-2.5 px-3">Resume</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">
                    No matching candidates found in the pipeline.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Candidate Name & Contact without Avatar Circle */}
                      <td className="py-2.5 px-3">
                        <div>
                          <div className="font-bold text-slate-900 hover:text-hrms-accent cursor-pointer" onClick={() => onSelectCandidate(c)}>
                            {c.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{c.id} • {c.email}</div>
                        </div>
                      </td>

                      {/* Vacancy */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{c.vacancyTitle}</div>
                        <div className="text-[11px] text-slate-500">{c.city} • Applied {c.applicationDate}</div>
                      </td>

                      {/* Stage Badge */}
                      <td className="py-3 px-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          c.stage === 'Hired' ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
                            c.stage === 'Offer Stage' ? "bg-teal-50 text-teal-800 border-teal-300" :
                              c.stage === 'Interview Scheduled' || c.stage === 'Interview Completed' ? "bg-purple-50 text-purple-800 border-purple-300" :
                                c.stage === 'Shortlisted' ? "bg-indigo-50 text-indigo-800 border-indigo-300" :
                                  c.stage === 'Rejected' ? "bg-rose-50 text-rose-800 border-rose-300" :
                                    "bg-slate-50 text-slate-700 border-slate-300"
                        )}>
                          {c.stage}
                        </span>
                      </td>

                      {/* Experience & Skills */}
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-semibold">{c.experienceYears} Years Exp</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                          {Array.isArray(c.skills) ? c.skills.slice(0, 3).join(', ') : c.skills}
                        </div>
                      </td>

                      {/* Expected Compensation (Shielded for Managers) */}
                      <td className="py-3 px-3 font-mono">
                        {isManager ? (
                          <span className="text-slate-400 italic text-[11px] flex items-center gap-1">
                            <AppIcon name="lock" className="w-2.5 h-2.5 text-slate-400" />
                            Confidential
                          </span>
                        ) : (
                          <span className="font-bold text-slate-800">
                            {c.expectedSalary != null && Number.isFinite(Number(c.expectedSalary))
                              ? `${Number(c.expectedSalary).toLocaleString()} PKR`
                              : 'Not Recorded'}                          </span>
                        )}
                      </td>

                      {/* Resume Reference */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-hrms-accent bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          <AppIcon name="pdf" className="w-3 h-3 text-rose-500" />
                          {c.cvResumeRef || 'Not Attached'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 text-slate-400">
                          <button
                            type="button"
                            onClick={() => onSelectCandidate(c)}
                            title="View Candidate"
                            className="p-1 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {c.status === 'Active' && (
                            <button
                              type="button"
                              onClick={() => setRejectingCandidate(c)}
                              title="Reject Candidate"
                              className="p-1 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )}
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
      {/* ADD CANDIDATE MODAL */}
      {/* ============================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-xl w-full max-h-[90vh] overflow-y-auto border border-hrms-border text-left">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-hrms-primary">Add Candidate Profile</h3>
                <p className="text-xs text-slate-500">Record a new applicant into the hiring pipeline</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Candidate full name"
                    value={candidateForm.fullName}
                    onChange={(e) => setCandidateForm({ ...candidateForm, fullName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-hrms-accent"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="candidate@example.com"
                    value={candidateForm.email}
                    onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-hrms-accent"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Contact Phone <span className="text-[10px] text-slate-400 font-normal">(Max 11 digits)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    placeholder="03000000000"
                    value={candidateForm.phone}
                    onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value.slice(0, 11) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Location</label>
                  <input
                    type="text"
                    placeholder="Islamabad / Rawalpindi / Lahore"
                    value={candidateForm.city}
                    onChange={(e) => setCandidateForm({ ...candidateForm, city: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Applied Vacancy *</label>
                  <select
                    required
                    value={candidateForm.vacancyId}
                    onChange={(e) =>
                      setCandidateForm({ ...candidateForm, vacancyId: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="" disabled>Select Vacancy</option>
                    {vacancies.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.departmentName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Years of Experience</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={candidateForm.experienceYears}
                    onChange={(e) => setCandidateForm({ ...candidateForm, experienceYears: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Salary (PKR Monthly)</label>
                  <input
                    type="number"
                    step="5000"
                    value={candidateForm.expectedSalary}
                    onChange={(e) => setCandidateForm({ ...candidateForm, expectedSalary: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Notice Period (Days)</label>
                  <input
                    type="number"
                    value={candidateForm.noticePeriodDays}
                    onChange={(e) => setCandidateForm({ ...candidateForm, noticePeriodDays: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Key Skills (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. React.js, Tailwind CSS, TypeScript, Vite"
                  value={candidateForm.skills}
                  onChange={(e) => setCandidateForm({ ...candidateForm, skills: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source of Applicant</label>
                <select
                  value={candidateForm.source}
                  onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                >
                  <option value="LinkedIn Direct">LinkedIn Direct</option>
                  <option value="Internal Referral">Internal Employee Referral</option>
                  <option value="Rozee.pk">Rozee.pk</option>
                  <option value="Career Site">Company Careers Site</option>
                  <option value="Headhunted">Executive Headhunted</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-hrms-accent text-white font-bold rounded-md hover:bg-blue-700 shadow-xs"
                >
                  Save & Add Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT CONFIRMATION MODAL */}
      {rejectingCandidate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-md w-full p-5 border border-hrms-border text-left">
            <h3 className="text-base font-bold text-rose-700 mb-1">Reject Candidate Application</h3>
            <p className="text-xs text-slate-600 mb-3">
              State formal rejection reason for <strong>{rejectingCandidate.fullName}</strong> applied for{' '}
              <strong>{rejectingCandidate.vacancyTitle}</strong>.
            </p>
            <textarea
              rows="3"
              required
              placeholder="e.g. Technical interview score did not meet senior threshold or salary expectation exceeded approved ceiling."
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md mb-4 focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRejectingCandidate(null)}
                className="px-3.5 py-1.5 font-semibold border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                className="px-4 py-1.5 font-bold rounded-md bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CandidateDirectoryTab
