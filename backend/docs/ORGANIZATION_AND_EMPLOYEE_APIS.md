# iSysware HRMS — Organization & Employee Management APIs (Batch 4)

**Version:** 1.0  
**Target:** PostgreSQL 18.6 (`aliyan_hrms_dev`) + Node.js / Express.js  
**Module:** M02 Workforce & Organizational Management  
**Architecture:** RESTful, PostgreSQL-backed, 5-Portal Scoped, Audit-Preserving  

---

## 1. Organization Management Endpoints (`/api/v1/organization`)

All endpoints require JWT Bearer authentication. Write operations (`POST`, `PATCH`, `DELETE`) are strictly gated to `SUPER_ADMIN` and `HR_ADMIN`.

### A. Departments
- `GET /api/v1/organization/departments`:
  - **Query Params**: `search`, `status` (`Active` | `Inactive`), `page`, `limit`.
  - **Response**: List of departments with head details and counts of active staff, teams, and sub-departments.
- `GET /api/v1/organization/departments/:id`:
  - Returns complete department details with sub-departments, teams, and active headcount.
- `POST /api/v1/organization/departments`:
  - **Payload**: `{ code: "DEP-01", name: "Software Engineering", description: "...", headId: "...", status: "Active" }`.
  - **Constraints**: Unique `code`, valid `headId` foreign key.
- `PATCH /api/v1/organization/departments/:id`:
  - Updates department properties and reassigns department head.
- `DELETE /api/v1/organization/departments/:id`:
  - Soft-deactivates department (`status = "Inactive"`). Strictly blocks deletion if active employees are assigned.

### B. Sub-Departments
- `GET /api/v1/organization/sub-departments`:
  - **Query Params**: `departmentId`, `search`.
- `POST /api/v1/organization/sub-departments`:
  - **Payload**: `{ code: "SUBDEP-01", name: "Frontend Engineering", departmentId: "...", managerId: "..." }`.

### C. Teams
- `GET /api/v1/organization/teams`:
  - **Query Params**: `departmentId`, `subDepartmentId`, `search`.
- `GET /api/v1/organization/teams/:id`:
  - Team details, team lead, and assigned member roster.
- `POST /api/v1/organization/teams`:
  - **Payload**: `{ code: "TEAM-01", name: "Core Architecture", departmentId: "...", subDepartmentId: "...", teamLeadId: "..." }`.
- `PATCH /api/v1/organization/teams/:id`:
  - Updates team lead or sub-department assignment. Automatically synchronizes `team_assignments`.

### D. Designations
- `GET /api/v1/organization/designations`:
  - **Query Params**: `departmentId`, `level` (`EXECUTIVE`, `DIRECTOR`, `MANAGER`, `LEAD`, `SENIOR`, `MID`, `JUNIOR`, `INTERN`), `search`.
- `POST /api/v1/organization/designations`:
  - **Payload**: `{ code: "DESIG-01", title: "Senior DevOps Architect", departmentId: "...", level: "SENIOR", minSalary: 250000, maxSalary: 400000 }`.

### E. Hierarchy & Anti-Circular Reporting
- `GET /api/v1/organization/hierarchy`:
  - Returns nested company-wide tree (Departments → Sub-Departments → Teams → Team Leads).
- **Anti-Circular Reporting Guard (`organizationService.validateReportingHierarchy`)**:
  - Validates that an employee cannot report to themselves.
  - Traverses the reporting tree upward to prevent cyclic dependencies ($A \to B \to C \to A$) before committing any reporting manager update. Throws `CIRCULAR_REPORTING_DETECTED` (400).

---

## 2. Employee Management Endpoints (`/api/v1/employees`)

### A. Employee Directory & Profile
- `GET /api/v1/employees`:
  - **Query Params**: `search`, `departmentId`, `teamId`, `status`, `employmentType`, `workArrangement`, `page`, `limit`.
  - **Server-Side Scoping**:
    - `SUPER_ADMIN` & `HR_ADMIN`: Full company-wide roster.
    - `DEPT_MANAGER`: Scoped strictly to their authorized department.
    - `TEAM_LEAD`: Scoped strictly to their assigned team(s).
    - `EMPLOYEE`: Returns public directory with sensitive fields masked.
- `GET /api/v1/employees/:id`:
  - **Role-Aware Sensitive Data Masking**:
    - Confidential banking details (`bankAccountNumber`, `bankIban`), tax information (`taxNtnNumber`), and identification (`cnic`) are strictly masked (`•••• •••• ••••`) for coworkers and managers.
    - Full details are visible ONLY to `SUPER_ADMIN`, `HR_ADMIN`, or the employee viewing their own profile.
- `POST /api/v1/employees`:
  - Creates a canonical employee profile.
  - **Payload**: Demographics, contact info, emergency contact, employment classification (`employmentType`, `workArrangement`, `payBasis`), placement (`departmentId`, `teamId`, `designationId`, `reportingManagerId`), and banking info.
  - **Optional Portal User Provisioning**: `{ createPortalAccount: true, portalUsername: "...", portalRole: "EMPLOYEE" }`.
- `PATCH /api/v1/employees/:id`:
  - Updates personal, contact, emergency, and banking information with audit logging.

### B. Employee Lifecycle & Career Movements
- `POST /api/v1/employees/:id/transfer`:
  - **Payload**: `{ departmentId, subDepartmentId, teamId, reportingManagerId, effectiveDate, remarks }`.
  - **Strict Invariant**: Lateral transfers **NEVER** silently alter compensation. Salary revisions remain separate under `salaryRevisionService`.
  - Atomically creates an immutable audit record in `employee_career_history` (`changeType: "DEPARTMENT_TRANSFER"`).
- `POST /api/v1/employees/:id/promote`:
  - **Payload**: `{ newDesignationId, effectiveDate, remarks }`.
  - **Strict Invariant**: Promotion designation upgrade is decoupled from salary adjustments.
  - Atomically creates an immutable audit record in `employee_career_history` (`changeType: "PROMOTION"`).
- `PATCH /api/v1/employees/:id/status`:
  - Updates employment status (`ACTIVE`, `PROBATION`, `NOTICE_PERIOD`, `SUSPENDED`, `RESIGNED`, `TERMINATED`, `RETIRED`).
  - Upon separation (`RESIGNED`, `TERMINATED`, `SUSPENDED`), automatically deactivates the employee's linked portal user account (`user.isActive = false`).
- `GET /api/v1/employees/:id/career-history`:
  - Returns historical movements and promotions with previous/new value snapshots.

### C. Employee Documents Metadata
- `GET /api/v1/employees/:id/documents`:
  - Lists verified and pending document references.
- `POST /api/v1/employees/:id/documents`:
  - **Payload**: `{ documentType, fileName, fileUrl, fileSize, mimeType }`.
- `PATCH /api/v1/employees/documents/:documentId/verify`:
  - Gated to `SUPER_ADMIN` and `HR_ADMIN`. Marks document verified with actor attribution and timestamp.

---

## 3. Global Sonner Notification Contract

All endpoints return predictable response structures:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "message": "Employee transfer executed successfully"
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "CIRCULAR_REPORTING_DETECTED",
    "message": "Anti-Circular Reporting: An employee cannot report to themselves.",
    "details": null
  }
}
```
Standard business error codes: `DUPLICATE_EMPLOYEE_CODE`, `DUPLICATE_EMAIL`, `DUPLICATE_CODE`, `INVALID_DEPARTMENT`, `INVALID_DESIGNATION`, `CIRCULAR_REPORTING_DETECTED`, `DEPARTMENT_HAS_ACTIVE_STAFF`, `FORBIDDEN_SCOPE`.

