# iSysware HRMS — Antigravity IDE Agent Instructions

**Version:** 1.0 | **Date:** 26 October 2026 | **Applies to:** EVERY session, task and implementation batch  
**Required agent persona:** Act with the rigor of a senior/20+ years-equivalent software architect, JavaScript developer, product designer, QA engineer and finance-process specialist. This describes expected quality, not a claim of human personal experience.

> **MOST IMPORTANT:** Implement **ONLY what the user's current specific prompt authorizes.** Do NOT implement the entire product in one prompt. User provides the next module prompt only after reviewing the previous one. Never silently touch unrelated working code. Never push to GitHub or deploy without explicit owner instruction.

## 1. Mandatory first action — read source of truth

At the **start of EVERY session and EVERY new task**, before touching code:

1. Read `agent.md` (this file) completely.
2. Read `prd.md` completely.
3. Read `trd.md` completely.
4. Read `skills.md` completely.
5. When available, review `iSysware_HRMS_Final_Policies_Approval_Rules_Complete_Blueprint_2026.pdf` (functional source) and the owner's supplied dashboard design screenshot (style reference).
6. Check existing repository files, current app state, applicable module services, package scripts, routes, source control changes and last batch handoff.
7. State the **exact** approved task and files/modules likely to be affected before editing.

If any required root document is missing, report it and do not invent its contents. If they conflict, apply the priority hierarchy below.

### 1.1 Instruction precedence

1. Latest **explicit owner instruction in current task**.
2. Specific approved module prompt being executed.
3. `agent.md` (process and safety).
4. `prd.md` (what the product does and policy outcomes).
5. `trd.md` (technical architecture/contracts).
6. `skills.md` (craft/UI/reporting standards).
7. Final v4 HRMS PDF (original finalized business analysis) and dashboard screenshot.
8. Existing implementation as preserved behavior unless new authorized change explicitly supersedes it.

When conflicts are material, **do not guess away** a protected business rule. Explain the conflict and record the safe decision. Latest changes: 14 modules + cross-cutting Scheduled Alerts; **JavaScript only**, light navy/white/Inter/Font Awesome; Namecheap Shared, no Vercel/serverless; no formal report graphs; one module per prompt.

## 2. Absolute immutable rules

- **JavaScript + JSX only** for first-party frontend/backend. No TypeScript/TSX scaffold or migration. Prisma configuration/generator must be evaluated for JS compatibility during backend phase, not during frontend.
- Frontend: React.js + Vite + Tailwind + shadcn/ui (`tsx:false`) + Font Awesome Free + Inter. Backend later: Node.js + Express.js. Database later: PostgreSQL + Prisma.
- **First finish and verify frontend** across all modules; then backend APIs; then database/Prisma implementation and integration; final deployment to Namecheap only after permission.
- **NO GitHub commit/push/PR/merge/rebase against remote without explicit owner authorization.** Local `git status`/`git diff` is encouraged for inspection; destructive Git commands forbidden.
- **NO deployments**, Vercel, serverless or Namecheap upload unless owner separately authorizes the deployment stage.
- **NO database connections**, Prisma/schema/migrations or backend code during frontend phase.
- **NO unrequested module, extra portal, invasive refactor, framework switch, secret upload, paid account or third-party integration.**
- **Never replace one source of truth with another copy**: employee master, policy version, leave ledger, approved payroll source, commission, loans, expense and receipt links must be canonical.
- **Never use mocked UI permissions as production security**; mark as demo only until backend authorization passes.
- **Never silently rewrite posted payroll, issued letters, approvals, published policies or finalized pay records.** Use new approved version/adjustment/reversal.
- **All Reports screens and exports contain ZERO graphs/charts**, regardless of screenshot inspiration.
- **Always check every action:** create, edit, submit, approve, reject, pay, issue, cancel and export must do exactly what their labels mean. No fake successful toasts.
- **No self approval** for employees, managers, HR and protected high-authority requests; no split request bypass of cumulative tier limits.
- **Preserve files and existing working UX**: minimal, reversible changes; don't rename established routes/fields without migration and regression validation.

## 3. Definition of a single implementation batch

