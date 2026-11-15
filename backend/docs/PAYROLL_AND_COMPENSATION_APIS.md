# iSysware HRMS — Payroll, Compensation, Salary Processing & Payslip APIs (Batch 6A & 6B)

## 1. Overview & Architectural Boundaries

Backend Batch 6 delivers the production PostgreSQL-backed financial engine for the Aliyan HRMS Enterprise Suite. All calculations use Decimal-accurate minor arithmetic (PKR), deterministic monthly lifecycle tracking (`DRAFT` $\to$ `PENDING_APPROVAL` $\to$ `APPROVED` $\to$ `DISBURSED`), immutable finalized calculation snapshots, progressive salary tax withholding per Pakistan FBR Section 149 (with effective-dated schedules), strict anti-self-approval safeguards, employee loans/advances ledger recovery, and confidential employee payslip scoping.

---

## 2. Salary Structures & Compensation (`/api/v1/payroll/structures`, `/api/v1/payroll/revisions`)

### Effective-Dated Structures
- Each employee can have multiple historical `SalaryStructure` records, but only **one** `isCurrent = true` record at any point in time.
- Adding a new structure automatically supersedes previous active structures (`isCurrent: false`, `effectiveUntil: effectiveDate`).
- Component breakdown:
  - `baseSalary`: Fundamental contractual wage.
  - `houseRentAllowance`: Configurable accommodation benefit.
  - `medicalAllowance`: Standard healthcare coverage.
  - `conveyanceAllowance`: Mobility benefit.
  - `specialAllowance`: Discretionary fixed allowance.
  - `grossSalary` $= \text{baseSalary} + \sum \text{allowances}$.

### Salary Revision Governance
- Formal proposal workflow: HR Admin or Super Admin initiates proposal via `POST /api/v1/payroll/revisions`.
- Supports `ANNUAL_INCREMENT`, `PROMOTION_INCREMENT`, `MARKET_ADJUSTMENT`, `PERFORMANCE_DECREMENT`, and `OTHER`.
- Automatically snapshots `previousBaseSalary` and `previousGrossSalary`.
- Final approval is strictly restricted to `SUPER_ADMIN`.
- **Anti-Self-Approval**: Super Admin or HR cannot approve their own proposed salary revision (`403 SELF_APPROVAL_PROHIBITED`).
- On approval, the engine supersedes the active salary structure and activates a new current structure.

