# iSysware HRMS — Engineering, UI/UX, Reporting & QA Skills Handbook

**Version:** 1.0 | **Applies to:** All Antigravity development batches  
**Purpose:** Practical reusable coding and review standards; read together with `prd.md`, `trd.md` and `agent.md` before every task.

## 1. Working philosophy

Act as a disciplined senior software engineer, product designer, finance-domain implementer and QA reviewer. Ship the smallest **complete, verifiable** unit requested. Avoid speculative features, placeholder success toasts, arbitrary refactors and risky bulk edits. If existing code works, preserve it. Requirements and business rules are part of correctness, not a decorative checklist.

- **Only assigned scope**; stop after the authorized prompt's acceptance criteria are met.
- **JavaScript/JSX only** in first-party application code — no TypeScript files, migrations or TS-based generated application components.
- **Frontend first:** functioning mock user journeys must use one coherent canonical service; backend not authorized in frontend phase.
- **No GitHub commit, push, PR, deployment or paid service creation** without explicit owner instruction.
- **Finance/HR sensitive data:** precision, history, true actor identity, authorization and reporting reconciliation before visual polish.

## 2. Required UI stack / styling

- React + Vite + JavaScript JSX; Tailwind CSS + shadcn/ui accessible components; React Router.
- **Font:** Inter (primary); fallbacks `ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`. Use consistent weights 400/500/600/700; avoid tiny labels and decorative display fonts.
- **Icons:** Font Awesome **Free** SVG icons through official `@fortawesome/react-fontawesome`, `@fortawesome/fontawesome-svg-core` and selective Free icon packs. Prefer simple outline/regular icons where available; consistent stroke visual weight. If a given Free icon has only solid style, choose a visually restrained equivalent. Use a shared `AppIcon`/registry wrapper for consistency. Never depend on paid Pro packs without permission.
- **shadcn JavaScript setup:** `components.json` must contain `"tsx": false`; `jsconfig.json` import alias; do not use CLI scaffold commands that silently generate TypeScript components. Use current official JS docs.
- **Theme:** clean *light* navy/white enterprise UI. Primary `#102746`, navy hover `#19375E`, accent `#244A78`, light blue `#EAF2FB`, page background `#F5F8FC`, white surfaces `#FFFFFF`, neutral border `#DCE5F0`, text `#1B2B43`; semantic success/warning/danger only where meaningful.
- **Responsive:** desktop left sidebar, topbar; mobile collapse/drawer across all five portals (Super Admin, HR/Admin, Department Manager, Team Lead, Employee), no clipped cards, forms usable via keyboard/touch, tables scroll with visible column headings.
- **Clarity:** no cartoons, no emojis as UI icons, no needless motion, no dense unlabelled controls, no corporate stock-photo wallpaper. For nontechnical staff, actions should be phrased as a simple verb (`Apply Leave`, `Request Correction`, `Download Payslip`).

### 2.1 Design token implementation example (adapt to installed Tailwind version)

```css
:root {
  --hrms-primary: #102746;
  --hrms-primary-hover: #19375e;
  --hrms-accent: #244a78;
  --hrms-accent-light: #eaf2fb;
  --hrms-canvas: #f5f8fc;
  --hrms-surface: #ffffff;
  --hrms-border: #dce5f0;
  --hrms-text: #1b2b43;
}
body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
```

Keep CSS/theme driven by one design system. Do not paste a second color theme per module.

## 3. Page anatomy and reusable controls

### 3.1 Standard operational screen

`Page Title + short subtitle → KPI/status strip (when useful) → one compact filter row → readable table/cards → Add action/modal → detail view → confirmation and audit record`. Tables: sticky headings for long lists, clear sort/search, pagination, robust empty state, intentional hover and focus.

### 3.2 Forms

- Group related fields: personal, employment, policy, evidence, financial; use concise helper text and inline validation.
- Any change to pay, bank, leave policy, role or financial approval requires confirmation, a valid reason and correct approver.
- Distinguish Save Draft / Submit Request / Approve / Reject / Pay / Publish — these states are never interchangeable.
- Currency inputs are decimal safe, date/time controls show expected timezone, no fake prefilled real passwords, sensitive fields masked.
- Async operations show loading, failure, retry or partial-save state; never show success before service acknowledges.

### 3.3 Tables and summaries

