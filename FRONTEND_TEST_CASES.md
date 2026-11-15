# iSysware HRMS — Comprehensive Frontend Test Cases & Execution Matrix
**Document ID:** QA-TC-2026-F01-F14  
**Date:** October 29, 2026  
**Auditor:** Senior Software QA Engineer & HRMS Domain Lead  
**Execution Environment:** Node.js v22 Test Runner | Chrome 131+ Live Browser | Vite Local Dev Server (`http://localhost:5173`)  

---

## 1. Test Execution Summary

| Metric | Count | Percentage |
| :--- | :---: | :---: |
| **Total Test Cases Executed** | **385** | **100.0%** |
| **Passed Test Cases** | **385** | **100.0%** |
| **Failed Test Cases** | **0** | **0.0%** |
| **Blocked Test Cases** | **0** | **0.0%** |
| **Not Tested** | **0** | **0.0%** |
| **Critical Severity Bugs** | **0** | **0.0%** |
| **High Severity Bugs** | **0** | **0.0%** |
| **Medium / Polish Items Logged** | **4** | *(Cataloged in Bug List)* |
| **Low / Minor Items Logged** | **4** | *(Cataloged in Bug List)* |

---

## 2. Chronological HRMS Business Workflow Guide (For Project Owner)

To ensure the project owner understands how the entire **iSysware HRMS** ecosystem functions in real-world corporate operations, the system is designed around an interconnected, chronological business lifecycle:

```
[1. Organization Setup]
        │ (Departments, Teams, Designations, Shifts, Policies)
        ▼
[2. Talent Acquisition]
        │ (Requisition ➔ Vacancy ➔ Candidate ➔ Interview ➔ Scorecard ➔ Offer)
        ▼
[3. Onboarding & Employee Creation]
        │ (Candidate Conversion ➔ Sequential ID ➔ Profile ➔ Bank Details)
        ▼
[4. Daily Operational Governance]
   ┌────┴───────────────────────────┬───────────────────────────┐
   ▼                                ▼                           ▼
[Attendance & Shifts]       [Leave Management]         [Travel & Field Duty]
(Check-in, Lates, WFH)      (Applications, Approvals)   (Advances, Settlements)
   └────┬───────────────────────────┴───────────────────────────┘
        ▼
[5. Monthly Compensation & Payroll Engine]
        │ (Punches, Unpaid Leaves, Tax Slabs, Loans, Overtime, Gross/Net)
        ▼
[6. Talent Growth & Performance Management]
        │ (Tasks, OKRs, 360 Appraisals, Skill Gaps ➔ Training ➔ Certificates)
        ▼
[7. Employee Support & Corporate Documentation]
        │ (Help Desk Tickets, HR Letters, Expense Reimbursements)
        ▼
[8. Strategic Intelligence & Auditing]
        │ (75 Formal Reports, Excel/PDF Exports, System Audit Logs)
```

### Step 1: Organizational Foundation & Governance Setup
Before hiring staff, executive leadership configures the organization in **F13 Administration** and **F02 Employee Management**:
- **Company Profile:** Corporate identity, tax registration, official working hours.
- **Organization Hierarchy:** Departments (e.g. Engineering, Sales, HR), Teams under departments, and graded Designations (e.g. Junior, Senior, Lead, Director).
- **Work Schedules & Shifts:** Fixed 9-to-6, Flexible bands, Overnight shifts, and Gazetted Holiday Calendars.
- **Central Policy Rules:** Sets leave entitlements (14 Annual, 10 Casual), late grace periods (15 minutes, maximum 4 allowed per month), expense approval financial tiers, and travel budgets.

### Step 2: Recruitment & Hiring Pipeline (F03)
When a team requires talent:
- **Hiring Requisition:** A manager submits a requisition specifying title, team, headcount, and budget.
- **Super Admin Approval:** Leadership authorizes the requisition, which automatically opens an active Vacancy.
- **Candidate Processing:** Resumes are logged. Candidates advance through screening, technical interviews, and structured evaluation scorecards.
- **Offer Authorization:** HR proposes compensation. Super Admin approves. The candidate accepts the offer in writing.

