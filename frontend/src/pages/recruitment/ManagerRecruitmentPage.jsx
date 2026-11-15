import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { recruitmentService } from '@/services/recruitmentService'
import { employeeService } from '@/services/employeeService'
import { useAuth } from '@/context/useAuth'
import { syncRecruitment, syncOrganization } from '@/services/backendSync'
import AppIcon from '@/components/common/AppIcon'
import RequisitionVacancyTab from '@/components/recruitment/RequisitionVacancyTab'
import CandidateDirectoryTab from '@/components/recruitment/CandidateDirectoryTab'
import CandidateDetailModal from '@/components/recruitment/CandidateDetailModal'
import InterviewScheduleTab from '@/components/recruitment/InterviewScheduleTab'
import ProbationManagementTab from '@/components/recruitment/ProbationManagementTab'
import { cn } from '@/lib/utils'

export function ManagerRecruitmentPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const activeMainTab = searchParams.get('tab') || 'requisitions'

  const currentUser = useMemo(() => ({
    name: user?.name || 'Bilal Siddiqui',
    role: 'manager',
    employeeId: user?.employeeId || 'EMP-003',
    departmentId: 'DEP-002',
    departmentName: 'Engineering'
  }), [user?.name, user?.employeeId])

  const [selectedCandidate, setSelectedCandidate] = useState(null)

  // Reactive state
  const [requisitions, setRequisitions] = useState(() => recruitmentService.getRequisitions({}, currentUser))
  const [vacancies, setVacancies] = useState(() => recruitmentService.getVacancies({}, currentUser))
  const [candidates, setCandidates] = useState(() => recruitmentService.getCandidates({}, currentUser))
  const [interviews, setInterviews] = useState(() => recruitmentService.getInterviews({}, currentUser))
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
    setProbationRecords(recruitmentService.getProbationRecords({}, currentUser))

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

  // Manager specific metrics
  const pendingScorecards = (interviews || []).filter((i) => i.status === 'Scheduled').length
  const activeProbationCount = (probationRecords || []).filter((p) => p.currentStatus === 'Active' || p.currentStatus === 'Under Review').length

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

  const tabs = [
    { id: 'requisitions', label: 'Team Requisitions & Vacancies', icon: 'recruitment', count: (requisitions || []).length },
    { id: 'candidates', label: 'Assigned Candidates', icon: 'employees', count: (candidates || []).length },
    { id: 'interviews', label: 'Interviews & Scorecards', icon: 'tasks', count: (interviews || []).length, badge: pendingScorecards > 0 ? `${pendingScorecards} due` : null },
    { id: 'probation', label: 'Direct Report Probations', icon: 'check', count: (probationRecords || []).length, badge: activeProbationCount > 0 ? `${activeProbationCount} active` : null }
  ]

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner */}
      <div className="bg-white rounded-lg border border-hrms-border p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-hrms-accent text-xs font-semibold mb-1.5 border border-blue-200">
              <AppIcon name="recruitment" className="w-3 h-3" />
              <span>Manager Portal • Team Talent & Hiring</span>
            </div>
            <h1 className="text-xl font-black text-hrms-primary tracking-tight">
              {activeMainTab === 'candidates'
                ? 'Assigned Candidates'
                : activeMainTab === 'interviews'
                ? 'Interviews & Scorecards'
                : activeMainTab === 'probation'
                ? 'Direct Report Probations'
                : 'Team Requisitions & Vacancies'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeMainTab === 'candidates'
                ? 'Candidates under review for your engineering openings with salary details masked.'
                : activeMainTab === 'interviews'
                ? 'Scheduled technical and panel interview rounds and evaluation scorecards.'
                : activeMainTab === 'probation'
                ? 'Review milestones, performance criteria, and tenure reviews for probationary direct reports.'
                : 'Request headcount expansions, create job requisitions, and track active team vacancies.'}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
            <div className="w-8 h-8 rounded-full bg-hrms-accent/10 text-hrms-accent flex items-center justify-center font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-slate-900">{currentUser.name}</div>
              <div className="text-[11px] text-slate-500">{currentUser.departmentName} Manager</div>
            </div>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500 font-semibold uppercase">Team Requisitions</div>
            <div className="text-xl font-black text-hrms-primary mt-0.5">{(requisitions || []).length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Active hiring requests</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500 font-semibold uppercase">Team Candidates</div>
            <div className="text-xl font-black text-hrms-primary mt-0.5">{(candidates || []).length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Salary details masked</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500 font-semibold uppercase">My Assigned Interviews</div>
            <div className="text-xl font-black text-indigo-700 mt-0.5">{(interviews || []).length}</div>
            <div className="text-[10px] text-indigo-600 mt-0.5">{pendingScorecards} pending evaluation</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500 font-semibold uppercase">Direct Report Probations</div>
            <div className="text-xl font-black text-amber-700 mt-0.5">{(probationRecords || []).length}</div>
            <div className="text-[10px] text-amber-600 mt-0.5">{activeProbationCount} currently tracking</div>
          </div>
        </div>
      </div>

      {/* Main Submodule Content View (One Submodule = One Functional Screen) */}
      <div className="bg-white rounded-lg border border-hrms-border shadow-2xs overflow-hidden">
        <div className="p-5">
          {activeMainTab === 'requisitions' && (
            <RequisitionVacancyTab
              currentUser={currentUser}
              requisitions={requisitions}
              vacancies={vacancies}
              departments={departments}
              teams={teams}
              designations={designations}
              employees={employees}
              onCreateRequisition={handleCreateRequisition}
              onUpdateRequisition={handleUpdateRequisition}
              onViewCandidatesForVacancy={(_vacId) => {
                setActiveMainTab('candidates')
              }}
            />
          )}

          {activeMainTab === 'candidates' && (
            <CandidateDirectoryTab
              currentUser={currentUser}
              candidates={candidates}
              vacancies={vacancies}
              departments={departments}
              selectedVacancyFilter="all"
              onSelectCandidate={(cand) => setSelectedCandidate(cand)}
            />
          )}

          {activeMainTab === 'interviews' && (
            <InterviewScheduleTab
              currentUser={currentUser}
              interviews={interviews}
              candidates={candidates}
              vacancies={vacancies}
              employees={employees}
            />
          )}

          {activeMainTab === 'probation' && (
            <ProbationManagementTab
              currentUser={currentUser}
              probationRecords={probationRecords}
              departments={departments}
            />
          )}
        </div>
      </div>

      {/* Candidate Profile Modal */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          currentUser={currentUser}
          onClose={() => setSelectedCandidate(null)}
          onUpdateStage={(stage, rejectionReason) => {
            recruitmentService.updateCandidateStage(
              selectedCandidate.id,
              stage,
              rejectionReason,
              currentUser.name
            )
            const updated = recruitmentService.getCandidateById(selectedCandidate.id, currentUser)
            setSelectedCandidate(updated)
          }}
          onAddNote={async (text, isConfidential) => {
            const { apiClient } = await import('@/services/apiClient')
            const targetId = selectedCandidate?.cuid || selectedCandidate?.id
            await apiClient.post(`/recruitment/candidates/${targetId}/notes`, {
              content: text.trim(),
              isConfidential: Boolean(isConfidential),
              author: currentUser.name,
              authorRole: currentUser.role
            })
            const updated = recruitmentService.getCandidateById(selectedCandidate.id, currentUser)
            setSelectedCandidate(updated)
          }}
        />
      )}
    </div>
  )
}

export default ManagerRecruitmentPage
