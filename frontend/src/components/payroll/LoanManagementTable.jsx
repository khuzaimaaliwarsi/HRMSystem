import React from 'react'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'

export function LoanManagementTable({
  loans = [],
  onApproveLoan,
  onRejectLoan,
  onOpenApplyModal,
  canApprove = false,
  canApply = true,
  currentUser = null
}) {
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
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Loan Category</th>
              <th className="px-4 py-3 text-right">Principal</th>
              <th className="px-4 py-3 text-right">Monthly Installment</th>
              <th className="px-4 py-3 text-center">Tenure / Paid</th>
              <th className="px-4 py-3 text-right text-emerald-700">Repaid Total</th>
              <th className="px-4 py-3 text-right text-rose-700 font-bold">Outstanding Balance</th>
              <th className="px-4 py-3">Status</th>
              {canApprove && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {loans.map((l) => {
              const isSuperAdmin = String(currentUser?.role || '').toLowerCase() === 'super_admin'
              const isSelf = currentUser && (currentUser.employeeId === l.employeeId || currentUser.id === l.employeeId)
              const blockSelf = isSelf && !isSuperAdmin
              const isPending = l.status === 'Pending Super Admin Review'

              return (
                <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-sans">
                    <div className="font-bold text-slate-900">{l.employeeName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{l.employeeId} • {l.id}</div>
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <span className="font-semibold text-slate-800">{l.loanType}</span>
                    <div className="text-[10px] text-slate-400 truncate max-w-xs" title={l.reason}>
                      {l.reason}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 font-bold">
                    PKR {(l.principalAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-indigo-700">
                    PKR {(l.installmentAmount || 0).toLocaleString()} /mo
                  </td>
                  <td className="px-4 py-3 text-center font-sans">
                    <span className="font-bold text-slate-800">{l.installmentsPaid || 0}</span>
                    <span className="text-slate-400"> / {l.totalInstallments} months</span>
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                    PKR {(l.repaidAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-rose-800 bg-rose-50/30">
                    PKR {(l.outstandingBalance || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <StatusBadge status={l.status} />
                  </td>
                  {canApprove && (
                    <td className="px-4 py-3 text-right font-sans">
                      {isPending && !blockSelf && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => onApproveLoan(l.id)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                          >
                            Disburse
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => onRejectLoan(l.id)}
                            className="text-xs cursor-pointer"
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      {blockSelf && isPending && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                          Self Request (No Self-Approval)
                        </span>
                      )}

                      {!isPending && (
                        <span className="text-[11px] text-slate-400">
                          {l.approvedBy ? `Approved by ${l.approvedBy}` : 'Processed'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}

            {loans.length === 0 && (
              <tr>
                <td colSpan={canApprove ? 9 : 8} className="px-4 py-8 text-center text-slate-400 font-sans text-xs">
                  No active or historical loan records found in this scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LoanManagementTable