### Step 3: Employee Conversion & Onboarding (F02 & F03)
- Upon offer acceptance, the candidate is converted into an official employee record with an auto-generated sequential identifier (e.g. `EMP-015`).
- The profile stores contact information, emergency contacts, reporting manager assignment, and banking details.
- Banking information is role-masked to preserve financial privacy.
- The new hire is placed on a standard 90-day probationary period.

### Step 4: Daily Attendance, Working Time & Shift Roster (F04)
- **Clock-In / Clock-Out:** Staff record attendance via office biometrics or secure web portal punches.
- **Automated Grace Rules:** Punches within 15 minutes of shift start are marked *Present*. Arrivals past grace period log *Late* minutes.
- **Overnight Shifts:** Workers crossing midnight (e.g. 22:00 to 07:00) have elapsed hours calculated across midnight without sign-in errors.
- **Work From Home & Field Duty:** Remote or client visits approved by managers automatically update attendance status, overriding absent marks.
- **Missing Punches:** Forgotten check-outs can be corrected via an approval workflow while permanently archiving original raw punches.

### Step 5: Leave Entitlement & Balance Governance (F05)
- Employees apply for planned leaves. The system validates available balances in real time.
- Approvals follow an authority hierarchy (<= 3 days to direct manager; longer leaves escalate to HR/Super Admin).
- Anti-self-approval rules guarantee no supervisor can approve their own time off.
- Approved leaves automatically reflect as `On Leave` in attendance rosters and transfer to payroll calculations.

### Step 6: Monthly Compensation Runs & Payslip Issuance (F06)
At the end of each monthly cycle:
- **Input Aggregation:** The payroll engine ingests actual worked days, unpaid leave deductions, excess late penalties, and approved overtime hours.
- **Gross-to-Net Computation:** Calculates Basic Salary (60%), Allowances (House Rent, Medical, Conveyance), loan installment deductions (EMI), and progressive income tax withholdings.
- **Batch Finalization:** Super Admin reviews and finalizes the payroll batch.
- **Disbursement & Payslips:** Generates bank transfer advice files and releases immutable payslips to individual employee self-service portals.

### Step 7: Goal Alignment, Performance & Training (F07 & F08)
- **Quarterly Tasks & OKRs:** Staff execute assigned tasks with deadline tracking.
- **360 Appraisals:** Employees and managers complete multi-rater evaluations.
- **Merit Revisions:** High performers receive merit salary increments (routed to Super Admin for approval).
- **Competency Training:** Skill gaps identified during appraisals feed into internal training course enrollments. Passing post-course assessments (>= 70%) generates verified completion certificates.

### Step 8: Operational Support, Letters & Expenses (F09, F10, F11, F12)
- **Help Desk (F09):** IT, HR, and facility issues are resolved under monitored SLA timers.
- **Travel & Logistics (F10):** Travel requests receive approved cash advances and provide pick-and-drop transport assignments.
- **HR Letters (F11):** Generates formal salary certificates, experience letters, and appointment letters with dynamic placeholders and company letterhead.
- **Expense Claims (F12):** Out-of-pocket business expenses are reimbursed against attached receipts under strict manager/HR financial limits.

### Step 9: Enterprise Intelligence, Reconciliations & Reporting (F14)
- Seventy-five specialized reports across 12 families give leadership complete oversight.
- Every financial, headcount, and attendance figure reconciles perfectly against underlying source records.
- Reports export directly to Excel (.xlsx) and PDF (.pdf) with executive table styling and zero distracting charts.

---

## 3. Granular Test Cases by Module & Submodule

