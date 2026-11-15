/**
 * iSysware HRMS — Centralized Company Policy Engine (Batch F13)
 * Authoritative single source of truth for all enterprise policies:
 * - 4-Level Precedence Hierarchy:
 *   1. Authorized Employee-Specific Exception (precedence 1)
 *   2. Department / Team-Specific Policy (precedence 2)
 *   3. Role / Employment Category Policy (precedence 3)
 *   4. General Company Policy (precedence 4)
 * - Versioning, Effective-Date Scheduling, and Immutability of Historical Finalized Records
 * - Conflict Detection & Multi-Module Adapters
 */

import { INITIAL_POLICIES } from '../mocks/policyData.js'
import { employeeService } from './employeeService.js'
import { auditService } from './auditService.js'
import apiClient from './apiClient.js'

const CANONICAL_PROTECTED_POLICY_IDS = [
  'POL-ATT-001',
  'POL-LEV-001',
  'POL-PAY-001',
  'POL-EXP-001',
  'POL-TRV-001'
]

const STORAGE_KEYS = {
  POLICIES: 'isysware_hrms_f13_central_policies_v1'
}

function isActorSuperAdmin(actorUser) {
  if (!actorUser) return false
  const r = String(actorUser.role || '').toLowerCase()
  const br = String(actorUser.backendRole || '').toLowerCase()
  return r === 'super_admin' || r === 'superadmin' || br === 'super_admin' || br === 'superadmin'
}

class PolicyService {
  constructor() {
    this.listeners = new Set()
    this.memoryStorage = {}
    this._initialize()
  }

