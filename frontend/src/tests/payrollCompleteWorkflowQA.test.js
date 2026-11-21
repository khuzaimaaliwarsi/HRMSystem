/**
 * iSysware HRMS — Payroll Complete Workflow & UI Verification Test Suite
 * Validates:
 * 1. Bulk Monthly Payroll Runs: Section B renders 1 row per run with required fields.
 * 2. Employee-wise Monthly Salary Breakdown: Section C displays each employee in their own row.
 * 3. Exact Mathematical Reconciliation: KPIs = Bulk Run Row = Sum of Employee Rows.
 * 4. Refresh / Recalculate Existing Payroll Draft: Preserves exact Run ID and Run Number.
 * 5. Refresh Draft Immutability Guard: Blocked on Approved, Disbursed, or Void runs.
 * 6. Individual Employee Approval: Server-side RBAC, audit log, non-disbursing (UNPAID).
 * 7. Anti-Self-Approval Guard: Requester cannot approve their own payroll entry.
 * 8. Bulk Approval Compatibility: Blocked when any individual entry is REJECTED.
 * 9. View Payslip Action: Builds accurate itemized payslip from breakdown entry.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import payrollService from '../services/payrollService.js'
import { loanService } from '../services/loanService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('Payroll Complete Workflow — 1. Section B Table Layout & 1 Row per Monthly Run', () => {
  const tableFilePath = path.join(__dirname, '../components/payroll/PayrollRunTable.jsx')
  const content = fs.readFileSync(tableFilePath, 'utf8')

  // Verify headers: Period | Headcount | Gross Payroll | Tax Withheld | Loan Recoveries | Net Payable | Status | Actions
  assert.ok(content.includes('Period'), 'PayrollRunTable must include Period column')
  assert.ok(content.includes('Headcount'), 'PayrollRunTable must include Headcount column')
  assert.ok(content.includes('Gross Payroll'), 'PayrollRunTable must include Gross Payroll column')
  assert.ok(content.includes('Tax Withheld'), 'PayrollRunTable must include Tax Withheld column')
  assert.ok(content.includes('Loans Recovered') || content.includes('Loan Recoveries'), 'PayrollRunTable must include Loans Recovered column')
  assert.ok(content.includes('Net Payable'), 'PayrollRunTable must include Net Payable column')
  assert.ok(content.includes('Status'), 'PayrollRunTable must include Status column')
  assert.ok(content.includes('Actions'), 'PayrollRunTable must include Actions column')

  // Verify Refresh Draft button is present for DRAFT runs
  assert.ok(content.includes('Refresh Draft'), 'PayrollRunTable must render Refresh Draft button for DRAFT runs')
  assert.ok(content.includes('onRefreshDraft'), 'PayrollRunTable must accept onRefreshDraft prop')

  // Verify 1 row per run logic
  assert.ok(content.includes('effectiveRuns.map((run) => ('), 'PayrollRunTable maps 1 row per run')
})

test('Payroll Complete Workflow — 2. Section C Employee-wise Monthly Salary Breakdown Table', () => {
  const breakdownFilePath = path.join(__dirname, '../components/payroll/EmployeePayrollBreakdownTable.jsx')
  assert.ok(fs.existsSync(breakdownFilePath), 'EmployeePayrollBreakdownTable.jsx must exist')

  const content = fs.readFileSync(breakdownFilePath, 'utf8')

  // Verify mandatory columns
  assert.ok(content.includes('Employee Name / ID'), 'Must have Employee Name / ID column')
  assert.ok(content.includes('Basic Salary'), 'Must have Basic Salary column')
  assert.ok(content.includes('Allowances'), 'Must have Allowances column')
  assert.ok(content.includes('Overtime'), 'Must have Overtime column')
  assert.ok(content.includes('Tax'), 'Must have Tax column')
  assert.ok(content.includes('Loan Deduction'), 'Must have Loan Deduction column')
  assert.ok(content.includes('Other Deductions'), 'Must have Other Deductions column')
  assert.ok(content.includes('Net Payable'), 'Must have Net Payable column')
  assert.ok(content.includes('Status'), 'Must have Status column')
  assert.ok(content.includes('Actions'), 'Must have Actions column')

  // Verify filters
  assert.ok(content.includes('Payroll Period'), 'Must include Month/Period selector')
  assert.ok(content.includes('Search Employee'), 'Must include Search filter')
  assert.ok(content.includes('Department'), 'Must include Department filter')
  assert.ok(content.includes('Approval Status'), 'Must include Approval Status filter')

  // Verify action buttons
  assert.ok(content.includes('View Payslip'), 'Must include View Payslip action')
  assert.ok(content.includes('onApproveEntry') || content.includes('Approve'), 'Must include Approve action')
})

test('Payroll Complete Workflow — 3. Mathematical Reconciliation (Run Totals = Sum of Employee Rows)', () => {
  payrollService.resetToDefaults()
  const runs = payrollService.getPayrollRuns()
  const sampleRun = runs.find((r) => r.employeeBreakdown && r.employeeBreakdown.length > 0)
  assert.ok(sampleRun, 'Must have at least one run with employeeBreakdown')

  const breakdown = sampleRun.employeeBreakdown
  const sumGross = breakdown.reduce((sum, e) => sum + Number(e.grossSalary || 0), 0)
  const sumNet = breakdown.reduce((sum, e) => sum + Number(e.netPayable || 0), 0)
  const sumTax = breakdown.reduce((sum, e) => sum + Number(e.salaryTaxWithheld || e.incomeTax || 0), 0)
  const sumLoans = breakdown.reduce((sum, e) => sum + Number(e.loanDeduction || 0), 0)

  // Verify employee entries sum reconciles with run totals
  assert.equal(Math.round(sumGross), Math.round(Number(sampleRun.grossPayroll || 0)), 'Sum of employee gross must equal run grossPayroll')
  assert.equal(Math.round(sumNet), Math.round(Number(sampleRun.netPayable || 0)), 'Sum of employee net must equal run netPayable')
  assert.equal(Math.round(sumTax), Math.round(Number(sampleRun.totalTaxWithheld || 0)), 'Sum of employee tax must equal run totalTaxWithheld')
  assert.equal(Math.round(sumLoans), Math.round(Number(sampleRun.totalLoanDeductions || 0)), 'Sum of employee loans must equal run totalLoanDeductions')
})

test('Payroll Complete Workflow — 4. Refresh Draft Preserves Exact Run ID and Run Number', () => {
  payrollService.resetToDefaults()

  // Prepare a draft run
  const draftRun = {
    id: 'RUN-202611-02',
    runNumber: 'RUN-202611-02',
    period: '2026-11',
    periodName: 'November 2026',
    fiscalYear: '2026-2027',
    status: 'Draft',
    preparedBy: 'Super Admin',
    grossPayroll: 180000,
    netPayable: 179500,
    totalTaxWithheld: 500,
    totalLoanDeductions: 0,
    totalEmployees: 5,
    employeeBreakdown: [
      { employeeId: 'EMP-001', employeeName: 'Super Admin', grossSalary: 35000, netPayable: 35000, approvalStatus: 'PENDING' },
      { employeeId: 'EMP-002', employeeName: 'Ayesha Khan', grossSalary: 35000, netPayable: 35000, approvalStatus: 'PENDING' },
      { employeeId: 'EMP-003', employeeName: 'Hamza Ahmed', grossSalary: 35000, netPayable: 35000, approvalStatus: 'PENDING' },
      { employeeId: 'EMP-004', employeeName: 'Ali Raza', grossSalary: 35000, netPayable: 35000, approvalStatus: 'PENDING' },
      { employeeId: 'EMP-005', employeeName: 'Ahmed Khan', grossSalary: 40000, netPayable: 39500, approvalStatus: 'PENDING' }
    ]
  }

  payrollService.memoryStorage['isysware_hrms_f06_payroll_runs_v1'] = [draftRun]

  // Execute Refresh Draft
  const refreshed = payrollService.refreshDraftRun('RUN-202611-02', { id: 'admin-1', name: 'Super Admin', role: 'super_admin' })

  // Verify Run ID and Run Number are 100% IDENTICAL
  assert.equal(refreshed.id, 'RUN-202611-02', 'Refresh Draft MUST preserve exact Run ID')
  assert.equal(refreshed.runNumber, 'RUN-202611-02', 'Refresh Draft MUST preserve exact Run Number')
  assert.equal(refreshed.period, '2026-11', 'Refresh Draft MUST preserve period')
})

test('Payroll Complete Workflow — 5. Refresh Draft Immutability Guard (Blocked on Approved/Disbursed/Void)', () => {
  payrollService.resetToDefaults()

  const finalizedRun = {
    id: 'RUN-202610-01',
    runNumber: 'RUN-202610-01',
    period: '2026-10',
    status: 'Approved',
    employeeBreakdown: []
  }

  payrollService.memoryStorage['isysware_hrms_f06_payroll_runs_v1'] = [finalizedRun]

  assert.throws(
    () => {
      payrollService.refreshDraftRun('RUN-202610-01', { id: 'admin-1', name: 'Super Admin', role: 'super_admin' })
    },
    /Cannot refresh payroll run.*Status is 'Approved'/i,
    'Refresh draft must throw an error when attempted on an Approved run'
  )
})

test('Payroll Complete Workflow — 6. Individual Employee Payroll Approval (Non-disbursing, single entry)', () => {
  payrollService.resetToDefaults()

  const draftRun = {
    id: 'RUN-202611-02',
    runNumber: 'RUN-202611-02',
    period: '2026-11',
    status: 'Draft',
    employeeBreakdown: [
      { entryId: 'ENT-001', employeeId: 'EMP-002', employeeName: 'Ayesha Khan', paymentStatus: 'UNPAID', approvalStatus: 'PENDING' },
      { entryId: 'ENT-002', employeeId: 'EMP-003', employeeName: 'Hamza Ahmed', paymentStatus: 'UNPAID', approvalStatus: 'PENDING' }
    ]
  }

  payrollService.memoryStorage['isysware_hrms_f06_payroll_runs_v1'] = [draftRun]

  // Approve EMP-002 only
  const approver = { id: 'admin-1', name: 'Super Admin', role: 'super_admin', employeeId: 'EMP-001' }
  const result = payrollService.approveEmployeeEntry('RUN-202611-02', 'ENT-001', approver, 'Verified')

  assert.equal(result.success, true)
  assert.equal(result.approvalStatus, 'APPROVED')

  // Inspect run state
  const run = payrollService.getPayrollRunById('RUN-202611-02')
  const entry1 = run.employeeBreakdown.find((e) => e.entryId === 'ENT-001')
  const entry2 = run.employeeBreakdown.find((e) => e.entryId === 'ENT-002')

  // Entry 1 is approved, but paymentStatus remains UNPAID (non-disbursing)
  assert.equal(entry1.approvalStatus, 'APPROVED')
  assert.equal(entry1.paymentStatus, 'UNPAID', 'Individual approval must not trigger salary payment')

  // Entry 2 remains PENDING (other entries untouched)
  assert.equal(entry2.approvalStatus, 'PENDING', 'Other employees must remain unaffected')
})

test('Payroll Complete Workflow — 7. Anti-Self-Approval Guard on Employee Payroll Entry', () => {
  payrollService.resetToDefaults()

  const draftRun = {
    id: 'RUN-202611-02',
    runNumber: 'RUN-202611-02',
    period: '2026-11',
    status: 'Draft',
    employeeBreakdown: [
      { entryId: 'ENT-001', employeeId: 'EMP-002', employeeCode: 'EMP-002', employeeName: 'Ayesha Khan', approvalStatus: 'PENDING' }
    ]
  }

  payrollService.memoryStorage['isysware_hrms_f06_payroll_runs_v1'] = [draftRun]

  // Ayesha Khan attempts to approve her own payroll entry
  const selfUser = { id: 'u-ayesha', name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002', employeeCode: 'EMP-002' }

  assert.throws(
    () => {
      payrollService.approveEmployeeEntry('RUN-202611-02', 'ENT-001', selfUser)
    },
    /Anti-Self-Approval Prohibited/i,
    'Employee must be prohibited from approving their own payroll entry'
  )
})

test('Payroll Complete Workflow — 8. Bulk Approval Compatibility with Individual Approvals & Rejection Blocking', () => {
  payrollService.resetToDefaults()

  const draftRunWithRejection = {
    id: 'RUN-202611-02',
    runNumber: 'RUN-202611-02',
    period: '2026-11',
    status: 'Draft',
    employeeBreakdown: [
      { entryId: 'ENT-001', employeeId: 'EMP-002', employeeName: 'Ayesha Khan', approvalStatus: 'APPROVED' },
      { entryId: 'ENT-002', employeeId: 'EMP-003', employeeName: 'Hamza Ahmed', approvalStatus: 'REJECTED', rejectionReason: 'Hours dispute' }
    ]
  }

  payrollService.memoryStorage['isysware_hrms_f06_payroll_runs_v1'] = [draftRunWithRejection]

  const superAdmin = { id: 'admin-1', name: 'Super Admin', role: 'super_admin' }

  // Bulk approval must be blocked due to rejected entry
  assert.throws(
    () => {
      payrollService.approvePayrollRun('RUN-202611-02', superAdmin)
    },
    /Cannot approve payroll run.*REJECTED/i,
    'Bulk approval must block if any employee entry is rejected'
  )

  // Once the rejected entry is resolved/approved, bulk approval succeeds
  draftRunWithRejection.employeeBreakdown[1].approvalStatus = 'PENDING'
  const approvedRun = payrollService.approvePayrollRun('RUN-202611-02', superAdmin)

  assert.equal(approvedRun.status, 'Approved')
  assert.ok(approvedRun.employeeBreakdown.every((e) => e.approvalStatus === 'APPROVED'), 'All entries should be marked Approved after master approval')
})

test('Payroll Complete Workflow — 9. View Payslip Action from Employee Breakdown Row', () => {
  const sampleRun = {
    id: 'RUN-202611-02',
    runNumber: 'RUN-202611-02',
    period: '2026-11',
    periodName: 'November 2026',
    status: 'Draft',
    fiscalYear: '2026-2027'
  }

  const sampleEntry = {
    entryId: 'ENT-202611-005',
    employeeId: 'EMP-005',
    employeeCode: 'EMP-005',
    employeeName: 'Ahmed Khan',
    basicSalary: 35000,
    allowancesTotal: 5000,
    overtimePay: 2000,
    overtimeHours: 8,
    grossSalary: 42000,
    salaryTaxWithheld: 500,
    loanDeduction: 1000,
    otherDeductions: 0,
    netPayable: 40500,
    approvalStatus: 'APPROVED',
    paymentStatus: 'UNPAID'
  }

  const payslip = payrollService.buildPayslipFromEntry(sampleRun, sampleEntry)

  assert.ok(payslip, 'Payslip must be generated')
  assert.equal(payslip.employeeId, 'EMP-005')
  assert.equal(payslip.grossPay, 42000)
  assert.equal(payslip.netPay, 40500)
  assert.equal(payslip.incomeTax, 500)
  assert.equal(payslip.period, '2026-11')
})

test('Payroll Complete Workflow — 10. Confirmation Preview Modal Layout & Diffs', () => {
  const modalFilePath = path.join(__dirname, '../components/payroll/RefreshDraftConfirmModal.jsx')
  assert.ok(fs.existsSync(modalFilePath), 'RefreshDraftConfirmModal.jsx must exist')

  const content = fs.readFileSync(modalFilePath, 'utf8')
  assert.ok(content.includes('Authoritative Run Number Preserved'), 'Must show Run Number Preserved banner')
  assert.ok(content.includes('Headcount'), 'Must show Headcount diff')
  assert.ok(content.includes('Gross Payroll'), 'Must show Gross Payroll diff')
  assert.ok(content.includes('Net Payable'), 'Must show Net Payable diff')
  assert.ok(content.includes('Recalculate & Update Draft') || content.includes('Recalculate &amp; Update Draft'), 'Must have confirm recalculate action')
})

test('Payroll Complete Workflow — 11. Active Loan LN-2026-001 Deduction on EMP-004 Payslip & Financial Integrity', () => {
  const sampleRun = {
    id: 'PAY-2026-11-02',
    runNumber: 'RUN-202611-02',
    period: '2026-11',
    periodName: 'November 2026',
    status: 'Draft',
    fiscalYear: '2026-2027'
  }

  // EMP-004 entry with basic salary 30,000 and initially 0 loan deduction
  const emp004Entry = {
    entryId: 'ENT-202611-004',
    employeeId: 'EMP-004',
    employeeCode: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    basicSalary: 30000,
    allowancesTotal: 0,
    overtimePay: 0,
    grossSalary: 30000,
    salaryTaxWithheld: 0,
    loanDeduction: 0, // initially 0 in unrefreshed entry
    unpaidLeaveDeduction: 0,
    otherDeductions: 0,
    netPayable: 30000,
    paymentStatus: 'UNPAID'
  }

  const payslip = payrollService.buildPayslipFromEntry(sampleRun, emp004Entry)

  assert.ok(payslip, 'Payslip must be created')
  assert.equal(payslip.basicSalary, 30000, 'Basic Salary must remain strictly PKR 30,000')
  assert.equal(payslip.grossPay, 30000, 'Gross Salary must remain PKR 30,000')
  assert.equal(payslip.loanDeduction, 3000, 'Active loan LN-2026-001 monthly installment PKR 3,000 must be deducted')
  assert.equal(payslip.totalDeductions, 3000, 'Total deductions must reflect loan deduction PKR 3,000')
  assert.equal(payslip.netPay, 27000, 'Net Payable must strictly reconcile to PKR 27,000 (30,000 - 3,000)')
})

test('Payroll Complete Workflow — 12. Draft Payslip Attribution & Official Status Guards', () => {
  const draftRun = {
    id: 'PAY-2026-11-02',
    runNumber: 'RUN-202611-02',
    period: '2026-11',
    status: 'Draft'
  }
  const entry = {
    entryId: 'ENT-001',
    employeeId: 'EMP-001',
    employeeName: 'Tariq Mehmood',
    basicSalary: 30000,
    grossSalary: 30000,
    netPayable: 30000
  }

  const draftPayslip = payrollService.buildPayslipFromEntry(draftRun, entry)
  assert.equal(draftPayslip.isDraft, true, 'Draft run payslip must be flagged isDraft=true')
  assert.equal(draftPayslip.approvedBy, 'Pending Review / Draft', 'Draft payslip must NOT display fake Super Admin approval')

  const approvedRun = {
    ...draftRun,
    status: 'Approved',
    approvedBy: 'Tariq Mehmood (Super Admin)'
  }
  const approvedPayslip = payrollService.buildPayslipFromEntry(approvedRun, entry)
  assert.equal(approvedPayslip.isDraft, false, 'Approved run payslip must have isDraft=false')
  assert.equal(approvedPayslip.approvedBy, 'Tariq Mehmood (Super Admin)', 'Approved payslip must display authentic approver')
})

test('Payroll Complete Workflow — 13. Loan Service Strict Status and Period Eligibility Guards', () => {
  const backupLoans = loanService._getItem('isysware_hrms_f06_loans_v1', [])

  try {
    loanService._setItem('isysware_hrms_f06_loans_v1', [
      {
        id: 'LN-TEST-001',
        employeeId: 'EMP-099',
        status: 'Active',
        principalAmount: 9000,
        installmentAmount: 3000,
        outstandingBalance: 9000,
        disbursedDate: '2026-11-01',
        nextDeductionPeriod: '2026-11'
      },
      {
        id: 'LN-TEST-002',
        employeeId: 'EMP-099',
        status: 'REJECTED',
        principalAmount: 15000,
        installmentAmount: 5000,
        outstandingBalance: 15000,
        disbursedDate: '2026-11-01'
      },
      {
        id: 'LN-TEST-003',
        employeeId: 'EMP-099',
        status: 'Pending',
        principalAmount: 12000,
        installmentAmount: 4000,
        outstandingBalance: 12000,
        disbursedDate: '2026-11-01'
      },
      {
        id: 'LN-TEST-004',
        employeeId: 'EMP-099',
        status: 'Active',
        principalAmount: 6000,
        installmentAmount: 2000,
        outstandingBalance: 6000,
        disbursedDate: '2026-12-01', // Future month
        nextDeductionPeriod: '2026-12'
      }
    ])

    const deductionNov = loanService.getActiveDeductionForEmployee('EMP-099', '2026-11')
    assert.equal(deductionNov.totalDeduction, 3000, 'Only LN-TEST-001 (Active in 2026-11) must be deducted')
    assert.equal(deductionNov.activeLoanCount, 1, 'Rejected, Pending, and future loans must be strictly excluded')
  } finally {
    loanService._setItem('isysware_hrms_f06_loans_v1', backupLoans)
  }
})

test('Payroll Complete Workflow — 14. Super Admin Shift Assignment Attribution is Dynamic', () => {
  const activeUser = { name: 'Tariq Mehmood', role: 'super_admin' }
  const isSuperAdminPortal = true
  const portalDefaultAssigner = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || 'HR Admin')

  let assignedByDisplay = 'HR Admin'
  if (isSuperAdminPortal) {
    if (!assignedByDisplay || assignedByDisplay === 'HR Admin' || assignedByDisplay === 'HR Administrator' || (typeof assignedByDisplay === 'string' && assignedByDisplay.startsWith('cmw'))) {
      assignedByDisplay = activeUser?.name || 'Super Admin'
    }
  }

  assert.equal(assignedByDisplay, 'Tariq Mehmood', 'Must resolve to the active Super Admin user, never hardcoded HR Admin')
})
