import React, { useState } from 'react'
import { expenseService } from '@/services/expenseService'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'
import { cn } from '@/lib/utils'

export function ExpenseApprovalQueueTab({ claims = [], currentUser, onActionComplete }) {
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [decision, setDecision] = useState('Approved')
  const [remarks, setRemarks] = useState('')
  const [errorMessage, setErrorMessage] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const limits = expenseService.getFinancialAuthorityLimits()
  const actorRole = (currentUser?.role || 'employee').toLowerCase()
  const actorId = currentUser?.id || currentUser?.employeeId

  // Only claims in Submitted or Under Review status need approval, sorted Latest First (descending)
  const queueClaims = claims
    .filter((c) => ['Submitted', 'Under Review'].includes(c.approvalStatus))
    .sort((a, b) => {
      const dateA = a.expenseDate || a.submittedDate || a.createdAt || ''
      const dateB = b.expenseDate || b.submittedDate || b.createdAt || ''
      return dateB.localeCompare(dateA)
    })

  const handleOpenReview = (claim) => {
    setSelectedClaim(claim)
    setDecision('Approved')
    setRemarks('')
    setErrorMessage(null)
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (isProcessing) return
    setErrorMessage(null)
    setIsProcessing(true)

    try {
      await expenseService.reviewExpenseClaimAsync(
        selectedClaim.claimId || selectedClaim.id,
        decision,
        remarks,
        currentUser
      )

      setIsProcessing(false)
      setSelectedClaim(null)
      onActionComplete?.()
    } catch (err) {
      setIsProcessing(false)
      setErrorMessage(err.message || 'Approval review failed.')
    }
  }

  return (
    <div className="space-y-4 text-left">
      {/* Header Info Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Expense Approval Queue</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Role: <span className="font-semibold uppercase text-blue-700">{actorRole}</span> | Financial Authority Limit:{' '}
            <span className="font-mono font-bold text-slate-800">
              PKR {actorRole === 'manager' ? limits.managerMaxLimit.toLocaleString() : actorRole === 'hr_admin' ? limits.hrAdminMaxLimit.toLocaleString() : 'Unlimited (Super Admin)'}
            </span>
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
          {queueClaims.length} Claims Awaiting Action
        </span>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-4 py-3">Claim ID</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Expense Date</th>
                <th className="px-4 py-3">Amount (PKR)</th>
                <th className="px-4 py-3">Authority Check</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queueClaims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className="text-2xl">✓</span>
                      <span>No pending expense claims in your approval queue.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                queueClaims.map((claim) => {
                  const isSelfClaim = expenseService.isClaimOwnedByUser(claim, currentUser) && actorRole !== 'super_admin'
                  let authorityExceeded = false

                  if ((actorRole === 'manager' || actorRole === 'team_lead') && limits.managerMaxLimit > 0 && claim.amount > limits.managerMaxLimit) {
                    authorityExceeded = true
                  } else if (actorRole === 'hr_admin' && limits.hrAdminMaxLimit > 0 && claim.amount > limits.hrAdminMaxLimit) {
                    authorityExceeded = true
                  }

                  return (
                    <tr key={claim.claimId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-blue-700">
                        {claim.claimId}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{claim.employeeName}</span>
                          <span className="text-[11px] text-slate-400">{claim.department}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-medium">
                        {claim.category}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {claim.expenseDate}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900 text-sm">
                        PKR {claim.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5">
                        {isSelfClaim ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Self-Claim (Locked)
                          </span>
                        ) : authorityExceeded ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Exceeds Limit (Escalate)
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Within Authority
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(claim)}
                          disabled={isSelfClaim}
                          className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer",
                            isSelfClaim
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                        >
                          Review &amp; Decide
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">Review Claim: {selectedClaim.claimId}</h3>
                <p className="text-xs text-slate-500">Submitted by {selectedClaim.employeeName} ({selectedClaim.department})</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClaim(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-6 overflow-y-auto space-y-4 text-xs">
              {errorMessage && (
                <Alert variant="danger" title="Review Error">
                  {errorMessage}
                </Alert>
              )}

              {/* Claim Summary Snapshot */}
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
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">DESCRIPTION</span>
                  <p className="text-slate-700 mt-0.5">{selectedClaim.description}</p>
                </div>
                {selectedClaim.receiptReference && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">RECEIPT REFERENCE</span>
                    <span className="font-mono text-blue-600 font-medium">📎 {selectedClaim.receiptReference}</span>
                  </div>
                )}
              </div>

              {/* Decision Radio Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Approval Decision <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'Approved', color: 'hover:border-emerald-300 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 text-emerald-800' },
                    { val: 'Returned', color: 'hover:border-amber-300 has-[:checked]:border-amber-600 has-[:checked]:bg-amber-50 text-amber-800' },
                    { val: 'Rejected', color: 'hover:border-rose-300 has-[:checked]:border-rose-600 has-[:checked]:bg-rose-50 text-rose-800' }
                  ].map((opt) => (
                    <label
                      key={opt.val}
                      className={cn("p-2.5 rounded-lg border border-slate-200 text-center font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5", opt.color)}
                    >
                      <input
                        type="radio"
                        name="decision"
                        value={opt.val}
                        checked={decision === opt.val}
                        onChange={(e) => setDecision(e.target.value)}
                        className="sr-only"
                      />
                      <span>{opt.val}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Review &amp; Authority Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required
                  rows={3}
                  placeholder="Mandatory review justification, budget verification note, or reason for rejection/return..."
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedClaim(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <AppIcon name="check" className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Recording...' : `Confirm ${decision}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpenseApprovalQueueTab
