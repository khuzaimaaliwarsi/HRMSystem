/**
 * iSysware HRMS — Unified Approval Authority & Escalation Matrix Service (Batch F13)
 * Authoritative single engine for multi-tier approval routing across:
 * - Leaves, Attendance Corrections, WFH/Field Duty, Overtime
 * - Recruitment Requisitions, Job Offers, Probation Confirmations
 * - Salary Revisions, Bonuses, Loans/Advances
 * - Training Requests, Travel Requests, Pick-and-Drop Transport
 * - Expense Claims, Protected Corporate HR Letters, Help Desk Escalations
 */

import { INITIAL_APPROVAL_RULES } from '../mocks/policyData.js'
import { employeeService } from './employeeService.js'
import { auditService } from './auditService.js'
import { attendancePolicyService } from './attendancePolicyService.js'
import { leavePolicyService } from './leavePolicyService.js'

const STORAGE_KEYS = {
  RULES: 'isysware_hrms_f13_approval_rules_v1'
}

class ApprovalRuleService {
  constructor() {
    this.listeners = new Set()
    this.memoryStorage = {}
    this._initialize()
  }

  _getItem(key, defaultVal) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key)
        return item ? JSON.parse(item) : defaultVal
      }
    } catch {
      // Fallback
    }
    return this.memoryStorage[key] !== undefined ? this.memoryStorage[key] : defaultVal
  }

  _setItem(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value))
      }
    } catch {
      // Fallback
    }
    this.memoryStorage[key] = value
  }

  _migrateLeaveRules(rules) {
    if (!Array.isArray(rules)) return INITIAL_APPROVAL_RULES
    let updated = false
    const migrated = rules.map((r) => {
      if (r.id === 'APV-LEV-STD' && (r.initialApprover === 'Manager' || r.cumulativePeriod === 'monthly')) {
        updated = true
        return {
          ...r,
          requestType: 'Normal Employee Leave',
          threshold: 2,
          thresholdUnit: 'requests/year',
          initialApprover: 'Team Lead',
          initialApproverRole: 'team_lead',
          escalationApprover: 'Department Manager',
          escalationApproverRole: 'manager',
          cumulativePeriod: 'annual',
          description: 'Normal employee: 1st and 2nd qualifying annual leave requests approved by Team Lead (Final Approved). 3rd and subsequent requests escalate to Department Manager.'
        }
      }
      return r
    })

    if (!migrated.some((r) => r.id === 'APV-LEV-TL')) {
      updated = true
      const tlRule = {
        id: 'APV-LEV-TL',
        module: 'leaves',
        requestType: 'Team Lead Leave',
        applicantTier: 'team_lead',
        threshold: 2,
        thresholdUnit: 'requests/year',
        initialApprover: 'Department Manager',
        initialApproverRole: 'manager',
        escalationApprover: 'HR Admin',
        escalationApproverRole: 'hr_admin',
        finalAuthority: 'Super Admin',
        finalAuthorityRole: 'super_admin',
        cumulativePeriod: 'annual',
        antiSelfApproval: true,
        description: 'Team Lead: 1st and 2nd qualifying annual leave requests approved by Department Manager (Final Approved). 3rd and subsequent requests escalate to HR Admin.'
      }
      const stdIdx = migrated.findIndex((r) => r.id === 'APV-LEV-STD')
      if (stdIdx !== -1) {
        migrated.splice(stdIdx + 1, 0, tlRule)
      } else {
        migrated.push(tlRule)
      }
    }

    if (updated) {
      this._setItem(STORAGE_KEYS.RULES, migrated)
    }
    return migrated
  }

  _initialize() {
    const raw = this._getItem(STORAGE_KEYS.RULES, null)
    if (!raw) {
      this._setItem(STORAGE_KEYS.RULES, INITIAL_APPROVAL_RULES)
    } else {
      this._migrateLeaveRules(raw)
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (err) {
        console.error('Error in approvalRuleService listener:', err)
      }
    }
  }

  resetAllData() {
    this.memoryStorage[STORAGE_KEYS.RULES] = JSON.parse(JSON.stringify(INITIAL_APPROVAL_RULES))
    this._setItem(STORAGE_KEYS.RULES, JSON.parse(JSON.stringify(INITIAL_APPROVAL_RULES)))
    this._notify()
  }

  /**
   * Get all approval rules
   */
  getRules(moduleFilter = 'all') {
    const raw = this._getItem(STORAGE_KEYS.RULES, INITIAL_APPROVAL_RULES)
    const list = this._migrateLeaveRules(raw)
    if (!moduleFilter || moduleFilter === 'all') return list
    return list.filter((r) => r.module.toLowerCase() === moduleFilter.toLowerCase())
  }

  /**
   * Get rule by ID
   */
  getRuleById(id) {
    const list = this.getRules()
    return list.find((r) => r.id === id) || null
  }

  /**
   * Universal Approval Routing Evaluator
   * Computes the required approver tier, detects anti-self-approval, and handles escalations.
   *
   * @param {Object} params
   * @param {string} params.module - e.g. 'leaves', 'expenses', 'payroll', 'travel'
   * @param {string} params.applicantId - ID of employee submitting request
   * @param {number} params.amountOrDays - Requested duration or financial amount
   * @param {number} params.cumulativeAmountOrDays - Cumulative total used by applicant in current period
   * @param {string} params.requestType - Optional request identifier
   * @returns {Object} Resolution details
   */
  evaluateApprovalRouting({
    module,
    applicantId,
    amountOrDays = 1,
    cumulativeAmountOrDays = 0,
    annualRequestCount = null,
    priorApprovedRequestsThisYear = null,
    requestType = null
  }) {
    const employee = employeeService.getEmployeeById(applicantId)
    if (!employee) throw new Error(`Applicant employee '${applicantId}' not found.`)

    // Determine applicant tier
    let applicantTier = 'employee'
    if (employee.designation?.toLowerCase().includes('director') || employee.id === 'EMP-001') {
      applicantTier = 'super_admin'
    } else if (employee.departmentId === 'DEP-04' || employee.id === 'EMP-002') {
      applicantTier = 'hr_admin'
    } else if (employee.managerId === 'EMP-001' || employee.designation?.toLowerCase().includes('manager') || employee.id === 'EMP-003') {
      applicantTier = 'manager'
    }

    const assignedManagerId = employee.managerId || 'EMP-003'
    const assignedManagerName = employee.managerName || 'Bilal Siddiqui'

    // Total projected quantity
    const projectedQuantity = cumulativeAmountOrDays + amountOrDays

    // 1. Module-Specific Resolution
    if (module === 'leaves') {
      const annualRequests = annualRequestCount !== null && annualRequestCount !== undefined
        ? Number(annualRequestCount)
        : priorApprovedRequestsThisYear !== null && priorApprovedRequestsThisYear !== undefined
        ? Number(priorApprovedRequestsThisYear)
        : Number(cumulativeAmountOrDays) || 0

      const annualThreshold = leavePolicyService.getAnnualLeaveApproverThreshold
        ? leavePolicyService.getAnnualLeaveApproverThreshold()
        : 2

      // RULE 1: HR Admin cannot self-approve; routes to Super Admin
      if (applicantTier === 'hr_admin') {
        return {
          currentApproverTier: 'Super Admin',
          currentApproverRole: 'super_admin',
          currentApproverId: 'EMP-001',
          currentApproverName: 'Tariq Mehmood (Super Admin)',
          isEscalated: true,
          escalationReason: 'Anti-Self-Approval: HR / Admin leave request must be approved by Super Admin.'
        }
      }

      // RULE 2: Super Admin leave request (universal direct authority)
      if (applicantTier === 'super_admin') {
        return {
          currentApproverTier: 'Super Admin',
          currentApproverRole: 'super_admin',
          currentApproverId: 'EMP-001',
          currentApproverName: 'Super Admin (Direct Authority)',
          isEscalated: false,
          escalationReason: 'Super Admin has full executive authority and does not require approval from another user.'
        }
      }

      const tl = employeeService.getTeamLeadForEmployee ? employeeService.getTeamLeadForEmployee(applicantId) : null

      // Resolve Department Manager for applicant
      let deptManagerId = 'EMP-003'
      let deptManagerName = 'Hamza Ahmed (Department Manager)'
      if (employee.departmentId === 'DEP-01' || applicantId === 'EMP-004' || applicantId === 'EMP-005' || applicantId === 'EMP-006') {
        deptManagerId = 'EMP-003'
        deptManagerName = 'Hamza Ahmed (Department Manager)'
      } else if (employee.managerId) {
        const directMgr = employeeService.getEmployeeById(employee.managerId)
        if (directMgr && directMgr.id !== tl?.id) {
          deptManagerId = directMgr.id
          deptManagerName = `${directMgr.name} (Department Manager)`
        }
      }

      // RULE 3: Team Lead Applicant (e.g. Ali Raza / EMP-004)
      const isTeamLead = employee.role === 'team_lead' ||
        (employee.designation || '').toLowerCase().includes('team lead') ||
        (employee.portalRole || '').toLowerCase().includes('team_lead') ||
        applicantId === 'EMP-004'

      if (isTeamLead) {
        // 1st & 2nd qualifying request in year -> Department Manager (Hamza Ahmed)
        if (annualRequests < annualThreshold) {
          return {
            currentApproverTier: 'Manager',
            currentApproverRole: 'manager',
            currentApproverId: deptManagerId,
            currentApproverName: deptManagerName,
            isEscalated: false,
            escalationReason: null
          }
        }
        // 3rd & subsequent requests -> HR Admin (Ayesha Khan)
        return {
          currentApproverTier: 'HR Admin',
          currentApproverRole: 'hr_admin',
          currentApproverId: 'EMP-002',
          currentApproverName: 'Ayesha Khan (HR Admin)',
          isEscalated: true,
          escalationReason: `Team Lead annual leave request #${annualRequests + 1} reaches/exceeds annual threshold (${annualThreshold}); escalated to HR Admin.`
        }
      }

      // RULE 4: Department Manager Applicant
      if (applicantTier === 'manager') {
        return {
          currentApproverTier: 'HR Admin',
          currentApproverRole: 'hr_admin',
          currentApproverId: 'EMP-002',
          currentApproverName: 'Ayesha Khan (HR Admin)',
          isEscalated: false,
          escalationReason: null
        }
      }

      // RULE 5: Standard Employee Applicant
      // If employee reports to a Team Lead (e.g. Ahmed Khan / EMP-005)
      if (tl && tl.id !== applicantId) {
        // 1st & 2nd qualifying request of the calendar year -> Team Lead approval (Ali Raza)
        if (annualRequests < annualThreshold) {
          return {
            currentApproverTier: 'Team Lead',
            currentApproverRole: 'team_lead',
            currentApproverId: tl.id,
            currentApproverName: tl.name,
            isEscalated: false,
            escalationReason: null
          }
        }
        // 3rd and subsequent requests -> Department Manager approval (Hamza Ahmed)
        return {
          currentApproverTier: 'Manager',
          currentApproverRole: 'manager',
          currentApproverId: deptManagerId,
          currentApproverName: deptManagerName,
          isEscalated: true,
          escalationReason: `Normal employee annual leave request #${annualRequests + 1} reaches/exceeds annual threshold (${annualThreshold}); routed to Department Manager.`
        }
      }

      // Direct Manager-Reporting Employee (No Team Lead)
      if (annualRequests < annualThreshold) {
        return {
          currentApproverTier: 'Manager',
          currentApproverRole: 'manager',
          currentApproverId: deptManagerId,
          currentApproverName: deptManagerName,
          isEscalated: false,
          escalationReason: null
        }
      }

      return {
        currentApproverTier: 'HR Admin',
        currentApproverRole: 'hr_admin',
        currentApproverId: 'EMP-002',
        currentApproverName: 'Ayesha Khan (HR Admin)',
        isEscalated: true,
        escalationReason: `Employee annual leave request #${annualRequests + 1} reaches/exceeds annual threshold (${annualThreshold}); routed to HR Admin.`
      }
    }

    // 2. Expenses Module Resolution
    if (module === 'expenses') {
      const amount = Number(amountOrDays)

      // Super Admin executive authority (no upward board dependency)
      if (applicantTier === 'super_admin') {
        return {
          currentApproverTier: 'Super Admin',
          currentApproverRole: 'super_admin',
          currentApproverId: 'EMP-001',
          currentApproverName: 'Super Admin (Direct Authority)',
          isEscalated: false,
          escalationReason: 'Super Admin expense claims can be directly authorized under executive authority.'
        }
      }

      if (applicantTier === 'hr_admin') {
        // HR Admin claim must be approved by Super Admin
        return {
          currentApproverTier: 'Super Admin',
          currentApproverRole: 'super_admin',
          currentApproverId: 'EMP-001',
          currentApproverName: 'Tariq Mehmood (Super Admin)',
          isEscalated: true,
          escalationReason: 'HR / Admin applicant cannot review own claim; routed to Super Admin.'
        }
      }

      if (applicantTier === 'manager') {
        // Manager's claim routes to HR Admin (if <= 75,000) or Super Admin (> 75,000)
        if (amount > 75000) {
          return {
            currentApproverTier: 'Super Admin',
            currentApproverRole: 'super_admin',
            currentApproverId: 'EMP-001',
            currentApproverName: 'Tariq Mehmood (Super Admin)',
            isEscalated: true,
            escalationReason: `Manager claim amount (PKR ${amount.toLocaleString()}) exceeds HR authority limit (PKR 75,000).`
          }
        }
        return {
          currentApproverTier: 'HR Admin',
          currentApproverRole: 'hr_admin',
          currentApproverId: 'EMP-002',
          currentApproverName: 'Ayesha Khan (HR Admin)',
          isEscalated: false,
          escalationReason: null
        }
      }

      // Standard employee expense claim
      if (amount > 75000) {
        return {
          currentApproverTier: 'Super Admin',
          currentApproverRole: 'super_admin',
          currentApproverId: 'EMP-001',
          currentApproverName: 'Tariq Mehmood (Super Admin)',
          isEscalated: true,
          escalationReason: `Claim amount (PKR ${amount.toLocaleString()}) exceeds HR limit (PKR 75,000).`
        }
      }
      if (amount > 25000) {
        return {
          currentApproverTier: 'HR Admin',
          currentApproverRole: 'hr_admin',
          currentApproverId: 'EMP-002',
          currentApproverName: 'Ayesha Khan (HR Admin)',
          isEscalated: true,
          escalationReason: `Claim amount (PKR ${amount.toLocaleString()}) exceeds Manager limit (PKR 25,000).`
        }
      }

      return {
        currentApproverTier: 'Manager',
        currentApproverRole: 'manager',
        currentApproverId: assignedManagerId,
        currentApproverName: assignedManagerName,
        isEscalated: false,
        escalationReason: null
      }
    }

    // 3. Payroll / Salary Revision Resolution
    if (module === 'payroll' || requestType === 'salary_revision') {
      // Salary revision proposals strictly require Super Admin final authority
      return {
        currentApproverTier: 'Super Admin',
        currentApproverRole: 'super_admin',
        currentApproverId: 'EMP-001',
        currentApproverName: 'Tariq Mehmood (Super Admin)',
        isEscalated: true,
        escalationReason: 'Protected Governance: Salary revisions require exclusive Super Admin authorization.'
      }
    }

    // 4. Attendance & Field Duty Resolution
    if (module === 'attendance' || module === 'field_duty' || requestType === 'field_duty') {
      const hours = Number(amountOrDays)

      // Super Admin executive authority (no upward board dependency)
      if (applicantTier === 'super_admin') {
        return {
          currentApproverTier: 'Super Admin',
          currentApproverRole: 'super_admin',
          currentApproverId: 'EMP-001',
          currentApproverName: 'Super Admin (Direct Authority)',
          isEscalated: false,
          escalationReason: 'Super Admin field duty can be directly authorized under executive authority.'
        }
      }

      if (applicantTier === 'hr_admin') {
        return {
          currentApproverTier: 'Super Admin',
          currentApproverRole: 'super_admin',
          currentApproverId: 'EMP-001',
          currentApproverName: 'Tariq Mehmood (Super Admin)',
          isEscalated: true,
          escalationReason: 'Anti-Self-Approval: HR Admin field duty must be authorized by Super Admin.'
        }
      }

      if (applicantTier === 'manager') {
        return {
          currentApproverTier: 'HR Admin',
          currentApproverRole: 'hr_admin',
          currentApproverId: 'EMP-002',
          currentApproverName: 'Ayesha Khan (HR Admin)',
          isEscalated: true,
          escalationReason: 'Manager Field Duty requires HR Admin authorization.'
        }
      }

      // Check for Team Lead
      const tl = employeeService.getTeamLeadForEmployee ? employeeService.getTeamLeadForEmployee(applicantId) : null
      const hasTeamLead = tl && tl.id !== applicantId
      const tlApproverName = tl?.id === 'EMP-004' ? (tl.name === 'Zeeshan Ali' ? 'Ali Raza' : tl.name) : tl?.name

      // Canonical Department Manager resolution
      let deptManagerId = 'EMP-003'
      let deptManagerName = 'Hamza Ahmed (EMP-003)'

      if (employee.departmentId === 'DEP-01' || applicantId === 'EMP-004' || applicantId === 'EMP-005' || applicantId === 'EMP-006') {
        deptManagerId = 'EMP-003'
        deptManagerName = 'Hamza Ahmed (EMP-003)'
      } else if (employee.managerId) {
        const directMgr = employeeService.getEmployeeById(employee.managerId)
        if (directMgr && directMgr.id !== tl?.id && (directMgr.role === 'manager' || (directMgr.designation || '').toLowerCase().includes('manager') || directMgr.id === 'EMP-003')) {
          deptManagerId = directMgr.id
          deptManagerName = directMgr.id === 'EMP-003' ? 'Hamza Ahmed (EMP-003)' : `${directMgr.name} (${directMgr.id})`
        }
      }

      const activePolicy = attendancePolicyService?.getActivePolicy ? attendancePolicyService.getActivePolicy() : null
      const fieldLimits = activePolicy?.fieldDutyApprovalLimits || {}
      const mode = fieldLimits.mode || 'duration_based'
      const tlLimit = fieldLimits.teamLeadMaxHours !== undefined ? fieldLimits.teamLeadMaxHours : 4.0
      const mgrLimit = fieldLimits.managerMaxHours !== undefined ? fieldLimits.managerMaxHours : 9.0

      // MODE 1: No Duration Limit (Team Lead can approve direct reports)
      if (mode === 'no_limit') {
        if (hasTeamLead) {
          return {
            currentApproverTier: 'Team Lead',
            currentApproverRole: 'team_lead',
            currentApproverId: tl.id,
            currentApproverName: tlApproverName,
            isEscalated: false,
            escalationReason: null
          }
        } else {
          return {
            currentApproverTier: 'Department Manager',
            currentApproverRole: 'manager',
            currentApproverId: deptManagerId,
            currentApproverName: deptManagerName,
            isEscalated: false,
            escalationReason: null
          }
        }
      }

      // MODE 2: Manager Approval Only
      if (mode === 'manager_only') {
        if (hours > mgrLimit) {
          return {
            currentApproverTier: 'HR Admin',
            currentApproverRole: 'hr_admin',
            currentApproverId: 'EMP-002',
            currentApproverName: 'Ayesha Khan (HR Admin)',
            isEscalated: true,
            escalationReason: `Field duty duration (${hours} hrs) exceeds Department Manager ${mgrLimit}-hour limit; requires HR Admin exception authorization.`
          }
        }
        return {
          currentApproverTier: 'Department Manager',
          currentApproverRole: 'manager',
          currentApproverId: deptManagerId,
          currentApproverName: deptManagerName,
          isEscalated: hasTeamLead,
          escalationReason: hasTeamLead ? 'Policy requires Department Manager approval for all Field Duty requests.' : null
        }
      }

      // MODE 3: Duration-Based Limits (Default)
      if (hours > mgrLimit) {
        return {
          currentApproverTier: 'HR Admin',
          currentApproverRole: 'hr_admin',
          currentApproverId: 'EMP-002',
          currentApproverName: 'Ayesha Khan (HR Admin)',
          isEscalated: true,
          escalationReason: `Field duty duration (${hours} hrs) exceeds Department Manager ${mgrLimit}.0-hour shift limit; requires HR Admin exception authorization.`
        }
      }

      if (hours > tlLimit || !hasTeamLead) {
        return {
          currentApproverTier: 'Department Manager',
          currentApproverRole: 'manager',
          currentApproverId: deptManagerId,
          currentApproverName: deptManagerName,
          isEscalated: hasTeamLead,
          escalationReason: hasTeamLead
            ? `Field duty duration (${hours} hrs) exceeds Team Lead ${tlLimit}.0-hour direct limit; escalated to Department Manager for full-shift coverage authorization.`
            : null
        }
      }

      return {
        currentApproverTier: 'Team Lead',
        currentApproverRole: 'team_lead',
        currentApproverId: tl.id,
        currentApproverName: tlApproverName,
        isEscalated: false,
        escalationReason: null
      }
    }

    // Default Fallback Routing
    return {
      currentApproverTier: 'Manager',
      currentApproverRole: 'manager',
      currentApproverId: assignedManagerId,
      currentApproverName: assignedManagerName,
      isEscalated: false,
      escalationReason: null
    }
  }

  getPriorApprovedLeaveCountThisYear(employeeId, year = null) {
    const list = this._getItem('isysware_hrms_f05_leave_requests_v1', [])
    return leavePolicyService.getApprovedLeaveCountInYear(employeeId, year, list)
  }

  /**
   * Update an approval authority rule (Super Admin protected)
   */
  updateRule(id, updates, actorUser = { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }) {
    if (actorUser.role !== 'super_admin') {
      throw new Error('Unauthorized: Only Super Admin can modify the Approval Authority Matrix.')
    }

    const list = [...this.getRules()]
    const idx = list.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error(`Approval rule '${id}' not found.`)

    const current = list[idx]
    list[idx] = { ...current, ...updates }
    this._setItem(STORAGE_KEYS.RULES, list)

    auditService.logEvent({
      actor: `${actorUser.name} (Super Admin)`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'APPROVAL_MATRIX_MODIFIED',
      entity: current.id,
      entityName: current.requestType,
      previousValue: `Threshold: ${current.threshold}, Initial: ${current.initialApprover}, Esc: ${current.escalationApprover}`,
      newValue: `Threshold: ${list[idx].threshold}, Initial: ${list[idx].initialApprover}, Esc: ${list[idx].escalationApprover}`,
      reason: 'Approval matrix parameter revised by Super Admin',
      policyVersion: '1.0',
      scope: 'company_wide'
    })

    this._notify()
    return list[idx]
  }
}

export const approvalRuleService = new ApprovalRuleService()
export default approvalRuleService
