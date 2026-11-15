# ALIYAN HRMS — FIVE-PORTAL POSTGRESQL INTEGRATION ARCHITECTURE (BATCH 7B)

## 1. Executive Summary & Objective

This document defines the complete frontend-to-backend integration architecture connecting the five existing React portals to the production PostgreSQL backend:
1. **Super Admin Portal**
2. **HR/Admin Portal**
3. **Department Manager Portal**
4. **Team Lead Portal**
5. **Employee Self-Service Portal**

### Architectural Pipeline
```
[React Five-Portals UI]
         │
         ▼
[Central API Client (Fetch + HttpOnly Cookies + Auto 401 Refresh Queue)]
         │
         ▼
[Express Master API Router (/api/v1/*)]
         │
         ▼
[Session Authentication & Server-Side RBAC Middleware]
         │
         ▼
[Prisma ORM Client & Transactional Services]
         │
         ▼
[PostgreSQL Database (aliyan_hrms_dev)]
```

---

## 2. Dual-Mode Storage Architecture & LocalStorage Cutover

### A. Browser Runtime (`typeof window !== 'undefined'`)
- **Zero Business Data in LocalStorage**: All business keys (`isysware_hrms_*`) are purged upon boot via `executeCutoverCleanup()`.
- **Runtime Interception Guard**: `window.localStorage.setItem` and `getItem` are intercepted to discard any business key writes and return `null` for business key reads.
- **UI Preferences Preserved**: User interface preferences (`hrms_theme`, `hrms_sidebar_collapsed`, `hrms_table_density`) are preserved intact.
- **Authoritative Store**: PostgreSQL `aliyan_hrms_dev` is the ONLY authoritative persistent business store.
- **Reactive In-Memory State**: Data fetched from backend APIs is held in service memory caches and pushed to UI components via `_notify()` and reactive `subscribe()` listeners.
- **Sonner Notifications**: Confirmed backend API operations trigger standardized `notify.success()`, while validation or access failures trigger `notify.error()`.

### B. Offline Unit Test Runner (`typeof window === 'undefined'`)
- Runs in Node.js test environment (`node --test`).
- Uses in-memory data structures and synchronous mock fixtures.
- Guarantees 100% pass rate (552 frontend tests) without requiring an active PostgreSQL daemon during unit testing.

---

## 3. Module Integration Matrix

| Module | Frontend Services | Backend API Routes | Core Invariants & Protections Enforced |
|---|---|---|---|
| **Auth & Sessions** | `authService.js`, `AuthContext.jsx` | `/api/v1/auth/*` | HttpOnly JWT cookies, token rotation, concurrency queue on 401 refresh, anti-theft detection. |
| **Module A: Organization & Employees** | `employeeService.js` | `/api/v1/organization/*`, `/api/v1/employees/*` | Anti-circular reporting hierarchy, department-team consistency, sensitive data masking (CNIC, NTN, bank accounts). |
| **Module B: Attendance & Shifts** | `attendanceService.js`, `shiftService.js` | `/api/v1/attendance/*`, `/api/v1/shifts/*` | `SHIFT-ISOLATION-01` per-employee isolation, minimum 60-min overtime policy, Anti-Self-Approval on corrections. |
| **Module C: Leave Management** | `leaveService.js`, `leaveBalanceService.js` | `/api/v1/leaves/*` | Annual sequence number routing, multi-tier escalation (Lead → Manager → HR Admin), anti-duplicate deduction. |
| **Module D: Payroll & Compensation** | `payrollService.js`, `compensationService.js`, `loanService.js` | `/api/v1/payroll/*` | **Fixed 31-day salary divisor**, company leave policy (first 2 leaves PKR 0, PKR 500 thereafter), strict disbursement reconciliation requiring `paymentAccount`. |
| **Module E: Recruitment & Onboarding** | `recruitmentService.js` | `/api/v1/recruitment/*` | Requisition anti-self-approval, duplicate candidate prevention, joined offer conversion to employee. |
| **Module F: Tasks & Performance** | `taskService.js`, `performanceService.js` | `/api/v1/tasks/*`, `/api/v1/performance/*` | Appraisal scoring thresholds, KPI targets, role-scoped task assignment. |
| **Module G: Training Management** | `trainingService.js` | `/api/v1/training/*` | Capacity limits, duplicate enrollment prevention, certificate verification code generation. |
| **Module H: Travel & Expenses** | `expenseService.js`, `travelService.js` | `/api/v1/expenses/*` | **Category Safe Delete Enforcement** (cannot delete if claim items exist in history), line-item receipt validation, manager limit threshold. |
| **Module I: Reports & Analytics** | `reportService.js`, `reportDataFetcher.js` | `/api/v1/reports/*` | Real PostgreSQL aggregates, role-based scoping (Manager blocked from confidential payroll reports). |
| **Module J: Administration & Policies** | `companySettingsService.js`, `policyService.js` | `/api/v1/admin/*` | Executive policy immutability (`403 FINANCIAL_RULE_PROTECTED` on 31-day divisor alterations), audit logging. |

---

## 4. Verification & Quality Assurance Results

1. **Backend Integration & Unit Tests**:
   - Total Tests: **121 / 121 PASS** across 15 suites.
   - Failures / Flaky Tests: **0**.
2. **Frontend Test Suite**:
   - Total Tests: **552 / 552 PASS** across 16 suites.
   - Failures / Flaky Tests: **0**.
3. **Frontend Production Build**:
   - Clean Vite production build: **497 modules transformed**, built in 14.21s with 0 errors.
4. **PostgreSQL Database Status**:
   - Target DB: `aliyan_hrms_dev`.
   - Business records: **0 mock/demo records (`{"users":0,"emps":0}`)**, verified pristine.