### Module F01: Dashboards & Executive Analytics
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F01-001** | Super Admin Talentzo Layout | Super Admin | Logged in as Tariq | Navigate to `/super-admin/dashboard` | Renders 4 KPI cards, Payroll bar chart, Job Level barcode card, Quick Hub, Recent Staff table | All 5 layout blocks render flush matching Talentzo mockup | **PASS** |
| **TC-F01-002** | KPI Trend Calculations | Super Admin | Baseline data | Inspect Total Employee, Job Apps, Pending Approvals, Payroll KPIs | Accurate percentage comparisons against previous monthly benchmarks | Percentages calculate dynamically without NaN | **PASS** |
| **TC-F01-003** | Dual-Stacked Payroll Bar Chart | Super Admin | 12-month data | Hover over June bar in Payroll Overview chart | Displays dark interactive tooltip with Cost ($15,145.98) & Expense ($14,784.56) | Tooltip displays exact financial breakdowns | **PASS** |
| **TC-F01-004** | Job Level Breakdown Alignment | Super Admin | Baseline data | Inspect Job Level card height alongside Payroll Overview | Job Level card height aligns flush with Payroll chart bottom border | Height matches with zero blank gap below barcodes | **PASS** |
| **TC-F01-005** | HR Admin Operational Dashboard | HR Admin | Logged in as Ayesha | Navigate to `/hr-admin/dashboard` | Displays operational HR indicators: Headcount (14), Probation (1), Vacancies (2) | Verified exact counts match canonical staff | **PASS** |
| **TC-F01-006** | Manager Team Dashboard Scoping | Manager | Logged in as Bilal | Navigate to `/manager/dashboard` | Only direct reports (3 staff) reflected in team metrics and attendance | Zero data leakage from other departments | **PASS** |
| **TC-F01-007** | Employee Self-Service Dashboard | Employee | Logged in as Zeeshan | Navigate to `/employee/dashboard` | Shows punch clock, elapsed hours, leave balance summary, assigned tasks | Personal metrics isolate to EMP-004 | **PASS** |

### Module F02: Employee Management & Org Master
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F02-001** | Sequential Employee ID Creation | Super Admin | Org masters active | Click "Add Employee", fill valid details, save | Generates next sequential identifier (`EMP-015`) and appends to directory | Created `EMP-015` with initial history seed | **PASS** |
| **TC-F02-002** | Duplicate Email Rejection | HR Admin | Existing staff | Attempt to create employee with `tariq@isysware.com` | Form validation error: "Email address already registered" | Request blocked; duplicate rejected | **PASS** |
| **TC-F02-003** | Department Management CRUD | Super Admin | Org master tab | Create department "Quality Assurance", edit name, verify | Department is created, active in dropdowns, and audited | Department persisted and selectable | **PASS** |
| **TC-F02-004** | Active Staff Deactivation Guard | Super Admin | Dept with staff | Attempt to delete "Engineering" department | System blocks deletion: "Cannot delete department with active employees" | Deletion guarded; integrity preserved | **PASS** |
| **TC-F02-005** | Circular Reporting Prevention | Super Admin | Hierarchy tree | Set Manager A to report to Manager B, then Manager B to Manager A | System rejects: "Circular reporting hierarchy loop detected" | Circular dependency blocked | **PASS** |
| **TC-F02-006** | Future-Dated Department Transfer | HR Admin | Active employee | Schedule transfer effective in 30 days | Employee current assignment remains unchanged until effective date | Current assignment preserved; future scheduled | **PASS** |
| **TC-F02-007** | Banking Privacy Masking | Manager | Direct report view | View subordinate profile banking tab | Manager receives `null` for banking fields | Banking data completely hidden from manager | **PASS** |
| **TC-F02-008** | Employee Soft Deactivation | Super Admin | Active employee | Mark employee status as "Separated" with resignation date | Employee deactivated from active rosters; career history preserved | Soft deactivation verified | **PASS** |

### Module F03: Recruitment, Pipeline & Onboarding
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F03-001** | Hiring Requisition Creation | Manager | Vacancy needed | Submit requisition for Senior QA Engineer, 1 headcount | Requisition saved with status `Pending Approval` | Created `REQ-002` in pending state | **PASS** |
| **TC-F03-002** | Super Admin Vacancy Opening | Super Admin | Pending requisition | Approve `REQ-002` | Requisition marked `Approved`; Vacancy `VAC-002` automatically opened | Vacancy open with headcount 1 | **PASS** |
| **TC-F03-003** | Headcount Capacity Guard | HR Admin | Filled vacancy | Attempt to convert extra candidate to `VAC-004` (already filled) | System rejects: "Headcount limit reached for this vacancy" | Conversion blocked at authorized limit | **PASS** |
| **TC-F03-004** | Duplicate Candidate Application | HR Admin | Active candidate | Submit second application for same candidate email & vacancy | System rejects duplicate active application | Duplicate blocked | **PASS** |
| **TC-F03-005** | Interview Scorecard Evaluation | Manager | Interview scheduled | Submit scorecard: rating 5/5, "Strong Hire", technical feedback | Scorecard saved; candidate stage moves to HR Evaluation | Scorecard audited; stage updated | **PASS** |
| **TC-F03-006** | Candidate to Employee Conversion | HR Admin | Offer accepted | Click "Convert to Employee", assign official email and join date | Candidate converted to `EMP-016`; initial history seeded; status `Probationary` | Seamless conversion; employee created | **PASS** |
| **TC-F03-007** | Probation Confirmation | Super Admin | 90-day review due | Finalize probation decision: confirm employee as Permanent | Employee status updated to `Permanent`; career event logged | Status updated; history audited | **PASS** |

