/**
 * iSysware HRMS — Batch F09: Help Desk Management Service
 * Authoritative orchestrator for:
 * - Centralized Support Ticket Lifecycle (Open -> Assigned -> In Progress -> Pending Employee -> Resolved -> Closed / Reopened)
 * - Category-based Routing to IT, HR, Payroll, and Admin Teams
 * - Dynamic SLA Calculation (Critical, High, Medium, Low) & Breach Detection
 * - Role-Based Confidentiality & Strict Internal Notes Privacy Shielding
 * - Employee Satisfaction Feedback (1-5 Stars) & Resolution Auditing
 * - Operational Analytics & Team Workload Metrics (PostgreSQL-backed in browser sessions)
 */

import {
  SUPPORT_TEAMS,
  TICKET_CATEGORIES,
  SLA_TARGETS,
  INITIAL_TICKETS
} from '../mocks/helpDeskData.js'
import apiClient from './apiClient.js'

const STORAGE_KEYS = {
  TICKETS: 'isysware_hrms_f09_tickets_v1',
  CATEGORIES: 'isysware_hrms_f09_categories_v1',
  TEAMS: 'isysware_hrms_f09_teams_v1',
  SLA_TARGETS: 'isysware_hrms_f09_sla_targets_v1',
  KPIS: 'isysware_hrms_f09_kpis_v1'
}

const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)

function normalizeRole(role) {
  const r = String(role || 'employee').toLowerCase()
  if (r === 'dept_manager') return 'manager'
  return r
}

function matchesUserIdentity(ticketEmpId, ticketEmpCode, user) {
  if (!user) return false
  const userIds = new Set(
    [user.employeeId, user.employeeCode, user.id, user.userId].filter(Boolean)
  )
  return (ticketEmpId && userIds.has(ticketEmpId)) || (ticketEmpCode && userIds.has(ticketEmpCode))
}

