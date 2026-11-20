/**
 * iSysware HRMS — Batch F05: Canonical Leave Management Dataset
 * Authoritative source of truth for:
 * - Configurable Leave Types (Annual, Casual, Sick, Emergency, Unpaid, Maternity/Paternity, Compensatory)
 * - Super Admin Centralized Leave Policy Definitions & Versioning
 * - Deterministic Initial Leave Requests across all 4 portals
 * - Initial Entitlement Ledgers with Opening, Accrued, Utilized, and Closing balances
 * - Approval Matrix Thresholds (2-day manager cap, split-request cumulative tracking)
 */

export const LEAVE_TYPES = [
  {
    id: 'LT-ANNUAL',
    code: 'AL',
    name: 'Annual Leave',
    category: 'Annual',
    description: 'Planned vacation and annual paid rest entitlement',
    paidTreatment: 'Paid',
    annualEntitlement: 14,
    accrualFrequency: 'Annual', // 'Annual' | 'Monthly'
    monthlyRate: 1.17,
    carryForwardAllowed: true,
    maxCarryForwardDays: 5,
    carryForwardExpiryMonths: 3, // expires end of March next year
    probationEligible: false, // accrued during probation, usable post-confirmation
    minNoticeDays: 3,
    minDaysPerRequest: 1,
    maxDaysPerRequest: 14,
    halfDayEligible: false,
    negativeBalanceAllowed: false,
    requiresDocumentation: false,
    eligibleEmploymentTypes: ['Permanent', 'Contract'],
    color: '#2563EB', // Blue
    bgColor: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  {
    id: 'LT-CASUAL',
    code: 'CL',
    name: 'Casual Leave',
    category: 'Casual',
    description: 'Short-notice personal affairs and urgent domestic matters',
    paidTreatment: 'Paid',
    annualEntitlement: 10,
    accrualFrequency: 'Monthly',
    monthlyRate: 0.83,
    carryForwardAllowed: false,
    maxCarryForwardDays: 0,
    carryForwardExpiryMonths: 0,
    probationEligible: true,
    minNoticeDays: 1,
    minDaysPerRequest: 0.5,
    maxDaysPerRequest: 3,
    halfDayEligible: true,
    negativeBalanceAllowed: false,
    requiresDocumentation: false,
    eligibleEmploymentTypes: ['Permanent', 'Contract', 'Probation'],
    color: '#0D9488', // Teal
    bgColor: 'bg-teal-50 text-teal-700 border-teal-200'
  },
  {
    id: 'LT-SICK',
    code: 'SL',
    name: 'Sick Leave',
    category: 'Medical',
    description: 'Medical recuperation and health recovery',
    paidTreatment: 'Paid',
    annualEntitlement: 8,
    accrualFrequency: 'Annual',
    monthlyRate: 0.67,
    carryForwardAllowed: false,
    maxCarryForwardDays: 0,
    carryForwardExpiryMonths: 0,
    probationEligible: true,
    minNoticeDays: 0, // same-day notice allowed
    minDaysPerRequest: 0.5,
    maxDaysPerRequest: 8,
    halfDayEligible: true,
    negativeBalanceAllowed: false,
    requiresDocumentation: true, // Medical certificate required for > 2 consecutive days
    docThresholdDays: 2,
    eligibleEmploymentTypes: ['Permanent', 'Contract', 'Probation', 'Intern'],
    color: '#E11D48', // Rose
    bgColor: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  {
    id: 'LT-EMERGENCY',
    code: 'EL',
    name: 'Emergency Leave',
    category: 'Emergency',
    description: 'Unforeseen domestic or family crises requiring immediate presence',
    paidTreatment: 'Paid',
    annualEntitlement: 3,
    accrualFrequency: 'Annual',
    monthlyRate: 0.25,
    carryForwardAllowed: false,
    maxCarryForwardDays: 0,
    carryForwardExpiryMonths: 0,
    probationEligible: true,
    minNoticeDays: 0,
    minDaysPerRequest: 0.5,
    maxDaysPerRequest: 3,
    halfDayEligible: true,
    negativeBalanceAllowed: false,
    requiresDocumentation: false,
    eligibleEmploymentTypes: ['Permanent', 'Contract', 'Probation'],
    color: '#EA580C', // Orange
    bgColor: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'LT-UNPAID',
    code: 'UL',
    name: 'Unpaid Leave (LWP)',
    category: 'Unpaid',
    description: 'Leave without pay when paid balances are exhausted or for extended leaves',
    paidTreatment: 'Unpaid',
    annualEntitlement: 30,
    accrualFrequency: 'Annual',
    monthlyRate: 2.5,
    carryForwardAllowed: false,
    maxCarryForwardDays: 0,
    carryForwardExpiryMonths: 0,
    probationEligible: true,
    minNoticeDays: 2,
    minDaysPerRequest: 0.5,
    maxDaysPerRequest: 30,
    halfDayEligible: true,
    negativeBalanceAllowed: true,
    requiresDocumentation: false,
    eligibleEmploymentTypes: ['Permanent', 'Contract', 'Probation', 'Intern', 'Freelancer'],
    color: '#64748B', // Slate
    bgColor: 'bg-slate-100 text-slate-700 border-slate-300'
  },
  {
    id: 'LT-MATERNITY',
    code: 'ML',
    name: 'Maternity / Paternity Leave',
    category: 'Parental',
    description: 'Parental leave following childbirth or adoption in accordance with statutory rights',
    paidTreatment: 'Paid',
    annualEntitlement: 90,
    accrualFrequency: 'Event-Based',
    monthlyRate: 0,
    carryForwardAllowed: false,
    maxCarryForwardDays: 0,
    carryForwardExpiryMonths: 0,
    probationEligible: false,
    minNoticeDays: 14,
    minDaysPerRequest: 10,
    maxDaysPerRequest: 90,
    halfDayEligible: false,
    negativeBalanceAllowed: false,
    requiresDocumentation: true,
    docThresholdDays: 1,
    eligibleEmploymentTypes: ['Permanent'],
    color: '#9333EA', // Purple
    bgColor: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  {
    id: 'LT-COMPENSATORY',
    code: 'CPL',
    name: 'Compensatory Leave',
    category: 'Compensatory',
    description: 'Compensatory time-off earned for authorized overtime on public holidays or weekends',
    paidTreatment: 'Paid',
    annualEntitlement: 0, // Credited dynamically via approved overtime or manager grants
    accrualFrequency: 'Event-Based',
    monthlyRate: 0,
    carryForwardAllowed: false,
    maxCarryForwardDays: 0,
    carryForwardExpiryMonths: 2, // expires in 60 days
    probationEligible: true,
    minNoticeDays: 1,
    minDaysPerRequest: 0.5,
    maxDaysPerRequest: 5,
    halfDayEligible: true,
    negativeBalanceAllowed: false,
    requiresDocumentation: false,
    eligibleEmploymentTypes: ['Permanent', 'Contract', 'Probation'],
    color: '#4F46E5', // Indigo
    bgColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  }
]

/**
 * Super Admin Owned Centralized Leave Policies
 */
export const LEAVE_POLICIES = [
  {
    id: 'POL-LEAVE-2026-V1',
    name: 'iSysware Enterprise Leave Policy 2026',
    version: '2026.1',
    status: 'Published',
    isDefault: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    description: 'Standard company-wide leave entitlements, approval authority limits, and escalation matrix for FY2026.',
    createdBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2026-01-01 00:00:00',
    approvalAuthority: {
      // Rule 1: Employee Applicant
      employee: {
        normalReviewer: 'Assigned Manager',
        managerMonthlyCap: 2.0, // Manager can approve up to 2 cumulative days per month
        escalateToHRThreshold: 2.0, // > 2.0 cumulative monthly days routes to HR Admin
        escalateToSuperAdminThreshold: 5.0, // > 5.0 days routes to Super Admin
        splitRequestPrevention: true // Cumulative tracking across calendar month
      },
      // Rule 2: Manager Applicant
      manager: {
        normalReviewer: 'HR / Admin',
        hrAdminMonthlyCap: 2.0, // HR Admin can approve manager leave up to 2 days
        escalateToSuperAdminThreshold: 2.0, // > 2.0 days routes to Super Admin
        selfApprovalAllowed: false
      },
      // Rule 3: HR / Admin Applicant
      hr_admin: {
        normalReviewer: 'Super Admin', // HR Admin must route to Super Admin
        selfApprovalAllowed: false
      },
      // Rule 4: Super Admin Applicant
      super_admin: {
        normalReviewer: 'Board of Directors / Independent Reviewer',
        selfApprovalAllowed: false
      }
    },
    workingDayRules: {
      excludeWeeklyOffs: true, // Monday-Friday workers don't lose Sat/Sun
      excludePublicHolidays: true, // Holidays are not deducted from leave balance
      halfDayValue: 0.5,
      firstHalfStartTime: '09:00',
      firstHalfEndTime: '13:30',
      secondHalfStartTime: '13:30',
      secondHalfEndTime: '18:00'
    },
    carryForwardRules: {
      allowed: true,
      maxDays: 5,
      expiryDate: '2027-03-31'
    }
  }
]

/**
 * Initial Leave Ledger Records (Deterministic Initial Entitlement & Balances for FY2026)
 */
export const INITIAL_LEAVE_LEDGER = [
  // EMP-001 (Tariq Mehmood - Super Admin)
  { id: 'LED-001-AL', employeeId: 'EMP-001', leaveTypeId: 'LT-ANNUAL', openingBalance: 14, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 14, availableBalance: 14 },
  { id: 'LED-001-CL', employeeId: 'EMP-001', leaveTypeId: 'LT-CASUAL', openingBalance: 10, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 10, availableBalance: 10 },
  { id: 'LED-001-SL', employeeId: 'EMP-001', leaveTypeId: 'LT-SICK', openingBalance: 8, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 8, availableBalance: 8 },
  { id: 'LED-001-EL', employeeId: 'EMP-001', leaveTypeId: 'LT-EMERGENCY', openingBalance: 3, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 3, availableBalance: 3 },
  { id: 'LED-001-UL', employeeId: 'EMP-001', leaveTypeId: 'LT-UNPAID', openingBalance: 30, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 30, availableBalance: 30 },

  // EMP-002 (Ayesha Khan - HR / Admin)
  { id: 'LED-002-AL', employeeId: 'EMP-002', leaveTypeId: 'LT-ANNUAL', openingBalance: 14, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 14, availableBalance: 14 },
  { id: 'LED-002-CL', employeeId: 'EMP-002', leaveTypeId: 'LT-CASUAL', openingBalance: 10, earnedAccrued: 0, adjustments: 0, utilized: 1, pending: 0, closingBalance: 9, availableBalance: 9 },
  { id: 'LED-002-SL', employeeId: 'EMP-002', leaveTypeId: 'LT-SICK', openingBalance: 8, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 8, availableBalance: 8 },
  { id: 'LED-002-EL', employeeId: 'EMP-002', leaveTypeId: 'LT-EMERGENCY', openingBalance: 3, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 3, availableBalance: 3 },
  { id: 'LED-002-UL', employeeId: 'EMP-002', leaveTypeId: 'LT-UNPAID', openingBalance: 30, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 30, availableBalance: 30 },

  // EMP-003 (Bilal Siddiqui - Manager Dev)
  { id: 'LED-003-AL', employeeId: 'EMP-003', leaveTypeId: 'LT-ANNUAL', leaveTypeCode: 'AL', openingBalance: 14, earnedAccrued: 0, adjustments: 0, utilized: 1, pending: 0, closingBalance: 13, availableBalance: 13 },
  { id: 'LED-003-CL', employeeId: 'EMP-003', leaveTypeId: 'LT-CASUAL', openingBalance: 10, earnedAccrued: 0, adjustments: 0, utilized: 2, pending: 0, closingBalance: 8, availableBalance: 8 },
  { id: 'LED-003-SL', employeeId: 'EMP-003', leaveTypeId: 'LT-SICK', openingBalance: 8, earnedAccrued: 0, adjustments: 0, utilized: 1, pending: 0, closingBalance: 7, availableBalance: 7 },
  { id: 'LED-003-EL', employeeId: 'EMP-003', leaveTypeId: 'LT-EMERGENCY', openingBalance: 3, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 3, availableBalance: 3 },
  { id: 'LED-003-UL', employeeId: 'EMP-003', leaveTypeId: 'LT-UNPAID', openingBalance: 30, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 30, availableBalance: 30 },

  // EMP-004 (Zeeshan Ali - Senior Developer)
  { id: 'LED-004-AL', employeeId: 'EMP-004', leaveTypeId: 'LT-ANNUAL', openingBalance: 14, earnedAccrued: 0, adjustments: 0, utilized: 2, pending: 3, closingBalance: 12, availableBalance: 9 },
  { id: 'LED-004-CL', employeeId: 'EMP-004', leaveTypeId: 'LT-CASUAL', openingBalance: 10, earnedAccrued: 0, adjustments: 0, utilized: 1, pending: 0, closingBalance: 9, availableBalance: 9 },
  { id: 'LED-004-SL', employeeId: 'EMP-004', leaveTypeId: 'LT-SICK', openingBalance: 8, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 8, availableBalance: 8 },
  { id: 'LED-004-EL', employeeId: 'EMP-004', leaveTypeId: 'LT-EMERGENCY', openingBalance: 3, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 3, availableBalance: 3 },
  { id: 'LED-004-UL', employeeId: 'EMP-004', leaveTypeId: 'LT-UNPAID', openingBalance: 30, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 30, availableBalance: 30 },

  // EMP-005 (Ahmed Khan - Frontend Developer / Software Development)
  { id: 'LED-005-AL', employeeId: 'EMP-005', leaveTypeId: 'LT-ANNUAL', openingBalance: 3.5, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 3.5, availableBalance: 3.5 },
  { id: 'LED-005-CL', employeeId: 'EMP-005', leaveTypeId: 'LT-CASUAL', openingBalance: 2.5, earnedAccrued: 0, adjustments: 0, utilized: 1.0, pending: 0, closingBalance: 1.5, availableBalance: 1.5 },
  { id: 'LED-005-SL', employeeId: 'EMP-005', leaveTypeId: 'LT-SICK', openingBalance: 2.0, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 2.0, availableBalance: 2.0 },
  { id: 'LED-005-EL', employeeId: 'EMP-005', leaveTypeId: 'LT-EMERGENCY', openingBalance: 1.0, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 1.0, availableBalance: 1.0 },
  { id: 'LED-005-UL', employeeId: 'EMP-005', leaveTypeId: 'LT-UNPAID', openingBalance: 30, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 30, availableBalance: 30 },

  // EMP-006 (Usman Ghani - Backend Engineer)
  { id: 'LED-006-AL', employeeId: 'EMP-006', leaveTypeId: 'LT-ANNUAL', openingBalance: 14, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 14, availableBalance: 14 },
  { id: 'LED-006-CL', employeeId: 'EMP-006', leaveTypeId: 'LT-CASUAL', openingBalance: 10, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 1, closingBalance: 10, availableBalance: 9 },
  { id: 'LED-006-SL', employeeId: 'EMP-006', leaveTypeId: 'LT-SICK', openingBalance: 8, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 8, availableBalance: 8 },
  { id: 'LED-006-EL', employeeId: 'EMP-006', leaveTypeId: 'LT-EMERGENCY', openingBalance: 3, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 3, availableBalance: 3 },
  { id: 'LED-006-UL', employeeId: 'EMP-006', leaveTypeId: 'LT-UNPAID', openingBalance: 30, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 30, availableBalance: 30 },

  // EMP-016 (Ahmed Raza QA - QA Automation Engineer)
  { id: 'LED-016-AL', employeeId: 'EMP-016', leaveTypeId: 'LT-ANNUAL', openingBalance: 14, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 14, availableBalance: 14 },
  { id: 'LED-016-CL', employeeId: 'EMP-016', leaveTypeId: 'LT-CASUAL', openingBalance: 10, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 1, closingBalance: 10, availableBalance: 9 },
  { id: 'LED-016-SL', employeeId: 'EMP-016', leaveTypeId: 'LT-SICK', openingBalance: 8, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 8, availableBalance: 8 },
  { id: 'LED-016-EL', employeeId: 'EMP-016', leaveTypeId: 'LT-EMERGENCY', openingBalance: 3, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 3, availableBalance: 3 },
  { id: 'LED-016-UL', employeeId: 'EMP-016', leaveTypeId: 'LT-UNPAID', openingBalance: 30, earnedAccrued: 0, adjustments: 0, utilized: 0, pending: 0, closingBalance: 30, availableBalance: 30 }
]

/**
 * Initial Leave Requests demonstrating all workflows & approval tiers
 */
export const INITIAL_LEAVE_REQUESTS = [
  // 1. Approved Leave (Bilal Siddiqui - Annual Leave, 1 day, approved by Super Admin Tariq Mehmood)
  {
    id: 'LV-202611-001',
    employeeId: 'EMP-003',
    employeeName: 'Bilal Siddiqui',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    designation: 'Software Engineering Manager',
    leaveTypeId: 'LT-ANNUAL',
    leaveTypeName: 'Annual Leave',
    leaveTypeCode: 'AL',
    paidTreatment: 'Paid',
    isPaid: true,
    isHalfDay: false,
    halfDayType: null,
    startDate: '2026-11-18',
    endDate: '2026-11-18',
    eligibleWorkingDays: 1.0,
    calculatedDays: 1.0,
    calendarDays: 1,
    reason: 'Personal architectural review and documentation',
    attachmentUrl: null,
    status: 'Approved',
    submittedAt: '2026-11-15 09:30:00',
    applicantRole: 'manager',
    currentApproverTier: 'Approved',
    currentApproverRole: 'Super Admin',
    currentApproverName: 'Tariq Mehmood',
    policyVersion: '2026.1',
    policyId: 'POL-LEAVE-2026-V1',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Bilal Siddiqui (EMP-003)',
        timestamp: '2026-11-15 09:30:00',
        note: 'Submitted 1-day annual leave request.'
      },
      {
        status: 'Approved',
        actor: 'Tariq Mehmood (Super Admin)',
        timestamp: '2026-11-16 11:00:00',
        note: 'Approved 1.0 day annual leave request.'
      }
    ],
    decisionRemarks: 'Approved 1.0 day annual leave request.',
    decidedBy: 'Tariq Mehmood (Super Admin)',
    decidedAt: '2026-11-16 11:00:00',
    integratedWithAttendance: true
  },
  // 2. Approved Leave (Ahmed Khan - Casual Leave, 1 day, approved by Team Lead Ali Raza)
  {
    id: 'LV-202611-002',
    employeeId: 'EMP-005',
    employeeName: 'Ahmed Khan',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    designation: 'Frontend Developer',
    leaveTypeId: 'LT-CASUAL',
    leaveTypeName: 'Casual Leave',
    leaveTypeCode: 'CL',
    paidTreatment: 'Paid',
    isPaid: true,
    isHalfDay: false,
    halfDayType: null, // 'First-Half' | 'Second-Half' | null
    startDate: '2026-11-02',
    endDate: '2026-11-02',
    eligibleWorkingDays: 1.0,
    calculatedDays: 1.0,
    calendarDays: 1,
    reason: 'Family domestic engagement in Lahore',
    attachmentUrl: null,
    status: 'Approved',
    submittedAt: '2026-10-31 09:30:00',
    applicantRole: 'employee',
    currentApproverTier: 'Approved',
    currentApproverRole: 'Team Lead',
    currentApproverName: 'Ali Raza',
    policyVersion: '2026.1',
    policyId: 'POL-LEAVE-2026-V1',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Ahmed Khan (EMP-005)',
        timestamp: '2026-10-31 09:30:00',
        note: 'Submitted 1-day casual leave request.'
      },
      {
        status: 'Approved',
        actor: 'Ali Raza (Team Lead)',
        timestamp: '2026-10-31 11:00:00',
        note: 'Approved within Team Lead leave authority in accordance with policy.'
      }
    ],
    decisionRemarks: 'Approved by Team Lead in accordance with policy.',
    decidedBy: 'Ali Raza (Team Lead)',
    decidedAt: '2026-10-31 11:00:00',
    integratedWithAttendance: true
  },

  // 2. Pending Manager Review (Usman Ghani - 1 day Casual Leave, within 2-day authority)
  {
    id: 'LV-202610-002',
    employeeId: 'EMP-006',
    employeeName: 'Usman Ghani',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    designation: 'Backend Software Engineer',
    leaveTypeId: 'LT-CASUAL',
    leaveTypeName: 'Casual Leave',
    leaveTypeCode: 'CL',
    paidTreatment: 'Paid',
    isHalfDay: false,
    halfDayType: null,
    startDate: '2026-10-29',
    endDate: '2026-10-29',
    eligibleWorkingDays: 1.0,
    calendarDays: 1,
    reason: 'Electricity and utility meter replacement inspection at home',
    attachmentUrl: null,
    status: 'Pending Manager Review',
    submittedAt: '2026-10-26 15:30:00',
    applicantRole: 'employee',
    currentApproverTier: 'Manager',
    currentApproverRole: 'Manager',
    currentApproverName: 'Bilal Siddiqui',
    policyVersion: '2026.1',
    policyId: 'POL-LEAVE-2026-V1',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Usman Ghani (Employee)',
        timestamp: '2026-10-26 15:30:00',
        note: 'Submitted 1-day casual leave request.'
      }
    ],
    decisionRemarks: null,
    decidedBy: null,
    decidedAt: null,
    integratedWithAttendance: false
  },

  // 3. Pending HR Admin Review (Zeeshan Ali - 3 days Annual Leave, EXCEEDS Manager 2-day cap!)
  // Demonstrates automatic policy escalation from Manager to HR Admin
  {
    id: 'LV-202610-003',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    designation: 'Senior Full Stack Developer',
    leaveTypeId: 'LT-ANNUAL',
    leaveTypeName: 'Annual Leave',
    leaveTypeCode: 'AL',
    paidTreatment: 'Paid',
    isHalfDay: false,
    halfDayType: null,
    startDate: '2026-11-04',
    endDate: '2026-11-06',
    eligibleWorkingDays: 3.0,
    calendarDays: 3,
    reason: 'Family travel and wedding celebrations in Islamabad',
    attachmentUrl: null,
    status: 'Pending HR Review',
    submittedAt: '2026-10-25 10:15:00',
    applicantRole: 'employee',
    currentApproverTier: 'HR Admin',
    currentApproverRole: 'HR Admin',
    currentApproverName: 'Ayesha Khan',
    policyVersion: '2026.1',
    policyId: 'POL-LEAVE-2026-V1',
    escalatedDueTo: 'Requested duration (3 days) exceeds Manager monthly approval authority (2 days).',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Zeeshan Ali (Employee)',
        timestamp: '2026-10-25 10:15:00',
        note: 'Submitted 3-day annual leave request.'
      },
      {
        status: 'Escalated',
        actor: 'Policy Engine (System)',
        timestamp: '2026-10-25 10:15:01',
        note: 'Escalated to HR Admin: 3-day duration exceeds Manager 2-day approval authority cap.'
      }
    ],
    decisionRemarks: null,
    decidedBy: null,
    decidedAt: null,
    integratedWithAttendance: false
  },

  // 4. Pending Super Admin Review (Manager Bilal Siddiqui requested 3 days - exceeds HR 2-day authority!)
  // Demonstrates Manager application routing to HR and escalating to Super Admin
  {
    id: 'LV-202610-004',
    employeeId: 'EMP-003',
    employeeName: 'Bilal Siddiqui',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    designation: 'Software Engineering Manager',
    leaveTypeId: 'LT-ANNUAL',
    leaveTypeName: 'Annual Leave',
    leaveTypeCode: 'AL',
    paidTreatment: 'Paid',
    isHalfDay: false,
    halfDayType: null,
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    eligibleWorkingDays: 3.0,
    calendarDays: 3,
    reason: 'Personal architectural retreat and home relocation',
    attachmentUrl: null,
    status: 'Pending Super Admin Review',
    submittedAt: '2026-10-26 09:40:00',
    applicantRole: 'manager',
    currentApproverTier: 'Super Admin',
    currentApproverRole: 'Super Admin',
    currentApproverName: 'Tariq Mehmood',
    policyVersion: '2026.1',
    policyId: 'POL-LEAVE-2026-V1',
    escalatedDueTo: 'Manager leave request (3 days) exceeds HR Admin 2-day approval authority cap.',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Bilal Siddiqui (Manager)',
        timestamp: '2026-10-26 09:40:00',
        note: 'Submitted 3-day annual leave request to HR Admin.'
      },
      {
        status: 'Escalated',
        actor: 'Ayesha Khan (HR Admin)',
        timestamp: '2026-10-26 11:15:00',
        note: 'Escalated to Super Admin: Request duration (3 days) exceeds HR approval authority for Managers (2 days).'
      }
    ],
    decisionRemarks: null,
    decidedBy: null,
    decidedAt: null,
    integratedWithAttendance: false
  },

  // 5. HR / Admin Applicant (Ayesha Khan requested 1 day Sick Leave)
  // Demonstrates HR Admin applicant routing directly to Super Admin (anti-self-approval rule!)
  {
    id: 'LV-202610-005',
    employeeId: 'EMP-002',
    employeeName: 'Ayesha Khan',
    departmentId: 'DEP-04',
    departmentName: 'Human Resources',
    designation: 'Lead People Operations Specialist',
    leaveTypeId: 'LT-SICK',
    leaveTypeName: 'Sick Leave',
    leaveTypeCode: 'SL',
    paidTreatment: 'Paid',
    isHalfDay: false,
    halfDayType: null,
    startDate: '2026-10-30',
    endDate: '2026-10-30',
    eligibleWorkingDays: 1.0,
    calendarDays: 1,
    reason: 'Scheduled diagnostic dental procedure and post-op rest',
    attachmentUrl: null,
    status: 'Pending Super Admin Review',
    submittedAt: '2026-10-26 16:00:00',
    applicantRole: 'hr_admin',
    currentApproverTier: 'Super Admin',
    currentApproverRole: 'Super Admin',
    currentApproverName: 'Tariq Mehmood',
    policyVersion: '2026.1',
    policyId: 'POL-LEAVE-2026-V1',
    escalatedDueTo: 'HR / Admin applicant cannot self-approve; routed to Super Admin.',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Ayesha Khan (HR Admin)',
        timestamp: '2026-10-26 16:00:00',
        note: 'Submitted 1-day sick leave request. Anti-self-approval rule routes to Super Admin.'
      }
    ],
    decisionRemarks: null,
    decidedBy: null,
    decidedAt: null,
    integratedWithAttendance: false
  },

  // 6. Rejected Leave Request (EMP-006 requested 4 days without notice, rejected with remarks)
  {
    id: 'LV-202610-006',
    employeeId: 'EMP-006',
    employeeName: 'Usman Ghani',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    designation: 'Backend Software Engineer',
    leaveTypeId: 'LT-CASUAL',
    leaveTypeName: 'Casual Leave',
    leaveTypeCode: 'CL',
    paidTreatment: 'Paid',
    isHalfDay: false,
    halfDayType: null,
    startDate: '2026-10-08',
    endDate: '2026-10-11',
    eligibleWorkingDays: 2.0, // Thursday, Friday (weekend Sat/Sun excluded)
    calendarDays: 4,
    reason: 'Trip to northern areas during sprint release week',
    attachmentUrl: null,
    status: 'Rejected',
    submittedAt: '2026-10-06 09:10:00',
    applicantRole: 'employee',
    currentApproverTier: 'Rejected',
    currentApproverRole: 'Manager',
    currentApproverName: 'Bilal Siddiqui',
    policyVersion: '2026.1',
    policyId: 'POL-LEAVE-2026-V1',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Usman Ghani (Employee)',
        timestamp: '2026-10-06 09:10:00',
        note: 'Submitted 2 working days casual leave during deployment.'
      },
      {
        status: 'Rejected',
        actor: 'Bilal Siddiqui (Manager)',
        timestamp: '2026-10-06 11:30:00',
        note: 'Declined: Sprint 42 critical core release scheduled for Oct 9th. Please reschedule.'
      }
    ],
    decisionRemarks: 'Declined: Sprint 42 critical core release scheduled for Oct 9th. Please reschedule.',
    decidedBy: 'Bilal Siddiqui (Manager)',
    decidedAt: '2026-10-06 11:30:00',
    integratedWithAttendance: false
  },

  // 7. Cancelled Request (Zeeshan Ali cancelled a previously approved leave; ledger reversed)
  {
    id: 'LV-202610-007',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    designation: 'Senior Full Stack Developer',
    leaveTypeId: 'LT-CASUAL',
    leaveTypeName: 'Casual Leave',
    leaveTypeCode: 'CL',
    paidTreatment: 'Paid',
    isHalfDay: true,
    halfDayType: 'Second-Half',
    startDate: '2026-10-14',
    endDate: '2026-10-14',
    eligibleWorkingDays: 0.5,
    calendarDays: 1,
    reason: 'Bank visit for loan documents',
    attachmentUrl: null,
    status: 'Cancelled',
    submittedAt: '2026-10-10 14:00:00',
    applicantRole: 'employee',
    currentApproverTier: 'Cancelled',
    currentApproverRole: 'Manager',
    currentApproverName: 'Bilal Siddiqui',
    policyVersion: '2026.1',
    policyId: 'POL-LEAVE-2026-V1',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Zeeshan Ali (Employee)',
        timestamp: '2026-10-10 14:00:00',
        note: 'Submitted half-day casual leave.'
      },
      {
        status: 'Approved',
        actor: 'Bilal Siddiqui (Manager)',
        timestamp: '2026-10-10 15:45:00',
        note: 'Approved half-day casual leave.'
      },
      {
        status: 'Cancellation Requested',
        actor: 'Zeeshan Ali (Employee)',
        timestamp: '2026-10-13 16:00:00',
        note: 'Bank representative visited office; leave no longer required.'
      },
      {
        status: 'Cancelled',
        actor: 'Bilal Siddiqui (Manager)',
        timestamp: '2026-10-13 17:10:00',
        note: 'Cancellation approved. 0.5 day returned to employee leave balance.'
      }
    ],
    decisionRemarks: 'Cancellation approved. 0.5 day returned to employee leave balance.',
    decidedBy: 'Bilal Siddiqui (Manager)',
    decidedAt: '2026-10-13 17:10:00',
    integratedWithAttendance: false
  },

  // 8. Pending Team Lead Review (Ahmed Raza QA - Casual Leave, 1 day, awaiting review by Team Lead Hina Farooq)
  {
    id: 'LV-202610-008',
    employeeId: 'EMP-016',
    employeeName: 'Ahmed Raza QA',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    designation: 'QA Automation Engineer',
    leaveTypeId: 'LT-CASUAL',
    leaveTypeName: 'Casual Leave',
    leaveTypeCode: 'CL',
    paidTreatment: 'Paid',
    isHalfDay: false,
    halfDayType: null,
    startDate: '2026-11-05',
    endDate: '2026-11-05',
    eligibleWorkingDays: 1.0,
    calendarDays: 1,
    reason: 'Personal family errand in Islamabad',
    attachmentUrl: null,
    status: 'Pending Team Lead Review',
    submittedAt: '2026-10-30 14:00:00',
    applicantRole: 'employee',
    currentApproverTier: 'Team Lead',
    currentApproverRole: 'team_lead',
    currentApproverName: 'Hina Farooq',
    policyVersion: '2026.1',
    policyId: 'POL-LEAVE-2026-V1',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Ahmed Raza QA (EMP-016)',
        timestamp: '2026-10-30 14:00:00',
        note: 'Submitted 1.0-day Casual Leave request for Team Lead Hina Farooq review.'
      }
    ],
    decisionRemarks: null,
    decidedBy: null,
    decidedAt: null,
    integratedWithAttendance: false
  }
]

