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

export default function HrAdminTrainingPage() {
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

  // Data States
  const [kpis, setKpis] = useState({})
  const [programs, setPrograms] = useState([])
  const [plans, setPlans] = useState([])
  const [sessions, setSessions] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [certificates, setCertificates] = useState([])
  const [employees, setEmployees] = useState([])

  // Modal States
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
      setSessions(trainingService.getSessions({}, user) || [])
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
      setEmployees(employeeService.getAllEmployees() || [])
    } catch (e) {
      console.error('Error loading employees:', e)
      setEmployees([])
    }
  }

  useEffect(() => {
    loadData()
    let mounted = true
    Promise.allSettled([
      trainingService.loadTrainingDataAsync(),
      employeeService.loadEmployeesAsync ? employeeService.loadEmployeesAsync() : Promise.resolve()
    ])
      .then(() => {
        if (mounted) loadData()
      })
      .catch((err) => {
        if (mounted) {
          triggerNotice(err.message || 'Failed to load training records.', 'error')
        }
      })

    const unsubscribe = trainingService.subscribe(() => {
      if (mounted) loadData()
    })
    return () => {
      mounted = false
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [user])

  const triggerNotice = (msg, type = 'success') => {
    setActionNotice({ msg, type })
    setTimeout(() => setActionNotice(null), 4000)
  }

  // Program Handlers
  const handleSaveProgram = async (progData) => {
    try {
      if (selectedProgram?.id || progData.id) {
        await trainingService.updateProgramAsync(progData.id || selectedProgram.id, progData)
        triggerNotice('Training program updated and saved to PostgreSQL.')
      } else {
        await trainingService.createProgramAsync(progData)
        triggerNotice('New training program created and saved to PostgreSQL.')
      }
      setIsProgramModalOpen(false)
      setSelectedProgram(null)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to save training program', 'error')
      throw err
    }
  }

  const handleToggleProgramStatus = async (programId) => {
    try {
      const res = await trainingService.toggleProgramStatusAsync(programId)
      triggerNotice(`Training program marked as ${res.status}.`)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to toggle program status', 'error')
    }
  }

  const handleArchiveProgram = async (programId) => {
    try {
      await trainingService.archiveProgramAsync(programId)
      triggerNotice('Training program archived in PostgreSQL.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to archive program', 'error')
    }
  }

  // Plan Handlers
  const handleSavePlan = async (planData) => {
    try {
      await trainingService.createPlanAsync(planData)
      triggerNotice('Training recommendation saved to PostgreSQL.')
      setIsPlanModalOpen(false)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to submit training plan', 'error')
      throw err
    }
  }

  const handleApprovePlan = async (planId) => {
    try {
      await trainingService.approvePlanAsync(planId, 'Approved by HR Administrator')
      triggerNotice('Training plan approved and saved to PostgreSQL.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to approve training plan', 'error')
    }
  }

  const handleRejectPlan = async (planId) => {
    const reason = window.prompt('Enter rejection reason:')
    if (!reason) return
    try {
      await trainingService.rejectPlanAsync(planId, reason)
      triggerNotice('Training plan rejected and saved to PostgreSQL.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to reject training plan', 'error')
    }
  }

  // Session Handlers
  const handleSaveSession = async (sessionData) => {
    try {
      await trainingService.scheduleSessionAsync(sessionData)
      triggerNotice('Training cohort session scheduled and saved to PostgreSQL.')
      setIsSessionModalOpen(false)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to schedule session', 'error')
      throw err
    }
  }

  const handleCompleteSession = async (sessionId) => {
    try {
      await trainingService.markSessionCompletedAsync(sessionId)
      triggerNotice('Training session marked completed in PostgreSQL.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to complete session', 'error')
    }
  }

  const handleCancelSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled training session?')) return
    try {
      await trainingService.cancelSessionAsync(sessionId, 'Cancelled by HR administration')
      triggerNotice('Training session cancelled in PostgreSQL.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to cancel session', 'error')
    }
  }

  const handleSaveAttendance = async (sessionId, attendanceRoster) => {
    try {
      await trainingService.recordSessionAttendanceAsync(sessionId, attendanceRoster)
      triggerNotice('Session attendance roster saved to PostgreSQL.')
      setSelectedSessionForAttendance(null)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to record attendance', 'error')
      throw err
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
      triggerNotice('Employee enrolled into training session and saved to PostgreSQL.')
      setEnrollModalSession(null)
      setEnrollEmployeeId('')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to enroll employee', 'error')
    }
  }

  const handleUpdateProgress = async (enrollmentId, pct) => {
    try {
      await trainingService.updateProgressAsync(enrollmentId, pct)
      triggerNotice(`Learning progress updated to ${pct}% in PostgreSQL.`)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to update progress', 'error')
    }
  }

  // Assessment & Grading Handler
  const handleSaveAssessment = async (enrollmentId, assessmentPayload) => {
    try {
      const res = await trainingService.finalizeAssessmentAsync(enrollmentId, assessmentPayload)
      if (res.status === 'Completed' && res.certificateNumber) {
        triggerNotice(`Assessment finalized! Participant passed with ${res.assessmentScore}% and Certificate #${res.certificateNumber} was saved to PostgreSQL.`)
      } else {
        triggerNotice(`Assessment finalized (${res.assessmentScore}% - ${res.status}) and saved to PostgreSQL.`)
      }
      setSelectedEnrollmentForAssessment(null)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to submit assessment', 'error')
      throw err
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'plans'
              ? 'Training Plans & Skill Recommendations'
              : activeTab === 'sessions'
              ? 'Cohorts & Training Scheduling'
              : activeTab === 'progress'
              ? 'Learning Progress & Assessment Grades'
              : activeTab === 'certificates'
              ? 'Verified Digital Certificates'
              : 'Course Catalog & Learning Programs'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === 'plans'
              ? 'Manage departmental upskilling recommendations and individual training roadmaps.'
              : activeTab === 'sessions'
              ? 'Schedule training sessions, assign instructors, and manage attendee rosters.'
              : activeTab === 'progress'
              ? 'Track employee completion status, attendance logs, and test scorecards.'
              : activeTab === 'certificates'
              ? 'Issue and verify certificates of completion for trained employees.'
              : 'Design curricula, course categories, prerequisites, and learning materials.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedProgram(null)
              setIsProgramModalOpen(true)
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <i className="fa-solid fa-plus"></i>
            New Course
          </button>
          <button
            onClick={() => setIsSessionModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <i className="fa-solid fa-calendar-plus"></i>
            Schedule Cohort
          </button>
          <button
            onClick={() => setIsPlanModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <i className="fa-solid fa-user-plus"></i>
            Assign Plan
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-lg border text-sm flex items-center justify-between transition-all ${
            actionNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <i className={`fa-solid ${actionNotice.type === 'error' ? 'fa-circle-exclamation text-rose-600' : 'fa-circle-check text-emerald-600'}`}></i>
            <span>{actionNotice.msg}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Operational KPI Summary */}
      <TrainingSummaryCards kpis={kpis} />

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-800">Corporate Training Program Catalog</h2>
              <span className="text-xs text-slate-500">Active and draft training curriculum available company-wide</span>
            </div>
            <TrainingCatalogTable
              programs={programs}
              canManage={true}
              onEditProgram={(prog) => {
                setSelectedProgram(prog)
                setIsProgramModalOpen(true)
              }}
              onArchiveProgram={handleArchiveProgram}
              onToggleStatus={handleToggleProgramStatus}
            />
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-800">Training Recommendations & Assignments</h2>
              <span className="text-xs text-slate-500">Skill-gap assignments and manager-recommended training approvals</span>
            </div>
            <TrainingPlansTable
              plans={plans}
              canApprove={true}
              onApprovePlan={handleApprovePlan}
              onRejectPlan={handleRejectPlan}
            />
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-800">Scheduled Training Cohorts & Attendance</h2>
              <span className="text-xs text-slate-500">Classroom sessions, workshop scheduling, and participation rosters</span>
            </div>
            <TrainingSessionsTable
              sessions={sessions}
              canManage={true}
              onOpenAttendance={(session) => setSelectedSessionForAttendance(session)}
              onCompleteSession={handleCompleteSession}
              onCancelSession={handleCancelSession}
              onEnrollParticipant={(session) => {
                setEnrollModalSession(session)
                setEnrollEmployeeId(employees[0]?.id || '')
              }}
            />
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-800">Employee Learning Progress & Evaluation Desk</h2>
              <span className="text-xs text-slate-500">Track progress milestones, grade knowledge assessments, and issue certificates</span>
            </div>
            <EnrollmentProgressTable
              enrollments={enrollments}
              canEvaluate={true}
              canUpdateProgress={true}
              onUpdateProgress={handleUpdateProgress}
              onOpenAssessment={(enr) => setSelectedEnrollmentForAssessment(enr)}
            />
          </div>
        )}

        {activeTab === 'certificates' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-800">Issued Training Certificates & Accreditations</h2>
              <span className="text-xs text-slate-500">Digitally authenticated corporate credentials with verification codes</span>
            </div>
            <CertificatesTable
              certificates={certificates}
              onPreviewCertificate={(cert) => setSelectedCertificate(cert)}
            />
          </div>
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
          programs={programs.filter((p) => p.status === 'Active')}
          employees={employees}
          currentUser={user}
          onClose={() => setIsPlanModalOpen(false)}
          onSave={handleSavePlan}
        />
      )}

      {isSessionModalOpen && (
        <TrainingSessionModal
          isOpen={isSessionModalOpen}
          programs={programs.filter((p) => p.status === 'Active')}
          employees={employees}
          onClose={() => setIsSessionModalOpen(false)}
          onSave={handleSaveSession}
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
          onFinalize={handleSaveAssessment}
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
