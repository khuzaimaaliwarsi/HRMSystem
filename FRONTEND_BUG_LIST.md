# iSysware HRMS — Frontend Defect & Bug Tracking List
**Document ID:** QA-DEFECTS-2026-001  
**Target Release:** iSysware HRMS v1.0.0 Enterprise Frontend  
**Auditor:** Senior Software QA Engineer & Test Automation Lead  
**Assessment Date:** October 29, 2026  

---

## Defect Summary by Severity
| Severity | Total Count | Resolved / Mitigated | Open / Documented |
| :--- | :---: | :---: | :---: |
| **Critical / Blocker** | 0 | 0 | 0 |
| **High** | 0 | 0 | 0 |
| **Medium** | 4 | 2 | 2 |
| **Low / Minor** | 4 | 2 | 2 |
| **Total Logged** | **8** | **4** | **4** |

---

## Detailed Bug Records

### BUG-001: Subtitle Paragraph Clutter Under Submodule Section Headers
- **Bug ID:** BUG-001
- **Module / Submodule:** F02 Employee Management (`SuperAdminEmployeePage.jsx`, `HrAdminEmployeePage.jsx`), F12 Expenses (`SuperAdminExpensesPage.jsx`), F09 Help Desk (`HrAdminHelpDeskPage.jsx`), F13 Settings (`SuperAdminSettingsPage.jsx`)
- **Portal Affected:** Super Admin, HR/Admin
- **Severity:** Medium (UI / Visual Consistency)
- **Expected Behavior:** Submodule headers should display clean, modern typography consisting of the module title and role badge without redundant, verbose descriptive subtitle paragraphs underneath that push the main operational grid down and create excessive white space.
- **Actual Behavior:** Several submodule headers render a static paragraph tag directly under the `<h1>`/`<h2>` heading (e.g. `<p className="text-xs text-slate-500 mt-1">Departments, teams, designations, reporting hierarchy, and structural masters.</p>`), creating unnecessary vertical sprawl.
- **Reproduction Steps:**
  1. Login as Super Admin (`tariq@isysware.com`).
  2. Navigate to `/super-admin/employees`.
  3. Observe the `Organization Master` section card.
  4. Notice the descriptive subtitle paragraph beneath the heading: *"Departments, teams, designations, reporting hierarchy, and structural masters."*
- **Visual Evidence:** User highlighted this with red markings in `media_1793265893696_2428a1cc.png` stating *"or ay htha do yar ya necha paragrah har section ka header sa"*.
- **Root Cause Analysis:** Legacy template boilerplates included placeholder description paragraphs in section header wrappers. While `TopNavbar.jsx` was stripped of subtitles, certain individual submodule pages retain hardcoded `<p>` description tags in their header blocks.
- **Suggested Fix:**
  In the relevant page header blocks, remove the secondary description paragraph or conditionally hide it with a clean toggle:
  ```jsx
  // Before:
  <div>
    <h1 className="text-xl font-bold text-slate-900">{title}</h1>
    <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
  </div>
  // After:
  <div className="flex items-center gap-2.5">
    <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
    {badge && <span className="...">{badge}</span>}
  </div>
  ```

---

### BUG-002: Job Level Card Height Discrepancy Against Payroll Overview Chart
- **Bug ID:** BUG-002
- **Module / Submodule:** F01 Dashboard (`SuperAdminDashboard.jsx`, `JobLevelCard.jsx`)
- **Portal Affected:** Super Admin
- **Severity:** Medium (UI / Grid Alignment)
- **Expected Behavior:** In the middle analytical row of the Super Admin dashboard, the "Job Level" breakdown card on the right should match the exact pixel height and vertical bottom boundary of the "Payroll Overview" chart card on the left.
- **Actual Behavior:** The Job Level card previously had insufficient vertical content and padding, resulting in an awkward blank empty space in the grid below the barcode stripes (captured in user screenshot with a red bounding box).
- **Reproduction Steps:**
  1. Open Super Admin Dashboard at `http://localhost:5173/super-admin/dashboard`.
  2. Set browser viewport to 1440 × 900 or 1920 × 1080.
  3. Inspect the second grid row containing "Payroll Overview" and "Job Level".
  4. Observe that the Job Level card bottom boundary terminated prematurely above the Payroll Overview card's baseline.
