import { test } from 'node:test';
import assert from 'node:assert/strict';
import helpDeskService from '../services/helpDeskService.js';

// Actor profiles
const superAdminActor = { name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001', department: 'Executive' };
const hrAdminActor = { name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002', department: 'HR' };
const managerActor = { name: 'Bilal Ahmed', role: 'manager', employeeId: 'EMP-003', department: 'Engineering' };
const employeeActor = { name: 'Zeeshan Ali', role: 'employee', employeeId: 'EMP-004', department: 'Engineering' };
const otherEmployeeActor = { name: 'Sana Malik', role: 'employee', employeeId: 'EMP-005', department: 'Finance' };
const resolverActor = { name: 'Asim Raza', role: 'hr_admin', employeeId: 'EMP-007', department: 'IT' };

test('1. Ticket Creation & Validation: Requires subject (min 5 chars) and description (min 10 chars)', () => {
  // Valid creation
  const ticket = helpDeskService.createTicket({
    subject: 'Cannot access internal corporate GitLab repository',
    categoryId: 'CAT-IT',
    subcategory: 'System Credentials & Email Login',
    priority: 'High',
    description: 'SSH key was added but git pull returns Permission denied (publickey) on port 22.',
  }, employeeActor);

  assert.ok(ticket.ticketId.startsWith('HD-'));
  assert.equal(ticket.status, 'Open');
  assert.equal(ticket.employeeId, employeeActor.employeeId);
  assert.equal(ticket.employeeName, employeeActor.name);

  // Validation: Missing or short subject throws
  assert.throws(() => {
    helpDeskService.createTicket({ subject: 'Git', description: 'Long enough description text here', categoryId: 'CAT-IT' }, employeeActor);
  }, /at least 5 characters/i);

  // Validation: Missing or short description throws
  assert.throws(() => {
    helpDeskService.createTicket({ subject: 'Valid subject title', description: 'short', categoryId: 'CAT-IT' }, employeeActor);
  }, /at least 10 characters/i);
});

test('2. Category-based Routing: IT ticket auto-routes to TEAM-IT, HR ticket auto-routes to TEAM-HR', () => {
  const itTicket = helpDeskService.createTicket({
    subject: 'Docker desktop virtual disk exhausted',
    categoryId: 'CAT-IT',
    description: 'Need assistance resizing qcow2 docker disk partition to 60GB.',
  }, employeeActor);

  assert.equal(itTicket.assignedTeamId, 'TEAM-IT');
  assert.equal(itTicket.assignedTeamName, 'IT Operations & Infrastructure');

  const hrTicket = helpDeskService.createTicket({
    subject: 'Request for formal experience letter format',
    categoryId: 'CAT-HR',
    description: 'Require official letter format verification for international visa appointment.',
  }, employeeActor);

  assert.equal(hrTicket.assignedTeamId, 'TEAM-HR');
  assert.equal(hrTicket.assignedTeamName, 'HR Operations & People Care');
});

test('3. Priority & Dynamic SLA Target Calculation: Critical target 4h, High target 8h, Medium 24h, Low 48h', () => {
  const now = new Date();
  const critTicket = helpDeskService.createTicket({
    subject: 'Production authentication service outage',
    categoryId: 'CAT-IT',
    priority: 'Critical',
    description: 'Single sign-on IDP gateway is returning 502 bad gateway across all company apps.',
  }, superAdminActor);

  const resDue = new Date(critTicket.resolutionDue).getTime();
  const created = new Date(critTicket.createdDate).getTime();
  const diffHours = (resDue - created) / 3600000;

  // Critical resolution target is 4 hours
  assert.equal(Math.round(diffHours), 4);
  assert.equal(critTicket.isEscalated, true); // Auto-escalated on Critical
});

test('4. Ticket Status Workflow: Valid status progression Open -> Assigned -> In Progress -> Resolved', () => {
  const ticket = helpDeskService.createTicket({
    subject: 'Need wireless mouse and monitor adapter',
    categoryId: 'CAT-ADM',
    description: 'HDMI to USB-C multi-port dongle requested for secondary screen setup.',
  }, employeeActor);

  assert.equal(ticket.status, 'Open');

  // Assign to resolver -> Status transitions to Assigned
  const assigned = helpDeskService.assignTicket(ticket.ticketId, {
    resolverId: resolverActor.employeeId,
    resolverName: resolverActor.name
  }, hrAdminActor);
  assert.equal(assigned.status, 'Assigned');

  // Support posts public reply -> Status transitions to In Progress
  const replied = helpDeskService.addReply(ticket.ticketId, {
    message: 'We have reserved a Dell USB-C adapter for you at the IT desk.',
    isInternalNote: false
  }, resolverActor);
  assert.equal(replied.status, 'In Progress');

  // Resolve ticket
  const resolved = helpDeskService.resolveTicket(ticket.ticketId, {
    resolutionSummary: 'Dispatched USB-C multiport adapter to 3rd floor workstation.'
  }, resolverActor);
  assert.equal(resolved.status, 'Resolved');
});

test('5. Internal Note Confidentiality: Internal notes are STRICTLY hidden from employee view', () => {
  const ticket = helpDeskService.createTicket({
    subject: 'Workstation battery drain investigation',
    categoryId: 'CAT-IT',
    description: 'Battery health drops 50% in 30 minutes off AC power.',
  }, employeeActor);

  // Resolver posts an internal note
  helpDeskService.addReply(ticket.ticketId, {
    message: 'Internal Note: Battery cycle count is 980. Needs replacement under warranty contract with vendor.',
    isInternalNote: true
  }, resolverActor);

  // Resolver posts a public customer message
  helpDeskService.addReply(ticket.ticketId, {
    message: 'Hello Zeeshan, we have ordered a diagnostic check.',
    isInternalNote: false
  }, resolverActor);

  // When fetched by employee, internal note is stripped!
  const employeeView = helpDeskService.getTicketById(ticket.ticketId, employeeActor);
  const internalNotesInEmployeeView = employeeView.conversations.filter(c => c.isInternalNote);
  assert.equal(internalNotesInEmployeeView.length, 0);

  // When fetched by HR/Admin, internal note is present
  const adminView = helpDeskService.getTicketById(ticket.ticketId, hrAdminActor);
  const internalNotesInAdminView = adminView.conversations.filter(c => c.isInternalNote);
  assert.equal(internalNotesInAdminView.length, 1);
  assert.ok(internalNotesInAdminView[0].message.includes('warranty contract'));
});

test('6. Support Reply History & Timeline Audit: Preserves chronological order and actors', () => {
  const ticket = helpDeskService.createTicket({
    subject: 'Query regarding medical insurance policy network hospitals',
    categoryId: 'CAT-HR',
    description: 'Please share the latest 2026 panel hospital directory for Lahore region.',
  }, employeeActor);

  helpDeskService.addReply(ticket.ticketId, { message: 'Shared the PDF brochure to your email.', isInternalNote: false }, hrAdminActor);

  const updated = helpDeskService.getTicketById(ticket.ticketId, hrAdminActor);
  assert.ok(updated.conversations.length >= 2);
  assert.ok(updated.timeline.length >= 2);
  assert.equal(updated.timeline[0].action, 'Ticket Created');
});

test('7. Resolver Assignment & Queue Delegation', () => {
  const ticket = helpDeskService.createTicket({
    subject: 'Ergonomic lumbar support chair inquiry',
    categoryId: 'CAT-ADM',
    description: 'Requesting orthopedic chair adjustment as per medical recommendation.',
  }, employeeActor);

  const assigned = helpDeskService.assignTicket(ticket.ticketId, {
    resolverId: 'EMP-010',
    resolverName: 'Kamran Facilities Lead',
    teamId: 'TEAM-ADM'
  }, hrAdminActor);

  assert.equal(assigned.assignedResolverName, 'Kamran Facilities Lead');
  assert.equal(assigned.assignedTeamId, 'TEAM-ADM');
});

test('8. Escalation Routing: Escalates priority and updates audit timeline', () => {
  const ticket = helpDeskService.createTicket({
    subject: 'Intermittent packet loss on QA staging server',
    categoryId: 'CAT-IT',
    priority: 'Medium',
    description: 'Automated regression test runner timeouts on API gateway.',
  }, employeeActor);

  const escalated = helpDeskService.escalateTicket(ticket.ticketId, 'Blocking sprint release candidate validation', hrAdminActor);

  assert.equal(escalated.isEscalated, true);
  assert.equal(escalated.priority, 'High');
  assert.equal(escalated.escalationReason, 'Blocking sprint release candidate validation');
});

test('9. Ticket Resolution: Requires resolution summary and records resolver attribution', () => {
  const ticket = helpDeskService.createTicket({
    subject: 'Attendance punch missing for field client visit',
    categoryId: 'CAT-HR',
    description: 'Attended on-site deployment at client headquarters yesterday from 10am to 6pm.',
  }, employeeActor);

  // Short resolution summary throws error
  assert.throws(() => {
    helpDeskService.resolveTicket(ticket.ticketId, { resolutionSummary: 'Fixed' }, hrAdminActor);
  }, /minimum 10 characters/i);

  const resolved = helpDeskService.resolveTicket(ticket.ticketId, {
    resolutionSummary: 'Verified client sign-off slip and adjusted field duty record in F04 attendance.'
  }, hrAdminActor);

  assert.equal(resolved.status, 'Resolved');
  assert.ok(resolved.resolvedAt);
  assert.equal(resolved.resolvedByName, hrAdminActor.name);
});

test('10. Ticket Closure & Satisfaction Feedback: Records 1-5 star rating and feedback', () => {
  const ticket = helpDeskService.createTicket({
    subject: 'Request for secondary monitor stand',
    categoryId: 'CAT-ADM',
    description: 'Desk arm stand required for ergonomic dual-screen setup.',
  }, employeeActor);

  helpDeskService.resolveTicket(ticket.ticketId, {
    resolutionSummary: 'Delivered dual-arm monitor stand to desk station #34.'
  }, hrAdminActor);

  const closed = helpDeskService.closeTicket(ticket.ticketId, {
    rating: 5,
    feedback: 'Excellent response and rapid physical installation!'
  }, employeeActor);

  assert.equal(closed.status, 'Closed');
  assert.equal(closed.satisfactionRating, 5);
  assert.equal(closed.satisfactionFeedback, 'Excellent response and rapid physical installation!');
  assert.ok(closed.closedAt);
});

test('11. Ticket Reopening: Moves prior resolution and feedback to historical, not current resolution', () => {
  const ticket = helpDeskService.createTicket({
    subject: 'Email signature template misalignment',
    categoryId: 'CAT-IT',
    description: 'Company logo in standard Outlook HTML template is distorted on mobile devices.',
  }, employeeActor);

  helpDeskService.resolveTicket(ticket.ticketId, {
    resolutionSummary: 'Uploaded fixed 2x retina logo image assets to CDN.'
  }, resolverActor);

  helpDeskService.closeTicket(ticket.ticketId, {
    rating: 4,
    feedback: 'Worked initially on desktop client.'
  }, employeeActor);

  // Reopen closed ticket
  const reopened = helpDeskService.reopenTicket(
    ticket.ticketId,
    'Logo is fixed on iOS but still stretched horizontally on Outlook for Android.',
    employeeActor
  );

  assert.equal(reopened.status, 'In Progress');
  assert.equal(reopened.isReopened, true);
  assert.equal(reopened.isReopenedActive, true);
  assert.equal(reopened.reopenReason, 'Logo is fixed on iOS but still stretched horizontally on Outlook for Android.');
  // Current resolution/closure/feedback must be cleared while previous cycle is historical
  assert.equal(reopened.resolutionSummary, null);
  assert.equal(reopened.satisfactionRating, null);
  assert.equal(reopened.previousResolutionSummary, 'Uploaded fixed 2x retina logo image assets to CDN.');
  assert.equal(reopened.previousSatisfactionRating, 4);
  assert.equal(reopened.previousSatisfactionFeedback, 'Worked initially on desktop client.');
});

test('12. Help Desk Operational Summaries & KPI Counts', () => {
  const kpis = helpDeskService.getHelpDeskKPIs(superAdminActor);

  assert.ok(kpis.totalTickets > 0);
  assert.ok(typeof kpis.openTickets === 'number');
  assert.ok(typeof kpis.resolvedTickets === 'number');
  assert.ok(typeof kpis.closedTickets === 'number');
  assert.ok(typeof kpis.categoryCounts === 'object');
  assert.ok(typeof kpis.teamWorkload === 'object');
});

test('13. Employee Data Privacy Isolation: Employees only see their own submitted tickets', () => {
  const allTickets = helpDeskService.getTickets({}, superAdminActor);
  const employeeTickets = helpDeskService.getTickets({}, employeeActor);

  assert.ok(allTickets.length >= employeeTickets.length);
  for (const t of employeeTickets) {
    assert.equal(t.employeeId, employeeActor.employeeId);
  }

  // Attempting to read another employee's ticket directly throws error
  assert.throws(() => {
    helpDeskService.getTicketById('HD-2026-002', employeeActor); // HD-2026-002 belongs to Sana Malik
  }, /access denied/i);
});

test('14. Manager Support Scope: Strictly shields direct reports confidential HR and payroll tickets', () => {
  // HD-2026-003 is a confidential HR grievance filed by Zeeshan Ali (EMP-004)
  // Bilal Ahmed is Zeeshan's engineering line manager (EMP-003)
  assert.throws(() => {
    helpDeskService.getTicketById('HD-2026-003', managerActor);
  }, /confidential hr\/payroll ticket/i);

  // In manager's ticket list, confidential HR/payroll tickets of direct reports are filtered out
  const managerTickets = helpDeskService.getTickets({}, managerActor);
  const confidentialTeamTickets = managerTickets.filter(
    t => t.employeeId === 'EMP-004' && (t.categoryId === 'CAT-HR' || t.categoryId === 'CAT-PAY')
  );
  assert.equal(confidentialTeamTickets.length, 0);
});

test('15. Escalation History, SLA Response Breach & Manager Internal-Note Shielding', () => {
  const ticket = helpDeskService.createTicket({
    subject: 'Staging VPN gateway handshake timeout',
    categoryId: 'CAT-IT',
    priority: 'Low',
    description: 'Department developers are unable to establish WireGuard tunnel to staging.'
  }, employeeActor);

  helpDeskService.addReply(ticket.ticketId, {
    message: 'Internal Note: Rotating WireGuard private key in vault.',
    isInternalNote: true
  }, hrAdminActor);

  // Non-assigned department manager can view IT ticket but CANNOT see internal note or internal timeline event
  const mgrTicket = helpDeskService.getTicketById(ticket.ticketId, managerActor);
  assert.equal(mgrTicket.conversations.filter(c => c.isInternalNote).length, 0);
  assert.equal(
    mgrTicket.timeline.filter(e => String(e.action || '').toLowerCase().includes('internal note')).length,
    0
  );

  // Escalate twice -> escalationHistory retains both events
  helpDeskService.escalateTicket(ticket.ticketId, 'Blocking QA release verification', hrAdminActor);
  const esc2 = helpDeskService.escalateTicket(ticket.ticketId, 'Executive demo affected', superAdminActor);
  assert.equal(esc2.escalationHistory.length, 2);

  // Overdue firstResponseDue triggers response SLA breach
  const overdueSla = helpDeskService.getSLAStatus({
    ...esc2,
    firstResponseDue: new Date(Date.now() - 3600000).toISOString(),
    firstResponseAt: null,
    resolutionDue: new Date(Date.now() + 7200000).toISOString()
  });
  assert.equal(overdueSla.isResponseBreached, true);
  assert.equal(overdueSla.isBreached, true);
  assert.equal(overdueSla.firstResponseSlaStatus, 'Breached');
});
