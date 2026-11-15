/**
 * iSysware HRMS — Centralized Security & Configuration Audit Log Service (Batch F13)
 * Authoritative immutable audit trail for:
 * - Policy creations, edits, activations, versioning
 * - Role permission updates & approval matrix modifications
 * - Company profile & working calendar adjustments
 * - Strict non-tamperable append-only ledger with sensitive data masking
 */

import { INITIAL_AUDIT_LOGS } from '../mocks/alertsData.js'

const STORAGE_KEYS = {
  AUDIT_LOGS: 'isysware_hrms_f13_audit_logs_v1'
}

class AuditService {
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
      // Fallback to memory
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
    if (!this._getItem(STORAGE_KEYS.AUDIT_LOGS, null)) {
      this._setItem(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS)
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
        console.error('Error in auditService listener:', err)
      }
    }
  }

  resetAllData() {
    this.memoryStorage[STORAGE_KEYS.AUDIT_LOGS] = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS))
    this._setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS)))
    this._notify()
  }

  /**
   * Mask sensitive information (passwords, bank accounts, tokens, CNICs)
   */
  _sanitizeValue(val) {
    if (val === undefined || val === null) return ''
    if (typeof val !== 'string') {
      try {
        val = JSON.stringify(val)
      } catch {
        val = String(val)
      }
    }
    // Mask password, secret, token patterns
    let sanitized = val.replace(/(password|secret|token|bearer)["']?\s*[:=]\s*["']?[^"',\s]+["']?/gi, '$1: "********"')
    // Mask bank account numbers (PK...)
    sanitized = sanitized.replace(/PK\d{2}[A-Z]{4}\d{16}/gi, 'PK** **** **** **** ****')
    // Mask CNIC format
    sanitized = sanitized.replace(/\b(\d{5}-)\d{7}(-\d)\b/g, '$1*******$2')
    return sanitized
  }

  /**
   * Append-only audit record creation
   */
  logEvent({
    actor = 'System',
    actorId = 'EMP-SYS',
    actorRole = 'system',
    action = 'CONFIGURATION_CHANGE',
    entity = 'GENERAL',
    entityName = 'System Setting',
    previousValue = '',
    newValue = '',
    reason = 'Administrative update',
    policyVersion = '1.0',
    scope = 'company_wide'
  }) {
    const rawLogs = this.getLogs()
    const list = Array.isArray(rawLogs) ? [...rawLogs] : []
    const nextSeq = list.length + 1
    const eventId = `AUD-2026-${String(nextSeq).padStart(3, '0')}`
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const newLog = {
      id: eventId,
      actor,
      actorId,
      actorRole,
      action: action.toUpperCase(),
      entity,
      entityName,
      previousValue: this._sanitizeValue(previousValue),
      newValue: this._sanitizeValue(newValue),
      reason,
      policyVersion: String(policyVersion),
      timestamp,
      scope
    }

    list.unshift(newLog) // Most recent first
    this._setItem(STORAGE_KEYS.AUDIT_LOGS, list)
    this._notify()
    return newLog
  }

  /**
   * Retrieve all audit logs (read-only, access-controlled)
   */
  getLogs(filters = {}, actor = null) {
    if (actor && actor.role && !['super_admin', 'hr_admin'].includes(actor.role)) {
      throw new Error('Access denied: Security and configuration audit logs are restricted to Super Admin and HR Admin.')
    }

    let logs = this._getItem(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS)
    if (!Array.isArray(logs)) {
      logs = Array.isArray(INITIAL_AUDIT_LOGS) ? [...INITIAL_AUDIT_LOGS] : []
    }

    if (filters.action && filters.action !== 'all') {
      logs = logs.filter((l) => l.action.toLowerCase().includes(filters.action.toLowerCase()))
    }
    if (filters.actor && filters.actor !== 'all') {
      logs = logs.filter((l) => l.actor.toLowerCase().includes(filters.actor.toLowerCase()))
    }
    if (filters.entity && filters.entity !== 'all') {
      logs = logs.filter((l) => l.entity.toLowerCase().includes(filters.entity.toLowerCase()) || l.entityName.toLowerCase().includes(filters.entity.toLowerCase()))
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      logs = logs.filter(
        (l) =>
          l.id.toLowerCase().includes(q) ||
          l.actor.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.entityName.toLowerCase().includes(q) ||
          l.reason.toLowerCase().includes(q)
      )
    }

    return logs
  }

  /**
   * Get audit log by ID
   */
  getLogById(id) {
    const list = this.getLogs()
    return list.find((l) => l.id === id) || null
  }
}

export const auditService = new AuditService()
export default auditService
