import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { expenseService } from '../services/expenseService.js'

beforeEach(() => {
  expenseService.resetAllData()
})

test('1. Expense Claim Creation: Validates required fields and creates claim', () => {
  const claim = expenseService.createExpenseClaim(
    {
      employeeId: 'EMP-004',
      expenseDate: '2026-10-27',
      category: 'Food / Meals',
      amount: 4500,
      description: 'Project deliverable working lunch with mobile dev team',
      receiptReference: 'REC-LUNCH-9901.pdf'
    },
    { id: 'EMP-004', name: 'Zeeshan Ali', role: 'employee' }
  )

  assert.ok(claim.claimId.startsWith('EXP-2026-'))
  assert.equal(claim.amount, 4500)
  assert.equal(claim.approvalStatus, 'Submitted')
  assert.equal(claim.paymentStatus, 'Unapproved')
  assert.equal(claim.paidAmount, 0)
  assert.equal(claim.remainingPayable, 4500)
})

test('2. Field Validation: Rejects invalid amount or missing description', () => {
  assert.throws(
    () => {
      expenseService.createExpenseClaim(
        {
          employeeId: 'EMP-004',
          expenseDate: '2026-10-27',
          category: 'Food / Meals',
          amount: 0,
          description: 'Lunch'
        },
        { id: 'EMP-004' }
      )
    },
    /greater than 0 PKR/
  )

  assert.throws(
    () => {
      expenseService.createExpenseClaim(
        {
          employeeId: 'EMP-004',
          expenseDate: '2026-10-27',
          category: 'Food / Meals',
          amount: 2500,
          description: 'bad'
        },
        { id: 'EMP-004' }
      )
    },
    /min 5 characters/
  )
})

test('3. Category Limits: Rejects amount exceeding per-claim limit', () => {
  // Food / Meals per claim limit is PKR 15,000
  assert.throws(
    () => {
      expenseService.createExpenseClaim(
        {
          employeeId: 'EMP-004',
          expenseDate: '2026-10-27',
          category: 'Food / Meals',
          amount: 22000,
          description: 'Massive dinner with external vendor',
          receiptReference: 'REC-MEAL-BIG.pdf'
        },
        { id: 'EMP-004' }
      )
    },
    /exceeds the per-claim limit of PKR 15,000/
  )
})

test('4. Receipt Threshold: Rejects claim without receipt when above threshold', () => {
  // Food / Meals threshold is PKR 500
  assert.throws(
    () => {
      expenseService.createExpenseClaim(
        {
          employeeId: 'EMP-004',
          expenseDate: '2026-10-27',
          category: 'Food / Meals',
          amount: 3500,
          description: 'Lunch without any receipt attached',
          receiptReference: ''
        },
        { id: 'EMP-004' }
      )
    },
    /Receipt \/ invoice reference is mandatory/
  )
})

test('5. Duplicate Receipt Check: Prevents reuse of same receipt reference', () => {
  expenseService.createExpenseClaim(
    {
      employeeId: 'EMP-004',
      expenseDate: '2026-10-27',
      category: 'Office Supplies',
      amount: 4000,
      description: 'HDMI cables and adapters',
      receiptReference: 'REC-INV-UNIQUE-889.pdf'
    },
    { id: 'EMP-004' }
  )

  assert.throws(
    () => {
      expenseService.createExpenseClaim(
        {
          employeeId: 'EMP-005',
          expenseDate: '2026-10-27',
          category: 'Office Supplies',
          amount: 3000,
          description: 'Duplicate receipt attempt',
          receiptReference: 'REC-INV-UNIQUE-889.pdf'
        },
        { id: 'EMP-005' }
      )
    },
    /Duplicate receipt reference/
  )
})

