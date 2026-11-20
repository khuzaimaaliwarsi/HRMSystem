/**
 * iSysware HRMS — F14 Canonical Report Registry
 * Central catalog of 75 professional reports across 12 families.
 * Strict Chartered Accountant / Auditor tabular layout — Zero Graphs.
 */

export const REPORT_FAMILIES = [
  {
    id: 'fam_org',
    familyNumber: 1,
    name: 'Workforce & Organization',
    description: 'Headcount, organizational masters, transfers, expiries, banking verification, and new joinings.',
    icon: 'building',
    reportCount: 6
  },
  {
    id: 'fam_rec',
    familyNumber: 2,
    name: 'Recruitment & Onboarding',
    description: 'Vacancies, applicant pipeline, interview outcomes, offers, and probation confirmations.',
    icon: 'user-plus',
    reportCount: 5
  },
  {
    id: 'fam_att',
    familyNumber: 3,
    name: 'Attendance, Shifts & Work Hours',
    description: 'Daily logs, monthly summaries, late/early grace, WFH, field visits, overtime, punch audit, and timesheets.',
    icon: 'clock',
    reportCount: 10
  },
  {
    id: 'fam_lev',
    familyNumber: 4,
    name: 'Leave & Approval Governance',
    description: 'Leave balance ledger, request status, entitlements, approval capacity, escalated exceptions, and SLA aging.',
    icon: 'calendar-alt',
    reportCount: 7
  },
  {
    id: 'fam_pay',
    familyNumber: 5,
    name: 'Payroll, Employee Pay & Banking',
    description: 'Payroll summary register, payslip breakdown, bank advice, department salary cost, increments, and liability rollforward.',
    icon: 'money-bill-wave',
    reportCount: 8
  },
  {
    id: 'fam_tax',
    familyNumber: 6,
    name: 'Tax & Salary Statutory Controls',
    description: 'FBR Section 149 salary tax withholding, annual tax summaries, withholding payable ledger, and tax certificates.',
    icon: 'file-invoice-dollar',
    reportCount: 5
  },
  {
    id: 'fam_ben',
    familyNumber: 7,
    name: 'Commissions, Allowances, Loans & Benefits',
    description: 'Sales targets, commission audits, allowances, recurring benefits, employee loan ledger, advances, and recovery schedules.',
    icon: 'hand-holding-usd',
    reportCount: 7
  },
  {
    id: 'fam_per',
    familyNumber: 8,
    name: 'Tasks, KPI, Performance & Training',
    description: 'Task completion, department goals, sales/dev KPIs, appraisals, training enrollments, and skill assessments.',
    icon: 'chart-line', // icon only for family metadata, zero graphs in reports
    reportCount: 8
  },
  {
    id: 'fam_pol',
    familyNumber: 9,
    name: 'Policy Governance & Approval Limits',
    description: 'Active company policies, change audit, reviewer threshold usage, exception delegation, and revision audits.',
    icon: 'shield-alt',
    reportCount: 5
  },
  {
    id: 'fam_hlp',
    familyNumber: 10,
    name: 'Help Desk Management',
    description: 'Ticket registers, response and resolution SLA aging, and workload/feedback metrics.',
    icon: 'headset',
    reportCount: 3
  },
  {
    id: 'fam_trv',
    familyNumber: 11,
    name: 'Travel, Pick-and-Drop & Expenses',
    description: 'Travel authorizations, advance settlements, transport seat rosters, expense claims, and project expense summaries.',
    icon: 'plane',
    reportCount: 7
  },
  {
    id: 'fam_sec',
    familyNumber: 12,
    name: 'HR Letters, Alerts & Security',
    description: 'Letter issuance, request aging, scheduled alert execution audit, and sensitive access/export security audit.',
    icon: 'envelope-open-text',
    reportCount: 4
  }
]

