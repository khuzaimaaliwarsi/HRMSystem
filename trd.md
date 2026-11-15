# iSysware HRMS — Technical Requirements Document (TRD)

**Version:** 1.0 | **Date:** 26 October 2026 | **Status:** approved target architecture; implementation staged  
**Primary inputs:** `prd.md`, final v4 HRMS PDF, owner's latest JavaScript/Namecheap UI choices.

## 1. Architecture decision record (locked)

| Concern | Approved direction |
|---|---|
| Stack | **PERN:** PostgreSQL, Express, React, Node.js |
| Code language | **JavaScript ES modules + JSX**; first-party application files `.js/.jsx`, never `.ts/.tsx` |
| Frontend | React + Vite, React Router, Tailwind CSS, shadcn/ui with `components.json` `"tsx": false` |
| Design | Inter font, light navy-blue/white design, Font Awesome Free React SVG icons |
| Backend | Dedicated non-serverless Node/Express app (NOT Vercel/Functions) with modular services/controllers |
| ORM | Prisma, **version validated with supported PostgreSQL and target Node runtime before backend phase** |
| Database | PostgreSQL (supported current release), relational/transactional source of truth |
| Hosting destination | **Namecheap Shared Hosting/cPanel**, subject to compatibility/security verification |
| Notifications | In-app + cron-triggered scheduled checks; no always-running custom daemon assumption |
| Files | Private document storage outside public webroot or approved secure storage, never accessible by guessed URL |
| Delivery | Documentation → frontend module-by-module with mock adapters → backend module-by-module → PostgreSQL & integration → QA → explicitly approved deployment |

**Critical compatibility:** Namecheap shared plans differ in PostgreSQL availability. Published server list currently shows PostgreSQL **10.23** for some plans; PostgreSQL 10 is EOL and unsuitable for private payroll. Prisma ORM 8 official matrix requires PostgreSQL **15+**, and currently offered Prisma setup can generate TypeScript configuration. Before database/backend work, verify exact app-friendly Prisma version / JS-only tooling and PostgreSQL 15+ (or later supported) access. Never auto-convert app to TypeScript. If requirements conflict, stop at deployment/backend gate with options; do not silently swap database or host. Official links at §16.

## 2. Runtime topology

```text
Browser (5 role-aware React portals: Super Admin, HR/Admin, Dept Manager, Team Lead, Employee)
  │ HTTPS + cookies / API
  ▼
Namecheap cPanel static frontend (React/Vite dist)
  │ /api via same-origin route or configured secure API subdomain
  ▼
Namecheap cPanel Setup Node.js App (Express; Passenger-managed where available)
  ├── Auth and role/object scope middleware
  ├── Modules / Policy engine / Business services
  ├── Prisma PostgreSQL connector (pooled connections where provider permits)
  ├── Authorized file access (private storage)
  └── Idempotent scheduled job endpoints/CLI triggered by cPanel Cron
                 │ TLS SQL
                 ▼
         Supported PostgreSQL 15+ host
```

No automatic assumption of PM2, systemd, Redis daemon, queues, persistent websocket process, or arbitrary native build rights on shared hosting. External modern Postgres hosting **may be necessary** and must be approved by the owner if the shared plan is unsuitable. Frontend can be developed locally without committing to a live database host.

## 3. Local source layout (proposed, adaptable to existing repo)

```text
iSysware-HRMS/
├── prd.md
├── trd.md
├── skills.md
├── agent.md
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                 # router/provider/guards
│   │   ├── components/ui/       # shadcn JS generated components
│   │   ├── components/common/   # tables, filters, inputs, badges, shell
│   │   ├── components/icons/    # consolidated Font Awesome icon wrapper
│   │   ├── layouts/            # five portal shells (Super Admin, HR/Admin, Manager, Team Lead, Employee)
│   │   ├── features/            # one module folder per domain
│   │   ├── services/            # front-end abstract interfaces
│   │   ├── mocks/               # deterministic seed + mock adapter
│   │   ├── styles/              # theme tokens, Inter font styling
│   │   └── lib/                 # money/date/errors/formatters
│   ├── jsconfig.json
│   ├── components.json          # "tsx": false
│   └── .gitignore
├── backend/                    # ONLY initialize during backend phase
│   ├── src/
│   │   ├── app.js              # Express app factory, no listen
│   │   ├── server.js           # cPanel compatible startup adapter
│   │   ├── modules/            # route/controller/service/repository/validation
│   │   ├── middleware/         # auth, permissions, rate limit, errors
│   │   ├── policies/           # policy resolution + approval routing
│   │   ├── jobs/               # repeat-safe scheduled job handlers
│   │   ├── lib/                # DB, money, time, storage, audit
│   │   └── config/
│   ├── prisma/                 # JS-compatible Prisma schema/migrations
│   ├── tests/
│   ├── .env.example            # placeholder-only, no real secrets
│   └── .gitignore
└── docs/                       # optional subordinate design notes, NOT extra owner-requested root docs
```