test('6. Cumulative Monthly Limit: Enforces monthly category cap', () => {
  // Communication per-claim limit 10,000; monthly limit 25,000
  expenseService.createExpenseClaim(
    {
      employeeId: 'EMP-004',
      expenseDate: '2026-10-10',
      category: 'Communication / Internet',
      amount: 10000,
      description: 'Fiber broadband project connection',
      receiptReference: 'REC-NET-01.pdf'
    },
    { id: 'EMP-004' }
  )

  expenseService.createExpenseClaim(
    {
      employeeId: 'EMP-004',
      expenseDate: '2026-10-15',
      category: 'Communication / Internet',
      amount: 10000,
      description: 'Field 4G wireless dongles',
      receiptReference: 'REC-NET-02.pdf'
    },
    { id: 'EMP-004' }
  )

  // Third claim of 8,000 pushes monthly total to 28,000 > 25,000 ceiling
  assert.throws(
    () => {
      expenseService.createExpenseClaim(
        {
          employeeId: 'EMP-004',
          expenseDate: '2026-10-20',
          category: 'Communication / Internet',
          amount: 8000,
          description: 'Emergency roaming package',
          receiptReference: 'REC-NET-03.pdf'
        },
        { id: 'EMP-004' }
      )
    },
    /Monthly limit exceeded/
  )
})

test('7. Anti-Self-Approval: Manager cannot approve their own claim', () => {
  // Bilal Siddiqui (Manager) submits personal claim EXP-2026-004
  assert.throws(
    () => {
      expenseService.reviewExpenseClaim(
        'EXP-2026-004',
        'Approved',
        'Approving my own supplies purchase',
        { id: 'EMP-003', name: 'Bilal Siddiqui', role: 'manager' }
      )
    },
    /Anti-Self-Approval Violation/
  )
})

test('8. Manager Approval Authority: Approves claim within PKR 25,000 limit', () => {
  // Fatima Noor submitted claim EXP-2026-003 for PKR 18,000
  const approved = expenseService.reviewExpenseClaim(
    'EXP-2026-003',
    'Approved',
    'Verified field duty UAT commute. Approved within manager authority.',
    { id: 'EMP-003', name: 'Bilal Siddiqui', role: 'manager' }
  )

  assert.equal(approved.approvalStatus, 'Approved')
  assert.equal(approved.paymentStatus, 'Payment Pending')
  assert.equal(approved.remainingPayable, 18000)
  assert.equal(approved.finalApproverId, 'EMP-003')
})

test('9. Manager Authority Exceeded: Rejects approval when claim > PKR 25,000', () => {
  const claim = expenseService.createExpenseClaim(
    {
      employeeId: 'EMP-004',
      expenseDate: '2026-10-26',
      category: 'Client Meetings',
      amount: 30000, // Manager limit is 25,000
      description: 'Full day corporate steering committee hosting',
      receiptReference: 'REC-STEER-30K.pdf'
    },
    { id: 'EMP-004' }
  )

  assert.throws(
    () => {
      expenseService.reviewExpenseClaim(
        claim.claimId,
        'Approved',
        'Manager attempting to approve 30k claim',
        { id: 'EMP-003', name: 'Bilal Siddiqui', role: 'manager' }
      )
    },
    /Manager Authority Exceeded/
  )
})

test('10. HR/Admin Financial Authority: Approves claim up to PKR 75,000', () => {
  const claim = expenseService.createExpenseClaim(
    {
      employeeId: 'EMP-004',
      expenseDate: '2026-10-26',
      category: 'Medical Reimbursement',
      amount: 48000,
      description: 'Emergency dental surgery and diagnostics',
      receiptReference: 'REC-MED-48K.pdf'
    },
    { id: 'EMP-004' }
  )

  const approved = expenseService.reviewExpenseClaim(
    claim.claimId,
    'Approved',
    'Verified medical receipts with company health policy. Approved.',
    { id: 'EMP-002', name: 'Ayesha Khan', role: 'hr_admin' }
  )

  assert.equal(approved.approvalStatus, 'Approved')
  assert.equal(approved.paymentStatus, 'Payment Pending')
  assert.equal(approved.remainingPayable, 48000)
})

