import React from 'react'
import KPICard from '@/components/common/KPICard'

export default function TravelSummaryCards({ kpis = {} }) {
  const cards = [
    {
      title: 'Travel Requests',
      value: kpis.totalRequests || 0,
      subtitle: 'Official travel applications',
      icon: 'travel',
      color: 'blue'
    },
    {
      title: 'Pending Approvals',
      value: kpis.pendingApprovals || 0,
      subtitle: 'Awaiting manager or HR review',
      icon: 'alerts',
      color: 'amber'
    },
    {
      title: 'Active Trips',
      value: kpis.activeTrips || 0,
      subtitle: 'Planned or in-transit itineraries',
      icon: 'dashboard',
      color: 'indigo'
    },
    {
      title: 'Travel Advances',
      value: `Rs. ${(kpis.totalAdvancesDisbursed || 0).toLocaleString()}`,
      subtitle: 'Disbursed cash advances',
      icon: 'banking',
      color: 'purple'
    },
    {
      title: 'Pick & Drop Enrolled',
      value: kpis.activeAssignments || 0,
      subtitle: `${kpis.routeUtilization || 0}% fleet capacity`,
      icon: 'shifts',
      color: 'emerald'
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
