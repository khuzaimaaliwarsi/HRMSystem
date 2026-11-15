import React from 'react'
import KPICard from '@/components/common/KPICard'

export function AttendanceOverviewCards({ stats = {}, onActionClick }) {
  const cards = [
    {
      title: 'Present in Office',
      value: stats.presentCount ?? 9,
      subtitle: `${stats.lateCount || 0} arrived late (${stats.totalEmployees ? Math.round(((stats.presentCount || 0) / stats.totalEmployees) * 100) : 0}%)`,
      icon: 'shifts',
      color: 'emerald'
    },
    {
      title: 'WFH & Remote',
      value: stats.wfhCount ?? 1,
      subtitle: 'Approved remote work sessions',
      icon: 'dashboard',
      color: 'blue'
    },
    {
      title: 'Field Duty',
      value: stats.fieldDutyCount ?? 2,
      subtitle: 'Client site engagements',
      icon: 'travel',
      color: 'indigo'
    },
    {
      title: 'Unscheduled Absent',
      value: stats.absentCount ?? 1,
      subtitle: 'No check-in or leave recorded',
      icon: 'danger',
      color: 'rose'
    },
    {
      title: 'Attendance Rate',
      value: (stats.scheduledWorkforce === 0 || stats.attendanceRate == null || isNaN(stats.attendanceRate))
        ? 'N/A'
        : `${stats.attendanceRate}%`,
      subtitle: `${stats.workingToday ?? 0} / ${stats.scheduledWorkforce ?? 0} scheduled staff`,
      icon: 'attendance',
      color: 'cyan'
    },
    {
      title: 'Pending Exceptions',
      value: (stats.pendingCorrectionsCount || 0) + (stats.pendingWfhCount || 0) + (stats.pendingFieldDutyCount || 0) + (stats.pendingOvertimeCount || 0),
      subtitle: `${stats.pendingCorrectionsCount || 0} corrections, ${stats.pendingOvertimeCount || 0} OT`,
      icon: 'warning',
      color: 'amber',
      onClick: () => onActionClick?.('exceptions')
    }
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {cards.map((card, idx) => (
        <KPICard
          key={idx}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          color={card.color}
          onClick={card.onClick}
        />
      ))}
    </div>
  )
}

export default AttendanceOverviewCards
