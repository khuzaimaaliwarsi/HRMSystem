# iSysware HRMS — PostgreSQL Database Architecture (Batch 2)

**Version:** 1.0  
**Database Engine:** PostgreSQL 18.6  
**Target Database:** `aliyan_hrms_dev`  
**ORM:** Prisma 6.19.3 (`@prisma/client`)  
**Architecture:** Relational / Normalized Enterprise HRMS Data Tier  

---

## 1. Architectural Overview & Design Principles

The iSysware HRMS database is architected to provide an immutable, auditable, accountant-grade foundation for the entire 5-portal enterprise suite (Super Admin, HR/Admin, Department Manager, Team Lead, Employee).

### Core Design Rules
1. **Separation of Employee Identity & User Credentials**:
   - `employees`: Canonical person master (demographics, employment terms, department, designation, hierarchy).
   - `users`: Portal authentication credentials, role grants (`SUPER_ADMIN`, `HR_ADMIN`, `DEPT_MANAGER`, `TEAM_LEAD`, `EMPLOYEE`), and session security. An employee may exist before having a portal user account.
2. **Financial Precision (PKR)**:
   - All monetary fields (`baseSalary`, `grossSalary`, `allowances`, `taxDeduction`, `netSalary`, `loanAmount`, `expenseAmount`) use PostgreSQL `@db.Decimal(12, 2)` or `@db.Decimal(14, 2)`. Floating-point numbers are strictly forbidden.
3. **Timezone & Business Date Decoupling**:
   - Instant events (punches, creation, approval timestamps) are stored in UTC `DateTime`.
   - Business calendar dates (attendance date, leave date, holiday date) are tracked as independent date values evaluated strictly against `Asia/Karachi` Pakistan Standard Time.
4. **Historical Immutability & Snapshots**:
   - Finalized attendance records store snapshots of the shift at that date (`shiftNameSnapshot`, `shiftStartTimeSnapshot`, `shiftEndTimeSnapshot`).
   - Payroll entries store snapshots of salary components and deductions at payment time. Changing an employee's salary structure NEVER retroactively rewrites older payslips.
5. **Referential Integrity & Safe Deletions**:
   - Historical audit records, attendance records, leaves, and payroll records use `onDelete: Restrict` or `onDelete: SetNull` to prevent cascading accidental data destruction.

---

## 2. Table Catalog & Module Mapping (61 Domain Models + 1 Migration Ledger)

| Module ID | Domain | Database Tables (PostgreSQL) | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **System** | Settings & Audit | `organization_settings`, `audit_logs`, `notifications`, `approval_authority_rules` | Global configuration, audit trail, in-app alerts, dynamic routing rules |
| **Auth** | Identity & Security | `users`, `sessions`, `password_reset_tokens`, `role_permissions` | 5 portal roles, SHA-256 hashed refresh tokens, login guards, root protection |
| **M02** | Workforce & Org | `departments`, `sub_departments`, `teams`, `designations`, `employees`, `team_assignments`, `employee_career_history`, `succession_history`, `employee_documents` | Org hierarchy, employee master, multi-team leads/managers, succession plans, career history |
| **M04** | Shifts & Attendance | `shifts`, `shift_assignments`, `attendance_records`, `attendance_punches`, `attendance_correction_requests`, `overtime_requests`, `wfh_requests`, `field_duty_requests`, `holiday_calendars`, `public_holidays` | **SHIFT-ISOLATION-01**, punches, regularization, overtime, WFH, field duty single-approver |
| **M05** | Leaves | `leave_types`, `leave_policies`, `leave_entitlements`, `leave_balance_journals`, `leave_requests` | Annual sequence counting, balance ledger, idempotent cancellations |
| **M03** | Recruitment | `job_requisitions`, `job_openings`, `candidates`, `job_applications`, `interview_schedules`, `interview_evaluations`, `job_offers`, `onboarding_checklists`, `onboarding_tasks` | Requisition to onboarding pipeline, candidate rating, offers |
| **M06** | Payroll & Finance | `salary_structures`, `salary_revisions`, `payroll_periods`, `payroll_runs`, `payroll_entries`, `employee_loans`, `loan_repayments` | Decimal precision, salary revisions (SA approval), payslip snapshots, loans |
| **M07** | Performance | `task_assignments`, `performance_cycles`, `performance_goals`, `performance_reviews` | Team tasks, KPI goals, cycle reviews, manager recommendations |
| **M08** | Training | `training_programs`, `training_enrollments` | Course catalog, capacity, attendance, certificates |
| **M11** | Help Desk | `help_desk_tickets` | Support tickets, SLA targets, category queues |
| **M12** | Travel & Logistics | `travel_requests`, `transport_passes` | Travel advances, approvals, pick-and-drop seating |
| **M14** | Expenses | `expense_claims`, `expense_items` | Itemized claims, travel linkage, disbursement |
| **M13** | HR Letters | `hr_letter_templates`, `issued_hr_letters` | Template engine, immutable letter snapshots |

---

## 3. Physical Database Metrics
- **Total Tables**: 62 (`61` business models + `1` `_prisma_migrations` table)
- **Foreign Key Constraints**: 75
- **Unique Indexes & Primary Keys**: 114
- **Schema Migration Status**: Applied cleanly via `20261105001924_init_hrms_schema`.

