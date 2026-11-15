-- CreateEnum
CREATE TYPE "PortalRole" AS ENUM ('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'FREELANCER');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'PROBATION', 'NOTICE_PERIOD', 'SUSPENDED', 'RESIGNED', 'TERMINATED', 'RETIRED');

-- CreateEnum
CREATE TYPE "WorkArrangement" AS ENUM ('OFFICE', 'REMOTE_WFH', 'HYBRID', 'FIELD_DUTY');

-- CreateEnum
CREATE TYPE "PayBasis" AS ENUM ('MONTHLY', 'HOURLY', 'PROJECT_MILESTONE', 'MONTHLY_PLUS_COMMISSION', 'PART_TIME');

-- CreateEnum
CREATE TYPE "DesignationLevel" AS ENUM ('EXECUTIVE', 'DIRECTOR', 'MANAGER', 'LEAD', 'SENIOR', 'MID', 'JUNIOR', 'INTERN');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('FIXED', 'FLEXIBLE', 'ROTATING');

-- CreateEnum
CREATE TYPE "ShiftAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'WFH', 'FIELD_DUTY', 'REST_DAY', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "PunchType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'BREAK_OUT', 'BREAK_IN');

-- CreateEnum
CREATE TYPE "PunchSource" AS ENUM ('WEB', 'MOBILE', 'BIOMETRIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "CorrectionAdjustmentType" AS ENUM ('MISSING_CHECK_IN', 'MISSING_CHECK_OUT', 'INCORRECT_HOURS', 'STATUS_ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HalfDayType" AS ENUM ('FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "LeaveBalanceTransactionType" AS ENUM ('ALLOCATION', 'UTILIZATION', 'REVERSAL', 'EXPIRY', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "JobOpeningStatus" AS ENUM ('OPEN', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('LINKEDIN', 'REFERRAL', 'JOB_PORTAL', 'CAREERS_PAGE', 'DIRECT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "InterviewRecommendation" AS ENUM ('STRONG_HIRE', 'HIRE', 'HOLD', 'REJECT');

-- CreateEnum
CREATE TYPE "JobOfferStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SalaryRevisionType" AS ENUM ('ANNUAL_INCREMENT', 'PROMOTION_INCREMENT', 'MARKET_ADJUSTMENT', 'PERFORMANCE_DECREMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'PROCESSING', 'APPROVED', 'PAID', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISBURSED', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PROCESSING', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'CASH');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('SALARY_ADVANCE', 'PERSONAL_LOAN', 'EMERGENCY_ASSISTANCE', 'EQUIPMENT_LOAN');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'DISBURSED', 'REPAID', 'DEFAULTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PerformanceCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EVALUATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "PerformanceRatingCategory" AS ENUM ('OUTSTANDING', 'EXCEEDS_EXPECTATIONS', 'MEETS_EXPECTATIONS', 'NEEDS_IMPROVEMENT', 'UNSATISFACTORY');

-- CreateEnum
CREATE TYPE "HelpDeskCategory" AS ENUM ('IT_SUPPORT', 'HR_QUERY', 'PAYROLL_ISSUE', 'FACILITIES', 'ADMIN_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "HelpDeskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "HelpDeskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TravelType" AS ENUM ('DOMESTIC', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('MEALS', 'LODGING', 'TRANSPORT', 'FUEL', 'CLIENT_ENTERTAINMENT', 'SUPPLIES', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MANAGER_APPROVED', 'HR_APPROVED', 'DISBURSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HrLetterStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'REVOKED');

-- CreateTable
CREATE TABLE "organization_settings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'iSysware Software Solutions',
    "legalEntityName" TEXT,
    "ntnNumber" TEXT,
    "address" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'PKR',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 7,
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmployeeCode" TEXT,
    "actorRole" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "recordSnapshotBefore" JSONB,
    "recordSnapshotAfter" JSONB,
    "reasonOrNotes" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'SYSTEM_NOTICE',
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_authority_rules" (
    "id" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "workflowModule" TEXT NOT NULL,
    "roleScope" TEXT NOT NULL,
    "tierLevel" INTEGER NOT NULL DEFAULT 1,
    "authorityRole" TEXT NOT NULL,
    "thresholdValue" DECIMAL(6,2),
    "thresholdType" TEXT,
    "escalateToRole" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_authority_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PortalRole" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" "PortalRole" NOT NULL,
    "permissionCode" TEXT NOT NULL,
    "isGranted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "managerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "subDepartmentId" TEXT,
    "teamLeadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT,
    "level" "DesignationLevel" NOT NULL DEFAULT 'MID',
    "minSalary" DECIMAL(12,2),
    "maxSalary" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "cnic" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "maritalStatus" TEXT,
    "bloodGroup" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "workArrangement" "WorkArrangement" NOT NULL DEFAULT 'OFFICE',
    "payBasis" "PayBasis" NOT NULL DEFAULT 'MONTHLY',
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "confirmationDate" TIMESTAMP(3),
    "probationEndDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "departmentId" TEXT NOT NULL,
    "subDepartmentId" TEXT,
    "teamId" TEXT,
    "designationId" TEXT NOT NULL,
    "reportingManagerId" TEXT,
    "bankName" TEXT,
    "bankAccountTitle" TEXT,
    "bankAccountNumber" TEXT,
    "bankIban" TEXT,
    "taxNtnNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEAM_LEAD',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_career_history" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "previousValues" JSONB NOT NULL,
    "newValues" JSONB NOT NULL,
    "approvedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_career_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "succession_history" (
    "id" TEXT NOT NULL,
    "formerManagerId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "pendingLeavesTransferred" INTEGER NOT NULL DEFAULT 0,
    "directReportsTransferred" INTEGER NOT NULL DEFAULT 0,
    "executedById" TEXT NOT NULL,
    "notes" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "succession_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "shiftCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ShiftType" NOT NULL DEFAULT 'FIXED',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "graceMinutesIn" INTEGER NOT NULL DEFAULT 15,
    "graceMinutesOut" INTEGER NOT NULL DEFAULT 15,
    "halfDayThresholdMinutes" INTEGER NOT NULL DEFAULT 240,
    "fullDayTargetMinutes" INTEGER NOT NULL DEFAULT 480,
    "breakDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "breakStartTime" TEXT,
    "breakEndTime" TEXT,
    "isBreakPaid" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "workDaysJson" JSONB,
    "isNightShift" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "status" "ShiftAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "shiftId" TEXT NOT NULL,
    "shiftNameSnapshot" TEXT NOT NULL,
    "shiftStartTimeSnapshot" TEXT NOT NULL,
    "shiftEndTimeSnapshot" TEXT NOT NULL,
    "firstCheckIn" TIMESTAMP(3),
    "lastCheckOut" TIMESTAMP(3),
    "totalWorkMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualWorkMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyExitMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "workArrangement" "WorkArrangement" NOT NULL DEFAULT 'OFFICE',
    "isRegularized" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_punches" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "punchType" "PunchType" NOT NULL,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "source" "PunchSource" NOT NULL DEFAULT 'WEB',
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_correction_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "attendanceRecordId" TEXT,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "adjustmentType" "CorrectionAdjustmentType" NOT NULL DEFAULT 'MISSING_CHECK_OUT',
    "requestedCheckIn" TIMESTAMP(3),
    "requestedCheckOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "supportingTicketRef" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionRemarks" TEXT,

    CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "overtimeDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "taskDeliverableRef" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionRemarks" TEXT,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wfh_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationDays" DECIMAL(4,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "deliverables" TEXT,
    "contactInfo" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedByRole" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionRemarks" TEXT,

    CONSTRAINT "wfh_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_duty_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dutyDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationHours" DECIMAL(4,1) NOT NULL,
    "clientName" TEXT NOT NULL,
    "siteLocation" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "transportRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByRole" TEXT,
    "approvedAt" TIMESTAMP(3),
    "decisionRemarks" TEXT,

    CONSTRAINT "field_duty_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_calendars" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holiday_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "holidayDate" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "isGazetted" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDaysPerYear" DECIMAL(5,1) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "isEncashable" BOOLEAN NOT NULL DEFAULT false,
    "carryForwardLimit" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_policies" (
    "id" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "annualApprovalThreshold" INTEGER NOT NULL DEFAULT 2,
    "maxConsecutiveDays" INTEGER NOT NULL DEFAULT 14,
    "minServiceMonthsRequired" INTEGER NOT NULL DEFAULT 0,
    "isProrated" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_entitlements" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "openingBalance" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "allocatedDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "utilizedDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pendingDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "encashedDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance_journals" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "transactionType" "LeaveBalanceTransactionType" NOT NULL,
    "days" DECIMAL(5,2) NOT NULL,
    "referenceRequestId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationDays" DECIMAL(4,1) NOT NULL,
    "isHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "halfDayType" "HalfDayType",
    "reason" TEXT NOT NULL,
    "emergencyContact" TEXT,
    "attachmentUrl" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "annualSequenceNumber" INTEGER NOT NULL DEFAULT 1,
    "routingTier" TEXT NOT NULL DEFAULT 'TEAM_LEAD',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByRole" TEXT,
    "approvedAt" TIMESTAMP(3),
    "decisionRemarks" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_requisitions" (
    "id" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "openingsCount" INTEGER NOT NULL DEFAULT 1,
    "justification" TEXT NOT NULL,
    "budgetRange" TEXT,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_openings" (
    "id" TEXT NOT NULL,
    "openingCode" TEXT NOT NULL,
    "requisitionId" TEXT,
    "title" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "experienceMinYears" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "experienceMaxYears" DECIMAL(3,1),
    "salaryMin" DECIMAL(12,2),
    "salaryMax" DECIMAL(12,2),
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'OPEN',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "candidateCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "currentCompany" TEXT,
    "currentDesignation" TEXT,
    "totalExperienceYears" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "resumeUrl" TEXT,
    "source" "CandidateSource" NOT NULL DEFAULT 'DIRECT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "openingId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "stageNotes" TEXT,
    "rating" DECIMAL(3,1),
    "appliedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_schedules" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "roundTitle" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "meetingLink" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_evaluations" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "technicalScore" INTEGER NOT NULL DEFAULT 0,
    "communicationScore" INTEGER NOT NULL DEFAULT 0,
    "culturalFitScore" INTEGER NOT NULL DEFAULT 0,
    "overallRating" DECIMAL(3,1) NOT NULL,
    "recommendation" "InterviewRecommendation" NOT NULL DEFAULT 'HOLD',
    "strengths" TEXT,
    "weaknesses" TEXT,
    "notes" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_offers" (
    "id" TEXT NOT NULL,
    "offerNumber" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "offeredGrossSalary" DECIMAL(12,2) NOT NULL,
    "offeredBaseSalary" DECIMAL(12,2) NOT NULL,
    "proposedJoiningDate" TIMESTAMP(3) NOT NULL,
    "probationMonths" INTEGER NOT NULL DEFAULT 3,
    "status" "JobOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_checklists" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "targetCompletionDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "houseRentAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medicalAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conveyanceAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "specialAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossSalary" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "approvedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_revisions" (
    "id" TEXT NOT NULL,
    "revisionNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousGrossSalary" DECIMAL(12,2) NOT NULL,
    "proposedGrossSalary" DECIMAL(12,2) NOT NULL,
    "previousBaseSalary" DECIMAL(12,2) NOT NULL,
    "proposedBaseSalary" DECIMAL(12,2) NOT NULL,
    "revisionType" "SalaryRevisionType" NOT NULL DEFAULT 'ANNUAL_INCREMENT',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "proposedById" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "justification" TEXT,

    CONSTRAINT "salary_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "workingDaysCount" INTEGER NOT NULL DEFAULT 22,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedById" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_entries" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "calendarDays" INTEGER NOT NULL DEFAULT 30,
    "payableDays" DECIMAL(4,1) NOT NULL,
    "absentDays" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "unpaidLeaveDays" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "houseRentAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medicalAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conveyanceAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "specialAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "overtimeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossEarnings" DECIMAL(12,2) NOT NULL,
    "taxDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "eobiDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "providentFundDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loanDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unpaidAbsenceDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "bankName" TEXT,
    "bankAccountTitle" TEXT,
    "bankAccountNumber" TEXT,
    "bankIban" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "transactionReference" TEXT,

    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_loans" (
    "id" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "loanType" "LoanType" NOT NULL DEFAULT 'SALARY_ADVANCE',
    "principalAmount" DECIMAL(12,2) NOT NULL,
    "repaymentMonths" INTEGER NOT NULL DEFAULT 6,
    "monthlyInstallment" DECIMAL(12,2) NOT NULL,
    "totalRepaidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(12,2) NOT NULL,
    "disbursementDate" TIMESTAMP(3),
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "payrollEntryId" TEXT,
    "repaymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "paymentSource" TEXT NOT NULL DEFAULT 'PAYROLL_DEDUCTION',
    "notes" TEXT,

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT,
    "teamId" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedHours" DECIMAL(4,1),
    "actualHours" DECIMAL(4,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_cycles" (
    "id" TEXT NOT NULL,
    "cycleCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PerformanceCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_goals" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kpiTitle" TEXT NOT NULL,
    "description" TEXT,
    "weightage" INTEGER NOT NULL DEFAULT 20,
    "targetMetric" TEXT,
    "achievedMetric" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "selfScore" DECIMAL(3,1),
    "reviewerScore" DECIMAL(3,1),
    "finalNormalizedScore" DECIMAL(3,1),
    "ratingCategory" "PerformanceRatingCategory",
    "strengths" TEXT,
    "growthAreas" TEXT,
    "managerRecommendation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SELF_REVIEW',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_programs" (
    "id" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "trainerName" TEXT NOT NULL,
    "durationHours" DECIMAL(4,1) NOT NULL,
    "maxCapacity" INTEGER NOT NULL DEFAULT 20,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'ONLINE_VIRTUAL',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_enrollments" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "sessionsAttendedCount" INTEGER NOT NULL DEFAULT 0,
    "assessmentScore" DECIMAL(4,1),
    "certificateNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_desk_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "category" "HelpDeskCategory" NOT NULL DEFAULT 'IT_SUPPORT',
    "priority" "HelpDeskPriority" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "HelpDeskStatus" NOT NULL DEFAULT 'OPEN',
    "slaDueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_desk_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "travelType" "TravelType" NOT NULL DEFAULT 'DOMESTIC',
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "estimatedBudget" DECIMAL(12,2) NOT NULL,
    "advanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bookingReferencePnr" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionRemarks" TEXT,

    CONSTRAINT "travel_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_passes" (
    "id" TEXT NOT NULL,
    "passNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "routeName" TEXT NOT NULL,
    "pickupPoint" TEXT NOT NULL,
    "dropoffPoint" TEXT NOT NULL,
    "shiftTiming" TEXT NOT NULL,
    "vehicleNumber" TEXT,
    "seatNumber" TEXT,
    "monthlyContribution" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claims" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "travelRequestId" TEXT,
    "claimTitle" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "advanceSettlementAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayableAmount" DECIMAL(12,2) NOT NULL,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvedById" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_items" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "merchantName" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "receiptUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_letter_templates" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "templateBodyHtml" TEXT NOT NULL,
    "placeholdersJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_letter_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issued_hr_letters" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "status" "HrLetterStatus" NOT NULL DEFAULT 'ISSUED',
    "documentUrl" TEXT,
    "contentSnapshotHtml" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issued_hr_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entityName_entityId_idx" ON "audit_logs"("entityName", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_sourceModule_createdAt_idx" ON "audit_logs"("sourceModule", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "approval_authority_rules_ruleCode_key" ON "approval_authority_rules"("ruleCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permissionCode_key" ON "role_permissions"("role", "permissionCode");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sub_departments_code_key" ON "sub_departments"("code");

-- CreateIndex
CREATE INDEX "sub_departments_departmentId_idx" ON "sub_departments"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_code_key" ON "teams"("code");

-- CreateIndex
CREATE INDEX "teams_departmentId_idx" ON "teams"("departmentId");

-- CreateIndex
CREATE INDEX "teams_subDepartmentId_idx" ON "teams"("subDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "designations_code_key" ON "designations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_cnic_key" ON "employees"("cnic");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_teamId_idx" ON "employees"("teamId");

-- CreateIndex
CREATE INDEX "employees_designationId_idx" ON "employees"("designationId");

-- CreateIndex
CREATE INDEX "employees_reportingManagerId_idx" ON "employees"("reportingManagerId");

-- CreateIndex
CREATE INDEX "employees_employmentStatus_idx" ON "employees"("employmentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "team_assignments_employeeId_teamId_role_key" ON "team_assignments"("employeeId", "teamId", "role");

-- CreateIndex
CREATE INDEX "employee_career_history_employeeId_effectiveDate_idx" ON "employee_career_history"("employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "succession_history_formerManagerId_successorId_idx" ON "succession_history"("formerManagerId", "successorId");

-- CreateIndex
CREATE INDEX "employee_documents_employeeId_idx" ON "employee_documents"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_shiftCode_key" ON "shifts"("shiftCode");

-- CreateIndex
CREATE INDEX "shift_assignments_employeeId_effectiveFrom_idx" ON "shift_assignments"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "shift_assignments_employeeId_status_idx" ON "shift_assignments"("employeeId", "status");

-- CreateIndex
CREATE INDEX "attendance_records_attendanceDate_status_idx" ON "attendance_records"("attendanceDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employeeId_attendanceDate_key" ON "attendance_records"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "attendance_punches_attendanceRecordId_punchTime_idx" ON "attendance_punches"("attendanceRecordId", "punchTime");

-- CreateIndex
CREATE INDEX "attendance_punches_employeeId_punchTime_idx" ON "attendance_punches"("employeeId", "punchTime");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_correction_requests_requestCode_key" ON "attendance_correction_requests"("requestCode");

-- CreateIndex
CREATE INDEX "attendance_correction_requests_employeeId_status_idx" ON "attendance_correction_requests"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_requests_requestCode_key" ON "overtime_requests"("requestCode");

-- CreateIndex
CREATE INDEX "overtime_requests_employeeId_status_idx" ON "overtime_requests"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wfh_requests_requestCode_key" ON "wfh_requests"("requestCode");

-- CreateIndex
CREATE INDEX "wfh_requests_employeeId_status_idx" ON "wfh_requests"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "field_duty_requests_requestCode_key" ON "field_duty_requests"("requestCode");

-- CreateIndex
CREATE INDEX "field_duty_requests_employeeId_status_idx" ON "field_duty_requests"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_calendars_calendarYear_name_key" ON "holiday_calendars"("calendarYear", "name");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_calendarId_holidayDate_key" ON "public_holidays"("calendarId", "holidayDate");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_entitlements_employeeId_leaveTypeId_calendarYear_key" ON "leave_entitlements"("employeeId", "leaveTypeId", "calendarYear");

-- CreateIndex
CREATE INDEX "leave_balance_journals_employeeId_leaveTypeId_idx" ON "leave_balance_journals"("employeeId", "leaveTypeId");

-- CreateIndex
CREATE INDEX "leave_balance_journals_referenceRequestId_idx" ON "leave_balance_journals"("referenceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_requestCode_key" ON "leave_requests"("requestCode");

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_status_idx" ON "leave_requests"("employeeId", "status");

-- CreateIndex
CREATE INDEX "leave_requests_leaveTypeId_startDate_idx" ON "leave_requests"("leaveTypeId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "job_requisitions_requisitionNumber_key" ON "job_requisitions"("requisitionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "job_openings_openingCode_key" ON "job_openings"("openingCode");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_candidateCode_key" ON "candidates"("candidateCode");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_openingId_candidateId_key" ON "job_applications"("openingId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_evaluations_interviewId_key" ON "interview_evaluations"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "job_offers_offerNumber_key" ON "job_offers"("offerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "job_offers_applicationId_key" ON "job_offers"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_checklists_employeeId_key" ON "onboarding_checklists"("employeeId");

-- CreateIndex
CREATE INDEX "salary_structures_employeeId_isCurrent_idx" ON "salary_structures"("employeeId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "salary_revisions_revisionNumber_key" ON "salary_revisions"("revisionNumber");

-- CreateIndex
CREATE INDEX "salary_revisions_employeeId_status_idx" ON "salary_revisions"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_periodCode_key" ON "payroll_periods"("periodCode");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_runNumber_key" ON "payroll_runs"("runNumber");

-- CreateIndex
CREATE INDEX "payroll_entries_employeeId_idx" ON "payroll_entries"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_entries_payrollRunId_employeeId_key" ON "payroll_entries"("payrollRunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_loans_loanNumber_key" ON "employee_loans"("loanNumber");

-- CreateIndex
CREATE INDEX "employee_loans_employeeId_status_idx" ON "employee_loans"("employeeId", "status");

-- CreateIndex
CREATE INDEX "loan_repayments_loanId_idx" ON "loan_repayments"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignments_taskCode_key" ON "task_assignments"("taskCode");

-- CreateIndex
CREATE INDEX "task_assignments_assigneeId_status_idx" ON "task_assignments"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_cycles_cycleCode_key" ON "performance_cycles"("cycleCode");

-- CreateIndex
CREATE INDEX "performance_goals_cycleId_employeeId_idx" ON "performance_goals"("cycleId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_cycleId_employeeId_key" ON "performance_reviews"("cycleId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "training_programs_courseCode_key" ON "training_programs"("courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "training_enrollments_certificateNumber_key" ON "training_enrollments"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "training_enrollments_programId_employeeId_key" ON "training_enrollments"("programId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "help_desk_tickets_ticketNumber_key" ON "help_desk_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "help_desk_tickets_employeeId_status_idx" ON "help_desk_tickets"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "travel_requests_requestCode_key" ON "travel_requests"("requestCode");

-- CreateIndex
CREATE INDEX "travel_requests_employeeId_status_idx" ON "travel_requests"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transport_passes_passNumber_key" ON "transport_passes"("passNumber");

-- CreateIndex
CREATE UNIQUE INDEX "transport_passes_employeeId_key" ON "transport_passes"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_claims_claimNumber_key" ON "expense_claims"("claimNumber");

-- CreateIndex
CREATE INDEX "expense_claims_employeeId_status_idx" ON "expense_claims"("employeeId", "status");

-- CreateIndex
CREATE INDEX "expense_items_claimId_idx" ON "expense_items"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_letter_templates_templateCode_key" ON "hr_letter_templates"("templateCode");

-- CreateIndex
CREATE UNIQUE INDEX "issued_hr_letters_referenceNumber_key" ON "issued_hr_letters"("referenceNumber");

-- CreateIndex
CREATE INDEX "issued_hr_letters_employeeId_idx" ON "issued_hr_letters"("employeeId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_headId_fkey" FOREIGN KEY ("headId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_departments" ADD CONSTRAINT "sub_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_departments" ADD CONSTRAINT "sub_departments_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_subDepartmentId_fkey" FOREIGN KEY ("subDepartmentId") REFERENCES "sub_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_teamLeadId_fkey" FOREIGN KEY ("teamLeadId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_subDepartmentId_fkey" FOREIGN KEY ("subDepartmentId") REFERENCES "sub_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_career_history" ADD CONSTRAINT "employee_career_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wfh_requests" ADD CONSTRAINT "wfh_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_duty_requests" ADD CONSTRAINT "field_duty_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "holiday_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_entitlements" ADD CONSTRAINT "leave_entitlements_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_entitlements" ADD CONSTRAINT "leave_entitlements_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_journals" ADD CONSTRAINT "leave_balance_journals_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_journals" ADD CONSTRAINT "leave_balance_journals_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "job_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interview_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "onboarding_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "employee_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_payrollEntryId_fkey" FOREIGN KEY ("payrollEntryId") REFERENCES "payroll_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_programId_fkey" FOREIGN KEY ("programId") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_desk_tickets" ADD CONSTRAINT "help_desk_tickets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_desk_tickets" ADD CONSTRAINT "help_desk_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_passes" ADD CONSTRAINT "transport_passes_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_travelRequestId_fkey" FOREIGN KEY ("travelRequestId") REFERENCES "travel_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_hr_letters" ADD CONSTRAINT "issued_hr_letters_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "hr_letter_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_hr_letters" ADD CONSTRAINT "issued_hr_letters_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
