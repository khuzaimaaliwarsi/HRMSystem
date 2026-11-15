import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'

export function MyExpenseClaimsTab({ claims = [], onNewClaim, canSubmit = true }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedClaim, setSelectedClaim] = useState(null)

  const filtered = claims.filter((c) => {
    if (statusFilter === 'all') return true
    return c.approvalStatus.toLowerCase() === statusFilter.toLowerCase()
  })

  // Default Latest First (descending) sorting
  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.expenseDate || a.submittedDate || a.createdAt || ''
    const dateB = b.expenseDate || b.submittedDate || b.createdAt || ''
    return dateB.localeCompare(dateA)
  })

  return (
    <div className="space-y-4 text-left">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="expense-claims-status-filter" className="text-xs font-semibold text-slate-500">
            Status:
          </label>
          <select
            id="expense-claims-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="returned">Returned</option>
          </select>
        </div>

        {canSubmit && (
          <button
            type="button"
            onClick={onNewClaim}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5" />
            <span>Submit Claim</span>
          </button>
        )}
      </div>

      {/* Claims Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-4 py-3">Claim ID</th>
                <th className="px-4 py-3">Expense Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount (PKR)</th>
                <th className="px-4 py-3">Receipt Ref</th>
                <th className="px-4 py-3 text-center">Approval Status</th>
                <th className="px-4 py-3 text-center">Payment Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No expense claims found matching this filter.
                  </td>
                </tr>
              ) : (
                sorted.map((claim) => (
                  <tr key={claim.claimId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-700">
                      {claim.claimId}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {claim.expenseDate}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {claim.category}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      PKR {claim.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                      {claim.receiptReference ? (
                        <span className="flex items-center gap-1 text-blue-600 hover:underline cursor-pointer">
                          📎 {claim.receiptReference}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={cn(
                          "inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border",
                          claim.approvalStatus === 'Approved' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                          claim.approvalStatus === 'Submitted' && "bg-blue-50 text-blue-700 border-blue-200",
                          claim.approvalStatus === 'Rejected' && "bg-rose-50 text-rose-700 border-rose-200",
                          claim.approvalStatus === 'Returned' && "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        {claim.approvalStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={cn(
                          "inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border",
                          claim.paymentStatus === 'Paid' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                          claim.paymentStatus === 'Partially Paid' && "bg-amber-50 text-amber-700 border-amber-200",
                          claim.paymentStatus === 'Payment Pending' && "bg-indigo-50 text-indigo-700 border-indigo-200",
                          claim.paymentStatus === 'Unapproved' && "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {claim.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedClaim(claim)}
                        className="px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Claim Detail Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">Claim Details: {selectedClaim.claimId}</h3>
                <p className="text-xs text-slate-500">Submitted on {selectedClaim.submissionDate}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClaim(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">CATEGORY</span>
                  <span className="font-bold text-slate-900">{selectedClaim.category}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">AMOUNT</span>
                  <span className="font-bold text-blue-700 font-mono text-sm">
                    PKR {selectedClaim.amount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">APPROVAL STATUS</span>
                  <span className="font-semibold text-slate-800">{selectedClaim.approvalStatus}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">PAYMENT STATUS</span>
                  <span className="font-semibold text-slate-800">{selectedClaim.paymentStatus}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">BUSINESS DESCRIPTION</span>
                <p className="text-slate-700 mt-1 p-2 rounded bg-slate-50 border border-slate-100">
                  {selectedClaim.description}
                </p>
              </div>

              {selectedClaim.finalApproverName && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">APPROVAL REMARKS</span>
                  <p className="text-slate-700 mt-1 p-2 rounded bg-emerald-50/50 border border-emerald-100">
                    <strong>{selectedClaim.finalApproverName}:</strong> {selectedClaim.finalApprovalRemarks}
                  </p>
                </div>
              )}

              {selectedClaim.reimbursements?.length > 0 && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    REIMBURSEMENT PAYMENTS DISBURSED
                  </span>
                  <div className="space-y-1.5">
                    {selectedClaim.reimbursements.map((r, idx) => (
                      <div key={idx} className="p-2 rounded border border-slate-200 bg-slate-50 text-[11px] flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-900">PKR {r.amount.toLocaleString()}</span> via {r.paymentMethod}
                          <span className="block text-[10px] text-slate-400 font-mono">Ref: {r.transactionReference}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{r.paymentDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedClaim(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyExpenseClaimsTab
