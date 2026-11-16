import React, { useState, useMemo, useEffect } from 'react'
import { dashboardService } from '@/services/dashboardService'
import { employeeService } from '@/services/employeeService'
import { syncOrganization, syncRecruitment, syncPayroll, syncLeaves } from '@/services/backendSync'
import { exportDashboardSummaryToCSV } from '@/lib/csvExport'
import DashboardControlBar from '@/components/dashboard/DashboardControlBar'
import KPICard from '@/components/common/KPICard'
import StatusBadge from '@/components/common/StatusBadge'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'
import QuickHubPanel from '@/components/dashboard/QuickHubPanel'
import RecentActivityTable from '@/components/dashboard/RecentActivityTable'

const CURRENT_MONTH_NAME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][new Date().getMonth()] || 'Nov'
const CURRENT_YEAR_STR = String(new Date().getFullYear())

export function HrAdminDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH_NAME)
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR_STR)
  const [selectedDept, setSelectedDept] = useState('all')
  const [exportNotice, setExportNotice] = useState(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    Promise.allSettled([
      syncOrganization(),
      syncRecruitment(),
      syncPayroll(),
      syncLeaves()
    ]).then(() => setVersion((v) => v + 1))

    const unsub = employeeService?.subscribe?.(() => setVersion((v) => v + 1))
    const handleStorage = (e) => {
      if (e?.key?.startsWith('isysware_hrms')) {
        setVersion((v) => v + 1)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      if (typeof unsub === 'function') unsub()
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const hrData = useMemo(() => {
    void version
    return dashboardService.getHrAdminData({
      periodMonth: selectedMonth,
      periodYear: selectedYear,
      department: selectedDept
    })
  }, [selectedMonth, selectedYear, selectedDept, version])

  const hrQuickHub = [
    {
      title: 'Employee Master & Profile Records',
      description: 'Create, update staff assignments and verify banking details',
      icon: 'employees',
      path: '/hr-admin/employees',
      actionLabel: 'Manage'
    },
    {
      title: 'Recruitment & Candidate Pipeline',
      description: 'Manage active vacancies, interview schedules and offer letters',
      icon: 'recruitment',
      path: '/hr-admin/recruitment',
      actionLabel: 'Hiring'
    },
    {
      title: 'Attendance Corrections & Overtime',
      description: 'Audit missed punch requests and field duty intervals',
      icon: 'attendance',
      path: '/hr-admin/attendance',
      actionLabel: 'Reconcile'
    },
    {
      title: 'Leave Approvals & Escalated Exceptions',
      description: 'Review leave requests escalated by annual request count routing policy',
      icon: 'leave',
      path: '/hr-admin/leaves',
      actionLabel: 'Leaves'
    }
  ]

  const handleExport = () => {
    const result = exportDashboardSummaryToCSV('HR Admin Operations', {
      periodYear: selectedYear,
      periodMonth: selectedMonth,
      department: selectedDept === 'all' ? 'All Departments' : selectedDept
    }, {
      kpis: hrData.kpis,
      headcountDistribution: {
        total: hrData.kpis.totalEmployees,
        female: hrData.recentUpdates.filter((m) => m.gender === 'Female').length,
        male: hrData.recentUpdates.filter((m) => m.gender === 'Male').length
      },
      tenureAging: {
        under30: hrData.recentUpdates.filter((m) => m.tenureDays <= 30).length,
        under60: hrData.recentUpdates.filter((m) => m.tenureDays > 30 && m.tenureDays <= 60).length,
        under90: hrData.recentUpdates.filter((m) => m.tenureDays > 60 && m.tenureDays <= 90).length,
        over90: hrData.recentUpdates.filter((m) => m.tenureDays > 90).length
      },
      recentActivity: hrData.recentUpdates
    })

    if (result.success) {
      setExportNotice(`Downloaded CSV file: ${result.filename}`)
      setTimeout(() => setExportNotice(null), 6000)
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Control Bar */}
      <DashboardControlBar
        title="iSysware Workforce"
        subtitle={`Operational workforce queue & compliance tracking • Fiscal Year ${selectedYear} (${selectedMonth})`}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
        selectedDepartment={selectedDept}
        onSelectDepartment={setSelectedDept}
        onExport={handleExport}
        showDepartmentFilter={false}
      />

      {exportNotice && (
        <Alert
          variant="success"
          title="CSV Export Complete"
          onClose={() => setExportNotice(null)}
        >
          {exportNotice}. Contains active HR operational metrics and filtered personnel records.
        </Alert>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KPICard
          title="Total In Scope"
          value={hrData.kpis.totalEmployees}
          icon="employees"
          subtitle={selectedDept === 'all' ? 'All Company Units' : `Dept Filter: ${selectedDept}`}
        />
        <KPICard
          title="Present Today"
          value={hrData.kpis.presentToday}
          icon="attendance"
          subtitle="On shift & client duty"
          trend={{ value: 'Real-time', positive: true }}
        />
        <KPICard
          title="On Probation"
          value={hrData.kpis.probationCount}
          icon="management"
          subtitle="Milestone review due"
        />
        <KPICard
          title="Open Vacancies"
          value={hrData.kpis.openVacancies}
          icon="recruitment"
          subtitle="Active recruitment"
          trend={{ value: '+2', positive: true, label: 'new' }}
        />
      </div>

      {/* Recruitment Pipeline & Probation Milestones (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recruitment Pipeline Card */}
        <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card text-left flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-hrms-border/60">
            <div className="flex items-center gap-2">
              <AppIcon name="recruitment" className="w-4 h-4 text-hrms-accent" />
              <h4 className="text-sm font-bold text-hrms-primary tracking-tight">
                Active Recruitment Funnel
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">
              36 Total Candidates
            </span>
          </div>

          <div className="space-y-3 py-3">
            {hrData.recruitmentPipeline.map((stage, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-hrms-text">{stage.stage}</span>
                  <span className="font-bold text-hrms-primary font-mono">{stage.count} candidates</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    style={{ width: `${Math.min((stage.count / 20) * 100, 100)}%` }}
                    className={`h-full rounded-full ${stage.color} transition-all duration-500`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-hrms-border/60 flex items-center justify-between text-xs text-hrms-muted">
            <span>Average candidate time to offer: <strong>14 Days</strong></span>
            <span className="text-hrms-accent font-semibold">ATS Pipeline Live</span>
          </div>
        </div>

        {/* Probation & Milestones Card */}
        <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card text-left flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-hrms-border/60">
            <div className="flex items-center gap-2">
              <AppIcon name="calendar" className="w-4 h-4 text-hrms-accent" />
              <h4 className="text-sm font-bold text-hrms-primary tracking-tight">
                Probation & Contract Milestones
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              {(hrData?.milestones || []).length} Events Due
            </span>
          </div>

          <div className="divide-y divide-hrms-border/60 py-1 space-y-1">
            {(hrData?.milestones || []).map((evt) => (
              <div key={evt.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-hrms-primary">
                    {evt.title}
                  </span>
                  <span className="text-[11px] text-hrms-muted">
                    {evt.targetName}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold text-hrms-accent">
                    {evt.date}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {evt.daysLeft}d left
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-hrms-border/60 flex items-center justify-between text-xs text-hrms-muted">
            <span>Automated alert notifications active</span>
            <span className="text-emerald-700 font-semibold">Zero SLA Breaches</span>
          </div>
        </div>
      </div>

      {/* HR Operations Quick Hub & Escalated Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <QuickHubPanel
          title="HR Operations Quick Hub"
          activeCount="Operational Access"
          items={hrQuickHub}
        />

        {/* Escalated & Above-Limit Leave Exceptions */}
        <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card text-left flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-hrms-border/60">
            <div className="flex items-center gap-2">
              <AppIcon name="leave" className="w-4 h-4 text-hrms-accent" />
              <h4 className="text-sm font-bold text-hrms-primary tracking-tight">
                Escalated Leaves & HR Approvals
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Manager Cap Exceeded
            </span>
          </div>

          <div className="divide-y divide-hrms-border/60 py-1">
            {hrData.escalatedApprovals.map((app) => (
              <div key={app.id} className="py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-hrms-primary">
                    {app.applicantName} ({app.department})
                  </span>
                  <StatusBadge status="Escalated to HR" variant="warning" size="sm" />
                </div>
                <p className="text-xs text-hrms-text leading-relaxed">
                  {app.details}
                </p>
                <div className="flex items-center justify-between text-[10px] text-hrms-muted mt-1">
                  <span>Routing Rule: <strong>{app.tier}</strong></span>
                  <span className="font-mono text-hrms-subtle">{app.requestedDate}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-hrms-border/60 flex items-center justify-between text-xs text-hrms-muted">
            <span>Governance Rule: Requests &gt;2 days escalate from Manager to HR</span>
            <span className="text-[11px] font-semibold text-hrms-accent">Policy Enforced</span>
          </div>
        </div>
      </div>

      {/* Recent Staff Activity Table */}
      <RecentActivityTable
        title="Recently Active Staff Records"
        subtitle="Live personnel statuses, active contracts, and attendance classifications."
        staff={hrData.recentUpdates}
        viewAllLink="/hr-admin/employees"
      />
    </div>
  )
}

export default HrAdminDashboard
