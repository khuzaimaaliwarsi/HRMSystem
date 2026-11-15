import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { leaveService } from '@/services/leaveService'
import { leaveBalanceService } from '@/services/leaveBalanceService'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import Alert from '@/components/common/Alert'
import { cn } from '@/lib/utils'
import LeaveSummaryCards from '@/components/leaves/LeaveSummaryCards'
import LeaveBalanceTable from '@/components/leaves/LeaveBalanceTable'
import LeaveCalendarView from '@/components/leaves/LeaveCalendarView'
import LeaveHistoryTable from '@/components/leaves/LeaveHistoryTable'
import LeaveDetailModal from '@/components/leaves/LeaveDetailModal'
import LeaveRequestModal from '@/components/leaves/LeaveRequestModal'
import LeavePolicyOverview from '@/components/leaves/LeavePolicyOverview'

export function EmployeeLeavePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  const currentUser = useMemo(() => ({
    name: user?.name || 'Zeeshan Ali',
    role: 'employee',
    employeeId: user?.employeeId || user?.id || 'EMP-004'
  }), [user?.name, user?.employeeId, user?.id])

  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'overview') // overview, history, balances, calendar, policy

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
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Reactive data
  const [requests, setRequests] = useState(() => leaveService.getLeaveRequests({}, currentUser))
  const [ledger, setLedger] = useState(() => leaveBalanceService.getLedger(currentUser.employeeId))
  const [calendarEvents, setCalendarEvents] = useState(() => leaveService.getCalendarEvents(currentUser))
  const [balances, setBalances] = useState(() => leaveBalanceService.getEmployeeBalanceSummary(currentUser.employeeId))

  const loadData = useCallback(() => {
    leaveBalanceService.reconcileApprovedLeaves?.(currentUser.employeeId)
    setRequests(leaveService.getLeaveRequests({}, currentUser) || [])
    setLedger(leaveBalanceService.getLedger(currentUser.employeeId) || [])
    setCalendarEvents(leaveService.getCalendarEvents(currentUser) || [])
    setBalances(leaveBalanceService.getEmployeeBalanceSummary(currentUser.employeeId) || {})
  }, [currentUser])

  useEffect(() => {
    const unsubLeave = leaveService.subscribe(loadData)
    const unsubBalance = leaveBalanceService.subscribe(loadData)
    return () => {
      unsubLeave()
      unsubBalance()
    }
  }, [loadData])

  // Overview stats
  const pendingCount = useMemo(() => {
    return (requests || []).filter((r) => r?.status && r.status.toLowerCase().includes('pending'))?.length || 0
  }, [requests])

  const [today] = useState(() => new Date().toISOString().split('T')[0])

  const upcomingLeaves = useMemo(() => {
    return (requests || []).filter((r) => r?.status === 'Approved' && r?.startDate >= today)
  }, [requests, today])

  const handleViewDetails = (req) => {
    setSelectedRequest(req)
    setIsDetailModalOpen(true)
  }

  const handleSubmitLeave = async (submissionPayload) => {
    try {
      const created = await leaveService.applyLeaveAsync(submissionPayload, currentUser)
      setFeedback({
        type: 'success',
        message: `Your leave application (${created.requestCode || created.id}) was submitted successfully. Pending reservation placed.`
      })
      setTimeout(() => setFeedback(null), 5000)
      return created
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
      throw err
    }
  }

  const handleWithdraw = (requestId) => {
    try {
      leaveService.withdrawLeaveRequest(requestId, 'Withdrawn by employee', currentUser)
      setFeedback({ type: 'info', message: `Leave request ${requestId} has been withdrawn and pending reservation released.` })
      setIsDetailModalOpen(false)
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message })
    }
  }

  const handleCancelApproved = (requestId) => {
    try {
      leaveService.cancelApprovedLeave(requestId, 'Employee requested cancellation before leave commencement', currentUser)
      setFeedback({ type: 'success', message: `Leave ${requestId} cancelled. Ledger credited and attendance restored.` })
      setIsDetailModalOpen(false)
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
            {activeTab === 'history'
              ? 'My Leave Requests & History'
              : activeTab === 'balances'
              ? 'My Entitlement Balance Ledger'
              : activeTab === 'calendar'
              ? 'Company Holidays & Leave Calendar'
              : activeTab === 'policy'
              ? 'Leave Policy Rules'
              : 'Apply & Leave Dashboard'}
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'history'
              ? 'View all submitted leave applications, journey approval stages, and manager comments.'
              : activeTab === 'balances'
              ? 'Real-time breakdown of annual, casual, and sick leave balances and usage.'
              : activeTab === 'calendar'
              ? 'Official corporate calendar, national holidays, and planned leaves schedule.'
              : activeTab === 'policy'
              ? 'Official company-wide leave entitlements, approval authority matrix, and escalation standards.'
              : 'Apply for leave, check real-time entitlement balances, and monitor pending approvals.'}
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
            Apply for Leave
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      {/* Tab 1: Overview */}
      {(activeTab === 'overview' || !activeTab) && (
        <div className="space-y-6">
          {/* Summary Cards strictly displayed on Overview */}
          {(() => {
            const al = (ledger || []).find((l) => l.leaveTypeId === 'LT-ANNUAL' || l.leaveTypeCode === 'AL') || ledger?.[0]
            const cl = (ledger || []).find((l) => l.leaveTypeId === 'LT-CASUAL' || l.leaveTypeCode === 'CL') || ledger?.[1] || ledger?.[0]
            const sl = (ledger || []).find((l) => l.leaveTypeId === 'LT-SICK' || l.leaveTypeCode === 'SL') || ledger?.[2] || ledger?.[0]

            const statsData = {
              annualBalance: al?.availableBalance !== undefined ? al.availableBalance : (balances?.annualRemaining ?? 14),
              casualBalance: cl?.availableBalance !== undefined ? cl.availableBalance : (balances?.casualRemaining ?? 10),
              sickBalance: sl?.availableBalance !== undefined ? sl.availableBalance : (balances?.sickRemaining ?? 8),
              pendingRequests: pendingCount ?? 0
            }

            return (
              <LeaveSummaryCards
                stats={statsData}
                isStaffView={true}
              />
            )
          })()}
          {(upcomingLeaves || []).length > 0 && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase">
                <AppIcon name="fa-circle-check" className="text-emerald-600" />
                Upcoming Approved Time Off
              </div>
              <div className="divide-y divide-emerald-100 text-xs">
                {upcomingLeaves.map((ul) => (
                  <div key={ul.id} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-900">{ul.leaveTypeName}</span>{' '}
                      <span className="text-emerald-700">({ul.startDate} to {ul.endDate})</span>
                      <span className="ml-2 font-mono text-[11px] text-emerald-800 font-semibold">{ul.calculatedDays}d</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(ul)}
                      className="text-xs text-emerald-800 hover:bg-emerald-100"
                    >
                      Details
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 w-full">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                <AppIcon name="fa-clock-rotate-left" className="text-navy-700" />
                Recent Leave Applications
              </h3>
              <button
                onClick={() => handleTabChange('history')}
                className="text-xs font-bold text-navy-700 hover:underline"
              >
                View All ({(requests || []).length})
              </button>
            </div>

            <LeaveHistoryTable
              requests={(requests || []).slice(0, 5)}
              onViewDetails={handleViewDetails}
              onWithdraw={handleWithdraw}
              canWithdraw={true}
              currentUser={currentUser}
              isOverview={true}
            />
          </div>
        </div>
      )}

      {/* Tab 2: History */}
      {activeTab === 'history' && (
        <LeaveHistoryTable
          requests={requests || []}
          onViewDetails={handleViewDetails}
          onWithdraw={handleWithdraw}
          canWithdraw={true}
          currentUser={currentUser}
        />
      )}

      {/* Tab 3: Balances */}
      {activeTab === 'balances' && (
        <LeaveBalanceTable
          ledger={ledger || []}
          showAllEmployees={false}
          canAdjust={false}
        />
      )}

      {/* Tab 4: Calendar */}
      {activeTab === 'calendar' && (
        <LeaveCalendarView
          calendarEvents={calendarEvents || []}
          currentUser={currentUser}
          onSelectRequest={handleViewDetails}
          initialYear={2026}
          initialMonth={11}
        />
      )}

      {/* Tab 5: Policy */}
      {activeTab === 'policy' && <LeavePolicyOverview currentUser={currentUser} />}

      {/* Modals */}
      {isDetailModalOpen && (
        <LeaveDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          request={selectedRequest}
          currentUser={currentUser}
          onWithdraw={handleWithdraw}
          onCancelApproved={handleCancelApproved}
        />
      )}

      {isRequestModalOpen && (
        <LeaveRequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          onSubmit={handleSubmitLeave}
          currentUser={currentUser}
        />
      )}
    </div>
  )
}

export default EmployeeLeavePage
