import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { reportExcelExporter } from '@/services/reportExcelExporter'
import KPICard from '@/components/common/KPICard'

export function EmployeeDirectoryTable({
  employees = [],
  departments = [],
  designations = [],
  onViewProfile,
  onEditEmployee,
  onPromoteTransfer,
  onToggleStatus,
  onAddEmployee,
  canEdit = true,
  canToggleStatus = true,
  canPromoteTransfer = true,
  title = 'Employee Management',
  subtitle = 'Centralized staff directory, organization hierarchy, profiles, and employment lifecycles'
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedDesig, setSelectedDesig] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  const safeEmployees = Array.isArray(employees) ? employees : []

  // Calculate Metrics for the 4 Top KPI Cards
  const totalHeadcount = safeEmployees.length
  const activeContracts = safeEmployees.filter((e) => (e.status || '').toLowerCase() === 'active').length
  const activePercent = totalHeadcount > 0 ? Math.round((activeContracts / totalHeadcount) * 100) : 100
  const onLeaveCount = safeEmployees.filter((e) => {
    const s = (e.status || '').toLowerCase()
    return s !== 'inactive' && s !== 'separated' && s.includes('leave')
  }).length
  const onProbationCount = safeEmployees.filter((e) => {
    const s = (e.status || '').toLowerCase()
    return s !== 'inactive' && s !== 'separated' && (s.includes('probation') || (e.employmentType || '').toLowerCase().includes('probation'))
  }).length

  // Filtered dataset
  const filtered = useMemo(() => {
    return safeEmployees.filter((emp) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matches =
          (emp.name || '').toLowerCase().includes(q) ||
          (emp.id || '').toLowerCase().includes(q) ||
          (emp.email || '').toLowerCase().includes(q) ||
          (emp.phone && emp.phone.includes(q)) ||
          (emp.designation || '').toLowerCase().includes(q) ||
          (emp.department || '').toLowerCase().includes(q)
        if (!matches) return false
      }

      if (selectedDept !== 'all' && emp.departmentId !== selectedDept && emp.department !== selectedDept) {
        return false
      }

      if (selectedDesig !== 'all' && emp.designationId !== selectedDesig && emp.designation !== selectedDesig) {
        return false
      }

      if (selectedStatus !== 'all') {
        const empStatus = (emp.status || '').toLowerCase()
        const isEmpInactive = empStatus === 'inactive' || empStatus === 'separated'
        const isEmpLeave = !isEmpInactive && empStatus.includes('leave')
        const isEmpProbation = !isEmpInactive && !isEmpLeave && (empStatus.includes('probation') || (emp.employmentType || '').toLowerCase().includes('probation'))
        const isEmpActive = !isEmpInactive && !isEmpLeave && !isEmpProbation && (empStatus === 'active' || !empStatus)

        if (selectedStatus === 'active' && !isEmpActive) return false
        if (selectedStatus === 'on leave' && !isEmpLeave) return false
        if (selectedStatus === 'probation' && !isEmpProbation) return false
        if (selectedStatus === 'inactive' && !isEmpInactive) return false
      }

      if (selectedType !== 'all') {
        const empType = (emp.employmentType || '').toLowerCase()
        if (empType !== selectedType.toLowerCase()) return false
      }

      return true
    })
  }, [employees, searchQuery, selectedDept, selectedDesig, selectedStatus, selectedType])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage, pageSize])

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // Export Directory to Styled Excel (.xlsx)
  const handleExportDirectory = async () => {
    try {
      const exportColumns = [
        { key: 'id', label: 'Employee ID', align: 'left', width: 14 },
        { key: 'name', label: 'Employee Name', align: 'left', width: 22 },
        { key: 'email', label: 'Email Address', align: 'left', width: 26 },
        { key: 'department', label: 'Department', align: 'left', width: 18 },
        { key: 'designation', label: 'Designation', align: 'left', width: 22 },
        { key: 'managerName', label: 'Reporting Manager', align: 'left', width: 20 },
        { key: 'employmentType', label: 'Employment Type', align: 'center', width: 16 },
        { key: 'joinDate', label: 'Joining Date', align: 'center', width: 14 },
        { key: 'status', label: 'Status', align: 'center', width: 12 }
      ]

      const exportRows = filtered.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        department: e.department || 'General',
        designation: e.designation || 'Staff',
        managerName: e.managerName || 'Board of Directors',
        employmentType: e.employmentType || 'Permanent',
        joinDate: e.joinDate || '2022-01-01',
        status: e.status || 'Active'
      }))

      await reportExcelExporter.downloadExcel({
        report: {
          id: 'DIR-EXP',
          name: 'Workforce Master Directory',
          familyName: 'Workforce & Organization',
          description: 'Official corporate workforce directory with active assignments and reporting lines.'
        },
        columns: exportColumns,
        rows: exportRows,
        totals: {
          name: `Total Records: ${exportRows.length}`
        },
        metadata: {
          generatedBy: 'System Administrator',
          generationDate: new Date().toISOString()
        }
      })
    } catch (err) {
      console.error('Failed to export directory as Excel:', err)
    }
  }

  return (
    <div className="space-y-3 text-left">
      {/* 1. SECTION HEADER (Matching Screenshot Exactly) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-xs text-slate-500 mt-0.5">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportDirectory}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export Directory</span>
          </button>

          {onAddEmployee && (
            <button
              type="button"
              onClick={onAddEmployee}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. FOUR KPI STAT CARDS (Compact & Sleek) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KPICard
          title="Total Headcount"
          value={totalHeadcount}
          subtitle="+12% from last month"
          icon="employees"
          color="blue"
        />
        <KPICard
          title="Active Contracts"
          value={activeContracts}
          subtitle={`${activePercent}% in good standing`}
          icon="check-circle"
          color="emerald"
        />
        <KPICard
          title="On Leave"
          value={onLeaveCount}
          subtitle="Workforce on approved leave"
          icon="calendar"
          color="amber"
        />
        <KPICard
          title="On Probation"
          value={onProbationCount}
          subtitle="Reviews due this quarter"
          icon="clock"
          color="purple"
        />
      </div>

      {/* 3. SEARCH, DROPDOWNS & STATUS PILLS BAR (IN DEDICATED WHITE CARD MATCHING SCREENSHOT) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2.5 sm:px-4 sm:py-2.5 shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between gap-3 w-full flex-wrap xl:flex-nowrap">
          {/* Left Side: Search Box + 3 Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, ID, email, designation..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-44 sm:w-52 lg:w-60 text-xs pl-7 pr-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs font-normal"
              />
              <div className="absolute left-2.5 top-2 text-slate-400 pointer-events-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Department Dropdown */}
            <div className="relative">
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value)
                  setCurrentPage(1)
                }}
                className="appearance-none text-xs font-medium pl-2.5 pr-6 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs cursor-pointer max-w-[130px] truncate"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-2 pointer-events-none text-slate-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Roles / Designation Dropdown */}
            <div className="relative">
              <select
                value={selectedDesig}
                onChange={(e) => {
                  setSelectedDesig(e.target.value)
                  setCurrentPage(1)
                }}
                className="appearance-none text-xs font-medium pl-2.5 pr-6 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs cursor-pointer max-w-[110px] truncate"
              >
                <option value="all">All Roles</option>
                {designations.map((des) => (
                  <option key={des.id} value={des.id}>
                    {des.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-2 pointer-events-none text-slate-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Types Dropdown */}
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value)
                  setCurrentPage(1)
                }}
                className="appearance-none text-xs font-medium pl-2.5 pr-6 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs cursor-pointer max-w-[105px] truncate"
              >
                <option value="all">All Types</option>
                <option value="permanent">Permanent</option>
                <option value="probation">Probation</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
              <div className="absolute right-2 top-2 pointer-events-none text-slate-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Right Side: Status Filter Pills (Matching Screenshot Exactly) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: 'all', label: `All (${safeEmployees.length})` },
              { id: 'active', label: 'Active' },
              { id: 'on leave', label: 'On Leave' },
              { id: 'probation', label: 'Probation' },
              { id: 'inactive', label: 'Inactive' }
            ].map((pill) => {
              const isActive = selectedStatus === pill.id
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(pill.id)
                    setCurrentPage(1)
                  }}
                  className={cn(
                    "px-2.5 py-0.5 text-xs rounded-full transition-colors cursor-pointer whitespace-nowrap",
                    isActive
                      ? "bg-blue-50 text-blue-600 font-bold border border-blue-200/80 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                  )}
                >
                  {pill.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Records Count Subtext */}
      <p className="text-xs text-slate-500 font-medium px-1 -mt-1">
        Showing <span className="font-bold text-slate-800">{(filtered || []).length}</span> of <span className="font-bold text-slate-800">{safeEmployees.length}</span> workforce records
      </p>

      {/* 4. WORKFORCE RECORDS TABLE (Compact, Clean, Pixel-Perfect) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-2.5 py-2 whitespace-nowrap">EMPLOYEE</th>
                <th className="px-2 py-2 whitespace-nowrap font-mono">ID</th>
                <th className="px-2.5 py-2 whitespace-nowrap">DEPARTMENT</th>
                <th className="px-2.5 py-2 whitespace-nowrap">DESIGNATION</th>
                <th className="px-2.5 py-2 whitespace-nowrap">MANAGER</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">TYPE</th>
                <th className="px-2 py-2 whitespace-nowrap font-mono">JOINED</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">STATUS</th>
                <th className="px-2.5 py-2 text-right whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(paginated || []).length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <p className="text-xs font-bold text-slate-800">No matching workforce records</p>
                      <p className="text-[11px] text-slate-500">Try adjusting your search criteria or resetting filters.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('')
                          setSelectedDept('all')
                          setSelectedDesig('all')
                          setSelectedStatus('all')
                          setSelectedType('all')
                          setCurrentPage(1)
                        }}
                        className="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((emp) => {
                  const statusLower = (emp.status || '').toLowerCase()
                  const isInactive = statusLower === 'inactive' || statusLower === 'separated'
                  const isOnLeave = !isInactive && statusLower.includes('leave')
                  const isProbation = !isInactive && !isOnLeave && (statusLower.includes('probation') || (emp.employmentType || '').toLowerCase().includes('probation'))
                  const isActive = !isInactive && !isOnLeave && !isProbation && (statusLower === 'active' || !statusLower)

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* EMPLOYEE (Clean Name & Email without Avatar Circle) */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => onViewProfile && onViewProfile(emp)}
                            className="font-bold text-slate-900 text-xs hover:text-blue-600 text-left transition-colors leading-tight"
                          >
                            {emp.name}
                          </button>
                          <span className="text-[10px] text-slate-400 font-normal leading-tight">
                            {emp.email}
                          </span>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500 font-medium whitespace-nowrap">
                        {emp.id}
                      </td>

                      {/* DEPARTMENT */}
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-slate-800 whitespace-nowrap max-w-[150px] truncate">
                        {emp.department}
                      </td>

                      {/* DESIGNATION */}
                      <td className="px-2.5 py-1.5 text-xs text-slate-600 whitespace-nowrap max-w-[170px] truncate">
                        {emp.designation}
                      </td>

                      {/* MANAGER */}
                      <td className="px-2.5 py-1.5 text-xs text-slate-600 whitespace-nowrap max-w-[140px] truncate">
                        {emp.managerName || 'Board of Directors'}
                      </td>

                      {/* TYPE */}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-200 bg-white text-slate-600">
                          {isProbation ? 'Probation' : (emp.employmentType || 'Permanent')}
                        </span>
                      </td>

                      {/* JOINED */}
                      <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {emp.joinDate || '2022-01-15'}
                      </td>

                      {/* STATUS (Clean Compact Pill without Overflow) */}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        {isInactive && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canToggleStatus && onToggleStatus) onToggleStatus(emp)
                            }}
                            title={canToggleStatus ? "Click to set Active" : undefined}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 leading-tight",
                              canToggleStatus && "cursor-pointer hover:bg-rose-100 hover:border-rose-300 transition-colors"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Inactive</span>
                          </button>
                        )}
                        {isActive && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canToggleStatus && onToggleStatus) onToggleStatus(emp)
                            }}
                            title={canToggleStatus ? "Click to set Inactive" : undefined}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 leading-tight",
                              canToggleStatus && "cursor-pointer hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </button>
                        )}
                        {isOnLeave && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200/60 leading-tight">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span>On Leave</span>
                          </span>
                        )}
                        {isProbation && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 leading-tight">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                            <span>Probation</span>
                          </span>
                        )}
                        {!isInactive && !isActive && !isOnLeave && !isProbation && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80 leading-tight">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>{emp.status === 'Separated' ? 'Inactive' : emp.status}</span>
                          </span>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 text-slate-400">
                          {/* View Profile */}
                          <button
                            type="button"
                            onClick={() => onViewProfile && onViewProfile(emp)}
                            title="View Employee Profile"
                            className="p-0.5 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {/* Edit Details */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onEditEmployee && onEditEmployee(emp)}
                              title="Edit Employee Information"
                              className="p-0.5 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}

                          {/* Promote / Transfer */}
                          {canPromoteTransfer && !isInactive && (
                            <button
                              type="button"
                              onClick={() => onPromoteTransfer && onPromoteTransfer(emp)}
                              title="Promote or Transfer Employee"
                              className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </button>
                          )}

                          {/* Deactivate / Manage Status */}
                          {canToggleStatus && (
                            <button
                              type="button"
                              onClick={() => onToggleStatus && onToggleStatus(emp)}
                              title={isInactive ? "Click to activate employee" : "Click to deactivate employee"}
                              className={cn(
                                "p-0.5 transition-colors cursor-pointer",
                                isInactive ? "hover:text-emerald-600 text-slate-400" : "hover:text-rose-600 text-slate-400"
                              )}
                            >
                              {isInactive ? (
                                <svg className="w-3.5 h-3.5 text-rose-500 hover:text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5 text-emerald-600 hover:text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-2 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{(filtered || []).length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-semibold text-slate-800">{Math.min(currentPage * pageSize, (filtered || []).length)}</span> of{' '}
            <span className="font-semibold text-slate-800">{(filtered || []).length}</span> staff entries
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePageChange(p)}
                    className={cn(
                      "w-6 h-6 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer",
                      currentPage === p
                        ? "bg-blue-600 text-white shadow-xs font-bold"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmployeeDirectoryTable
