import React from 'react'
import ReportViewer from '@/components/reports/ReportViewer'

export default function EmployeeReportsPage() {
  return (
    <div className="space-y-4">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            My Reports &amp; Statements
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            Personal downloadable attendance statements, leave balances, payslip summaries, tax withholding certificates, and travel records.
          </p>
        </div>
      </div>

      {/* Main Report Viewer scoped to Employee */}
      <ReportViewer initialFamilyId="fam_att" initialReportId="RPT-ATT-001" />
    </div>
  )
}
