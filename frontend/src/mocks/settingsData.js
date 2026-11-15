/**
 * iSysware HRMS — Company Profile, Settings, Calendar & RBAC Foundation (Batch F13)
 * Authoritative single source of configuration truth owned by Super Admin.
 */

export const INITIAL_COMPANY_PROFILE = {
  id: 'COMP-ISYSWARE',
  name: 'iSysware Software Solutions (Pvt) Ltd',
  tradingName: 'iSysware HRMS',
  registrationNumber: 'SEC-PK-2018-098471',
  ntn: '7482910-3',
  logoUrl: '/logo.png',
  website: 'https://isysware.com',
  address: 'Suite 402, Executive Business Avenue, Shahrah-e-Faisal, Karachi 75350, Pakistan',
  contactEmail: 'admin@isysware.com',
  supportEmail: 'support@isysware.com',
  phone: '+92 (21) 3456-7890',
  fax: '+92 (21) 3456-7899',
  timezone: 'Asia/Karachi',
  defaultCurrency: 'PKR',
  currencySymbol: 'Rs.',
  fiscalYearStartMonth: 7, // July (Pakistan Tax Year: July 01 to June 30)
  fiscalYearEndMonth: 6,   // June
  workingWeekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  weeklyOffDays: ['Saturday', 'Sunday'],
  workingHoursPerDay: 8.0,
  defaultShiftStart: '09:00',
  defaultShiftEnd: '18:00',
  defaultGraceMinutes: 15,
  payrollCutoffDay: 25,
  payrollDisbursementDay: 1,
  authorizedContacts: [
    { name: 'Tariq Mehmood', role: 'Super Admin / Managing Director', email: 'superadmin@isysware.com', phone: '+92 300 1112233' },
    { name: 'Ayesha Khan', role: 'HR Admin / People Operations Lead', email: 'hr@isysware.com', phone: '+92 300 4445566' }
  ],
  version: '2.4',
  updatedAt: '2026-07-01 09:00:00',
  updatedBy: 'Tariq Mehmood (Super Admin)'
}

export const INITIAL_HOLIDAYS_2026 = [
  { id: 'HOL-2026-01', name: 'New Year Day', date: '2026-01-01', day: 'Thursday', type: 'Public', isWorkingDay: false, description: 'International New Year celebration' },
  { id: 'HOL-2026-02', name: 'Kashmir Solidarity Day', date: '2026-02-05', day: 'Thursday', type: 'Public', isWorkingDay: false, description: 'National public holiday' },
  { id: 'HOL-2026-03', name: 'Pakistan Day', date: '2026-03-23', day: 'Monday', type: 'Public', isWorkingDay: false, description: 'Commemoration of the Lahore Resolution' },
  { id: 'HOL-2026-04', name: 'Eid-ul-Fitr Day 1', date: '2026-03-20', day: 'Friday', type: 'Religious', isWorkingDay: false, description: 'Islamic Eid celebration' },
  { id: 'HOL-2026-05', name: 'Eid-ul-Fitr Day 2', date: '2026-03-21', day: 'Saturday', type: 'Religious', isWorkingDay: false, description: 'Islamic Eid celebration' },
  { id: 'HOL-2026-06', name: 'Eid-ul-Fitr Day 3', date: '2026-03-22', day: 'Sunday', type: 'Religious', isWorkingDay: false, description: 'Islamic Eid celebration' },
  { id: 'HOL-2026-07', name: 'Labour Day', date: '2026-05-01', day: 'Friday', type: 'Public', isWorkingDay: false, description: 'International Workers Day' },
  { id: 'HOL-2026-08', name: 'Eid-ul-Adha Day 1', date: '2026-05-27', day: 'Wednesday', type: 'Religious', isWorkingDay: false, description: 'Feast of Sacrifice' },
  { id: 'HOL-2026-09', name: 'Eid-ul-Adha Day 2', date: '2026-05-28', day: 'Thursday', type: 'Religious', isWorkingDay: false, description: 'Feast of Sacrifice' },
  { id: 'HOL-2026-10', name: 'Eid-ul-Adha Day 3', date: '2026-05-29', day: 'Friday', type: 'Religious', isWorkingDay: false, description: 'Feast of Sacrifice' },
  { id: 'HOL-2026-11', name: 'Ashura (9th Muharram)', date: '2026-06-25', day: 'Thursday', type: 'Religious', isWorkingDay: false, description: 'Holy Day of Ashura' },
  { id: 'HOL-2026-12', name: 'Ashura (10th Muharram)', date: '2026-06-26', day: 'Friday', type: 'Religious', isWorkingDay: false, description: 'Holy Day of Ashura' },
  { id: 'HOL-2026-13', name: 'Independence Day', date: '2026-08-14', day: 'Friday', type: 'Public', isWorkingDay: false, description: 'Pakistan Independence Day 1947' },
  { id: 'HOL-2026-14', name: 'Eid Milad-un-Nabi', date: '2026-08-25', day: 'Tuesday', type: 'Religious', isWorkingDay: false, description: 'Prophet Muhammad birthday commemoration' },
  { id: 'HOL-2026-15', name: 'iSysware Foundation Day', date: '2026-10-15', day: 'Thursday', type: 'Company', isWorkingDay: false, description: 'Annual company anniversary & hackathon' },
  { id: 'HOL-2026-16', name: 'Quaid-e-Azam Day / Christmas', date: '2026-12-25', day: 'Friday', type: 'Public', isWorkingDay: false, description: 'Birthday of Muhammad Ali Jinnah and Christmas' }
]

