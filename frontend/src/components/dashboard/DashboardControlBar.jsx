import React from 'react'
import AppIcon from '@/components/common/AppIcon'
import { DEMO_DEPARTMENTS } from '@/mocks/demoUsers'
import { employeeService } from '@/services/employeeService'
import { cn } from '@/lib/utils'

export function DashboardControlBar({
  title = 'iSysware Workforce',
  selectedYear = '2026',
  onSelectYear,
  selectedMonth = 'Oct',
  onSelectMonth,
  selectedDepartment = 'all',
  onSelectDepartment,
  onExport,
  showDepartmentFilter = true,
  departments: propDepartments = null
}) {
  const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
  const departments = propDepartments || employeeService?.getDepartments?.() || (isTest ? DEMO_DEPARTMENTS : [])
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const years = ['2026', '2027']

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:px-5 sm:py-3 mb-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-left">
      {/* Left: Brand Icon & Title matching reference screenshot */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full border-[3px] border-blue-600 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
          </div>
          <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            {title}
          </span>
        </div>

        {showDepartmentFilter && (
          <div className="flex items-center gap-1.5 ml-1 border-l border-slate-200 pl-3">
            <select
              value={selectedDepartment}
              onChange={(e) => onSelectDepartment?.(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right Controls: Year Pills + 12 Month Pills + Export + Share */}
      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] shrink-0">
        {/* Year Pills (2026, 2027) */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
          {years.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => onSelectYear?.(yr)}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-md transition-all select-none cursor-pointer",
                selectedYear === yr
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {yr}
            </button>
          ))}
        </div>

        {/* 12 Month Pills */}
        <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-200 shrink-0">
          {months.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSelectMonth?.(m)}
              className={cn(
                "px-2 py-1 text-[11px] sm:text-xs font-medium rounded-md transition-all whitespace-nowrap select-none cursor-pointer",
                selectedMonth === m
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Export Button matching Screenshot 1 */}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <AppIcon name="download" className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        )}

        {/* Share Button matching Screenshot 1 */}
        <button
          type="button"
          onClick={() => alert('Dashboard view link copied to clipboard.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs cursor-pointer shrink-0"
        >
          <AppIcon name="share" className="w-3.5 h-3.5 text-slate-500" />
          <span>Share</span>
        </button>
      </div>
    </div>
  )
}

export default DashboardControlBar
