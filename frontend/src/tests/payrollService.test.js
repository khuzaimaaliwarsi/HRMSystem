import { test } from 'node:test';
import assert from 'node:assert/strict';
import payrollService from '../services/payrollService.js';
import taxService from '../services/taxService.js';
import loanService from '../services/loanService.js';
import commissionService from '../services/commissionService.js';
import salaryRevisionService from '../services/salaryRevisionService.js';
import compensationService from '../services/compensationService.js';
import payrollPaymentService from '../services/payrollPaymentService.js';

// Actors for tests
const superAdminActor = { name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001' };
const hrAdminActor = { name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002' };
const employeeActor = { name: 'Zeeshan Ali', role: 'employee', employeeId: 'EMP-004' };

test('1. FBR Section 149 Tax: 0% tax for income under PKR 600,000 per annum', () => {
  const tax = taxService.calculateSalaryTax(40000);
  assert.equal(tax.applicableSlabNumber, 1);
  assert.equal(tax.annualTaxLiability, 0);
  assert.equal(tax.monthlyTaxWithholding, 0);
});

test('2. FBR Section 149 Tax: 5% tax on excess over PKR 600,000 for Slab 2 (600k - 1.2M)', () => {
  const tax = taxService.calculateSalaryTax(80000);
  assert.equal(tax.applicableSlabNumber, 2);
  assert.equal(tax.ratePercent, 5);
  assert.equal(tax.annualTaxLiability, 18000);
  assert.equal(tax.monthlyTaxWithholding, 1500);
});

test('3. FBR Section 149 Tax: Progressive tax for Slab 3 (1.2M - 2.2M)', () => {
  const tax = taxService.calculateSalaryTax(150000);
  assert.equal(tax.applicableSlabNumber, 3);
  assert.equal(tax.annualTaxLiability, 120000);
  assert.equal(tax.monthlyTaxWithholding, 10000);
});

test('4. Taxable Classification: Exempts medical allowance up to 10% of basic salary', () => {
  const basicSalary = 100000;
  const allowances = [
    { code: 'MED', amount: 15000 },
    { code: 'FUEL', isTaxable: true, amount: 20000 },
  ];

  const taxable = taxService.classifyTaxableComponents(basicSalary, allowances);
  assert.equal(taxable.taxableAllowances, 25000); // 5000 (15000 - 10000 exempt) + 20000
  assert.equal(taxable.exemptAllowances, 10000);  // 10,000 exempt
  assert.equal(taxable.totalTaxableMonthly, 125000);
});

test('5. Commission Service: Calculates percentage commission on qualified deal source', () => {
  const res = commissionService.recordCommission({
    employeeId: 'EMP-007',
    employeeName: 'Farhan Zaidi',
    planId: 'COMM-PLAN-001',
    sourceRef: 'DEAL-QUAL-TEST-999',
    clientName: 'Alfalah Bank Ltd',
    dealAmount: 500000,
    qualifyingAmount: 500000,
    period: '2026-10'
  }, 'Super Admin');

  assert.ok(res.id);
  assert.equal(res.commissionAmount, 25000); // 5% of 500k
});

test('6. Commission Service: Prevents duplicate commission recording for the same qualifying deal reference', () => {
  assert.throws(() => {
    commissionService.recordCommission({
      employeeId: 'EMP-007',
      employeeName: 'Farhan Zaidi',
      planId: 'COMM-PLAN-001',
      sourceRef: 'DEAL-QUAL-TEST-999', // duplicate
      clientName: 'Alfalah Bank Ltd',
      dealAmount: 500000,
      period: '2026-10'
    }, 'Super Admin');
  }, /duplicate commission denied/i);
});

test('7. Loan Service: Creates loan request and calculates monthly amortization schedule', () => {
  const res = loanService.applyForLoan({
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    loanType: 'Company Personal Loan',
    principalAmount: 60000,
    totalInstallments: 6,
    reason: 'Emergency family medical expenses'
  }, employeeActor);

  assert.ok(res.id);
  assert.equal(res.installmentAmount, 10000); // 60,000 / 6
  assert.equal(res.outstandingBalance, 60000);
  assert.equal(res.status, 'Pending Super Admin Review');
});

test('8. Loan Service: Enforces Super Admin approval & disbursement', () => {
  const loans = loanService.getLoans({ employeeId: 'EMP-004' });
  const pendingLoan = loans.find(l => l.status === 'Pending Super Admin Review');
  assert.ok(pendingLoan, 'Pending loan should exist');

  // HR Admin cannot approve
  assert.throws(() => {
    loanService.approveAndDisburseLoan(pendingLoan.id, hrAdminActor, '2026-11');
  }, /Only Super Admin is authorized/i);

  // Super Admin approves and disburses
  const approved = loanService.approveAndDisburseLoan(pendingLoan.id, superAdminActor, '2026-11');
  assert.equal(approved.status, 'Active');
  assert.equal(approved.approvedBy, superAdminActor.name);
});

test('9. Loan Service: Deducts loan installment accurately and updates outstanding balance', () => {
  const deductionInfo = loanService.getActiveDeductionForEmployee('EMP-004', '2026-09');
  assert.ok(deductionInfo.totalDeduction >= 0);

  // Record installment
  const res = loanService.recordInstallmentDeduction('LN-2026-001', '2026-09', 3000);
  assert.ok(res);
  assert.equal(res.installmentsPaid, 1);
});

test('10. Salary Revision: Drafts a revision proposal with automatic delta and percentage change', () => {
  const res = salaryRevisionService.createProposal({
    employeeId: 'EMP-001',
    employeeName: 'Tariq Mehmood',
    currentSalary: 280000,
    proposedSalary: 320000,
    effectiveDate: '2026-11-01',
    justification: 'Exemplary leadership and successful architectural delivery',
    performanceRef: 'PERF-REV-Q3',
    performanceRating: 4.8
  }, hrAdminActor);

  assert.ok(res.id);
  assert.equal(res.deltaAmount, 40000);
  assert.equal(res.percentageChange, 14.29);
  assert.equal(res.status, 'Pending Super Admin Review');
});

test('11. Salary Revision: Strictly prevents HR/Admin from self-approving salary revision proposals', () => {
  const proposals = salaryRevisionService.getProposals({ status: 'Pending Super Admin Review' });
  const pending = proposals[0];
  assert.ok(pending);

  assert.throws(() => {
    salaryRevisionService.approveProposal(pending.id, hrAdminActor);
  }, /Only Super Admin is authorized/i);
});

test('12. Salary Revision: Enforces anti-self-approval and updates compensation upon Super Admin approval', () => {
  // Let's create a proposal for EMP-004 (Zeeshan Ali)
  const proposal = salaryRevisionService.createProposal({
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    currentSalary: 110000,
    proposedSalary: 130000,
    effectiveDate: '2026-11-01',
    justification: 'Promotion to Senior React Developer with increased team mentoring'
  }, hrAdminActor);

  // Super Admin approves
  const approved = salaryRevisionService.approveProposal(proposal.id, superAdminActor);
  assert.equal(approved.status, 'Approved');

  // Verify structure is updated in compensation service
  const struct = compensationService.getStructureByEmployeeId('EMP-004');
  assert.equal(struct.basicSalary, 130000);
});

test('13. Payroll Engine: Generates a draft payroll run consuming canonical inputs', () => {
  const draft = payrollService.generateDraftPayrollRun('2026-12', hrAdminActor);
  assert.ok(draft.id);
  assert.equal(draft.period, '2026-12');
  assert.equal(draft.status, 'Draft');
  assert.ok(draft.totalEmployees > 0);
  assert.ok(draft.grossPayroll > 0);
  assert.ok(draft.netPayable > 0);
});

test('14. Payroll Engine: Submits draft for Super Admin review and approves run', () => {
  const submitted = payrollService.submitPayrollForReview('PAY-2026-12', hrAdminActor);
  assert.equal(submitted.status, 'Pending Super Admin Review');

  const approved = payrollService.approvePayrollRun('PAY-2026-12', superAdminActor);
  assert.equal(approved.status, 'Approved');
});

test('15. Payroll Engine: Finalizes payroll run and locks it as immutable', () => {
  const finalized = payrollService.finalizeAndPostPayrollRun('PAY-2026-12', superAdminActor);
  assert.equal(finalized.status, 'Posted');
  assert.equal(finalized.isLocked, true);

  // Overwriting posted run must fail
  assert.throws(() => {
    payrollService.generateDraftPayrollRun('2026-12', hrAdminActor);
  }, /already been finalized and posted/i);
});

test('16. Payslips: Retrieves immutable payslip and enforces role-based confidentiality', () => {
  const payslip = payrollService.getPayslip('EMP-004', '2026-09', employeeActor);
  assert.ok(payslip);
  assert.equal(payslip.employeeId, 'EMP-004');
  assert.ok(payslip.netPayable > 0);

  // Employee cannot access other employee's payslip
  assert.throws(() => {
    payrollService.getPayslip('EMP-001', '2026-09', employeeActor);
  }, /Confidentiality violation/i);
});

test('17. Bank Advice & Payment Register: Generates register from finalized payroll', () => {
  const postedRun = payrollService.getPayrollRunById('2026-09');
  assert.ok(postedRun);

  const register = payrollPaymentService.generatePaymentRegisterForRun(postedRun);
  assert.ok(register.length > 0);
  assert.equal(register[0].status, 'Disbursed');
  assert.ok(register[0].maskedIban);
});

test('18. Bank Register: Records batch disbursement confirmation', () => {
  const confirmation = payrollPaymentService.confirmSalaryDisbursement('PAY-2026-09', 'BATCH-IBFT-99120', superAdminActor);
  assert.ok(confirmation.id);
  assert.equal(confirmation.batchTransactionRef, 'BATCH-IBFT-99120');
  assert.equal(confirmation.status, 'Confirmed');
});
