# iSysware HRMS — Product Requirements Document (PRD)

**Version:** 1.0 — Final approved functional baseline  
**Date:** 26 October 2026  
**Owner:** iSysware Software Solutions  
**Status:** Requirements baseline; NOT a claim of implemented functionality  
**Implementation agent:** Antigravity IDE  
**Primary language:** English technical specifications with Roman Urdu operational examples  
**Primary source:** `iSysware_HRMS_Final_Policies_Approval_Rules_Complete_Blueprint_2026.pdf` (48-page v4 blueprint)

> **Decision lock:** Five portals (Super Admin, HR/Admin, Department Manager, Team Lead, Employee), fourteen core modules, and Scheduled Alerts as a cross-cutting capability. Product uses JavaScript-based PERN, not TypeScript. Frontend first, then backend, then PostgreSQL/integration, then owner-approved Namecheap deployment. All formal reports must be table/column based — zero graphs.

## 1. Product vision and problem statement

Build a centralized, auditable, intuitive Human Resource Management System for iSysware's Development, Sales, Media, HR, Finance, Management, and future departments. It should replace disconnected spreadsheets, inconsistent attendance/leave decisions, informal salary calculations, scattered requests, undocumented HR letters, and opaque performance decisions with consistent end-to-end workflows. A person with basic computer literacy should be able to complete their core daily task without training beyond basic orientation.

### 1.1 Goals

1. One canonical employee record, independent of login account, role, work arrangement, contract and compensation plan.
2. Super Admin defines and versions company rules; all modules consume one applicable-policy resolution mechanism.
3. Accurate, approved, traceable time, leave, overtime, commission, tax, payroll, banking, loans and benefits.
4. Managers supervise only assigned teams; employees use personal self-service; HR handles operations with permissioned finance access.
5. Support office, remote, hybrid, field/client duty, monthly, hourly, project/milestone and salary-plus-commission arrangements.
6. Make HR services measurable: recruitment, tasks/performance, training, Help Desk, official travel, transport/pick-and-drop, expense claims and letters.
7. Deliver accountant-grade, filterable, reconcilable, exportable tabular reporting without report graphs.
8. Operate securely on a verified compatible hosting/database architecture; prevent silent changes to historical records.

### 1.2 Scope boundaries

- This is HRMS/workforce management, **not** a full accounting general ledger, CRM, enterprise project management suite, fleet GPS tracker, statutory tax e-filing product, or complex ATS/LMS.
- Reporting may use CA-style formats, but must **not** label itself audited statutory financial statements unless a true ledger and compliance process exist.
- UI prototype is not secure production authorization; production enforces policies on backend and DB transactions.
- No sixth portal for Finance, IT, Transport, Applicant or Vendor; use the five portals (Super Admin, HR/Admin, Department Manager, Team Lead, Employee) plus fine-grained role/capability grants and routing.
- External email/WhatsApp, banking APIs, biometric hardware, maps and FBR filing are optional future integrations, not implicit commitments.

## 2. Organizational structure and identity model

**Hierarchy (Batch 3.1):** Company → Department → Sub-department (optional intermediate entity) → Teams → Team Leads → Employees; team/manager assignment is effective dated. 
- **Sub-department Master:** Stable ID (`SUBDEP-xx`), code, name, parent `departmentId`, assigned `managerId`, status (`Active`/`Inactive`), and description. Sub-departments are optional; departments may operate with direct teams or with intermediate sub-departments.
- **Five-Portal Role Scope:** Exactly five portals are preserved. Department Heads oversee whole authorized department scope. Sub-department Managers utilize the existing Department Manager Portal (`/manager/*`) dynamically scoped strictly to their sub-department teams and reporting members. Team Leads remain restricted to their assigned team roster and direct reports.
- **Organization Masters:** Super Admin and HR/Admin portals provide full CRUD management over Departments, Sub-departments, Teams, and Designations with relationship consistency validation and active-staff deactivation guards.
- **Multi-Team Management (Batch 3.2):** Authorized Department Managers, Sub-department Managers, and Team Leads can manage one or multiple assigned teams simultaneously via canonical team assignments (`STORAGE_KEYS.TEAM_ASSIGNMENTS`). Scalar fields `teamLeadId` and `managerId` are synchronized for backward compatibility.
- **Dynamic Scoping & Deduplication (Batch 3.2):** Portal scopes for Team Leads (`getTeamLeadScope`) and Managers (`getDepartmentManagerScope`) aggregate team members across all assigned teams with strict employee deduplication.
- **Cross-Department Security Guard (Batch 3.2):** Cross-department team assignments require explicit Super Admin or HR Admin authorization and cannot occur implicitly.
- **Dynamic Reporting Manager Resolution (Batch 3.2):** Employee creation/editing modal dynamically filters eligible direct managers based on Department, Sub-department, and Team, displaying the recommended direct supervisor and preventing reporting loops.
- **Audit & History (Batch 3.2):** Full audit trail for team lead/manager assignments and deassignments is preserved in `STORAGE_KEYS.TEAM_ASSIGNMENT_HISTORY`.
- **Employee Promotion, Transfers & Role Upgrades (Batch 3.3):** Controlled career lifecycle transitions for promotions (e.g. Employee → Team Lead, Team Lead → Manager), designation changes, and lateral transfers across departments/sub-departments/teams via `employeeService.promoteOrTransferEmployee`. Creates discrete audit records (`PROMOTION`, `DESIGNATION_CHANGE`, `DEPARTMENT_TRANSFER`, `SUB_DEPARTMENT_TRANSFER`, `TEAM_TRANSFER`, `MANAGER_TRANSFER`).
- **Separation of Concerns & Compensation Independence (Batch 3.3):** Strict invariant that promotions, designation changes, or lateral transfers NEVER automatically alter employee compensation or salary. All salary revisions remain independently governed under `salaryRevisionService` (Batch F06).
- **Controlled Portal Role Changes (Batch 3.3):** Dynamic portal role upgrades/downgrades restricted to authorized Super Admin and HR Admin. Primary Super Admin root account (`EMP-001`) is strictly protected against demotion. Active sessions in localStorage are automatically synchronized to prevent stale role escalation.
- **Management Succession & Deactivation Handover (Batch 3.3):** Prior to separating or deactivating any manager or team lead, `employeeService.analyzeManagementDependencies` identifies direct reports, managed teams/departments, and pending approvals. Deactivation is strictly blocked without an active successor plan. Executing succession atomically transfers direct reports, teams, and pending leave reviews to the designated successor with full audit tracking in `STORAGE_KEYS.SUCCESSION_HISTORY`.

