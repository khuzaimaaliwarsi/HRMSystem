# iSysware HRMS — Backend Batch 6C APIs Documentation
## Recruitment, Tasks, Performance, Training, Expenses, Reports & Administration

---

## 1. Architectural Boundaries & Security Posture
Batch 6C completes the backend REST API foundation for the iSysware HRMS Enterprise Suite across the 5 corporate portals. Every endpoint enforces:
- Bearer JWT authentication & role-based access control (`SUPER_ADMIN`, `HR_ADMIN`, `DEPT_MANAGER`, `TEAM_LEAD`, `EMPLOYEE`).
- Server-side organizational scoping: Employees cannot inspect colleagues' tasks, appraisals, training transcripts, or travel claims; Managers are scoped to their departmental hierarchy.
- Strict Anti-Self-Approval: Requesters cannot approve their own requisitions, travel requests, expense claims, or appraisals.
- Financial Precision: Monetary values (salaries, budgets, advances, reimbursements) are maintained via PostgreSQL `DECIMAL(12, 2)` arithmetic.
- Audit Attribution: All critical transitions record immutable actor, timestamp, and snapshot data in `audit_logs`.

---

## 2. Recruitment & Onboarding Module (`/api/v1/recruitment`)
- **Job Requisitions**: Department Managers propose requisitions (`POST /requisitions`); Super Admin / HR Admin approves (`PATCH /requisitions/:id/review`). Anti-Self-Approval prevents requesters from approving their own requisitions.
- **Job Openings**: Published openings (`POST /openings`, `GET /openings`, `GET /openings/:id`).
- **Candidates**: Registered candidates remain distinct from employees (`POST /candidates`, `GET /candidates`, `GET /candidates/:id`).
- **Applications & Pipeline**: Applies candidates to open jobs (`POST /openings/:id/apply`, `PATCH /applications/:id/status`). Prevents duplicate applications with 409.
- **Interviews & 5-Point Evaluation**: Schedules interviews (`POST /applications/:id/interviews`) and collects technical, communication, and cultural fit scorecard ratings (`POST /interviews/:id/evaluate`).
- **Job Offers**: Formal offer creation (`POST /applications/:id/offers`), Super Admin approval (`PATCH /offers/:id/review`), candidate acceptance (`PATCH /offers/:id/accept`).
- **Canonical Employee Hiring Conversion (`POST /candidates/:id/hire`)**:
  - Explicit, authorized, and idempotent.
  - Generates canonical `Employee` record (`status: PROBATION`, probation timeline calculated).
  - Links `candidate.linkedEmployeeId` and `offer.linkedEmployeeId`. A candidate can never be converted twice (`409 ALREADY_CONVERTED`).
  - Automatically seeds `OnboardingChecklist` with 5 default onboarding tasks across categories (`DOCUMENTATION`, `IT_EQUIPMENT`, `WORKSPACE`, `ORIENTATION`, `BENEFITS`).
  - **Security Invariant**: Employee creation does NOT automatically generate portal user credentials. Portal user provisioning remains an explicit administrative step.

---

## 3. Task Management Module (`/api/v1/tasks`)
- **Task Assignment (`POST /tasks`)**: Assigns tasks with priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), due dates, and estimated hours.
- **Role Scoping (`GET /tasks`)**:
  - `EMPLOYEE`: sees only assigned tasks.
  - `TEAM_LEAD` / `DEPT_MANAGER`: sees departmental / team scope.
  - `SUPER_ADMIN` / `HR_ADMIN`: company-wide visibility.
- **Dynamic Overdue Detection**: Tasks past their deadline with `status != 'COMPLETED'` automatically compute `isOverdue: true`.
- **Completion & Hours**: Updating status to `COMPLETED` records `completedAt` timestamp and actual hours.
- **Comments & Activity (`POST /tasks/:id/comments`)**: Appends structured comments with author role and timestamp.
- **Productivity Metrics (`GET /tasks/stats`)**: Aggregate breakdown of TODO, IN_PROGRESS, COMPLETED, and OVERDUE tasks.

---

## 4. Performance Management Module (`/api/v1/performance`)
- **Appraisal Cycles (`POST /cycles`, `GET /cycles`)**: Review cycle windows with date validation.
- **Goals & KPIs (`POST /goals`, `PATCH /goals/:id/progress`)**: Objective tracking with weightages and target metrics.
- **Self-Appraisals (`POST /reviews/:id/self`)**: Employee inputs self-score and development areas.
- **Manager Evaluations (`POST /reviews/:id/manager-review`)**:
  - Anti-Self-Approval strictly blocks managers from evaluating their own review (`403 SELF_APPROVAL_PROHIBITED`).
  - Score Normalization: blends 30% self-appraisal + 70% manager evaluation.
  - Categorical Classification:
    * $\ge 4.5 \implies$ `OUTSTANDING`
    * $\ge 3.8 \implies$ `EXCEEDS_EXPECTATIONS`
    * $\ge 2.8 \implies$ `MEETS_EXPECTATIONS`
    * $\ge 2.0 \implies$ `NEEDS_IMPROVEMENT`
    * $< 2.0 \implies$ `UNSATISFACTORY`
  - Finalization Lock: Once finalized, appraisal status becomes `COMPLETED` and prevents further modification.

