/**
 * iSysware HRMS — Batch F04: Canonical Attendance & Shifts Mock Dataset
 * Authoritative source of truth for:
 * - Shift Master (Fixed, Flexible, Part-Time, Hourly, Overnight, Rotating)
 * - Shift Assignments & Effective Date Roster
 * - Centralized Attendance Policies (Super Admin owned)
 * - Public & Company Holidays (2026 Calendar)
 * - Daily Attendance Records & Multi-Punch Sessions
 * - Attendance Regularization & Missed Punch Correction Requests
 * - WFH & Field Duty Authorizations
 * - Overtime Tracking & Authorizations
 */

export const INITIAL_SHIFTS = [
  {
    id: 'QA-SHIFT-01',
    code: 'QA-STD',
    name: 'Quality Assurance Shift',
    type: 'Fixed',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    paidBreak: false,
    expectedWorkingHours: 8.0,
    gracePeriodMinutes: 15,
    flexibleArrivalWindow: null,
    coreHoursStart: null,
    coreHoursEnd: null,
    weeklyWorkingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    applicableWorkArrangements: ['Office', 'Hybrid'],
    lateCalculationRule: 'Minutes past 09:15',
    earlyExitRule: 'Minutes before 18:00',
    overtimeEligible: true,
    status: 'Active',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    description: 'Standard QA and testing schedule for QA engineers and analysts',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)'
  },
  {
    id: 'SHIFT-01',
    code: 'GEN-DAY',
    name: 'General Corporate Day Shift',
    type: 'Fixed', // 'Fixed' | 'Flexible' | 'Part-Time' | 'Hourly' | 'Overnight' | 'Rotating'
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    paidBreak: false,
    expectedWorkingHours: 8.0,
    gracePeriodMinutes: 15, // <= 09:15 is On-Time, > 09:15 is Late
    flexibleArrivalWindow: null,
    coreHoursStart: null,
    coreHoursEnd: null,
    weeklyWorkingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    applicableWorkArrangements: ['Office', 'Hybrid'],
    lateCalculationRule: 'Minutes past 09:15',
    earlyExitRule: 'Minutes before 18:00',
    overtimeEligible: true,
    status: 'Active',
    effectiveFrom: '2021-01-01',
    effectiveTo: null,
    description: 'Standard 9-to-6 business schedule for Management, HR, and Operations',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)'
  },
  {
    id: 'SHIFT-02',
    code: 'ENG-FLEX',
    name: 'Engineering Flexible Development Shift',
    type: 'Flexible',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    paidBreak: false,
    expectedWorkingHours: 8.0,
    gracePeriodMinutes: 0,
    flexibleArrivalWindow: { start: '08:00', end: '11:00' },
    coreHoursStart: '11:00',
    coreHoursEnd: '16:00',
    weeklyWorkingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    applicableWorkArrangements: ['Office', 'Hybrid', 'WFH'],
    lateCalculationRule: 'Arrival after 11:00 or less than core presence',
    earlyExitRule: 'Departure before core hours end (16:00)',
    overtimeEligible: true,
    status: 'Active',
    effectiveFrom: '2022-01-01',
    effectiveTo: null,
    description: 'Flexible arrival window between 8:00 AM and 11:00 AM with mandatory 11:00 AM - 4:00 PM core hours',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Bilal Siddiqui (Manager)'
  },
  {
    id: 'SHIFT-03',
    code: 'SALES-HYBRID',
    name: 'Commercial Sales & Client Field Shift',
    type: 'Fixed',
    startTime: '09:30',
    endTime: '18:30',
    breakMinutes: 60,
    paidBreak: false,
    expectedWorkingHours: 8.0,
    gracePeriodMinutes: 15,
    flexibleArrivalWindow: null,
    coreHoursStart: null,
    coreHoursEnd: null,
    weeklyWorkingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    applicableWorkArrangements: ['Office', 'Field Duty', 'Hybrid'],
    lateCalculationRule: 'Arrival after 09:45 unless approved Field Duty visit logged',
    earlyExitRule: 'Departure before 18:30 unless traveling on client engagement',
    overtimeEligible: true,
    status: 'Active',
    effectiveFrom: '2022-06-01',
    effectiveTo: null,
    description: 'Commercial enterprise sales schedule permitting official outside client visits without absence flags',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Ayesha Khan (HR Admin)'
  },
  {
    id: 'SHIFT-04',
    code: 'NIGHT-OPS',
    name: 'Technical Support Overnight Shift',
    type: 'Overnight',
    startTime: '21:00',
    endTime: '06:00', // Crosses midnight
    breakMinutes: 60,
    paidBreak: true, // Night break paid per policy
    expectedWorkingHours: 8.0,
    gracePeriodMinutes: 15,
    flexibleArrivalWindow: null,
    coreHoursStart: null,
    coreHoursEnd: null,
    weeklyWorkingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    applicableWorkArrangements: ['Office'],
    lateCalculationRule: 'Arrival past 21:15',
    earlyExitRule: 'Departure before 06:00 next day',
    overtimeEligible: true,
    status: 'Active',
    effectiveFrom: '2023-01-01',
    effectiveTo: null,
    description: 'Overnight technical infrastructure monitoring starting at 9:00 PM and ending 6:00 AM the following morning',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Tariq Mehmood (Super Admin)'
  },
  {
    id: 'SHIFT-05',
    code: 'MEDIA-PART',
    name: 'Media Creative Part-Time Shift',
    type: 'Part-Time',
    startTime: '10:00',
    endTime: '14:00',
    breakMinutes: 0,
    paidBreak: false,
    expectedWorkingHours: 4.0,
    gracePeriodMinutes: 10,
    flexibleArrivalWindow: null,
    coreHoursStart: null,
    coreHoursEnd: null,
    weeklyWorkingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    applicableWorkArrangements: ['Office', 'Hybrid', 'WFH'],
    lateCalculationRule: 'Arrival after 10:10',
    earlyExitRule: 'Departure before 14:00',
    overtimeEligible: false,
    status: 'Active',
    effectiveFrom: '2023-03-01',
    effectiveTo: null,
    description: '4-hour morning schedule for visual design, video editing and creative production associates',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Ayesha Khan (HR Admin)'
  },
  {
    id: 'SHIFT-06',
    code: 'HOURLY-MED',
    name: 'Contractor Hourly Project Schedule',
    type: 'Hourly',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 0,
    paidBreak: false,
    expectedWorkingHours: 0, // Computed from actual logged session minutes
    gracePeriodMinutes: 0,
    flexibleArrivalWindow: null,
    coreHoursStart: null,
    coreHoursEnd: null,
    weeklyWorkingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    applicableWorkArrangements: ['Office', 'Hybrid', 'WFH'],
    lateCalculationRule: 'No fixed lateness; actual billed hours evaluated against project milestones',
    earlyExitRule: 'None',
    overtimeEligible: false,
    status: 'Active',
    effectiveFrom: '2024-01-01',
    effectiveTo: null,
    description: 'Timesheet-based hourly arrangement for external contractors and project-based specialists',
    createdBy: 'Tariq Mehmood (Super Admin)',
    updatedBy: 'Ayesha Khan (HR Admin)'
  }
]