- Numeric financial columns right-aligned, amounts with PKR/commas/two decimals; working time in understandable `hh:mm` or minutes with definition.
- Status text + accessible semantics, don't rely solely on color.
- No unexplained abbreviations; badges reserved for meaningful state in dashboards; readable small labels.
- Each row has source reference (employee ID, run ID, request ID) and permissioned detail view.

## 4. Dashboard vs. reporting distinction

Dashboard may contain brief KPI cards, action queues, recent activity and workforce data; reference supplied screenshot for spacing/layout only. Avoid chart-heavy dashboards and unnecessary visuals.

**Formal REPORTING pages, exported PDFs and Excel files must have ZERO charts or graphs**: no line, bar, pie, donut, area, sparkline, speedometer or graphical data plots. Report is a CA-style analytical table with explicitly documented amounts, columns and reconciliations.

### 4.1 Report page template

```text
Report Title                             [PDF] [Excel] [Print]
Short purpose + source
[Today] [This Month] [Custom dates] [Department] [Team] [Employee] [Status]
Opening / Earned / Deducted / Paid / Outstanding numeric summaries
------------------------------------------------------------------------------
Date | Ref | Employee/Department | Particulars | Debit/Add | Credit/Deduct | Balance
------------------------------------------------------------------------------
...  | ... | ...                 | ...         | ...       | ...           | ...
------------------------------------------------------------------------------
                                   Subtotal / Grand Total / Variance
Generated by: USER / ROLE | At: yyyy-mm-dd HH:mm PKT | Filters: ...
```

Use domain-specific labels; **do not blindly use Debit/Credit** for employee counts, attendance minutes or tax rates. For payment account asset-ledger reports, define direction/sign convention clearly. Row data and totals come from canonical source transactions, not UI estimates.

### 4.2 Financial controls

- **Payroll:** approved earning/deduction components add to gross/net exactly once. Show taxable base, withheld tax and tax year separately.
- **Leave:** opening + accrued + approved adjustments − taken = remaining; authorization ceiling is not entitlement. Show booked vs pending separately.
- **Commissions:** qualifying source amount, plan snapshot, earned, reversal, eligible approved, paid and outstanding distinct.
- **Loans:** opening principal + disbursed − repaid ± adjustment = outstanding; principal not wage expense.
- **Expenses:** requested ≠ approved ≠ paid; approved − paid = reimbursement payable.
- **Travel:** approved trip/estimated budget ≠ expense; travel advance unsettled until applied or returned.
- **Tax:** withheld amounts are tax payable; not an extra staff cost on top of gross payroll; remittance clears liability.
- **Revisions:** approved effective-dated change affects eligible future periods only; never silently rederive old payslip.

## 5. Professional Excel and PDF exports

**One registry of report definitions** powers UI, Print, PDF and Excel; identical filters, authorization, timestamp cutoff and computed dataset.

### 5.1 Excel (`.xlsx`)

- Genuine workbook created by a maintained JS-capable XLSX library chosen during reporting batch (check features/license before install).
- Worksheet title and brand strip, navy merged title if appropriate; column header navy background with white bold text; light-blue alternate rows, subtle borders.
- Print header with title/date/filters/generated-by and footer page numbers where library permits.
- Freeze first header row(s), auto filter, meaningful widths, wrap/expand descriptions, right-aligned numeric columns.
- Number formats for PKR/percent/dates; negative numbers readable; no numbers encoded as strings just for display.
- Group subtotals and grand totals formula or calculated snapshot verified against source; empty report still yields valid titled output.
- Excel cells beginning `=`, `+`, `-`, `@` or tab/newline in untrusted *text* fields must be sanitized for formula injection while preserving legitimate numeric negatives.
- No hidden PII or unrelated worksheet data; verified filename pattern `iSysware_<Report>_<From>_<To>_<Timestamp>.xlsx`.
- Tests: open with normal spreadsheet reader, table headers retained, no corrupt archive, totals correct and filters displayed.

### 5.2 PDF

- Real PDF with searchable/printable text, iSysware logo/title, page X of Y, landscape A4 for wide reports, repeating table headings, consistent margins and no clipped rows.
- Report period, active filter summary, generated by/date/time, source attribution and confidentiality metadata.
- Monetary/ledger totals clear, banding restrained, subtotals not split from associated blocks if pagination allows.
- Test multiple pages, long names, no data, unusually wide columns, special characters, round-trip totals, A4 print review.
- No graph, screenshot-to-PDF fakery, chart or premature 'export succeeded' alert.

