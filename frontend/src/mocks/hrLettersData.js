/**
 * iSysware HRMS — Batch F11: HR Letters Initial Mock Data
 * Authoritative corporate letter templates, placeholders, and issued registers.
 */

export const LETTER_TYPES = [
  'Offer Letter',
  'Appointment Letter',
  'Employment Confirmation Letter',
  'Probation Extension Letter',
  'Salary Increment Letter',
  'Salary Decrement Letter',
  'Promotion Letter',
  'Salary Certificate',
  'Experience Letter',
  'Employment Verification Letter',
  'Warning Letter',
  'Relieving Letter',
  'Resignation Acceptance Letter',
  'Internship Completion Letter',
  'Training Completion Letter',
  'General / Custom HR Letter'
]

export const AVAILABLE_PLACEHOLDERS = [
  { tag: '{{employee_name}}', desc: 'Full Name of the Employee' },
  { tag: '{{employee_id}}', desc: 'Employee ID (e.g. EMP-004)' },
  { tag: '{{designation}}', desc: 'Current Job Title / Designation' },
  { tag: '{{department}}', desc: 'Assigned Department' },
  { tag: '{{joining_date}}', desc: 'Official Date of Joining' },
  { tag: '{{reporting_manager}}', desc: 'Name of Reporting Line Manager' },
  { tag: '{{company_name}}', desc: 'iSysware Software Solutions (Pvt) Ltd' },
  { tag: '{{company_address}}', desc: 'Suite 401, Tech Park, Shahrah-e-Faisal, Karachi' },
  { tag: '{{letter_date}}', desc: 'Date of Letter Issuance' },
  { tag: '{{effective_date}}', desc: 'Effective Date of the Decision' },
  { tag: '{{basic_salary}}', desc: 'Monthly Basic Salary (PKR)' },
  { tag: '{{gross_salary}}', desc: 'Monthly Gross Compensation (PKR)' },
  { tag: '{{revised_salary}}', desc: 'Approved Revised Salary (PKR)' },
  { tag: '{{increment_amount}}', desc: 'Salary Increment Delta (PKR)' },
  { tag: '{{new_designation}}', desc: 'Promoted Job Title' },
  { tag: '{{probation_months}}', desc: 'Probation Duration in Months' },
  { tag: '{{probation_extension_days}}', desc: 'Extension Period in Days' },
  { tag: '{{relieving_date}}', desc: 'Last Official Working Day' },
  { tag: '{{training_course}}', desc: 'Completed Training Syllabus Title' },
  { tag: '{{signatory_name}}', desc: 'Authorized Signatory Name' },
  { tag: '{{signatory_title}}', desc: 'Signatory Official Designation' }
]

