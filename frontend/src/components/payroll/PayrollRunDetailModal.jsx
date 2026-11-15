import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'
import { taxService } from '@/services/taxService'

export function PayrollRunDetailModal({
  isOpen,
  onClose,
  run,
  onApprove,
  onFinalizePost,
  onSubmitReview,
  onVoidRun,
  onReconcileRun,
  onViewPayslip,
  onRecalculateTax,
  currentUser = null
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [processing, setProcessing] = useState(false)
  const [voidMode, setVoidMode] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [disburseMode, setDisburseMode] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER')
  const [transactionReference, setTransactionReference] = useState('')
  const [actionError, setActionError] = useState('')
  const [recalculatingTax, setRecalculatingTax] = useState(false)
  const [taxSuccessMessage, setTaxSuccessMessage] = useState('')

  if (!isOpen || !run) return null

  const roleUpper = String(currentUser?.backendRole || currentUser?.role || '').toUpperCase().replace(/[^A-Z]/g, '')
  const isSuperAdmin = roleUpper === 'SUPERADMIN'
  const isHrAdmin = roleUpper === 'HRADMIN'

  const statusUpper = String(run.status || '').toUpperCase()
  const isDraft = statusUpper === 'DRAFT'
  const isPendingReview = ['PENDING_APPROVAL', 'PENDING SUPER ADMIN REVIEW', 'UNDER_REVIEW', 'SUBMITTED'].includes(statusUpper)
  const isApproved = statusUpper === 'APPROVED'
  const isDisbursed = ['DISBURSED', 'POSTED', 'FINALIZED'].includes(statusUpper)
  const isVoid = statusUpper === 'VOID'
  const isBlockedUnreconciled = run.isReconciled === false || run.hasInactiveEmployees === true

  const filteredEmployees = (run.employeeBreakdown || []).filter((emp) => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase().trim()
    return (
      String(emp.employeeName || '').toLowerCase().includes(q) ||
      String(emp.employeeId || '').toLowerCase().includes(q) ||
      String(emp.department || '').toLowerCase().includes(q)
    )
  })

  const handleApprove = async () => {
    setActionError('')
    setProcessing(true)
    try {
      await onApprove?.(run.id)
    } catch (err) {
      setActionError(err?.message || 'Approval failed')
    } finally {
      setProcessing(false)
    }
  }

  const handlePost = async () => {
    setActionError('')
    if (!disburseMode) {
      setDisburseMode(true)
      return
    }
    if (!transactionReference.trim()) {
      setActionError('Bank / treasury transaction reference is required before disbursement.')
      return
    }
    setProcessing(true)
    try {
      await onFinalizePost?.(run.id, {
        paymentMethod,
        transactionReference: transactionReference.trim()
      })
      setDisburseMode(false)
      setTransactionReference('')
    } catch (err) {
      setActionError(err?.message || 'Disbursement failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleSubmit = async () => {
    setActionError('')
    setProcessing(true)
    try {
      await onSubmitReview?.(run.id)
    } catch (err) {
      setActionError(err?.message || 'Submit failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleConfirmVoid = async () => {
    setActionError('')
    if (!voidReason.trim()) {
      setActionError('A documented reason is required to void a payroll run.')
      return
    }
    setProcessing(true)
    try {
      await onVoidRun?.(run.id, voidReason.trim())
      setVoidMode(false)
      setVoidReason('')
      onClose?.()
    } catch (err) {
      setActionError(err?.message || 'Failed to void payroll run')
    } finally {
      setProcessing(false)
    }
  }

  const handleReconcile = async () => {
    setActionError('')
    setProcessing(true)
    try {
      await onReconcileRun?.(run.id)
    } catch (err) {
      setActionError(err?.message || 'Reconciliation failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleRecalculateTax = async () => {
    setActionError('')
    setTaxSuccessMessage('')
    setRecalculatingTax(true)
    try {
      if (onRecalculateTax) {
        await onRecalculateTax(run.id)
      } else {
        await taxService.recalculatePayrollRunTax(run.id)
      }
      setTaxSuccessMessage('Payroll tax recalculation applied successfully and snapshot saved.')
    } catch (err) {
      setActionError(err?.message || 'Tax recalculation failed')
    } finally {
      setRecalculatingTax(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen min-w-full z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl sm:max-w-2xl text-left overflow-hidden my-2 flex flex-col min-h-[75vh] max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-navy-950 via-navy-900 to-slate-900 text-white flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shrink-0 mt-0.5">
              <AppIcon name="payroll" className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white tracking-tight truncate">
                {run.periodName} Payroll Master Sheet
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-navy-800 text-blue-200 border border-navy-700">
                  {run.runNumber || run.id}
                </span>
                <span className="text-[11px] text-slate-300">
                  {run.fiscalYear || '2026-2027'} • {run.totalEmployees ?? filteredEmployees.length} Personnel
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={run.status} />
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-navy-800/80 hover:bg-navy-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Financial Highlights Bar (2x2 Portrait Grid) */}
        <div className="grid grid-cols-2 gap-2.5 p-4 bg-slate-50 border-b border-slate-200 shrink-0 font-mono text-xs">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 font-sans font-bold uppercase block">Gross Payroll</span>
            <span className="text-sm font-black text-slate-900">PKR {(run.grossPayroll || 0).toLocaleString()}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 font-sans font-bold uppercase block">FBR Tax Withheld</span>
            <span className="text-sm font-black text-amber-700">PKR {(run.totalTaxWithheld || 0).toLocaleString()}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 font-sans font-bold uppercase block">Loan Recoveries</span>
            <span className="text-sm font-black text-indigo-700">PKR {(run.totalLoanDeductions || 0).toLocaleString()}</span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            <span className="text-[10px] text-emerald-700 font-sans font-bold uppercase block">Total Net Disbursable</span>
            <span className="text-sm font-black text-emerald-800">PKR {(run.netPayable || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Statutory Tax Compliance & Policy Variance Banner */}
        {run.taxCompliance && (
          <div className="px-4 py-2 bg-amber-50/80 border-b border-amber-200/90 flex flex-wrap items-center justify-between text-[11px] text-amber-950 gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold flex items-center gap-1 text-slate-800">
                <AppIcon name="shield" className="w-3.5 h-3.5 text-amber-600" />
                Tax Policy:
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 font-mono font-bold text-amber-900 border border-amber-300">
                {run.taxCompliance.taxSnapshot?.config?.mode || 'Manual / Statutory'}
              </span>
              <span className="text-slate-600">
                Withheld: <strong className="font-mono text-slate-900">PKR {(run.taxCompliance.totalTaxWithheld || 0).toLocaleString()}</strong>
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">
                Statutory FBR Obligation: <strong className="font-mono text-slate-900">PKR {(run.taxCompliance.statutoryTaxObligationTotal || 0).toLocaleString()}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Statutory Variance:</span>
              <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                (run.taxCompliance.statutoryVariance || 0) === 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                PKR {(run.taxCompliance.statutoryVariance || 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {taxSuccessMessage && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between shrink-0">
            <span>{taxSuccessMessage}</span>
            <button type="button" onClick={() => setTaxSuccessMessage('')} className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer">✕</button>
          </div>
        )}

        {/* Reconciliation & Integrity Banner */}
        {(isBlockedUnreconciled || actionError) && (
          <div className="px-4 py-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 space-y-2 shrink-0">
            {isBlockedUnreconciled && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="font-semibold">
                  Validation Hold: {(run.reconciliationIssues || ['Payroll summary totals or employee eligibility do not reconcile with PostgreSQL records. Void invalid draft before approval.']).join(' ')}
                </div>
                {isSuperAdmin && (isDraft || isPendingReview) && !isVoid && onReconcileRun && (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    loading={processing}
                    onClick={handleReconcile}
                    className="bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    Void &amp; Reconcile Draft
                  </Button>
                )}
              </div>
            )}
            {actionError && <div className="font-bold">{actionError}</div>}
          </div>
        )}

        {/* Search Input */}
        <div className="px-4 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search employee / department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 shrink-0">
            Showing <strong className="text-slate-800">{filteredEmployees.length}</strong> employee{filteredEmployees.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Scrollable Portrait Employee Calculation Cards */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3 bg-slate-50/50">
          {filteredEmployees.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
              No employee payroll calculations match your search.
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const isInactive = emp.employmentStatus && emp.employmentStatus !== 'ACTIVE' && emp.employmentStatus !== 'UNKNOWN'
              return (
                <div
                  key={emp.entryId || emp.employeeId}
                  className={`bg-white rounded-xl border p-4 shadow-2xs space-y-3 ${
                    isInactive ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 flex flex-wrap items-center gap-1.5">
                        <span>{emp.employeeName}</span>
                        {emp.employmentStatus && emp.employmentStatus !== 'UNKNOWN' && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              isInactive
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {emp.employmentStatus}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {emp.employeeId} • {emp.department || 'Unassigned'}{emp.designation ? ` • ${emp.designation}` : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onViewPayslip(emp.employeeId, run.period)}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[11px] transition-colors cursor-pointer shrink-0"
                    >
                      View Payslip
                    </button>
                  </div>

                  {/* Two-Column Breakdown Inside Portrait Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    {/* Earnings Column */}
                    <div className="bg-slate-50/80 rounded-lg p-3 border border-slate-200/80 space-y-1.5">
                      <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Earnings Breakdown
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-slate-600">Basic Salary</span>
                        <span className="font-semibold text-slate-900">PKR {(emp.basicSalary || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-slate-600">Allowances</span>
                        <span className="text-slate-800">+{(emp.allowancesTotal || 0).toLocaleString()}</span>
                      </div>
                      {(emp.commission || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="font-sans text-slate-600">Commission</span>
                          <span className="text-slate-800">+{(emp.commission || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {(emp.overtimePay || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="font-sans text-slate-600">Overtime</span>
                          <span className="text-slate-800">+{(emp.overtimePay || 0).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                        <span className="font-sans">Gross Pay</span>
                        <span>PKR {(emp.grossSalary || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Deductions & Net Column */}
                    <div className="bg-slate-50/80 rounded-lg p-3 border border-slate-200/80 space-y-1.5 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Deductions &amp; Payout
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans text-rose-700">Unpaid Leave / Other</span>
                          <span className="text-rose-700 font-medium">
                            {(emp.unpaidLeaveDeduction || 0) > 0 ? `-${(emp.unpaidLeaveDeduction).toLocaleString()}` : '0'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans text-amber-700">FBR Tax (S.149)</span>
                          <span className="text-amber-700 font-medium">
                            {(emp.salaryTaxWithheld || 0) > 0 ? `-${(emp.salaryTaxWithheld).toLocaleString()}` : '0'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans text-indigo-700">Loan Installment</span>
                          <span className="text-indigo-700 font-medium">
                            {(emp.loanDeduction || 0) > 0 ? `-${(emp.loanDeduction).toLocaleString()}` : '0'}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-2 px-2.5 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 font-black text-emerald-800">
                        <span className="font-sans text-[11px] uppercase">Net Payable</span>
                        <span>PKR {(emp.netPayable || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Optional Inline Void / Disbursement Verification Inputs */}
        {voidMode && isSuperAdmin && !isDisbursed && !isVoid && (
          <div className="px-6 py-3 bg-rose-50 border-t border-rose-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Enter mandatory reason to VOID this payroll run..."
              className="flex-1 min-w-[260px] text-xs border border-rose-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setVoidMode(false)}>Cancel</Button>
              <Button type="button" variant="primary" size="sm" loading={processing} onClick={handleConfirmVoid} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                Confirm Void Run
              </Button>
            </div>
          </div>
        )}

        {disburseMode && isSuperAdmin && isApproved && (
          <div className="px-6 py-3 bg-blue-50 border-t border-blue-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-xs border border-blue-300 rounded-lg px-2.5 py-1.5 bg-white"
              >
                <option value="BANK_TRANSFER">Bank Transfer (IBFT/SWIFT)</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="Treasury / Bank Batch Reference (e.g. BATCH-IBFT-202611)"
                className="flex-1 min-w-[240px] text-xs border border-blue-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDisburseMode(false)}>Cancel</Button>
              <Button type="button" variant="primary" size="sm" loading={processing} onClick={handlePost} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                Confirm Disbursement
              </Button>
            </div>
          </div>
        )}

        {/* Modal Footer with Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {isVoid ? (
              <span className="text-rose-700 font-semibold">
                Voided payroll run. Excluded from disbursement and financial totals.
              </span>
            ) : isDisbursed ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <AppIcon name="check" className="w-3.5 h-3.5" />
                Finalized and disbursed to bank payment register
              </span>
            ) : isApproved ? (
              <span className="text-blue-700 font-semibold">
                Approved by Super Admin. Ready for authorized disbursement.
              </span>
            ) : isPendingReview ? (
              <span className="text-amber-700 font-semibold">
                Submitted for Super Admin review. Verify calculations before final approval.
              </span>
            ) : (
              <span className="text-amber-700 font-semibold">
                Draft stage. Verify attendance, overtime, unpaid leaves and eligibility before approval.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>

            {/* Super Admin can recalculate manual tax deductions for draft runs */}
            {isSuperAdmin && (isDraft || isPendingReview) && !isVoid && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={recalculatingTax}
                disabled={processing || isBlockedUnreconciled}
                onClick={handleRecalculateTax}
                title="Recalculate deductions using active manual tax configuration and snapshot to database"
                className="text-amber-800 border-amber-300 hover:bg-amber-50 font-bold cursor-pointer inline-flex items-center gap-1 text-[11px]"
              >
                <AppIcon name="calculator" className="w-3 h-3 text-amber-600" />
                Recalculate Tax
              </Button>
            )}

            {/* Super Admin can Void un-disbursed runs */}
            {isSuperAdmin && !isDisbursed && !isVoid && onVoidRun && !voidMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={processing}
                onClick={() => setVoidMode(true)}
                className="text-rose-700 border-rose-300 hover:bg-rose-50 font-bold cursor-pointer"
              >
                Void Run
              </Button>
            )}

            {/* HR Admin or Super Admin can submit Draft for Review */}
            {(isHrAdmin || isSuperAdmin) && isDraft && onSubmitReview && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={processing}
                disabled={isBlockedUnreconciled}
                onClick={handleSubmit}
                className="bg-navy-700 hover:bg-navy-800 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                Submit for Super Admin Review
              </Button>
            )}

            {/* Super Admin can Approve */}
            {isSuperAdmin && (isDraft || isPendingReview) && onApprove && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={processing}
                disabled={isBlockedUnreconciled}
                onClick={handleApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                Approve Payroll Run
              </Button>
            )}

            {/* Finalize and Disburse (Requires APPROVED) */}
            {isSuperAdmin && isApproved && onFinalizePost && !disburseMode && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={processing}
                disabled={isBlockedUnreconciled}
                onClick={handlePost}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                Disburse &amp; Mark Paid
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}

export default PayrollRunDetailModal
