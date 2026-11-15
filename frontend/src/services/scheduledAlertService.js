/**
 * iSysware HRMS — Scheduled Alerts & In-App Notification Service (Batch F13)
 * Authoritative cross-cutting scheduler for:
 * - 16+ Preconfigured Alert Rules (Birthdays, Anniversaries, Probation, SLA breaches, etc.)
 * - Preview Trigger Results & Recipient Resolution
 * - Duplicate Alert Prevention & Role-Based Scoped Delivery
 * - Read / Unread Status Management
 *
 * CRITICAL FRONTEND NOTICE:
 * This service operates purely as a client-side deterministic evaluation engine for demonstration.
 * In-browser mocks cannot run cron jobs when the browser is closed, nor do they dispatch real SMS/Email/WhatsApp.
 * The production cron scheduler, retry queues, and SMTP/SMS gateways belong on the Namecheap-compatible backend.
 */

import { INITIAL_SCHEDULED_ALERTS, INITIAL_NOTIFICATIONS } from '../mocks/alertsData.js'
import { employeeService } from './employeeService.js'
import { auditService } from './auditService.js'

const STORAGE_KEYS = {
  RULES: 'isysware_hrms_f13_alert_rules_v1',
  NOTIFICATIONS: 'isysware_hrms_f13_notifications_v1'
}

