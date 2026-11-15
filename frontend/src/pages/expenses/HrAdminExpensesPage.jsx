import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { expenseService } from '@/services/expenseService'
import AppIcon from '@/components/common/AppIcon'
import ExpenseOverviewTab from '@/components/expenses/ExpenseOverviewTab'
import MyExpenseClaimsTab from '@/components/expenses/MyExpenseClaimsTab'
import ExpenseApprovalQueueTab from '@/components/expenses/ExpenseApprovalQueueTab'
import ReimbursementPaymentTab from '@/components/expenses/ReimbursementPaymentTab'
import ExpenseCategoriesPolicyTab from '@/components/expenses/ExpenseCategoriesPolicyTab'
import TravelExpenseReconciliationTab from '@/components/expenses/TravelExpenseReconciliationTab'
import ExpenseClaimModal from '@/components/expenses/ExpenseClaimModal'

export function HrAdminExpensesPage({ user }) {
  const { user: authUser } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const effectiveUser = user || authUser
  const currentUser = useMemo(() => effectiveUser || {
    id: 'EMP-002',
    name: 'Ayesha Khan',
    role: 'hr_admin',
    department: 'Human Resources'
  }, [effectiveUser])

  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'overview')
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

  const getSubmoduleHeader = () => {
    switch (activeTab) {
      case 'claims':
        return {
          title: 'Department Claims Register',
          desc: 'Comprehensive register of all organizational expense claims, receipts, and disbursement statuses.',
          icon: 'receipt'
        }
      case 'queue':
        return {
          title: 'Expense Approval Queue',
          desc: 'HR review and approval queue for claims submitted by departments across the company.',
          icon: 'check'
        }
      case 'reimbursements':
        return {
          title: 'Reimbursements & Payment Tracking',
          desc: 'Payment processing, bank disbursement batches, and settled employee reimbursement logs.',
          icon: 'currency'
        }
      case 'categories':
        return {
          title: 'Expense Policies & Categories',
          desc: 'Corporate spending policy limits, authorized claim categories, and receipt requirements.',
          icon: 'settings'
        }
      case 'travel_reconciliation':
        return {
          title: 'Travel Expense Reconciliation',
          desc: 'Reconcile advance travel per diems, flight bookings, hotel stays, and actual journey expenditures.',
          icon: 'calendar'
        }
      case 'overview':
      default:
        return {
          title: 'Expense Overview',
          desc: 'Operational summary of company expenditures, pending claims, and reimbursement status.',
          icon: 'dashboard'
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

      {activeTab === 'overview' && (
        <ExpenseOverviewTab
          metrics={metrics}
          onNewClaim={() => setIsModalOpen(true)}
          canSubmit={true}
        />
      )}

      {activeTab === 'queue' && (
        <ExpenseApprovalQueueTab
          claims={claims}
          currentUser={currentUser}
          onActionComplete={loadData}
        />
      )}

      {activeTab === 'reimbursements' && (
        <ReimbursementPaymentTab
          claims={claims}
          currentUser={currentUser}
          onPaymentRecorded={loadData}
        />
      )}

      {activeTab === 'claims' && (
        <MyExpenseClaimsTab
          claims={claims}
          onNewClaim={() => setIsModalOpen(true)}
          canSubmit={true}
        />
      )}

      {activeTab === 'categories' && (
        <ExpenseCategoriesPolicyTab />
      )}

      {activeTab === 'travel_reconciliation' && (
        <TravelExpenseReconciliationTab
          currentUser={currentUser}
        />
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

export default HrAdminExpensesPage