Root documentation filenames are exact and must not be renamed. Separate `frontend/` and `backend/` dependencies/ignores. Do not scaffold backend during frontend batches. Follow current working structure rather than destructive rewrite.

## 4. Frontend architecture

- React functional components, JavaScript/JSX with consistent naming; no app TypeScript compilation or `tsconfig`.
- React Router: centralized login; routes `/super-admin/*`, `/hr-admin/*`, `/manager/*` (serves Department Heads and Sub-department Managers with dynamic scoping), `/team-lead/*`, `/employee/*`; one identity may have additional authorized team-manager capabilities. Portal scope determined by session grants. Exactly five portals are preserved.
- Organizational Hierarchy (Batch 3.1): Company → Department → Sub-department (optional) → Team → Employee. Sub-department master CRUD, parent-department validation, dynamic team filtering, and career history tracking for sub-department transfers.
- Multi-Team Management & Dynamic Scoping (Batch 3.2): Canonical team assignment model (`isysware_hrms_f02_team_assignments_v1`) supporting one or many assigned teams per lead or manager. Dynamic scoping (`getScopedTeams`, `getTeamLeadScope`, `getDepartmentManagerScope`) with strict employee deduplication. Full audit tracking in `isysware_hrms_f02_team_assignment_history_v1`. Dynamic reporting manager resolution with hierarchy filtering, recommended manager badge, and anti-self-approval enforcement.
- Employee Promotion, Transfers & Management Succession (Batch 3.3): Promotion and transfer pipeline (`employeeService.promoteOrTransferEmployee`) decoupling job designations, leadership team assignments, portal access, and primary manager. Strict invariant that career movements never mutate compensation; salary revisions require independent proposals via `salaryRevisionService`. Controlled RBAC upgrades via `authService.updateUserRole` with `EMP-001` protection and stale session synchronization. Mandatory succession validation (`analyzeManagementDependencies`, `executeManagerSuccession`) blocks separation of managers/leads with unresolved dependencies, transferring direct reports, units, and pending approvals atomically to the successor with audit logging in `isysware_hrms_f02_succession_history_v1`.
- Navigation reflects privileges but **hidden links do not replace backend permission checks**.
- Data layer: `services/<module>Service.js` interface with mock implementation first. Later swap API adapter without rewriting screens; normalized canonical references (employeeId/teamId/policyId).
- Deterministic demo fixtures, local mock persistence for frontend only, documented Demo Mode and reset. Explicit timestamps, avoid random contradictory total badges. Record activity as mock only.
- Reusable UI design components: PageHeader, KPI Card, filter/search bar, DataTable, details drawer, form dialog, ConfirmDialog, status badge, summary strip, approval timeline, empty/loading/error states, printing/report shell.
- Form validation: required fields, enums, numeric range, decimal money, dates, duplicate records, effective dates, manager loops, cross-department team references, conflict messaging.
- Date/time display Pakistan office timezone per company config (default `Asia/Karachi`); store instants in UTC, use explicit business local date for monthly/attendance windows; do not infer date from client machine alone.
- Performance: route-level lazy load where useful, paginate/filter large tables, avoid heavyweight graph/chart libraries in reports, graceful narrow-screen scroll.

### UI and accessibility

- Light canvas, white surfaces, primary navy, readable contrast; Inter via approved font source with fallbacks (`Inter, ui-sans-serif, system-ui, sans-serif`).
- Font Awesome Free icon components through a central wrapper and selectively imported icons; don't mix random Lucide/Font Awesome across the product. shadcn/ui components are the accessible primitive layer, not a design theme to copy blindly.
- Buttons labelled, errors adjacent to inputs, keyboard focus visible, proper ARIA for modal tabs and menus; user-facing labels in clear English, Roman Urdu in documentation/examples where helpful.
- Formal reports **no graphs/pies/bars/sparklines**, dashboards compact KPI cards and useful tabular/action summaries.

## 5. Backend service contracts (future stage — not frontend prompt authorization)

**Layers:** Express Router → session/auth + policy/scope middleware → validation → domain service → Prisma repository → PostgreSQL transaction → audited event → notification outbox → safe response.

