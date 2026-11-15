import React from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/utils'

export function EmployeeOnboardingView({
  employee,
  probationRecord = null
}) {
  if (!employee) return null

  const daysElapsed = probationRecord?.daysElapsed || employee.tenureDays || 1
  const totalDays = probationRecord?.totalProbationDays || 90
  const percentElapsed = Math.min(100, Math.round((daysElapsed / totalDays) * 100))
  const isConfirmed = employee.status === 'Active' && (!probationRecord || probationRecord.currentStatus === 'Confirmed')

  const checklistItems = [
    { title: 'Personal & Contact Information Verified', completed: true, date: employee.joinDate },
    { title: 'Official Designation & Team Onboarding', completed: true, date: employee.joinDate },
    { title: 'Primary Salary Bank Account Setup', completed: true, date: employee.joinDate },
    { title: 'Assigned Shift & Daily Work Schedule', completed: true, date: employee.joinDate },
    {
      title: '90-Day Probation Review & Permanent Confirmation',
      completed: isConfirmed,
      date: isConfirmed ? (probationRecord?.finalDecision?.decisionDate || 'Completed') : (probationRecord?.expectedProbationEndDate || 'Pending Milestone')
    }
  ]

  return (
    <div className="space-y-6 text-left">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-lg p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-800/80 text-blue-200 text-xs font-semibold mb-2">
            <AppIcon name="recruitment" className="w-3 h-3" />
            <span>Onboarding & Service Journey</span>
          </div>
          <h2 className="text-xl font-black tracking-tight">{employee.name}</h2>
          <p className="text-xs text-blue-200 mt-0.5">
            {employee.designation} • {employee.department} • Joined <strong>{employee.joinDate}</strong>
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xs p-3 rounded-lg border border-white/20 text-xs flex items-center gap-3">
          <div>
            <div className="text-[10px] text-blue-200 uppercase font-semibold">Reporting Manager</div>
            <div className="font-bold text-white text-sm">{employee.managerName}</div>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div>
            <div className="text-[10px] text-blue-200 uppercase font-semibold">Lifecycle Status</div>
            <StatusBadge status={employee.status} />
          </div>
        </div>
      </div>

      {/* Probation Milestone Tracker */}
      <div className="bg-white rounded-lg border border-hrms-border p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-hrms-primary">Probation Milestone Progress</h3>
            <p className="text-xs text-slate-500">Scheduled evaluation period toward full permanent employment confirmation</p>
          </div>
          <span className={cn(
            "px-2.5 py-1 rounded-full text-xs font-bold font-mono self-start sm:self-auto",
            isConfirmed ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"
          )}>
            {isConfirmed ? 'Permanent Status Confirmed' : `${daysElapsed} / ${totalDays} Days Elapsed (${percentElapsed}%)`}
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-slate-600">
            <span>Joining: {employee.joinDate}</span>
            <span>Expected Confirmation: {probationRecord?.expectedProbationEndDate || '2026-12-01'}</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isConfirmed ? "bg-emerald-600" : "bg-hrms-accent"
              )}
              style={{ width: `${isConfirmed ? 100 : percentElapsed}%` }}
            />
          </div>
        </div>

        {/* Milestone Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Review Due Date</span>
            <div className="font-bold text-slate-900 mt-0.5">{probationRecord?.reviewDueDate || '2026-11-15'}</div>
            <p className="text-[11px] text-slate-500 mt-1">15 days before final scheduled completion</p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Assigned Evaluator</span>
            <div className="font-bold text-slate-900 mt-0.5">{employee.managerName}</div>
            <p className="text-[11px] text-slate-500 mt-1">Submits performance assessment scorecard</p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Executive Approver</span>
            <div className="font-bold text-slate-900 mt-0.5">Super Administrator</div>
            <p className="text-[11px] text-slate-500 mt-1">Authorizes company-wide confirmation</p>
          </div>
        </div>
      </div>

      {/* Onboarding Checklist */}
      <div className="bg-white rounded-lg border border-hrms-border p-5 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-hrms-primary border-b border-slate-100 pb-2">
          Onboarding & Readiness Checklist
        </h3>

        <div className="space-y-2.5">
          {checklistItems.map((item, idx) => (
            <div
              key={idx}
              className={cn(
                "p-3 rounded-lg border text-xs flex items-center justify-between gap-3",
                item.completed ? "bg-emerald-50/40 border-emerald-200" : "bg-slate-50 border-slate-200"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]",
                  item.completed ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                )}>
                  {item.completed ? <AppIcon name="check" className="w-2.5 h-2.5" /> : idx + 1}
                </div>
                <span className={cn("font-semibold", item.completed ? "text-emerald-950 font-bold" : "text-slate-700")}>
                  {item.title}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 shrink-0">
                {item.date}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EmployeeOnboardingView