class HelpDeskService {
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
    return defaultVal !== undefined ? defaultVal : []
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
    const existingTickets = this._getItem(STORAGE_KEYS.TICKETS, null)
    if (!existingTickets || existingTickets.length === 0) {
      this._setItem(STORAGE_KEYS.TICKETS, JSON.parse(JSON.stringify(INITIAL_TICKETS)))
    }
    const existingCats = this._getItem(STORAGE_KEYS.CATEGORIES, null)
    if (!existingCats || existingCats.length === 0) {
      this._setItem(STORAGE_KEYS.CATEGORIES, JSON.parse(JSON.stringify(TICKET_CATEGORIES)))
    }
    const existingTeams = this._getItem(STORAGE_KEYS.TEAMS, null)
    if (!existingTeams || existingTeams.length === 0) {
      this._setItem(STORAGE_KEYS.TEAMS, JSON.parse(JSON.stringify(SUPPORT_TEAMS)))
    }
    this._setItem(STORAGE_KEYS.SLA_TARGETS, SLA_TARGETS)
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
        console.error('Error in helpDeskService listener:', err)
      }
    }
  }

  resetToDefaults() {
    const tickets = isTest ? INITIAL_TICKETS : []
    this._setItem(STORAGE_KEYS.TICKETS, JSON.parse(JSON.stringify(tickets)))
    this._setItem(STORAGE_KEYS.CATEGORIES, JSON.parse(JSON.stringify(TICKET_CATEGORIES)))
    this._setItem(STORAGE_KEYS.TEAMS, JSON.parse(JSON.stringify(SUPPORT_TEAMS)))
    this._setItem(STORAGE_KEYS.SLA_TARGETS, JSON.parse(JSON.stringify(SLA_TARGETS)))
    if (!isTest) this._setItem(STORAGE_KEYS.KPIS, null)
    this._notify()
  }

  // ==========================================
  // POSTGRESQL API SYNCHRONIZATION (BROWSER)
  // ==========================================

  _upsertTicketInMemory(apiTicket) {
    if (!apiTicket) return null
    const existing = Array.isArray(this.memoryStorage[STORAGE_KEYS.TICKETS])
      ? [...this.memoryStorage[STORAGE_KEYS.TICKETS]]
      : []
    const idx = existing.findIndex(
      (t) =>
        (apiTicket.id && t.id === apiTicket.id) ||
        (apiTicket.ticketId && t.ticketId === apiTicket.ticketId)
    )
    if (idx === -1) {
      existing.unshift(apiTicket)
    } else {
      existing[idx] = apiTicket
    }
    this._setItem(STORAGE_KEYS.TICKETS, existing)
    return apiTicket
  }

  async loadHelpDeskDataAsync(filters = {}) {
    if (isTest) return { tickets: this.getTickets(filters), kpis: this.getHelpDeskKPIs() }

    const params = new URLSearchParams()
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        params.set(k, String(v))
      }
    })
    const queryStr = params.toString() ? `?${params.toString()}` : ''

    const [ticketsRes, kpisRes, configRes] = await Promise.allSettled([
      apiClient.get(`/helpdesk/tickets${queryStr}`),
      apiClient.get('/helpdesk/kpis'),
      apiClient.get('/helpdesk/config')
    ])

    if (ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value)) {
      this._setItem(STORAGE_KEYS.TICKETS, ticketsRes.value)
    } else if (ticketsRes.status === 'rejected') {
      throw ticketsRes.reason
    }

    if (kpisRes.status === 'fulfilled' && kpisRes.value) {
      this._setItem(STORAGE_KEYS.KPIS, kpisRes.value)
    }

    if (configRes.status === 'fulfilled' && configRes.value) {
      if (Array.isArray(configRes.value.categories)) {
        this._setItem(STORAGE_KEYS.CATEGORIES, configRes.value.categories)
      }
      if (Array.isArray(configRes.value.teams)) {
        this._setItem(STORAGE_KEYS.TEAMS, configRes.value.teams)
      }
      if (configRes.value.slaTargets) {
        this._setItem(STORAGE_KEYS.SLA_TARGETS, configRes.value.slaTargets)
      }
    }

    this._notify()
    return {
      tickets: this.memoryStorage[STORAGE_KEYS.TICKETS] || [],
      kpis: this.memoryStorage[STORAGE_KEYS.KPIS] || null
    }
  }

  async fetchTicketByIdAsync(ticketId) {
    if (isTest) return this.getTicketById(ticketId)
    const ticket = await apiClient.get(`/helpdesk/tickets/${encodeURIComponent(ticketId)}`)
    this._upsertTicketInMemory(ticket)
    this._notify()
    return ticket
  }

  async _refreshKpisSafe() {
    try {
      const kpis = await apiClient.get('/helpdesk/kpis')
      if (kpis) this._setItem(STORAGE_KEYS.KPIS, kpis)
    } catch {
      // non-fatal KPI refresh
    }
  }

  async createTicketAsync(ticketData, actorUser = null) {
    if (isTest) return this.createTicket(ticketData, actorUser)
    const created = await apiClient.post('/helpdesk/tickets', ticketData)
    this._upsertTicketInMemory(created)
    await this._refreshKpisSafe()
    this._notify()
    return created
  }

  async addReplyAsync(ticketId, replyData, actorUser = null) {
    if (isTest) return this.addReply(ticketId, replyData, actorUser)
    const updated = await apiClient.post(
      `/helpdesk/tickets/${encodeURIComponent(ticketId)}/replies`,
      replyData
    )
    this._upsertTicketInMemory(updated)
    await this._refreshKpisSafe()
    this._notify()
    return updated
  }

  async assignTicketAsync(ticketId, assignmentData, actorUser = null) {
    if (isTest) return this.assignTicket(ticketId, assignmentData, actorUser)
    const updated = await apiClient.post(
      `/helpdesk/tickets/${encodeURIComponent(ticketId)}/assign`,
      assignmentData
    )
    this._upsertTicketInMemory(updated)
    await this._refreshKpisSafe()
    this._notify()
    return updated
  }

  async escalateTicketAsync(ticketId, reason, actorUser = null) {
    if (isTest) return this.escalateTicket(ticketId, reason, actorUser)
    const payload = typeof reason === 'string' ? { reason } : reason
    const updated = await apiClient.post(
      `/helpdesk/tickets/${encodeURIComponent(ticketId)}/escalate`,
      payload
    )
    this._upsertTicketInMemory(updated)
    await this._refreshKpisSafe()
    this._notify()
    return updated
  }

  async updateStatusAsync(ticketId, status, note = '') {
    if (isTest) {
      const list = [...this._getItem(STORAGE_KEYS.TICKETS, INITIAL_TICKETS)]
      const idx = list.findIndex((t) => t.ticketId === ticketId || t.id === ticketId)
      if (idx === -1) throw new Error(`Ticket '${ticketId}' not found.`)
      list[idx] = { ...list[idx], status }
      this._setItem(STORAGE_KEYS.TICKETS, list)
      this._notify()
      return list[idx]
    }
    const updated = await apiClient.patch(
      `/helpdesk/tickets/${encodeURIComponent(ticketId)}/status`,
      { status, note }
    )
    this._upsertTicketInMemory(updated)
    await this._refreshKpisSafe()
    this._notify()
    return updated
  }

  async resolveTicketAsync(ticketId, resolutionData, resolverUser = null) {
    if (isTest) return this.resolveTicket(ticketId, resolutionData, resolverUser)
    const updated = await apiClient.post(
      `/helpdesk/tickets/${encodeURIComponent(ticketId)}/resolve`,
      resolutionData
    )
    this._upsertTicketInMemory(updated)
    await this._refreshKpisSafe()
    this._notify()
    return updated
  }

  async closeTicketAsync(ticketId, feedbackData = {}, actorUser = null) {
    if (isTest) return this.closeTicket(ticketId, feedbackData, actorUser)
    const updated = await apiClient.post(
      `/helpdesk/tickets/${encodeURIComponent(ticketId)}/close`,
      feedbackData
    )
    this._upsertTicketInMemory(updated)
    await this._refreshKpisSafe()
    this._notify()
    return updated
  }

  async reopenTicketAsync(ticketId, reason, actorUser = null) {
    if (isTest) return this.reopenTicket(ticketId, reason, actorUser)
    const payload = typeof reason === 'string' ? { reason } : reason
    const updated = await apiClient.post(
      `/helpdesk/tickets/${encodeURIComponent(ticketId)}/reopen`,
      payload
    )
    this._upsertTicketInMemory(updated)
    await this._refreshKpisSafe()
    this._notify()
    return updated
  }

  // ==========================================
  // CONFIGURATIONS & MASTER METADATA
  // ==========================================

  getCategories() {
    return this._getItem(STORAGE_KEYS.CATEGORIES, TICKET_CATEGORIES)
  }

  getSupportTeams() {
    return this._getItem(STORAGE_KEYS.TEAMS, SUPPORT_TEAMS)
  }

  getSLATargets() {
    return this._getItem(STORAGE_KEYS.SLA_TARGETS, SLA_TARGETS)
  }

  calculateSLADueDates(priority, fromDate = new Date()) {
    const targets = this.getSLATargets()
    const config = targets[priority] || targets.Medium || SLA_TARGETS.Medium
    const baseTime = fromDate.getTime()

    const firstResponseDue = new Date(baseTime + config.firstResponseHours * 3600000).toISOString()
    const resolutionDue = new Date(baseTime + config.resolutionHours * 3600000).toISOString()

    return { firstResponseDue, resolutionDue }
  }

  _isTicketReopenedActive(ticket) {
    if (!ticket) return false
    if (typeof ticket.isReopenedActive === 'boolean') return ticket.isReopenedActive
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') return false
    if (!ticket.reopenedAt) return false
    if (!ticket.resolvedAt) return true
    return new Date(ticket.reopenedAt).getTime() >= new Date(ticket.resolvedAt).getTime()
  }

  _canSeeInternalNotes(ticket, user) {
    if (!user) return true // Unscoped internal call
    const role = normalizeRole(user.role)
    if (role === 'super_admin' || role === 'hr_admin') return true
    return Boolean(this.isTicketAssignedTo(ticket, user))
  }

  _canViewTicket(ticket, user) {
    if (!user) return true
    const role = normalizeRole(user.role)
    if (role === 'super_admin' || role === 'hr_admin') return true
    if (this.isTicketOwner(ticket, user) || this.isTicketAssignedTo(ticket, user)) return true
    if (role === 'manager' || role === 'team_lead') {
      const isConfidential = ticket.categoryId === 'CAT-HR' || ticket.categoryId === 'CAT-PAY'
      if (isConfidential) return false
      if (user.departmentId && ticket.employeeDepartmentId) {
        return ticket.employeeDepartmentId === user.departmentId
      }
      if (user.department) {
        return ticket.employeeDepartment === user.department
      }
      return false
    }
    return false
  }

  _sanitizeTicketForUser(ticket, user) {
    const slaInfo = this.getSLAStatus(ticket)
    const canSeeInternal = this._canSeeInternalNotes(ticket, user)
    const sanitizedConvs = (ticket.conversations || []).filter((c) => canSeeInternal || !c.isInternalNote)
    const sanitizedTimeline = (ticket.timeline || []).filter(
      (evt) =>
        canSeeInternal ||
        (!evt?.isInternalNote && !String(evt?.action || '').toLowerCase().includes('internal note'))
    )
    const isReopened = Boolean(ticket.reopenedAt || ticket.isReopened)
    const isReopenedActive = this._isTicketReopenedActive(ticket)

    return {
      ...ticket,
      isReopened,
      isReopenedActive,
      slaStatus: slaInfo.status,
      isSlaBreached: slaInfo.isBreached,
      isSlaWarning: slaInfo.isWarning,
      isResponseSlaBreached: slaInfo.isResponseBreached,
      isResolutionSlaBreached: slaInfo.isResolutionBreached,
      firstResponseSlaStatus: slaInfo.firstResponseSlaStatus,
      resolutionSlaStatus: slaInfo.resolutionSlaStatus,
      conversations: sanitizedConvs,
      timeline: sanitizedTimeline
    }
  }

  getSLAStatus(ticket) {
    if (!ticket) {
      return {
        status: 'Within SLA',
        isBreached: false,
        isWarning: false,
        isResponseBreached: false,
        isResolutionBreached: false,
        firstResponseSlaStatus: 'Pending',
        resolutionSlaStatus: 'Pending'
      }
    }

    const isReopenedActive = this._isTicketReopenedActive(ticket)
    const isResolvedOrClosed = !isReopenedActive && (ticket.status === 'Resolved' || ticket.status === 'Closed')

    const now = Date.now()
    const createdMs = new Date(ticket.createdDate).getTime()
    const respDueMs = ticket.firstResponseDue ? new Date(ticket.firstResponseDue).getTime() : null
    const respAtMs = ticket.firstResponseAt ? new Date(ticket.firstResponseAt).getTime() : null
    const resDue = ticket.resolutionDue || ticket.slaDueDate
    const resDueMs = resDue ? new Date(resDue).getTime() : null
    const completionEndMs = isResolvedOrClosed
      ? (ticket.resolvedAt
          ? new Date(ticket.resolvedAt).getTime()
          : ticket.closedAt
          ? new Date(ticket.closedAt).getTime()
          : now)
      : now

    const isResponseBreached = Boolean(
      respDueMs && (respAtMs !== null ? respAtMs > respDueMs : completionEndMs > respDueMs)
    )
    const firstResponseSlaStatus = !respDueMs
      ? (respAtMs !== null ? 'Met' : 'Pending')
      : respAtMs !== null
      ? (isResponseBreached ? 'Breached' : 'Met')
      : isResponseBreached
      ? 'Breached'
      : 'Pending'

    const isResolutionBreached = Boolean(resDueMs && completionEndMs > resDueMs)
    const resolutionSlaStatus = !resDueMs
      ? (isResolvedOrClosed ? 'Met' : 'Pending')
      : isResolvedOrClosed
      ? (isResolutionBreached ? 'Breached' : 'Met')
      : isResolutionBreached
      ? 'Breached'
      : 'Pending'

    const isBreached = isResponseBreached || isResolutionBreached

    if (isResolvedOrClosed) {
      return {
        status: isBreached ? 'Breached' : 'Satisfied',
        isBreached,
        isWarning: false,
        isResponseBreached,
        isResolutionBreached,
        firstResponseSlaStatus,
        resolutionSlaStatus
      }
    }

    if (isBreached) {
      return {
        status: 'Breached',
        isBreached: true,
        isWarning: false,
        isResponseBreached,
        isResolutionBreached,
        firstResponseSlaStatus,
        resolutionSlaStatus
      }
    }

    const elapsed = now - createdMs
    const totalResDuration = resDueMs ? resDueMs - createdMs : 0
    const totalRespDuration = respDueMs ? respDueMs - createdMs : 0
    const isResWarning = totalResDuration > 0 && elapsed > totalResDuration * 0.75
    const isRespWarning = respAtMs === null && totalRespDuration > 0 && elapsed > totalRespDuration * 0.75

    if (isResWarning || isRespWarning) {
      return {
        status: 'Warning',
        isBreached: false,
        isWarning: true,
        isResponseBreached: false,
        isResolutionBreached: false,
        firstResponseSlaStatus,
        resolutionSlaStatus
      }
    }

    return {
      status: 'Within SLA',
      isBreached: false,
      isWarning: false,
      isResponseBreached: false,
      isResolutionBreached: false,
      firstResponseSlaStatus,
      resolutionSlaStatus
    }
  }

  isTicketOwner(ticket, user) {
    if (!ticket || !user) return false
    return Boolean(
      matchesUserIdentity(ticket.employeeId, ticket.employeeCode, user) ||
      (ticket.createdByUserId && (ticket.createdByUserId === user.id || ticket.createdByUserId === user.userId))
    )
  }

  isTicketAssignedTo(ticket, user) {
    if (!ticket || !user) return false
    return Boolean(matchesUserIdentity(ticket.assignedResolverId, ticket.assignedResolverCode, user))
  }

  // ==========================================
  // TICKET RETRIEVAL & ROLE-BASED PRIVACY
  // ==========================================

  getTickets(filters = {}, requestingUser = null) {
    let list = [...this._getItem(STORAGE_KEYS.TICKETS, isTest ? INITIAL_TICKETS : [])]

    // Role privacy scoping (backend also enforces this authoritatively)
    if (requestingUser) {
      list = list.filter((t) => this._canViewTicket(t, requestingUser))
    }

    const { status, category, priority, assignedToMe, search, department } = filters

    if (status && status !== 'all') {
      list = list.filter((t) => t.status.toLowerCase() === status.toLowerCase())
    }
    if (category && category !== 'all') {
      list = list.filter((t) => t.categoryId === category || t.category === category)
    }
    if (priority && priority !== 'all') {
      list = list.filter((t) => t.priority.toLowerCase() === priority.toLowerCase())
    }
    if (assignedToMe) {
      list = list.filter((t) => matchesUserIdentity(t.assignedResolverId, t.assignedResolverCode, requestingUser))
    }
    if (department && department !== 'all') {
      list = list.filter((t) => t.employeeDepartment === department)
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) =>
        t.subject.toLowerCase().includes(q) ||
        t.ticketId.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.employeeName || '').toLowerCase().includes(q)
      )
    }

    return list.map((t) => this._sanitizeTicketForUser(t, requestingUser))
  }

  getTicketById(ticketId, requestingUser = null) {
    const list = this._getItem(STORAGE_KEYS.TICKETS, isTest ? INITIAL_TICKETS : [])
    const ticket = list.find((t) => t.ticketId === ticketId || t.id === ticketId)
    if (!ticket) return null

    const role = normalizeRole(requestingUser?.role)

    if (requestingUser && !this._canViewTicket(ticket, requestingUser)) {
      const isConfidential = ticket.categoryId === 'CAT-HR' || ticket.categoryId === 'CAT-PAY'
      if ((role === 'manager' || role === 'team_lead') && isConfidential) {
        throw new Error('Access Denied: Confidential HR/Payroll ticket.')
      }
      throw new Error('Access Denied: You do not have permission to view this ticket.')
    }

    return this._sanitizeTicketForUser(ticket, requestingUser)
  }

  // ==========================================
  // IN-MEMORY SYNC METHODS (UNIT TEST COMPATIBILITY)
  // ==========================================

  createTicket(ticketData, actorUser) {
    const {
      subject,
      description,
      categoryId,
      subcategory,
      priority = 'Medium',
      relatedModule = null,
      attachmentRef = null
    } = ticketData

    if (!subject || subject.trim().length < 5) {
      throw new Error('Ticket subject is required and must be at least 5 characters.')
    }
    if (!description || description.trim().length < 10) {
      throw new Error('Ticket description is required and must be at least 10 characters.')
    }
    if (!categoryId) {
      throw new Error('Ticket category is mandatory.')
    }

    const categories = this.getCategories()
    const categoryObj = categories.find((c) => c.categoryId === categoryId || c.categoryName === categoryId)
    if (!categoryObj) {
      throw new Error(`Invalid category '${categoryId}'.`)
    }

    const teams = this.getSupportTeams()
    const assignedTeam = teams.find((t) => t.teamId === categoryObj.defaultTeamId) || teams[0]

    const now = new Date()
    const { firstResponseDue, resolutionDue } = this.calculateSLADueDates(priority, now)

    const empId = actorUser?.employeeId || actorUser?.id || 'EMP-GUEST'
    const empName = actorUser?.name || 'Employee'
    const empDept = actorUser?.department || 'General Workforce'
    const empEmail = actorUser?.email || `${empName.toLowerCase().replace(/\s+/g, '.')}@isysware.internal`

    const list = [...this._getItem(STORAGE_KEYS.TICKETS, isTest ? INITIAL_TICKETS : [])]
    const nextSeq = list.length + 1
    const ticketId = `HD-${now.getFullYear()}-${String(nextSeq).padStart(3, '0')}`

    const newTicket = {
      id: ticketId,
      ticketId,
      subject: subject.trim(),
      category: categoryObj.categoryName,
      categoryId: categoryObj.categoryId,
      subcategory: subcategory || categoryObj.subcategories[0] || 'General Inquiry',
      priority,
      status: 'Open',
      employeeId: empId,
      employeeName: empName,
      employeeDepartment: empDept,
      employeeEmail: empEmail,
      assignedTeamId: assignedTeam.teamId,
      assignedTeamName: assignedTeam.teamName,
      assignedResolverId: null,
      assignedResolverName: null,
      createdDate: now.toISOString(),
      firstResponseDue,
      resolutionDue,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      isEscalated: priority === 'Critical',
      escalationReason: priority === 'Critical' ? 'Automatic critical priority SLA escalation' : null,
      relatedModule: relatedModule || null,
      attachmentRef: attachmentRef || null,
      description: description.trim(),
      conversations: [
        {
          id: `CONV-${Date.now().toString().slice(-6)}`,
          senderId: empId,
          senderName: empName,
          senderRole: actorUser?.role || 'Employee',
          message: description.trim(),
          createdAt: now.toISOString(),
          isInternalNote: false
        }
      ],
      timeline: [
        { action: 'Ticket Created', by: empName, at: now.toISOString() },
        { action: `Auto-routed to ${assignedTeam.teamName}`, by: 'System Router', at: now.toISOString() }
      ]
    }

    list.unshift(newTicket)
    this._setItem(STORAGE_KEYS.TICKETS, list)
    this._notify()
    return newTicket
  }

  addReply(ticketId, replyData, actorUser) {
    const { message, isInternalNote = false } = replyData

    if (!message || !message.trim()) {
      throw new Error('Reply message cannot be empty.')
    }

    const list = [...this._getItem(STORAGE_KEYS.TICKETS, isTest ? INITIAL_TICKETS : [])]
    const idx = list.findIndex((t) => t.ticketId === ticketId || t.id === ticketId)
    if (idx === -1) throw new Error(`Ticket '${ticketId}' not found.`)

    const ticket = { ...list[idx] }
    const currentEmpId = actorUser?.employeeId || actorUser?.id
    const role = normalizeRole(actorUser?.role)
    const isSupportStaff =
      role === 'super_admin' ||
      role === 'hr_admin' ||
      matchesUserIdentity(ticket.assignedResolverId, ticket.assignedResolverCode, actorUser)
    const isEmployee = !isSupportStaff
    const noteFlag = isSupportStaff ? Boolean(isInternalNote) : false

    const now = new Date().toISOString()
    const newConv = {
      id: `CONV-${Date.now().toString().slice(-6)}`,
      senderId: currentEmpId,
      senderName: actorUser?.name || 'User',
      senderRole: role === 'super_admin' ? 'Super Admin' : (role === 'hr_admin' ? 'HR Admin' : (role === 'manager' ? 'Manager' : 'Employee')),
      message: message.trim(),
      createdAt: now,
      isInternalNote: noteFlag
    }

    ticket.conversations = [...(ticket.conversations || []), newConv]

    if (!isEmployee && !ticket.firstResponseAt && !noteFlag) {
      ticket.firstResponseAt = now
      ticket.timeline.push({ action: 'First Support Response Recorded', by: actorUser?.name, at: now })
    }

    if (isEmployee && ticket.status === 'Pending Employee') {
      ticket.status = 'In Progress'
      ticket.timeline.push({ action: 'Employee Replied — Status set to In Progress', by: actorUser?.name, at: now })
    } else if (!isEmployee && !noteFlag && (ticket.status === 'Open' || ticket.status === 'Assigned')) {
      ticket.status = 'In Progress'
      ticket.timeline.push({ action: 'Support Replied — Status set to In Progress', by: actorUser?.name, at: now })
    } else if (noteFlag) {
      ticket.timeline.push({
        action: 'Internal Note Appended by Support Staff',
        by: actorUser?.name,
        at: now,
        isInternalNote: true
      })
    }

    list[idx] = ticket
    this._setItem(STORAGE_KEYS.TICKETS, list)
    this._notify()
    return ticket
  }

  assignTicket(ticketId, assignmentData, actorUser) {
    const { resolverId, resolverName, teamId } = assignmentData
    const list = [...this._getItem(STORAGE_KEYS.TICKETS, isTest ? INITIAL_TICKETS : [])]
    const idx = list.findIndex((t) => t.ticketId === ticketId || t.id === ticketId)
    if (idx === -1) throw new Error(`Ticket '${ticketId}' not found.`)

    const ticket = { ...list[idx] }
    const now = new Date().toISOString()

    if (teamId) {
      const teams = this.getSupportTeams()
      const teamObj = teams.find((t) => t.teamId === teamId)
      if (teamObj) {
        ticket.assignedTeamId = teamObj.teamId
        ticket.assignedTeamName = teamObj.teamName
      }
    }

    ticket.assignedResolverId = resolverId
    ticket.assignedResolverName = resolverName || resolverId
    if (ticket.status === 'Open') {
      ticket.status = 'Assigned'
    }

    ticket.timeline.push({
      action: `Assigned to ${ticket.assignedResolverName} (${ticket.assignedTeamName})`,
      by: actorUser?.name || 'Supervisor',
      at: now
    })

    list[idx] = ticket
    this._setItem(STORAGE_KEYS.TICKETS, list)
    this._notify()
    return ticket
  }

  escalateTicket(ticketId, reason, actorUser) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Mandatory escalation reason (min 5 characters) is required.')
    }

    const list = [...this._getItem(STORAGE_KEYS.TICKETS, isTest ? INITIAL_TICKETS : [])]
    const idx = list.findIndex((t) => t.ticketId === ticketId || t.id === ticketId)
    if (idx === -1) throw new Error(`Ticket '${ticketId}' not found.`)

    const ticket = { ...list[idx] }
    const now = new Date().toISOString()

    const previousPriority = ticket.priority
    ticket.isEscalated = true
    ticket.escalationReason = reason.trim()
    ticket.escalatedAt = now
    ticket.escalatedByName = actorUser?.name || 'Support Lead'
    if (ticket.priority !== 'Critical') {
      ticket.priority = 'High'
    }

    ticket.escalationHistory = [
      ...(Array.isArray(ticket.escalationHistory) ? ticket.escalationHistory : []),
      {
        reason: reason.trim(),
        escalatedBy: ticket.escalatedByName,
        escalatedAt: now,
        previousPriority,
        priority: ticket.priority
      }
    ]

    ticket.timeline.push({
      type: 'ESCALATION',
      reason: reason.trim(),
      previousPriority,
      newPriority: ticket.priority,
      action: `Escalated: ${reason.trim()}`,
      by: actorUser?.name || 'Support Lead',
      at: now
    })

    list[idx] = ticket
    this._setItem(STORAGE_KEYS.TICKETS, list)
    this._notify()
    return ticket
  }

  resolveTicket(ticketId, resolutionData, resolverUser) {
    const { resolutionSummary } = resolutionData
    if (!resolutionSummary || resolutionSummary.trim().length < 10) {
      throw new Error('Resolution summary is required (minimum 10 characters).')
    }

    const list = [...this._getItem(STORAGE_KEYS.TICKETS, isTest ? INITIAL_TICKETS : [])]
    const idx = list.findIndex((t) => t.ticketId === ticketId || t.id === ticketId)
    if (idx === -1) throw new Error(`Ticket '${ticketId}' not found.`)

    const ticket = { ...list[idx] }
    const now = new Date().toISOString()

    ticket.status = 'Resolved'
    ticket.resolvedAt = now
    ticket.resolutionSummary = resolutionSummary.trim()
    ticket.resolvedById = resolverUser?.employeeId || resolverUser?.id
    ticket.resolvedByName = resolverUser?.name || 'Support Resolver'

    ticket.timeline.push({
      action: `Resolved: ${resolutionSummary.trim()}`,
      by: ticket.resolvedByName,
      at: now
    })

    list[idx] = ticket
    this._setItem(STORAGE_KEYS.TICKETS, list)
    this._notify()
    return ticket
  }

  closeTicket(ticketId, feedbackData = {}, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.TICKETS, isTest ? INITIAL_TICKETS : [])]
    const idx = list.findIndex((t) => t.ticketId === ticketId || t.id === ticketId)
    if (idx === -1) throw new Error(`Ticket '${ticketId}' not found.`)

    const ticket = { ...list[idx] }
    const now = new Date().toISOString()

    ticket.status = 'Closed'
    ticket.closedAt = now
    if (feedbackData.rating) {
      ticket.satisfactionRating = Math.min(5, Math.max(1, Number(feedbackData.rating)))
    }
    if (feedbackData.feedback) {
      ticket.satisfactionFeedback = feedbackData.feedback.trim()
    }

    const ratingNote = ticket.satisfactionRating ? ` (${ticket.satisfactionRating}-Star Feedback)` : ''
    ticket.timeline.push({
      action: `Ticket Confirmed Closed${ratingNote}`,
      by: actorUser?.name || 'Employee',
      at: now
    })

    list[idx] = ticket
    this._setItem(STORAGE_KEYS.TICKETS, list)
    this._notify()
    return ticket
  }

  reopenTicket(ticketId, reopenReason, actorUser) {
    if (!reopenReason || reopenReason.trim().length < 5) {
      throw new Error('Reopen reason is mandatory (minimum 5 characters).')
    }

    const list = [...this._getItem(STORAGE_KEYS.TICKETS, isTest ? INITIAL_TICKETS : [])]
    const idx = list.findIndex((t) => t.ticketId === ticketId || t.id === ticketId)
    if (idx === -1) throw new Error(`Ticket '${ticketId}' not found.`)

    const ticket = { ...list[idx] }
    const now = new Date().toISOString()

    // Archive prior resolution / closure / CSAT feedback into historical record
    const priorSnapshot =
      ticket.resolvedAt || ticket.resolutionSummary || ticket.closedAt || ticket.satisfactionRating
        ? {
            resolvedAt: ticket.resolvedAt || null,
            resolvedById: ticket.resolvedById || null,
            resolvedByName: ticket.resolvedByName || null,
            resolutionSummary: ticket.resolutionSummary || null,
            closedAt: ticket.closedAt || null,
            closedByName: ticket.closedByName || null,
            satisfactionRating: ticket.satisfactionRating ?? null,
            satisfactionFeedback: ticket.satisfactionFeedback || null,
            reopenedAt: now,
            reopenedBy: actorUser?.name || 'Employee',
            reopenReason: reopenReason.trim()
          }
        : null

    if (priorSnapshot) {
      ticket.resolutionHistory = [...(Array.isArray(ticket.resolutionHistory) ? ticket.resolutionHistory : []), priorSnapshot]
      ticket.previousResolvedAt = priorSnapshot.resolvedAt
      ticket.previousResolvedById = priorSnapshot.resolvedById
      ticket.previousResolvedByName = priorSnapshot.resolvedByName
      ticket.previousResolutionSummary = priorSnapshot.resolutionSummary
      ticket.previousClosedAt = priorSnapshot.closedAt
      ticket.previousClosedByName = priorSnapshot.closedByName
      ticket.previousSatisfactionRating = priorSnapshot.satisfactionRating
      ticket.previousSatisfactionFeedback = priorSnapshot.satisfactionFeedback
      ticket.hasHistoricalResolution = true
    }

    // Clear current cycle resolution/closure fields so reopened tickets never render prior fix as current resolution
    ticket.status = 'In Progress'
    ticket.reopenedAt = now
    ticket.reopenReason = reopenReason.trim()
    ticket.isReopened = true
    ticket.isReopenedActive = true
    ticket.resolvedAt = null
    ticket.resolvedById = null
    ticket.resolvedByName = null
    ticket.resolutionSummary = null
    ticket.closedAt = null
    ticket.closedByName = null
    ticket.satisfactionRating = null
    ticket.satisfactionFeedback = null

    ticket.conversations = [
      ...(ticket.conversations || []),
      {
        id: `CONV-${Date.now().toString().slice(-6)}`,
        senderId: actorUser?.employeeId || actorUser?.id,
        senderName: actorUser?.name || 'Employee',
        senderRole: actorUser?.role || 'Employee',
        message: `[Ticket Reopened]: ${reopenReason.trim()}`,
        createdAt: now,
        isInternalNote: false
      }
    ]

    ticket.timeline = [
      ...(ticket.timeline || []),
      {
        action: `Ticket Reopened: ${reopenReason.trim()}`,
        by: actorUser?.name || 'Employee',
        at: now,
        reopenReason: reopenReason.trim(),
        ...(priorSnapshot ? { snapshot: priorSnapshot } : {})
      }
    ]

    list[idx] = ticket
    this._setItem(STORAGE_KEYS.TICKETS, list)
    this._notify()
    return ticket
  }

  getHelpDeskKPIs(requestingUser = null) {
    const cachedKpis = !isTest ? this._getItem(STORAGE_KEYS.KPIS, null) : null
    if (cachedKpis && typeof cachedKpis === 'object') {
      return cachedKpis
    }

    const tickets = this.getTickets({}, requestingUser)

    const totalTickets = tickets.length
    const openTickets = tickets.filter((t) => t.status === 'Open').length
    const assignedTickets = tickets.filter((t) => t.status === 'Assigned').length
    const inProgressTickets = tickets.filter((t) => t.status === 'In Progress').length
    const pendingTickets = tickets.filter((t) => t.status === 'Pending Employee' || t.status === 'Pending Department').length
    const resolvedTickets = tickets.filter((t) => t.status === 'Resolved').length
    const closedTickets = tickets.filter((t) => t.status === 'Closed').length

    let overdueTickets = 0
    let slaBreaches = 0
    let responseSlaBreaches = 0
    let resolutionSlaBreaches = 0
    let totalFirstResponseHours = 0
    let firstRespondedCount = 0
    let totalResolutionTimeHours = 0
    let resolvedWithTimesCount = 0
    let ratingSum = 0
    let ratedTicketsCount = 0
    const feedbackList = []
    const historicalFeedbackList = []

    const reopenedTickets = tickets.filter((t) => Boolean(t.isReopened || t.reopenedAt)).length
    const escalatedTickets = tickets.filter((t) => t.isEscalated || t.priority === 'Critical').length

    tickets.forEach((t) => {
      const sla = this.getSLAStatus(t)
      if (sla.isBreached) {
        slaBreaches++
        overdueTickets++
      }
      if (sla.isResponseBreached) responseSlaBreaches++
      if (sla.isResolutionBreached) resolutionSlaBreaches++

      if (t.firstResponseAt && t.createdDate) {
        const respHours = (new Date(t.firstResponseAt).getTime() - new Date(t.createdDate).getTime()) / 3600000
        if (respHours >= 0) {
          totalFirstResponseHours += respHours
          firstRespondedCount++
        }
      }
      if (t.resolvedAt && t.createdDate && !this._isTicketReopenedActive(t)) {
        const diffHours = (new Date(t.resolvedAt).getTime() - new Date(t.createdDate).getTime()) / 3600000
        if (diffHours > 0) {
          totalResolutionTimeHours += diffHours
          resolvedWithTimesCount++
        }
      }
      if (t.satisfactionRating && !this._isTicketReopenedActive(t)) {
        ratingSum += Number(t.satisfactionRating)
        ratedTicketsCount++
        feedbackList.push({
          ticketId: t.ticketId,
          subject: t.subject,
          category: t.category,
          employeeName: t.employeeName,
          resolvedByName: t.resolvedByName,
          rating: t.satisfactionRating,
          feedback: t.satisfactionFeedback || '',
          closedAt: t.closedAt,
          isHistorical: false
        })
      }
      if (Array.isArray(t.resolutionHistory)) {
        t.resolutionHistory.forEach((cycle, i) => {
          if (cycle.satisfactionRating) {
            historicalFeedbackList.push({
              ticketId: t.ticketId,
              cycleNumber: i + 1,
              subject: t.subject,
              category: t.category,
              employeeName: t.employeeName,
              resolvedByName: cycle.resolvedByName || t.previousResolvedByName || null,
              rating: cycle.satisfactionRating,
              feedback: cycle.satisfactionFeedback || '',
              closedAt: cycle.closedAt || null,
              reopenedAt: cycle.reopenedAt || t.reopenedAt || null,
              reopenReason: cycle.reopenReason || t.reopenReason || null,
              isHistorical: true
            })
          }
        })
      }
    })

    const avgFirstResponseHours = firstRespondedCount > 0 ? (totalFirstResponseHours / firstRespondedCount).toFixed(1) : '0.0'
    const avgResolutionHours = resolvedWithTimesCount > 0 ? (totalResolutionTimeHours / resolvedWithTimesCount).toFixed(1) : '0.0'
    const avgSatisfactionRating = ratedTicketsCount > 0 ? (ratingSum / ratedTicketsCount).toFixed(1) : null
    const slaComplianceRate = totalTickets > 0 ? Math.round(((totalTickets - slaBreaches) / totalTickets) * 100) : 100

    const categoryCounts = {}
    tickets.forEach((t) => {
      const cat = t.category || 'General'
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    })

    const teamWorkload = {}
    tickets.forEach((t) => {
      const team = t.assignedTeamName || 'Unassigned Queue'
      teamWorkload[team] = (teamWorkload[team] || 0) + 1
    })

    return {
      totalTickets,
      openTickets,
      assignedTickets,
      inProgressTickets,
      pendingTickets,
      resolvedTickets,
      closedTickets,
      reopenedTickets,
      escalatedTickets,
      overdueTickets,
      slaBreaches,
      responseSlaBreaches,
      resolutionSlaBreaches,
      slaComplianceRate,
      avgFirstResponseHours,
      avgResolutionHours,
      avgSatisfactionRating,
      ratedTicketsCount,
      feedbackList,
      historicalFeedbackList,
      categoryCounts,
      teamWorkload
    }
  }
}

export const helpDeskService = new HelpDeskService()
export default helpDeskService
