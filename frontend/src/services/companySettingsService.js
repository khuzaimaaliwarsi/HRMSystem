/**
 * iSysware HRMS — Company Profile & General Settings Service (Batch F13)
 * Authoritative management for corporate metadata, fiscal calendar, currency,
 * timezone, payroll cutoffs, and administrative contact registry.
 */

import { INITIAL_COMPANY_PROFILE } from '../mocks/settingsData.js'
import { auditService } from './auditService.js'

const STORAGE_KEYS = {
  PROFILE: 'isysware_hrms_f13_company_profile_v1'
}

class CompanySettingsService {
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
      } catch {}
    }
    return defaultVal !== undefined ? defaultVal : []
  }

  _setItem(key, value) {
    this.memoryStorage[key] = value
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {}
    }
  }

  _initialize() {
    if (!this._getItem(STORAGE_KEYS.PROFILE, null)) {
      this._setItem(STORAGE_KEYS.PROFILE, INITIAL_COMPANY_PROFILE)
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
        console.error('Error in companySettingsService listener:', err)
      }
    }
  }

  resetAllData() {
    this.memoryStorage[STORAGE_KEYS.PROFILE] = JSON.parse(JSON.stringify(INITIAL_COMPANY_PROFILE))
    this._setItem(STORAGE_KEYS.PROFILE, JSON.parse(JSON.stringify(INITIAL_COMPANY_PROFILE)))
    this._notify()
  }

  /**
   * Retrieve company profile
   */
  getCompanyProfile() {
    return this._getItem(STORAGE_KEYS.PROFILE, INITIAL_COMPANY_PROFILE)
  }

  /**
   * Update company profile (Super Admin protected)
   */
  updateCompanyProfile(updates, actorUser = { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }, reason = 'Company settings update') {
    if (actorUser.role !== 'super_admin') {
      throw new Error('Unauthorized: Only Super Admin can modify protected Company Profile settings.')
    }

    const current = this.getCompanyProfile()
    const newVersion = (parseFloat(current.version || '2.4') + 0.1).toFixed(1)
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const updatedProfile = {
      ...current,
      ...updates,
      version: newVersion,
      updatedAt: timestamp,
      updatedBy: `${actorUser.name} (${actorUser.roleLabel || 'Super Admin'})`
    }

    this._setItem(STORAGE_KEYS.PROFILE, updatedProfile)

    // Calculate changed fields for precise event-specific before/after tracking
    const changedFieldKeys = Object.keys(updates).filter(
      (key) => key !== 'updatedAt' && key !== 'updatedBy' && key !== 'version' && current[key] !== updates[key]
    )

    let prevStr = ''
    let newStr = ''

    if (changedFieldKeys.length > 0) {
      prevStr = changedFieldKeys.map((k) => `${k}: ${current[k] !== undefined ? current[k] : 'Not recorded'}`).join(', ')
      newStr = changedFieldKeys.map((k) => `${k}: ${updates[k] !== undefined ? updates[k] : 'Not recorded'}`).join(', ')
    } else {
      prevStr = `Name: ${current.name}, Cutoff: ${current.payrollCutoffDay}, TZ: ${current.timezone}`
      newStr = `Name: ${updatedProfile.name}, Cutoff: ${updatedProfile.payrollCutoffDay}, TZ: ${updatedProfile.timezone}`
    }

    // Audit log
    auditService.logEvent({
      actor: `${actorUser.name} (${actorUser.roleLabel || 'Super Admin'})`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'COMPANY_SETTINGS_UPDATED',
      entity: updatedProfile.id || 'COMP-ISYSWARE',
      entityName: updatedProfile.name || 'iSysware Profile',
      previousValue: prevStr,
      newValue: newStr,
      reason,
      policyVersion: newVersion,
      scope: 'company_wide'
    })

    this._notify()
    return updatedProfile
  }
}

export const companySettingsService = new CompanySettingsService()
export default companySettingsService
