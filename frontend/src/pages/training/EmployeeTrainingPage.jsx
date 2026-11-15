import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import trainingService from '@/services/trainingService'

import TrainingSummaryCards from '@/components/training/TrainingSummaryCards'
import TrainingCatalogTable from '@/components/training/TrainingCatalogTable'
import TrainingPlanModal from '@/components/training/TrainingPlanModal'
import TrainingSessionsTable from '@/components/training/TrainingSessionsTable'
import CertificatesTable from '@/components/training/CertificatesTable'
import CertificatePreviewModal from '@/components/training/CertificatePreviewModal'

export default function EmployeeTrainingPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'my-courses')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Scoped Data States
  const [kpis, setKpis] = useState({})
  const [programs, setPrograms] = useState([])
  const [sessions, setSessions] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [certificates, setCertificates] = useState([])

  // Modal States
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [actionNotice, setActionNotice] = useState(null)
  const [progressUpdateEnrollment, setProgressUpdateEnrollment] = useState(null)
  const [progressInput, setProgressInput] = useState(0)
  const [progressError, setProgressError] = useState('')
  const [savingProgress, setSavingProgress] = useState(false)

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

  const handleSelfRequestTraining = async (planData) => {
    try {
      const empId = user?.employeeId || user?.id
      await trainingService.createPlanAsync({
        ...planData,
        employeeId: empId,
        targetEmployeeId: empId,
        planType: 'Individual',
      })
      triggerNotice('Your training request was submitted to your manager & HR for review.')
      setIsPlanModalOpen(false)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to submit training request', 'error')
      throw err
    }
  }

  const handleUpdateProgressSubmit = async (e) => {
    e.preventDefault()
    if (!progressUpdateEnrollment || savingProgress) return
    setProgressError('')
    setSavingProgress(true)
    try {
      await trainingService.updateProgressAsync(
        progressUpdateEnrollment.enrollmentId || progressUpdateEnrollment.id,
        Number(progressInput)
      )
      triggerNotice(`Learning progress updated to ${progressInput}%.`)
      setProgressUpdateEnrollment(null)
      loadData()
    } catch (err) {
      const msg = err?.message || 'Failed to update progress'
      setProgressError(msg)
      triggerNotice(msg, 'error')
    } finally {
      setSavingProgress(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'my-sessions'
              ? 'My Cohort Sessions & Calendar'
              : activeTab === 'my-certificates'
              ? 'My Verified Certificates'
              : activeTab === 'browse-catalog'
              ? 'Browse Learning Catalog'
              : 'My Enrolled Courses'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === 'my-sessions'
              ? 'View upcoming cohort dates, classroom schedules, and session attendance status.'
              : activeTab === 'my-certificates'
              ? 'Download your verified course certificates and professional skill badges.'
              : activeTab === 'browse-catalog'
              ? 'Discover new professional courses and submit training enrollment requests.'
              : 'Track active coursework, update completion progress, and review modules.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlanModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <i className="fa-solid fa-paper-plane"></i>
            Request Training
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

      {/* Personal KPI Summary */}
      <TrainingSummaryCards kpis={kpis} />

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        {activeTab === 'my-courses' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">My Active & Completed Courses</h2>
                <p className="text-xs text-slate-500">Track your progress and click Update Progress to log completed modules</p>
              </div>
            </div>

            {(enrollments || []).length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <i className="fa-solid fa-graduation-cap text-3xl text-slate-400 mb-2"></i>
                <p className="font-medium text-slate-700">No active course enrollments yet</p>
                <p className="text-xs mt-1">Browse the course catalog and submit a training request to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {enrollments.map((enr) => (
                  <div key={enr.enrollmentId} className="p-4 border border-slate-200 rounded-lg hover:border-indigo-200 transition bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{enr.trainingTitle}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          enr.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : enr.status === 'In Progress'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {enr.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span><i className="fa-regular fa-clock mr-1"></i>Due: {enr.dueDate}</span>
                        <span><i className="fa-solid fa-chalkboard-user mr-1"></i>Trainer: {enr.trainerName}</span>
                        {enr.assessmentScore !== null && (
                          <span className="font-medium text-slate-700"><i className="fa-solid fa-star text-amber-500 mr-1"></i>Score: {enr.assessmentScore}%</span>
                        )}
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            enr.status === 'Completed' ? 'bg-emerald-500' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${enr.completionPercentage || 0}%` }}
                        ></div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        {enr.completionPercentage || 0}% completed
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {enr.status !== 'Completed' && enr.status !== 'Cancelled' && (
                        <button
                          onClick={() => {
                            setProgressError('')
                            setProgressUpdateEnrollment(enr)
                            setProgressInput(enr.completionPercentage || 0)
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
                        >
                          <i className="fa-solid fa-pen-to-square mr-1"></i>
                          Log Progress
                        </button>
                      )}
                      {enr.certificateNumber && (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-mono border border-emerald-200">
                          <i className="fa-solid fa-check mr-1"></i>
                          Cert #{enr.certificateNumber}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'my-sessions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">My Scheduled Sessions & Cohorts</h2>
                <p className="text-xs text-slate-500">Upcoming classroom and virtual workshop timings where you are enrolled</p>
              </div>
            </div>
            <TrainingSessionsTable
              sessions={sessions}
              canManage={false}
            />
          </div>
        )}

        {activeTab === 'my-certificates' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">My Earned Certificates</h2>
                <p className="text-xs text-slate-500">View and print your authenticated corporate training credentials</p>
              </div>
            </div>
            <CertificatesTable
              certificates={certificates}
              onPreviewCertificate={(cert) => setSelectedCertificate(cert)}
            />
          </div>
        )}

        {activeTab === 'browse-catalog' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Corporate Training Catalog</h2>
                <p className="text-xs text-slate-500">Browse available courses and request training directly to your manager</p>
              </div>
            </div>
            <TrainingCatalogTable
              programs={programs}
              canManage={false}
            />
          </div>
        )}
      </div>

      {/* Progress Self-Update Modal */}
      {progressUpdateEnrollment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Update Learning Progress</h3>
              <button
                onClick={() => setProgressUpdateEnrollment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleUpdateProgressSubmit} className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700">{progressUpdateEnrollment.trainingTitle}</p>
                <p className="text-xs text-slate-500 mt-0.5">Trainer: {progressUpdateEnrollment.trainerName}</p>
              </div>

              {progressError && (
                <div className="p-2.5 text-xs bg-rose-50 text-rose-800 rounded-lg border border-rose-200 flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
                  <span>{progressError}</span>
                </div>
              )}

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Progress Percentage</span>
                  <span className="font-semibold text-indigo-600">{progressInput}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressInput}
                  onChange={(e) => setProgressInput(e.target.value)}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * Note: Reaching 100% and certification requires official assessment by an authorized HR/Trainer reviewer.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setProgressError('')
                    setProgressUpdateEnrollment(null)
                  }}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProgress}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm transition disabled:opacity-50"
                >
                  {savingProgress ? 'Saving...' : 'Save Progress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Request Modal */}
      {isPlanModalOpen && (
        <TrainingPlanModal
          isOpen={isPlanModalOpen}
          programs={programs}
          employees={[{ id: user?.employeeId || user?.id, name: user?.name || 'Self', fullName: user?.name || 'Self', department: user?.department || 'General', designation: user?.designation || 'Employee' }]}
          currentUser={user}
          onClose={() => setIsPlanModalOpen(false)}
          onSave={handleSelfRequestTraining}
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
