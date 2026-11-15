/**
 * iSysware HRMS — Centralized Company Policy Engine Registry (Batch F13)
 * Authoritative single source of truth for:
 * - Company-Wide, Department, Role and Employee-Specific Policies
 * - Precedence: Employee Exception (1) > Department (2) > Role (3) > Company-Wide (4)
 * - Versioning, Effective-Date Schedules, Active/Draft/Archived Statuses
 * - Centralized Approval Authority & Escalation Rules
 */

export const INITIAL_POLICIES = [
  // 1. Attendance Policy
  {
    id: 'POL-ATT-001',
    name: 'General Corporate Attendance & Punctuality Policy',
    category: 'attendance',
    description: 'Defines grace period, permitted monthly late arrivals, half-day thresholds, and biometric punch rules.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'threshold',
    allowedLimit: 4, // 4 late marks permitted per calendar month
    calculationMethod: 'fixed',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '2.1',
    status: 'Active',
    precedence: 4,
    rules: {
      graceMinutes: 15,
      allowedLatesPerMonth: 4,
      latePenaltyDeductionMultiplier: 0.5, // 5th late triggers half-day salary or warning
      halfDayHourThreshold: 4.0,
      fullDayHourThreshold: 8.0,
      maxMissingPunchCorrectionsPerMonth: 3,
      overtimeMinimumMinutes: 60,
      wfhMonthlyAllowanceDays: 2
    },
    approvalAuthorityRef: 'APV-ATT-CORR',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Annual HRMS 2026 baseline calibration'
  },

  // 2. Leave Policy
  {
    id: 'POL-LEV-001',
    name: 'Standard Paid Time-Off & Leave Governance Policy',
    category: 'leaves',
    description: 'Defines annual leave entitlements, carry forward ceilings, manager approval caps, and split-request prevention.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'allowance',
    allowedLimit: 2.0, // Manager cumulative approval cap: 2 days/month
    calculationMethod: 'cumulative_monthly',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '3.0',
    status: 'Active',
    precedence: 4,
    rules: {
      annualLeaveEntitlement: 14,
      casualLeaveEntitlement: 10,
      sickLeaveEntitlement: 8,
      maternityLeaveEntitlement: 90,
      maxCarryForwardDays: 5,
      managerMonthlyApprovalCap: 2.0,
      hrAdminMonthlyApprovalCap: 5.0,
      superAdminEscalationThreshold: 5.0,
      medicalDocThresholdDays: 2,
      minServiceMonthsForAnnualLeave: 3
    },
    approvalAuthorityRef: 'APV-LEV-STD',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Synchronized with provincial employment standards'
  },

  // 3. Payroll, Compensation & Benefits Policy
  {
    id: 'POL-PAY-001',
    name: 'Corporate Compensation, Allowances & Financial Advances Policy',
    category: 'payroll',
    description: 'Enforces strict Super Admin exclusive authority for salary revisions, loan caps, and allowance criteria.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'limit',
    allowedLimit: 30, // Max loan installment: 30% of net salary
    calculationMethod: 'formula',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '1.5',
    status: 'Active',
    precedence: 4,
    rules: {
      salaryRevisionRequiresSuperAdmin: true,
      maxAnnualIncrementPercentage: 25.0,
      loanMaxTenureMonths: 12,
      loanMaxAmountMultiplier: 3.0, // 3x basic salary
      loanMaxDeductionPercent: 30.0,
      fuelAllowanceExcludesReimbursement: true,
      standardPayrollCutoffDay: 25,
      taxWithholdingSection: 'Section 149 Income Tax Ordinance 2001'
    },
    approvalAuthorityRef: 'APV-SAL-REV',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Secured financial oversight & fiscal compliance'
  },

  // 4. Expense Management Policy
  {
    id: 'POL-EXP-001',
    name: 'Official Business Expense & Reimbursement Matrix Policy',
    category: 'expenses',
    description: 'Configurable financial authority thresholds, receipt attachment limits, and category ceilings.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'limit',
    allowedLimit: 25000, // Manager ceiling PKR 25,000
    calculationMethod: 'tiered',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '2.0',
    status: 'Active',
    precedence: 4,
    rules: {
      managerMaxLimit: 25000,
      hrAdminMaxLimit: 75000,
      superAdminThreshold: 75000,
      requiredReceiptThreshold: 1000,
      dailyFuelLimit: 6000,
      dailyMealLimit: 4000,
      monthlyCommunicationLimit: 10000,
      duplicateReceiptCheck: true,
      splitClaimDetection: true
    },
    approvalAuthorityRef: 'APV-EXP-MAT',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Unified financial authority tiers'
  },

  // 5. Travel & Transport Policy
  {
    id: 'POL-TRV-001',
    name: 'Business Travel, Advance & Transport Facilities Policy',
    category: 'travel',
    description: 'Travel advance limits, per-diem caps, pick-and-drop eligibility, and attendance bridging.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'limit',
    allowedLimit: 80, // Travel advance up to 80% of estimated budget
    calculationMethod: 'formula',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '1.2',
    status: 'Active',
    precedence: 4,
    rules: {
      maxAdvancePercentage: 80,
      perDiemDailyCap: 5000,
      domesticFlightAdvanceNoticeDays: 7,
      internationalTravelSuperAdminApproval: true,
      pickAndDropMonthlyChargeRate: 3500,
      transportCancellationNoticeDays: 15
    },
    approvalAuthorityRef: 'APV-TRV-REQ',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Standardized travel advance procedures'
  },

  // 6. Recruitment & Probation Policy
  {
    id: 'POL-REC-001',
    name: 'Talent Acquisition, Headcount & Probation Policy',
    category: 'recruitment',
    description: 'Requisition approval chain, standard 90-day probation timeline, and confirmation criteria.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'eligibility',
    allowedLimit: 90, // Standard 90 days probation
    calculationMethod: 'fixed',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '1.0',
    status: 'Active',
    precedence: 4,
    rules: {
      standardProbationDays: 90,
      maxProbationExtensionDays: 90,
      offerSuperAdminApprovalRequired: true,
      minInterviewerCount: 2,
      joiningDocSubmissionDays: 7
    },
    approvalAuthorityRef: 'APV-REC-REQ',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Formalized recruitment workflow'
  },

  // 7. Performance & Appraisal Policy
  {
    id: 'POL-PRF-001',
    name: 'Performance Review, KPI Scoring & Goal Alignment Policy',
    category: 'performance',
    description: 'Bi-annual appraisal cycles, self-assessment weightings, and anti-self-evaluation rules.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'eligibility',
    allowedLimit: 100, // Total KPI weight percentage
    calculationMethod: 'formula',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '1.4',
    status: 'Active',
    precedence: 4,
    rules: {
      kpiWeightSumRequired: 100,
      appraisalMinReviewDays: 14,
      managerAntiSelfEvaluation: true,
      hrModerationRequired: true,
      superAdminAppraisalFinalization: true,
      salaryIncrementRecommendationCapPercent: 20.0
    },
    approvalAuthorityRef: 'APV-PRF-REV',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Updated KPI calibration standards'
  },

  // 8. Training & Development Policy
  {
    id: 'POL-TRN-001',
    name: 'Corporate Upskilling, Certification & Development Policy',
    category: 'training',
    description: 'Course eligibility criteria, passing score thresholds (70%), and certificate validity.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'threshold',
    allowedLimit: 70, // Passing score 70%
    calculationMethod: 'fixed',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '1.1',
    status: 'Active',
    precedence: 4,
    rules: {
      minimumPassScorePercent: 70,
      annualTrainingBudgetPerEmployee: 50000,
      certificateValidityYears: 2,
      mandatoryAttendanceRatePercent: 85
    },
    approvalAuthorityRef: 'APV-TRN-ENR',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Upskilling benchmark updates'
  },

  // 9. Help Desk SLA & Escalation Policy
  {
    id: 'POL-HLP-001',
    name: 'IT & HR Support Service Level Agreement (SLA) Policy',
    category: 'helpdesk',
    description: 'Ticket response times, resolution deadlines, and automatic breach escalations.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'sla',
    allowedLimit: 24, // Standard 24h resolution SLA
    calculationMethod: 'fixed',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '1.3',
    status: 'Active',
    precedence: 4,
    rules: {
      slaHoursUrgent: 4,
      slaHoursHigh: 12,
      slaHoursMedium: 24,
      slaHoursLow: 48,
      firstResponseTargetHours: 2,
      autoEscalateOnBreach: true
    },
    approvalAuthorityRef: 'APV-HLP-ESC',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Service delivery metrics adjustment'
  },

  // 10. Corporate HR Letters Policy
  {
    id: 'POL-LTR-001',
    name: 'Corporate HR Letters Issuance & Signatory Authority Policy',
    category: 'letters',
    description: 'Restricts issuance of official letters, required approvals, and cryptographic verification codes.',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'eligibility',
    allowedLimit: 1,
    calculationMethod: 'fixed',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '1.0',
    status: 'Active',
    precedence: 4,
    rules: {
      authorizedSignatories: ['EMP-001', 'EMP-002'],
      confidentialSalaryLettersSuperAdminApproval: true,
      verificationCodeTamperProof: true,
      pdfWatermarkRequired: true
    },
    approvalAuthorityRef: 'APV-LTR-ISS',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-01 08:00:00',
    changeReason: 'Letter governance baseline'
  },

  // 11. Department Specific Policy Example: Development Team WFH & Attendance Exception
  {
    id: 'POL-ATT-DEV-002',
    name: 'Engineering Department Extended WFH & Flexible Shift Policy',
    category: 'attendance',
    description: 'Permits Development Department up to 4 WFH days per month and flexible 30-min morning window.',
    appliesTo: 'Department',
    scopeValue: 'DEP-01', // Development Department
    ruleType: 'threshold',
    allowedLimit: 4,
    calculationMethod: 'fixed',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: '1.0',
    status: 'Active',
    precedence: 2, // Precedence over company-wide policy
    rules: {
      graceMinutes: 30, // Flexible grace for engineering
      allowedLatesPerMonth: 4,
      wfhMonthlyAllowanceDays: 4 // Extended WFH
    },
    approvalAuthorityRef: 'APV-ATT-CORR',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)',
    updatedAt: '2026-01-15 10:00:00',
    changeReason: 'Department level engineering flexibility approval'
  }
]

