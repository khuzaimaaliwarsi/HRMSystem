/**
 * iSysware HRMS — Batch F07: Tasks, Goals, KPIs & Performance Mock Dataset
 * Authoritative dataset for:
 * - Department-specific Tasks & Assignments
 * - Departmental Goals & Role-specific KPIs (Dev, Sales, Media, HR, Finance, Mgmt)
 * - Appraisal Review Cycles & Employee Performance Reviews
 * - Feedback, Individual Development Plans (IDP) & PIPs
 * - Performance-to-Salary Revision Integration Hooks
 */

export const INITIAL_TASKS = [
  {
    id: 'TSK-001',
    title: 'Migrate React Components to Vanilla CSS Tokens',
    description: 'Refactor core navigation and button components to use shared design system tokens.',
    departmentId: 'DEP-01',
    department: 'Engineering & Technology',
    assignedToId: 'EMP-004',
    assignedToName: 'Zeeshan Ali',
    assignedById: 'EMP-003',
    assignedByName: 'Bilal Siddiqui',
    priority: 'High',
    status: 'In Progress',
    progress: 65,
    estimatedHours: 24,
    loggedHours: 16,
    startDate: '2026-10-15',
    dueDate: '2026-10-30',
    completionDate: null,
    projectRef: 'PRJ-HRMS-V4',
    comments: [
      { id: 'CMT-1', author: 'Bilal Siddiqui', date: '2026-10-18', text: 'Please ensure high contrast on dark headers.' },
      { id: 'CMT-2', author: 'Zeeshan Ali', date: '2026-10-22', text: 'Token mapping complete, validating dialogs.' }
    ]
  },
  {
    id: 'TSK-002',
    title: 'Implement FBR Section 149 Withholding Verification Engine',
    description: 'Ensure payroll withholding adheres strictly to Income Tax Ordinance 2001 First Schedule.',
    departmentId: 'DEP-01',
    department: 'Engineering & Technology',
    assignedToId: 'EMP-005',
    assignedToName: 'Hamza Sheikh',
    assignedById: 'EMP-003',
    assignedByName: 'Bilal Siddiqui',
    priority: 'Urgent',
    status: 'In Review',
    progress: 90,
    estimatedHours: 32,
    loggedHours: 30,
    startDate: '2026-10-10',
    dueDate: '2026-10-28',
    completionDate: null,
    projectRef: 'PRJ-HRMS-V4',
    comments: [
      { id: 'CMT-3', author: 'Hamza Sheikh', date: '2026-10-25', text: 'All 6 tax slabs verified against test scenarios.' }
    ]
  },
  {
    id: 'TSK-003',
    title: 'Enterprise Q4 Client Account Review & Proposals',
    description: 'Prepare tailored enterprise HRMS implementation bids for 3 top-tier telecom prospects.',
    departmentId: 'DEP-02',
    department: 'Sales & Business',
    assignedToId: 'EMP-007',
    assignedToName: 'Farhan Zaidi',
    assignedById: 'EMP-001',
    assignedByName: 'Tariq Mehmood',
    priority: 'High',
    status: 'In Progress',
    progress: 75,
    estimatedHours: 40,
    loggedHours: 32,
    startDate: '2026-10-01',
    dueDate: '2026-11-05',
    completionDate: null,
    projectRef: 'SLS-Q4-2026',
    comments: []
  },
  {
    id: 'TSK-004',
    title: 'Design UI Motion Assets for Portal Dashboard',
    description: 'Produce vector micro-interaction sequences and visual design banners for employee portal.',
    departmentId: 'DEP-03',
    department: 'Media & Design',
    assignedToId: 'EMP-010',
    assignedToName: 'Sana Mir',
    assignedById: 'EMP-001',
    assignedByName: 'Tariq Mehmood',
    priority: 'Medium',
    status: 'Completed',
    progress: 100,
    estimatedHours: 18,
    loggedHours: 18,
    startDate: '2026-10-05',
    dueDate: '2026-10-20',
    completionDate: '2026-10-19',
    projectRef: 'MED-ASSETS-V2',
    comments: [
      { id: 'CMT-4', author: 'Tariq Mehmood', date: '2026-10-20', text: 'Approved. Assets integrated into Figma.' }
    ]
  },
  {
    id: 'TSK-005',
    title: 'Probation Milestone & Biometric Punch Verification',
    description: 'Audit canonical attendance logs for 3 probation candidates approaching 90-day review.',
    departmentId: 'DEP-04',
    department: 'Human Resources',
    assignedToId: 'EMP-002',
    assignedToName: 'Ayesha Khan',
    assignedById: 'EMP-001',
    assignedByName: 'Tariq Mehmood',
    priority: 'Medium',
    status: 'Completed',
    progress: 100,
    estimatedHours: 12,
    loggedHours: 10,
    startDate: '2026-10-12',
    dueDate: '2026-10-24',
    completionDate: '2026-10-23',
    projectRef: 'HR-OPS-2026',
    comments: []
  },
  {
    id: 'TSK-006',
    title: 'Resolve Overnight Shift Cross-Midnight Punch Deductions',
    description: 'Ensure 20:00 - 04:00 shift punches do not trigger spurious late deductions across midnight.',
    departmentId: 'DEP-01',
    department: 'Engineering & Technology',
    assignedToId: 'EMP-004',
    assignedToName: 'Zeeshan Ali',
    assignedById: 'EMP-003',
    assignedByName: 'Bilal Siddiqui',
    priority: 'Urgent',
    status: 'To Do',
    progress: 0,
    estimatedHours: 16,
    loggedHours: 0,
    startDate: '2026-10-26',
    dueDate: '2026-11-04',
    completionDate: null,
    projectRef: 'PRJ-HRMS-V4',
    comments: []
  }
];