test('11. Super Admin Authority: High-value claims (> 75k) require Super Admin', () => {
  // EXP-2026-005 is for PKR 88,000 (submitted by Ayesha Khan EMP-002)
  // An independent HR admin (EMP-014) tries to approve -> should exceed HR 75k limit
  assert.throws(
    () => {
      expenseService.reviewExpenseClaim(
        'EXP-2026-005',
        'Approved',
        'HR attempting to approve 88k claim',
        { id: 'EMP-014', name: 'Independent HR Admin', role: 'hr_admin' }
      )
    },
    /HR Admin Authority Exceeded/
  )

  // Super Admin can approve high-value claims
  const approved = expenseService.reviewExpenseClaim(
    'EXP-2026-005',
    'Approved',
    'Authorized executive forum expense.',
    { id: 'EMP-001', name: 'Tariq Mehmood', role: 'super_admin' }
  )

  assert.equal(approved.approvalStatus, 'Approved')
  assert.equal(approved.paymentStatus, 'Payment Pending')
  assert.equal(approved.remainingPayable, 88000)
})


test('12. Reimbursement Payment Gate: Cannot pay unapproved claim', () => {
  // EXP-2026-003 is in Submitted status
  assert.throws(
    () => {
      expenseService.recordReimbursementPayment(
        'EXP-2026-003',
        {
          amount: 18000,
          paymentMethod: 'Bank Transfer',
          transactionReference: 'FT-PREMATURE-01'
        },
        { name: 'Finance Lead' }
      )
    },
    /Cannot disburse reimbursement: Claim EXP-2026-003 is Submitted, not Approved/
  )
})

test('13. Reimbursement Partial & Full Payment: Tracks balance accurately', () => {
  // Approve EXP-2026-003 first
  expenseService.reviewExpenseClaim(
    'EXP-2026-003',
    'Approved',
    'Approved for reimbursement',
    { id: 'EMP-003', name: 'Bilal Siddiqui', role: 'manager' }
  )

  // 1. Partial payment of PKR 10,000 out of 18,000
  const partial = expenseService.recordReimbursementPayment(
    'EXP-2026-003',
    {
      amount: 10000,
      paymentMethod: 'Bank Transfer',
      transactionReference: 'FT-PARTIAL-001'
    },
    { name: 'Finance Lead' }
  )

  assert.equal(partial.paymentStatus, 'Partially Paid')
  assert.equal(partial.paidAmount, 10000)
  assert.equal(partial.remainingPayable, 8000)

  // 2. Final payment of remaining PKR 8,000
  const full = expenseService.recordReimbursementPayment(
    'EXP-2026-003',
    {
      amount: 8000,
      paymentMethod: 'Bank Transfer',
      transactionReference: 'FT-FINAL-002'
    },
    { name: 'Finance Lead' }
  )

  assert.equal(full.paymentStatus, 'Paid')
  assert.equal(full.paidAmount, 18000)
  assert.equal(full.remainingPayable, 0)
})

test('14. Overpayment Prevention: Rejects payment exceeding remaining balance', () => {
  expenseService.reviewExpenseClaim(
    'EXP-2026-003',
    'Approved',
    'Approved',
    { id: 'EMP-003', name: 'Bilal Siddiqui', role: 'manager' }
  )

  assert.throws(
    () => {
      expenseService.recordReimbursementPayment(
        'EXP-2026-003',
        {
          amount: 25000, // Total claim is 18,000
          paymentMethod: 'Bank Transfer',
          transactionReference: 'FT-OVERPAY-01'
        },
        { name: 'Finance Lead' }
      )
    },
    /Overpayment prevented/
  )
})

test('15. Payment Reversal: Preserves original transaction and restores balance', () => {
  // EXP-2026-001 has a reimbursement of PKR 14,500
  const claim = expenseService.getExpenseClaimById('EXP-2026-001')
  assert.equal(claim.paymentStatus, 'Paid')
  const reimbId = claim.reimbursements[0].reimbursementId

  const reversed = expenseService.reverseReimbursementPayment(
    'EXP-2026-001',
    reimbId,
    'Returned by bank due to beneficiary account dormancy',
    { name: 'Super Admin' }
  )

  assert.equal(reversed.paymentStatus, 'Payment Pending')
  assert.equal(reversed.paidAmount, 0)
  assert.equal(reversed.remainingPayable, 14500)
  assert.equal(reversed.reimbursements[0].isReversed, true)
  assert.equal(reversed.reimbursements[0].reversalReason, 'Returned by bank due to beneficiary account dormancy')
})