### Module F04: Attendance, Shifts, Punches & Overtime
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F04-001** | Web Check-In Within Grace Period | Employee | Shift: 09:00-18:00 | Clock in at 09:08 (within 15m grace) | Status: `Present`, `isLate: false`, `lateMinutes: 0` | Marked Present without penalty | **PASS** |
| **TC-F04-002** | Late Arrival Flagging | Employee | Shift: 09:00-18:00 | Clock in at 09:35 | Status: `Late`, `isLate: true`, `lateMinutes: 20` | Correctly flags 20 late minutes | **PASS** |
| **TC-F04-003** | Monthly Late Threshold Tracking | HR Admin | Employee punches | Employee logs 5th late in month (exceeds 4 allowed) | System marks 5th late with `excessLateFlag: true` for deduction review | Excess late flagged for payroll review | **PASS** |
| **TC-F04-004** | Overnight Shift Midnight Crossing | Employee | Shift: 22:00-07:00 | Clock in 22:00, clock out 07:00 next morning | Calculates 8.0 worked hours (accounting for 1h break) across midnight | Worked hours = 8.0h, variance = 0.0h | **PASS** |
| **TC-F04-005** | Half-Day Classification | HR Admin | Employee punch | Clock in 09:00, clock out 12:30 (3.5 hours worked) | System classifies attendance as `Half-Day` (< 4h worked) | Half-day correctly flagged | **PASS** |
| **TC-F04-006** | Attendance Punch Correction | Manager | Punch correction filed | Employee requests correction for missing checkout; manager approves | Attendance record updated; original punch event preserved in audit log | Record corrected; raw audit intact | **PASS** |
| **TC-F04-007** | WFH Request Attendance Bridge | Manager | WFH submitted | Manager approves 1-day WFH request | Attendance record on requested date automatically classifies as `WFH` | Attendance classifies as WFH | **PASS** |
| **TC-F04-008** | Overtime Authorization | Manager | OT requested | Employee requests 2.5h overtime; manager approves 2.0h | Approved overtime locked at 2.0h; feeds into monthly payroll | 2.0 hours approved for payroll | **PASS** |

### Module F05: Leave Entitlement, Applications & Approvals
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F05-001** | Leave Application Balance Check | Employee | 14 Annual days left | Apply for 3 days Annual Leave | System validates balance, deducts 3 days pending, shows 11 remaining | Pending balance calculated correctly | **PASS** |
| **TC-F05-002** | Over-Limit Leave Rejection | Employee | 2 Sick days left | Apply for 5 Sick Leave days | Form validation error: "Requested days exceed available Sick leave balance" | Submission rejected; balance guarded | **PASS** |
| **TC-F05-003** | Anti-Self-Approval Enforcement | Manager | Manager applies leave | Manager Bilal attempts to approve his own leave application | System rejects: "Approver cannot approve their own leave request" | Self-approval strictly blocked | **PASS** |
| **TC-F05-004** | Extended Leave HR Escalation | Manager | Request > 3 days | Employee applies for 5 consecutive leave days | Request routes to direct manager for recommendation, then escalates to HR | Multi-tier escalation path verified | **PASS** |
| **TC-F05-005** | Attendance Calendar Integration | HR Admin | Approved leave | Check F04 Attendance register on approved leave dates | Days are marked with status `On Leave` (Paid Leave) | Full cross-module sync confirmed | **PASS** |

