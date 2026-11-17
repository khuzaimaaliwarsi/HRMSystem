/**
 * iSysware HRMS — Authoritative Monthly Payroll Processing Engine
 *
 * OWNER-APPROVED PAYROLL RULES (BATCH 6B):
 * 1. FIXED 31-DAY DIVISOR: Daily Basic Rate = Monthly Basic Salary / 31 (always, all months).
 *    Full monthly basic salary is preserved for fully eligible employees.
 *    Unpaid Deduction = (Monthly Basic Salary / 31) * Unpaid Days.
 * 2. MONTHLY 2 PAID LEAVES: Exactly 2 eligible paid leave days allowed per calendar month.
 *    Any approved leave days exceeding 2 in that calendar month are unpaid and deducted from salary.
 * 3. 31-DAY HOURLY OVERTIME: Hourly Rate = (Monthly Basic Salary / 31) / Standard Paid Shift Hours.
 *    Overtime Pay = Approved Hours * Hourly Rate * Configured Multiplier (default 1.5x).
 * 4. LOAN REPAYMENT INTEGRATION: Disbursed loans deducted in payroll and ledger repayments stamped.
 * 5. PAYMENT INTEGRITY: Run marked PAID only when authorized disbursement transaction is executed.
 */

import { prisma } from '../config/database.js'
import { Prisma } from '@prisma/client'
import { calculateSalaryTax } from '../utils/tax.js'
import { shiftService } from './shiftService.js'
import { loanService } from './loanService.js'
import { getKarachiDate } from '../utils/time.js'
import { payrollTaxService } from './payrollTaxService.js'

function toUtcCalendarDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const NON_CANONICAL_PERIOD_SUFFIX = /(?:-TEST|-6B|-QA)$/i

function isEmployeeEligibleForPeriod(emp, periodStartStr, periodEndStr) {
  if (!emp || emp.employmentStatus !== 'ACTIVE') return false
  const joinedStr = toUtcCalendarDate(emp.joiningDate)
  if (joinedStr && periodEndStr && joinedStr > periodEndStr) return false
  const terminatedStr = toUtcCalendarDate(emp.terminationDate)
  if (terminatedStr && periodStartStr && terminatedStr < periodStartStr) return false
  return true
}

