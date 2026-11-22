import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { reportService } from '../services/reportService.js'
import { loanService } from '../services/loanService.js'

const superAdmin = { id: 'usr_super', name: 'Super Admin', role: 'super_admin' }

describe('F14 Reporting & Analytics — Comprehensive Root-Cause Verification (All 75 Reports)', () => {
  it('1. RPT-PAY-001: Reconciles canonical November run RUN-202611-02 under All and Active filters', async () => {
    const resAll = await reportService.generateReport('RPT-PAY-001', {}, superAdmin)
    assert.strictEqual(resAll.rows.length, 5, 'November payroll must have exactly 5 employees')
    assert.strictEqual(resAll.summary.totalGross, 180000, 'Gross payroll must equal PKR 180,000')
    assert.strictEqual(resAll.summary.totalBasic, 180000, 'Basic payroll must equal PKR 180,000')
    assert.strictEqual(resAll.summary.totalTax, 500, 'Tax withheld must equal PKR 500')
    assert.strictEqual(resAll.summary.totalNet, 179500, 'Net disbursed must equal PKR 179,500')

    const resActive = await reportService.generateReport('RPT-PAY-001', { status: 'active' }, superAdmin)
    assert.strictEqual(resActive.rows.length, 5, 'Active Staff filter must return all active employees in payroll')
    assert.strictEqual(resActive.summary.totalGross, 180000)
    assert.strictEqual(resActive.summary.totalNet, 179500)

    const resInactive = await reportService.generateReport('RPT-PAY-001', { status: 'inactive' }, superAdmin)
    assert.strictEqual(resInactive.rows.length, 0, 'Inactive filter returns 0 rows')
    assert.strictEqual(resInactive.summary.totalGross, 0, 'KPIs must recompute to 0 when filtered to empty')
    assert.strictEqual(resInactive.summary.totalNet, 0)
  })

  it('2. RPT-LEV-001: EMP-003 Annual Leave strictly reconciles to Allocated 14d, Utilized 1d, Available 13d', async () => {
    const res = await reportService.generateReport('RPT-LEV-001', {}, superAdmin)
    const emp003AL = res.rows.find(
      (r) => r.employeeId === 'EMP-003' && (r.leaveType === 'Annual Leave' || r.type === 'Annual Leave')
    )
    assert.ok(emp003AL, 'EMP-003 Annual Leave ledger row must exist')
    assert.strictEqual(emp003AL.opening, 14, 'Allocated opening must be 14d')
    assert.strictEqual(emp003AL.consumed, 1, 'Utilized consumed must be 1d')
    assert.strictEqual(emp003AL.closing, 13, 'Available closing must be 13d')
  })

  it('3. RPT-LEV-002: Period filtering includes LV-202611-001 (EMP-003, 18 Nov, 1 day, Approved)', async () => {
    const res = await reportService.generateReport(
      'RPT-LEV-002',
      { startDate: '2026-11-01', endDate: '2026-11-30' },
      superAdmin
    )
    const req001 = res.rows.find((r) => r.requestId === 'LV-202611-001' || r.id === 'LV-202611-001')
    assert.ok(req001, 'LV-202611-001 must appear in November leave report')
    assert.strictEqual(req001.days, 1)
    assert.strictEqual(req001.status, 'Approved')
    assert.strictEqual(req001.startDate, '2026-11-18')
  })

  it('4. RPT-REC-002: Candidate pipeline maps real names, positions, and departments (no undefined)', async () => {
    const res = await reportService.generateReport('RPT-REC-002', {}, superAdmin)
    assert.ok(res.rows.length >= 8, 'Candidate pipeline must have candidates')
    res.rows.forEach((row) => {
      assert.ok(row.name && row.name !== 'undefined', `Candidate ${row.candidateId} must have valid name`)
      assert.ok(row.position && row.position !== 'undefined', `Candidate ${row.candidateId} must have valid position`)
      assert.ok(row.department && row.department !== 'undefined', `Candidate ${row.candidateId} must have valid department`)
    })
  })

  it('5. RPT-REC-003: UAT QA Candidate scheduled on 20 Nov 2026, 11 AM-12 PM, UAT Dev Manager, Scheduled', async () => {
    const res = await reportService.generateReport('RPT-REC-003', {}, superAdmin)
    const uatInt = res.rows.find((r) => r.candidateName?.includes('UAT QA Candidate'))
    assert.ok(uatInt, 'UAT QA Candidate interview must be present in RPT-REC-003')
    assert.strictEqual(uatInt.scheduledDate, '2026-11-20', 'Scheduled date must be 20 Nov 2026')
    assert.ok(uatInt.interviewer?.includes('UAT Dev Manager'), 'Interviewer must be UAT Dev Manager')
    assert.strictEqual(uatInt.status, 'Scheduled', 'Status must be Scheduled')
    assert.strictEqual(uatInt.score, '—', 'Unevaluated interview score must be —')
    assert.strictEqual(uatInt.recommendation, 'Pending Evaluation', 'Recommendation must be Pending Evaluation')
  })

  it('6. RPT-ATT-001 & RPT-ATT-004: EMP-005 on 18 Nov reflects Half Day (0.0h worked, 443m late, 97m early exit)', async () => {
    const res = await reportService.generateReport('RPT-ATT-001', { date: '2026-11-18' }, superAdmin)
    const emp005 = res.rows.find((r) => r.employeeId === 'EMP-005')
    assert.ok(emp005, 'EMP-005 record must exist for 18 Nov')
    assert.strictEqual(emp005.status, 'Half Day', 'Zero worked hours must classify as Half Day')
    assert.strictEqual(emp005.workHours, 0)
    assert.strictEqual(emp005.lateMinutes, 443)

    const resEarly = await reportService.generateReport('RPT-ATT-004', {}, superAdmin)
    const earlyEmp005 = resEarly.rows.find((r) => r.employeeId === 'EMP-005')
    assert.ok(earlyEmp005, 'EMP-005 must appear in Early Departure report')
    assert.strictEqual(earlyEmp005.earlyMinutes, 97)
  })

  it('7. RPT-ORG-001 to RPT-ORG-006: Workforce integrity, zero duplicate counts, banking verification and separation safety', async () => {
    // RPT-ORG-001
    const org1 = await reportService.generateReport('RPT-ORG-001', {}, superAdmin)
    assert.strictEqual(org1.rows.length, 14, 'Total employee profiles must be exactly 14')
    assert.strictEqual(org1.summary.probationCount, 2, 'Probation count must equal 2 (EMP-006, EMP-014)')
    assert.strictEqual(org1.summary.activeCount, 11, 'Confirmed permanent active count must equal 11')

    // RPT-ORG-002
    const org2 = await reportService.generateReport('RPT-ORG-002', {}, superAdmin)
    assert.strictEqual(org2.summary.totalHeadcount, 14, 'Total departmental headcount must not exceed 14 (no duplicate counting across teams)')

    // RPT-ORG-004
    const org4 = await reportService.generateReport('RPT-ORG-004', {}, superAdmin)
    assert.strictEqual(org4.summary.totalDue, 2, 'Probation reviews due must be 2')
    assert.strictEqual(org4.summary.pendingConfirmation, 1, 'Pending confirmation must be 1')
    assert.strictEqual(org4.summary.confirmedCount, 1, 'Confirmed count must be 1')

    // RPT-ORG-005
    const org5 = await reportService.generateReport('RPT-ORG-005', {}, superAdmin)
    assert.strictEqual(org5.summary.pendingVerificationCount, 2, 'Pending bank account verifications must be 2')
    assert.strictEqual(org5.summary.verifiedCount, 12, 'Verified bank accounts must be 12')

    // RPT-ORG-006
    const org6 = await reportService.generateReport('RPT-ORG-006', {}, superAdmin)
    const emp003Sep = org6.rows.find((r) => r.employeeId === 'EMP-003' && r.eventType === 'Separation')
    const emp011Sep = org6.rows.find((r) => r.employeeId === 'EMP-011' && r.eventType === 'Separation')
    assert.strictEqual(emp003Sep, undefined, 'Active employee EMP-003 must never be marked Separated')
    assert.strictEqual(emp011Sep, undefined, 'Active employee EMP-011 must never be marked Separated')
  })

  it('8. RPT-PAY-002 & RPT-PAY-004: Draft payroll RUN-202611-02 GAAP compliance (disbursement liability = 0)', async () => {
    // RPT-PAY-002
    const pay2 = await reportService.generateReport('RPT-PAY-002', {}, superAdmin)
    assert.strictEqual(pay2.summary.totalGrossEarnings, 180000)
    assert.strictEqual(pay2.summary.totalNetDisbursed, 0, 'DRAFT payroll has not been disbursed, totalNetDisbursed must be 0')

    // RPT-PAY-004
    const pay4 = await reportService.generateReport('RPT-PAY-004', {}, superAdmin)
    assert.strictEqual(pay4.summary.totalDisbursed, 0, 'Disbursed bank transfers must be 0 for draft advice')
    assert.strictEqual(pay4.summary.totalUnpaidLiability, 179500, 'Unpaid payroll liability must be PKR 179,500')
    pay4.rows.forEach((r) => {
      assert.strictEqual(r.batchRef, 'Unbatched (Draft)')
      assert.strictEqual(r.paymentStatus, 'Draft Advice (Unapproved)')
      assert.strictEqual(r.amountPaid, 0)
    })
  })

  it('9. RPT-BEN-005 & RPT-BEN-007: Canonical loan LN-2026-001 (Principal 9,000, Recovered 0, Outstanding 9,000)', async () => {
    // 1. Single loan check
    const ben5 = await reportService.generateReport('RPT-BEN-005', {}, superAdmin)
    assert.strictEqual(ben5.rows.length, 1, 'Only active canonical loan LN-2026-001 on ledger')
    const ln = ben5.rows[0]
    assert.strictEqual(ln.loanId, 'LN-2026-001')
    assert.strictEqual(ln.principalAmount, 9000)
    assert.strictEqual(ln.totalRecovered, 0)
    assert.strictEqual(ln.outstandingBalance, 9000)
    assert.strictEqual(ben5.summary.totalOutstandingBalance, 9000)

    // RPT-BEN-007
    const ben7 = await reportService.generateReport('RPT-BEN-007', {}, superAdmin)
    assert.strictEqual(ben7.rows.length, 1)
    const lnSchedule = ben7.rows[0]
    assert.strictEqual(lnSchedule.installmentDue, 3000)
    assert.strictEqual(lnSchedule.payrollRecovered, 0)
    assert.strictEqual(lnSchedule.variance, -3000)

    // 2. Production Simulation: 5 loans in storage (1 Active, 3 Rejected, 1 Pending = 41,000 raw principal, 14,500 raw installments)
    const backupLoans = loanService._getItem('isysware_hrms_f06_loans_v1')
    try {
      loanService._setItem('isysware_hrms_f06_loans_v1', [
        { id: 'LN-2026-001', employeeId: 'EMP-004', employeeName: 'UAT Dev Manager', principalAmount: 9000, installmentAmount: 3000, status: 'Active', outstandingBalance: 9000, totalRecovered: 0, repaidAmount: 0, repaymentStartMonth: '2026-11' },
        { id: 'LN-2026-002', employeeId: 'EMP-004', employeeName: 'UAT Dev Manager', principalAmount: 9000, installmentAmount: 3000, status: 'Rejected', outstandingBalance: 9000, totalRecovered: 0, repaidAmount: 0 },
        { id: 'LN-2026-003', employeeId: 'EMP-004', employeeName: 'UAT Dev Manager', principalAmount: 9000, installmentAmount: 3000, status: 'Rejected', outstandingBalance: 9000, totalRecovered: 0, repaidAmount: 0 },
        { id: 'LN-2026-004', employeeId: 'EMP-004', employeeName: 'UAT Dev Manager', principalAmount: 9000, installmentAmount: 3000, status: 'Rejected', outstandingBalance: 9000, totalRecovered: 0, repaidAmount: 0 },
        { id: 'LN-2026-005', employeeId: 'EMP-004', employeeName: 'UAT Dev Manager', principalAmount: 5000, installmentAmount: 2500, status: 'Pending Super Admin Review', outstandingBalance: 5000, totalRecovered: 0, repaidAmount: 0 }
      ])

      const prodBen5 = await reportService.generateReport('RPT-BEN-005', {}, superAdmin)
      assert.strictEqual(prodBen5.rows.length, 1, 'Strict exclusion: Rejected and Pending loans must NEVER appear on loan ledger')
      assert.strictEqual(prodBen5.summary.totalPrincipalDisbursed, 9000, 'Total principal must be exactly 9,000 (NEVER 41,000)')
      assert.strictEqual(prodBen5.summary.totalOutstandingBalance, 9000, 'Total outstanding must be exactly 9,000 (NEVER 41,000)')
      assert.strictEqual(prodBen5.reconciliation.reconciled, true)

      const prodBen7 = await reportService.generateReport('RPT-BEN-007', {}, superAdmin)
      assert.strictEqual(prodBen7.rows.length, 1, 'Strict exclusion: Only Active loans qualify for due installments')
      assert.strictEqual(prodBen7.summary.totalDue, 3000, 'Total installment due must be exactly 3,000 (NEVER 14,500)')
      assert.strictEqual(prodBen7.reconciliation.reconciled, true)
    } finally {
      loanService._setItem('isysware_hrms_f06_loans_v1', backupLoans)
    }
  })

  it('10. RPT-POL-001: Active policies reflect complete set of corporate governance standards', async () => {
    const pol1 = await reportService.generateReport('RPT-POL-001', {}, superAdmin)
    assert.strictEqual(pol1.summary.totalActivePolicies, 11)
  })

  it('11. All 75 reports execute cleanly and dynamically recompute KPIs from filtered rows', async () => {
    const reports = reportService.getReports()
    assert.strictEqual(reports.length, 75, 'Must have exactly 75 reports')
    for (const r of reports) {
      const res = await reportService.generateReport(r.id, {}, superAdmin)
      assert.ok(res, `Report ${r.id} must return valid result object`)
      assert.ok(Array.isArray(res.rows), `Report ${r.id} rows must be array`)
      assert.ok(typeof res.summary === 'object', `Report ${r.id} summary must be object`)

      const resActive = await reportService.generateReport(r.id, { status: 'active' }, superAdmin)
      assert.ok(resActive, `Report ${r.id} with active filter must return valid result`)
      if (resActive.rows.length === 0) {
        Object.entries(resActive.summary).forEach(([k, v]) => {
          if (typeof v === 'number') {
            assert.strictEqual(v, 0, `Summary KPI ${k} must be 0 when rows are empty for ${r.id}`)
          }
        })
      }
    }
  })
})