Modules grouped by domain: `auth`, `organization`, `employees`, `recruitment`, `attendance`, `leave`, `payroll`, `commission`, `benefits`, `loans`, `tasks`, `performance`, `training`, `helpdesk`, `travel`, `transport`, `expenses`, `hr-letters`, `policies`, `approvals`, `alerts`, `reports`, `audit`.

RESTful example routes (contracts to finalize in each dedicated backend batch):

| Verb/path | Purpose | Default role/scope |
|---|---|---|
| POST `/api/auth/login` | Create authenticated session | public throttled |
| GET `/api/me` | Own account/permissions, employee ID | authenticated |
| GET/POST `/api/employees` | list/create employees | HR/SA scoped |
| PATCH `/api/employees/:id` | controlled update, audit | HR/SA scoped |
| GET `/api/teams/:id/members` | assigned roster | scoped Manager/HR/SA |
| POST `/api/attendance/punches` | own raw check-in/out | employee/self |
| POST `/api/attendance/corrections` | original-preserving request | self/authorized |
| POST `/api/leaves/requests` | leave request | self |
| POST `/api/approvals/:requestId/decision` | approve/reject/return | independently authorized approver |
| POST `/api/payroll/runs` | draft from finalized sources | HR/Finance role |
| POST `/api/payroll/runs/:id/approve` | immutable approval | granted final approver |
| POST `/api/payroll/runs/:id/payments` | mark actual payments | finance permission |
| GET `/api/reports/:type` | read filtered canonical report | exact role + scope + sensitivity |
| GET `/api/reports/:type/export` | safe PDF/XLSX export | same auth/filters as read |
| POST `/api/helpdesk/tickets` | raise ticket | self |
| POST `/api/travel/requests` | official trip | self |
| POST `/api/expenses/claims` | claim/reimbursement | self |
| POST `/api/letters/requests` | request letter | self/HR |
| POST `/api/admin/policies/:id/publish` | policy effective version | Super Admin grant |

Response envelope (proposed): `{ success, data, meta, error }`; machine-readable error codes for validation/forbidden/conflict, no sensitive stack traces. Filtering and pagination consistent; `createdBy`, `approvedBy`, and `effectivePolicyVersionId` from authenticated server context, never trusted from client submission.

## 6. PostgreSQL conceptual relational model

Create migration-backed normalized tables with stable surrogate IDs (UUID or audited numeric sequences by entity), PK/FK/unique/check constraints and indexes. Actual Prisma models are a **backend/database-phase deliverable**, not required in frontend. Below is conceptual ERD inventory.

| Domain | Main tables / relationships |
|---|---|
| Identity | `users`, `user_roles`, `permissions`, `role_permissions`, `sessions`, `login_audit` |
| Organization | `companies`, `departments`, `sub_departments`, `teams`, `designations`, `employee_assignments`, `manager_links` |
| Employee | `employees`, `employment_terms`, `employee_contacts`, `employee_bank_accounts`, `employee_status_history` |
| Recruitment | `vacancies`, `candidates`, `applications`, `interviews`, `interview_reviews`, `offers`, `joining_events`, `probation_reviews`, `separations` |
| Policies | `policy_definitions`, `policy_versions`, `policy_assignments`, `approval_rules`, `approval_limits`, `delegations` |
| Approvals | `approval_requests`, `approval_steps`, `approval_decisions`, `approval_usage_counters`, `approval_audit` |
| Time | `shift_definitions`, `shift_assignments`, `holiday_calendars`, `attendance_punches`, `attendance_intervals`, `attendance_corrections`, `field_duties`, `timesheets`, `overtime_requests` |
| Leave | `leave_types`, `leave_entitlements`, `leave_requests`, `leave_ledger_entries`, `leave_balances_view` |
| Payroll | `compensation_plans`, `salary_revisions`, `pay_periods`, `payroll_runs`, `payroll_lines`, `payslips`, `payroll_payment_batches`, `payment_records` |
| Tax | `tax_years`, `tax_rule_versions`, `tax_calculation_snapshots`, `tax_withholding_entries`, `tax_remittance_entries`, `tax_certificates` |
| Variable benefits | `commission_plans`, `commission_qualifying_events`, `commission_ledger`, `allowance_definitions`, `employee_allowances`, `bonus_awards` |
| Loan | `employee_loans`, `loan_disbursements`, `loan_installment_schedules`, `loan_repayments`, `salary_advances` |
| Performance | `projects`, `tasks`, `task_history`, `department_kpis`, `employee_goals`, `reviews`, `recommendations` |
| Training | `training_programs`, `training_assignments`, `training_sessions`, `training_results` |
| Help Desk | `tickets`, `ticket_comments`, `ticket_assignments`, `ticket_sla_events`, `ticket_feedback` |
| Travel/transport | `travel_requests`, `travel_itineraries`, `travel_advances`, `trip_settlements`, `transport_routes`, `vehicles`, `route_stops`, `transport_assignments`, `transport_contributions` |
| Expense | `expense_claims`, `expense_claim_lines`, `receipts`, `expense_reviews`, `expense_payments` |
| Letters | `letter_templates`, `letter_template_versions`, `letter_requests`, `issued_letters`, `letter_files` |
| Alerts | `alert_rules`, `alert_rule_versions`, `alert_instances`, `alert_deliveries`, `notifications` |
| Control | `audit_events`, `attachments_metadata`, `export_audit`, `idempotency_keys`, `outbox_events` |

