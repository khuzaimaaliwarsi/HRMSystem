import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { recruitmentService } from '@/services/recruitmentService'
import { employeeService } from '@/services/employeeService'
import { useAuth } from '@/context/useAuth'
import { syncRecruitment, syncOrganization } from '@/services/backendSync'
import RequisitionVacancyTab from '@/components/recruitment/RequisitionVacancyTab'
import CandidateDirectoryTab from '@/components/recruitment/CandidateDirectoryTab'
import CandidateDetailModal from '@/components/recruitment/CandidateDetailModal'
import InterviewScheduleTab from '@/components/recruitment/InterviewScheduleTab'
import OffersJoiningTab from '@/components/recruitment/OffersJoiningTab'
import ProbationManagementTab from '@/components/recruitment/ProbationManagementTab'

export function SuperAdminRecruitmentPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const activeMainTab = searchParams.get('tab') || 'vacancies'

  const currentUser = useMemo(() => ({
    name: user?.displayName || user?.name || user?.username || 'Super Admin',
    role: 'super_admin',
    employeeId: user?.employeeId || null
  }), [user?.displayName, user?.name, user?.username, user?.employeeId])

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [vacancyFilterForCandidates, setVacancyFilterForCandidates] = useState('all')

  // Reactive state from services
  const [requisitions, setRequisitions] = useState(() => recruitmentService.getRequisitions({}, currentUser))
  const [vacancies, setVacancies] = useState(() => recruitmentService.getVacancies({}, currentUser))
  const [candidates, setCandidates] = useState(() => recruitmentService.getCandidates({}, currentUser))
  const [interviews, setInterviews] = useState(() => recruitmentService.getInterviews({}, currentUser))
  const [offers, setOffers] = useState(() => recruitmentService.getOffers({}, currentUser))
  const [probationRecords, setProbationRecords] = useState(() => recruitmentService.getProbationRecords({}, currentUser))

  const [departments, setDepartments] = useState(() => employeeService.getDepartments())
  const [teams, setTeams] = useState(() => employeeService.getTeams())
  const [designations, setDesignations] = useState(() => employeeService.getDesignations())
  const [employees, setEmployees] = useState(() => employeeService.getEmployees())

  const loadData = useCallback(() => {
    setRequisitions(recruitmentService.getRequisitions({}, currentUser))
    setVacancies(recruitmentService.getVacancies({}, currentUser))
    setCandidates(recruitmentService.getCandidates({}, currentUser))
    setInterviews(recruitmentService.getInterviews({}, currentUser))
    setOffers(recruitmentService.getOffers({}, currentUser))
    setProbationRecords(recruitmentService.getProbationRecords({}, currentUser))

    setDepartments(employeeService.getDepartments())
    setTeams(employeeService.getTeams())
    setDesignations(employeeService.getDesignations())
    setEmployees(employeeService.getEmployees())
  }, [currentUser])

  useEffect(() => {
    // On mount: sync from PostgreSQL first, then load local state
    const unsubRecruitment = recruitmentService.subscribe(() => loadData())
    const unsubEmployee = employeeService.subscribe(() => loadData())
    // Pull real data from DB on page load
    Promise.allSettled([syncOrganization(), syncRecruitment()]).then(() => loadData())
    return () => {
      unsubRecruitment()
      unsubEmployee()
    }
  }, [loadData])

  // Handlers for Requisitions & Vacancies
  const handleCreateRequisition = async (data) => {
    const { apiClient } = await import('@/services/apiClient')
    const depts = employeeService.getDepartments()
    const desigs = employeeService.getDesignations()
    const dept = depts.find((d) => d.id === data.departmentId || d.code === data.departmentId)
    const desig = desigs.find((d) => d.id === data.designationId || d.code === data.designationId)
    if (!dept) throw new Error('Please select a valid Department before submitting.')
    if (!desig) throw new Error('Please select a valid Designation before submitting.')
    await apiClient.post('/recruitment/requisitions', {
      departmentId: dept.id,
      designationId: desig.id,
      openingsCount: Number(data.openPositions) || 1,
      justification: data.hiringReason || data.jobTitle || 'Hiring Request',
      targetDate: data.expectedJoiningDate || null,
      compensationBasis: data.compensationBasis || data.salaryRange?.period || 'Monthly',
      budgetRange: data.salaryRange ? `PKR ${data.salaryRange.min} - ${data.salaryRange.max}` : null
    })
    await syncRecruitment()
    loadData()
  }

  const handleUpdateRequisition = async (id, data) => {
    const { apiClient } = await import('@/services/apiClient')
    const reqs = recruitmentService.getRequisitions({}, currentUser)
    const req = reqs.find((r) =>
      [r.id, r.cuid, r.requisitionNumber, r.requisitionCode].some((value) => value != null && String(value) === String(id))
    )
    if (!req) throw new Error('Requisition not found. Refresh the page and try again.')

    // Use the PostgreSQL record ID, never the human-facing REQ-2026-xxx code.
    const targetId = req.cuid || (String(req.id || '').startsWith('REQ-') ? null : req.id)
    if (!targetId) throw new Error('Database ID unavailable for this requisition. Refresh and retry.')

    const depts = employeeService.getDepartments()
    const desigs = employeeService.getDesignations()
    const requestedDepartment = data.departmentId ?? req.departmentId
    const requestedDesignation = data.designationId ?? req.designationId
    const dept = depts.find((d) => d.id === requestedDepartment || d.code === requestedDepartment)
    const desig = desigs.find((d) => d.id === requestedDesignation || d.code === requestedDesignation)

    if (!dept || !desig) throw new Error('Select valid department and designation before saving.')
    const openingsCount = Number(data.openPositions ?? data.openingsCount ?? req.openPositions ?? req.openingsCount)
    if (!Number.isInteger(openingsCount) || openingsCount < 1) {
      throw new Error('Number of open positions must be a positive whole number.')
    }

    const payload = {
      departmentId: dept.id,
      designationId: desig.id,
      openingsCount,
      justification: (data.hiringReason ?? data.justification ?? req.hiringReason ?? req.justification ?? '').trim(),
      compensationBasis: data.compensationBasis ?? data.salaryRange?.period ?? req.compensationBasis,
    }
    if (data.salaryRange && data.salaryRange.min !== '' && data.salaryRange.max !== '') {
      payload.budgetRange = `PKR ${data.salaryRange.min} - ${data.salaryRange.max}`
    }
    if (data.expectedJoiningDate !== undefined) payload.targetDate = data.expectedJoiningDate || null

    await apiClient.patch(`/recruitment/requisitions/${encodeURIComponent(targetId)}`, payload)
    await syncRecruitment()
    loadData()
  }

  const handleApproveRequisition = async (id) => {
    const { apiClient } = await import('@/services/apiClient')
    // find cuid from memory if available
    const reqs = recruitmentService.getRequisitions({}, currentUser)
    const req = reqs.find((r) => r.id === id || r.cuid === id || r.requisitionNumber === id)
    const targetId = req?.cuid || req?.id || id
    await apiClient.patch(`/recruitment/requisitions/${targetId}/review`, { action: 'APPROVE' })
    await syncRecruitment()
    loadData()
  }

  const handleRejectRequisition = async (id, reason) => {
    const { apiClient } = await import('@/services/apiClient')
    const reqs = recruitmentService.getRequisitions({}, currentUser)
    const req = reqs.find((r) => r.id === id || r.cuid === id || r.requisitionNumber === id)
    const targetId = req?.cuid || req?.id || id
    await apiClient.patch(`/recruitment/requisitions/${targetId}/review`, { action: 'REJECT', reviewComments: reason })
    await syncRecruitment()
    loadData()
  }

  const handleUpdateVacancyStatus = async (id, newStatus) => {
    const { apiClient } = await import('@/services/apiClient')
    const vacs = recruitmentService.getVacancies({}, currentUser)
    const vac = vacs.find((v) => v.id === id || v.cuid === id || v.openingCode === id)
    const targetId = vac?.cuid || vac?.id || id
    await apiClient.patch(`/recruitment/openings/${targetId}`, { status: newStatus })
    await syncRecruitment()
    loadData()
  }

  const handleUpdateVacancy = async (id, data) => {
    const { apiClient } = await import('@/services/apiClient')
    const vacs = recruitmentService.getVacancies({}, currentUser)
    const vac = vacs.find((v) => v.id === id || v.cuid === id || v.openingCode === id)
    const targetId = vac?.cuid || vac?.id || id
    await apiClient.patch(`/recruitment/openings/${targetId}`, data)
    await syncRecruitment()
    loadData()
  }

  const handleDeleteVacancy = async (id) => {
    const { apiClient } = await import('@/services/apiClient')
    const vacs = recruitmentService.getVacancies({}, currentUser)
    const vac = vacs.find((v) => v.id === id || v.cuid === id || v.openingCode === id)
    const targetId = vac?.cuid || vac?.id || id
    await apiClient.delete(`/recruitment/openings/${targetId}`)
    await syncRecruitment()
    loadData()
  }

  const handleDeleteRequisition = async (id) => {
    const { apiClient } = await import('@/services/apiClient')
    const reqs = recruitmentService.getRequisitions({}, currentUser)
    const req = reqs.find((r) => r.id === id || r.cuid === id || r.requisitionNumber === id)
    const targetId = req?.cuid || req?.id || id
    await apiClient.delete(`/recruitment/requisitions/${targetId}`)
    await syncRecruitment()
    loadData()
  }

  // Handlers for Candidates

  const handleCreateCandidate = async (data) => {
    const { apiClient } = await import('@/services/apiClient')
    console.log('CANDIDATE FORM PAYLOAD:', data)
    const fullName = String(data.fullName || '').trim()

    if (!fullName) {
      throw new Error('Candidate full name is required.')
    }

    const parts = fullName.split(/\s+/)

    const selectedVacancy = vacancies.find(
      (v) => v.id === data.vacancyId || v.cuid === data.vacancyId
    )

    if (!selectedVacancy) {
      throw new Error('Please select a valid vacancy.')
    }

    const openingId = selectedVacancy.cuid || selectedVacancy.id

    if (!openingId) {
      throw new Error('Selected vacancy is missing its database ID.')
    }

    const sourceMap = {
      'LinkedIn Direct': 'LINKEDIN',
      'Internal Referral': 'REFERRAL',
      'Rozee.pk': 'JOB_PORTAL',
      'Career Site': 'CAREERS_PAGE',
      'Headhunted': 'DIRECT'
    }

    const source = sourceMap[data.source]

    if (!source) {
      throw new Error('Invalid candidate source.')
    }

    const response = await apiClient.post('/recruitment/candidates', {
      openingId,
      firstName: parts[0],
      lastName: parts.slice(1).join(' ') || '.',
      email: String(data.email || '').trim(),
      phone: String(data.phone || '').trim(),
      currentCompany: data.currentCompany || null,
      currentDesignation: data.currentDesignation || null,
      totalExperienceYears: Number(data.experienceYears),
      source
    })

    if (!response?.id) {
      throw new Error('Candidate was not saved successfully.')
    }



    await syncRecruitment()
    loadData()
  }


  const handleUpdateCandidateStage = async (id, stage, note, reason = null) => {
    const { apiClient } = await import('@/services/apiClient')

    const candidate = recruitmentService.getCandidateById(id, currentUser)
    const applicationId = candidate?.applicationId

    if (!applicationId) {
      throw new Error('Candidate has no linked Job Application.')
    }

    const stageMap = {
      'Application Received': 'APPLIED',
      'Initial Screening': 'SCREENING',
      'Shortlisted': 'SHORTLISTED',
      'Interview Scheduled': 'INTERVIEWING',
      'Interview Completed': 'INTERVIEWING',
      'Final Evaluation': 'INTERVIEWING',
      'Offer Stage': 'OFFERED',
      'Hired': 'HIRED',
      'Rejected': 'REJECTED',
      'Withdrawn': 'WITHDRAWN'
    }

    const status = stageMap[stage]

    if (!status) {
      throw new Error('Invalid hiring stage.')
    }

    await apiClient.patch(
      `/recruitment/applications/${applicationId}/status`,
      {
        status,
        stageNotes: reason || note || null
      }
    )

    await syncRecruitment()
    loadData()
    setSelectedCandidate(null)
  }

  const handleAddCandidateNote = async (id, noteText, isConfidential, author, authorRole) => {
    const { apiClient } = await import('@/services/apiClient')
    const cand = recruitmentService.getCandidateById(id, currentUser)
    const targetId = cand?.cuid || cand?.id || id
    await apiClient.post(`/recruitment/candidates/${targetId}/notes`, {
      content: noteText.trim(),
      isConfidential: Boolean(isConfidential),
      author: author || currentUser.name,
      authorRole: authorRole || currentUser.role
    })
    await syncRecruitment()
    loadData()
    if (selectedCandidate && (selectedCandidate.id === id || selectedCandidate.cuid === id)) {
      const refreshed = recruitmentService.getCandidateById(id, currentUser)
      setSelectedCandidate(refreshed)
    }
  }

  // Handlers for Interviews
  const handleScheduleInterview = (data) => {
    recruitmentService.scheduleInterview(data, currentUser.name)
  }

  const handleSubmitEvaluation = (interviewId, evalData) => {
    recruitmentService.submitInterviewEvaluation(interviewId, evalData, currentUser.name)
  }

  // Handlers for Offers & Joining
  const handleCreateOffer = (data) => {
    recruitmentService.createOffer(data, currentUser.name)
  }

  const handleUpdateOffer = (id, data) => {
    recruitmentService.updateOffer(id, data, currentUser.name)
  }

  const handleSubmitOfferForApproval = (id) => {
    recruitmentService.submitOfferForApproval(id, currentUser.name)
  }

  const handleApproveOffer = (id) => {
    recruitmentService.approveOffer(id, currentUser.name)
  }

  const handleRejectOffer = (id, reason) => {
    recruitmentService.rejectOffer(id, reason, currentUser.name)
  }

  const handleIssueOffer = (id) => {
    recruitmentService.issueOffer(id, currentUser.name)
  }

  const handleRecordOfferResponse = (id, response, reason) => {
    recruitmentService.recordCandidateOfferResponse(id, response, reason, currentUser.name)
  }

  const handleConfirmJoining = (joiningData) => {
    return recruitmentService.convertCandidateToEmployee(joiningData, currentUser.name)
  }

  // Handlers for Probation
  const handleSubmitManagerAssessment = (probationId, data) => {
    recruitmentService.submitManagerProbationAssessment(probationId, data, currentUser.name)
  }

  const handleSubmitHrReview = (probationId, data) => {
    recruitmentService.submitHrProbationReview(probationId, data, currentUser.name)
  }

  const handleFinalizeDecision = (probationId, decisionData) => {
    recruitmentService.finalizeProbationDecision(probationId, decisionData, currentUser.name)
  }

  return (
    <div className="space-y-4 text-left">
      {/* Main Tab Panels */}
      {activeMainTab === 'vacancies' && (
        <RequisitionVacancyTab
          requisitions={requisitions}
          vacancies={vacancies}
          departments={departments}
          teams={teams}
          designations={designations}
          currentUser={currentUser}
          onCreateRequisition={handleCreateRequisition}
          onUpdateRequisition={handleUpdateRequisition}
          onDeleteRequisition={handleDeleteRequisition}
          onApproveRequisition={handleApproveRequisition}
          onRejectRequisition={handleRejectRequisition}
          onUpdateVacancy={handleUpdateVacancy}
          onDeleteVacancy={handleDeleteVacancy}
          onUpdateVacancyStatus={handleUpdateVacancyStatus}
          onSelectVacancyForFilter={(vacId) => {
            setVacancyFilterForCandidates(vacId)
          }}
        />
      )}

      {activeMainTab === 'candidates' && (
        <CandidateDirectoryTab
          candidates={candidates}
          vacancies={vacancies}
          departments={departments}
          currentUser={currentUser}
          initialVacancyFilter={vacancyFilterForCandidates}
          onSelectCandidate={(c) => setSelectedCandidate(c)}
          onCreateCandidate={handleCreateCandidate}
          onUpdateCandidateStage={handleUpdateCandidateStage}
          onAddCandidateNote={handleAddCandidateNote}
        />
      )}

      {activeMainTab === 'interviews' && (
        <InterviewScheduleTab
          interviews={interviews}
          candidates={candidates}
          vacancies={vacancies}
          employees={employees}
          currentUser={currentUser}
          onScheduleInterview={handleScheduleInterview}
          onSubmitEvaluation={handleSubmitEvaluation}
        />
      )}

      {activeMainTab === 'offers' && (
        <OffersJoiningTab
          offers={offers}
          candidates={candidates}
          vacancies={vacancies}
          departments={departments}
          teams={teams}
          designations={designations}
          employees={employees}
          currentUser={currentUser}
          onCreateOffer={handleCreateOffer}
          onUpdateOffer={handleUpdateOffer}
          onSubmitOfferForApproval={handleSubmitOfferForApproval}
          onApproveOffer={handleApproveOffer}
          onRejectOffer={handleRejectOffer}
          onIssueOffer={handleIssueOffer}
          onRecordResponse={handleRecordOfferResponse}
          onConfirmJoining={handleConfirmJoining}
        />
      )}

      {activeMainTab === 'probation' && (
        <ProbationManagementTab
          probationRecords={probationRecords}
          currentUser={currentUser}
          onSubmitManagerAssessment={handleSubmitManagerAssessment}
          onSubmitHrReview={handleSubmitHrReview}
          onFinalizeDecision={handleFinalizeDecision}
        />
      )}

      {/* Candidate Profile Dossier Modal */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          isOpen={Boolean(selectedCandidate)}
          onClose={() => setSelectedCandidate(null)}
          currentUser={currentUser}
          onUpdateStage={handleUpdateCandidateStage}
          onAddNote={handleAddCandidateNote}
        />
      )}
    </div>
  )
}

export default SuperAdminRecruitmentPage
