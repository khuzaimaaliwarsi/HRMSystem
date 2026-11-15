import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function RecentActivityTable({
  title = 'Recent Employees & Activity',
  subtitle = 'Overview of staff records, active designations, and real-time attendance statuses',
  staff = [],
  viewAllLink = '/super-admin/employees',
  className = ''
}) {
  const [filterTab, setFilterTab] = useState('all')

  // Derive staff strictly from passed props. Never inject fake or hardcoded demo employees.
  const allStaff = useMemo(() => {
    return Array.isArray(staff) ? staff : []
  }, [staff])

  // Deterministic categorizers matching Image 1
  const isLeave = (emp) => {
    const st = (emp?.status || emp?.employmentStatus || '').toLowerCase()
    const att = (emp?.attendanceToday || '').toLowerCase()
    return st.includes('leave') || att.includes('leave')
  }

  const isProbation = (emp) => {
    const st = (emp?.status || emp?.employmentStatus || '').toLowerCase()
    const type = (emp?.employmentType || '').toLowerCase()
    return st === 'probation' || type === 'probation'
  }

  const isInactive = (emp) => {
    const st = (emp?.status || emp?.employmentStatus || '').toLowerCase()
    return st === 'inactive' || st === 'suspended' || st === 'terminated' || st === 'separated'
  }

  const isActive = (emp) => {
    const st = (emp?.status || emp?.employmentStatus || '').toLowerCase()
    return st === 'active' && !isLeave(emp) && !isProbation(emp)
  }

  // Pre-filter entire pool into lists
  const activeStaff = useMemo(() => allStaff.filter((e) => (e?.status || e?.employmentStatus || '').toLowerCase() === 'active'), [allStaff])
  const inactiveStaff = useMemo(() => allStaff.filter(isInactive), [allStaff])
  const leaveStaff = useMemo(() => allStaff.filter(isLeave), [allStaff])
  const probationStaff = useMemo(() => allStaff.filter(isProbation), [allStaff])

  // Filtered records matching tab
  const displayRecords = useMemo(() => {
    if (filterTab === 'active') {
      return activeStaff
    }
    if (filterTab === 'inactive') {
      return inactiveStaff
    }
    if (filterTab === 'leave') {
      return leaveStaff
    }
    if (filterTab === 'probation') {
      return probationStaff
    }
    return allStaff
  }, [filterTab, allStaff, activeStaff, inactiveStaff, leaveStaff, probationStaff])

  // Count badges for tabs matching user requirements
  const activeCountLabel = activeStaff.length
  const inactiveCountLabel = inactiveStaff.length
  const leaveCountLabel = leaveStaff.length
  const probationCountLabel = probationStaff.length

  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden text-left transition-all hover:shadow-xs", className)}>
      {/* Table Header & Filter Tabs matching screenshot */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="shrink-0">
          <h4 className="text-[13px] font-bold text-slate-900 tracking-tight">
            {title}
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer focus:outline-none",
                filterTab === 'all'
                  ? "bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              All Staff
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('active')}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer focus:outline-none",
                filterTab === 'active'
                  ? "bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              Active ({activeCountLabel})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('inactive')}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer focus:outline-none",
                filterTab === 'inactive'
                  ? "bg-rose-50 text-rose-700 border-rose-300 font-bold shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              Inactive ({inactiveCountLabel})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('leave')}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer focus:outline-none",
                filterTab === 'leave'
                  ? "bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              On Leave ({leaveCountLabel})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('probation')}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer focus:outline-none",
                filterTab === 'probation'
                  ? "bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              Probation ({probationCountLabel})
            </button>
          </div>

          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0 ml-1"
            >
              <span>View All Directory</span>
              <span className="text-sm leading-none">→</span>
            </Link>
          )}
        </div>
      </div>

      {/* Responsive Table Body matching screenshot exactly */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <th className="px-5 py-3 whitespace-nowrap">EMPLOYEE</th>
              <th className="px-4 py-3 whitespace-nowrap">ID</th>
              <th className="px-4 py-3 whitespace-nowrap">DEPARTMENT</th>
              <th className="px-4 py-3 whitespace-nowrap">DESIGNATION</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">TYPE</th>
              <th className="px-5 py-3 text-right whitespace-nowrap">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayRecords.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-400 text-xs">
                  No employee records found in this category.
                </td>
              </tr>
            ) : (
              displayRecords.map((emp) => {
                const onLeave = isLeave(emp)
                const onProbation = isProbation(emp)

                return (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Employee Name & Email without Avatar Circle */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-xs">
                          {emp.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {emp.email}
                        </span>
                      </div>
                    </td>

                    {/* ID */}
                    <td className="px-4 py-3.5 font-mono text-slate-500 text-xs whitespace-nowrap">
                      {emp.id}
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      {emp.department}
                    </td>

                    {/* Designation */}
                    <td className="px-4 py-3.5 text-slate-500 font-medium whitespace-nowrap">
                      {emp.designation}
                    </td>

                    {/* Type Badge */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className="inline-block px-3 py-0.5 rounded-full text-[10.5px] font-medium border border-slate-200 bg-white text-slate-600 shadow-2xs whitespace-nowrap">
                        {emp.employmentType || 'Permanent'}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {isInactive(emp) ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Inactive
                        </span>
                      ) : onLeave ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          On Leave
                        </span>
                      ) : onProbation ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Probation
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RecentActivityTable

