import React from 'react'
import ReactDOM from 'react-dom'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import { generateLoanSchedule } from '@/services/loanService'

export default function LoanDetailsModal({ isOpen, onClose, loan }) {
  if (!isOpen || !loan) return null

  const schedule = (Array.isArray(loan.schedule) && loan.schedule.length > 0)
    ? loan.schedule
    : generateLoanSchedule(loan)

  const principal = Number(loan.principalAmount || 0)
  const installment = Number(loan.installmentAmount || 0)
  const repaid = Number(loan.repaidAmount || 0)
  const balance = Number(loan.outstandingBalance || 0)
  const tenure = Number(loan.totalInstallments || 1)
  const paidCount = Number(loan.installmentsPaid || 0)

  const disbDateStr = loan.disbursementDate || loan.disbursedDate
  const formattedDisbDate = disbDateStr
    ? new Date(disbDateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Not Disbursed Yet'

  const startMonthStr = loan.repaymentStartMonth || (disbDateStr ? String(disbDateStr).slice(0, 7) : null)
  const formattedStartMonth = startMonthStr
    ? new Date(`${startMonthStr}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'N/A'

  const repayments = Array.isArray(loan.repayments) ? loan.repayments : []
  const approvalDate = loan.approvedDate || null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overscroll-contain animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150 text-left">
        {/* Header */}
        <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm bg-navy-800 px-2.5 py-0.5 rounded text-amber-300 border border-navy-700">
                {loan.loanNumber || loan.id}
              </span>
              <h3 className="text-base font-bold text-white">
                {loan.loanType || 'Loan Details & Amortization Schedule'}
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {loan.employeeName} ({loan.employeeCode || loan.employeeId})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl p-1 cursor-pointer transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status and Overview Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Current Status:</span>
              <StatusBadge status={loan.status === 'PENDING' ? 'Pending Super Admin Review' : loan.status} />
            </div>
            {(loan.approvedBy || approvalDate) && (
              <div className="text-xs text-slate-500 font-medium">
                Approval: <span className="font-semibold text-slate-700">{loan.approvedBy || 'Approver not recorded'}</span>
                {approvalDate && <span> on {approvalDate}</span>}
                {!approvalDate && <span> (date not recorded)</span>}
              </div>
            )}
          </div>

          {/* 4 Financial KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Principal</span>
              <span className="text-sm font-extrabold text-slate-900 font-mono">PKR {principal.toLocaleString()}</span>
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">Monthly Installment</span>
              <span className="text-sm font-extrabold text-indigo-900 font-mono">PKR {installment.toLocaleString()} /mo</span>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Repaid Total</span>
              <span className="text-sm font-extrabold text-emerald-900 font-mono">
                PKR {repaid.toLocaleString()}
                <span className="text-[10px] text-emerald-700 font-sans font-normal ml-1">({paidCount}/{tenure})</span>
              </span>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">Outstanding</span>
              <span className="text-sm font-extrabold text-rose-900 font-mono">PKR {balance.toLocaleString()}</span>
            </div>
          </div>

          {/* Key Dates Schedule Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-blue-50/50 border border-blue-100 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Disbursement Date:</span>
              <span className="font-bold text-slate-900 font-mono">{formattedDisbDate}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Repayment Start Month:</span>
              <span className="font-bold text-slate-900">{formattedStartMonth}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Amortization Tenure:</span>
              <span className="font-bold text-slate-900">{tenure} Monthly Installments</span>
            </div>
          </div>

          {/* Amortization Schedule Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <AppIcon name="calendar" className="w-3.5 h-3.5 text-navy-700" />
                <span>Monthly Installment Amortization Schedule</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                Automatic Payroll Deduction at Month-End Cutoff
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5 text-center">#</th>
                    <th className="px-3.5 py-2.5">Billing Period</th>
                    <th className="px-3.5 py-2.5">Deduction Due Date</th>
                    <th className="px-3.5 py-2.5 text-right">Installment Amount</th>
                    <th className="px-3.5 py-2.5 text-right">Projected Balance</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {schedule.length === 0 && (
                    <tr><td colSpan={6} className="px-3.5 py-4 text-center font-sans text-amber-800">Repayment schedule unavailable: verified start month or disbursement date required.</td></tr>
                  )}
                  {schedule.map((item) => {
                    const isPaid = item.status === 'PAID'
                    return (
                      <tr key={item.installmentNumber} className={isPaid ? 'bg-emerald-50/30' : 'hover:bg-slate-50/80'}>
                        <td className="px-3.5 py-2.5 text-center font-bold text-slate-700">
                          {item.installmentNumber}
                        </td>
                        <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-900">
                          {item.dueMonthName}
                          <span className="text-[10px] text-slate-400 font-mono ml-1.5">({item.periodCode})</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">
                          {item.dueDate}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-indigo-700">
                          PKR {Number(item.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-medium text-slate-700">
                          PKR {Number(item.remainingAfter || item.balanceAfter || 0).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-sans">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <AppIcon name="check" className="w-3 h-3 text-emerald-600" />
                              <span>Paid in Payroll</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <AppIcon name="clock" className="w-3 h-3 text-amber-600" />
                              <span>Pending Deduction</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Repayment History Ledger (if any) */}
          {repayments.length > 0 ? (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <AppIcon name="receipt" className="w-3.5 h-3.5 text-emerald-700" />
                <span>Recorded Repayment Transactions</span>
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2">Date</th>
                      <th className="px-3.5 py-2">Source</th>
                      <th className="px-3.5 py-2 text-right">Amount</th>
                      <th className="px-3.5 py-2 text-right">Balance After</th>
                      <th className="px-3.5 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {repayments.map((r, i) => (
                      <tr key={r.id || i}>
                        <td className="px-3.5 py-2 text-slate-700">
                          {r.repaymentDate ? new Date(r.repaymentDate).toISOString().slice(0, 10) : '-'}
                        </td>
                        <td className="px-3.5 py-2 font-sans font-medium text-slate-800">
                          {r.paymentSource || 'PAYROLL_DEDUCTION'}
                        </td>
                        <td className="px-3.5 py-2 text-right font-bold text-emerald-700">
                          PKR {Number(r.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-right text-slate-700">
                          PKR {Number(r.balanceAfter || 0).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 font-sans text-slate-500 text-[11px]">
                          {r.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-500 flex items-center gap-2">
              <AppIcon name="clock" className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                <strong className="text-slate-700">Repayment Ledger:</strong> No repayments posted yet. Draft payroll runs do not deduct loan balances; installments are officially recorded as Paid only upon Super Admin payroll disbursement.
              </span>
            </div>
          )}

          {/* Reason / Remarks */}
          {loan.reason && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-0.5">Application Remarks / Purpose:</span>
              <p className="text-slate-600">{loan.reason}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(modalContent, document.body)
  }
  return modalContent
}
