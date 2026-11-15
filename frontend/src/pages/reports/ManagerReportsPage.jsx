import React from 'react'
import ReportViewer from '@/components/reports/ReportViewer'

export default function ManagerReportsPage({ isTeamLead = false }) {
  return (
    <div className="space-y-4">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            {isTeamLead ? 'Team Lead Reports & Analytics' : 'Team Reports & Analytics'}
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            Supervisory attendance, leaves, deliverables, KPIs, and training reports for your assigned team members (zero salary leakage).
          </p>
        </div>
      </div>

      {/* Main Report Viewer scoped to Manager / Team Lead */}
      <ReportViewer initialFamilyId="fam_att" initialReportId="RPT-ATT-001" />
    </div>
  )
}
