/**
 * iSysware HRMS — Pakistan Salary Income Tax Engine (FBR Section 149)
 * Official Regulatory Reference: FBR Withholding Tax Slabs (Tax Year 2026-2027)
 * Configurable, effective-dated, auditable, and precision-safe tax calculation.
 */

export const STATUTORY_TAX_SCHEDULES = [
  {
    taxYear: '2025-2026',
    effectiveFrom: new Date('2025-07-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-06-30T23:59:59.999Z'),
    regulatoryAuthority: 'Federal Board of Revenue (FBR) Pakistan',
    statuteReference: 'Income Tax Ordinance 2001, Section 149 - First Schedule, Part I, Division I',
    slabs: [
      {
        slabNumber: 1,
        minIncome: 0,
        maxIncome: 600000,
        fixedTax: 0,
        ratePercent: 0,
        description: 'Up to PKR 600,000 / year: Tax Exempt (0%)'
      },
      {
        slabNumber: 2,
        minIncome: 600000,
        maxIncome: 1200000,
        fixedTax: 0,
        ratePercent: 5,
        description: 'PKR 600,001 to 1,200,000 / year: 5% of amount exceeding 600,000'
      },
      {
        slabNumber: 3,
        minIncome: 1200000,
        maxIncome: 2200000,
        fixedTax: 30000,
        ratePercent: 15,
        description: 'PKR 1,200,001 to 2,200,000 / year: PKR 30,000 + 15% of amount exceeding 1,200,000'
      },
      {
        slabNumber: 4,
        minIncome: 2200000,
        maxIncome: 3200000,
        fixedTax: 180000,
        ratePercent: 25,
        description: 'PKR 2,200,001 to 3,200,000 / year: PKR 180,000 + 25% of amount exceeding 2,200,000'
      },
      {
        slabNumber: 5,
        minIncome: 3200000,
        maxIncome: 4100000,
        fixedTax: 430000,
        ratePercent: 30,
        description: 'PKR 3,200,001 to 4,100,000 / year: PKR 430,000 + 30% of amount exceeding 3,200,000'
      },
      {
        slabNumber: 6,
        minIncome: 4100000,
        maxIncome: Infinity,
        fixedTax: 700000,
        ratePercent: 35,
        description: 'Exceeding PKR 4,100,000 / year: PKR 700,000 + 35% of amount exceeding 4,100,000'
      }
    ]
  },
  {
    taxYear: '2026-2027',
    effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
    effectiveTo: new Date('2027-06-30T23:59:59.999Z'),
    regulatoryAuthority: 'Federal Board of Revenue (FBR) Pakistan',
    statuteReference: 'Income Tax Ordinance 2001, Section 149 - First Schedule, Part I, Division I',
    slabs: [
      {
        slabNumber: 1,
        minIncome: 0,
        maxIncome: 600000,
        fixedTax: 0,
        ratePercent: 0,
        description: 'Up to PKR 600,000 / year: Tax Exempt (0%)'
      },
      {
        slabNumber: 2,
        minIncome: 600000,
        maxIncome: 1200000,
        fixedTax: 0,
        ratePercent: 5,
        description: 'PKR 600,001 to 1,200,000 / year: 5% of amount exceeding 600,000'
      },
      {
        slabNumber: 3,
        minIncome: 1200000,
        maxIncome: 2200000,
        fixedTax: 30000,
        ratePercent: 15,
        description: 'PKR 1,200,001 to 2,200,000 / year: PKR 30,000 + 15% of amount exceeding 1,200,000'
      },
      {
        slabNumber: 4,
        minIncome: 2200000,
        maxIncome: 3200000,
        fixedTax: 180000,
        ratePercent: 25,
        description: 'PKR 2,200,001 to 3,200,000 / year: PKR 180,000 + 25% of amount exceeding 2,200,000'
      },
      {
        slabNumber: 5,
        minIncome: 3200000,
        maxIncome: 4100000,
        fixedTax: 430000,
        ratePercent: 30,
        description: 'PKR 3,200,001 to 4,100,000 / year: PKR 430,000 + 30% of amount exceeding 3,200,000'
      },
      {
        slabNumber: 6,
        minIncome: 4100000,
        maxIncome: Infinity,
        fixedTax: 700000,
        ratePercent: 35,
        description: 'Exceeding PKR 4,100,000 / year: PKR 700,000 + 35% of amount exceeding 4,100,000'
      }
    ]
  }
]

/**
 * Resolves active statutory tax schedule for a given date.
 * Throws explicit error when required configuration is missing.
 */
export function getTaxScheduleForDate(date = new Date()) {
  const targetDate = new Date(date)

  const schedule = STATUTORY_TAX_SCHEDULES.find(
    (s) => targetDate >= s.effectiveFrom && targetDate <= s.effectiveTo
  )

  if (!schedule) {
    const error = new Error(`Missing Tax Configuration: No statutory tax schedule configured for date '${targetDate.toISOString().slice(0, 10)}'.`)
    error.code = 'MISSING_TAX_CONFIGURATION'
    error.status = 500
    throw error
  }

  return schedule
}

/**
 * Calculates progressive salary withholding tax per Pakistan FBR Section 149.
 * @param {number} monthlyTaxableIncome - Taxable earnings (Basic + Allowances + Overtime)
 * @param {number} [additionalAnnualTaxable=0] - Bonuses or irregular taxable earnings
 * @param {Date|string} [taxDate=new Date()] - Effective date for resolving statutory tax schedule
 * @returns {object} Detailed tax breakdown including applicable slab and monthly withholding
 */
export function calculateSalaryTax(monthlyTaxableIncome, additionalAnnualTaxable = 0, taxDate = new Date()) {
  const schedule = getTaxScheduleForDate(taxDate)
  const monthlyIncome = Math.max(0, Number(monthlyTaxableIncome) || 0)
  const annualProjected = Math.round(monthlyIncome * 12 + (Number(additionalAnnualTaxable) || 0))

  let applicableSlab = null
  let annualTax = 0

  for (const slab of schedule.slabs) {
    if (annualProjected > slab.minIncome && annualProjected <= slab.maxIncome) {
      applicableSlab = slab
      const taxableExcess = annualProjected - slab.minIncome
      annualTax = Math.round(slab.fixedTax + taxableExcess * (slab.ratePercent / 100))
      break
    }
  }

  if (!applicableSlab) {
    applicableSlab = schedule.slabs[0]
    annualTax = 0
  }

  const monthlyTaxWithholding = Math.round(annualTax / 12)

  return {
    taxYear: schedule.taxYear,
    effectiveFrom: schedule.effectiveFrom,
    effectiveTo: schedule.effectiveTo,
    annualTaxableProjected: annualProjected,
    applicableSlabNumber: applicableSlab.slabNumber,
    slabDescription: applicableSlab.description,
    fixedTax: applicableSlab.fixedTax,
    ratePercent: applicableSlab.ratePercent,
    taxableExcess: Math.max(0, annualProjected - applicableSlab.minIncome),
    annualTaxLiability: annualTax,
    monthlyTaxWithholding,
    effectiveTaxRatePercent:
      annualProjected > 0 ? Math.round((annualTax / annualProjected) * 10000) / 100 : 0
  }
}
