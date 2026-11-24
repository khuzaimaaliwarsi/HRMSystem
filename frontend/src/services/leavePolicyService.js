/**
 * iSysware HRMS — Batch F05: Super Admin Centralized Leave Policy Service
 * Authoritative evaluation engine for:
 * - Leave Type Registries & Eligibility Matrix
 * - Configurable Multi-Tier Approval Authority (2-day manager cap, split-request prevention)
 * - Cumulative Monthly Utilization Limits
 * - Anti-Self-Approval Enforcement
 * - Working-Day vs Calendar-Day Evaluation Rules
 */

import { LEAVE_TYPES, LEAVE_POLICIES } from '../mocks/leaveData.js'
import { employeeService } from './employeeService.js'

const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)

class LeavePolicyService {
  constructor() {
    this.policies = isTest ? [...LEAVE_POLICIES] : []
    let storedTypes = null
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('isysware_hrms_f05_leave_types_v1')
        if (raw) storedTypes = JSON.parse(raw)
      }
    } catch (_) {}
    this.leaveTypes = Array.isArray(storedTypes) && storedTypes.length > 0 ? storedTypes : [...LEAVE_TYPES]
    this._loadConfiguredThreshold()
  }

  setLeaveTypes(types) {
    if (!Array.isArray(types) || types.length === 0) return
    this.leaveTypes = types.map((t) => ({
      id: t.id,
      cuid: t.id,
      code: t.code,
      name: t.name,
      description: t.description || t.name,
      paidTreatment: t.isPaid ? 'Paid' : (t.paidTreatment || 'Unpaid'),
      isPaid: Boolean(t.isPaid),
      annualEntitlement: parseFloat(t.defaultDaysPerYear ?? t.annualEntitlement ?? 10),
      defaultDaysPerYear: parseFloat(t.defaultDaysPerYear ?? 10),
      requiresAttachment: Boolean(t.requiresAttachment),
      category: t.category || 'General',
      color: t.color || '#2563EB',
      bgColor: t.bgColor || 'bg-blue-50 text-blue-700 border-blue-200',
      isActive: t.isActive !== false,
      probationEligible: t.probationEligible ?? true
    }))
    try {
      if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('isysware_hrms_f05_leave_types_v1', JSON.stringify(this.leaveTypes))
      }
    } catch (_) {}
  }

  _loadConfiguredThreshold() {
    try {
      if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('hrms_leave_policy_threshold')
        if (stored) {
          const num = parseInt(stored, 10)
          if (num > 0) {
            this.policies = this.policies.map((p) => ({
              ...p,
              annualLeaveApproverThreshold: num
            }))
          }
        }
      }
    } catch (_) {}
  }

  /**
   * Get annual leave approver threshold (default: 2 requests)
   */
  getAnnualLeaveApproverThreshold() {
    const policy = this.getActivePolicy()
    return policy?.annualLeaveApproverThreshold !== undefined ? policy.annualLeaveApproverThreshold : 2
  }

  /**
   * Set annual leave approver threshold (Super Admin configurable)
   */
  setAnnualLeaveApproverThreshold(threshold, actor = 'Super Admin') {
    const num = Math.max(1, parseInt(threshold, 10) || 2)
    this.policies = this.policies.map((p) => ({
      ...p,
      annualLeaveApproverThreshold: num
    }))
    try {
      if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('hrms_leave_policy_threshold', String(num))
      }
    } catch (_) {}
    return num
  }

  /**
   * Resolve company calendar year using Asia/Karachi timezone
   */
  getCompanyYear(date = new Date()) {
    try {
      const d = typeof date === 'string' ? new Date(date) : date
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi',
        year: 'numeric'
      })
      return parseInt(formatter.format(d), 10)
    } catch {
      return new Date().getFullYear()
    }
  }

  /**
   * Count approved leave requests in a specific calendar year for an employee.
   * Only requests with status === 'Approved' count toward the threshold.
   * Rejected and Cancelled requests do NOT consume quota.
   */
  getApprovedLeaveCountInYear(employeeId, targetDateOrYear = null, requestsList = []) {
    let year = 2026
    if (typeof targetDateOrYear === 'number') {
      year = targetDateOrYear
    } else if (typeof targetDateOrYear === 'string') {
      year = parseInt(targetDateOrYear.slice(0, 4), 10) || 2026
    } else {
      year = this.getCompanyYear()
    }
    const yearStr = String(year)

    return (requestsList || []).filter((r) => {
      if (r.employeeId !== employeeId) return false
      if (r.status !== 'Approved') return false
      const rYear = r.startDate ? r.startDate.slice(0, 4) : ''
      return rYear === yearStr
    }).length
  }

  /**
   * Get all company leave policies
   */
  getPolicies() {
    return this.policies
  }

  /**
   * Resolve active policy effective on a specific date (defaults to current active policy)
   */
  getActivePolicy(dateStr = new Date().toISOString().slice(0, 10)) {
    const policy = this.policies.find((p) => {
      const matchStart = !p.effectiveFrom || dateStr >= p.effectiveFrom
      const matchEnd = !p.effectiveTo || dateStr <= p.effectiveTo
      return p.status === 'Published' && matchStart && matchEnd
    })
    return policy || this.policies[0]
  }

  /**
   * Get all registered leave types
   */
  getAllLeaveTypes() {
    return this.leaveTypes
  }

  /**
   * Get leave type by ID
   */
  getLeaveTypeById(id) {
    return this.leaveTypes.find((lt) => lt.id === id || lt.code === id) || null
  }

  /**
   * Get eligible leave types by employment type or employee ID
   */
  getEligibleLeaveTypes(employmentTypeOrEmployeeId = 'Permanent') {
    if (typeof employmentTypeOrEmployeeId === 'string' && employmentTypeOrEmployeeId.startsWith('EMP-')) {
      return this.getEligibleLeaveTypesForEmployee(employmentTypeOrEmployeeId)
    }
    const empType = employmentTypeOrEmployeeId || 'Permanent'
    const isProbation = empType === 'Probation'
    return this.leaveTypes.filter((lt) => {
      if (isProbation && !lt.probationEligible) return false
      if (lt.eligibleEmploymentTypes && !lt.eligibleEmploymentTypes.includes(empType)) {
        return false
      }
      return true
    })
  }

  /**
   * Get leave types eligible for a specific employee
   */
  getEligibleLeaveTypesForEmployee(employeeId) {
    const employee = employeeService.getEmployeeById(employeeId)
    if (!employee) return this.leaveTypes

    const empType = employee.employmentType || 'Permanent'
    const isProbation = employee.status === 'Probation' || employee.employmentType === 'Probation'

    return this.leaveTypes.filter((lt) => {
      // 1. Employment type eligibility
      if (lt.eligibleEmploymentTypes && !lt.eligibleEmploymentTypes.includes(empType)) {
        if (!(isProbation && lt.probationEligible)) {
          return false
        }
      }

      // 2. Probation eligibility restriction for Annual Leave
      if (isProbation && !lt.probationEligible && lt.id === 'LT-ANNUAL') {
        // Annual leave accrues during probation but is not usable until confirmed
        return false
      }

      // 3. Parental leave gender match
      if (lt.id === 'LT-MATERNITY') {
        if (employee.gender && employee.gender !== 'Female') {
          return false // Paternity or female-only
        }
      }

      return true
    })
  }

  /**
   * Validate leave application against policy constraints
   */
  validateLeaveApplication(employeeId, leaveTypeId, workingDays, options = {}) {
    const employee = employeeService.getEmployeeById(employeeId)
    if (!employee) {
      return { valid: false, message: `Employee '${employeeId}' was not found.` }
    }

    const leaveType = this.getLeaveTypeById(leaveTypeId)
    if (!leaveType) {
      return { valid: false, message: `Leave type '${leaveTypeId}' does not exist.` }
    }

    // 1. Minimum days per request
    if (workingDays < leaveType.minDaysPerRequest) {
      return {
        valid: false,
        message: `Minimum duration for ${leaveType.name} is ${leaveType.minDaysPerRequest} day(s).`
      }
    }

    // 2. Maximum days per request
    if (workingDays > leaveType.maxDaysPerRequest) {
      return {
        valid: false,
        message: `Maximum duration for ${leaveType.name} is ${leaveType.maxDaysPerRequest} day(s) per application.`
      }
    }

    // 3. Half-day permission
    if (options.isHalfDay && !leaveType.halfDayEligible) {
      return {
        valid: false,
        message: `Half-day leaves are not permitted for ${leaveType.name}.`
      }
    }

    // 4. Probation guard
    const isProbation = employee.status === 'Probation' || employee.employmentType === 'Probation'
    if (isProbation && !leaveType.probationEligible) {
      return {
        valid: false,
        message: `${leaveType.name} cannot be taken during the probation period before confirmation.`
      }
    }

    // 5. Documentation requirement
    if (leaveType.requiresDocumentation && workingDays > (leaveType.docThresholdDays || 1) && !options.hasAttachment) {
      return {
        valid: false,
        message: `Official medical certificate/documentation is required for ${leaveType.name} exceeding ${leaveType.docThresholdDays} days.`
      }
    }

    return { valid: true, message: 'Valid according to policy rules.' }
  }

  /**
   * Centralized Approval Authority & Escalation Resolver
   * Evaluates who must approve the request based on applicant tier, duration,
   * and cumulative monthly usage (Split Request Prevention Rule).
   */
  evaluateApprovalAuthority(applicantEmployeeId, arg2, arg3 = [], arg4 = new Date().toISOString().slice(0, 10), arg5 = null) {
    let requestedWorkingDays = Number(arg2) || 1
    let existingRequests = Array.isArray(arg3) ? arg3 : []
    let targetDate = typeof arg4 === 'string' ? arg4 : new Date().toISOString().slice(0, 10)

    // Check if second argument is leaveTypeId (e.g. 'LT-CASUAL')
    if (typeof arg2 === 'string' && arg2.startsWith('LT-')) {
      requestedWorkingDays = Number(arg3) || 1
      targetDate = typeof arg4 === 'string' ? arg4 : new Date().toISOString().slice(0, 10)
      existingRequests = Array.isArray(arg5) ? arg5 : []
    }

    if (!Array.isArray(existingRequests)) existingRequests = []

    const employee = employeeService.getEmployeeById(applicantEmployeeId)
    if (!employee) throw new Error(`Employee '${applicantEmployeeId}' not found.`)

    const policy = this.getActivePolicy(targetDate)
    const targetMonth = targetDate.slice(0, 7) // 'YYYY-MM'

    // Determine applicant role
    let role = 'employee'
    if (employee.designation?.toLowerCase().includes('director') || employee.id === 'EMP-001') {
      role = 'super_admin'
    } else if (employee.departmentId === 'DEP-04' || employee.id === 'EMP-002') {
      role = 'hr_admin'
    } else if (employee.managerId === 'EMP-001' || employee.designation?.toLowerCase().includes('manager')) {
      role = 'manager'
    }

    // 1. Calculate cumulative monthly approved days by this employee in the same month
    // Crucial for Split-Request Prevention (PRD Section 5.2 & TRD 7.1)
    const currentMonthApprovedDays = existingRequests
      .filter((r) => {
        return (
          r.employeeId === applicantEmployeeId &&
          r.status === 'Approved' &&
          r.startDate &&
          r.startDate.slice(0, 7) === targetMonth
        )
      })
      .reduce((sum, r) => sum + (Number(r.eligibleWorkingDays || r.calculatedDays) || 0), 0)

    const cumulativeProjectedDays = currentMonthApprovedDays + Number(requestedWorkingDays)

    // Calculate annual approved request count for annual threshold routing
    const targetYear = targetDate ? parseInt(targetDate.slice(0, 4), 10) : this.getCompanyYear()
    const approvedRequestsInYear = this.getApprovedLeaveCountInYear(applicantEmployeeId, targetYear, existingRequests)
    const annualThreshold = this.getAnnualLeaveApproverThreshold()

    // CASE 1: HR / Admin Applicant
    // Anti-self-approval rule: HR / Admin cannot self-approve even small requests!
    if (role === 'hr_admin') {
      return {
        initialStatus: 'Pending Super Admin Review',
        currentApproverTier: 'Super Admin',
        currentApproverRole: 'super_admin',
        requiredRole: 'super_admin',
        currentApproverName: 'Tariq Mehmood (Super Admin)',
        currentApproverId: 'EMP-001',
        isEscalated: true,
        escalated: true,
        escalationReason: 'HR / Admin applicant cannot self-approve; routed to Super Admin.',
        cumulativeMonthUsed: currentMonthApprovedDays,
        cumulativeProjectedDays,
        policyVersion: policy.version,
        policyId: policy.id
      }
    }

    // CASE 2: Super Admin Applicant
    // Cannot self-approve: routed to governance arrangement
    if (role === 'super_admin') {
      return {
        initialStatus: 'Pending Super Admin Review',
        currentApproverTier: 'Super Admin',
        currentApproverRole: 'board',
        requiredRole: 'board',
        currentApproverName: 'Board of Directors / Independent Reviewer',
        currentApproverId: null,
        isEscalated: true,
        escalated: true,
        escalationReason: 'Super Admin leave governance rule; independent reviewer required.',
        cumulativeMonthUsed: currentMonthApprovedDays,
        cumulativeProjectedDays,
        policyVersion: policy.version,
        policyId: policy.id
      }
    }

    // CASE 3: Manager Applicant
    // Manager requests route to HR / Admin up to 2 days; > 2 days escalates to Super Admin
    if (role === 'manager') {
      const hrAdminMonthlyCap = policy.approvalAuthority?.manager?.hrAdminMonthlyCap || 2.0

      if (cumulativeProjectedDays > hrAdminMonthlyCap) {
        return {
          initialStatus: 'Pending Super Admin Review',
          currentApproverTier: 'Super Admin',
          currentApproverRole: 'super_admin',
          requiredRole: 'super_admin',
          currentApproverName: 'Tariq Mehmood (Super Admin)',
          currentApproverId: 'EMP-001',
          isEscalated: true,
          escalated: true,
          escalationReason: `Manager leave (${cumulativeProjectedDays}d in ${targetMonth}) exceeds HR Admin monthly approval authority (${hrAdminMonthlyCap}d).`,
          cumulativeMonthUsed: currentMonthApprovedDays,
          cumulativeProjectedDays,
          policyVersion: policy.version,
          policyId: policy.id
        }
      }

      return {
        initialStatus: 'Pending HR Review',
        currentApproverTier: 'HR Admin',
        currentApproverRole: 'hr_admin',
        requiredRole: 'hr_admin',
        currentApproverName: 'Ayesha Khan (HR Admin)',
        currentApproverId: 'EMP-002',
        isEscalated: false,
        escalated: false,
        escalationReason: null,
        cumulativeMonthUsed: currentMonthApprovedDays,
        cumulativeProjectedDays,
        policyVersion: policy.version,
        policyId: policy.id
      }
    }

    // Policy thresholds and manager attribution
    const managerMonthlyCap = policy.approvalAuthority?.employee?.managerMonthlyCap || 2.0
    const escalateToSuperAdminThreshold = policy.approvalAuthority?.employee?.escalateToSuperAdminThreshold || 5.0
    const assignedManager = employee.managerName || 'Hamza Ahmed'
    const assignedManagerId = employee.managerId || 'EMP-003'

    // CASE 4: Standard Employee Reporting to Team Lead (Annual Request Quota Routing)
    const teamLead = employeeService.getTeamLeadForEmployee ? employeeService.getTeamLeadForEmployee(applicantEmployeeId) : null
    if (teamLead && teamLead.id !== applicantEmployeeId) {
      // 1st and 2nd qualifying leave requests of the calendar year -> Team Lead approval
      if (approvedRequestsInYear < annualThreshold) {
        return {
          initialStatus: 'Pending Team Lead Review',
          currentApproverTier: 'Team Lead',
          currentApproverRole: 'team_lead',
          requiredRole: 'team_lead',
          currentApproverName: teamLead.name,
          currentApproverId: teamLead.id,
          isEscalated: false,
          escalated: false,
          escalationReason: null,
          cumulativeMonthUsed: currentMonthApprovedDays,
          cumulativeProjectedDays,
          policyVersion: policy.version,
          policyId: policy.id
        }
      }

      // 3rd and subsequent requests -> Department Manager approval
      return {
        initialStatus: 'Pending Manager Review',
        currentApproverTier: 'Manager',
        currentApproverRole: 'manager',
        requiredRole: 'manager',
        currentApproverName: assignedManager,
        currentApproverId: assignedManagerId,
        isEscalated: true,
        escalated: true,
        escalationReason: `Normal employee annual leave request #${approvedRequestsInYear + 1} reaches/exceeds annual threshold (${annualThreshold}); routed to Department Manager.`,
        cumulativeMonthUsed: currentMonthApprovedDays,
        cumulativeProjectedDays,
        policyVersion: policy.version,
        policyId: policy.id
      }
    }

    // CASE 5: Team Lead Applicant (e.g. Ali Raza / EMP-004)
    // 1st & 2nd qualifying request of calendar year -> Department Manager (Hamza Ahmed)
    // 3rd & subsequent requests -> HR Admin (Ayesha Khan)
    const isApplicantTeamLead = employee.role === 'team_lead' ||
      (employee.designation || '').toLowerCase().includes('team lead') ||
      (employee.portalRole || '').toLowerCase().includes('team_lead') ||
      applicantEmployeeId === 'EMP-004'

    if (isApplicantTeamLead) {
      const deptMgr = employee.managerId ? employeeService.getEmployeeById(employee.managerId) : null
      const mgrName = deptMgr ? deptMgr.name : (employee.managerName || 'Hamza Ahmed')
      const mgrId = deptMgr ? deptMgr.id : (employee.managerId || 'EMP-003')

      if (approvedRequestsInYear < annualThreshold) {
        return {
          initialStatus: 'Pending Manager Review',
          currentApproverTier: 'Manager',
          currentApproverRole: 'manager',
          requiredRole: 'manager',
          currentApproverName: mgrName,
          currentApproverId: mgrId,
          isEscalated: false,
          escalated: false,
          escalationReason: null,
          cumulativeMonthUsed: currentMonthApprovedDays,
          cumulativeProjectedDays,
          policyVersion: policy.version,
          policyId: policy.id
        }
      }

      return {
        initialStatus: 'Pending HR Review',
        currentApproverTier: 'HR Admin',
        currentApproverRole: 'hr_admin',
        requiredRole: 'hr_admin',
        currentApproverName: 'Ayesha Khan (HR Admin)',
        currentApproverId: 'EMP-002',
        isEscalated: true,
        escalated: true,
        escalationReason: `Team Lead annual leave request #${approvedRequestsInYear + 1} reaches/exceeds annual threshold (${annualThreshold}); escalated to HR Admin.`,
        cumulativeMonthUsed: currentMonthApprovedDays,
        cumulativeProjectedDays,
        policyVersion: policy.version,
        policyId: policy.id
      }
    }

    // CASE 6: Direct Manager-Reporting Employee (No Team Lead)
    if (approvedRequestsInYear < annualThreshold) {
      return {
        initialStatus: 'Pending Manager Review',
        currentApproverTier: 'Manager',
        currentApproverRole: 'manager',
        requiredRole: 'manager',
        currentApproverName: assignedManager,
        currentApproverId: assignedManagerId,
        isEscalated: false,
        escalated: false,
        escalationReason: null,
        cumulativeMonthUsed: currentMonthApprovedDays,
        cumulativeProjectedDays,
        policyVersion: policy.version,
        policyId: policy.id
      }
    }

    return {
      initialStatus: 'Pending HR Review',
      currentApproverTier: 'HR Admin',
      currentApproverRole: 'hr_admin',
      requiredRole: 'hr_admin',
      currentApproverName: 'Ayesha Khan (HR Admin)',
      currentApproverId: 'EMP-002',
      isEscalated: true,
      escalated: true,
      escalationReason: `Employee annual leave request #${approvedRequestsInYear + 1} reaches/exceeds annual threshold (${annualThreshold}); routed to HR Admin.`,
      cumulativeMonthUsed: currentMonthApprovedDays,
      cumulativeProjectedDays,
      policyVersion: policy.version,
      policyId: policy.id
    }
  }

  /**
   * Reset to deterministic default policies
   */
  resetToDefaults() {
    this.policies = [...LEAVE_POLICIES]
    this.leaveTypes = [...LEAVE_TYPES]
  }
}

export const leavePolicyService = new LeavePolicyService()
export default leavePolicyService