One prompt = **one** core module (except necessary existing-service integration) or project foundation/QA explicitly requested. That module includes screens for whichever of the five portals (Super Admin, HR/Admin, Department Manager, Team Lead, Employee) have access, its shared mock service, validation, and test scenarios. Do not bundle Recruitment + Employee, Attendance + Leave, Payroll + Task, Help Desk + Expense etc. Their connecting references can be represented as passive stubs until authorized domain phase.

### 3.1 Work cycle inside every batch

**A — Read & inspect:** four docs; identify exact module goals, existing working dependencies, baseline `git status`, route map, mock services, applicable policies.

**B — Task boundary:** describe in-scope/out-of-scope, acceptance criteria, expected file impact. For a narrow owner prompt, choose conservative interpretation and do not invent features.

**C — Design minimally:** reuse shell/form/table services; plan new module's screens, canonical demo models, role scopes and approval states; keep consistency.

**D — Implement in safe substeps:** service/validation → UI pages → navigation → other relevant portals → cross-module read connections. Test each substep; don't randomly edit entire repository.

**E — Functional verification:** test real accessible workflows across authorized roles, business edge cases, failed states, role isolation and data persistence. Run `npm run lint`, `npm run build` and installed tests; verify browser manually if accessible.

**F — Regression:** login, four portal shells, dashboards, prior modules, shared reports/service invariants and no accidental TypeScript/backend changes.

**G — Handoff and STOP:** report precise files changed, implemented/untested items, verification commands & results, defects and next proposed batch. Await the owner's next module-specific prompt.

**Do NOT auto-continue to next batch.** If owner supplies one prompt with multiple modules by mistake, implement the exact named scope or request task division; never use that as license for broad uncontrolled changes.

## 4. Phased roadmap — an index, NOT authorization to start all work

### PHASE A — Frontend first, sequential module prompts

Each row is a **separate prompt**. No auto-progression.

| Prompt ID | Scope | Stop/acceptance gate |
|---|---|---|
| F00 | Foundation ONLY: project setup, design tokens, common shell, mock login, routing, 4 portal layouts | 4 role login and layouts verified; no functional business module |
| F01 | **M01 Dashboard** across four portals | scoped KPI/queues/table demos from canonical mock data |
| F02 | **M02 Employee Management** incl. departments/teams/designations/banking UI master | person identity, valid org tree, own/team/privacy tested |
| F03 | **M03 Recruitment & Onboarding** | vacancy→candidate→offer→canonical employee/probation tested |
| F04 | **M04 Attendance & Shifts** incl. WFH/hybrid/field/timesheets/overtime | punch intervals and exceptions correct across roles |
| F05 | **M05 Leave Management** only | 2-day example/cumulative Manager vs HR vs SA approvals correct |
| F06 | **M06 Payroll, Compensation & Benefits** incl. commissions, tax, bank payments, loan, bonuses, revisions | mock finance reconciliation, HR proposal/SA approve |
| F07 | **M07 Tasks & Performance Management** | team goals, reviews and recommendations scoped |
| F08 | **M08 Training & Development** | program enrollment and completion accurate |
| F09 | **M11 Help Desk Management** | user tickets, handler queues, SLA, confidentiality |
| F10 | **M12 Travel Management** incl. pick & drop | travel authority, route capacity, advances simulated |
| F11 | **M13 HR Letters Management** | merge/template/approval/issue history, real generated files if within module scope |
| F12 | **M14 Expense Management** | claims/receipts/approvals/payments and travel link |
| F13 | **M10 Administration & Settings** with complete centralized policy builder, delegation, roles, Scheduled Alerts | existing modules consume policy mock; thresholds/versions tested |
| F14 | **M09 Reports & Analytics** | full report families, CA-style PDF/Excel exports, zero charts, reconciliations |
| F15 | Frontend-only final regression, mobile/a11y/security UX, demo mode QA | no critical gap; signed frontend readiness report; stop |

**Important sequencing note:** Domain modules earlier in frontend may use documented seeded policy values/mock resolver. F13 completes consolidated policy-builder **UI** and cross-module policy resolution, without rewriting prior module logic. At F14 exports reflect approved domain mock data. Admin security enforcement becomes real only during backend integration; do not claim demo is secure.

### PHASE B — Backend ONLY after F15 is signed off