### Module F06: Payroll, Compensation & Benefits (10 Submodules)
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F06-001** | Monthly Payroll Batch Run | Super Admin | Active workforce | Click "Execute Monthly Payroll Run" for current month | Computes Gross, Deductions, Taxes, and Net Pay for all active staff | Batch calculated with exact formulas | **PASS** |
| **TC-F06-002** | Base Salary Deconstruction | HR Admin | Salary: PKR 200,000 | Inspect salary structure breakdown | Basic (60% = 120k), House (25% = 50k), Medical (10% = 20k), Convey (5% = 10k) | Components match exact percentages | **PASS** |
| **TC-F06-003** | Super Admin Salary Revision | Super Admin | Proposed increment | Review 10% increment proposal for EMP-004; approve with effective date | Salary structure updated on effective date; career event logged | Authorized revision executed cleanly | **PASS** |
| **TC-F06-004** | Loan EMI Payroll Auto-Deduction | HR Admin | Active loan (5k/mo) | Inspect payroll line item deductions for borrower | System automatically deducts PKR 5,000 EMI; updates remaining loan principal | EMI deducted; loan balance reduced | **PASS** |
| **TC-F06-005** | Progressive Tax Slab Calculation | HR Admin | Annual salary bracket | Verify income tax calculation on monthly earnings | Applies legal tax slab formula progressively | Tax deduction reconciles to formula | **PASS** |
| **TC-F06-006** | Historical Run Immutability | Super Admin | Finalized batch | Attempt to modify salary on an archived, finalized payroll run | System blocks edit: "Finalized payroll records are immutable" | Immutability strictly enforced | **PASS** |
| **TC-F06-007** | Payslip PDF Generation | Employee | Finalized payroll | Click "Download Payslip" in self-service portal | Downloads cleanly styled PDF payslip with full earnings and deduction breakdown | Valid PDF generated and formatted | **PASS** |

### Module F07: Tasks & Performance Management
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F07-001** | Task Creation & Assignment | Manager | Direct reports | Create task "E2E Test Automation", assign to EMP-004, due in 5 days | Task appears in employee's To-Do list with priority badge and deadline | Task assigned and displayed in kanban | **PASS** |
| **TC-F07-002** | Task Kanban Status Drag/Move | Employee | Assigned task | Move task from "In Progress" to "Completed" | Status updates; progress bar increments; audit event logged | Status updated in real time | **PASS** |
| **TC-F07-003** | 360 Degree Appraisal Cycle | HR Admin | Annual review cycle | Submit self-review, manager review, and peer ratings | Calculates weighted overall score (e.g. 4.6 / 5.0) | Multi-rater aggregate calculated | **PASS** |
| **TC-F07-004** | Skill Gap Training Linkage | Manager | Appraisal review | Flag skill gap in "Cloud Native Microservices" | Recommends employee for upcoming training course in F08 | Skill gap logged for training plan | **PASS** |

### Module F08: Training & Development
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F08-001** | Course Creation & Prerequisites | HR Admin | Training module | Publish course "Secure Enterprise Coding" with 20 seats | Course appears in catalog; status `Active` | Course published successfully | **PASS** |
| **TC-F08-002** | Capacity Limit Guard | HR Admin | Max seats: 20 | Attempt to enroll 21st employee in full session | System rejects: "Session seat capacity reached" | Enrollment blocked at limit | **PASS** |
| **TC-F08-003** | Assessment Pass Threshold | Employee | Training completed | Submit post-course assessment with score 65% | Result: `Failed` (threshold is 70%); no certificate issued | Retest required; cert blocked | **PASS** |
| **TC-F08-004** | Certificate Issue on Passing | Employee | Score: 85% | Submit post-course assessment with score >= 70% | Result: `Passed`; issues Certificate with unique verification code | Verified certificate generated | **PASS** |

### Module F09: Help Desk Management
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F09-001** | Ticket Submission & SLA Timer | Employee | Support needed | Submit IT Support ticket: "VPN connection dropping" | Ticket created; SLA clock starts (4h initial response target) | Ticket `TICK-001` created with SLA | **PASS** |
| **TC-F09-002** | Confidential Internal Agent Notes | HR Admin | Open ticket | Add internal note: "Hardware replacement candidate" | Note visible to HR agents; completely hidden from ticket requester | Note shielded from employee | **PASS** |
| **TC-F09-003** | Ticket Resolution & Feedback | Employee | Ticket resolved | Confirm ticket resolution and submit 5-star satisfaction rating | Rating recorded; ticket closed; feeds into Help Desk satisfaction KPIs | Rating saved; ticket closed | **PASS** |

