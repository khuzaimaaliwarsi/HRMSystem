/**
 * iSysware HRMS — F14 Canonical Report Service
 * Master orchestrator for Report Registry, Role Scoping, Aggregation, and Export Preflight.
 */

import { REPORT_FAMILIES, REPORT_REGISTRY } from './reportRegistry.js'
import { reportDataFetcher } from './reportDataFetcher.js'
import { auditService } from './auditService.js'

class ReportService {
  constructor() {
    this.families = REPORT_FAMILIES
    this.registry = REPORT_REGISTRY
  }

  /**
   * Get all report families
   */
  getFamilies() {
    return this.families
  }

  /**
   * Get reports filtered by family and user role
   */
  getReports(familyId = null, user = null) {
    let list = this.registry

    if (familyId && familyId !== 'all') {
      list = list.filter((r) => r.familyId === familyId)
    }

    if (user?.role) {
      list = list.filter((r) => {
        if (!r.allowedRoles || r.allowedRoles.length === 0) return true
        return r.allowedRoles.includes(user.role)
      })
    }

    return list
  }

  /**
   * Get report definition by ID
   */
  getReportById(reportId) {
    return this.registry.find((r) => r.id === reportId) || null
  }

  /**
   * Generate canonical report dataset with calculations, totals, and metadata
   */
  generateReport(reportId, filters = {}, user = null) {
    const report = this.getReportById(reportId)
    if (!report) {
      throw new Error(`Report with ID '${reportId}' not found in canonical registry.`)
    }

    // Role-based Access Control
    if (user?.role && report.allowedRoles && !report.allowedRoles.includes(user.role)) {
      throw new Error(
        `Access Denied: Role '${user.role}' is not authorized to access protected report '${report.name}' (${report.id}).`
      )
    }

    // Fetch data using registered data fetcher
    const fetcher = reportDataFetcher[reportId]
    let result = { rows: [], summary: {}, reconciliation: { reconciled: true } }

    if (typeof fetcher === 'function') {
      try {
        result = fetcher(filters, user)
      } catch (err) {
        console.error(`Error fetching data for ${reportId}:`, err)
        result = { rows: [], summary: {}, reconciliation: { reconciled: false, error: err.message } }
      }
    }

    // Apply any general search or status filters on rows
    let rows = result.rows || []
    if (filters?.status && filters.status !== 'all') {
      const targetStatus = filters.status.toLowerCase()
      rows = rows.filter((r) => {
        const val = String(r.status || r.employmentStatus || r.verificationStatus || r.dueStatus || r.decision || '').toLowerCase()
        if (targetStatus === 'active') {
          return val === 'active' || (val && !val.includes('inactive') && !val.includes('suspended') && !val.includes('terminated') && !val.includes('separated'))
        }
        if (targetStatus === 'inactive') {
          return val.includes('inactive') || val.includes('suspended') || val.includes('terminated') || val.includes('separated')
        }
        return val.includes(targetStatus)
      })
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase()
      rows = rows.filter((r) => {
        return Object.values(r).some((v) => String(v).toLowerCase().includes(q))
      })
    }

    // Compute column-wise grand totals for numeric/currency columns
    const totals = {}
    report.columns.forEach((col) => {
      if (col.type === 'number' || col.type === 'currency') {
        const sum = rows.reduce((acc, row) => {
          const val = Number(row[col.key]) || 0
          return acc + val
        }, 0)
        totals[col.key] = Math.round(sum * 100) / 100
      } else {
        totals[col.key] = null
      }
    })

    // Metadata block
    const metadata = {
      reportId: report.id,
      reportName: report.name,
      familyName: this.families.find((f) => f.id === report.familyId)?.name || 'General Reports',
      generatedAt: new Date().toISOString(),
      generatedAtFormatted: new Date().toLocaleString('en-PK', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      }),
      generatedBy: user ? `${user.name} (${user.role.replace('_', ' ').toUpperCase()})` : 'System Administrator',
      periodLabel: filters?.dateRange?.label || 'Current Period',
      appliedFilters: {
        department: filters?.departmentName || 'All Authorized',
        team: filters?.teamName || 'All Teams',
        employee: filters?.employeeName || 'All Permitted',
        dateRange: filters?.dateRange?.label || 'All Dates'
      },
      confidentialityNotice: report.allowedRoles.includes('employee')
        ? 'Internal Use Only — iSysware HRMS'
        : 'STRICTLY CONFIDENTIAL — Authorized Personnel Only',
      recordCount: rows.length
    }

    // Audit log for report generation
    try {
      auditService.logEvent({
        actor: metadata.generatedBy,
        action: 'REPORT_VIEW',
        module: 'Reports & Analytics',
        details: `Generated ${report.name} (${report.id}) - ${(rows || []).length} records`,
        severity: (report?.allowedRoles || []).length <= 2 ? 'High' : 'Normal'
      })
    } catch {
      // ignore
    }

    return {
      report,
      columns: report.columns,
      rows,
      summary: result.summary || {},
      totals,
      reconciliation: result.reconciliation || { reconciled: true },
      metadata
    }
  }
}

export const reportService = new ReportService()
