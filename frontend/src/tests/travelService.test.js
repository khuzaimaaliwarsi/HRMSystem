import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import travelService from '../services/travelService.js';

// Actor profiles
const superAdminActor = { name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001', department: 'Executive' };
const hrAdminActor = { name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002', department: 'HR' };
const managerActor = { name: 'Bilal Ahmed', role: 'manager', employeeId: 'EMP-003', department: 'Engineering' };
const employeeActor = { name: 'Zeeshan Ali', role: 'employee', employeeId: 'EMP-004', department: 'Engineering' };
const newEmployeeActor = { name: 'Usman Ghani', role: 'employee', employeeId: 'EMP-006', department: 'Operations' };

beforeEach(() => {
  travelService.resetToDefaults();
});

test('1. Travel Request Submission & Required Fields Validation', () => {
  const req = travelService.createTravelRequest({
    destination: 'Islamabad, Pakistan',
    travelPurpose: 'Client Enterprise Deployment & Security Review',
    departureDate: '2026-11-15',
    departureTime: '08:00 AM',
    returnDate: '2026-11-18',
    returnTime: '08:00 PM',
    travelMode: 'Commercial Airline',
    accommodationRequired: true,
    estimatedBudget: 60000,
    requestedAdvance: 25000,
    status: 'Submitted'
  }, employeeActor);

  assert.ok(req.requestId.startsWith('TRV-'));
  assert.equal(req.status, 'Submitted');
  assert.equal(req.employeeId, employeeActor.employeeId);
  assert.equal(req.employeeName, employeeActor.name);
  assert.equal(req.estimatedBudget, 60000);
  assert.equal(req.requestedAdvance, 25000);

  // Missing destination throws
  assert.throws(() => {
    travelService.createTravelRequest({
      destination: '',
      travelPurpose: 'Valid Purpose',
      departureDate: '2026-11-15',
      returnDate: '2026-11-18',
      estimatedBudget: 50000
    }, employeeActor);
  }, /destination is required/i);

  // Missing purpose throws
  assert.throws(() => {
    travelService.createTravelRequest({
      destination: 'Lahore',
      travelPurpose: '',
      departureDate: '2026-11-15',
      returnDate: '2026-11-18',
      estimatedBudget: 50000
    }, employeeActor);
  }, /travel purpose is required/i);
});

test('2. Travel Date Validation: Start date must be before or equal to return date', () => {
  assert.throws(() => {
    travelService.createTravelRequest({
      destination: 'Lahore',
      travelPurpose: 'Architecture Summit',
      departureDate: '2026-11-20',
      returnDate: '2026-11-15', // Departure after return
      estimatedBudget: 40000
    }, employeeActor);
  }, /departure date cannot be after return date/i);
});

test('3. Travel Budget & Advance Limits: Advance cannot exceed estimated budget', () => {
  assert.throws(() => {
    travelService.createTravelRequest({
      destination: 'Faisalabad',
      travelPurpose: 'Vendor Audit',
      departureDate: '2026-11-10',
      returnDate: '2026-11-12',
      estimatedBudget: 20000,
      requestedAdvance: 35000 // Exceeds budget
    }, employeeActor);
  }, /cannot exceed total estimated budget/i);

  assert.throws(() => {
    travelService.createTravelRequest({
      destination: 'Faisalabad',
      travelPurpose: 'Vendor Audit',
      departureDate: '2026-11-10',
      returnDate: '2026-11-12',
      estimatedBudget: 0 // Non-positive budget
    }, employeeActor);
  }, /estimated travel budget must be greater than zero/i);
});

test('4. Anti-Self-Approval Rule: Requester cannot approve their own travel request', () => {
  // Manager submits travel
  const mgrReq = travelService.createTravelRequest({
    destination: 'Peshawar',
    travelPurpose: 'Tech Conference Representation',
    departureDate: '2026-11-22',
    returnDate: '2026-11-24',
    estimatedBudget: 45000,
    requestedAdvance: 20000,
    status: 'Submitted'
  }, managerActor);

  // Manager attempts to approve own request -> must throw
  assert.throws(() => {
    travelService.approveTravelRequest(mgrReq.requestId, managerActor, 'Self Approval Attempt');
  }, /anti-self-approval/i);

  // Super Admin can approve manager's request
  const approved = travelService.approveTravelRequest(mgrReq.requestId, superAdminActor, 'Authorized by Super Admin');
  assert.equal(approved.status, 'Approved');
});

test('5. Multi-tier Approval Routing: Manager recommends, HR/Super Admin authorizes', () => {
  const empReq = travelService.createTravelRequest({
    destination: 'Multan',
    travelPurpose: 'Field Infrastructure Commissioning',
    departureDate: '2026-11-01',
    returnDate: '2026-11-04',
    estimatedBudget: 50000,
    requestedAdvance: 20000,
    status: 'Submitted'
  }, employeeActor);

  // Manager in employee's department reviews -> advances to Under Review
  const reviewed = travelService.approveTravelRequest(empReq.requestId, managerActor, 'Department Recommendation');
  assert.equal(reviewed.status, 'Under Review');

  // HR Admin gives final authorization
  const finalApproved = travelService.approveTravelRequest(empReq.requestId, hrAdminActor, 'HR Director Signoff');
  assert.equal(finalApproved.status, 'Approved');
});

test('6. Overlapping Travel Request Prevention', () => {
  // Conflicting overlapping trip for employeeActor who already has a trip scheduled
  assert.throws(() => {
    travelService.createTravelRequest({
      destination: 'Lahore',
      travelPurpose: 'Branch Office Audit',
      departureDate: '2026-12-02', // Overlaps with initial trip TRV-2026-004 (2026-12-01 to 2026-12-03)
      returnDate: '2026-12-04',
      estimatedBudget: 30000,
      status: 'Submitted'
    }, employeeActor);
  }, /overlapping travel conflict/i);
});

test('7. F04 Attendance Bridge: Approved travel generates controlled field duty reference', () => {
  const req = travelService.createTravelRequest({
    destination: 'Islamabad',
    travelPurpose: 'Client Executive Workshop',
    departureDate: '2026-11-25',
    returnDate: '2026-11-27',
    estimatedBudget: 40000,
    status: 'Submitted'
  }, employeeActor);

  const approved = travelService.approveTravelRequest(req.requestId, superAdminActor, 'Super Admin Direct Approval');
  assert.ok(approved.attendanceF04Ref);
  assert.ok(approved.attendanceF04Ref.startsWith('DUTY-FLD-'));
});

test('8. Travel Plan & Booking Details: Requires valid booking PNR and Approved status', () => {
  const req = travelService.createTravelRequest({
    destination: 'Quetta',
    travelPurpose: 'Regional Operations Review',
    departureDate: '2026-12-20',
    returnDate: '2026-12-22',
    estimatedBudget: 35000,
    status: 'Submitted'
  }, employeeActor);

  // Attempt plan before approval -> must throw
  assert.throws(() => {
    travelService.createTravelPlan({
      requestId: req.requestId,
      bookingReference: 'PNR-QUE-1100',
      transportationType: 'Commercial Airline'
    }, hrAdminActor);
  }, /must be approved/i);

  // Approve request
  travelService.approveTravelRequest(req.requestId, hrAdminActor, 'HR Approval');

  // Create plan with booking PNR
  const plan = travelService.createTravelPlan({
    requestId: req.requestId,
    bookingReference: 'PIA-PNR-88219',
    transportationType: 'Commercial Airline',
    vendorReference: 'Pakistan International Airlines',
    hotelReference: 'Serena Quetta Corporate Booking',
    confirmedCost: 35000
  }, hrAdminActor);

  assert.ok(plan.planId.startsWith('TRV-PLAN-'));
  assert.equal(plan.bookingReference, 'PIA-PNR-88219');
  assert.equal(plan.status, 'Planned');
});

test('9. Travel Advance Disbursement & Separation from Incurred Expenses', () => {
  const req = travelService.createTravelRequest({
    destination: 'Lahore',
    travelPurpose: 'Client Tech Migration',
    departureDate: '2026-11-18',
    returnDate: '2026-11-20',
    estimatedBudget: 50000,
    requestedAdvance: 20000,
    status: 'Submitted'
  }, employeeActor);

  travelService.approveTravelRequest(req.requestId, superAdminActor, 'Approved');

  // Disburse advance
  const disburse = travelService.disburseAdvance(req.requestId, {
    disbursedAmount: 20000,
    voucherReference: 'PCV-2026-9001',
    notes: 'Petty cash handed over against signed requisition voucher'
  }, hrAdminActor);

  assert.equal(disburse.disbursedAdvance, 20000);
  assert.equal(disburse.settlementStatus, 'Advance Disbursed');
  assert.equal(disburse.settlementBalance, -20000); // Company holds claim over employee
});

test('10. Expense Claim Submission & Settlement Reconciliation Balance', () => {
  const req = travelService.createTravelRequest({
    destination: 'Karachi',
    travelPurpose: 'Data Center Installation',
    departureDate: '2026-11-28',
    returnDate: '2026-11-30',
    estimatedBudget: 30000,
    requestedAdvance: 15000,
    status: 'Submitted'
  }, employeeActor);

  travelService.approveTravelRequest(req.requestId, hrAdminActor, 'Approved');
  travelService.disburseAdvance(req.requestId, {
    disbursedAmount: 15000,
    voucherReference: 'PCV-2026-9002'
  }, hrAdminActor);

  // Employee claims actual incurred expenses of 22,000 (exceeds advance)
  travelService.submitExpenseReceipts(req.requestId, {
    submittedExpenses: 22000,
    receiptReferences: ['RCP-KHI-01', 'RCP-KHI-02']
  }, employeeActor);

  // Audit reconciles and approves 22,000
  const reconciled = travelService.reconcileTravelExpense(req.requestId, {
    approvedExpenses: 22000,
    notes: 'All fuel and accommodation vouchers audited'
  }, hrAdminActor);

  assert.equal(reconciled.approvedExpenses, 22000);
  // Balance: 22000 - 15000 = +7000 (Company owes employee reimbursement)
  assert.equal(reconciled.settlementBalance, 7000);
  assert.equal(reconciled.settlementStatus, 'Pending Final Settlement');
});

test('11. Pick-and-Drop Facility Request & Capacity Enforcement', () => {
  // Get active route
  const routes = travelService.getRoutes();
  const route = routes[0];
  const initialCount = route.assignedCount || 0;

  // Enroll employee without existing assignment
  const asn = travelService.requestPickAndDrop({
    employeeId: newEmployeeActor.employeeId,
    routeId: route.routeId,
    pickupPoint: 'Gulshan Chowrangi',
    facilityType: 'Company Subsidized',
    monthlyContribution: 3000
  }, hrAdminActor);

  assert.ok(asn.assignmentId.startsWith('TRANS-ASN-'));
  assert.equal(asn.status, 'Active');
  assert.equal(asn.routeId, route.routeId);

  // Verify route assignedCount incremented
  const updatedRoutes = travelService.getRoutes();
  const updatedRoute = updatedRoutes.find((r) => r.routeId === route.routeId);
  assert.equal(updatedRoute.assignedCount, initialCount + 1);
});

test('12. Conflicting Active Transport Assignment Prevention', () => {
  const routes = travelService.getRoutes();
  const route = routes[0];

  // employeeActor (Zeeshan Ali) already has an active assignment in INITIAL_TRANSPORT_ASSIGNMENTS
  assert.throws(() => {
    travelService.requestPickAndDrop({
      employeeId: employeeActor.employeeId,
      routeId: route.routeId,
      pickupPoint: 'Clifton'
    }, hrAdminActor);
  }, /already has an active transport assignment/i);
});

test('13. Route & Vehicle Scheduling Conflict Detection', () => {
  const drivers = travelService.getDrivers();
  const routes = travelService.getRoutes();
  const activeRoute = routes[0];

  // Try to create another route using the same vehicle at the same departure time
  assert.throws(() => {
    travelService.saveRoute({
      routeName: 'Conflicting Morning Shuttle',
      assignedVehicleId: activeRoute.assignedVehicleId,
      assignedDriverId: drivers[1]?.driverId || drivers[0].driverId,
      morningDepartureTime: activeRoute.morningDepartureTime, // Same time!
      capacity: 10
    }, superAdminActor);
  }, /schedule conflict.*vehicle/i);
});

test('14. Transport Contribution & Privacy Scoping: Employee sees only own transport pass', () => {
  const employeeView = travelService.getTransportAssignments({}, employeeActor);
  // Must only contain employeeActor's records
  for (const a of employeeView) {
    assert.equal(a.employeeId, employeeActor.employeeId);
  }

  // Super admin sees all company assignments
  const adminView = travelService.getTransportAssignments({}, superAdminActor);
  assert.ok(adminView.length >= employeeView.length);
});

test('15. Travel & Transport Audit History Preservation', () => {
  const req = travelService.createTravelRequest({
    destination: 'Hyderabad',
    travelPurpose: 'ERP User Training',
    departureDate: '2026-11-29',
    returnDate: '2026-11-30',
    estimatedBudget: 25000,
    status: 'Submitted'
  }, employeeActor);

  // History contains creation entry
  assert.ok(req.approvalHistory);
  assert.equal(req.approvalHistory.length, 1);
  assert.equal(req.approvalHistory[0].action, 'Submitted');

  // Approval appends audit entry
  const approved = travelService.approveTravelRequest(req.requestId, superAdminActor, 'Executive Signoff');
  assert.equal(approved.approvalHistory.length, 2);
  assert.equal(approved.approvalHistory[1].action, 'Approved');
  assert.equal(approved.approvalHistory[1].by, superAdminActor.name);
});

test('16. Super Admin Self-Approval & Rejection Authority (while blocking non-Super Admin self-approval)', () => {
  const saReq = travelService.createTravelRequest({
    destination: 'Karachi Hub',
    travelPurpose: 'Executive Operations Review',
    departureDate: '2026-12-01',
    returnDate: '2026-12-02',
    estimatedBudget: 45000,
    requestedAdvance: 20000,
    status: 'Submitted'
  }, superAdminActor);

  assert.equal(saReq.status, 'Submitted');

  // Super Admin directly approves own pending request without Manager/HR approval
  const approved = travelService.approveTravelRequest(saReq.requestId, superAdminActor, 'Direct Super Admin Authorization');
  assert.equal(approved.status, 'Approved');
  assert.ok(approved.attendanceF04Ref?.startsWith('DUTY-FLD-'));

  // Expense ledger auto-initialized for approved Super Admin trip
  const expense = travelService.getTravelExpenses({}, superAdminActor).find((e) => e.requestId === saReq.requestId);
  assert.ok(expense);
  assert.equal(expense.settlementStatus, 'Advance Pending');

  // Super Admin can also reject own pending request
  const saReq2 = travelService.createTravelRequest({
    destination: 'Quetta',
    travelPurpose: 'Board Briefing Trip',
    departureDate: '2026-12-05',
    returnDate: '2026-12-06',
    estimatedBudget: 30000,
    status: 'Submitted'
  }, superAdminActor);

  const rejected = travelService.rejectTravelRequest(saReq2.requestId, superAdminActor, 'Virtual meeting instead');
  assert.equal(rejected.status, 'Rejected');

  // Non-Super Admin (HR Admin) is still blocked from self-approving own request
  const hrReq = travelService.createTravelRequest({
    destination: 'Multan',
    travelPurpose: 'HR Campus Hiring',
    departureDate: '2026-12-10',
    returnDate: '2026-12-11',
    estimatedBudget: 20000,
    status: 'Submitted'
  }, hrAdminActor);

  assert.throws(() => {
    travelService.approveTravelRequest(hrReq.requestId, hrAdminActor, 'HR self attempt');
  }, /anti-self-approval/i);
});

test('17. Super Admin Direct Authorization on Creation & Plan/Expense Integration', () => {
  const direct = travelService.createTravelRequest({
    destination: 'Lahore Regional Office',
    travelPurpose: 'Executive Annual Audit',
    departureDate: '2026-12-15',
    returnDate: '2026-12-17',
    estimatedBudget: 50000,
    requestedAdvance: 25000,
    status: 'Approved',
    directApprove: true
  }, superAdminActor);

  assert.equal(direct.status, 'Approved');
  assert.ok(direct.attendanceF04Ref?.startsWith('DUTY-FLD-'));

  const plan = travelService.createTravelPlan({
    requestId: direct.requestId,
    bookingReference: 'PIA-EXEC-900',
    confirmedCost: 48000
  }, superAdminActor);
  assert.equal(plan.status, 'Planned');

  const adv = travelService.disburseAdvance(direct.requestId, {
    disbursedAmount: 25000,
    voucherReference: 'PCV-DIRECT-01'
  }, superAdminActor);
  assert.equal(adv.settlementStatus, 'Advance Disbursed');
});

test('18. Travel Plans Date & Transition Validation: Blocks premature start/completion and repeated/invalid transitions', () => {
  const localYmd = (offsetDays) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  // Future trip: cannot start before departure
  const futureReq = travelService.createTravelRequest({
    employeeId: 'EMP-004',
    travelPurpose: 'Future Client Workshop',
    destination: 'Lahore, Pakistan',
    departureDate: localYmd(5),
    returnDate: localYmd(7),
    estimatedBudget: 30000,
    directApprove: true
  }, superAdminActor);
  const futurePlan = travelService.createTravelPlan({
    requestId: futureReq.requestId,
    bookingReference: 'PK-FUT-01',
    departureSchedule: `${localYmd(5)} 09:00 AM`,
    returnSchedule: `${localYmd(7)} 06:00 PM`,
    confirmedCost: 29000
  }, hrAdminActor);

  assert.throws(() => {
    travelService.updateTravelPlanStatus(futurePlan.planId, 'In Progress', hrAdminActor);
  }, /before scheduled departure date/i);

  assert.throws(() => {
    travelService.updateTravelPlanStatus(futurePlan.planId, 'Completed', hrAdminActor);
  }, /invalid status transition/i);

  // Elapsed trip: allows Planned -> In Progress -> Completed, blocks repeat & terminal reversal
  const pastReq = travelService.createTravelRequest({
    employeeId: 'EMP-004',
    travelPurpose: 'Completed Field Audit',
    destination: 'Karachi, Pakistan',
    departureDate: localYmd(-3),
    returnDate: localYmd(-1),
    estimatedBudget: 25000,
    directApprove: true
  }, superAdminActor);
  const pastPlan = travelService.createTravelPlan({
    requestId: pastReq.requestId,
    bookingReference: 'PK-PAST-02',
    departureSchedule: `${localYmd(-3)} 09:00 AM`,
    returnSchedule: `${localYmd(-1)} 06:00 PM`,
    confirmedCost: 24000
  }, hrAdminActor);

  const started = travelService.updateTravelPlanStatus(pastPlan.planId, 'In Progress', hrAdminActor);
  assert.equal(started.status, 'In Progress');

  assert.throws(() => {
    travelService.updateTravelPlanStatus(pastPlan.planId, 'In Progress', hrAdminActor);
  }, /repeated transition blocked/i);

  const completed = travelService.updateTravelPlanStatus(pastPlan.planId, 'Completed', superAdminActor);
  assert.equal(completed.status, 'Completed');

  assert.throws(() => {
    travelService.updateTravelPlanStatus(pastPlan.planId, 'Planned', superAdminActor);
  }, /invalid status transition/i);
});

test('19. Incomplete Save as Draft & Overlap Checks Across Create, Edit, Submit and Approve', () => {
  // Incomplete draft without dates/budget/purpose saves cleanly
  const draft = travelService.createTravelRequest({
    destination: 'Karachi',
    travelPurpose: '',
    departureDate: '',
    returnDate: '',
    estimatedBudget: '',
    status: 'Draft'
  }, employeeActor);

  assert.equal(draft.status, 'Draft');
  assert.equal(draft.departureDate, '');
  assert.equal(draft.estimatedBudget, 0);

  // Submitting incomplete draft is blocked
  assert.throws(() => {
    travelService.submitTravelRequest(draft.requestId, employeeActor);
  }, /travel purpose is required|required/i);

  // Editing draft dates to overlap existing Submitted request (TRV-2026-004: 2026-12-01..03 for EMP-004) is blocked
  assert.throws(() => {
    travelService.updateTravelRequest(draft.requestId, {
      travelPurpose: 'Conflicting Sync',
      destination: 'Karachi, Pakistan',
      departureDate: '2026-12-01',
      returnDate: '2026-12-02',
      estimatedBudget: 15000,
      status: 'Draft'
    }, employeeActor);
  }, /overlapping travel conflict/i);

  // Editing with clean dates & submitting succeeds
  const submitted = travelService.updateTravelRequest(draft.requestId, {
    travelPurpose: 'Clean Non-Overlapping Visit',
    destination: 'Karachi, Pakistan',
    departureDate: '2027-02-10',
    returnDate: '2027-02-12',
    estimatedBudget: 25000,
    status: 'Submitted'
  }, employeeActor);
  assert.equal(submitted.status, 'Submitted');

  // Super Admin direct authorize on overlapping dates is also blocked
  assert.throws(() => {
    travelService.createTravelRequest({
      employeeId: employeeActor.employeeId,
      travelPurpose: 'Overlap SA Direct',
      destination: 'Karachi',
      departureDate: '2027-02-11',
      returnDate: '2027-02-13',
      estimatedBudget: 12000,
      directApprove: true
    }, superAdminActor);
  }, /overlapping travel conflict/i);
});

test('20. Travel Advances & Expenses: Duplicate Advance & Final Settlement Financial Locks', () => {
  const req = travelService.createTravelRequest({
    employeeId: employeeActor.employeeId,
    travelPurpose: 'Locked Settlement Financial QA',
    destination: 'Karachi, Pakistan',
    departureDate: '2027-05-01',
    returnDate: '2027-05-02',
    estimatedBudget: 45000,
    requestedAdvance: 20000,
    directApprove: true
  }, superAdminActor);

  // First advance disbursement succeeds
  const disbursed = travelService.disburseAdvance(req.requestId, {
    disbursedAmount: 20000,
    voucherReference: 'PCV-UNIT-LOCK-01',
    notes: 'Single valid disbursement'
  }, hrAdminActor);
  assert.equal(disbursed.advanceDisbursedReference, 'PCV-UNIT-LOCK-01');

  // Second advance disbursement on same trip is blocked
  assert.throws(() => {
    travelService.disburseAdvance(req.requestId, {
      disbursedAmount: 5000,
      voucherReference: 'PCV-UNIT-LOCK-02'
    }, superAdminActor);
  }, /duplicate advance blocked/i);

  // Submit receipts & settle exact match -> Settled
  travelService.submitExpenseReceipts(req.requestId, {
    submittedExpenses: 20000,
    receiptReferences: ['RCP-LOCK-01']
  }, employeeActor);

  const settled = travelService.reconcileTravelExpense(req.requestId, {
    approvedExpenses: 20000,
    notes: 'Exact final settlement'
  }, hrAdminActor);
  assert.equal(settled.settlementStatus, 'Settled');

  // Post-settlement locks across all 3 operations
  assert.throws(() => {
    travelService.disburseAdvance(req.requestId, {
      disbursedAmount: 1000,
      voucherReference: 'PCV-UNIT-LOCK-03'
    }, superAdminActor);
  }, /already settled/i);

  assert.throws(() => {
    travelService.submitExpenseReceipts(req.requestId, {
      submittedExpenses: 25000,
      receiptReferences: ['RCP-LOCK-02']
    }, employeeActor);
  }, /locked|settled/i);

  assert.throws(() => {
    travelService.reconcileTravelExpense(req.requestId, {
      approvedExpenses: 21000
    }, superAdminActor);
  }, /already settled/i);
});

test('21. Edit Travel Request (Draft, Submitted, Approved Corrections with Snapshot Protection), Travel Plan & Pick-and-Drop Assignment', () => {
  // 1) Owner creates Submitted request -> edits own Submitted request
  const sub = travelService.createTravelRequest({
    travelPurpose: 'Client Workshop',
    destination: 'Karachi',
    departureDate: '2027-07-10',
    returnDate: '2027-07-12',
    estimatedBudget: 32000,
    requestedAdvance: 10000,
    status: 'Submitted'
  }, employeeActor);
  const editedSub = travelService.updateTravelRequest(sub.requestId, {
    destination: 'Karachi South',
    estimatedBudget: 35000
  }, employeeActor);
  assert.equal(editedSub.destination, 'Karachi South');
  assert.equal(editedSub.estimatedBudget, 35000);

  // 2) Super Admin approves -> authorized correction preserves approval attribution & appends audit trail
  const appReq = travelService.approveTravelRequest(sub.requestId, superAdminActor, 'Approved initially');
  const origApprovedAt = appReq.finalApprovedAt;
  const saCorrected = travelService.updateTravelRequest(sub.requestId, {
    destination: 'Hyderabad, Pakistan',
    correctionReason: 'Site updated'
  }, superAdminActor);
  assert.equal(saCorrected.destination, 'Hyderabad, Pakistan');
  assert.equal(saCorrected.finalApprovedAt, origApprovedAt);
  assert.ok(saCorrected.approvalHistory.some((h) => h.action === 'Authorized Correction'));

  // 3) Plan create + edit
  const plan = travelService.createTravelPlan({
    requestId: sub.requestId,
    bookingReference: 'PNR-U-100',
    confirmedCost: 34000
  }, hrAdminActor);
  const editedPlan = travelService.updateTravelPlan(plan.planId, {
    bookingReference: 'PNR-U-200',
    confirmedCost: 36000
  }, superAdminActor);
  assert.equal(editedPlan.bookingReference, 'PNR-U-200');
  assert.equal(editedPlan.confirmedCost, 36000);

  // 4) Pick-and-Drop Assignment edit (owner pending -> admin active)
  const asn = travelService.requestPickAndDrop({
    routeId: 'ROUTE-01',
    pickupPoint: 'Gulshan Chowrangi',
    effectiveFrom: '2027-07-01'
  }, newEmployeeActor);
  const ownerEditedAsn = travelService.updateTransportAssignment(asn.assignmentId, {
    pickupPoint: 'Nipa Chowrangi'
  }, newEmployeeActor);
  assert.equal(ownerEditedAsn.pickupPoint, 'Nipa Chowrangi');

  travelService.updateTransportAssignmentStatus(asn.assignmentId, 'Active', hrAdminActor);
  assert.throws(() => {
    travelService.updateTransportAssignment(asn.assignmentId, { pickupPoint: 'Jail Chowrangi' }, newEmployeeActor);
  }, /HR Admin or Super Admin/i);

  const adminEditedAsn = travelService.updateTransportAssignment(asn.assignmentId, {
    pickupPoint: 'Jail Chowrangi',
    monthlyContribution: 2500
  }, superAdminActor);
  assert.equal(adminEditedAsn.pickupPoint, 'Jail Chowrangi');
  assert.equal(adminEditedAsn.monthlyContribution, 2500);

  // 5) Disbursed advance locks approved budget edits; Settled locks all travel request edits
  travelService.disburseAdvance(sub.requestId, { disbursedAmount: 10000, voucherReference: 'PCV-EDIT-U1' }, hrAdminActor);
  assert.throws(() => {
    travelService.updateTravelRequest(sub.requestId, { estimatedBudget: 88000 }, superAdminActor);
  }, /disbursement|reconciliation/i);

  travelService.submitExpenseReceipts(sub.requestId, { submittedExpenses: 10000, receiptReferences: ['RCP-U-1'] }, employeeActor);
  travelService.reconcileTravelExpense(sub.requestId, { approvedExpenses: 10000 }, hrAdminActor);
  assert.throws(() => {
    travelService.updateTravelRequest(sub.requestId, { destination: 'Locked Settled Edit' }, superAdminActor);
  }, /Settled/i);
});
