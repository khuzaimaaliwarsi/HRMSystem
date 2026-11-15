import React, { useState, useMemo } from 'react'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import { cn } from '@/lib/utils'
import { leavePolicyService } from '@/services/leavePolicyService'

export function LeaveBalanceTable({
  balances = [],
  ledger = [],
  employeeName = '',
  employeeId = '',
  showAllEmployees = false,
  canAdjust = false,
  onOpenAdjustment,
  onOpenAdjustModal
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')

  const rawList = useMemo(() => {
    return balances && balances.length > 0 ? balances : (Array.isArray(ledger) ? ledger : [])
  }, [balances, ledger])

  // Resolve human-readable name using actual Leave Type master, keeping duplicates distinguishable
  const resolveDisplayName = useMemo(() => {
    const masterTypes = leavePolicyService?.getAllLeaveTypes?.() || []

    const typeMap = new Map()
    masterTypes.forEach((mt) => {
      if (mt.id) {
        typeMap.set(mt.id, {
          id: mt.id,
          name: mt.name || 'Ops Leave',
          code: mt.code || 'LV'
        })
      }
    })

    rawList.forEach((r) => {
      if (r.leaveTypeId && !typeMap.has(r.leaveTypeId)) {
        const found = masterTypes.find((mt) => mt.id === r.leaveTypeId || mt.code === r.leaveTypeCode)
        const nameCandidate = found?.name || (r.leaveTypeName && !r.leaveTypeName.startsWith('cmw') ? r.leaveTypeName : 'Ops Leave')
        typeMap.set(r.leaveTypeId, {
          id: r.leaveTypeId,
          name: nameCandidate,
          code: found?.code || r.leaveTypeCode || 'LV'
        })
      }
    })

    const nameGroups = new Map()
    typeMap.forEach((type, id) => {
      let baseName = type.name || 'Ops Leave'
      if (baseName.startsWith('cmw')) baseName = 'Ops Leave'
      if (!nameGroups.has(baseName)) nameGroups.set(baseName, [])
      nameGroups.get(baseName).push({ id, ...type, baseName })
    })

    return (leaveTypeId, fallbackName = '', fallbackCode = '') => {
      if (!leaveTypeId) return fallbackName || 'Leave'
      const type = typeMap.get(leaveTypeId)
      let baseName = type?.name || fallbackName
      if (!baseName || baseName.startsWith('cmw')) baseName = 'Ops Leave'

      const group = nameGroups.get(baseName) || []
      if (group.length > 1) {
        const idx = group.findIndex((g) => g.id === leaveTypeId)
        if (idx !== -1) {
          return `${baseName} (Slot ${idx + 1})`
        }
        const code = type?.code || fallbackCode
        if (code && code !== 'LV') {
          return `${baseName} (${code})`
        }
        return `${baseName} (#${leaveTypeId.slice(-4)})`
      }
      return baseName
    }
  }, [rawList])

  const uniqueTypes = useMemo(() => {
    const map = new Map()
    rawList.forEach((r) => {
      if (r.leaveTypeId && !map.has(r.leaveTypeId)) {
        const displayName = resolveDisplayName(r.leaveTypeId, r.leaveTypeName, r.leaveTypeCode)
        map.set(r.leaveTypeId, displayName)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [rawList, resolveDisplayName])

  const filteredList = useMemo(() => {
    let list = rawList
    if (showAllEmployees && searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      list = list.filter((r) => {
        const typeDisplay = resolveDisplayName(r.leaveTypeId, r.leaveTypeName, r.leaveTypeCode).toLowerCase()
        return (
          (r.employeeName && r.employeeName.toLowerCase().includes(q)) ||
          (r.employeeId && r.employeeId.toLowerCase().includes(q)) ||
          (r.department && r.department.toLowerCase().includes(q)) ||
          typeDisplay.includes(q)
        )
      })
    }
    if (selectedType !== 'all') {
      list = list.filter((r) => r.leaveTypeId === selectedType || r.leaveTypeCode === selectedType)
    }
    return list
  }, [rawList, showAllEmployees, searchTerm, selectedType, resolveDisplayName])

  const handleOpenAdjust = onOpenAdjustModal || onOpenAdjustment

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden text-left">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200">
            <AppIcon name="banking" className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Leave Entitlement &amp; Balance Ledger
            </h3>
            <p className="text-xs text-slate-500">
              {employeeName
                ? `${employeeName} (${employeeId})`
                : showAllEmployees
                ? `Organization Register (${rawList.length} total balance records)`
                : 'Comprehensive balances across all registered leave categories'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showAllEmployees && (
            <>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search employee / type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Leave Types</option>
                {uniqueTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {canAdjust && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenAdjust}
              className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
            >
              <AppIcon name="plus" className="w-3.5 h-3.5" />
              <span>Manual Balance Adjustment</span>
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
            <tr>
              {showAllEmployees && <th className="px-4 py-3">Employee</th>}
              <th className="px-4 py-3">Leave Category</th>
              <th className="px-4 py-3">Treatment</th>
              <th className="px-4 py-3 text-right">Opening</th>
              <th className="px-4 py-3 text-right text-blue-700">Allocated</th>
              <th className="px-4 py-3 text-right">Accrued</th>
              <th className="px-4 py-3 text-right">Adjustments</th>
              <th className="px-4 py-3 text-right">Utilized</th>
              <th className="px-4 py-3 text-right">Pending</th>
              <th className="px-4 py-3 text-right">Closing</th>
              <th className="px-4 py-3 text-right">Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filteredList.map((row) => (
              <tr key={row.id || `${row.employeeId}-${row.leaveTypeId}`} className="hover:bg-slate-50/80 transition-colors">
                {/* Employee Info if organization view */}
                {showAllEmployees && (
                  <td className="px-4 py-3 font-sans">
                    <div className="font-bold text-slate-900">{row.employeeName || row.employeeId}</div>
                    <div className="text-[10px] text-slate-400">{row.department || row.employeeId}</div>
                  </td>
                )}

                {/* Leave Category */}
                <td className="px-4 py-3 font-sans">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color || '#2563EB' }} />
                    <span className="font-bold text-slate-900">{resolveDisplayName(row.leaveTypeId, row.leaveTypeName, row.leaveTypeCode)}</span>
                    <span className="text-[10px] text-slate-400">({row.leaveTypeCode || 'LV'})</span>
                  </div>
                </td>

                {/* Treatment */}
                <td className="px-4 py-3 font-sans">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                    row.paidTreatment === 'Paid'
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  )}>
                    {row.paidTreatment || 'Paid'}
                  </span>
                </td>

                {/* Opening */}
                <td className="px-4 py-3 text-right font-medium text-slate-700">
                  {row.openingBalance ?? 0}d
                </td>

                {/* Allocated */}
                <td className="px-4 py-3 text-right font-bold text-blue-700">
                  {row.allocatedDays ?? row.allocated ?? 0}d
                </td>

                {/* Accrued */}
                <td className="px-4 py-3 text-right text-slate-600">
                  +{(row.earnedAccrued ?? 0)}d
                </td>

                {/* Adjustments */}
                <td className="px-4 py-3 text-right">
                  <span className={cn(
                    "font-medium",
                    (row.adjustments || 0) > 0 ? "text-emerald-600" : (row.adjustments || 0) < 0 ? "text-rose-600" : "text-slate-400"
                  )}>
                    {(row.adjustments || 0) > 0 ? `+${row.adjustments}` : row.adjustments || 0}d
                  </span>
                </td>

                {/* Utilized */}
                <td className="px-4 py-3 text-right font-bold text-slate-800">
                  {row.utilized || 0}d
                </td>

                {/* Pending */}
                <td className="px-4 py-3 text-right font-medium text-amber-600">
                  {row.pending || 0}d
                </td>

                {/* Closing */}
                <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                  {row.closingBalance ?? 0}d
                </td>

                {/* Available */}
                <td className="px-4 py-3 text-right font-sans">
                  <span className="inline-block px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-extrabold border border-blue-200 text-xs">
                    {row.availableBalance ?? 0}d
                  </span>
                </td>
              </tr>
            ))}

            {filteredList.length === 0 && (
              <tr>
                <td colSpan={showAllEmployees ? 11 : 10} className="px-4 py-10 text-center text-slate-400 font-sans text-xs">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <AppIcon name="banking" className="w-5 h-5 text-slate-300 mb-1" />
                    <span className="font-semibold text-slate-600">No balance records matching criteria</span>
                    <span className="text-[11px] text-slate-400">Ledger entries are initialized on demand</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ledger Accounting Footnote */}
      <div className="px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5 font-medium">
          <AppIcon name="info" className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Accounting Formula: <strong>Closing Balance = Opening + Allocated + Accrued + Adjustments − Utilized</strong></span>
        </span>
        <span className="text-slate-500 font-medium">Available Balance = Closing Balance − Pending</span>
      </div>
    </div>
  )
}

export default LeaveBalanceTable