### Endpoints
| Method | Endpoint | Authorized Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/payroll/structures` | Authenticated | Lists salary structures (scoped to employee self-service or admin) |
| `GET` | `/api/v1/payroll/structures/:employeeId` | Authenticated | Current and historical compensation (403 on probing others) |
| `POST` | `/api/v1/payroll/structures` | `SUPER_ADMIN`, `HR_ADMIN` | Assigns effective-dated salary structure |
| `GET` | `/api/v1/payroll/revisions` | Authenticated | Lists salary revision proposals |
| `POST` | `/api/v1/payroll/revisions` | `SUPER_ADMIN`, `HR_ADMIN` | Proposes a salary increment / adjustment |
| `PATCH` | `/api/v1/payroll/revisions/:id/review` | `SUPER_ADMIN` | Approves or rejects revision (Anti-Self-Approval enforced) |

---

## 3. Authoritative Payroll Calculation Rules (Batch 6B Mandatory Invariants)

The latest owner-approved salary, leave, and overtime rules below supersede prior assumptions:

### 1. Fixed 31-Day Salary Divisor
- The salary daily-rate divisor is **ALWAYS 31**, regardless of the month's actual calendar days (January 31d, February 28/29d, April 30d, etc.).
- **Mandatory Daily Rate Formula**:
  $$\text{Daily Basic Rate} = \frac{\text{Monthly Basic Salary}}{31}$$
- **Full Monthly Salary Preservation**:
  - Full monthly basic salary is preserved for fully eligible employees. In February (28 days), an employee with zero unpaid days receives 100% full monthly basic salary, never $28/31$ or $28/30$.
- **Unpaid Absence Deduction**:
  $$\text{Unpaid Basic Salary Deduction} = \text{round}\left(\frac{\text{Monthly Basic Salary}}{31} \times \text{Unpaid Days}\right)$$
  - *Example*: An employee with basic salary PKR 62,000 has a daily rate of $62,000 / 31 = \text{PKR } 2,000$. Taking 2 unpaid days results in a deduction of $2,000 \times 2 = \text{PKR } 4,000$, leaving PKR 58,000 basic earnings.
  - The base salary divisor is **never** $/30$, calendar days, or working days.

### 2. Owner-Approved Monthly Leave Policy (Zero Deduction for First 2 Days, Exactly PKR 500 Per Extra Day)
- Company policy allows exactly **2 company-allowed leave days** per calendar month.
- **Allocation & Deduction Engine**:
  - The first 2 approved eligible leave days in a calendar month incur **ZERO salary deduction** ($\text{deduction} = 0$).
  - Starting from the 3rd eligible leave day, deduct **exactly PKR 500 per additional leave day** placed under `otherDeductions` (`extraLeaveDeduction`).
  - **NEVER deduct $\text{Basic Salary} / 31$ for eligible leaves**, and do not add daily basic salary deduction on top of the PKR 500.
  - **Exact Formulas**:
    $$\text{Extra Leave Days} = \max(0, \text{Eligible Monthly Leave Days} - 2)$$
    $$\text{Extra Leave Deduction} = \text{Extra Leave Days} \times 500\text{ PKR}$$
    $$\text{Basic Salary Deductions for Approved Leaves} = 0$$
  - **Explicit Scenario**: For an employee with Basic Salary = PKR 62,000 taking 4 eligible leave days in the month:
    - First 2 leaves: PKR 0 deduction
    - 3rd & 4th leaves (2 extra days): $2 \times 500 = \text{PKR } 1,000$ deduction
    - **Total Leave Deduction** = PKR 1,000
    - **Remaining Basic Salary** = $\text{PKR } 62,000 - 1,000 = \textbf{PKR 61,000}$ *(NOT PKR 58,000!)*
- **Absence vs. Leave Invariant**:
  - The fixed 31-day divisor ($\text{baseSalary} / 31$) is strictly reserved for *explicit unauthorized absences / explicitly unpaid leaves* and shift-aware hourly overtime.
  - Approved company leaves never incur the 31-day basic salary daily deduction.
- **Monthly Reset & Reconciliation**:
  - Reset monthly per `Asia/Karachi` calendar month.
  - Multi-day leaves spanning month boundaries (e.g., Oct 30 – Nov 2) apportion exact days into their respective calendar months.
  - Cancelled and rejected leaves incur ZERO deduction and do not consume the 2-day quota.
  - Attendance punches and leave days are reconciled without double-counting.

### 3. 31-Day Hourly Overtime Formula
- Standard overtime hourly rate is derived from the resolved shift's standard daily paid hours (e.g., 8 hours / 480 minutes) and the fixed 31-day daily rate:
  $$\text{Standard Hourly Rate} = \frac{\text{Monthly Basic Salary} / 31}{\text{Standard Paid Hours Per Day}}$$
  $$\text{Overtime Pay} = \text{round}(\text{Approved Overtime Hours} \times \text{Standard Hourly Rate} \times \text{Multiplier})$$
  - Default multiplier is $1.5\times$ unless configured otherwise.
  - *Example*: At PKR 62,000 basic salary and an 8-hour shift, daily rate $= \text{PKR } 2,000$, hourly rate $= 2,000 / 8 = \text{PKR } 250$. At $1.5\times$, 4 hours overtime yields $4 \times 250 \times 1.5 = \text{PKR } 1,500$.

### 4. Configurable Effective-Dated Tax Engine (Pakistan FBR Section 149)
- Tax schedules support explicit effective date ranges (`effectiveFrom` to `effectiveTo`).
- Annual projected income $= \text{round}(\text{Monthly Taxable Gross} \times 12)$.
- Withholding tax slabs (Tax Year 2025-2026 and 2026-2027):
  - **Slab 1** ($\le 600,000$ PKR): 0%
  - **Slab 2** ($600,001 - 1,200,000$ PKR): 5% of amount $> 600,000$
  - **Slab 3** ($1,200,001 - 2,200,000$ PKR): $30,000 + 15\%$ of amount $> 1,200,000$
  - **Slab 4** ($2,200,001 - 3,200,000$ PKR): $180,000 + 25\%$ of amount $> 2,200,000$
  - **Slab 5** ($3,200,001 - 4,100,000$ PKR): $430,000 + 30\%$ of amount $> 3,200,000$
  - **Slab 6** ($> 4,100,000$ PKR): $700,000 + 35\%$ of amount $> 4,100,000$
- If a payroll date falls outside all configured schedules, the engine throws an explicit `MISSING_TAX_CONFIGURATION` error.

### 5. Negative Net Salary & Structured Salary Liability Accounting
- If total statutory and voluntary deductions exceed gross earnings, $\text{netSalary}$ is capped at 0 (never negative).
- Instead of raw string hacks, the deficit is tracked via a dedicated PostgreSQL ledger:
  - Model: `SalaryLiability` (`salary_liabilities`)
  - Columns: `liabilityNumber`, `employeeId`, `payrollPeriodId`, `payrollEntryId`, `originalAmount`, `outstandingBalance`, `recoveredAmount`, `status` (`OUTSTANDING, PARTIALLY_RECOVERED, RECOVERED, WRITTEN_OFF`).
  - Recorded on `payroll_entries.unrecoveredLiability` as structured monetary value `DECIMAL(12, 2)`.
  - Enables transparent multi-month deficit recovery against future payroll earnings without data loss.

### 6. Payroll Disbursement Attribution & Verification Integrity
- `PATCH /api/v1/payroll/runs/:id/disburse` strictly enforces:
  - Required non-empty `transactionReference`.
  - Allowed `paymentMethod` (`BANK_TRANSFER`, `CHEQUE`, `CASH`).
  - Strict date validation: `paymentDate` must be valid ISO `YYYY-MM-DD` and cannot be a future date (`paymentDate <= today`).
  - Immutable attribution: Persists `disbursedById` (authenticated user) and `disbursedAt` (timestamp) on `payroll_runs`.
  - System audit: Creates an `AuditLog` entry with action `DISBURSE` and full monetary snapshot.
  - Duplicate guard: Second disbursement attempt immediately rejected with `400 ALREADY_DISBURSED`.

---

## 4. Employee Loans & Salary Advances Subsystem (`/api/v1/payroll/loans`)

### Lifecycle & Invariants
```
[ PENDING ] ──▶ [ APPROVED ] ──▶ [ DISBURSED ] ──▶ [ REPAID ]
    │               │
    ▼               ▼
