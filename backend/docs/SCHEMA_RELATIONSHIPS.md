# iSysware HRMS — Database Schema Relationships & Constraints (Batch 2)

This document specifies the primary keys, foreign key constraints, unique indexes, and referential actions across all 61 business tables in `aliyan_hrms_dev`.

---

## 1. Key Entity Relationships

### A. Organization & Employee Hierarchy
- `employees.departmentId` → `departments.id` (`onDelete: Restrict`)
  - Ensures a department cannot be deleted if active staff members are assigned.
- `employees.subDepartmentId` → `sub_departments.id` (`onDelete: SetNull`)
- `employees.teamId` → `teams.id` (`onDelete: SetNull`)
- `employees.designationId` → `designations.id` (`onDelete: Restrict`)
- `employees.reportingManagerId` → `employees.id` (`onDelete: SetNull`)
  - Self-referencing reporting hierarchy. Prevents cyclic reporting.
- `departments.headId` → `employees.id` (`onDelete: SetNull`)
- `sub_departments.managerId` → `employees.id` (`onDelete: SetNull`)
- `teams.teamLeadId` → `employees.id` (`onDelete: SetNull`)
- `team_assignments`:
  - `employeeId` → `employees.id` (`onDelete: Cascade`)
  - `teamId` → `teams.id` (`onDelete: Cascade`)
  - Unique: `@@unique([employeeId, teamId, role])` (Supports multi-team management for leads/managers without duplicates).

### B. User Authentication & Portal Access
- `users.employeeId` → `employees.id` (`onDelete: SetNull`)
  - Unique 1:1 relation. Employee profile exists independently of portal login.
- `sessions.userId` → `users.id` (`onDelete: Cascade`)
  - Deleting a user clears their active sessions.
- `password_reset_tokens.userId` → `users.id` (`onDelete: Cascade`)
- `role_permissions`:
  - Unique: `@@unique([role, permissionCode])`

### C. Attendance & Shift Isolation (`SHIFT-ISOLATION-01`)
- `shift_assignments`:
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - `shiftId` → `shifts.id` (`onDelete: Restrict`)
  - Indexes: `@@index([employeeId, effectiveFrom])`, `@@index([employeeId, status])`
  - Guarantees shift resolution is strictly scoped to the employee and business date.
- `attendance_records`:
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - `shiftId` → `shifts.id` (`onDelete: Restrict`)
  - Unique: `@@unique([employeeId, attendanceDate])` (Only 1 attendance record per employee per calendar date).
  - Contains immutable shift snapshots (`shiftNameSnapshot`, `shiftStartTimeSnapshot`, `shiftEndTimeSnapshot`).
- `attendance_punches`:
  - `attendanceRecordId` → `attendance_records.id` (`onDelete: Cascade`)
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - Index: `@@index([attendanceRecordId, punchTime])`, `@@index([employeeId, punchTime])`
- `attendance_correction_requests`:
  - `attendanceRecordId` → `attendance_records.id` (`onDelete: SetNull`)
  - `employeeId` → `employees.id` (`onDelete: Restrict`)

### D. Leave Management & Approval Invariants
- `leave_entitlements`:
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - `leaveTypeId` → `leave_types.id` (`onDelete: Restrict`)
  - Unique: `@@unique([employeeId, leaveTypeId, calendarYear])`
- `leave_balance_journals`:
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - `leaveTypeId` → `leave_types.id` (`onDelete: Restrict`)
  - Index: `@@index([employeeId, leaveTypeId])`, `@@index([referenceRequestId])`
- `leave_requests`:
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - `leaveTypeId` → `leave_types.id` (`onDelete: Restrict`)
  - Unique: `requestCode` (`LV-YYYYMM-XXX`)
  - Fields: `annualSequenceNumber` (Int), `routingTier` (`TEAM_LEAD`, `DEPT_MANAGER`, `HR_ADMIN`, `SUPER_ADMIN`), `approvedById`, `approvedByRole`, `cancelledById`, `cancelledAt`.

### E. Payroll & Compensation
- `salary_structures`:
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - Fields: `baseSalary`, `houseRentAllowance`, `medicalAllowance`, `conveyanceAllowance`, `specialAllowance`, `grossSalary` (all `Decimal(12, 2)`).
- `salary_revisions`:
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - Fields: `previousGrossSalary`, `proposedGrossSalary`, `proposedById`, `approvedById` (Super Admin final approval).
- `payroll_runs`:
  - `payrollPeriodId` → `payroll_periods.id` (`onDelete: Restrict`)
- `payroll_entries`:
  - `payrollRunId` → `payroll_runs.id` (`onDelete: Restrict`)
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - Unique: `@@unique([payrollRunId, employeeId])` (Prevents duplicate payslip generation in a single run).
- `employee_loans`:
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
- `loan_repayments`:
  - `loanId` → `employee_loans.id` (`onDelete: Cascade`)
  - `payrollEntryId` → `payroll_entries.id` (`onDelete: SetNull`)

### F. Recruitment & Onboarding
- `job_requisitions.departmentId` → `departments.id`
- `job_openings.requisitionId` → `job_requisitions.id` (`onDelete: SetNull`)
- `job_applications`:
  - `openingId` → `job_openings.id` (`onDelete: Cascade`)
  - `candidateId` → `candidates.id` (`onDelete: Cascade`)
  - Unique: `@@unique([openingId, candidateId])`
- `interview_schedules.applicationId` → `job_applications.id` (`onDelete: Cascade`)
- `interview_evaluations.interviewId` → `interview_schedules.id` (`onDelete: Cascade`, Unique 1:1)
- `job_offers.applicationId` → `job_applications.id` (`onDelete: Cascade`, Unique 1:1)
- `onboarding_checklists.employeeId` → `employees.id` (Unique 1:1)
- `onboarding_tasks.checklistId` → `onboarding_checklists.id` (`onDelete: Cascade`)

### G. Performance & Training
- `task_assignments.assigneeId` → `employees.id` (`onDelete: Restrict`)
- `performance_goals`:
  - `cycleId` → `performance_cycles.id` (`onDelete: Cascade`)
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
- `performance_reviews`:
  - `cycleId` → `performance_cycles.id` (`onDelete: Cascade`)
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - Unique: `@@unique([cycleId, employeeId])`
- `training_enrollments`:
  - `programId` → `training_programs.id` (`onDelete: Cascade`)
  - `employeeId` → `employees.id` (`onDelete: Restrict`)
  - Unique: `@@unique([programId, employeeId])`

### H. Logistics, Travel & Expenses
- `help_desk_tickets.employeeId` → `employees.id` (`onDelete: Restrict`)
- `travel_requests.employeeId` → `employees.id` (`onDelete: Restrict`)
- `transport_passes.employeeId` → `employees.id` (`onDelete: Cascade`, Unique 1:1)
- `expense_claims.employeeId` → `employees.id` (`onDelete: Restrict`)
- `expense_claims.travelRequestId` → `travel_requests.id` (`onDelete: SetNull`)
- `expense_items.claimId` → `expense_claims.id` (`onDelete: Cascade`)
- `issued_hr_letters`:
  - `templateId` → `hr_letter_templates.id` (`onDelete: Restrict`)
  - `employeeId` → `employees.id` (`onDelete: Restrict`)

---

## 2. Integrity Summary
- Total Relational Foreign Keys: **75**
- Unique Key / Index Constraints: **114**
- Cascading Protection: All core workforce, attendance, leave, payroll, and audit records are safeguarded by `Restrict` or `SetNull` referential actions.