Independent employee attributes (never one overloaded type field):

| Dimension | Supported values / behavior |
|---|---|
| Employment relationship | Permanent, contract, probation, intern, freelancer/project agreement |
| Work capacity | Full-time, part-time, hourly arrangement |
| Work location | Office, WFH/remote, hybrid, field/client duty |
| Pay basis | Monthly, monthly + commission, hourly, project/milestone, agreed part-time |
| Organization | Department, optional sub-department, team, designation, cost center, reporting manager |
| Work policy | Shift, workdays, holiday calendar, attendance/leave/overtime rules |
| Historical changes | Effective-from/to; sub-department transfers recorded in career history; never rewrite older payroll or approved events |
| Identity | Stable employee ID; portal user account, sessions and role grants stored separately |

**Examples:** Sales Executive = full-time + hybrid + monthly + commission + field duty; video editor = part-time + remote + hourly; freelancer = contract + project/milestone; developer = monthly + office/hybrid. Access and statutory benefits depend on actual employment/legal classification, not labels alone.

## 3. Five portals and data boundaries

### 3.1 Super Admin (company/policy owner)

- Company-wide authorized workforce/financial/operational dashboards, all departments and team hierarchies.
- Create/change/activate/version **policies, thresholds, entitlement, approver grants, escalation, department exceptions**, calendars and compensation plans.
- Manage protected portal accounts, granular permissions, audit records, final compensation and configured exceptions.
- Review payroll drafts, salary revision proposals, loan/advance/bonus/benefit requests and high-authority travel/expense decisions; approve where policy grants authority.
- Access sensitive reports with lawful need and logging; no unilateral self-approval where governance requires independent review.

### 3.2 HR/Admin (operations)

- Create/maintain employee profiles, recruitment, assignment history, shifts, policy applications, leave and attendance corrections.
- Prepare verified payroll, salary tax calculations, compensation/loan/commission data and bank advice/payment registers when granted.
- **Create performance-based increment/decrement proposals** after manager evaluation; **Super Admin final approval required**.
- Review/approve Manager leave within configured cap; handle escalated employee requests within HR authority; no broad protected policy editing.
- Operate Help Desk, travel, transport, reimbursement and HR letters by scoped delegation.
- HR/Admin account's own leave/benefits require independent reviewer; no self approval.

### 3.3 Department Manager (authorized department teams and direct reports)

- Team roster, attendance/field visits, leave/late exceptions within department authority, assignments, targets, task reviews and KPI appraisals across authorized department teams and direct reports.
- Recommend increments, decrements, promotions, overtime, bonuses, travel and expenses; **not** directly mutate confidential salary plans.
- Department-specific views for Development, Sales, Media, HR, Finance and Management; same portal, authorized department scope.
- Oversees Teams, Team Leads, and Employees within their assigned department; second-tier approval for escalations from Team Leads.
- By default cannot view reports of another department manager, subordinate private bank accounts, salary amount, loan details, confidential HR tickets or unrestricted candidate records.

### 3.4 Team Lead (assigned team operational oversight & first-tier reviews)

- Dedicated portal with Dashboard, My Team Roster, Attendance & Shifts, Leaves, Tasks, Performance, and Team Reports.
- Supervise only assigned team(s) and assigned employees (direct reports); report upward to Department Manager.
- Review & endorse attendance corrections, leave requests within team cap, WFH, client visits, timesheets, tasks, and periodic KPI reviews for assigned team members.
- Escalates requests exceeding team authority to Department Manager and HR/Admin.
- Anti-self-approval enforcement: Team Lead cannot approve own leaves, punches, or requests.
- Zero cross-department access, zero visibility into unassigned teams, confidential executive compensation, or private employee records.

### 3.5 Employee (personal self service)

- Own profile/work arrangement, assigned schedule, check-in/out, field duty, timesheets, tasks, leaves, exceptions and overtime requests.
- Own payslips, earned commission, loan/advance ledger, allowance and tax deductions, bank-detail change request, performance and training progress.
- Own Help Desk tickets, travel/transport requests, expense claims, HR letter requests and alerts.
- No edit of role, salary, designation, approver rules, policy master or another employee record.

### 3.6 Portal-specific capability matrix (approved 5-portal standard)

Legend **A** = full authorized company scope; **O** = scoped operations; **D** = authorized department teams; **T** = assigned team only; **S** = self; **—** = no default. Explicit permission + resource scope always required.

