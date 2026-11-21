import React, { useState, useMemo } from 'react'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'
import { loanService } from '@/services/loanService'

export function EmployeePayrollBreakdownTable({
  payrollRuns = [],
  selectedPeriod: initialPeriod,
  onPeriodChange,
  onViewPayslip,
  onApproveEntry,
  currentUser,
  canApprove = false
}) {
  // Available runs for period selection
  const validRuns = useMemo(() => {
    return (payrollRuns || []).filter((r) => String(r.status || '').toUpperCase() !== 'VOID')
  }, [payrollRuns])

  const [activePeriod, setActivePeriod] = useState(() => {
    if (initialPeriod) return initialPeriod
    return validRuns[0]?.period || validRuns[0]?.payrollPeriod?.periodCode || '2026-11'
  })

  // Keep in sync if parent period changes
  React.useEffect(() => {
    if (initialPeriod && initialPeriod !== activePeriod) {
      setActivePeriod(initialPeriod)
    }
  }, [initialPeriod])

  const handlePeriodChange = (newPeriod) => {
    setActivePeriod(newPeriod)
    if (onPeriodChange) onPeriodChange(newPeriod)
  }

  // Selected Run
  const currentRun = useMemo(() => {
    return (
      validRuns.find(
        (r) =>
          r.period === activePeriod ||
          r.payrollPeriod?.periodCode === activePeriod ||
          r.id === activePeriod ||
          r.runNumber === activePeriod
      ) || validRuns[0] || null
    )
  }, [validRuns, activePeriod])

  const rawEntries = useMemo(() => {
    if (!currentRun) return []
    return Array.isArray(currentRun.employeeBreakdown)
      ? currentRun.employeeBreakdown
      : Array.isArray(currentRun.entries)
        ? currentRun.entries
        : []
  }, [currentRun])

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Available departments
  const departments = useMemo(() => {
    const set = new Set()
    for (const e of rawEntries) {
      if (e.department) set.add(e.department)
    }
    return Array.from(set).sort()
  }, [rawEntries])

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return rawEntries.filter((entry) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const nameMatch = (entry.employeeName || '').toLowerCase().includes(q)
        const idMatch = (entry.employeeId || entry.employeeCode || '').toLowerCase().includes(q)
        const desigMatch = (entry.designation || '').toLowerCase().includes(q)
        if (!nameMatch && !idMatch && !desigMatch) return false
      }

      // Dept
      if (deptFilter !== 'ALL' && entry.department !== deptFilter) {
        return false
      }

      // Status
      if (statusFilter !== 'ALL') {
        const appStatus = String(entry.approvalStatus || 'PENDING').toUpperCase()
        if (statusFilter === 'APPROVED' && appStatus !== 'APPROVED') return false
        if (statusFilter === 'PENDING' && appStatus !== 'PENDING') return false
        if (statusFilter === 'REJECTED' && appStatus !== 'REJECTED') return false
      }

      return true
    })
  }, [rawEntries, searchTerm, deptFilter, statusFilter])

  // Reconciled Totals (All entries for selected run)
  const runTotals = useMemo(() => {
    return rawEntries.reduce(
      (acc, e) => {
        acc.basic += Number(e.basicSalary || 0)
        acc.allowances += Number(e.allowancesTotal ?? e.allowances ?? 0)
        acc.overtime += Number(e.overtimePay ?? e.overtimeAmount ?? 0)
        acc.tax += Number(e.salaryTaxWithheld ?? e.taxDeduction ?? 0)
        acc.loans += Number(e.loanDeduction ?? 0)
        acc.otherDeductions += Number(e.unpaidLeaveDeduction ?? e.otherDeductions ?? 0)
        acc.net += Number(e.netPayable ?? e.netSalary ?? 0)
        return acc
      },
      { basic: 0, allowances: 0, overtime: 0, tax: 0, loans: 0, otherDeductions: 0, net: 0 }
    )
  }, [rawEntries])

  // Filtered subset totals
  const filteredTotals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, e) => {
        acc.basic += Number(e.basicSalary || 0)
        acc.allowances += Number(e.allowancesTotal ?? e.allowances ?? 0)
        acc.overtime += Number(e.overtimePay ?? e.overtimeAmount ?? 0)
        acc.tax += Number(e.salaryTaxWithheld ?? e.taxDeduction ?? 0)
        acc.loans += Number(e.loanDeduction ?? 0)
        acc.otherDeductions += Number(e.unpaidLeaveDeduction ?? e.otherDeductions ?? 0)
        acc.net += Number(e.netPayable ?? e.netSalary ?? 0)
        return acc
      },
      { basic: 0, allowances: 0, overtime: 0, tax: 0, loans: 0, otherDeductions: 0, net: 0 }
    )
  }, [filteredEntries])

  // Bulk Run Reconciliation check
  const bulkRunNet = Number(currentRun?.netPayable ?? currentRun?.totalNet ?? 0)
  const bulkRunGross = Number(currentRun?.grossPayroll ?? currentRun?.totalGross ?? 0)
  const bulkRunHeadcount = Number(currentRun?.totalEmployees ?? 0)
  const isReconciled =
    currentRun &&
    rawEntries.length > 0 &&
    (bulkRunHeadcount === 0 || bulkRunHeadcount === rawEntries.length) &&
    Math.abs(runTotals.net - bulkRunNet) < 0.05

  // Helper to check anti-self-approval
  const isSelf = (entry) => {
    if (!currentUser) return false
    const userEmpId = currentUser.employeeId || currentUser.employee?.id || currentUser.employeeCuid
    const userEmpCode = currentUser.employeeCode || currentUser.employee?.employeeCode
    return (
      (userEmpId && (userEmpId === entry.employeeCuid || userEmpId === entry.employeeId)) ||
      (userEmpCode && (userEmpCode === entry.employeeId || userEmpCode === entry.employeeCode))
    )
  }

  const isMasterFinalized = ['APPROVED', 'DISBURSED', 'POSTED', 'VOID'].includes(
    String(currentRun?.status || '').toUpperCase()
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden text-left mt-6">
      {/* Header & Controls */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-200">
            <AppIcon name="users" className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Employee-wise Payroll Breakdown
              </h3>
              {currentRun && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {currentRun.periodName || currentRun.period || currentRun.runNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Itemized monthly earnings, statutory deductions, individual approvals, and payslips
            </p>
          </div>
        </div>

        {/* Reconciliation Status Badge */}
        {currentRun && (
          <div className="flex items-center gap-2">
            {isReconciled ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                <AppIcon name="checkCircle" className="w-4 h-4 text-emerald-600" />
                <span>Reconciled with Bulk Run: PKR {runTotals.net.toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
                <AppIcon name="alertTriangle" className="w-4 h-4 text-amber-600" />
                <span>Entries Total: PKR {runTotals.net.toLocaleString()} (Bulk: PKR {bulkRunNet.toLocaleString()})</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Month / Period Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Payroll Period
          </label>
          <select
            value={activePeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {validRuns.map((r) => (
              <option key={r.id || r.period} value={r.period || r.payrollPeriod?.periodCode || r.id}>
                {r.periodName || r.period} ({r.runNumber || r.id}) — {r.status}
              </option>
            ))}
            {validRuns.length === 0 && (
              <option value="2026-11">November 2026</option>
            )}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Search Employee
          </label>
          <div className="relative">
            <AppIcon name="search" className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by name, ID, or title..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Department
          </label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Departments ({rawEntries.length})</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Approval Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Approval States</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending Review</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Employee Name / ID</th>
              <th className="px-4 py-3 text-right">Basic Salary</th>
              <th className="px-4 py-3 text-right">Allowances</th>
              <th className="px-4 py-3 text-right">Overtime</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Loan Deduction</th>
              <th className="px-4 py-3 text-right">Other Deductions</th>
              <th className="px-4 py-3 text-right">Net Payable</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filteredEntries.map((entry) => {
              const basic = Number(entry.basicSalary || 0)
              const allowances = Number(entry.allowancesTotal ?? entry.allowances ?? 0)
              const overtime = Number(entry.overtimePay ?? entry.overtimeAmount ?? 0)
              const otHours = Number(entry.overtimeHours || 0)
              const tax = Number(entry.salaryTaxWithheld ?? entry.taxDeduction ?? 0)
              let loan = Number(entry.loanDeduction ?? 0)
              if (loan === 0) {
                try {
                  const empCode = entry.employeeId || entry.employeeCode || entry.employeeCuid
                  const activeLoanInfo = loanService.getActiveDeductionForEmployee(empCode, currentRun?.period || activePeriod)
                  if (activeLoanInfo && Number(activeLoanInfo.totalDeduction) > 0) {
                    loan = Number(activeLoanInfo.totalDeduction)
                  }
                } catch {
                  // ignore
                }
              }
              const other = Number(entry.unpaidLeaveDeduction ?? entry.otherDeductions ?? 0)
              const calculatedNet = (Number(entry.loanDeduction ?? 0) === 0 && loan > 0)
                ? Math.max(0, (basic + allowances + overtime) - (tax + loan + other))
                : Number(entry.netPayable ?? entry.netSalary ?? 0)
              const net = calculatedNet

              const isEntryApproved = String(entry.approvalStatus || '').toUpperCase() === 'APPROVED'
              const isEntryRejected = String(entry.approvalStatus || '').toUpperCase() === 'REJECTED'
              const selfBlocked = isSelf(entry)

              return (
                <tr key={entry.entryId || entry.employeeId} className="hover:bg-slate-50/80 transition-colors">
                  {/* Employee Name / ID */}
                  <td className="px-4 py-3 font-sans">
                    <div className="font-bold text-slate-900">{entry.employeeName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {entry.employeeId || entry.employeeCode}
                      {entry.designation ? ` • ${entry.designation}` : ''}
                    </div>
                    {entry.department && (
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                        {entry.department}
                      </div>
                    )}
                  </td>

                  {/* Basic Salary */}
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    PKR {basic.toLocaleString()}
                  </td>

                  {/* Allowances */}
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {allowances > 0 ? (
                      <span title={Array.isArray(entry.allowancesList) ? entry.allowancesList.map(a => `${a.name}: PKR ${a.amount}`).join(', ') : 'Allowances'}>
                        PKR {allowances.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Overtime */}
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {overtime > 0 ? (
                      <div>
                        <div>PKR {overtime.toLocaleString()}</div>
                        {otHours > 0 && <span className="text-[10px] text-slate-400">({otHours}h)</span>}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Tax */}
                  <td className="px-4 py-3 text-right font-medium text-amber-700">
                    {tax > 0 ? `PKR ${tax.toLocaleString()}` : <span className="text-slate-400">PKR 0</span>}
                  </td>

                  {/* Loan Deduction */}
                  <td className="px-4 py-3 text-right font-medium text-indigo-700">
                    {loan > 0 ? `PKR ${loan.toLocaleString()}` : <span className="text-slate-400">-</span>}
                  </td>

                  {/* Other Deductions */}
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {other > 0 ? `PKR ${other.toLocaleString()}` : <span className="text-slate-400">-</span>}
                  </td>

                  {/* Net Payable */}
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 font-sans">
                    <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                      PKR {net.toLocaleString()}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center font-sans">
                    {currentRun?.status === 'DISBURSED' || entry.paymentStatus === 'PAID' ? (
                      <StatusBadge status="PAID" />
                    ) : isEntryApproved ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <AppIcon name="check" className="w-3 h-3 text-emerald-600" />
                          <span>Approved</span>
                        </span>
                        {entry.approvedBy && (
                          <div className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[120px] mx-auto">
                            by {entry.approvedBy}
                          </div>
                        )}
                      </div>
                    ) : isEntryRejected ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <AppIcon name="xmark" className="w-3 h-3 text-rose-600" />
                          <span>Rejected</span>
                        </span>
                        {entry.rejectionReason && (
                          <div className="text-[9px] text-rose-600 mt-0.5 truncate max-w-[120px] mx-auto" title={entry.rejectionReason}>
                            {entry.rejectionReason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <AppIcon name="clock" className="w-3 h-3 text-amber-600" />
                        <span>Pending</span>
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Individual Approve Button */}
                      {canApprove && !isMasterFinalized && !isEntryApproved && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={selfBlocked}
                          onClick={() => onApproveEntry && onApproveEntry(currentRun.id, entry.entryId || entry.employeeId, entry)}
                          className="text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold cursor-pointer disabled:opacity-40"
                          title={selfBlocked ? 'Anti-Self-Approval Prohibited: You cannot approve your own payroll entry' : 'Approve individual payroll entry'}
                        >
                          <AppIcon name="check" className="w-3 h-3 mr-1" />
                          <span>Approve</span>
                        </Button>
                      )}

                      {/* View Payslip Button */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onViewPayslip && onViewPayslip(currentRun, entry)}
                        className="text-[11px] text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
                        title="View detailed payslip"
                      >
                        <AppIcon name="fileText" className="w-3 h-3 mr-1" />
                        <span>View Payslip</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-sans text-xs">
                  {rawEntries.length === 0
                    ? 'No employee payroll entries found for this period. Click "Generate Period Draft" to generate.'
                    : 'No employees match the applied filter criteria.'}
                </td>
              </tr>
            )}
          </tbody>

          {/* Table Footer: Summary Totals */}
          {filteredEntries.length > 0 && (
            <tfoot className="bg-slate-100/80 font-mono text-[11px] border-t-2 border-slate-300">
              <tr className="font-bold text-slate-900">
                <td className="px-4 py-3 font-sans">
                  Total ({filteredEntries.length} {filteredEntries.length === 1 ? 'Staff' : 'Staff Members'})
                </td>
                <td className="px-4 py-3 text-right">
                  PKR {filteredTotals.basic.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  PKR {filteredTotals.allowances.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  PKR {filteredTotals.overtime.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-amber-700">
                  PKR {filteredTotals.tax.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-indigo-700">
                  PKR {filteredTotals.loans.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  PKR {filteredTotals.otherDeductions.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-emerald-800 font-sans font-extrabold">
                  <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
                    PKR {filteredTotals.net.toLocaleString()}
                  </span>
                </td>
                <td colSpan={2} className="px-4 py-3 text-right font-sans text-[10px] text-slate-500 font-normal">
                  {isReconciled ? (
                    <span className="text-emerald-700 font-bold">✓ 100% Reconciled</span>
                  ) : (
                    <span className="text-amber-700 font-semibold">Variance: PKR {(runTotals.net - bulkRunNet).toLocaleString()}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

export default EmployeePayrollBreakdownTable