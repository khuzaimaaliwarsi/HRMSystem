import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { leaveService } from '@/services/leaveService'
import { leaveBalanceService } from '@/services/leaveBalanceService'
import { employeeService } from '@/services/employeeService'
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
import LeaveAdjustmentModal from '@/components/leaves/LeaveAdjustmentModal'

export function HrAdminLeavePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  const currentUser = useMemo(() => ({
    name: user?.name || 'Ayesha Khan',
    role: 'hr_admin',
    employeeId: user?.employeeId || user?.id || 'EMP-002'
  }), [user?.name, user?.employeeId, user?.id])

  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'operations') // operations, queue, balances, calendar, history

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    } else {
      setActiveTab('operations')
    }
  }, [searchParams])

  const handleTabChange = (newTab) => {
    setActiveTab(newTab)
    setSearchParams({ tab: newTab })
  }
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Reactive data
  const [requests, setRequests] = useState(() => leaveService.getLeaveRequests({}, currentUser))
  const [ledger, setLedger] = useState(() => leaveBalanceService.getLedger())
  const [calendarEvents, setCalendarEvents] = useState(() => leaveService.getCalendarEvents(currentUser))
  const [employees, setEmployees] = useState(() => employeeService.getEmployees())

  const loadData = useCallback(() => {
    setRequests(leaveService.getLeaveRequests({}, currentUser))
    setLedger(leaveBalanceService.getLedger())
    setCalendarEvents(leaveService.getCalendarEvents(currentUser))
    setEmployees(employeeService.getEmployees())
  }, [currentUser])

  useEffect(() => {
    const unsubLeave = leaveService.subscribe(loadData)
    const unsubBalance = leaveBalanceService.subscribe(loadData)
    const unsubEmp = employeeService.subscribe(loadData)
    return () => {
      unsubLeave()
      unsubBalance()
      unsubEmp()
    }
  }, [loadData])

  const [today] = useState(() => new Date().toISOString().split('T')[0])

  // KPIs
  const hrStats = useMemo(() => {
    const overallPending = requests.filter(
      (r) => r.status?.toLowerCase().includes('pending') || r.backendStatus === 'PENDING'
    ).length
    const hrActionable = requests.filter(
      (r) => (r.status === 'Pending HR Review' || r.routingTier === 'HR_ADMIN' || r.currentApproverTier === 'HR Admin')
    ).length
    const approvedCount = requests.filter((r) => r.status === 'Approved' || r.backendStatus === 'APPROVED').length
    const onLeaveToday = requests.filter((r) => {
      if (r.status !== 'Approved' && r.backendStatus !== 'APPROVED') return false
      return r.startDate <= today && r.endDate >= today
    }).length

    return {
      pendingReview: overallPending,
      hrActionable,
      approvedLeaves: approvedCount,
      onLeaveToday,
      totalEmployees: (employees || []).length
    }
  }, [requests, employees, today])

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
      setFeedback({ type: 'info', message: `Request ${requestId} returned to applicant for clarification.` })
      setIsDetailModalOpen(false)
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
    }
  }

  const handleApplyAdjustment = (adjustmentPayload) => {
    try {
      leaveBalanceService.adjustLeaveBalance(adjustmentPayload)
      setFeedback({
        type: 'success',
        message: `Ledger adjusted: ${adjustmentPayload.days > 0 ? '+' : ''}${adjustmentPayload.days} days recorded for employee ${adjustmentPayload.employeeId}.`
      })
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
        message: `Your leave request ${created.requestCode || created.id} was submitted successfully to Super Admin for approval (Anti-Self-Approval enforced).`
      })
      setTimeout(() => setFeedback(null), 5000)
      return created
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
      throw err
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'queue'
              ? 'Leave Approval Queue'
              : activeTab === 'balances'
              ? 'Balance Entitlements & Ledgers'
              : activeTab === 'calendar'
              ? 'Department Leave Calendar'
              : activeTab === 'history'
              ? 'Central Leave Register'
              : 'Leave Analytics & Operations'}
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'queue'
              ? 'Operational leave queue, manager escalations, and review authorizations.'
              : activeTab === 'balances'
              ? 'Departmental staff leave entitlements, usage rates, and balance adjustments.'
              : activeTab === 'calendar'
              ? 'Departmental absence calendar, team leaves schedule, and coverage mapping.'
              : activeTab === 'history'
              ? 'Audit log of employee leave records, statuses, and historical approvals.'
              : 'Operational leave analytics, daily on-leave staff, and attendance reconciliation.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            icon="fa-sliders"
            onClick={() => setIsAdjustmentModalOpen(true)}
            className="text-xs font-semibold"
          >
            Adjust Balance
          </Button>
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

      {/* Submodule View (One Submodule = One Functional Screen) */}
      {(activeTab === 'operations' || activeTab === 'overview') && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <LeaveSummaryCards
            stats={{
              annualBalance: hrStats.totalEmployees,
              casualBalance: hrStats.onLeaveToday,
              sickBalance: hrStats.approvedLeaves,
              pendingRequests: hrStats.pendingReview
            }}
            isStaffView={false}
          />
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                  <AppIcon name="fa-bell" className="text-blue-600" />
                  Requests Requiring HR Review
                </h3>
                <p className="text-xs text-slate-500">
                  Manager escalations (3rd+ annual request) or requests submitted by department managers.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('queue')}
                className="text-xs font-bold text-navy-700"
              >
                View Full Queue
              </Button>
            </div>

            <LeaveApprovalQueue
              requests={requests}
              currentUser={currentUser}
              onApprove={handleApprove}
              onReject={handleReject}
              onReturn={handleReturn}
              onViewDetails={handleViewDetails}
            />
          </div>
        </div>
      )}

      {/* Queue View */}
      {activeTab === 'queue' && (
        <LeaveApprovalQueue
          requests={requests}
          currentUser={currentUser}
          onApprove={handleApprove}
          onReject={handleReject}
          onReturn={handleReturn}
          onViewDetails={handleViewDetails}
        />
      )}

      {/* Balances View */}
      {activeTab === 'balances' && (
        <LeaveBalanceTable
          ledger={ledger}
          showAllEmployees={true}
          canAdjust={true}
          onOpenAdjustModal={() => setIsAdjustmentModalOpen(true)}
        />
      )}

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <LeaveCalendarView
          calendarEvents={calendarEvents}
          currentUser={currentUser}
          onSelectRequest={handleViewDetails}
        />
      )}

      {/* History View */}
      {activeTab === 'history' && (
        <LeaveHistoryTable
          requests={requests}
          onViewDetails={handleViewDetails}
          currentUser={currentUser}
        />
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

      {isAdjustmentModalOpen && (
        <LeaveAdjustmentModal
          isOpen={isAdjustmentModalOpen}
          onClose={() => setIsAdjustmentModalOpen(false)}
          employees={employees}
          currentUser={currentUser}
          onApplyAdjustment={handleApplyAdjustment}
        />
      )}
    </div>
  )
}

export default HrAdminLeavePage