| Capability | Super Admin | HR/Admin | Dept Manager | Team Lead | Employee |
|---|---|---|---|---|---|
| Organization/employment master | A | O | D read | T read | S read |
| Candidate/joining/probation | A | O | D review | T review | S probation |
| Attendance, shift/field duty | A | O | D review | T review | S submit |
| Leave and threshold exceptions | A policy/final | O HR limits | D manager limits | T lead limits | S request |
| Payroll and tax processing | A approve | O prepare | Own only | Own only | S finalized |
| Bank/payroll payment instructions | A authorized | O Finance grant | Own masked | Own masked | S own masked |
| Commission/bonus/loan/allowance | A policy/approve | O verify | D recommend | T recommend | S own |
| Salary revision | A final approve | O propose | D recommend | T feedback | S view approved |
| Tasks/KPI/reviews | A oversight | O authorized | D manage | T manage | S update |
| Training | A oversight | O manage | D assign | T endorse | S attend |
| Help Desk | A escalation | O assigned resolver | D permitted only | T permitted only | S own |
| Travel/pick-drop/expense | A policy/exception | O verify | D approval cap | T endorse | S request |
| HR letter templates/issuance | A governance | O prepare/issue grant | D request | T request | S own |
| Scheduled alerts | A create policy | O configured rules | D receive/dept | T receive/team | S receive |
| Read-only reports | A authorized | O authorized | D safe views | T safe views | S own |
| Protected role/security rules | A | — by default | — | — | — |

## 4. Fourteen core modules and ownership

1. **Dashboard** — role-aware KPI cards, action queues, alerts, activity summary and links. Dashboard may use light visual summaries; formal reporting never uses graphs.
2. **Employee Management** — people/organization masters, joining details, work classifications, employee banking setup, assignment and career history.
3. **Recruitment & Onboarding** — vacancies, candidates, screening, interviews, offers, joining, probation, confirmation and lightweight separation.
4. **Attendance & Shift Management** — fixed/flexible/overnight shifts, office/WFH/hybrid/field, check-in/out, timesheets, corrections, early/late, overtime.
5. **Leave Management** — entitlement, leave types, balances, requests, cumulative approval limits, managers/HR hierarchy, holidays.
6. **Payroll, Compensation & Benefits** — all pay bases, commissions, monthly tax withholding, bank payment, loans, advances, bonuses, allowances, revisions, promotions.
7. **Tasks & Performance Management** — simple assignments/project refs, department goals, KPI weightages, periodic appraisals and recommendations.
8. **Training & Development** — programs, assignment, attendance/completion, skills and assessments.
9. **Reports & Analytics** — readonly 75 report blueprints, filters, reconciliation, source drilldown, PDF/Excel/Print.
10. **Administration & Settings** — organization/configuration, policy and approval engine, users/roles, audit, notifications, Scheduled Alerts.
11. **Help Desk Management** — HR, IT, Admin employee tickets, classification, routing, SLA, private issues, resolution and feedback.
12. **Travel Management** — official trip request, budget, itinerary, approval, advance, closure, staff pick-and-drop routes and transport eligibility.
13. **HR Letters Management** — offer/increment/confirmation/salary/experience/warning/custom templates, merge, approval, issue, archive.
14. **Expense Management** — travel/food/medical/fuel/client/other claims, receipts, financial review, approval, reimbursement and reconciliation.

**Scheduled Alerts** are cross-cutting, not core module 15. Their configuration belongs to Administration & Settings and outputs feed Notifications throughout the five portals.

## 5. System-wide policies, effective dates and approval routing (CRITICAL)

### 5.1 Super Admin policy builder

Must support draft/review/publish/retire, effective-from/to, name, category, precedence, company/department/team/role/employee target, exception permissions, parameters (days/minutes/amount/Pkr), reviewer grants, cumulative windows, calendar basis, reasons and version/audit. Read-only preview must explain why a policy applied and which rule wins. Authorized changes impact **future effective periods**, not locked historical payroll.

**Proposed precedence:** authorized employee-specific exception → scoped department/team → role/employment category → company default; conflict detection and deterministic tie-break required. No policy can undercut legal minimum rights.

### 5.2 Entitlement and approval authority are separate

A 2-day paid leave balance **is not** a Manager's right to approve any two requests. Track (a) leave accrual/entitlement/remaining, (b) per-request approval ceiling, (c) cumulative approved days by applicant + month + approver tier, (d) exception limit, (e) final paid/unpaid treatment.

**Illustrative configurable company rule, NOT Pakistani legal entitlement:** employee receives 2 eligible monthly leave days, Manager can approve up to 2 cumulative days/month; beyond that HR/Admin reviews, and beyond HR cap Super Admin. Requests split across multiple dates must **not** bypass cumulative cap. Half-days count fractionally. For Manager applicant, independent HR/Admin may approve within configured 2-day authority and higher goes to Super Admin. HR/Admin applicant goes to distinct authorized HR reviewer where available or Super Admin; no self review. Super Admin applicant requires an independently authorized company decision path when applicable.

| Applicant | Normal approval | Beyond authorized limit | Explicit safeguard |
|---|---|---|---|
| Employee | Assigned Team Lead (up to configured cap, e.g. 1-2 days) | Department Manager → HR/Admin → Super Admin | No split requests or self approval |
| Team Lead | Department Manager (configured cap) | HR/Admin → Super Admin | No self approval |
| Dept Manager | Independent HR/Admin (e.g. up to 2 days) | Super Admin | Manager never approves own leave |
| HR/Admin | Another authorized reviewer if configured; otherwise Super Admin | Super Admin | No same-account reviewer |
| Super Admin | Independent governing authority if present | Defined organization governance path | Never invent auto self approval |

Leave flow: Submit → resolve workdays/holidays and overlapping leave → resolve policy effective date + accrual → resolve reviewer authority + cumulative ledger → route/approve/reject/escalate → journal leave movement once → attendance reconciliation → payroll treatment → notifications/audit.

### 5.3 Attendance rules

