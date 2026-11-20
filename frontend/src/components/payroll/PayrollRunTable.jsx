import React from 'react'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'

export function PayrollRunTable({
  runs = [],
  payrollRuns = [],
  onViewRun,
  onApproveRun,
  onFinalizeRun,
  onReconcileRun,
  onRefreshDraft,
  onGenerateDraft,
  canGenerate = false
}) {
  const effectiveRuns = Array.isArray(runs) && runs.length > 0 ? runs : (Array.isArray(payrollRuns) ? payrollRuns : [])
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden text-left">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200">
            <AppIcon name="payroll" className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Monthly Payroll Runs &amp; Disbursal History
            </h3>
            <p className="text-xs text-slate-500">
              Audited payroll periods, executive review, tax liability, and payment execution
            </p>
          </div>
        </div>

        {canGenerate && (
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onGenerateDraft}
            className="text-xs bg-navy-800 hover:bg-navy-900 text-white font-bold cursor-pointer"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5 mr-1" />
            <span>Generate Monthly Draft</span>
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Headcount</th>
              <th className="px-4 py-3 text-right">Gross Payroll</th>
              <th className="px-4 py-3 text-right">Tax Withheld</th>
              <th className="px-4 py-3 text-right">Loans Recovered</th>
              <th className="px-4 py-3 text-right">Net Payable</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {effectiveRuns.map((run) => (
              <tr key={run.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3 font-sans">
                  <div className="font-bold text-slate-900">{run.periodName || run.period}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{run.runNumber || run.id} • {run.fiscalYear || '2026-2027'}</div>
                  {run.isReconciled === false && (
                    <div className="text-[10px] text-rose-700 font-semibold mt-0.5">
                      {(run.reconciliationIssues && run.reconciliationIssues[0]) || 'Requires Void / Reconciliation'}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-sans font-medium text-slate-700">
                  {run.totalEmployees ?? 0} Employees
                  {run.entryCount != null && Number(run.entryCount) !== Number(run.totalEmployees) && (
                    <span className="block text-[10px] text-rose-600">({run.entryCount} entries)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">
                  PKR {(run.grossPayroll || 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium text-amber-700">
                  PKR {(run.totalTaxWithheld || 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium text-indigo-700">
                  PKR {(run.totalLoanDeductions || 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-emerald-700 font-sans">
                  <span className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200">
                    PKR {(run.netPayable || 0).toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 font-sans">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-right font-sans">
                  <div className="flex items-center justify-end gap-1.5">
                    {onRefreshDraft && ['DRAFT', 'PENDING SUPERVISION', 'PENDING SUPER ADMIN REVIEW', 'PENDING_APPROVAL'].includes(String(run.status || '').toUpperCase()) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onRefreshDraft(run)}
                        className="text-[11px] text-blue-700 border-blue-300 hover:bg-blue-50 font-bold cursor-pointer"
                        title="Recalculate draft against canonical records"
                      >
                        <AppIcon name="arrowPath" className="w-3 h-3 mr-1" />
                        <span>Refresh Draft</span>
                      </Button>
                    )}
                    {onReconcileRun && (run.isReconciled === false || run.hasInactiveEmployees === true) && ['DRAFT', 'PENDING_APPROVAL'].includes(String(run.status || '').toUpperCase()) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onReconcileRun(run.id)}
                        className="text-[11px] text-rose-700 border-rose-300 hover:bg-rose-50 font-bold cursor-pointer"
                      >
                        Void &amp; Reconcile
                      </Button>
                    )}
                    {onApproveRun && ['DRAFT', 'PENDING SUPERVISION', 'PENDING SUPER ADMIN REVIEW', 'PENDING_APPROVAL'].includes(String(run.status || '').toUpperCase()) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={run.isReconciled === false || run.hasInactiveEmployees === true}
                        onClick={() => onApproveRun(run.id)}
                        className="text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer disabled:opacity-40"
                      >
                        Approve
                      </Button>
                    )}
                    {onFinalizeRun && (run.status === 'Approved' || run.status === 'APPROVED') && (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => onFinalizeRun(run.id)}
                        className="text-[11px] bg-navy-950 hover:bg-navy-900 text-white cursor-pointer"
                      >
                        Finalize &amp; Disburse
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onViewRun(run)}
                      className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
                    >
                      <span>View Sheet</span>
                      <AppIcon name="chevronRight" className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {effectiveRuns.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-sans text-xs">
                  No monthly payroll runs found. Click &quot;Generate Period Draft&quot; above to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PayrollRunTable