export const INITIAL_APPROVAL_RULES = [
  {
    id: 'APV-LEV-STD',
    module: 'leaves',
    requestType: 'Normal Employee Leave',
    applicantTier: 'employee',
    threshold: 2,
    thresholdUnit: 'requests/year',
    initialApprover: 'Team Lead',
    initialApproverRole: 'team_lead',
    escalationApprover: 'Department Manager',
    escalationApproverRole: 'manager',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'annual',
    antiSelfApproval: true,
    description: 'Normal employee: 1st and 2nd qualifying annual leave requests approved by Team Lead (Final Approved). 3rd and subsequent requests escalate to Department Manager.'
  },
  {
    id: 'APV-LEV-TL',
    module: 'leaves',
    requestType: 'Team Lead Leave',
    applicantTier: 'team_lead',
    threshold: 2,
    thresholdUnit: 'requests/year',
    initialApprover: 'Department Manager',
    initialApproverRole: 'manager',
    escalationApprover: 'HR Admin',
    escalationApproverRole: 'hr_admin',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'annual',
    antiSelfApproval: true,
    description: 'Team Lead: 1st and 2nd qualifying annual leave requests approved by Department Manager (Final Approved). 3rd and subsequent requests escalate to HR Admin.'
  },
  {
    id: 'APV-LEV-MGR',
    module: 'leaves',
    requestType: 'Department Manager Leave',
    applicantTier: 'manager',
    threshold: 0,
    thresholdUnit: 'requests/year',
    initialApprover: 'HR Admin',
    initialApproverRole: 'hr_admin',
    escalationApprover: 'Super Admin',
    escalationApproverRole: 'super_admin',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'annual',
    antiSelfApproval: true,
    description: 'Department Manager cannot self-approve. Routes to HR Admin for review and Super Admin for final sign-off.'
  },
  {
    id: 'APV-LEV-HR',
    module: 'leaves',
    requestType: 'HR Admin Leave',
    applicantTier: 'hr_admin',
    threshold: 0,
    thresholdUnit: 'requests/year',
    initialApprover: 'Super Admin',
    initialApproverRole: 'super_admin',
    escalationApprover: 'Super Admin',
    escalationApproverRole: 'super_admin',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'annual',
    antiSelfApproval: true,
    description: 'HR Admin cannot self-approve. All requests route directly to Super Admin.'
  },
  {
    id: 'APV-EXP-MAT',
    module: 'expenses',
    requestType: 'Expense Claim',
    applicantTier: 'all',
    threshold: 25000, // PKR
    initialApprover: 'Manager',
    initialApproverRole: 'manager',
    escalationApprover: 'HR Admin',
    escalationApproverRole: 'hr_admin',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'monthly',
    antiSelfApproval: true,
    description: 'Manager approves <= 25,000 PKR. Claims > 25,000 up to 75,000 route to HR Admin. Claims > 75,000 require Super Admin.'
  },
  {
    id: 'APV-ATT-FLD',
    module: 'attendance',
    requestType: 'Field Duty & Client Visits',
    applicantTier: 'employee',
    threshold: 4.0, // hours
    initialApprover: 'Team Lead',
    initialApproverRole: 'team_lead',
    escalationApprover: 'Department Manager',
    escalationApproverRole: 'manager',
    finalAuthority: 'HR Admin',
    finalAuthorityRole: 'hr_admin',
    cumulativePeriod: 'daily',
    antiSelfApproval: true,
    description: 'Team Lead directly approves visits up to 4.0 hours (half-day). Requests > 4.0 hours (such as 9.0-hour full-shift visits like FLD-002) escalate to Department Manager for shift coverage sign-off. Visits > 9.0 hours require HR Admin.'
  },
  {
    id: 'APV-SAL-REV',
    module: 'payroll',
    requestType: 'Salary Revision',
    applicantTier: 'all',
    threshold: 0,
    initialApprover: 'HR Admin',
    initialApproverRole: 'hr_admin',
    escalationApprover: 'Super Admin',
    escalationApproverRole: 'super_admin',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'annual',
    antiSelfApproval: true,
    description: 'HR Admin proposes revision; Super Admin alone holds final authorization power.'
  },
  {
    id: 'APV-ATT-CORR',
    module: 'attendance',
    requestType: 'Missing Punch Correction',
    applicantTier: 'employee',
    threshold: 3, // occurrences
    initialApprover: 'Manager',
    initialApproverRole: 'manager',
    escalationApprover: 'HR Admin',
    escalationApproverRole: 'hr_admin',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'monthly',
    antiSelfApproval: true,
    description: 'Manager approves normal corrections; > 3 monthly corrections escalates to HR Admin.'
  },
  {
    id: 'APV-TRV-REQ',
    module: 'travel',
    requestType: 'Travel Request & Advance',
    applicantTier: 'all',
    threshold: 50000, // PKR estimated budget
    initialApprover: 'Manager',
    initialApproverRole: 'manager',
    escalationApprover: 'HR Admin',
    escalationApproverRole: 'hr_admin',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'trip',
    antiSelfApproval: true,
    description: 'Manager reviews business travel intent; HR Admin verifies advance; > 50,000 PKR advance requires Super Admin approval.'
  },
  {
    id: 'APV-REC-REQ',
    module: 'recruitment',
    requestType: 'Headcount Requisition',
    applicantTier: 'manager',
    threshold: 1, // headcount
    initialApprover: 'HR Admin',
    initialApproverRole: 'hr_admin',
    escalationApprover: 'Super Admin',
    escalationApproverRole: 'super_admin',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'quarterly',
    antiSelfApproval: true,
    description: 'Department manager requests opening; HR Admin reviews pipeline; Super Admin must sanction budget.'
  },
  {
    id: 'APV-LTR-ISS',
    module: 'letters',
    requestType: 'Corporate HR Letter',
    applicantTier: 'all',
    threshold: 0,
    initialApprover: 'HR Admin',
    initialApproverRole: 'hr_admin',
    escalationApprover: 'Super Admin',
    escalationApproverRole: 'super_admin',
    finalAuthority: 'Super Admin',
    finalAuthorityRole: 'super_admin',
    cumulativePeriod: 'request',
    antiSelfApproval: true,
    description: 'Letters requested by employees are vetted by HR Admin. Letters containing compensation or bank undertakings require Super Admin.'
  }
]
