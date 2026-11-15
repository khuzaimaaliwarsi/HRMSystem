import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import travelService from '@/services/travelService'
import AppIcon from '@/components/common/AppIcon'

import TravelRequestsTable from '@/components/travel/TravelRequestsTable'
import TravelRequestModal from '@/components/travel/TravelRequestModal'
import TravelPlansTable from '@/components/travel/TravelPlansTable'
import PickAndDropRosterTable from '@/components/travel/PickAndDropRosterTable'
import PickAndDropRequestModal from '@/components/travel/PickAndDropRequestModal'

export default function ManagerTravelPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'team-requests')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Data States
  const [requests, setRequests] = useState([])
  const [plans, setPlans] = useState([])
  const [assignments, setAssignments] = useState([])

  // Modal States
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [requestModalEditMode, setRequestModalEditMode] = useState(false)
  const [isPickDropModalOpen, setIsPickDropModalOpen] = useState(false)
  const [assignmentToEdit, setAssignmentToEdit] = useState(null)
  const [actionNotice, setActionNotice] = useState(null)

  const loadData = () => {
    try {
      setRequests(travelService.getTravelRequests({}, user) || [])
    } catch {
      setRequests([])
    }
    try {
      setPlans(travelService.getTravelPlans({}, user) || [])
    } catch {
      setPlans([])
    }
    try {
      setAssignments(travelService.getTransportAssignments({}, user) || [])
    } catch {
      setAssignments([])
    }
  }

  useEffect(() => {
    loadData()
    travelService.loadTravelDataAsync().catch((err) => {
      console.error('Failed to hydrate manager travel view from database:', err)
    })
    const unsubscribe = travelService.subscribe(() => {
      loadData()
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  const triggerNotice = (msg, type = 'success') => {
    setActionNotice({ msg, type })
    setTimeout(() => setActionNotice(null), 4000)
  }

  const handleCreatePersonalRequest = async (reqData) => {
    try {
      const isEdit = Boolean(reqData.existingRequestId)
      const saved = isEdit
        ? await travelService.updateTravelRequestAsync(reqData.existingRequestId, reqData)
        : await travelService.createTravelRequestAsync(reqData, user)
      triggerNotice(
        saved.status === 'Draft'
          ? `Travel draft #${saved.requestId} saved.`
          : `Official travel request #${saved.requestId} submitted for HR review.`
      )
      setIsRequestModalOpen(false)
      setSelectedRequest(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleApproveTeamRequest = async (req) => {
    try {
      await travelService.approveTravelRequestAsync(req.requestId, user, 'Department Manager Approval')
      triggerNotice(`Travel request #${req.requestId} approved.`)
      setIsRequestModalOpen(false)
      setSelectedRequest(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleRejectTeamRequest = async (req, reason) => {
    try {
      await travelService.rejectTravelRequestAsync(req.requestId, user, reason)
      triggerNotice(`Travel request #${req.requestId} rejected.`, 'error')
      setIsRequestModalOpen(false)
      setSelectedRequest(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleCancelRequest = async (req) => {
    try {
      await travelService.cancelTravelRequestAsync(req.requestId, user)
      triggerNotice(`Travel request #${req.requestId} cancelled.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
    }
  }

  const handlePickDropSubmit = async (asnData) => {
    try {
      const created = await travelService.requestPickAndDropAsync(asnData, user)
      triggerNotice(`Transport request #${created.assignmentId} submitted for HR approval.`)
      setIsPickDropModalOpen(false)
      setAssignmentToEdit(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleUpdateAssignment = async (asnId, asnData) => {
    try {
      const updated = await travelService.updateTransportAssignmentAsync(asnId, asnData)
      triggerNotice(`Transport request #${updated.assignmentId} updated successfully.`)
      setIsPickDropModalOpen(false)
      setAssignmentToEdit(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  // Scoped views
  const myEmpId = user?.employeeId || user?.id
  const teamRequests = requests.filter((r) => r.employeeId !== myEmpId)
  const myRequests = requests.filter((r) => r.employeeId === myEmpId)
  const myAssignments = assignments.filter((a) => a.employeeId === myEmpId)

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <AppIcon name="plane" className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab === 'team-plans'
                ? 'Active Team Itineraries'
                : activeTab === 'my-requests'
                ? 'My Travel Requests'
                : activeTab === 'my-transport'
                ? 'My Pick-and-Drop Facility'
                : 'Team Travel Approvals'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'team-plans'
              ? 'Confirmed department itineraries, tickets, and travel schedules.'
              : activeTab === 'my-requests'
              ? 'Apply and monitor your personal domestic and international business trips.'
              : activeTab === 'my-transport'
              ? 'Your enrolled corporate shuttle route, pickup timings, and driver contact.'
              : `Review and authorize travel requests submitted by ${user?.department || 'Engineering'} direct reports.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedRequest(null)
              setIsRequestModalOpen(true)
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5" />
            Apply Personal Travel
          </button>
          <button
            onClick={() => setIsPickDropModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <AppIcon name="bus" className="w-3.5 h-3.5" />
            Apply Shuttle
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between ${
            actionNotice.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AppIcon
              name={actionNotice.type === 'error' ? 'alertCircle' : 'check'}
              className="w-4 h-4 shrink-0"
            />
            <span>{actionNotice.msg}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="opacity-60 hover:opacity-100">
            <AppIcon name="close" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      {(activeTab === 'team-requests' || !activeTab) && (
        <TravelRequestsTable
          requests={teamRequests}
          currentUser={user}
          onViewDetails={(req) => {
            setSelectedRequest(req)
            setRequestModalEditMode(false)
            setIsRequestModalOpen(true)
          }}
          onEditRequest={(req) => {
            setSelectedRequest(req)
            setRequestModalEditMode(true)
            setIsRequestModalOpen(true)
          }}
          onApprove={handleApproveTeamRequest}
          onReject={(req) => {
            setSelectedRequest(req)
            setRequestModalEditMode(false)
            setIsRequestModalOpen(true)
          }}
          onCancel={handleCancelRequest}
        />
      )}

      {activeTab === 'team-plans' && (
        <TravelPlansTable
          plans={plans}
          currentUser={user}
          onViewPlan={(plan) => {
            const req = requests.find((r) => r.requestId === plan.requestId)
            if (req) {
              setSelectedRequest(req)
              setRequestModalEditMode(false)
              setIsRequestModalOpen(true)
            }
          }}
        />
      )}

      {activeTab === 'my-requests' && (
        <TravelRequestsTable
          requests={myRequests}
          currentUser={user}
          onViewDetails={(req) => {
            setSelectedRequest(req)
            setRequestModalEditMode(false)
            setIsRequestModalOpen(true)
          }}
          onEditRequest={(req) => {
            setSelectedRequest(req)
            setRequestModalEditMode(true)
            setIsRequestModalOpen(true)
          }}
          onCancel={handleCancelRequest}
        />
      )}

      {activeTab === 'my-transport' && (
        <PickAndDropRosterTable
          assignments={myAssignments}
          currentUser={user}
          onEditAssignment={(asn) => {
            setAssignmentToEdit(asn)
            setIsPickDropModalOpen(true)
          }}
        />
      )}

      {/* Modals */}
      <TravelRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false)
          setSelectedRequest(null)
          setRequestModalEditMode(false)
        }}
        request={selectedRequest}
        initialEditMode={requestModalEditMode}
        currentUser={user}
        onSubmitRequest={handleCreatePersonalRequest}
        onApprove={handleApproveTeamRequest}
        onReject={handleRejectTeamRequest}
      />

      <PickAndDropRequestModal
        isOpen={isPickDropModalOpen}
        onClose={() => {
          setIsPickDropModalOpen(false)
          setAssignmentToEdit(null)
        }}
        currentUser={user}
        assignment={assignmentToEdit}
        onRequestSubmit={handlePickDropSubmit}
        onUpdateAssignment={handleUpdateAssignment}
      />
    </div>
  )
}