test('16. Travel Expense Reconciliation: Bridges F10 travel advances and claims', () => {
  const reconciliations = expenseService.getTravelExpenseReconciliations(
    {},
    { id: 'EMP-001', role: 'super_admin' }
  )

  assert.ok(Array.isArray(reconciliations))
  const trip1 = reconciliations.find((r) => r.tripId === 'TRV-2026-001')
  assert.ok(trip1)
  assert.equal(trip1.disbursedAdvance, 40000)
  assert.equal(trip1.totalApprovedClaims, 42500)
  assert.equal(trip1.netSettlementBalance, 2500) // Staff spent 2,500 extra
  assert.equal(trip1.reconciliationStatus, 'Reimbursement Payable to Staff')
})

test('17. Role-Based Scoping: Employee sees only own claims', () => {
  const empClaims = expenseService.getExpenseClaims(
    {},
    { id: 'EMP-005', role: 'employee' }
  )

  assert.ok(empClaims.every((c) => c.employeeId === 'EMP-005'))
  assert.ok(!empClaims.some((c) => c.employeeId === 'EMP-004'))
})

test('18. Role-Based Scoping: Manager sees team and own claims', () => {
  const managerClaims = expenseService.getExpenseClaims(
    {},
    { id: 'EMP-003', role: 'manager' } // Bilal Siddiqui manages Development team (EMP-004 Zeeshan Ali)
  )

  const employeeIds = new Set(managerClaims.map((c) => c.employeeId))
  assert.ok(employeeIds.has('EMP-003')) // own
  assert.ok(employeeIds.has('EMP-004')) // reportee
  assert.ok(!employeeIds.has('EMP-002')) // HR Lead
})

test('19. Summary Metrics: Accurately tallies pending, approved, and reimbursed', () => {
  const metrics = expenseService.getExpenseSummaryMetrics(
    {},
    { id: 'EMP-001', role: 'super_admin' }
  )

  assert.ok(metrics.totalClaimsCount >= 5)
  assert.ok(metrics.totalApprovedAmount > 0)
  assert.ok(typeof metrics.categoryTotals === 'object')
})

test('20. Audit Trail: Every submission, approval, and disbursement logs history', () => {
  const logs = expenseService.getAuditLogs({ role: 'super_admin' })
  assert.ok(Array.isArray(logs))
  // Claim submission logs audit
  expenseService.createExpenseClaim(
    {
      employeeId: 'EMP-004',
      expenseDate: '2026-10-27',
      category: 'Office Supplies',
      amount: 1500,
      description: 'Notebooks and whiteboard markers',
      receiptReference: 'REC-MARKERS-77.pdf'
    },
    { id: 'EMP-004', name: 'Zeeshan Ali' }
  )

  const updatedLogs = expenseService.getAuditLogs({ role: 'super_admin' })
  assert.ok(updatedLogs.some((l) => l.action === 'CLAIM_SUBMITTED'))
})

