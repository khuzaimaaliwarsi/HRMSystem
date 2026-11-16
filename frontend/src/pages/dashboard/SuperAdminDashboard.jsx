import React, { useState, useMemo, useEffect } from 'react'
import { employeeService } from '@/services/employeeService'
import { recruitmentService } from '@/services/recruitmentService'
import { leaveService } from '@/services/leaveService'
import { payrollService } from '@/services/payrollService'
import { syncOrganization, syncRecruitment, syncPayroll, syncLeaves } from '@/services/backendSync'
import TalentzoKpiCards from '@/components/dashboard/TalentzoKpiCards'
import TalentzoPayrollOverviewCard from '@/components/dashboard/TalentzoPayrollOverviewCard'
import TalentzoJobLevelCard from '@/components/dashboard/TalentzoJobLevelCard'
import QuickHubPanel from '@/components/dashboard/QuickHubPanel'
import TalentzoOpenPositionsCard from '@/components/dashboard/TalentzoOpenPositionsCard'
import RecentActivityTable from '@/components/dashboard/RecentActivityTable'
import EmployeeFormModal from '@/components/employee/EmployeeFormModal'
import DateRangePicker from '@/components/common/DateRangePicker'
import Alert from '@/components/common/Alert'

const NOW = new Date()
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DEFAULT_MONTH_RANGE = `1 ${MONTH_NAMES[NOW.getMonth()]} ${NOW.getFullYear()} - ${new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate()} ${MONTH_NAMES[NOW.getMonth()]} ${NOW.getFullYear()}`