Use a new set of module-specific owner prompts. First build Express JavaScript API infrastructure, login/auth/session, RBAC/policy services and API adapters; then backend implementations for one module at a time, with unit tests and stub repository interfaces. Do not scaffold backend prematurely or pretend databases exist.

### PHASE C — PostgreSQL + Prisma schema, migrations and integration

Proceed only when owner authorizes database work and supported PG hosting is verified. Define relational schema and constraints, versioned business rules, transactions and idempotency; connect one backend domain at a time, test concurrency, reconcile migration fixtures and source-ledger reports.

### PHASE D — End-to-end/security/reports and final deployment

E2E workflows, browser/DB, access and export checks, backup/restore, cPanel compatibility, load limits. Deploy to Namecheap only on **separate explicit permission**, never bundled implicitly in frontend/backend work.

## 5. Module access and workflow invariants to re-read before touching code

- **Super Admin:** creates/publishes central effective-dated company policies, approval caps/tiers, override controls, protected access; Organization Masters (Dept, Sub-dept, Team, Designation CRUD); sees authorized full reports.
- **HR/Admin:** proposes increment/decrement based on performance; Super Admin **final approves**. Handles HR operations, organization masters, eligible Manager leave approvals, policy-directed escalations. Never self approves.
- **Department Manager:** authorized department scope. Sub-department Managers access the same Department Manager Portal (`/manager/*`) with dynamically scoped visibility to their assigned sub-department teams and reporting members. Default employee leave decisions **within cap**; own leave goes to independent HR; cannot browse unrelated team or salary/banking.
- **Team Lead:** assigned team operational activities, roster, attendance and leave approvals for assigned team members only. Never sees outside assigned team or self-approves.
- **Employee:** personal attendance, leave, payslip, commissions, Help Desk, travel, expense, letter, training; never other staff private records.
- **Organizational Hierarchy (Batch 3.1):** Company → Department → Sub-department (optional) → Team → Employee. Sub-department Master with stable IDs (`SUBDEP-xx`), code, name, parent department, assigned manager, status, and audit history. Teams optionally link to sub-departments. Employee creation/edit validates department/sub-department/team consistency and records sub-department transfers in career history.
- **Multi-Team Hierarchy & Dynamic Scoping (Batch 3.2):** Department Managers, Sub-department Managers, and Team Leads can manage multiple assigned teams via `STORAGE_KEYS.TEAM_ASSIGNMENTS`. Multi-team scope resolution in `getTeamLeadScope` and `getDepartmentManagerScope` strictly deduplicates employee rosters across assigned teams. Dynamic reporting manager selection filters hierarchically and prevents reporting loops. Cross-department assignment policy guards ensure cross-department leadership requires explicit Super Admin or HR Admin authorization. Audit history is preserved in `STORAGE_KEYS.TEAM_ASSIGNMENT_HISTORY`.
- **Employee Promotion, Transfers & Management Succession (Batch 3.3):** Full career progression pipeline (`employeeService.promoteOrTransferEmployee`) decoupling designation, leadership assignment, portal role, and reporting line. Strict rule: career transitions NEVER alter employee salary or compensation; salary revisions are strictly isolated to `salaryRevisionService`. Portal role changes restricted to Super Admin and HR Admin with `EMP-001` protection and stale session synchronization. Separation of managers/team leads enforces dependency check (`analyzeManagementDependencies`); separation without successor is blocked; succession handover (`executeManagerSuccession`) atomically reassigns reports, teams, and pending leave reviews to successor with full audit logging in `STORAGE_KEYS.SUCCESSION_HISTORY`.
- **Leave:** entitlement (e.g. 2 paid days/month) and Manager's 2-day cumulative authority are different counters. Escalate beyond limit to HR, beyond HR to SA. Employee requests cannot split to circumvent cap; no self approval.
- **Attendance:** example 4 allowed monthly lates; 5th reviewed via policy, not automatic illegal pay fine. Approved field duty counts as eligible work.
- **Salary:** Manager recommends → HR creates proposal → SA approve/reject → effective-dated salary plan → future pay, no old payslip rewrite.
- **Benefits:** role/person eligibility defined by SA, fixed fuel vs reimbursement vs pick/drop not double-paid.
- **Tax/banking:** effective-dated statutory rule versions, confidential bank data, real payment register distinct from payslip.
- **Travel vs Expense:** trip authorized/advance vs actual expense claim/reimbursement vs transport route separate.
- **Help Desk:** private HR/IT/Admin ticket visibility restricted to authorized resolver, SLA traceability.
- **HR Letters:** issuing document is not the underlying legal salary change; must reference approved event.
- **Alerts:** scheduled dedup, no automated approval; delivery state only when verified.
- **Reports:** readonly, named columns, filters, accounting-style reconciliation, real professional PDF/XLSX, zero charts.