**Examples of essential foreign keys:** employees→teams/departments/manager links; payroll_lines→employee+pay_period+original approved source; leave_ledger→leave_request+employee+policy_version; commission_ledger→qualifying receipt/invoice; letter→approved business event and template version; expense_claim→employee & optional trip; trip_settlement→advance and eligible expenses.

**Sensitive data:** bank account title/full IBAN etc must be encrypted where appropriate, access-controlled, and masked in ordinary reports/logs. Never store passwords in cleartext; sessions hashed/revocable.

## 7. Versioned policy and approval engine design

### 7.1 Policy resolution

Input: `policyType`, requested action, employeeId, applicantRole, effectiveBusinessDate, department/team/designation, amount/duration, already-approved usage. Output: policyVersionId, entitlement, matching scope, reason for precedence, approver tier, permitted exception and legal hard-stop. **Evaluate at submission AND at decision** to prevent stale/counter-bypass; transaction/review invalidation required if policy changes while pending.

Precedence: authorized employee exception → team/department → employment/role category → company default; explicitly resolve ties. Preserve frozen `policy_version_id` on financial and approval events, with applicability validation.

### 7.2 Leave approval concurrency and split protection

- Separate **leave quota** from approver **max days/request** and **cumulative approved days in period**.
- Derive workday quantity from effective shift/holiday calendar; half-days count 0.5; exclude holidays where policy says.
- Validate overlap with pending and posted leave/field duty; avoid double usage.
- Acquire transaction lock or equivalent concurrency guard on `(employee_id, policy_type, period_key, approver_tier)` counter while deciding; insert decision and leave movement atomically.
- Multiple 1-day requests cannot evade e.g. Manager's 2-day cap. An exhausted reviewer must escalate; no negative balance unless authorized distinct exception policy.
- Manager leave → independent HR; HR own leave → distinct HR or SA; no self-decision, no same-person delegated self.
- Record applicant, submitted/countable days, paid/unpaid, approval actor/role, reasons, threshold, effective rule and timestamp.

### 7.3 Other policy engines

- Late occurrence counter (e.g. max 4/month) **not equal** total minute threshold; grace and actual late minutes separate.
- Overtime eligible only after approval (even if raw timesheet shows more hours); no duplicate pay component.
- Compensation revision HR proposal, SA approval with effective date; salary plan version snapshot.
- Delegation/time-limited authority must not permit granting Super Admin/root controls or self approval.
- Cash/benefit/expense caps use stable decimal money, currency and category and user/period group counters.
- Alerts evaluate effective rule/version and have `(source_event, recipient, channel, rule_version, scheduled_occurrence)` unique dedup key.

## 8. Financial calculations and transactions

- Monetary PostgreSQL `NUMERIC(18,2)` (or documented precision) and decimal-safe JavaScript library/integer-paisa boundary. Never compute payroll results with uncontrolled JS floating point.
- Pay plan = approved basic pay + allowed earnings − authorized adjustments; taxes/statutory according to **versioned validated rules**, not hardcoded assumed brackets.
- Monthly = approved salary with proration and attendance deductions if policy/legal; hourly = approved hours × hourly rate; project = accepted milestone × contract terms; mixed structures avoid twice counting same work.
- `gross = base + eligible overtime + eligible commission + allowance + bonus + other approved earnings` ; `net_payable = gross − tax_withheld − approved other deductions − loan installment − approved recovery`. Display employer contributions separately where applicable.
- Commission receipt eligibility differs from booking/invoice; returns/reversal refer to original earning entry, never delete.
- Approved payroll run locks pay item snapshots; payment attempt/failed/paid entries remain separate from approved payable. Retroactive correction = reversal/approved delta/arrears, no silent overwrite.
- Loan: `closing = opening + principal_disbursed − recovered ± authorized adjustment`.
- Withheld tax: `closing_tax_payable = opening + withheld + corrections − remitted`.
- Reimbursement: `outstanding = approved − paid`; advance and approved expense are distinct; apply trip advance under explicit settlement.