[ REJECTED ]   [ CANCELLED ]
```
- **Application**: Employee or HR applies with `principalAmount`, `repaymentMonths` (tenure 1–60 months), and `loanType`.
- **Anti-Self-Approval**: Super Admin or HR cannot review or approve their own loan applications (`403 SELF_APPROVAL_PROHIBITED`).
- **Disbursement**: When authorized by Super Admin via `/loans/:id/disburse`, the loan status becomes `DISBURSED` with `remainingBalance = principalAmount`.
- **Automated Payroll Deduction**: During payroll draft generation, active disbursed loans are snapshotted (`loanDeduction = min(monthlyInstallment, remainingBalance)`).
- **Repayment Ledger Posting**: Upon payroll run disbursement (`/runs/:id/disburse`), the engine posts a `LoanRepayment` record (`paymentSource: 'PAYROLL_DEDUCTION'`), decrements `remainingBalance`, increments `totalRepaidAmount`, and transitions the loan to `REPAID` when the balance reaches 0.
- **Direct Repayment**: Supports direct cash/bank settlement via `POST /loans/:id/repay`.

### Loan Endpoints
| Method | Endpoint | Authorized Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/payroll/loans` | Authenticated | Lists loans (scoped to employee self-service or admin) |
| `GET` | `/api/v1/payroll/loans/:id` | Authenticated | Single loan details with repayment ledger history |
| `POST` | `/api/v1/payroll/loans` | Authenticated | Submits loan application |
| `PATCH` | `/api/v1/payroll/loans/:id/review` | `SUPER_ADMIN`, `HR_ADMIN` | Approves or rejects loan application (Anti-Self-Approval enforced) |
| `POST` | `/api/v1/payroll/loans/:id/disburse` | `SUPER_ADMIN` | Disburses approved loan with payment reference |
| `POST` | `/api/v1/payroll/loans/:id/repay` | `SUPER_ADMIN`, `HR_ADMIN` | Records direct loan repayment transaction |

---

## 5. Payroll Runs & Disbursement Integrity (`/api/v1/payroll/runs`)

### Processing Lifecycle
```
[ OPEN Period ]
       │
       ▼
 [ POST /runs/generate ] ──▶ DRAFT (Snapshots attendance, leaves, overtime, tax & loans)
       │
       ▼
 [ PATCH /runs/:id/submit ] ──▶ PENDING_APPROVAL (Submitted for Super Admin audit)
       │
       ▼
 [ PATCH /runs/:id/approve ] ──▶ APPROVED (Calculations frozen immutably)
       │
       ▼
 [ PATCH /runs/:id/disburse ] ──▶ DISBURSED (paymentStatus = 'PAID', paidAt stamped, loan ledgers posted)
```

### Payment Integrity Guards
- **Explicit Disbursement**: Generating or approving a run never marks payment as completed. The run transitions to `DISBURSED` with `paymentStatus = 'PAID'` and timestamp only when an authorized disbursement transaction is executed.
- **Payment Metadata**: Accepts `paymentMethod`, `transactionReference`, and `paymentDate`.
- **Duplicate Disbursement Prevention**: Once disbursed, calling `/disburse` again returns `400 ALREADY_DISBURSED`.
- **Duplicate Run Protection**: Rejects generating a new run if a non-void run already exists for the period (`409 DUPLICATE_PAYROLL_RUN`).

---

## 6. Payslips & Reporting (`/api/v1/payroll/payslips`, `/api/v1/payroll/summary`)

- **Employee Confidentiality**: Employees only receive payslips belonging to their own employee ID (`403` on querying another employee).
- **Executive Period Summary**: Returns total employees, total gross, total deductions, total net payroll liability, and departmental cost breakdown for executive dashboards.

---

## 7. Verification & Test Evidence

```bash
# Backend Test Suite (Batches 1 to 6B)
npm --prefix backend test
# Result: 103 / 103 tests passed across 13 suites (0 failures)

# Frontend Regression Suite
npm --prefix frontend test -- --run
# Result: 552 / 552 tests passed across 16 suites (0 failures)

# Frontend Production Build
npm --prefix frontend run build
# Result: Clean build in 7.05s

# PostgreSQL Database State (aliyan_hrms_dev)
# Result: {"users":0,"employees":0,"payrollRuns":0,"loans":0} (Pristine, 0 mock data)
```
