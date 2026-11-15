import React from 'react'
import KPICard from '@/components/common/KPICard'

export default function HelpDeskSummaryCards({ kpis = {} }) {
  const cards = [
    {
      title: 'Total Tickets',
      value: kpis.totalTickets ?? 0,
      subtitle: 'All registered employee inquiries',
      icon: 'helpdesk',
      color: 'indigo'
    },
    {
      title: 'Active In-Progress',
      value: (kpis.openTickets ?? 0) + (kpis.inProgressTickets ?? 0) + (kpis.assignedTickets ?? 0),
      subtitle: `${kpis.openTickets ?? 0} open, ${(kpis.assignedTickets ?? 0) + (kpis.inProgressTickets ?? 0)} active`,
      icon: 'tasks',
      color: 'blue'
    },
    {
      title: 'Pending Action',
      value: kpis.pendingTickets ?? 0,
      subtitle: 'Awaiting employee / dept input',
      icon: 'alerts',
      color: 'amber'
    },
    {
      title: 'Resolved & Closed',
      value: (kpis.resolvedTickets ?? 0) + (kpis.closedTickets ?? 0),
      subtitle: `${kpis.closedTickets ?? 0} confirmed ticket closures`,
      icon: 'check',
      color: 'emerald'
    },
    {
      title: 'SLA Breaches',
      value: kpis.slaBreaches ?? 0,
      subtitle: `Resp avg: ${kpis.avgFirstResponseHours ?? '0.0'}h • Res: ${kpis.avgResolutionHours ?? '0.0'}h`,
      icon: 'danger',
      color: kpis.slaBreaches > 0 ? 'rose' : 'purple'
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