export const INITIAL_HOLIDAYS_2026 = [
  { id: 'HOL-01', name: 'Kashmir Solidarity Day', date: '2026-02-05', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-02', name: 'Pakistan Resolution Day', date: '2026-03-23', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-03', name: 'Eid-ul-Fitr (Day 1)', date: '2026-03-20', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-04', name: 'Eid-ul-Fitr (Day 2)', date: '2026-03-21', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-05', name: 'Eid-ul-Fitr (Day 3)', date: '2026-03-22', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-06', name: 'Labour Day', date: '2026-05-01', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-07', name: 'Eid-ul-Adha (Day 1)', date: '2026-05-27', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-08', name: 'Eid-ul-Adha (Day 2)', date: '2026-05-28', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-09', name: 'Independence Day', date: '2026-08-14', type: 'National Holiday', isPaid: true },
  { id: 'HOL-10', name: 'Eid Milad-un-Nabi', date: '2026-08-26', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-11', name: 'Iqbal Day', date: '2026-11-09', type: 'Public Holiday', isPaid: true },
  { id: 'HOL-12', name: 'Quaid-e-Azam Day / Christmas', date: '2026-12-25', type: 'National Holiday', isPaid: true }
]

export const INITIAL_ATTENDANCE_POLICIES = [
  {
    id: 'POL-ATT-01',
    name: 'Enterprise Attendance & Punctuality Policy',
    version: '1.2',
    scope: 'Company-Wide',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'Active',
    ownerRole: 'Super Administrator',
    gracePeriodMinutes: 15,
    allowedLateOccurrencesPerMonth: 4, // 4 permitted lates before excess escalation/warning flag
    earlyExitThresholdMinutes: 15,
    halfDayThresholdHours: 4.0, // < 4 hours = Absent; 4h to 6h = Half Day
    fullDayMinimumHours: 7.5,
    missingPunchTimeoutHours: 14,
    correctionSubmissionDeadlineDays: 3, // Business days to regularize missed punch
    monthlyCorrectionLimit: 3, // Per employee before HR escalation
    overtimeMinimumMinutes: 60, // Minimum extra work required for OT submission
    managerApprovalLimitDays: 2, // Manager can approve up to 2 cumulative days of exceptions per employee/month
    wfhMonthlyAllowanceDays: 4, // Max WFH days allowed per calendar month per staff
    fieldDutyApprovalLimits: {
      mode: 'no_limit', // 'no_limit' | 'duration_based' | 'manager_only'
      teamLeadMaxHours: 4.0, // Used when in duration_based mode
      managerMaxHours: 9.0, // Used when in duration_based mode
      escalateToHRThresholdHours: 9.0, // > 9.0 hours escalates to HR Admin
      description: 'Under No Duration Limit mode, any authorized supervisor (Team Lead, Department Manager, HR Admin, or Super Admin) can directly approve Field Duty requests. The first approval immediately finalizes the request.'
    },
    approvalHierarchy: {
      employee: { primaryApprover: 'Manager', escalation: 'HR Admin' },
      manager: { primaryApprover: 'HR Admin', escalation: 'Super Admin' },
      hrAdmin: { primaryApprover: 'Super Admin', escalation: null },
      superAdmin: { primaryApprover: null, escalation: null }
    },
    auditNotes: 'Baseline attendance policy approved by Managing Director Tariq Mehmood.'
  }
]

export const INITIAL_SHIFT_ASSIGNMENTS = [
  { id: 'ASGN-001', employeeId: 'EMP-001', shiftId: 'SHIFT-01', effectiveFrom: '2021-01-15', effectiveTo: null, assignedBy: 'Super Admin' },
  { id: 'ASGN-002', employeeId: 'EMP-002', shiftId: 'SHIFT-01', effectiveFrom: '2022-03-01', effectiveTo: null, assignedBy: 'Super Admin' },
  { id: 'ASGN-003', employeeId: 'EMP-003', shiftId: 'SHIFT-02', effectiveFrom: '2022-06-15', effectiveTo: null, assignedBy: 'HR Admin' },
  { id: 'ASGN-004', employeeId: 'EMP-004', shiftId: 'SHIFT-02', effectiveFrom: '2023-02-01', effectiveTo: null, assignedBy: 'Bilal Siddiqui' },
  { id: 'ASGN-005', employeeId: 'EMP-005', shiftId: 'SHIFT-02', effectiveFrom: '2023-08-10', effectiveTo: null, assignedBy: 'Bilal Siddiqui' },
  { id: 'ASGN-006', employeeId: 'EMP-006', shiftId: 'SHIFT-02', effectiveFrom: '2026-09-01', effectiveTo: null, assignedBy: 'Bilal Siddiqui' },
  { id: 'ASGN-007', employeeId: 'EMP-007', shiftId: 'SHIFT-03', effectiveFrom: '2021-06-01', effectiveTo: null, assignedBy: 'HR Admin' },
  { id: 'ASGN-008', employeeId: 'EMP-008', shiftId: 'SHIFT-03', effectiveFrom: '2023-04-15', effectiveTo: null, assignedBy: 'Kamran Raza' },
  { id: 'ASGN-009', employeeId: 'EMP-009', shiftId: 'SHIFT-03', effectiveFrom: '2026-10-01', effectiveTo: null, assignedBy: 'Kamran Raza' },
  { id: 'ASGN-010', employeeId: 'EMP-010', shiftId: 'SHIFT-05', effectiveFrom: '2022-01-10', effectiveTo: null, assignedBy: 'HR Admin' },
  { id: 'ASGN-011', employeeId: 'EMP-011', shiftId: 'SHIFT-05', effectiveFrom: '2023-11-01', effectiveTo: null, assignedBy: 'Faizan Ahmed' },
  { id: 'ASGN-012', employeeId: 'EMP-012', shiftId: 'SHIFT-06', effectiveFrom: '2024-02-15', effectiveTo: null, assignedBy: 'HR Admin' },
  { id: 'ASGN-013', employeeId: 'EMP-013', shiftId: 'SHIFT-01', effectiveFrom: '2022-05-01', effectiveTo: null, assignedBy: 'Super Admin' },
  { id: 'ASGN-014', employeeId: 'EMP-014', shiftId: 'SHIFT-01', effectiveFrom: '2023-09-15', effectiveTo: null, assignedBy: 'Farhan Sheikh' }
]

/**
 * CANONICAL DAILY ATTENDANCE RECORDS (Active Day: 2026-10-26, Monday)
 * Exact breakdown matching F01 Dashboard:
 * - Total Workforce: 14
 * - Present in Office (On-Time): 8
 * - Present in Office (Late): 1 (EMP-005 Hina Farooq)
 * - In-Office Total: 9
 * - WFH (Approved): 1 (EMP-011 Rabia Malik)
 * - Field Duty (Approved): 2 (EMP-007 Kamran Raza, EMP-008 Danish Qureshi)
 * - Absent (Unscheduled): 1 (EMP-009 Noman Bashir)
 * - On Leave (Approved Annual Leave): 1 (EMP-010 Faizan Ahmed)
 * - Total Working Today = 9 + 1 + 2 = 12
 * - Scheduled Workforce = 14 - 1 = 13
 * - Attendance Rate = (12 / 13) * 100 = 92.3%
 */
export const INITIAL_ATTENDANCE_RECORDS = [
  {
    id: 'ATT-20261026-001',
    employeeId: 'EMP-001',
    employeeName: 'Tariq Mehmood',
    departmentId: 'DEP-06',
    departmentName: 'Executive Management',
    date: '2026-10-26',
    shiftId: 'SHIFT-01',
    shiftName: 'General Corporate Day Shift',
    checkInTime: '08:52',
    checkOutTime: '18:05',
    totalBreakMinutes: 60,
    workedHours: 8.2,
    expectedHours: 8.0,
    hoursVariance: 0.2,
    status: 'Present',
    primaryClassification: 'Present',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Office',
    source: 'Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 08:52:14', source: 'Web Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:05:32', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'System Auto-Audit',
    correctionStatus: 'None',
    notes: 'On-time standard executive attendance'
  },
  {
    id: 'ATT-20261026-002',
    employeeId: 'EMP-002',
    employeeName: 'Ayesha Khan',
    departmentId: 'DEP-04',
    departmentName: 'Human Resources',
    date: '2026-10-26',
    shiftId: 'SHIFT-01',
    shiftName: 'General Corporate Day Shift',
    checkInTime: '08:56',
    checkOutTime: '18:02',
    totalBreakMinutes: 60,
    workedHours: 8.1,
    expectedHours: 8.0,
    hoursVariance: 0.1,
    status: 'Present',
    primaryClassification: 'Present',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Office',
    source: 'Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 08:56:45', source: 'Web Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:02:11', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'System Auto-Audit',
    correctionStatus: 'None',
    notes: 'On-time HR leadership attendance'
  },
  {
    id: 'ATT-20261026-003',
    employeeId: 'EMP-003',
    employeeName: 'Bilal Siddiqui',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    date: '2026-10-26',
    shiftId: 'SHIFT-02',
    shiftName: 'Engineering Flexible Development Shift',
    checkInTime: '09:10',
    checkOutTime: '18:15',
    totalBreakMinutes: 60,
    workedHours: 8.1,
    expectedHours: 8.0,
    hoursVariance: 0.1,
    status: 'Present',
    primaryClassification: 'Present',
    isLate: false, // In flex arrival window (08:00 - 11:00)
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Office',
    source: 'Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 09:10:22', source: 'Web Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:15:40', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'System Auto-Audit',
    correctionStatus: 'None',
    notes: 'Engineering management attendance inside flexible arrival window'
  },
  {
    id: 'ATT-20261026-004',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    date: '2026-10-26',
    shiftId: 'SHIFT-02',
    shiftName: 'Engineering Flexible Development Shift',
    checkInTime: '09:12',
    checkOutTime: '18:20',
    totalBreakMinutes: 60,
    workedHours: 8.1,
    expectedHours: 8.0,
    hoursVariance: 0.1,
    status: 'Present',
    primaryClassification: 'Present',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Hybrid',
    source: 'Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 09:12:05', source: 'Web Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:20:18', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'System Auto-Audit',
    correctionStatus: 'None',
    notes: 'Hybrid developer in-office session'
  },
  {
    id: 'ATT-20261026-005',
    employeeId: 'EMP-005',
    employeeName: 'Hina Farooq',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    date: '2026-10-26',
    shiftId: 'SHIFT-01', // Assigned fixed shift on this date
    shiftName: 'General Corporate Day Shift',
    checkInTime: '09:28',
    checkOutTime: '18:00',
    totalBreakMinutes: 60,
    workedHours: 7.5,
    expectedHours: 8.0,
    hoursVariance: -0.5,
    status: 'Late',
    primaryClassification: 'Late', // Marked late (09:28 > 09:15)
    isLate: true,
    lateMinutes: 13, // 13 minutes beyond grace period of 15m
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Office',
    source: 'Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 09:28:44', source: 'Web Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:00:12', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'System Auto-Audit',
    correctionStatus: 'None',
    notes: 'Arrived at 09:28 (13 mins past 15-minute grace threshold)'
  },
  {
    id: 'ATT-20261118-005',
    employeeId: 'EMP-005',
    employeeName: 'Ahmed Khan',
    departmentId: 'DEP-01',
    departmentName: 'Software Development',
    date: '2026-11-18',
    shiftId: 'SHIFT-01',
    shiftName: 'General Corporate Day Shift',
    checkInTime: '16:23',
    checkOutTime: '16:23',
    totalBreakMinutes: 0,
    workedHours: 0.0,
    expectedHours: 8.0,
    hoursVariance: -8.0,
    status: 'Half Day',
    primaryClassification: 'Half Day',
    isLate: true,
    lateMinutes: 443,
    isEarlyExit: true,
    earlyExitMinutes: 97,
    isHalfDay: true,
    workArrangement: 'Field Duty',
    source: 'Web Check-In',
    punches: [
      { id: 'PCH-20261118-01', type: 'IN', timestamp: '2026-11-18 16:23:11', source: 'Web Portal', verified: true },
      { id: 'PCH-20261118-02', type: 'OUT', timestamp: '2026-11-18 16:23:25', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'PostgreSQL Sync',
    correctionStatus: 'None',
    notes: 'Completed Punch-In + Punch-Out with 0 actual worked hours (HALF_DAY)'
  },
  {
    id: 'ATT-20261026-006',
    employeeId: 'EMP-006',
    employeeName: 'Usman Tariq',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    date: '2026-10-26',
    shiftId: 'SHIFT-02',
    shiftName: 'Engineering Flexible Development Shift',
    checkInTime: '08:58',
    checkOutTime: '18:04',
    totalBreakMinutes: 60,
    workedHours: 8.1,
    expectedHours: 8.0,
    hoursVariance: 0.1,
    status: 'Present',
    primaryClassification: 'Present',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Office',
    source: 'Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 08:58:33', source: 'Web Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:04:10', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'System Auto-Audit',
    correctionStatus: 'None',
    notes: 'Probationary engineer on-time full shift'
  },
  {
    id: 'ATT-20261026-007',
    employeeId: 'EMP-007',
    employeeName: 'Kamran Raza',
    departmentId: 'DEP-02',
    departmentName: 'Sales & Business',
    date: '2026-10-26',
    shiftId: 'SHIFT-03',
    shiftName: 'Commercial Sales & Client Field Shift',
    checkInTime: '09:30',
    checkOutTime: '18:30',
    totalBreakMinutes: 60,
    workedHours: 8.0,
    expectedHours: 8.0,
    hoursVariance: 0.0,
    status: 'Field Duty',
    primaryClassification: 'Field Duty',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Field Duty',
    source: 'Field Duty Authorization',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 09:30:00', source: 'Client Visit App', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:30:00', source: 'Client Visit App', verified: true }
    ],
    verifiedBy: 'Ayesha Khan (HR Admin)',
    correctionStatus: 'None',
    notes: 'Approved field duty engagement at Mobilink Microfinance Bank HQ'
  },
  {
    id: 'ATT-20261026-008',
    employeeId: 'EMP-008',
    employeeName: 'Danish Qureshi',
    departmentId: 'DEP-02',
    departmentName: 'Sales & Business',
    date: '2026-10-26',
    shiftId: 'SHIFT-03',
    shiftName: 'Commercial Sales & Client Field Shift',
    checkInTime: '09:35',
    checkOutTime: '18:35',
    totalBreakMinutes: 60,
    workedHours: 8.0,
    expectedHours: 8.0,
    hoursVariance: 0.0,
    status: 'Field Duty',
    primaryClassification: 'Field Duty',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Field Duty',
    source: 'Field Duty Authorization',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 09:35:00', source: 'Client Visit App', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:35:00', source: 'Client Visit App', verified: true }
    ],
    verifiedBy: 'Kamran Raza (Sales Lead)',
    correctionStatus: 'None',
    notes: 'Approved enterprise client meeting at Telenor Pakistan B2B'
  },
  {
    id: 'ATT-20261026-009',
    employeeId: 'EMP-009',
    employeeName: 'Noman Bashir',
    departmentId: 'DEP-02',
    departmentName: 'Sales & Business',
    date: '2026-10-26',
    shiftId: 'SHIFT-03',
    shiftName: 'Commercial Sales & Client Field Shift',
    checkInTime: null,
    checkOutTime: null,
    totalBreakMinutes: 0,
    workedHours: 0.0,
    expectedHours: 8.0,
    hoursVariance: -8.0,
    status: 'Absent',
    primaryClassification: 'Absent',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Office',
    source: 'Automated Day End Reconciliation',
    punches: [],
    verifiedBy: 'System Auto-Audit',
    correctionStatus: 'Pending Submission',
    notes: 'Unscheduled absence without prior leave notice or punch record'
  },
  {
    id: 'ATT-20261026-010',
    employeeId: 'EMP-010',
    employeeName: 'Faizan Ahmed',
    departmentId: 'DEP-03',
    departmentName: 'Media & Creative',
    date: '2026-10-26',
    shiftId: 'SHIFT-05',
    shiftName: 'Media Creative Part-Time Shift',
    checkInTime: null,
    checkOutTime: null,
    totalBreakMinutes: 0,
    workedHours: 0.0,
    expectedHours: 4.0,
    hoursVariance: -4.0,
    status: 'On Leave',
    primaryClassification: 'On Leave',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Office',
    source: 'Approved Leave Ledger (F05 Demo Link)',
    punches: [],
    verifiedBy: 'Ayesha Khan (HR Admin)',
    correctionStatus: 'None',
    notes: 'Approved Annual Leave Day 1 (Leave Request LR-2026-012)'
  },
  {
    id: 'ATT-20261026-011',
    employeeId: 'EMP-011',
    employeeName: 'Rabia Malik',
    departmentId: 'DEP-03',
    departmentName: 'Media & Creative',
    date: '2026-10-26',
    shiftId: 'SHIFT-05',
    shiftName: 'Media Creative Part-Time Shift',
    checkInTime: '09:55',
    checkOutTime: '14:02',
    totalBreakMinutes: 0,
    workedHours: 4.1,
    expectedHours: 4.0,
    hoursVariance: 0.1,
    status: 'WFH',
    primaryClassification: 'WFH',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'WFH',
    source: 'Remote Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 09:55:12', source: 'Remote Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 14:02:40', source: 'Remote Portal', verified: true }
    ],
    verifiedBy: 'Faizan Ahmed (Media Head)',
    correctionStatus: 'None',
    notes: 'Authorized WFH video editing delivery session'
  },
  {
    id: 'ATT-20261026-012',
    employeeId: 'EMP-012',
    employeeName: 'Saad Haroon',
    departmentId: 'DEP-03',
    departmentName: 'Media & Creative',
    date: '2026-10-26',
    shiftId: 'SHIFT-06',
    shiftName: 'Contractor Hourly Project Schedule',
    checkInTime: '09:00',
    checkOutTime: '17:00',
    totalBreakMinutes: 60,
    workedHours: 7.0,
    expectedHours: 7.0,
    hoursVariance: 0.0,
    status: 'Present',
    primaryClassification: 'Present',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Hybrid',
    source: 'Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 09:00:10', source: 'Web Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 17:00:25', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'Faizan Ahmed (Media Head)',
    correctionStatus: 'None',
    notes: 'Hourly 3D motion graphics deliverables'
  },
  {
    id: 'ATT-20261026-013',
    employeeId: 'EMP-013',
    employeeName: 'Farhan Sheikh',
    departmentId: 'DEP-05',
    departmentName: 'Finance & Accounts',
    date: '2026-10-26',
    shiftId: 'SHIFT-01',
    shiftName: 'General Corporate Day Shift',
    checkInTime: '08:50',
    checkOutTime: '18:00',
    totalBreakMinutes: 60,
    workedHours: 8.2,
    expectedHours: 8.0,
    hoursVariance: 0.2,
    status: 'Present',
    primaryClassification: 'Present',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Office',
    source: 'Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 08:50:30', source: 'Web Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:00:15', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'System Auto-Audit',
    correctionStatus: 'None',
    notes: 'Finance team monthly reconciliation on-time attendance'
  },
  {
    id: 'ATT-20261026-014',
    employeeId: 'EMP-014',
    employeeName: 'Madiha Javed',
    departmentId: 'DEP-05',
    departmentName: 'Finance & Accounts',
    date: '2026-10-26',
    shiftId: 'SHIFT-01',
    shiftName: 'General Corporate Day Shift',
    checkInTime: '08:54',
    checkOutTime: '18:05',
    totalBreakMinutes: 60,
    workedHours: 8.2,
    expectedHours: 8.0,
    hoursVariance: 0.2,
    status: 'Present',
    primaryClassification: 'Present',
    isLate: false,
    lateMinutes: 0,
    isEarlyExit: false,
    earlyExitMinutes: 0,
    isHalfDay: false,
    workArrangement: 'Office',
    source: 'Web Check-In',
    punches: [
      { type: 'IN', timestamp: '2026-10-26 08:54:19', source: 'Web Portal', verified: true },
      { type: 'OUT', timestamp: '2026-10-26 18:05:45', source: 'Web Portal', verified: true }
    ],
    verifiedBy: 'System Auto-Audit',
    correctionStatus: 'None',
    notes: 'Accounts associate on-time attendance'
  }
]

