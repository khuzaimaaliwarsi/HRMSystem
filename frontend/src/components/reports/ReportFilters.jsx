import React, { useMemo } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function ReportFilters({
  departments = [],
  teams = [],
  employees = [],
  filters,
  onChange,
  onReset
}) {
  const currentDeptTeams = useMemo(() => {
    return filters.departmentId && filters.departmentId !== 'all'
      ? teams.filter((t) => t.departmentId === filters.departmentId)
      : teams
  }, [teams, filters.departmentId])

  const availableEmployees = useMemo(() => {
    let list = Array.isArray(employees) ? employees : []

    // 1. Filter by Status (Default is 'active')
    const statusFilter = (filters.status || 'active').toLowerCase()
    if (statusFilter === 'active') {
      list = list.filter((e) => {
        const s = (e.status || e.employmentStatus || '').toLowerCase()
        return s === 'active' || (!s.includes('inactive') && !s.includes('suspended') && !s.includes('terminated') && !s.includes('separated'))
      })
    } else if (statusFilter === 'inactive') {
      list = list.filter((e) => {
        const s = (e.status || e.employmentStatus || '').toLowerCase()
        return s === 'inactive' || s === 'suspended' || s === 'terminated' || s === 'separated'
      })
    }

    // 2. Filter by Department
    if (filters.departmentId && filters.departmentId !== 'all') {
      list = list.filter((e) =>
        e.departmentId === filters.departmentId ||
        e.department === filters.departmentName ||
        e.department === filters.departmentId
      )
    }

    // 3. Filter by Team
    if (filters.teamId && filters.teamId !== 'all') {
      list = list.filter((e) =>
        e.teamId === filters.teamId ||
        e.team === filters.teamName ||
        e.team === filters.teamId
      )
    }

    return list
  }, [employees, filters.status, filters.departmentId, filters.departmentName, filters.teamId, filters.teamName])

  const handleDepartmentChange = (deptId) => {
    const deptObj = departments.find((d) => d.id === deptId)
    const newDeptName = deptObj ? deptObj.name : 'All Departments'

    let newEmployeeId = filters.employeeId
    let newEmployeeName = filters.employeeName
    if (deptId !== 'all' && newEmployeeId !== 'all') {
      const empInDept = employees.find((e) =>
        e.id === newEmployeeId && (e.departmentId === deptId || e.department === newDeptName)
      )
      if (!empInDept) {
        newEmployeeId = 'all'
        newEmployeeName = 'All Permitted'
      }
    }

    onChange({
      ...filters,
      departmentId: deptId,
      departmentName: newDeptName,
      teamId: 'all',
      teamName: 'All Teams',
      employeeId: newEmployeeId,
      employeeName: newEmployeeName
    })
  }

  const handleStatusChange = (newStatus) => {
    let newEmployeeId = filters.employeeId
    let newEmployeeName = filters.employeeName
    if (newEmployeeId !== 'all') {
      const emp = employees.find((e) => e.id === newEmployeeId)
      if (emp) {
        const s = (emp.status || emp.employmentStatus || '').toLowerCase()
        const isAct = s === 'active' || (!s.includes('inactive') && !s.includes('suspended') && !s.includes('terminated'))
        if ((newStatus === 'active' && !isAct) || (newStatus === 'inactive' && isAct)) {
          newEmployeeId = 'all'
          newEmployeeName = 'All Permitted'
        }
      }
    }

    onChange({
      ...filters,
      status: newStatus,
      employeeId: newEmployeeId,
      employeeName: newEmployeeName
    })
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-2xs mb-4">
      {/* Sleek Single-Line Professional Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-xs w-full">
        {/* Filter Label Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100/90 rounded-lg text-slate-700 font-bold text-[11px] uppercase tracking-wider shrink-0 border border-slate-200/60">
          <AppIcon icon="filter" className="text-blue-600 text-xs" />
          <span>Filters:</span>
        </div>

        {/* Period Dropdown */}
        <div className="flex items-center shrink-0">
          <select
            aria-label="Reporting Period"
            value={filters.datePreset || 'thisMonth'}
            onChange={(e) => onChange({ ...filters, datePreset: e.target.value })}
            className="h-8 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
          >
            <option value="thisMonth">Period: This Month</option>
            <option value="today">Period: Today</option>
            <option value="prevMonth">Period: Prev Month</option>
            <option value="thisYear">Period: This Year</option>
            <option value="all">Period: All Dates</option>
          </select>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center shrink-0">
          <select
            aria-label="Employment Status"
            value={filters.status || 'active'}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-8 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
          >
            <option value="active">Status: Active Staff</option>
            <option value="all">Status: All Staff (Inc. Inactive)</option>
            <option value="inactive">Status: Inactive Staff</option>
          </select>
        </div>

        {/* Department Dropdown */}
        <div className="flex items-center shrink-0">
          <select
            aria-label="Department"
            value={filters.departmentId || 'all'}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            className="h-8 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg font-medium text-slate-800 max-w-[200px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
          >
            <option value="all">Dept: All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>Dept: {d.name}</option>
            ))}
          </select>
        </div>

        {/* Team Dropdown */}
        <div className="flex items-center shrink-0">
          <select
            aria-label="Team"
            value={filters.teamId || 'all'}
            onChange={(e) => {
              const tId = e.target.value
              const tObj = teams.find((t) => t.id === tId)
              onChange({
                ...filters,
                teamId: tId,
                teamName: tObj ? tObj.name : 'All Teams'
              })
            }}
            className="h-8 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg font-medium text-slate-800 max-w-[170px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
          >
            <option value="all">Team: All Teams</option>
            {currentDeptTeams.map((t) => (
              <option key={t.id} value={t.id}>Team: {t.name}</option>
            ))}
          </select>
        </div>

        {/* Employee Scope Dropdown */}
        <div className="flex items-center shrink-0">
          <select
            aria-label="Employee Scope"
            value={filters.employeeId || 'all'}
            onChange={(e) => {
              const empId = e.target.value
              const empObj = availableEmployees.find((emp) => emp.id === empId)
              onChange({
                ...filters,
                employeeId: empId,
                employeeName: empObj ? `${empObj.name} (${empObj.id})` : 'All Authorized'
              })
            }}
            className="h-8 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg font-medium text-slate-800 max-w-[220px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
          >
            <option value="all">Staff: All Permitted ({availableEmployees.length})</option>
            {availableEmployees.map((emp) => {
              const s = (emp.status || emp.employmentStatus || '').toLowerCase()
              const isInactive = s === 'inactive' || s === 'suspended' || s === 'terminated' || s === 'separated'
              return (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id || emp.employeeCode}){isInactive ? ' [Inactive]' : ''}
                </option>
              )
            })}
          </select>
        </div>

        {/* Search Keyword */}
        <div className="relative flex-1 min-w-[140px] max-w-[200px]">
          <input
            type="text"
            placeholder="Search rows..."
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full text-xs h-8 pl-7 pr-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          <AppIcon icon="search" className="absolute left-2.5 top-2.5 text-slate-400 text-[11px]" />
        </div>

        {/* Reset Action Button */}
        <button
          type="button"
          onClick={onReset}
          title="Reset all filters to defaults"
          className="h-8 px-3 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ml-auto cursor-pointer"
        >
          <AppIcon icon="undo" className="text-[10px]" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  )
}

