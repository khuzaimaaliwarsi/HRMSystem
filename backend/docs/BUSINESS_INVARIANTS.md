# iSysware HRMS — Database Schema Business Invariants (Batch 2)

This document describes the critical business invariants, approval rules, and statutory calculation constraints embedded into the database schema.

---

## 1. Shift Isolation Architecture (`SHIFT-ISOLATION-01`)

### Defect Background
In earlier frontend mock states, assigning an employee (e.g. Ahmed Khan / `EMP-005`) to a new shift (`QA Test Morning Shift`) caused other employees on the register to inadvertently inherit that shift when no explicit per-employee assignment existed.

### Schema Enforcement
1. **Isolated Assignment Model (`shift_assignments`)**:
   - Every shift assignment is keyed explicitly to `(employeeId, shiftId, effectiveFrom)`.
   - Has status (`ACTIVE`, `INACTIVE`, `SUPERSEDED`) and effective date boundaries (`effectiveFrom`, `effectiveUntil`).
2. **Explicit Snapshots in Attendance Records (`attendance_records`)**:
   - Each daily attendance record persists `shiftId` and frozen strings: `shiftNameSnapshot`, `shiftStartTimeSnapshot`, `shiftEndTimeSnapshot`.
   - Daily attendance resolves deterministically for the individual employee on that business date. An employee without an explicit assignment resolves to the canonical default corporate shift (`shifts.isDefault = true`).
3. **No Global Fallbacks**:
   - Services and queries never select `shifts[0]` or fall back to an arbitrary employee's shift.

---

## 2. Leave Management & Approval Tier Invariants

### Approved Multi-Tier Approval Rules
1. **Normal Employee Routing**:
   - 1st & 2nd qualifying leave request in a calendar year → **Team Lead** (`routingTier = "TEAM_LEAD"`).
   - 3rd and subsequent requests → **Department Manager** (`routingTier = "DEPT_MANAGER"`).
2. **Team Lead Routing**:
   - 1st & 2nd qualifying leave request in a calendar year → **Department Manager**.
   - 3rd and subsequent requests → **HR Admin**.
3. **Request Counting, Not Days**:
   - The threshold tracks `annualSequenceNumber` (count of qualifying requests in calendar year), NOT cumulative leave days.
   - Cancelled and rejected requests do NOT consume the annual sequence quota.
4. **Single-Approver Finality**:
   - The first valid approval by an authorized role immediately marks the request `APPROVED`. No secondary endorsement or endorsement loop is required.
5. **Anti-Self-Approval**:
   - Requesters can never approve their own requests (`approvedById != employeeId`).
6. **Idempotent Cancellation Reversals**:
   - `leave_balance_journals` records transaction type `REVERSAL` with `referenceRequestId` to prevent double-refunds of utilized leave balance upon cancellation.

---

## 3. Field Duty Approval Policies

The database supports all three configured Field Duty approval modes:
1. **No Duration Limit**:
   - Either the employee's Team Lead or Department Manager can directly approve the request. First valid decision becomes `Final Approved`.
2. **Duration-Based Limits**:
   - $\le 4.0\text{h}$ → Team Lead.
   - $4.1\text{h} - 9.0\text{h}$ → Department Manager.
   - $> 9.0\text{h}$ → HR Admin / Super Admin.
3. **Manager Approval Only**:
   - Bypasses Team Lead entirely and routes directly to Department Manager.

---

## 4. Financial & Payroll Precision Invariants

1. **Exact Currency Representation**:
   - All financial amounts use PostgreSQL `NUMERIC` / `DECIMAL(12, 2)` or `DECIMAL(14, 2)`.
   - Default configured currency is `PKR`.
   - Zero floating-point rounding errors.
2. **Salary Independence**:
   - Employee promotions, designation changes, or department transfers recorded in `employee_career_history` **NEVER** mutate employee salary or compensation.
   - Salary changes require an independent `salary_revisions` proposal requiring Super Admin final authorization.
3. **Historical Payroll Immutability**:
   - `payroll_entries` store a point-in-time snapshot of basic salary, allowances, tax, overtime, loans, and net pay.
   - Updating an employee's `salary_structures` never modifies historical `payroll_entries`.
   - Duplicate payroll runs for the same period and employee are blocked by `@@unique([payrollRunId, employeeId])`.

---

## 5. Security & Account Protection Invariants

1. **Root Super Admin Protection**:
   - `users.isProtected = true` prevents the primary Super Admin (`EMP-001`) from being demoted or deleted.
2. **Hashed Credential Storage**:
   - Passwords and refresh tokens are stored exclusively as secure hashes (`passwordHash`, `tokenHash`). Raw secrets are never stored.
3. **Immutable Audit Attribution**:
   - Every sensitive business action records `actorUserId`, `actorEmployeeCode`, `actorRole`, `actionType`, `sourceModule`, `recordSnapshotBefore`, `recordSnapshotAfter`, and `ipAddress` in `audit_logs`.
   - Audit logs have no delete cascade and remain permanent historical records.

---

## 6. Payroll Calculation & Leave Invariants (`PAYROLL-DIVISOR-31` & `LEAVE-DEDUCTION-01`)

1. **Fixed 31-Day Salary Divisor (`PAYROLL-DIVISOR-31`)**:
   - The basic salary daily rate is calculated strictly with divisor 31: `Daily Basic Salary = Monthly Basic Salary / 31`.
   - Divisor is always 31 regardless of calendar month days (Jan 31d, Feb 28/29d, Apr 30d). Full basic salary preserved in February if employee has zero unapproved absences.
   - Used exclusively for explicit unauthorized absences and shift-aware hourly overtime.
2. **Owner-Approved Leave Deduction Formula (`LEAVE-DEDUCTION-01`)**:
   - Each employee is entitled to **2 company-allowed leave days per month** at **zero salary deduction**.
   - Starting from the 3rd eligible leave day, deduct **exactly PKR 500 per additional leave day** placed under `otherDeductions`.
   - **Never deduct `Basic Salary / 31` for eligible company leaves**, and never add daily basic salary deduction on top of PKR 500.
   - Formula: `ExtraLeaveDays = max(0, EligibleLeaveDays - 2)`, `ExtraLeaveDeduction = ExtraLeaveDays * 500`.
   - Baseline example: Basic Salary PKR 62,000 with 4 eligible leaves in a month $\implies$ Deduction = PKR 1,000, Remaining Basic Salary = **PKR 61,000** (NOT PKR 58,000).
3. **Structured Negative Net Salary Accounting (`SalaryLiability`)**:
   - Deficits where deductions exceed earnings are capped at 0 net pay and recorded in dedicated PostgreSQL model `SalaryLiability` and column `payroll_entries.unrecoveredLiability Decimal(12, 2)`.
4. **Disbursement Attribution & Anti-Tamper Safeguards**:
   - Payroll disbursement requires valid non-future `paymentDate`, valid `paymentMethod`, mandatory `transactionReference`, attribution snapshots (`disbursedById`, `disbursedAt`), and immutable `AuditLog` generation. Re-disbursement is strictly rejected with `400 ALREADY_DISBURSED`.


