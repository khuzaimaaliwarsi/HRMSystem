import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import trainingService from '@/services/trainingService'
import employeeService from '@/services/employeeService'

import TrainingSummaryCards from '@/components/training/TrainingSummaryCards'
import TrainingCatalogTable from '@/components/training/TrainingCatalogTable'
import TrainingPlansTable from '@/components/training/TrainingPlansTable'
import TrainingPlanModal from '@/components/training/TrainingPlanModal'
import TrainingSessionsTable from '@/components/training/TrainingSessionsTable'
import EnrollmentProgressTable from '@/components/training/EnrollmentProgressTable'
import CertificatesTable from '@/components/training/CertificatesTable'
import CertificatePreviewModal from '@/components/training/CertificatePreviewModal'

export default function ManagerTrainingPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'team-progress')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Master State scoped to team and self
  const [kpis, setKpis] = useState({})
  const [programs, setPrograms] = useState([])
  const [plans, setPlans] = useState([])
  const [sessions, setSessions] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [certificates, setCertificates] = useState([])
  const [teamEmployees, setTeamEmployees] = useState([])

  // Modal States
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [actionNotice, setActionNotice] = useState(null)

  const loadData = () => {
    try {
      setKpis(trainingService.getTrainingKPIs(user) || {})
    } catch (e) {
      console.error('Error loading training KPIs:', e)
      setKpis({})
    }
    try {
      setPrograms(trainingService.getPrograms({ status: 'Active' }) || [])
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
      // Get all employees, but filter for team recommendations: direct reports + self
      const allEmps = employeeService.getAllEmployees() || []
      const currentEmpId = user?.employeeId || user?.id
      // Team members where managerId matches or same department
      const team = allEmps.filter(
        (emp) => emp.reportingManagerId === currentEmpId || emp.managerId === currentEmpId || emp.id === currentEmpId || emp.employeeId === currentEmpId
      )
      setTeamEmployees(team.length > 0 ? team : allEmps)
    } catch (e) {
      console.error('Error loading team employees:', e)
      setTeamEmployees([])
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
          setActionNotice({ msg: err.message || 'Failed to load training data.', type: 'error' })
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

  const handleSavePlan = async (planData) => {
    try {
      await trainingService.createPlanAsync(planData)
      triggerNotice('Training recommendation submitted successfully to HR for approval.')
      setIsPlanModalOpen(false)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to submit recommendation', 'error')
      throw err
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'team-plans'
              ? 'Team Training Recommendations'
              : activeTab === 'catalog'
              ? 'Available Courses Catalog'
              : activeTab === 'sessions'
              ? 'Upcoming Cohorts & Schedules'
              : activeTab === 'certificates'
              ? 'Team Verified Certificates'
              : 'Team Learning Progress'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === 'team-plans'
              ? 'Recommend skill-gap training programs and monitor approvals for direct reports.'
              : activeTab === 'catalog'
              ? 'Explore authorized professional development and technical training courses.'
              : activeTab === 'sessions'
              ? 'Upcoming cohort calendar, timings, and attendance confirmation for your team.'
              : activeTab === 'certificates'
              ? 'View verified certifications and accredited credentials earned by direct reports.'
              : 'Track active enrollment progress, completion percentages, and assessment scores.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlanModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <i className="fa-solid fa-lightbulb"></i>
            Recommend Training
          </button>
        </div>
      </div>

      {/* Action Notification */}
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

      {/* Operational KPI Cards */}
      <TrainingSummaryCards kpis={kpis} />

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        {activeTab === 'team-progress' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Team Learning Progress & Completion</h2>
                <p className="text-xs text-slate-500">Track real-time progress and assessment outcomes for your team members</p>
              </div>
            </div>
            <EnrollmentProgressTable
              enrollments={enrollments}
              canReview={false}
            />
          </div>
        )}

        {activeTab === 'team-plans' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Training Recommendations & Approvals</h2>
                <p className="text-xs text-slate-500">Submitted skill development plans awaiting HR review or approved for enrollment</p>
              </div>
            </div>
            <TrainingPlansTable
              plans={plans}
              canApprove={false}
            />
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Available Corporate Training Catalog</h2>
                <p className="text-xs text-slate-500">Browse current internal and external training programs to recommend for team members</p>
              </div>
            </div>
            <TrainingCatalogTable
              programs={programs}
              canManage={false}
            />
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Scheduled Training Cohorts</h2>
                <p className="text-xs text-slate-500">View upcoming scheduled sessions and participant rosters for your department</p>
              </div>
            </div>
            <TrainingSessionsTable
              sessions={sessions}
              canManage={false}
            />
          </div>
        )}

        {activeTab === 'certificates' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Team Certificates & Badges</h2>
                <p className="text-xs text-slate-500">Credentials achieved by team members upon successful course completion</p>
              </div>
            </div>
            <CertificatesTable
              certificates={certificates}
              onPreviewCertificate={(cert) => setSelectedCertificate(cert)}
            />
          </div>
        )}
      </div>

      {/* Plan Recommendation Modal */}
      {isPlanModalOpen && (
        <TrainingPlanModal
          isOpen={isPlanModalOpen}
          programs={programs}
          employees={teamEmployees}
          currentUser={user}
          onClose={() => setIsPlanModalOpen(false)}
          onSave={handleSavePlan}
        />
      )}

      {/* Certificate Viewer Modal */}
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
