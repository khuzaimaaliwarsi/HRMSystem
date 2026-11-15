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
import LeavePolicyOverview from '@/components/leaves/LeavePolicyOverview'
import LeaveDetailModal from '@/components/leaves/LeaveDetailModal'
import LeaveAdjustmentModal from '@/components/leaves/LeaveAdjustmentModal'

export function SuperAdminLeavePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  const currentUser = useMemo(() => ({
    name: user?.name || 'Tariq Mehmood',
    role: 'super_admin',
    employeeId: user?.employeeId || user?.id || 'EMP-001'
  }), [user?.name, user?.employeeId, user?.id])

  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'overview') // overview, queue, balances, calendar, history, policy

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    } else {
      setActiveTab('overview')
    }
  }, [searchParams])

  const handleTabChange = (newTab) => {
    setActiveTab(newTab)
    setSearchParams({ tab: newTab })
  }
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Reactive data states
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

  // Overview KPIs
  const overviewStats = useMemo(() => {
    const pendingCount = requests.filter((r) => r.status && r.status.toLowerCase().includes('pending')).length
    const approvedCount = requests.filter((r) => r.status === 'Approved').length
    const onLeaveToday = requests.filter((r) => {
      if (r.status !== 'Approved') return false
      return r.startDate <= today && r.endDate >= today
    }).length

    return {
      pendingRequests: pendingCount,
      approvedLeaves: approvedCount,
      onLeaveToday,
      totalEmployees: (employees || []).length
    }
  }, [requests, employees, today])

  // Handler: Open Details Modal
  const handleViewDetails = (req) => {
    setSelectedRequest(req)
    setIsDetailModalOpen(true)
  }

  // Handler: Approve Request
  const handleApprove = (requestId, comments) => {
    try {
      leaveService.approveLeaveRequest(requestId, comments, currentUser)
      setFeedback({ type: 'success', message: `Request ${requestId} approved successfully under Super Admin authority. Attendance synchronized.` })
      setIsDetailModalOpen(false)
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
    }
  }

  // Handler: Reject Request
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

  // Handler: Return for Info
  const handleReturn = (requestId, note) => {
    try {
      leaveService.returnLeaveRequest(requestId, note, currentUser)
      setFeedback({ type: 'info', message: `Request ${requestId} returned to applicant for additional information.` })
      setIsDetailModalOpen(false)
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
    }
  }

  // Handler: Balance Adjustment
  const handleApplyAdjustment = (adjustmentPayload) => {
    try {
      leaveBalanceService.adjustLeaveBalance(adjustmentPayload)
      setFeedback({
        type: 'success',
        message: `Ledger adjusted successfully: ${adjustmentPayload.days > 0 ? '+' : ''}${adjustmentPayload.days} days recorded for employee ${adjustmentPayload.employeeId}.`
      })
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'queue'
              ? 'Leave Approval Queue'
              : activeTab === 'balances'
              ? 'Balance Entitlements & Registers'
              : activeTab === 'calendar'
              ? 'Department Leave Calendar'
              : activeTab === 'history'
              ? 'Central Leave History Register'
              : activeTab === 'policy'
              ? 'Leave Policy & Entitlements'
              : 'Leave Analytics & Overview'}
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'queue'
              ? 'Pending multi-tier leave approval requests awaiting executive or administrative authorization.'
              : activeTab === 'balances'
              ? 'Organization-wide leave entitlements, accrued quotas, consumed days, and ledger adjustments.'
              : activeTab === 'calendar'
              ? 'Cross-department leave schedule calendar, scheduled absences, and overlap visualization.'
              : activeTab === 'history'
              ? 'Comprehensive historical audit register of all processed leave requests and determinations.'
              : activeTab === 'policy'
              ? 'Configured statutory and enterprise leave rules, carryover limits, and notice requirements.'
              : 'Centralized policy authority, executive approvals, organization balance registers, and attendance integration.'}
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
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      {/* 1. Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <LeaveSummaryCards
            stats={{
              annualBalance: overviewStats.totalEmployees,
              casualBalance: overviewStats.onLeaveToday,
              sickBalance: overviewStats.approvedLeaves,
              pendingRequests: overviewStats.pendingRequests
            }}
            isStaffView={false}
          />
          {/* High Priority Action Items / Pending Queue (Full Width) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                <AppIcon name="fa-bolt" className="text-amber-500" />
                High Priority Action Items
              </h3>
              <button
                onClick={() => setActiveTab('queue')}
                className="text-xs font-bold text-navy-700 hover:underline"
              >
                View All ({overviewStats.pendingRequests})
              </button>
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

      {/* 2. Queue Tab */}
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

      {/* 3. Balances Tab */}
      {activeTab === 'balances' && (
        <LeaveBalanceTable
          ledger={ledger}
          showAllEmployees={true}
          canAdjust={true}
          onOpenAdjustModal={() => setIsAdjustmentModalOpen(true)}
        />
      )}

      {/* 4. Calendar Tab */}
      {activeTab === 'calendar' && (
        <LeaveCalendarView
          calendarEvents={calendarEvents}
          currentUser={currentUser}
          onSelectRequest={handleViewDetails}
        />
      )}

      {/* 5. History Tab */}
      {activeTab === 'history' && (
        <LeaveHistoryTable
          requests={requests}
          onViewDetails={handleViewDetails}
          currentUser={currentUser}
        />
      )}

      {/* 6. Policy Tab */}
      {activeTab === 'policy' && <LeavePolicyOverview currentUser={currentUser} />}

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

export default SuperAdminLeavePage
