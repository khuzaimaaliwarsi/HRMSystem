# iSysware HRMS — Backend API Architecture, Database & Security

Welcome to the backend service of the **iSysware HRMS Enterprise Suite**.

This backend is built on **Node.js + Express.js**, **Prisma ORM (v6.19.3)**, and **PostgreSQL 18.6** (`aliyan_hrms_dev`). It provides a modular, production-ready REST API architected to support the complete 5-portal HRMS architecture (Super Admin, HR/Admin, Department Manager, Team Lead, Employee).

---

## 1. Architecture Overview

- **Runtime**: Node.js (`>=18.0.0`, verified with `v24.18.0`)
- **Web Framework**: Express.js 4.21.2 (ES Modules)
- **Database Engine**: PostgreSQL 18.6
- **Target Database**: `aliyan_hrms_dev`
- **ORM / Query Builder**: Prisma 6.19.3
- **Database Tables**: 62 tables (61 domain models + 1 migration tracking table)
- **Authentication**: Argon2id + Short-lived JWT (15m) + SHA-256 Hashed Refresh Tokens (7d in `sessions`) + Replay Theft Detection
- **Authorization**: 5-Portal Server-Side RBAC, Organizational Scope Verification, Anti-Self-Approval Guard, Protected Super Admin Safeguards
- **Domain Modules**: Organization Management (Departments, Sub-Departments, Teams, Designations, Hierarchy) & Canonical Employee Management (Lifecycle, Lateral Transfers, Promotions, Statuses, Career History, Documents)
- **API Prefix**: `/api/v1`
- **Deployment Compatibility**: Local server (`src/server.js`) & Vercel Serverless (`api/index.js`)

```
backend/
├── api/
│   └── index.js                 # Serverless entry point (Vercel handler)
├── docs/
│   ├── DATABASE_ARCHITECTURE.md # ERD, table catalog, module mapping
│   ├── SCHEMA_RELATIONSHIPS.md  # 75 FKs, constraints, referential actions
│   ├── MIGRATION_GUIDE.md       # Safe migration procedures & commands
│   ├── BUSINESS_INVARIANTS.md   # SHIFT-ISOLATION-01, approval rules, financial precision
│   ├── AUTHENTICATION_AND_RBAC.md # Token lifecycle, sessions, RBAC, scope, bootstrap
│   └── ORGANIZATION_AND_EMPLOYEE_APIS.md # Organization & Employee API contracts
├── prisma/
│   ├── migrations/
│   │   └── 20261105001924_init_hrms_schema/
│   │       └── migration.sql    # Applied baseline migration SQL
│   └── schema.prisma            # Complete Prisma schema definition (61 models, 28 enums)
├── src/
│   ├── config/
│   │   ├── env.js               # Environment validation, JWT/session config & defaults
│   │   └── database.js          # Prisma client singleton & connection health probe
│   ├── middleware/
│   │   ├── auth.js              # authenticate, requireRoles, requireEmployeeScope, antiSelfApproval
│   │   ├── rateLimit.js         # Brute-force rate limiting middleware
│   │   ├── errorHandler.js      # Centralized error handler & Prisma error mapper
│   │   ├── logger.js            # HTTP request logging via Morgan
│   │   └── notFound.js          # Standardized 404 handler
│   ├── routes/
│   │   ├── authRoutes.js        # Login, refresh, logout, logout-all, me, password, bootstrap
│   │   ├── organizationRoutes.js# Departments, sub-departments, teams, designations, hierarchy
│   │   ├── employeeRoutes.js    # Employee CRUD, transfers, promotions, status, documents
│   │   ├── healthRoutes.js      # Liveness & database diagnostic endpoints
│   │   └── index.js             # Master API v1 route aggregator
│   ├── scripts/
│   │   ├── bootstrapAdmin.js    # CLI tool to provision initial protected Super Admin
│   │   ├── verifyDb.js          # CLI connectivity probe (npm run db:verify)
│   │   └── verifySchema.js      # CLI schema table & constraint verification
│   ├── services/
│   │   ├── authService.js       # Core authentication, session management & audit logging
│   │   ├── organizationService.js# Org structure, team assignments, anti-circular hierarchy
│   │   └── employeeService.js   # Employee lifecycle, transfers, promotions, masking
│   ├── utils/
│   │   ├── crypto.js            # Argon2id hashing, SHA-256 token hashing, password validator
│   │   ├── jwt.js               # Short-lived access token signing and verification
│   │   └── response.js          # Standardized API response formatters
│   ├── app.js                   # Express app factory (used by tests & serverless)
│   └── server.js                # Local development HTTP server runner
├── tests/
│   ├── auth.test.js             # Authentication, session lifecycle & replay detection tests
│   ├── db.test.js               # Database connection probe tests
│   ├── employee.test.js         # Employee CRUD, masking, transfers, career history tests
│   ├── env.test.js              # Environment validation unit tests
│   ├── health.test.js           # Health endpoints & error handler integration tests
│   ├── organization.test.js     # Department, team, designation & anti-circular reporting tests
│   ├── rbac.test.js             # 5-Portal RBAC, scope, anti-self-approval & protection tests
│   └── schema.test.js           # Batch 2 schema constraints & invariant tests
├── .env.example                 # Template with safe configuration documentation
├── package.json                 # Backend scripts and dependencies
└── README.md                    # This documentation
```