Super Admin controls shift/grace, permitted monthly lates (example 4), early-exit and half-day thresholds, absence classification, overtime eligibility/rates, exception authority. Store **late count and late minutes separately**. 5th late after four allowed is reviewable exception, **not automatically a monetary fine**. Valid field duty must not be classified as unapproved early exit. Preserve raw punches, approved corrections, reason/actor/timestamp. Payroll may only consume finalized attendance snapshots. Overnight shifts, time zone, overlapping punch/break windows, WFH and holidays must be tested.

### 5.4 Salary increment/decrement and promotion

Manager records evidence-based review/recommendation → HR/Admin drafts a proposal with employee, current pay, proposed pay, percent/delta, effective date, justification, performance period/evidence → Super Admin approves, rejects or returns → approved effective-dated compensation history updates future payroll → employee sees authorized outcome → salary revision register. Manager cannot directly approve a pay change. Salary decrement requires contract/legal policy review and necessary notices; never triggered automatically by low KPI.

### 5.5 Benefits and allowances

Super Admin defines employee/Manager/HR eligibility, amount/rate, fixed/variable, monthly/one-time, taxable treatment, effective dates, employer/employee portion and approving ceilings. HR proposes assignments; configured authority approves. Fuel allowance, travel advance, reimbursable fuel expense and pick/drop benefit must be **separate** and no double counting.

### 5.6 Other approval rules

| Process | Request / verification | Default final authority |
|---|---|---|
| Missed punch / WFH / field duty | Employee → Manager | Manager within limit; HR exception; SA above cap |
| Overtime | Employee/Manager → Manager verifies | Authorized reviewer within time/value policy |
| Commission | Sales source → Manager evidence → HR/Finance | Configured payroll approver |
| Loan / advance / bonus | Employee/Manager → HR validates | Authorized management/SA threshold |
| Travel | Employee → Manager → HR/Finance budget | Configured limit/SA exceptional |
| Pick-and-drop | Employee/HR → transport verification | Authorized eligibility approver |
| Expense claim | Employee receipt → Manager → Finance | Expense category/amount delegated approval |
| Help Desk | Employee creates → HR/IT/Admin assigned queue | Resolver or escalation owner |
| HR letter | Request → HR draft → approved signatory | Authorized issuer, immutable issued copy |
| Payroll | HR prepares → reviewer verifies | Authorized final approval → payment recording |

**Rules cannot be bypassed by API, URL, multiple split requests, impersonation or simultaneous approvals.** Approver identity, effective policy version, amount/days, cumulative counters and decision reason are preserved. Notifications alone are not approvals.

## 6. Module-by-module processes and acceptance criteria

### M01 Dashboard
Role-specific landing with action-needed, attendance, payroll state, assigned team/own activity and readable KPI cards. Data derived from canonical services. No manufactured success states, empty/degraded states handled. **Acceptance:** five portals have different scope; totals reconcile; no confidential salary leakage.

### M02 Employee Management
Company/department/team/designation masters; employee profile and IDs; reporting structure with circular manager prevention; status/probation/work type/pay plan selection; optional masked banking info with secure change approval; effective-date transfers; employee portal account separate. **Acceptance:** assignments respect org relations and effective dates; no hard deletion of staff with historical records.

### M03 Recruitment & Onboarding
Vacancy approval → candidates → screening/shortlist → interview evaluation → selection → offer draft/approval → accepted offer → **one** employee master → probation/confirmation → exit record if applicable. Letter issuance via M13 can reference offer. **Acceptance:** no double joining; candidate history survives; candidate is not automatically a privileged portal user.

### M04 Attendance & Shifts
Create schedule (office/remote/hybrid/field; fixed/flexible/overnight) → punch/break/field visit/timesheet → validate overlap and eligibility → exception inbox → reviewer decision → locked payable-time summary. Sales team can record field client visits and their approved intervals count toward work instead of false absence. **Acceptance:** raw vs corrected punch traceable; no duplicate hours; holidays applied; no silent late fines.

### M05 Leave Management
Define leave types + effective policy/accrual → Employee/Manager/HR request → accurate workday count → cumulative approval limit → independent routed approver → paid/unpaid decision → leave ledger + attendance → payroll. **Acceptance:** split/overlap prevention; Manager leave to HR; HR own leave to independent role; quota ≠ authorization; day/half-day counters correct.

### M06 Payroll, Compensation & Benefits
Monthly; monthly + commission; hourly; part-time; project/milestone. Attendance/time + leave + overtime + plan + approved commission/allowance/bonus − authorized deductions/tax/loan → draft → exception check → review → approval/lock → bank/cash payment register → payslip. Tax year and applicable salary withholding configured with effective versions; employee bank/wallet account effective dated, verified and masked. Loans/advances track principal, disbursement, repayments, current outstanding. Commission on qualifying booked/invoiced/collected basis, configurable percentage/fixed/slab, partial collection and refund reversal; posted once. Salary revisions via HR proposal → Super Admin approval. **Acceptance:** decimal-safe amounts; gross/net/payout reconcile, tax is withheld liability, loan disbursement not payroll expense; finalized payslip immutable.

**Owner-Approved Payroll & Leave Invariants (Batch 6B):**
1. **Fixed 31-Day Divisor**: Daily Basic Salary is strictly `Monthly Basic Salary / 31` across all calendar months (January, February, April, etc.). Full monthly salary is preserved for fully eligible employees in all months.
2. **Monthly Leave Policy**: First 2 company-allowed leave days per calendar month incur ZERO salary deduction (PKR 0). Starting from the 3rd eligible leave day, deduct exactly PKR 500 per additional leave day (`ExtraLeaveDeduction = max(0, leaveDays - 2) * 500`) without applying basic salary daily rate deduction.
3. **Structured Negative Salary Accounting**: Deficits where deductions exceed earnings are recorded via dedicated `SalaryLiability` ledger (`salary_liabilities`) and `payroll_entries.unrecoveredLiability` rather than informal string hacks.
4. **Disbursement Integrity**: Requires explicit `transactionReference`, `paymentMethod`, non-future `paymentDate`, snapshots `disbursedById`/`disbursedAt`, creates `AuditLog`, and blocks duplicate disbursements with `400 ALREADY_DISBURSED`.

