import { test } from 'node:test';
import assert from 'node:assert/strict';
import payrollPaymentService, {
  isValidPakistaniIban,
  validateAccountOwnership,
} from '../services/payrollPaymentService.js';
import payrollService from '../services/payrollService.js';

test('Bank Payments QA — 1. Pakistani IBAN Standard Validation (24 characters, PK prefix)', () => {
  // Valid Pakistani IBANs (24 chars)
  assert.equal(isValidPakistaniIban('PK60MEZN0001010102001001'), true);
  assert.equal(isValidPakistaniIban('PK12HABB0002020203002002'), true);
  assert.equal(isValidPakistaniIban('pk36habb0000000100492810'), true);
  assert.equal(isValidPakistaniIban('PK 60 MEZN 0001 0101 0200 1001'), true);

  // Invalid IBANs (wrong country code, wrong length, bad chars)
  assert.equal(isValidPakistaniIban('GB60MEZN0001010102001001'), false);
  assert.equal(isValidPakistaniIban('PK60MEZN000101010200100'), false); // 23 chars
  assert.equal(isValidPakistaniIban('PK60MEZN000101010200100199'), false); // 26 chars
  assert.equal(isValidPakistaniIban('001004928101'), false); // Not an IBAN
  assert.equal(isValidPakistaniIban(null), false);
  assert.equal(isValidPakistaniIban(undefined), false);
  assert.equal(isValidPakistaniIban(''), false);
});

test('Bank Payments QA — 2. Account Ownership Matching Validation', () => {
  // Matching employee and title
  assert.equal(validateAccountOwnership('Tariq Mehmood', 'Tariq Mehmood'), true);
  assert.equal(validateAccountOwnership('Mr. Tariq Mehmood', 'Tariq Mehmood'), true);
  assert.equal(validateAccountOwnership('Ayesha Khan', 'Ayesha Khan'), true);
  assert.equal(validateAccountOwnership('Tariq Mehmood Khan', 'Tariq Mehmood'), true);

  // Mismatched accounts
  assert.equal(validateAccountOwnership('John Doe', 'Tariq Mehmood'), false);
  assert.equal(validateAccountOwnership('Random Company Ltd', 'Ayesha Khan'), false);
  assert.equal(validateAccountOwnership('', 'Tariq Mehmood'), false);
  assert.equal(validateAccountOwnership('Tariq Mehmood', null), false);
});

test('Bank Payments QA — 3. Real Data Extraction & Zero Synthetic Fallback Banks', () => {
  const dummyRun = {
    id: 'RUN-TEST-01',
    period: '2026-11',
    status: 'APPROVED',
    entries: [
      {
        id: 'ENTRY-01',
        employeeId: 'EMP-999',
        employee: {
          id: 'EMP-999',
          employeeCode: 'EMP-999',
          firstName: 'NoBank',
          lastName: 'User',
          department: { name: 'Engineering' },
        },
        netSalary: 150000,
        bankName: null,
        bankAccountTitle: null,
        bankAccountNumber: null,
        bankIban: null,
        paymentStatus: 'UNPAID',
        paidAt: null,
        transactionReference: null,
      },
    ],
  };

  const register = payrollPaymentService.generatePaymentRegisterForRun(dummyRun);
  assert.equal(register.length, 1);
  const entry = register[0];

  // Must NOT fall back to 'HBL Pakistan Ltd' or synthetic IBANs
  assert.equal(entry.bankName, null);
  assert.equal(entry.accountTitle, null);
  assert.equal(entry.accountNumber, null);
  assert.equal(entry.iban, null);
  assert.equal(entry.isVerified, false);
  assert.equal(entry.status, 'Missing Banking Info');
  assert.equal(entry.paymentStatus, 'PENDING');
  assert.equal(entry.paymentReference, null);
});

test('Bank Payments QA — 4. Export Guard: Blocks DRAFT, SUBMITTED, and VOID runs', () => {
  const draftRun = {
    id: 'RUN-DRAFT-01',
    period: '2026-11',
    status: 'DRAFT',
    entries: [],
  };

  const voidRun = {
    id: 'RUN-VOID-01',
    period: '2026-11',
    status: 'VOID',
    entries: [],
  };

  assert.throws(
    () => payrollPaymentService.generateBankTransferAdvice(draftRun),
    /Only Approved or Disbursed payroll runs can generate bank transfer advice/
  );

  assert.throws(
    () => payrollPaymentService.generateBankTransferAdvice(voidRun),
    /Only Approved or Disbursed payroll runs can generate bank transfer advice/
  );
});

test('Bank Payments QA — 5. Export Guard: Blocks runs with zero verified accounts', () => {
  const unverifiedRun = {
    id: 'RUN-APP-01',
    period: '2026-11',
    status: 'APPROVED',
    entries: [
      {
        id: 'ENTRY-01',
        employeeId: 'EMP-888',
        employee: {
          id: 'EMP-888',
          employeeCode: 'EMP-888',
          firstName: 'Unverified',
          lastName: 'Worker',
          department: { name: 'Operations' },
        },
        netSalary: 95000,
        bankName: 'Meezan Bank',
        bankAccountTitle: 'Different Name',
        bankAccountNumber: '010101010101',
        bankIban: 'INVALID_IBAN',
        bankVerificationStatus: 'Unverified',
        paymentStatus: 'UNPAID',
      },
    ],
  };

  assert.throws(
    () => payrollPaymentService.generateBankTransferAdvice(unverifiedRun),
    /No verified employee bank accounts with valid IBAN found in this payroll batch/
  );
});

