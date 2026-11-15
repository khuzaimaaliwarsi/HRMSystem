import React from 'react'
import KPICard from '@/components/common/KPICard'

export function LeaveSummaryCards({
  balances = [],
  stats = null,
  isStaffView = true,
  pendingCount = 0,
  upcomingCount = 0,
  role = 'employee'
}) {
  if (stats) {
    if (!isStaffView) {
      // Admin / HR Management Overview KPI Cards
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-left">
          <KPICard
            title="Total Employees"
            value={stats.annualBalance ?? stats.totalEmployees ?? 0}
            subtitle="Active headcount in HRMS"
            icon="users"
            color="blue"
          />
          <KPICard
            title="On Leave Today"
            value={stats.casualBalance ?? stats.onLeaveToday ?? 0}
            subtitle="Synchronized attendance roster"
            icon="calendar"
            color="amber"
          />
          <KPICard
            title="Approved Leaves"
            value={stats.sickBalance ?? stats.approvedLeaves ?? 0}
            subtitle="Granted within policy matrix"
            icon="check"
            color="emerald"
          />
          <KPICard
            title="Pending Review"
            value={stats.pendingRequests ?? 0}
            subtitle="Multi-tier review queue"
            icon="alerts"
            color="purple"
          />
        </div>
      )
    }

    // Staff view with stats object
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-left">
        <KPICard
          title="Annual Leave"
          value={`${stats.annualBalance ?? 14}d`}
          subtitle="Paid vacation balance available"
          icon="calendar"
          color="blue"
        />
        <KPICard
          title="Casual Leave"
          value={`${stats.casualBalance ?? 10}d`}
          subtitle="Half-day allowed • paid"
          icon="shifts"
          color="emerald"
        />
        <KPICard
          title="Sick Leave"
          value={`${stats.sickBalance ?? 8}d`}
          subtitle="Medical rest allocation"
          icon="attendance"
          color="purple"
        />
        <KPICard
          title="Pending Requests"
          value={stats.pendingRequests ?? 0}
          subtitle="In active approval flow"
          icon="alerts"
          color="amber"
        />
      </div>
    )
  }

  // Fallback to balances array
  const annual = balances.find((b) => b.leaveTypeCode === 'AL') || { availableBalance: 14, closingBalance: 14, utilized: 0 }
  const casual = balances.find((b) => b.leaveTypeCode === 'CL') || { availableBalance: 10, closingBalance: 10, utilized: 0 }
  const sick = balances.find((b) => b.leaveTypeCode === 'SL') || { availableBalance: 8, closingBalance: 8, utilized: 0 }
  const totalUtilized = balances.reduce((sum, b) => sum + (Number(b.utilized) || 0), 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-left">
      <KPICard
        title="Annual Leave"
        value={`${annual.availableBalance}d`}
        subtitle={`${annual.utilized || 0}d used • ${annual.closingBalance}d total`}
        icon="calendar"
        color="blue"
      />
      <KPICard
        title="Casual Leave"
        value={`${casual.availableBalance}d`}
        subtitle={`${casual.utilized || 0}d used • half-day allowed`}
        icon="shifts"
        color="emerald"
      />
      <KPICard
        title="Sick Leave"
        value={`${sick.availableBalance}d`}
        subtitle={`${sick.utilized || 0}d used • doc required > 2d`}
        icon="attendance"
        color="purple"
      />
      <KPICard
        title={role === 'manager' || role === 'hr_admin' || role === 'super_admin' ? 'Pending Review' : 'Total Consumed'}
        value={role === 'manager' || role === 'hr_admin' || role === 'super_admin' ? pendingCount : `${totalUtilized}d`}
        subtitle={upcomingCount > 0 ? `${upcomingCount} upcoming approved` : 'Policy compliant tracking'}
        icon="alerts"
        color="amber"
      />
    </div>
  )
}

export default LeaveSummaryCards