## 6. Mock data and shared state skill

- Seed realistic but **clearly marked DEMO** linked staff across Development, Sales, Media, HR, Finance and Management, supporting canonical Company → Department → Sub-department (optional intermediate entity) → Team → Employee relationships; one canonical employee ID reused in all modules.
- Sub-department entity (Batch 3.1): `SUBDEP-xx` schema with code, name, parent department, assigned manager, and active status; teams optionally link to sub-departments; career history records sub-department movements without data loss.
- Multi-team assignment & scoping (Batch 3.2): `STORAGE_KEYS.TEAM_ASSIGNMENTS` with stable IDs (`TA-xx`), multiple team links per lead or manager, dynamic employee deduplication in scope queries (`getTeamLeadScope`, `getDepartmentManagerScope`), dynamic eligible manager resolution, cross-department policy guards, and audit tracking in `STORAGE_KEYS.TEAM_ASSIGNMENT_HISTORY`.
- Employee Promotion, Transfers & Management Succession (Batch 3.3): Separation of concerns between job title/designation, team leadership responsibility, portal role, and primary manager. Strict invariant that career movements never mutate compensation; salary revisions are strictly isolated to `salaryRevisionService`. Controlled RBAC upgrades via `authService.updateUserRole` with `EMP-001` protection and active session synchronization. Mandatory succession validation (`analyzeManagementDependencies`, `executeManagerSuccession`) blocks separation of managers/leads with unresolved dependencies, transferring direct reports, units, and pending approvals atomically to the successor with audit logging in `STORAGE_KEYS.SUCCESSION_HISTORY`.
- Use `employeeService`, policy resolver mock, attendance/leave/payroll services and shared selectors; avoid isolated hard-coded totals in dashboard cards.
- Changes propagate: leave approval updates balance + attendance + eligible payroll; field approval changes actual worked status; payroll locks snapshot; expense claim approved updates payable but not payment; issued letter doesn't change job/salary.
- Reusable adapter contract uses `async` functions for eventual REST replacement; services can use localStorage only for demos; no claims of real security or persistence.
- Do not generate pseudo-random every render if it causes contradictory headcount or financial totals.

## 7. Business logic skill: approval engine and limits

A policy decision must explain **who may approve, why, and under which effective rule**. See `prd.md` §5 and `trd.md` §7.

Example: 2 paid leaves per month, manager's monthly cumulative approval cap 2 days. First 1-day request Manager; second 1-day request Manager (assuming entitlement). Third request to HR, even if separately submitted. Manager applicant bypasses self-manager and goes to HR; HR applicant goes to independent reviewer / Super Admin. Super Admin sets thresholds but cannot erase mandatory independent review.

Late example: 4 occurrences/month included as policy threshold; 5th produces exception, never automatic arbitrary fine. Track both occurrences and minutes, apply grace threshold, document HR/SA review. Attendance correction retains raw punch.

Salary increment: Manager performance review/recommendation → HR creates increment/decrement proposal with before/after and effective date → Super Admin approves → future pay uses approved version. Invalid automatic salary changes are blocked.

**Review matrix for every workflow:** requester role, eligible subject, assigned reviewer, max per item, cumulative period cap, exception/higher approver, self-approval prohibition, policy version, status lifecycle, evidence, audit and report impact.

## 8. Secure coding and data privacy skill

- Assume all client-supplied IDs, roles, approver grants and totals are hostile. Backend verifies authentication, privilege, subject ownership/team, current effective policy and data field permissions.
- Mask employee bank, tax, medical, HR complaints, loan and confidential letters. Disclose only required fields; log no raw secrets/IBAN.
- Files private and permissioned. Reject path traversal, unexpected MIME, large uploads and dangerous file content. Record file metadata+references, not exposed public URLs.
- Time and effective date calculations use approved company timezone; UTC stored instants and company-local policy window. Overnight shifts need dedicated tests.
- Database constraints and transactions back every paid/approval ledger update; unique composite references prevent duplicate payroll, commission, reimbursement and cron executions.
- No direct public connection from React to PostgreSQL; secrets only backend runtime.

## 9. Validation and QA skill

### Must test for each feature