export const REPORT_REGISTRY = [
  // ==========================================
  // FAMILY 01: WORKFORCE & ORGANIZATION (6)
  // ==========================================
  {
    id: 'RPT-ORG-001',
    familyId: 'fam_org',
    number: 1,
    name: 'Workforce Master Register',
    description: 'Complete employee directory with identity, department, designation, manager, and current employment status.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'all',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'name', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'team', label: 'Team', align: 'left', width: 18 },
      { key: 'designation', label: 'Designation', align: 'left', width: 22 },
      { key: 'manager', label: 'Reporting Manager', align: 'left', width: 20 },
      { key: 'employmentType', label: 'Type', align: 'center', width: 14 },
      { key: 'workArrangement', label: 'Work Mode', align: 'center', width: 14 },
      { key: 'joinDate', label: 'Joining Date', align: 'center', width: 14 },
      { key: 'status', label: 'Status', align: 'center', width: 12 }
    ],
    summaryKeys: ['totalEmployees', 'activeCount', 'probationCount', 'separatedCount'],
    reconciliationRule: 'Total Employees = Active + Probation + Inactive + Separated'
  },
  {
    id: 'RPT-ORG-002',
    familyId: 'fam_org',
    number: 2,
    name: 'Department & Team Headcount',
    description: 'Breakdown of active, probation, and remote staff reconciled across departments and teams to company total.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'all',
    columns: [
      { key: 'department', label: 'Department', align: 'left', width: 20 },
      { key: 'team', label: 'Team', align: 'left', width: 20 },
      { key: 'manager', label: 'Manager / Lead', align: 'left', width: 20 },
      { key: 'active', label: 'Active', align: 'right', type: 'number', width: 12 },
      { key: 'probation', label: 'Probation', align: 'right', type: 'number', width: 12 },
      { key: 'inactive', label: 'Inactive / On Leave', align: 'right', type: 'number', width: 16 },
      { key: 'separated', label: 'Separated', align: 'right', type: 'number', width: 12 },
      { key: 'onSite', label: 'On-Site', align: 'right', type: 'number', width: 12 },
      { key: 'remote', label: 'Remote / Hybrid', align: 'right', type: 'number', width: 14 },
      { key: 'totalHeadcount', label: 'Total Staff', align: 'right', type: 'number', width: 14 }
    ],
    summaryKeys: ['totalHeadcount', 'totalActive', 'totalProbation', 'totalRemote'],
    reconciliationRule: 'Department Headcount = Sum of Team Headcounts = Active + Probation + Inactive + Separated'
  },
  {
    id: 'RPT-ORG-003',
    familyId: 'fam_org',
    number: 3,
    name: 'Employee Assignment / Transfer History',
    description: 'Effective-dated audit trail of departmental transfers, designation changes, and manager reassignments.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'recordId', label: 'Event Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'effectiveDate', label: 'Effective Date', align: 'center', width: 14 },
      { key: 'previousDept', label: 'Previous Dept', align: 'left', width: 18 },
      { key: 'newDept', label: 'New Dept', align: 'left', width: 18 },
      { key: 'previousRole', label: 'Previous Role', align: 'left', width: 20 },
      { key: 'newRole', label: 'New Role', align: 'left', width: 20 },
      { key: 'reason', label: 'Reason / Promotion Ref', align: 'left', width: 26 },
      { key: 'approvedBy', label: 'Authorized By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalEvents', 'departmentTransfers', 'roleChanges'],
    reconciliationRule: 'Total Assignment Events = Department Transfers + Role Reclassifications'
  },
  {
    id: 'RPT-ORG-004',
    familyId: 'fam_org',
    number: 4,
    name: 'Probation / Contract Expiry Due',
    description: 'Upcoming probation confirmations and contract renewal milestones with reviewer accountability.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'all',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'joinDate', label: 'Joining Date', align: 'center', width: 14 },
      { key: 'expiryDate', label: 'Due / Expiry Date', align: 'center', width: 14 },
      { key: 'reviewer', label: 'Responsible Reviewer', align: 'left', width: 20 },
      { key: 'dueStatus', label: 'Due Status', align: 'center', width: 16 },
      { key: 'currentDecision', label: 'Manager / HR Decision', align: 'left', width: 22 },
      { key: 'status', label: 'Workflow Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalDue', 'pendingConfirmation', 'extendedCount', 'confirmedCount'],
    reconciliationRule: 'Total Due = Pending Confirmation + Extended + Confirmed'
  },
  {
    id: 'RPT-ORG-005',
    familyId: 'fam_org',
    number: 5,
    name: 'Employee Banking Verification',
    description: 'Bank payment setup, masked accounts/IBAN, verification status, and audit attributions.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'all',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'bankName', label: 'Bank Name', align: 'left', width: 20 },
      { key: 'accountTitle', label: 'Account Title', align: 'left', width: 22 },
      { key: 'maskedAccount', label: 'Masked Account / IBAN', align: 'center', width: 22 },
      { key: 'paymentMethod', label: 'Method', align: 'center', width: 14 },
      { key: 'verificationStatus', label: 'Verification', align: 'center', width: 14 },
      { key: 'verifiedBy', label: 'Verified By', align: 'left', width: 20 },
      { key: 'effectiveDate', label: 'Effective Date', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalAccounts', 'verifiedCount', 'pendingVerificationCount', 'rejectedCount'],
    reconciliationRule: 'Total Accounts = Verified + Pending Verification + Rejected'
  },
  {
    id: 'RPT-ORG-006',
    familyId: 'fam_org',
    number: 6,
    name: 'New Joinings & Separations',
    description: 'Chronological register of workforce influx and separations with reference authorization.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'designation', label: 'Designation', align: 'left', width: 20 },
      { key: 'eventType', label: 'Event Type', align: 'center', width: 16 },
      { key: 'eventDate', label: 'Effective Date', align: 'center', width: 14 },
      { key: 'vacancyRef', label: 'Requisition / Exit Ref', align: 'left', width: 20 },
      { key: 'status', label: 'Status', align: 'center', width: 14 },
      { key: 'authorizedBy', label: 'Authorized By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalEvents', 'newHires', 'separations', 'netMovement'],
    reconciliationRule: 'Net Movement = New Hires - Separations'
  },

  // ==========================================
  // FAMILY 02: RECRUITMENT & ONBOARDING (5)
  // ==========================================
  {
    id: 'RPT-REC-001',
    familyId: 'fam_rec',
    number: 7,
    name: 'Vacancy Register',
    description: 'Approved manpower requisitions vs filled headcount, remaining openings, and budget status.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'requisitionId', label: 'Req ID', align: 'left', width: 14 },
      { key: 'title', label: 'Position Title', align: 'left', width: 24 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'openings', label: 'Openings', align: 'right', type: 'number', width: 12 },
      { key: 'filled', label: 'Filled', align: 'right', type: 'number', width: 12 },
      { key: 'remaining', label: 'Remaining', align: 'right', type: 'number', width: 12 },
      { key: 'priority', label: 'Priority', align: 'center', width: 12 },
      { key: 'status', label: 'Status', align: 'center', width: 14 },
      { key: 'approvedBy', label: 'Approved By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalPositions', 'totalFilled', 'totalRemaining'],
    reconciliationRule: 'Total Positions = Total Filled + Total Remaining'
  },
  {
    id: 'RPT-REC-002',
    familyId: 'fam_rec',
    number: 8,
    name: 'Candidate Pipeline',
    description: 'Active talent pool tracking through screening, interviews, offers, and hiring stages with aging.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'candidateId', label: 'Candidate ID', align: 'left', width: 14 },
      { key: 'name', label: 'Candidate Name', align: 'left', width: 22 },
      { key: 'position', label: 'Applied Position', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'stage', label: 'Current Stage', align: 'center', width: 16 },
      { key: 'applicationDate', label: 'Applied Date', align: 'center', width: 14 },
      { key: 'daysInStage', label: 'Days in Stage', align: 'right', type: 'number', width: 14 },
      { key: 'assignedRecruiter', label: 'Lead Recruiter', align: 'left', width: 20 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalCandidates', 'screeningCount', 'interviewCount', 'offeredCount'],
    reconciliationRule: 'Total Candidates = Sourced + Screening + Interviewing + Offered + Hired + Rejected'
  },
  {
    id: 'RPT-REC-003',
    familyId: 'fam_rec',
    number: 9,
    name: 'Interview Schedule & Outcome',
    description: 'Audit log of scheduled interviews, interviewer assignments, scorecard ratings, and decisions.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'interviewId', label: 'Interview Ref', align: 'left', width: 14 },
      { key: 'candidateName', label: 'Candidate', align: 'left', width: 22 },
      { key: 'position', label: 'Position', align: 'left', width: 20 },
      { key: 'round', label: 'Round / Type', align: 'center', width: 16 },
      { key: 'scheduledDate', label: 'Scheduled Date', align: 'center', width: 14 },
      { key: 'interviewer', label: 'Interviewer', align: 'left', width: 20 },
      { key: 'score', label: 'Score / 5', align: 'right', type: 'number', width: 12 },
      { key: 'recommendation', label: 'Outcome', align: 'center', width: 16 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalInterviews', 'completedInterviews', 'passedCount', 'rejectedCount'],
    reconciliationRule: 'Total Completed = Recommended + Shortlisted + Rejected'
  },
  {
    id: 'RPT-REC-004',
    familyId: 'fam_rec',
    number: 10,
    name: 'Offer/Acceptance Register',
    description: 'Formal employment offers issued, candidate acceptances, joining milestones, and linked employee IDs.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'offerId', label: 'Offer ID', align: 'left', width: 14 },
      { key: 'candidateName', label: 'Candidate Name', align: 'left', width: 22 },
      { key: 'position', label: 'Designation', align: 'left', width: 20 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'offeredSalary', label: 'Offered Salary', align: 'right', type: 'currency', width: 16 },
      { key: 'offerDate', label: 'Offer Date', align: 'center', width: 14 },
      { key: 'joiningTarget', label: 'Target Joining', align: 'center', width: 14 },
      { key: 'decision', label: 'Offer Decision', align: 'center', width: 16 },
      { key: 'linkedEmployeeId', label: 'Assigned EMP ID', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalOffers', 'acceptedOffers', 'declinedOffers', 'joinedCount'],
    reconciliationRule: 'Total Offers = Accepted + Pending + Declined'
  },
  {
    id: 'RPT-REC-005',
    familyId: 'fam_rec',
    number: 11,
    name: 'Onboarding & Probation Review',
    description: 'Checklist compliance of new hires, 90-day probation appraisals, extensions, and confirmation signoffs.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'joinDate', label: 'Joining Date', align: 'center', width: 14 },
      { key: 'probationEnd', label: 'Probation End', align: 'center', width: 14 },
      { key: 'onboardingProgress', label: 'Onboarding %', align: 'right', width: 14 },
      { key: 'evaluationRating', label: 'Appraisal Rating', align: 'right', type: 'number', width: 16 },
      { key: 'outcome', label: 'Probation Outcome', align: 'center', width: 16 },
      { key: 'approvedBy', label: 'Signoff Authority', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalOnboarded', 'confirmedCount', 'extendedCount', 'inProgressCount'],
    reconciliationRule: 'Total Enrolled = Confirmed + Extended + In Progress'
  },

  // ==========================================
  // FAMILY 03: ATTENDANCE, SHIFTS & WORK HOURS (10)
  // ==========================================
  {
    id: 'RPT-ATT-001',
    familyId: 'fam_att',
    number: 12,
    name: 'Daily Attendance Register',
    description: 'Detailed daily punch logs, in/out timestamps, payable hours, late/early flags, and daily status.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'today',
    columns: [
      { key: 'date', label: 'Date', align: 'center', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'name', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'shift', label: 'Assigned Shift', align: 'center', width: 14 },
      { key: 'checkIn', label: 'Check-In', align: 'center', width: 12 },
      { key: 'checkOut', label: 'Check-Out', align: 'center', width: 12 },
      { key: 'workHours', label: 'Work Hours', align: 'right', type: 'number', width: 12 },
      { key: 'lateMinutes', label: 'Late (Min)', align: 'right', type: 'number', width: 12 },
      { key: 'status', label: 'Attendance Status', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalRecords', 'presentCount', 'lateCount', 'absentCount', 'onLeaveCount'],
    reconciliationRule: 'Total Records = Present + Absent + Paid Leave + Unpaid Leave + WFH + Field Duty'
  },
  {
    id: 'RPT-ATT-002',
    familyId: 'fam_att',
    number: 13,
    name: 'Monthly Attendance Summary',
    description: 'Aggregated monthly breakdown: scheduled workdays, days present, leaves, half-days, and total payable hours.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'scheduledDays', label: 'Scheduled', align: 'right', type: 'number', width: 12 },
      { key: 'presentDays', label: 'Present', align: 'right', type: 'number', width: 12 },
      { key: 'paidLeave', label: 'Paid Leave', align: 'right', type: 'number', width: 12 },
      { key: 'unpaidLeave', label: 'Unpaid Leave', align: 'right', type: 'number', width: 12 },
      { key: 'absentDays', label: 'Absent', align: 'right', type: 'number', width: 12 },
      { key: 'halfDays', label: 'Half-Day', align: 'right', type: 'number', width: 12 },
      { key: 'payableHours', label: 'Payable Hours', align: 'right', type: 'number', width: 14 }
    ],
    summaryKeys: ['totalScheduled', 'totalPresent', 'totalPaidLeaves', 'totalAbsents', 'totalPayableHours'],
    reconciliationRule: 'Scheduled Days = Present Days + Paid Leave + Unpaid Leave + Absent Days + (Half Days * 0.5)'
  },
  {
    id: 'RPT-ATT-003',
    familyId: 'fam_att',
    number: 14,
    name: 'Late Occurrence & Grace Utilization',
    description: 'Monthly late occurrences, policy grace minutes utilized, allowed occurrences vs excess exceptions.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'allowedGraceLates', label: 'Policy Cap', align: 'right', type: 'number', width: 12 },
      { key: 'actualLates', label: 'Actual Lates', align: 'right', type: 'number', width: 12 },
      { key: 'totalLateMinutes', label: 'Late Minutes', align: 'right', type: 'number', width: 14 },
      { key: 'excessLates', label: 'Excess Lates', align: 'right', type: 'number', width: 12 },
      { key: 'reviewedAction', label: 'Exception Review', align: 'center', width: 18 },
      { key: 'status', label: 'Compliance Status', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalEmployees', 'compliantCount', 'excessLateCount', 'totalLateMinutes'],
    reconciliationRule: 'Actual Lates = Policy Grace Utilized + Excess Unexcused Lates'
  },
  {
    id: 'RPT-ATT-004',
    familyId: 'fam_att',
    number: 15,
    name: 'Early Exit & Half-Day Exceptions',
    description: 'Instances of premature departure, short work hours, unauthorized half-day conversions, and managerial notes.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'date', label: 'Date', align: 'center', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'scheduledEnd', label: 'Shift End', align: 'center', width: 12 },
      { key: 'actualCheckOut', label: 'Check-Out', align: 'center', width: 12 },
      { key: 'earlyMinutes', label: 'Early (Min)', align: 'right', type: 'number', width: 12 },
      { key: 'classification', label: 'Classification', align: 'center', width: 16 },
      { key: 'approvedBy', label: 'Reviewed By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalExceptions', 'authorizedEarly', 'unauthorizedEarly', 'halfDayCount'],
    reconciliationRule: 'Total Early Exits = Approved Early Leave + Half-Day Adjustments + Unauthorized Departures'
  },
  {
    id: 'RPT-ATT-005',
    familyId: 'fam_att',
    number: 16,
    name: 'WFH / Hybrid Register',
    description: 'Work-from-home schedule requests, pre-approvals, remote attendance check-ins, and compliance tracking.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'requestId', label: 'Request Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'date', label: 'Remote Date', align: 'center', width: 14 },
      { key: 'reason', label: 'Remote Justification', align: 'left', width: 24 },
      { key: 'punchVerified', label: 'Punch Logged', align: 'center', width: 14 },
      { key: 'status', label: 'Approval Status', align: 'center', width: 14 },
      { key: 'approvedBy', label: 'Authorized By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalWfhDays', 'approvedWfhDays', 'pendingWfhDays'],
    reconciliationRule: 'Total WFH Days = Approved WFH + Rejected WFH + Pending WFH'
  },
  {
    id: 'RPT-ATT-006',
    familyId: 'fam_att',
    number: 17,
    name: 'Field/Client Duty Register',
    description: 'Official client visits and external field duties with verifier approval and eligible hours.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'dutyId', label: 'Duty Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'clientName', label: 'Client / Site', align: 'left', width: 22 },
      { key: 'date', label: 'Duty Date', align: 'center', width: 14 },
      { key: 'startTime', label: 'Start Time', align: 'center', width: 12 },
      { key: 'endTime', label: 'End Time', align: 'center', width: 12 },
      { key: 'payableHours', label: 'Eligible Hours', align: 'right', type: 'number', width: 14 },
      { key: 'approvedBy', label: 'Verified By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalDuties', 'totalFieldHours', 'approvedDuties'],
    reconciliationRule: 'Total Field Hours = Sum of Approved Payable Hours across Client Duties'
  },
  {
    id: 'RPT-ATT-007',
    familyId: 'fam_att',
    number: 18,
    name: 'Overtime Request & Pay Eligibility',
    description: 'Submitted vs manager-verified and HR-approved overtime hours, applicable rate, and payroll bridge.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'otId', label: 'OT Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'date', label: 'Overtime Date', align: 'center', width: 14 },
      { key: 'claimedHours', label: 'Claimed (Hrs)', align: 'right', type: 'number', width: 14 },
      { key: 'approvedHours', label: 'Approved (Hrs)', align: 'right', type: 'number', width: 14 },
      { key: 'hourlyRate', label: 'OT Rate', align: 'right', type: 'currency', width: 14 },
      { key: 'totalOtPay', label: 'Payable Amount', align: 'right', type: 'currency', width: 16 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalClaimedHours', 'totalApprovedHours', 'totalOtPayable'],
    reconciliationRule: 'Payable Amount = Approved Hours * Hourly OT Rate (Reconciles with F06 Payroll Overtime)'
  },
  {
    id: 'RPT-ATT-008',
    familyId: 'fam_att',
    number: 19,
    name: 'Missed Punch / Correction Audit',
    description: 'Audit log of biometric missing punches, employee regularization claims, reasons, and managerial signoffs.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'regularizationId', label: 'Audit Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'date', label: 'Punch Date', align: 'center', width: 14 },
      { key: 'originalPunch', label: 'Raw Punch Record', align: 'center', width: 16 },
      { key: 'correctedPunch', label: 'Corrected Time', align: 'center', width: 16 },
      { key: 'reason', label: 'Reason for Regularization', align: 'left', width: 24 },
      { key: 'reviewer', label: 'Reviewer', align: 'left', width: 20 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalRequests', 'approvedCorrections', 'rejectedCorrections'],
    reconciliationRule: 'Total Correction Requests = Approved Corrections + Rejected Corrections + Pending'
  },
  {
    id: 'RPT-ATT-009',
    familyId: 'fam_att',
    number: 20,
    name: 'Shift Roster & Variance',
    description: 'Planned shift assignments vs actual punched timing, roster deviations, and unauthorized shift changes.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'assignedShift', label: 'Assigned Shift', align: 'center', width: 16 },
      { key: 'shiftTiming', label: 'Standard Hours', align: 'center', width: 16 },
      { key: 'actualPunches', label: 'Actual Worked', align: 'center', width: 16 },
      { key: 'varianceMinutes', label: 'Variance (Min)', align: 'right', type: 'number', width: 14 },
      { key: 'deviationStatus', label: 'Deviation Type', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalRostered', 'onScheduleCount', 'deviatedCount'],
    reconciliationRule: 'Total Rostered = On Schedule + Deviated Shift Operations'
  },
  {
    id: 'RPT-ATT-010',
    familyId: 'fam_att',
    number: 21,
    name: 'Timesheet & Project Hour Register',
    description: 'Project-wise and milestone-wise task hours submitted by staff, verified billable/cost hours, and reviewers.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'timesheetId', label: 'Timesheet Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'project', label: 'Project / Client', align: 'left', width: 22 },
      { key: 'milestone', label: 'Milestone / Task', align: 'left', width: 20 },
      { key: 'submittedHours', label: 'Logged (Hrs)', align: 'right', type: 'number', width: 14 },
      { key: 'acceptedHours', label: 'Accepted (Hrs)', align: 'right', type: 'number', width: 14 },
      { key: 'rateBasis', label: 'Pay Basis', align: 'center', width: 14 },
      { key: 'reviewer', label: 'Approver', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalLoggedHours', 'totalAcceptedHours', 'totalProjects'],
    reconciliationRule: 'Accepted Hours <= Logged Hours; Verified against Attendance Work Hours'
  },

  // ==========================================
  // FAMILY 04: LEAVE & APPROVAL GOVERNANCE (7)
  // ==========================================
  {
    id: 'RPT-LEV-001',
    familyId: 'fam_lev',
    number: 22,
    name: 'Employee Leave Balance Ledger',
    description: 'Opening leave balances, monthly accruals, approved leaves taken, adjustments, and closing balances.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'leaveType', label: 'Leave Type', align: 'center', width: 14 },
      { key: 'opening', label: 'Opening', align: 'right', type: 'number', width: 12 },
      { key: 'earned', label: 'Accrued', align: 'right', type: 'number', width: 12 },
      { key: 'consumed', label: 'Consumed', align: 'right', type: 'number', width: 12 },
      { key: 'adjusted', label: 'Adjusted', align: 'right', type: 'number', width: 12 },
      { key: 'closing', label: 'Closing Balance', align: 'right', type: 'number', width: 14 }
    ],
    summaryKeys: ['totalOpening', 'totalAccrued', 'totalConsumed', 'totalClosing'],
    reconciliationRule: 'Closing Balance = Opening + Accrued - Consumed +/- Adjustments'
  },
  {
    id: 'RPT-LEV-002',
    familyId: 'fam_lev',
    number: 23,
    name: 'Leave Request Status Register',
    description: 'Chronological tracking of leave requests, leave type, applied dates, duration, approver tier, and decisions.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'requestId', label: 'Request Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'leaveType', label: 'Type', align: 'center', width: 14 },
      { key: 'startDate', label: 'From Date', align: 'center', width: 14 },
      { key: 'endDate', label: 'To Date', align: 'center', width: 14 },
      { key: 'days', label: 'Days', align: 'right', type: 'number', width: 10 },
      { key: 'reviewer', label: 'Reviewer Tier', align: 'left', width: 20 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalRequests', 'approvedDays', 'rejectedDays', 'pendingDays'],
    reconciliationRule: 'Total Days Requested = Approved Days + Rejected Days + Pending Days'
  },
  {
    id: 'RPT-LEV-003',
    familyId: 'fam_lev',
    number: 24,
    name: 'Leave Entitlement vs Utilization',
    description: 'Annual policy quota vs utilized leaves categorized by paid/unpaid status with policy references.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'annualEntitlement', label: 'Annual Entitlement', align: 'right', type: 'number', width: 16 },
      { key: 'paidConsumed', label: 'Paid Consumed', align: 'right', type: 'number', width: 14 },
      { key: 'unpaidConsumed', label: 'Unpaid Consumed', align: 'right', type: 'number', width: 14 },
      { key: 'remainingEntitlement', label: 'Remaining Entitlement', align: 'right', type: 'number', width: 16 },
      { key: 'utilizationRate', label: 'Utilization %', align: 'right', width: 14 }
    ],
    summaryKeys: ['totalEntitlement', 'totalPaidConsumed', 'totalUnpaidConsumed', 'totalRemainingQuota'],
    reconciliationRule: 'Remaining Entitlement = Annual Entitlement - Paid Consumed'
  },
  {
    id: 'RPT-LEV-004',
    familyId: 'fam_lev',
    number: 25,
    name: 'Manager vs HR Leave Approval Capacity',
    description: 'Tier-wise approval threshold monitoring: single-request and cumulative monthly authority caps vs usage.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'reviewerId', label: 'Reviewer ID', align: 'left', width: 14 },
      { key: 'reviewerName', label: 'Approver Name', align: 'left', width: 22 },
      { key: 'role', label: 'Authority Role', align: 'center', width: 14 },
      { key: 'singleRequestCap', label: 'Max Per Req', align: 'right', type: 'number', width: 12 },
      { key: 'monthlyCap', label: 'Monthly Cap', align: 'right', type: 'number', width: 12 },
      { key: 'cumulativeApproved', label: 'Cumulative Used', align: 'right', type: 'number', width: 14 },
      { key: 'remainingCapacity', label: 'Remaining Cap', align: 'right', type: 'number', width: 14 },
      { key: 'escalationsTriggered', label: 'Escalations Sent', align: 'right', type: 'number', width: 14 }
    ],
    summaryKeys: ['totalApprovers', 'totalApprovedDays', 'totalEscalationsTriggered'],
    reconciliationRule: 'Remaining Capacity = Monthly Cap - Cumulative Used'
  },
  {
    id: 'RPT-LEV-005',
    familyId: 'fam_lev',
    number: 26,
    name: 'Escalated / Above-Limit Leave Exceptions',
    description: 'Requests that exceeded Manager or HR approval thresholds and routed to higher authorities.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'requestId', label: 'Request Ref', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Applicant Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'requestedDays', label: 'Days Requested', align: 'right', type: 'number', width: 14 },
      { key: 'thresholdExceeded', label: 'Threshold Exceeded', align: 'left', width: 22 },
      { key: 'routedTo', label: 'Escalated Approver', align: 'left', width: 20 },
      { key: 'escalationReason', label: 'Escalation Reason', align: 'left', width: 24 },
      { key: 'finalDecision', label: 'Final Decision', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalEscalated', 'approvedExceptions', 'rejectedExceptions'],
    reconciliationRule: 'Total Escalations = Approved Exceptions + Rejected Exceptions + In Review'
  },
  {
    id: 'RPT-LEV-006',
    familyId: 'fam_lev',
    number: 27,
    name: 'Leave/Attendance Overlap Audit',
    description: 'Audit report verifying zero double-counting between approved leaves, biometric attendance, and public holidays.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'date', label: 'Conflict Date', align: 'center', width: 14 },
      { key: 'leaveRecord', label: 'Leave Entry', align: 'left', width: 18 },
      { key: 'attendanceRecord', label: 'Punch Record', align: 'left', width: 18 },
      { key: 'holidayRecord', label: 'Public Holiday', align: 'left', width: 18 },
      { key: 'resolution', label: 'Resolved Treatment', align: 'left', width: 22 },
      { key: 'status', label: 'Audit Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalAuditChecks', 'cleanCount', 'conflictsResolved'],
    reconciliationRule: 'Every calendar day is uniquely classified: either Work, Paid Leave, Unpaid Leave, or Public Holiday'
  },
  {
    id: 'RPT-LEV-007',
    familyId: 'fam_lev',
    number: 28,
    name: 'Approval Aging / SLA Register',
    description: 'Pending leave approvals categorized by current reviewer tier, elapsed waiting time, and SLA compliance.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'all',
    columns: [
      { key: 'requestId', label: 'Request Ref', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Applicant Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'submittedDate', label: 'Submission Date', align: 'center', width: 14 },
      { key: 'pendingWith', label: 'Pending Approver', align: 'left', width: 20 },
      { key: 'elapsedDays', label: 'Aging (Days)', align: 'right', type: 'number', width: 12 },
      { key: 'slaTarget', label: 'SLA Target', align: 'center', width: 14 },
      { key: 'slaStatus', label: 'SLA Compliance', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalPending', 'withinSla', 'breachedSla'],
    reconciliationRule: 'Total Pending = Within SLA + Overdue / SLA Breached'
  },

  // ==========================================
  // FAMILY 05: PAYROLL, EMPLOYEE PAY & BANKING (8)
  // ==========================================
  {
    id: 'RPT-PAY-001',
    familyId: 'fam_pay',
    number: 29,
    name: 'Payroll Summary Register',
    description: 'The master payroll journal: Basic, Overtime, Commissions, Allowances, Gross, Tax, Deductions, and Net Payable.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 20 },
      { key: 'department', label: 'Department', align: 'left', width: 16 },
      { key: 'basicSalary', label: 'Basic Salary', align: 'right', type: 'currency', width: 15 },
      { key: 'allowances', label: 'Allowances', align: 'right', type: 'currency', width: 14 },
      { key: 'commissions', label: 'Commissions', align: 'right', type: 'currency', width: 14 },
      { key: 'overtime', label: 'Overtime', align: 'right', type: 'currency', width: 13 },
      { key: 'grossPay', label: 'Gross Pay', align: 'right', type: 'currency', width: 16 },
      { key: 'taxWithheld', label: 'Salary Tax', align: 'right', type: 'currency', width: 14 },
      { key: 'otherDeductions', label: 'Other Deductions', align: 'right', type: 'currency', width: 14 },
      { key: 'netPayable', label: 'Net Payable', align: 'right', type: 'currency', width: 16 }
    ],
    summaryKeys: ['totalBasic', 'totalGross', 'totalTax', 'totalDeductions', 'totalNet'],
    reconciliationRule: 'Gross = Basic + Allowances + Commissions + Overtime; Net = Gross - Tax - Other Deductions'
  },
  {
    id: 'RPT-PAY-002',
    familyId: 'fam_pay',
    number: 30,
    name: 'Employee Payslip Breakdown',
    description: 'Itemized payslip component details for individual staff including earnings, statutory tax, and loan recoveries.',
    allowedRoles: ['super_admin', 'hr_admin', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'payslipId', label: 'Payslip Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'payPeriod', label: 'Pay Period', align: 'center', width: 14 },
      { key: 'basicPay', label: 'Basic Pay', align: 'right', type: 'currency', width: 15 },
      { key: 'totalEarnings', label: 'Total Earnings', align: 'right', type: 'currency', width: 16 },
      { key: 'taxDeduction', label: 'Tax (Sec 149)', align: 'right', type: 'currency', width: 15 },
      { key: 'loanDeduction', label: 'Loan Recovery', align: 'right', type: 'currency', width: 14 },
      { key: 'unpaidLeaveDeduction', label: 'Unpaid Leave', align: 'right', type: 'currency', width: 14 },
      { key: 'netSalary', label: 'Net Payable', align: 'right', type: 'currency', width: 16 },
      { key: 'status', label: 'Run Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalGrossEarnings', 'totalTaxDeductions', 'totalLoanRecoveries', 'totalNetDisbursed'],
    reconciliationRule: 'Net Salary = Total Earnings - (Tax + Loan Recovery + Unpaid Leave Deductions)'
  },
  {
    id: 'RPT-PAY-003',
    familyId: 'fam_pay',
    number: 31,
    name: 'Payroll Exception & Reconciliation',
    description: 'Variance analysis comparing Draft vs Final posted payroll, authorization discrepancies, and manual adjustments.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'itemRef', label: 'Reference', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee', align: 'left', width: 22 },
      { key: 'component', label: 'Component', align: 'left', width: 18 },
      { key: 'draftAmount', label: 'Draft Value', align: 'right', type: 'currency', width: 15 },
      { key: 'finalAmount', label: 'Final Value', align: 'right', type: 'currency', width: 15 },
      { key: 'variance', label: 'Variance', align: 'right', type: 'currency', width: 14 },
      { key: 'reason', label: 'Adjustment Reason', align: 'left', width: 24 },
      { key: 'approvedBy', label: 'Signoff Authority', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalDraft', 'totalFinal', 'netVariance'],
    reconciliationRule: 'Final Amount = Draft Amount + Approved Adjustments; Net Variance = Final - Draft'
  },
  {
    id: 'RPT-PAY-004',
    familyId: 'fam_pay',
    number: 32,
    name: 'Salary Payment Register',
    description: 'Banking disbursement advice: masked accounts, batch reference, approved net pay, amount paid, and unpaid liabilities.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'batchRef', label: 'Batch Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 20 },
      { key: 'bankName', label: 'Bank Name', align: 'left', width: 18 },
      { key: 'maskedAccount', label: 'Masked IBAN / Account', align: 'center', width: 20 },
      { key: 'approvedNet', label: 'Approved Net', align: 'right', type: 'currency', width: 15 },
      { key: 'amountPaid', label: 'Amount Paid', align: 'right', type: 'currency', width: 15 },
      { key: 'unpaidBalance', label: 'Unpaid Liability', align: 'right', type: 'currency', width: 15 },
      { key: 'paymentStatus', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalApprovedNet', 'totalDisbursed', 'totalUnpaidLiability'],
    reconciliationRule: 'Unpaid Liability = Approved Net - Amount Paid (Failed or pending payments remain unpaid liabilities)'
  },
  {
    id: 'RPT-PAY-005',
    familyId: 'fam_pay',
    number: 33,
    name: 'Salary Cost by Department / Employee Type',
    description: 'Approved payroll cost breakdown grouped by organizational departments, teams, and employment contracts.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'department', label: 'Department', align: 'left', width: 20 },
      { key: 'employmentType', label: 'Contract Type', align: 'center', width: 16 },
      { key: 'headcount', label: 'Staff Count', align: 'right', type: 'number', width: 12 },
      { key: 'basicTotal', label: 'Basic Total', align: 'right', type: 'currency', width: 16 },
      { key: 'allowancesTotal', label: 'Allowances', align: 'right', type: 'currency', width: 15 },
      { key: 'commissionsTotal', label: 'Commissions', align: 'right', type: 'currency', width: 15 },
      { key: 'overtimeTotal', label: 'Overtime', align: 'right', type: 'currency', width: 14 },
      { key: 'totalGrossCost', label: 'Total Company Cost', align: 'right', type: 'currency', width: 18 }
    ],
    summaryKeys: ['totalStaff', 'sumBasic', 'sumGrossCost'],
    reconciliationRule: 'Total Company Cost = Sum of Basic + Allowances + Commissions + Overtime across all departments'
  },
  {
    id: 'RPT-PAY-006',
    familyId: 'fam_pay',
    number: 34,
    name: 'Salary Increment & Decrement Register',
    description: 'Historical register of salary changes: previous salary, revised salary, absolute change, percentage, and approval.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'revisionId', label: 'Revision Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 20 },
      { key: 'currentSalary', label: 'Previous Pay', align: 'right', type: 'currency', width: 15 },
      { key: 'proposedSalary', label: 'Revised Pay', align: 'right', type: 'currency', width: 15 },
      { key: 'deltaAmount', label: 'Change Amount', align: 'right', type: 'currency', width: 14 },
      { key: 'percentageChange', label: '% Change', align: 'right', width: 12 },
      { key: 'effectiveDate', label: 'Effective Date', align: 'center', width: 14 },
      { key: 'proposedBy', label: 'Proposer', align: 'left', width: 18 },
      { key: 'approvedBy', label: 'Super Admin Approval', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalRevisions', 'netMonthlyIncrement', 'approvedRevisionsCount'],
    reconciliationRule: 'Change Amount = Revised Pay - Previous Pay; strictly requires Super Admin final authorization'
  },
  {
    id: 'RPT-PAY-007',
    familyId: 'fam_pay',
    number: 35,
    name: 'Career Movement / Promotion Register',
    description: 'Promotions, designation elevations, responsibility adjustments, and linked compensation adjustments.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'movementId', label: 'Promotion Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'previousDesignation', label: 'Previous Title', align: 'left', width: 22 },
      { key: 'newDesignation', label: 'New Title', align: 'left', width: 22 },
      { key: 'effectiveDate', label: 'Effective Date', align: 'center', width: 14 },
      { key: 'linkedSalaryRevision', label: 'Salary Action', align: 'center', width: 16 },
      { key: 'authorizedBy', label: 'Authorized By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalPromotions', 'withSalaryIncrement', 'lateralTransfers'],
    reconciliationRule: 'Total Career Movements = Promotions + Lateral Reassignments'
  },
  {
    id: 'RPT-PAY-008',
    familyId: 'fam_pay',
    number: 36,
    name: 'Outstanding Payroll Liability Rollforward',
    description: 'Chartered Accountant-grade payroll liability continuity: Opening Payable + Approved Payroll - Disbursed = Closing.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'period', label: 'Pay Period', align: 'center', width: 14 },
      { key: 'openingLiability', label: 'Opening Payable', align: 'right', type: 'currency', width: 16 },
      { key: 'payrollAccrued', label: 'Approved Net Pay', align: 'right', type: 'currency', width: 16 },
      { key: 'paymentsDisbursed', label: 'Disbursed Paid', align: 'right', type: 'currency', width: 16 },
      { key: 'adjustments', label: 'Adjustments', align: 'right', type: 'currency', width: 14 },
      { key: 'closingLiability', label: 'Closing Payable', align: 'right', type: 'currency', width: 16 },
      { key: 'status', label: 'Reconciliation Status', align: 'center', width: 18 }
    ],
    summaryKeys: ['openingBalance', 'totalAccruals', 'totalDisbursements', 'closingBalance'],
    reconciliationRule: 'Closing Payable = Opening Payable + Approved Net Pay - Disbursed Paid +/- Adjustments'
  },

  // ==========================================
  // FAMILY 06: TAX & SALARY STATUTORY CONTROLS (5)
  // ==========================================
  {
    id: 'RPT-TAX-001',
    familyId: 'fam_tax',
    number: 37,
    name: 'Monthly Employee Salary Tax Withholding',
    description: 'FBR Section 149 progressive income tax computation, taxable salary, slab rule version, and deducted tax.',
    allowedRoles: ['super_admin', 'hr_admin', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'taxYear', label: 'Tax Year', align: 'center', width: 12 },
      { key: 'taxableSalary', label: 'Taxable Salary', align: 'right', type: 'currency', width: 16 },
      { key: 'annualizedSalary', label: 'Annualized Base', align: 'right', type: 'currency', width: 16 },
      { key: 'slabRate', label: 'FBR Bracket', align: 'center', width: 16 },
      { key: 'monthlyTax', label: 'Tax Withheld', align: 'right', type: 'currency', width: 15 },
      { key: 'effectiveRule', label: 'Tax Rule Version', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalTaxablePayroll', 'totalMonthlyTaxWithheld', 'taxedEmployeesCount'],
    reconciliationRule: 'Monthly Tax = Annual FBR Tax Computed from Slabs / 12 (Preserves historical immutable snapshots)'
  },
  {
    id: 'RPT-TAX-002',
    familyId: 'fam_tax',
    number: 38,
    name: 'Annual Employee Tax Summary',
    description: 'Year-to-date cumulative taxable earnings, period-wise tax deductions, and statutory compliance status.',
    allowedRoles: ['super_admin', 'hr_admin', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'taxYear', label: 'Tax Year', align: 'center', width: 12 },
      { key: 'ytdTaxableSalary', label: 'YTD Taxable Salary', align: 'right', type: 'currency', width: 18 },
      { key: 'ytdTaxWithheld', label: 'YTD Tax Withheld', align: 'right', type: 'currency', width: 16 },
      { key: 'effectiveTaxRate', label: 'Effective %', align: 'right', width: 12 },
      { key: 'status', label: 'FBR Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalYtdTaxableSalary', 'totalYtdTaxWithheld'],
    reconciliationRule: 'YTD Tax Withheld = Sum of Monthly Tax Withheld from Posted Payroll Runs'
  },
  {
    id: 'RPT-TAX-003',
    familyId: 'fam_tax',
    number: 39,
    name: 'Withholding Payable / Remittance Ledger',
    description: 'Accounting continuity of tax collected from employees vs actual bank CPR remittances to FBR.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'period', label: 'Tax Month', align: 'center', width: 14 },
      { key: 'openingLiability', label: 'Opening Payable', align: 'right', type: 'currency', width: 16 },
      { key: 'taxWithheld', label: 'Tax Withheld', align: 'right', type: 'currency', width: 16 },
      { key: 'remittedAmount', label: 'FBR Remittance', align: 'right', type: 'currency', width: 16 },
      { key: 'cprReference', label: 'CPR / Challan Ref', align: 'center', width: 18 },
      { key: 'closingLiability', label: 'Closing Payable', align: 'right', type: 'currency', width: 16 }
    ],
    summaryKeys: ['openingTaxLiability', 'totalTaxWithheld', 'totalRemitted', 'closingTaxLiability'],
    reconciliationRule: 'Closing Tax Payable = Opening Payable + Tax Withheld - FBR Remittance (Tax withheld is distinct from remitted)'
  },
  {
    id: 'RPT-TAX-004',
    familyId: 'fam_tax',
    number: 40,
    name: 'Salary Tax Exception & Recalculation Audit',
    description: 'Audit log of mid-year tax rate revisions, adjustments, arrears, and approved recalculation references.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'auditId', label: 'Audit Ref', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'payPeriod', label: 'Period Affected', align: 'center', width: 14 },
      { key: 'originalTax', label: 'Original Tax', align: 'right', type: 'currency', width: 15 },
      { key: 'revisedTax', label: 'Adjusted Tax', align: 'right', type: 'currency', width: 15 },
      { key: 'taxDelta', label: 'Difference', align: 'right', type: 'currency', width: 14 },
      { key: 'reason', label: 'Adjustment Basis', align: 'left', width: 24 },
      { key: 'approvedBy', label: 'Authorized By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalExceptions', 'netTaxAdjustment'],
    reconciliationRule: 'Difference = Adjusted Tax - Original Tax; verified by Super Admin / HR Controller'
  },
  {
    id: 'RPT-TAX-005',
    familyId: 'fam_tax',
    number: 41,
    name: 'Employee Tax Certificate Register',
    description: 'Formal annual salary tax withholding certificates issued to staff for personal FBR tax filing.',
    allowedRoles: ['super_admin', 'hr_admin', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'certificateNo', label: 'Certificate Ref', align: 'left', width: 18 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'ntnCnic', label: 'NTN / CNIC', align: 'center', width: 18 },
      { key: 'taxYear', label: 'Tax Year', align: 'center', width: 12 },
      { key: 'grossTaxable', label: 'Total Taxable Pay', align: 'right', type: 'currency', width: 16 },
      { key: 'totalTaxDeducted', label: 'Total Tax Deducted', align: 'right', type: 'currency', width: 16 },
      { key: 'issueDate', label: 'Issuance Date', align: 'center', width: 14 },
      { key: 'issuedBy', label: 'Issued By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalCertificates', 'totalCertifiedTaxable', 'totalCertifiedTax'],
    reconciliationRule: 'Certificate amounts strictly reconcile with posted annual payroll snapshots'
  },

  // ==========================================
  // FAMILY 07: COMMISSIONS, ALLOWANCES, LOANS & BENEFITS (7)
  // ==========================================
  {
    id: 'RPT-BEN-001',
    familyId: 'fam_ben',
    number: 42,
    name: 'Sales Target & Commission Statement',
    description: 'Sales targets, booked deals, cash collections, qualifying commissions, reversals, and paid amounts.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Sales Exec', align: 'left', width: 20 },
      { key: 'targetAmount', label: 'Target (PKR)', align: 'right', type: 'currency', width: 16 },
      { key: 'bookedSales', label: 'Booked Sales', align: 'right', type: 'currency', width: 16 },
      { key: 'collectedAmount', label: 'Verified Collections', align: 'right', type: 'currency', width: 16 },
      { key: 'qualifyingCommission', label: 'Earned Commission', align: 'right', type: 'currency', width: 16 },
      { key: 'reversals', label: 'Reversals', align: 'right', type: 'currency', width: 14 },
      { key: 'netCommissionPaid', label: 'Net Payable', align: 'right', type: 'currency', width: 16 }
    ],
    summaryKeys: ['totalTargets', 'totalCollections', 'totalCommissionsEarned', 'totalCommissionsPaid'],
    reconciliationRule: 'Net Commission = Earned Commission - Reversals (Earned only upon verified cash collection)'
  },
  {
    id: 'RPT-BEN-002',
    familyId: 'fam_ben',
    number: 43,
    name: 'Commission Qualification / Reversal Audit',
    description: 'Source deal verification, client payment receipt reference, cancellation clawbacks, and approval actors.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'transactionId', label: 'Deal Ref', align: 'left', width: 14 },
      { key: 'salesPerson', label: 'Sales Executive', align: 'left', width: 20 },
      { key: 'clientName', label: 'Client / Contract', align: 'left', width: 22 },
      { key: 'dealValue', label: 'Deal Value', align: 'right', type: 'currency', width: 15 },
      { key: 'commissionPlan', label: 'Plan Code', align: 'center', width: 14 },
      { key: 'calculatedCommission', label: 'Commission', align: 'right', type: 'currency', width: 15 },
      { key: 'eventType', label: 'Event', align: 'center', width: 16 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalEvents', 'grossCommissions', 'reversedCommissions'],
    reconciliationRule: 'Gross Commissions - Reversed Commissions = Net Qualifying Commissions'
  },
  {
    id: 'RPT-BEN-003',
    familyId: 'fam_ben',
    number: 44,
    name: 'Allowance & Bonus Register',
    description: 'Breakdown of recurring and one-time allowances (Fuel, Mobile, Transport, Medical) and executive bonuses.',
    allowedRoles: ['super_admin', 'hr_admin', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'allowanceType', label: 'Allowance / Bonus', align: 'left', width: 20 },
      { key: 'amount', label: 'Approved Value', align: 'right', type: 'currency', width: 16 },
      { key: 'taxableStatus', label: 'Tax Treatment', align: 'center', width: 16 },
      { key: 'payPeriod', label: 'Linked Run', align: 'center', width: 14 },
      { key: 'approvedBy', label: 'Authorized By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalAllowancesCount', 'totalApprovedAmount', 'taxableAllowancesSum'],
    reconciliationRule: 'Total Allowance Amount matches F06 Monthly Payroll allowances component'
  },
  {
    id: 'RPT-BEN-004',
    familyId: 'fam_ben',
    number: 45,
    name: 'Recurring Benefits & Fuel/Transport Eligibility',
    description: 'Active employee transport benefits, fuel allowance quotas, and pick-and-drop non-duplication enforcement.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'all',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'fuelBenefit', label: 'Fuel Quota (Ltr/PKR)', align: 'right', type: 'currency', width: 18 },
      { key: 'mobileBenefit', label: 'Mobile Allowance', align: 'right', type: 'currency', width: 16 },
      { key: 'transportAssignment', label: 'Transport Pass', align: 'center', width: 16 },
      { key: 'duplicationCheck', label: 'Conflict Status', align: 'center', width: 16 },
      { key: 'effectiveFrom', label: 'Effective Date', align: 'center', width: 14 }
    ],
    summaryKeys: ['enrolledEmployees', 'totalFuelAllowance', 'totalMobileAllowance'],
    reconciliationRule: 'Pick-and-drop passengers are strictly excluded from fuel allowance (zero double-benefit)'
  },
  {
    id: 'RPT-BEN-005',
    familyId: 'fam_ben',
    number: 46,
    name: 'Employee Loan Ledger',
    description: 'Principal disbursements, approved installment recoveries, early settlements, and remaining balances.',
    allowedRoles: ['super_admin', 'hr_admin', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'loanId', label: 'Loan Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'disbursementDate', label: 'Disbursed Date', align: 'center', width: 14 },
      { key: 'principalAmount', label: 'Original Principal', align: 'right', type: 'currency', width: 16 },
      { key: 'monthlyInstallment', label: 'Monthly Inst.', align: 'right', type: 'currency', width: 15 },
      { key: 'totalRecovered', label: 'Total Recovered', align: 'right', type: 'currency', width: 16 },
      { key: 'outstandingBalance', label: 'Balance Outstanding', align: 'right', type: 'currency', width: 18 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalPrincipalDisbursed', 'totalRecovered', 'totalOutstandingBalance'],
    reconciliationRule: 'Outstanding Balance = Original Principal - Total Recovered (Loan disbursement is a receivable, not salary expense)'
  },
  {
    id: 'RPT-BEN-006',
    familyId: 'fam_ben',
    number: 47,
    name: 'Salary Advance Register',
    description: 'Short-term salary advances granted, scheduled monthly payroll recoveries, and remaining advance balances.',
    allowedRoles: ['super_admin', 'hr_admin', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'advanceId', label: 'Advance Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'grantDate', label: 'Grant Date', align: 'center', width: 14 },
      { key: 'advanceAmount', label: 'Advance Granted', align: 'right', type: 'currency', width: 16 },
      { key: 'recoveredAmount', label: 'Recovered', align: 'right', type: 'currency', width: 15 },
      { key: 'unrecoveredBalance', label: 'Outstanding Balance', align: 'right', type: 'currency', width: 18 },
      { key: 'targetRecoveryRun', label: 'Target Pay Run', align: 'center', width: 14 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalAdvancesGranted', 'totalAdvancesRecovered', 'totalAdvancesOutstanding'],
    reconciliationRule: 'Outstanding Balance = Advance Granted - Recovered Amount (Salary advances are separate from regular salary)'
  },
  {
    id: 'RPT-BEN-007',
    familyId: 'fam_ben',
    number: 48,
    name: 'Loan Installment Schedule vs Payroll Recovery',
    description: 'Period-wise expected loan installment due vs actual deduction recovered in posted payroll runs.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'loanRef', label: 'Loan Ref', align: 'left', width: 14 },
      { key: 'payPeriod', label: 'Pay Period', align: 'center', width: 14 },
      { key: 'installmentDue', label: 'Installment Due', align: 'right', type: 'currency', width: 16 },
      { key: 'payrollRecovered', label: 'Actually Deducted', align: 'right', type: 'currency', width: 16 },
      { key: 'variance', label: 'Variance', align: 'right', type: 'currency', width: 14 },
      { key: 'reconciliationStatus', label: 'Status', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalDue', 'totalRecovered', 'netVariance'],
    reconciliationRule: 'Variance = Installment Due - Actually Deducted (Reconciles with F06 loan deduction component)'
  },

  // ==========================================
  // FAMILY 08: TASKS, KPI, PERFORMANCE & TRAINING (8)
  // ==========================================
  {
    id: 'RPT-PER-001',
    familyId: 'fam_per',
    number: 49,
    name: 'Task Assignment & Completion',
    description: 'Work order and task tracking: assigned employee, project, due date, completion date, and reviewer acceptance.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'taskId', label: 'Task Ref', align: 'left', width: 14 },
      { key: 'title', label: 'Task Title', align: 'left', width: 24 },
      { key: 'project', label: 'Project', align: 'left', width: 18 },
      { key: 'assignee', label: 'Assigned To', align: 'left', width: 20 },
      { key: 'dueDate', label: 'Due Date', align: 'center', width: 14 },
      { key: 'completionDate', label: 'Completed Date', align: 'center', width: 14 },
      { key: 'progress', label: 'Progress', align: 'right', width: 12 },
      { key: 'reviewer', label: 'Reviewer', align: 'left', width: 20 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalTasks', 'completedCount', 'inProgressCount', 'overdueCount'],
    reconciliationRule: 'Total Tasks = Completed + In Progress + Overdue + Pending Review'
  },
  {
    id: 'RPT-PER-002',
    familyId: 'fam_per',
    number: 50,
    name: 'Department Goals: Target vs Achieved',
    description: 'Strategic departmental objectives, quantitative targets, actual deliverables, and percentage variance.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'goalId', label: 'Goal Ref', align: 'left', width: 14 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'objective', label: 'Strategic Objective', align: 'left', width: 26 },
      { key: 'targetMetric', label: 'Target Target', align: 'right', width: 14 },
      { key: 'achievedMetric', label: 'Achieved Actual', align: 'right', width: 14 },
      { key: 'achievementRate', label: 'Achievement %', align: 'right', width: 14 },
      { key: 'owner', label: 'Department Lead', align: 'left', width: 20 },
      { key: 'evaluation', label: 'Rating', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalGoals', 'achievedGoals', 'inProgressGoals'],
    reconciliationRule: 'Achievement % = (Achieved Metric / Target Metric) * 100'
  },
  {
    id: 'RPT-PER-003',
    familyId: 'fam_per',
    number: 51,
    name: 'Sales Performance & Collection KPIs',
    description: 'Sales productivity: prospect calls, meetings, client proposals, conversions, collections, and achievement.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Sales Executive', align: 'left', width: 22 },
      { key: 'leadsAssigned', label: 'Leads', align: 'right', type: 'number', width: 12 },
      { key: 'meetingsDone', label: 'Meetings', align: 'right', type: 'number', width: 12 },
      { key: 'dealsClosed', label: 'Deals Closed', align: 'right', type: 'number', width: 14 },
      { key: 'salesVolume', label: 'Booked Sales', align: 'right', type: 'currency', width: 16 },
      { key: 'cashCollected', label: 'Cash Collections', align: 'right', type: 'currency', width: 16 },
      { key: 'kpiScore', label: 'Score / 100', align: 'right', type: 'number', width: 14 }
    ],
    summaryKeys: ['totalBookedSales', 'totalCashCollected', 'avgKpiScore'],
    reconciliationRule: 'KPI achievement is weighted against verified cash collections'
  },
  {
    id: 'RPT-PER-004',
    familyId: 'fam_per',
    number: 52,
    name: 'Development Delivery & QA Performance',
    description: 'Engineering sprint deliveries, milestone deadlines, code reviews, defect counts, and rework rates.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Engineer Name', align: 'left', width: 22 },
      { key: 'team', label: 'Team', align: 'left', width: 18 },
      { key: 'deliverables', label: 'Milestones', align: 'right', type: 'number', width: 12 },
      { key: 'onTimeDelivery', label: 'On-Time %', align: 'right', width: 14 },
      { key: 'qaDefects', label: 'QA Defects', align: 'right', type: 'number', width: 12 },
      { key: 'reworkRate', label: 'Rework %', align: 'right', width: 12 },
      { key: 'leadReview', label: 'Lead Rating', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalMilestones', 'avgOnTimeRate', 'totalQaDefects'],
    reconciliationRule: 'Rework % = (Defective Milestones / Total Milestones) * 100'
  },
  {
    id: 'RPT-PER-005',
    familyId: 'fam_per',
    number: 53,
    name: 'Media Delivery & Creative Quality',
    description: 'Media production metrics: creative deliverables, turnaround speed, revision cycles, and quality scorecards.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Creator Name', align: 'left', width: 22 },
      { key: 'assetsProduced', label: 'Assets', align: 'right', type: 'number', width: 12 },
      { key: 'avgTurnaroundDays', label: 'Turnaround (Days)', align: 'right', type: 'number', width: 16 },
      { key: 'revisionRounds', label: 'Avg Revisions', align: 'right', type: 'number', width: 14 },
      { key: 'clientApprovalRate', label: 'Client Approval %', align: 'right', width: 16 },
      { key: 'qualityScore', label: 'Score / 5.0', align: 'right', type: 'number', width: 14 }
    ],
    summaryKeys: ['totalAssets', 'avgTurnaround', 'avgQualityScore'],
    reconciliationRule: 'Quality evaluation based on revision rounds and client approval rate'
  },
  {
    id: 'RPT-PER-006',
    familyId: 'fam_per',
    number: 54,
    name: 'Employee Appraisal / Rating History',
    description: 'Periodic appraisals: self-rating, manager evaluation, HR moderation, salary increment recommendation, and final rating.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'appraisalId', label: 'Appraisal Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 20 },
      { key: 'reviewPeriod', label: 'Period', align: 'center', width: 14 },
      { key: 'selfRating', label: 'Self / 5', align: 'right', type: 'number', width: 12 },
      { key: 'managerRating', label: 'Mgr / 5', align: 'right', type: 'number', width: 12 },
      { key: 'finalRating', label: 'Final / 5', align: 'right', type: 'number', width: 12 },
      { key: 'incrementRec', label: 'Increment Rec %', align: 'right', width: 14 },
      { key: 'status', label: 'Approval Status', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalAppraisals', 'avgFinalRating', 'recommendedIncrementCount'],
    reconciliationRule: 'Increment recommendations bridge into F06 salary revision proposals'
  },
  {
    id: 'RPT-PER-007',
    familyId: 'fam_per',
    number: 55,
    name: 'Training Enrollment & Completion',
    description: 'Professional courses, employee enrollments, session attendance, assessment scores, and certification status.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'enrollmentId', label: 'Enrollment Ref', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'courseTitle', label: 'Course Title', align: 'left', width: 24 },
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'enrolledDate', label: 'Enrolled Date', align: 'center', width: 14 },
      { key: 'attendanceRate', label: 'Attendance %', align: 'right', width: 14 },
      { key: 'assessmentScore', label: 'Score %', align: 'right', width: 12 },
      { key: 'certification', label: 'Certified', align: 'center', width: 14 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalEnrollments', 'completedCount', 'certifiedCount', 'failedCount'],
    reconciliationRule: 'Certification requires Assessment Score >= 70% and Attendance Rate >= 80%'
  },
  {
    id: 'RPT-PER-008',
    familyId: 'fam_per',
    number: 56,
    name: 'Training Effectiveness / Skills Register',
    description: 'Post-training skill gap assessments, pre vs post evaluation progress, and managerial skill validation.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'skillArea', label: 'Competency / Skill', align: 'left', width: 22 },
      { key: 'preScore', label: 'Pre-Training', align: 'right', type: 'number', width: 14 },
      { key: 'postScore', label: 'Post-Training', align: 'right', type: 'number', width: 14 },
      { key: 'skillGrowth', label: 'Growth %', align: 'right', width: 14 },
      { key: 'validatedBy', label: 'Evaluated By', align: 'left', width: 20 },
      { key: 'status', label: 'Proficiency Level', align: 'center', width: 16 }
    ],
    summaryKeys: ['evaluatedEmployees', 'avgGrowthPercent', 'skillsUpgradedCount'],
    reconciliationRule: 'Skill Growth % = ((Post Score - Pre Score) / Pre Score) * 100'
  },

  // ==========================================
  // FAMILY 09: POLICY GOVERNANCE & APPROVAL LIMITS (5)
  // ==========================================
  {
    id: 'RPT-POL-001',
    familyId: 'fam_pol',
    number: 57,
    name: 'Active Company Policy & Coverage Register',
    description: 'Catalog of active company policies, version numbers, effective dates, applicable scope, and target headcount.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'all',
    columns: [
      { key: 'policyId', label: 'Policy Ref', align: 'left', width: 14 },
      { key: 'policyName', label: 'Policy Title', align: 'left', width: 24 },
      { key: 'category', label: 'Category', align: 'center', width: 16 },
      { key: 'version', label: 'Version', align: 'center', width: 10 },
      { key: 'effectiveFrom', label: 'Effective From', align: 'center', width: 14 },
      { key: 'effectiveTo', label: 'Effective To', align: 'center', width: 14 },
      { key: 'scope', label: 'Applicable Scope', align: 'center', width: 18 },
      { key: 'coveredStaff', label: 'Covered Staff', align: 'right', type: 'number', width: 14 },
      { key: 'approvedBy', label: 'Owner / Publisher', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalActivePolicies', 'totalCoveredStaff', 'avgVersion'],
    reconciliationRule: 'Policy versions are strictly effective-dated; old transactions retain historical policy rules'
  },
  {
    id: 'RPT-POL-002',
    familyId: 'fam_pol',
    number: 58,
    name: 'Policy Change / Override Audit',
    description: 'Audit history of policy modifications: old vs new parameters, justification, and Super Admin authorization.',
    allowedRoles: ['super_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'changeId', label: 'Change Ref', align: 'left', width: 14 },
      { key: 'policyName', label: 'Policy Name', align: 'left', width: 22 },
      { key: 'oldRule', label: 'Old Parameter', align: 'left', width: 20 },
      { key: 'newRule', label: 'New Parameter', align: 'left', width: 20 },
      { key: 'changeDate', label: 'Change Date', align: 'center', width: 14 },
      { key: 'reason', label: 'Business Justification', align: 'left', width: 26 },
      { key: 'actor', label: 'Authorized By', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalPolicyChanges', 'authorizedOverrides'],
    reconciliationRule: 'All policy changes strictly increment version number and preserve audit metadata'
  },
  {
    id: 'RPT-POL-003',
    familyId: 'fam_pol',
    number: 59,
    name: 'Leave / Late Threshold Usage by Reviewer',
    description: 'Reviewer approval compliance: monthly leave day approvals, late exception grants, and split-request checks.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'reviewerId', label: 'Reviewer ID', align: 'left', width: 14 },
      { key: 'reviewerName', label: 'Approver Name', align: 'left', width: 22 },
      { key: 'leaveDaysApproved', label: 'Leaves Approved', align: 'right', type: 'number', width: 16 },
      { key: 'monthlyLeaveCap', label: 'Policy Cap', align: 'right', type: 'number', width: 14 },
      { key: 'lateExceptionsGranted', label: 'Lates Excused', align: 'right', type: 'number', width: 14 },
      { key: 'complianceStatus', label: 'Threshold Status', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalApprovers', 'totalLeavesApproved', 'totalLatesExcused'],
    reconciliationRule: 'Approver authority is independent of employee leave balance'
  },
  {
    id: 'RPT-POL-004',
    familyId: 'fam_pol',
    number: 60,
    name: 'Exception & Delegation Register',
    description: 'Temporary delegation of approval powers, out-of-office coverage, authority ceilings, and validity dates.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'all',
    columns: [
      { key: 'delegationId', label: 'Delegation Ref', align: 'left', width: 14 },
      { key: 'delegator', label: 'Original Authority', align: 'left', width: 20 },
      { key: 'delegatee', label: 'Acting Delegate', align: 'left', width: 20 },
      { key: 'scope', label: 'Delegated Module', align: 'center', width: 16 },
      { key: 'approvalCap', label: 'Delegated Cap', align: 'right', type: 'currency', width: 15 },
      { key: 'startDate', label: 'Start Date', align: 'center', width: 14 },
      { key: 'endDate', label: 'End Date', align: 'center', width: 14 },
      { key: 'status', label: 'Active Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalDelegations', 'activeDelegations', 'expiredDelegations'],
    reconciliationRule: 'Total Delegations = Active Delegations + Expired Delegations'
  },
  {
    id: 'RPT-POL-005',
    familyId: 'fam_pol',
    number: 61,
    name: 'Overtime / Salary Revision Approval Audit',
    description: 'Multi-tier approval trace for financial exceptions: overtime caps exceeded, salary revisions, and Super Admin decisions.',
    allowedRoles: ['super_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'auditRef', label: 'Audit Ref', align: 'left', width: 14 },
      { key: 'itemType', label: 'Financial Action', align: 'center', width: 18 },
      { key: 'employeeName', label: 'Subject Employee', align: 'left', width: 22 },
      { key: 'proposedValue', label: 'Proposed Amount', align: 'right', type: 'currency', width: 16 },
      { key: 'proposer', label: 'Proposer', align: 'left', width: 18 },
      { key: 'approvalTier', label: 'Approval Tier', align: 'center', width: 16 },
      { key: 'decision', label: 'Final Decision', align: 'center', width: 16 },
      { key: 'decisionDate', label: 'Decision Date', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalAudits', 'approvedCount', 'rejectedCount'],
    reconciliationRule: 'All salary changes and high overtime require documented Super Admin signoff'
  },

  // ==========================================
  // FAMILY 10: HELP DESK MANAGEMENT (3)
  // ==========================================
  {
    id: 'RPT-HLP-001',
    familyId: 'fam_hlp',
    number: 62,
    name: 'Help Desk Ticket Register',
    description: 'Comprehensive incident and service request log: employee, department, severity, assigned resolver, and status.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'ticketId', label: 'Ticket Ref', align: 'left', width: 14 },
      { key: 'title', label: 'Subject', align: 'left', width: 26 },
      { key: 'employeeName', label: 'Requester', align: 'left', width: 20 },
      { key: 'category', label: 'Category', align: 'center', width: 14 },
      { key: 'priority', label: 'Priority', align: 'center', width: 12 },
      { key: 'assignedTo', label: 'Assigned Resolver', align: 'left', width: 20 },
      { key: 'createdDate', label: 'Created Date', align: 'center', width: 14 },
      { key: 'closedDate', label: 'Closed Date', align: 'center', width: 14 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalTickets', 'openTickets', 'resolvedTickets', 'closedTickets'],
    reconciliationRule: 'Total Tickets = Open + In Progress + Resolved + Closed'
  },
  {
    id: 'RPT-HLP-002',
    familyId: 'fam_hlp',
    number: 63,
    name: 'First Response / Resolution SLA Aging',
    description: 'Help Desk SLA performance: first response time, resolution target hours, elapsed business time, and breach tracking.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'ticketId', label: 'Ticket Ref', align: 'left', width: 14 },
      { key: 'category', label: 'Category', align: 'center', width: 14 },
      { key: 'priority', label: 'Priority', align: 'center', width: 12 },
      { key: 'firstResponseHours', label: 'Response (Hrs)', align: 'right', type: 'number', width: 15 },
      { key: 'resolutionHours', label: 'Resolution (Hrs)', align: 'right', type: 'number', width: 16 },
      { key: 'slaTargetHours', label: 'SLA Target', align: 'right', type: 'number', width: 14 },
      { key: 'breachStatus', label: 'SLA Status', align: 'center', width: 16 },
      { key: 'resolver', label: 'Resolver', align: 'left', width: 20 }
    ],
    summaryKeys: ['totalTicketsEvaluated', 'metSlaCount', 'breachedSlaCount'],
    reconciliationRule: 'Breached tickets strictly determined against active category SLA policy definition'
  },
  {
    id: 'RPT-HLP-003',
    familyId: 'fam_hlp',
    number: 64,
    name: 'Help Desk Workload & Feedback',
    description: 'Resolver ticket throughput: assigned, resolved, reopened counts, and employee satisfaction ratings.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'resolverName', label: 'Support Specialist', align: 'left', width: 22 },
      { key: 'assignedCount', label: 'Assigned', align: 'right', type: 'number', width: 12 },
      { key: 'resolvedCount', label: 'Resolved', align: 'right', type: 'number', width: 12 },
      { key: 'reopenedCount', label: 'Reopened', align: 'right', type: 'number', width: 12 },
      { key: 'avgResolutionTime', label: 'Avg Time (Hrs)', align: 'right', type: 'number', width: 16 },
      { key: 'avgCsat', label: 'CSAT / 5.0', align: 'right', type: 'number', width: 14 },
      { key: 'satisfactionRate', label: 'Satisfaction %', align: 'right', width: 16 }
    ],
    summaryKeys: ['totalResolvers', 'totalResolvedTickets', 'avgCsatScore'],
    reconciliationRule: 'Resolution Rate % = (Resolved / Assigned) * 100'
  },

  // ==========================================
  // FAMILY 11: TRAVEL, PICK-AND-DROP & EXPENSES (7)
  // ==========================================
  {
    id: 'RPT-TRV-001',
    familyId: 'fam_trv',
    number: 65,
    name: 'Travel Authorization Register',
    description: 'Official trip requests, destination, purpose, estimated vs approved budget, and managerial approvals.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'travelId', label: 'Trip Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Traveler Name', align: 'left', width: 20 },
      { key: 'destination', label: 'Destination', align: 'left', width: 18 },
      { key: 'purpose', label: 'Purpose', align: 'left', width: 22 },
      { key: 'startDate', label: 'Departure', align: 'center', width: 14 },
      { key: 'endDate', label: 'Return', align: 'center', width: 14 },
      { key: 'approvedBudget', label: 'Approved Budget', align: 'right', type: 'currency', width: 16 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalTrips', 'totalApprovedBudget', 'completedTrips'],
    reconciliationRule: 'Budget approval authorizes travel spending cap; it is not immediate expense recognition'
  },
  {
    id: 'RPT-TRV-002',
    familyId: 'fam_trv',
    number: 66,
    name: 'Travel Advance & Trip Settlement',
    description: 'Accounting rollforward of travel advances: Advance Issued - Verified Incurred Expenses - Refund = Balance.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'travelId', label: 'Trip Ref', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Traveler Name', align: 'left', width: 20 },
      { key: 'advanceIssued', label: 'Advance Paid', align: 'right', type: 'currency', width: 15 },
      { key: 'incurredExpenses', label: 'Applied Expenses', align: 'right', type: 'currency', width: 16 },
      { key: 'refundedAmount', label: 'Advance Returned', align: 'right', type: 'currency', width: 16 },
      { key: 'outstandingBalance', label: 'Outstanding Balance', align: 'right', type: 'currency', width: 18 },
      { key: 'settlementStatus', label: 'Settlement Status', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalAdvanceIssued', 'totalIncurredExpenses', 'totalOutstandingAdvances'],
    reconciliationRule: 'Travel Advance Outstanding = Advance Paid - Applied Expenses - Advance Returns +/- Adjustments'
  },
  {
    id: 'RPT-TRV-003',
    familyId: 'fam_trv',
    number: 67,
    name: 'Pick & Drop Route/Seat Roster',
    description: 'Corporate transport routes, vehicle allocation, driver details, seat capacity, and assigned employee passengers.',
    allowedRoles: ['super_admin', 'hr_admin', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'all',
    columns: [
      { key: 'routeId', label: 'Route Ref', align: 'left', width: 14 },
      { key: 'routeName', label: 'Route Name', align: 'left', width: 22 },
      { key: 'vehicleNumber', label: 'Vehicle No', align: 'center', width: 14 },
      { key: 'driverName', label: 'Driver', align: 'left', width: 18 },
      { key: 'seatCapacity', label: 'Capacity', align: 'right', type: 'number', width: 12 },
      { key: 'assignedStaff', label: 'Assigned Staff', align: 'right', type: 'number', width: 14 },
      { key: 'availableSeats', label: 'Seats Vacant', align: 'right', type: 'number', width: 14 },
      { key: 'status', label: 'Operational Status', align: 'center', width: 16 }
    ],
    summaryKeys: ['totalRoutes', 'totalFleetCapacity', 'totalAssignedPassengers', 'totalVacantSeats'],
    reconciliationRule: 'Seats Vacant = Seat Capacity - Assigned Staff (Strict capacity limits enforced)'
  },
  {
    id: 'RPT-TRV-004',
    familyId: 'fam_trv',
    number: 68,
    name: 'Transport Cost & Employee Contributions',
    description: 'Van route lease costs, company subsidy share, and authorized monthly payroll deductions from passengers.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'routeId', label: 'Route Ref', align: 'left', width: 14 },
      { key: 'routeName', label: 'Route Name', align: 'left', width: 22 },
      { key: 'providerCost', label: 'Monthly Lease Cost', align: 'right', type: 'currency', width: 18 },
      { key: 'companySubsidy', label: 'Company Subsidy', align: 'right', type: 'currency', width: 16 },
      { key: 'employeeShareTotal', label: 'Staff Contribution', align: 'right', type: 'currency', width: 18 },
      { key: 'passengerCount', label: 'Passengers', align: 'right', type: 'number', width: 12 },
      { key: 'payrollRecoveryRef', label: 'Payroll Component', align: 'center', width: 18 }
    ],
    summaryKeys: ['totalTransportCost', 'totalCompanySubsidy', 'totalEmployeeRecoveries'],
    reconciliationRule: 'Monthly Lease Cost = Company Subsidy + Staff Contributions (Reconciled with F06 payroll deductions)'
  },
  {
    id: 'RPT-TRV-005',
    familyId: 'fam_trv',
    number: 69,
    name: 'Expense Claim Detail',
    description: 'Itemized expense claims: category, receipt attachment reference, claimed amount, approved amount, and rejected portion.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'claimId', label: 'Claim Ref', align: 'left', width: 14 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 20 },
      { key: 'category', label: 'Category', align: 'center', width: 14 },
      { key: 'receiptRef', label: 'Receipt Ref', align: 'center', width: 16 },
      { key: 'claimedAmount', label: 'Claimed (PKR)', align: 'right', type: 'currency', width: 15 },
      { key: 'approvedAmount', label: 'Approved (PKR)', align: 'right', type: 'currency', width: 15 },
      { key: 'rejectedAmount', label: 'Rejected (PKR)', align: 'right', type: 'currency', width: 15 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalClaimed', 'totalApproved', 'totalRejected'],
    reconciliationRule: 'Claimed Amount = Approved Amount + Rejected Amount'
  },
  {
    id: 'RPT-TRV-006',
    familyId: 'fam_trv',
    number: 70,
    name: 'Expense Reimbursement Register',
    description: 'Accounting ledger of approved expense claims vs verified disbursements and remaining expense payables.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'claimId', label: 'Claim Ref', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Payee Name', align: 'left', width: 20 },
      { key: 'approvedAmount', label: 'Approved Claim', align: 'right', type: 'currency', width: 16 },
      { key: 'reimbursedAmount', label: 'Disbursed Paid', align: 'right', type: 'currency', width: 16 },
      { key: 'unpaidPayable', label: 'Expense Payable', align: 'right', type: 'currency', width: 16 },
      { key: 'paymentDate', label: 'Payment Date', align: 'center', width: 14 },
      { key: 'paymentReference', label: 'Voucher Ref', align: 'center', width: 16 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalApprovedPayable', 'totalDisbursed', 'totalOutstandingPayable'],
    reconciliationRule: 'Expense Payable = Approved Eligible Claims - Confirmed Reimbursements +/- Adjustments'
  },
  {
    id: 'RPT-TRV-007',
    familyId: 'fam_trv',
    number: 71,
    name: 'Department/Project Expense Summary',
    description: 'Cost center expenditure report grouped by departmental budget, client project, and expense category.',
    allowedRoles: ['super_admin', 'hr_admin', 'manager', 'team_lead'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'department', label: 'Department', align: 'left', width: 18 },
      { key: 'costCenter', label: 'Cost Center', align: 'center', width: 16 },
      { key: 'project', label: 'Linked Project', align: 'left', width: 20 },
      { key: 'category', label: 'Category', align: 'center', width: 16 },
      { key: 'claimsCount', label: 'Claims', align: 'right', type: 'number', width: 10 },
      { key: 'totalApproved', label: 'Approved Expense', align: 'right', type: 'currency', width: 16 },
      { key: 'totalReimbursed', label: 'Paid Reimbursed', align: 'right', type: 'currency', width: 16 },
      { key: 'pendingPayable', label: 'Pending Payable', align: 'right', type: 'currency', width: 16 }
    ],
    summaryKeys: ['grandApprovedTotal', 'grandReimbursedTotal', 'grandPendingPayable'],
    reconciliationRule: 'Total Approved Expense = Sum of Approved Claims grouped by Department and Project'
  },

  // ==========================================
  // FAMILY 12: HR LETTERS, ALERTS & SECURITY (4)
  // ==========================================
  {
    id: 'RPT-SEC-001',
    familyId: 'fam_sec',
    number: 72,
    name: 'HR Letter Issue / Revision Register',
    description: 'Audit log of formal HR letters issued: Appointment, Increment, Confirmation, Experience, and Signatories.',
    allowedRoles: ['super_admin', 'hr_admin', 'employee'],
    orientation: 'landscape',
    defaultDatePreset: 'thisYear',
    columns: [
      { key: 'letterId', label: 'Letter Ref', align: 'left', width: 16 },
      { key: 'employeeId', label: 'Employee ID', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Employee Name', align: 'left', width: 22 },
      { key: 'templateType', label: 'Letter Template', align: 'left', width: 22 },
      { key: 'templateVersion', label: 'Version', align: 'center', width: 10 },
      { key: 'issueDate', label: 'Issue Date', align: 'center', width: 14 },
      { key: 'signatory', label: 'Authorized Signer', align: 'left', width: 20 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalIssued', 'offerLettersCount', 'incrementLettersCount', 'experienceLettersCount'],
    reconciliationRule: 'Total Letters = Sum of Valid Generated Official Letters'
  },
  {
    id: 'RPT-SEC-002',
    familyId: 'fam_sec',
    number: 73,
    name: 'HR Letter Request Aging',
    description: 'Employee letter requests, assigned HR reviewer, elapsed turnaround time, and issuance status.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'requestId', label: 'Request Ref', align: 'left', width: 14 },
      { key: 'employeeName', label: 'Applicant Name', align: 'left', width: 22 },
      { key: 'letterType', label: 'Requested Letter', align: 'left', width: 22 },
      { key: 'requestDate', label: 'Request Date', align: 'center', width: 14 },
      { key: 'assignedReviewer', label: 'HR Handler', align: 'left', width: 20 },
      { key: 'turnaroundDays', label: 'Aging (Days)', align: 'right', type: 'number', width: 14 },
      { key: 'status', label: 'Status', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalRequests', 'issuedCount', 'pendingCount', 'rejectedCount'],
    reconciliationRule: 'Total Requests = Issued + Pending Review + Rejected'
  },
  {
    id: 'RPT-SEC-003',
    familyId: 'fam_sec',
    number: 74,
    name: 'Scheduled Alert Execution & Delivery Audit',
    description: 'Automated background scheduled alerts: trigger event, rule version, scheduled due date, recipient, and execution state.',
    allowedRoles: ['super_admin', 'hr_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'alertId', label: 'Alert Log Ref', align: 'left', width: 14 },
      { key: 'ruleName', label: 'Alert Rule', align: 'left', width: 24 },
      { key: 'triggerEvent', label: 'Trigger Event', align: 'center', width: 18 },
      { key: 'scheduledTime', label: 'Evaluated Time', align: 'center', width: 16 },
      { key: 'recipient', label: 'Target Recipient', align: 'left', width: 22 },
      { key: 'channel', label: 'Channel', align: 'center', width: 14 },
      { key: 'deliveryState', label: 'Delivery State', align: 'center', width: 16 },
      { key: 'retryCount', label: 'Retries', align: 'right', type: 'number', width: 10 }
    ],
    summaryKeys: ['totalAlertsEvaluated', 'deliveredCount', 'queuedCount', 'failedCount'],
    reconciliationRule: 'Total Evaluated = Delivered + Queued + Failed (Delivery logged only when actual delivery event occurs)'
  },
  {
    id: 'RPT-SEC-004',
    familyId: 'fam_sec',
    number: 75,
    name: 'Security / Approval / Sensitive Export Audit',
    description: 'Chartered compliance audit log: actor, action, protected module, applied filters, and timestamp.',
    allowedRoles: ['super_admin'],
    orientation: 'landscape',
    defaultDatePreset: 'thisMonth',
    columns: [
      { key: 'auditId', label: 'Log Ref', align: 'left', width: 14 },
      { key: 'timestamp', label: 'Timestamp', align: 'center', width: 18 },
      { key: 'actor', label: 'Actor / User', align: 'left', width: 22 },
      { key: 'action', label: 'Action Type', align: 'center', width: 18 },
      { key: 'module', label: 'Module / Resource', align: 'left', width: 20 },
      { key: 'details', label: 'Audit Particulars', align: 'left', width: 30 },
      { key: 'severity', label: 'Sensitivity', align: 'center', width: 14 }
    ],
    summaryKeys: ['totalAuditEvents', 'securityChanges', 'reportExports', 'criticalActions'],
    reconciliationRule: 'Every report export and protected policy mutation creates an immutable audit record'
  }
]
