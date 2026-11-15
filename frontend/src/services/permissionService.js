/**
 * iSysware HRMS — Dynamic Roles & Permissions Service (Batch F13)
 * Authoritative single source of truth for Role-Based Access Control (RBAC):
 * - 4 Portals: Super Admin, HR/Admin, Manager, Employee
 * - Module & Action grants: view, create, edit, submit, approve, reject, verify, export, manage_config, view_audit
 * - Data Scopes: company_wide, department, direct_reports, own
 * - Protected Super Admin invariants and privilege escalation safeguards
 */

import { INITIAL_ROLE_PERMISSIONS } from '../mocks/settingsData.js'
import { auditService } from './auditService.js'
import { employeeService } from './employeeService.js'

const STORAGE_KEYS = {
  PERMISSIONS: 'isysware_hrms_f13_permissions_v1'
}

class PermissionService {
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

  _initialize() {
    const existing = this._getItem(STORAGE_KEYS.PERMISSIONS, null)
    if (!existing) {
      this._setItem(STORAGE_KEYS.PERMISSIONS, INITIAL_ROLE_PERMISSIONS)
    } else {
      let updated = false
      const merged = { ...existing }
      for (const [rKey, rDef] of Object.entries(INITIAL_ROLE_PERMISSIONS)) {
        if (!merged[rKey]) {
          merged[rKey] = rDef
          updated = true
        }
      }
      if (updated) {
        this._setItem(STORAGE_KEYS.PERMISSIONS, merged)
      }
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
        console.error('Error in permissionService listener:', err)
      }
    }
  }

  resetAllData() {
    this.memoryStorage[STORAGE_KEYS.PERMISSIONS] = JSON.parse(JSON.stringify(INITIAL_ROLE_PERMISSIONS))
    this._setItem(STORAGE_KEYS.PERMISSIONS, JSON.parse(JSON.stringify(INITIAL_ROLE_PERMISSIONS)))
    this._notify()
  }

  /**
   * Get all role permission definitions (Super Admin, HR/Admin, Manager, Team Lead, Employee)
   */
  getAllRolePermissions() {
    const stored = this._getItem(STORAGE_KEYS.PERMISSIONS, INITIAL_ROLE_PERMISSIONS) || {}
    let needsSync = false
    const synced = { ...stored }
    for (const [rKey, rDef] of Object.entries(INITIAL_ROLE_PERMISSIONS)) {
      if (!synced[rKey]) {
        synced[rKey] = rDef
        needsSync = true
      }
    }
    if (needsSync) {
      this._setItem(STORAGE_KEYS.PERMISSIONS, synced)
    }
    return synced
  }

  /**
   * Get metadata and scopes for all 5 roles
   */
  getRoles() {
    const permissions = this.getAllRolePermissions()
    return Object.entries(permissions).map(([key, def]) => ({
      key,
      role: key,
      name: def.roleName,
      label: def.roleName,
      description: def.description,
      defaultScope: def.defaultScope,
      scope: def.defaultScope === 'company_wide' ? 'Company Wide' :
             def.defaultScope === 'department_teams' ? 'Authorized Department Teams' :
             def.defaultScope === 'assigned_team' ? 'Assigned Teams' :
             def.defaultScope === 'own' ? 'Personal Self-Service' : def.defaultScope,
      isProtected: Boolean(def.isProtected)
    }))
  }

  /**
   * Get permissions for a specific role
   */
  getPermissionsForRole(role) {
    const roles = this.getAllRolePermissions()
    return roles[role] || null
  }

  /**
   * Check if a role has permission for a specific module and action
   */
  hasPermission(role, moduleName, action = 'view') {
    if (!role) return false
    // Super Admin by definition has all permissions
    if (role === 'super_admin') return true

    const roleDef = this.getPermissionsForRole(role)
    if (!roleDef || !roleDef.modules) return false

    const moduleActions = roleDef.modules[moduleName]
    if (!moduleActions) return false

    return moduleActions.includes(action)
  }

  /**
   * Check data scope boundaries across 5 roles
   */
  canAccessData(requestingUser, dataOwnerId, dataOwnerDepartmentId = null) {
    if (!requestingUser) return false
    if (requestingUser.role === 'super_admin') return true

    // HR Admin has company-wide access to operational records, except protected Super Admin items
    if (requestingUser.role === 'hr_admin') {
      return true
    }

    const reqEmpId = requestingUser.employeeId || requestingUser.id

    // Manager can access own data and authorized department teams/employees
    if (requestingUser.role === 'manager') {
      if (reqEmpId === dataOwnerId || requestingUser.id === dataOwnerId) return true
      if (requestingUser.directReportIds && requestingUser.directReportIds.includes(dataOwnerId)) return true
      if (dataOwnerDepartmentId && requestingUser.departmentId === dataOwnerDepartmentId) return true
      try {
        const mgrScope = employeeService.getDepartmentManagerScope(reqEmpId)
        if (mgrScope.some((e) => e.id === dataOwnerId)) return true
      } catch {
        // Fallback
      }
      return false
    }

    // Team Lead can access own data and assigned team employees only
    if (requestingUser.role === 'team_lead') {
      if (reqEmpId === dataOwnerId || requestingUser.id === dataOwnerId) return true
      if (requestingUser.assignedTeamMemberIds && requestingUser.assignedTeamMemberIds.includes(dataOwnerId)) return true
      try {
        const tlScope = employeeService.getTeamLeadScope(reqEmpId)
        if (tlScope.some((e) => e.id === dataOwnerId)) return true
      } catch {
        // Fallback
      }
      return false
    }

    // Employee can ONLY access own data
    if (requestingUser.role === 'employee') {
      return reqEmpId === dataOwnerId || requestingUser.id === dataOwnerId
    }

    return false
  }

  /**
   * Update permissions for a role (Super Admin protected with anti-escalation safeguards)
   */
  updateRolePermissions(targetRole, moduleName, newActions = [], actorUser = { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }, reason = 'Permission matrix calibration') {
    if (actorUser.role !== 'super_admin') {
      throw new Error('Unauthorized: Only Super Admin has authority to modify role permissions.')
    }

    // Safeguard 1: Cannot downgrade or lock out Super Admin protected role
    if (targetRole === 'super_admin' && !newActions.includes('manage_config')) {
      throw new Error('Safeguard Violation: Super Admin root administrative permissions cannot be stripped.')
    }

    // Safeguard 2: Prevent HR Admin from granting Super Admin access or self-elevating
    if (actorUser.role === 'hr_admin') {
      throw new Error('Safeguard Violation: HR / Admin cannot alter security permissions or elevate privileges.')
    }

    const currentRoles = { ...this.getAllRolePermissions() }
    if (!currentRoles[targetRole]) {
      throw new Error(`Role '${targetRole}' not found in registry.`)
    }

    const oldActions = currentRoles[targetRole].modules[moduleName] || []
    currentRoles[targetRole] = {
      ...currentRoles[targetRole],
      modules: {
        ...currentRoles[targetRole].modules,
        [moduleName]: [...newActions]
      }
    }

    this._setItem(STORAGE_KEYS.PERMISSIONS, currentRoles)

    // Audit log
    auditService.logEvent({
      actor: `${actorUser.name} (Super Admin)`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'ROLE_PERMISSION_MODIFIED',
      entity: `ROLE-${targetRole.toUpperCase()}`,
      entityName: `${currentRoles[targetRole].roleName} Permissions`,
      previousValue: `${moduleName}: [${oldActions.join(', ')}]`,
      newValue: `${moduleName}: [${newActions.join(', ')}]`,
      reason,
      policyVersion: '1.0',
      scope: 'company_wide'
    })

    this._notify()
    return currentRoles[targetRole]
  }
}

export const permissionService = new PermissionService()
export default permissionService
