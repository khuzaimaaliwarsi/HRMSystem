import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { recruitmentService } from '@/services/recruitmentService'
import { employeeService } from '@/services/employeeService'
import { useAuth } from '@/context/useAuth'
import { syncRecruitment, syncOrganization } from '@/services/backendSync'
import RecruitmentKpiCards from '@/components/recruitment/RecruitmentKpiCards'
import RequisitionVacancyTab from '@/components/recruitment/RequisitionVacancyTab'
import CandidateDirectoryTab from '@/components/recruitment/CandidateDirectoryTab'
import CandidateDetailModal from '@/components/recruitment/CandidateDetailModal'
import InterviewScheduleTab from '@/components/recruitment/InterviewScheduleTab'
import OffersJoiningTab from '@/components/recruitment/OffersJoiningTab'
import ProbationManagementTab from '@/components/recruitment/ProbationManagementTab'
import AppIcon from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'

export function HrAdminRecruitmentPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const activeMainTab = searchParams.get('tab') || 'vacancies'

  const currentUser = useMemo(() => ({
    name: user?.name || 'Ayesha Khan',
    role: 'hr_admin',
    employeeId: user?.employeeId || 'EMP-002'
  }), [user?.name, user?.employeeId])

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [vacancyFilterForCandidates, setVacancyFilterForCandidates] = useState('all')

  const [requisitions, setRequisitions] = useState(() => recruitmentService.getRequisitions({}, currentUser))
  const [vacancies, setVacancies] = useState(() => recruitmentService.getVacancies({}, currentUser))
  const [candidates, setCandidates] = useState(() => recruitmentService.getCandidates({}, currentUser))
  const [interviews, setInterviews] = useState(() => recruitmentService.getInterviews({}, currentUser))
  const [offers, setOffers] = useState(() => recruitmentService.getOffers({}, currentUser))
  const [probationRecords, setProbationRecords] = useState(() => recruitmentService.getProbationRecords({}, currentUser))
  const [stats, setStats] = useState(() => recruitmentService.getRecruitmentOverviewStats(currentUser))

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
    setStats(recruitmentService.getRecruitmentOverviewStats(currentUser))

    setDepartments(employeeService.getDepartments())
    setTeams(employeeService.getTeams())
    setDesignations(employeeService.getDesignations())
    setEmployees(employeeService.getEmployees())
  }, [currentUser])

  useEffect(() => {
    const unsubRecruitment = recruitmentService.subscribe(() => loadData())
    const unsubEmployee = employeeService.subscribe(() => loadData())
    // Pull real data from PostgreSQL on mount
    Promise.allSettled([syncOrganization(), syncRecruitment()]).then(() => loadData())
    return () => {
      unsubRecruitment()
      unsubEmployee()
    }
  }, [loadData])

  // Handlers
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
    const req = reqs.find((r) => r.id === id || r.cuid === id || r.requisitionNumber === id)
    const targetId = req?.cuid || req?.id || id
    const depts = employeeService.getDepartments()
    const desigs = employeeService.getDesignations()
    const dept = depts.find((d) => d.id === data.departmentId || d.code === data.departmentId)
    const desig = desigs.find((d) => d.id === data.designationId || d.code === data.designationId)
    await apiClient.patch(`/recruitment/requisitions/${targetId}`, {
      departmentId: dept?.id || data.departmentId,
      designationId: desig?.id || data.designationId,
      openingsCount: Number(data.openPositions) || 1,
      justification: data.hiringReason || data.jobTitle || 'Hiring Request',
      compensationBasis: data.compensationBasis || data.salaryRange?.period || 'Monthly',
      budgetRange: data.salaryRange ? `PKR ${data.salaryRange.min} - ${data.salaryRange.max}` : null
    })
    await syncRecruitment()
    loadData()
  }

  const handleApproveRequisition = async (id) => {
    const { apiClient } = await import('@/services/apiClient')
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

  const handleCreateCandidate = async (data) => {
    const { apiClient } = await import('@/services/apiClient')
    const nameParts = (data.name || '').trim().split(/\s+/)
    await apiClient.post('/recruitment/candidates', {
      firstName: nameParts[0] || 'Candidate',
      lastName: nameParts.slice(1).join(' ') || '.',
      email: data.email,
      phone: data.phone,
      currentCompany: data.currentCompany,
      currentDesignation: data.currentRole,
      totalExperienceYears: parseFloat(data.experience) || 0,
      source: data.source || 'Direct'
    })
    await syncRecruitment()
    loadData()
  }

  const handleUpdateCandidateStage = (id, stage, note, reason = null) => {
    recruitmentService.updateCandidateStage(id, stage, note, currentUser.name, reason)
    if (selectedCandidate && selectedCandidate.id === id) {
      setSelectedCandidate(recruitmentService.getCandidateById(id, currentUser))
    }
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

  const handleScheduleInterview = (data) => {
    recruitmentService.scheduleInterview(data, currentUser.name)
  }

  const handleSubmitEvaluation = (interviewId, evalData) => {
    recruitmentService.submitInterviewEvaluation(interviewId, evalData, currentUser.name)
  }

  const handleCreateOffer = (data) => {
    recruitmentService.createOffer(data, currentUser.name)
  }

  const handleUpdateOffer = (id, data) => {
    recruitmentService.updateOffer(id, data, currentUser.name)
  }

  const handleSubmitOfferForApproval = (id) => {
    recruitmentService.submitOfferForApproval(id, currentUser.name)
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

  const handleSubmitHrReview = (probationId, data) => {
    recruitmentService.submitHrProbationReview(probationId, data, currentUser.name)
  }

  return (
    <div className="space-y-4 text-left">
      {/* Tab Panels */}
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
            setActiveMainTab('candidates')
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
          onIssueOffer={handleIssueOffer}
          onRecordResponse={handleRecordOfferResponse}
          onConfirmJoining={handleConfirmJoining}
        />
      )}

      {activeMainTab === 'probation' && (
        <ProbationManagementTab
          probationRecords={probationRecords}
          currentUser={currentUser}
          onSubmitHrReview={handleSubmitHrReview}
        />
      )}

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

export default HrAdminRecruitmentPage
