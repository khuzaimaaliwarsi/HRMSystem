import React from 'react'
import AppIcon from '@/components/common/AppIcon'

export function ExpenseOverviewTab({ metrics, onNewClaim, canSubmit = true }) {
  const {
    totalClaimsCount = 0,
    pendingApprovalCount = 0,
    totalApprovedAmount = 0,
    pendingReimbursementAmount = 0,
    totalReimbursedAmount = 0,
    categoryTotals = {}
  } = metrics || {}

  const categories = Object.entries(categoryTotals)
  const maxCategorySpend = Math.max(...categories.map(([, val]) => val), 1)

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 bg-blue-800/60 px-2 py-0.5 rounded">
            F12 Financial Engine
          </span>
          <h2 className="text-xl font-bold mt-1 text-white">Expense & Reimbursement Center</h2>
          <p className="text-xs text-blue-200 mt-0.5">
            Decoupled multi-tier approval authority, independent reimbursement register, and audited financial disbursement
          </p>
        </div>

        {canSubmit && (
          <button
            type="button"
            onClick={onNewClaim}
            className="px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            <AppIcon name="plus" className="w-4 h-4" />
            <span>New Expense Claim</span>
          </button>
        )}
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Claims */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            TOTAL CLAIMS
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{totalClaimsCount}</span>
            <span className="text-[11px] font-medium text-slate-500">All submissions</span>
          </div>
        </div>

        {/* Card 2: Pending Approval */}
        <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-sm bg-amber-50/20">
          <span className="text-[10px] uppercase font-bold text-amber-800 block tracking-wider">
            PENDING APPROVAL
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-600">{pendingApprovalCount}</span>
            <span className="text-[11px] font-medium text-amber-700">Awaiting review</span>
          </div>
        </div>

        {/* Card 3: Total Approved */}
        <div className="bg-white rounded-xl border border-blue-200/80 p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-blue-800 block tracking-wider">
            TOTAL APPROVED
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-blue-700 font-mono">
              PKR {totalApprovedAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 4: Pending Reimbursement */}
        <div className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-sm bg-rose-50/20">
          <span className="text-[10px] uppercase font-bold text-rose-800 block tracking-wider">
            PENDING PAYABLE
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-rose-600 font-mono">
              PKR {pendingReimbursementAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 5: Disbursed to Date */}
        <div className="bg-white rounded-xl border border-emerald-200/80 p-4 shadow-sm bg-emerald-50/20">
          <span className="text-[10px] uppercase font-bold text-emerald-800 block tracking-wider">
            DISBURSED TO DATE
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-emerald-700 font-mono">
              PKR {totalReimbursedAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Category Spend Distribution */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Expenditure Breakdown by Category</h4>
            <p className="text-xs text-slate-500 mt-0.5">Commercial spending distribution across corporate policies</p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            {categories.length} Active Categories
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {categories.map(([catName, spend], idx) => {
            const pct = Math.round((spend / maxCategorySpend) * 100)
            return (
              <div key={idx} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-800">{catName}</span>
                  <span className="text-blue-700 font-mono font-bold">
                    PKR {spend.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full rounded-full bg-blue-600 transition-all duration-700"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ExpenseOverviewTab
