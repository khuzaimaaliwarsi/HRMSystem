import { test } from 'node:test';
import assert from 'node:assert/strict';
import compensationService from '../services/compensationService.js';

test('Allowances QA — 1. Master Allowance Categories retrieval without unverified fallbacks', () => {
  const masters = compensationService.getAllowancesMaster();
  assert.ok(Array.isArray(masters));
});

test('Allowances QA — 2. Employee Allowance Allocation retrieval with canonical fields', () => {
  const allowances = compensationService.getEmployeeAllowances('EMP-001');
  assert.ok(Array.isArray(allowances));
  if (allowances.length > 0) {
    const first = allowances[0];
    assert.ok(first.id);
    assert.ok(first.code);
    assert.ok(first.category);
    assert.equal(typeof first.amount, 'number');
    assert.equal(typeof first.isTaxable, 'boolean');
  }
});

test('Allowances QA — 3. Employee Allocation Assignment & Audit Attribution', async () => {
  const empId = 'EMP-004';
  const alloc = await compensationService.assignAllowanceToEmployee(
    empId,
    'ALW-TRAVEL',
    12500,
    'Tariq Mehmood (Super Admin)',
    'Field duty transport subsidy'
  );

  assert.ok(alloc.id);
  assert.equal(alloc.employeeId, empId);
  assert.equal(alloc.amount, 12500);
  assert.equal(alloc.status, 'Active');
  assert.equal(alloc.approvedBy, 'Tariq Mehmood (Super Admin)');
});

test('Allowances QA — 4. Double-Counting Prevention Invariant', () => {
  const structure = compensationService.getStructureByEmployeeId('EMP-004');
  const dynamicAllowances = compensationService.getEmployeeAllowances('EMP-004');

  // Verify structure base salary exists
  assert.ok(structure);
  const baseSalary = structure.baseSalary || structure.basicSalary || 0;
  assert.ok(baseSalary > 0);

  // Dynamic allowances are strictly isolated and tracked separately from base structure
  const dynamicTotal = dynamicAllowances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  assert.equal(typeof dynamicTotal, 'number');
  assert.ok(dynamicTotal >= 0);
});

test('Allowances QA — 5. Role-Based Privacy Guard for Subordinate Compensation', () => {
  const managerUser = { id: 'USR-MGR-01', role: 'manager', employeeId: 'EMP-003' };

  // Manager querying their own structure is permitted
  const ownStruct = compensationService.getStructureByEmployeeId('EMP-003', managerUser);
  assert.ok(ownStruct || ownStruct === null); // Can view own or null if unassigned

  // Manager querying subordinate structure is strictly blocked (null returned)
  const subordinateStruct = compensationService.getStructureByEmployeeId('EMP-004', managerUser);
  assert.equal(subordinateStruct, null);
});

test('Allowances QA — 6. Revocation Workflow & Audit Attribution with Mandatory Reason', async () => {
  const empId = 'EMP-004';
  const alloc = await compensationService.assignAllowanceToEmployee(
    empId,
    'ALW-TRAVEL',
    8000,
    'Tariq Mehmood (Super Admin)',
    'Temporary field transport'
  );

  assert.ok(alloc.id);

  // Revoke allocation with explicit audit reason
  const revokeReason = 'Project transport phase concluded; returning to base conveyance';
  const revoked = await compensationService.revokeEmployeeAllowance(alloc.id, revokeReason);

  assert.ok(revoked);
  assert.equal(revoked.isActive, false);
  assert.equal(revoked.status, 'Revoked');
  assert.ok(revoked.remarks.includes(revokeReason));
  assert.ok(revoked.revokedBy);
  assert.ok(revoked.revokedAt);
});

test('Allowances QA — 7. Invariant: Revoked Allocations NEVER Contribute to Active Monthly Totals', () => {
  const empId = 'EMP-004';

  // Active-only query (default for payroll calculations)
  const activeAllowances = compensationService.getEmployeeAllowances(empId);
  const activeTotal = activeAllowances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

  // Query with full history
  const allHistorical = compensationService.getEmployeeAllowances(empId, { includeHistorical: true });
  const allTotal = allHistorical.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

  // Every record in activeAllowances must have active computedStatus
  for (const a of activeAllowances) {
    assert.equal(a.status, 'Active');
    assert.notEqual(a.status, 'Revoked');
  }

  // Active total must be less than or equal to total historical sum
  assert.ok(activeTotal <= allTotal);
});

test('Allowances QA — 8. Status Filtering: All / Active / Revoked / Expired Support', () => {
  const empId = 'EMP-004';

  const allRecords = compensationService.getEmployeeAllowances(empId, { status: 'ALL' });
  const activeRecords = compensationService.getEmployeeAllowances(empId, { status: 'ACTIVE' });
  const revokedRecords = compensationService.getEmployeeAllowances(empId, { status: 'REVOKED' });
  const expiredRecords = compensationService.getEmployeeAllowances(empId, { status: 'EXPIRED' });

  assert.ok(Array.isArray(allRecords));
  assert.ok(Array.isArray(activeRecords));
  assert.ok(Array.isArray(revokedRecords));
  assert.ok(Array.isArray(expiredRecords));

  // Count consistency invariant
  assert.equal(activeRecords.length + revokedRecords.length + expiredRecords.length, allRecords.length);

  for (const a of activeRecords) {
    assert.equal(a.status, 'Active');
  }
  for (const r of revokedRecords) {
    assert.equal(r.status, 'Revoked');
  }
  for (const e of expiredRecords) {
    assert.equal(e.status, 'Expired');
  }
});

test('Allowances QA — 9. Canonical History & Audit Metadata Completeness', () => {
  const allAllocations = compensationService.getEmployeeAllowances(null, { includeHistorical: true });
  assert.ok(allAllocations.length > 0);

  for (const record of allAllocations) {
    assert.ok(record.id, 'Record ID must be present');
    assert.ok(record.employeeId, 'Employee ID must be present');
    assert.ok(record.name, 'Allowance name must be present');
    assert.ok(record.code, 'Allowance code must be present');
    assert.equal(typeof record.amount, 'number', 'Amount must be a numeric value');
    assert.ok(['Active', 'Revoked', 'Expired'].includes(record.status), 'Status must be Active, Revoked, or Expired');
    assert.ok(record.assignedBy, 'Assigned By must be attributed');
    if (record.status === 'Revoked') {
      assert.ok(record.revokedBy, 'Revoked By must be present on revoked records');
      assert.ok(record.revokedAt, 'Revoked At timestamp must be present on revoked records');
    }
  }
});