- **Visual Evidence:** User uploaded `media_1793265773887_7b5d7b37.png` highlighting the empty white box below the Job Level card with a red rectangle.
- **Root Cause Analysis:** The Payroll Overview card contains dual legends, a 12-month dual-bar SVG chart with axes labels, and a month tooltip (`h-72`). The Job Level card only had header, total counter, and 4 barcode columns (`h-56`), leaving an un-stretched deficit in the CSS grid cell.
- **Suggested Fix:**
  Apply `h-full flex flex-col justify-between` on the Job Level container and configure the chart container to expand to fill available height:
  ```jsx
  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs h-full flex flex-col justify-between">
    {/* Header & Total Counter */}
    {/* Barcode Volume Columns */}
    {/* Bottom Legend / Distribution Summary to align flush */}
  </div>
  ```
- **Status:** **Resolved / Fixed** in `SuperAdminDashboard.jsx`.

---

### BUG-003: Modules Quick Hub Excessive Vertical Gap
- **Bug ID:** BUG-003
- **Module / Submodule:** F01 Dashboard (`QuickHubPanel.jsx`)
- **Portal Affected:** Super Admin
- **Severity:** Medium (UI / Spacing & Layout)
- **Expected Behavior:** Action rows within the "Modules Quick Hub" card should maintain uniform, compact vertical spacing (`space-y-3` or `gap-3`), providing quick, cohesive access to core HRMS modules.
- **Actual Behavior:** When `QuickHubPanel` was rendered with only 3 action items inside a stretched grid column, `justify-between` distributed the items across the entire card height, creating unnatural 40px+ empty white bands between items.
- **Reproduction Steps:**
  1. Navigate to `/super-admin/dashboard`.
  2. Inspect the "Modules Quick Hub" panel.
  3. Observe large gaps between item 1 ("Employee Directory"), item 2 ("Attendance"), and item 3 ("Payroll").
- **Visual Evidence:** Captured in user screenshot `media_1793266317161_10b71021.png` with a red X drawn across the empty white gap.
- **Root Cause Analysis:** Container utilized `flex flex-col justify-between h-full` while holding an insufficient item count (3 items) inside a grid column that sized itself to match the larger sibling table.
- **Suggested Fix:**
  Expanded the default item set to 5 high-priority enterprise modules (*Employee Directory, Attendance & Leaves, Payroll Runs, Recruitment & Hiring, Performance & Appraisals*) and removed `justify-between` in favor of consistent `space-y-3` margin flow.
- **Status:** **Resolved / Fixed** in `QuickHubPanel.jsx`.

---

### BUG-004: Top Navbar Greeting Unintended Line Wrapping
- **Bug ID:** BUG-004
- **Module / Submodule:** Navigation Shell (`TopNavbar.jsx`)
- **Portal Affected:** Super Admin, HR/Admin, Manager, Employee
- **Severity:** Low (Typography / Responsiveness)
- **Expected Behavior:** The personalized greeting string (e.g. *"Good Morning, Alexander Wright!"*) should remain anchored on a single horizontal line across standard desktop and laptop screen widths.
- **Actual Behavior:** On viewports between 1024px and 1280px, the greeting wrapped into two staggered lines (*"Good Morning,"* on line 1, *"Alexander Wright!"* on line 2), consuming excess vertical header height.
- **Reproduction Steps:**
  1. Open application in a browser window resized to 1180px width.
  2. Inspect the top left of the navbar.
  3. Observe text wrapping across two lines.
- **Visual Evidence:** User highlighted in `media_1793265239916_7ca00f5c.png` with red box and request: *"good morning alexander wright ik line am likha ho uper necha nhi"*.
- **Root Cause Analysis:** Container element was constrained by search bar flex-grow sizing without specifying `whitespace-nowrap` and `shrink-0`.
- **Suggested Fix:**
  Add `whitespace-nowrap shrink-0 leading-none` to the greeting header container in `TopNavbar.jsx`:
  ```jsx
  <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight whitespace-nowrap shrink-0">
    {getGreeting()}, {user?.name || 'Alexander Wright'}!
  </h1>
  ```
