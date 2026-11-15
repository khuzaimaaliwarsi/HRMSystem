import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import trainingService from '@/services/trainingService'
import employeeService from '@/services/employeeService'

import TrainingSummaryCards from '@/components/training/TrainingSummaryCards'
import TrainingCatalogTable from '@/components/training/TrainingCatalogTable'
import TrainingProgramModal from '@/components/training/TrainingProgramModal'
import TrainingPlansTable from '@/components/training/TrainingPlansTable'
import TrainingPlanModal from '@/components/training/TrainingPlanModal'
import TrainingSessionsTable from '@/components/training/TrainingSessionsTable'
import TrainingSessionModal from '@/components/training/TrainingSessionModal'
import SessionAttendanceModal from '@/components/training/SessionAttendanceModal'
import EnrollmentProgressTable from '@/components/training/EnrollmentProgressTable'
import AssessmentReviewModal from '@/components/training/AssessmentReviewModal'
import CertificatesTable from '@/components/training/CertificatesTable'
import CertificatePreviewModal from '@/components/training/CertificatePreviewModal'

export default function SuperAdminTrainingPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'catalog')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Master State
  const [kpis, setKpis] = useState({})
  const [programs, setPrograms] = useState([])
  const [plans, setPlans] = useState([])
  const [sessions, setSessions] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [certificates, setCertificates] = useState([])
  const [employees, setEmployees] = useState([])

  // Modal states
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false)
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] = useState(null)
  const [enrollModalSession, setEnrollModalSession] = useState(null)
  const [enrollEmployeeId, setEnrollEmployeeId] = useState('')
  const [selectedEnrollmentForAssessment, setSelectedEnrollmentForAssessment] = useState(null)
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [actionNotice, setActionNotice] = useState(null)

  const loadData = () => {
    try {
      setKpis(trainingService.getTrainingKPIs() || {})
    } catch (e) {
      console.error('Error loading training KPIs:', e)
      setKpis({})
    }
    try {
      setPrograms(trainingService.getPrograms() || [])
    } catch (e) {
      console.error('Error loading programs:', e)
      setPrograms([])
    }
    try {
      setPlans(trainingService.getPlans({}, user) || [])
    } catch (e) {
      console.error('Error loading plans:', e)
      setPlans([])
    }
    try {
      setSessions(trainingService.getSessions() || [])
    } catch (e) {
      console.error('Error loading sessions:', e)
      setSessions([])
    }
    try {
      setEnrollments(trainingService.getEnrollments({}, user) || [])
    } catch (e) {
      console.error('Error loading enrollments:', e)
      setEnrollments([])
    }
    try {
      setCertificates(trainingService.getCertificates({}, user) || [])
    } catch (e) {
      console.error('Error loading certificates:', e)
      setCertificates([])
    }
    try {
      setEmployees(
        (employeeService.getAllEmployees() || []).filter(
          (emp) => String(emp.status || emp.employmentStatus || '')
            .toUpperCase() === 'ACTIVE'
        )
      )
    } catch (e) {
      console.error('Error loading employees:', e)
      setEmployees([])
    }
  }


  useEffect(() => {
    loadData()

    let mounted = true

    trainingService.loadTrainingDataAsync()
      .then(() => {
        if (mounted) loadData()
      })
      .catch((err) => {
        if (mounted) {
          setActionNotice({
            type: 'error',
            text: err.message || 'Failed to load training records.'
          })
        }
      })

    const unsubscribe = trainingService.subscribe(() => {
      if (mounted) loadData()
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [user])

  const handleSaveProgram = async (programData) => {
    try {
      if (programData.id) {
        await trainingService.updateProgramAsync(programData.id, programData)
      } else {
        await trainingService.createProgramAsync(programData)
      }

      setActionNotice({
        type: 'success',
        text: `Course '${programData.title}' saved successfully to PostgreSQL.`
      })

      loadData()
    } catch (err) {
      setActionNotice({
        type: 'error',
        text: err.message || 'Failed to save course.'
      })
      throw err
    }
  }

  const handleArchiveProgram = async (id) => {
    try {
      await trainingService.archiveProgramAsync(id)
      setActionNotice({ type: 'success', text: 'Course archived in PostgreSQL. Historical training records preserved.' })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to archive course.' })
    }
  }

  const handleToggleProgramStatus = async (id) => {
    try {
      const updated = await trainingService.toggleProgramStatusAsync(id)
      setActionNotice({ type: 'success', text: `Course status updated to ${updated.status}.` })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to update course status.' })
    }
  }

  const handleSavePlan = async (planData) => {
    try {
      await trainingService.createPlanAsync(planData)
      setActionNotice({ type: 'success', text: 'Training plan saved successfully to PostgreSQL.' })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to save training plan.' })
      throw err
    }
  }

  const handleApprovePlan = async (planId) => {
    try {
      await trainingService.approvePlanAsync(planId, 'Approved by Super Admin executive authority')
      setActionNotice({ type: 'success', text: 'Training plan approved and saved to PostgreSQL.' })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to approve training plan.' })
    }
  }

  const handleRejectPlan = async (planId) => {
    try {
      await trainingService.rejectPlanAsync(planId, 'Declined under executive review')
      setActionNotice({ type: 'success', text: 'Training plan declined and saved to PostgreSQL.' })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to reject training plan.' })
    }
  }

  const handleScheduleSession = async (sessionData) => {
    try {
      await trainingService.scheduleSessionAsync(sessionData)
      setActionNotice({ type: 'success', text: 'Cohort training session scheduled and saved to PostgreSQL.' })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to schedule session.' })
      throw err
    }
  }

  const handleSaveAttendance = async (sessionId, attendanceList) => {
    try {
      await trainingService.recordSessionAttendanceAsync(sessionId, attendanceList)
      setActionNotice({ type: 'success', text: 'Session attendance ledger saved to PostgreSQL.' })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to record attendance.' })
      throw err
    }
  }

  const handleCompleteSession = async (sessionId) => {
    try {
      await trainingService.markSessionCompletedAsync(sessionId)
      setActionNotice({ type: 'success', text: 'Session marked completed in PostgreSQL.' })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to complete session.' })
    }
  }

  const handleCancelSession = async (sessionId) => {
    try {
      await trainingService.cancelSessionAsync(sessionId, 'Administrative cancellation')
      setActionNotice({ type: 'success', text: 'Session cancelled and saved to PostgreSQL.' })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to cancel session.' })
    }
  }

  const handleEnrollEmployee = async (e) => {
    e.preventDefault()
    if (!enrollModalSession || !enrollEmployeeId) return
    try {
      await trainingService.enrollEmployeeAsync({
        programId: enrollModalSession.programId,
        sessionId: enrollModalSession.id,
        employeeId: enrollEmployeeId
      })
      setActionNotice({ type: 'success', text: 'Employee enrolled into cohort and saved to PostgreSQL.' })
      setEnrollModalSession(null)
      setEnrollEmployeeId('')
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to enroll employee.' })
    }
  }

  const handleUpdateProgress = async (enrollmentId, pct) => {
    try {
      await trainingService.updateProgressAsync(enrollmentId, pct)
      setActionNotice({ type: 'success', text: `Learning progress updated to ${pct}% in PostgreSQL.` })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to update progress.' })
    }
  }

  const handleFinalizeAssessment = async (enrollmentId, assessmentData) => {
    try {
      const res = await trainingService.finalizeAssessmentAsync(enrollmentId, assessmentData)
      setActionNotice({
        type: 'success',
        text: res.certificateNumber
          ? `Assessment finalized (${res.score}%) and Certificate #${res.certificateNumber} persisted to PostgreSQL.`
          : 'Assessment finalized and saved to PostgreSQL.'
      })
      loadData()
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to finalize assessment.' })
      throw err
    }
  }

  const tabs = [
    { id: 'catalog', label: 'Course Catalog & Programs', icon: 'fa-book-bookmark' },
    { id: 'plans', label: 'Plans & Skill Recommendations', icon: 'fa-route', badge: plans.filter(p => p.status.includes('Pending')).length },
    { id: 'sessions', label: 'Cohorts & Scheduling', icon: 'fa-calendar-days', badge: sessions.filter(s => s.status === 'Scheduled').length },
    { id: 'progress', label: 'Learning Progress & Grades', icon: 'fa-chart-simple' },
    { id: 'certificates', label: 'Verified Certificates', icon: 'fa-award', badge: certificates.length }
  ]

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'plans'
              ? 'Training Plans & Skill Recommendations'
              : activeTab === 'sessions'
                ? 'Cohorts & Training Scheduling'
                : activeTab === 'progress'
                  ? 'Learning Progress & Assessment Grades'
                  : activeTab === 'certificates'
                    ? 'Verified Digital Certificates'
                    : 'Course Catalog & Learning Programs'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'plans'
              ? 'Review skills-gap analysis, validate recommended training plans, and approve program budgets.'
              : activeTab === 'sessions'
                ? 'Supervise cohort timetables, instructor assignments, attendance rosters, and completion rates.'
                : activeTab === 'progress'
                  ? 'Audit employee course progression, post-training evaluation scores, and compliance metrics.'
                  : activeTab === 'certificates'
                    ? 'Inspect cryptographic verification hashes, issued certifications, and accredited skill badges.'
                    : 'Curate internal learning syllabus, professional workshops, external vendor courses, and learning paths.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'catalog' && (
            <button
              type="button"
              onClick={() => {
                setSelectedProgram(null)
                setIsProgramModalOpen(true)
              }}
              className="px-3.5 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-2xs flex items-center gap-2 transition-all"
            >
              <i className="fa-solid fa-plus"></i>
              Publish Course
            </button>
          )}

          {activeTab === 'plans' && (
            <button
              type="button"
              onClick={() => setIsPlanModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-2xs flex items-center gap-2 transition-all"
            >
              <i className="fa-solid fa-plus"></i>
              Create Plan
            </button>
          )}

          {activeTab === 'sessions' && (
            <button
              type="button"
              onClick={() => setIsSessionModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-2xs flex items-center gap-2 transition-all"
            >
              <i className="fa-solid fa-calendar-plus"></i>
              Schedule Cohort
            </button>
          )}
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3 text-xs rounded-lg border flex items-center gap-2 ${actionNotice.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
        >
          <i className={`fa-solid ${actionNotice.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'}`}></i>
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* KPI Cards */}
      <TrainingSummaryCards kpis={kpis} />

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-slate-50/50 rounded-xl min-h-[400px]">
        {activeTab === 'catalog' && (
          <TrainingCatalogTable
            programs={programs}
            canManage={true}
            onEditProgram={(prog) => {
              setSelectedProgram(prog)
              setIsProgramModalOpen(true)
            }}
            onArchiveProgram={handleArchiveProgram}
            onToggleStatus={handleToggleProgramStatus}
            onViewProgram={(prog) => {
              setSelectedProgram(prog)
              setIsProgramModalOpen(true)
            }}
          />
        )}

        {activeTab === 'plans' && (
          <TrainingPlansTable
            plans={plans}
            canApprove={true}
            onApprovePlan={handleApprovePlan}
            onRejectPlan={handleRejectPlan}
          />
        )}

        {activeTab === 'sessions' && (
          <TrainingSessionsTable
            sessions={sessions}
            canManage={true}
            onOpenAttendance={(session) => setSelectedSessionForAttendance(session)}
            onCancelSession={handleCancelSession}
            onCompleteSession={handleCompleteSession}
            onEnrollParticipant={(session) => {
              setEnrollModalSession(session)
              setEnrollEmployeeId(employees[0]?.id || '')
            }}
          />
        )}

        {activeTab === 'progress' && (
          <EnrollmentProgressTable
            enrollments={enrollments}
            canEvaluate={true}
            canUpdateProgress={true}
            onUpdateProgress={handleUpdateProgress}
            onOpenAssessment={(enr) => setSelectedEnrollmentForAssessment(enr)}
          />
        )}

        {activeTab === 'certificates' && (
          <CertificatesTable
            certificates={certificates}
            onPreviewCertificate={(cert) => setSelectedCertificate(cert)}
          />
        )}
      </div>

      {/* Enroll Staff into Session Modal */}
      {enrollModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-left">
            <div className="px-6 py-4 bg-navy-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Enroll Employee in Cohort</h3>
                <p className="text-xs text-slate-300">{enrollModalSession.programTitle} • {enrollModalSession.sessionId}</p>
              </div>
              <button
                type="button"
                onClick={() => setEnrollModalSession(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEnrollEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={enrollEmployeeId}
                  onChange={(e) => setEnrollEmployeeId(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()} ({emp.employeeCode || emp.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEnrollModalSession(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm"
                >
                  Confirm Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      {isProgramModalOpen && (
        <TrainingProgramModal
          isOpen={isProgramModalOpen}
          program={selectedProgram}
          onClose={() => {
            setIsProgramModalOpen(false)
            setSelectedProgram(null)
          }}
          onSave={handleSaveProgram}
        />
      )}

      {isPlanModalOpen && (
        <TrainingPlanModal
          isOpen={isPlanModalOpen}
          programs={programs.filter(p => p.status === 'Active')}
          employees={employees}
          onClose={() => setIsPlanModalOpen(false)}
          onSave={handleSavePlan}
        />
      )}

      {isSessionModalOpen && (
        <TrainingSessionModal
          isOpen={isSessionModalOpen}
          programs={programs.filter(p => p.status === 'Active')}
          onClose={() => setIsSessionModalOpen(false)}
          onSave={handleScheduleSession}
        />
      )}

      {selectedSessionForAttendance && (
        <SessionAttendanceModal
          isOpen={Boolean(selectedSessionForAttendance)}
          session={selectedSessionForAttendance}
          canEdit={true}
          onClose={() => setSelectedSessionForAttendance(null)}
          onSaveAttendance={handleSaveAttendance}
        />
      )}

      {selectedEnrollmentForAssessment && (
        <AssessmentReviewModal
          isOpen={Boolean(selectedEnrollmentForAssessment)}
          enrollment={selectedEnrollmentForAssessment}
          onClose={() => setSelectedEnrollmentForAssessment(null)}
          onFinalize={handleFinalizeAssessment}
        />
      )}

      {selectedCertificate && (
        <CertificatePreviewModal
          isOpen={Boolean(selectedCertificate)}
          certificate={selectedCertificate}
          onClose={() => setSelectedCertificate(null)}
        />
      )}
    </div>
  )
}