### M07 Tasks & Performance Management
Manager assigns task linked to project/client reference → To Do/In Progress/In Review/Completed; feedback and deadline history. Department-specific KPIs: Development quality/delivery, Sales qualified collections/targets, Media approval/revision, HR process performance, Finance accuracy, Management objectives. Appraisal period → employee input → Manager evidence → HR review → bonus/increment recommendation only. **Acceptance:** employee sees own tasks, Manager sees scoped team, low score cannot auto-change pay; task completion does not auto-release project pay.

### M08 Training & Development
Training catalog/learning plan → eligible employee assignment → session/course attendance → outcomes/assessments → completion/certificate reference → development review. **Acceptance:** assigned vs completed accurate and limited to proper scope.

### M09 Reports & Analytics
Readonly report center, reusable table/filter/export shell, role-scoped data, no graph/chart of any kind; report catalog in §8. **Acceptance:** filtered screen = PDF/Excel = source ledger; branded exports work; source references link to permissioned details.

### M10 Administration & Settings
Company settings; policy builder with versioning and approval tier limits; role/permission grants; effective holiday/shift, tax/allowance masters; audit; notifications and Scheduled Alerts scheduler config. **Acceptance:** new rule applies on effective date; old period remains; no unauthorized edit/self approval; alert dedup.

### M11 Help Desk Management
Employee opens HR/IT/Admin ticket (summary, category, priority, attachments, confidentiality) → policy-scoped queue + assignee + SLA first response/due date → replies/escalation → resolution → employee feedback/reopen. Sensitive HR tickets restricted to selected handlers, not every Manager. **Acceptance:** SLA correctly pauses/resumes where configured; no cross-team confidential access.

### M12 Travel Management (including Pick & Drop)
Employee official trip request → purpose/destination/itinerary/estimated budget → Manager → HR/Finance → final cap approver → approved travel → optional advance → actual claim links to M14 → trip settlement/closure. Pick/drop: route, driver/vendor/vehicle, stop/time/capacity, employee request, eligibility, assignment, subsidy or employee contribution and effective dates. **Acceptance:** overlapping route capacity avoided; contribution feeds payroll only if authorized; advance not expense; address visibility restricted.

### M13 HR Letters Management
Approved template/version → request for offer/appointment/increment/confirmation/salary certificate/experience/warning/custom letter → validate authority + source event → merge approved fields → preview → authorized signer/issuer → finalized PDF/history → own employee download. **Acceptance:** issued letter never silently rewrites compensation/role; after issue versions and reissue/supersession auditable.

### M14 Expense Management
Employee claim with expense category, line items and receipt → Manager relevance → HR/Finance policy/duplicate verification → authorized amount approval → reimbursement payment recording → link to official trip/advance if applicable → report. Food, medical, fuel, client visit, travel and custom expense categories configurable. **Acceptance:** reimbursed once; approved claim and paid amount distinct; expense claim vs allowance separate; duplicate receipt control.

### X01 Scheduled Alerts (cross-module)
Configurable birthdays/anniversaries, leave/absence, contract/probation expiry, shift/approval deadlines, payroll dates, training, ticket SLA, trip return, letters due; Super Admin controls rule, HR manages authorized schedules. Schedule record = source event + due time/timezone + audience + channel + dedup + enabled + retry/error state. In-app primary, email optional if configured and verified. **Acceptance:** no fake sent status; no duplicate sends; alert is never approval or posting action.

## 7. Cross-module source-of-truth and finance mapping

| Source event | Authoritative module | Read consumers |
|---|---|---|
| Employee/team/manager + effective terms | Employee | all scoped modules |
| Approved offer/confirmed joining | Recruitment | Employee, letters, onboarding reports |
| Raw/approved punches, field time | Attendance | Leave, Payroll, team status, reports |
| Approved leave entitlement/usage | Leave | Attendance, Payroll, alerts |
| Commission eligibility/reversal | Payroll/commission subledger | Payroll, employee, reports |
| Performance review, KPI evidence | Tasks/Performance | HR proposal, career history |
| Salary revision approval | Compensation | future payroll, letters, reports |
| Paid salary / withheld tax | Payroll and payment register | bank advice, statutory summaries, reports |
| Help Desk ticket status | Help Desk | SLA alerts, reports |
| Approved travel/advance | Travel | expenses, transport, settlement |
| Approved expenses/paid reimbursement | Expense | travel settlement, reports |
| Final issued letter | HR Letters | employee self-service/history |
| Alert schedule/delivery state | Administration/Alerts | notification center, audit |

**Accounting examples:** net payable = gross − authorized deductions − tax withholding; tax withheld is a payable, not an additional expense above gross. Loan principal due = opening + disbursed − recovered − other approved adjustments; loan disbursement is not wage expense. Expense reimbursement payable = approved eligible claims − recorded paid reimbursements. Travel advance unsettled = issued − applied eligible claims − returned. Revenue/collections distinct from salesperson commission.

## 8. Reports & Analytics: required accountant-style catalog

All report views are **read-only**, charts/graphs/sparklines forbidden. Every report uses role/team/employee/period/status filters, generated-by/time metadata, explicit columns, reconciled subtotals/totals, confidential masking, downloadable PDF/XLSX and Print. The following catalog is the build target, organized into 12 navigable report families (implemented in F14 under canonical identifiers `RPT-ORG-001` through `RPT-SEC-004`) rather than 75 sidebar entries. Additional policy-control registers requested in v4 are included under their families.