function daysInclusive(from, until) {
  return Math.floor((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1
}

function salaryForPayrollPeriod(emp, start, end) {
  const allStructures = Array.isArray(emp?.salaryStructures) ? emp.salaryStructures : []
  const currentStruct = allStructures.find(s => s.isCurrent)
  const currentDate = currentStruct ? toUtcCalendarDate(currentStruct.effectiveFrom) : null

  const structures = allStructures.filter(s => {
    const from = toUtcCalendarDate(s.effectiveFrom)
    const until = toUtcCalendarDate(s.effectiveUntil)
    if (!s.isCurrent && until && from && until <= from) return false
    if (!s.isCurrent && currentStruct && from === currentDate) return false
    return (!from || from <= end) && (!until || until >= start)
  }).sort((a, b) => (toUtcCalendarDate(a.effectiveFrom) || '').localeCompare(toUtcCalendarDate(b.effectiveFrom) || ''))
  if (!structures.length) return null

  // Historical snapshots are retained.
  // Baseline structure: latest structure starting on or before period start, or current structure, or latest structure
  const pastStructures = structures.filter(s => toUtcCalendarDate(s.effectiveFrom) <= start)
  const baseline = pastStructures.length ? pastStructures.at(-1) : (structures.find(s => s.isCurrent) || structures.at(-1) || structures[0])
  let basic = Number(baseline.baseSalary)
  let startingBasic = basic
  let houseRent = Number(baseline.houseRentAllowance || 0)
  let medical = Number(baseline.medicalAllowance || 0)
  let conveyance = Number(baseline.conveyanceAllowance || 0)
  let special = Number(baseline.specialAllowance || 0)

  const baselineFrom = toUtcCalendarDate(baseline.effectiveFrom)
  let events = structures.filter(s => {
    const date = toUtcCalendarDate(s.effectiveFrom)
    return date > start && date <= end && (!baselineFrom || date > baselineFrom)
  }).map(s => ({ date: toUtcCalendarDate(s.effectiveFrom), basic: Number(s.baseSalary), source: 'structure' }))

  for (const revision of emp.salaryRevisions || []) {
    if (revision.status !== 'APPROVED') continue
    const date = toUtcCalendarDate(revision.effectiveDate)
    if (!date || date > end) continue
    const matched = structures.some(s => toUtcCalendarDate(s.effectiveFrom) === date && Math.abs(Number(s.baseSalary) - Number(revision.proposedBaseSalary)) < 0.01)
    if (matched) continue
    if (date <= start) {
      // A past approved revision not materialized in structures must still be honored.
      if (Math.abs(Number(revision.previousBaseSalary) - basic) < 0.01) {
        basic = Number(revision.proposedBaseSalary)
        startingBasic = basic
      }
    } else {
      events.push({ date, basic: Number(revision.proposedBaseSalary), previous: Number(revision.previousBaseSalary), source: 'revision' })
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || (a.source === 'structure' ? 1 : -1))
  let effectiveBasic = basic
  for (const event of events) {
    if (event.source === 'revision' && Math.abs((event.previous ?? effectiveBasic) - effectiveBasic) > 0.01) {
      const error = new Error('Conflicting approved salary revision chain; reconcile salary structure history before payroll.')
      error.code = 'SALARY_HISTORY_CONFLICT'
      error.status = 409
      throw error
    }
    const next = event.basic
    effectiveBasic += (next - basic) * daysInclusive(event.date, end) / 31
    basic = next
  }

  // Dynamic employee allowances with double counting prevention
  let dynamicAllowancesTotal = 0
  const dynamicAllowancesList = []
  for (const alloc of emp.allowanceAllocations || []) {
    if (!alloc.isActive) continue
    const allocFrom = toUtcCalendarDate(alloc.effectiveFrom)
    const allocUntil = toUtcCalendarDate(alloc.effectiveUntil)
    if (allocFrom && allocFrom > end) continue
    if (allocUntil && allocUntil < start) continue

    const code = String(alloc.allowance?.code || '').toUpperCase()
    const cat = String(alloc.allowance?.category || '').toUpperCase()

    // Prevent duplicate calculation when allowance already exists within SalaryStructure
    if ((['RENT', 'HOUSE_RENT', 'HRA'].includes(code) || ['HOUSE_RENT_ALLOWANCE', 'HOUSE_RENT'].includes(cat)) && houseRent > 0) {
      continue
    }
    if ((['MED', 'MEDICAL'].includes(code) || cat === 'MEDICAL') && medical > 0) {
      continue
    }
    if ((['CONV', 'CONVEYANCE', 'TRANSPORT'].includes(code) || ['CONVEYANCE', 'TRANSPORT'].includes(cat)) && conveyance > 0) {
      continue
    }
    if ((code === 'SPECIAL' || cat === 'SPECIAL') && special > 0) {
      continue
    }

    const allocAmt = Number(alloc.amount || 0)
    let effectiveAllocAmt = allocAmt
    // Prorate under 31-day divisor if allocation starts mid-month
    if (allocFrom && allocFrom > start && allocFrom <= end) {
      const days = daysInclusive(allocFrom, end)
      effectiveAllocAmt = Math.round(((allocAmt * days) / 31) * 100) / 100
    }
    dynamicAllowancesTotal += effectiveAllocAmt
    dynamicAllowancesList.push({
      id: alloc.id,
      name: alloc.allowance?.name || 'Dynamic Allowance',
      code: alloc.allowance?.code || 'ALLOWANCE',
      amount: effectiveAllocAmt,
      fullAmount: allocAmt,
      isTaxable: alloc.allowance?.isTaxable !== false
    })
  }

  const structureAllowances = houseRent + medical + conveyance + special
  const totalAllowances = Math.round((structureAllowances + dynamicAllowancesTotal) * 100) / 100
  const grossSalary = Math.round((effectiveBasic + totalAllowances) * 100) / 100

  return {
    baseSalary: Math.round(effectiveBasic * 100) / 100,
    houseRentAllowance: houseRent,
    medicalAllowance: medical,
    conveyanceAllowance: conveyance,
    specialAllowance: Math.round((special + dynamicAllowancesTotal) * 100) / 100,
    structureAllowances,
    dynamicAllowancesTotal,
    dynamicAllowancesList,
    totalAllowances,
    grossSalary,
    baselineBasic: startingBasic,
    appliedEvents: events
  }
}

async function assertCurrentPayrollSnapshot(run) {
  const start = toUtcCalendarDate(run.payrollPeriod?.startDate)
  const end = toUtcCalendarDate(run.payrollPeriod?.endDate)
  if (!start || !end) {
    throw Object.assign(new Error('Payroll period dates missing.'), { code: 'PAYROLL_PERIOD_INVALID', status: 409 })
  }
  const employees = await prisma.employee.findMany({
    where: { employmentStatus: 'ACTIVE' },
    select: {
      id: true,
      employeeCode: true,
      employmentStatus: true,
      joiningDate: true,
      terminationDate: true,
      salaryStructures: true,
      salaryRevisions: { where: { status: 'APPROVED' } },
      allowanceAllocations: { where: { isActive: true }, include: { allowance: true } }
    }
  })
  const eligible = employees.filter(e => isEmployeeEligibleForPeriod(e, start, end))
  const withSalary = eligible.filter(e => salaryForPayrollPeriod(e, start, end))
  const expected = new Map(withSalary.map(e => [e.id, salaryForPayrollPeriod(e, start, end)]))
  const included = new Set(run.entries.map(e => e.employeeId))
  const isCanonical = !NON_CANONICAL_PERIOD_SUFFIX.test(run.payrollPeriod?.periodCode || '')
  if (isCanonical) {
    if (run.entries.length !== expected.size || [...expected.keys()].some(id => !included.has(id))) {
      throw Object.assign(new Error('Payroll employee headcount/eligibility changed since draft generation. Void and regenerate this run.'), { code: 'STALE_PAYROLL_HEADCOUNT', status: 409 })
    }
  }
  for (const entry of run.entries) {
    const salary = expected.get(entry.employeeId)
    if (!salary) continue
    for (const [field, salaryField] of [
      ['basicSalary', 'baseSalary'],
      ['houseRentAllowance', 'houseRentAllowance'],
      ['medicalAllowance', 'medicalAllowance'],
      ['conveyanceAllowance', 'conveyanceAllowance'],
      ['specialAllowance', 'specialAllowance']
    ]) {
      if (Math.abs(Number(entry[field] || 0) - Number(salary[salaryField] || 0)) > 0.02) {
        throw Object.assign(new Error(`Payroll salary snapshot for ${entry.employeeId} is stale (${field}). Void and regenerate before approval/disbursement.`), { code: 'STALE_PAYROLL_SALARY', status: 409 })
      }
    }
  }
}

function resolveEffectiveSalaryStructure(emp, periodStartStr, periodEndStr) {
  const structures = Array.isArray(emp?.salaryStructures) ? emp.salaryStructures : []
  if (structures.length === 0) return null

  // Prioritize active current structure if valid for the period
  const current = structures.find(s => s.isCurrent)
  if (current) {
    const fromStr = toUtcCalendarDate(current.effectiveFrom)
    const untilStr = toUtcCalendarDate(current.effectiveUntil)
    if ((!fromStr || !periodEndStr || fromStr <= periodEndStr) && (!untilStr || !periodStartStr || untilStr > periodStartStr)) {
      return current
    }
  }

  const sorted = [...structures].sort((a, b) => {
    const aTime = new Date(a.effectiveFrom || 0).getTime()
    const bTime = new Date(b.effectiveFrom || 0).getTime()
    if (bTime !== aTime) return bTime - aTime
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })

  return sorted.find((s) => {
    const fromStr = toUtcCalendarDate(s.effectiveFrom)
    if (fromStr && periodEndStr && fromStr > periodEndStr) return false
    const untilStr = toUtcCalendarDate(s.effectiveUntil)
    if (untilStr && fromStr && !s.isCurrent && untilStr <= fromStr) return false
    if (untilStr && periodStartStr && untilStr <= periodStartStr) return false
    return true
  }) || null
}

function isValidPakistaniIban(iban) {
  if (!iban || typeof iban !== 'string') return false
  const clean = iban.replace(/\s+/g, '').toUpperCase()
  return /^PK\d{2}[A-Z]{4}[0-9A-Z]{16}$/.test(clean)
}

function validateBankAccountOwnership(accountTitle, employeeName) {
  if (!accountTitle || !employeeName) return false
  const cleanTitle = accountTitle.trim().toLowerCase()
  const cleanEmp = employeeName.trim().toLowerCase()
  if (cleanTitle === cleanEmp) return true
  const empParts = cleanEmp.split(/\s+/).filter((p) => p.length >= 3)
  const titleParts = cleanTitle.split(/\s+/).filter((p) => p.length >= 3)
  return empParts.some((part) => titleParts.some((tp) => tp.includes(part) || part.includes(tp)))
}

function assessPayrollRunReconciliation(run) {
  const entries = Array.isArray(run?.entries) ? run.entries : []
  const entryCount = entries.length
  const recordedHeadcount = Number(run?.totalEmployees ?? 0)
  const periodStartStr = toUtcCalendarDate(run?.payrollPeriod?.startDate)
  const periodEndStr = toUtcCalendarDate(run?.payrollPeriod?.endDate)
  const reconciliationIssues = []

  if (entryCount === 0) {
    reconciliationIssues.push('Payroll run has zero employee entries.')
  }
  if (entryCount !== recordedHeadcount) {
    reconciliationIssues.push(`Headcount mismatch (recorded ${recordedHeadcount}, entries ${entryCount}).`)
  }

  let entriesGross = 0
  let entriesDeductions = 0
  let entriesNet = 0
  let hasEntryArithmeticMismatch = false

  const inactiveEmployees = []
  const missingStructureEmployees = []

  for (const entry of entries) {
    const entryGross = Number(entry.grossEarnings)
    const entryDeductions = Number(entry.totalDeductions)
    const entryNet = Number(entry.netSalary)
    if (Math.abs(Math.max(0, entryGross - entryDeductions) - entryNet) > 0.01) {
      hasEntryArithmeticMismatch = true
    }
    entriesGross += entryGross
    entriesDeductions += entryDeductions
    entriesNet += entryNet

    const emp = entry.employee
    if (!emp || !isEmployeeEligibleForPeriod(emp, periodStartStr, periodEndStr)) {
      const empLabel = emp
        ? `${[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.employeeCode} (${emp.employmentStatus || 'INELIGIBLE'})`
        : entry.employeeId
      inactiveEmployees.push(empLabel)
    } else if (['DRAFT', 'PENDING_APPROVAL'].includes(run?.status)) {
      const effectiveStructure = resolveEffectiveSalaryStructure(emp, periodStartStr, periodEndStr)
      if (!effectiveStructure) {
        missingStructureEmployees.push(`${emp.employeeCode || emp.id}`)
      }
    }
  }

  const totalsMatch =
    !hasEntryArithmeticMismatch &&
    Math.abs(entriesGross - Number(run?.totalGross ?? 0)) <= 0.01 &&
    Math.abs(entriesDeductions - Number(run?.totalDeductions ?? 0)) <= 0.01 &&
    Math.abs(entriesNet - Number(run?.totalNet ?? 0)) <= 0.01

  if (!totalsMatch) {
    reconciliationIssues.push('Summary totals do not reconcile with employee entries.')
  }
  if (inactiveEmployees.length > 0) {
    reconciliationIssues.push(`Contains ineligible/non-ACTIVE employee(s): ${inactiveEmployees.join(', ')}.`)
  }
  if (missingStructureEmployees.length > 0) {
    reconciliationIssues.push(`Contains employee(s) without an effective salary structure: ${missingStructureEmployees.join(', ')}.`)
  }

  const isReconciled =
    entryCount > 0 &&
    entryCount === recordedHeadcount &&
    totalsMatch &&
    inactiveEmployees.length === 0 &&
    missingStructureEmployees.length === 0

  return {
    entryCount,
    isReconciled,
    hasInactiveEmployees: inactiveEmployees.length > 0,
    hasMissingSalaryStructures: missingStructureEmployees.length > 0,
    reconciliationIssues
  }
}

async function validatePayrollRunIntegrity(run) {
  if (!run.entries?.length) {
    const error = new Error('Cannot process payroll without employee salary entries.')
    error.code = 'EMPTY_PAYROLL_RUN'
    error.status = 400
    throw error
  }

  if (run.entries.length !== Number(run.totalEmployees)) {
    const error = new Error('Payroll headcount does not match employee entries.')
    error.code = 'PAYROLL_HEADCOUNT_MISMATCH'
    error.status = 400
    throw error
  }

  let gross = 0
  let deductions = 0
  let net = 0
  for (const entry of run.entries) {
    const entryGross = Number(entry.grossEarnings)
    const entryDeductions = Number(entry.totalDeductions)
    const entryNet = Number(entry.netSalary)
    const expectedNet = Math.max(0, entryGross - entryDeductions)
    if (Math.abs(expectedNet - entryNet) > 0.01) {
      const error = new Error('Payroll entry net salary does not reconcile with gross earnings and deductions.')
      error.code = 'PAYROLL_TOTAL_MISMATCH'
      error.status = 400
      throw error
    }
    gross += entryGross
    deductions += entryDeductions
    net += entryNet
  }

  if (
    Math.abs(gross - Number(run.totalGross)) > 0.01 ||
    Math.abs(deductions - Number(run.totalDeductions)) > 0.01 ||
    Math.abs(net - Number(run.totalNet)) > 0.01
  ) {
    const error = new Error('Payroll totals do not reconcile with employee entries.')
    error.code = 'PAYROLL_TOTAL_MISMATCH'
    error.status = 400
    throw error
  }

  const periodStartStr = toUtcCalendarDate(run.payrollPeriod?.startDate)
  const periodEndStr = toUtcCalendarDate(run.payrollPeriod?.endDate)
  const employeeIds = run.entries.map((entry) => entry.employeeId)
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      employeeCode: true,
      employmentStatus: true,
      joiningDate: true,
      terminationDate: true,
      salaryStructures: {
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }]
      }
    }
  })

  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]))
  const invalidEmployees = run.entries.filter((entry) => {
    const employee = employeeMap.get(entry.employeeId)
    return !isEmployeeEligibleForPeriod(employee, periodStartStr, periodEndStr)
  })

  if (invalidEmployees.length > 0) {
    const error = new Error(
      'Payroll contains inactive, ineligible, or missing employees. Void the invalid draft and generate a corrected run.'
    )
    error.code = 'INVALID_PAYROLL_EMPLOYEES'
    error.status = 400
    throw error
  }

  if (['DRAFT', 'PENDING_APPROVAL'].includes(run.status)) {
    const missingStructures = run.entries.filter((entry) => {
      const employee = employeeMap.get(entry.employeeId)
      return !resolveEffectiveSalaryStructure(employee, periodStartStr, periodEndStr)
    })
    if (missingStructures.length > 0) {
      const error = new Error(
        'Payroll contains employee entry without an effective salary structure for the period. Void and regenerate the draft.'
      )
      error.code = 'MISSING_SALARY_STRUCTURE'
      error.status = 400
      throw error
    }
  }

  // Independent server-side guard; matching totals alone cannot detect a missing employee
  // or an approved revision that was created after this payroll snapshot.
  await assertCurrentPayrollSnapshot(run)
}