export const INITIAL_ROLE_PERMISSIONS = {
  super_admin: {
    roleName: 'Super Admin',
    description: 'Executive governance, company policy owner, supreme approval authority, system configuration.',
    isProtected: true,
    modules: {
      dashboard: ['view', 'export'],
      employees: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      recruitment: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      attendance: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      leaves: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      payroll: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      performance: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      training: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      helpdesk: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      travel: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      letters: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      expenses: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      settings: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      alerts: ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'verify', 'export', 'manage_config', 'view_audit'],
      reports: ['view', 'export']
    },
    defaultScope: 'company_wide'
  },
  hr_admin: {
    roleName: 'HR / Admin',
    description: 'Operational people care, attendance corrections, recruitment execution, payroll preparation, policy compliance.',
    isProtected: false,
    modules: {
      dashboard: ['view', 'export'],
      employees: ['view', 'create', 'edit', 'submit', 'verify', 'export', 'view_audit'],
      recruitment: ['view', 'create', 'edit', 'submit', 'verify', 'export', 'view_audit'],
      attendance: ['view', 'create', 'edit', 'submit', 'verify', 'export', 'view_audit'],
      leaves: ['view', 'create', 'edit', 'submit', 'verify', 'export', 'view_audit'],
      payroll: ['view', 'create', 'edit', 'submit', 'verify', 'export'], // Cannot finalize or approve without Super Admin
      performance: ['view', 'create', 'edit', 'submit', 'verify', 'export'],
      training: ['view', 'create', 'edit', 'submit', 'verify', 'export'],
      helpdesk: ['view', 'create', 'edit', 'submit', 'verify', 'export'],
      travel: ['view', 'create', 'edit', 'submit', 'verify', 'export'],
      letters: ['view', 'create', 'edit', 'submit', 'verify', 'export'],
      expenses: ['view', 'create', 'edit', 'submit', 'verify', 'export'],
      settings: ['view', 'edit'], // Operational settings only; cannot alter protected permissions or super admin rules
      alerts: ['view', 'create', 'edit'],
      reports: ['view', 'export']
    },
    defaultScope: 'company_wide'
  },
  manager: {
    roleName: 'Department Manager',
    description: 'Departmental oversight, multi-team leadership, performance appraisals, and approvals across authorized department teams.',
    isProtected: false,
    modules: {
      dashboard: ['view'],
      employees: ['view'], // Scoped to team, private salary hidden
      recruitment: ['view', 'submit'], // Can request headcount, view candidates for team
      attendance: ['view', 'approve', 'reject'], // Team punches & corrections
      leaves: ['view', 'approve', 'reject'], // Up to 2 days per month
      payroll: ['view'], // Own payslip only
      performance: ['view', 'create', 'edit', 'submit', 'approve'], // Team appraisals
      training: ['view', 'submit'], // Recommend training
      helpdesk: ['view', 'create', 'submit'], // Team tickets
      travel: ['view', 'submit', 'approve'], // Recommends travel
      letters: ['view', 'submit'],
      expenses: ['view', 'submit', 'approve'], // Up to PKR 25,000
      settings: ['view'], // View team policies only
      alerts: ['view'],
      reports: ['view']
    },
    defaultScope: 'department_teams'
  },
  team_lead: {
    roleName: 'Team Lead',
    description: 'Direct team supervision, task allocation, attendance oversight, initial leave recommendation, and team performance tracking within assigned team.',
    isProtected: false,
    modules: {
      dashboard: ['view'],
      employees: ['view'], // Scoped to assigned team only
      recruitment: ['view'],
      attendance: ['view', 'approve', 'reject'], // Assigned team attendance & corrections
      leaves: ['view', 'approve', 'reject'], // Assigned team leaves
      payroll: ['view'], // Own payslip
      tasks: ['view', 'create', 'edit', 'submit', 'approve'], // Assigned team tasks
      performance: ['view', 'create', 'edit', 'submit'], // Team reviews
      training: ['view', 'submit'],
      helpdesk: ['view', 'create', 'submit'],
      travel: ['view', 'submit'],
      letters: ['view', 'submit'],
      expenses: ['view', 'submit'],
      settings: ['view'],
      alerts: ['view'],
      reports: ['view']
    },
    defaultScope: 'assigned_team'
  },
  employee: {
    roleName: 'Employee',
    description: 'Personal self-service, attendance punch, leave requests, expense claims, personal profile management.',
    isProtected: false,
    modules: {
      dashboard: ['view'],
      employees: ['view', 'edit'], // Own profile only
      recruitment: ['view'], // View internal openings/onboarding
      attendance: ['view', 'create', 'submit'], // Clock in/out, punch corrections
      leaves: ['view', 'create', 'submit'], // Submit leave
      payroll: ['view'], // Own payslip & benefits
      performance: ['view', 'edit', 'submit'], // Self-appraisal & goals
      training: ['view', 'submit'], // Enroll in courses
      helpdesk: ['view', 'create', 'submit'], // Own tickets
      travel: ['view', 'create', 'submit'], // Own travel requests
      letters: ['view', 'submit'], // Request letters
      expenses: ['view', 'create', 'submit'], // Submit expense claims
      settings: ['view'], // View company entitlements only
      alerts: ['view'], // Personal notifications
      reports: []
    },
    defaultScope: 'own'
  }
}
