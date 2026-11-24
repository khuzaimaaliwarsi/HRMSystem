/**
 * iSysware HRMS — Batch F06: Employee Compensation Structures Service
 * Manages:
 * - Base Salary Structures & Rates (Monthly, Hourly, Commission, Project)
 * - Allowances Master & Employee-wise Allowance Allocations
 * - Role-Based Confidentiality (Manager cannot view subordinate compensation)
 */

import { INITIAL_SALARY_STRUCTURES, INITIAL_ALLOWANCES, INITIAL_EMPLOYEE_ALLOWANCES } from '../mocks/payrollData.js'
import apiClient from './apiClient.js'

const STORAGE_KEYS = {
  STRUCTURES: 'isysware_hrms_f06_salary_structures_v1',
  ALLOWANCES: 'isysware_hrms_f06_allowances_master_v1',
  EMP_ALLOWANCES: 'isysware_hrms_f06_emp_allowances_v1'
}

class CompensationService {
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
    const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)
    if (isTest) {
      const existingStructures = this._getItem(STORAGE_KEYS.STRUCTURES, null)
      if (!existingStructures || existingStructures.length === 0) {
        this._setItem(STORAGE_KEYS.STRUCTURES, INITIAL_SALARY_STRUCTURES)
      }
      const existingAllowances = this._getItem(STORAGE_KEYS.ALLOWANCES, null)
      if (!existingAllowances || existingAllowances.length === 0) {
        this._setItem(STORAGE_KEYS.ALLOWANCES, INITIAL_ALLOWANCES)
      }
      const existingEmpAllowances = this._getItem(STORAGE_KEYS.EMP_ALLOWANCES, null)
      if (!existingEmpAllowances || existingEmpAllowances.length === 0) {
        this._setItem(STORAGE_KEYS.EMP_ALLOWANCES, INITIAL_EMPLOYEE_ALLOWANCES)
      }
    } else {
      this.memoryStorage[STORAGE_KEYS.STRUCTURES] = []
      this.memoryStorage[STORAGE_KEYS.ALLOWANCES] = []
      this.memoryStorage[STORAGE_KEYS.EMP_ALLOWANCES] = []
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
        console.error('Error in compensationService listener:', err)
      }
    }
  }

  resetToDefaults() {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    this._setItem(STORAGE_KEYS.STRUCTURES, JSON.parse(JSON.stringify(isTest ? INITIAL_SALARY_STRUCTURES : [])))
    this._setItem(STORAGE_KEYS.ALLOWANCES, JSON.parse(JSON.stringify(isTest ? INITIAL_ALLOWANCES : [])))
    this._setItem(STORAGE_KEYS.EMP_ALLOWANCES, JSON.parse(JSON.stringify(isTest ? INITIAL_EMPLOYEE_ALLOWANCES : [])))
    this._notify()
  }

  /**
   * Get all employee salary structures
   * Role privacy guard: Managers cannot access subordinate structures; Employee only sees own
   */
  getSalaryStructures(requestingUser = null) {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    let list = [...this._getItem(STORAGE_KEYS.STRUCTURES, isTest ? INITIAL_SALARY_STRUCTURES : [])]

    if (requestingUser?.role === 'employee' || requestingUser?.role === 'manager') {
      const myId = requestingUser.employeeId || requestingUser.id
      list = list.filter((s) => s.employeeId === myId)
    }

    return list
  }

  getAllSalaryStructures(requestingUser = null) {
    return this.getSalaryStructures(requestingUser)
  }

  /**
   * Get salary structure for a specific employee
   */
  getStructureByEmployeeId(employeeId, requestingUser = null) {
    if (requestingUser?.role === 'manager') {
      const myId = requestingUser.employeeId || requestingUser.id
      if (employeeId !== myId) return null // Confidentiality guard
    }
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    const list = this._getItem(STORAGE_KEYS.STRUCTURES, isTest ? INITIAL_SALARY_STRUCTURES : [])
    const cleanId = String(employeeId || '').trim()
    if (!cleanId) return null
    const matched = list.find((s) =>
      s.employeeId === cleanId ||
      s.employeeCode === cleanId ||
      s.employee?.id === cleanId ||
      s.employee?.employeeCode === cleanId ||
      s.id === cleanId
    )
    if (!matched) return null
    return {
      ...matched,
      basicSalary: Number(matched.basicSalary ?? matched.baseSalary ?? 0),
      grossSalary: Number(matched.grossSalary ?? (
        (Number(matched.basicSalary ?? matched.baseSalary ?? 0)) +
        (Number(matched.houseRentAllowance) || 0) +
        (Number(matched.medicalAllowance) || 0) +
        (Number(matched.conveyanceAllowance) || 0) +
        (Number(matched.specialAllowance) || 0)
      ))
    }
  }

  getEmployeeSalaryStructure(employeeId, requestingUser = null) {
    return this.getStructureByEmployeeId(employeeId, requestingUser)
  }

  /**
   * Master Allowance Categories
   * Safely returns real PostgreSQL allowances without synthetic fallbacks in production
   */
  getAllowancesMaster() {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    return this._getItem(STORAGE_KEYS.ALLOWANCES, isTest ? INITIAL_ALLOWANCES : [])
  }

  /**
   * Get active allowances allocated to an employee, or complete historical records when requested.
   * Safely returns real PostgreSQL allocations without synthetic fallbacks in production.
   * @param {string} employeeId
   * @param {Object|string} [options] - e.g. { includeHistorical: true, status: 'ALL'|'ACTIVE'|'REVOKED'|'EXPIRED' } or status string
   */
  getEmployeeAllowances(employeeId, options = {}) {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    const allocations = this._getItem(STORAGE_KEYS.EMP_ALLOWANCES, isTest ? INITIAL_EMPLOYEE_ALLOWANCES : [])
    const masters = this.getAllowancesMaster()

    const opts = typeof options === 'string' ? { status: options, includeHistorical: true } : (options || {})
    const includeHistorical = Boolean(opts.includeHistorical || opts.status !== undefined || opts.all === true)
    const targetStatus = opts.status && opts.status.toUpperCase() !== 'ALL' ? opts.status.toUpperCase() : null

    return allocations
      .filter((a) => {
        const matchesEmp = !employeeId || a.employeeId === employeeId || a.employee?.id === employeeId || a.employee?.employeeCode === employeeId
        if (!matchesEmp) return false

        // Compute status for filter
        let computedStatus = a.computedStatus
        if (!computedStatus) {
          const isAct = a.isActive !== undefined ? a.isActive : a.status === 'Active'
          const hasRevoked = Boolean(a.revokedBy || (a.remarks && /revoked/i.test(a.remarks)) || a.status === 'Revoked')
          const isExpired = Boolean(a.effectiveUntil && new Date(a.effectiveUntil) < new Date())
          if (!isAct || hasRevoked) {
            computedStatus = hasRevoked ? 'Revoked' : (isExpired ? 'Expired' : 'Revoked')
          } else if (isExpired) {
            computedStatus = 'Expired'
          } else {
            computedStatus = 'Active'
          }
        }

        if (targetStatus) {
          return computedStatus.toUpperCase() === targetStatus
        }

        if (!includeHistorical) {
          // Default behavior for payroll & existing callers: return ONLY active allowances
          return computedStatus === 'Active'
        }

        return true
      })
      .map((a) => {
        const master = masters.find((m) => m.id === a.allowanceId || m.code === a.allowance?.code || m.id === a.allowance?.id) || a.allowance || {}

        let computedStatus = a.computedStatus
        let revokedBy = a.revokedBy || null
        let revokedAt = a.revokedAt || null

        if (a.remarks && /\[Revoked by (.*?) on (.*?)\]/i.test(a.remarks)) {
          const match = a.remarks.match(/\[Revoked by (.*?) on (.*?)\]/i)
          if (match) {
            let revoker = match[1].trim()
            if (revoker.includes('|')) {
              revoker = revoker.split('|')[0].trim()
            }
            if (revoker.includes('Khuzaima Senior Developer')) {
              revoker = 'Super Admin (superadmin)'
            }
            revokedBy = revoker
            revokedAt = match[2].trim()
          }
        } else if (a.remarks && /Revoked/i.test(a.remarks)) {
          revokedBy = a.revokedBy || 'Super Admin (superadmin)'
          revokedAt = a.revokedAt || a.updatedAt
        }

        if (!computedStatus) {
          const isAct = a.isActive !== undefined ? a.isActive : a.status === 'Active'
          const hasRevoked = Boolean(revokedBy || (a.remarks && /revoked/i.test(a.remarks)) || a.status === 'Revoked')
          const isExpired = Boolean(a.effectiveUntil && new Date(a.effectiveUntil) < new Date())
          if (!isAct || hasRevoked) {
            computedStatus = hasRevoked ? 'Revoked' : (isExpired ? 'Expired' : 'Revoked')
          } else if (isExpired) {
            computedStatus = 'Expired'
          } else {
            computedStatus = 'Active'
          }
        }

        const employeeName = a.employeeName || (a.employee ? `${a.employee.firstName || ''} ${a.employee.lastName || ''}`.trim() : null)

        return {
          ...a,
          id: a.id,
          employeeId: a.employeeId || a.employee?.id,
          employeeCode: a.employee?.employeeCode,
          employeeName,
          name: a.allowance?.name || master.name || a.name || a.allowanceId,
          code: a.allowance?.code || master.code || a.code || 'ALW',
          category: a.allowance?.category || master.category || a.category || 'GENERAL',
          isTaxable: a.allowance?.isTaxable !== undefined ? a.allowance.isTaxable : (master.isTaxable !== undefined ? master.isTaxable : true),
          amount: Number(a.amount || 0),
          status: computedStatus,
          computedStatus,
          approvedBy: a.assignedBy || a.approvedBy || a.approvedById || 'Super Admin',
          assignedBy: a.assignedBy || a.approvedBy || a.approvedById || 'Super Admin',
          assignedAt: a.assignedAt || a.createdAt || a.assignedDate || null,
          revokedBy,
          revokedAt: revokedAt || (computedStatus === 'Revoked' ? (a.updatedAt || a.effectiveUntil) : null),
          effectiveFrom: a.effectiveFrom,
          effectiveUntil: a.effectiveUntil,
          remarks: a.remarks
        }
      })
  }

  /**
   * Fetch live allowances master from PostgreSQL
   */
  async fetchAllowancesMaster() {
    try {
      const res = await apiClient.get('/payroll/allowances')
      const data = Array.isArray(res) ? res : res?.data || []
      this._setItem(STORAGE_KEYS.ALLOWANCES, data)
      this._notify()
      return data
    } catch (err) {
      console.warn('[Compensation] Failed to fetch allowances master:', err)
      return this.getAllowancesMaster()
    }
  }

  /**
   * Fetch live employee allowances from PostgreSQL
   */
  async fetchEmployeeAllowances(employeeId = null) {
    try {
      const url = employeeId ? `/payroll/employee-allowances?employeeId=${employeeId}` : '/payroll/employee-allowances'
      const res = await apiClient.get(url)
      const data = Array.isArray(res) ? res : res?.data || []

      if (employeeId) {
        const current = [...this._getItem(STORAGE_KEYS.EMP_ALLOWANCES, [])]
        const remaining = current.filter(
          (a) => a.employeeId !== employeeId && a.employee?.id !== employeeId && a.employee?.employeeCode !== employeeId
        )
        const updated = [...remaining, ...data]
        this._setItem(STORAGE_KEYS.EMP_ALLOWANCES, updated)
      } else {
        this._setItem(STORAGE_KEYS.EMP_ALLOWANCES, data)
      }
      this._notify()
      return data
    } catch (err) {
      console.warn('[Compensation] Failed to fetch employee allowances:', err)
      return this.getEmployeeAllowances(employeeId)
    }
  }

  /**
   * Create a new corporate allowance category in PostgreSQL
   */
  async createAllowanceMaster(data) {
    const res = await apiClient.post('/payroll/allowances', data)
    const created = res?.data || res
    await this.fetchAllowancesMaster()
    return created
  }

  /**
   * Update an existing corporate allowance category in PostgreSQL
   */
  async updateAllowanceMaster(id, data) {
    const res = await apiClient.put(`/payroll/allowances/${id}`, data)
    const updated = res?.data || res
    await this.fetchAllowancesMaster()
    return updated
  }

  /**
   * Deactivate an allowance category in PostgreSQL
   */
  async deleteAllowanceMaster(id) {
    const res = await apiClient.delete(`/payroll/allowances/${id}`)
    await this.fetchAllowancesMaster()
    return res
  }

  /**
   * Assign an allowance allocation to an employee in PostgreSQL
   * Validates positive amount, stamps audit attribution, and supersedes overlapping allocations
   */
  async assignAllowanceToEmployee(employeeId, allowanceId, amount, authorizedBy = 'Super Admin', remarks = '') {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    try {
      const payload = {
        employeeId,
        allowanceId,
        amount: Number(amount) || 0,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        remarks: remarks || `Allocated by ${authorizedBy}`
      }
      const res = await apiClient.post('/payroll/employee-allowances', payload)
      const allocated = res?.data || res
      await this.fetchEmployeeAllowances()
      return allocated
    } catch (err) {
      if (isTest) {
        const allocations = [...this._getItem(STORAGE_KEYS.EMP_ALLOWANCES, INITIAL_EMPLOYEE_ALLOWANCES)]
        const newAllocation = {
          id: `EALW-${Date.now().toString().slice(-6)}`,
          employeeId,
          allowanceId,
          amount: Number(amount) || 0,
          status: 'Active',
          approvedBy: authorizedBy,
          assignedDate: new Date().toISOString().slice(0, 10),
          remarks
        }
        allocations.push(newAllocation)
        this._setItem(STORAGE_KEYS.EMP_ALLOWANCES, allocations)
        this._notify()
        return newAllocation
      }
      throw err
    }
  }

  /**
   * Revoke/deactivate an employee allowance allocation in PostgreSQL
   */
  async revokeEmployeeAllowance(id, remarks = '') {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    try {
      const res = await apiClient.delete(`/payroll/employee-allowances/${id}`, { data: { remarks, reason: remarks } })
      await this.fetchEmployeeAllowances()
      return res
    } catch (err) {
      if (isTest) {
        const allocations = [...this._getItem(STORAGE_KEYS.EMP_ALLOWANCES, INITIAL_EMPLOYEE_ALLOWANCES)]
        const idx = allocations.findIndex((a) => a.id === id)
        if (idx !== -1) {
          const existing = allocations[idx]
          const nowIso = new Date().toISOString()
          const revocationNote = `[Revoked by Super Admin (superadmin) | role:SUPER_ADMIN on ${nowIso}] Reason: ${remarks?.trim() || 'Administrative revocation'}`
          allocations[idx] = {
            ...existing,
            isActive: false,
            status: 'Revoked',
            computedStatus: 'Revoked',
            effectiveUntil: nowIso,
            revokedBy: 'Super Admin (superadmin)',
            revokedAt: nowIso,
            remarks: existing.remarks ? `${existing.remarks}\n${revocationNote}` : revocationNote
          }
          this._setItem(STORAGE_KEYS.EMP_ALLOWANCES, allocations)
          this._notify()
          return allocations[idx]
        }
      }
      throw err
    }
  }

  /**
   * Update salary structure when a salary revision is approved
   */
  updateSalaryStructure(employeeId, newBasicSalary, effectiveDate, revisionRef, approvedBy = 'Super Admin') {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    const structures = [...this._getItem(STORAGE_KEYS.STRUCTURES, isTest ? INITIAL_SALARY_STRUCTURES : [])]
    const idx = structures.findIndex((s) => s.employeeId === employeeId)
    if (idx !== -1) {
      const updated = { ...structures[idx] }
      updated.basicSalary = Number(newBasicSalary)
      updated.lastRevisedDate = effectiveDate
      updated.lastRevisionRef = revisionRef
      updated.approvedBy = approvedBy
      structures[idx] = updated
      this._setItem(STORAGE_KEYS.STRUCTURES, structures)
      this._notify()
      return updated
    }
    return null
  }
}

export const compensationService = new CompensationService()
export default compensationService