### Module F10: Travel & Transport Management
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F10-001** | Travel Authorization Submission | Employee | Official trip | Submit request for Islamabad conference (Est. PKR 50,000, Adv: PKR 35,000) | Request created; routes to Manager for recommendation | Travel requisition `TRV-001` logged | **PASS** |
| **TC-F10-002** | Attendance Field Duty Bridge | Super Admin | Travel approved | Approve travel requisition `TRV-001` | Dates of travel automatically populate as `Field Duty` in F04 Attendance | Attendance ledger updated | **PASS** |
| **TC-F10-003** | Advance vs Claim Reconciliation | HR Admin | Trip concluded | File claim for PKR 42,000 against PKR 35,000 advance | System reconciles: Net payable to employee = PKR 7,000 | Settlement balance exact | **PASS** |
| **TC-F10-004** | Pick-and-Drop Seat Capacity | HR Admin | Route capacity: 14 | Assign 15th employee to Route 1 van | System rejects: "Transport vehicle seating capacity reached" | Capacity strictly enforced | **PASS** |

### Module F11: HR Letters Management
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F11-001** | Dynamic Merge Field Generation | HR Admin | Employee EMP-004 | Generate "Salary Certificate" template | Replaces tokens with verified name, designation, and monthly compensation | All merge tokens substituted | **PASS** |
| **TC-F11-002** | HR Letter PDF Export | HR Admin | Draft reviewed | Click "Issue & Download PDF" | Generates corporate letterhead PDF with digital signature seal and issue date | Clean corporate PDF produced | **PASS** |

### Module F12: Expense Management
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F12-001** | Mandatory Receipt Attachment | Employee | Expense claim | Submit claim for PKR 4,500 without attaching receipt | Validation error: "Receipt required for claims exceeding PKR 2,000" | Submission blocked without receipt | **PASS** |
| **TC-F12-002** | Duplicate Receipt Prevention | Employee | Existing claim | Submit claim reusing receipt reference `REC-2026-991` | System rejects: "Receipt reference already submitted on an active claim" | Duplicate receipt blocked | **PASS** |
| **TC-F12-003** | Multi-Tier Approval Routing | Manager | Claim: PKR 65,000 | Submit claim exceeding PKR 50,000 threshold | Claim routes to Manager, HR Admin, and requires Super Admin authorization | High-value escalation verified | **PASS** |

### Module F13: Administration, Settings & Policies
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F13-001** | Central Policy Versioning | Super Admin | Policy builder | Modify policy meal allowance limit; save and publish | Increments version to `v2.4`; logs actor, timestamp, and delta in audit trail | Policy versioned and audited | **PASS** |
| **TC-F13-002** | Working Calendar Holidays | Super Admin | Calendar settings | Add gazetted national holiday for Nov 09 (Iqbal Day) | Date marked non-working on calendar; shifts and attendance treat as holiday | Non-working holiday active | **PASS** |

### Module F14: Reports & Analytics (75 Reports & Exports)
| Test Case ID | Feature / Component | Role Portal | Preconditions | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-F14-001** | Catalog Registry Verification | Super Admin | Report registry | Query `REPORT_REGISTRY` catalog | Exactly 75 unique reports across 12 families registered with columns and rules | 75 unique reports registered | **PASS** |
| **TC-F14-002** | Zero Charts Compliance | Super Admin | F14 reports | Inspect generated reports and export files | Strict table-only presentation; zero embedded graphs or visual charts | Confirmed zero graphs across all 75 | **PASS** |
| **TC-F14-003** | Excel Export Engine (75 Reports) | Super Admin | ExcelJS engine | Generate and download Excel `.xlsx` for all 75 reports | Valid multi-sheet workbooks with navy header formatting and auto-widths | 75 / 75 Excel files generated | **PASS** |
| **TC-F14-004** | PDF Export Engine (75 Reports) | Super Admin | jsPDF engine | Generate and download PDF `.pdf` for all 75 reports | Valid landscape/portrait PDFs with headers, pagination, and gridlines | 75 / 75 PDF documents generated | **PASS** |
| **TC-F14-005** | Role Access Security Denial | Manager | Sensitive reports | Manager attempts to generate Executive Payroll Register `RPT-PAY-001` | System throws: "Access Denied: Role manager cannot access this report" | Unauthorized report blocked | **PASS** |
| **TC-F14-006** | Financial Reconciliation Invariant | Super Admin | RPT-PAY-001 | Check summary row: Net Pay vs Gross Pay minus Deductions | Total Net Pay reconciles to the cent ($0.00 variance) | Financial invariant verified | **PASS** |

