/**
 * iSysware HRMS — Batch F06: Pakistan Salary Income Tax Service
 * Official Regulatory Reference: FBR (Federal Board of Revenue) Section 149 Withholding Slabs
 * Accurate calculation engine for Tax Year 2026-2027
 */

import { PAKISTAN_TAX_SLABS_TY2027 } from '../mocks/payrollData.js'
import { apiClient } from './apiClient.js'

class TaxService {
  constructor() {
    this.slabs = [...PAKISTAN_TAX_SLABS_TY2027]
  }

  /**
   * Get all active tax slabs for Tax Year 2026-2027
   */
  getTaxSlabs() {
    return this.slabs
  }

  getTaxConfig() {
    return {
      taxYear: '2026-2027',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2027-06-30',
      slabs: this.slabs.map((s) => ({
        ...s,
        min: s.minIncome,
        max: s.maxIncome === Infinity ? null : s.maxIncome,
        baseTax: s.fixedTax,
        ratePercent: s.ratePercent
      }))
    }
  }

  calculateMonthlyTax(options) {
    let monthlyIncome = 0
    if (typeof options === 'object' && options !== null) {
      monthlyIncome = options.projectedMonthlyTaxable || options.monthlyTaxableIncome || 0
    } else {
      monthlyIncome = Number(options) || 0
    }

    const calc = this.calculateSalaryTax(monthlyIncome)
    return {
      ...calc,
      annualTaxableIncome: calc.annualTaxableProjected,
      slabNumber: calc.applicableSlabNumber,
      slabRate: calc.ratePercent,
      annualTaxLiability: calc.annualTaxLiability,
      effectiveTaxRate: calc.effectiveTaxRatePercent,
      monthlyTaxWithheld: calc.monthlyTaxWithholding,
      monthlyTax: calc.monthlyTaxWithholding
    }
  }

  /**
   * Calculate annual and monthly salary withholding tax for a given taxable gross salary
   * @param {number} monthlyTaxableIncome - Total taxable monthly income (Basic + Taxable Allowances + Commissions + Overtime)
   * @param {number} additionalAnnualTaxable - One-time bonuses or non-recurring taxable earnings
   * @returns {object} Tax breakdown including slab, annualized amount, annual tax, and monthly tax
   */
  calculateSalaryTax(monthlyTaxableIncome, additionalAnnualTaxable = 0) {
    const monthlyIncome = Math.max(0, Number(monthlyTaxableIncome) || 0)
    const annualProjected = Math.round((monthlyIncome * 12) + (Number(additionalAnnualTaxable) || 0))

    let applicableSlab = null
    let annualTax = 0

    for (const slab of this.slabs) {
      if (annualProjected > slab.minIncome && annualProjected <= slab.maxIncome) {
        applicableSlab = slab
        const taxableExcess = annualProjected - slab.minIncome
        annualTax = Math.round(slab.fixedTax + (taxableExcess * (slab.ratePercent / 100)))
        break
      }
    }

    if (!applicableSlab) {
      applicableSlab = this.slabs[0]
      annualTax = 0
    }

    // Monthly withholding deduction
    const monthlyTax = Math.round(annualTax / 12)

    return {
      annualTaxableProjected: annualProjected,
      applicableSlabNumber: applicableSlab.slabNumber,
      slabDescription: applicableSlab.description,
      fixedTax: applicableSlab.fixedTax,
      ratePercent: applicableSlab.ratePercent,
      taxableExcess: Math.max(0, annualProjected - applicableSlab.minIncome),
      annualTaxLiability: annualTax,
      monthlyTaxWithholding: monthlyTax,
      effectiveTaxRatePercent: annualProjected > 0 ? Math.round((annualTax / annualProjected) * 10000) / 100 : 0
    }
  }

  /**
   * Classify allowances and components into taxable vs exempt
   * Note: Under Pakistan tax law, Medical Allowance up to 10% of basic is exempt if hospitalization is not provided.
   */
  classifyTaxableComponents(basicSalary, allowances = [], commission = 0, overtimePay = 0, bonus = 0) {
    const basic = Number(basicSalary) || 0
    let taxableAllowances = 0
    let exemptAllowances = 0

    const allowanceBreakdown = allowances.map((alw) => {
      const amt = Number(alw.amount) || 0
      let taxable = amt
      let exempt = 0

      if (alw.code === 'MED') {
        const statutoryExemptLimit = Math.round(basic * 0.10)
        exempt = Math.min(amt, statutoryExemptLimit)
        taxable = Math.max(0, amt - exempt)
      } else if (!alw.isTaxable) {
        exempt = amt
        taxable = 0
      }

      taxableAllowances += taxable
      exemptAllowances += exempt

      return {
        ...alw,
        taxableAmount: taxable,
        exemptAmount: exempt
      }
    })

    const taxableMonthlyGross = basic + taxableAllowances + (Number(commission) || 0) + (Number(overtimePay) || 0)
    const exemptMonthlyGross = exemptAllowances

    return {
      basicSalary: basic,
      taxableAllowances,
      exemptAllowances,
      allowanceBreakdown,
      commissionTaxable: Number(commission) || 0,
      overtimeTaxable: Number(overtimePay) || 0,
      bonusTaxable: Number(bonus) || 0,
      totalTaxableMonthly: taxableMonthlyGross,
      totalExemptMonthly: exemptMonthlyGross
    }
  }

  /**
   * Retrieves active manual tax configuration from PostgreSQL backend
   */
  async getPayrollTaxConfig() {
    try {
      const res = await apiClient.get('/payroll/tax-config')
      return res?.data || res
    } catch (e) {
      console.warn('[TaxService] Failed to load remote tax config:', e.message)
      return {
        enabled: true,
        mode: 'FBR_STATUTORY',
        ratePercentage: 0,
        fixedAmount: 0,
        employeeOverrides: []
      }
    }
  }

  /**
   * Persistently updates manual tax configuration (Super Admin only)
   */
  async updatePayrollTaxConfig(payload) {
    const res = await apiClient.put('/payroll/tax-config', payload)
    return res?.data || res
  }

  /**
   * Controlled recalculation of Draft / Pending Approval payroll run tax
   */
  async recalculatePayrollRunTax(runId) {
    const res = await apiClient.post(`/payroll/runs/${runId}/recalculate-tax`)
    return res?.data || res
  }

  /**
   * Retrieves statutory tax obligation and variance breakdown
   */
  async getTaxCompliance(periodCode) {
    const res = await apiClient.get(`/payroll/tax-compliance/${periodCode}`)
    return res?.data || res
  }
}

export const taxService = new TaxService()
export default taxService
