/**
 * iSysware HRMS — Deterministic Demo Data Foundation
 * Used ONLY for frontend UI layout verification and mock sessions.
 * Never claim this is production authentication or real security.
 */

export const DEMO_DEPARTMENTS = [
  { id: 'DEP-01', code: 'DEV', name: 'Development', description: 'Engineering, QA, and Architecture teams' },
  { id: 'DEP-02', code: 'SALES', name: 'Sales & Business', description: 'Enterprise sales, lead generation and field duty' },
  { id: 'DEP-03', code: 'MEDIA', name: 'Media & Creative', description: 'Design, video production, and content marketing' },
  { id: 'DEP-04', code: 'HR', name: 'Human Resources', description: 'People operations, recruitment, and compliance' },
  { id: 'DEP-05', code: 'FIN', name: 'Finance & Accounts', description: 'Payroll disbursement, tax withholding, and audit' },
  { id: 'DEP-06', code: 'MGMT', name: 'Executive Management', description: 'Company governance, board, and strategic oversight' }
]

export const DEMO_USERS = [
  {
    id: 'EMP-001',
    employeeId: 'EMP-001',
    name: 'Alexander Wright',
    email: 'superadmin@isysware.com',
    role: 'super_admin',
    roleLabel: 'Super Admin',
    designation: 'Chief Human Resources Officer',
    department: 'Executive Office',
    departmentId: 'DEP-06',
    initials: 'AW',
    portalPath: '/super-admin',
    capabilities: ['all', 'policy_engine', 'audit_full', 'payroll_approve']
  },
  {
    id: 'EMP-002',
    employeeId: 'EMP-002',
    name: 'Ayesha Khan',
    email: 'hr@isysware.com',
    role: 'hr_admin',
    roleLabel: 'HR / Admin',
    designation: 'Lead People Operations Specialist',
    department: 'Human Resources',
    departmentId: 'DEP-04',
    initials: 'AK',
    portalPath: '/hr-admin',
    capabilities: ['hr_operations', 'payroll_prepare', 'employee_admin', 'letters_issue']
  },
  {
    id: 'EMP-003',
    employeeId: 'EMP-003',
    name: 'Bilal Siddiqui',
    email: 'manager.dev@isysware.com',
    role: 'manager',
    roleLabel: 'Department Manager',
    designation: 'Software Engineering Manager',
    department: 'Development',
    departmentId: 'DEP-01',
    initials: 'BS',
    portalPath: '/manager',
    capabilities: ['team_review', 'leave_approve_cap', 'kpi_appraise', 'task_assign']
  },
  {
    id: 'EMP-005',
    employeeId: 'EMP-005',
    name: 'Hina Farooq',
    email: 'teamlead.dev@isysware.com',
    role: 'team_lead',
    roleLabel: 'Team Lead',
    designation: 'Lead QA Automation Engineer',
    department: 'Development',
    departmentId: 'DEP-01',
    teamId: 'TEAM-03',
    teamName: 'Quality Assurance & Testing',
    managerId: 'EMP-003',
    managerName: 'Bilal Siddiqui',
    initials: 'HF',
    portalPath: '/team-lead',
    capabilities: ['team_lead_review', 'leave_recommend', 'task_assign', 'attendance_view']
  },
  {
    id: 'EMP-004',
    employeeId: 'EMP-004',
    name: 'Zeeshan Ali',
    email: 'zeeshan.dev@isysware.com',
    role: 'employee',
    roleLabel: 'Employee',
    designation: 'Senior Full-Stack Developer',
    department: 'Development',
    departmentId: 'DEP-01',
    managerId: 'EMP-003',
    managerName: 'Bilal Siddiqui',
    initials: 'ZA',
    portalPath: '/employee',
    capabilities: ['self_service', 'punch_record', 'leave_request', 'payslip_view']
  },
  {
    id: 'EMP-016',
    employeeId: 'EMP-016',
    name: 'Ahmed Raza QA',
    email: 'ahmed.qa@isysware.com',
    role: 'employee',
    roleLabel: 'Employee (QA)',
    designation: 'QA Automation Engineer',
    department: 'Development',
    departmentId: 'DEP-01',
    teamId: 'TEAM-03',
    teamName: 'Quality Assurance & Testing',
    managerId: 'EMP-005',
    managerName: 'Hina Farooq',
    initials: 'AR',
    portalPath: '/employee',
    capabilities: ['self_service', 'punch_record', 'leave_request', 'payslip_view']
  }
]

export const DEFAULT_DEMO_PASSWORD = 'password123'
