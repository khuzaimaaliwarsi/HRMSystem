import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { expenseService } from '@/services/expenseService'
import AppIcon from '@/components/common/AppIcon'
import MyExpenseClaimsTab from '@/components/expenses/MyExpenseClaimsTab'
import ExpenseCategoriesPolicyTab from '@/components/expenses/ExpenseCategoriesPolicyTab'
import ExpenseClaimModal from '@/components/expenses/ExpenseClaimModal'

export function EmployeeExpensesPage({ user }) {
  const { user: authUser } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const effectiveUser = user || authUser
  const currentUser = useMemo(() => effectiveUser ? {
    ...effectiveUser,
    id: effectiveUser.employeeId || effectiveUser.id || 'EMP-004',
    employeeId: effectiveUser.employeeId || effectiveUser.id || 'EMP-004',
    name: effectiveUser.name || 'Zeeshan Ali',
    role: effectiveUser.role || 'employee',
    department: effectiveUser.department || 'Development'
  } : {
    id: 'EMP-004',
    employeeId: 'EMP-004',
    name: 'Zeeshan Ali',
    role: 'employee',
    department: 'Development'
  }, [effectiveUser])

  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'my_claims')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [claims, setClaims] = useState([])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const loadData = useCallback(() => {
    const allClaims = expenseService.getExpenseClaims({}, currentUser)
    setClaims(allClaims)
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

  const isPolicies = activeTab === 'policies'
  const title = isPolicies ? 'Expense Reimbursement Policy' : 'My Submitted Claims'
  const desc = isPolicies
    ? 'Official company limits, eligible expense types, receipt rules, and reimbursement turnaround times.'
    : 'View and track all your submitted expense reimbursement claims, status, and disbursement details.'

  return (
    <div className="space-y-5 text-left">
      {/* Submodule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name={isPolicies ? 'fileText' : 'receipt'} className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {title}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {desc}
          </p>
        </div>
      </div>

      {activeTab === 'my_claims' && (
        <MyExpenseClaimsTab
          claims={claims}
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

export default EmployeeExpensesPage