export const INITIAL_DEPARTMENT_KPIS = [
  // Engineering
  {
    id: 'KPI-DEV-001',
    code: 'ENG-DELIVERY',
    name: 'Sprint Task Delivery Rate',
    departmentId: 'DEP-01',
    department: 'Engineering & Technology',
    metricType: 'Percentage',
    targetValue: 90,
    weightPercent: 30,
    reviewCycle: 'Quarterly',
    description: 'Percentage of assigned sprint backlog deliverables completed within committed deadline.'
  },
  {
    id: 'KPI-DEV-002',
    code: 'ENG-QUALITY',
    name: 'Code Quality & Defect Density',
    departmentId: 'DEP-01',
    department: 'Engineering & Technology',
    metricType: 'Rating (1-5)',
    targetValue: 4.5,
    weightPercent: 30,
    reviewCycle: 'Quarterly',
    description: 'Peer code review score and post-release bug defect counts.'
  },
  {
    id: 'KPI-DEV-003',
    code: 'ENG-ARCHITECTURE',
    name: 'Architecture & System Compliance',
    departmentId: 'DEP-01',
    department: 'Engineering & Technology',
    metricType: 'Rating (1-5)',
    targetValue: 4.0,
    weightPercent: 20,
    reviewCycle: 'Quarterly',
    description: 'Adherence to pure React, no TypeScript constraint, and modular service patterns.'
  },
  {
    id: 'KPI-DEV-004',
    code: 'ENG-MENTOR',
    name: 'Team Mentorship & Documentation',
    departmentId: 'DEP-01',
    department: 'Engineering & Technology',
    metricType: 'Rating (1-5)',
    targetValue: 4.0,
    weightPercent: 20,
    reviewCycle: 'Quarterly',
    description: 'Knowledge sharing, technical onboarding assistance, and TRD/PRD documentation.'
  },

  // Sales
  {
    id: 'KPI-SLS-001',
    code: 'SLS-REVENUE',
    name: 'Revenue Target Achievement',
    departmentId: 'DEP-02',
    department: 'Sales & Business',
    metricType: 'Numeric (PKR)',
    targetValue: 3000000,
    weightPercent: 40,
    reviewCycle: 'Quarterly',
    description: 'Total verified enterprise software revenue collected.'
  },
  {
    id: 'KPI-SLS-002',
    code: 'SLS-PIPELINE',
    name: 'Qualified Enterprise Leads',
    departmentId: 'DEP-02',
    department: 'Sales & Business',
    metricType: 'Count',
    targetValue: 15,
    weightPercent: 30,
    reviewCycle: 'Quarterly',
    description: 'Number of validated enterprise RFP/deal opportunities initiated.'
  },
  {
    id: 'KPI-SLS-003',
    code: 'SLS-CONV',
    name: 'Deal Conversion Ratio',
    departmentId: 'DEP-02',
    department: 'Sales & Business',
    metricType: 'Percentage',
    targetValue: 25,
    weightPercent: 30,
    reviewCycle: 'Quarterly',
    description: 'Percentage of qualified demonstrations converted into paid contracts.'
  },

  // Media & Design
  {
    id: 'KPI-MED-001',
    code: 'MED-DELIVERY',
    name: 'UI/UX Deliverable Completion',
    departmentId: 'DEP-03',
    department: 'Media & Design',
    metricType: 'Percentage',
    targetValue: 95,
    weightPercent: 50,
    reviewCycle: 'Quarterly',
    description: 'On-time delivery of application screens, vector graphics, and brand assets.'
  },
  {
    id: 'KPI-MED-002',
    code: 'MED-AESTHETICS',
    name: 'Design Aesthetics & System Polish',
    departmentId: 'DEP-03',
    department: 'Media & Design',
    metricType: 'Rating (1-5)',
    targetValue: 4.8,
    weightPercent: 50,
    reviewCycle: 'Quarterly',
    description: 'Visual excellence, responsive polish, and brand alignment rating.'
  },

  // Human Resources
  {
    id: 'KPI-HR-001',
    code: 'HR-TIMELINESS',
    name: 'Payroll & Leave Processing Timeliness',
    departmentId: 'DEP-04',
    department: 'Human Resources',
    metricType: 'Percentage',
    targetValue: 100,
    weightPercent: 40,
    reviewCycle: 'Monthly',
    description: 'Monthly payroll draft readiness by 25th and leave requests reviewed within 24h.'
  },
  {
    id: 'KPI-HR-002',
    code: 'HR-COMPLIANCE',
    name: 'Statutory & Policy Governance',
    departmentId: 'DEP-04',
    department: 'Human Resources',
    metricType: 'Rating (1-5)',
    targetValue: 4.8,
    weightPercent: 30,
    reviewCycle: 'Quarterly',
    description: 'Zero compliance exceptions in Section 149 tax deductions and bank verification.'
  },
  {
    id: 'KPI-HR-003',
    code: 'HR-RECRUIT',
    name: 'Average Time-to-Hire',
    departmentId: 'DEP-04',
    department: 'Human Resources',
    metricType: 'Numeric (Days)',
    targetValue: 21,
    weightPercent: 30,
    reviewCycle: 'Quarterly',
    description: 'Average days from vacancy approval to candidate job offer acceptance.'
  }
];

