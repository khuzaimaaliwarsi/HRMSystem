import React from 'react'
import ReportViewer from '@/components/reports/ReportViewer'

export default function HrAdminReportsPage() {
  return (
    <div className="space-y-4">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            HR Operational Reports &amp; Analytics
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            Authoritative workforce, attendance, leaves, recruitment, training, expenses, and operational statements with real PDF &amp; Excel exports.
          </p>
        </div>
      </div>

      {/* Main Report Viewer */}
      <ReportViewer initialFamilyId="fam_org" initialReportId="RPT-ORG-001" />
    </div>
  )
}