export const INITIAL_LETTER_TEMPLATES = [
  {
    templateId: 'TMP-001',
    letterType: 'Offer Letter',
    templateName: 'Standard Corporate Employment Offer',
    subject: 'Offer of Employment — {{designation}}',
    body: `Dear {{employee_name}},

We are pleased to offer you the position of {{designation}} in the {{department}} Department at {{company_name}}. We were impressed with your technical skills and experience during the interview evaluations.

Your initial monthly gross remuneration package will be PKR {{gross_salary}} per month, subject to statutory deductions under Pakistan tax laws. Your official date of joining will be {{effective_date}}. You will report directly to {{reporting_manager}}.

Please sign and return the duplicate copy of this offer letter as your formal acceptance. We look forward to welcoming you to the iSysware team.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Software Solutions (Pvt) Ltd — Private & Confidential',
    footerText: 'Tech Park, Shahrah-e-Faisal, Karachi, Pakistan | www.isysware.com',
    status: 'Active',
    version: '1.2',
    isProtectedSalary: true,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-002',
    letterType: 'Appointment Letter',
    templateName: 'Formal Executive Appointment Contract',
    subject: 'Letter of Appointment — {{designation}}',
    body: `Dear {{employee_name}},

Further to your acceptance of our offer letter, we have great pleasure in formally appointing you as {{designation}} in the {{department}} Department at {{company_name}} with effect from {{joining_date}}.

1. Probation Period: You will be on probation for a period of 3 months from your joining date, during which your performance and conduct will be reviewed.
2. Compensation: Your monthly basic salary will be PKR {{basic_salary}} with a total gross monthly compensation of PKR {{gross_salary}}.
3. Code of Conduct: You will be governed by company HR policies, IP protection agreements, and confidentiality guidelines.

We congratulate you on your appointment and wish you a rewarding career with {{company_name}}.`,
    authorizedSignatory: 'Tariq Mehmood',
    signatoryTitle: 'Chief Executive Officer',
    headerText: 'iSysware Software Solutions (Pvt) Ltd — Formal Appointment',
    footerText: 'Corporate Office: Suite 401, Tech Park, Karachi | info@isysware.com',
    status: 'Active',
    version: '2.0',
    isProtectedSalary: true,
    effectiveFrom: '2026-01-01',
    createdBy: 'Tariq Mehmood'
  },
  {
    templateId: 'TMP-003',
    letterType: 'Employment Confirmation Letter',
    templateName: 'Post-Probation Employment Confirmation',
    subject: 'Confirmation of Employment Services',
    body: `Dear {{employee_name}},

Consequent upon the satisfactory completion of your probationary period and evaluation by your reporting manager, {{reporting_manager}}, we are pleased to confirm your appointment as a permanent employee of {{company_name}} in the capacity of {{designation}}, effective {{effective_date}}.

All other terms and conditions of your service as stated in your appointment letter shall remain unchanged. We appreciate your dedication and look forward to your continued contribution to our organizational growth.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Software Solutions (Pvt) Ltd — Employment Confirmation',
    footerText: 'HR Operations Desk | Phone: +92-21-34567890 | hr@isysware.com',
    status: 'Active',
    version: '1.1',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-004',
    letterType: 'Probation Extension Letter',
    templateName: 'Formal Notice of Probationary Extension',
    subject: 'Extension of Probationary Period',
    body: `Dear {{employee_name}},

This has reference to your appointment as {{designation}} in {{department}} Department with joining date {{joining_date}}.

Following your formal probationary performance appraisal, management has determined that your performance requires further observation and alignment against departmental KPIs. Therefore, your probationary period is hereby extended by {{probation_extension_days}} days, effective {{effective_date}}.

During this extended timeframe, your line manager, {{reporting_manager}}, will provide specific milestone targets. We trust you will utilize this opportunity to demonstrate the required performance standards.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware HR Governance — Performance Notice',
    footerText: 'Confidential Human Resource Communication',
    status: 'Active',
    version: '1.0',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-005',
    letterType: 'Salary Increment Letter',
    templateName: 'Annual Performance Compensation Increment',
    subject: 'Notification of Salary Revision & Increment',
    body: `Dear {{employee_name}},

In recognition of your commendable performance and valuable contribution towards organizational objectives, the Executive Management of {{company_name}} is pleased to inform you that your compensation has been revised effective {{effective_date}}.

- Existing Monthly Gross Salary: PKR {{gross_salary}}
- Approved Increment: PKR {{increment_amount}}
- New Monthly Revised Gross Salary: PKR {{revised_salary}}

All other terms and conditions of your employment contract remain unchanged. We appreciate your hard work and trust you will continue to deliver excellence.`,
    authorizedSignatory: 'Tariq Mehmood',
    signatoryTitle: 'Chief Executive Officer',
    headerText: 'iSysware Compensation & Benefits — Strictly Confidential',
    footerText: 'This compensation letter contains confidential employee remuneration data.',
    status: 'Active',
    version: '2.1',
    isProtectedSalary: true,
    effectiveFrom: '2026-01-01',
    createdBy: 'Tariq Mehmood'
  },
  {
    templateId: 'TMP-006',
    letterType: 'Promotion Letter',
    templateName: 'Executive Career Promotion Letter',
    subject: 'Letter of Promotion — {{new_designation}}',
    body: `Dear {{employee_name}},

Management is delighted to commend you on your exemplary leadership, technical mastery, and dedication to the {{department}} Department. In recognition of your outstanding performance, we are pleased to promote you to the position of {{new_designation}}, effective {{effective_date}}.

In your new capacity, you will assume enhanced technical and mentorship responsibilities. Your revised monthly compensation package will be PKR {{revised_salary}}.

Please accept our hearty congratulations on this well-deserved promotion.`,
    authorizedSignatory: 'Tariq Mehmood',
    signatoryTitle: 'Chief Executive Officer',
    headerText: 'iSysware Talent Advancement & Leadership',
    footerText: 'Executive HR Operations | Karachi, Pakistan',
    status: 'Active',
    version: '1.3',
    isProtectedSalary: true,
    effectiveFrom: '2026-01-01',
    createdBy: 'Tariq Mehmood'
  },
  {
    templateId: 'TMP-007',
    letterType: 'Salary Certificate',
    templateName: 'Official Banking & Embassy Salary Certificate',
    subject: 'To Whom It May Concern — Salary Certificate',
    body: `To Whom It May Concern,

This is to certify that {{employee_name}}, bearing Employee ID {{employee_id}}, is a bona fide permanent employee of {{company_name}}, currently serving as {{designation}} in the {{department}} Department since {{joining_date}}.

As per our payroll records, their current monthly compensation breakdown is as follows:
- Basic Salary: PKR {{basic_salary}}
- Total Monthly Gross Emoluments: PKR {{gross_salary}}

This certificate is issued at the specific request of the employee for banking / visa facilitation purposes without any financial liability on the part of this company.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Official Corporate Verification Desk',
    footerText: 'Issued with digital authentication reference for third-party verification.',
    status: 'Active',
    version: '1.5',
    isProtectedSalary: true,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-008',
    letterType: 'Experience Letter',
    templateName: 'Formal Service & Experience Certificate',
    subject: 'Certificate of Service & Professional Experience',
    body: `To Whom It May Concern,

This is to certify that {{employee_name}} was employed with {{company_name}} as {{designation}} in the {{department}} Department from {{joining_date}} to {{relieving_date}}.

During their tenure with us, {{employee_name}} proved to be a sincere, diligent, and competent professional. They demonstrated strong technical acumen and maintained good working relationships with colleagues and clients.

They leave our organization on their own accord. We wish them all success in their future career endeavors.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Service & Career Certification Desk',
    footerText: 'Official Corporate Seal & Signatory Desk',
    status: 'Active',
    version: '1.2',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-009',
    letterType: 'Employment Verification Letter',
    templateName: 'Standard Third-Party Employment Verification',
    subject: 'Employment Verification — {{employee_name}}',
    body: `To Whom It May Concern,

This letter serves to verify that {{employee_name}} (Employee ID: {{employee_id}}) is actively employed on a full-time basis with {{company_name}} as {{designation}} in the {{department}} Department, having joined our organization on {{joining_date}}.

They are currently in good standing with the company. Should you require any additional information, please feel free to contact our Human Resources Department at hr@isysware.com.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware HR Credential Verification Bureau',
    footerText: 'Valid for visa processing, bank loan inquiries, and residential leasing.',
    status: 'Active',
    version: '1.0',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-010',
    letterType: 'Warning Letter',
    templateName: 'Disciplinary Caution & Compliance Warning',
    subject: 'Official Written Warning — Compliance Breach',
    body: `Dear {{employee_name}},

This formal written warning is being issued to you regarding non-compliance with company policies and established workplace standards. Despite prior verbal advisories, your conduct regarding adherence to operational schedules and attendance guidelines has not met required expectations.

Please note that {{company_name}} expects all staff to maintain professional discipline and integrity. You are required to submit a written explanation within 48 hours and rectify your performance immediately. Failure to demonstrate satisfactory improvement may result in further disciplinary action under corporate service rules.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware HR Governance & Compliance Advisory',
    footerText: 'Strictly Confidential — Hand Delivered to Recipient',
    status: 'Active',
    version: '1.1',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-011',
    letterType: 'Relieving Letter',
    templateName: 'Formal Relieving & Release from Duties',
    subject: 'Relieving Order — {{employee_name}}',
    body: `Dear {{employee_name}},

Consequent upon the acceptance of your resignation dated, you are hereby formally relieved from your duties and responsibilities as {{designation}} with {{company_name}} at the close of business hours on {{relieving_date}}.

We acknowledge that you have completed formal departmental asset handovers, knowledge transfers, and clearance procedures. Your full and final financial settlement is being processed by Finance in accordance with company policy.

We appreciate your services to {{company_name}} and wish you the best in your professional journey.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Employee Exit & Separation Bureau',
    footerText: 'Official Release Documentation',
    status: 'Active',
    version: '1.0',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-012',
    letterType: 'Resignation Acceptance Letter',
    templateName: 'Formal Acceptance of Resignation',
    subject: 'Acceptance of Resignation Notice',
    body: `Dear {{employee_name}},

This has reference to your letter of resignation from the services of {{company_name}} as {{designation}} in the {{department}} Department.

Management has accepted your resignation. In accordance with your notice period, your last working day with the company will be {{relieving_date}}. You are advised to coordinate with your reporting manager, {{reporting_manager}}, for seamless project handover and clearance of corporate IT assets before your final date.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware HR Separation Desk',
    footerText: 'Confidential Human Resource Notice',
    status: 'Active',
    version: '1.0',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-013',
    letterType: 'Internship Completion Letter',
    templateName: 'Formal Internship Completion Certificate',
    subject: 'Certificate of Internship Completion',
    body: `To Whom It May Concern,

This is to certify that {{employee_name}} has successfully completed an intensive Software Engineering internship program with {{company_name}} from {{joining_date}} to {{relieving_date}} under the mentorship of the {{department}} team.

During the internship period, {{employee_name}} actively contributed to full-stack application development modules. They demonstrated commendable enthusiasm, analytical abilities, and strong dedication.

We wish them all the best in their academic and future professional career.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Academic & Early Career Programs',
    footerText: 'Certified by iSysware Technical Directorate',
    status: 'Active',
    version: '1.0',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-014',
    letterType: 'Training Completion Letter',
    templateName: 'Corporate Skill & Syllabus Completion Letter',
    subject: 'Certificate of Corporate Training Completion',
    body: `Dear {{employee_name}},

Congratulations on successfully completing the corporate training curriculum on "{{training_course}}" conducted by {{company_name}} on {{effective_date}}.

Your active participation, technical evaluations, and assessment milestone score reflect a high degree of commitment to your professional development and organizational capability standards.

This achievement has been recorded in your permanent employee learning profile.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Learning & Development Academy',
    footerText: 'Verified Learning Credential ID: ISW-LND-2026',
    status: 'Active',
    version: '1.0',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  },
  {
    templateId: 'TMP-015',
    letterType: 'Salary Decrement Letter',
    templateName: 'Formal Notice of Compensation Adjustment',
    subject: 'Notification of Restructured Compensation Package',
    body: `Dear {{employee_name}},

This letter serves as formal notification regarding the executive restructuring of your monthly compensation package effective {{effective_date}} in alignment with approved corporate compensation policy.

- Revised Monthly Gross Salary: PKR {{revised_salary}}

Please contact the Human Resources Department if you require any clarification regarding this corporate adjustment.`,
    authorizedSignatory: 'Tariq Mehmood',
    signatoryTitle: 'Chief Executive Officer',
    headerText: 'iSysware Executive Compensation Committee',
    footerText: 'Protected Executive Remuneration Record',
    status: 'Active',
    version: '1.0',
    isProtectedSalary: true,
    effectiveFrom: '2026-01-01',
    createdBy: 'Tariq Mehmood'
  },
  {
    templateId: 'TMP-016',
    letterType: 'General / Custom HR Letter',
    templateName: 'General Official Corporate HR Notice',
    subject: 'Official Communication — {{subject_line}}',
    body: `Dear {{employee_name}},

This official notification is issued by {{company_name}} with respect to {{department}} Department operations, effective {{effective_date}}.

{{custom_content}}

For any questions or further guidance, please reach out to the Human Resources Operations Desk.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Corporate Administration Desk',
    footerText: 'iSysware Software Solutions (Pvt) Ltd',
    status: 'Active',
    version: '1.0',
    isProtectedSalary: false,
    effectiveFrom: '2026-01-01',
    createdBy: 'Ayesha Khan'
  }
]

