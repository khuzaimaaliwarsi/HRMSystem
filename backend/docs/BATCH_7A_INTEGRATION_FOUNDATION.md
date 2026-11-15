# ALIYAN HRMS — BATCH 7A
## Frontend–Backend Integration Foundation & Critical Gap Closure

**Suite:** iSysware HRMS Enterprise Suite  
**Milestone:** Batch 7A — Integration Foundation & Gap Closure  
**Status:** Completed & Fully Verified  

---

## 1. Executive Summary

Batch 7A establishes the production-grade, secure foundation for connecting the five React portals to PostgreSQL-backed Express APIs:
1. **Critical Batch 6C Gap Audit & Remediation**:
   - Expense category Master with full lifecycle (`Add`, `Edit`, `Deactivate`, `Safe Delete`). Safe delete protection actively queries claim history and prevents deletion of categories in use.
   - Configurable expense policy enforcement: line item limits, mandatory receipt verification, and multi-tier manager approval limits (`PKR 100,000`).
   - Configurable organization policies for Super Admin and HR Admin (`monthlyAllowedLeaves: 2`, `extraLeaveDeductionAmount: 500 PKR`, `overtimeThresholdMinutes: 60`, `trainingPassingScore: 70%`, `performanceScoringWeights: { kpi: 70%, competencies: 30% }`).
   - Strict invariant protection: The company 31-day salary daily divisor is immutable. Any attempt to modify it is rejected with `403 Forbidden` (`FINANCIAL_RULE_PROTECTED`). Core financial deduction rules are restricted to Super Admin (`SUPER_ADMIN_REQUIRED`).
   - Policy revisions maintain effective dates and an immutable `auditHistory` trail with actor attribution.
   - Payment account recording (`paymentAccount`) is required and logged during reimbursement disbursements to prevent unverified `PAID` statuses.
2. **Authentication Integration**:
   - Cut over session handling to PostgreSQL `/api/v1/auth/login`, `/me`, `/refresh`, `/logout`, `/logout-all`, `/change-password`.
   - Security: Protected HttpOnly cookie sessions (`access_token`, `refresh_token`). Zero JWT tokens stored in browser `localStorage`.
   - Removed automatic mock fallback on browser login. Authentic errors are surfaced directly for wrong credentials or database disconnection.
   - Initial application startup verifies active cookie sessions via `/api/v1/auth/me` with non-blocking loading states.
3. **Centralized API Service Layer (`frontend/src/services/apiClient.js`)**:
   - Environment-configured base URL (`VITE_API_URL` or relative `/api/v1`).
   - Vite proxy configuration (`/api` -> `http://127.0.0.1:5000`).
   - `credentials: 'include'` for first-party cookie transport across all API requests.
   - Silent auto-refresh on 401 with concurrency request queuing and session expiry dispatching.
   - Standardized `ApiError` normalization.
4. **Global Sonner Notifications**:
   - Mounted `<Toaster richColors position="top-right" closeButton />` in `App.jsx`.
   - Standardized notification utility (`frontend/src/lib/notify.js`) integrated into login, logout, password change, and error handling.
5. **LocalStorage Cutover Safety**:
   - Complete inventory of UI preferences (`hrms_theme`, `hrms_sidebar_collapsed`) vs business data keys.
   - Preserved UI layout preferences while eliminating JWT tokens from client-side storage.

---

## 2. API Endpoints Implemented in Batch 7A

| Method | Endpoint | Authorized Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/policies` | All Authenticated | Returns active company policies, invariant divisor, and revision history |
| `PATCH` | `/api/v1/admin/policies` | `SUPER_ADMIN`, `HR_ADMIN` | Updates company policies with audit trail (Financial rules restricted to Super Admin; 31-day divisor immutable) |
| `GET` | `/api/v1/expenses/categories` | All Authenticated | Lists active and historical expense categories with limits and receipt requirements |
| `POST` | `/api/v1/expenses/categories` | `SUPER_ADMIN`, `HR_ADMIN` | Provisions a new expense category with max limit and receipt requirements |
| `PATCH` | `/api/v1/expenses/categories/:code` | `SUPER_ADMIN`, `HR_ADMIN` | Updates category configuration or activates/deactivates category |
| `DELETE` | `/api/v1/expenses/categories/:code` | `SUPER_ADMIN` | Safely deletes unused category; rejects deletion with `400` if historical claim items exist |
| `POST` | `/api/v1/expenses/claims/:id/disburse` | `SUPER_ADMIN`, `HR_ADMIN` | Disburses approved claim with mandatory `paymentAccount` and transaction reference reconciliation |

---

## 3. Verification & Regression Metrics

- **Backend Tests**: **121 / 121 tests PASS across 15 test suites** (including new `batch7a.test.js`).
- **Frontend Tests**: **552 / 552 tests PASS across 16 test suites**.
- **Frontend Production Build**: **Clean build in 8.30s**.
- **PostgreSQL Database (`aliyan_hrms_dev`)**: **Pristine, 0 mock demo business records**.