export const INITIAL_ATTENDANCE_CORRECTIONS = [
  {
    id: 'CORR-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    attendanceDate: '2026-10-23', // Last Friday
    correctionType: 'Missing Check-Out',
    originalCheckIn: '09:05',
    originalCheckOut: null,
    requestedCheckIn: '09:05',
    requestedCheckOut: '18:10',
    reason: 'Power outage in office block during evening departure; browser session was terminated before manual punch.',
    supportingReference: 'IT Facility Ticket #992',
    currentApproverRole: 'Manager',
    currentApproverName: 'Bilal Siddiqui',
    status: 'Pending Review',
    submittedAt: '2026-10-24 10:15:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Zeeshan Ali (EMP-004)',
        timestamp: '2026-10-24 10:15:00',
        note: 'Submitted missed check-out correction request'
      }
    ],
    decisionNotes: null,
    decidedBy: null,
    decidedAt: null
  },
  {
    id: 'CORR-002',
    employeeId: 'EMP-009',
    employeeName: 'Noman Bashir',
    departmentId: 'DEP-02',
    departmentName: 'Sales & Business',
    attendanceDate: '2026-10-22',
    correctionType: 'Incorrect Absent Marking',
    originalCheckIn: null,
    originalCheckOut: null,
    requestedCheckIn: '09:30',
    requestedCheckOut: '18:30',
    reason: 'Was visiting client premises at Zong CMPak Telecom all day; missed pre-approval submission.',
    supportingReference: 'Signed client visitor slip attached',
    currentApproverRole: 'Manager',
    currentApproverName: 'Kamran Raza',
    status: 'Approved',
    submittedAt: '2026-10-23 09:00:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Noman Bashir (EMP-009)',
        timestamp: '2026-10-23 09:00:00',
        note: 'Submitted client duty regularization request'
      },
      {
        status: 'Approved',
        actor: 'Kamran Raza (Sales Lead)',
        timestamp: '2026-10-23 11:30:00',
        note: 'Verified with Zong account manager. Attendance regularized to Field Duty.'
      }
    ],
    decisionNotes: 'Verified client engagement.',
    decidedBy: 'Kamran Raza',
    decidedAt: '2026-10-23 11:30:00'
  }
]

