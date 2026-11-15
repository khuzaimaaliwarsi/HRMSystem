import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { expenseService } from '@/services/expenseService'
import AppIcon from '@/components/common/AppIcon'
import MyExpenseClaimsTab from '@/components/expenses/MyExpenseClaimsTab'
import ExpenseApprovalQueueTab from '@/components/expenses/ExpenseApprovalQueueTab'
import ExpenseOverviewTab from '@/components/expenses/ExpenseOverviewTab'
import ExpenseCategoriesPolicyTab from '@/components/expenses/ExpenseCategoriesPolicyTab'
import ExpenseClaimModal from '@/components/expenses/ExpenseClaimModal'

export function ManagerExpensesPage({ user: propUser }) {
  const { user: authUser } = useAuth()
  const user = propUser || authUser
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const currentUser = useMemo(() => user || {
    id: 'EMP-003',
    name: 'Bilal Siddiqui',
    role: 'manager',
    department: 'Development'
  }, [user])

  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'team_queue')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [claims, setClaims] = useState([])
  const [metrics, setMetrics] = useState({})

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const loadData = useCallback(() => {
    const allClaims = expenseService.getExpenseClaims({}, currentUser)
    const summary = expenseService.getExpenseSummaryMetrics({}, currentUser)
    setClaims(allClaims)
    setMetrics(summary)
  }, [currentUser])

  useEffect(() => {
    loadData()
    expenseService.loadExpensesDataAsync().catch(() => {})
    const unsubscribe = expenseService.subscribe(() => {
      loadData()
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [loadData])

  // Manager's own claims
  const myClaims = claims.filter((c) => expenseService.isClaimOwnedByUser(c, currentUser))

  // Direct reports' claims awaiting review
  const teamPending = claims.filter(
    (c) => !expenseService.isClaimOwnedByUser(c, currentUser) && ['Submitted', 'Under Review'].includes(c.approvalStatus)
  )

  const getSubmoduleHeader = () => {
    switch (activeTab) {
      case 'my_claims':
        return {
          title: 'My Expense Claims',
          desc: 'Submit and track your personal expense reimbursement requests, travel claims, and receipts.',
          icon: 'receipt'
        }
      case 'overview':
        return {
          title: 'Expense Summary Overview',
          desc: `Spend analytics and budget tracking for Department ${currentUser?.department || 'Engineering'}.`,
          icon: 'dashboard'
        }
      case 'policies':
        return {
          title: 'Expense Policies Overview',
          desc: 'Per-diem policies, mileage rates, meal allowances, and receipt upload guidelines.',
          icon: 'fileText'
        }
      case 'team_queue':
      default:
        return {
          title: 'Team Claims Approvals',
          desc: 'Review and approve reimbursement requests submitted by your direct reporting team members.',
          icon: 'check'
        }
    }
  }

  const subHeader = getSubmoduleHeader()

  return (
    <div className="space-y-5 text-left">
      {/* Submodule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name={subHeader.icon} className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {subHeader.title}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {subHeader.desc}
          </p>
        </div>
      </div>

      {activeTab === 'team_queue' && (
        <ExpenseApprovalQueueTab
          claims={claims}
          currentUser={currentUser}
          onActionComplete={loadData}
        />
      )}

      {activeTab === 'my_claims' && (
        <MyExpenseClaimsTab
          claims={myClaims}
          onNewClaim={() => setIsModalOpen(true)}
          canSubmit={true}
        />
      )}

      {activeTab === 'overview' && (
        <ExpenseOverviewTab
          metrics={metrics}
          onNewClaim={() => setIsModalOpen(true)}
          canSubmit={true}
        />
      )}

      {activeTab === 'policies' && (
        <ExpenseCategoriesPolicyTab />
      )}

      <ExpenseClaimModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentUser={currentUser}
        onSuccess={loadData}
      />
    </div>
  )
}

export default ManagerExpensesPage
