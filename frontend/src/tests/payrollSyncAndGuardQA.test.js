import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import payrollService from '../services/payrollService.js'

const SRC_ROOT = path.resolve(import.meta.dirname, '..')

test('Payroll Sync & Guard QA — 1. buildPayslipFromEntry maps itemized allowances and canonical Prisma entry totals', () => {
  const sampleRun = {
    id: 'run_123',
    runNumber: 'RUN-202611-01',
    period: '2026-11',
    periodName: 'November 2026',
    status: 'DRAFT',
    fiscalYear: '2026-2027'
  }
  const sampleEntry = {
    entryId: 'ent_emp001',
    employeeCuid: 'cmw6xxjfu0001u804pra5o2tv',
    employeeId: 'EMP-001',
    employeeName: 'Khuzaima Senior Developer',
    department: 'Software Development',
    designation: 'Senior Developer',
    basicSalary: 50000,
    houseRentAllowance: 10000,
    medicalAllowance: 5000,
    conveyanceAllowance: 3000,
    specialAllowance: 2000,
    allowancesTotal: 20000,
    allowancesList: [
      { name: 'House Rent Allowance', type: 'HRA', amount: 10000 },
      { name: 'Medical Allowance', type: 'MEDICAL', amount: 5000 },
      { name: 'Conveyance Allowance', type: 'CONVEYANCE', amount: 3000 },
      { name: 'Special Allowance', type: 'SPECIAL', amount: 2000 }
    ],
    commission: 0,
    bonusAmount: 0,
    overtimePay: 0,
    grossSalary: 70000,
    salaryTaxWithheld: 0,
    unpaidAbsenceDeduction: 0,
    otherDeductions: 0,
    loanDeduction: 0,
    totalDeductions: 0,
    netPayable: 70000,
    paymentStatus: 'UNPAID'
  }

  const slip = payrollService.buildPayslipFromEntry(sampleRun, sampleEntry)
  assert.equal(slip.employeeId, 'EMP-001')
  assert.equal(slip.basicSalary, 50000)
  assert.equal(slip.allowances, 20000)
  assert.equal(slip.allowancesBreakdown.length, 4)
  assert.equal(slip.grossSalary, 70000)
  assert.equal(slip.netPay, 70000)
  assert.equal(slip.paymentStatus, 'UNPAID')
})

test('Payroll Sync & Guard QA — 2. SuperAdminPayrollPage and HrAdminPayrollPage remove unsafe local generate/loan fallbacks', () => {
  const superAdminSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/payroll/SuperAdminPayrollPage.jsx'), 'utf8')
  const hrAdminSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/payroll/HrAdminPayrollPage.jsx'), 'utf8')

  assert.ok(!superAdminSource.includes('payrollService.generateDraftPayrollRun'), 'SuperAdminPayrollPage must not fall back to local mock generateDraftPayrollRun')
  assert.ok(!hrAdminSource.includes('payrollService.generateDraftPayrollRun'), 'HrAdminPayrollPage must not call local mock generateDraftPayrollRun')
  assert.ok(!superAdminSource.includes('loanService.approveAndDisburseLoan'), 'SuperAdminPayrollPage must not swallow loan errors with local fallback')
  assert.ok(!superAdminSource.includes('Approval temporarily disabled'), 'Valid approval handler should be active')
  assert.ok(superAdminSource.includes('buildPayslipFromEntry'), 'SuperAdminPayrollPage should pass proper payslip object to PayslipModal')
  assert.ok(hrAdminSource.includes('buildPayslipFromEntry'), 'HrAdminPayrollPage should pass proper payslip object to PayslipModal')
})

test('Payroll Sync & Guard QA — 3. backendSync syncPayroll maps itemized PostgreSQL PayrollEntry fields and headcount checks', () => {
  const syncSource = fs.readFileSync(path.join(SRC_ROOT, 'services/backendSync.js'), 'utf8')

  assert.ok(syncSource.includes('entry.houseRentAllowance'), 'Must map Prisma houseRentAllowance')
  assert.ok(syncSource.includes('entry.medicalAllowance'), 'Must map Prisma medicalAllowance')
  assert.ok(syncSource.includes('entry.conveyanceAllowance'), 'Must map Prisma conveyanceAllowance')
  assert.ok(syncSource.includes('entry.specialAllowance'), 'Must map Prisma specialAllowance')
  assert.ok(syncSource.includes('entry.overtimeAmount'), 'Must map Prisma overtimeAmount')
  assert.ok(syncSource.includes('entry.commissionAmount'), 'Must map Prisma commissionAmount')
  assert.ok(syncSource.includes('entry.unpaidAbsenceDeduction'), 'Must map Prisma unpaidAbsenceDeduction')
  assert.ok(syncSource.includes('hasInactiveEmployees'), 'Must detect inactive/suspended employees in draft runs')
  assert.ok(syncSource.includes("apiClient.get('/payroll/payslips')"), 'Must sync self-service payslips for employee/manager portals')
})

test('Payroll Sync & Guard QA — 4. PayrollRunDetailModal supports both backend enum statuses and legacy labels without crash', () => {
  const modalSource = fs.readFileSync(path.join(SRC_ROOT, 'components/payroll/PayrollRunDetailModal.jsx'), 'utf8')
  const badgeSource = fs.readFileSync(path.join(SRC_ROOT, 'components/common/StatusBadge.jsx'), 'utf8')

  assert.ok(modalSource.includes('PENDING_APPROVAL'), 'Modal must support backend PENDING_APPROVAL enum')
  assert.ok(modalSource.includes('DISBURSED'), 'Modal must support backend DISBURSED enum')
  assert.ok(modalSource.includes('onVoidRun'), 'Modal must support VOID action')
  assert.ok(modalSource.includes('onReconcileRun'), 'Modal must support draft reconciliation action')
  assert.ok(modalSource.includes('max-w-xl sm:max-w-2xl'), 'Modal must use centered portrait layout')
  assert.ok(badgeSource.includes('pending_approval'), 'StatusBadge must format backend enum PENDING_APPROVAL')
  assert.ok(badgeSource.includes('disbursed'), 'StatusBadge must format backend enum DISBURSED')
})

test('Payroll Sync & Guard QA — 5. backendSync does not fabricate synthetic Meezan bank details when PostgreSQL bank fields are null', () => {
  const syncSource = fs.readFileSync(path.join(SRC_ROOT, 'services/backendSync.js'), 'utf8')
  const syncOrgBlock = syncSource.slice(
    syncSource.indexOf('export async function syncOrganization'),
    syncSource.indexOf('export async function syncAttendanceAndShifts')
  )
  assert.ok(!syncOrgBlock.includes("'Meezan Bank Limited'"), 'syncOrganization must not fabricate Meezan Bank Limited when DB bankName is null')
  assert.ok(syncSource.includes('hasMissingSalaryStructures'), 'syncPayroll must surface missing salary structure reconciliation flag')
})

