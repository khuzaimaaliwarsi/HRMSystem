import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'
import LoanDetailsModal from './LoanDetailsModal'

export function LoanManagementTable({
  loans = [],
  onApproveLoan,
  onRejectLoan,
  onOpenApplyModal,
  canApprove = false,
  canApply = true,
  currentUser = null
}) {
  const [selectedLoanForDetails, setSelectedLoanForDetails] = useState(null)

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden text-left">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs border border-amber-200">
            <AppIcon name="tasks" className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Employee Loans &amp; Salary Advance Ledgers
            </h3>
            <p className="text-xs text-slate-500">
              Principal disbursements, amortization schedules, and automatic monthly payroll installment deductions
            </p>
          </div>
        </div>

        {canApply && (
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onOpenApplyModal}
            className="text-xs bg-navy-800 hover:bg-navy-900 text-white font-bold cursor-pointer"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5 mr-1" />
            <span>Apply for Loan / Advance</span>
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Employee &amp; Dates</th>
              <th className="px-4 py-3">Loan Category</th>
              <th className="px-4 py-3 text-right">Principal</th>
              <th className="px-4 py-3 text-right">Monthly Installment</th>
              <th className="px-4 py-3 text-center">Tenure / Schedule</th>
              <th className="px-4 py-3 text-right text-emerald-700">Repaid Total</th>
              <th className="px-4 py-3 text-right text-rose-700 font-bold">Outstanding Balance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {loans.map((l) => {
              const isSuperAdmin = String(currentUser?.role || '').toLowerCase() === 'super_admin'
              const isSelf = currentUser && (currentUser.employeeId === l.employeeId || currentUser.id === l.employeeId || currentUser.employeeId === l.employeeCode)
              const blockSelf = isSelf && !isSuperAdmin
              const isPending = l.status === 'Pending Super Admin Review' || l.status === 'PENDING' || l.status === 'APPLIED'
              const disbDateStr = l.disbursedDate || l.disbursementDate
              const formattedDisbDate = disbDateStr
                ? new Date(disbDateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : null

              return (
                <tr key={l.cuid || l.loanNumber || l.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-sans">
                    <div className="font-bold text-slate-900">{l.employeeName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{l.employeeCode || l.employeeId} • {l.loanNumber || l.id}</div>
                    <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                      {formattedDisbDate ? (
                        <span className="font-semibold text-navy-900 bg-navy-50 px-1.5 py-0.2 rounded border border-navy-200">
                          Disbursed: {formattedDisbDate}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Pending Disbursement</span>
                      )}
                      {l.repaymentStartMonth && (
                        <span className="text-slate-500 font-mono text-[9.5px]">• Start: {l.repaymentStartMonth}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <span className="font-semibold text-slate-800">{l.loanType}</span>
                    <div className="text-[10px] text-slate-400 truncate max-w-xs" title={l.reason}>
                      {l.reason}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 font-bold whitespace-nowrap">
                    PKR {(l.principalAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-indigo-700 whitespace-nowrap">
                    PKR {(l.installmentAmount || 0).toLocaleString()} /mo
                  </td>
                  <td className="px-4 py-3 text-center font-sans whitespace-nowrap">
                    <span className="font-bold text-slate-800">{l.installmentsPaid || 0}</span>
                    <span className="text-slate-400"> / {l.totalInstallments} months</span>
                    {l.nextDeductionPeriod && (l.status === 'Active' || l.status === 'DISBURSED') && (
                      <div className="text-[10px] font-mono text-indigo-700 font-semibold mt-0.5">
                        Due: {l.nextDeductionPeriod}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-medium whitespace-nowrap">
                    PKR {(l.repaidAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-rose-800 bg-rose-50/30 whitespace-nowrap">
                    PKR {(l.outstandingBalance || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-sans whitespace-nowrap">
                    <StatusBadge status={l.status === 'PENDING' ? 'Pending Super Admin Review' : l.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLoanForDetails(l)}
                        className="text-xs text-navy-800 border-slate-300 hover:bg-slate-100 font-bold cursor-pointer whitespace-nowrap"
                        title="View complete repayment schedule and installment details"
                      >
                        <AppIcon name="calendar" className="w-3.5 h-3.5 mr-1 text-navy-700" />
                        <span>View Schedule</span>
                      </Button>

                      {canApprove && isPending && !blockSelf && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => onApproveLoan(l.cuid || l.id)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                          >
                            Disburse
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => onRejectLoan(l.cuid || l.id)}
                            className="text-xs cursor-pointer"
                          >
                            Decline
                          </Button>
                        </>
                      )}

                      {canApprove && blockSelf && isPending && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                          Self Request (No Self-Approval)
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {loans.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-sans text-xs">
                  No active or historical loan records found in this scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Loan Details & Amortization Schedule Modal */}
      <LoanDetailsModal
        isOpen={Boolean(selectedLoanForDetails)}
        onClose={() => setSelectedLoanForDetails(null)}
        loan={selectedLoanForDetails}
      />
    </div>
  )
}

export default LoanManagementTable