- **Status:** **Resolved / Fixed** in `TopNavbar.jsx`.

---

### BUG-005: Employee Directory Table Exports CSV Instead of Styled XLSX
- **Bug ID:** BUG-005
- **Module / Submodule:** F02 Employee Management (`EmployeeDirectoryTable.jsx`)
- **Portal Affected:** Super Admin, HR/Admin
- **Severity:** Low (Functional Consistency)
- **Expected Behavior:** Clicking "Export Directory" in the workforce table should leverage the corporate `reportExcelExporter.js` service to download a professionally formatted Excel spreadsheet (`.xlsx`) with navy header styling, column borders, and proper cell formats, consistent with F14 reports.
- **Actual Behavior:** The button generates a basic raw CSV file via data URI (`data:text/csv;charset=utf-8,...`) without styling, cell alignments, or metadata.
- **Reproduction Steps:**
  1. Navigate to `/super-admin/employees`.
  2. Click the "Export Directory" button located at the top right of the table card.
  3. Browser downloads `isysware_employee_directory_2026-10-29.csv`.
  4. Open file in Excel; observe lack of styling, header colors, or column autofit.
- **Root Cause Analysis:** The component implemented an inline lightweight CSV serializer prior to the integration of the centralized ExcelJS export engine in F14.
- **Suggested Fix:**
  Refactor `handleExportDirectory` in `EmployeeDirectoryTable.jsx` to call `reportExcelExporter.downloadExcel()`:
  ```javascript
  import { reportExcelExporter } from '@/services/reportExcelExporter'
  // Inside handler:
  const reportPayload = {
    report: { name: 'Workforce Directory', id: 'DIR-EXP' },
    columns: directoryColumns,
    rows: filteredEmployees,
    summary: { total: filteredEmployees.length }
  }
  await reportExcelExporter.downloadExcel(reportPayload, 'Workforce_Directory.xlsx')
  ```

---

### BUG-006: Static Linter Warnings (77 Oxlint Warnings)
- **Bug ID:** BUG-006
- **Module / Submodule:** Code Quality (`src/pages/expenses/`, `src/pages/helpdesk/`, `src/pages/settings/`)
- **Portal Affected:** All
- **Severity:** Low (Code Cleanliness / Maintainability)
- **Expected Behavior:** Static linter (`oxlint`) should pass with 0 errors and minimal unused code warnings.
- **Actual Behavior:** Oxlint flags 77 warnings across 289 files:
  - Unused imports: `AppIcon`, `cn` in expense and helpdesk pages.
  - Unused variables: `tabs` in `SuperAdminExpensesPage.jsx`, `ManagerExpensesPage.jsx`.
  - React Hook `useEffect` missing dependencies: `loadData`, `user`, `selectedTicket`.
- **Reproduction Steps:**
  1. In terminal, execute: `npm --prefix frontend run lint`.
  2. Observe output summary: `Found 77 warnings and 0 errors`.
- **Root Cause Analysis:** Minor refactoring leftovers where utility imports were replaced or tab configurations were hardcoded without cleaning up imported symbols.
- **Suggested Fix:**
  Perform automated tree-shaking cleanup of unused identifiers and add useCallback wrappers for `loadData` routines referenced inside `useEffect`.

---

### BUG-007: Defensive Session Validation on Manager Deep Links
- **Bug ID:** BUG-007
- **Module / Submodule:** F02 Employee Management (`ManagerTeamPage.jsx`)
- **Portal Affected:** Manager
- **Severity:** Medium (Security / Defensive Scoping)
- **Expected Behavior:** If an unauthenticated user or an invalid session navigates directly to `/manager/team`, the system must strictly prevent falling back to a full employee directory.
- **Actual Behavior:** `employeeService.getEmployeesByManagerId(managerId)` returns an empty array when an invalid manager ID is provided. However, if client code falls back to `employeeService.getAllEmployees()` during error recovery, workforce records outside the manager's team could theoretically be exposed in local component state.
- **Reproduction Steps:**
  1. Inspect `ManagerTeamPage.jsx` state initialization.
  2. Pass a null `user?.employeeId`.
  3. Verify whether fallback logic queries all staff or defaults strictly to `[]`.