/**
 * Initial Leave Adjustments Audit Trail
 */
export const INITIAL_LEAVE_ADJUSTMENTS = [
  {
    id: 'ADJ-202601-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    leaveTypeId: 'LT-CASUAL',
    leaveTypeName: 'Casual Leave',
    adjustmentType: 'Credit',
    amount: 1.0,
    reason: 'Approved compensatory credit for Sunday deployment on 2026-01-18',
    authorizedBy: 'Tariq Mehmood (Super Admin)',
    authorizedAt: '2026-01-19 10:30:00',
    policyRef: 'POL-LEAVE-2026-V1'
  }
]

/**
 * Initial Immutable Leave Journal Entries
 */
export const INITIAL_LEAVE_JOURNAL = [
  {
    id: 'JRN-SEED-LV-202611-001',
    employeeId: 'EMP-003',
    leaveTypeId: 'LT-ANNUAL',
    eventType: 'Approved Utilization',
    amount: -1.0,
    actor: 'Tariq Mehmood (Super Admin)',
    referenceId: 'LV-202611-001',
    timestamp: '2026-11-16 11:00:00',
    notes: 'Utilization posted for approved annual leave LV-202611-001'
  },
  {
    id: 'JRN-SEED-LV-202611-002',
    employeeId: 'EMP-005',
    leaveTypeId: 'LT-CASUAL',
    eventType: 'Approved Utilization',
    amount: -1.0,
    actor: 'Ali Raza (Team Lead)',
    referenceId: 'LV-202611-002',
    timestamp: '2026-10-31 11:00:00',
    notes: 'Utilization posted for approved casual leave LV-202611-002'
  }
]