export const payrollService = {
  // ============================================================================
  // 1. PAYROLL PERIODS
  // ============================================================================

  async getPayrollPeriods(filters = {}) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.year) where.year = parseInt(filters.year, 10)

    return prisma.payrollPeriod.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        runs: {
          select: {
            id: true,
            runNumber: true,
            status: true,
            totalEmployees: true,
            totalGross: true,
            totalNet: true
          }
        }
      }
    })
  },

  async createPayrollPeriod(data) {
    const { periodCode, month, year, startDate, endDate, workingDaysCount = 22 } = data

    if (!periodCode || !month || !year || !startDate || !endDate) {
      const error = new Error('periodCode, month, year, startDate, and endDate are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const cleanCode = periodCode.trim()
    const existing = await prisma.payrollPeriod.findUnique({ where: { periodCode: cleanCode } })
    if (existing) {
      const error = new Error(`Payroll period '${cleanCode}' already exists.`)
      error.code = 'DUPLICATE_PERIOD'
      error.status = 409
      throw error
    }

    return prisma.payrollPeriod.create({
      data: {
        periodCode: cleanCode,
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        workingDaysCount: parseInt(workingDaysCount, 10),
        status: 'OPEN'
      }
    })
  },

  // ============================================================================
  // 2. PAYROLL RUNS & CALCULATION ENGINE
  // ============================================================================


  async getPayrollRuns(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.periodCode) {
      where.payrollPeriod = {
        periodCode: filters.periodCode
      };
    }

    const runs = await prisma.payrollRun.findMany({
      where,
      orderBy: { runDate: 'desc' },
      include: {
        payrollPeriod: true,
        entries: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                employmentStatus: true,
                joiningDate: true,
                terminationDate: true,
                bankName: true,
                bankAccountTitle: true,
                bankAccountNumber: true,
                bankIban: true,
                department: {
                  select: { name: true }
                },
                designation: {
                  select: { title: true }
                },
                salaryStructures: {
                  orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }]
                }
              }
            }
          },
          orderBy: {
            employee: {
              employeeCode: 'asc'
            }
          }
        },
        _count: {
          select: { entries: true }
        }
      }
    });

    return runs.map((run) => ({
      ...run,
      ...assessPayrollRunReconciliation(run)
    }));
  },


  async getPayrollRunById(id) {
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        payrollPeriod: true,
        entries: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                employmentStatus: true,
                joiningDate: true,
                terminationDate: true,
                bankName: true,
                bankAccountTitle: true,
                bankAccountNumber: true,
                bankIban: true,
                department: { select: { name: true } },
                designation: { select: { title: true } },
                salaryStructures: {
                  orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }]
                }
              }
            }
          },
          orderBy: { employee: { employeeCode: 'asc' } }
        }
      }
    })

    if (!run) {
      const error = new Error(`Payroll run '${id}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const org = await prisma.organizationSetting.findFirst().catch(() => null)
    const runTaxSnapshots = org?.settingsJson?.runTaxSnapshots || {}
    const snapshot = runTaxSnapshots[run.id] || null

    let totalStatutoryTax = 0
    let totalTaxWithheld = 0

    const enrichedEntries = (run.entries || []).map((entry) => {
      const gross = Number(entry.grossEarnings || 0)
      const withheld = Number(entry.taxDeduction || 0)
      totalTaxWithheld += withheld

      let statutory = 0
      try {
        statutory = calculateSalaryTax(gross, 0, run.payrollPeriod?.startDate || new Date()).monthlyTaxWithholding
      } catch (e) {
        statutory = 0
      }
      totalStatutoryTax += statutory

      return {
        ...entry,
        statutoryTaxLiability: statutory,
        statutoryVariance: statutory - withheld
      }
    })

    const reconciliation = assessPayrollRunReconciliation({ ...run, entries: enrichedEntries })

    return {
      ...run,
      entries: enrichedEntries,
      taxCompliance: {
        totalTaxWithheld: Math.round(totalTaxWithheld * 100) / 100,
        statutoryTaxObligationTotal: Math.round(totalStatutoryTax * 100) / 100,
        statutoryVariance: Math.round((totalStatutoryTax - totalTaxWithheld) * 100) / 100,
        taxSnapshot: snapshot
      },
      ...reconciliation
    }
  },

  /**
   * Generates a draft payroll run with owner-approved Batch 6B calculation rules:
   * 1. Fixed 31-day salary divisor for daily basic rate.
   * 2. Exactly 2 paid leave days per calendar month; excess is unpaid.
   * 3. 31-day base hourly rate for approved overtime.
   * 4. FBR Section 149 progressive salary tax.
   * 5. Active loan installment deduction recovery.
   */
  async generateDraftPayrollRun(periodCode, actorUser, options = {}) {
    if (!periodCode) {
      const error = new Error('periodCode is required to generate payroll.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const cleanCode = periodCode.trim()
    const isCanonicalMonthlyCode = /^\d{4}-\d{2}$/.test(cleanCode)
    let period = await prisma.payrollPeriod.findUnique({
      where: { periodCode: cleanCode }
    })

    if (isCanonicalMonthlyCode) {
      const [yearStr, monthStr] = cleanCode.split('-')
      const canonicalYear = parseInt(yearStr, 10)
      const canonicalMonth = parseInt(monthStr, 10)
      if (canonicalYear >= 2020 && canonicalMonth >= 1 && canonicalMonth <= 12) {
        const conflictingRuns = await prisma.payrollRun.findMany({
          where: {
            status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISBURSED'] },
            payrollPeriod: {
              year: canonicalYear,
              month: canonicalMonth
            }
          },
          include: {
            payrollPeriod: { select: { periodCode: true } }
          }
        })
        const activeConflict = conflictingRuns.find(
          (r) => !NON_CANONICAL_PERIOD_SUFFIX.test(r.payrollPeriod?.periodCode || '')
        )
        if (activeConflict) {
          const error = new Error(
            `A payroll run (${activeConflict.runNumber}) already exists for ${cleanCode} (period '${activeConflict.payrollPeriod?.periodCode}') with status '${activeConflict.status}'. Void previous run before regenerating.`
          )
          error.code = 'DUPLICATE_PAYROLL_RUN'
          error.status = 409
          throw error
        }
      }
    }

    if (!period) {
      const parts = cleanCode.split('-')
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      if (isCanonicalMonthlyCode && year >= 2020 && month >= 1 && month <= 12) {
        const startDate = new Date(Date.UTC(year, month - 1, 1))
        const endDate = new Date(Date.UTC(year, month, 0))
        period = await prisma.payrollPeriod.create({
          data: {
            periodCode: cleanCode,
            month,
            year,
            startDate,
            endDate,
            workingDaysCount: 22,
            status: 'OPEN'
          }
        })
      } else {
        const error = new Error(`Payroll period '${periodCode}' does not exist. Please create the period first.`)
        error.code = 'PERIOD_NOT_FOUND'
        error.status = 404
        throw error
      }
    }

    // DUPLICATE RUN PROTECTION: Check if non-void run already exists for this period
    const existingRun = await prisma.payrollRun.findFirst({
      where: {
        payrollPeriodId: period.id,
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISBURSED'] }
      }
    })

    if (existingRun) {
      const error = new Error(`A payroll run (${existingRun.runNumber}) already exists for period '${periodCode}' with status '${existingRun.status}'. Void previous run before regenerating.`)
      error.code = 'DUPLICATE_PAYROLL_RUN'
      error.status = 409
      throw error
    }

    const startDate = period.startDate
    const endDate = period.endDate
    const periodStartStr = toUtcCalendarDate(startDate)
    const periodEndStr = toUtcCalendarDate(endDate)

    // Fetch all active employees and resolve period-eligible salary structures
    const employees = await prisma.employee.findMany({
      where: { employmentStatus: 'ACTIVE' },
      include: {
        department: true,
        designation: true,
        salaryStructures: {
          orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }]
        },
        salaryRevisions: { where: { status: 'APPROVED' } },
        allowanceAllocations: { where: { isActive: true }, include: { allowance: true } }
      },
      orderBy: { employeeCode: 'asc' }
    })

    const eligibleEmployees = employees.filter((e) =>
      isEmployeeEligibleForPeriod(e, periodStartStr, periodEndStr)
    )

    if (eligibleEmployees.length === 0) {
      const error = new Error(`No eligible active employees found to generate payroll for '${period.periodCode}'.`)
      error.code = 'NO_ACTIVE_EMPLOYEES'
      error.status = 400
      throw error
    }

    // Filter eligible employees who have an effective salary structure for the period
    const employeesWithSalary = eligibleEmployees
      .map((e) => {
        const resolvedSalary = salaryForPayrollPeriod(e, periodStartStr, periodEndStr)
        return resolvedSalary ? { ...e, payrollResolvedSalary: resolvedSalary } : null
      })
      .filter(Boolean)

    if (employeesWithSalary.length === 0) {
      const missingCodes = eligibleEmployees.map((e) => e.employeeCode).join(', ')
      const error = new Error(`Cannot generate payroll: All eligible active employees lack an effective salary structure for '${period.periodCode}': ${missingCodes}. Please assign salary structures before proceeding.`)
      error.code = 'MISSING_SALARY_STRUCTURE'
      error.status = 400
      throw error
    }
    const actualCalendarDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1

    // Pre-fetch approved leaves, approved overtimes, and active loans within the period
    const [approvedLeaves, approvedOvertimes, activeLoans] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { lte: endDate },
          endDate: { gte: startDate }
        },
        include: { leaveType: true }
      }),
      prisma.overtimeRequest.findMany({
        where: {
          status: 'APPROVED',
          overtimeDate: { gte: startDate, lte: endDate }
        }
      }),
      prisma.employeeLoan.findMany({
        where: {
          status: 'DISBURSED',
          remainingBalance: { gt: 0 }
        }
      })
    ])

    // =========================================================================
    // MONTHLY LEAVE POLICY ENGINE (TWO PAID DAYS ALLOWED PER CALENDAR MONTH)
    // =========================================================================
    // Group leaves by employee, accurately apportioning days into THIS calendar month
    const leavesByEmp = new Map()
    for (const req of approvedLeaves) {
      const reqStart = new Date(Math.max(new Date(req.startDate), startDate))
      const reqEnd = new Date(Math.min(new Date(req.endDate), endDate))
      let daysInMonth = 0
      if (reqEnd >= reqStart) {
        daysInMonth = req.isHalfDay ? 0.5 : Math.ceil((reqEnd - reqStart) / (1000 * 60 * 60 * 24)) + 1
      }

      if (daysInMonth > 0) {
        const empList = leavesByEmp.get(req.employeeId) || []
        empList.push({
          ...req,
          daysInMonth,
          isPaidType: req.leaveType?.isPaid !== false
        })
        leavesByEmp.set(req.employeeId, empList)
      }
    }

    // Overtime grouped by employee
    const overtimeByEmp = new Map()
    for (const ot of approvedOvertimes) {
      const current = overtimeByEmp.get(ot.employeeId) || 0
      overtimeByEmp.set(ot.employeeId, current + ot.durationMinutes)
    }

    // Loans grouped by employee
    const loansByEmp = new Map()
    for (const loan of activeLoans) {
      loansByEmp.set(loan.employeeId, loan)
    }

    const taxConfig = await payrollTaxService.getTaxConfig()

    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0
    const calculatedEntries = []

    // Configure rate parameters
    const overtimeMultiplier = options.overtimeMultiplier || 1.5
    const extraLeaveFlatPenalty = options.extraLeavePenaltyPerDay || 0 // e.g. 500 PKR if configured

    for (const emp of employeesWithSalary) {
      const structure = emp.payrollResolvedSalary || emp.salaryStructures[0]
      const baseSalary = Number(structure.baseSalary)
      const houseRent = Number(structure.houseRentAllowance) || 0
      const medical = Number(structure.medicalAllowance) || 0
      const conveyance = Number(structure.conveyanceAllowance) || 0
      const special = Number(structure.specialAllowance) || 0

      // -----------------------------------------------------------------------
      // 1. MANDATORY OWNER FORMULA: FIXED 31-DAY DIVISOR
      // -----------------------------------------------------------------------
      // Rate divisor is ALWAYS 31 for every month of the year
      const dailyBasicRate = baseSalary / 31

      // -----------------------------------------------------------------------
      // 2. OWNER LEAVE POLICY: 2 ALLOWED LEAVES (PKR 0) + PKR 500 / EXTRA LEAVE
      // -----------------------------------------------------------------------
      const empLeaves = leavesByEmp.get(emp.id) || []
      let eligiblePaidLeaveDaysTaken = 0
      let explicitlyUnpaidLeaveDays = 0

      for (const l of empLeaves) {
        if (!l.isPaidType) {
          explicitlyUnpaidLeaveDays += l.daysInMonth
        } else {
          eligiblePaidLeaveDaysTaken += l.daysInMonth
        }
      }

      // First 2 company-allowed leaves incur ZERO salary deduction
      const companyAllowedLeaves = Math.min(2, eligiblePaidLeaveDaysTaken)
      // Starting from 3rd leave day, deduct exactly PKR 500 per additional day
      const extraLeaveDays = Math.max(0, eligiblePaidLeaveDaysTaken - 2)
      const penaltyPerDay = options.extraLeavePenaltyPerDay !== undefined
        ? Number(options.extraLeavePenaltyPerDay)
        : 500
      const extraLeaveDeduction = extraLeaveDays * penaltyPerDay

      // Explicitly unauthorized absence or unpaid special leave deducts at daily basic rate
      const unpaidAbsenceDeduction = Math.round(dailyBasicRate * explicitlyUnpaidLeaveDays)

      // Fixed extra-leave deduction placed in dedicated line / otherDeductions
      const otherDeductions = extraLeaveDeduction

      // -----------------------------------------------------------------------
      // 3. 31-DAY HOURLY OVERTIME CALCULATION
      // -----------------------------------------------------------------------
      // Look up employee's resolved shift to get standard paid hours per day
      let standardPaidHoursPerDay = 8.0
      try {
        const { shift } = await shiftService.resolveEmployeeShift(emp.id, period.startDate.toISOString().slice(0, 10))
        if (shift?.fullDayTargetMinutes) {
          standardPaidHoursPerDay = shift.fullDayTargetMinutes / 60
        }
      } catch {
        standardPaidHoursPerDay = 8.0
      }

      // Base Hourly Rate = (Monthly Basic Salary / 31) / Approved Standard Paid Hours Per Day
      const baseHourlyRate = dailyBasicRate / standardPaidHoursPerDay

      const otMinutes = overtimeByEmp.get(emp.id) || 0
      const otHours = Math.round((otMinutes / 60) * 10) / 10
      const overtimeAmount = Math.round(otHours * baseHourlyRate * overtimeMultiplier)

      // -----------------------------------------------------------------------
      // 4. GROSS SALARY
      // -----------------------------------------------------------------------
      // Full monthly basic salary is preserved for fully eligible employees
      const grossEarnings = baseSalary + houseRent + medical + conveyance + special + overtimeAmount

      // -----------------------------------------------------------------------
      // 5. TAX WITHHOLDING (MANUAL CONFIGURATION OR FBR STATUTORY WITH OVERRIDES)
      // -----------------------------------------------------------------------
      const taxCalc = await payrollTaxService.calculateEmployeeTax(emp, grossEarnings, period.startDate, taxConfig)
      const taxDeduction = taxCalc.taxDeduction

      // -----------------------------------------------------------------------
      // 6. LOAN DEDUCTIONS
      // -----------------------------------------------------------------------
      let loanDeduction = 0
      const activeLoan = loansByEmp.get(emp.id)
      if (activeLoan) {
        loanDeduction = Math.min(Number(activeLoan.monthlyInstallment), Number(activeLoan.remainingBalance))
      }

      // -----------------------------------------------------------------------
      // 7. TOTAL DEDUCTIONS & NET SALARY (WITH STRUCTURED LIABILITY ACCOUNTING)
      // -----------------------------------------------------------------------
      const totalEmpDeductions = taxDeduction + unpaidAbsenceDeduction + loanDeduction + otherDeductions

      // Preserve unrecovered liability if deductions exceed gross
      const netSalary = Math.max(0, grossEarnings - totalEmpDeductions)
      const unrecoveredLiability = totalEmpDeductions > grossEarnings ? totalEmpDeductions - grossEarnings : 0

      totalGross += grossEarnings
      totalDeductions += totalEmpDeductions
      totalNet += netSalary

      const totalUnpaidLeaveDays = explicitlyUnpaidLeaveDays + extraLeaveDays
      const payableDays = Math.max(0, actualCalendarDays - explicitlyUnpaidLeaveDays)

      calculatedEntries.push({
        employeeId: emp.id,
        calendarDays: actualCalendarDays,
        payableDays: new Prisma.Decimal(payableDays.toFixed(1)),
        absentDays: new Prisma.Decimal(totalUnpaidLeaveDays.toFixed(1)),
        unpaidLeaveDays: new Prisma.Decimal(totalUnpaidLeaveDays.toFixed(1)),
        basicSalary: new Prisma.Decimal(baseSalary.toFixed(2)),
        houseRentAllowance: new Prisma.Decimal(houseRent.toFixed(2)),
        medicalAllowance: new Prisma.Decimal(medical.toFixed(2)),
        conveyanceAllowance: new Prisma.Decimal(conveyance.toFixed(2)),
        specialAllowance: new Prisma.Decimal(special.toFixed(2)),
        overtimeHours: new Prisma.Decimal(otHours.toFixed(1)),
        overtimeAmount: new Prisma.Decimal(overtimeAmount.toFixed(2)),
        bonusAmount: new Prisma.Decimal('0.00'),
        commissionAmount: new Prisma.Decimal('0.00'),
        grossEarnings: new Prisma.Decimal(grossEarnings.toFixed(2)),
        taxDeduction: new Prisma.Decimal(taxDeduction.toFixed(2)),
        eobiDeduction: new Prisma.Decimal('0.00'),
        providentFundDeduction: new Prisma.Decimal('0.00'),
        loanDeduction: new Prisma.Decimal(loanDeduction.toFixed(2)),
        unpaidAbsenceDeduction: new Prisma.Decimal(unpaidAbsenceDeduction.toFixed(2)),
        otherDeductions: new Prisma.Decimal(otherDeductions.toFixed(2)),
        totalDeductions: new Prisma.Decimal(totalEmpDeductions.toFixed(2)),
        netSalary: new Prisma.Decimal(netSalary.toFixed(2)),
        unrecoveredLiability: new Prisma.Decimal(unrecoveredLiability.toFixed(2)),
        currency: 'PKR',
        paymentMethod: 'BANK_TRANSFER',
        bankName: emp.bankName || null,
        bankAccountTitle: emp.bankAccountTitle || null,
        bankAccountNumber: emp.bankAccountNumber || null,
        bankIban: emp.bankIban || null,
        paymentStatus: 'UNPAID',
        transactionReference: null
      })
    }

    // Generate unique run number e.g. RUN-202611-01
    const periodPrefix = periodCode.replace(/-/g, '')
    const runCount = await prisma.payrollRun.count({ where: { payrollPeriodId: period.id } })
    const runNumber = `RUN-${periodPrefix}-${String(runCount + 1).padStart(2, '0')}`

    const payrollRun = await prisma.$transaction(async (tx) => {
      const createdRun = await tx.payrollRun.create({
        data: {
          runNumber,
          payrollPeriodId: period.id,
          runDate: new Date(),
          processedById: actorUser.id,
          totalEmployees: employeesWithSalary.length,
          totalGross: new Prisma.Decimal(totalGross.toFixed(2)),
          totalDeductions: new Prisma.Decimal(totalDeductions.toFixed(2)),
          totalNet: new Prisma.Decimal(totalNet.toFixed(2)),
          paymentStatus: 'UNPAID',
          status: 'DRAFT',
          entries: {
            create: calculatedEntries
          }
        },
        include: {
          payrollPeriod: true,
          entries: {
            include: {
              employee: {
                select: { id: true, employeeCode: true, firstName: true, lastName: true }
              }
            }
          }
        }
      })

      // Persist structured salary liabilities for any negative net salary scenarios
      const liabilitiesToCreate = createdRun.entries
        .filter((entry) => Number(entry.unrecoveredLiability) > 0)
        .map((entry, idx) => ({
          liabilityNumber: `LIA-${periodPrefix}-${String(idx + 1).padStart(3, '0')}`,
          employeeId: entry.employeeId,
          payrollPeriodId: period.id,
          payrollEntryId: entry.id,
          originalAmount: entry.unrecoveredLiability,
          outstandingBalance: entry.unrecoveredLiability,
          recoveredAmount: new Prisma.Decimal('0.00'),
          reason: `Excess deductions exceeding gross earnings in payroll period ${period.periodCode}`,
          status: 'OUTSTANDING'
        }))

      for (const lia of liabilitiesToCreate) {
        await tx.salaryLiability.create({ data: lia })
      }

      // Persist applied tax configuration snapshot for this run
      const org = await tx.organizationSetting.findFirst().catch(() => null)
      if (org) {
        const existingSnapshots = org.settingsJson?.runTaxSnapshots || {}
        await tx.organizationSetting.update({
          where: { id: org.id },
          data: {
            settingsJson: {
              ...(org.settingsJson || {}),
              runTaxSnapshots: {
                ...existingSnapshots,
                [createdRun.id]: {
                  runNumber: createdRun.runNumber,
                  appliedAt: new Date().toISOString(),
                  appliedBy: `${actorUser?.firstName || actorUser?.name || 'User'} (${actorUser?.role || 'ADMIN'})`,
                  config: {
                    mode: taxConfig.mode,
                    enabled: taxConfig.enabled,
                    ratePercentage: taxConfig.ratePercentage,
                    fixedAmount: taxConfig.fixedAmount,
                    overridesCount: (taxConfig.employeeOverrides || []).length
                  }
                }
              }
            }
          }
        }).catch((e) => console.warn('[PayrollService] Tax snapshot warning:', e.message))
      }

      return createdRun
    })

    return payrollRun
  },

  // ============================================================================
  // 3. RUN LIFECYCLE: SUBMIT, APPROVE, DISBURSE, VOID
  // ============================================================================

  async submitPayrollRun(runId, actorUser) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { entries: true, payrollPeriod: true }
    })
    if (!run) {
      const error = new Error(`Payroll run '${runId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (run.status !== 'DRAFT') {
      const error = new Error(`Only DRAFT payroll runs can be submitted for review. Current status: '${run.status}'.`)
      error.code = 'INVALID_STATE'
      error.status = 400
      throw error
    }

    await validatePayrollRunIntegrity(run)

    return prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'PENDING_APPROVAL' },
      include: { payrollPeriod: true }
    })
  },

  async approvePayrollRun(runId, reviewerUser) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { entries: true, payrollPeriod: true }
    })

    if (!run) {
      const error = new Error(`Payroll run '${runId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (!['DRAFT', 'PENDING_APPROVAL'].includes(run.status)) {
      const error = new Error(`Cannot approve payroll run already marked as '${run.status}'.`)
      error.code = 'ALREADY_PROCESSED'
      error.status = 400
      throw error
    }

    // Validate payroll employees and salary calculations before approval
    await validatePayrollRunIntegrity(run)

    if (reviewerUser.id === run.processedById && reviewerUser.role !== 'SUPER_ADMIN') {
      const error = new Error('Anti-Self-Approval Violation: The user who processed the draft cannot approve the payroll run.')
      error.code = 'SELF_APPROVAL_PROHIBITED'
      error.status = 403
      throw error
    }

    const updateResult = await prisma.payrollRun.updateMany({
      where: {
        id: runId,
        status: { in: ['DRAFT', 'PENDING_APPROVAL'] }
      },
      data: {
        status: 'APPROVED',
        approvedById: reviewerUser.id,
        approvedAt: new Date()
      }
    })

    if (updateResult.count === 0) {
      const error = new Error(`Cannot approve payroll run already marked as '${run.status}'.`)
      error.code = 'ALREADY_PROCESSED'
      error.status = 409
      throw error
    }

    const updated = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { payrollPeriod: true }
    })

    return updated
  },

  /**
   * Disburses approved payroll run and creates official loan repayment ledger entries.
   * Payment status transitions to PAID ONLY upon valid authorized disbursement.
   */
  async disbursePayrollRun(runId, actorUser, paymentData = {}) {
    if (!actorUser || !actorUser.id) {
      const error = new Error('Authorized actor attribution is required for payroll disbursement.')
      error.code = 'UNAUTHORIZED'
      error.status = 401
      throw error
    }

    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        entries: true,
        payrollPeriod: true
      }
    })

    if (!run) {
      const error = new Error(`Payroll run '${runId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (run.status === 'DISBURSED' || run.paymentStatus === 'PAID') {
      const error = new Error('Payroll run is already disbursed. Duplicate disbursement is prohibited.')
      error.code = 'ALREADY_DISBURSED'
      error.status = 400
      throw error
    }

    if (run.status !== 'APPROVED') {
      const error = new Error(`Only APPROVED payroll runs can be disbursed. Current status: '${run.status}'.`)
      error.code = 'INVALID_STATE'
      error.status = 400
      throw error
    }

    // Block disbursement of empty, inconsistent, or ineligible payroll runs
    await validatePayrollRunIntegrity(run)

    // Validate payment parameters strictly
    const paymentMethod = paymentData.paymentMethod || 'BANK_TRANSFER'
    const validMethods = ['BANK_TRANSFER', 'CHEQUE', 'CASH']
    if (!validMethods.includes(paymentMethod)) {
      const error = new Error(`Invalid payment method '${paymentMethod}'. Allowed: ${validMethods.join(', ')}.`)
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const transactionReference = (paymentData.transactionReference || '').trim()
    if (!transactionReference) {
      const error = new Error('Explicit transactionReference is required for disbursement verification.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const paymentAccount = (paymentData.paymentAccount || 'Corporate Primary Payroll Operating A/C').trim()

    const paymentDate = paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date()
    if (isNaN(paymentDate.getTime())) {
      const error = new Error('Invalid paymentDate provided.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const todayEndOfDay = new Date()
    todayEndOfDay.setHours(23, 59, 59, 999)
    if (paymentDate > todayEndOfDay) {
      const error = new Error('Future disbursement paymentDate is not permitted.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const disbursed = await prisma.$transaction(async (tx) => {
      // 1. Mark run as DISBURSED & PAID with explicit actor attribution
      const updatedRun = await tx.payrollRun.update({
        where: { id: runId },
        data: {
          status: 'DISBURSED',
          paymentStatus: 'PAID',
          disbursedById: actorUser.id,
          disbursedAt: paymentDate
        }
      })

      // 2. Mark all entries as PAID with payment attribution
      await tx.payrollEntry.updateMany({
        where: { payrollRunId: runId },
        data: {
          paymentStatus: 'PAID',
          paidAt: paymentDate,
          paymentMethod,
          transactionReference
        }
      })

      // 3. Process automated loan repayments for entries with loan deductions
      for (const entry of run.entries) {
        const loanDeduct = Number(entry.loanDeduction)
        if (loanDeduct > 0) {
          const activeLoan = await tx.employeeLoan.findFirst({
            where: {
              employeeId: entry.employeeId,
              status: 'DISBURSED',
              remainingBalance: { gt: 0 }
            }
          })

          if (activeLoan) {
            const curRemaining = Number(activeLoan.remainingBalance)
            const actualDeduct = Math.min(loanDeduct, curRemaining)
            const newBalance = Math.max(0, curRemaining - actualDeduct)
            const newTotalRepaid = Number(activeLoan.totalRepaidAmount) + actualDeduct

            await tx.loanRepayment.create({
              data: {
                loanId: activeLoan.id,
                payrollEntryId: entry.id,
                amount: new Prisma.Decimal(actualDeduct.toFixed(2)),
                balanceAfter: new Prisma.Decimal(newBalance.toFixed(2)),
                paymentSource: 'PAYROLL_DEDUCTION',
                notes: `Automated monthly payroll deduction (${run.payrollPeriod.periodCode})`
              }
            })

            await tx.employeeLoan.update({
              where: { id: activeLoan.id },
              data: {
                remainingBalance: new Prisma.Decimal(newBalance.toFixed(2)),
                totalRepaidAmount: new Prisma.Decimal(newTotalRepaid.toFixed(2)),
                status: newBalance <= 0 ? 'REPAID' : activeLoan.status
              }
            })
          }
        }
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId: actorUser.id,
          actorRole: actorUser.role || 'SUPER_ADMIN',
          sourceModule: 'PAYROLL',
          actionType: 'DISBURSE',
          entityName: 'PayrollRun',
          entityId: runId,
          recordSnapshotAfter: {
            runNumber: run.runNumber,
            periodCode: run.payrollPeriod.periodCode,
            totalNet: Number(run.totalNet),
            totalEmployees: run.totalEmployees,
            paymentMethod,
            transactionReference,
            paymentAccount,
            disbursedAt: paymentDate
          }
        }
      })

      return updatedRun
    })

    return disbursed
  },

  async voidPayrollRun(runId, actorUser, reason = 'Administrative cancellation') {
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { payrollPeriod: true }
    })
    if (!run) {
      const error = new Error(`Payroll run '${runId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (run.status === 'DISBURSED') {
      const error = new Error('Cannot void an already disbursed payroll run. Documented reversal workflow required.')
      error.code = 'CANNOT_VOID_DISBURSED'
      error.status = 400
      throw error
    }

    if (run.status === 'VOID') {
      const error = new Error('Payroll run is already voided.')
      error.code = 'ALREADY_VOID'
      error.status = 400
      throw error
    }

    const cleanReason = String(reason || '').trim() || 'Administrative cancellation'

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payrollRun.update({
        where: { id: runId },
        data: { status: 'VOID' },
        include: { payrollPeriod: true }
      })

      if (actorUser?.id) {
        await tx.auditLog.create({
          data: {
            actorUserId: actorUser.id,
            actorRole: actorUser.role || 'SUPER_ADMIN',
            sourceModule: 'PAYROLL',
            actionType: 'VOID',
            entityName: 'PayrollRun',
            entityId: runId,
            recordSnapshotAfter: {
              runNumber: run.runNumber,
              periodCode: run.payrollPeriod?.periodCode || null,
              previousStatus: run.status,
              newStatus: 'VOID',
              reason: cleanReason
            }
          }
        })
      }

      return updated
    })
  },

  /**
   * Reconciles a DRAFT payroll run in-place against canonical salary structures and
   * leaves/attendance without changing the run number.
   */
  async reconcileDraftRunInPlace(runId, actorUser = null) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        payrollPeriod: true,
        entries: {
          include: {
            employee: {
              include: {
                salaryStructures: true,
                salaryRevisions: { where: { status: 'APPROVED' } },
                allowanceAllocations: { where: { isActive: true }, include: { allowance: true } }
              }
            }
          }
        }
      }
    })

    if (!run || run.status !== 'DRAFT') return null

    const start = toUtcCalendarDate(run.payrollPeriod?.startDate)
    const end = toUtcCalendarDate(run.payrollPeriod?.endDate)
    const taxConfig = await payrollTaxService.getTaxConfig()

    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0

    await prisma.$transaction(async (tx) => {
      for (const entry of run.entries) {
        const resolved = salaryForPayrollPeriod(entry.employee, start, end)
        const baseSalary = resolved ? resolved.baseSalary : Number(entry.basicSalary)
        const houseRent = resolved ? resolved.houseRentAllowance : Number(entry.houseRentAllowance || 0)
        const medical = resolved ? resolved.medicalAllowance : Number(entry.medicalAllowance || 0)
        const conveyance = resolved ? resolved.conveyanceAllowance : Number(entry.conveyanceAllowance || 0)
        const special = resolved ? resolved.specialAllowance : Number(entry.specialAllowance || 0)
        const otAmount = Number(entry.overtimeAmount || 0)
        const bonus = Number(entry.bonusAmount || 0)
        const commission = Number(entry.commissionAmount || 0)

        const grossEarnings = baseSalary + houseRent + medical + conveyance + special + otAmount + bonus + commission

        const taxCalc = await payrollTaxService.calculateEmployeeTax(
          entry.employee,
          grossEarnings,
          run.payrollPeriod?.startDate || new Date(),
          taxConfig
        )
        const taxDeduction = taxCalc.taxDeduction

        const unpaidAbsence = Number(entry.unpaidAbsenceDeduction || 0)
        const loanDeduction = Number(entry.loanDeduction || 0)
        const otherDeductions = Number(entry.otherDeductions || 0)
        const eobiDeduction = Number(entry.eobiDeduction || 0)
        const providentFundDeduction = Number(entry.providentFundDeduction || 0)

        const totalEmpDeductions = taxDeduction + unpaidAbsence + loanDeduction + otherDeductions + eobiDeduction + providentFundDeduction
        const netSalary = Math.max(0, grossEarnings - totalEmpDeductions)
        const unrecoveredLiability = totalEmpDeductions > grossEarnings ? totalEmpDeductions - grossEarnings : 0

        totalGross += grossEarnings
        totalDeductions += totalEmpDeductions
        totalNet += netSalary

        await tx.payrollEntry.update({
          where: { id: entry.id },
          data: {
            basicSalary: new Prisma.Decimal(baseSalary.toFixed(2)),
            houseRentAllowance: new Prisma.Decimal(houseRent.toFixed(2)),
            medicalAllowance: new Prisma.Decimal(medical.toFixed(2)),
            conveyanceAllowance: new Prisma.Decimal(conveyance.toFixed(2)),
            specialAllowance: new Prisma.Decimal(special.toFixed(2)),
            grossEarnings: new Prisma.Decimal(grossEarnings.toFixed(2)),
            taxDeduction: new Prisma.Decimal(taxDeduction.toFixed(2)),
            totalDeductions: new Prisma.Decimal(totalEmpDeductions.toFixed(2)),
            netSalary: new Prisma.Decimal(netSalary.toFixed(2)),
            unrecoveredLiability: new Prisma.Decimal(unrecoveredLiability.toFixed(2))
          }
        })
      }

      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          totalGross: new Prisma.Decimal(totalGross.toFixed(2)),
          totalDeductions: new Prisma.Decimal(totalDeductions.toFixed(2)),
          totalNet: new Prisma.Decimal(totalNet.toFixed(2))
        }
      })
    })

    if (actorUser) {
      await prisma.auditLog.create({
        data: {
          actorUserId: actorUser.id,
          actorRole: actorUser.role || 'SUPER_ADMIN',
          sourceModule: 'PAYROLL',
          actionType: 'RECONCILE',
          entityName: 'PayrollRun',
          entityId: run.id,
          recordSnapshotAfter: {
            runNumber: run.runNumber,
            totalGross,
            totalNet,
            reconciledInPlace: true
          }
        }
      }).catch(() => {})
    }

    return this.getPayrollRunById(run.id, actorUser)
  },

  /**
   * Reconciles a stale/invalid DRAFT or PENDING_APPROVAL payroll run by voiding it
   * with full audit history (preserving historical rows & entries) and regenerating
   * a canonical run against active eligible employees and effective-dated salary structures.
   */
  async reconcilePayrollRun(runId, actorUser, reason = 'Reconciled invalid payroll draft against canonical employee and salary records') {
    if (!actorUser || !actorUser.id) {
      const error = new Error('Authorized actor attribution is required to reconcile payroll runs.')
      error.code = 'UNAUTHORIZED'
      error.status = 401
      throw error
    }

    const existing = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        payrollPeriod: true,
        entries: true
      }
    })

    if (!existing) {
      const error = new Error(`Payroll run '${runId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (existing.status === 'DISBURSED' || existing.status === 'APPROVED') {
      const error = new Error(`Cannot reconcile a payroll run already in '${existing.status}' status.`)
      error.code = 'CANNOT_RECONCILE_FINALIZED'
      error.status = 400
      throw error
    }

    if (existing.status === 'VOID') {
      const error = new Error('Payroll run is already voided. Generate a draft directly for the period.')
      error.code = 'ALREADY_VOID'
      error.status = 400
      throw error
    }

    const periodCode = existing.payrollPeriod?.periodCode
    if (!periodCode) {
      const error = new Error('Payroll period metadata missing for run reconciliation.')
      error.code = 'PERIOD_NOT_FOUND'
      error.status = 404
      throw error
    }

    if (existing.status === 'DRAFT' && reason !== 'FORCE_VOID_REGENERATE') {
      return await this.reconcileDraftRunInPlace(runId, actorUser)
    }

    const cleanReason = String(reason || '').trim() || 'Payroll draft reconciliation'
    const voidedRun = await this.voidPayrollRun(runId, actorUser, cleanReason)
    const reconciledRun = await this.generateDraftPayrollRun(periodCode, actorUser)

    await prisma.auditLog.create({
      data: {
        actorUserId: actorUser.id,
        actorRole: actorUser.role || 'SUPER_ADMIN',
        sourceModule: 'PAYROLL',
        actionType: 'RECONCILE',
        entityName: 'PayrollRun',
        entityId: reconciledRun.id,
        recordSnapshotAfter: {
          voidedRunId: voidedRun.id,
          voidedRunNumber: voidedRun.runNumber,
          reconciledRunId: reconciledRun.id,
          reconciledRunNumber: reconciledRun.runNumber,
          periodCode,
          totalEmployees: reconciledRun.totalEmployees,
          totalGross: Number(reconciledRun.totalGross),
          totalNet: Number(reconciledRun.totalNet),
          reason: cleanReason
        }
      }
    })

    return {
      voidedRun,
      reconciledRun: {
        ...reconciledRun,
        isReconciled: true,
        hasInactiveEmployees: false,
        reconciliationIssues: []
      }
    }
  },

  /**
   * Controlled recalculation of manual payroll tax for DRAFT and PENDING_APPROVAL runs.
   * Preserves historical APPROVED, DISBURSED, and VOID runs as strictly immutable.
   */
  async recalculateDraftTax(runId, actorUser) {
    if (!runId) {
      const error = new Error('runId is required to recalculate tax.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        payrollPeriod: true,
        entries: {
          include: {
            employee: true
          }
        }
      }
    })

    if (!run) {
      const error = new Error(`Payroll run '${runId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Historical lock: ONLY DRAFT and PENDING_APPROVAL runs can be recalculated.
    // APPROVED, DISBURSED, and VOID runs are permanently immutable.
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(run.status) || run.paymentStatus === 'PAID') {
      const error = new Error(
        `Cannot recalculate tax for payroll run '${run.runNumber}'. Status is '${run.status}' (payment: ${run.paymentStatus}). Approved, paid, and void runs are permanently immutable historical records.`
      )
      error.code = 'IMMUTABLE_HISTORICAL_RUN'
      error.status = 409
      throw error
    }

    const taxConfig = await payrollTaxService.getTaxConfig()
    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0

    await prisma.$transaction(async (tx) => {
      for (const entry of run.entries) {
        const grossEarnings =
          Number(entry.basicSalary) +
          Number(entry.houseRentAllowance) +
          Number(entry.medicalAllowance) +
          Number(entry.conveyanceAllowance) +
          Number(entry.specialAllowance) +
          Number(entry.overtimeAmount) +
          Number(entry.bonusAmount) +
          Number(entry.commissionAmount)

        const taxCalc = await payrollTaxService.calculateEmployeeTax(
          entry.employee,
          grossEarnings,
          run.payrollPeriod?.startDate || new Date(),
          taxConfig
        )
        const newTaxDeduction = taxCalc.taxDeduction

        const unpaidAbsence = Number(entry.unpaidAbsenceDeduction || 0)
        const loanDeduction = Number(entry.loanDeduction || 0)
        const otherDeductions = Number(entry.otherDeductions || 0)
        const eobiDeduction = Number(entry.eobiDeduction || 0)
        const providentFundDeduction = Number(entry.providentFundDeduction || 0)

        const newTotalDeductions =
          newTaxDeduction + unpaidAbsence + loanDeduction + otherDeductions + eobiDeduction + providentFundDeduction
        const newNetSalary = Math.max(0, grossEarnings - newTotalDeductions)
        const unrecovered = newTotalDeductions > grossEarnings ? newTotalDeductions - grossEarnings : 0

        totalGross += grossEarnings
        totalDeductions += newTotalDeductions
        totalNet += newNetSalary

        await tx.payrollEntry.update({
          where: { id: entry.id },
          data: {
            taxDeduction: new Prisma.Decimal(newTaxDeduction.toFixed(2)),
            totalDeductions: new Prisma.Decimal(newTotalDeductions.toFixed(2)),
            netSalary: new Prisma.Decimal(newNetSalary.toFixed(2)),
            unrecoveredLiability: new Prisma.Decimal(unrecovered.toFixed(2))
          }
        })
      }

      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          totalGross: new Prisma.Decimal(totalGross.toFixed(2)),
          totalDeductions: new Prisma.Decimal(totalDeductions.toFixed(2)),
          totalNet: new Prisma.Decimal(totalNet.toFixed(2))
        }
      })

      // Snapshot applied tax configuration in organization_settings
      const org = await tx.organizationSetting.findFirst().catch(() => null)
      if (org) {
        const existingSnapshots = org.settingsJson?.runTaxSnapshots || {}
        await tx.organizationSetting.update({
          where: { id: org.id },
          data: {
            settingsJson: {
              ...(org.settingsJson || {}),
              runTaxSnapshots: {
                ...existingSnapshots,
                [run.id]: {
                  runNumber: run.runNumber,
                  appliedAt: new Date().toISOString(),
                  appliedBy: `${actorUser?.firstName || actorUser?.name || 'User'} (${actorUser?.role || 'ADMIN'})`,
                  config: {
                    mode: taxConfig.mode,
                    enabled: taxConfig.enabled,
                    ratePercentage: taxConfig.ratePercentage,
                    fixedAmount: taxConfig.fixedAmount,
                    overridesCount: (taxConfig.employeeOverrides || []).length
                  }
                }
              }
            }
          }
        }).catch((e) => console.warn('[PayrollService] Tax snapshot update warning:', e.message))
      }
    })

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUser.id,
        actorRole: actorUser.role || 'SUPER_ADMIN',
        sourceModule: 'PAYROLL',
        actionType: 'RECALCULATE_PAYROLL_TAX',
        entityName: 'PayrollRun',
        entityId: run.id,
        recordSnapshotBefore: {
          totalDeductions: Number(run.totalDeductions),
          totalNet: Number(run.totalNet)
        },
        recordSnapshotAfter: {
          totalDeductions: Math.round(totalDeductions * 100) / 100,
          totalNet: Math.round(totalNet * 100) / 100,
          appliedTaxMode: taxConfig.mode
        },
        reasonOrNotes: `Manual payroll tax recalculation applied under mode '${taxConfig.mode}'`
      }
    }).catch((e) => console.warn('[PayrollService] Recalculate tax audit log warning:', e.message))

    return this.getPayrollRunById(run.id)
  },

  /**
   * Generates server-validated bank transfer advice for APPROVED or DISBURSED runs only.
   * Blocks DRAFT, PENDING_APPROVAL, VOID, and unreconciled runs, and isolates employees
   * missing valid banking/IBAN details into heldItems without fabricating bank accounts.
   */
  async getBankAdvice(runId, actorUser, options = {}) {
    const run = await this.getPayrollRunById(runId)

    if (!['APPROVED', 'DISBURSED'].includes(run.status)) {
      const error = new Error(
        `Bank transfer advice blocked: Payroll run '${run.runNumber}' (${run.payrollPeriod?.periodCode || ''}) is '${run.status}'. Only APPROVED or DISBURSED runs can be exported.`
      )
      error.code = 'BANK_ADVICE_BLOCKED'
      error.status = 400
      throw error
    }

    await validatePayrollRunIntegrity(run)

    const items = run.entries.map((entry) => {
      const emp = entry.employee || {}
      const employeeName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.employeeCode || entry.employeeId
      const isDraftLike = ['DRAFT', 'PENDING_APPROVAL'].includes(run.status)
      const bankName = (isDraftLike ? emp.bankName : (entry.bankName || emp.bankName)) || null
      const accountTitle = (isDraftLike ? emp.bankAccountTitle : (entry.bankAccountTitle || emp.bankAccountTitle)) || null
      const accountNumber = (isDraftLike ? emp.bankAccountNumber : (entry.bankAccountNumber || emp.bankAccountNumber)) || null
      const rawIban = ((isDraftLike ? emp.bankIban : (entry.bankIban || emp.bankIban)) || '').replace(/\s+/g, '').toUpperCase() || null

      const hasBank = Boolean(bankName || accountNumber || rawIban)
      const validIban = isValidPakistaniIban(rawIban)
      const ownershipValid = validateBankAccountOwnership(accountTitle, employeeName)
      const isVerified = Boolean(bankName && validIban && ownershipValid)

      let holdReason = null
      if (!hasBank) holdReason = 'MISSING_BANK_DETAILS'
      else if (!validIban) holdReason = 'INVALID_PAKISTANI_IBAN'
      else if (!ownershipValid) holdReason = 'ACCOUNT_TITLE_MISMATCH'

      const netPayable = Number(entry.netSalary || 0)

      return {
        entryId: entry.id,
        employeeId: emp.employeeCode || entry.employeeId,
        employeeCuid: entry.employeeId,
        employeeName,
        department: emp.department?.name || 'Unassigned',
        bankName,
        accountTitle,
        accountNumber,
        iban: rawIban,
        isVerified,
        holdReason,
        paymentStatus: entry.paymentStatus,
        transactionReference: entry.transactionReference || null,
        netPayable
      }
    })

    const exportableItems = items.filter((item) => item.isVerified && item.netPayable > 0)
    const heldItems = items.filter((item) => !item.isVerified || item.netPayable <= 0)

    if (options.strictExport && exportableItems.length === 0) {
      const error = new Error(
        'Cannot export bank advice: No verified employee bank accounts with valid Pakistani IBAN and matching account ownership were found in this run.'
      )
      error.code = 'NO_VERIFIED_BANK_ACCOUNTS'
      error.status = 400
      throw error
    }

    return {
      runId: run.id,
      runNumber: run.runNumber,
      periodCode: run.payrollPeriod?.periodCode || null,
      status: run.status,
      isReconciled: run.isReconciled,
      canExport: exportableItems.length > 0,
      recordCount: exportableItems.length,
      holdCount: heldItems.length,
      totalPayable: Math.round(items.reduce((sum, i) => sum + i.netPayable, 0)),
      exportableTotal: Math.round(exportableItems.reduce((sum, i) => sum + i.netPayable, 0)),
      items,
      exportableItems,
      heldItems
    }
  },

  // ============================================================================
  // 4. PAYSLIPS & EMPLOYEE SELF-SERVICE
  // ============================================================================

  async getPayslips(filters = {}, requestingUser = null) {
    const where = {}

    if (filters.periodCode) {
      where.payrollRun = { payrollPeriod: { periodCode: filters.periodCode } }
    }
    if (filters.employeeId) {
      where.employeeId = filters.employeeId
    }

    // Role-based privacy scoping
    if (requestingUser) {
      if (requestingUser.role === 'EMPLOYEE') {
        if (!requestingUser.employee?.id) return []
        where.employeeId = requestingUser.employee.id
        // Employees can only view finalized/approved payslips
        where.payrollRun = {
          ...where.payrollRun,
          status: { in: ['APPROVED', 'DISBURSED'] }
        }
      } else if (requestingUser.role === 'DEPT_MANAGER' && requestingUser.employee?.departmentId) {
        where.employee = { departmentId: requestingUser.employee.departmentId }
      }
    }

    const payslips = await prisma.payrollEntry.findMany({
      where,
      orderBy: { payrollRun: { runDate: 'desc' } },
      include: {
        payrollRun: {
          select: {
            id: true,
            runNumber: true,
            runDate: true,
            status: true,
            payrollPeriod: true
          }
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        }
      }
    })

    const slipsWithAttendance = await Promise.all(
      payslips.map(async (ps) => {
        const periodStart = ps.payrollRun?.payrollPeriod?.startDate
        const periodEnd = ps.payrollRun?.payrollPeriod?.endDate
        let actualPresent = 0
        if (periodStart && periodEnd) {
          actualPresent = await prisma.attendanceRecord.count({
            where: {
              employeeId: ps.employeeId,
              attendanceDate: { gte: periodStart, lte: periodEnd },
              firstCheckIn: { not: null }
            }
          })
        }
        return {
          ...ps,
          daysPresent: actualPresent
        }
      })
    )

    return slipsWithAttendance
  },

  async getPayslipById(entryId, requestingUser = null) {
    const entry = await prisma.payrollEntry.findUnique({
      where: { id: entryId },
      include: {
        payrollRun: {
          include: { payrollPeriod: true }
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
            bankName: true,
            bankAccountTitle: true,
            bankAccountNumber: true,
            bankIban: true,
            taxNtnNumber: true
          }
        }
      }
    })

    if (!entry) {
      const error = new Error(`Payslip with ID '${entryId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Privacy guard
    if (requestingUser?.role === 'EMPLOYEE' && requestingUser.employee?.id !== entry.employeeId) {
      const error = new Error('Access denied: You are not authorized to view another employee’s payslip.')
      error.code = 'FORBIDDEN'
      error.status = 403
      throw error
    }

    let statutoryLiability = 0
    try {
      statutoryLiability = calculateSalaryTax(
        Number(entry.grossEarnings),
        0,
        entry.payrollRun?.payrollPeriod?.startDate || new Date()
      ).monthlyTaxWithholding
    } catch {
      statutoryLiability = 0
    }

    const actualPresentCount = await prisma.attendanceRecord.count({
      where: {
        employeeId: entry.employeeId,
        attendanceDate: {
          gte: entry.payrollRun.payrollPeriod.startDate,
          lte: entry.payrollRun.payrollPeriod.endDate
        },
        firstCheckIn: { not: null }
      }
    })

    return {
      id: entry.id,
      payslipNumber: `SLIP-${entry.payrollRun.payrollPeriod.periodCode}-${entry.employee.employeeCode}`,
      period: entry.payrollRun.payrollPeriod.periodCode,
      runNumber: entry.payrollRun.runNumber,
      runStatus: entry.payrollRun.status,
      paymentStatus: entry.paymentStatus,
      paidAt: entry.paidAt,
      paymentMethod: entry.paymentMethod,
      transactionReference: entry.transactionReference,
      employee: {
        id: entry.employee.id,
        code: entry.employee.employeeCode,
        name: `${entry.employee.firstName} ${entry.employee.lastName}`,
        department: entry.employee.department?.name,
        designation: entry.employee.designation?.title,
        bankName: entry.bankName || entry.employee.bankName,
        accountTitle: entry.bankAccountTitle || entry.employee.bankAccountTitle,
        accountNumber: entry.bankAccountNumber || entry.employee.bankAccountNumber,
        iban: entry.bankIban || entry.employee.bankIban,
        ntn: entry.employee.taxNtnNumber
      },
      timeAndAttendance: {
        calendarDays: entry.calendarDays,
        payableDays: Number(entry.payableDays),
        daysPresent: actualPresentCount,
        unpaidDays: Number(entry.unpaidLeaveDays),
        extraLeaveDays: Number(entry.unpaidLeaveDays),
        overtimeHours: Number(entry.overtimeHours)
      },
      daysPresent: actualPresentCount,
      earnings: {
        basicSalary: Number(entry.basicSalary),
        dailyBasicRate: Math.round((Number(entry.basicSalary) / 31) * 100) / 100, // FIXED 31-DAY RATE
        houseRentAllowance: Number(entry.houseRentAllowance),
        medicalAllowance: Number(entry.medicalAllowance),
        conveyanceAllowance: Number(entry.conveyanceAllowance),
        specialAllowance: Number(entry.specialAllowance),
        overtimeAmount: Number(entry.overtimeAmount),
        bonusAmount: Number(entry.bonusAmount),
        commissionAmount: Number(entry.commissionAmount),
        grossEarnings: Number(entry.grossEarnings)
      },
      deductions: {
        incomeTaxWithholding: Number(entry.taxDeduction),
        statutoryTaxObligation: Number(statutoryLiability),
        statutoryVariance: Number(statutoryLiability - Number(entry.taxDeduction)),
        unpaidAbsenceDeduction: Number(entry.unpaidAbsenceDeduction),
        extraLeaveDeduction: Number(entry.otherDeductions),
        loanDeduction: Number(entry.loanDeduction),
        eobiDeduction: Number(entry.eobiDeduction),
        providentFundDeduction: Number(entry.providentFundDeduction),
        otherDeductions: Number(entry.otherDeductions),
        unrecoveredLiability: Number(entry.unrecoveredLiability || 0),
        totalDeductions: Number(entry.totalDeductions)
      },
      netPayable: Number(entry.netSalary),
      unrecoveredLiability: Number(entry.unrecoveredLiability || 0),
      currency: entry.currency
    }
  },

  async getPayrollSummary(periodCode, requestingUser = null) {
    if (!periodCode) {
      const error = new Error('periodCode is required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const period = await prisma.payrollPeriod.findUnique({
      where: { periodCode: periodCode.trim() },
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
                    employmentStatus: true,
                    joiningDate: true,
                    terminationDate: true,
                    department: { select: { id: true, name: true } },
                    salaryStructures: {
                      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }]
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!period) {
      const error = new Error(`Payroll period '${periodCode}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const latestRun = period.runs[0] || null

    if (!latestRun) {
      return {
        periodCode,
        status: 'UNPROCESSED',
        totalEmployees: 0,
        totalGross: 0,
        totalTax: 0,
        totalDeductions: 0,
        totalNet: 0,
        departmentBreakdown: []
      }
    }

    const deptMap = new Map()
    let totalTaxWithheld = 0
    let totalStatutoryTax = 0

    for (const entry of latestRun.entries) {
      const deptName = entry.employee.department?.name || 'Unassigned'
      const cur = deptMap.get(deptName) || { count: 0, gross: 0, net: 0, tax: 0 }
      cur.count++
      cur.gross += Number(entry.grossEarnings)
      cur.net += Number(entry.netSalary)
      cur.tax += Number(entry.taxDeduction)
      deptMap.set(deptName, cur)

      totalTaxWithheld += Number(entry.taxDeduction || 0)
      try {
        totalStatutoryTax += calculateSalaryTax(
          Number(entry.grossEarnings || 0),
          0,
          period.startDate
        ).monthlyTaxWithholding
      } catch (e) {
        // fallback
      }
    }

    const departmentBreakdown = Array.from(deptMap.entries()).map(([department, data]) => ({
      department,
      employeeCount: data.count,
      grossTotal: Math.round(data.gross),
      netTotal: Math.round(data.net),
      taxTotal: Math.round(data.tax)
    }))

    const reconciliation = assessPayrollRunReconciliation({
      ...latestRun,
      payrollPeriod: period
    })

    return {
      periodCode,
      runId: latestRun.id,
      runNumber: latestRun.runNumber,
      runStatus: latestRun.status,
      paymentStatus: latestRun.paymentStatus,
      totalEmployees: latestRun.totalEmployees,
      entryCount: reconciliation.entryCount,
      isReconciled: reconciliation.isReconciled,
      hasInactiveEmployees: reconciliation.hasInactiveEmployees,
      reconciliationIssues: reconciliation.reconciliationIssues,
      totalGross: Number(latestRun.totalGross),
      totalTaxWithheld: Math.round(totalTaxWithheld * 100) / 100,
      statutoryTaxObligationTotal: Math.round(totalStatutoryTax * 100) / 100,
      statutoryTaxVariance: Math.round((totalStatutoryTax - totalTaxWithheld) * 100) / 100,
      totalDeductions: Number(latestRun.totalDeductions),
      totalNet: Number(latestRun.totalNet),
      departmentBreakdown
    }
  }
}

export default payrollService
