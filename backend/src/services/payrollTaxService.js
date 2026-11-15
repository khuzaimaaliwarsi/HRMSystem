/**
 * iSysware HRMS — Manual Payroll Tax Configuration & Statutory Obligation Service
 *
 * Requirements:
 * 1. Controlled strictly by Super Admin.
 * 2. Supports Tax ON/OFF, Percentage (%), Fixed Amount (PKR), and Employee-wise Overrides.
 * 3. Calculates deductions using the saved manual configuration.
 * 4. Stored persistently in PostgreSQL (organization_settings.settingsJson), with audit logs.
 * 5. Applies in Payroll Drafts, Payslips, Reports, and Net Payable calculations.
 * 6. Preserves historical Approved/Paid/Void runs; enables controlled recalculation of Drafts.
 * 7. Retains separate reporting of statutory FBR Section 149 tax obligations.
 */

import { prisma } from '../config/database.js'
import { calculateSalaryTax } from '../utils/tax.js'

export const DEFAULT_TAX_CONFIG = {
  enabled: true,
  mode: 'FBR_STATUTORY', // 'OFF' | 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FBR_STATUTORY'
  ratePercentage: 0,
  fixedAmount: 0,
  description: 'Statutory Pakistan FBR Section 149 progressive tax slabs',
  employeeOverrides: [],
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Default'
}

