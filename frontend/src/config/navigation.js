/**
 * iSysware HRMS — Four Portals Approved Navigation Registry
 * Defines exact authorized navigation items & submodules for:
 * 1. Super Admin Portal (All 14 modules in exact logical order F01–F14)
 * 2. HR / Admin Portal (All 14 operational modules F01–F14)
 * 3. Manager Portal (13 permitted team/personal modules)
 * 4. Employee Portal (14 authorized personal self-service modules)
 */

export const PORTAL_CONFIG = {
  super_admin: {
    portalId: 'super_admin',
    portalName: 'Super Admin Portal',
    badgeLabel: 'Company Oversight & Policies',
    basePath: '/super-admin',
    defaultRoute: '/super-admin/dashboard',
    themeColor: 'primary',
    menuGroups: [
      {
        groupLabel: 'WORKFORCE & CORE',
        items: [
          {
            key: 'dashboard',
            label: 'Dashboard',
            path: '/super-admin/dashboard',
            icon: 'dashboard',
            batchId: 'F01'
          },
          {
            key: 'employees',
            label: 'Employee Management',
            path: '/super-admin/employees',
            icon: 'employees',
            batchId: 'F02',
            submodules: [
              { key: 'directory', label: 'Employee Directory', path: '/super-admin/employees?tab=directory' },
              { key: 'org', label: 'Organization Master', path: '/super-admin/employees?tab=org' },
              { key: 'profiles', label: 'Employee Profiles & Career History', path: '/super-admin/employees?tab=profiles' }
            ]
          },
          {
            key: 'recruitment',
            label: 'Recruitment & Onboarding',
            path: '/super-admin/recruitment',
            icon: 'recruitment',
            batchId: 'F03',
            submodules: [
              { key: 'vacancies', label: 'Job Requisitions & Vacancies', path: '/super-admin/recruitment?tab=vacancies' },
              { key: 'candidates', label: 'Candidates & Applications', path: '/super-admin/recruitment?tab=candidates' },
              { key: 'interviews', label: 'Interviews & Evaluations', path: '/super-admin/recruitment?tab=interviews' },
              { key: 'offers', label: 'Offers & Joining', path: '/super-admin/recruitment?tab=offers' },
              { key: 'probation', label: 'Probation & Confirmation', path: '/super-admin/recruitment?tab=probation' }
            ]
          },
          {
            key: 'attendance',
            label: 'Attendance & Shifts',
            path: '/super-admin/attendance',
            icon: 'attendance',
            batchId: 'F04',
            submodules: [
              { key: 'register', label: 'Attendance Register', path: '/super-admin/attendance?tab=register' },
              { key: 'shifts', label: 'Shift Management & Rosters', path: '/super-admin/attendance?tab=shifts' },
              { key: 'assignments', label: 'Shift Assignments', path: '/super-admin/attendance?tab=assignments' },
              { key: 'corrections', label: 'Attendance Corrections', path: '/super-admin/attendance?tab=corrections' },
              { key: 'wfh', label: 'WFH & Field Duty', path: '/super-admin/attendance?tab=wfh' },
              { key: 'timesheets', label: 'Overtime & Timesheets', path: '/super-admin/attendance?tab=timesheets' }
            ]
          },
          {
            key: 'leaves',
            label: 'Leave Management',
            path: '/super-admin/leaves',
            icon: 'leave',
            batchId: 'F05',
            submodules: [
              { key: 'overview', label: 'Leave Requests & Overview', path: '/super-admin/leaves?tab=overview' },
              { key: 'queue', label: 'Leave Approvals Queue', path: '/super-admin/leaves?tab=queue' },
              { key: 'balances', label: 'Leave Balances & Entitlements', path: '/super-admin/leaves?tab=balances' },
              { key: 'calendar', label: 'Company Leave Calendar', path: '/super-admin/leaves?tab=calendar' },
              { key: 'history', label: 'Leave History & Ledger', path: '/super-admin/leaves?tab=history' },
              { key: 'policy', label: 'Leave Policy Overview', path: '/super-admin/leaves?tab=policy' }
            ]
          }
        ]
      },
      {
        groupLabel: 'COMPENSATION & TALENT',
        items: [
          {
            key: 'payroll',
            label: 'Payroll, Compensation & Benefits',
            path: '/super-admin/payroll',
            icon: 'payroll',
            batchId: 'F06',
            submodules: [
              { key: 'runs', label: 'Payroll Overview & Runs', path: '/super-admin/payroll?tab=runs' },
              { key: 'structures', label: 'Salary Structures & Compensation', path: '/super-admin/payroll?tab=structures' },
              { key: 'revisions', label: 'Salary Increment / Decrement', path: '/super-admin/payroll?tab=revisions' },
              { key: 'allowances', label: 'Allowances & Benefits', path: '/super-admin/payroll?tab=allowances' },
              { key: 'commissions', label: 'Sales Commissions & Bonuses', path: '/super-admin/payroll?tab=commissions' },
              { key: 'loans', label: 'Employee Loans & Salary Advances', path: '/super-admin/payroll?tab=loans' },
              { key: 'tax', label: 'Pakistan Salary Tax (S.149)', path: '/super-admin/payroll?tab=tax' },
              { key: 'payments', label: 'Bank Accounts & Salary Payments', path: '/super-admin/payroll?tab=payments' }
            ]
          },
          {
            key: 'performance',
            label: 'Tasks & Performance Management',
            path: '/super-admin/performance',
            icon: 'performance',
            batchId: 'F07',
            submodules: [
              { key: 'tasks', label: 'Task Management & Deliverables', path: '/super-admin/performance?tab=tasks' },
              { key: 'kpis', label: 'Goals, Targets & Department KPIs', path: '/super-admin/performance?tab=kpis' },
              { key: 'reviews', label: 'Employee Performance Reviews', path: '/super-admin/performance?tab=reviews' },
              { key: 'plans', label: 'Feedback & Development Plans (PIPs)', path: '/super-admin/performance?tab=plans' }
            ]
          },
          {
            key: 'training',
            label: 'Training & Development',
            path: '/super-admin/training',
            icon: 'training',
            batchId: 'F08',
            submodules: [
              { key: 'catalog', label: 'Course Catalog & Programs', path: '/super-admin/training?tab=catalog' },
              { key: 'plans', label: 'Training Plans & Skill Recommendations', path: '/super-admin/training?tab=plans' },
              { key: 'sessions', label: 'Cohorts & Training Scheduling', path: '/super-admin/training?tab=sessions' },
              { key: 'progress', label: 'Employee Learning Progress & Grades', path: '/super-admin/training?tab=progress' },
              { key: 'certificates', label: 'Verified Certificates Register', path: '/super-admin/training?tab=certificates' }
            ]
          }
        ]
      },
      {
        groupLabel: 'OPERATIONS & SERVICES',
        items: [
          {
            key: 'helpdesk',
            label: 'Help Desk Management',
            path: '/super-admin/helpdesk',
            icon: 'helpdesk',
            batchId: 'F09',
            submodules: [
              { key: 'all-tickets', label: 'Help Desk Overview & Company Tickets', path: '/super-admin/helpdesk?tab=all-tickets' },
              { key: 'escalations', label: 'Ticket Assignment & Escalations', path: '/super-admin/helpdesk?tab=escalations' },
              { key: 'sla-breaches', label: 'SLA & Resolution Management', path: '/super-admin/helpdesk?tab=sla-breaches' },
              { key: 'my-tickets', label: 'My Submitted Tickets', path: '/super-admin/helpdesk?tab=my-tickets' },
              { key: 'analytics', label: 'Ticket History, Feedback & Analytics', path: '/super-admin/helpdesk?tab=analytics' }
            ]
          },
          {
            key: 'travel',
            label: 'Travel & Transport Management',
            path: '/super-admin/travel',
            icon: 'travel',
            batchId: 'F10',
            submodules: [
              { key: 'overview', label: 'Travel Requests & Approvals', path: '/super-admin/travel?tab=overview' },
              { key: 'plans', label: 'Travel Plans & Bookings', path: '/super-admin/travel?tab=plans' },
              { key: 'expenses', label: 'Travel Advances & Expenses', path: '/super-admin/travel?tab=expenses' },
              { key: 'transport', label: 'Pick-and-Drop Management', path: '/super-admin/travel?tab=transport' },
              { key: 'routes', label: 'Vehicles, Drivers & Transport Routes', path: '/super-admin/travel?tab=routes' },
              { key: 'audit', label: 'Travel & Transport History', path: '/super-admin/travel?tab=audit' }
            ]
          },
          {
            key: 'letters',
            label: 'HR Letters Management',
            path: '/super-admin/letters',
            icon: 'letters',
            batchId: 'F11',
            submodules: [
              { key: 'templates', label: 'Letter Templates Management', path: '/super-admin/letters?tab=templates' },
              { key: 'register', label: 'Issued Letters Register', path: '/super-admin/letters?tab=register' },
              { key: 'approvals', label: 'Letter Approval & Issuance', path: '/super-admin/letters?tab=approvals' },
              { key: 'audit', label: 'Governance & Audit History', path: '/super-admin/letters?tab=audit' }
            ]
          },
          {
            key: 'expenses',
            label: 'Expense Management',
            path: '/super-admin/expenses',
            icon: 'expense',
            batchId: 'F12',
            submodules: [
              { key: 'overview', label: 'Expense Overview', path: '/super-admin/expenses?tab=overview' },
              { key: 'claims', label: 'Company Expense Claims', path: '/super-admin/expenses?tab=claims' },
              { key: 'queue', label: 'Expense Approval Queue', path: '/super-admin/expenses?tab=queue' },
              { key: 'reimbursements', label: 'Reimbursements & Payment Tracking', path: '/super-admin/expenses?tab=reimbursements' },
              { key: 'categories', label: 'Expense Categories & Policies Overview', path: '/super-admin/expenses?tab=categories' },
              { key: 'travel_reconciliation', label: 'Travel Expense Reconciliation', path: '/super-admin/expenses?tab=travel_reconciliation' },
              { key: 'audit', label: 'Expense History & Audit', path: '/super-admin/expenses?tab=audit' }
            ]
          }
        ]
      },
      {
        groupLabel: 'ORGANIZATION & SYSTEM',
        items: [
          {
            key: 'reports',
            label: 'Reports & Analytics',
            path: '/super-admin/reports',
            icon: 'reports',
            batchId: 'F14',
            submodules: [
              { key: 'fam_org', label: 'Workforce & Organization Reports', path: '/super-admin/reports?family=fam_org' },
              { key: 'fam_rec', label: 'Recruitment & Onboarding Reports', path: '/super-admin/reports?family=fam_rec' },
              { key: 'fam_att', label: 'Attendance, Shifts & Work Hours Reports', path: '/super-admin/reports?family=fam_att' },
              { key: 'fam_lev', label: 'Leave & Approval Governance Reports', path: '/super-admin/reports?family=fam_lev' },
              { key: 'fam_pay', label: 'Payroll, Employee Pay & Banking Reports', path: '/super-admin/reports?family=fam_pay' },
              { key: 'fam_tax', label: 'Tax & Statutory Reports (FBR)', path: '/super-admin/reports?family=fam_tax' },
              { key: 'fam_ben', label: 'Commissions, Loans & Benefits Reports', path: '/super-admin/reports?family=fam_ben' },
              { key: 'fam_prf', label: 'Tasks, Performance & Training Reports', path: '/super-admin/reports?family=fam_prf' },
              { key: 'fam_pol', label: 'Policy Governance & Approval Reports', path: '/super-admin/reports?family=fam_pol' },
              { key: 'fam_hld', label: 'Help Desk Service & SLA Reports', path: '/super-admin/reports?family=fam_hld' },
              { key: 'fam_trv', label: 'Travel, Pick-and-Drop & Expense Reports', path: '/super-admin/reports?family=fam_trv' },
              { key: 'fam_sec', label: 'HR Letters, Alerts & Security Reports', path: '/super-admin/reports?family=fam_sec' }
            ]
          },
          {
            key: 'settings',
            label: 'Administration & Settings',
            path: '/super-admin/settings',
            icon: 'settings',
            batchId: 'F13',
            submodules: [
              { key: 'profile', label: 'Company Profile & General Settings', path: '/super-admin/settings?tab=profile' },
              { key: 'users', label: 'Portal User Management', path: '/super-admin/settings?tab=users' },
              { key: 'policies', label: 'Company Policies & Rule Builder', path: '/super-admin/settings?tab=policies' },
              { key: 'permissions', label: 'Roles & Permissions Management', path: '/super-admin/settings?tab=permissions' },
              { key: 'matrix', label: 'Approval Authority & Escalation Matrix', path: '/super-admin/settings?tab=matrix' },
              { key: 'attendance_leaves', label: 'Attendance & Leave Policies', path: '/super-admin/settings?tab=attendance_leaves' },
              { key: 'finance_expenses', label: 'Payroll & Expense Policies', path: '/super-admin/settings?tab=finance_expenses' },
              { key: 'calendar', label: 'Holidays & Working Calendar', path: '/super-admin/settings?tab=calendar' },
              { key: 'alerts', label: 'Scheduled Alerts & Notifications', path: '/super-admin/settings?tab=alerts' },
              { key: 'audit', label: 'Security, Configuration & Audit Logs', path: '/super-admin/settings?tab=audit' },
              { key: 'data_management', label: 'Data Management', path: '/super-admin/settings?tab=data_management' }
            ]
          }
        ]
      }
    ]
  },

  hr_admin: {
    portalId: 'hr_admin',
    portalName: 'HR / Admin Portal',
    badgeLabel: 'Operations & People Care',
    basePath: '/hr-admin',
    defaultRoute: '/hr-admin/dashboard',
    themeColor: 'accent',
    menuGroups: [
      {
        groupLabel: 'WORKFORCE & CORE',
        items: [
          {
            key: 'dashboard',
            label: 'HR Dashboard',
            path: '/hr-admin/dashboard',
            icon: 'dashboard',
            batchId: 'F01'
          },
          {
            key: 'employees',
            label: 'Employee Management',
            path: '/hr-admin/employees',
            icon: 'employees',
            batchId: 'F02',
            submodules: [
              { key: 'directory', label: 'Employee Directory', path: '/hr-admin/employees?tab=directory' },
              { key: 'org', label: 'Organization Master', path: '/hr-admin/employees?tab=org' },
              { key: 'profiles', label: 'Employee Profiles & Career History', path: '/hr-admin/employees?tab=profiles' }
            ]
          },
          {
            key: 'recruitment',
            label: 'Recruitment & Onboarding',
            path: '/hr-admin/recruitment',
            icon: 'recruitment',
            batchId: 'F03',
            submodules: [
              { key: 'vacancies', label: 'Job Requisitions & Vacancies', path: '/hr-admin/recruitment?tab=vacancies' },
              { key: 'candidates', label: 'Candidates & Applications', path: '/hr-admin/recruitment?tab=candidates' },
              { key: 'interviews', label: 'Interviews & Evaluations', path: '/hr-admin/recruitment?tab=interviews' },
              { key: 'offers', label: 'Offers & Joining', path: '/hr-admin/recruitment?tab=offers' },
              { key: 'probation', label: 'Probation & Confirmation', path: '/hr-admin/recruitment?tab=probation' }
            ]
          },
          {
            key: 'attendance',
            label: 'Attendance & Shifts',
            path: '/hr-admin/attendance',
            icon: 'attendance',
            batchId: 'F04',
            submodules: [
              { key: 'register', label: 'Daily Attendance Register', path: '/hr-admin/attendance?tab=register' },
              { key: 'shifts', label: 'Shift Management & Scheduling', path: '/hr-admin/attendance?tab=shifts' },
              { key: 'assignments', label: 'Shift Assignments', path: '/hr-admin/attendance?tab=assignments' },
              { key: 'corrections', label: 'Attendance Corrections Queue', path: '/hr-admin/attendance?tab=corrections' },
              { key: 'wfh', label: 'WFH & Field Duty Operations', path: '/hr-admin/attendance?tab=wfh' },
              { key: 'timesheets', label: 'Overtime & Timesheets', path: '/hr-admin/attendance?tab=timesheets' }
            ]
          },
          {
            key: 'leaves',
            label: 'Leave Management',
            path: '/hr-admin/leaves',
            icon: 'leave',
            batchId: 'F05',
            submodules: [
              { key: 'operations', label: 'Leave Operations & Requests', path: '/hr-admin/leaves?tab=operations' },
              { key: 'queue', label: 'Leave Approval Queue', path: '/hr-admin/leaves?tab=queue' },
              { key: 'balances', label: 'Employee Leave Balances', path: '/hr-admin/leaves?tab=balances' },
              { key: 'calendar', label: 'Company Leave Calendar', path: '/hr-admin/leaves?tab=calendar' },
              { key: 'history', label: 'Leave History & Ledger', path: '/hr-admin/leaves?tab=history' }
            ]
          }
        ]
      },
      {
        groupLabel: 'COMPENSATION & TALENT',
        items: [
          {
            key: 'payroll',
            label: 'Payroll, Compensation & Benefits',
            path: '/hr-admin/payroll',
            icon: 'payroll',
            batchId: 'F06',
            submodules: [
              { key: 'runs', label: 'Payroll Overview & Runs', path: '/hr-admin/payroll?tab=runs' },
              { key: 'structures', label: 'Salary Structures & Compensation', path: '/hr-admin/payroll?tab=structures' },
              { key: 'revisions', label: 'Salary Revision Proposals', path: '/hr-admin/payroll?tab=revisions' },
              { key: 'allowances', label: 'Allowances & Benefits', path: '/hr-admin/payroll?tab=allowances' },
              { key: 'commissions', label: 'Sales Commissions & Bonuses', path: '/hr-admin/payroll?tab=commissions' },
              { key: 'loans', label: 'Employee Loans & Salary Advances', path: '/hr-admin/payroll?tab=loans' },
              { key: 'tax', label: 'Pakistan Salary Tax Management', path: '/hr-admin/payroll?tab=tax' },
              { key: 'payments', label: 'Bank Accounts & Salary Payments', path: '/hr-admin/payroll?tab=payments' }
            ]
          },
          {
            key: 'performance',
            label: 'Tasks & Performance',
            path: '/hr-admin/performance',
            icon: 'performance',
            batchId: 'F07',
            submodules: [
              { key: 'tasks', label: 'Task Management & Deliverables', path: '/hr-admin/performance?tab=tasks' },
              { key: 'kpis', label: 'Goals, Targets & Department KPIs', path: '/hr-admin/performance?tab=kpis' },
              { key: 'reviews', label: 'Employee Performance Reviews', path: '/hr-admin/performance?tab=reviews' },
              { key: 'plans', label: 'Feedback & Development Plans (PIPs)', path: '/hr-admin/performance?tab=plans' }
            ]
          },
          {
            key: 'training',
            label: 'Training & Development',
            path: '/hr-admin/training',
            icon: 'training',
            batchId: 'F08',
            submodules: [
              { key: 'catalog', label: 'Course Catalog & Programs', path: '/hr-admin/training?tab=catalog' },
              { key: 'plans', label: 'Training Plans & Skill Recommendations', path: '/hr-admin/training?tab=plans' },
              { key: 'sessions', label: 'Cohorts & Training Scheduling', path: '/hr-admin/training?tab=sessions' },
              { key: 'progress', label: 'Employee Learning Progress & Grades', path: '/hr-admin/training?tab=progress' },
              { key: 'certificates', label: 'Verified Certificates Register', path: '/hr-admin/training?tab=certificates' }
            ]
          }
        ]
      },
      {
        groupLabel: 'OPERATIONS & SERVICES',
        items: [
          {
            key: 'helpdesk',
            label: 'Help Desk Management',
            path: '/hr-admin/helpdesk',
            icon: 'helpdesk',
            batchId: 'F09',
            submodules: [
              { key: 'hr-queue', label: 'HR Support Queue', path: '/hr-admin/helpdesk?tab=hr-queue' },
              { key: 'my-assigned', label: 'My Assigned Tickets', path: '/hr-admin/helpdesk?tab=my-assigned' },
              { key: 'all-tickets', label: 'Company-Wide Tickets', path: '/hr-admin/helpdesk?tab=all-tickets' },
              { key: 'my-tickets', label: 'My Submitted Tickets', path: '/hr-admin/helpdesk?tab=my-tickets' }
            ]
          },
          {
            key: 'travel',
            label: 'Travel & Transport',
            path: '/hr-admin/travel',
            icon: 'travel',
            batchId: 'F10',
            submodules: [
              { key: 'requests', label: 'Travel Requests & Queue', path: '/hr-admin/travel?tab=requests' },
              { key: 'plans', label: 'Travel Plans & Bookings', path: '/hr-admin/travel?tab=plans' },
              { key: 'expenses', label: 'Advances & Expenses Tracking', path: '/hr-admin/travel?tab=expenses' },
              { key: 'transport', label: 'Pick-and-Drop Fleet Roster', path: '/hr-admin/travel?tab=transport' },
              { key: 'routes', label: 'Vehicles, Drivers & Transport Routes', path: '/hr-admin/travel?tab=routes' }
            ]
          },
          {
            key: 'letters',
            label: 'HR Letters Management',
            path: '/hr-admin/letters',
            icon: 'letters',
            batchId: 'F11',
            submodules: [
              { key: 'templates', label: 'Standard Letter Templates', path: '/hr-admin/letters?tab=templates' },
              { key: 'approvals', label: 'Letter Approval & Issuance', path: '/hr-admin/letters?tab=approvals' },
              { key: 'register', label: 'Issued Letters Register', path: '/hr-admin/letters?tab=register' },
              { key: 'audit', label: 'Letters Audit & History', path: '/hr-admin/letters?tab=audit' }
            ]
          },
          {
            key: 'expenses',
            label: 'Expense Management',
            path: '/hr-admin/expenses',
            icon: 'expense',
            batchId: 'F12',
            submodules: [
              { key: 'overview', label: 'Expense Overview', path: '/hr-admin/expenses?tab=overview' },
              { key: 'queue', label: 'Expense Approval Queue', path: '/hr-admin/expenses?tab=queue' },
              { key: 'reimbursements', label: 'Reimbursements & Payment Tracking', path: '/hr-admin/expenses?tab=reimbursements' },
              { key: 'claims', label: 'Department Claims Register', path: '/hr-admin/expenses?tab=claims' },
              { key: 'categories', label: 'Expense Policies & Categories', path: '/hr-admin/expenses?tab=categories' },
              { key: 'travel_reconciliation', label: 'Travel Expense Reconciliation', path: '/hr-admin/expenses?tab=travel_reconciliation' }
            ]
          }
        ]
      },
      {
        groupLabel: 'ORGANIZATION & SYSTEM',
        items: [
          {
            key: 'reports',
            label: 'Reports & Analytics',
            path: '/hr-admin/reports',
            icon: 'reports',
            batchId: 'F14',
            submodules: [
              { key: 'fam_org', label: 'Workforce & Organization Reports', path: '/hr-admin/reports?family=fam_org' },
              { key: 'fam_rec', label: 'Recruitment & Onboarding Reports', path: '/hr-admin/reports?family=fam_rec' },
              { key: 'fam_att', label: 'Attendance, Shifts & Work Hours Reports', path: '/hr-admin/reports?family=fam_att' },
              { key: 'fam_lev', label: 'Leave & Approval Governance Reports', path: '/hr-admin/reports?family=fam_lev' },
              { key: 'fam_pay', label: 'Payroll, Employee Pay & Banking Reports', path: '/hr-admin/reports?family=fam_pay' },
              { key: 'fam_tax', label: 'Tax & Statutory Statements', path: '/hr-admin/reports?family=fam_tax' },
              { key: 'fam_ben', label: 'Commissions, Loans & Benefits Reports', path: '/hr-admin/reports?family=fam_ben' },
              { key: 'fam_prf', label: 'Tasks, Performance & Training Reports', path: '/hr-admin/reports?family=fam_prf' },
              { key: 'fam_hld', label: 'Help Desk Service & SLA Reports', path: '/hr-admin/reports?family=fam_hld' },
              { key: 'fam_trv', label: 'Travel, Pick-and-Drop & Expense Reports', path: '/hr-admin/reports?family=fam_trv' }
            ]
          },
          {
            key: 'settings',
            label: 'HR Administration & Settings',
            path: '/hr-admin/settings',
            icon: 'settings',
            batchId: 'F13',
            submodules: [
              { key: 'profile', label: 'Company Profile & General Settings', path: '/hr-admin/settings?tab=profile' },
              { key: 'policies', label: 'Company Policies Overview', path: '/hr-admin/settings?tab=policies' },
              { key: 'matrix', label: 'Approval Authority Matrix', path: '/hr-admin/settings?tab=matrix' },
              { key: 'attendance_leaves', label: 'Attendance & Leave Policies', path: '/hr-admin/settings?tab=attendance_leaves' },
              { key: 'calendar', label: 'Holidays & Working Calendar', path: '/hr-admin/settings?tab=calendar' },
              { key: 'alerts', label: 'Scheduled Alerts Configuration', path: '/hr-admin/settings?tab=alerts' },
              { key: 'audit', label: 'Security & Audit Logs', path: '/hr-admin/settings?tab=audit' }
            ]
          }
        ]
      }
    ]
  },

  manager: {
    portalId: 'manager',
    portalName: 'Manager Portal',
    badgeLabel: 'Assigned Team Supervision',
    basePath: '/manager',
    defaultRoute: '/manager/dashboard',
    themeColor: 'accent',
    menuGroups: [
      {
        groupLabel: 'TEAM SUPERVISION',
        items: [
          {
            key: 'dashboard',
            label: 'My Dashboard',
            path: '/manager/dashboard',
            icon: 'dashboard',
            batchId: 'F01'
          },
          {
            key: 'team',
            label: 'Employee Management',
            path: '/manager/team',
            icon: 'employees',
            batchId: 'F02',
            submodules: [
              { key: 'team', label: 'My Team Roster', path: '/manager/team?tab=team' },
              { key: 'profile', label: 'My Profile', path: '/manager/profile' }
            ]
          },
          {
            key: 'recruitment',
            label: 'Recruitment & Hiring',
            path: '/manager/recruitment',
            icon: 'recruitment',
            batchId: 'F03',
            submodules: [
              { key: 'requisitions', label: 'Team Job Requisitions', path: '/manager/recruitment?tab=requisitions' },
              { key: 'candidates', label: 'Assigned Candidates', path: '/manager/recruitment?tab=candidates' },
              { key: 'interviews', label: 'Interview Evaluations', path: '/manager/recruitment?tab=interviews' },
              { key: 'probation', label: 'Team Probation Reviews', path: '/manager/recruitment?tab=probation' }
            ]
          },
          {
            key: 'attendance',
            label: 'Attendance & Shifts',
            path: '/manager/attendance',
            icon: 'attendance',
            batchId: 'F04',
            submodules: [
              { key: 'teamRegister', label: 'Team Attendance Register', path: '/manager/attendance?tab=teamRegister' },
              { key: 'teamSchedules', label: 'Team Shift Schedules', path: '/manager/attendance?tab=teamSchedules' },
              { key: 'teamWfh', label: 'Team WFH & Field Duty', path: '/manager/attendance?tab=teamWfh' },
              { key: 'corrections', label: 'Team Attendance Corrections', path: '/manager/attendance?tab=corrections' },
              { key: 'timesheets', label: 'Team Timesheets & Overtime', path: '/manager/attendance?tab=timesheets' },
              { key: 'myAttendance', label: 'My Personal Attendance', path: '/manager/attendance?tab=myAttendance' }
            ]
          },
          {
            key: 'leaves',
            label: 'Leave Management',
            path: '/manager/leaves',
            icon: 'leave',
            batchId: 'F05',
            submodules: [
              { key: 'team_queue', label: 'Team Leave Approvals', path: '/manager/leaves?tab=team_queue' },
              { key: 'team_balances', label: 'Team Leave Balances', path: '/manager/leaves?tab=team_balances' },
              { key: 'team_calendar', label: 'Team Leave Calendar', path: '/manager/leaves?tab=team_calendar' },
              { key: 'my_leaves', label: 'My Personal Leaves', path: '/manager/leaves?tab=my_leaves' }
            ]
          },
          {
            key: 'tasks',
            label: 'Tasks & Performance',
            path: '/manager/tasks',
            icon: 'tasks',
            batchId: 'F07',
            submodules: [
              { key: 'tasks', label: 'Team Tasks & Deliverables', path: '/manager/tasks?tab=tasks' },
              { key: 'reviews', label: 'Team Appraisals & Reviews', path: '/manager/tasks?tab=reviews' },
              { key: 'kpis', label: 'Department Goals & KPIs', path: '/manager/tasks?tab=kpis' },
              { key: 'plans', label: 'Development Plans & PIPs', path: '/manager/tasks?tab=plans' }
            ]
          },
          {
            key: 'training',
            label: 'Training & Development',
            path: '/manager/training',
            icon: 'training',
            batchId: 'F08',
            submodules: [
              { key: 'team-progress', label: 'Team Learning Progress', path: '/manager/training?tab=team-progress' },
              { key: 'team-plans', label: 'Team Training Recommendations', path: '/manager/training?tab=team-plans' },
              { key: 'catalog', label: 'Course Catalog', path: '/manager/training?tab=catalog' },
              { key: 'sessions', label: 'Cohort Sessions', path: '/manager/training?tab=sessions' },
              { key: 'certificates', label: 'Verified Certificates', path: '/manager/training?tab=certificates' }
            ]
          }
        ]
      },
      {
        groupLabel: 'OPERATIONS & SELF-SERVICE',
        items: [
          {
            key: 'my_payroll',
            label: 'Payroll & Benefits',
            path: '/manager/my-payroll',
            icon: 'payroll',
            batchId: 'F06',
            submodules: [
              { key: 'payslips', label: 'My Payslips', path: '/manager/my-payroll?tab=payslips' },
              { key: 'structures', label: 'My Salary Structure', path: '/manager/my-payroll?tab=structures' },
              { key: 'loans', label: 'My Loans & Advances', path: '/manager/my-payroll?tab=loans' },
              { key: 'tax', label: 'My Tax Deductions', path: '/manager/my-payroll?tab=tax' },
              { key: 'commissions', label: 'My Commissions & Bonuses', path: '/manager/my-payroll?tab=commissions' }
            ]
          },
          {
            key: 'helpdesk',
            label: 'Help Desk',
            path: '/manager/helpdesk',
            icon: 'helpdesk',
            batchId: 'F09',
            submodules: [
              { key: 'my-tickets', label: 'My Submitted Tickets', path: '/manager/helpdesk?tab=my-tickets' },
              { key: 'dept-tickets', label: 'Department Support Queue', path: '/manager/helpdesk?tab=dept-tickets' }
            ]
          },
          {
            key: 'travel',
            label: 'Travel & Transport',
            path: '/manager/travel',
            icon: 'travel',
            batchId: 'F10',
            submodules: [
              { key: 'team-requests', label: 'Team Travel Requests', path: '/manager/travel?tab=team-requests' },
              { key: 'team-plans', label: 'Team Travel Plans', path: '/manager/travel?tab=team-plans' },
              { key: 'my-requests', label: 'My Travel Requests', path: '/manager/travel?tab=my-requests' },
              { key: 'my-transport', label: 'My Transport Pass', path: '/manager/travel?tab=my-transport' }
            ]
          },
          {
            key: 'letters',
            label: 'HR Letters',
            path: '/manager/letters',
            icon: 'letters',
            batchId: 'F11',
            submodules: [
              { key: 'team-letters', label: 'Permitted Team Requests', path: '/manager/letters?tab=team-letters' },
              { key: 'my-letters', label: 'My Issued Letters', path: '/manager/letters?tab=my-letters' }
            ]
          },
          {
            key: 'expenses',
            label: 'Expense Management',
            path: '/manager/expenses',
            icon: 'expense',
            batchId: 'F12',
            submodules: [
              { key: 'team_queue', label: 'Team Claims Approvals', path: '/manager/expenses?tab=team_queue' },
              { key: 'my_claims', label: 'My Expense Claims', path: '/manager/expenses?tab=my_claims' },
              { key: 'overview', label: 'Expense Summary Overview', path: '/manager/expenses?tab=overview' },
              { key: 'policies', label: 'Expense Policies Overview', path: '/manager/expenses?tab=policies' }
            ]
          },
          {
            key: 'reports',
            label: 'Reports & Analytics',
            path: '/manager/reports',
            icon: 'reports',
            batchId: 'F14',
            submodules: [
              { key: 'fam_att', label: 'Team Attendance Reports', path: '/manager/reports?family=fam_att' },
              { key: 'fam_lev', label: 'Team Leave Summary Reports', path: '/manager/reports?family=fam_lev' },
              { key: 'fam_prf', label: 'Team Tasks & Performance Reports', path: '/manager/reports?family=fam_prf' },
              { key: 'fam_trv', label: 'Team Travel & Transport Reports', path: '/manager/reports?family=fam_trv' }
            ]
          }
        ]
      }
    ]
  },

  team_lead: {
    portalId: 'team_lead',
    portalName: 'Team Lead Portal',
    badgeLabel: 'Assigned Team Scope',
    basePath: '/team-lead',
    defaultRoute: '/team-lead/dashboard',
    themeColor: 'emerald',
    menuGroups: [
      {
        groupLabel: 'TEAM LEADERSHIP',
        items: [
          {
            key: 'dashboard',
            label: 'My Dashboard',
            path: '/team-lead/dashboard',
            icon: 'dashboard',
            batchId: 'F01'
          },
          {
            key: 'team',
            label: 'My Team',
            path: '/team-lead/team',
            icon: 'employees',
            batchId: 'F02',
            submodules: [
              { key: 'team', label: 'My Team Roster', path: '/team-lead/team?tab=team' },
              { key: 'profiles', label: 'Team Member Profiles', path: '/team-lead/team?tab=profiles' },
              { key: 'profile', label: 'My Profile', path: '/team-lead/profile' }
            ]
          },
          {
            key: 'attendance',
            label: 'Attendance & Shifts',
            path: '/team-lead/attendance',
            icon: 'attendance',
            batchId: 'F04',
            submodules: [
              { key: 'teamRegister', label: 'Team Attendance Register', path: '/team-lead/attendance?tab=teamRegister' },
              { key: 'teamSchedules', label: 'Team Shift Schedules', path: '/team-lead/attendance?tab=teamSchedules' },
              { key: 'teamWfh', label: 'Team WFH & Field Duty', path: '/team-lead/attendance?tab=teamWfh' },
              { key: 'corrections', label: 'Team Attendance Corrections', path: '/team-lead/attendance?tab=corrections' },
              { key: 'timesheets', label: 'Team Timesheets & Overtime', path: '/team-lead/attendance?tab=timesheets' },
              { key: 'myAttendance', label: 'My Personal Attendance', path: '/team-lead/attendance?tab=myAttendance' }
            ]
          },
          {
            key: 'leaves',
            label: 'Leave Management',
            path: '/team-lead/leaves',
            icon: 'leave',
            batchId: 'F05',
            submodules: [
              { key: 'team_queue', label: 'Team Leave Approvals', path: '/team-lead/leaves?tab=team_queue' },
              { key: 'team_balances', label: 'Team Leave Balances', path: '/team-lead/leaves?tab=team_balances' },
              { key: 'team_calendar', label: 'Team Leave Calendar', path: '/team-lead/leaves?tab=team_calendar' },
              { key: 'my_leaves', label: 'My Personal Leaves', path: '/team-lead/leaves?tab=my_leaves' }
            ]
          },
          {
            key: 'tasks',
            label: 'Tasks & Deliverables',
            path: '/team-lead/tasks',
            icon: 'tasks',
            batchId: 'F07',
            submodules: [
              { key: 'tasks', label: 'Team Tasks & Deliverables', path: '/team-lead/tasks?tab=tasks' }
            ]
          },
          {
            key: 'performance',
            label: 'Team Performance',
            path: '/team-lead/performance',
            icon: 'performance',
            batchId: 'F07',
            submodules: [
              { key: 'reviews', label: 'Team Appraisals & KPIs', path: '/team-lead/performance?tab=reviews' },
              { key: 'plans', label: 'Mentorship & Growth Plans', path: '/team-lead/performance?tab=plans' }
            ]
          },
          {
            key: 'reports',
            label: 'Team Reports',
            path: '/team-lead/reports',
            icon: 'reports',
            batchId: 'F14',
            submodules: [
              { key: 'fam_att', label: 'Team Attendance Statement', path: '/team-lead/reports?family=fam_att' },
              { key: 'fam_lev', label: 'Team Leave Utilization', path: '/team-lead/reports?family=fam_lev' },
              { key: 'fam_prf', label: 'Team Deliverables & Performance', path: '/team-lead/reports?family=fam_prf' }
            ]
          }
        ]
      }
    ]
  },

  employee: {
    portalId: 'employee',
    portalName: 'Employee Portal',
    badgeLabel: 'Personal Self-Service',
    basePath: '/employee',
    defaultRoute: '/employee/dashboard',
    themeColor: 'info',
    menuGroups: [
      {
        groupLabel: 'MY SELF-SERVICE',
        items: [
          {
            key: 'dashboard',
            label: 'My Dashboard',
            path: '/employee/dashboard',
            icon: 'dashboard',
            batchId: 'F01'
          },
          {
            key: 'profile',
            label: 'My Profile',
            path: '/employee/profile',
            icon: 'user',
            batchId: 'F02'
          },
          {
            key: 'onboarding',
            label: 'Onboarding & Probation',
            path: '/employee/onboarding',
            icon: 'recruitment',
            batchId: 'F03',
            submodules: [
              { key: 'checklist', label: 'Onboarding Checklist', path: '/employee/onboarding?tab=checklist' },
              { key: 'probation', label: 'Probation Milestones', path: '/employee/onboarding?tab=probation' }
            ]
          },
          {
            key: 'attendance',
            label: 'My Attendance & Shifts',
            path: '/employee/attendance',
            icon: 'attendance',
            batchId: 'F04',
            submodules: [
              { key: 'punch', label: 'Web Punch & Status', path: '/employee/attendance?tab=punch' },
              { key: 'history', label: 'Shift Schedule & History', path: '/employee/attendance?tab=history' },
              { key: 'timesheets', label: 'Timesheets & Overtime', path: '/employee/attendance?tab=timesheets' },
              { key: 'requests', label: 'Correction & WFH Requests', path: '/employee/attendance?tab=requests' }
            ]
          },
          {
            key: 'leaves',
            label: 'My Leaves',
            path: '/employee/leaves',
            icon: 'leave',
            batchId: 'F05',
            submodules: [
              { key: 'overview', label: 'Leave Requests Overview', path: '/employee/leaves?tab=overview' },
              { key: 'history', label: 'My Leave History', path: '/employee/leaves?tab=history' },
              { key: 'balances', label: 'Entitlements & Balances', path: '/employee/leaves?tab=balances' },
              { key: 'calendar', label: 'Company Leave Calendar', path: '/employee/leaves?tab=calendar' },
              { key: 'policy', label: 'Leave Policy Rules', path: '/employee/leaves?tab=policy' }
            ]
          },
          {
            key: 'payroll',
            label: 'My Payslips & Benefits',
            path: '/employee/payroll',
            icon: 'payroll',
            batchId: 'F06',
            submodules: [
              { key: 'payslips', label: 'Monthly Payslips Register', path: '/employee/payroll?tab=payslips' },
              { key: 'tax', label: 'Section 149 Tax Certificates', path: '/employee/payroll?tab=tax' },
              { key: 'loans', label: 'Loans & Salary Advances', path: '/employee/payroll?tab=loans' },
              { key: 'commissions', label: 'Commissions & Bonuses', path: '/employee/payroll?tab=commissions' }
            ]
          },
          {
            key: 'tasks',
            label: 'My Tasks & Performance',
            path: '/employee/tasks',
            icon: 'tasks',
            batchId: 'F07',
            submodules: [
              { key: 'tasks', label: 'Assigned Tasks & Deliverables', path: '/employee/tasks?tab=tasks' },
              { key: 'reviews', label: 'Performance Reviews & Goals', path: '/employee/tasks?tab=reviews' },
              { key: 'kpis', label: 'Department Goals & KPIs', path: '/employee/tasks?tab=kpis' },
              { key: 'plans', label: 'Development Plans & PIPs', path: '/employee/tasks?tab=plans' }
            ]
          },
          {
            key: 'training',
            label: 'My Training',
            path: '/employee/training',
            icon: 'training',
            batchId: 'F08',
            submodules: [
              { key: 'my-courses', label: 'Enrolled Courses & Progress', path: '/employee/training?tab=my-courses' },
              { key: 'my-sessions', label: 'Scheduled Sessions', path: '/employee/training?tab=my-sessions' },
              { key: 'my-certificates', label: 'Verified Certificates', path: '/employee/training?tab=my-certificates' },
              { key: 'browse-catalog', label: 'Browse Course Catalog', path: '/employee/training?tab=browse-catalog' }
            ]
          },
          {
            key: 'helpdesk',
            label: 'Help Desk',
            path: '/employee/helpdesk',
            icon: 'helpdesk',
            batchId: 'F09',
            submodules: [
              { key: 'my-tickets', label: 'My Support Tickets', path: '/employee/helpdesk?tab=my-tickets' }
            ]
          },
          {
            key: 'travel',
            label: 'My Travel & Pick-and-Drop',
            path: '/employee/travel',
            icon: 'travel',
            batchId: 'F10',
            submodules: [
              { key: 'my-trips', label: 'My Travel Requests', path: '/employee/travel?tab=my-trips' },
              { key: 'itineraries', label: 'Travel Itineraries & Bookings', path: '/employee/travel?tab=itineraries' },
              { key: 'expenses', label: 'Travel Expenses & Advances', path: '/employee/travel?tab=expenses' },
              { key: 'transport', label: 'Pick-and-Drop Facility Pass', path: '/employee/travel?tab=transport' }
            ]
          },
          {
            key: 'letters',
            label: 'My HR Letters',
            path: '/employee/letters',
            icon: 'letters',
            batchId: 'F11',
            submodules: [
              { key: 'my-letters', label: 'My Issued Letters Register', path: '/employee/letters?tab=my-letters' }
            ]
          },
          {
            key: 'expenses',
            label: 'My Expense Claims',
            path: '/employee/expenses',
            icon: 'expense',
            batchId: 'F12',
            submodules: [
              { key: 'my_claims', label: 'My Submitted Claims', path: '/employee/expenses?tab=my_claims' },
              { key: 'policies', label: 'Expense Reimbursement Policy', path: '/employee/expenses?tab=policies' }
            ]
          },
          {
            key: 'reports',
            label: 'My Reports & Statements',
            path: '/employee/reports',
            icon: 'reports',
            batchId: 'F14',
            submodules: [
              { key: 'fam_att', label: 'My Attendance Statement', path: '/employee/reports?family=fam_att' },
              { key: 'fam_lev', label: 'My Leave Ledger', path: '/employee/reports?family=fam_lev' },
              { key: 'fam_pay', label: 'My Payslip Register', path: '/employee/reports?family=fam_pay' },
              { key: 'fam_tax', label: 'My Tax Withholding Certificate', path: '/employee/reports?family=fam_tax' }
            ]
          },
          {
            key: 'notifications',
            label: 'My Notifications',
            path: '/employee/notifications',
            icon: 'alerts',
            batchId: 'F13'
          }
        ]
      }
    ]
  }
}