**Atomic transactions** needed for: leave decision+ledger; approval limit check+counter update; payroll post+source mark; commission qualifying posting; loan recovery+payroll line; trip settlement+expense/advance linkage; bank payment booking; alert idempotent queue. Unique composite keys for employee/period/component/source to prevent double posting.

## 9. Auth and authorization (server-side mandatory)

- Login with secure password hashing (Argon2id/bcrypt configured safely), secure opaque sessions or appropriately protected token strategy; HttpOnly/Secure/SameSite cookies where used; CSRF control for cookie session; audited logout/password reset.
- Enforce least privilege default deny and separate capabilities (`employees.read.self`, `.team`, `.all`, `payroll.prepare`, `payroll.approve`, `policy.publish`, `bank.view.full`, `report.export.financial`, `ticket.view.confidential`, etc.).
- Data scope must resolve on backend from staff+manager graph and employment dates, not frontend submitted department or route path.
- Field-level privacy and need-to-know on banking, tax, medical/leave reasons, payroll, ticket confidentiality, documents. Redact logs and audit exports.
- No employee/manager/HR self approval. Two-person financial approval where configured; important changes journaled immutable.
- Validate inputs with a schema library, rate-limit auth/sensitive mutation endpoints, content security/secure headers, enforce CORS origin carefully, upload antivirus/size/type and private storage path, safe error responses.
- Separate super admin bootstrap from ordinary employee creation; no implicit privileged account on new hire.
- Run access-control matrix tests for both listing and object ID tampering, exports and attachments.

## 10. Files, letters and audit history

- Store file metadata in PostgreSQL; binary contracts/HR letter PDFs/receipts in private storage with bounded file sizes and secure download checks. Avoid under `public_html` without protective controls.
- Issued letter: unique human-readable ref, template version, data snapshot, signer, approval, generated PDF hash, issue timestamp; reissue creates linked newer version and retains old archive.
- Audit event envelope: actual authenticated actor, role, source portal, source entity ID, action, before/after safe diff, reason, IP/user agent where appropriate, timestamp, approval version. Append-only for financially sensitive actions.
- Report exports sensitive audit: report type, filters, resulting role scope, row count, generatedBy, generatedAt, output hash if required.

## 11. Reporting technical specification

- Queries from canonical posted records; never derive salary from current `employees.salary` if a period's approved snapshot exists.
- Shared report registry defines `reportId`, columns, filters, scope policy, source service, group totals, reconciliations, formatters and export schema; use PRD §8 list.
- Always separate data authorization from presentation; single filtered dataset used by on-screen table, PDF, Excel and Print.
- Correct pagination and server-side aggregation for large data; totals based on **full filtered scope**, not only visible page.
- Finance reports: opening, additions/debit, reductions/credit, closing, variance, transaction source/ref and approved actor where relevant. CA-style but no unearned audited-statements claim.
- Excel XLSX: reputable maintained JS-compatible library (validate current support/licensing), merged title, navy white headers, alternate pale rows, grouped totals, freeze panes, autofilter, A4/landscape if supported, dates as dates, currency `#,##0.00`, safe text escaping against formulas.
- PDF: text-based, repeat header/footer, accurate width/pagination, no clipping, logo + title + filter metadata + totals, multi-page tables, font embedding where permitted, no graphs.
- Private reports (tax, loans, bank details, confidential tickets) require export permission and track download audit.
- **F14 Implementation Baseline:** All 75 reports across 12 report families implemented via canonical registry `reportRegistry.js` (`RPT-ORG-001` through `RPT-SEC-004`), data fetcher `reportDataFetcher.js`, facade `reportService.js`, Excel exporter `reportExcelExporter.js` (using `exceljs` ^4.4.0 with frozen panes at Row 8, AutoFilters, `#102746` navy header, `#F4F8FA` alternate rows, `#,##0.00` accounting formats, and grand totals), and PDF exporter `reportPdfExporter.js` (using `jspdf` ^4.2.1 and `jspdf-autotable` ^5.0.9 with multi-page repeated table headers, `Page X of Y` footers, auto portrait/landscape orientation, confidentiality watermark, and zero graphs/charts).

## 12. Notifications and scheduled jobs on shared hosting