export const payrollTaxService = {
  /**
   * Retrieves the current manual tax configuration from PostgreSQL
   */
  async getTaxConfig() {
    const org = await prisma.organizationSetting.findFirst()
    if (!org) {
      return { ...DEFAULT_TAX_CONFIG }
    }

    const config = org.settingsJson?.payrollTaxConfig
    if (!config) {
      return { ...DEFAULT_TAX_CONFIG }
    }

    return {
      enabled: config.enabled !== false,
      mode: config.mode || (config.enabled === false ? 'OFF' : 'FBR_STATUTORY'),
      ratePercentage: Number(config.ratePercentage || 0),
      fixedAmount: Number(config.fixedAmount || 0),
      description: config.description || '',
      employeeOverrides: Array.isArray(config.employeeOverrides) ? config.employeeOverrides : [],
      updatedAt: config.updatedAt || org.updatedAt?.toISOString() || new Date().toISOString(),
      updatedBy: config.updatedBy || 'Super Admin',
      history: Array.isArray(org.settingsJson?.payrollTaxConfigHistory)
        ? org.settingsJson.payrollTaxConfigHistory.slice(-20)
        : []
    }
  },

  /**
   * Persistently saves manual tax configuration into PostgreSQL with Super Admin authorization and audit log
   */
  async updateTaxConfig(data, actorUser) {
    if (!actorUser) {
      const error = new Error('Authentication required.')
      error.code = 'UNAUTHORIZED'
      error.status = 401
      throw error
    }

    const roleUpper = String(actorUser.role || actorUser.backendRole || '').toUpperCase().replace(/[^A-Z]/g, '')
    if (roleUpper !== 'SUPERADMIN') {
      const error = new Error('Access Denied: Only Super Admin has legal authority to modify Payroll Tax Settings.')
      error.code = 'FORBIDDEN_SUPER_ADMIN_REQUIRED'
      error.status = 403
      throw error
    }

    // Validation
    const mode = String(data.mode || 'FBR_STATUTORY').toUpperCase()
    if (!['OFF', 'PERCENTAGE', 'FIXED_AMOUNT', 'FBR_STATUTORY'].includes(mode)) {
      const error = new Error("Invalid tax mode. Must be 'OFF', 'PERCENTAGE', 'FIXED_AMOUNT', or 'FBR_STATUTORY'.")
      error.code = 'INVALID_TAX_MODE'
      error.status = 400
      throw error
    }

    const ratePercentage = Math.max(0, Math.min(100, Number(data.ratePercentage || 0)))
    const fixedAmount = Math.max(0, Number(data.fixedAmount || 0))
    const enabled = data.enabled !== false && mode !== 'OFF'

    let org = await prisma.organizationSetting.findFirst()
    if (!org) {
      org = await prisma.organizationSetting.create({
        data: {
          companyName: 'iSysware Software Solutions',
          settingsJson: {}
        }
      })
    }

    const previousConfig = org.settingsJson?.payrollTaxConfig || { ...DEFAULT_TAX_CONFIG }

    // Preserve existing employee overrides safely if present historically
    const rawOverrides = Array.isArray(data.employeeOverrides)
      ? data.employeeOverrides
      : Array.isArray(previousConfig?.employeeOverrides)
        ? previousConfig.employeeOverrides
        : []
    const validatedOverrides = []
    for (const ov of rawOverrides) {
      if (!ov || (!ov.employeeId && !ov.employeeCode)) continue
      const ovMode = String(ov.mode || 'DEFAULT').toUpperCase()
      if (!['DEFAULT', 'OFF', 'PERCENTAGE', 'FIXED_AMOUNT', 'FBR_STATUTORY'].includes(ovMode)) {
        continue
      }
      validatedOverrides.push({
        employeeId: ov.employeeId || null,
        employeeCode: ov.employeeCode || null,
        employeeName: ov.employeeName || null,
        mode: ovMode,
        ratePercentage: Math.max(0, Math.min(100, Number(ov.ratePercentage || 0))),
        fixedAmount: Math.max(0, Number(ov.fixedAmount || 0)),
        reason: String(ov.reason || 'Individual employment agreement').trim()
      })
    }
    const actorLabel = `${actorUser.firstName || actorUser.name || actorUser.username || 'Super Admin'} (SUPER_ADMIN)`

    const newConfig = {
      enabled,
      mode: enabled ? mode : 'OFF',
      ratePercentage,
      fixedAmount,
      description: data.description ? String(data.description).trim() : '',
      employeeOverrides: validatedOverrides,
      updatedAt: new Date().toISOString(),
      updatedBy: actorLabel
    }

    const historyEntry = {
      id: `TAX-REV-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorUserId: actorUser.id,
      actorLabel,
      previousMode: previousConfig.mode || 'FBR_STATUTORY',
      newMode: newConfig.mode,
      previousPercentage: previousConfig.ratePercentage || 0,
      newPercentage: newConfig.ratePercentage,
      previousFixed: previousConfig.fixedAmount || 0,
      newFixed: newConfig.fixedAmount,
      overridesCount: validatedOverrides.length,
      reason: data.reason || 'Routine payroll tax policy adjustment'
    }

    const existingHistory = Array.isArray(org.settingsJson?.payrollTaxConfigHistory)
      ? org.settingsJson.payrollTaxConfigHistory
      : []

    const updatedSettingsJson = {
      ...(org.settingsJson || {}),
      payrollTaxConfig: newConfig,
      payrollTaxConfigHistory: [...existingHistory, historyEntry].slice(-50)
    }

    // Persist to PostgreSQL
    await prisma.organizationSetting.update({
      where: { id: org.id },
      data: { settingsJson: updatedSettingsJson }
    })

    // Record formal PostgreSQL audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUser.id,
        actorRole: 'SUPER_ADMIN',
        sourceModule: 'PAYROLL_TAX',
        actionType: 'UPDATE_TAX_CONFIG',
        entityName: 'PayrollTaxConfig',
        entityId: org.id,
        recordSnapshotBefore: previousConfig,
        recordSnapshotAfter: newConfig,
        reasonOrNotes: data.reason || 'Manual payroll tax configuration update'
      }
    }).catch((e) => console.warn('[PayrollTaxService] Audit log warning:', e.message))

    return {
      ...newConfig,
      history: updatedSettingsJson.payrollTaxConfigHistory.slice(-20)
    }
  },

  /**
   * Authoritative calculation: Resolves actual tax deduction and statutory liability for an employee
   * @param {object} employee - Employee object
   * @param {number} grossEarnings - Monthly gross earnings (Basic + Allowances + Overtime)
   * @param {Date|string} periodDate - Start date of the payroll period
   * @param {object} [taxConfig] - Active tax configuration (fetched if not passed)
   */
  async calculateEmployeeTax(employee, grossEarnings, periodDate = new Date(), taxConfig = null) {
    const config = taxConfig || (await this.getTaxConfig())
    const gross = Math.max(0, Number(grossEarnings) || 0)

    // 1. Statutory FBR Section 149 legal obligation (ALWAYS calculated for transparency and compliance)
    let statutoryResult = { monthlyTaxWithholding: 0, slabDescription: 'Exempt', ratePercent: 0 }
    try {
      statutoryResult = calculateSalaryTax(gross, 0, periodDate)
    } catch (e) {
      // Fallback if statutory schedule missing
      statutoryResult = { monthlyTaxWithholding: 0, slabDescription: 'Schedule Unavailable', ratePercent: 0 }
    }

    const statutoryLiability = Number(statutoryResult.monthlyTaxWithholding || 0)

    // Global organization-wide tax configuration (Employee-specific overrides removed from active evaluation)
    let actualTaxDeduction = 0
    let appliedMode = config.mode || 'FBR_STATUTORY'
    let appliedRate = null
    let appliedFixed = null

    if (!config.enabled || config.mode === 'OFF') {
      actualTaxDeduction = 0
      appliedMode = 'OFF'
    } else if (config.mode === 'PERCENTAGE') {
      appliedRate = Number(config.ratePercentage || 0)
      actualTaxDeduction = Math.round((gross * appliedRate) / 100)
      appliedMode = 'PERCENTAGE'
    } else if (config.mode === 'FIXED_AMOUNT') {
      appliedFixed = Number(config.fixedAmount || 0)
      actualTaxDeduction = Math.round(appliedFixed)
      appliedMode = 'FIXED_AMOUNT'
    } else {
      // FBR_STATUTORY
      actualTaxDeduction = statutoryLiability
      appliedMode = 'FBR_STATUTORY'
    }

    return {
      taxDeduction: actualTaxDeduction,
      statutoryTaxLiability: statutoryLiability,
      statutoryVariance: statutoryLiability - actualTaxDeduction,
      appliedTaxMode: appliedMode,
      appliedTaxRate: appliedRate,
      appliedTaxFixed: appliedFixed,
      statutorySlab: statutoryResult.slabDescription || 'Standard Slab'
    }
  },

  /**
   * Retrieves statutory tax compliance and variance analysis for a payroll period
   * @param {string} periodCode - e.g. "2026-11"
   */
  async getTaxComplianceSummary(periodCode) {
    if (!periodCode) {
      const error = new Error('periodCode is required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const period = await prisma.payrollPeriod.findUnique({
      where: { periodCode: String(periodCode).trim() },
      include: {
        runs: {
          where: { status: { not: 'VOID' } },
          orderBy: { runDate: 'desc' },
          take: 1,
          include: {
            entries: {
              include: {
                employee: {
                  select: {
                    id: true,
                    employeeCode: true,
                    firstName: true,
                    lastName: true,
                    department: { select: { name: true } }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!period || !period.runs?.[0]) {
      return {
        periodCode,
        hasRun: false,
        totalGross: 0,
        totalTaxWithheld: 0,
        statutoryTaxObligationTotal: 0,
        statutoryVariance: 0,
        entries: []
      }
    }

    const run = period.runs[0]
    let totalGross = 0
    let totalTaxWithheld = 0
    let totalStatutoryTax = 0

    const entriesCompliance = (run.entries || []).map((entry) => {
      const gross = Number(entry.grossEarnings || 0)
      const withheld = Number(entry.taxDeduction || 0)
      let statutory = 0
      try {
        statutory = calculateSalaryTax(gross, 0, period.startDate).monthlyTaxWithholding
      } catch (e) {
        statutory = 0
      }

      totalGross += gross
      totalTaxWithheld += withheld
      totalStatutoryTax += statutory

      return {
        employeeId: entry.employeeId,
        employeeCode: entry.employee?.employeeCode,
        employeeName: `${entry.employee?.firstName || ''} ${entry.employee?.lastName || ''}`.trim(),
        department: entry.employee?.department?.name || 'Unassigned',
        grossEarnings: gross,
        taxWithheld: withheld,
        statutoryTax: statutory,
        variance: statutory - withheld
      }
    })

    return {
      periodCode,
      runId: run.id,
      runNumber: run.runNumber,
      runStatus: run.status,
      hasRun: true,
      totalGross: Math.round(totalGross * 100) / 100,
      totalTaxWithheld: Math.round(totalTaxWithheld * 100) / 100,
      statutoryTaxObligationTotal: Math.round(totalStatutoryTax * 100) / 100,
      statutoryVariance: Math.round((totalStatutoryTax - totalTaxWithheld) * 100) / 100,
      entries: entriesCompliance
    }
  }
}

export default payrollTaxService
