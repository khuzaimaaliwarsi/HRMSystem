/**
 * iSysware HRMS — Batch F09: Help Desk Management Mock Data
 * Canonical data structures for:
 * - Support Teams & Resolver Personnel
 * - Ticket Categories, Subcategories & Routing Configurations
 * - SLA Policy Configurations (Priority, Response Target, Resolution Target)
 * - Initial Tickets across HR, IT, Payroll, and Administration
 */

export const SUPPORT_TEAMS = [
  {
    teamId: 'TEAM-IT',
    teamName: 'IT Operations & Infrastructure',
    leadName: 'Asim Raza',
    leadEmployeeId: 'EMP-007',
    email: 'it-support@isysware.internal',
    coverage: '24/7 On-Call & Business Hours 09:00 - 18:00',
    description: 'Hardware provisioning, software licenses, network infrastructure, and cybersecurity access.'
  },
  {
    teamId: 'TEAM-HR',
    teamName: 'HR Operations & People Care',
    leadName: 'Ayesha Khan',
    leadEmployeeId: 'EMP-002',
    email: 'hr-helpdesk@isysware.internal',
    coverage: 'Business Hours 09:00 - 18:00',
    description: 'Workplace inquiries, employee onboarding logistics, policy guidance, and confidential grievances.'
  },
  {
    teamId: 'TEAM-PAY',
    teamName: 'Payroll & Benefits Support',
    leadName: 'Fatima Noor',
    leadEmployeeId: 'EMP-009',
    email: 'payroll-desk@isysware.internal',
    coverage: 'Business Hours 09:00 - 18:00',
    description: 'Salary calculations, FBR tax deductions, bank detail validations, and loan schedule assistance.'
  },
  {
    teamId: 'TEAM-ADM',
    teamName: 'Facilities & Workplace Administration',
    leadName: 'Kamran Siddiqui',
    leadEmployeeId: 'EMP-010',
    email: 'admin-facilities@isysware.internal',
    coverage: 'Business Hours 08:30 - 17:30',
    description: 'Office ergonomics, security RFID cards, stationery, conference rooms, and workplace maintenance.'
  }
]

export const TICKET_CATEGORIES = [
  {
    categoryId: 'CAT-IT',
    categoryName: 'Information Technology (IT)',
    icon: 'fa-laptop-code',
    defaultTeamId: 'TEAM-IT',
    isConfidential: false,
    subcategories: [
      'Laptop Hardware Malfunction',
      'Software Installation & License Request',
      'Internet / VPN & Network Access',
      'System Credentials & Email Login',
      'Peripheral / Monitor Replacement'
    ]
  },
  {
    categoryId: 'CAT-HR',
    categoryName: 'Human Resources (HR)',
    icon: 'fa-users',
    defaultTeamId: 'TEAM-HR',
    isConfidential: true, // Sensitive HR tickets
    subcategories: [
      'HR Policy Clarification',
      'Attendance Regularization Support',
      'Leave Balance Discrepancy',
      'Workplace Health & Ergonomics',
      'Confidential Workplace Grievance'
    ]
  },
  {
    categoryId: 'CAT-PAY',
    categoryName: 'Payroll & Benefits',
    icon: 'fa-money-check-dollar',
    defaultTeamId: 'TEAM-PAY',
    isConfidential: true, // Sensitive payroll tickets
    subcategories: [
      'Salary Slip & Withholding Tax Clarification',
      'Bank Account / IBAN Update Assistance',
      'Loan Deductions & Schedule Inquiry',
      'Reimbursement Status Follow-up',
      'Overtime Calculation Assistance'
    ]
  },
  {
    categoryId: 'CAT-ADM',
    categoryName: 'Facilities & Workplace Admin',
    icon: 'fa-building',
    defaultTeamId: 'TEAM-ADM',
    isConfidential: false,
    subcategories: [
      'RFID Access Badge & Security Card',
      'Desk Chair & Seating Adjustment',
      'Office Supplies & Stationery',
      'Air Conditioning & Electrical Maintenance',
      'Visitor / Parking Clearance'
    ]
  }
]