export const INITIAL_APPRAISAL_CYCLES = [
  {
    id: 'CYC-2026-Q3',
    name: 'Q3 2026 Performance Appraisal Cycle',
    fiscalYear: '2026-2027',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    status: 'Completed',
    totalEligible: 14,
    completedReviews: 14,
    finalizedDate: '2026-10-05',
    moderatedBy: 'Ayesha Khan (HR Admin)',
    approvedBy: 'Tariq Mehmood (Super Admin)'
  },
  {
    id: 'CYC-2026-Q4',
    name: 'Q4 2026 Mid-Year Appraisal Cycle',
    fiscalYear: '2026-2027',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    status: 'In Progress',
    totalEligible: 14,
    completedReviews: 6,
    finalizedDate: null,
    moderatedBy: 'Ayesha Khan (HR Admin)',
    approvedBy: null
  }
];

export const INITIAL_EMPLOYEE_REVIEWS = [
  {
    id: 'REV-2026-Q3-EMP004',
    cycleId: 'CYC-2026-Q3',
    cycleName: 'Q3 2026 Performance Appraisal Cycle',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    department: 'Engineering & Technology',
    designation: 'Senior Frontend Engineer',
    reviewerId: 'EMP-003',
    reviewerName: 'Bilal Siddiqui (Engineering Manager)',
    selfRating: 4.5,
    selfComments: 'Delivered Leave Management (F05) and refactored responsive navigation tables. Maintained 96% sprint velocity.',
    managerRating: 4.7,
    managerComments: 'Exceptional architectural rigor, clean JavaScript logic, and strong pair programming. Highly recommended for promotion.',
    hrRating: 4.7,
    hrComments: 'Verified with attendance and leave records. Perfect discipline and zero policy infractions.',
    finalWeightedRating: 4.7,
    status: 'Finalized',
    isAcknowledged: true,
    acknowledgedAt: '2026-10-07 11:20:00',
    managerRecommendation: {
      type: 'SALARY_INCREMENT',
      recommendedIncreasePercent: 15.0,
      recommendedNewSalary: 130000,
      justification: 'Exemplary delivery of core HRMS modules and strong mentoring of junior frontend engineers.',
      handoffStatus: 'PROPOSAL_CREATED' // 'NOT_STARTED' | 'PROPOSAL_CREATED' | 'APPROVED_IN_PAYROLL'
    },
    developmentGoals: [
      { goal: 'Lead full React performance audit', targetDate: '2026-12-15', status: 'In Progress' },
      { goal: 'Mentor incoming junior developer on module integration', targetDate: '2026-11-30', status: 'Achieved' }
    ]
  },
  {
    id: 'REV-2026-Q3-EMP007',
    cycleId: 'CYC-2026-Q3',
    cycleName: 'Q3 2026 Performance Appraisal Cycle',
    employeeId: 'EMP-007',
    employeeName: 'Farhan Zaidi',
    department: 'Sales & Business',
    designation: 'Senior Enterprise Business Executive',
    reviewerId: 'EMP-001',
    reviewerName: 'Tariq Mehmood (Managing Director)',
    selfRating: 4.2,
    selfComments: 'Surpassed Q3 enterprise revenue quotas and closed 2 multi-year enterprise contracts.',
    managerRating: 4.5,
    managerComments: 'Outstanding client relationship management. Consistently high qualifying revenue collection.',
    hrRating: 4.5,
    hrComments: 'Sales commission transactions verified against bank payment receipts.',
    finalWeightedRating: 4.5,
    status: 'Finalized',
    isAcknowledged: true,
    acknowledgedAt: '2026-10-06 14:15:00',
    managerRecommendation: {
      type: 'ONE_TIME_BONUS',
      recommendedIncreasePercent: 0,
      recommendedNewSalary: 190000,
      justification: 'Overachieved revenue quota by 22% in Q3 2026.',
      handoffStatus: 'APPROVED_IN_PAYROLL'
    },
    developmentGoals: [
      { goal: 'Expand enterprise pipeline in banking sector', targetDate: '2026-12-31', status: 'In Progress' }
    ]
  },
  {
    id: 'REV-2026-Q4-EMP005',
    cycleId: 'CYC-2026-Q4',
    cycleName: 'Q4 2026 Mid-Year Appraisal Cycle',
    employeeId: 'EMP-005',
    employeeName: 'Hamza Sheikh',
    department: 'Engineering & Technology',
    designation: 'Full Stack Engineer',
    reviewerId: 'EMP-003',
    reviewerName: 'Bilal Siddiqui (Engineering Manager)',
    selfRating: 4.0,
    selfComments: 'Focused on tax computation services and salary proration math.',
    managerRating: 4.2,
    managerComments: 'Strong analytical skills, solid financial modeling in JavaScript.',
    hrRating: null,
    hrComments: '',
    finalWeightedRating: 4.1,
    status: 'Manager Evaluated',
    isAcknowledged: false,
    acknowledgedAt: null,
    managerRecommendation: {
      type: 'SALARY_INCREMENT',
      recommendedIncreasePercent: 10.0,
      recommendedNewSalary: 165000,
      justification: 'Successfully engineered Section 149 calculation engine.',
      handoffStatus: 'NOT_STARTED'
    },
    developmentGoals: [
      { goal: 'Master vitest test automation patterns', targetDate: '2026-11-20', status: 'In Progress' }
    ]
  }
];

