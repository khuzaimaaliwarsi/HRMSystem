import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { reportService } from '@/services/reportService'
import { employeeService } from '@/services/employeeService'
import AppIcon from '@/components/common/AppIcon'
import ReportFilters from './ReportFilters'
import ReportSummary from './ReportSummary'
import ReportTable from './ReportTable'
import ReportExportActions from './ReportExportActions'

function normalizeFamilyId(id) {
  if (!id) return 'fam_org'
  const map = {
    fam_prf: 'fam_per',
    fam_perf: 'fam_per',
    fam_performance: 'fam_per',
    fam_hld: 'fam_hlp',
    fam_help: 'fam_hlp'
  }
  return map[id] || id
}

export default function ReportViewer({ initialFamilyId = 'fam_org', initialReportId = 'RPT-ORG-001' }) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const families = useMemo(() => reportService.getFamilies(), [])

  const rawFamilyFromUrl = searchParams.get('family')
  const familyFromUrl = normalizeFamilyId(rawFamilyFromUrl)
  const reportFromUrl = searchParams.get('report')

  // Selected family state
  const [selectedFamilyId, setSelectedFamilyId] = useState(() => familyFromUrl || initialFamilyId)

  // Sync with URL query parameter changes
  useEffect(() => {
    if (familyFromUrl && families.some((f) => f.id === familyFromUrl)) {
      setSelectedFamilyId(familyFromUrl)
    }
  }, [familyFromUrl, families])

  // Reports permitted for this user within selected family
  const availableReports = useMemo(() => {
    return reportService.getReports(selectedFamilyId, user)
  }, [selectedFamilyId, user])

  // Selected report state
  const [selectedReportId, setSelectedReportId] = useState(() => {
    if (reportFromUrl) return reportFromUrl
    const defaultRpt = availableReports.find((r) => r.id === initialReportId) || availableReports[0]
    return defaultRpt?.id || 'RPT-ORG-001'
  })

  useEffect(() => {
    if (reportFromUrl) {
      setSelectedReportId(reportFromUrl)
    }
  }, [reportFromUrl])

  // Ensure selected report is always strictly valid within the current family
  useEffect(() => {
    if (availableReports.length > 0) {
      const exists = availableReports.some((r) => r.id === selectedReportId)
      if (!exists) {
        setSelectedReportId(availableReports[0].id)
      }
    }
  }, [availableReports, selectedReportId])

  // Keep selected report valid when family changes
  const currentFamily = useMemo(() => {
    return families.find((f) => f.id === selectedFamilyId) || families[0]
  }, [families, selectedFamilyId])

  const activeReport = useMemo(() => {
    const found = availableReports.find((r) => r.id === selectedReportId)
    return found || availableReports[0] || null
  }, [availableReports, selectedReportId])

  // Reference data for filters
  const departments = useMemo(() => employeeService.getDepartments(), [])
  const teams = useMemo(() => employeeService.getTeams(), [])
  const employees = useMemo(() => {
    if (user?.role === 'employee') {
      const emp = employeeService.getEmployeeById(user.employeeId || user.id)
      return emp ? [emp] : []
    }
    if (user?.role === 'team_lead') {
      const tlId = user.employeeId || user.id
      return employeeService.getAuthorizedTeamEmployees(tlId, 'team_lead')
    }
    if (user?.role === 'manager') {
      const mgrId = user.employeeId || user.id
      return employeeService.getAuthorizedTeamEmployees(mgrId, 'manager')
    }
    return employeeService.getEmployees()
  }, [user])

  // Filters state (Default to 'active' status so inactive/suspended staff are excluded by default)
  const [filters, setFilters] = useState({
    datePreset: 'thisMonth',
    departmentId: 'all',
    departmentName: 'All Departments',
    teamId: 'all',
    teamName: 'All Teams',
    employeeId: 'all',
    employeeName: 'All Permitted',
    status: 'active',
    search: ''
  })

  // Execute report generation with active filters and user role
  const reportResult = useMemo(() => {
    if (!activeReport) return null
    try {
      return reportService.generateReport(activeReport.id, filters, user)
    } catch (err) {
      console.error('Report generation error:', err)
      return null
    }
  }, [activeReport, filters, user])

  const handleResetFilters = () => {
    setFilters({
      datePreset: 'thisMonth',
      departmentId: 'all',
      departmentName: 'All Departments',
      teamId: 'all',
      teamName: 'All Teams',
      employeeId: 'all',
      employeeName: 'All Permitted',
      status: 'active',
      search: ''
    })
  }

  return (
    <div className="space-y-4">
      {/* REPORT SELECTOR & REPORT HEADER */}
      <div className="bg-white border border-hrms-border rounded-lg p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-hrms-border/70">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-white bg-[#102746] px-2.5 py-0.5 rounded tracking-wide font-mono">
                {activeReport?.id || 'RPT'}
              </span>
              <h2 className="text-lg font-bold text-hrms-text tracking-tight">
                {activeReport?.name || 'Select a Report'}
              </h2>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {activeReport?.orientation === 'landscape' ? 'A4 Landscape' : 'A4 Portrait'}
              </span>
            </div>
            <p className="text-xs text-hrms-muted max-w-3xl">
              {activeReport?.description}
            </p>
          </div>

          {/* Export Actions Toolbar */}
          <div className="flex items-center gap-3">
            <ReportExportActions reportResult={reportResult} />
          </div>
        </div>

        {/* Family & Report Selector Controls */}
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-hrms-text whitespace-nowrap min-w-[80px]">
              Report Family:
            </span>
            <select
              value={selectedFamilyId}
              onChange={(e) => {
                const newFamId = e.target.value
                setSelectedFamilyId(newFamId)
                const newRpts = reportService.getReports(newFamId, user)
                const firstRptId = newRpts[0]?.id || ''
                if (firstRptId) setSelectedReportId(firstRptId)
                setSearchParams({ family: newFamId, ...(firstRptId ? { report: firstRptId } : {}) })
              }}
              className="flex-1 text-xs h-8 px-2.5 bg-slate-50 border border-hrms-border rounded-md text-slate-900 font-medium focus:ring-1 focus:ring-hrms-primary focus:outline-none"
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-hrms-text whitespace-nowrap min-w-[80px]">
              Active Report:
            </span>
            <select
              value={selectedReportId}
              onChange={(e) => {
                setSelectedReportId(e.target.value)
                setSearchParams({ family: selectedFamilyId, report: e.target.value })
              }}
              className="flex-1 text-xs h-8 px-2.5 bg-slate-50 border border-hrms-border rounded-md text-slate-900 font-medium focus:ring-1 focus:ring-hrms-primary focus:outline-none"
            >
              {availableReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}. {r.name} ({r.id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* COMPACT FILTER BAR */}
      <ReportFilters
        departments={departments}
        teams={teams}
        employees={employees}
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* NUMERICAL SUMMARY METRIC CARDS (ZERO GRAPHS) */}
      {reportResult?.summary && Object.keys(reportResult.summary).length > 0 && (
        <ReportSummary summary={reportResult.summary} />
      )}

      {/* MAIN DENSE AUDIT TABLE */}
      {reportResult && (
        <ReportTable
          columns={reportResult.columns}
          rows={reportResult.rows}
          totals={reportResult.totals}
          metadata={reportResult.metadata}
          reconciliation={reportResult.reconciliation}
        />
      )}
    </div>
  )
}
