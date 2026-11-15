import React from 'react'
import KPICard from '@/components/common/KPICard'

export default function LettersSummaryCards({ kpis = {} }) {
  const cards = [
    {
      title: 'Active Templates',
      value: kpis.activeTemplates || 0,
      subtitle: `${kpis.totalTemplates || 0} registered formats`,
      icon: 'letters',
      color: 'blue'
    },
    {
      title: 'Draft Documents',
      value: kpis.draftsCount || 0,
      subtitle: 'Unsubmitted letter drafts',
      icon: 'tasks',
      color: 'amber'
    },
    {
      title: 'Pending Approvals',
      value: kpis.pendingApprovalCount || 0,
      subtitle: 'Awaiting executive signoff',
      icon: 'alerts',
      color: 'purple'
    },
    {
      title: 'Officially Issued',
      value: kpis.issuedCount || 0,
      subtitle: 'Published with verification QR',
      icon: 'check',
      color: 'emerald'
    },
    {
      title: 'Total Generated',
      value: kpis.totalLetters || 0,
      subtitle: 'All recorded HR documents',
      icon: 'dashboard',
      color: 'indigo'
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