class ScheduledAlertService {
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
    if (!this._getItem(STORAGE_KEYS.RULES, null)) {
      this._setItem(STORAGE_KEYS.RULES, INITIAL_SCHEDULED_ALERTS)
    }
    if (!this._getItem(STORAGE_KEYS.NOTIFICATIONS, null)) {
      this._setItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS)
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
        console.error('Error in scheduledAlertService listener:', err)
      }
    }
  }

  resetAllData() {
    this.memoryStorage[STORAGE_KEYS.RULES] = JSON.parse(JSON.stringify(INITIAL_SCHEDULED_ALERTS))
    this.memoryStorage[STORAGE_KEYS.NOTIFICATIONS] = JSON.parse(JSON.stringify(INITIAL_NOTIFICATIONS))
    this._setItem(STORAGE_KEYS.RULES, JSON.parse(JSON.stringify(INITIAL_SCHEDULED_ALERTS)))
    this._setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.parse(JSON.stringify(INITIAL_NOTIFICATIONS)))
    this._notify()
  }

  /**
   * Get all scheduled alert rules
   */
  getAlertRules() {
    return this._getItem(STORAGE_KEYS.RULES, INITIAL_SCHEDULED_ALERTS)
  }

  /**
   * Get alert rule by ID
   */
  getRuleById(id) {
    const list = this.getAlertRules()
    return list.find((r) => r.id === id) || null
  }

  /**
   * Create or update an alert rule
   */
  createAlertRule(data, actorUser = { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }) {
    if (actorUser.role !== 'super_admin' && actorUser.role !== 'hr_admin') {
      throw new Error('Unauthorized: Only Super Admin or HR Admin can configure scheduled alerts.')
    }

    const list = [...this.getAlertRules()]
    const nextSeq = list.length + 1
    const newId = `ALT-CUST-${String(nextSeq).padStart(3, '0')}`

    const newRule = {
      id: newId,
      name: data.name,
      triggerEvent: data.triggerEvent || 'custom_reminder',
      daysBefore: Number(data.daysBefore) || 0,
      recipientRole: data.recipientRole || 'all',
      scope: data.scope || 'company_wide',
      priority: data.priority || 'Normal',
      schedule: data.schedule || 'Daily at 09:00 AM',
      notificationTemplate: data.notificationTemplate || 'System notification reminder.',
      enabled: Boolean(data.enabled !== false),
      createdBy: `${actorUser.name} (${actorUser.roleLabel || actorUser.role})`,
      createdAt: new Date().toISOString().slice(0, 10),
      description: data.description || ''
    }

    list.push(newRule)
    this._setItem(STORAGE_KEYS.RULES, list)

    auditService.logEvent({
      actor: `${actorUser.name} (${actorUser.roleLabel || actorUser.role})`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'ALERT_RULE_CREATED',
      entity: newRule.id,
      entityName: newRule.name,
      previousValue: 'None',
      newValue: `Rule created with priority ${newRule.priority}`,
      reason: newRule.description || 'New scheduled alert defined',
      policyVersion: '1.0',
      scope: newRule.scope
    })

    this._notify()
    return newRule
  }

  /**
   * Toggle alert rule enabled status
   */
  toggleAlertRule(id, enabled, actorUser = { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }) {
    const list = [...this.getAlertRules()]
    const idx = list.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error(`Alert rule '${id}' not found.`)

    const current = list[idx]
    list[idx] = { ...current, enabled }
    this._setItem(STORAGE_KEYS.RULES, list)

    auditService.logEvent({
      actor: `${actorUser.name} (${actorUser.roleLabel || actorUser.role})`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'ALERT_RULE_TOGGLED',
      entity: current.id,
      entityName: current.name,
      previousValue: `Enabled: ${current.enabled}`,
      newValue: `Enabled: ${enabled}`,
      reason: `Rule status changed to ${enabled ? 'Active' : 'Disabled'}`,
      policyVersion: '1.0',
      scope: current.scope
    })

    this._notify()
    return list[idx]
  }

  /**
   * Preview which recipients would receive notifications under this rule
   */
  previewRecipients(ruleId) {
    const rule = this.getRuleById(ruleId)
    if (!rule) return []

    const allEmployees = employeeService.getAllEmployees()

    if (rule.recipientRole === 'all') {
      return allEmployees
    }
    if (rule.recipientRole === 'super_admin') {
      return allEmployees.filter((e) => e.role === 'super_admin' || e.id === 'EMP-001')
    }
    if (rule.recipientRole === 'hr_admin') {
      return allEmployees.filter((e) => e.role === 'hr_admin' || e.departmentId === 'DEP-04' || e.id === 'EMP-002')
    }
    if (rule.recipientRole === 'manager') {
      return allEmployees.filter((e) => e.role === 'manager' || e.designation?.toLowerCase().includes('manager'))
    }
    if (rule.recipientRole === 'employee') {
      return allEmployees
    }

    return allEmployees
  }

  /**
   * Preview trigger results (evaluates simulated event against demo employee database)
   */
  previewTriggerResults(ruleId) {
    const rule = this.getRuleById(ruleId)
    if (!rule) return []

    const allEmployees = employeeService.getAllEmployees()

    // Deterministic simulation based on triggerEvent
    if (rule.triggerEvent === 'probation_ending') {
      return allEmployees.filter((e) => e.status === 'Probation' || e.employmentType === 'Probation').map((e) => ({
        targetId: e.id,
        targetName: e.name,
        targetDepartment: e.department,
        metric: 'Probation Ending in 14 days (Nov 08, 2026)',
        status: 'Trigger Met'
      }))
    }

    if (rule.triggerEvent === 'excess_lates') {
      return [
        {
          targetId: 'EMP-004',
          targetName: 'Zeeshan Ali',
          targetDepartment: 'Development',
          metric: '4 Recorded Lates (At policy threshold)',
          status: 'Warning Imminent'
        }
      ]
    }

    if (rule.triggerEvent === 'payroll_cutoff') {
      return [
        {
          targetId: 'COMP-ISYSWARE',
          targetName: 'iSysware Monthly Payroll Run',
          targetDepartment: 'Finance & HR',
          metric: 'Cutoff on 25th of month (3 days remaining)',
          status: 'Trigger Met'
        }
      ]
    }

    if (rule.triggerEvent === 'employee_birthday') {
      return [
        {
          targetId: 'EMP-003',
          targetName: 'Bilal Siddiqui',
          targetDepartment: 'Development',
          metric: 'Birthday on October 28',
          status: 'Trigger Scheduled'
        }
      ]
    }

    // Generic fallback preview
    return [
      {
        targetId: 'EMP-004',
        targetName: 'Zeeshan Ali',
        targetDepartment: 'Development',
        metric: `${rule.name} trigger evaluated`,
        status: 'Trigger Ready'
      }
    ]
  }

  /**
   * Get notifications scoped to requesting user
   */
  getNotificationsForUser(user) {
    if (!user) return []
    const all = this._getItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS)

    return all.filter((n) => {
      // Super admin sees all or super_admin scoped
      if (user.role === 'super_admin') return true
      // Exact recipient match
      if (n.recipientId === user.id) return true
      // Role match
      if (n.recipientRole === user.role || n.recipientRole === 'all') return true
      return false
    })
  }

  /**
   * Mark a single notification as read
   */
  markAsRead(notificationId) {
    const list = [...this._getItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS)]
    const idx = list.findIndex((n) => n.id === notificationId)
    if (idx === -1) return false

    list[idx] = { ...list[idx], isRead: true }
    this._setItem(STORAGE_KEYS.NOTIFICATIONS, list)
    this._notify()
    return true
  }

  /**
   * Mark all notifications for a user as read
   */
  markAllAsRead(user) {
    if (!user) return 0
    const list = [...this._getItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS)]
    let count = 0

    const updated = list.map((n) => {
      const isTarget = user.role === 'super_admin' || n.recipientId === user.id || n.recipientRole === user.role || n.recipientRole === 'all'
      if (isTarget && !n.isRead) {
        count += 1
        return { ...n, isRead: true }
      }
      return n
    })

    this._setItem(STORAGE_KEYS.NOTIFICATIONS, updated)
    this._notify()
    return count
  }
}

export const scheduledAlertService = new ScheduledAlertService()
export default scheduledAlertService
