import React, { useState, useEffect } from 'react'
import { expenseService } from '@/services/expenseService'
import { cn } from '@/lib/utils'

export function TravelExpenseReconciliationTab({ currentUser }) {
  const [, setTick] = useState(0)
  const [showIneligible, setShowIneligible] = useState(false)

  useEffect(() => {
    const unsub = expenseService.subscribe(() => setTick((t) => t + 1))
    return () => unsub()
  }, [])

  const reconciliations = expenseService.getTravelExpenseReconciliations(
    { includeIneligible: showIneligible },
    currentUser
  )
  const excludedCounts = expenseService.getTravelReconciliationExcludedCounts(currentUser)

  const getStatusBadgeClasses = (item) => {
    if (!item.isEligibleForReconciliation) {
      if (item.rawStatus === 'REJECTED' || item.rawStatus === 'CANCELLED') {
        return 'bg-rose-50 text-rose-700 border-rose-200'
      }
      return 'bg-slate-100 text-slate-500 border-slate-200'
    }
    if (item.isSettled) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
    if (item.netSettlementBalance > 0) {
      return 'bg-teal-50 text-teal-700 border-teal-200'
    }
    if (item.netSettlementBalance < 0) {
      return 'bg-rose-50 text-rose-700 border-rose-200'
    }
    if (item.reconciliationStatus === 'Claims Under Verification' || item.reconciliationStatus === 'Advance Disbursed (Awaiting Claims)') {
      return 'bg-amber-50 text-amber-700 border-amber-200'
    }
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  return (
    <div className="space-y-6 text-left">
      {/* Information Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">F10 Travel Management &amp; Advance Reconciliation Bridge</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Reconciles authoritative F10 travel advances against verified F12 actual expense claims to determine net settlement
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
            F10 Authoritative Travel ↔ F12 Authoritative Claims
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block">Rule 1: Distinct Financial Concepts</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Travel advances are liability balances; only approved expense claims are recognized as actual expenditures.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block">Rule 2: Anti-Double Counting</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Disbursed advances are deducted from actual incurred expenses before releasing any surplus reimbursement.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block">Rule 3: Payroll Isolation</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Expense reimbursements are disbursed via dedicated bank advice, completely isolated from regular salary runs.
            </span>
          </div>
        </div>
      </div>

      {/* Reconciliations Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Official Trips &amp; Advance Settlement Status</h3>
            {excludedCounts.total > 0 && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                {!showIneligible
                  ? `${excludedCounts.total} non-approved travel request(s) excluded from financial settlement (${[
                      excludedCounts.draft ? `${excludedCounts.draft} Draft` : null,
                      excludedCounts.rejected ? `${excludedCounts.rejected} Rejected` : null,
                      excludedCounts.pendingApproval ? `${excludedCounts.pendingApproval} Pending Approval` : null,
                      excludedCounts.cancelled ? `${excludedCounts.cancelled} Cancelled` : null
                    ]
                      .filter(Boolean)
                      .join(', ')}).`
                  : 'Showing all travel requests including Draft, Rejected, and Pending Approval records (marked Not Eligible).'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {excludedCounts.total > 0 && (
              <button
                type="button"
                onClick={() => setShowIneligible((v) => !v)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer',
                  showIneligible
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                )}
              >
                {showIneligible ? 'Hide Unapproved Requests' : `Show Excluded Requests (${excludedCounts.total})`}
              </button>
            )}
            <span className="text-xs font-mono text-slate-500 font-bold">
              {reconciliations.length} {showIneligible ? 'Total Trips' : 'Authorized Trips Tracked'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-4 py-3">Trip ID</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3 text-right">Disbursed Advance</th>
                <th className="px-4 py-3 text-right">Submitted Claims</th>
                <th className="px-4 py-3 text-right">Approved Claims</th>
                <th className="px-4 py-3 text-right">Net Settlement Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reconciliations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No authorized travel requests found for reconciliation.
                  </td>
                </tr>
              ) : (
                reconciliations.map((item) => (
                  <tr
                    key={item.tripId}
                    className={cn(
                      'hover:bg-slate-50/60 transition-colors',
                      !item.isEligibleForReconciliation && 'bg-slate-50/40 opacity-75'
                    )}
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-700">
                      <div>{item.tripId}</div>
                      {item.expenseCode && (
                        <div className="text-[10px] font-normal text-slate-500">{item.expenseCode}</div>
                      )}
                      {item.linkedClaimNumbers?.length > 0 && (
                        <div className="text-[10px] font-normal text-indigo-600">
                          {item.linkedClaimNumbers.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      <div>{item.employeeName}</div>
                      {item.reconciliationSource && item.isEligibleForReconciliation && (
                        <span className="text-[10px] text-slate-400 font-normal">{item.reconciliationSource}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      <div>{item.destination}</div>
                      <span className="block text-[10px] text-slate-400">{item.travelDates}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                      PKR {Number(item.disbursedAdvance || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                      PKR {Number(item.totalSubmittedClaims || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-blue-700">
                      PKR {Number(item.totalApprovedClaims || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-extrabold">
                      {!item.isEligibleForReconciliation ? (
                        <span className="text-slate-400 font-medium">— (Not Eligible)</span>
                      ) : item.netSettlementBalance > 0 ? (
                        <span className="text-emerald-700">
                          +PKR {item.netSettlementBalance.toLocaleString()} (Payable)
                        </span>
                      ) : item.netSettlementBalance < 0 ? (
                        <span className="text-rose-700">
                          -PKR {Math.abs(item.netSettlementBalance).toLocaleString()} (Return Due)
                        </span>
                      ) : item.isSettled ? (
                        <span className="text-emerald-700">PKR 0 (Settled)</span>
                      ) : (
                        <span className="text-slate-400 font-medium">— (Not Reconciled)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={cn(
                          'inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border',
                          getStatusBadgeClasses(item)
                        )}
                      >
                        {item.reconciliationStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default TravelExpenseReconciliationTab