export const INITIAL_DEVELOPMENT_PLANS = [
  {
    id: 'IDP-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    type: 'Career Growth & Leadership',
    title: 'Senior Technical Lead Progression',
    mentorName: 'Bilal Siddiqui',
    startDate: '2026-10-01',
    targetCompletionDate: '2027-03-31',
    status: 'Active',
    checkpoints: [
      { title: 'Complete advanced React architecture refactoring', dueDate: '2026-11-15', completed: true },
      { title: 'Conduct 2 technical design reviews for team', dueDate: '2026-12-20', completed: false },
      { title: 'Publish module integration architectural best practices', dueDate: '2027-01-30', completed: false }
    ],
    recommendedTraining: 'Advanced Software System Architecture & Scalability (F08 Preview)'
  },
  {
    id: 'IDP-002',
    employeeId: 'EMP-006',
    employeeName: 'Usman Ghani',
    type: 'Performance Improvement Plan (PIP)',
    title: 'Punctuality & Shift Attendance Rectification',
    mentorName: 'Ayesha Khan',
    startDate: '2026-10-01',
    targetCompletionDate: '2026-11-30',
    status: 'Active',
    checkpoints: [
      { title: 'Zero unapproved tardiness for 30 consecutive business days', dueDate: '2026-10-31', completed: true },
      { title: 'Daily shift roster confirmation with HR portal', dueDate: '2026-11-15', completed: false }
    ],
    recommendedTraining: 'Professional Workplace Ethics & Time Governance'
  }
];
