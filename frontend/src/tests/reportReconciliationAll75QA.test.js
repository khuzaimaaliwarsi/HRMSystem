import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { reportService } from '../services/reportService.js'

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

  it('7. All 75 reports execute cleanly and dynamically recompute KPIs from filtered rows', async () => {
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
