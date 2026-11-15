import React from 'react'
import { useNavigate } from 'react-router-dom'
import AppIcon from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'

export function QuickHubPanel({
  title = 'Modules Quick Hub',
  activeCount = '10 Modules Active',
  items = [],
  className = ''
}) {
  const navigate = useNavigate()

  // Default row palettes matching Screenshot 1 100%:
  // Row 1: Soft sky blue (Users)
  // Row 2: Soft mint emerald (Clock / Attendance)
  // Row 3: Soft lavender purple (Payment Card / Payroll)
  const defaultPalettes = [
    'bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]',
    'bg-[#ECFDF5] text-[#059669] border border-[#D1FAE5]',
    'bg-[#FAF5FF] text-[#9333EA] border border-[#F3E8FF]'
  ]

  // Default items matching user screenshot + added Recruitment & Performance to eliminate empty space
  const defaultItems = [
    {
      title: 'Employee Directory & Org Hierarchy',
      description: 'Manage workforce directory, designations & reporting trees',
      icon: 'employees',
      iconBg: 'bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]',
      path: '/super-admin/employees',
      actionLabel: 'Manage'
    },
    {
      title: 'Attendance, Shifts & Leave Center',
      description: 'Biometric timesheets, shift schedules & regularizations',
      icon: 'attendance',
      iconBg: 'bg-[#ECFDF5] text-[#059669] border border-[#D1FAE5]',
      path: '/super-admin/attendance',
      actionLabel: 'Review'
    },
    {
      title: 'Payroll & Monthly Compensation Runs',
      description: 'Salary structures, tax allowances & payslip distributions',
      icon: 'payroll',
      iconBg: 'bg-[#FAF5FF] text-[#9333EA] border border-[#F3E8FF]',
      path: '/super-admin/payroll',
      actionLabel: 'Open Payroll'
    },
    {
      title: 'Recruitment & Talent Acquisition',
      description: 'Active job requisitions, candidate evaluation & onboarding',
      icon: 'recruitment',
      iconBg: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
      path: '/super-admin/recruitment',
      actionLabel: 'Hiring'
    },
    {
      title: 'Performance, Appraisals & KPIs',
      description: 'Quarterly review cycles, OKR targets & merit ratings',
      icon: 'performance',
      iconBg: 'bg-[#FDF2F8] text-[#DB2777] border border-[#FBCFE8]',
      path: '/super-admin/performance',
      actionLabel: 'Appraisals'
    }
  ]

  const displayItems = items && items.length > 0 ? items : defaultItems

  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col text-left transition-all hover:shadow-xs", className)}>
      {/* Header with Sparkle Badge from Screenshot 1 */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1.5C12 7.298 7.298 12 1.5 12C7.298 12 12 16.702 12 22.5C12 16.702 16.702 12 22.5 12C16.702 12 12 7.298 12 1.5Z" />
              <circle cx="3.5" cy="20.5" r="2" />
            </svg>
          </div>
          <h4 className="text-[13px] font-bold text-slate-900 tracking-tight">
            {title}
          </h4>
        </div>
        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
          {activeCount}
        </span>
      </div>

      {/* 5 Action Rows with Pastel Icon Badges */}
      <div className="divide-y divide-slate-100 flex-1 flex flex-col justify-around py-0.5">
        {displayItems.map((item, idx) => {
          const badgeClass = item.iconBg || defaultPalettes[idx % defaultPalettes.length]
          return (
            <div
              key={idx}
              className="py-2.5 flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3">
                <div className={cn("w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105", badgeClass)}>
                  <AppIcon name={item.icon || 'settings'} className="w-3.5 h-3.5 text-current" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </span>
                  <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {item.description}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => item.path && navigate(item.path)}
                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-800 transition-all shrink-0 flex items-center gap-1 shadow-xs cursor-pointer focus:outline-none"
              >
                <span>{item.actionLabel || 'Manage'}</span>
                <span className="text-[11px] text-slate-400">→</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default QuickHubPanel