export const INITIAL_ISSUED_LETTERS = [
  {
    letterId: 'LTR-2026-001',
    referenceNumber: 'ISW-LTR-2026-00001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    department: 'Engineering',
    designation: 'Senior Frontend Engineer',
    letterType: 'Employment Confirmation Letter',
    templateId: 'TMP-003',
    templateVersion: '1.1',
    subject: 'Confirmation of Employment Services',
    contentSnapshot: `Dear Zeeshan Ali,

Consequent upon the satisfactory completion of your probationary period and evaluation by your reporting manager, Bilal Ahmed, we are pleased to confirm your appointment as a permanent employee of iSysware Software Solutions (Pvt) Ltd in the capacity of Senior Frontend Engineer, effective 2026-03-01.

All other terms and conditions of your service as stated in your appointment letter shall remain unchanged. We appreciate your dedication and look forward to your continued contribution to our organizational growth.`,
    headerText: 'iSysware Software Solutions (Pvt) Ltd — Employment Confirmation',
    footerText: 'HR Operations Desk | Phone: +92-21-34567890 | hr@isysware.com',
    signatoryName: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    preparedBy: 'Ayesha Khan',
    preparedById: 'EMP-002',
    approvalStatus: 'Approved',
    approvedBy: 'Tariq Mehmood',
    approvedAt: '2026-03-01T10:00:00.000Z',
    issuedBy: 'Ayesha Khan',
    issuedAt: '2026-03-01T11:30:00.000Z',
    effectiveDate: '2026-03-01',
    status: 'Issued',
    isProtectedSalary: false,
    auditTrail: [
      { action: 'Drafted', by: 'Ayesha Khan', at: '2026-02-28T09:00:00.000Z' },
      { action: 'Approved', by: 'Tariq Mehmood', at: '2026-03-01T10:00:00.000Z' },
      { action: 'Issued', by: 'Ayesha Khan', at: '2026-03-01T11:30:00.000Z' }
    ]
  },
  {
    letterId: 'LTR-2026-002',
    referenceNumber: 'ISW-LTR-2026-00002',
    employeeId: 'EMP-005',
    employeeName: 'Hina Farooq',
    department: 'Finance',
    designation: 'Senior Financial Analyst',
    letterType: 'Salary Certificate',
    templateId: 'TMP-007',
    templateVersion: '1.5',
    subject: 'To Whom It May Concern — Salary Certificate',
    contentSnapshot: `To Whom It May Concern,

This is to certify that Hina Farooq, bearing Employee ID EMP-005, is a bona fide permanent employee of iSysware Software Solutions (Pvt) Ltd, currently serving as Senior Financial Analyst in the Finance Department since 2024-03-15.

As per our payroll records, their current monthly compensation breakdown is as follows:
- Basic Salary: PKR 110,000
- Total Monthly Gross Emoluments: PKR 165,000

This certificate is issued at the specific request of the employee for banking / visa facilitation purposes without any financial liability on the part of this company.`,
    headerText: 'iSysware Official Corporate Verification Desk',
    footerText: 'Issued with digital authentication reference for third-party verification.',
    signatoryName: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    preparedBy: 'Ayesha Khan',
    preparedById: 'EMP-002',
    approvalStatus: 'Approved',
    approvedBy: 'Tariq Mehmood',
    approvedAt: '2026-04-10T14:00:00.000Z',
    issuedBy: 'Ayesha Khan',
    issuedAt: '2026-04-10T15:00:00.000Z',
    effectiveDate: '2026-04-10',
    status: 'Issued',
    isProtectedSalary: true,
    auditTrail: [
      { action: 'Drafted', by: 'Ayesha Khan', at: '2026-04-10T11:00:00.000Z' },
      { action: 'Approved', by: 'Tariq Mehmood', at: '2026-04-10T14:00:00.000Z' },
      { action: 'Issued', by: 'Ayesha Khan', at: '2026-04-10T15:00:00.000Z' }
    ]
  }
]
