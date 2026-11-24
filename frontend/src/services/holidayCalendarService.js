/**
 * iSysware HRMS — Working Calendar & Holiday Management Service (Batch F13)
 * Authoritative single source of truth for:
 * - Configurable working week (e.g. Mon-Fri or alternative shifts)
 * - Weekly off days (avoiding hardcoded Saturday/Sunday assumptions)
 * - Public, religious and company holidays registry
 * - Accurate working-day calculation engine for Leave, Attendance, and SLA modules
 */

import { INITIAL_HOLIDAYS_2026 } from '../mocks/settingsData.js'
import { companySettingsService } from './companySettingsService.js'
import { auditService } from './auditService.js'

const STORAGE_KEYS = {
  HOLIDAYS: 'isysware_hrms_f13_holidays_v1'
}

class HolidayCalendarService {
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
    if (!this._getItem(STORAGE_KEYS.HOLIDAYS, null)) {
      this._setItem(STORAGE_KEYS.HOLIDAYS, INITIAL_HOLIDAYS_2026)
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
        console.error('Error in holidayCalendarService listener:', err)
      }
    }
  }

  resetAllData() {
    this.memoryStorage[STORAGE_KEYS.HOLIDAYS] = JSON.parse(JSON.stringify(INITIAL_HOLIDAYS_2026))
    this._setItem(STORAGE_KEYS.HOLIDAYS, JSON.parse(JSON.stringify(INITIAL_HOLIDAYS_2026)))
    this._notify()
  }

  /**
   * Get all holidays, optionally filtered by year
   */
  getHolidays(year = '2026') {
    const list = this._getItem(STORAGE_KEYS.HOLIDAYS, INITIAL_HOLIDAYS_2026)
    if (!year || year === 'all') return list
    return list.filter((h) => h.date.startsWith(String(year)))
  }

  /**
   * Check if a specific date string ('YYYY-MM-DD') is an official holiday
   */
  isHoliday(dateStr) {
    const holidays = this.getHolidays('all')
    const match = holidays.find((h) => h.date === dateStr)
    return match ? { isHoliday: true, holiday: match } : { isHoliday: false, holiday: null }
  }

  /**
   * Check if a specific date string is a configured weekly off day
   */
  isWeeklyOff(dateStr) {
    const profile = companySettingsService.getCompanyProfile()
    const weeklyOffDays = profile.weeklyOffDays || ['Saturday', 'Sunday']
    const dateObj = new Date(dateStr)
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
    return weeklyOffDays.includes(dayName)
  }

  /**
   * Check if a date is a standard working day
   */
  isWorkingDay(dateStr) {
    if (this.isWeeklyOff(dateStr)) return false
    const holidayCheck = this.isHoliday(dateStr)
    if (holidayCheck.isHoliday && !holidayCheck.holiday.isWorkingDay) return false
    return true
  }

  /**
   * Calculate exact working days between startDate and endDate (inclusive)
   */
  calculateWorkingDays(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 0
    let start = new Date(startDateStr)
    let end = new Date(endDateStr)
    if (start > end) return 0

    let workingDays = 0
    let current = new Date(start)

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10)
      if (this.isWorkingDay(dateStr)) {
        workingDays += 1
      }
      current.setDate(current.getDate() + 1)
    }

    return workingDays
  }

  /**
   * Add a new holiday (Super Admin or authorized HR)
   */
  addHoliday(holidayData, actorUser = { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }) {
    if (actorUser.role !== 'super_admin' && actorUser.role !== 'hr_admin') {
      throw new Error('Unauthorized: Only Super Admin or HR Admin can configure company holidays.')
    }
    if (!holidayData.name || !holidayData.date) {
      throw new Error('Holiday name and date are required.')
    }

    const list = [...this.getHolidays('all')]
    if (list.some((h) => h.date === holidayData.date)) {
      throw new Error(`A holiday on ${holidayData.date} already exists.`)
    }

    const dateObj = new Date(holidayData.date)
    const day = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
    const newId = `HOL-${holidayData.date.slice(0, 4)}-${String(list.length + 1).padStart(2, '0')}`

    const newHoliday = {
      id: newId,
      name: holidayData.name,
      date: holidayData.date,
      day: holidayData.day || day,
      type: holidayData.type || 'Company',
      isWorkingDay: Boolean(holidayData.isWorkingDay),
      description: holidayData.description || ''
    }

    list.push(newHoliday)
    list.sort((a, b) => a.date.localeCompare(b.date))
    this._setItem(STORAGE_KEYS.HOLIDAYS, list)

    auditService.logEvent({
      actor: `${actorUser.name} (${actorUser.roleLabel || actorUser.role})`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'HOLIDAY_CREATED',
      entity: newHoliday.id,
      entityName: newHoliday.name,
      previousValue: 'None',
      newValue: `${newHoliday.name} on ${newHoliday.date} (${newHoliday.type})`,
      reason: holidayData.description || 'Calendar holiday added',
      policyVersion: '1.0',
      scope: 'company_wide'
    })

    this._notify()
    return newHoliday
  }

  /**
   * Update an existing holiday
   */
  updateHoliday(id, holidayData, actorUser = { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }) {
    if (actorUser.role !== 'super_admin' && actorUser.role !== 'hr_admin') {
      throw new Error('Unauthorized: Only Super Admin or HR Admin can configure company holidays.')
    }
    const list = [...this.getHolidays('all')]
    const idx = list.findIndex((h) => h.id === id)
    if (idx === -1) throw new Error(`Holiday '${id}' not found.`)

    const prev = list[idx]
    const dateObj = new Date(holidayData.date || prev.date)
    const day = dateObj.toLocaleDateString('en-US', { weekday: 'long' })

    const updated = {
      ...prev,
      ...holidayData,
      day: holidayData.day || day
    }

    list[idx] = updated
    list.sort((a, b) => a.date.localeCompare(b.date))
    this._setItem(STORAGE_KEYS.HOLIDAYS, list)

    auditService.logEvent({
      actor: `${actorUser.name} (${actorUser.roleLabel || actorUser.role})`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'HOLIDAY_UPDATED',
      entity: updated.id,
      entityName: updated.name,
      previousValue: `${prev.name} on ${prev.date} (${prev.type})`,
      newValue: `${updated.name} on ${updated.date} (${updated.type})`,
      reason: holidayData.description || 'Holiday updated',
      policyVersion: '1.0',
      scope: 'company_wide'
    })

    this._notify()
    return updated
  }

  /**
   * Delete a holiday
   */
  deleteHoliday(id, actorUser = { name: 'Tariq Mehmood', role: 'super_admin', id: 'EMP-001' }) {
    if (actorUser.role !== 'super_admin') {
      throw new Error('Unauthorized: Only Super Admin can delete official calendar holidays.')
    }

    const list = [...this.getHolidays('all')]
    const target = list.find((h) => h.id === id)
    if (!target) throw new Error(`Holiday '${id}' not found.`)

    const updated = list.filter((h) => h.id !== id)
    this._setItem(STORAGE_KEYS.HOLIDAYS, updated)

    auditService.logEvent({
      actor: `${actorUser.name} (Super Admin)`,
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: 'HOLIDAY_DELETED',
      entity: target.id,
      entityName: target.name,
      previousValue: `${target.name} on ${target.date}`,
      newValue: 'DELETED',
      reason: 'Holiday removed from official calendar',
      policyVersion: '1.0',
      scope: 'company_wide'
    })

    this._notify()
    return true
  }
}

export const holidayCalendarService = new HolidayCalendarService()
export default holidayCalendarService
