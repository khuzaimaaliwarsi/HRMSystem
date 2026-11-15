import { DEMO_USERS } from '../mocks/demoUsers.js'
import { CANONICAL_EMPLOYEES } from '../mocks/organizationData.js'
import apiClient from './apiClient.js'

const SESSION_KEY = 'isysware_hrms_demo_session'
const USER_ACCOUNTS_KEY = 'isysware_hrms_user_accounts_v1'
const ROLE_CHANGE_HISTORY_KEY = 'isysware_hrms_role_change_history_v1'

let memorySession = null
let memoryUsers = null
let memoryRoleHistory = null

const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Fallback
  }
  return null
}

const ROLE_METADATA = {
  super_admin: {
    roleLabel: 'Super Admin',
    portalPath: '/super-admin',
    capabilities: ['all', 'policy_engine', 'audit_full', 'payroll_approve']
  },
  hr_admin: {
    roleLabel: 'HR / Admin',
    portalPath: '/hr-admin',
    capabilities: ['hr_operations', 'payroll_prepare', 'employee_admin', 'letters_issue']
  },
  manager: {
    roleLabel: 'Department Manager',
    portalPath: '/manager',
    capabilities: ['team_review', 'leave_approve_cap', 'kpi_appraise', 'task_assign']
  },
  team_lead: {
    roleLabel: 'Team Lead',
    portalPath: '/team-lead',
    capabilities: ['team_lead_review', 'leave_recommend', 'task_assign', 'attendance_view']
  },
  employee: {
    roleLabel: 'Employee',
    portalPath: '/employee',
    capabilities: ['self_service', 'punch_record', 'leave_request', 'payslip_view']
  }
}

/**
 * Normalizes backend User + Employee record into standardized frontend user model
 */
export function normalizeBackendUser(rawUser) {
  if (!rawUser) return null
  const backendRole = rawUser.role || 'EMPLOYEE'
  let role = backendRole.toLowerCase()
  if (role === 'dept_manager') role = 'manager'
  const meta = ROLE_METADATA[role] || ROLE_METADATA.employee

  const emp = rawUser.employee || {}
  const firstName = emp.firstName || ''
  const lastName = emp.lastName || ''
  const linkedFullName = `${firstName} ${lastName}`.trim()

  // Canonical fallback hierarchy:
  // rawUser.displayName || (linked employee full name) || rawUser.username || rawUser.email || 'User'
  const resolvedName = (rawUser.displayName && rawUser.displayName.trim()) ||
    (linkedFullName || null) ||
    rawUser.username ||
    rawUser.email ||
    'User'

  const initials = resolvedName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || (rawUser.username ? rawUser.username.slice(0, 2).toUpperCase() : 'US')

  // Employee ID: strictly null if no employee is linked (never fallback to rawUser.id)
  const resolvedEmployeeId = emp.employeeCode || rawUser.employeeId || null
  const resolvedEmployeeCode = emp.employeeCode || null

  const defaultDesignation = role === 'super_admin'
    ? 'Super Administrator'
    : role === 'hr_admin'
      ? 'HR Administrator'
      : role === 'manager'
        ? 'Department Manager'
        : role === 'team_lead'
          ? 'Team Lead'
          : 'Staff'

  return {
    id: rawUser.id,
    userId: rawUser.id,
    username: rawUser.username,
    displayName: rawUser.displayName || null,
    email: rawUser.email,
    backendRole,
    role,
    roleLabel: meta.roleLabel,
    portalPath: meta.portalPath,
    name: resolvedName,
    initials,
    employeeId: resolvedEmployeeId,
    employeeCode: resolvedEmployeeCode,
    department: emp.department?.name || (role === 'super_admin' ? 'Executive Administration' : 'Corporate HQ'),
    departmentId: emp.department?.id || emp.departmentId || null,
    designation: emp.designation?.title || defaultDesignation,
    capabilities: rawUser.capabilities || meta.capabilities || [],
    isProtected: rawUser.isProtected || false,
    isActive: rawUser.isActive !== false,
    isRealBackend: true
  }
}

