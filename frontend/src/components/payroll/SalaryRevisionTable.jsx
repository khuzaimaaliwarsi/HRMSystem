import React from 'react'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/utils'
import { fmtDate } from '@/lib/dateUtils'

export function SalaryRevisionTable({
  proposals = [],
  revisions = [],
  onApprove,
  onReject,
  onReturn,
  onOpenNewProposal,
  canApprove = false,
  canPropose = false,
  currentUser = null
}) {
  const items = (proposals && proposals.length > 0) ? proposals : (revisions || [])

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden text-left">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-200">
            <AppIcon name="payroll" className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Salary Increment &amp; Decrement Governance
            </h3>
            <p className="text-xs text-slate-500">
              Executive approval matrix: Manager performance recommendation → HR proposal → Super Admin final sign-off
            </p>
          </div>
        </div>

        {canPropose && (
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onOpenNewProposal}
            className="text-xs bg-navy-800 hover:bg-navy-900 text-white font-bold cursor-pointer"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5 mr-1" />
            <span>Propose Salary Revision</span>
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3 text-right">Current Salary</th>
              <th className="px-4 py-3 text-right">Proposed Salary</th>
              <th className="px-4 py-3 text-right">Delta / Change</th>
              <th className="px-4 py-3">Effective Date</th>
              <th className="px-4 py-3">Justification &amp; Rating</th>
              <th className="px-4 py-3">Status</th>
              {canApprove && <th className="px-4 py-3 text-right">Executive Decision</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {items.map((p) => {
              const isSuperAdmin = String(currentUser?.role || '').toLowerCase() === 'super_admin'
              const isSelf = currentUser && (currentUser.employeeId === p.employeeId || currentUser.id === p.employeeId)
              const blockSelf = isSelf && !isSuperAdmin
              const isPending = p.status === 'Pending Super Admin Review' || p.status === 'Draft'

              return (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-sans">
                    <div className="font-bold text-slate-900">{p.employeeName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{p.employeeId} • {p.department}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    PKR {(p.currentSalary || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-slate-900">
                    PKR {(p.proposedSalary || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      "px-2 py-0.5 rounded font-extrabold text-[11px]",
                      p.type === 'Increment'
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    )}>
                      {p.deltaAmount > 0 ? `+${p.deltaAmount.toLocaleString()}` : p.deltaAmount.toLocaleString()} ({p.percentageChange}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {fmtDate(p.effectiveDate)}
                  </td>
                  <td className="px-4 py-3 font-sans max-w-xs">
                    <div className="text-slate-800 line-clamp-1" title={p.justification}>
                      {p.justification}
                    </div>
                    {p.performanceRating && (
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 mt-0.5 inline-block">
                        ★ Rating: {p.performanceRating} / 5.0
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <StatusBadge status={p.status} />
                  </td>
                  {canApprove && (
                    <td className="px-4 py-3 text-right font-sans">
                      {isPending && !blockSelf && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => onApprove(p.id)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onReturn(p.id)}
                            className="text-xs text-amber-600 border-amber-200 hover:bg-amber-50 cursor-pointer"
                          >
                            Return
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => onReject(p.id)}
                            className="text-xs cursor-pointer"
                          >
                            Reject
                          </Button>
                        </div>
                      )}

                      {blockSelf && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                          Self Proposal (Anti-Self-Approval)
                        </span>
                      )}

                      {!isPending && (
                        <span className="text-xs text-slate-400 font-medium">
                          Decided by {p.approvedBy || 'Board'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={canApprove ? 8 : 7} className="px-4 py-8 text-center text-slate-400 font-sans text-xs">
                  No salary revision proposals found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SalaryRevisionTable