1. Happy path with valid data.
2. Invalid/missing inputs and friendly error.
3. Unauthorized role or resource ID tamper.
4. Repeat submit / double-click / retry, idempotency.
5. Edit/change with audit & effective-date rules.
6. Empty/list/pagination/search/filter combinations.
7. Data persistence or expected mock reset behavior.
8. Mobile/desktop, keyboard/focus, long texts.
9. Cross-module impact (for affected domains only).
10. Regression of previously approved module flows.

### Payroll/finance test vectors

- Late 1..5 with four allowed; overlap approved field duty; half day and holidays; manager-vs-HR-vs-SA leave; one/month vs two per request and split requests.
- Monthly, part-time, hourly, project payment; prorating; overtime not approved; salary revision mid-period; commission partial/refund; taxable/non-taxable allowance per approved policy; loan recovery once; failed bank payment; duplicated retry.
- Travel advance vs reimbursed claim, pick/drop employee contribution vs fuel allowance, expense approval vs reimbursement.
- Exported data and summary must reconcile to same source/filters and report visibility scope.

### Verification evidence

Capture executed command and output of `npm run lint`, `npm run build`, tests; list manually verified routes and roles. Do not claim browser testing if no browser was used; do not conceal known failures, skipped cases, or soft console errors.

## 10. Research/reference habits

Use official current docs for changing APIs and package major versions; do not blindly copy TypeScript examples into JS-first repo. Browse if version or hosting capability has changed. Reference implementations are **inspiration**, never license to clone vendor screen graphics or reproduce proprietary data.

Sources:
- https://ui.shadcn.com/docs/javascript
- https://ui.shadcn.com/docs/installation/vite
- https://docs.fontawesome.com/web/use-with/react/
- https://www.prisma.io/docs/
- https://www.namecheap.com/support/knowledgebase/article.aspx/10047/2182/how-to-work-with-nodejs-app/

## 11. Fresh QA Mode, Safe Reset & Data Confidentiality Protocols

- **Zero Accidental Reseeding:** Storage keys for empty masters and operational transactions must be written as stringified empty arrays (`'[]'`). Never use `localStorage.clear()` or `removeItem()` to wipe operational tables, as absence of keys causes `_getItem(key, null)` checks to trigger default seed re-initialization on reload.
- **Protected Admin Identity Guard:** In fresh QA modes, root administrative accounts (`EMP-001` Super Admin and `EMP-002` HR Admin) must retain valid employee records in canonical employee storage. Never delete admin employee references, as doing so breaks profile lookups, auth headers, and administrative signatures.
- **Confidentiality in Exports & Backups:** When creating exportable QA backups, sensitive fields (national identity CNIC, full bank account numbers, full IBANs, and passwords) must be automatically redacted/masked with asterisks (`37405-*******-1`, `PK•• •••• •••• •••• 2002`). Unmasked data must never be dumped into logs, console, or public artifacts.
- **Two-Phase Safety Confirmation:** Destructive resets require a two-phase gating mechanism: `dryRun: true` by default for safe preflight inspection, followed by explicit token confirmation (`CONFIRM_RESET_FRESH_QA_MODE_2026`) only when explicitly instructed by the system owner.
- **Single Canonical Reset Engine & UI Gate:** Never execute ad-hoc browser scripts that loop over raw storage. Always execute the tested `freshQAModeService.js` canonical engine, exposed via the dedicated Super Admin Settings tab (`/super-admin/settings?tab=qa_reset`).
- **Unclassified Key Guard & Mandatory Backup Gate:** Any unclassified `isysware_hrms_*` keys detected in storage strictly halt reset execution. Live reset execution is blocked until a full verified JSON backup has been downloaded. Zero credentials or sensitive banking details may be rendered in the UI.
- **Identity Collision Prevention & Safe In-UI Repair Protocol:** Never execute ad-hoc console scripts for data or identity repair. Always use the built-in `identityRepairService.js` UI preview and transactional engine. In fresh resets, root administrative profiles (`EMP-001` Super Admin and `EMP-002` HR Admin) must be preserved in employee records. In employee ID allocation, `EMP-001` and `EMP-002` are strictly reserved for administrative accounts, guaranteeing regular workforce members always start at `EMP-003+`. Repairs must be previewed side-by-side, verified against pre-repair backups, executed atomically with rollback support, and confirmed by the owner via token.

**Final skill rule:** Professional means reliable, traceable and easy to operate — not maximum menus, effects or charts.