### 8.1 Workforce & organization

1. **Workforce Master Register:** Employee ID, name, department/team, designation, manager, relationship, work location, join/effective status.
2. **Department & Team Headcount:** department, team, active/probation/inactive, on-site/WFH/field, manager; sums to company total.
3. **Employee Assignment / Transfer History:** effective date, old/new department/manager/designation, reason, actor/approver.
4. **Probation / Contract Expiry Due:** join date, contract dates, review owner, due period, decision, status.
5. **Employee Banking Verification:** bank/method, masked account/IBAN, holder, verification status, effective date, actor.
6. **New Joinings & Separations:** employee, vacancy/source, joining/last day, authorized status.

### 8.2 Recruitment & onboarding

7. Vacancy Register (approved openings vs filled/remaining, cost center).
8. Candidate Pipeline (stage/status, recruiter, time in stage, duplicate prevention).
9. Interview Schedule & Outcome (interviewer, slot, decision, source candidate).
10. Offer/Acceptance Register (approved offer vs accepted/joined).
11. Onboarding & Probation Review (joined, due, confirmation/extension and approver).

### 8.3 Attendance, shifts & work hours

12. Daily Attendance Register (employee, schedule, in/out, hours, breaks, late/early, status).
13. Monthly Attendance Summary (scheduled/present/paid/unpaid/absent/half days).
14. Late Occurrence & Grace Utilization (minutes, 1/4 example, policy version, exception).
15. Early Exit & Half-Day Exceptions (approved short hours vs unauthorized).
16. WFH / Hybrid Register (scheduled day, check-in, validation and approval).
17. Field/Client Duty Register (client ref, duty intervals, verifier, payable duration).
18. Overtime Request & Pay Eligibility (proposed/verified/approved hours, rate and payroll link).
19. Missed Punch / Correction Audit (raw/corrected punch, reason, reviewer, time).
20. Shift Roster & Variance (planned/actual roster, shift exceptions).
21. Timesheet & Project Hour Register (employee, project, rate basis, approved hours).

### 8.4 Leave & approval governance

22. Employee Leave Balance Ledger (opening, accrued, used, adjusted, closing).
23. Leave Request Status Register (request, type, workdays, applicant role, outcome).
24. Leave Entitlement vs Utilization (monthly/yearly and paid/unpaid classification).
25. Manager vs HR Leave Approval Capacity (per request + cumulative period usage).
26. Escalated / Above-Limit Leave Exceptions (who escalated, thresholds, final authority).
27. Leave/Attendance Overlap Audit (duplicate/holiday/shift conflicts).
28. Approval Aging / SLA Register (pending reviewer, due, age, policy tier).

### 8.5 Payroll, employee pay and banking

29. Payroll Summary Register (base, overtime, commission, allowance, bonus, gross, tax, other deductions, net).
30. Employee Payslip Breakdown (per item, policy version, period, approved run).
31. Payroll Exception & Reconciliation (draft/final, missing authorizations, duplicate flags, adjustment).
32. Salary Payment Register (bank/method, masked account, batch, payable, paid, failed, outstanding).
33. Salary Cost by Department / Employee Type (approved gross vs planned/budgeted where configured).
34. Salary Increment & Decrement Register (old/new, %, reason, review period, proposer, SA approval, effective date).
35. Career Movement / Promotion Register (designation/role changes and effective approvals).
36. Outstanding Payroll Liability Rollforward (opening payable + approved − paid ± adjustments = closing).

### 8.6 Tax & salary statutory controls

37. Monthly Employee Salary Tax Withholding (taxable base, tax year, bracket/rule version, due, deducted).
38. Annual Employee Tax Summary (YTD taxable and withholding by pay period, corrections).
39. Withholding Payable / Remittance Ledger (opening + withheld + adjustments − remitted = closing).
40. Salary Tax Exception & Recalculation Audit (original vs approved correction with reference).
41. Employee Tax Certificate Register (employee/tax year, source pay runs, issued-by/version).

### 8.7 Commission, allowances, loans and benefits

42. Sales Target & Commission Statement (target, booked/invoiced/collected, eligible, rate, reversed, earned, paid).
43. Commission Qualification / Reversal Audit (deal/invoice/receipt ID, event, actor, plan snapshot, refund).
44. Allowance & Bonus Register (category, eligibility, effective period, approved amount, payroll reference).
45. Recurring Benefits & Fuel/Transport Eligibility (assigned allowance vs pick-drop benefits, no duplicates).
46. Employee Loan Ledger (opening, disbursement, installments, paid/recovered, adjusted, closing).
47. Salary Advance Register (advance grant, deductions, outstanding, close date).
48. Loan Installment Schedule vs Payroll Recovery (due/recovered/remaining per period).

### 8.8 Tasks, KPI, development & training

49. Task Assignment & Completion (project, assignee, due, status, reviewer, approved close date).
50. Department Goals: Target vs Achieved (owner, period, evidence, variance).
51. Sales Performance & Collection KPIs (meetings, conversion, collections, targets, followup).
52. Development Delivery & QA Performance (milestones, deadlines, defects/rework, quality).
53. Media Delivery & Creative Quality (asset, approvals, revisions, turnaround).
54. Employee Appraisal / Rating History (period, weighting, evidence, manager/HR actions).
55. Training Enrollment & Completion (assigned, started, completed, outcome, expiry/assessment).
56. Training Effectiveness / Skills Register (competence, assessed gap, achieved progress).

### 8.9 Policy governance and attendance limits