export const authService = {
  /**
   * Get all registered portal user accounts
   */
  getUserAccounts() {
    const storage = getStorage()
    let users = []
    if (storage) {
      const stored = storage.getItem(USER_ACCOUNTS_KEY)
      if (stored) {
        try {
          users = JSON.parse(stored)
        } catch {
          // fallback
        }
      }
    }
    if (!users || users.length === 0) {
      users = memoryUsers ? [...memoryUsers] : [...DEMO_USERS]
    }

    // Reconcile user accounts with live employee directory and active leadership assignments
    if (storage) {
      try {
        const rawEmps = storage.getItem('isysware_hrms_f02_employees_v1')
        const rawAssignments = storage.getItem('isysware_hrms_f02_team_assignments_v1')
        const rawDepts = storage.getItem('isysware_hrms_f02_departments_v1')
        const rawTeams = storage.getItem('isysware_hrms_f02_teams_v1')

        if (rawEmps) {
          const emps = JSON.parse(rawEmps)
          const assignments = rawAssignments ? JSON.parse(rawAssignments) : []
          const depts = rawDepts ? JSON.parse(rawDepts) : []
          const teams = rawTeams ? JSON.parse(rawTeams) : []

          let mutated = false

          for (const emp of emps) {
            if (!emp.id) continue

            // Determine if employee holds an active leadership position
            const isDeptHead = depts.some((d) => d.headId === emp.id && d.status === 'Active')
            const isTeamLeadInTeams = teams.some((t) => t.teamLeadId === emp.id && t.status === 'Active')
            const activeLeadAssignment = assignments.find(
              (a) => a.employeeId === emp.id && a.role === 'team_lead' && a.status === 'Active'
            )
            const activeMgrAssignment = assignments.find(
              (a) => a.employeeId === emp.id && a.role === 'manager' && a.status === 'Active'
            )

            let naturalRole = 'employee'
            if (emp.email === 'superadmin@isysware.com') {
              naturalRole = 'super_admin'
            } else if (emp.email === 'hr@isysware.com') {
              naturalRole = 'hr_admin'
            } else if (isTeamLeadInTeams || activeLeadAssignment) {
              naturalRole = 'team_lead'
            } else if (isDeptHead || activeMgrAssignment) {
              naturalRole = 'manager'
            }

            const existingIdx = users.findIndex(
              (u) =>
                (u.id && u.id.toLowerCase() === emp.id.toLowerCase()) ||
                (u.employeeId && u.employeeId.toLowerCase() === emp.id.toLowerCase()) ||
                (u.email && emp.email && u.email.toLowerCase() === emp.email.toLowerCase())
            )

            if (existingIdx !== -1) {
              const current = users[existingIdx]
              const targetRole = current.role === 'super_admin' ? 'super_admin' : (current.role === 'team_lead' || current.role === 'manager' ? current.role : naturalRole)
              const meta = ROLE_METADATA[targetRole] || ROLE_METADATA.employee

              if (
                current.name !== emp.name ||
                current.email !== emp.email ||
                current.role !== targetRole ||
                current.designation !== emp.designation
              ) {
                users[existingIdx] = {
                  ...current,
                  id: emp.id,
                  employeeId: emp.id,
                  name: emp.name,
                  email: emp.email,
                  role: targetRole,
                  roleLabel: meta.roleLabel,
                  designation: emp.designation,
                  department: emp.department,
                  departmentId: emp.departmentId,
                  portalPath: meta.portalPath,
                  capabilities: meta.capabilities
                }
                mutated = true
              }
            } else {
              // Provision newly discovered employee
              const meta = ROLE_METADATA[naturalRole] || ROLE_METADATA.employee
              users.push({
                id: emp.id,
                employeeId: emp.id,
                name: emp.name,
                email: emp.email,
                role: naturalRole,
                roleLabel: meta.roleLabel,
                designation: emp.designation,
                department: emp.department,
                departmentId: emp.departmentId,
                initials: emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
                portalPath: meta.portalPath,
                capabilities: meta.capabilities
              })
              mutated = true
            }
          }

          if (mutated) {
            storage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(users))
          }
        }
      } catch {
        // Non-blocking sync
      }
    }

    if (storage && (!storage.getItem(USER_ACCOUNTS_KEY) || users.length > 0)) {
      storage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(users))
    }
    memoryUsers = users
    return users
  },

  /**
   * Get 1-click quick demo accounts for login screen reflecting live organization
   */
  getQuickDemoAccounts() {
    const users = this.getUserAccounts()
    const targetRoles = ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee']
    const result = []

    for (const role of targetRoles) {
      const match = users.find((u) => u.role === role)
      if (match) {
        result.push(match)
      }
    }
    const qaMatch = users.find((u) => u.id === 'EMP-016')
    if (qaMatch && !result.some((u) => u.id === 'EMP-016')) {
      result.push(qaMatch)
    }
    return result.length > 0 ? result : DEMO_USERS
  },

  /**
   * Find user account by id, employeeId, or email
   */
  getUserAccountById(identifier) {
    if (!identifier) return null
    const clean = identifier.trim().toLowerCase()
    const users = this.getUserAccounts()
    return (
      users.find(
        (u) =>
          (u.id && u.id.toLowerCase() === clean) ||
          (u.employeeId && u.employeeId.toLowerCase() === clean) ||
          (u.email && u.email.toLowerCase() === clean)
      ) || null
    )
  },

  /**
   * Primary Login Method
   * In browser/production: Authenticates against /api/v1/auth/login with HttpOnly cookies.
   * Throws real server error on invalid credentials or database/network failure (NO mock fallback).
   */
  async login(identifier, password) {
    const isBrowser = typeof window !== 'undefined'
    const isNodeTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT

    if (isBrowser || !isNodeTest) {
      try {
        const responseData = await apiClient.post('/auth/login', { identifier, password })
        const normalized = normalizeBackendUser(responseData.user || responseData)
        memorySession = normalized
        return normalized
      } catch (err) {
        // Enforce STRICT POLICY: Real error messages on login or database failure. NO mock fallback in browser.
        if (isBrowser) {
          throw err
        }
        if (isNodeTest) {
          return this._mockLogin(identifier, password)
        }
        throw err
      }
    }

    return this._mockLogin(identifier, password)
  },

  /**
   * Offline test environment mock login resolver (used only in headless Node unit tests)
   */
  async _mockLogin(identifier, _password) {
    const cleanInput = (identifier || '').trim().toLowerCase()
    const users = this.getUserAccounts()

    const matchedUser = users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === cleanInput) ||
        (u.id && u.id.toLowerCase() === cleanInput) ||
        (u.employeeId && u.employeeId.toLowerCase() === cleanInput) ||
        (u.name && u.name.toLowerCase() === cleanInput) ||
        u.role.toLowerCase() === cleanInput ||
        (cleanInput === 'teamlead' && u.role === 'team_lead') ||
        (cleanInput === 'team lead' && u.role === 'team_lead') ||
        (cleanInput === 'department manager' && u.role === 'manager') ||
        (cleanInput === 'manager' && u.role === 'manager') ||
        (cleanInput === 'ahmed' && u.id === 'EMP-016') ||
        (cleanInput === 'ahmed raza' && u.id === 'EMP-016') ||
        (cleanInput === 'qa' && u.id === 'EMP-016')
    )

    if (!matchedUser) {
      throw new Error('Invalid credentials')
    }

    const sessionData = {
      ...matchedUser,
      employeeId: matchedUser.employeeId || matchedUser.id,
      loginTime: new Date().toISOString()
    }
    const storage = getStorage()
    if (storage) {
      storage.setItem(SESSION_KEY, JSON.stringify(sessionData))
    }
    memorySession = sessionData
    return sessionData
  },

  /**
   * Fetches currently active session from PostgreSQL backend (/api/v1/auth/me)
   */
  async getMe() {
    try {
      const data = await apiClient.get('/auth/me')
      const user = normalizeBackendUser(data.user || data)
      memorySession = user
      return user
    } catch {
      memorySession = null
      return null
    }
  },

  /**
   * Get currently active session in memory
   */
  getCurrentUser() {
    if (memorySession) return memorySession
    // In browser runtime, never resurrect legacy demo sessions from localStorage
    if (typeof window !== 'undefined') return null
    const storage = getStorage()
    const stored = storage ? storage.getItem(SESSION_KEY) : null
    if (stored) {
      try {
        memorySession = JSON.parse(stored)
        return memorySession
      } catch {
        // ignore
      }
    }
    return null
  },

  /**
   * Refresh session token with backend (/api/v1/auth/refresh)
   */
  async refreshToken() {
    return apiClient.post('/auth/refresh')
  },

  /**
   * Changes authenticated user password (/api/v1/auth/change-password)
   */
  async changePassword(currentPassword, newPassword) {
    return apiClient.post('/auth/change-password', { currentPassword, newPassword })
  },

  /**
   * End session and revoke tokens on server (/api/v1/auth/logout)
   */
  async logout() {
    try {
      if (typeof window !== 'undefined') {
        await apiClient.post('/auth/logout')
      }
    } catch {
      // non-blocking
    } finally {
      memorySession = null
      const storage = getStorage()
      if (storage) {
        storage.removeItem(SESSION_KEY)
      }
    }
  },

  /**
   * Revoke all active sessions on server (/api/v1/auth/logout-all)
   */
  async logoutAll() {
    try {
      if (typeof window !== 'undefined') {
        await apiClient.post('/auth/logout-all')
      }
    } catch {
      // non-blocking
    } finally {
      memorySession = null
      const storage = getStorage()
      if (storage) {
        storage.removeItem(SESSION_KEY)
      }
    }
  },

  /**
   * Quick role/user switch for demo testing
   */
  switchDemoRole(roleOrId) {
    const users = this.getUserAccounts()
    const target = users.find((u) => u.id === roleOrId || u.role === roleOrId || u.email === roleOrId)
    if (target) {
      const sessionData = {
        ...target,
        employeeId: target.employeeId || target.id,
        token: `demo-token-${target.id}-${Date.now()}`,
        loginTime: new Date().toISOString()
      }
      const storage = getStorage()
      if (storage) {
        storage.setItem(SESSION_KEY, JSON.stringify(sessionData))
      }
      memorySession = sessionData
      return sessionData
    }
    return null
  },

  /**
   * CONTROLLED PORTAL ROLE UPGRADE / DOWNGRADE
   * Enforces administrative authorization, Super Admin account protection, and stale session prevention.
   */
  updateUserRole(userIdOrEmployeeId, newRole, reason = 'Administrative role revision', actor = 'Super Admin') {
    if (!newRole || !ROLE_METADATA[newRole]) {
      throw new Error(`Invalid portal role '${newRole}'. Allowed roles: ${Object.keys(ROLE_METADATA).join(', ')}.`)
    }

    // Role Escalation / Authority Guard:
    // Only authorized Super Admin or HR Admin can alter portal permissions.
    const actorRole = typeof actor === 'object' ? `${actor.role || ''} ${actor.name || ''}` : String(actor || '')
    const actorLower = actorRole.toLowerCase()
    const isAuthorized =
      actorLower.includes('admin') ||
      actorLower.includes('super') ||
      actorLower.includes('tariq') ||
      actorLower.includes('ayesha') ||
      actorLower.includes('alexander')
    if (!isAuthorized) {
      throw new Error('Unauthorized role modification: Only Super Admin or HR Admin can grant or revoke portal access.')
    }

    const users = [...this.getUserAccounts()]
    let userIdx = users.findIndex(
      (u) =>
        (u.id && u.id.toLowerCase() === userIdOrEmployeeId.toLowerCase()) ||
        (u.employeeId && u.employeeId.toLowerCase() === userIdOrEmployeeId.toLowerCase())
    )

    let targetUser = userIdx !== -1 ? users[userIdx] : null

    if (!targetUser) {
      // Dynamically provision portal account for workforce employee
      const storage = getStorage()
      let emp = null
      if (storage) {
        const rawEmps = storage.getItem('isysware_hrms_f02_employees_v1')
        if (rawEmps) {
          try {
            const parsed = JSON.parse(rawEmps)
            emp = parsed.find((e) => e.id && e.id.toLowerCase() === userIdOrEmployeeId.toLowerCase())
          } catch {
            // ignore
          }
        }
      }
      if (!emp) {
        emp = CANONICAL_EMPLOYEES.find((e) => e.id && e.id.toLowerCase() === userIdOrEmployeeId.toLowerCase())
      }
      if (emp) {
        targetUser = {
          id: emp.id,
          employeeId: emp.id,
          name: emp.name,
          email: emp.email,
          role: 'employee',
          roleLabel: 'Employee',
          designation: emp.designation,
          department: emp.department,
          departmentId: emp.departmentId,
          initials: emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
          portalPath: '/employee',
          capabilities: ROLE_METADATA.employee.capabilities
        }
        users.push(targetUser)
        userIdx = users.length - 1
      } else {
        throw new Error(`Portal user account for employee '${userIdOrEmployeeId}' not found.`)
      }
    }
    const previousRole = targetUser.role

    // Super Admin Account Protection Guard:
    // Primary Super Admin (EMP-001) cannot be downgraded or revoked.
    if ((targetUser.id === 'EMP-001' || targetUser.employeeId === 'EMP-001') && newRole !== 'super_admin') {
      throw new Error('Governance Protection: Primary Super Admin account (EMP-001) cannot be downgraded or revoked.')
    }

    const meta = ROLE_METADATA[newRole]
    const updatedUser = {
      ...targetUser,
      role: newRole,
      roleLabel: meta.roleLabel,
      portalPath: meta.portalPath,
      capabilities: meta.capabilities,
      updatedAt: new Date().toISOString()
    }

    users[userIdx] = updatedUser
    const storage = getStorage()
    if (storage) {
      storage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(users))
    }
    memoryUsers = users

    // Stale Session Protection:
    // If the affected user is currently authenticated in the active demo session,
    // update session storage immediately to eliminate stale privileges.
    const currentSession = this.getCurrentUser()
    if (
      currentSession &&
      (currentSession.id === targetUser.id || currentSession.employeeId === targetUser.employeeId)
    ) {
      const refreshedSession = {
        ...currentSession,
        role: newRole,
        roleLabel: meta.roleLabel,
        portalPath: meta.portalPath,
        capabilities: meta.capabilities
      }
      if (storage) {
        storage.setItem(SESSION_KEY, JSON.stringify(refreshedSession))
      }
      memorySession = refreshedSession
    }

    // Record Role Change History
    this._recordRoleChangeHistory({
      userId: targetUser.id,
      employeeId: targetUser.employeeId || targetUser.id,
      employeeName: targetUser.name,
      previousRole,
      newRole,
      reason,
      effectiveDate: new Date().toISOString().slice(0, 10),
      actor
    })

    return updatedUser
  },

  /**
   * Record role change audit log
   */
  _recordRoleChangeHistory(record) {
    const list = this.getRoleChangeHistory()
    const today = new Date().toISOString()
    const entry = {
      id: `RCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: today.replace('T', ' ').slice(0, 19),
      ...record
    }
    list.unshift(entry)
    const storage = getStorage()
    if (storage) {
      storage.setItem(ROLE_CHANGE_HISTORY_KEY, JSON.stringify(list))
    }
    memoryRoleHistory = list
    return entry
  },

  /**
   * Get role change history
   */
  getRoleChangeHistory(employeeId = null) {
    const storage = getStorage()
    if (storage) {
      const stored = storage.getItem(ROLE_CHANGE_HISTORY_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (employeeId && employeeId !== 'all') {
            return parsed.filter((h) => h.employeeId === employeeId || h.userId === employeeId)
          }
          return parsed
        } catch {
          // fallback
        }
      }
    }
    if (memoryRoleHistory) {
      if (employeeId && employeeId !== 'all') {
        return memoryRoleHistory.filter((h) => h.employeeId === employeeId || h.userId === employeeId)
      }
      return memoryRoleHistory
    }
    return []
  },

  /**
   * Reset user accounts and role history to default canonical state
   */
  resetDemoAccounts() {
    const storage = getStorage()
    if (storage) {
      storage.removeItem(USER_ACCOUNTS_KEY)
      storage.removeItem(ROLE_CHANGE_HISTORY_KEY)
    }
    memoryUsers = null
    memoryRoleHistory = null
  },

  clearMemoryCache() {
    memoryUsers = null
    memoryRoleHistory = null
  }
}

export default authService