- In-app alert state `scheduled → queued → sent / failed → retry / canceled` where outbound provider actually confirms delivery. Mock can only claim `demo` event; no fake email send.
- Use **Namecheap cPanel Cron Jobs** or approved external scheduler with idempotent short-lived tasks; public docs restrict cron intervals **under 5 minutes** and >5 simultaneous cron jobs. Design batching and daily/hourly checks accordingly.
- Do not run persistent custom daemon/worker in shared hosting; plan fallback/external worker only after user approval.
- Lock/dedup each due event and safely retry, log failures, skip canceled source events, honor timezone and quiet hours where configured.
- Scheduled reminders have no ability to auto-approve pay, leave or ticket closure.

## 13. Testing and quality gates

### For every FRONTEND-only module batch

- Read all four docs; inspect git status, routes, shared mock API/service, screens already working; record baseline.
- Implement only authorized domain; add role-specific UI and mock flows with realistic deterministic state and guarded menus.
- Test create/view/update/status flows, all 4 portal scopes, unauthorized link/ID behavior in mock, refresh, key edge cases, responsive UI and console warnings.
- Run existing `npm run lint`, `npm run build`, tests; state **exactly** what passed and what was not run. Restore functionality before next module; stop and report.

### Backend unit/integration and security

- Policy and approval matrix tests: 2-day leave, split 1+1+1, overlapping leave, half day, Manager own leave to HR, HR to independent SA, unauthorized grant, simultaneous requests.
- Attendance: late 1-5 with four allowed, grace, early exit, overnight shift, valid field visit, missed punch original/correction, overlapping intervals.
- Payroll: monthly/hourly/project/part-time, mid-month revision, commission partial/refund, overtime eligibility, leave deduction, loan once, tax year boundary, payment failure and reversal; posted snapshot immutable.
- Expenses/travel: duplicate receipt, advance applied+cash return, partial reimbursement, transport contribution and fuel allowance no double count.
- Reports: sum rows equals subtotal and statement total, export equals source filtered dataset, masked private data, print legibility, zero charts.
- Security: brute force, object ID tampering, field-level read, uploads, CSRF, access scope, independent approval; no secret exposures.
- Restore test: migration rollback/recovery, backup and point-in-time restoration availability, audit integrity.

**Deployment gate requires actual browser/HTTP/DB and export smoke tests on production-like environment**, not just `npm run build` locally.

## 14. Deployment to Namecheap Shared Hosting — PRE-FLIGHT ONLY until owner approval

1. Identify exact plan (Stellar/Stellar Plus/Stellar Business), cPanel environment, available Node versions, memory/CPU/entry processes, PostgreSQL options, external database TLS access, SSH, Cron Jobs, app root outside `public_html` and domain/subdomain configuration.
2. Verify current Node-supported Prisma version **and JS-only setup**. Prisma 8 requires PostgreSQL >=15. Do not use outdated PostgreSQL 10.23 for sensitive HRMS data; if only 10.23, obtain separate supported PostgreSQL instance or an approved hosting upgrade.
3. Confirm allowed database connection count/TLS, file storage/privacy limits, backup options, restore, SSL, dedicated secret management, cron retry architecture and database network connectivity.
4. Prepare separate environment config; build frontend locally/CI and upload static build to correct web folder; set Express cPanel Setup Node.js App with correct startup file and environment variables. Ensure no code or `.env` accidentally publicly accessible.
5. Restrict API CORS/CSRF, health endpoint, session cookies, HTTPS redirects, logging retention, blocked public access to backend source/employee attachments.
6. Run reviewed migrations on staging before production; database snapshots/backups before irreversible changes. No `prisma migrate dev` against production.
7. Test login all roles, leave approval counter, payroll exception scenario, tax, bank payments, expenses/letters, reporting exports, cron and failure retries with real server limits.
8. Rollback plan and monitoring/alerts; owner formally approves deployment only after documented preflight and verified data privacy.

**Do not deploy under any current frontend prompt.** If host/DB is incompatible, do not make unsupported changes such as replacing PostgreSQL with MySQL or moving to Vercel; present a documented solution requiring approval.

## 15. Environment & safe build notes

- `frontend/.env.example`: only public nonsecret values prefixed `VITE_`; never embed DB password or API secret in Vite bundle.
- `backend/.env.example`: placeholders for `DATABASE_URL`, session secret, CORS origin, storage keys, optional mail provider secrets. Secrets never committed.
- Prefer a supported stable Node LTS compatible with exact cPanel Node runtime and ORM version, **pin dependencies** and use lockfiles. Document version decisions at backend gate.
- Use Git locally for inspection/status only unless owner authorizes commits; absolutely no push/PR/deployment without owner permission.
- No silent mass upgrade, schema reset, deleting user data or auto-provisioning paid services.