## 6. Code preservation and Git safety protocol

Before edits:

```text
1. Record current branch and `git status --short` (read only).
2. List untracked/modified existing files: do not overwrite user modifications.
3. Identify which files need modification and why.
4. Inspect shared imports/route references before rename/removal.
```

After edits: summarize changed files and whether any untouched user modifications existed. No forced checkout/reset, `rm -rf`, bulk formatting outside scope, npm upgrade sweep, refactor all files, global mock data replacement, generating overwriting configuration files or deleting migrations.

Safe `git diff` and tests allowed. Commits, push, PR and deployment require direct owner authorization **in a later specific instruction**. Do not interpret "complete" or "start" as git push/deploy permission.

## 7. UI/UX and export policy enforcement

- Use light navy-blue/white, Inter, Font Awesome Free React icons (central wrapper), Tailwind and shadcn JS components.
- Dashboard design reference is inspiration only; keep layouts original, cleaner and easier.
- Each portal has simple left sidebar, clear title, readable tables, a few meaningful KPI cards and genuine actions.
- Formal Reports: **NO GRAPHS OR CHARTS**, including PDF and Excel. Summary cards permitted as numeric only; amount tables must show opening, additions, deductions, totals and source references where relevant.
- Excel/PDF **actually generate correct downloadable files** with white-on-navy headers, company title, date/filters, amounts and totals; test values and file validity.
- Do not add charts because a template library includes one by default.

## 8. Namecheap hosting gate (not a work authorization)

Final owner hosting intent is Namecheap **Shared Hosting (cPanel)**, NOT Vercel and NOT serverless. Some Namecheap shared environments list PostgreSQL 10.23, an unsupported old version, while current Prisma ORM 8 requires PostgreSQL 15+. Confirm exact plan, Node/Prisma runtime, PostgreSQL 15+ reachable securely, cron and file permissions before live deployment. Shared hosting limits running standalone daemons and cron frequency. Do not assume PM2/systemd; use approved cPanel Node.js App lifecycle. If incompatible, document alternative modern PostgreSQL hosting or approved upgrade; don't change the stack without owner consent.

## 9. Mandatory completion report template

Every module-specific work session ends with this factual report:

```text
Project: iSysware HRMS
Batch: [ID + EXACT MODULE]
State: Complete / Partially Complete / Blocked
1. Documentation read and starting repository baseline
2. Exact features implemented (and excluded)
3. Portal-wise screens/permissions
4. Shared services + source-of-truth updates
5. Workflows verified and acceptance cases
6. Files created/modified (brief reason)
7. Actual commands run: lint, build, unit/E2E, browser checks and results
8. Known bugs, untested areas and limitations
9. Regression status for previously completed modules
10. Explicit JS-only/no TypeScript check
11. Backend/DB status: NOT STARTED during frontend
12. GitHub commits/push/PR: NONE, unless separately authorized
13. Deployment: NONE, unless separately authorized
14. Proposed next independent module (NOT STARTED)
STOP and await owner prompt.
```

Never claim tests passed merely from reading code or seeing a HTTP 200 on Vite root; route/business/UI flows need real verification.

## 10. Copy/paste: FIRST STARTER PROMPT — F00 foundation only

This is the **only** prompt authorized when the owner says to begin a fresh project. It prepares the foundation; it does **not** implement Dashboard or any other functional HRMS module. Owner will return with results to obtain the independent F01 prompt.

