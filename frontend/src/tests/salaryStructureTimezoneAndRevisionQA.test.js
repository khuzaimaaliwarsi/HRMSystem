import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDate } from '../lib/dateUtils.js';
import salaryRevisionService from '../services/salaryRevisionService.js';
import compensationService from '../services/compensationService.js';

test('Salary Structure & Revision QA — 1. Effective Date Timezone Conversion: 01/11/2026 Never Rolls Back to 31/10/2026', () => {
  // Test case 1: ISO UTC midnight from PostgreSQL (2026-11-01T00:00:00.000Z)
  assert.equal(fmtDate('2026-11-01T00:00:00.000Z'), '01/11/2026');

  // Test case 2: Standard HTML5 input date format (YYYY-MM-DD)
  assert.equal(fmtDate('2026-11-01'), '01/11/2026');

  // Test case 3: Direct canonical DD/MM/YYYY string
  assert.equal(fmtDate('01/11/2026'), '01/11/2026');

  // Test case 4: Javascript Date object instantiated from UTC midnight
  const dateObj = new Date('2026-11-01T00:00:00.000Z');
  assert.equal(fmtDate(dateObj), '01/11/2026');

  // Test case 5: Date saved at Asia/Karachi midnight (2026-10-31 19:00:00 UTC)
  const pktMidnight = new Date('2026-10-31T19:00:00.000Z');
  assert.equal(fmtDate(pktMidnight), '01/11/2026');

  // Negative test: verify it NEVER equals 31/10/2026
  assert.notEqual(fmtDate('2026-11-01'), '31/10/2026');
  assert.notEqual(fmtDate('2026-11-01T00:00:00.000Z'), '31/10/2026');
  assert.notEqual(fmtDate(dateObj), '31/10/2026');
});

test('Salary Structure & Revision QA — 2. Salary Revision Accepts Valid PKR Amounts (e.g. 57,500)', () => {
  const employeeId = 'EMP-001';
  const baseline = 50000;
  const proposedAmount = 57500; // Not a multiple of 1,000 or 10,000

  const proposal = salaryRevisionService.createProposal({
    employeeId,
    currentSalary: baseline,
    proposedSalary: proposedAmount,
    effectiveDate: '2026-11-01',
    justification: 'Annual performance revision with approved increment',
    performanceRating: 4.8,
    proposedBy: 'HR Admin'
  });

  assert.ok(proposal.id);
  assert.equal(proposal.proposedSalary, 57500);
  assert.equal(proposal.deltaAmount, 7500);
  assert.equal(proposal.percentageChange, 15);
  assert.equal(proposal.status, 'Pending Super Admin Review');
});

test('Salary Structure & Revision QA — 3. Salary Revision Validates Numeric PKR Boundaries', () => {
  // Test arbitrary positive PKR amounts
  const validAmounts = [57500, 62250, 75100, 89999, 125000];
  for (const amt of validAmounts) {
    const p = salaryRevisionService.createProposal({
      employeeId: 'EMP-002',
      currentSalary: 50000,
      proposedSalary: amt,
      effectiveDate: '2026-11-01',
      justification: 'Valid PKR amount test for revision',
      performanceRating: 4.0,
      proposedBy: 'HR Admin'
    });
    assert.equal(p.proposedSalary, amt);
  }

  // Reject non-positive amounts
  assert.throws(() => {
    salaryRevisionService.createProposal({
      employeeId: 'EMP-002',
      currentSalary: 50000,
      proposedSalary: 0,
      effectiveDate: '2026-11-01',
      justification: 'Zero salary test justification',
      proposedBy: 'HR Admin'
    });
  });

  assert.throws(() => {
    salaryRevisionService.createProposal({
      employeeId: 'EMP-002',
      currentSalary: 50000,
      proposedSalary: -5000,
      effectiveDate: '2026-11-01',
      justification: 'Negative salary test justification',
      proposedBy: 'HR Admin'
    });
  });
});

test('Salary Structure & Revision QA — 4. Backend & Frontend Date Consistency Invariant', async () => {
  // Verify date parsing handles DD/MM/YYYY and YYYY-MM-DD identically
  const { parseCalendarDate } = await import('../../../backend/src/services/compensationService.js');
  
  const d1 = parseCalendarDate('01/11/2026');
  const d2 = parseCalendarDate('2026-11-01');
  const d3 = parseCalendarDate('2026-11-01T00:00:00.000Z');

  assert.ok(d1);
  assert.ok(d2);
  assert.ok(d3);

  assert.equal(d1.toISOString().slice(0, 10), '2026-11-01');
  assert.equal(d2.toISOString().slice(0, 10), '2026-11-01');
  assert.equal(d3.toISOString().slice(0, 10), '2026-11-01');

  // Both frontend and backend format to identical 01/11/2026
  assert.equal(fmtDate(d1), '01/11/2026');
  assert.equal(fmtDate(d2), '01/11/2026');
  assert.equal(fmtDate(d3), '01/11/2026');
});