## 16. Official references (checked 26 October 2026)

- shadcn/ui JavaScript: https://ui.shadcn.com/docs/javascript (set `tsx:false`).
- shadcn/ui Vite: https://ui.shadcn.com/docs/installation/vite (example docs often default to TS; adapt to JS explicitly).
- Font Awesome React: https://docs.fontawesome.com/web/use-with/react/ (free SVG icons and official React component).
- Prisma current docs: https://www.prisma.io/docs/ ; supported versions: https://www.prisma.io/docs/orm/supported-versions .
- PostgreSQL: https://www.postgresql.org/ .
- Namecheap cPanel Node apps: https://www.namecheap.com/support/knowledgebase/article.aspx/10047/2182/how-to-work-with-nodejs-app/ .
- Namecheap shared server versions: https://www.namecheap.com/support/knowledgebase/article.aspx/129/22/what-version-of-the-software-is-used-on-your-servers/ .
- Namecheap plan comparison: https://www.namecheap.com/support/knowledgebase/article.aspx/10112/22/shared-hosting-plans-comparison/ .
- Namecheap restrictions: https://www.namecheap.com/support/knowledgebase/article.aspx/157/22/do-you-have-any-server-resource-restrictions/ .
- Namecheap cron jobs: https://www.namecheap.com/support/knowledgebase/article.aspx/9453/29/how-to-run-scripts-via-cron-jobs/ .

## 17. Batch 3.4 Architecture & Verification Baseline

- **Verified Five-Portal Architecture:** PERN stack frontend baseline verified across Super Admin (`/super-admin/*`), HR / Admin (`/hr-admin/*`), Department Manager (`/manager/*`), Team Lead (`/team-lead/*`), and Employee (`/employee/*`).
- **Hierarchy Data Contracts:** Sub-department entity (`STORAGE_KEYS.SUB_DEPARTMENTS`) and multi-team assignments (`STORAGE_KEYS.TEAM_ASSIGNMENTS`) verified. Scope deduplication and circular reference guards operate across all services.
- **Cross-Module Approver Reassignment Contract:** `attendanceService.reassignPendingApprover` coordinates with `leaveService.reassignPendingApprover` to atomically redirect pending attendance adjustments (corrections, WFH, field duty, overtime) during succession without orphaned requests.
- **Service Layer Contracts:** `leaveService.getCalendarEvents` contract fulfilled, eliminating runtime mount crashes across leave portals. In-page submodule tab state synchronizes bidirectionally with URL query parameters and AppSidebar NavLink targets.
- **Unified Card System:** Reusable `KPICard.jsx` standardizes metric containers across all 14 modules with pure SVG micro-sparklines and zero visual arrow glyphs (`↗`/`↘`). Zero-chart export invariant maintained across ExcelJS and jsPDF engines.
- **Test Baseline:** 356 automated Node.js tests passing. Static code quality: 0 errors. Production Vite bundle successfully generated (`dist/` clean in <11s).

## 18. Batch 3.5A & 3.5B Fresh QA Mode Technical Architecture & Storage Contracts

- **Service Module:** `frontend/src/services/freshQAModeService.js` provides the single canonical engine for inventory inspection, dry-run preview, backup/masking, and safe reset activation. Exposed directly via UI at `/super-admin/settings?tab=qa_reset` and window context for parity.
- **Complete Storage Registry:** 76 discrete localStorage namespaces partitioned into:
  1. `PROTECTED_IDENTITIES` (6 keys): Preserves user accounts, active sessions, career history, bank accounts, and canonical employee identities for `EMP-001` (Super Admin) and `EMP-002` (HR Admin).
  2. `PRESERVED_SYSTEM_DEFINITIONS` (13 keys): Preserves company profile, RBAC matrices, core policy templates, approval hierarchies, attendance rules, expense limits, letter templates, holidays, scheduled alerts, and allowance definitions.
  3. `RESET_ORGANIZATION_MASTERS` (7 keys): Atomically sets departments, sub-departments, teams, designations, team assignments, assignment history, and succession logs to `'[]'`.
  4. `RESET_OPERATIONAL_TRANSACTIONS` (50 keys): Atomically sets operational transactions across Recruitment, Attendance, Leaves, Payroll, Performance, Training, Help Desk, Travel, Letters, Expenses, and Notifications to `'[]'`.