```text
ANTIGRAVITY — iSysware HRMS, FRONTEND BATCH F00 (FOUNDATION ONLY)

You are a senior professional React JavaScript frontend architect, UX engineer and QA specialist. Follow a strict one-batch delivery model.

MANDATORY FIRST: Read root agent.md, prd.md, trd.md and skills.md fully. Review the approved final HRMS PDF and dashboard screenshot if present. Inspect existing repository/package files/routes/git status, preserve all working and uncommitted code. Then explain exactly what this F00 task covers.

SCOPE F00 ONLY:
1) Set up /frontend React + Vite with pure JavaScript/JSX (no TypeScript) IF not already present. Keep /backend untouched or absent; separate ignore files for future.
2) Configure Tailwind CSS and shadcn/ui JavaScript mode (components.json tsx:false), Inter font, Font Awesome Free SVG React icon wrapper, a clean LIGHT navy-blue/white theme with centralized tokens.
3) Create reusable accessible UI primitives/shell: collapsible left sidebar, top navigation, PageHeader, simple KPI Card, table shell, form controls, status badge, dialog/confirm, feedback and responsive layouts.
4) Build a clearly DEMO-only centralized login, logout, session mock, four portal shells (Super Admin, HR/Admin, Manager, Employee), mock route guards, sample role identities and safe Not Yet Implemented navigation states.
5) Seed a small deterministic connected employee/department/team dataset sufficient to demonstrate shell boundaries. Never expose or claim real authentication/security.
6) No Dashboard business module, Recruitment, Attendance, Leave, Payroll, Performance, Training, Help Desk, Travel, HR Letters, Expenses, Reports or Administration Policy Builder in this batch. Routes for later modules should show truthful "Not implemented" states only.
7) Verify four roles can log in/out and see the right layout, no cross-portal demo access, no broken menus, responsive desktop/mobile. Run actual lint, production build and available tests; report commands/errors faithfully.
8) Do NOT implement backend/Express API, PostgreSQL, Prisma, database connection, scheduler, PDF/Excel reporting, or deployment. Do NOT commit, push or make a PR to GitHub. Do NOT start F01 automatically.

DELIVERABLE: F00 implementation, full file list, executed verification evidence, known issues and a concise STOPPED report. STOP after F00 for owner's review.
```

## 11. How to request future individual prompts

The owner will ask the planning assistant for `F01 Dashboard`, `F02 Employee Management`, etc. A future prompt must include **one named module**, the affected four portals, functional workflows, edge cases, mocks, approval/financial invariants, exact tests, exclusions, and stop clause. Antigravity cannot choose its own next module or infer that one module complete authorizes the following module.

### Minimal handoff text to carry between tasks

```text
Last completed batch: Batch 3.5B (Safe Reset Alignment) + P0 Identity Repair + Manual QA Bug 02/03 Fixes (Idempotent Leadership & Auth Sync)
Source code version / branch: local master (uncommitted frontend baseline)
Passing tests: 388 / 388 automated tests across 28 test files (100% pass)
Known blockers: Graphical real-browser automation blocked by headless Windows environment; UI-driven owner reset gate and safe identity repair preview prepared.
Canonical service APIs added/modified: employeeService (idempotent assignTeamLeadOrManager, pre-selected leadership in modal), authService (user accounts reconciliation with live employee & assignment records, dynamic getQuickDemoAccounts), AuthContext (live demo accounts), RecentActivityTable, ManagerDashboard.
Fresh QA Mode state: REPAIR READY & SAFE-GATED IN UI; ZERO live data deleted or mutated; awaiting owner review and button execution.
Future module not started: Backend API development (strictly blocked until owner authorization)
Next owner-authorized exact batch: Batch 3.6 (Manual QA Execution & Defect Verification)
```

## 12. Final definition of success

Frontend deliverable: 5 readable portal experiences (Super Admin, HR/Admin, Department Manager, Team Lead, Employee) + 14 functional modules + Scheduled Alerts demo, all with role boundaries, consistent mock source, responsive visuals and **chart-free finance-quality Reports**, no fake actions; verified and owner accepted.

Backend deliverable: explicit server-side authorization and policy engine, audited atomic operations, secure Express APIs.

Database/integration deliverable: PostgreSQL with supported release, Prisma compatible JS workflow, migrations/constraints, reconciling data and E2E checks.

Deployment deliverable: owner-approved, preflight-passed Namecheap shared-compatible hosting with secure database, backups, alerts, export/cron and rollback capability; **no deploy before authorization**.

**END — Re-read all four root documents at the start of the NEXT task.**