57. Active Company Policy & Coverage Register (rule, version, effective, scope, approver).
58. Policy Change / Override Audit (old/new rule, reason, authorizing actor).
59. Leave / Late Threshold Usage by Reviewer (applicant count vs approver limit, no split bypass).
60. Exception & Delegation Register (temporary authority, justification, expiry and actor).
61. Overtime / Salary Revision Approval Audit (role, delegated limit, proposal and final decision).

### 8.10 Help Desk

62. Help Desk Ticket Register (ticket/category/priority/owner/status/create/close).
63. First Response / Resolution SLA Aging (due, elapsed business hours, breach/pause).
64. Help Desk Workload & Feedback (open/closed/reopened, service owner, customer feedback).

### 8.11 Travel, pick/drop and expenses

65. Travel Authorization Register (trip dates, destination, estimated/approved budget, approval status).
66. Travel Advance & Trip Settlement (advance issued, applied expenses, returned, outstanding).
67. Pick & Drop Route/Seat Roster (route/vehicle/driver, capacity, employee, start/end).
68. Transport Cost & Employee Contributions (route cost, company share, authorized payroll share).
69. Expense Claim Detail (claim/employee/receipts, requested/approved/denied, category).
70. Expense Reimbursement Register (approved vs paid/returned and outstanding).
71. Department/Project Expense Summary (claim category and linked trip, cost totals).

### 8.12 Letters, alerts and security

72. HR Letter Issue / Revision Register (template version, source event, employee, signatory, issued date).
73. HR Letter Request Aging (request, requester, approver, issued/return/rejected, turnaround).
74. Scheduled Alert Execution & Delivery Audit (event, version, due, recipient, queued/sent/failed/retry).
75. Security / Approval / Sensitive Export Audit (actor, action, original ref, before/after, report export filters/date).

**Report implementation rule:** a family can have many report types in a selector, but each report has an explicit column schema, data source and reconcile rule. If the PDF baseline has a separate named view not fully captured above, map it to the nearest family with a traceability note rather than silently omit it.

## 9. Reporting presentation and exports

- **Standard layout:** title + description → one compact filter row → summary amounts/counts → dense professional table → subtotal/grand total → PDF, Excel, Print. No operational mutation in reports.
- **PDF:** actual vector/text PDF, landscape for wide tables, iSysware branding, repeated headers, pagination, no clipped columns, filters and user/date metadata, amounts 2 decimals, confidential notice.
- **Excel:** valid `.xlsx`, navy header with white type, soft-blue alternate rows, merged report title when helpful, proper widths, header freeze, autofilter, aligned money, date formats, subtotals/total rows, print titles and print area when library permits; prevent formula injection.
- **Same source:** export and screen must use the same authorized filtered canonical dataset and final rounding; test identity of totals. No graphs in reporting screen, export or printed output.
- **Finance:** distinguish accrued/due vs approved vs paid; tax withheld is liability, not second salary expense; expenses vs allowances and advances separated; refunds/reversals keep original entry.

## 10. Financial policies and statutory guardrails

- Use PKR display and accurate decimal arithmetic; currency rounding rules are effective dated and source-snapshotted.
- Tax year/slabs/reliefs/exemptions and other statutory contributions are configurable and legally validated at implementation time. **No hardcoded 2026 rates based solely on stale examples.**
- Bank details: payment method, account title, bank/branch, masked account number, IBAN/wallet where relevant, verification and effective dates. Restrict sensitive details; keep salary payment instructions vs actual paid status distinct.
- Salary revision/compensation approval never rewrites historical posted pay runs. New corrections are approved adjustment/reversal events.
- Loan principal and travel advances are custody/receivable balances, not payroll expenses; expenses reimbursed once; approved commission in only one run.

## 11. Nonfunctional product acceptance

- UI: light blue/white, Inter, professional Font Awesome icons, shadcn/ui + Tailwind; keyboard-friendly, legible, responsive, high contrast.
- Security: deny by default, object-level and field-level RBAC, no self approval, secret/PII masking, audit, rate limits, safe uploads, session safeguards; frontend demo grants are **not** security.
- Reliability: consistent calculation services, idempotent posting, retry-safe alerts, backups and restore drills, migration control, no destructive actions without approval.
- Accessibility: clear form labels, logical focus and tab order, readable error/empty/loading states, touch targets, no reliance on color alone.
- Hosting: Namecheap Shared Hosting is desired, but PostgreSQL/Node/Prisma and scheduling production feasibility is a **deployment gate**, not a guarantee. See `trd.md`.

## 12. Module-level sign-off rule

Only one module per Antigravity implementation prompt after the foundation. Each module must include its role-specific screens, connected mock behavior, validation, regression tests, actual lint/build outcome, screenshots when possible, and unresolved issues. Do not start the next module until the owner sends its prompt. No GitHub push/commit/deployment without explicit permission. Backend only after full verified frontend; database integration after backend preparation; deployment last.

## 13. Requirements traceability and open verification points

- **Canonical functional scope:** v4 PDF; this PRD normalizes its concepts for implementation, **not** a code audit.
- **Final owner overrides:** JS not TS; Namecheap Shared not Vercel/serverless; navy/white light theme; Inter; Font Awesome; one module per prompt; owner-controlled Git/deploy.
- **Business defaults needing owner/legal confirmation before payroll production:** leave entitlement by category and applicable provincial law; manager/HR monthly caps; salary deduction formula; overtime rules; salary tax year; transport contribution eligibility; reimbursements/tax treatment; bank verification requirements.
- **Hosting verification:** exact shared plan, cPanel Node runtime availability, PostgreSQL version/location, external database connectivity, Prisma compatible version, scheduling limits, backup and confidentiality.

## 14. Batch 3.4 Comprehensive Frontend QA, Hierarchy & Verification Baseline