---

## 2. API Response & Error Contract

All API responses strictly adhere to a predictable contract:

### Success Response Format
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "message": "Human-readable confirmation (Sonner compatible)"
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Sanitized explanation",
    "details": null
  }
}
```

---

## 3. Developer & Verification Commands

### A. Run Database Connectivity Probe
```bash
npm --prefix backend run db:verify
```

### B. Verify Relational Schema & Constraints
```bash
npm --prefix backend run db:schema
```

### C. Run All Backend Tests (121 Tests Across 15 Suites)
```bash
npm --prefix backend test
```

### D. Bootstrap Protected Super Admin
```bash
npm --prefix backend run admin:bootstrap
```

---

## 4. Completed Batches

- [x] **Backend Batch 1**: Foundation, Express App, Serverless Handler, Centralized Error Handling, Morgan Logger, `/api/v1/health`, Database Health Probe.
- [x] **Backend Batch 2**: Complete PostgreSQL Database Schema (61 models, 28 enums, 75 FKs, 114 unique constraints/indexes, `SHIFT-ISOLATION-01` enforcement, Decimal monetary precision, audit logs, safe initial migration applied to `aliyan_hrms_dev`).
- [x] **Backend Batch 3**: Secure Authentication, Sessions & Server-Side RBAC (Argon2id password hashing, short-lived JWT access tokens, SHA-256 hashed refresh tokens in `sessions`, token rotation with replay/theft detection, 5-portal role enforcement, organizational scope verification, anti-self-approval guards, protected Super Admin bootstrap mechanism).
- [x] **Backend Batch 4**: Organization & Employee Management APIs (Departments, Sub-Departments, Teams, Designations, Hierarchy, Anti-Circular Reporting, Canonical Employee CRUD, Lateral Transfers, Promotions, Sensitive Data Masking, Career History, Documents Metadata).
- [x] **Backend Batch 5**: Attendance, Shifts, Overtime, WFH, Field Duty & Leave Management APIs (Deterministic employee shift isolation `SHIFT-ISOLATION-01`, Asia/Karachi time calculations, grace periods, lateness & early exits, future date `SCHEDULED` classification, `0 scheduled -> "N/A"` attendance rate rule, regularization & anti-self-approval, overtime minimum policy threshold, WFH date deduplication, Field Duty single-approver finality under "No Duration Limit" policy, Leave entitlement tracking, annual sequence threshold escalation: requests 1 & 2 -> TL / 3+ -> DM, idempotent balance ledger reversals in `leave_balance_journals`).
- [x] **Backend Batch 6A**: Payroll, Compensation, Salary Processing & Payslip APIs (Decimal currency precision, effective-dated salary structures, allowances, formal salary revision proposal & Super Admin approval, anti-self-approval, Pakistan FBR Section 149 income tax engine, monthly payroll run lifecycle: Draft -> Submit -> Approve -> Disburse, duplicate run protection, attendance unpaid leave deductions, approved overtime compensation, employee self-service payslip privacy scoping, structured payslip breakdown, and executive departmental summary reports).
- [x] **Backend Batch 6B**: Critical Payroll Formula Corrections, Owner-Approved Leave Policy, Loans & Compensation:
  - **Fixed 31-Day Salary Divisor**: Base salary daily rate divisor is ALWAYS 31 for all months (`Daily Basic Rate = Monthly Basic Salary / 31`). Full monthly salary is preserved for fully eligible employees (February 28-day month receives 100% full monthly salary).
  - **Owner-Approved Monthly Leave Policy**: Exactly 2 company-allowed leave days per calendar month incur **ZERO salary deduction** (PKR 0). Starting from the 3rd eligible leave day, deduct **exactly PKR 500 per additional leave day** (`extraLeaveDeduction = max(0, leaveDays - 2) * 500`). **Never deduct `Basic Salary / 31` for eligible company leaves**. Baseline scenario: Basic PKR 62,000 with 4 eligible leaves $\implies$ Deduction = PKR 1,000, Remaining Basic Salary = **PKR 61,000** (NOT PKR 58,000).
  - **31-Day Hourly Overtime Formula**: Standard hourly rate derived from `(baseSalary / 31) / shift.standardHours`, with overtime pay at $1.5\times$ multiplier.
  - **Employee Loans & Salary Advances**: Full lifecycle (`/api/v1/payroll/loans`) with application, anti-self-approval review, disbursement, automated payroll deduction snapshotting, ledger repayment posting, and direct settlement.
  - **Payment Disbursement Integrity**: Explicit disbursement transaction requiring payment metadata (`paymentMethod`, `transactionReference`, non-future `paymentDate`), immutable attribution (`disbursedById`, `disbursedAt`), `AuditLog` generation, and preventing duplicate disbursement (`400 ALREADY_DISBURSED`).
  - **Structured Salary Liability Accounting**: Negative net salary is capped at 0 and deficits are recorded via dedicated PostgreSQL model `SalaryLiability` (`salary_liabilities`) and column `payroll_entries.unrecoveredLiability Decimal(12, 2)`.
  - **Effective-Dated Statutory Tax Schedules**: Multi-year FBR Section 149 schedules with explicit `MISSING_TAX_CONFIGURATION` error when date is outside configured schedules.
- [x] **Backend Batch 6C**: Recruitment, Tasks, Performance, Training, Expenses, Reports & Administration APIs (Requisitions, candidates, interviews, offers, onboarding, tasks, performance cycles, training catalog & certification, travel & expense claims, aggregate reports, system settings & security audits).
- [x] **Backend Batch 7A**: Frontend–Backend Integration Foundation & Critical Gap Closure:
  - **Expense Category Master**: Complete lifecycle (`GET/POST/PATCH/DELETE /api/v1/expenses/categories`) with configurable limits, receipt requirements, status deactivation, and safe delete protection enforcing active claim history integrity.
  - **Configurable Policies & Invariants**: Organization policies endpoint (`/api/v1/admin/policies`) with effective dating and audit history. Enforces strict immutability of 31-day salary divisor (`403 FINANCIAL_RULE_PROTECTED`) and restricts financial leave deduction rules to Super Admin.
  - **Reimbursement Disbursement Reconciliation**: Payment account reference (`paymentAccount`) is strictly validated and recorded in permanent audit logs.
  - **Authentication Integration**: Cut over React frontend session management to `/api/v1/auth/*` using secure HttpOnly cookies (`access_token`, `refresh_token`). Removed client-side JWT storage in `localStorage`. Authentic errors returned with zero mock fallback in production/browser mode.
  - **Centralized API Client (`frontend/src/services/apiClient.js`)**: Environment-aware base URL, Vite dev proxy (`/api` -> port 5000), `credentials: 'include'`, silent token auto-refresh on 401 with concurrency request queueing, and unified error mapping.
  - **Global Sonner Notifications**: Integrated `<Toaster />` across all 5 portals with standard toast utility (`frontend/src/lib/notify.js`).

---

## 5. Verification Evidence Summary

- **Backend Test Suite**: **121 / 121 tests pass across 15 suites (0 failures)**.
- **Frontend Regression Suite**: **552 / 552 tests pass across 16 suites (0 failures)**.
- **Frontend Production Build**: **Clean build in 8.30s (0 errors)**.
- **PostgreSQL Database State (`aliyan_hrms_dev`)**: **Pristine, 0 mock records (`{"users":0,"employees":0,"payrollRuns":0,"loans":0,"claims":0,"tasks":0,"requisitions":0}`)**.
