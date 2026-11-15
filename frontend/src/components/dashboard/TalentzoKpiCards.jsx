import React from 'react'
import KPICard from '@/components/common/KPICard'

export function TalentzoKpiCards({
  totalEmployees = 0,
  jobApplications = '0',
  pendingApprovals = 0,
  payrollProgress = 0,
  totalEmployeesSubtitle,
  jobApplicationsSubtitle,
  pendingApprovalsSubtitle,
  payrollProgressSubtitle
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-left">
      <KPICard
        title="Total Employees"
        value={totalEmployees}
        subtitle={totalEmployeesSubtitle || (totalEmployees > 0 ? 'Active workforce count' : '0 staff registered')}
        icon="users"
        color="indigo"
      />
      <KPICard
        title="Job Applications"
        value={jobApplications}
        subtitle={jobApplicationsSubtitle || 'Active pipeline'}
        icon="recruitment"
        color="cyan"
      />
      <KPICard
        title="Pending Approvals"
        value={pendingApprovals}
        subtitle={pendingApprovalsSubtitle || (pendingApprovals > 0 ? `${pendingApprovals} pending review` : 'All clear')}
        icon="alerts"
        color="amber"
      />
      <KPICard
        title="Payroll Progress"
        value={typeof payrollProgress === 'string' ? payrollProgress : `${payrollProgress}%`}
        subtitle={payrollProgressSubtitle || (payrollProgress > 0 ? `${100 - (Number(payrollProgress) || 0)}% remaining` : 'No active cycle')}
        icon="payroll"
        color="emerald"
      />
    </div>
  )
}

export default TalentzoKpiCards
