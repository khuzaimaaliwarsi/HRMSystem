import React, { useState } from 'react'
import { expenseService } from '@/services/expenseService'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'

export function ReimbursementPaymentTab({ claims = [], currentUser, onPaymentRecorded }) {
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer')
  const [transactionRef, setTransactionRef] = useState('')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Reversal dialog state
  const [reversalClaim, setReversalClaim] = useState(null)
  const [reversalReimbId, setReversalReimbId] = useState('')
  const [reversalReason, setReversalReason] = useState('')

  // Claims eligible for reimbursement (Approved status and remainingPayable > 0)
  const payableClaims = claims.filter(
    (c) => c.approvalStatus === 'Approved' && (c.remainingPayable || 0) > 0
  )

  const paidClaims = claims.filter(
    (c) => c.reimbursements && c.reimbursements.length > 0
  )

  const handleOpenPayment = (claim) => {
    setSelectedClaim(claim)
    setPayAmount(String(claim.remainingPayable))
    setPaymentMethod('Bank Transfer')
    setTransactionRef(`FT-EXP-${Date.now().toString().slice(-6)}`)
    setNotes(`Reimbursement payment for ${claim.claimId}`)
    setErrorMessage(null)
  }

  const handleConfirmPayment = async (e) => {
    e.preventDefault()
    if (isProcessing) return
    setErrorMessage(null)
    setIsProcessing(true)

    try {
      await expenseService.recordReimbursementPaymentAsync(
        selectedClaim.claimId || selectedClaim.id,
        {
          amount: Number(payAmount),
          paymentMethod,
          transactionReference: transactionRef,
          bankAccountReference: selectedClaim.requestedReimbursementAccount,
          notes
        },
        currentUser
      )

      setIsProcessing(false)
      setSelectedClaim(null)
      onPaymentRecorded?.()
    } catch (err) {
      setIsProcessing(false)
      setErrorMessage(err.message || 'Payment recording failed.')
    }
  }

  const handleConfirmReversal = async (e) => {
    e.preventDefault()
    if (isProcessing) return
    setErrorMessage(null)
    setIsProcessing(true)

    try {
      await expenseService.reverseReimbursementPaymentAsync(
        reversalClaim.claimId || reversalClaim.id,
        reversalReimbId,
        reversalReason,
        currentUser
      )

      setIsProcessing(false)
      setReversalClaim(null)
      setReversalReimbId('')
      setReversalReason('')
      onPaymentRecorded?.()
    } catch (err) {
      setIsProcessing(false)
      setErrorMessage(err.message || 'Payment reversal failed.')
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Payables Awaiting Disbursement Section */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Approved Expense Claims Awaiting Reimbursement</h3>
            <p className="text-xs text-slate-500 mt-0.5">Authorized claims with pending financial disbursement balance</p>
          </div>
          <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
            {payableClaims.length} Claims Payable
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-4 py-3">Claim ID</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Total Claim</th>
                <th className="px-4 py-3 text-right">Paid to Date</th>
                <th className="px-4 py-3 text-right">Remaining Payable</th>
                <th className="px-4 py-3">Reimbursement Account</th>
                <th className="px-4 py-3 text-right">Disburse Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payableClaims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No approved expense claims currently awaiting payment.
                  </td>
                </tr>
              ) : (
                payableClaims.map((claim) => (
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
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      PKR {claim.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-emerald-600 font-semibold">
                      PKR {(claim.paidAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-extrabold text-rose-600">
                      PKR {(claim.remainingPayable || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px] max-w-xs truncate">
                      {claim.requestedReimbursementAccount}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenPayment(claim)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disbursed Reimbursements History Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Disbursed Reimbursement Payment Register</h3>
            <p className="text-xs text-slate-500 mt-0.5">Audited records of completed bank advice disbursements and reversals</p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            {paidClaims.reduce((cnt, c) => cnt + (c.reimbursements?.length || 0), 0)} Payment Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-4 py-3">Claim ID</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3 text-right">Amount Paid</th>
                <th className="px-4 py-3">Method &amp; Ref</th>
                <th className="px-4 py-3">Disbursed By</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paidClaims.map((claim) =>
                claim.reimbursements?.map((r) => (
                  <tr key={r.reimbursementId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-700">
                      {claim.claimId}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {claim.employeeName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {r.paymentDate}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      PKR {r.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                      <span>{r.paymentMethod}</span>
                      <span className="block text-[10px] text-slate-400">Ref: {r.transactionReference}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {r.paidBy}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {r.isReversed ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Reversed
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Confirmed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {!r.isReversed && (
                        <button
                          type="button"
                          onClick={() => {
                            setReversalClaim(claim)
                            setReversalReimbId(r.reimbursementId)
                            setReversalReason('')
                            setErrorMessage(null)
                          }}
                          className="px-2.5 py-1 rounded text-xs font-semibold border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Reimbursement Payment</h3>
                <p className="text-xs text-slate-500">{selectedClaim.claimId} — {selectedClaim.employeeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClaim(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-6 overflow-y-auto space-y-4 text-xs">
              {errorMessage && (
                <Alert variant="danger" title="Payment Error">
                  {errorMessage}
                </Alert>
              )}

              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-blue-700 font-bold uppercase block">REMAINING PAYABLE</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    PKR {selectedClaim.remainingPayable.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">BENEFICIARY ACCOUNT</span>
                  <span className="font-mono text-slate-700 text-[11px] block">{selectedClaim.requestedReimbursementAccount}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Disbursement Amount (PKR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  min="1"
                  max={selectedClaim.remainingPayable}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  You can record partial payment or full settlement up to PKR {selectedClaim.remainingPayable.toLocaleString()}.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Bank Transfer">Bank Transfer (Direct Advice)</option>
                    <option value="Company Cheque">Company Cheque</option>
                    <option value="Petty Cash Voucher">Petty Cash Voucher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Transaction Reference <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    required
                    placeholder="e.g. FT-MEZN-99102"
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Remarks
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Verified by finance desk; advice submitted to bank"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

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
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <AppIcon name="check" className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Disbursing...' : 'Confirm Disbursement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reversal Modal */}
      {reversalClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">Reverse Reimbursement Payment</h3>
            <p className="text-xs text-slate-500 mt-1">
              This action reverses the payment, restores the payable balance on {reversalClaim.claimId}, and permanently audits the transaction reversal.
            </p>

            <form onSubmit={handleConfirmReversal} className="mt-4 space-y-4 text-xs">
              {errorMessage && (
                <Alert variant="danger" title="Reversal Error">
                  {errorMessage}
                </Alert>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Audit Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Reason for reversal (e.g., returned advice, bank account mismatch, duplicate voucher)..."
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReversalClaim(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? 'Reversing...' : 'Execute Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReimbursementPaymentTab
