import React from 'react'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'

export function RefreshDraftConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  run,
  previewData,
  isLoading = false
}) {
  if (!isOpen || !run) return null

  const curTotals = previewData?.currentTotals || {
    gross: Number(run.grossPayroll || run.totalGross || 0),
    net: Number(run.netPayable || run.totalNet || 0),
    deductions: Number(run.totalDeductions || 0),
    headcount: Number(run.totalEmployees || run.employeeBreakdown?.length || 0)
  }

  const newTotals = previewData?.newTotals || curTotals
  const diff = previewData?.diff || {
    gross: newTotals.gross - curTotals.gross,
    net: newTotals.net - curTotals.net,
    deductions: newTotals.deductions - curTotals.deductions,
    headcount: newTotals.headcount - curTotals.headcount
  }

  const added = previewData?.added || []
  const removed = previewData?.removed || []
  const updated = previewData?.updated || []
  const hasApprovals = previewData?.hasIndividualApprovals || false
  const approvedCount = previewData?.approvedEntriesCount || 0

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold border border-blue-200">
              <AppIcon name="arrowPath" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Refresh &amp; Recalculate Payroll Draft
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {run.runNumber || run.id} • {run.periodName || run.period}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <AppIcon name="xmark" className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-slate-600 max-h-[75vh] overflow-y-auto">
          {/* Identity Preservation Notice */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-2.5">
            <AppIcon name="info" className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-blue-900 text-xs">
                Authoritative Run Number Preserved
              </div>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Recalculating updates employee line items, approved leaves, shift overtime, and loan deductions directly within this draft run. The original ID and run number (<span className="font-mono font-bold">{run.runNumber || run.id}</span>) will remain unchanged.
              </p>
            </div>
          </div>

          {/* Individual Approvals Warning Banner */}
          {hasApprovals && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <AppIcon name="alertTriangle" className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold text-amber-900 text-xs">
                  Existing Individual Approvals Detected ({approvedCount})
                </div>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {approvedCount} employee entry(s) have been individually approved. Recalculating will update calculations against canonical PostgreSQL records.
                </p>
              </div>
            </div>
          )}

          {/* Financial Diff Grid */}
          <div>
            <h4 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2">
              Financial Comparison &amp; Scope Diff
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              {/* Headcount */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-sans font-semibold">Headcount</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{newTotals.headcount}</div>
                <div className="text-[10px] text-slate-400">
                  Current: {curTotals.headcount}
                  {diff.headcount !== 0 && (
                    <span className={`ml-1 font-bold ${diff.headcount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ({diff.headcount > 0 ? `+${diff.headcount}` : diff.headcount})
                    </span>
                  )}
                </div>
              </div>

              {/* Gross Payroll */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-sans font-semibold">Gross Payroll</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">PKR {newTotals.gross.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">
                  Diff: {diff.gross === 0 ? 'PKR 0' : `${diff.gross > 0 ? '+' : ''}${diff.gross.toLocaleString()}`}
                </div>
              </div>

              {/* Deductions */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-sans font-semibold">Total Deductions</div>
                <div className="text-sm font-bold text-amber-800 mt-0.5">PKR {newTotals.deductions.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">
                  Diff: {diff.deductions === 0 ? 'PKR 0' : `${diff.deductions > 0 ? '+' : ''}${diff.deductions.toLocaleString()}`}
                </div>
              </div>

              {/* Net Payable */}
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div className="text-[10px] text-emerald-800 font-sans font-semibold">Net Payable</div>
                <div className="text-sm font-extrabold text-emerald-800 mt-0.5">PKR {newTotals.net.toLocaleString()}</div>
                <div className="text-[10px] text-emerald-700">
                  Diff: {diff.net === 0 ? 'PKR 0' : `${diff.net > 0 ? '+' : ''}${diff.net.toLocaleString()}`}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Employee Changes Breakdown */}
          {(added.length > 0 || removed.length > 0 || updated.length > 0) ? (
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Line Item Adjustments
              </h4>

              {added.length > 0 && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-[11px]">
                  <div className="font-bold text-emerald-900 mb-1">
                    Newly Added Eligible Staff ({added.length})
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                    {added.map((e) => (
                      <li key={e.employeeId}>
                        {e.employeeName} ({e.employeeCode}) — Net PKR {e.netPayable.toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {removed.length > 0 && (
                <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl text-[11px]">
                  <div className="font-bold text-rose-900 mb-1">
                    Excluded / Ineligible Staff ({removed.length})
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-800">
                    {removed.map((e) => (
                      <li key={e.employeeId}>
                        {e.employeeName} ({e.employeeCode})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {updated.length > 0 && (
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-[11px]">
                  <div className="font-bold text-blue-900 mb-1">
                    Updated Staff Calculations ({updated.length})
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 font-mono text-[10px]">
                    {updated.map((e) => (
                      <li key={e.employeeId} className="font-sans">
                        <span className="font-bold">{e.employeeName} ({e.employeeCode})</span>: Net PKR {e.oldNet.toLocaleString()} &rarr; PKR {e.newNet.toLocaleString()}
                        {e.netDiff !== 0 && (
                          <span className={`ml-1 font-bold ${e.netDiff > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            ({e.netDiff > 0 ? `+PKR ${e.netDiff.toLocaleString()}` : `-PKR ${Math.abs(e.netDiff).toLocaleString()}`})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
              All employee line items and financial calculations are currently identical to canonical records.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={onClose}
            className="text-xs text-slate-600 border-slate-300 hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isLoading}
            onClick={() => onConfirm(run.id)}
            className="text-xs bg-navy-950 hover:bg-navy-900 text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <AppIcon name="arrowPath" className="w-3.5 h-3.5 animate-spin" />
                <span>Recalculating...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <AppIcon name="calculator" className="w-3.5 h-3.5" />
                <span>Recalculate &amp; Update Draft</span>
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default RefreshDraftConfirmModal