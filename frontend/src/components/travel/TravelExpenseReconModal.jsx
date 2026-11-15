import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TravelExpenseReconModal({
  isOpen,
  onClose,
  expenseRecord = null,
  currentUser = null,
  onDisburseAdvance,
  onSubmitReceipts,
  onReconcile
}) {
  const [activeTab, setActiveTab] = useState('summary') // 'summary', 'disburse', 'claim', 'audit'
  const [errorMsg, setErrorMsg] = useState('')

  // Advance disbursement form state
  const [disbursedAmount, setDisbursedAmount] = useState('')
  const [voucherReference, setVoucherReference] = useState('')
  const [disburseNotes, setDisburseNotes] = useState('')

  // Claim submission form state
  const [submittedExpenses, setSubmittedExpenses] = useState('')
  const [receiptReferences, setReceiptReferences] = useState('')
  const [claimNotes, setClaimNotes] = useState('')

  // Final reconciliation state
  const [approvedExpenses, setApprovedExpenses] = useState('')
  const [auditNotes, setAuditNotes] = useState('')

  const isSettled = expenseRecord?.settlementStatus === 'Settled'
  const isAdvanceDisbursed = Boolean(
    expenseRecord &&
      (Number(expenseRecord.disbursedAdvance || 0) > 0 ||
        expenseRecord.advanceDisbursedReference ||
        expenseRecord.advanceDisbursedDate ||
        expenseRecord.settlementStatus === 'Advance Disbursed')
  )
  const isReconciled = Boolean(expenseRecord?.reconciledAt) || expenseRecord?.settlementStatus === 'Pending Final Settlement'

  useEffect(() => {
    if (expenseRecord) {
      const alreadyDisbursed =
        Number(expenseRecord.disbursedAdvance || 0) > 0 ||
        Boolean(expenseRecord.advanceDisbursedReference || expenseRecord.advanceDisbursedDate)
      setDisbursedAmount(
        alreadyDisbursed
          ? String(expenseRecord.disbursedAdvance || '')
          : expenseRecord.requestedAdvance || ''
      )
      setVoucherReference(
        alreadyDisbursed
          ? expenseRecord.advanceDisbursedReference || ''
          : `PCV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      )
      setDisburseNotes('')

      setSubmittedExpenses(expenseRecord.employeeSubmittedExpenses || expenseRecord.disbursedAdvance || '')
      setReceiptReferences(
        Array.isArray(expenseRecord.expenseReceiptReferences)
          ? expenseRecord.expenseReceiptReferences.join(', ')
          : ''
      )
      setClaimNotes('')

      setApprovedExpenses(
        expenseRecord.approvedExpenses ||
          expenseRecord.employeeSubmittedExpenses ||
          expenseRecord.disbursedAdvance ||
          ''
      )
      setAuditNotes(expenseRecord.notes || '')
    }
    setErrorMsg('')
    setActiveTab('summary')
  }, [expenseRecord, isOpen])

  if (!isOpen || !expenseRecord) return null

  const normalizedRole = String(currentUser?.role || '').toLowerCase()
  const isFinanceOrHR =
    normalizedRole === 'super_admin' || normalizedRole === 'hr_admin'

  const canDisburseAdvance = isFinanceOrHR && !isSettled && !isAdvanceDisbursed && !isReconciled
  const canSubmitClaims = !isSettled && !isReconciled
  const canReconcile = isFinanceOrHR && !isSettled

  const handleDisburseSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      if (!canDisburseAdvance) {
        throw new Error(
          isSettled
            ? `Financial lock: '${expenseRecord.expenseId}' is already Settled.`
            : `Advance already disbursed under voucher '${expenseRecord.advanceDisbursedReference || 'N/A'}'.`
        )
      }
      if (!disbursedAmount || Number(disbursedAmount) <= 0) {
        throw new Error('Disbursed advance amount must be greater than zero.')
      }
      if (!voucherReference.trim()) {
        throw new Error('Petty cash voucher reference is required.')
      }
      await onDisburseAdvance(expenseRecord.requestId, {
        disbursedAmount: Number(disbursedAmount),
        voucherReference: voucherReference.trim(),
        notes: disburseNotes.trim()
      })
      setActiveTab('summary')
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleClaimSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      if (!canSubmitClaims) {
        throw new Error(`Financial lock: Expense claims are locked because '${expenseRecord.expenseId}' is already reconciled/settled.`)
      }
      if (!submittedExpenses || Number(submittedExpenses) < 0) {
        throw new Error('Submitted expense amount must be a valid number.')
      }
      const refs = receiptReferences
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
      if (refs.length === 0) {
        throw new Error('At least one receipt or invoice reference is required.')
      }

      await onSubmitReceipts(expenseRecord.requestId, {
        submittedExpenses: Number(submittedExpenses),
        receiptReferences: refs,
        notes: claimNotes.trim()
      })
      setActiveTab('summary')
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleAuditSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      if (!canReconcile) {
        throw new Error(`Financial lock: '${expenseRecord.expenseId}' is already Settled.`)
      }
      if (approvedExpenses === '' || Number(approvedExpenses) < 0) {
        throw new Error('Approved expenses amount must be specified.')
      }

      await onReconcile(expenseRecord.requestId, {
        approvedExpenses: Number(approvedExpenses),
        notes: auditNotes.trim()
      })
      setActiveTab('summary')
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const balance = expenseRecord.settlementBalance ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-purple-50 text-purple-700 rounded-lg">
              <AppIcon name="money" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Travel Advance & Expense Reconciliation
              </h3>
              <p className="text-xs text-slate-500">
                Tracking #{expenseRecord.expenseId} for Travel Request #{expenseRecord.requestId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-6 bg-slate-50/30 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Financial Summary
          </button>
          {isFinanceOrHR && (
            <button
              type="button"
              onClick={() => setActiveTab('disburse')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1 ${
                activeTab === 'disburse'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Disburse Advance</span>
              {!canDisburseAdvance && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                  Locked
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('claim')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'claim'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Submit Expense Claims</span>
            {!canSubmitClaims && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                Locked
              </span>
            )}
          </button>
          {isFinanceOrHR && (
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1 ${
                activeTab === 'audit'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Audit & Reconcile</span>
              {!canReconcile && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium">
                  Settled
                </span>
              )}
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {isSettled && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-start gap-2.5">
              <AppIcon name="shieldCheck" className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Final Settlement Complete — Read-Only Financial Record</div>
                <div className="text-[11px] text-emerald-800 mt-0.5">
                  Reconciled by {expenseRecord.reconciledBy || 'Authorized Auditor'}
                  {expenseRecord.reconciledAt ? ` on ${expenseRecord.reconciledAt}` : ''}.
                  Advance disbursement, expense claims, and further reconciliation are permanently locked to prevent double posting.
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AppIcon name="alertCircle" className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Employee info banner */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{expenseRecord.employeeName}</div>
                  <div className="text-slate-500 font-mono">
                    ID: {expenseRecord.employeeId} • Dept: {expenseRecord.department}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      isSettled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {expenseRecord.settlementStatus || 'Pending'}
                  </span>
                </div>
              </div>

              {/* 4 Financial Metric Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">
                    Approved Budget
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    Rs. {(expenseRecord.approvedBudget || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Authorised Limit</div>
                </div>

                <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-left">
                  <div className="text-[10px] font-semibold text-purple-700 uppercase">
                    Advance Paid
                  </div>
                  <div className="text-base font-bold text-purple-900 mt-1">
                    Rs. {(expenseRecord.disbursedAdvance || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-purple-600 mt-0.5">
                    {expenseRecord.advanceDisbursedReference || 'None disbursed'}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-left">
                  <div className="text-[10px] font-semibold text-blue-700 uppercase">
                    Submitted Claims
                  </div>
                  <div className="text-base font-bold text-blue-900 mt-1">
                    Rs. {(expenseRecord.employeeSubmittedExpenses || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-blue-600 mt-0.5">
                    {expenseRecord.expenseReceiptReferences?.length || 0} receipt(s)
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-left">
                  <div className="text-[10px] font-semibold text-emerald-700 uppercase">
                    Approved Actual
                  </div>
                  <div className="text-base font-bold text-emerald-900 mt-1">
                    Rs. {(expenseRecord.approvedExpenses || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">Verified claim</div>
                </div>
              </div>

              {/* Settlement Balance Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                  balance > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : balance < 0
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div>
                  <div className="font-bold text-sm">
                    Settlement Balance: Rs. {Math.abs(balance).toLocaleString()}
                  </div>
                  <div className="text-[11px] mt-0.5">
                    {balance > 0
                      ? 'Reimbursement due to employee for approved expenses exceeding advance.'
                      : balance < 0
                      ? 'Employee currently holds unused advance amount to be refunded.'
                      : 'Advance and approved expenses are fully balanced and settled.'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-semibold px-2 py-1 bg-white/80 rounded border">
                    {balance > 0
                      ? 'PAY REIMBURSEMENT'
                      : balance < 0
                      ? 'RECOVERY REQUIRED'
                      : 'BALANCED'}
                  </span>
                </div>
              </div>

              {/* Receipts & Audit details */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="font-semibold text-slate-800">Expense Claim References</div>
                {(expenseRecord?.expenseReceiptReferences || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {expenseRecord.expenseReceiptReferences.map((ref, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-slate-700"
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">No receipts submitted yet.</div>
                )}
                <div className="text-slate-500 text-[11px] pt-1">
                  Notes: {expenseRecord.notes || 'None recorded'}
                </div>
              </div>

              {/* Historical Vouchers & Audit Metadata */}
              {(expenseRecord.advanceDisbursedReference || expenseRecord.reconciledAt) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                  <div className="font-semibold text-slate-800">Historical Voucher &amp; Settlement Audit</div>
                  {expenseRecord.advanceDisbursedReference && (
                    <div className="text-slate-600 text-[11px]">
                      <span className="font-medium text-slate-800">Advance Voucher:</span>{' '}
                      <span className="font-mono">{expenseRecord.advanceDisbursedReference}</span> • Rs.{' '}
                      {(expenseRecord.disbursedAdvance || 0).toLocaleString()} disbursed
                      {expenseRecord.disbursedBy ? ` by ${expenseRecord.disbursedBy}` : ''}
                      {expenseRecord.advanceDisbursedDate ? ` on ${expenseRecord.advanceDisbursedDate}` : ''}
                    </div>
                  )}
                  {expenseRecord.reconciledAt && (
                    <div className="text-slate-600 text-[11px]">
                      <span className="font-medium text-slate-800">Reconciliation Signoff:</span> Approved Rs.{' '}
                      {(expenseRecord.approvedExpenses || 0).toLocaleString()}
                      {expenseRecord.reconciledBy ? ` by ${expenseRecord.reconciledBy}` : ''} on {expenseRecord.reconciledAt}
                    </div>
                  )}
                </div>
              )}

              {/* Compliance Notice */}
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px] text-amber-800">
                <span className="font-semibold">Compliance Note:</span> A travel advance is
                recorded separately and does not post automatic payroll deductions or bank
                transfers until canonical F12 Expense reconciliation.
              </div>
            </div>
          )}

          {activeTab === 'disburse' && (
            !canDisburseAdvance ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-slate-900">
                  Advance Disbursement Locked ({expenseRecord.settlementStatus})
                </div>
                <p className="text-slate-600">
                  {isSettled
                    ? 'This travel expense record has already completed final settlement. Additional advance disbursements are strictly prohibited.'
                    : `An advance of Rs. ${(expenseRecord.disbursedAdvance || 0).toLocaleString()} has already been recorded for this trip. Duplicate advance disbursements are blocked.`}
                </p>
                {expenseRecord.advanceDisbursedReference && (
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-[11px] space-y-1">
                    <div>
                      <span className="font-semibold text-slate-700">Recorded Voucher:</span>{' '}
                      <span className="font-mono text-purple-800">{expenseRecord.advanceDisbursedReference}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Disbursed Amount:</span>{' '}
                      Rs. {(expenseRecord.disbursedAdvance || 0).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Disbursed By / Date:</span>{' '}
                      {expenseRecord.disbursedBy || 'Finance / Admin'} • {expenseRecord.advanceDisbursedDate || 'Recorded'}
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <form onSubmit={handleDisburseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Disbursed Advance Amount (PKR) *
                </label>
                <input
                  type="number"
                  value={disbursedAmount}
                  onChange={(e) => setDisbursedAmount(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Requested by employee: Rs. {(expenseRecord.requestedAdvance || 0).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Petty Cash Voucher / Payment Ref *
                </label>
                <input
                  type="text"
                  value={voucherReference}
                  onChange={(e) => setVoucherReference(e.target.value)}
                  placeholder="e.g. PCV-2026-8812"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Disbursement Notes
                </label>
                <textarea
                  rows={2}
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  placeholder="Petty cash disbursed against signed traveler receipt..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 shadow-xs"
                >
                  Record Advance Disbursement
                </button>
              </div>
            </form>
            )
          )}

          {activeTab === 'claim' && (
            !canSubmitClaims ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-slate-900">
                  Expense Claims Locked ({expenseRecord.settlementStatus})
                </div>
                <p className="text-slate-600">
                  Expense claims are locked once audit reconciliation/final settlement has been posted.
                </p>
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-[11px] space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">Submitted Claim Total:</span>{' '}
                    Rs. {(expenseRecord.employeeSubmittedExpenses || 0).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Receipts Recorded:</span>{' '}
                    {(expenseRecord.expenseReceiptReferences || []).join(', ') || 'None'}
                  </div>
                </div>
              </div>
            ) : (
            <form onSubmit={handleClaimSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Claimed Incurred Expenses (PKR) *
                </label>
                <input
                  type="number"
                  value={submittedExpenses}
                  onChange={(e) => setSubmittedExpenses(e.target.value)}
                  placeholder="e.g. 23500"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt Numbers & Bill References * (comma-separated)
                </label>
                <input
                  type="text"
                  value={receiptReferences}
                  onChange={(e) => setReceiptReferences(e.target.value)}
                  placeholder="e.g. RCP-HOTEL-990, RCP-TAXI-11, RCP-MEAL-44"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Claim Description / Traveler Notes
                </label>
                <textarea
                  rows={2}
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  placeholder="Included hotel stay, local cab fares, and client team dinner..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-xs"
                >
                  Submit Expense Claim
                </button>
              </div>
            </form>
            )
          )}

          {activeTab === 'audit' && (
            !canReconcile ? (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-emerald-900">
                  Final Settlement Reconciled &amp; Locked
                </div>
                <p className="text-emerald-800">
                  This record is permanently settled with Rs. 0 outstanding balance. Re-reconciliation is blocked to prevent duplicate ledger postings.
                </p>
                <div className="p-2.5 bg-white border border-emerald-200 rounded-lg text-[11px] space-y-1 text-slate-700">
                  <div>
                    <span className="font-semibold">Approved Actual Expenses:</span>{' '}
                    Rs. {(expenseRecord.approvedExpenses || 0).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-semibold">Reconciled By / Date:</span>{' '}
                    {expenseRecord.reconciledBy || 'Authorized Auditor'} • {expenseRecord.reconciledAt || 'Recorded'}
                  </div>
                  <div>
                    <span className="font-semibold">Settlement Notes:</span>{' '}
                    {expenseRecord.notes || 'None'}
                  </div>
                </div>
              </div>
            ) : (
            <form onSubmit={handleAuditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audited & Approved Expenses (PKR) *
                </label>
                <input
                  type="number"
                  value={approvedExpenses}
                  onChange={(e) => setApprovedExpenses(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Employee claimed: Rs. {(expenseRecord.employeeSubmittedExpenses || 0).toLocaleString()} • Advance paid: Rs. {(expenseRecord.disbursedAdvance || 0).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audit Remarks / Settlement Note
                </label>
                <textarea
                  rows={2}
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  placeholder="Verified original receipts against corporate per-diem policy..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 shadow-xs"
                >
                  Finalize Reconciliation
                </button>
              </div>
            </form>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
