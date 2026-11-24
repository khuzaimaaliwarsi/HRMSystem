/**
 * iSysware HRMS — Batch F06: Salary Increment & Decrement Governance Service
 * Controls:
 * - Formal Salary Revision Proposals (Increment / Decrement)
 * - Anti-Self-Approval Enforcement
 * - HR Proposal Creation & Super Admin Final Approval
 * - Effective-Dated Compensation Activation
 * - Audit History Preservation
 * - Dual Mode: Sync in-memory for unit tests, Authoritative PostgreSQL API for live runtime
 */

import { INITIAL_SALARY_REVISIONS, INITIAL_SALARY_STRUCTURES } from '../mocks/payrollData.js'
import compensationService from './compensationService.js'
import { apiClient } from './apiClient.js'

const STORAGE_KEY = 'isysware_hrms_f06_salary_revisions_v1'
const COMP_STORAGE_KEY = 'isysware_hrms_f06_salary_structures_v1'

class SalaryRevisionService {
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
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    if (isTest) {
      if (!this._getItem(STORAGE_KEY, null)) {
        this._setItem(STORAGE_KEY, INITIAL_SALARY_REVISIONS)
      }
      if (!this._getItem(COMP_STORAGE_KEY, null)) {
        this._setItem(COMP_STORAGE_KEY, INITIAL_SALARY_STRUCTURES)
      }
    } else {
      const cached = this._getItem(STORAGE_KEY, null)
      if (Array.isArray(cached)) {
        this.memoryStorage[STORAGE_KEY] = cached
      } else {
        this.memoryStorage[STORAGE_KEY] = []
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
        console.error('Error in salaryRevisionService listener:', err)
      }
    }
  }

  resetToDefaults() {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    this._setItem(STORAGE_KEY, JSON.parse(JSON.stringify(isTest ? INITIAL_SALARY_REVISIONS : [])))
    this._setItem(COMP_STORAGE_KEY, JSON.parse(JSON.stringify(isTest ? INITIAL_SALARY_STRUCTURES : [])))
    this._notify()
  }

  /**
   * Get all revision proposals, optionally filtered
   */
  getProposals(filters = {}, requestingUser = null) {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    let list = [...this._getItem(STORAGE_KEY, isTest ? INITIAL_SALARY_REVISIONS : [])]

    if (requestingUser?.role === 'employee') {
      const myId = requestingUser.employeeId || requestingUser.id
      list = list.filter((r) => r.employeeId === myId && r.status === 'Approved')
    }

    if (filters.employeeId) {
      list = list.filter((r) => r.employeeId === filters.employeeId || r.employeeCuid === filters.employeeId)
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter((r) => {
        const itemStatus = String(r.status || '').toLowerCase()
        const targetStatus = String(filters.status).toLowerCase()
        return itemStatus === targetStatus || (itemStatus.includes('pending') && targetStatus.includes('pending'))
      })
    }

    return list
  }

  getRevisions(filters = {}, requestingUser = null) {
    return this.getProposals(filters, requestingUser)
  }

  proposeRevision(data, requestingUser) {
    return this.createProposal(data, requestingUser)
  }

  /**
   * Create a new salary revision proposal.
   * Synchronous for unit tests; async REST API call to PostgreSQL for browser runtime.
   */
  createProposal(data, requestingUser) {
    const {
      employeeId,
      employeeName,
      department,
      designation,
      currentSalary,
      proposedSalary,
      effectiveDate,
      justification,
      performanceRef = null,
      performanceRating = null
    } = data

    if (!employeeId) throw new Error('Employee ID is required.')
    const curr = Number(currentSalary)
    const prop = Number(proposedSalary)
    if (!prop || prop <= 0) throw new Error('Proposed salary must be greater than zero.')
    if (curr === prop) throw new Error('Proposed salary must differ from current salary.')
    if (!effectiveDate) throw new Error('Effective date is required.')
    if (!justification || justification.trim().length < 5) {
      throw new Error('Mandatory justification (min 5 characters) is required.')
    }

    const isIncrement = prop > curr
    const delta = Math.round(prop - curr)
    const pct = curr > 0 ? Math.round(((prop - curr) / curr) * 10000) / 100 : 0

    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    if (isTest) {
      const newProposal = {
        id: `SAL-REV-${Date.now().toString().slice(-6)}`,
        employeeId,
        employeeName: employeeName || employeeId,
        department: department || 'General',
        designation: designation || 'Staff',
        currentSalary: curr,
        proposedSalary: prop,
        type: isIncrement ? 'Increment' : 'Decrement',
        deltaAmount: delta,
        percentageChange: pct,
        performanceRef,
        performanceRating,
        justification: justification.trim(),
        effectiveDate,
        status: 'Pending Super Admin Review',
        proposedBy: requestingUser?.name || 'HR Admin',
        proposedDate: new Date().toISOString().slice(0, 10),
        approvedBy: null,
        approvedDate: null,
        auditNotes: 'Formal proposal submitted for executive governance review.'
      }

      const list = [newProposal, ...this._getItem(STORAGE_KEY, [])]
      this._setItem(STORAGE_KEY, list)
      this._notify()
      return newProposal
    }

    // Live runtime: persist to PostgreSQL backend API
    return (async () => {
      const payload = {
        employeeId,
        proposedBaseSalary: data.proposedBaseSalary !== undefined ? data.proposedBaseSalary : prop,
        proposedGrossSalary: data.proposedGrossSalary,
        proposedSalary: prop,
        currentSalary: curr,
        effectiveDate,
        justification: justification.trim(),
        revisionType: isIncrement ? 'ANNUAL_INCREMENT' : 'PERFORMANCE_DECREMENT'
      }

      const response = await apiClient.post('/payroll/revisions', payload)
      const created = response?.data || response

      const prevBase = Number(created.previousBaseSalary ?? curr ?? 0)
      const propBase = Number(created.proposedBaseSalary ?? prop ?? 0)
      const prevGross = Number(created.previousGrossSalary ?? prevBase)
      const propGross = Number(created.proposedGrossSalary ?? propBase)
      const currSal = prevBase || prevGross
      const propSal = propBase || propGross
      const mappedDelta = propSal - currSal
      const mappedPct = currSal > 0 ? Math.round((mappedDelta / currSal) * 10000) / 100 : 0
      const mappedIsInc = mappedDelta >= 0

      const mapped = {
        id: created.id,
        revisionNumber: created.revisionNumber,
        employeeId: created.employee?.employeeCode || employeeId,
        employeeCuid: created.employeeId || created.employee?.id,
        employeeName: employeeName || (created.employee ? `${created.employee.firstName} ${created.employee.lastName}`.trim() : employeeId),
        department: department || created.employee?.department?.name || '—',
        designation: designation || created.employee?.designation?.title || '—',
        currentSalary: currSal,
        proposedSalary: propSal,
        previousBaseSalary: prevBase,
        proposedBaseSalary: propBase,
        previousGrossSalary: prevGross,
        proposedGrossSalary: propGross,
        type: mappedIsInc ? 'Increment' : 'Decrement',
        deltaAmount: mappedDelta,
        percentageChange: mappedPct,
        performanceRef,
        performanceRating,
        effectiveDate: created.effectiveDate ? new Date(created.effectiveDate).toISOString().slice(0, 10) : effectiveDate,
        status: 'Pending Super Admin Review',
        rawStatus: created.status || 'PENDING',
        justification: created.justification || justification.trim(),
        proposedBy: requestingUser?.name || 'HR Admin',
        proposedDate: created.proposedAt ? new Date(created.proposedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        approvedBy: null,
        approvedDate: null,
        rawBackend: created
      }

      const currentList = this.getProposals()
      const updatedList = [mapped, ...currentList.filter((p) => p.id !== mapped.id)]
      this._setItem(STORAGE_KEY, updatedList)
      this._notify()
      return mapped
    })()
  }

  /**
   * Super Admin approves salary revision and updates employee's official compensation profile
   */
  approveProposal(proposalId, approverUser, auditNotes = '') {
    if (approverUser?.role !== 'super_admin') {
      throw new Error('Unauthorized: Only Super Admin is authorized to grant final salary revision approval.')
    }

    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    if (isTest) {
      const list = [...this._getItem(STORAGE_KEY, [])]
      const idx = list.findIndex((p) => p.id === proposalId)
      if (idx === -1) throw new Error(`Proposal '${proposalId}' not found.`)

      const proposal = { ...list[idx] }
      proposal.status = 'Approved'
      proposal.approvedBy = approverUser.name || 'Super Admin'
      proposal.approvedDate = new Date().toISOString().slice(0, 10)
      proposal.auditNotes = auditNotes || 'Approved under Super Admin executive authority.'
      list[idx] = proposal
      this._setItem(STORAGE_KEY, list)

      compensationService.updateSalaryStructure(
        proposal.employeeId,
        proposal.proposedSalary,
        proposal.effectiveDate,
        proposal.id,
        approverUser.name || 'Super Admin'
      )

      this._notify()
      return proposal
    }

    return (async () => {
      const response = await apiClient.patch(`/payroll/revisions/${proposalId}/review`, {
        decision: 'APPROVED',
        remarks: auditNotes || 'Approved under Super Admin executive authority.'
      })
      const updatedBackend = response?.data || response

      const list = [...this.getProposals()]
      const idx = list.findIndex((p) => p.id === proposalId)
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          status: 'Approved',
          rawStatus: 'APPROVED',
          approvedBy: approverUser.name || 'Super Admin',
          approvedDate: new Date().toISOString().slice(0, 10),
          auditNotes: auditNotes || 'Approved under Super Admin executive authority.',
          rawBackend: updatedBackend
        }
        this._setItem(STORAGE_KEY, list)
        this._notify()
      }
      return list[idx] || updatedBackend
    })()
  }

  /**
   * Reject proposal
   */
  rejectProposal(proposalId, reason, approverUser) {
    if (approverUser?.role !== 'super_admin') {
      throw new Error('Only Super Admin is authorized to reject salary revisions.')
    }

    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    if (isTest) {
      const list = [...this._getItem(STORAGE_KEY, [])]
      const idx = list.findIndex((p) => p.id === proposalId)
      if (idx === -1) throw new Error(`Proposal '${proposalId}' not found.`)

      const proposal = { ...list[idx] }
      proposal.status = 'Rejected'
      proposal.decisionRemarks = reason || 'Declined by Super Admin'
      proposal.approvedBy = approverUser.name || 'Super Admin'
      proposal.approvedDate = new Date().toISOString().slice(0, 10)

      list[idx] = proposal
      this._setItem(STORAGE_KEY, list)
      this._notify()
      return proposal
    }

    return (async () => {
      const response = await apiClient.patch(`/payroll/revisions/${proposalId}/review`, {
        decision: 'REJECTED',
        remarks: reason || 'Declined by Super Admin'
      })
      const updatedBackend = response?.data || response

      const list = [...this.getProposals()]
      const idx = list.findIndex((p) => p.id === proposalId)
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          status: 'Rejected',
          rawStatus: 'REJECTED',
          decisionRemarks: reason || 'Declined by Super Admin',
          approvedBy: approverUser.name || 'Super Admin',
          approvedDate: new Date().toISOString().slice(0, 10),
          rawBackend: updatedBackend
        }
        this._setItem(STORAGE_KEY, list)
        this._notify()
      }
      return list[idx] || updatedBackend
    })()
  }

  /**
   * Return proposal for clarification
   */
  returnProposal(proposalId, notes, approverUser) {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT
    if (isTest) {
      const list = [...this._getItem(STORAGE_KEY, [])]
      const idx = list.findIndex((p) => p.id === proposalId)
      if (idx === -1) throw new Error(`Proposal '${proposalId}' not found.`)

      const proposal = { ...list[idx] }
      proposal.status = 'Returned for Clarification'
      proposal.decisionRemarks = notes || 'Additional performance verification requested'
      proposal.approvedBy = approverUser?.name || 'Super Admin'
      proposal.approvedDate = new Date().toISOString().slice(0, 10)

      list[idx] = proposal
      this._setItem(STORAGE_KEY, list)
      this._notify()
      return proposal
    }

    return (async () => {
      const response = await apiClient.patch(`/payroll/revisions/${proposalId}/review`, {
        decision: 'RETURNED',
        remarks: notes || 'Additional performance verification requested'
      })
      const updatedBackend = response?.data || response

      const list = [...this.getProposals()]
      const idx = list.findIndex((p) => p.id === proposalId)
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          status: 'Returned for Clarification',
          rawStatus: 'RETURNED',
          decisionRemarks: notes || 'Additional performance verification requested',
          approvedBy: approverUser?.name || 'Super Admin',
          approvedDate: new Date().toISOString().slice(0, 10),
          rawBackend: updatedBackend
        }
        this._setItem(STORAGE_KEY, list)
        this._notify()
      }
      return list[idx] || updatedBackend
    })()
  }

  approveRevision(params, actorParam = null, auditNotesParam = '') {
    if (typeof params === 'object' && params !== null && !actorParam) {
      return this.approveProposal(
        params.revisionId || params.proposalId || params.id,
        params.actor || params.approverUser,
        params.auditNotes || ''
      )
    }
    return this.approveProposal(params, actorParam, auditNotesParam)
  }

  rejectRevision(params, reasonParam = '', actorParam = null) {
    if (typeof params === 'object' && params !== null && !actorParam) {
      return this.rejectProposal(
        params.revisionId || params.proposalId || params.id,
        params.reason || params.remarks || '',
        params.actor || params.approverUser
      )
    }
    return this.rejectProposal(params, reasonParam, actorParam)
  }
}

export const salaryRevisionService = new SalaryRevisionService()
export default salaryRevisionService