- **Portal Scope Verification:** All five portals (Super Admin, HR/Admin, Department Manager, Team Lead, Employee) are fully functional with dynamic role scoping, zero cross-portal leakages, and strict employee self-service data isolation.
- **Hierarchy & Succession Verification:** Company → Department → Optional Sub-department → Team → Employee hierarchy validated. Multi-team assignments and dynamic direct reporting filters operating correctly. Manager succession and deactivation enforce pre-transition checks, atomically transferring direct reports, managed teams, and pending requests across Leave, Attendance Corrections, WFH, Field Duty, and Overtime to designated active successors with immutable audit tracking.
- **Leave Management Regression:** Super Admin Leave Management crash resolved with complete `leaveService.getCalendarEvents(currentUser)` implementation. All 6 submodules (Overview, Queue, Balances, Calendar, History, Policy) verified with horizontal in-page tab navigation synchronized with sidebar and URL search params. Modal header cutoff permanently resolved with viewport-aware padding and height constraints.
- **Software-Wide KPI Cards Standardization:** Compact, modern card design standardized across all 14 modules matching owner-approved layout (`rounded-2xl`, subtle borders, 5-bar micro-sparkline SVGs in matching color palettes). Decorative arrows (`↗` / `↘`) permanently removed from cards across the entire application. Zero-chart rule strictly preserved in all 75 formal reports and exports.
- **75 Reports & Analytics Matrix:** Exactly 75 tabular reports across 12 families verified. Dual export engines (ExcelJS formatted workbooks + jsPDF landscape autoTables) operational with 0 embedded charts.
- **Automated Verification Status:** 356/356 automated unit and integration tests passing (100% pass rate). Static lint clean (0 errors). Vite production build successful (0 errors). Frontend baseline verified and ready for owner-led manual browser QA handoff.

## 15. Batch 3.5A & 3.5B Fresh QA Mode & Safe Reset Baseline

- **Option B (Fresh QA Baseline) Architecture:** Explicitly configured mode allowing owner to conduct full manual QA from a pristine organizational baseline while strictly safeguarding administrative accounts (`EMP-001` Super Admin Alexander Wright / Tariq Mehmood and `EMP-002` HR Admin Ayesha Khan) and system definitions.
- **76 Storage Keys Categorization:** Full inventory classifying all 76 localStorage keys into:
  1. *Protected Identities (6 keys):* User accounts, active session, role change history, canonical employee profiles, bank details, and career history for protected accounts `EMP-001` and `EMP-002`.
  2. *Preserved System Definitions (13 keys):* Company profile, RBAC permissions, central policies, approval rules, attendance policies, expense categories/limits, letter templates, holidays, alert rules, helpdesk setup, and allowance masters.
  3. *Reset Organization Masters (7 keys):* Departments, sub-departments, teams, designations, multi-team assignments, team assignment history, succession history reset to empty arrays (`[]`).
  4. *Reset Operational Transactions (50 keys):* Recruitment, attendance punches/corrections/requests, leaves, payroll runs/payslips, salary structures/revisions, loans, commissions, tasks, performance reviews, training, tickets, travel/transport, issued letters, expense claims, notifications, and general audits reset to empty arrays (`[]`).
- **Single Canonical Reset Engine:** `freshQAModeService.js` is the sole engine for inventory, preflight previews, backup generation, and reset execution. Ad-hoc browser scripts are removed. The UI in Super Admin Settings (`/super-admin/settings?tab=qa_reset`) directly executes this canonical service.
- **Unclassified Key Guard:** Storage keys starting with `isysware_hrms_` not in the 76-key registry automatically block reset execution until manually classified and reviewed.
- **Mandatory Pre-Reset Backup Gate:** Reset execution is strictly gated behind a mandatory lossless JSON backup download (`isysware_hrms_fresh_qa_backup_timestamp`).
- **Anti-Reseeding Persistence:** In-place empty arrays (`'[]'`) evaluated by service `_getItem(key, null)` guarantee that JavaScript truthy empty arrays (`![] === false`) permanently block automatic re-seeding of demo data on browser refresh or navigation.
- **Identity Link Integrity:** Protected admin accounts retain valid employee profile links in `isysware_hrms_f02_employees_v1` ensuring administrative identity, initials, designations, and audit trails remain continuous even when regular staff tables are empty.
- **Stale Account Purging:** Demo accounts mapped to deleted regular employees (`EMP-003` Manager, `EMP-005` Team Lead, `EMP-004` Employee, `EMP-016` QA Employee) are pruned from user accounts until newly created employees are assigned leadership or portal access.
- **Confidentiality & Backup Safeguards:** Automated exportable backup with sensitive data masking (IBAN, bank account numbers, CNIC, and passwords masked). Lossless backup and dry-run validation engine built into `freshQAModeService.js`. Credentials and banking values are never displayed in the UI.
- **Strict Execution Guard:** Zero automated reset or data deletion. Reset is strictly disabled by default (`dryRun: true`) and requires explicit owner token `CONFIRM_RESET_FRESH_QA_MODE_2026` to execute live.
- **Automated Preflight Suite:** 17/17 focused preflight tests and 373/373 full regression tests passing across 27 test files. Lint clean (0 errors), Vite production build passing.

**Reference links (external official):** https://ui.shadcn.com/docs/javascript | https://docs.fontawesome.com/web/use-with/react/ | https://www.postgresql.org/ | https://www.prisma.io/docs/ | https://www.namecheap.com/support/knowledgebase/article.aspx/10047/2182/how-to-work-with-nodejs-app/ | https://flowhcm.com/ | https://www.paypeople.pk/ | https://decibel360cloud.com/ | https://etimetrax.com/ | https://smarthcm.cloud/
