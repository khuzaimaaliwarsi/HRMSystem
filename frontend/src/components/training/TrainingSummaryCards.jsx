import React from 'react'
import KPICard from '@/components/common/KPICard'

export default function TrainingSummaryCards({ kpis = {} }) {
  const cards = [
    {
      title: 'Active Curriculum',
      value: kpis.totalCourses || 0,
      subtitle: 'Catalog courses published',
      icon: 'training',
      color: 'blue'
    },
    {
      title: 'Scheduled Cohorts',
      value: kpis.activeSessions || 0,
      subtitle: 'Training sessions in pipeline',
      icon: 'calendar',
      color: 'indigo'
    },
    {
      title: 'Workforce Enrollments',
      value: kpis.totalEnrollments || 0,
      subtitle: 'Active learning participants',
      icon: 'employees',
      color: 'emerald'
    },
    {
      title: 'Completion Rate',
      value: `${kpis.completionRate || 0}%`,
      subtitle: 'Passed syllabus evaluations',
      icon: 'performance',
      color: 'purple'
    },
    {
      title: 'Certificates Issued',
      value: kpis.certificatesIssued || 0,
      subtitle: 'Verified credentials issued',
      icon: 'tasks',
      color: 'amber'
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
      {cards.map((c, i) => (
        <KPICard
          key={i}
          title={c.title}
          value={c.value}
          subtitle={c.subtitle}
          icon={c.icon}
          color={c.color}
        />
      ))}
    </div>
  )
}