- **Unknown Storage Key Gate:** Scans all `isysware_hrms_*` keys in storage; any unclassified keys block reset execution with an explicit exception until reviewed.
- **Mandatory Pre-Reset Backup Gate:** Verification flag `QA_MODE_KEYS.BACKUP_TIMESTAMP` must be set via a successful backup download before live reset execution is unlocked.
- **Anti-Reseeding Evaluation Contract:** Services use `this._getItem(key, null)`. In JavaScript, `JSON.parse('[]')` evaluates to `[]`, which is truthy (`![] === false`). Therefore, setting `'[]'` guarantees services never reseed default mock data upon reload or refresh.
- **Mode Flag Contract:** `isysware_hrms_fresh_qa_mode_active = 'true'` persists alongside reset execution, verified via `freshQAModeService.isFreshQAModeActive()`.
- **Identity Link Retention:** Admin accounts maintain valid foreign-key links to their corresponding employee profile in `isysware_hrms_f02_employees_v1`, guaranteeing that `authService.getCurrentUser()` and operational signatures never yield orphan pointers or broken identities.
- **Backup & Sensitive Masking Engine:** `createBackup({ maskSensitive: true })` masks employee CNIC, full bank account numbers, full IBANs, and passwords using deterministic asterisks and redaction tokens before export. Zero credentials or banking values exposed in UI.
- **Strict Safety Gating:** Reset execution defaults to `dryRun: true` and throws an error unless provided with the exact confirmation token `CONFIRM_RESET_FRESH_QA_MODE_2026` and `dryRun: false`. Never invokes indiscriminate `localStorage.clear()`.
- **Verification Baseline:** 383/383 automated tests passing across 28 test files (`node --test src/tests/*.test.js`). 0 lint errors. Production build verified clean in 6.6s.

## 19. P0 Identity Collision Prevention and Safe In-UI Repair Architecture

- **Root Cause & Vulnerability Addressed:** Clean-slate Option B reset historically emptied `isysware_hrms_f02_employees_v1: []`, deleting protected root admin records (`EMP-001` Super Admin Alexander Wright / Tariq Mehmood, `EMP-002` HR Admin Ayesha Khan). When a new employee was onboarded, `getNextEmployeeId()` extracted sequential digits from the empty array, defaulting to `EMP-001`. This resulted in identity collision between the newly onboarded employee and the root Super Admin account (`isysware_hrms_user_accounts_v1`), locking the employee's role in `PromotionTransferModal` and hiding admin identities from the Employee Directory.
- **Permanent Allocator Guard (`employeeService.js`):** `getNextEmployeeId()` now inspects both `isysware_hrms_f02_employees_v1` and `isysware_hrms_user_accounts_v1`, permanently reserving `EMP-001` and `EMP-002`. Regular employee allocation calculates `Math.max(2, ...existingNumbers) + 1`, guaranteeing regular employees always start at `EMP-003+`. `createEmployee()` strictly rejects assigning `EMP-001` or `EMP-002` to non-admin emails.
- **Immutable Admin Role Protection (`PromotionTransferModal.jsx`):** Root Super Admin check no longer relies solely on display ID `EMP-001`; it verifies account email (`superadmin@isysware.com`) and system role (`role === 'super_admin'`) against canonical user accounts.
- **Safe In-UI Repair Service (`identityRepairService.js`):**
  - Canonical Storage Namespaces: `isysware_hrms_f02_employees_v1`, `isysware_hrms_user_accounts_v1`, `isysware_hrms_f02_departments_v1`, `isysware_hrms_f02_teams_v1`, `isysware_hrms_f02_team_assignments_v1`, `isysware_hrms_f02_bank_records_v1`, `isysware_hrms_f02_career_history_v1`.
  - Non-destructive Dry-Run Preview (`generateRepairPreview`): Detects collision, calculates safe target ID (e.g. `EMP-003`), preserves all newly created departments, sub-departments, teams, and designations, and accurately maps dependent references (`dept.managerId`, `team.teamLeadId`, team assignments, bank records, career history). Authoritative admin profiles are restored from canonical seed definitions.
  - Transactional Execution & Rollback (`executeRepair`): Requires confirmation token `CONFIRM_REPAIR_IDENTITY_COLLISION_2026`. Takes pre-execution storage snapshot, writes updated records atomically, verifies post-repair invariants (`EMP-001` belongs to Super Admin, no duplicate IDs, Hamza points to `EMP-003`), and automatically rolls back if any invariant check fails.
  - Dedicated UI Tab: Accessible via `/super-admin/settings?tab=reset` under "Identity Collision & Repair" (with red `P0 Issue` indicator when collision is detected), featuring pre-repair backup download, side-by-side before/after preview, and owner confirmation token gate.

**End of TRD — all backend/database details are future requirements, not permission to start them.**