export const SLA_TARGETS = {
  Critical: {
    firstResponseHours: 0.5, // 30 minutes
    resolutionHours: 4,      // 4 hours
    businessHoursOnly: false,
    label: 'Critical — Immediate Outage / Blocker'
  },
  High: {
    firstResponseHours: 2,   // 2 hours
    resolutionHours: 8,      // 1 business day (8 hrs)
    businessHoursOnly: true,
    label: 'High — Significant Impact'
  },
  Medium: {
    firstResponseHours: 6,   // 6 hours
    resolutionHours: 24,     // 3 business days (24 hrs)
    businessHoursOnly: true,
    label: 'Medium — Moderate Operational Issue'
  },
  Low: {
    firstResponseHours: 12,  // 12 hours
    resolutionHours: 48,     // 6 business days (48 hrs)
    businessHoursOnly: true,
    label: 'Low — General Inquiry / Minor Request'
  }
}

export const INITIAL_TICKETS = [
  {
    ticketId: 'HD-2026-001',
    subject: 'Development Workstation Freezing during Docker builds',
    category: 'Information Technology (IT)',
    categoryId: 'CAT-IT',
    subcategory: 'Laptop Hardware Malfunction',
    priority: 'High',
    status: 'In Progress',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    employeeDepartment: 'Engineering',
    employeeEmail: 'zeeshan.ali@isysware.internal',
    assignedTeamId: 'TEAM-IT',
    assignedTeamName: 'IT Operations & Infrastructure',
    assignedResolverId: 'EMP-007',
    assignedResolverName: 'Asim Raza',
    createdDate: '2026-10-25T09:30:00Z',
    firstResponseDue: '2026-10-25T11:30:00Z',
    resolutionDue: '2026-10-26T09:30:00Z',
    firstResponseAt: '2026-10-25T10:15:00Z',
    resolvedAt: null,
    closedAt: null,
    isEscalated: false,
    escalationReason: null,
    relatedModule: 'F04 Attendance / Dev Environment',
    attachmentRef: 'crash_dump_kernel.log (Mock File)',
    description: 'My MacBook Pro workstation throttles CPU and freezes completely whenever running the local microservice docker cluster.',
    conversations: [
      {
        id: 'CONV-101',
        senderId: 'EMP-004',
        senderName: 'Zeeshan Ali',
        senderRole: 'Employee',
        message: 'The issue started yesterday after the latest container runtime update. The fan spins at maximum speed and OS crashes.',
        createdAt: '2026-10-25T09:30:00Z',
        isInternalNote: false
      },
      {
        id: 'CONV-102',
        senderId: 'EMP-007',
        senderName: 'Asim Raza',
        senderRole: 'IT Support Engineer',
        message: 'Internal Note: Diagnosed thermal paste degradation on core #3. Needs hardware fan cleaning and memory diagnostics test.',
        createdAt: '2026-10-25T10:10:00Z',
        isInternalNote: true // CRITICAL: Shielded from employee
      },
      {
        id: 'CONV-103',
        senderId: 'EMP-007',
        senderName: 'Asim Raza',
        senderRole: 'IT Support Engineer',
        message: 'Hello Zeeshan, we have checked the crash logs. Please bring your workstation to IT Lab 3 at 2:00 PM for hardware inspection and temporary loaner issuance.',
        createdAt: '2026-10-25T10:15:00Z',
        isInternalNote: false
      }
    ],
    timeline: [
      { action: 'Ticket Created', by: 'Zeeshan Ali', at: '2026-10-25T09:30:00Z' },
      { action: 'Auto-Routed to IT Operations', by: 'System', at: '2026-10-25T09:30:05Z' },
      { action: 'Assigned to Asim Raza', by: 'Asim Raza', at: '2026-10-25T10:05:00Z' },
      { action: 'Status changed to In Progress', by: 'Asim Raza', at: '2026-10-25T10:15:00Z' }
    ]
  },
  {
    ticketId: 'HD-2026-002',
    subject: 'Payroll Tax Withholding query on September Performance Bonus',
    category: 'Payroll & Benefits',
    categoryId: 'CAT-PAY',
    subcategory: 'Salary Slip & Withholding Tax Clarification',
    priority: 'Medium',
    status: 'Resolved',
    employeeId: 'EMP-005',
    employeeName: 'Sana Malik',
    employeeDepartment: 'Finance',
    employeeEmail: 'sana.malik@isysware.internal',
    assignedTeamId: 'TEAM-PAY',
    assignedTeamName: 'Payroll & Benefits Support',
    assignedResolverId: 'EMP-009',
    assignedResolverName: 'Fatima Noor',
    createdDate: '2026-10-22T11:00:00Z',
    firstResponseDue: '2026-10-22T17:00:00Z',
    resolutionDue: '2026-10-25T11:00:00Z',
    firstResponseAt: '2026-10-22T14:30:00Z',
    resolvedAt: '2026-10-24T16:00:00Z',
    closedAt: '2026-10-25T10:00:00Z',
    isEscalated: false,
    resolutionSummary: 'Explained FBR Section 149 progressive slab recalculation due to lump-sum bonus payment. Sent revised tax breakdown computation sheet.',
    satisfactionRating: 5,
    satisfactionFeedback: 'Very clear explanation and prompt breakdown by the payroll officer.',
    relatedModule: 'F06 Payroll',
    attachmentRef: 'tax_computation_sep2026.pdf (Mock Document)',
    description: 'My September 2026 payslip shows a higher tax withholding than standard slab. Please clarify whether bonus pushed the annual slab to tier 3.',
    conversations: [
      {
        id: 'CONV-201',
        senderId: 'EMP-005',
        senderName: 'Sana Malik',
        senderRole: 'Employee',
        message: 'Could you please provide the annualized taxable income computation used for the September salary credit?',
        createdAt: '2026-10-22T11:00:00Z',
        isInternalNote: false
      },
      {
        id: 'CONV-202',
        senderId: 'EMP-009',
        senderName: 'Fatima Noor',
        senderRole: 'Payroll Specialist',
        message: 'Dear Sana, because the performance bonus increased your annualized projected income beyond PKR 1.2M, FBR Section 149 requires the 15% rate on the surplus. I have attached the detailed tax worksheet for your records.',
        createdAt: '2026-10-22T14:30:00Z',
        isInternalNote: false
      }
    ],
    timeline: [
      { action: 'Ticket Created', by: 'Sana Malik', at: '2026-10-22T11:00:00Z' },
      { action: 'Assigned to Fatima Noor', by: 'System', at: '2026-10-22T11:05:00Z' },
      { action: 'Resolved by Fatima Noor', by: 'Fatima Noor', at: '2026-10-24T16:00:00Z' },
      { action: 'Closed with 5-Star Feedback', by: 'Sana Malik', at: '2026-10-25T10:00:00Z' }
    ]
  },
  {
    ticketId: 'HD-2026-003',
    subject: 'Confidential: Managerial Communication & Workload Grievance',
    category: 'Human Resources (HR)',
    categoryId: 'CAT-HR',
    subcategory: 'Confidential Workplace Grievance',
    priority: 'High',
    status: 'Pending Employee',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    employeeDepartment: 'Engineering',
    employeeEmail: 'zeeshan.ali@isysware.internal',
    assignedTeamId: 'TEAM-HR',
    assignedTeamName: 'HR Operations & People Care',
    assignedResolverId: 'EMP-002',
    assignedResolverName: 'Ayesha Khan',
    createdDate: '2026-10-24T14:00:00Z',
    firstResponseDue: '2026-10-24T16:00:00Z',
    resolutionDue: '2026-10-27T14:00:00Z',
    firstResponseAt: '2026-10-24T15:10:00Z',
    resolvedAt: null,
    closedAt: null,
    isEscalated: false,
    relatedModule: null,
    attachmentRef: null,
    description: 'Requesting a confidential 1-on-1 counseling session with HR regarding recent sprint project reallocations and after-hours escalation pressures.',
    conversations: [
      {
        id: 'CONV-301',
        senderId: 'EMP-004',
        senderName: 'Zeeshan Ali',
        senderRole: 'Employee',
        message: 'I would like this discussion to remain private between HR and myself as per the Employee Handbook privacy policy.',
        createdAt: '2026-10-24T14:00:00Z',
        isInternalNote: false
      },
      {
        id: 'CONV-302',
        senderId: 'EMP-002',
        senderName: 'Ayesha Khan',
        senderRole: 'HR Lead',
        message: 'Internal Note: High-sensitivity case. Keep strictly shielded from Engineering Manager portal. Scheduled private room 4B for consultation.',
        createdAt: '2026-10-24T15:05:00Z',
        isInternalNote: true
      },
      {
        id: 'CONV-303',
        senderId: 'EMP-002',
        senderName: 'Ayesha Khan',
        senderRole: 'HR Lead',
        message: 'Hello Zeeshan, your privacy is completely protected under iSysware code of ethics. Are you available for a confidential Google Meet / in-person discussion tomorrow at 11:30 AM?',
        createdAt: '2026-10-24T15:10:00Z',
        isInternalNote: false
      }
    ],
    timeline: [
      { action: 'Ticket Created', by: 'Zeeshan Ali', at: '2026-10-24T14:00:00Z' },
      { action: 'Assigned to Ayesha Khan', by: 'System', at: '2026-10-24T14:05:00Z' },
      { action: 'Status set to Pending Employee', by: 'Ayesha Khan', at: '2026-10-24T15:10:00Z' }
    ]
  },
  {
    ticketId: 'HD-2026-004',
    subject: 'Replacement of Faulty RFID Door Access Card',
    category: 'Facilities & Workplace Admin',
    categoryId: 'CAT-ADM',
    subcategory: 'RFID Access Badge & Security Card',
    priority: 'Low',
    status: 'Open',
    employeeId: 'EMP-003',
    employeeName: 'Bilal Ahmed',
    employeeDepartment: 'Engineering',
    employeeEmail: 'bilal.ahmed@isysware.internal',
    assignedTeamId: 'TEAM-ADM',
    assignedTeamName: 'Facilities & Workplace Administration',
    assignedResolverId: null, // In Unassigned queue
    assignedResolverName: null,
    createdDate: '2026-10-26T08:45:00Z',
    firstResponseDue: '2026-10-26T20:45:00Z',
    resolutionDue: '2026-10-28T08:45:00Z',
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    isEscalated: false,
    relatedModule: null,
    attachmentRef: null,
    description: 'My access card fails to beep at the 3rd Floor Engineering biometric turnstile. Security guard had to open manually today.',
    conversations: [
      {
        id: 'CONV-401',
        senderId: 'EMP-003',
        senderName: 'Bilal Ahmed',
        senderRole: 'Manager',
        message: 'Please re-issue or re-encode my RFID proximity card at the security desk.',
        createdAt: '2026-10-26T08:45:00Z',
        isInternalNote: false
      }
    ],
    timeline: [
      { action: 'Ticket Created', by: 'Bilal Ahmed', at: '2026-10-26T08:45:00Z' },
      { action: 'Routed to Facilities Unassigned Queue', by: 'System', at: '2026-10-26T08:45:05Z' }
    ]
  },
  {
    ticketId: 'HD-2026-005',
    subject: 'CRITICAL: VPN Gateway Connectivity Failure for Lahore Branch',
    category: 'Information Technology (IT)',
    categoryId: 'CAT-IT',
    subcategory: 'Internet / VPN & Network Access',
    priority: 'Critical',
    status: 'In Progress',
    employeeId: 'EMP-001',
    employeeName: 'Tariq Mehmood',
    employeeDepartment: 'Executive Board',
    employeeEmail: 'tariq.mehmood@isysware.internal',
    assignedTeamId: 'TEAM-IT',
    assignedTeamName: 'IT Operations & Infrastructure',
    assignedResolverId: 'EMP-007',
    assignedResolverName: 'Asim Raza',
    createdDate: '2026-10-27T03:00:00Z',
    firstResponseDue: '2026-10-27T03:30:00Z',
    resolutionDue: '2026-10-27T07:00:00Z',
    firstResponseAt: '2026-10-27T03:12:00Z',
    resolvedAt: null,
    closedAt: null,
    isEscalated: true,
    escalationReason: 'Executive Escalation: 25+ remote engineers unable to authenticate against production Git repositories.',
    relatedModule: null,
    attachmentRef: 'openvpn_auth_timeout.png (Mock Screenshot)',
    description: 'Remote SSL-VPN gateway is rejecting LDAP credentials for entire engineering cohort with error 504 Gateway Timeout.',
    conversations: [
      {
        id: 'CONV-501',
        senderId: 'EMP-001',
        senderName: 'Tariq Mehmood',
        senderRole: 'Super Admin',
        message: 'This is blocking critical client deliverables for the Q4 sprint. Urgent resolution required.',
        createdAt: '2026-10-27T03:00:00Z',
        isInternalNote: false
      },
      {
        id: 'CONV-502',
        senderId: 'EMP-007',
        senderName: 'Asim Raza',
        senderRole: 'IT Support Engineer',
        message: 'Internal Note: RADIUS server synchronization daemon restarted. Testing failover IP address 192.168.10.254.',
        createdAt: '2026-10-27T03:10:00Z',
        isInternalNote: true
      },
      {
        id: 'CONV-503',
        senderId: 'EMP-007',
        senderName: 'Asim Raza',
        senderRole: 'IT Support Engineer',
        message: 'We have initiated the secondary LDAP sync daemon. Standby for gateway reboot in 5 minutes.',
        createdAt: '2026-10-27T03:12:00Z',
        isInternalNote: false
      }
    ],
    timeline: [
      { action: 'Ticket Created as Critical', by: 'Tariq Mehmood', at: '2026-10-27T03:00:00Z' },
      { action: 'Auto-escalated to IT Lead', by: 'System SLA Policy', at: '2026-10-27T03:00:02Z' },
      { action: 'First Response Provided', by: 'Asim Raza', at: '2026-10-27T03:12:00Z' }
    ]
  },
  {
    ticketId: 'HD-2026-006',
    subject: 'Request for IntelliJ IDEA Ultimate & Docker Desktop Pro Licenses',
    category: 'Information Technology (IT)',
    categoryId: 'CAT-IT',
    subcategory: 'Software Installation & License Request',
    priority: 'Medium',
    status: 'Resolved',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    employeeDepartment: 'Engineering',
    employeeEmail: 'zeeshan.ali@isysware.internal',
    assignedTeamId: 'TEAM-IT',
    assignedTeamName: 'IT Operations & Infrastructure',
    assignedResolverId: 'EMP-007',
    assignedResolverName: 'Asim Raza',
    createdDate: '2026-10-18T10:00:00Z',
    firstResponseDue: '2026-10-18T16:00:00Z',
    resolutionDue: '2026-10-21T10:00:00Z',
    firstResponseAt: '2026-10-18T11:45:00Z',
    resolvedAt: '2026-10-19T14:20:00Z',
    closedAt: '2026-10-20T09:00:00Z',
    isEscalated: false,
    resolutionSummary: 'Allocated corporate JetBrains license key #JB-ISW-2026-88 and assigned Docker Enterprise seat.',
    satisfactionRating: 4,
    satisfactionFeedback: 'Quick turnaround, licenses active.',
    relatedModule: null,
    attachmentRef: null,
    description: 'Need licensed IDE tooling for Java microservices development.',
    conversations: [
      {
        id: 'CONV-601',
        senderId: 'EMP-004',
        senderName: 'Zeeshan Ali',
        senderRole: 'Employee',
        message: 'Manager approved license expense in sprint planning.',
        createdAt: '2026-10-18T10:00:00Z',
        isInternalNote: false
      },
      {
        id: 'CONV-602',
        senderId: 'EMP-007',
        senderName: 'Asim Raza',
        senderRole: 'IT Support Engineer',
        message: 'Licenses provisioned via corporate SSO portal. Check your inbox for invitation link.',
        createdAt: '2026-10-19T14:20:00Z',
        isInternalNote: false
      }
    ],
    timeline: [
      { action: 'Ticket Created', by: 'Zeeshan Ali', at: '2026-10-18T10:00:00Z' },
      { action: 'Assigned to Asim Raza', by: 'System', at: '2026-10-18T10:05:00Z' },
      { action: 'Resolved', by: 'Asim Raza', at: '2026-10-19T14:20:00Z' },
      { action: 'Closed', by: 'Zeeshan Ali', at: '2026-10-20T09:00:00Z' }
    ]
  }
]
