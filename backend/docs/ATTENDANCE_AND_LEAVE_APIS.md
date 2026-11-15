# iSysware HRMS — Attendance, Shifts, Overtime, WFH, Field Duty & Leave Management APIs

## 1. Overview & Architectural Boundaries

Backend Batch 5 completes the attendance and leave subsystem for the five portals of the Aliyan HRMS. All endpoints strictly interact with the PostgreSQL 18 database via Prisma ORM, respecting live Asia/Karachi (UTC+5) calendar dates, single-approver finality, anti-self-approval security guards, and immutable balance ledger journals.

---

## 2. Shift Management (`/api/v1/shifts`)

### Invariant: `SHIFT-ISOLATION-01`
Shift assignments are strictly isolated per-employee with effective date ranges.
- When an employee is explicitly assigned a shift (e.g. `QA Test Morning Shift` starting `2026-11-05`), only that employee resolves that shift on or after that date.
- Prior dates resolve to the canonical corporate default shift (`isDefault = true`).
- Other employees without explicit assignments resolve to the corporate default shift. Shifts **never leak** across employee rosters.

### Endpoints
| Method | Endpoint | Authorized Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/shifts` | Authenticated | List all active shifts with formatted 12h times |
| `GET` | `/api/v1/shifts/:id` | Authenticated | Get single shift details |
| `POST` | `/api/v1/shifts` | `SUPER_ADMIN`, `HR_ADMIN` | Create new shift master |
| `PATCH` | `/api/v1/shifts/:id` | `SUPER_ADMIN`, `HR_ADMIN` | Update shift parameters (grace periods, breaks) |
| `POST` | `/api/v1/shifts/assignments` | `SUPER_ADMIN`, `HR_ADMIN` | Effective-dated employee shift assignment |
| `GET` | `/api/v1/shifts/resolve/:employeeId` | Authenticated | Deterministically resolve active shift for date |

---

## 3. Attendance, Regularization, Overtime, WFH & Field Duty (`/api/v1/attendance`)

### Core Attendance Rules
1. **Punches & Sessions**: Punch IN (`CHECK_IN`) and punch OUT (`CHECK_OUT`) are stored in `attendance_punches` and linked to `attendance_records`. Duplicate check-in on the same date is rejected with `409 ALREADY_CHECKED_IN`.
2. **Grace Period & Lateness**: Arrival within the shift's `graceMinutesIn` (e.g., 15 minutes) incurs **0 late minutes**. Arrivals past grace incur exact minutes from shift start.
3. **Register Rate Invariant**: If scheduled workforce denominator is 0, attendance rate displays `"N/A"`, avoiding false 100% metrics.
4. **Future Dates**: Dates after today in Asia/Karachi are classified as `SCHEDULED`, never `ABSENT`.

### Remote Work & Field Duty Rules
1. **WFH Duplicate Prevention**: Overlapping pending or approved WFH date ranges are rejected with `409 OVERLAPPING_REQUEST`.
2. **Field Duty "No Duration Limit" Finality**: Under the active policy, the first valid approval by any authorized role (`TEAM_LEAD`, `DEPT_MANAGER`, `HR_ADMIN`, `SUPER_ADMIN`) immediately marks the request `APPROVED` (`Final Approved`). Subsequent approvals are disabled with `400 ALREADY_PROCESSED`.
3. **Overtime Threshold**: Enforces policy minimum 60 minutes (`MINIMUM_DURATION_VIOLATION` on < 60 min).
4. **Anti-Self-Approval**: Requesters are strictly prohibited from approving their own attendance regularization, overtime, WFH, or field duty (`403 SELF_APPROVAL_PROHIBITED`).

### Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/attendance/check-in` | Punch IN with device/IP metadata |
| `POST` | `/api/v1/attendance/check-out` | Punch OUT with work/break/early-exit calculations |
| `GET` | `/api/v1/attendance/register` | Date-filtered attendance register with isolated shift resolution |
| `GET` | `/api/v1/attendance/history/:employeeId` | Employee attendance history & punches |
| `POST` | `/api/v1/attendance/corrections` | Submit regularization / missed-punch request |
| `PATCH` | `/api/v1/attendance/corrections/:id/review` | Review regularization (enforces anti-self-approval) |
| `POST` | `/api/v1/attendance/overtime` | Apply for overtime (minimum 60m threshold) |
| `PATCH` | `/api/v1/attendance/overtime/:id/review` | Review overtime request |
| `POST` | `/api/v1/attendance/wfh` | Request WFH with date range deduplication |
| `PATCH` | `/api/v1/attendance/wfh/:id/review` | Review WFH request |
| `POST` | `/api/v1/attendance/field-duty` | Request Field Duty |
| `PATCH` | `/api/v1/attendance/field-duty/:id/review` | Single-approver finality review |

---

## 4. Leave Management & Annual Sequence Escalation (`/api/v1/leaves`)

### Annual Sequence Escalation Invariant
Qualifying approved leave requests in a calendar year escalate based on sequence:
- **Normal Employee**:
  - Request 1 & 2 $\to$ `TEAM_LEAD`
  - Request 3+ $\to$ `DEPT_MANAGER`
- **Team Lead**:
  - Request 1 & 2 $\to$ `DEPT_MANAGER`
  - Request 3+ $\to$ `HR_ADMIN`

### Balance Ledger & Idempotent Reversal
1. Upon application, requested days are held in `pendingDays` and decremented from `availableBalance`.
2. Upon approval, days move to `utilizedDays` and an immutable `UTILIZATION` entry is posted to `leave_balance_journals`.
3. Upon cancellation, an offsetting `REVERSAL` transaction is posted in the journal, restoring `availableBalance` and decrementing `utilizedDays`. Repeated cancellation is rejected with `400 ALREADY_CANCELLED`.

### Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/leaves/types` | List leave types and policies |
| `POST` | `/api/v1/leaves/types` | Create leave type (`SUPER_ADMIN`, `HR_ADMIN`) |
| `GET` | `/api/v1/leaves/entitlements/:employeeId` | Get employee leave balances for year |
| `POST` | `/api/v1/leaves/entitlements` | Set or adjust leave balance quota |
| `POST` | `/api/v1/leaves/apply` | Apply for leave with threshold routing tier calculation |
| `PATCH` | `/api/v1/leaves/:id/review` | Review leave (enforces anti-self-approval) |
| `POST` | `/api/v1/leaves/:id/cancel` | Cancel leave with idempotent ledger reversal |
| `GET` | `/api/v1/leaves/requests` | List leave requests with portal scoping |
| `GET` | `/api/v1/leaves/calendar` | Company-wide approved leaves & holiday calendar |

---

## 5. Automated Verification Summary

```bash
npm --prefix backend test
# 79 tests across 11 suites PASS (0 failures)
# Coverage includes:
# - shift.test.js (7 tests)
# - attendance.test.js (12 tests)
# - leave.test.js (9 tests)

npm --prefix frontend test
# 552 tests across 16 suites PASS (0 failures)

npm --prefix frontend run build
# Built cleanly in 10.05s without regressions
```