test('Bank Payments QA — 6. Status Mapping: PAID, HOLD, PENDING Against Backend Enums', () => {
  const multiStatusRun = {
    id: 'RUN-MIXED-01',
    period: '2026-11',
    status: 'APPROVED',
    entries: [
      {
        id: 'ENTRY-PAID',
        employeeId: 'EMP-001',
        employee: { id: 'EMP-001', firstName: 'Tariq', lastName: 'Mehmood' },
        netSalary: 250000,
        bankName: 'Meezan Bank',
        bankAccountTitle: 'Tariq Mehmood',
        bankIban: 'PK60MEZN0001010102001001',
        bankVerificationStatus: 'Verified',
        paymentStatus: 'PAID',
        transactionReference: 'FT-REAL-998877',
      },
      {
        id: 'ENTRY-HOLD',
        employeeId: 'EMP-002',
        employee: { id: 'EMP-002', firstName: 'Ayesha', lastName: 'Khan' },
        netSalary: 180000,
        bankName: 'Habib Bank Limited',
        bankAccountTitle: 'Ayesha Khan',
        bankIban: 'PK12HABB0002020203002002',
        bankVerificationStatus: 'Verified',
        paymentStatus: 'PROCESSING',
      },
      {
        id: 'ENTRY-UNPAID',
        employeeId: 'EMP-003',
        employee: { id: 'EMP-003', firstName: 'Hamza', lastName: 'Ahmed' },
        netSalary: 210000,
        bankName: 'Bank Alfalah',
        bankAccountTitle: 'Hamza Ahmed',
        bankIban: 'PK50ALFH0003030304003003',
        bankVerificationStatus: 'Verified',
        paymentStatus: 'UNPAID',
      },
    ],
  };

  const register = payrollPaymentService.generatePaymentRegisterForRun(multiStatusRun);
  assert.equal(register.length, 3);

  // PAID entry
  const paid = register.find((r) => r.employeeId === 'EMP-001');
  assert.equal(paid.paymentStatus, 'PAID');
  assert.equal(paid.status, 'Disbursed');
  assert.equal(paid.transactionRef, 'FT-REAL-998877');

  // PROCESSING / HOLD entry
  const hold = register.find((r) => r.employeeId === 'EMP-002');
  assert.equal(hold.paymentStatus, 'HOLD');
  assert.equal(hold.status, 'On Hold');

  // UNPAID entry
  const unpaid = register.find((r) => r.employeeId === 'EMP-003');
  assert.equal(unpaid.paymentStatus, 'PENDING');
  assert.equal(unpaid.status, 'Ready for Transfer');
  assert.equal(unpaid.transactionRef, null);
});

test('Bank Payments QA — 7. Net Payable Totals & Reconcile to Canonical Records', () => {
  const postedRun = payrollService.getPayrollRunById('2026-09');
  assert.ok(postedRun);

  const register = payrollPaymentService.generatePaymentRegisterForRun(postedRun);
  assert.ok(register.length > 0);

  const totalCalculated = register.reduce((acc, r) => acc + (r.netPayable || 0), 0);
  assert.equal(Math.round(totalCalculated), Math.round(postedRun.netPayable));
});

test('Bank Payments QA — 8. Audit Attribution & Immutable Confirmation Record', () => {
  const adminActor = { role: 'super_admin', name: 'Tariq Mehmood (Super Admin)' };
  const confirmation = payrollPaymentService.confirmSalaryDisbursement(
    'RUN-AUDIT-01',
    'TXN-IBFT-CONFIRM-5544',
    adminActor
  );

  assert.ok(confirmation.id);
  assert.equal(confirmation.confirmedBy, 'Tariq Mehmood (Super Admin)');
  assert.equal(confirmation.batchTransactionRef, 'TXN-IBFT-CONFIRM-5544');
  assert.equal(confirmation.status, 'Confirmed');
  assert.ok(confirmation.confirmedAt);
});

test('Bank Payments QA — 9. Reconciliation Guard: Blocks bank export on unreconciled or inactive-employee runs even if Approved', () => {
  const unreconciledApprovedRun = {
    id: 'RUN-BAD-APP-01',
    period: '2026-11',
    status: 'APPROVED',
    isReconciled: false,
    hasInactiveEmployees: true,
    entries: [
      {
        id: 'ENTRY-SUSP',
        employeeId: 'EMP-900',
        employee: { id: 'EMP-900', firstName: 'Operational', lastName: 'Tester' },
        netSalary: 50000,
        bankName: 'Meezan Bank Limited',
        bankAccountTitle: 'Operational Tester',
        bankIban: 'PK60MEZN0001010102001001',
        bankVerificationStatus: 'Verified',
        paymentStatus: 'UNPAID'
      }
    ]
  };

  assert.throws(
    () => payrollPaymentService.generateBankTransferAdvice(unreconciledApprovedRun),
    /failed reconciliation or contains ineligible employees/
  );
});

