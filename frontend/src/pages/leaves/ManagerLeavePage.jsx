import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { employeeService } from '@/services/employeeService'
import { leaveService } from '@/services/leaveService'
import { leaveBalanceService } from '@/services/leaveBalanceService'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import Alert from '@/components/common/Alert'
import { cn } from '@/lib/utils'
import LeaveSummaryCards from '@/components/leaves/LeaveSummaryCards'
import LeaveApprovalQueue from '@/components/leaves/LeaveApprovalQueue'
import LeaveBalanceTable from '@/components/leaves/LeaveBalanceTable'
import LeaveCalendarView from '@/components/leaves/LeaveCalendarView'
import LeaveHistoryTable from '@/components/leaves/LeaveHistoryTable'
import LeaveDetailModal from '@/components/leaves/LeaveDetailModal'
import LeaveRequestModal from '@/components/leaves/LeaveRequestModal'

export function ManagerLeavePage({ isTeamLead = false }) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const effectiveRole = user?.role === 'team_lead' || isTeamLead ? 'team_lead' : 'manager'
  const effectiveId = user?.employeeId || user?.id || (effectiveRole === 'team_lead' ? 'EMP-005' : 'EMP-003')

  const currentUser = useMemo(() => ({
    name: user?.name || (effectiveRole === 'team_lead' ? 'Hina Farooq' : 'Bilal Siddiqui'),
    role: effectiveRole,
    employeeId: effectiveId
  }), [user?.name, effectiveRole, effectiveId])

  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'team_queue') // team_queue, team_balances, team_calendar, my_leaves

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    } else {
      setActiveTab('team_queue')
    }
  }, [searchParams])

  const handleTabChange = (newTab) => {
    setActiveTab(newTab)
    setSearchParams({ tab: newTab })
  }
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Reactive data
  const [requests, setRequests] = useState(() => leaveService.getLeaveRequests({}, currentUser))
  const [ledger, setLedger] = useState(() => leaveBalanceService.getLedger())
  const [calendarEvents, setCalendarEvents] = useState(() => leaveService.getCalendarEvents(currentUser))
  const [myBalances, setMyBalances] = useState(() => leaveBalanceService.getEmployeeBalanceSummary(currentUser.employeeId))

  const loadData = useCallback(() => {
    setRequests(leaveService.getLeaveRequests({}, currentUser))
    setLedger(leaveBalanceService.getLedger())
    setCalendarEvents(leaveService.getCalendarEvents(currentUser))
    setMyBalances(leaveBalanceService.getEmployeeBalanceSummary(currentUser.employeeId))
  }, [currentUser])

  useEffect(() => {
    const unsubLeave = leaveService.subscribe(loadData)
    const unsubBalance = leaveBalanceService.subscribe(loadData)
    return () => {
      unsubLeave()
      unsubBalance()
    }
  }, [loadData])

  const authorizedTeamEmployees = useMemo(() => {
    return employeeService.getAuthorizedTeamEmployees(currentUser.employeeId, currentUser.role) || []
  }, [currentUser.employeeId, currentUser.role])

  const authorizedIds = useMemo(() => {
    return new Set((authorizedTeamEmployees || []).map((e) => e.id))
  }, [authorizedTeamEmployees])

  // Split requests into team queue vs my personal leaves
  const teamRequests = useMemo(() => {
    return requests.filter((r) => r.employeeId !== currentUser.employeeId && authorizedIds.has(r.employeeId))
  }, [requests, currentUser.employeeId, authorizedIds])

  const myPersonalRequests = useMemo(() => {
    return requests.filter((r) => r.employeeId === currentUser.employeeId)
  }, [requests, currentUser.employeeId])

  const pendingTeamCount = useMemo(() => {
    return teamRequests.filter((r) =>
      ['Pending Manager Review', 'Pending Team Lead Review', 'Submitted', 'Returned for Information'].includes(r.status)
    ).length
  }, [teamRequests])

  const scopedLedger = useMemo(() => {
    return ledger.filter((item) => authorizedIds.has(item.employeeId))
  }, [ledger, authorizedIds])

  const handleViewDetails = (req) => {
    setSelectedRequest(req)
    setIsDetailModalOpen(true)
  }

  const handleApprove = (requestId, comments) => {
    try {
      leaveService.approveLeaveRequest(requestId, comments, currentUser)
      setFeedback({ type: 'success', message: `Request ${requestId} approved. Attendance synchronized.` })
      setIsDetailModalOpen(false)
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
    }
  }

  const handleReject = (requestId, reason) => {
    try {
      leaveService.rejectLeaveRequest(requestId, reason, currentUser)
      setFeedback({ type: 'success', message: `Request ${requestId} rejected. Balances released.` })
      setIsDetailModalOpen(false)
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
    }
  }

  const handleReturn = (requestId, note) => {
    try {
      leaveService.returnLeaveRequest(requestId, note, currentUser)
      setFeedback({ type: 'info', message: `Request ${requestId} returned to employee for clarification.` })
      setIsDetailModalOpen(false)
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
    }
  }

  const handleSubmitOwnLeave = async (submissionPayload) => {
    try {
      const created = await leaveService.applyLeaveAsync(submissionPayload, currentUser)
      setFeedback({
        type: 'success',
        message: `Your leave request ${created.requestCode || created.id} was submitted successfully to HR / Admin for review.`
      })
      setTimeout(() => setFeedback(null), 5000)
      return created
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
      throw err
    }
  }

  const handleWithdrawOwnLeave = (requestId) => {
    try {
      leaveService.withdrawLeaveRequest(requestId, 'Withdrawn by manager', currentUser)
      setFeedback({ type: 'info', message: `Leave request ${requestId} has been withdrawn.` })
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'my_leaves'
              ? 'My Personal Leave Applications & History'
              : (activeTab === 'calendar' || activeTab === 'team_calendar')
              ? 'Team Availability & Leave Calendar'
              : activeTab === 'team_balances'
              ? 'Direct Reports Balances'
              : 'Team Leave Requests & Approvals'}
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'my_leaves'
              ? 'Submit personal leave requests and track review status.'
              : (activeTab === 'calendar' || activeTab === 'team_calendar')
              ? 'Visual monthly team absence calendar to manage operational coverage.'
              : activeTab === 'team_balances'
              ? 'Monitor available statutory and annual quotas for direct reports.'
              : 'Authorize team leave requests within designated approval threshold.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setIsRequestModalOpen(true)}
            className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            Apply for Own Leave
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      {/* Tab 1: Team Queue */}
      {(activeTab === 'team_queue' || !activeTab) && (
        <div className="space-y-6">
          {/* Team Queue Operational KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Team Requests Pending</div>
              <div className="text-2xl font-bold text-navy-900 mt-1">{pendingTeamCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Awaiting your authorization</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Direct Reports</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {(authorizedTeamEmployees || []).length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {effectiveRole === 'team_lead' ? 'In assigned QA team' : 'Under authorized department teams'}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Annual Routing</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">2 Requests</div>
              <div className="text-[11px] text-slate-500 mt-0.5">1st–2nd go to Team Lead; 3rd+ escalate</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">My Leave Balance</div>
              <div className="text-2xl font-bold text-navy-700 mt-1">
                {myBalances.annualRemaining + myBalances.casualRemaining + myBalances.sickRemaining}d
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Available across all types</div>
            </div>
          </div>
        <LeaveApprovalQueue
          requests={teamRequests}
          currentUser={currentUser}
          onApprove={handleApprove}
          onReject={handleReject}
          onReturn={handleReturn}
          onViewDetails={handleViewDetails}
        />
        </div>
      )}

      {/* Tab 2: Team Balances */}
      {activeTab === 'team_balances' && (
        <LeaveBalanceTable
          ledger={scopedLedger}
          showAllEmployees={false}
          canAdjust={false}
        />
      )}

      {/* Tab 3: Team Calendar */}
      {activeTab === 'team_calendar' && (
        <LeaveCalendarView
          calendarEvents={calendarEvents}
          currentUser={currentUser}
          onSelectRequest={handleViewDetails}
        />
      )}

      {/* Tab 4: My Personal Leaves */}
      {activeTab === 'my_leaves' && (
        <div className="space-y-6">
          <LeaveSummaryCards
            stats={{
              annualBalance: myBalances.annualRemaining,
              casualBalance: myBalances.casualRemaining,
              sickBalance: myBalances.sickRemaining,
              pendingRequests: myPersonalRequests.filter((r) => r.status && r.status.startsWith('Pending')).length
            }}
            isStaffView={true}
          />

          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-navy-900">My Leave Applications</h3>
              <p className="text-xs text-slate-500">
                Personal requests are reviewed by HR / Admin or Super Admin under strict anti-self-approval policy.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon="fa-plus"
              onClick={() => setIsRequestModalOpen(true)}
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              Submit New Request
            </Button>
          </div>

          <LeaveHistoryTable
            requests={myPersonalRequests}
            onViewDetails={handleViewDetails}
            onWithdraw={handleWithdrawOwnLeave}
            canWithdraw={true}
            currentUser={currentUser}
          />
        </div>
      )}

      {/* Modals */}
      {isDetailModalOpen && (
        <LeaveDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          request={selectedRequest}
          currentUser={currentUser}
          onApprove={handleApprove}
          onReject={handleReject}
          onReturn={handleReturn}
        />
      )}

      {isRequestModalOpen && (
        <LeaveRequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          onSubmit={handleSubmitOwnLeave}
          currentUser={currentUser}
        />
      )}
    </div>
  )
}

export default ManagerLeavePage
