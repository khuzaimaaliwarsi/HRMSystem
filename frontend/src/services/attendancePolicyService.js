/**
 * iSysware HRMS — Centralized Attendance Policy Service (Batch F04)
 * Authoritative single source of truth for:
 * - Super Admin owned Attendance Policies (grace periods, late limits, half-day, working hours)
 * - Allowed late occurrences per month (default 4 permitted lates before excess escalation)
 * - Early exit & minimum working hours rules
 * - Multi-tier approval routing & authority limits
 * - Policy versioning, scopes, and audit metadata
 */

import { INITIAL_ATTENDANCE_POLICIES } from '../mocks/attendanceData.js'

const STORAGE_KEYS = {
  POLICIES: 'isysware_hrms_f04_policies_v1'
}

class AttendancePolicyService {
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
    const stored = this._getItem(STORAGE_KEYS.POLICIES, null)
    if (!stored) {
      this._setItem(STORAGE_KEYS.POLICIES, INITIAL_ATTENDANCE_POLICIES)
    } else {
      let changed = false
      const updated = stored.map((p) => {
        if (!p.fieldDutyApprovalLimits || !p.fieldDutyApprovalLimits.mode) {
          changed = true
          return {
            ...p,
            fieldDutyApprovalLimits: {
              ...(p.fieldDutyApprovalLimits || {}),
              mode: 'no_limit',
              teamLeadMaxHours: 4.0,
              managerMaxHours: 9.0,
              escalateToHRThresholdHours: 9.0,
              description: 'Under No Duration Limit mode, any authorized supervisor (Team Lead, Department Manager, HR Admin, or Super Admin) can directly approve Field Duty requests. The first approval immediately finalizes the request.'
            }
          }
        }
        return p
      })
      if (changed) {
        this._setItem(STORAGE_KEYS.POLICIES, updated)
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
        console.error('Error in attendancePolicyService listener:', err)
      }
    }
  }

  resetToDefaults() {
    this._setItem(STORAGE_KEYS.POLICIES, JSON.parse(JSON.stringify(INITIAL_ATTENDANCE_POLICIES)))
    this._notify()
  }

  getPolicies() {
    return this._getItem(STORAGE_KEYS.POLICIES, INITIAL_ATTENDANCE_POLICIES)
  }

  getActivePolicy() {
    const list = this.getPolicies()
    return list.find((p) => p.status === 'Active') || list[0]
  }

  getPolicyById(id) {
    const list = this.getPolicies()
    return list.find((p) => p.id === id) || null
  }

  /**
   * Super Admin configuration update (centralized policy versioning)
   */
  updatePolicy(id, updates, actor = 'Tariq Mehmood (Super Admin)') {
    const list = [...this.getPolicies()]
    const idx = list.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Policy '${id}' not found.`)

    const current = list[idx]
    const newVersion = (parseFloat(current.version || '1.0') + 0.1).toFixed(1)

    list[idx] = {
      ...current,
      ...updates,
      version: newVersion,
      updatedBy: actor,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      auditNotes: updates.auditNotes || `Policy parameters revised by ${actor} (v${newVersion})`
    }

    this._setItem(STORAGE_KEYS.POLICIES, list)
    this._notify()
    return list[idx]
  }

  /**
   * Configure Field Duty Approval Mode and limits
   * @param {'no_limit' | 'duration_based' | 'manager_only'} mode
   * @param {Object} limits
   */
  setFieldDutyApprovalMode(mode, limits = {}, actor = 'Tariq Mehmood (Super Admin)') {
    const active = this.getActivePolicy()
    const currentLimits = active.fieldDutyApprovalLimits || {}
    const newLimits = {
      ...currentLimits,
      ...limits,
      mode: mode || currentLimits.mode || 'duration_based'
    }
    return this.updatePolicy(active.id, { fieldDutyApprovalLimits: newLimits }, actor)
  }

  /**
   * Resolve reviewer and escalation authority based on applicant role
   */
  resolveApproverRouting(applicantRole = 'employee') {
    const _policy = this.getActivePolicy()

    if (applicantRole === 'employee') {
      return {
        normalReviewer: 'Manager',
        escalationReviewer: 'HR Admin',
        finalAuthority: 'Super Admin'
      }
    }
    if (applicantRole === 'manager') {
      return {
        normalReviewer: 'HR Admin',
        escalationReviewer: 'Super Admin',
        finalAuthority: 'Super Admin'
      }
    }
    if (applicantRole === 'hr_admin') {
      return {
        normalReviewer: 'Super Admin',
        escalationReviewer: 'Super Admin',
        finalAuthority: 'Super Admin'
      }
    }
    // Super Admin has no higher authority; must be independently assigned if configured
    return {
      normalReviewer: null,
      escalationReviewer: null,
      finalAuthority: 'Board of Directors'
    }
  }
}

export const attendancePolicyService = new AttendancePolicyService()
export default attendancePolicyService