test('21. F10-F12 Reconciliation: Reads canonical F10 settled records & prevents double counting', () => {
  // Mirror PostgreSQL state where TRV-2026-001 was settled via F10 directly (no separate F12 EXP claim on TRV-2026-001)
  expenseService._setItem('isysware_hrms_f12_expense_claims_v1', [
    {
      claimId: 'EXP-2026-901',
      employeeId: 'EMP-001',
      employeeName: 'Khuzaima Senior Developer',
      amount: 15000,
      approvalStatus: 'Approved',
      paymentStatus: 'Payment Pending',
      paidAmount: 0,
      netPayableAmount: 3000,
      relatedTravelRequestId: 'TRV-2026-006',
      submissionDate: '2026-11-12'
    }
  ])
  expenseService._setItem('isysware_hrms_f12_travel_requests_v1', [
    {
      id: 'cuid-trv-001',
      requestCode: 'TRV-2026-001',
      employeeId: 'cuid-emp-001',
      employee: { employeeCode: 'EMP-001', firstName: 'Khuzaima', lastName: 'Senior Developer' },
      destination: 'Lahore, Pakistan',
      departureDate: '2026-11-20T00:00:00.000Z',
      returnDate: '2026-11-22T00:00:00.000Z',
      estimatedBudget: 45000,
      advanceAmount: 20000,
      disbursedAdvance: 20000,
      employeeSubmittedExp: 20000,
      approvedExpenses: 20000,
      settlementBalance: 0,
      settlementStatus: 'Settled',
      reconciledAt: '2026-11-13T02:03:38.262Z',
      status: 'APPROVED'
    },
    {
      id: 'cuid-trv-002',
      requestCode: 'TRV-2026-002',
      employeeId: 'cuid-emp-001',
      employee: { employeeCode: 'EMP-001', firstName: 'Khuzaima', lastName: 'Senior Developer' },
      destination: 'Islamabad, Pakistan',
      departureDate: '2026-11-25T00:00:00.000Z',
      returnDate: '2026-11-26T00:00:00.000Z',
      estimatedBudget: 15000,
      advanceAmount: 5000,
      disbursedAdvance: 0,
      employeeSubmittedExp: 0,
      approvedExpenses: 0,
      settlementBalance: 0,
      settlementStatus: 'Not Initialized',
      reconciledAt: null,
      status: 'REJECTED'
    },
    {
      id: 'cuid-trv-003',
      requestCode: 'TRV-2026-003',
      employeeId: 'cuid-emp-001',
      employee: { employeeCode: 'EMP-001', firstName: 'Khuzaima', lastName: 'Senior Developer' },
      destination: 'Karachi, Pakistan',
      departureDate: '2026-11-28T00:00:00.000Z',
      returnDate: '2026-11-29T00:00:00.000Z',
      estimatedBudget: 5000,
      advanceAmount: 0,
      disbursedAdvance: 0,
      settlementStatus: 'Not Initialized',
      status: 'DRAFT'
    },
    {
      id: 'cuid-trv-004',
      requestCode: 'TRV-2026-004',
      employeeId: 'cuid-emp-001',
      employee: { employeeCode: 'EMP-001', firstName: 'Khuzaima', lastName: 'Senior Developer' },
      destination: 'Karachi, Pakistan',
      departureDate: '2026-11-28T00:00:00.000Z',
      returnDate: '2026-11-29T00:00:00.000Z',
      estimatedBudget: 5000,
      advanceAmount: 0,
      disbursedAdvance: 0,
      settlementStatus: 'Not Initialized',
      status: 'PENDING'
    },
    {
      id: 'cuid-trv-005',
      requestCode: 'TRV-2026-005',
      employeeId: 'cuid-emp-001',
      employee: { employeeCode: 'EMP-001', firstName: 'Khuzaima', lastName: 'Senior Developer' },
      destination: 'Multan, Pakistan',
      departureDate: '2026-12-01T00:00:00.000Z',
      returnDate: '2026-12-02T00:00:00.000Z',
      estimatedBudget: 10000,
      advanceAmount: 0,
      disbursedAdvance: 0,
      employeeSubmittedExp: 0,
      approvedExpenses: 0,
      settlementBalance: 0,
      settlementStatus: 'Not Initialized',
      reconciledAt: null,
      status: 'APPROVED'
    },
    {
      id: 'cuid-trv-006',
      requestCode: 'TRV-2026-006',
      employeeId: 'cuid-emp-001',
      employee: { employeeCode: 'EMP-001', firstName: 'Khuzaima', lastName: 'Senior Developer' },
      destination: 'Faisalabad, Pakistan',
      departureDate: '2026-12-05T00:00:00.000Z',
      returnDate: '2026-12-06T00:00:00.000Z',
      estimatedBudget: 20000,
      advanceAmount: 12000,
      disbursedAdvance: 12000,
      employeeSubmittedExp: 0,
      approvedExpenses: 0,
      settlementBalance: -12000,
      settlementStatus: 'Advance Disbursed',
      reconciledAt: null,
      status: 'APPROVED'
    }
  ])

  const activeRows = expenseService.getTravelExpenseReconciliations({}, { id: 'EMP-001', role: 'super_admin' })
  assert.equal(activeRows.some((r) => r.tripId === 'TRV-2026-002'), false, 'Rejected trip excluded by default')
  assert.equal(activeRows.some((r) => r.tripId === 'TRV-2026-003'), false, 'Draft trip excluded by default')
  assert.equal(activeRows.some((r) => r.tripId === 'TRV-2026-004'), false, 'Pending approval trip excluded by default')

  const trv1 = activeRows.find((r) => r.tripId === 'TRV-2026-001')
  assert.ok(trv1)
  assert.equal(trv1.disbursedAdvance, 20000)
  assert.equal(trv1.totalSubmittedClaims, 20000)
  assert.equal(trv1.totalApprovedClaims, 20000)
  assert.equal(trv1.netSettlementBalance, 0)
  assert.equal(trv1.isSettled, true)
  assert.equal(trv1.reconciliationStatus, 'Settled')

  const trv6 = activeRows.find((r) => r.tripId === 'TRV-2026-006')
  assert.ok(trv6)
  assert.equal(trv6.disbursedAdvance, 12000)
  assert.equal(trv6.totalApprovedClaims, 15000)
  assert.equal(trv6.netSettlementBalance, 3000)
  assert.equal(trv6.reconciliationStatus, 'Reimbursement Payable to Staff')

  const trv5 = activeRows.find((r) => r.tripId === 'TRV-2026-005')
  assert.ok(trv5)
  assert.equal(trv5.netSettlementBalance, 0)
  assert.equal(trv5.isSettled, false, 'Zero balance without actual reconciliation must NOT appear Settled')
  assert.equal(trv5.isReconciled, false)
  assert.equal(trv5.reconciliationStatus, 'Not Initialized')

  const auditRows = expenseService.getTravelExpenseReconciliations(
    { includeIneligible: true },
    { id: 'EMP-001', role: 'super_admin' }
  )
  const trv2 = auditRows.find((r) => r.tripId === 'TRV-2026-002')
  const trv3 = auditRows.find((r) => r.tripId === 'TRV-2026-003')
  const trv4 = auditRows.find((r) => r.tripId === 'TRV-2026-004')
  assert.equal(trv2.disbursedAdvance, 0, 'Rejected trip must never show requestedAdvance 5000 as disbursed')
  assert.equal(trv2.isSettled, false)
  assert.equal(trv2.reconciliationStatus, 'Rejected (Excluded)')
  assert.equal(trv3.isSettled, false)
  assert.equal(trv3.reconciliationStatus, 'Draft (Not Eligible)')
  assert.equal(trv4.isSettled, false)
  assert.equal(trv4.reconciliationStatus, 'Awaiting Trip Approval')

  // Available travel requests must exclude already-settled TRV-2026-001 to block duplicate claim submission
  const available = expenseService.getAvailableTravelRequests({ id: 'EMP-001', role: 'super_admin' })
  assert.equal(available.some((t) => t.requestId === 'TRV-2026-001'), false)
  assert.equal(available.some((t) => t.requestId === 'TRV-2026-005'), true)
})

test('22. TravelExpenseReconciliationTab UI guards against false Settled zero-balance label', () => {
  const jsx = fs.readFileSync(
    new URL('../components/expenses/TravelExpenseReconciliationTab.jsx', import.meta.url),
    'utf8'
  )
  assert.match(jsx, /item\.isSettled \?/)
  assert.match(jsx, /Not Reconciled/)
  assert.match(jsx, /Not Eligible/)
  assert.match(jsx, /includeIneligible:\s*showIneligible/)
})
