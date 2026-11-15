import React, { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/context/useAuth'
import { dashboardService } from '@/services/dashboardService'
import { employeeService } from '@/services/employeeService'
import { exportManagerTeamRosterToCSV } from '@/lib/csvExport'
import KPICard from '@/components/common/KPICard'
import StatusBadge from '@/components/common/StatusBadge'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'
import RecentActivityTable from '@/components/dashboard/RecentActivityTable'
import { cn } from '@/lib/utils'

export function ManagerDashboard({ isTeamLead = false }) {
  const { user } = useAuth()
  const effectiveRole = user?.role === 'team_lead' || isTeamLead ? 'team_lead' : 'manager'
  const effectiveId = user?.employeeId || user?.id || (effectiveRole === 'team_lead' ? 'EMP-005' : 'EMP-003')

  const [taskFilter, setTaskFilter] = useState('all')
  const [exportNotice, setExportNotice] = useState(null)
  const [version, setVersion] = useState(0)

  // React to cross-tab storage changes and employee service updates
  useEffect(() => {
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

  const managerData = useMemo(() => {
    void version
    if (effectiveRole === 'team_lead') {
      return dashboardService.getTeamLeadData(effectiveId, {
        taskStatus: taskFilter
      })
    }
    return dashboardService.getManagerData(effectiveId, {
      taskStatus: taskFilter
    })
  }, [effectiveRole, effectiveId, taskFilter, version])

  const handleExportTeamRoster = () => {
    const result = exportManagerTeamRosterToCSV(managerData)
    if (result.success) {
      setExportNotice(`Downloaded CSV file: ${result.filename}`)
      setTimeout(() => setExportNotice(null), 6000)
    }
  }

  const managerName = managerData?.managerProfile?.name || user?.name || 'Authorized Manager'
  const managerDept = managerData?.managerProfile?.department || 'Department'
  const leadName = managerData?.leadProfile?.name || user?.name || 'Assigned Lead'
  const teamTitle = managerData?.leadProfile?.teamName || 'Assigned Team'
  const teamTasks = Array.isArray(managerData?.teamTasks) ? managerData.teamTasks : []
  const teamApprovals = Array.isArray(managerData?.teamApprovals) ? managerData.teamApprovals : []
  const kpis = managerData?.kpis || {}

  return (
    <div className="space-y-6 text-left">
      {/* Top Welcome & Team Scope Banner */}
      <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
              {effectiveRole === 'team_lead' ? `${teamTitle} Dashboard` : `${managerDept} Management Dashboard`}
            </h2>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", effectiveRole === 'team_lead' ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-hrms-primary")}>
              {effectiveRole === 'team_lead' ? 'Team Lead Scope' : `${managerDept} Scope`}
            </span>
          </div>
          <p className="text-xs text-hrms-muted mt-1">
            {effectiveRole === 'team_lead' ? (
              <>Team Lead: <strong>{leadName} ({effectiveId})</strong> • Assigned Team Scope Only</>
            ) : (
              <>Supervising Manager: <strong>{managerName} ({effectiveId})</strong> • Authorized Direct Reports Scope Only</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleExportTeamRoster}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-hrms-primary text-white text-xs font-semibold hover:bg-hrms-primary-hover shadow-xs transition-colors"
          >
            <AppIcon name="print" className="w-3.5 h-3.5" />
            <span>Export Team Summary</span>
          </button>
          <div className="px-3 py-1.5 rounded-md bg-hrms-canvas border border-hrms-border text-hrms-muted">
            Approval Cap: <strong className="text-hrms-primary">2 Cumulative Days / Mo</strong>
          </div>
        </div>
      </div>

      {exportNotice && (
        <Alert
          variant="success"
          title="Team Summary Exported"
          onClose={() => setExportNotice(null)}
        >
          {exportNotice}. Downloaded direct report attendance and active deliverables snapshot.
        </Alert>
      )}

      {/* KPI Cards Grid */}
      <div className={cn("grid gap-2.5", effectiveRole === 'team_lead' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5")}>
        <KPICard
          title="Direct Reports"
          value={kpis.directReportsCount !== undefined ? kpis.directReportsCount : (kpis.teamMembers || 0)}
          icon="employees"
          subtitle={effectiveRole === 'team_lead' ? "Assigned direct reports" : "Direct subordinates"}
        />
        {effectiveRole !== 'team_lead' && (
          <KPICard
            title="Total Dept Staff"
            value={kpis.totalDepartmentStaff ?? kpis.teamMembers ?? 0}
            icon="workforce"
            subtitle="Department personnel"
          />
        )}
        <KPICard
          title="Team Present"
          value={kpis.presentToday || 0}
          icon="attendance"
          subtitle="On shift & duty today"
          trend={{ value: `${(kpis.teamMembers || 0) > 0 ? Math.round(((kpis.presentToday || 0) / kpis.teamMembers) * 100) : 100}%`, positive: true, label: 'rate' }}
        />
        <KPICard
          title="Tasks In Progress"
          value={kpis.tasksInProgress || 0}
          icon="tasks"
          subtitle="Sprint deliverables"
        />
        <KPICard
          title="Pending Approvals"
          value={kpis.pendingApprovalsCount || 0}
          icon="leave"
          subtitle="Within manager tier"
        />
      </div>

      {/* Team Tasks & Deliverables + Team Leave Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Team Tasks */}
        <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card text-left flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-hrms-border/60 gap-2">
            <div className="flex items-center gap-2">
              <AppIcon name="tasks" className="w-4 h-4 text-hrms-accent" />
              <h4 className="text-sm font-bold text-hrms-primary tracking-tight">
                Sprint Deliverables & Tasks
              </h4>
            </div>

            {/* Task Status Filters */}
            <div className="flex items-center gap-1 bg-hrms-canvas p-0.5 rounded border border-hrms-border">
              {['all', 'in progress', 'overdue'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTaskFilter(tab)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-semibold rounded capitalize transition-all",
                    taskFilter === tab
                      ? "bg-white text-hrms-primary shadow-xs"
                      : "text-hrms-muted hover:text-hrms-primary"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-hrms-border/60 py-1 space-y-1">
            {(teamTasks || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-hrms-muted">
                No tasks match filter '{taskFilter}'.
              </div>
            ) : (
              teamTasks.map((task) => (
                <div key={task.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-hrms-primary">
                      {task.title}
                    </span>
                    <span className="text-[11px] text-hrms-muted mt-0.5">
                      Assignee: <strong>{task.assigneeName}</strong>
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <StatusBadge status={task.status} size="sm" />
                    <span className="text-[10px] font-mono text-hrms-muted mt-1">
                      Due: {task.dueDate}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-hrms-border/60 flex items-center justify-between text-xs text-hrms-muted">
            <span>Sprint Goal: <strong>{(teamTasks || []).length > 0 ? 'Active Sprint Deliverables' : 'No Active Sprint Objectives'}</strong></span>
            <span className={(teamTasks || []).length > 0 ? "text-emerald-700 font-semibold" : "text-hrms-muted font-medium"}>
              {(teamTasks || []).length > 0 ? 'On Track' : 'Not Set'}
            </span>
          </div>
        </div>

        {/* Team Leave Approvals & Invariant Guard */}
        <div className="bg-white rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card text-left flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-hrms-border/60">
            <div className="flex items-center gap-2">
              <AppIcon name="leave" className="w-4 h-4 text-hrms-accent" />
              <h4 className="text-sm font-bold text-hrms-primary tracking-tight">
                Team Leave Requests (Cap: 2d)
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              Authority Enforced
            </span>
          </div>

          <div className="divide-y divide-hrms-border/60 py-1">
            {(teamApprovals || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-hrms-muted">
                No pending leave requests in your approval queue.
              </div>
            ) : (
              teamApprovals.map((req) => (
                <div key={req.id} className="py-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-hrms-primary">
                      {req.applicantName}
                    </span>
                    <StatusBadge status={req.status} size="sm" />
                  </div>
                  <p className="text-xs text-hrms-text leading-relaxed">
                    {req.details}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-hrms-muted mt-1">
                    <span>Authorized Tier: <strong>{req.tier}</strong></span>
                    <span className="font-mono text-hrms-subtle">{req.requestedDate}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-hrms-border/60 flex items-center justify-between text-xs text-hrms-muted">
            <span>Rule: Requests &gt;2 days or manager's own leave route to HR</span>
            <span className="text-[11px] font-semibold text-hrms-primary">No Self-Approval</span>
          </div>
        </div>
      </div>

      {/* Assigned Direct Reports Team Roster */}
      <RecentActivityTable
        title={effectiveRole === 'team_lead' ? `Assigned ${teamTitle} Roster` : `Assigned ${managerDept} Roster`}
        subtitle={
          effectiveRole === 'team_lead'
            ? `Direct reporting staff under Team Lead ${leadName} (Confidential salary masked by default).`
            : `Direct reporting staff under ${managerName} (Confidential salary masked by default).`
        }
        staff={Array.isArray(managerData?.teamMembers) ? managerData.teamMembers : []}
        viewAllLink={effectiveRole === 'team_lead' ? '/team-lead/team' : '/manager/team'}
      />
    </div>
  )
}

export default ManagerDashboard