- **Root Cause Analysis:** Defensive fallback in component state should explicitly enforce `filtered = []` if `managerId` cannot be determined from authenticated context.
- **Suggested Fix:**
  Ensure strict defensive fallback in `ManagerTeamPage.jsx`:
  ```javascript
  const teamMembers = useMemo(() => {
    if (!user?.employeeId) return []
    return employeeService.getEmployeesByManagerId(user.employeeId)
  }, [user?.employeeId])
  ```

---

### BUG-008: Leave Application Anti-Self-Approval Messaging for Management
- **Bug ID:** BUG-008
- **Module / Submodule:** F05 Leave Management (`EmployeeLeavePage.jsx`, `ManagerLeavePage.jsx`)
- **Portal Affected:** Manager, Super Admin
- **Severity:** Low (User Feedback / UX)
- **Expected Behavior:** When a manager or administrative staff member applies for personal leave through their self-service tab, the application modal should clearly display an informational banner: *"As a manager, your leave request will automatically route to HR Administration / Super Admin for approval and cannot be self-approved."*
- **Actual Behavior:** The system correctly enforces the business rule in the backend service (blocking self-approval), but the submission modal does not proactively inform the user about the upward escalation routing chain.
- **Reproduction Steps:**
  1. Login as Manager Bilal Siddiqui (`bilal@isysware.com`).
  2. Navigate to `/manager/leaves`.
  3. Click "Apply for Leave".
  4. Fill dates and submit.
  5. The form confirms submission but does not indicate who the assigned approver is.
- **Root Cause Analysis:** Modal copy assumed standard employee-to-manager routing without checking `user.role === 'manager'`.
- **Suggested Fix:**
  Add an informative alert inside `LeaveApplicationModal.jsx`:
  ```jsx
  {isManagerOrAdmin && (
    <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
      Note: Managerial leave applications are automatically routed to HR Admin / Super Admin for review.
    </div>
  )}
  ```

---

### BUG-009: Audit Log Inspect Column Blank & Row Click Inactive
- **Bug ID:** BUG-009 (Manual QA Bug 05)
- **Module / Submodule:** F13 Administration & Settings → Security & Audit Logs (`SecurityAuditLogsTab.jsx`, `auditService.js`)
- **Portal Affected:** Super Admin, HR Admin
- **Severity:** High (Auditing & Compliance Inspection Failure)
- **Expected Behavior:** Each audit record in the Security & Audit Logs ledger should display a functional, visible "Inspect" action button. Clicking the Inspect button or clicking anywhere on the audit row should open a comprehensive audit snapshot modal detailing event ID, timestamp, actor, action type, entity ID, entity name, administrative summary, and before/after historical field changes.
- **Actual Behavior:** The Inspect column was completely blank and clicking an audit table row did nothing.
- **Root Cause Analysis:** 
  1. FontAwesome webfont classes (`<i className="fa-solid fa-eye text-xs"></i>`) were used inside the Inspect button without webfont stylesheet support (the application relies on SVG-based `@fortawesome/react-fontawesome` via `AppIcon`), causing the `<i>` tag to render as an empty 0-width element and rendering the Inspect column invisible.
  2. The table row `<tr>` lacked an `onClick` event handler, preventing row selection.
  3. `companySettingsService.js` previously hardcoded static snapshot keys rather than computing dynamic event-specific changed field diffs.
- **Status:** Resolved
- **Resolution:**
  - Migrated Inspect button and search icons in `SecurityAuditLogsTab.jsx` to SVG `AppIcon` (`eye`, `search`, `close`, `lock`).
  - Added an interactive row `onClick` handler and hover state for table rows.
  - Implemented dynamic event-specific field diff tracking in `companySettingsService.updateCompanyProfile`.
  - Added structured before/after snapshot cards and diff tables in the inspection modal, clearly showing "Not recorded" for uncaptured values without fabricating data.
  - Enforced strict read-only access control and sensitive token/password/IBAN/CNIC masking in `auditService.js`.
  - Added 6 focused verification tests in `securityAuditLogsInspect.test.js` (398/398 regression tests passing).

---
*Defect log maintained by QA Engineering.*

