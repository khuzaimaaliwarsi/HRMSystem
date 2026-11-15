import React from 'react'
import KPICard from '@/components/common/KPICard'

export function RecruitmentKpiCards({ stats = {}, onTabSelect = () => {} }) {
  const {
    openVacanciesCount = 0,
    activeCandidatesCount = 0,
    interviewsScheduledCount = 0,
    offersPendingCount = 0,
    probationDueCount = 0
  } = stats

  const cards = [
    {
      id: 'vacancies',
      title: 'Open Vacancies',
      value: openVacanciesCount,
      subtitle: 'Approved active job openings',
      icon: 'recruitment',
      color: 'blue',
      tabKey: 'vacancies'
    },
    {
      id: 'candidates',
      title: 'Active Pipeline',
      value: activeCandidatesCount,
      subtitle: 'Candidates in hiring stages',
      icon: 'employees',
      color: 'cyan',
      tabKey: 'candidates'
    },
    {
      id: 'interviews',
      title: 'Interviews Scheduled',
      value: interviewsScheduledCount,
      subtitle: 'Upcoming evaluation rounds',
      icon: 'calendar',
      color: 'purple',
      tabKey: 'interviews'
    },
    {
      id: 'offers',
      title: 'Pending Offers',
      value: offersPendingCount,
      subtitle: 'Awaiting approval / acceptance',
      icon: 'letters',
      color: 'amber',
      tabKey: 'offers'
    },
    {
      id: 'probation',
      title: 'Probation Milestone',
      value: probationDueCount,
      subtitle: 'Reviews due for confirmation',
      icon: 'management',
      color: 'emerald',
      tabKey: 'probation'
    }
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-6">
      {cards.map((card) => (
        <KPICard
          key={card.id}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          color={card.color}
          onClick={() => onTabSelect(card.tabKey)}
        />
      ))}
    </div>
  )
}

export default RecruitmentKpiCards