---

## 5. Training & Development Module (`/api/v1/training`)
- **Course Catalog (`POST /programs`, `GET /programs`, `GET /programs/:id`)**: Configures courses with max capacity, duration, and passing score.
- **Enrollment Governance (`POST /programs/:id/enroll`)**:
  - Capacity Enforcement: Blocks enrollment if program reached `maxCapacity` (`400 CAPACITY_REACHED`).
  - Duplicate Prevention: Prevents multiple active enrollments (`409 ALREADY_ENROLLED`).
  - Department Eligibility: Verifies departmental criteria when restricted.
- **Attendance & Sessions (`POST /enrollments/:id/attendance`)**: Records attended session count.
- **Assessment & Certification (`POST /enrollments/:id/assessment`)**:
  - Score $\ge$ passing score (default 70) marks `COMPLETED`, stamps `issuedAt`, and generates unique certificate sequence `CERT-YYYY-XXXX`.
  - Score $<$ passing score marks `FAILED`.
- **Transcripts (`GET /transcript/:employeeId`)**: Full employee training history, certificates, and cumulative learning hours.

---

## 6. Travel & Expense Management Module (`/api/v1/expenses`)
- **Official Travel Requests (`POST /travel/requests`, `PATCH /travel/requests/:id/review`)**:
  - Validates `departureDate <= returnDate` and `advanceAmount <= estimatedBudget`.
  - Enforces Anti-Self-Approval on travel authorization.
  - Attaches booking PNR references upon approval (`PATCH /travel/requests/:id/booking`).
- **Transport Passes (`POST /transport/passes`, `GET /transport/passes`)**: Pick-and-drop route allocation with duplicate active pass prevention.
- **Expense Claims (`POST /claims`)**:
  - Itemized line entries with exact Decimal summation.
  - Automatic advance settlement offsetting against linked travel request.
- **Claim Review vs Payment Disbursement Separation**:
  - `PATCH /claims/:id/review`: Manager/HR approval transitions status to `MANAGER_APPROVED` or `HR_APPROVED`. Approval is NOT payment!
  - `POST /claims/:id/disburse`: Authorized finance officer disburses reimbursement:
    * Requires `paymentMethod` (`BANK_TRANSFER`, `CHEQUE`, `CASH`).
    * Requires non-empty `transactionReference`.
    * Validates non-future `paymentDate <= today`.
    * Transitions status to `DISBURSED`, timestamps `disbursedAt`, persists `disbursedById`.
    * Creates permanent `AuditLog` entry.
    * Blocks duplicate reimbursements (`400 NOT_APPROVED`).

---

## 7. Reports & Analytics Backend (`/api/v1/reports`)
All metrics are derived in real-time from canonical PostgreSQL records:
1. `GET /headcount`: Total headcount, active, probation, notice, departed, and departmental distribution.
2. `GET /attendance`: Total records, present count, late arrivals, half-days, and punctuality rate.
3. `GET /leaves`: Total leave requests, approved days taken, pending and rejected counts.
4. `GET /overtime-remote`: Total approved overtime minutes/hours, WFH days, and field duty counts.
5. `GET /payroll/:periodCode?`: Confidential basic gross, tax withheld, deductions, and net pay. Strictly restricted to `SUPER_ADMIN` and `HR_ADMIN` (blocks lower roles with `403 FORBIDDEN` to prevent salary leakage).
6. `GET /recruitment`: Requisitions, open vacancies, total applications, interviews, offers, and hired counts.
7. `GET /tasks`: Total tasks, completed, in-progress, todo, overdue, and completion rate.
8. `GET /expenses`: Total expense claims, approved count, disbursed count, and cumulative reimbursed PKR amount.

---

## 8. Administration & Settings Module (`/api/v1/admin`)
- **Organization Settings (`GET /settings`, `PATCH /settings`, `PUT /settings`)**: Corporate profile (company name, NTN, support email/phone, currency, timezone, JSON settings).
- **Portal User Management (`GET /users`, `PATCH /users/:id/status`)**:
  - Protected Super Admin account (`isProtected = true`) cannot be deactivated (`403 PROTECTED_ADMIN_IMMUTABLE`).
  - System blocks deactivating the last remaining active Super Admin account (`400 LAST_SUPER_ADMIN_REQUIRED`).
- **Admin Password Reset (`POST /users/:id/reset-password`)**: Updates password hash using Argon2id, immediately terminates all active sessions in `sessions`, and records an audit log.
- **Security Audit Logs (`GET /audit-logs`)**: Paginated audit trail with date/module/actor filters. Never leaks raw password hashes or secrets in response payloads.