export const INITIAL_WFH_REQUESTS = [
  {
    id: 'WFH-20261117-001',
    requestCode: 'WFH-20261117-001',
    employeeId: 'EMP-005',
    employeeName: 'Ahmed Khan',
    departmentId: 'DEP-01',
    departmentName: 'Software Development',
    requestedDate: '2026-11-17',
    startDate: '2026-11-17',
    endDate: '2026-11-17',
    totalDays: 1,
    reason: 'Remote infrastructure optimization & database tuning',
    workArrangement: 'WFH',
    deliverablesPlanned: 'PostgreSQL connection pooling configuration and replication testing.',
    status: 'Approved',
    hiringManagerId: 'EMP-004',
    approverName: 'Ali Raza',
    submittedAt: '2026-11-16 09:00:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Ahmed Khan (EMP-005)',
        timestamp: '2026-11-16 09:00:00',
        note: 'Submitted WFH request for 17 Nov'
      },
      {
        status: 'Approved',
        actor: 'Ali Raza (Team Lead)',
        timestamp: '2026-11-16 10:30:00',
        note: 'Approved for scheduled remote maintenance'
      }
    ]
  },
  {
    id: 'WFH-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    requestedDate: '2026-10-30', // Coming Friday
    endDate: '2026-10-30',
    totalDays: 1,
    reason: 'Home fiber internet upgrade and scheduled maintenance work.',
    workArrangement: 'WFH',
    deliverablesPlanned: 'API integration for payments service module and PR reviews.',
    status: 'Pending Review',
    hiringManagerId: 'EMP-003',
    approverName: 'Bilal Siddiqui',
    submittedAt: '2026-10-26 09:30:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Zeeshan Ali (EMP-004)',
        timestamp: '2026-10-26 09:30:00',
        note: 'WFH requested for 1 day'
      }
    ]
  },
  {
    id: 'WFH-002',
    employeeId: 'EMP-011',
    employeeName: 'Rabia Malik',
    departmentId: 'DEP-03',
    departmentName: 'Media & Creative',
    requestedDate: '2026-10-26',
    endDate: '2026-10-26',
    totalDays: 1,
    reason: 'High-bandwidth 4K video rendering on dedicated workstation at home studio.',
    workArrangement: 'WFH',
    deliverablesPlanned: 'Render and color-grade 4 promo videos for marketing release.',
    status: 'Approved',
    hiringManagerId: 'EMP-010',
    approverName: 'Faizan Ahmed',
    submittedAt: '2026-10-25 15:00:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Rabia Malik (EMP-011)',
        timestamp: '2026-10-25 15:00:00',
        note: 'Submitted video rendering WFH request'
      },
      {
        status: 'Approved',
        actor: 'Faizan Ahmed (Media Head)',
        timestamp: '2026-10-25 16:30:00',
        note: 'Approved. High workstation load justified.'
      }
    ]
  }
]

