import React from 'react'
import ReportViewer from '@/components/reports/ReportViewer'

export default function SuperAdminReportsPage() {
  return (
    <div className="space-y-4">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            Reports &amp; Analytics Center
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            Chartered Accountant-grade financial and workforce statements across 12 families with source reconciliation and zero graphs.
          </p>
        </div>
      </div>

      {/* Main Report Viewer */}
      <ReportViewer initialFamilyId="fam_org" initialReportId="RPT-ORG-001" />
    </div>
  )
}