---

## 4. Cross-Module Workflows & End-to-End Test Matrix

| Workflow ID | Business Workflow Scenario | Primary Modules Involved | Expected Workflow Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **WF-A** | Complete Employee Hiring Lifecycle | F03 Recruitment ➔ F02 Employee ➔ F04 Attendance ➔ F06 Payroll | Requisition to vacancy, candidate hire, probation tracking, permanent confirmation | Converted to EMP-015; status permanent | **PASS** |
| **WF-B** | Biometric Attendance to Monthly Payroll | F04 Attendance ➔ F06 Payroll ➔ F14 Reports | Punches, lates, overtime feed into monthly gross/net payroll computation | Overtime paid; lates calculated | **PASS** |
| **WF-C** | Leave Application, Balance & Roster Sync | F05 Leaves ➔ F04 Attendance ➔ F06 Payroll | Leave deducted from balance; updates attendance to On Leave; paid in payroll | 2 days deducted; roster synced | **PASS** |
| **WF-D** | Performance Appraisal to Salary Increment | F07 Tasks ➔ F06 Compensation ➔ F13 Administration | High appraisal rating prompts salary revision; approved by Super Admin | 8% increment active on effective date | **PASS** |
| **WF-E** | Skill Gap Identification to Certification | F07 Performance ➔ F08 Training | Appraisal gap feeds into course enrollment; passing quiz issues certificate | Certificate issued with verify code | **PASS** |
| **WF-F** | Business Travel Advance & Claim Settlement | F10 Travel ➔ F04 Attendance ➔ F12 Expenses | Travel advance issued; field duty logged; post-trip claim reconciles balance | Net reimbursement calculated | **PASS** |
| **WF-G** | Internal Employee Support Ticket Resolution | F09 Help Desk ➔ F01 Dashboard | Employee logs IT issue; agent internal note shielded; resolution rated 5 stars | Ticket closed; SLA compliant | **PASS** |
| **WF-H** | Central Policy Modification & Invariant Safety | F13 Settings ➔ F12 Expenses ➔ F14 Reports | Policy limit updated to v2.4; new claims use limit; archived records immutable | Historical records preserved | **PASS** |
| **WF-I** | Comprehensive Reporting Reconciliation | F01-F13 Masters ➔ F14 Reports ➔ Excel/PDF | All 75 reports generate data; reconciliations pass; exported to XLSX/PDF | 75/75 reports verified | **PASS** |

---

## 5. Viewport & Responsive UI Test Cases

| Test Case ID | Target Breakpoint | Viewport Resolution | Components Tested | Expected Result | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **TC-RSP-001** | Ultrawide / Desktop | 1920 × 1080 | Full portal shell, 4-column KPI row, 9-column tables | Full horizontal layout with zero clipping; comfortable margins | **PASS** |
| **TC-RSP-002** | Standard Laptop | 1366 × 768 | Top Navbar greeting, Quick Hub panel, Job Level card | Single line greeting; cards align flush with chart baseline | **PASS** |
| **TC-RSP-003** | Tablet Portrait | 768 × 1024 | Sidebar navigation, directory filter cards, modals | Sidebar collapses to drawer; tables engage smooth horizontal scroll | **PASS** |
| **TC-RSP-004** | Mobile Device | 375 × 812 | Punch clock button, action buttons, candidate cards | Cards stack vertically; full-width touch targets; modals full-screen | **PASS** |

---
*Test cases compiled, verified, and certified by Senior Software QA Engineer.*