export const INITIAL_FIELD_DUTY_REQUESTS = [
  {
    id: 'FLD-20261118-001',
    requestCode: 'FLD-20261118-001',
    employeeId: 'EMP-005',
    employeeName: 'Ahmed Khan',
    departmentId: 'DEP-01',
    departmentName: 'Software Development',
    visitDate: '2026-11-18',
    clientName: 'Enterprise Client Site Karachi',
    purpose: 'On-site technical integration & client field audit',
    location: 'Karachi Financial District',
    expectedStartTime: '10:00',
    expectedEndTime: '15:30',
    actualStartTime: '10:00',
    actualEndTime: '15:30',
    durationHours: 5.5,
    status: 'Approved',
    approverRole: 'Super Admin',
    approverName: 'Tariq Mehmood',
    submittedAt: '2026-11-17 11:00:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Ahmed Khan (EMP-005)',
        timestamp: '2026-11-17 11:00:00',
        note: 'Submitted 5.5-hour client field audit request'
      },
      {
        status: 'Approved',
        actor: 'Tariq Mehmood (Super Admin)',
        timestamp: '2026-11-17 12:00:00',
        note: 'Approved client deployment session'
      }
    ]
  },
  {
    id: 'FLD-001',
    employeeId: 'EMP-007',
    employeeName: 'Kamran Raza',
    departmentId: 'DEP-02',
    departmentName: 'Sales & Business',
    visitDate: '2026-10-26',
    clientName: 'Mobilink Microfinance Bank',
    purpose: 'Executive demonstration of HRMS Enterprise and contract renewal discussions.',
    location: 'Mobilink HQ, Blue Area, Islamabad',
    expectedStartTime: '09:30',
    expectedEndTime: '18:30',
    actualStartTime: '09:30',
    actualEndTime: '18:30',
    status: 'Approved',
    approverRole: 'HR Admin',
    approverName: 'Ayesha Khan',
    submittedAt: '2026-10-25 11:00:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Kamran Raza (EMP-007)',
        timestamp: '2026-10-25 11:00:00',
        note: 'Field duty submission for client proposal'
      },
      {
        status: 'Approved',
        actor: 'Ayesha Khan (HR Admin)',
        timestamp: '2026-10-25 14:00:00',
        note: 'Official client visit authorized'
      }
    ]
  },
  {
    id: 'FLD-002',
    employeeId: 'EMP-005',
    employeeName: 'Ahmed Khan',
    departmentId: 'DEP-01',
    departmentName: 'Software Development',
    visitDate: '2026-10-26',
    clientName: 'Telenor Pakistan B2B Solutions',
    purpose: 'Quarterly review of workforce software requirements and technical integration assessment.',
    location: 'Telenor Campus, 345 River View Avenue, Islamabad',
    expectedStartTime: '09:35',
    expectedEndTime: '18:35',
    actualStartTime: '09:35',
    actualEndTime: '18:35',
    durationHours: 9.0,
    durationMinutes: 540,
    durationFormatted: '9h',
    status: 'Approved',
    isEscalated: true,
    escalationReason: 'Field duty duration (9.0 hrs) exceeds Team Lead 4.0-hour direct limit; escalated to Department Manager for authorization.',
    approverRole: 'Manager',
    approverName: 'Hamza Ahmed',
    approverId: 'EMP-003',
    submittedAt: '2026-10-25 12:30:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Ahmed Khan (EMP-005)',
        timestamp: '2026-10-25 12:30:00',
        note: 'Submitted 9-hour client integration review request'
      },
      {
        status: 'Endorsed by Team Lead',
        actor: 'Ali Raza (Team Lead)',
        timestamp: '2026-10-25 14:00:00',
        note: 'Client visit verified. Escalated to Department Manager (duration 9.0 hrs exceeds Team Lead 4.0h limit).'
      },
      {
        status: 'Approved',
        actor: 'Hamza Ahmed (Department Manager)',
        timestamp: '2026-10-25 15:45:00',
        note: 'Authorized full-day client consultation on-site.'
      }
    ]
  },
  {
    id: 'FLD-003',
    employeeId: 'EMP-005',
    employeeName: 'Ahmed Khan',
    departmentId: 'DEP-01',
    departmentName: 'Software Development',
    visitDate: '2026-11-04',
    clientName: 'Mobilink Microfinance Bank',
    purpose: 'Executive on-site technical architecture and HRMS API integration review.',
    location: 'Mobilink HQ, Blue Area, Islamabad',
    expectedStartTime: '09:00',
    expectedEndTime: '18:00',
    actualStartTime: '09:00',
    actualEndTime: '18:00',
    durationHours: 9.0,
    durationMinutes: 540,
    durationFormatted: '9h',
    status: 'Pending Team Lead Review',
    isEscalated: false,
    currentApproverRole: 'Team Lead',
    currentApproverName: 'Ali Raza',
    currentApproverId: 'EMP-004',
    approverRole: 'Team Lead',
    approverName: 'Ali Raza',
    approverId: 'EMP-004',
    submittedAt: '2026-11-03 09:30:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Ahmed Khan (EMP-005)',
        timestamp: '2026-11-03 09:30:00',
        note: 'Submitted 9-hour client integration review request'
      }
    ]
  }
]

export const INITIAL_OVERTIME_REQUESTS = [
  {
    id: 'OT-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    departmentId: 'DEP-01',
    departmentName: 'Development',
    overtimeDate: '2026-10-23',
    actualCheckIn: '09:00',
    actualCheckOut: '21:00',
    regularHours: 8.0,
    requestedMinutes: 120, // 2.0 hours
    requestedHours: 2.0,
    reason: 'Emergency database performance patch and cloud database migration during low-traffic window.',
    managerRecommendation: 'Recommended',
    status: 'Pending Review',
    approvedMinutes: null,
    approvedHours: null,
    approverRole: 'Manager',
    approverName: 'Bilal Siddiqui',
    submittedAt: '2026-10-24 09:30:00',
    approvalHistory: [
      {
        status: 'Submitted',
        actor: 'Zeeshan Ali (EMP-004)',
        timestamp: '2026-10-24 09:30:00',
        note: 'Requested 2 hours overtime for production patch'
      }
    ]
  }
]