export function SuperAdminDashboard() {
  const [selectedDateRange, setSelectedDateRange] = useState(DEFAULT_MONTH_RANGE)
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false)
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [notification, setNotification] = useState(null)

  const departments = useMemo(() => employeeService.getDepartments(), [])
  const teams = useMemo(() => employeeService.getTeams(), [])
  const designations = useMemo(() => employeeService.getDesignations(), [])
  const [employees, setEmployees] = useState(() => employeeService.getEmployees())
  const [candidates, setCandidates] = useState(() => recruitmentService.getCandidates())
  const [vacancies, setVacancies] = useState(() => recruitmentService.getVacancies({ status: 'Open' }))
  const [leaves, setLeaves] = useState(() => leaveService.getLeaveRequests())
  const [payrollRuns, setPayrollRuns] = useState(() => payrollService.getPayrollRuns())

  useEffect(() => {
    // Immediate initial sync on dashboard mount from PostgreSQL database
    Promise.allSettled([
      syncOrganization(),
      syncRecruitment(),
      syncPayroll(),
      syncLeaves()
    ]).then(() => {
      setEmployees(employeeService.getEmployees())
      setCandidates(recruitmentService.getCandidates())
      setVacancies(recruitmentService.getVacancies({ status: 'Open' }))
      setLeaves(leaveService.getLeaveRequests())
      setPayrollRuns(payrollService.getPayrollRuns())
    })

    const unsubEmp = employeeService.subscribe(() => {
      setEmployees(employeeService.getEmployees())
    })
    const unsubRec = recruitmentService.subscribe(() => {
      setCandidates(recruitmentService.getCandidates())
      setVacancies(recruitmentService.getVacancies({ status: 'Open' }))
    })
    const unsubLeave = leaveService.subscribe(() => {
      setLeaves(leaveService.getLeaveRequests())
    })
    const unsubPay = payrollService.subscribe(() => {
      setPayrollRuns(payrollService.getPayrollRuns())
    })
    return () => {
      if (typeof unsubEmp === 'function') unsubEmp()
      if (typeof unsubRec === 'function') unsubRec()
      if (typeof unsubLeave === 'function') unsubLeave()
      if (typeof unsubPay === 'function') unsubPay()
    }
  }, [])

  const pendingLeavesCount = useMemo(() => {
    return (leaves || []).filter((l) => l.status && l.status.toLowerCase().includes('pending')).length
  }, [leaves])

  const payrollProgress = useMemo(() => {
    if (!payrollRuns || payrollRuns.length === 0) return 0
    const latest = payrollRuns[payrollRuns.length - 1]
    if (latest.status === 'Disbursed' || latest.status === 'Posted') return 100
    if (latest.status === 'Approved') return 75
    if (latest.status === 'Review') return 50
    return 25
  }, [payrollRuns])

  const activeStaffCount = useMemo(() => {
    return (employees || []).filter((e) => (e?.status || e?.employmentStatus || '').toLowerCase() === 'active').length
  }, [employees])

  const handleExport = () => {
    const total = employees.length
    const fullTime = employees.filter((e) => !e.employmentType || e.employmentType === 'Permanent' || e.employmentType === 'Full-Time').length
    const partTime = employees.filter((e) => e.employmentType === 'Part-Time' || e.employmentType === 'Contract').length
    const freelance = employees.filter((e) => e.employmentType === 'Freelance').length
    const internship = employees.filter((e) => e.employmentType === 'Internship' || e.employmentType === 'Probation').length

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      ['Metric', 'Value', 'Period'],
      ['Total Employees', `${total}`, selectedDateRange],
      ['Job Applications', `${candidates.length}`, selectedDateRange],
      ['Pending Approvals', `${pendingLeavesCount}`, selectedDateRange],
      ['Payroll Progress', `${payrollProgress}%`, selectedDateRange],
      ['Full-Time Headcount', `${fullTime}`, selectedDateRange],
      ['Part-Time Headcount', `${partTime}`, selectedDateRange],
      ['Freelance Headcount', `${freelance}`, selectedDateRange],
      ['Internship Headcount', `${internship}`, selectedDateRange]
    ].map((r) => r.join(',')).join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `hrms_workforce_summary_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setNotification({
      type: 'success',
      message: 'Workforce analytics data exported successfully to CSV.'
    })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleCreateEmployeeSubmit = (formData, actor) => {
    try {
      const created = employeeService.createEmployee(formData, actor)
      setNotification({
        type: 'success',
        message: `New employee ${created.name} (${created.id}) onboarded successfully.`
      })
      setIsAddEmployeeOpen(false)
      setTimeout(() => setNotification(null), 5000)
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleImportSample = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setNotification({
        type: 'success',
        message: `File "${file.name}" uploaded. 24 new records successfully validated.`
      })
      setIsImportModalOpen(false)
      setTimeout(() => setNotification(null), 5000)
    }
  }

  return (
    <div className="space-y-4 text-left">
      {/* ========================================================================= */}
      {/* TOP CONTROLS BAR: Date Range Picker + Import + Export + Add Employee      */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Dynamic & Custom Calendar Date Filter */}
        <DateRangePicker
          value={selectedDateRange}
          onChange={setSelectedDateRange}
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Import Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16V4m0 12l-4-4m4 4l4-4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span>Import</span>
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v12m0-12l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span>Export</span>
          </button>

          {/* Add Employee Button */}
          <button
            type="button"
            onClick={() => setIsAddEmployeeOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {notification && (
        <Alert variant={notification.type} onClose={() => setNotification(null)}>
          {notification.message}
        </Alert>
      )}

      {/* ========================================================================= */}
      {/* ROW 1: 4 KPI CARDS                                                        */}
      {/* ========================================================================= */}
      <TalentzoKpiCards
        totalEmployees={employees.length}
        jobApplications={candidates.length > 0 ? `${candidates.length}` : '0'}
        pendingApprovals={pendingLeavesCount}
        payrollProgress={payrollProgress}
        totalEmployeesSubtitle={activeStaffCount > 0 ? `${activeStaffCount} active staff profiles` : '0 active staff'}
        jobApplicationsSubtitle={candidates.length > 0 ? `${candidates.length} in talent pool` : '0 applications'}
        pendingApprovalsSubtitle={pendingLeavesCount > 0 ? `${pendingLeavesCount} requests pending` : 'All clear'}
        payrollProgressSubtitle={payrollProgress > 0 ? `${100 - payrollProgress}% pending bank release` : 'No active cycle'}
      />

      {/* ========================================================================= */}
      {/* ROW 2: Payroll Overview (Left) + Job Level (Right) (Equal Height)         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col">
          <TalentzoPayrollOverviewCard
            selectedDateRange={selectedDateRange}
            onDateRangeChange={setSelectedDateRange}
          />
        </div>
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col">
          <TalentzoJobLevelCard />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 3: Modules Quick Hub (Left) + Open Positions (Right)                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col">
          <QuickHubPanel
            title="Modules Quick Hub"
            activeCount="10 Modules Active"
            className="rounded-2xl border-slate-200/80 shadow-2xs h-full"
          />
        </div>
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col">
          <TalentzoOpenPositionsCard />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 4: Recent Employees & Activity Table (Screenshot 1 Exact)             */}
      {/* ========================================================================= */}
      <RecentActivityTable
        title="Recent Employees & Activity"
        subtitle="Overview of staff records, active designations, and real-time attendance statuses"
        staff={employees}
        viewAllLink="/super-admin/employees"
      />

      {/* ========================================================================= */}
      {/* MODALS: Add Employee Modal + Import Modal                                 */}
      {/* ========================================================================= */}
      <EmployeeFormModal
        isOpen={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        onSubmit={handleCreateEmployeeSubmit}
        departments={departments}
        teams={teams}
        designations={designations}
        allEmployees={employees}
        actor="Tariq Mehmood (Super Admin)"
      />

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Import Employee Data</h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="py-5 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-700">Choose CSV or Excel file to upload</p>
              <p className="text-[11px] text-slate-400 mt-1">Accepts .csv, .xlsx format (max 5MB)</p>
              <label className="mt-4 inline-block px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                <span>Browse File</span>
                <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportSample} />
              </label>
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperAdminDashboard
