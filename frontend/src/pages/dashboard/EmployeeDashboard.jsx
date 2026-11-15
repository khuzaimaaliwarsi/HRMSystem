import React, { useState } from 'react'
import { useAuth } from '@/context/useAuth'
import { dashboardService } from '@/services/dashboardService'
import { exportEmployeeStatementToCSV } from '@/lib/csvExport'
import KPICard from '@/components/common/KPICard'
import StatusBadge from '@/components/common/StatusBadge'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'
import { cn } from '@/lib/utils'
import { formatTimeTo12Hour } from '@/lib/dateUtils'

export function EmployeeDashboard() {
  const { user } = useAuth()
  const empId = user?.employeeId || user?.id || 'EMP-004'
  const [requestFilter, setRequestFilter] = useState('all')
  const [exportNotice, setExportNotice] = useState(null)

  const empData = dashboardService.getEmployeeData(empId) || {}
  const {
    profile = {},
    todayPunch = {},
    leaveBalances = {},
    activeTasks = [],
    recentRequests = [],
    upcomingHolidays = [],
    kpis = {}
  } = empData

  const filteredRequests = (recentRequests || []).filter((r) => {
    if (requestFilter === 'pending') return r?.status?.toLowerCase().includes('pending')
    if (requestFilter === 'approved') return r?.status?.toLowerCase().includes('approved') || r?.status?.toLowerCase().includes('issued')
    return true
  })

  const handleExportPersonalStatement = () => {
    const result = exportEmployeeStatementToCSV(profile, empData)
    if (result.success) {
      setExportNotice(`Downloaded CSV file: ${result.filename}`)
      setTimeout(() => setExportNotice(null), 6000)
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Top Welcome & Employee Summary Banner */}
      <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-hrms-primary text-white font-extrabold flex items-center justify-center text-base shadow-sm shrink-0">
            {profile.initials || 'ZA'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
                Welcome back, {profile.name}!
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                Active Employee
              </span>
            </div>
            <p className="text-xs text-hrms-muted mt-0.5">
              {profile.designation} • {profile.department} (ID: <span className="font-mono">{profile.id}</span>)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPersonalStatement}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-hrms-primary text-white text-xs font-semibold hover:bg-hrms-primary-hover shadow-xs transition-colors"
          >
            <AppIcon name="print" className="w-3.5 h-3.5" />
            <span>Export Statement</span>
          </button>
          <div className="flex items-center gap-2 text-xs bg-hrms-canvas p-2 rounded-lg border border-hrms-border">
            <AppIcon name="user" className="w-3.5 h-3.5 text-hrms-accent" />
            <span className="text-hrms-muted">
              Manager: <strong className="text-hrms-primary">{profile.managerName}</strong>
            </span>
          </div>
        </div>
      </div>

      {exportNotice && (
        <Alert
          variant="success"
          title="Personal Statement Exported"
          onClose={() => setExportNotice(null)}
        >
          {exportNotice}. Downloaded attendance punch state, leave balances ledger, and active requests.
        </Alert>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KPICard
          title="Attendance Status"
          value={kpis.attendanceToday}
          icon="attendance"
          subtitle={`In at ${formatTimeTo12Hour(kpis.checkInTime)}`}
          trend={{ value: 'On Time', positive: true }}
        />
        <KPICard
          title="Hours Logged Today"
          value={kpis.hoursToday}
          icon="shifts"
          subtitle="Expected out: 06:00 PM"
        />
        <KPICard
          title="Available Leaves"
          value={`${kpis.remainingLeavesTotal} Days`}
          icon="leave"
          subtitle="Annual + Casual + Sick"
        />
        <KPICard
          title="Active Deliverables"
          value={kpis.activeTasksCount}
          icon="tasks"
          subtitle="In current sprint"
        />
      </div>

      {/* Main Sections: Punch Card & Leave Balances Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Today's Shift & Punch State */}
        <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card flex flex-col justify-between text-left">
          <div className="flex items-center justify-between pb-3 border-b border-hrms-border/60">
            <div className="flex items-center gap-2">
              <AppIcon name="attendance" className="w-4 h-4 text-hrms-accent" />
              <h4 className="text-sm font-bold text-hrms-primary tracking-tight">
                Daily Work Schedule & Shift
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-hrms-primary">
              {profile.shift}
            </span>
          </div>

          <div className="py-4 space-y-3">
            <div className="p-3 bg-hrms-canvas rounded-lg border border-hrms-border flex items-center justify-between">
              <div>
                <span className="text-xs text-hrms-muted block">First Punch In</span>
                <span className="text-sm font-bold text-emerald-700">{todayPunch.time ? formatTimeTo12Hour(todayPunch.time) : '—'}</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-hrms-muted block">Shift Closes</span>
                <span className="text-sm font-bold text-hrms-primary">{todayPunch.expectedOut ? formatTimeTo12Hour(todayPunch.expectedOut) : '—'}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-hrms-muted block">Work Arrangement</span>
                <span className="text-xs font-semibold text-hrms-accent">{profile.workLocation}</span>
              </div>
            </div>

            <p className="text-xs text-hrms-muted leading-relaxed">
              Punches are recorded in UTC and calculated against the official Pakistan Business Time (<span className="font-mono">Asia/Karachi</span>). Approved field duty intervals automatically count towards work time.
            </p>
          </div>

          <div className="pt-3 border-t border-hrms-border/60 flex items-center justify-between text-xs text-hrms-muted">
            <span>Biometric & Field Sync</span>
            <span className="text-emerald-700 font-semibold">Shift Compliant</span>
          </div>
        </div>

        {/* Leave Entitlement Ledger */}
        <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card flex flex-col justify-between text-left">
          <div className="flex items-center justify-between pb-3 border-b border-hrms-border/60">
            <div className="flex items-center gap-2">
              <AppIcon name="leave" className="w-4 h-4 text-hrms-accent" />
              <h4 className="text-sm font-bold text-hrms-primary tracking-tight">
                My Leave Entitlement Ledger
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {leaveBalances.pendingRequests} Request Pending
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 py-4">
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 text-center">
              <span className="text-[10px] uppercase font-bold text-hrms-muted block">Annual</span>
              <span className="text-xl font-black text-hrms-primary mt-1 block">{leaveBalances.annualRemaining}</span>
              <span className="text-[10px] text-hrms-subtle block">of {leaveBalances.annualTotal} days</span>
            </div>
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 text-center">
              <span className="text-[10px] uppercase font-bold text-hrms-muted block">Casual</span>
              <span className="text-xl font-black text-emerald-700 mt-1 block">{leaveBalances.casualRemaining}</span>
              <span className="text-[10px] text-hrms-subtle block">of {leaveBalances.casualTotal} days</span>
            </div>
            <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50 text-center">
              <span className="text-[10px] uppercase font-bold text-hrms-muted block">Sick</span>
              <span className="text-xl font-black text-purple-700 mt-1 block">{leaveBalances.sickRemaining}</span>
              <span className="text-[10px] text-hrms-subtle block">of {leaveBalances.sickTotal} days</span>
            </div>
          </div>

          <div className="pt-3 border-t border-hrms-border/60 flex items-center justify-between text-xs text-hrms-muted">
            <span>Rule: Quota is entitlement; manager approval cap is separate</span>
            <span className="text-hrms-accent font-semibold">Ledger Reconciled</span>
          </div>
        </div>
      </div>

      {/* Active Tasks & Requests (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* My Tasks */}
        <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card flex flex-col justify-between text-left">
          <div className="flex items-center justify-between pb-3 border-b border-hrms-border/60">
            <div className="flex items-center gap-2">
              <AppIcon name="tasks" className="w-4 h-4 text-hrms-accent" />
              <h4 className="text-sm font-bold text-hrms-primary tracking-tight">
                My Active Deliverables
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">
              Sprint In-Progress
            </span>
          </div>

          <div className="divide-y divide-hrms-border/60 py-1 space-y-1">
            {(activeTasks || []).map((t) => (
              <div key={t.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-bold text-hrms-primary">
                    {t.title}
                  </span>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                    <div style={{ width: `${t.progress}%` }} className="bg-hrms-accent h-1.5 rounded-full" />
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] font-mono text-hrms-muted">
                    Due: {t.deadline}
                  </span>
                  <span className="text-[10px] font-semibold text-hrms-accent mt-1">
                    {t.progress}% Done
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-hrms-border/60 flex items-center justify-between text-xs text-hrms-muted">
            <span>Sprint Goal: <strong>Batch F01 Complete</strong></span>
            <span className="text-emerald-700 font-semibold">Active</span>
          </div>
        </div>

        {/* My Recent Requests & Upcoming Holidays */}
        <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card flex flex-col justify-between text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-hrms-border/60 gap-2">
            <div className="flex items-center gap-2">
              <AppIcon name="letters" className="w-4 h-4 text-hrms-accent" />
              <h4 className="text-sm font-bold text-hrms-primary tracking-tight">
                My Service Requests
              </h4>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-hrms-canvas p-0.5 rounded border border-hrms-border">
              {['all', 'pending', 'approved'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRequestFilter(tab)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-semibold rounded capitalize transition-all",
                    requestFilter === tab
                      ? "bg-white text-hrms-primary shadow-xs"
                      : "text-hrms-muted hover:text-hrms-primary"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-hrms-border/60 py-1">
            {(filteredRequests || []).length === 0 ? (
              <div className="py-6 text-center text-xs text-hrms-muted">
                No requests match filter '{requestFilter}'.
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div key={req.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-hrms-primary block">{req.type}</span>
                    <span className="text-[10px] text-hrms-muted">Date: {req.date} • Approver: {req.approver}</span>
                  </div>
                  <StatusBadge status={req.status} size="sm" />
                </div>
              ))
            )}

            <div className="pt-3">
              <span className="text-[10px] uppercase font-bold text-hrms-muted block mb-1.5">Upcoming Holidays (Pakistan Calendar)</span>
              <div className="flex flex-wrap items-center gap-2">
                {upcomingHolidays.map((h, idx) => (
                  <span key={idx} className="text-xs px-2.5 py-1 bg-hrms-canvas rounded border border-hrms-border text-hrms-text whitespace-nowrap">
                    <strong>{h.title}</strong> ({h.date})
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-hrms-border/60 flex items-center justify-between text-xs text-hrms-muted">
            <span>Strict Personal Scope Enforced</span>
            <span className="text-emerald-700 font-semibold">Data Protected</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmployeeDashboard
