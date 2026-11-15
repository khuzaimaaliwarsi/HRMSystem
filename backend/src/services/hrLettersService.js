/**
 * iSysware HRMS — HR Letters Management Backend Service
 * Authoritative PostgreSQL-backed service for all 4 HR Letters submodules:
 * 1. Letter Templates Management (CRUD, dynamic placeholders, version bumping)
 * 2. Issued Letters Register (role-scoped register, immutable content snapshots)
 * 3. Letter Approval & Issuance (multi-tier approval, Super Admin executive override,
 *    anti-self-approval for non-Super Admin, sensitive salary shielding & unique ISW-LTR refs)
 * 4. Governance & Audit History (PostgreSQL AuditLog sourceModule: 'HR_LETTERS')
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'

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

export const PROTECTED_SALARY_TYPES = [
  'Offer Letter',
  'Appointment Letter',
  'Salary Increment Letter',
  'Salary Decrement Letter',
  'Promotion Letter',
  'Salary Certificate'
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

const STARTER_TEMPLATES = [
  {
    templateCode: 'TMP-001',
    category: 'Offer Letter',
    title: 'Standard Corporate Employment Offer',
    subject: 'Offer of Employment — {{designation}}',
    templateBodyHtml: `Dear {{employee_name}},

We are pleased to offer you the position of {{designation}} in the {{department}} Department at {{company_name}}. We were impressed with your technical skills and experience during the interview evaluations.

Your initial monthly gross remuneration package will be PKR {{gross_salary}} per month, subject to statutory deductions under Pakistan tax laws. Your official date of joining will be {{effective_date}}. You will report directly to {{reporting_manager}}.

Please sign and return the duplicate copy of this offer letter as your formal acceptance. We look forward to welcoming you to the iSysware team.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Software Solutions (Pvt) Ltd — Private & Confidential',
    footerText: 'Tech Park, Shahrah-e-Faisal, Karachi, Pakistan | www.isysware.com',
    version: '1.2',
    isProtectedSalary: true
  },
  {
    templateCode: 'TMP-002',
    category: 'Appointment Letter',
    title: 'Formal Executive Appointment Contract',
    subject: 'Letter of Appointment — {{designation}}',
    templateBodyHtml: `Dear {{employee_name}},

Further to your acceptance of our offer letter, we have great pleasure in formally appointing you as {{designation}} in the {{department}} Department at {{company_name}} with effect from {{joining_date}}.

1. Probation Period: You will be on probation for a period of 3 months from your joining date, during which your performance and conduct will be reviewed.
2. Compensation: Your monthly basic salary will be PKR {{basic_salary}} with a total gross monthly compensation of PKR {{gross_salary}}.
3. Code of Conduct: You will be governed by company HR policies, IP protection agreements, and confidentiality guidelines.

We congratulate you on your appointment and wish you a rewarding career with {{company_name}}.`,
    authorizedSignatory: 'Tariq Mehmood',
    signatoryTitle: 'Chief Executive Officer',
    headerText: 'iSysware Software Solutions (Pvt) Ltd — Formal Appointment',
    footerText: 'Corporate Office: Suite 401, Tech Park, Karachi | info@isysware.com',
    version: '2.0',
    isProtectedSalary: true
  },
  {
    templateCode: 'TMP-003',
    category: 'Employment Confirmation Letter',
    title: 'Post-Probation Employment Confirmation',
    subject: 'Confirmation of Employment Services',
    templateBodyHtml: `Dear {{employee_name}},

Consequent upon the satisfactory completion of your probationary period and evaluation by your reporting manager, {{reporting_manager}}, we are pleased to confirm your appointment as a permanent employee of {{company_name}} in the capacity of {{designation}}, effective {{effective_date}}.

All other terms and conditions of your service as stated in your appointment letter shall remain unchanged. We appreciate your dedication and look forward to your continued contribution to our organizational growth.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Software Solutions (Pvt) Ltd — Employment Confirmation',
    footerText: 'HR Operations Desk | Phone: +92-21-34567890 | hr@isysware.com',
    version: '1.1',
    isProtectedSalary: false
  },
  {
    templateCode: 'TMP-004',
    category: 'Probation Extension Letter',
    title: 'Formal Notice of Probationary Extension',
    subject: 'Extension of Probationary Period',
    templateBodyHtml: `Dear {{employee_name}},

This has reference to your appointment as {{designation}} in {{department}} Department with joining date {{joining_date}}.

Following your formal probationary performance appraisal, management has determined that your performance requires further observation and alignment against departmental KPIs. Therefore, your probationary period is hereby extended by {{probation_extension_days}} days, effective {{effective_date}}.

During this extended timeframe, your line manager, {{reporting_manager}}, will provide specific milestone targets.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware HR Governance — Performance Notice',
    footerText: 'Confidential Human Resource Communication',
    version: '1.0',
    isProtectedSalary: false
  },
  {
    templateCode: 'TMP-005',
    category: 'Salary Increment Letter',
    title: 'Annual Performance Compensation Increment',
    subject: 'Notification of Salary Revision & Increment',
    templateBodyHtml: `Dear {{employee_name}},

In recognition of your commendable performance and valuable contribution towards organizational objectives, the Executive Management of {{company_name}} is pleased to inform you that your compensation has been revised effective {{effective_date}}.

- Existing Monthly Gross Salary: PKR {{gross_salary}}
- Approved Increment: PKR {{increment_amount}}
- New Monthly Revised Gross Salary: PKR {{revised_salary}}

All other terms and conditions of your employment contract remain unchanged.`,
    authorizedSignatory: 'Tariq Mehmood',
    signatoryTitle: 'Chief Executive Officer',
    headerText: 'iSysware Compensation & Benefits — Strictly Confidential',
    footerText: 'This compensation letter contains confidential employee remuneration data.',
    version: '2.1',
    isProtectedSalary: true
  },
  {
    templateCode: 'TMP-006',
    category: 'Promotion Letter',
    title: 'Executive Career Promotion Letter',
    subject: 'Letter of Promotion — {{new_designation}}',
    templateBodyHtml: `Dear {{employee_name}},

Management is delighted to commend you on your exemplary leadership and dedication to the {{department}} Department. We are pleased to promote you to {{new_designation}}, effective {{effective_date}}.

Your revised monthly compensation package will be PKR {{revised_salary}}. Please accept our congratulations on this well-deserved promotion.`,
    authorizedSignatory: 'Tariq Mehmood',
    signatoryTitle: 'Chief Executive Officer',
    headerText: 'iSysware Talent Advancement & Leadership',
    footerText: 'Executive HR Operations | Karachi, Pakistan',
    version: '1.3',
    isProtectedSalary: true
  },
  {
    templateCode: 'TMP-007',
    category: 'Salary Certificate',
    title: 'Official Banking & Embassy Salary Certificate',
    subject: 'To Whom It May Concern — Salary Certificate',
    templateBodyHtml: `To Whom It May Concern,

This is to certify that {{employee_name}}, bearing Employee ID {{employee_id}}, is a bona fide permanent employee of {{company_name}}, serving as {{designation}} in the {{department}} Department since {{joining_date}}.

As per our payroll records, their current monthly compensation breakdown is as follows:
- Basic Salary: PKR {{basic_salary}}
- Total Monthly Gross Emoluments: PKR {{gross_salary}}

This certificate is issued at the specific request of the employee for banking / visa facilitation purposes without any financial liability on the part of this company.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Official Corporate Verification Desk',
    footerText: 'Issued with digital authentication reference for third-party verification.',
    version: '1.5',
    isProtectedSalary: true
  },
  {
    templateCode: 'TMP-008',
    category: 'Experience Letter',
    title: 'Formal Service & Experience Certificate',
    subject: 'Certificate of Service & Professional Experience',
    templateBodyHtml: `To Whom It May Concern,

This is to certify that {{employee_name}} was employed with {{company_name}} as {{designation}} in the {{department}} Department from {{joining_date}} to {{relieving_date}}.

During their tenure with us, {{employee_name}} proved to be a sincere, diligent, and competent professional. We wish them all success in their future career endeavors.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Service & Career Certification Desk',
    footerText: 'Official Corporate Seal & Signatory Desk',
    version: '1.2',
    isProtectedSalary: false
  },
  {
    templateCode: 'TMP-009',
    category: 'Employment Verification Letter',
    title: 'Standard Third-Party Employment Verification',
    subject: 'Employment Verification — {{employee_name}}',
    templateBodyHtml: `To Whom It May Concern,

This letter serves to verify that {{employee_name}} (Employee ID: {{employee_id}}) is actively employed on a full-time basis with {{company_name}} as {{designation}} in the {{department}} Department, having joined our organization on {{joining_date}}.

They are currently in good standing with the company.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware HR Credential Verification Bureau',
    footerText: 'Valid for visa processing, bank loan inquiries, and residential leasing.',
    version: '1.0',
    isProtectedSalary: false
  },
  {
    templateCode: 'TMP-010',
    category: 'Warning Letter',
    title: 'Disciplinary Caution & Compliance Warning',
    subject: 'Official Written Warning — Compliance Breach',
    templateBodyHtml: `Dear {{employee_name}},

This formal written warning is being issued regarding non-compliance with company policies and established workplace standards. You are required to submit a written explanation within 48 hours and rectify your performance immediately.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware HR Governance & Compliance Advisory',
    footerText: 'Strictly Confidential — Hand Delivered to Recipient',
    version: '1.1',
    isProtectedSalary: false
  },
  {
    templateCode: 'TMP-011',
    category: 'Relieving Letter',
    title: 'Formal Relieving & Release from Duties',
    subject: 'Relieving Order — {{employee_name}}',
    templateBodyHtml: `Dear {{employee_name}},

Consequent upon the acceptance of your resignation, you are hereby formally relieved from your duties as {{designation}} with {{company_name}} at the close of business hours on {{relieving_date}}. We wish you the best in your professional journey.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Employee Exit & Separation Bureau',
    footerText: 'Official Release Documentation',
    version: '1.0',
    isProtectedSalary: false
  },
  {
    templateCode: 'TMP-012',
    category: 'Resignation Acceptance Letter',
    title: 'Formal Acceptance of Resignation',
    subject: 'Acceptance of Resignation Notice',
    templateBodyHtml: `Dear {{employee_name}},

Management has accepted your resignation as {{designation}} in the {{department}} Department. Your last working day will be {{relieving_date}}. Please coordinate with {{reporting_manager}} for handover and asset clearance.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware HR Separation Desk',
    footerText: 'Confidential Human Resource Notice',
    version: '1.0',
    isProtectedSalary: false
  },
  {
    templateCode: 'TMP-013',
    category: 'Internship Completion Letter',
    title: 'Formal Internship Completion Certificate',
    subject: 'Certificate of Internship Completion',
    templateBodyHtml: `To Whom It May Concern,

This is to certify that {{employee_name}} has successfully completed an internship program with {{company_name}} from {{joining_date}} to {{relieving_date}} with the {{department}} team. We wish them all the best in their future career.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Academic & Early Career Programs',
    footerText: 'Certified by iSysware Technical Directorate',
    version: '1.0',
    isProtectedSalary: false
  },
  {
    templateCode: 'TMP-014',
    category: 'Training Completion Letter',
    title: 'Corporate Skill & Syllabus Completion Letter',
    subject: 'Certificate of Corporate Training Completion',
    templateBodyHtml: `Dear {{employee_name}},

Congratulations on successfully completing the corporate training curriculum on "{{training_course}}" conducted by {{company_name}} on {{effective_date}}. This achievement has been recorded in your permanent employee learning profile.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Learning & Development Academy',
    footerText: 'Verified Learning Credential ID: ISW-LND-2026',
    version: '1.0',
    isProtectedSalary: false
  },
  {
    templateCode: 'TMP-015',
    category: 'Salary Decrement Letter',
    title: 'Formal Notice of Compensation Adjustment',
    subject: 'Notification of Restructured Compensation Package',
    templateBodyHtml: `Dear {{employee_name}},

This letter serves as formal notification regarding the restructuring of your monthly compensation package effective {{effective_date}}.
- Revised Monthly Gross Salary: PKR {{revised_salary}}

Please contact Human Resources for any clarification.`,
    authorizedSignatory: 'Tariq Mehmood',
    signatoryTitle: 'Chief Executive Officer',
    headerText: 'iSysware Executive Compensation Committee',
    footerText: 'Protected Executive Remuneration Record',
    version: '1.0',
    isProtectedSalary: true
  },
  {
    templateCode: 'TMP-016',
    category: 'General / Custom HR Letter',
    title: 'General Official Corporate HR Notice',
    subject: 'Official Communication — {{subject_line}}',
    templateBodyHtml: `Dear {{employee_name}},

This official notification is issued by {{company_name}} with respect to {{department}} Department operations, effective {{effective_date}}.

{{custom_content}}

For any questions or further guidance, please reach out to the Human Resources Operations Desk.`,
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Software Solutions (Pvt) Ltd — Official Desk',
    footerText: 'Official Corporate HR Document',
    version: '1.0',
    isProtectedSalary: false
  }
]

let _seedPromise = null

export class HrLettersService {
  _role(user) {
    return String(user?.role || '').toUpperCase()
  }

  _isSuperAdmin(user) {
    return this._role(user) === 'SUPER_ADMIN'
  }

  _isHrOrSuper(user) {
    const r = this._role(user)
    return r === 'SUPER_ADMIN' || r === 'HR_ADMIN'
  }

  _isManagerOrLead(user) {
    const r = this._role(user)
    return r === 'DEPT_MANAGER' || r === 'TEAM_LEAD'
  }

  _actorName(user) {
    if (user?.employee?.firstName || user?.employee?.lastName) {
      return `${user.employee.firstName || ''} ${user.employee.lastName || ''}`.trim()
    }
    return user?.name || user?.username || 'System User'
  }

  async _ensureStarterTemplates() {
    // Zero hardcoded auto-seeding. PostgreSQL database is the single source of truth.
    return
  }

  _mapTemplateRow(row) {
    const meta = row.placeholdersJson && typeof row.placeholdersJson === 'object' ? row.placeholdersJson : {}
    const status = meta.status || (row.isActive ? 'Active' : 'Archived')
    return {
      id: row.id,
      templateId: row.templateCode,
      templateCode: row.templateCode,
      letterType: row.category,
      templateName: row.title,
      subject: meta.subject || `${row.category} — {{employee_name}}`,
      body: row.templateBodyHtml,
      authorizedSignatory: meta.authorizedSignatory || 'Head of Human Resources',
      signatoryTitle: meta.signatoryTitle || 'HR Directorate',
      headerText: meta.headerText || 'iSysware Software Solutions (Pvt) Ltd — Official Communication',
      footerText: meta.footerText || 'Tech Park, Shahrah-e-Faisal, Karachi | www.isysware.com',
      status,
      isActive: row.isActive,
      version: meta.version || '1.0',
      isProtectedSalary: Boolean(meta.isProtectedSalary ?? PROTECTED_SALARY_TYPES.includes(row.category)),
      effectiveFrom: meta.effectiveFrom || row.createdAt.toISOString().slice(0, 10),
      createdBy: meta.createdBy || 'HR Administration',
      updatedBy: meta.updatedBy || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }

  _parseLetterMeta(row) {
    if (typeof row.remarks === 'string' && row.remarks.startsWith('{"__meta":')) {
      try {
        return JSON.parse(row.remarks)
      } catch {
        // fallback below
      }
    }
    return { remarksText: row.remarks || '' }
  }

  _encodeLetterMeta(meta) {
    return JSON.stringify({ __meta: 1, ...meta })
  }

  _mapLetterStatusToUi(dbStatus, meta) {
    if (dbStatus === 'ISSUED') return 'Issued'
    if (dbStatus === 'APPROVED') return 'Approved'
    if (dbStatus === 'PENDING_APPROVAL') return 'Pending Approval'
    if (dbStatus === 'REVOKED') return 'Rejected'
    if (meta.approvalStatus === 'Rejected') return 'Rejected'
    return 'Draft'
  }

  _mapLetterRow(row) {
    const meta = this._parseLetterMeta(row)
    const emp = row.employee || {}
    const tplMeta = row.template ? this._parseTemplateJson(row.template.placeholdersJson) : {}
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || meta.employeeName || 'Employee'
    const uiStatus = this._mapLetterStatusToUi(row.status, meta)
    const isIssued = row.status === 'ISSUED'

    return {
      id: row.id,
      letterId: meta.letterId || row.referenceNumber,
      referenceNumber: isIssued ? row.referenceNumber : (meta.officialReferenceNumber || null),
      trackingCode: row.referenceNumber,
      templateId: row.template?.templateCode || meta.templateCode || row.templateId,
      templateCuid: row.templateId,
      templateVersion: meta.templateVersion || tplMeta.version || '1.0',
      letterType: meta.letterType || row.template?.category || 'General / Custom HR Letter',
      employeeId: emp.employeeCode || meta.employeeCode || row.employeeId,
      employeeCuid: row.employeeId,
      employeeName: fullName,
      designation: emp.designation?.title || meta.designation || 'Staff Member',
      department: emp.department?.name || meta.department || 'Operations',
      departmentId: emp.departmentId || null,
      subject: meta.subject || row.template?.title || 'Official HR Communication',
      headerText: meta.headerText || tplMeta.headerText || 'iSysware Software Solutions (Pvt) Ltd',
      footerText: meta.footerText || tplMeta.footerText || 'Official Corporate Document',
      contentSnapshot: row.contentSnapshotHtml,
      signatoryName: meta.signatoryName || tplMeta.authorizedSignatory || 'Head of Human Resources',
      signatoryTitle: meta.signatoryTitle || tplMeta.signatoryTitle || 'Human Resources',
      effectiveDate: meta.effectiveDate || row.issuedDate.toISOString().slice(0, 10),
      customValues: meta.customValues || {},
      isProtectedSalary: Boolean(meta.isProtectedSalary ?? tplMeta.isProtectedSalary),
      status: uiStatus,
      dbStatus: row.status,
      approvalStatus: meta.approvalStatus || (isIssued || row.status === 'APPROVED' ? 'Approved' : uiStatus),
      preparedBy: meta.preparedBy || 'HR Administration',
      preparedById: meta.preparedById || row.issuedById,
      preparedByEmployeeCode: meta.preparedByEmployeeCode || null,
      submittedBy: meta.submittedBy || null,
      submittedAt: meta.submittedAt || null,
      approvedBy: meta.approvedBy || null,
      approvedById: meta.approvedById || null,
      approvedAt: meta.approvedAt || null,
      rejectedBy: meta.rejectedBy || null,
      rejectedAt: meta.rejectedAt || null,
      rejectionReason: meta.rejectionReason || null,
      issuedBy: meta.issuedBy || null,
      issuedById: isIssued ? row.issuedById : null,
      issuedAt: isIssued ? (meta.issuedAt || row.issuedDate.toISOString()) : null,
      documentUrl: row.documentUrl || null,
      remarks: meta.remarksText || '',
      auditTrail: Array.isArray(meta.auditTrail) ? meta.auditTrail : [],
      createdAt: row.createdAt.toISOString()
    }
  }

  _parseTemplateJson(json) {
    return json && typeof json === 'object' ? json : {}
  }

  async _logAudit(client, { user, actionType, entityName, entityId, before = null, after = null, notes = null, employeeId = null }) {
    await client.auditLog.create({
      data: {
        actorUserId: user?.id || null,
        actorEmployeeCode: user?.employee?.employeeCode || null,
        actorRole: user?.role || 'SYSTEM',
        sourceModule: 'HR_LETTERS',
        actionType,
        entityName,
        entityId: String(entityId),
        recordSnapshotBefore: before || undefined,
        recordSnapshotAfter: {
          ...(after || {}),
          ...(employeeId ? { targetEmployeeId: employeeId } : {})
        },
        reasonOrNotes: notes || null
      }
    })
  }

  async _resolveEmployeeWithDetails(idOrCode) {
    if (!idOrCode) return null
    return prisma.employee.findFirst({
      where: { OR: [{ id: idOrCode }, { employeeCode: idOrCode }] },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
        reportingManager: { select: { firstName: true, lastName: true } },
        salaryStructures: { where: { isCurrent: true }, take: 1, orderBy: { effectiveFrom: 'desc' } }
      }
    })
  }

  async _resolveTemplate(idOrCode) {
    if (!idOrCode) return null
    return prisma.hrLetterTemplate.findFirst({
      where: { OR: [{ id: idOrCode }, { templateCode: idOrCode }] }
    })
  }

  async _resolveLetter(idOrRef) {
    const rows = await prisma.issuedHrLetter.findMany({
      where: { OR: [{ id: idOrRef }, { referenceNumber: idOrRef }] },
      include: {
        template: true,
        employee: {
          include: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } }
          }
        }
      }
    })
    if (rows.length > 0) return rows[0]

    const all = await prisma.issuedHrLetter.findMany({
      include: {
        template: true,
        employee: {
          include: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } }
          }
        }
      }
    })
    return all.find((r) => this._parseLetterMeta(r).letterId === idOrRef) || null
  }

  _bumpVersion(version = '1.0') {
    const cleaned = String(version || '1.0').trim().replace(/^v/i, '')
    const parts = cleaned.split('.')
    const major = Number.parseInt(parts[0], 10) || 1
    const minor = (Number.isFinite(Number.parseInt(parts[1], 10)) ? Number.parseInt(parts[1], 10) : 0) + 1
    return `${major}.${minor}`
  }

  async _nextCode(prefix, modelName, field, pad = 3) {
    const rows = await prisma[modelName].findMany({ select: { [field]: true } })
    let max = 0
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^${escaped}-(\\d+)$`)
    for (const r of rows) {
      const m = re.exec(String(r[field] || ''))
      if (m) max = Math.max(max, Number(m[1]))
    }
    return `${prefix}-${String(max + 1).padStart(pad, '0')}`
  }

  interpolateText(rawText = '', employee = {}, customValues = {}, templateMeta = {}, callerUser = null) {
    if (!rawText) return ''
    const isPrivileged = this._isHrOrSuper(callerUser)
    const sal = employee?.salaryStructures?.[0] || {}
    const formatCurrency = (val) => {
      if (val === undefined || val === null || val === '') return 'N/A'
      const num = Number(val)
      return Number.isNaN(num) ? String(val) : num.toLocaleString()
    }

    const maskSalary = (val) => (isPrivileged ? formatCurrency(val) : 'CONFIDENTIAL (HR Only)')
    const fullName =
      employee?.name ||
      `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() ||
      'Employee Name'
    const managerName = employee?.reportingManager
      ? `${employee.reportingManager.firstName || ''} ${employee.reportingManager.lastName || ''}`.trim()
      : 'Line Manager'

    const nowDate = new Date().toISOString().slice(0, 10)
    const joinDate = employee?.joiningDate
      ? new Date(employee.joiningDate).toISOString().slice(0, 10)
      : '2024-01-15'

    const tokens = {
      '{{employee_name}}': fullName,
      '{{employee_id}}': employee?.employeeCode || employee?.employeeId || employee?.id || 'EMP-XXX',
      '{{designation}}': employee?.designation?.title || employee?.designation || 'Staff Member',
      '{{department}}': employee?.department?.name || employee?.department || 'Operations',
      '{{joining_date}}': joinDate,
      '{{reporting_manager}}': managerName,
      '{{company_name}}': 'iSysware Software Solutions (Pvt) Ltd',
      '{{company_address}}': 'Suite 401, Tech Park, Shahrah-e-Faisal, Karachi',
      '{{letter_date}}': nowDate,
      '{{effective_date}}': customValues.effectiveDate || nowDate,
      '{{basic_salary}}': maskSalary(customValues.basicSalary ?? sal.baseSalary),
      '{{gross_salary}}': maskSalary(customValues.grossSalary ?? sal.grossSalary),
      '{{revised_salary}}': maskSalary(customValues.revisedSalary ?? customValues.grossSalary ?? sal.grossSalary),
      '{{increment_amount}}': maskSalary(customValues.incrementAmount ?? '0'),
      '{{new_designation}}': customValues.newDesignation || employee?.designation?.title || 'Senior Staff',
      '{{probation_months}}': String(customValues.probationMonths || '3'),
      '{{probation_extension_days}}': String(customValues.probationExtensionDays || '60'),
      '{{relieving_date}}': customValues.relievingDate || nowDate,
      '{{training_course}}': customValues.trainingCourse || 'Corporate Professional Development',
      '{{signatory_name}}': templateMeta.authorizedSignatory || 'Ayesha Khan',
      '{{signatory_title}}': templateMeta.signatoryTitle || 'Head of Human Resources',
      '{{subject_line}}': customValues.customSubject || 'General Communication',
      '{{custom_content}}': customValues.customContent || ''
    }

    let result = String(rawText)
    for (const [tag, value] of Object.entries(tokens)) {
      result = result.split(tag).join(String(value ?? ''))
    }
    return result
  }

  // ==========================================================================
  // 1. TEMPLATES MANAGEMENT
  // ==========================================================================

  async getTemplates(filters = {}) {
    await this._ensureStarterTemplates()
    const rows = await prisma.hrLetterTemplate.findMany({ orderBy: { templateCode: 'asc' } })
    let list = rows.map((r) => this._mapTemplateRow(r))

    if (filters.letterType && filters.letterType !== 'all') {
      list = list.filter((t) => t.letterType === filters.letterType)
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter((t) => t.status === filters.status)
    }
    return list
  }

  async saveTemplate(data, user) {
    if (!this._isHrOrSuper(user)) {
      throw new AppError('Only Super Admin or HR Admin can create or edit corporate letter templates.', 403, 'FORBIDDEN')
    }
    await this._ensureStarterTemplates()

    const letterType = String(data.letterType || '').trim()
    const templateName = String(data.templateName || data.title || '').trim()
    const subject = String(data.subject || '').trim()
    const body = String(data.body || data.templateBodyHtml || '').trim()

    if (!letterType) throw new AppError('Letter type is required.', 400, 'VALIDATION_ERROR')
    if (!templateName) throw new AppError('Template title/name is required.', 400, 'VALIDATION_ERROR')
    if (!subject) throw new AppError('Letter subject is required.', 400, 'VALIDATION_ERROR')
    if (!body) throw new AppError('Letter template body is required.', 400, 'VALIDATION_ERROR')

    const status = data.status || 'Active'
    const isActive = status === 'Active'
    const isProtectedSalary =
      data.isProtectedSalary !== undefined
        ? Boolean(data.isProtectedSalary)
        : PROTECTED_SALARY_TYPES.includes(letterType)

    const lookupId = data.templateId || data.id
    const existing = lookupId ? await this._resolveTemplate(lookupId) : null

    if (data.isUpdate && !existing) {
      throw new AppError(`Letter template '${lookupId}' not found.`, 404, 'TEMPLATE_NOT_FOUND')
    }

    if (existing) {
      const prevMeta = this._parseTemplateJson(existing.placeholdersJson)
      const nextVersion = this._bumpVersion(prevMeta.version || '1.0')
      const actorName = this._actorName(user)
      const authorizedSignatory =
        data.authorizedSignatory !== undefined
          ? String(data.authorizedSignatory).trim() || prevMeta.authorizedSignatory || 'Ayesha Khan'
          : prevMeta.authorizedSignatory || 'Ayesha Khan'
      const signatoryTitle =
        data.signatoryTitle !== undefined
          ? String(data.signatoryTitle).trim() || prevMeta.signatoryTitle || 'Head of Human Resources'
          : prevMeta.signatoryTitle || 'Head of Human Resources'
      const headerText =
        data.headerText !== undefined ? String(data.headerText).trim() : prevMeta.headerText
      const footerText =
        data.footerText !== undefined ? String(data.footerText).trim() : prevMeta.footerText

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.hrLetterTemplate.update({
          where: { id: existing.id },
          data: {
            title: templateName,
            category: letterType,
            templateBodyHtml: body,
            isActive,
            placeholdersJson: {
              ...prevMeta,
              subject,
              authorizedSignatory,
              signatoryTitle,
              headerText,
              footerText,
              status,
              version: nextVersion,
              isProtectedSalary,
              updatedBy: actorName
            }
          }
        })

        await this._logAudit(tx, {
          user,
          actionType: 'TEMPLATE_UPDATED',
          entityName: 'HrLetterTemplate',
          entityId: row.templateCode,
          before: {
            title: existing.title,
            version: prevMeta.version,
            status: prevMeta.status,
            authorizedSignatory: prevMeta.authorizedSignatory,
            signatoryTitle: prevMeta.signatoryTitle,
            subject: prevMeta.subject
          },
          after: {
            title: row.title,
            version: nextVersion,
            status,
            authorizedSignatory,
            signatoryTitle,
            subject
          },
          notes: `Updated template '${row.title}' to v${nextVersion}`
        })

        return row
      })

      return this._mapTemplateRow(updated)
    }

    const templateCode = await this._nextCode('TMP', 'hrLetterTemplate', 'templateCode', 3)
    const actorName = this._actorName(user)

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.hrLetterTemplate.create({
        data: {
          templateCode,
          title: templateName,
          category: letterType,
          templateBodyHtml: body,
          isActive,
          placeholdersJson: {
            subject,
            authorizedSignatory: data.authorizedSignatory || 'Ayesha Khan',
            signatoryTitle: data.signatoryTitle || 'Head of Human Resources',
            headerText: data.headerText || 'iSysware Software Solutions (Pvt) Ltd — Official Communication',
            footerText: data.footerText || 'Tech Park, Shahrah-e-Faisal, Karachi | www.isysware.com',
            status,
            version: '1.0',
            isProtectedSalary,
            effectiveFrom: new Date().toISOString().slice(0, 10),
            createdBy: actorName
          }
        }
      })

      await this._logAudit(tx, {
        user,
        actionType: 'TEMPLATE_CREATED',
        entityName: 'HrLetterTemplate',
        entityId: row.templateCode,
        after: { title: row.title, category: row.category, version: '1.0', status },
        notes: `Created corporate letter template '${row.title}'`
      })

      return row
    })

    return this._mapTemplateRow(created)
  }

  // ==========================================================================
  // 2. LETTERS REGISTER & ROLE-SCOPED QUERIES
  // ==========================================================================

  _canViewLetter(mapped, user) {
    if (this._isHrOrSuper(user)) return true

    const myEmpId = user?.employeeId
    const myDeptId = user?.employee?.departmentId
    const isOwnRecipient = Boolean(myEmpId && mapped.employeeCuid === myEmpId)
    const isPreparedBySelf = Boolean(user?.id && mapped.preparedById === user.id)

    if (this._role(user) === 'EMPLOYEE') {
      if (!isOwnRecipient) return false
      // Employees always see officially Issued letters; self-requested non-salary letters also stay visible to requester
      return mapped.status === 'Issued' || (isPreparedBySelf && !mapped.isProtectedSalary)
    }

    if (this._isManagerOrLead(user)) {
      if (isOwnRecipient && mapped.status === 'Issued') return true
      if (isPreparedBySelf && !mapped.isProtectedSalary) return true
      if (mapped.isProtectedSalary) return false
      return Boolean(myDeptId && mapped.departmentId === myDeptId && mapped.status === 'Issued')
    }

    return false
  }

  async getLetters(filters = {}, user) {
    const rows = await prisma.issuedHrLetter.findMany({
      include: {
        template: true,
        employee: {
          include: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    let list = rows.map((r) => this._mapLetterRow(r)).filter((l) => this._canViewLetter(l, user))

    if (filters.status && filters.status !== 'all') {
      list = list.filter((l) => l.status.toLowerCase() === String(filters.status).toLowerCase())
    }
    if (filters.letterType && filters.letterType !== 'all') {
      list = list.filter((l) => l.letterType === filters.letterType)
    }
    if (filters.employeeId) {
      list = list.filter((l) => l.employeeId === filters.employeeId || l.employeeCuid === filters.employeeId)
    }

    return list
  }

  async getLetterById(idOrRef, user) {
    const row = await this._resolveLetter(idOrRef)
    if (!row) throw new AppError('Letter record not found.', 404, 'NOT_FOUND')
    const mapped = this._mapLetterRow(row)
    if (!this._canViewLetter(mapped, user)) {
      throw new AppError('Access denied: You do not have permission to view this HR letter.', 403, 'FORBIDDEN')
    }
    return mapped
  }

  // ==========================================================================
  // 3. DRAFT CREATION, APPROVAL WORKFLOW & OFFICIAL ISSUANCE
  // ==========================================================================

  async createLetterDraft(data, user) {
    await this._ensureStarterTemplates()

    const template = await this._resolveTemplate(data.templateId)
    if (!template) {
      throw new AppError(`Invalid letter template reference: ${data.templateId}`, 404, 'NOT_FOUND')
    }
    const tplMeta = this._parseTemplateJson(template.placeholdersJson)
    if (!template.isActive || tplMeta.status === 'Archived') {
      throw new AppError('Archived or inactive letter templates cannot be used.', 400, 'INVALID_TEMPLATE')
    }

    const empLookupId = data.employeeId || user?.employee?.employeeCode || user?.employeeId
    const emp = await this._resolveEmployeeWithDetails(empLookupId)
    if (!emp) {
      throw new AppError(`Recipient employee '${empLookupId}' not found in PostgreSQL directory.`, 404, 'NOT_FOUND')
    }

    const letterType = data.letterType || template.category
    const isProtectedSalary = Boolean(
      tplMeta.isProtectedSalary ||
        data.isProtectedSalary ||
        PROTECTED_SALARY_TYPES.includes(letterType)
    )

    if (!this._isHrOrSuper(user)) {
      if (isProtectedSalary) {
        throw new AppError(
          `Access denied: Your role cannot prepare protected salary or confidential compensation letters (${letterType}).`,
          403,
          'FORBIDDEN'
        )
      }
      if (this._role(user) === 'EMPLOYEE') {
        if (user.employeeId !== emp.id) {
          throw new AppError('Employees can only request non-confidential letters for themselves.', 403, 'FORBIDDEN')
        }
      } else if (this._isManagerOrLead(user)) {
        const myDeptId = user?.employee?.departmentId
        if (emp.id !== user.employeeId && (!myDeptId || emp.departmentId !== myDeptId)) {
          throw new AppError('Managers can only draft non-salary letters within their own department.', 403, 'FORBIDDEN')
        }
      }
    }

    const directIssue = Boolean(data.directIssue)
    if (directIssue && !this._isSuperAdmin(user)) {
      throw new AppError('Only Super Admin can directly authorize and issue letters in a single step.', 403, 'FORBIDDEN')
    }

    const submitNow = Boolean(data.submitNow) && !directIssue
    const customValues = {
      ...(data.customValues || {}),
      effectiveDate: data.effectiveDate || data.customValues?.effectiveDate || new Date().toISOString().slice(0, 10),
      customSubject: data.customSubject || data.customValues?.customSubject || '',
      customContent: data.customContent || data.customValues?.customContent || ''
    }

    const renderedSubject =
      data.customSubject ||
      this.interpolateText(tplMeta.subject || template.title, emp, customValues, tplMeta, user)
    const rawBody = data.customContent || template.templateBodyHtml
    const contentSnapshotHtml = this.interpolateText(rawBody, emp, customValues, tplMeta, user)

    const year = new Date().getFullYear()
    const actorName = this._actorName(user)
    const nowIso = new Date().toISOString()

    const created = await prisma.$transaction(async (tx) => {
      const existingAll = await tx.issuedHrLetter.findMany({ select: { referenceNumber: true, remarks: true } })
      let maxLetterSeq = 0
      let maxOfficialSeq = 0
      const draftRe = new RegExp(`^LTR-${year}-(\\d+)$`)
      const officialRe = new RegExp(`^ISW-LTR-${year}-(\\d+)$`)

      for (const r of existingAll) {
        const meta = this._parseLetterMeta(r)
        const lid = meta.letterId || r.referenceNumber
        const dm = draftRe.exec(String(lid || ''))
        if (dm) maxLetterSeq = Math.max(maxLetterSeq, Number(dm[1]))
        const om = officialRe.exec(String(r.referenceNumber || ''))
        if (om) maxOfficialSeq = Math.max(maxOfficialSeq, Number(om[1]))
      }

      const letterId = `LTR-${year}-${String(maxLetterSeq + 1).padStart(4, '0')}`
      const officialRef = directIssue
        ? `ISW-LTR-${year}-${String(maxOfficialSeq + 1).padStart(5, '0')}`
        : null

      const dbStatus = directIssue ? 'ISSUED' : submitNow ? 'PENDING_APPROVAL' : 'DRAFT'
      const approvalStatus = directIssue ? 'Approved' : submitNow ? 'Pending Approval' : 'Draft'

      const auditTrail = [
        {
          action: 'Drafted',
          by: actorName,
          role: user.role,
          at: nowIso,
          remarks: `Prepared from template ${template.templateCode} (v${tplMeta.version || '1.0'})`
        }
      ]
      if (submitNow) {
        auditTrail.push({
          action: 'Submitted for Approval',
          by: actorName,
          role: user.role,
          at: nowIso,
          remarks: 'Submitted to approval queue'
        })
      }
      if (directIssue) {
        auditTrail.push({
          action: 'Officially Issued',
          by: actorName,
          role: user.role,
          at: nowIso,
          remarks: `Super Admin direct authorization & issuance (${officialRef})`
        })
      }

      const meta = {
        letterId,
        templateCode: template.templateCode,
        letterType,
        templateVersion: tplMeta.version || '1.0',
        subject: renderedSubject,
        headerText: tplMeta.headerText || 'iSysware Software Solutions (Pvt) Ltd',
        footerText: tplMeta.footerText || 'Official Corporate HR Document',
        signatoryName: tplMeta.authorizedSignatory || 'Ayesha Khan',
        signatoryTitle: tplMeta.signatoryTitle || 'Head of Human Resources',
        effectiveDate: customValues.effectiveDate,
        customValues,
        isProtectedSalary,
        approvalStatus,
        preparedBy: actorName,
        preparedById: user.id,
        preparedByEmployeeCode: user.employee?.employeeCode || null,
        submittedBy: submitNow ? actorName : null,
        submittedAt: submitNow ? nowIso : null,
        approvedBy: directIssue ? actorName : null,
        approvedById: directIssue ? user.id : null,
        approvedAt: directIssue ? nowIso : null,
        issuedBy: directIssue ? actorName : null,
        issuedAt: directIssue ? nowIso : null,
        officialReferenceNumber: officialRef,
        remarksText: data.remarks || '',
        auditTrail
      }

      const row = await tx.issuedHrLetter.create({
        data: {
          referenceNumber: officialRef || letterId,
          templateId: template.id,
          employeeId: emp.id,
          issuedDate: new Date(),
          issuedById: user.id,
          status: dbStatus,
          documentUrl: officialRef ? `/api/v1/letters/verify/${officialRef}` : null,
          contentSnapshotHtml,
          remarks: this._encodeLetterMeta(meta)
        },
        include: {
          template: true,
          employee: {
            include: {
              department: { select: { id: true, name: true } },
              designation: { select: { id: true, title: true } }
            }
          }
        }
      })

      await this._logAudit(tx, {
        user,
        actionType: directIssue ? 'LETTER_DIRECTLY_ISSUED' : submitNow ? 'LETTER_SUBMITTED' : 'LETTER_DRAFTED',
        entityName: 'IssuedHrLetter',
        entityId: officialRef || letterId,
        after: { letterId, officialRef, letterType, employeeCode: emp.employeeCode, status: dbStatus },
        notes: directIssue
          ? `Super Admin directly authorized & issued ${letterType} (${officialRef})`
          : `Created ${letterType} draft ${letterId} (${approvalStatus})`,
        employeeId: emp.id
      })

      return row
    })

    return this._mapLetterRow(created)
  }

  async submitForApproval(idOrRef, user) {
    const existing = await this._resolveLetter(idOrRef)
    if (!existing) throw new AppError('Letter record not found.', 404, 'NOT_FOUND')
    if (existing.status === 'ISSUED') {
      throw new AppError('Issued letters cannot be resubmitted.', 400, 'INVALID_TRANSITION')
    }

    const meta = this._parseLetterMeta(existing)
    const isCreator = meta.preparedById === user.id || existing.employeeId === user.employeeId
    if (!this._isHrOrSuper(user) && !isCreator) {
      throw new AppError('You do not have permission to submit this letter.', 403, 'FORBIDDEN')
    }

    const actorName = this._actorName(user)
    const nowIso = new Date().toISOString()
    const nextMeta = {
      ...meta,
      approvalStatus: 'Pending Approval',
      submittedBy: actorName,
      submittedAt: nowIso,
      auditTrail: [
        ...(meta.auditTrail || []),
        { action: 'Submitted for Approval', by: actorName, role: user.role, at: nowIso, remarks: 'Routed for authorization' }
      ]
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.issuedHrLetter.update({
        where: { id: existing.id },
        data: {
          status: 'PENDING_APPROVAL',
          remarks: this._encodeLetterMeta(nextMeta)
        },
        include: {
          template: true,
          employee: { include: { department: { select: { id: true, name: true } }, designation: { select: { id: true, title: true } } } }
        }
      })

      await this._logAudit(tx, {
        user,
        actionType: 'LETTER_SUBMITTED',
        entityName: 'IssuedHrLetter',
        entityId: nextMeta.letterId || row.referenceNumber,
        before: { status: existing.status },
        after: { status: row.status },
        notes: 'Submitted letter for approval',
        employeeId: row.employeeId
      })
      return row
    })

    return this._mapLetterRow(updated)
  }

  async approveLetter(idOrRef, user, remarks = '') {
    if (!this._isHrOrSuper(user)) {
      throw new AppError('Only HR Admin or Super Admin can approve HR letters.', 403, 'FORBIDDEN')
    }

    const existing = await this._resolveLetter(idOrRef)
    if (!existing) throw new AppError('Letter record not found.', 404, 'NOT_FOUND')
    if (existing.status === 'ISSUED') {
      throw new AppError('Letter has already been officially issued.', 400, 'INVALID_TRANSITION')
    }

    const meta = this._parseLetterMeta(existing)
    const isProtectedSalary = Boolean(meta.isProtectedSalary || PROTECTED_SALARY_TYPES.includes(meta.letterType))

    if (isProtectedSalary && !this._isSuperAdmin(user)) {
      throw new AppError(
        'Confidential salary revision/compensation letters require Super Admin executive approval.',
        403,
        'FORBIDDEN'
      )
    }

    // Strict anti-self-approval enforced for all non-Super-Admin roles; Super Admin bypasses cleanly
    const isOwnPrepared =
      meta.preparedById === user.id ||
      (user.employee?.employeeCode && meta.preparedByEmployeeCode === user.employee.employeeCode) ||
      (user.employeeId && existing.employeeId === user.employeeId)
    if (!this._isSuperAdmin(user) && isOwnPrepared) {
      throw new AppError(
        'Strict Anti-Self-Approval Policy: You cannot approve a letter that you prepared or submitted.',
        403,
        'SELF_APPROVAL_PROHIBITED'
      )
    }

    const actorName = this._actorName(user)
    const nowIso = new Date().toISOString()
    const nextMeta = {
      ...meta,
      approvalStatus: 'Approved',
      approvedBy: actorName,
      approvedById: user.id,
      approvedAt: nowIso,
      rejectionReason: null,
      auditTrail: [
        ...(meta.auditTrail || []),
        { action: 'Approved', by: actorName, role: user.role, at: nowIso, remarks: remarks || 'Executive approval granted' }
      ]
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.issuedHrLetter.update({
        where: { id: existing.id },
        data: {
          status: 'APPROVED',
          remarks: this._encodeLetterMeta(nextMeta)
        },
        include: {
          template: true,
          employee: { include: { department: { select: { id: true, name: true } }, designation: { select: { id: true, title: true } } } }
        }
      })

      await this._logAudit(tx, {
        user,
        actionType: 'LETTER_APPROVED',
        entityName: 'IssuedHrLetter',
        entityId: nextMeta.letterId || row.referenceNumber,
        before: { status: existing.status, approvalStatus: meta.approvalStatus },
        after: { status: row.status, approvalStatus: 'Approved' },
        notes: remarks || 'Letter approved',
        employeeId: row.employeeId
      })
      return row
    })

    return this._mapLetterRow(updated)
  }

  async rejectLetter(idOrRef, user, reason = '') {
    if (!this._isHrOrSuper(user)) {
      throw new AppError('Only HR Admin or Super Admin can reject HR letters.', 403, 'FORBIDDEN')
    }

    const existing = await this._resolveLetter(idOrRef)
    if (!existing) throw new AppError('Letter record not found.', 404, 'NOT_FOUND')
    if (existing.status === 'ISSUED') {
      throw new AppError('Cannot reject an already officially issued letter.', 400, 'INVALID_TRANSITION')
    }

    const cleanReason = String(reason || 'Returned for revision').trim()
    const meta = this._parseLetterMeta(existing)
    const actorName = this._actorName(user)
    const nowIso = new Date().toISOString()

    const nextMeta = {
      ...meta,
      approvalStatus: 'Rejected',
      rejectedBy: actorName,
      rejectedAt: nowIso,
      rejectionReason: cleanReason,
      auditTrail: [
        ...(meta.auditTrail || []),
        { action: 'Rejected', by: actorName, role: user.role, at: nowIso, remarks: cleanReason }
      ]
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.issuedHrLetter.update({
        where: { id: existing.id },
        data: {
          status: 'DRAFT',
          remarks: this._encodeLetterMeta(nextMeta)
        },
        include: {
          template: true,
          employee: { include: { department: { select: { id: true, name: true } }, designation: { select: { id: true, title: true } } } }
        }
      })

      await this._logAudit(tx, {
        user,
        actionType: 'LETTER_REJECTED',
        entityName: 'IssuedHrLetter',
        entityId: nextMeta.letterId || row.referenceNumber,
        before: { status: existing.status },
        after: { status: 'DRAFT', approvalStatus: 'Rejected' },
        notes: cleanReason,
        employeeId: row.employeeId
      })
      return row
    })

    return this._mapLetterRow(updated)
  }

  async issueLetter(idOrRef, user, remarks = '') {
    if (!this._isHrOrSuper(user)) {
      throw new AppError('Only HR Admin or Super Admin can issue official HR letters.', 403, 'FORBIDDEN')
    }

    const existing = await this._resolveLetter(idOrRef)
    if (!existing) throw new AppError('Letter record not found.', 404, 'NOT_FOUND')

    if (existing.status === 'ISSUED') {
      throw new AppError(
        `Duplicate issuance prevented: Letter has already been officially issued (${existing.referenceNumber}).`,
        409,
        'DUPLICATE_ISSUANCE'
      )
    }

    const meta = this._parseLetterMeta(existing)
    const isProtectedSalary = Boolean(meta.isProtectedSalary || PROTECTED_SALARY_TYPES.includes(meta.letterType))

    // Super Admin can directly issue without a prior separate approval step; non-Super-Admin needs APPROVED status
    if (!this._isSuperAdmin(user) && existing.status !== 'APPROVED') {
      throw new AppError('Letter must be formally approved before final official issuance.', 400, 'APPROVAL_REQUIRED')
    }
    if (isProtectedSalary && !this._isSuperAdmin(user) && existing.status !== 'APPROVED') {
      throw new AppError('Protected salary letters must be approved by Super Admin prior to issuance.', 403, 'FORBIDDEN')
    }

    const year = new Date().getFullYear()
    const actorName = this._actorName(user)
    const now = new Date()
    const nowIso = now.toISOString()

    const updated = await prisma.$transaction(async (tx) => {
      const issuedRefs = await tx.issuedHrLetter.findMany({
        where: { referenceNumber: { startsWith: `ISW-LTR-${year}-` } },
        select: { referenceNumber: true }
      })
      let maxSeq = 0
      const re = new RegExp(`^ISW-LTR-${year}-(\\d+)$`)
      for (const r of issuedRefs) {
        const m = re.exec(r.referenceNumber)
        if (m) maxSeq = Math.max(maxSeq, Number(m[1]))
      }
      const officialRef = `ISW-LTR-${year}-${String(maxSeq + 1).padStart(5, '0')}`

      const nextTrail = [...(meta.auditTrail || [])]
      if (existing.status !== 'APPROVED' && this._isSuperAdmin(user)) {
        nextTrail.push({
          action: 'Approved',
          by: actorName,
          role: user.role,
          at: nowIso,
          remarks: 'Super Admin executive direct authorization'
        })
      }
      nextTrail.push({
        action: 'Officially Issued',
        by: actorName,
        role: user.role,
        at: nowIso,
        remarks: remarks || `Published with immutable reference ${officialRef}`
      })

      const nextMeta = {
        ...meta,
        approvalStatus: 'Approved',
        approvedBy: meta.approvedBy || actorName,
        approvedById: meta.approvedById || user.id,
        approvedAt: meta.approvedAt || nowIso,
        issuedBy: actorName,
        issuedAt: nowIso,
        officialReferenceNumber: officialRef,
        auditTrail: nextTrail
      }

      const row = await tx.issuedHrLetter.update({
        where: { id: existing.id },
        data: {
          referenceNumber: officialRef,
          status: 'ISSUED',
          issuedDate: now,
          issuedById: user.id,
          documentUrl: `/api/v1/letters/verify/${officialRef}`,
          remarks: this._encodeLetterMeta(nextMeta)
        },
        include: {
          template: true,
          employee: { include: { department: { select: { id: true, name: true } }, designation: { select: { id: true, title: true } } } }
        }
      })

      await this._logAudit(tx, {
        user,
        actionType: 'LETTER_ISSUED',
        entityName: 'IssuedHrLetter',
        entityId: officialRef,
        before: { status: existing.status, letterId: meta.letterId },
        after: { status: 'ISSUED', officialRef },
        notes: remarks || `Officially issued with reference ${officialRef}`,
        employeeId: row.employeeId
      })
      return row
    })

    return this._mapLetterRow(updated)
  }

  // ==========================================================================
  // 4. GOVERNANCE & AUDIT HISTORY + KPIS
  // ==========================================================================

  async getAuditLogs(user) {
    if (!this._isHrOrSuper(user) && !this._isManagerOrLead(user)) {
      throw new AppError('Access denied: Audit governance logs require management or HR privileges.', 403, 'FORBIDDEN')
    }
    const logs = await prisma.auditLog.findMany({
      where: { sourceModule: 'HR_LETTERS' },
      orderBy: { createdAt: 'desc' },
      take: 250
    })
    return logs.map((l) => ({
      id: l.id,
      entityId: l.entityId,
      entityName: l.entityName,
      actionType: l.actionType,
      actorRole: l.actorRole,
      actorEmployeeCode: l.actorEmployeeCode,
      notes: l.reasonOrNotes,
      after: l.recordSnapshotAfter,
      createdAt: l.createdAt.toISOString()
    }))
  }

  async getKPIs(user) {
    const [templates, letters] = await Promise.all([
      this.getTemplates(),
      this.getLetters({}, user)
    ])
    return {
      totalTemplates: templates.length,
      activeTemplates: templates.filter((t) => t.status === 'Active').length,
      draftsCount: letters.filter((l) => l.status === 'Draft').length,
      pendingApprovalCount: letters.filter((l) => l.status === 'Pending Approval').length,
      approvedCount: letters.filter((l) => l.status === 'Approved').length,
      issuedCount: letters.filter((l) => l.status === 'Issued').length,
      totalLetters: letters.length
    }
  }
}

export const hrLettersService = new HrLettersService()
export default hrLettersService