  _getItem(key, defaultVal) {
    if (this.memoryStorage[key] !== undefined) return this.memoryStorage[key]
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(key)
        return item ? JSON.parse(item) : defaultVal
      } catch {
        // Fallback
      }
    }
    return defaultVal
  }

  _setItem(key, value) {
    this.memoryStorage[key] = value
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Fallback
      }
    }
  }

  _initialize() {
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT) {
      if (!this._getItem(STORAGE_KEYS.POLICIES, null)) {
        this._setItem(STORAGE_KEYS.POLICIES, INITIAL_POLICIES)
      }
    } else {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(STORAGE_KEYS.POLICIES)
          window.localStorage.removeItem('isysware_hrms_f13_central_policies_v1')
        }
      } catch {
        // Fallback
      }
      this.memoryStorage[STORAGE_KEYS.POLICIES] = []
    }
  }

  /**
   * Fetch live company policies from PostgreSQL backend
   */
  async fetchPoliciesFromBackend() {
    try {
      const response = await apiClient.get('/admin/company-policies')
      const backendPolicies = response?.data || response
      if (Array.isArray(backendPolicies) && backendPolicies.length > 0) {
        this._setItem(STORAGE_KEYS.POLICIES, backendPolicies)
        this._notify()
        return backendPolicies
      }
    } catch (err) {
      console.warn('Could not fetch company policies from backend, using cached state:', err.message)
    }
    return this.getAllPolicies()
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
        console.error('Error in policyService listener:', err)
      }
    }
  }

  resetAllData() {
    this.memoryStorage[STORAGE_KEYS.POLICIES] = JSON.parse(JSON.stringify(INITIAL_POLICIES))
    this._setItem(STORAGE_KEYS.POLICIES, JSON.parse(JSON.stringify(INITIAL_POLICIES)))
    this._notify()
  }

  /**
   * Retrieve all policies
   */
  getAllPolicies(filters = {}) {
    const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)
    let list = this._getItem(STORAGE_KEYS.POLICIES, isTest ? INITIAL_POLICIES : [])
    if (!Array.isArray(list)) {
      list = Array.isArray(INITIAL_POLICIES) ? INITIAL_POLICIES : []
    }

    if (filters.category && filters.category !== 'all') {
      list = list.filter((p) => p.category.toLowerCase() === filters.category.toLowerCase())
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter((p) => p.status.toLowerCase() === filters.status.toLowerCase())
    }
    if (filters.appliesTo && filters.appliesTo !== 'all') {
      list = list.filter((p) => p.appliesTo.toLowerCase() === filters.appliesTo.toLowerCase())
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
    }

    return list
  }

  /**
   * Get policy by ID
   */
  getPolicyById(id) {
    const list = this.getAllPolicies()
    return list.find((p) => p.id === id) || null
  }

  /**
   * Check if policy is protected / canonical
   */
  isPolicyProtected(id) {
    if (CANONICAL_PROTECTED_POLICY_IDS.includes(id)) return true
    const p = this.getPolicyById(id)
    return Boolean(p?.isProtected)
  }

  /**
   * Resolve applicable effective policy using documented Precedence Hierarchy:
   * 1. Employee-Specific Exception (precedence: 1)
   * 2. Department-Specific Policy (precedence: 2)
   * 3. Role-Specific Policy (precedence: 3)
   * 4. General Company-Wide Policy (precedence: 4)
   */
  resolveEffectivePolicy(category, context = {}) {
    const targetDate = context.date || new Date().toISOString().slice(0, 10)
    const employeeId = context.employeeId
    const departmentId = context.departmentId || (employeeId ? employeeService.getEmployeeById(employeeId)?.departmentId : null)
    const role = context.role || (employeeId ? employeeService.getEmployeeById(employeeId)?.role : null)

    const candidates = this.getAllPolicies({ category, status: 'Active' }).filter((p) => {
      const matchStart = !p.effectiveFrom || targetDate >= p.effectiveFrom
      const matchEnd = !p.effectiveTo || targetDate <= p.effectiveTo
      return matchStart && matchEnd
    })

    if (!candidates.length) {
      // Fallback to any active policy in that category or default
      const anyActive = this.getAllPolicies({ category }).find((p) => p.status === 'Active')
      return anyActive || null
    }

    // Sort candidates by precedence ascending (1 is highest priority)
    // 1: Employee-Specific match
    if (employeeId) {
      const empException = candidates.find((p) => p.appliesTo === 'Employee-Specific' && p.scopeValue === employeeId)
      if (empException) return empException
    }

    // 2: Department-Specific match
    if (departmentId) {
      const deptPolicy = candidates.find((p) => p.appliesTo === 'Department' && p.scopeValue === departmentId)
      if (deptPolicy) return deptPolicy
    }

    // 3: Role-Specific match
    if (role) {
      const rolePolicy = candidates.find((p) => p.appliesTo === 'Role' && p.scopeValue === role)
      if (rolePolicy) return rolePolicy
    }

    // 4: General Company-Wide policy (precedence 4)
    const companyPolicy = candidates.find((p) => p.appliesTo === 'Company-Wide')
    if (companyPolicy) return companyPolicy

    // Default to the candidate with lowest numeric precedence
    candidates.sort((a, b) => (a.precedence || 4) - (b.precedence || 4))
    return candidates[0]
  }

  /**
   * Conflict Detection Engine
   * Detects if another active policy with the exact same category, appliesTo, and scopeValue overlaps in effective dates
   */
  detectPolicyConflicts(policy) {
    const existing = this.getAllPolicies({ category: policy.category }).filter(
      (p) => p.id !== policy.id && p.status === 'Active' && p.appliesTo === policy.appliesTo && p.scopeValue === policy.scopeValue
    )

    const conflicts = []
    for (const other of existing) {
      const pStart = policy.effectiveFrom || '1970-01-01'
      const pEnd = policy.effectiveTo || '2099-12-31'
      const oStart = other.effectiveFrom || '1970-01-01'
      const oEnd = other.effectiveTo || '2099-12-31'

      // Check date range overlap
      if (pStart <= oEnd && pEnd >= oStart) {
        conflicts.push({
          conflictingPolicyId: other.id,
          conflictingPolicyName: other.name,
          reason: `Overlaps with active policy ${other.id} from ${other.effectiveFrom} to ${other.effectiveTo} for scope '${policy.scopeValue}'.`
        })
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    }
  }

  /**
   * Create a new company policy (Super Admin protected)
   */
  createPolicy(policyData, actorUser = { name: 'Super Admin', role: 'super_admin', id: 'EMP-001' }) {
    if (!isActorSuperAdmin(actorUser)) {
      throw new Error('Unauthorized: Only Super Admin has authority to create company policies.')
    }
    if (!policyData.name || !policyData.category) {
      throw new Error('Policy Name and Category are required.')
    }

    const list = [...this.getAllPolicies()]
    const nextSeq = list.length + 1
    const prefix = policyData.category.slice(0, 3).toUpperCase()
    const newId = `POL-${prefix}-${String(nextSeq).padStart(3, '0')}`

    // Assign precedence based on appliesTo
    let precedence = 4
    if (policyData.appliesTo === 'Employee-Specific') precedence = 1
    else if (policyData.appliesTo === 'Department') precedence = 2
    else if (policyData.appliesTo === 'Role') precedence = 3

    const newPolicy = {
      id: newId,
      name: policyData.name,
      category: policyData.category,
      description: policyData.description || '',
      appliesTo: policyData.appliesTo || 'Company-Wide',
      scopeValue: policyData.scopeValue || 'all',
      ruleType: policyData.ruleType || 'threshold',
      allowedLimit: Number(policyData.allowedLimit) || 0,
      calculationMethod: policyData.calculationMethod || 'fixed',
      effectiveFrom: policyData.effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: policyData.effectiveTo || '2026-12-31',
      version: '1.0',
      status: policyData.status || 'Active',
      precedence,
      rules: policyData.rules || {},
      approvalAuthorityRef: policyData.approvalAuthorityRef || '',
      createdBy: `${actorUser.name || 'Super Admin'} (Super Admin)`,
      updatedBy: `${actorUser.name || 'Super Admin'} (Super Admin)`,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      changeReason: policyData.changeReason || 'Initial policy creation'
    }

    // Check for conflicting active rules
    if (newPolicy.status === 'Active') {
      const conflictCheck = this.detectPolicyConflicts(newPolicy)
      if (conflictCheck.hasConflict) {
        throw new Error(`Policy Conflict Detected: ${conflictCheck.conflicts[0].reason}`)
      }
    }

    list.unshift(newPolicy)
    this._setItem(STORAGE_KEYS.POLICIES, list)

    auditService.logEvent({
      actor: `${actorUser.name || 'Super Admin'} (Super Admin)`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'POLICY_CREATED',
      entity: newPolicy.id,
      entityName: newPolicy.name,
      previousValue: 'None',
      newValue: `Created ${newPolicy.name} (v1.0, ${newPolicy.category})`,
      reason: newPolicy.changeReason,
      policyVersion: '1.0',
      scope: newPolicy.scopeValue
    })

    this._notify()

    if (typeof window !== 'undefined') {
      apiClient.post('/admin/company-policies', policyData).catch(() => {})
    }

    return newPolicy
  }

  /**
   * Version and update an existing policy (Super Admin protected)
   */
  versionPolicy(id, updates, actorUser = { name: 'Super Admin', role: 'super_admin', id: 'EMP-001' }, changeReason = 'Policy revised') {
    if (!isActorSuperAdmin(actorUser)) {
      throw new Error('Unauthorized: Only Super Admin has authority to modify company policies.')
    }

    const list = [...this.getAllPolicies()]
    const idx = list.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Policy '${id}' not found.`)

    const current = list[idx]
    const newVersion = (parseFloat(current.version || '1.0') + 0.1).toFixed(1)

    const updated = {
      ...current,
      ...updates,
      version: newVersion,
      updatedBy: `${actorUser.name || 'Super Admin'} (Super Admin)`,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      changeReason
    }

    if (updated.status === 'Active') {
      const conflictCheck = this.detectPolicyConflicts(updated)
      if (conflictCheck.hasConflict) {
        throw new Error(`Policy Conflict Detected: ${conflictCheck.conflicts[0].reason}`)
      }
    }

    list[idx] = updated
    this._setItem(STORAGE_KEYS.POLICIES, list)

    auditService.logEvent({
      actor: `${actorUser.name || 'Super Admin'} (Super Admin)`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'POLICY_VERSIONED',
      entity: updated.id,
      entityName: updated.name,
      previousValue: `v${current.version}: limit=${current.allowedLimit}, status=${current.status}`,
      newValue: `v${updated.version}: limit=${updated.allowedLimit}, status=${updated.status}`,
      reason: changeReason,
      policyVersion: updated.version,
      scope: updated.scopeValue
    })

    this._notify()

    if (typeof window !== 'undefined') {
      apiClient.put(`/admin/company-policies/${id}`, { ...updates, changeReason }).catch(() => {})
    }

    return updated
  }

  /**
   * Toggle policy active/inactive status
   */
  togglePolicyStatus(id, newStatus, actorUser = { name: 'Super Admin', role: 'super_admin', id: 'EMP-001' }, reason = 'Status toggled') {
    if (typeof window !== 'undefined') {
      apiClient.patch(`/admin/company-policies/${id}/status`, { status: newStatus }).catch(() => {})
    }
    return this.versionPolicy(id, { status: newStatus }, actorUser, `${reason} - status changed to ${newStatus}`)
  }

  /**
   * Safe delete policy (only allowed for custom/non-canonical policies)
   */
  deletePolicy(id, actorUser = { name: 'Super Admin', role: 'super_admin', id: 'EMP-001' }) {
    if (!isActorSuperAdmin(actorUser)) {
      throw new Error('Unauthorized: Only Super Admin has authority to delete policies.')
    }

    if (this.isPolicyProtected(id)) {
      throw new Error(`Cannot delete canonical system policy ${id}. You can archive or deactivate it instead.`)
    }

    const current = this.getPolicyById(id)
    const list = this.getAllPolicies().filter((p) => p.id !== id)
    this._setItem(STORAGE_KEYS.POLICIES, list)

    auditService.logEvent({
      actor: `${actorUser.name || 'Super Admin'} (Super Admin)`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'POLICY_DELETED',
      entity: id,
      entityName: current?.name || id,
      previousValue: `Policy ${id}`,
      newValue: 'DELETED',
      reason: 'Policy safely deleted by Super Admin',
      policyVersion: current?.version || '1.0',
      scope: current?.scopeValue || 'all'
    })

    this._notify()

    if (typeof window !== 'undefined') {
      apiClient.delete(`/admin/company-policies/${id}`).catch(() => {})
    }

    return true
  }

  /**
   * Preview employees affected by a policy
   */
  previewAffectedEmployees(policyId) {
    const policy = this.getPolicyById(policyId)
    if (!policy) return []

    const allEmployees = employeeService.getAllEmployees()

    if (policy.appliesTo === 'Company-Wide') {
      return allEmployees
    }
    if (policy.appliesTo === 'Department') {
      return allEmployees.filter((e) => e.departmentId === policy.scopeValue || e.department === policy.scopeValue)
    }
    if (policy.appliesTo === 'Employee-Specific') {
      return allEmployees.filter((e) => e.id === policy.scopeValue)
    }
    if (policy.appliesTo === 'Role') {
      return allEmployees.filter((e) => e.role === policy.scopeValue || e.designation?.toLowerCase().includes(policy.scopeValue.toLowerCase()))
    }

    return allEmployees
  }
}

export const policyService = new PolicyService()
export default policyService
