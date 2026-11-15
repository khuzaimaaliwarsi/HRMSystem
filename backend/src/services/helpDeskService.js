/**
 * iSysware HRMS — Help Desk Management Backend Service
 * PostgreSQL-backed orchestrator for all Help Desk submodules:
 * 1. Help Desk Overview & Company-Wide Tickets (Role-scoped + Confidential Shielding)
 * 2. Ticket Assignment, Queue Routing & Escalations
 * 3. SLA & Resolution Management (First-Response & Resolution Breach Detection)
 * 4. My Submitted Tickets, Conversations, Internal Notes & Reopening
 * 5. Ticket History, CSAT Satisfaction Feedback & Operational Analytics
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'

export const SUPPORT_TEAMS = [
  {
    teamId: 'TEAM-IT',
    teamName: 'IT Operations & Infrastructure',
    leadName: 'Asim Raza',
    leadEmployeeId: 'EMP-007',
    email: 'it-support@isysware.internal',
    coverage: '24/7 On-Call & Business Hours 09:00 - 18:00',
    description: 'Hardware provisioning, software licenses, network infrastructure, and cybersecurity access.'
  },
  {
    teamId: 'TEAM-HR',
    teamName: 'HR Operations & People Care',
    leadName: 'Ayesha Khan',
    leadEmployeeId: 'EMP-002',
    email: 'hr-helpdesk@isysware.internal',
    coverage: 'Business Hours 09:00 - 18:00',
    description: 'Workplace inquiries, employee onboarding logistics, policy guidance, and confidential grievances.'
  },
  {
    teamId: 'TEAM-PAY',
    teamName: 'Payroll & Benefits Support',
    leadName: 'Fatima Noor',
    leadEmployeeId: 'EMP-009',
    email: 'payroll-desk@isysware.internal',
    coverage: 'Business Hours 09:00 - 18:00',
    description: 'Salary calculations, FBR tax deductions, bank detail validations, and loan schedule assistance.'
  },
  {
    teamId: 'TEAM-ADM',
    teamName: 'Facilities & Workplace Administration',
    leadName: 'Kamran Siddiqui',
    leadEmployeeId: 'EMP-010',
    email: 'admin-facilities@isysware.internal',
    coverage: 'Business Hours 08:30 - 17:30',
    description: 'Office ergonomics, security RFID cards, stationery, conference rooms, and workplace maintenance.'
  }
]

export const TICKET_CATEGORIES = [
  {
    categoryId: 'CAT-IT',
    enumValue: 'IT_SUPPORT',
    categoryName: 'Information Technology (IT)',
    icon: 'fa-laptop-code',
    defaultTeamId: 'TEAM-IT',
    isConfidential: false,
    subcategories: [
      'Laptop Hardware Malfunction',
      'Software Installation & License Request',
      'Internet / VPN & Network Access',
      'System Credentials & Email Login',
      'Peripheral / Monitor Replacement'
    ]
  },
  {
    categoryId: 'CAT-HR',
    enumValue: 'HR_QUERY',
    categoryName: 'Human Resources (HR)',
    icon: 'fa-users',
    defaultTeamId: 'TEAM-HR',
    isConfidential: true,
    subcategories: [
      'HR Policy Clarification',
      'Attendance Regularization Support',
      'Leave Balance Discrepancy',
      'Workplace Health & Ergonomics',
      'Confidential Workplace Grievance'
    ]
  },
  {
    categoryId: 'CAT-PAY',
    enumValue: 'PAYROLL_ISSUE',
    categoryName: 'Payroll & Benefits',
    icon: 'fa-money-check-dollar',
    defaultTeamId: 'TEAM-PAY',
    isConfidential: true,
    subcategories: [
      'Salary Slip & Withholding Tax Clarification',
      'Bank Account / IBAN Update Assistance',
      'Loan Deductions & Schedule Inquiry',
      'Reimbursement Status Follow-up',
      'Overtime Calculation Assistance'
    ]
  },
  {
    categoryId: 'CAT-ADM',
    enumValue: 'ADMIN_REQUEST',
    categoryName: 'Facilities & Workplace Admin',
    icon: 'fa-building',
    defaultTeamId: 'TEAM-ADM',
    isConfidential: false,
    subcategories: [
      'RFID Access Badge & Security Card',
      'Desk Chair & Seating Adjustment',
      'Office Supplies & Stationery',
      'Air Conditioning & Electrical Maintenance',
      'Visitor / Parking Clearance'
    ]
  }
]

export const SLA_TARGETS = {
  Critical: {
    firstResponseHours: 0.5,
    resolutionHours: 4,
    businessHoursOnly: false,
    label: 'Critical — Immediate Outage / Blocker'
  },
  High: {
    firstResponseHours: 2,
    resolutionHours: 8,
    businessHoursOnly: true,
    label: 'High — Significant Impact'
  },
  Medium: {
    firstResponseHours: 6,
    resolutionHours: 24,
    businessHoursOnly: true,
    label: 'Medium — Moderate Operational Issue'
  },
  Low: {
    firstResponseHours: 12,
    resolutionHours: 48,
    businessHoursOnly: true,
    label: 'Low — General Inquiry / Minor Request'
  }
}

const PRIORITY_TO_ENUM = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
  urgent: 'URGENT'
}

const ENUM_TO_PRIORITY = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
  URGENT: 'Critical'
}

const STATUS_TO_ENUM = {
  open: 'OPEN',
  assigned: 'ASSIGNED',
  'in progress': 'IN_PROGRESS',
  in_progress: 'IN_PROGRESS',
  'pending employee': 'PENDING_USER',
  'pending department': 'PENDING_USER',
  pending_user: 'PENDING_USER',
  resolved: 'RESOLVED',
  closed: 'CLOSED'
}

const ENUM_TO_STATUS = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  PENDING_USER: 'Pending Employee',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed'
}

export class HelpDeskService {
  _getActorContext(user) {
    if (!user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED')
    }
    const emp = user.employee || null
    const fullName = emp
      ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim()
      : null
    const rawRole = String(user.role || 'EMPLOYEE').toUpperCase()
    return {
      userId: user.id || null,
      employeeId: user.employeeId || emp?.id || null,
      employeeCode: emp?.employeeCode || null,
      departmentId: user.departmentId || emp?.departmentId || null,
      departmentName: emp?.department?.name || user.department || null,
      role: rawRole,
      displayName: user.name || fullName || user.username || user.email || 'Authorized User',
      email: user.email || null
    }
  }

  _formatRoleLabel(role) {
    const r = String(role || '').toUpperCase()
    if (r === 'SUPER_ADMIN') return 'Super Admin'
    if (r === 'HR_ADMIN') return 'HR Admin'
    if (r === 'DEPT_MANAGER' || r === 'MANAGER') return 'Manager'
    if (r === 'TEAM_LEAD') return 'Team Lead'
    return 'Employee'
  }

  _calculateSLADueDates(priorityLabel, fromDate = new Date()) {
    const config = SLA_TARGETS[priorityLabel] || SLA_TARGETS.Medium
    const baseTime = fromDate.getTime()
    return {
      firstResponseDue: new Date(baseTime + config.firstResponseHours * 3600000),
      resolutionDue: new Date(baseTime + config.resolutionHours * 3600000)
    }
  }

  _hasClosedBeforeReopen(existing) {
    return Boolean(
      existing.reopenedAt &&
        existing.closedAt &&
        new Date(existing.reopenedAt).getTime() >= new Date(existing.closedAt).getTime()
    )
  }

  _archivePriorCycleSnapshot(existing, baseTimeline = []) {
    if (!this._hasClosedBeforeReopen(existing) || !existing.reopenedAt) {
      return [...baseTimeline]
    }
    const priorReopenIso = existing.reopenedAt.toISOString()
    const hasSnapshot = baseTimeline.some((evt) => evt?.snapshot && evt?.at === priorReopenIso)
    if (hasSnapshot) return [...baseTimeline]
    return [
      ...baseTimeline,
      {
        action: 'Historical Closure Snapshot (Prior Cycle)',
        by: existing.closedByName || existing.resolvedByName || 'Requester',
        at: priorReopenIso,
        reopenReason: existing.reopenReason || null,
        snapshot: {
          resolvedAt: existing.resolvedAt ? existing.resolvedAt.toISOString() : null,
          resolvedById: existing.resolvedById || null,
          resolvedByName: existing.resolvedByName || null,
          resolutionSummary: existing.resolutionSummary || null,
          closedAt: existing.closedAt ? existing.closedAt.toISOString() : null,
          closedByName: existing.closedByName || null,
          satisfactionRating: existing.satisfactionRating ?? null,
          satisfactionFeedback: existing.satisfactionFeedback || null
        }
      }
    ]
  }

  _isTicketReopenedActive(ticket) {
    const statusLabel = ENUM_TO_STATUS[ticket.status] || ticket.status
    const isResolvedOrClosed = statusLabel === 'Resolved' || statusLabel === 'Closed'
    if (isResolvedOrClosed || !ticket.reopenedAt) return false
    if (!ticket.resolvedAt) return true
    return new Date(ticket.reopenedAt).getTime() >= new Date(ticket.resolvedAt).getTime()
  }

  _buildEscalationHistory(ticket, rawTimeline = []) {
    const items = []
    const seen = new Set()

    for (const evt of rawTimeline) {
      const action = String(evt?.action || '')
      const isEsc = evt?.type === 'ESCALATION' || action.startsWith('Escalated:')
      if (!isEsc) continue
      const reason = evt?.reason || action.replace(/^Escalated:\s*/i, '').trim()
      const at = evt?.at || null
      const key = `${reason}|${at || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push({
        reason,
        escalatedBy: evt?.by || 'Support Lead',
        escalatedAt: at,
        previousPriority: evt?.previousPriority || null,
        priority: evt?.newPriority || evt?.priority || (ENUM_TO_PRIORITY[ticket.priority] || ticket.priority)
      })
    }

    if (ticket.isEscalated && items.length === 0) {
      items.push({
        reason: ticket.escalationReason || 'Escalated to priority SLA monitoring',
        escalatedBy: ticket.escalatedByName || 'SLA Monitor',
        escalatedAt: (ticket.escalatedAt || ticket.createdAt || new Date()).toISOString(),
        previousPriority: null,
        priority: ENUM_TO_PRIORITY[ticket.priority] || ticket.priority
      })
    } else if (ticket.isEscalated && ticket.escalationReason) {
      const hasCurrent = items.some((i) => i.reason === ticket.escalationReason)
      if (!hasCurrent) {
        items.push({
          reason: ticket.escalationReason,
          escalatedBy: ticket.escalatedByName || 'Support Lead',
          escalatedAt: (ticket.escalatedAt || ticket.updatedAt || ticket.createdAt || new Date()).toISOString(),
          previousPriority: null,
          priority: ENUM_TO_PRIORITY[ticket.priority] || ticket.priority
        })
      }
    }

    return items
  }

  _buildResolutionHistory(ticket, rawTimeline = []) {
    const cycles = []
    let activeCycle = null

    for (const evt of rawTimeline) {
      const action = String(evt?.action || '')
      if (evt?.snapshot && (evt.snapshot.resolutionSummary || evt.snapshot.resolvedAt || evt.snapshot.satisfactionRating)) {
        const snap = {
          resolvedAt: evt.snapshot.resolvedAt || null,
          resolvedById: evt.snapshot.resolvedById || null,
          resolvedByName: evt.snapshot.resolvedByName || null,
          resolutionSummary: evt.snapshot.resolutionSummary || null,
          closedAt: evt.snapshot.closedAt || null,
          closedByName: evt.snapshot.closedByName || null,
          satisfactionRating: evt.snapshot.satisfactionRating ?? null,
          satisfactionFeedback: evt.snapshot.satisfactionFeedback || null,
          reopenedAt: evt?.at || null,
          reopenedBy: evt?.by || null,
          reopenReason: evt?.reopenReason || action.replace(/^Ticket Reopened:\s*/i, '').trim() || null
        }
        const alreadyRecorded = cycles.some(
          (c) => c.resolvedAt === snap.resolvedAt && c.reopenedAt === snap.reopenedAt
        )
        if (!alreadyRecorded) {
          cycles.push(snap)
        }
        activeCycle = null
        continue
      }

      if (action.startsWith('Resolved:')) {
        activeCycle = {
          resolvedAt: evt?.at || null,
          resolvedById: null,
          resolvedByName: evt?.by || null,
          resolutionSummary: action.replace(/^Resolved:\s*/i, '').trim(),
          closedAt: null,
          closedByName: null,
          satisfactionRating: null,
          satisfactionFeedback: null,
          reopenedAt: null,
          reopenedBy: null,
          reopenReason: null
        }
      } else if (action.startsWith('Ticket Confirmed Closed') && activeCycle) {
        activeCycle.closedAt = evt?.at || null
        activeCycle.closedByName = evt?.by || null
        const match = action.match(/\((\d+)-Star Feedback\)/i)
        if (match) {
          activeCycle.satisfactionRating = Number(match[1])
        }
      } else if (action.startsWith('Ticket Reopened:')) {
        if (!activeCycle && (ticket.resolutionSummary || ticket.resolvedAt)) {
          activeCycle = {
            resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
            resolvedById: ticket.resolvedById || null,
            resolvedByName: ticket.resolvedByName || null,
            resolutionSummary: ticket.resolutionSummary || null,
            closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
            closedByName: ticket.closedByName || null,
            satisfactionRating: ticket.satisfactionRating ?? null,
            satisfactionFeedback: ticket.satisfactionFeedback || null
          }
        }
        if (activeCycle) {
          activeCycle.reopenedAt = evt?.at || null
          activeCycle.reopenedBy = evt?.by || null
          activeCycle.reopenReason = action.replace(/^Ticket Reopened:\s*/i, '').trim()
          const alreadyRecorded = cycles.some(
            (c) => c.resolvedAt === activeCycle.resolvedAt && c.reopenedAt === activeCycle.reopenedAt
          )
          if (!alreadyRecorded) {
            cycles.push(activeCycle)
          }
          activeCycle = null
        }
      }
    }

    if (ticket.reopenedAt) {
      const reopenIso = ticket.reopenedAt.toISOString()
      const reopenMs = new Date(ticket.reopenedAt).getTime()
      const hasCycleForReopen = cycles.some((c) => c.reopenedAt === reopenIso || (c.reopenedAt && Math.abs(new Date(c.reopenedAt).getTime() - reopenMs) < 5000))
      const priorScalarResolved =
        ticket.resolvedAt && new Date(ticket.resolvedAt).getTime() <= reopenMs
          ? ticket.resolvedAt.toISOString()
          : null
      const priorScalarClosed =
        ticket.closedAt && new Date(ticket.closedAt).getTime() <= reopenMs
          ? ticket.closedAt.toISOString()
          : null

      if (!hasCycleForReopen && (ticket.resolutionSummary || priorScalarResolved || priorScalarClosed)) {
        cycles.push({
          resolvedAt: priorScalarResolved || (ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null),
          resolvedById: ticket.resolvedById || null,
          resolvedByName: ticket.resolvedByName || null,
          resolutionSummary: ticket.resolutionSummary || null,
          closedAt: priorScalarClosed,
          closedByName: priorScalarClosed ? ticket.closedByName || null : null,
          satisfactionRating: priorScalarClosed ? (ticket.satisfactionRating ?? null) : null,
          satisfactionFeedback: priorScalarClosed ? (ticket.satisfactionFeedback || null) : null,
          reopenedAt: reopenIso,
          reopenedBy: null,
          reopenReason: ticket.reopenReason || null
        })
      } else if (hasCycleForReopen && cycles.length > 0) {
        const last = cycles[cycles.length - 1]
        if (priorScalarClosed && last.closedAt && Math.abs(new Date(last.closedAt).getTime() - new Date(priorScalarClosed).getTime()) < 5000) {
          if (!last.satisfactionFeedback && ticket.satisfactionFeedback) {
            last.satisfactionFeedback = ticket.satisfactionFeedback
          }
          if (last.satisfactionRating == null && ticket.satisfactionRating != null) {
            last.satisfactionRating = ticket.satisfactionRating
          }
        }
      }
    }

    return cycles
  }

  _computeSLAStatus(ticket) {
    const statusLabel = ENUM_TO_STATUS[ticket.status] || ticket.status
    const isReopenedActive = this._isTicketReopenedActive(ticket)
    const isResolvedOrClosed = !isReopenedActive && (statusLabel === 'Resolved' || statusLabel === 'Closed')

    const now = Date.now()
    const createdMs = new Date(ticket.createdAt).getTime()
    const respDueMs = ticket.firstResponseDue ? new Date(ticket.firstResponseDue).getTime() : null
    const respAtMs = ticket.firstResponseAt ? new Date(ticket.firstResponseAt).getTime() : null
    const resDueMs = ticket.slaDueDate ? new Date(ticket.slaDueDate).getTime() : null
    const completionEndMs = isResolvedOrClosed
      ? (ticket.resolvedAt
          ? new Date(ticket.resolvedAt).getTime()
          : ticket.closedAt
          ? new Date(ticket.closedAt).getTime()
          : now)
      : now

    const isResponseBreached = Boolean(
      respDueMs &&
        (respAtMs !== null ? respAtMs > respDueMs : completionEndMs > respDueMs)
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

  _isConfidentialTicket(ticket) {
    return (
      ticket.categoryCode === 'CAT-HR' ||
      ticket.categoryCode === 'CAT-PAY' ||
      ticket.category === 'HR_QUERY' ||
      ticket.category === 'PAYROLL_ISSUE'
    )
  }

  _canViewTicket(ticket, actor) {
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'HR_ADMIN') {
      return true
    }

    const isOwner =
      (actor.employeeId && ticket.employeeId === actor.employeeId) ||
      (actor.userId && ticket.createdByUserId === actor.userId)
    const isAssignedResolver = actor.employeeId && ticket.assignedToId === actor.employeeId

    if (isOwner || isAssignedResolver) {
      return true
    }

    if (actor.role === 'DEPT_MANAGER' || actor.role === 'TEAM_LEAD') {
      if (this._isConfidentialTicket(ticket)) {
        return false
      }
      if (actor.departmentId && ticket.requester?.departmentId === actor.departmentId) {
        return true
      }
      return false
    }

    return false
  }

  _canSeeInternalNotes(ticket, actor) {
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'HR_ADMIN') return true
    if (actor.employeeId && ticket.assignedToId === actor.employeeId) return true
    return false
  }

  _formatTicket(ticket, actor) {
    const slaInfo = this._computeSLAStatus(ticket)
    const canSeeInternal = this._canSeeInternalNotes(ticket, actor)
    const statusLabel = ENUM_TO_STATUS[ticket.status] || ticket.status
    const rawTimeline = Array.isArray(ticket.timeline) ? ticket.timeline : []
    const escalationHistory = this._buildEscalationHistory(ticket, rawTimeline)
    const resolutionHistory = this._buildResolutionHistory(ticket, rawTimeline)
    const isReopened = Boolean(ticket.reopenedAt)
    const isReopenedActive = this._isTicketReopenedActive(ticket)

    // Determine whether stored closure/feedback fields belong to a prior (pre-reopen) cycle
    const closedBeforeLastReopen = Boolean(
      ticket.reopenedAt &&
        ticket.closedAt &&
        new Date(ticket.reopenedAt).getTime() >= new Date(ticket.closedAt).getTime()
    )
    const showCurrentResolution = !isReopenedActive && Boolean(ticket.resolvedAt || ticket.resolutionSummary)
    const showCurrentClosure = !isReopenedActive && !closedBeforeLastReopen && Boolean(ticket.closedAt || statusLabel === 'Closed')

    const latestPriorCycle = resolutionHistory.length > 0 ? resolutionHistory[resolutionHistory.length - 1] : null
    const reqEmp = ticket.requester
    const reqFullName = reqEmp
      ? `${reqEmp.firstName || ''} ${reqEmp.lastName || ''}`.trim()
      : null
    const assignedEmp = ticket.assignedTo
    const assignedFullName = assignedEmp
      ? `${assignedEmp.firstName || ''} ${assignedEmp.lastName || ''}`.trim()
      : null

    const conversations = (ticket.comments || [])
      .filter((c) => canSeeInternal || !c.isInternalNote)
      .map((c) => ({
        id: c.id,
        senderId: c.senderEmployeeId || c.senderUserId,
        senderEmployeeCode: c.sender?.employeeCode || null,
        senderName: c.senderName,
        senderRole: c.senderRole,
        message: c.message,
        createdAt: c.createdAt.toISOString(),
        isInternalNote: c.isInternalNote
      }))

    const visibleTimeline = rawTimeline.filter(
      (evt) =>
        canSeeInternal ||
        (!evt?.isInternalNote && !String(evt?.action || '').toLowerCase().includes('internal note'))
    )

    return {
      id: ticket.id,
      ticketId: ticket.ticketNumber,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.categoryLabel || 'Information Technology (IT)',
      categoryId: ticket.categoryCode || 'CAT-IT',
      categoryEnum: ticket.category,
      subcategory: ticket.subcategory || 'General Inquiry',
      priority: ENUM_TO_PRIORITY[ticket.priority] || 'Medium',
      priorityEnum: ticket.priority,
      status: ENUM_TO_STATUS[ticket.status] || 'Open',
      statusEnum: ticket.status,
      employeeId: ticket.employeeId || ticket.createdByUserId,
      employeeCode: reqEmp?.employeeCode || null,
      createdByUserId: ticket.createdByUserId,
      employeeName: reqFullName || ticket.requesterName || 'Employee',
      employeeDepartment: reqEmp?.department?.name || ticket.requesterDepartment || 'Corporate HQ',
      employeeEmail: reqEmp?.email || ticket.requesterEmail || '',
      assignedTeamId: ticket.assignedTeamId,
      assignedTeamName: ticket.assignedTeamName,
      assignedResolverId: ticket.assignedToId || null,
      assignedResolverCode: assignedEmp?.employeeCode || null,
      assignedResolverName: ticket.assignedResolverName || assignedFullName || null,
      createdDate: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      firstResponseDue: ticket.firstResponseDue ? ticket.firstResponseDue.toISOString() : null,
      resolutionDue: ticket.slaDueDate ? ticket.slaDueDate.toISOString() : null,
      firstResponseAt: ticket.firstResponseAt ? ticket.firstResponseAt.toISOString() : null,
      resolvedAt: showCurrentResolution && ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
      resolvedById: showCurrentResolution ? ticket.resolvedById || null : null,
      resolvedByName: showCurrentResolution ? ticket.resolvedByName || null : null,
      resolutionSummary: showCurrentResolution ? ticket.resolutionSummary || null : null,
      closedAt: showCurrentClosure && ticket.closedAt ? ticket.closedAt.toISOString() : null,
      closedByName: showCurrentClosure ? ticket.closedByName || null : null,
      satisfactionRating: showCurrentClosure ? ticket.satisfactionRating ?? null : null,
      satisfactionFeedback: showCurrentClosure ? ticket.satisfactionFeedback || null : null,
      reopenedAt: ticket.reopenedAt ? ticket.reopenedAt.toISOString() : null,
      reopenReason: ticket.reopenReason || null,
      isReopened,
      isReopenedActive,
      hasHistoricalResolution: resolutionHistory.length > 0,
      previousResolvedAt: latestPriorCycle?.resolvedAt || null,
      previousResolvedById: latestPriorCycle?.resolvedById || null,
      previousResolvedByName: latestPriorCycle?.resolvedByName || null,
      previousResolutionSummary: latestPriorCycle?.resolutionSummary || null,
      previousClosedAt: latestPriorCycle?.closedAt || null,
      previousClosedByName: latestPriorCycle?.closedByName || null,
      previousSatisfactionRating: latestPriorCycle?.satisfactionRating ?? null,
      previousSatisfactionFeedback: latestPriorCycle?.satisfactionFeedback || null,
      resolutionHistory,
      isEscalated: Boolean(ticket.isEscalated),
      escalationReason: ticket.escalationReason || null,
      escalatedAt: ticket.escalatedAt ? ticket.escalatedAt.toISOString() : null,
      escalatedByName: ticket.escalatedByName || null,
      escalationHistory,
      employeeDepartmentId: ticket.requester?.departmentId || null,
      relatedModule: ticket.relatedModule || null,
      attachmentRef: ticket.attachmentRef || null,
      description: ticket.description,
      slaStatus: slaInfo.status,
      isSlaBreached: slaInfo.isBreached,
      isSlaWarning: slaInfo.isWarning,
      isResponseSlaBreached: slaInfo.isResponseBreached,
      isResolutionSlaBreached: slaInfo.isResolutionBreached,
      firstResponseSlaStatus: slaInfo.firstResponseSlaStatus,
      resolutionSlaStatus: slaInfo.resolutionSlaStatus,
      conversations,
      timeline: visibleTimeline
    }
  }

  async _resolveEmployee(idOrCode) {
    if (!idOrCode) return null
    return prisma.employee.findFirst({
      where: { OR: [{ id: idOrCode }, { employeeCode: idOrCode }] },
      include: { department: true }
    })
  }

  async _resolveTicket(idOrNumber) {
    if (!idOrNumber) return null
    return prisma.helpDeskTicket.findFirst({
      where: { OR: [{ id: idOrNumber }, { ticketNumber: idOrNumber }] },
      include: {
        requester: { include: { department: true } },
        assignedTo: { include: { department: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, employeeCode: true } } }
        }
      }
    })
  }

  async _generateTicketNumber() {
    const year = new Date().getFullYear()
    const prefix = `HD-${year}-`
    const existing = await prisma.helpDeskTicket.findMany({
      where: { ticketNumber: { startsWith: prefix } },
      select: { ticketNumber: true }
    })
    let maxSeq = 0
    for (const row of existing) {
      const numPart = Number(row.ticketNumber.replace(prefix, ''))
      if (Number.isFinite(numPart) && numPart > maxSeq) {
        maxSeq = numPart
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`
  }

  async _logAudit(actor, actionType, entityId, notes, before = null, after = null) {
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: actor.userId || null,
          actorEmployeeCode: actor.employeeCode || null,
          actorRole: actor.role || 'SYSTEM',
          sourceModule: 'HELP_DESK',
          actionType,
          entityName: 'HelpDeskTicket',
          entityId,
          recordSnapshotBefore: before,
          recordSnapshotAfter: after,
          reasonOrNotes: notes || null
        }
      })
    } catch (err) {
      console.warn('[HelpDeskService] AuditLog write warning:', err?.message || err)
    }
  }

  getConfig() {
    return {
      categories: TICKET_CATEGORIES,
      teams: SUPPORT_TEAMS,
      slaTargets: SLA_TARGETS
    }
  }

  async getTickets(filters = {}, actorUser) {
    const actor = this._getActorContext(actorUser)
    const where = {}

    if (filters.status && filters.status !== 'all') {
      const stEnum = STATUS_TO_ENUM[String(filters.status).toLowerCase()]
      if (stEnum) where.status = stEnum
    }

    if (filters.priority && filters.priority !== 'all') {
      const prEnum = PRIORITY_TO_ENUM[String(filters.priority).toLowerCase()]
      if (prEnum) {
        where.priority = prEnum === 'CRITICAL' ? { in: ['CRITICAL', 'URGENT'] } : prEnum
      }
    }

    if (filters.category && filters.category !== 'all') {
      where.OR = [
        { categoryCode: filters.category },
        { categoryLabel: filters.category }
      ]
    }

    if (filters.escalated === 'true' || filters.escalated === true) {
      where.OR = [
        ...(where.OR || []),
        { isEscalated: true },
        { priority: { in: ['CRITICAL', 'URGENT'] } }
      ]
    }

    const rows = await prisma.helpDeskTicket.findMany({
      where,
      include: {
        requester: { include: { department: true } },
        assignedTo: { include: { department: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, employeeCode: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    let list = rows
      .filter((t) => this._canViewTicket(t, actor))
      .map((t) => this._formatTicket(t, actor))

    if (filters.assignedToMe === 'true' || filters.assignedToMe === true) {
      list = list.filter((t) => t.assignedResolverId && actor.employeeId && t.assignedResolverId === actor.employeeId)
    }

    if (filters.department && filters.department !== 'all') {
      list = list.filter((t) => t.employeeDepartment === filters.department)
    }

    if (filters.slaBreached === 'true' || filters.slaBreached === true) {
      list = list.filter((t) => t.isSlaBreached)
    }

    if (filters.search && String(filters.search).trim()) {
      const q = String(filters.search).trim().toLowerCase()
      list = list.filter(
        (t) =>
          t.ticketId.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.employeeName || '').toLowerCase().includes(q)
      )
    }

    return list
  }

  async getTicketById(idOrNumber, actorUser) {
    const actor = this._getActorContext(actorUser)
    const ticket = await this._resolveTicket(idOrNumber)
    if (!ticket) {
      throw new AppError(`Ticket '${idOrNumber}' not found.`, 404, 'NOT_FOUND')
    }
    if (!this._canViewTicket(ticket, actor)) {
      throw new AppError('Access Denied: You do not have permission to view this ticket.', 403, 'FORBIDDEN')
    }
    return this._formatTicket(ticket, actor)
  }

  async getKPIs(actorUser) {
    const tickets = await this.getTickets({}, actorUser)

    const totalTickets = tickets.length
    const openTickets = tickets.filter((t) => t.status === 'Open').length
    const assignedTickets = tickets.filter((t) => t.status === 'Assigned').length
    const inProgressTickets = tickets.filter((t) => t.status === 'In Progress').length
    const pendingTickets = tickets.filter((t) => t.status === 'Pending Employee' || t.status === 'Pending Department').length
    const resolvedTickets = tickets.filter((t) => t.status === 'Resolved').length
    const closedTickets = tickets.filter((t) => t.status === 'Closed').length
    const escalatedTickets = tickets.filter((t) => t.isEscalated || t.priority === 'Critical').length

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

    const reopenedTickets = tickets.filter((t) => t.isReopened).length

    tickets.forEach((t) => {
      if (t.isSlaBreached) {
        slaBreaches++
        overdueTickets++
      }
      if (t.isResponseSlaBreached) {
        responseSlaBreaches++
      }
      if (t.isResolutionSlaBreached) {
        resolutionSlaBreaches++
      }
      if (t.firstResponseAt && t.createdDate) {
        const respDiff = (new Date(t.firstResponseAt).getTime() - new Date(t.createdDate).getTime()) / 3600000
        if (respDiff >= 0) {
          totalFirstResponseHours += respDiff
          firstRespondedCount++
        }
      }
      if (t.resolvedAt && t.createdDate && !t.isReopenedActive) {
        const diffHours = (new Date(t.resolvedAt).getTime() - new Date(t.createdDate).getTime()) / 3600000
        if (diffHours > 0) {
          totalResolutionTimeHours += diffHours
          resolvedWithTimesCount++
        }
      }
      if (t.satisfactionRating && !t.isReopenedActive) {
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
        t.resolutionHistory.forEach((cycle, idx) => {
          if (cycle.satisfactionRating) {
            historicalFeedbackList.push({
              ticketId: t.ticketId,
              cycleNumber: idx + 1,
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
    const teamWorkload = {}
    tickets.forEach((t) => {
      const cat = t.category || 'General'
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
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

  async createTicket(data, actorUser) {
    const actor = this._getActorContext(actorUser)
    const subject = data?.subject ? String(data.subject).trim() : ''
    const description = data?.description ? String(data.description).trim() : ''
    const categoryKey = data?.categoryId || data?.category

    if (subject.length < 5) {
      throw new AppError('Ticket subject is required and must be at least 5 characters.', 400, 'VALIDATION_FAILED')
    }
    if (description.length < 10) {
      throw new AppError('Ticket description is required and must be at least 10 characters.', 400, 'VALIDATION_FAILED')
    }
    if (!categoryKey) {
      throw new AppError('Ticket category is mandatory.', 400, 'VALIDATION_FAILED')
    }

    const categoryObj = TICKET_CATEGORIES.find(
      (c) =>
        c.categoryId === categoryKey ||
        c.categoryName === categoryKey ||
        c.enumValue === categoryKey
    )
    if (!categoryObj) {
      throw new AppError(`Invalid ticket category '${categoryKey}'.`, 400, 'VALIDATION_FAILED')
    }

    const rawPriority = String(data?.priority || 'Medium').trim().toLowerCase()
    const priorityEnum = PRIORITY_TO_ENUM[rawPriority]
    if (!priorityEnum) {
      throw new AppError(`Invalid priority '${data.priority}'.`, 400, 'VALIDATION_FAILED')
    }
    const priorityLabel = ENUM_TO_PRIORITY[priorityEnum]

    const assignedTeam = SUPPORT_TEAMS.find((t) => t.teamId === categoryObj.defaultTeamId) || SUPPORT_TEAMS[0]
    const now = new Date()
    const { firstResponseDue, resolutionDue } = this._calculateSLADueDates(priorityLabel, now)
    const isAutoEscalated = priorityEnum === 'CRITICAL' || priorityEnum === 'URGENT'

    // Allow requester override only if HR Admin / Super Admin creates on behalf; otherwise use actor employee
    let requesterEmp = actor.employeeId ? await this._resolveEmployee(actor.employeeId) : null
    if (data?.employeeId && (actor.role === 'SUPER_ADMIN' || actor.role === 'HR_ADMIN')) {
      const targetEmp = await this._resolveEmployee(data.employeeId)
      if (targetEmp) requesterEmp = targetEmp
    }

    const reqName = requesterEmp
      ? `${requesterEmp.firstName} ${requesterEmp.lastName}`.trim()
      : actor.displayName
    const reqDept = requesterEmp?.department?.name || actor.departmentName || 'Corporate HQ'
    const reqEmail = requesterEmp?.email || actor.email || ''

    const ticketNumber = await this._generateTicketNumber()
    const initialTimeline = [
      { action: 'Ticket Created', by: actor.displayName, at: now.toISOString() },
      { action: `Auto-routed to ${assignedTeam.teamName}`, by: 'System Router', at: now.toISOString() }
    ]
    if (isAutoEscalated) {
      initialTimeline.push({
        action: 'Auto-Escalated: Critical Priority SLA Policy',
        by: 'SLA Monitor',
        at: now.toISOString()
      })
    }

    const created = await prisma.$transaction(async (tx) => {
      const tkt = await tx.helpDeskTicket.create({
        data: {
          ticketNumber,
          employeeId: requesterEmp?.id || null,
          createdByUserId: actor.userId,
          requesterName: reqName,
          requesterDepartment: reqDept,
          requesterEmail: reqEmail,
          assignedTeamId: assignedTeam.teamId,
          assignedTeamName: assignedTeam.teamName,
          category: categoryObj.enumValue,
          categoryCode: categoryObj.categoryId,
          categoryLabel: categoryObj.categoryName,
          subcategory: data?.subcategory || categoryObj.subcategories[0] || 'General Inquiry',
          priority: priorityEnum,
          subject,
          description,
          status: 'OPEN',
          firstResponseDue,
          slaDueDate: resolutionDue,
          isEscalated: isAutoEscalated,
          escalationReason: isAutoEscalated ? 'Automatic critical priority SLA escalation' : null,
          escalatedAt: isAutoEscalated ? now : null,
          escalatedByName: isAutoEscalated ? 'SLA Monitor' : null,
          relatedModule: data?.relatedModule || null,
          attachmentRef: data?.attachmentRef ? String(data.attachmentRef).trim() : null,
          timeline: initialTimeline
        }
      })

      await tx.helpDeskComment.create({
        data: {
          ticketId: tkt.id,
          senderEmployeeId: requesterEmp?.id || actor.employeeId || null,
          senderUserId: actor.userId,
          senderName: actor.displayName,
          senderRole: this._formatRoleLabel(actor.role),
          message: description,
          isInternalNote: false,
          createdAt: now
        }
      })

      return tx.helpDeskTicket.findUnique({
        where: { id: tkt.id },
        include: {
          requester: { include: { department: true } },
          assignedTo: { include: { department: true } },
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { id: true, employeeCode: true } } }
          }
        }
      })
    })

    await this._logAudit(
      actor,
      'CREATE',
      created.id,
      `Created ticket ${created.ticketNumber}: ${created.subject}`,
      null,
      { ticketNumber: created.ticketNumber, category: created.categoryCode, priority: created.priority }
    )

    return this._formatTicket(created, actor)
  }

  async addReply(idOrNumber, data, actorUser) {
    const actor = this._getActorContext(actorUser)
    const message = data?.message ? String(data.message).trim() : ''
    if (!message) {
      throw new AppError('Reply message cannot be empty.', 400, 'VALIDATION_FAILED')
    }

    const existing = await this._resolveTicket(idOrNumber)
    if (!existing) {
      throw new AppError(`Ticket '${idOrNumber}' not found.`, 404, 'NOT_FOUND')
    }
    if (!this._canViewTicket(existing, actor)) {
      throw new AppError('Access Denied: You do not have permission to reply to this ticket.', 403, 'FORBIDDEN')
    }
    if (existing.status === 'CLOSED') {
      throw new AppError('Cannot reply to a closed ticket. Please reopen the ticket first.', 400, 'TICKET_CLOSED')
    }

    const isSupportStaff =
      actor.role === 'SUPER_ADMIN' ||
      actor.role === 'HR_ADMIN' ||
      (actor.employeeId && existing.assignedToId === actor.employeeId)
    const isInternalNote = isSupportStaff ? Boolean(data?.isInternalNote) : false

    const now = new Date()
    const nextTimeline = [...(Array.isArray(existing.timeline) ? existing.timeline : [])]
    let nextStatus = existing.status
    let nextFirstResponseAt = existing.firstResponseAt

    if (isSupportStaff && !existing.firstResponseAt && !isInternalNote) {
      nextFirstResponseAt = now
      nextTimeline.push({
        action: 'First Support Response Recorded',
        by: actor.displayName,
        at: now.toISOString()
      })
    }

    if (!isSupportStaff && existing.status === 'PENDING_USER') {
      nextStatus = 'IN_PROGRESS'
      nextTimeline.push({
        action: 'Employee Replied — Status set to In Progress',
        by: actor.displayName,
        at: now.toISOString()
      })
    } else if (isSupportStaff && !isInternalNote && (existing.status === 'OPEN' || existing.status === 'ASSIGNED')) {
      nextStatus = 'IN_PROGRESS'
      nextTimeline.push({
        action: 'Support Replied — Status set to In Progress',
        by: actor.displayName,
        at: now.toISOString()
      })
    } else if (isInternalNote) {
      nextTimeline.push({
        action: 'Internal Note Appended by Support Staff',
        by: actor.displayName,
        at: now.toISOString(),
        isInternalNote: true
      })
    } else {
      nextTimeline.push({
        action: `Reply Added by ${actor.displayName}`,
        by: actor.displayName,
        at: now.toISOString()
      })
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.helpDeskComment.create({
        data: {
          ticketId: existing.id,
          senderEmployeeId: actor.employeeId || null,
          senderUserId: actor.userId,
          senderName: actor.displayName,
          senderRole: this._formatRoleLabel(actor.role),
          message,
          isInternalNote,
          createdAt: now
        }
      })

      return tx.helpDeskTicket.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          firstResponseAt: nextFirstResponseAt,
          timeline: nextTimeline
        },
        include: {
          requester: { include: { department: true } },
          assignedTo: { include: { department: true } },
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { id: true, employeeCode: true } } }
          }
        }
      })
    })

    await this._logAudit(
      actor,
      'UPDATE',
      updated.id,
      isInternalNote ? `Internal note added on ${updated.ticketNumber}` : `Reply added on ${updated.ticketNumber}`
    )

    return this._formatTicket(updated, actor)
  }

  async assignTicket(idOrNumber, data, actorUser) {
    const actor = this._getActorContext(actorUser)
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'HR_ADMIN') {
      throw new AppError('Only Super Admin or HR Admin can assign support resolvers.', 403, 'FORBIDDEN')
    }

    const existing = await this._resolveTicket(idOrNumber)
    if (!existing) {
      throw new AppError(`Ticket '${idOrNumber}' not found.`, 404, 'NOT_FOUND')
    }
    if (existing.status === 'CLOSED') {
      throw new AppError('Cannot assign a closed ticket.', 400, 'TICKET_CLOSED')
    }

    const { resolverId, resolverName, teamId } = data || {}
    let nextTeamId = existing.assignedTeamId
    let nextTeamName = existing.assignedTeamName

    if (teamId) {
      const teamObj = SUPPORT_TEAMS.find((t) => t.teamId === teamId)
      if (!teamObj) {
        throw new AppError(`Invalid support team '${teamId}'.`, 400, 'VALIDATION_FAILED')
      }
      nextTeamId = teamObj.teamId
      nextTeamName = teamObj.teamName
    }

    let resolvedEmp = resolverId ? await this._resolveEmployee(resolverId) : null
    const finalResolverName =
      (resolverName && String(resolverName).trim()) ||
      (resolvedEmp ? `${resolvedEmp.firstName} ${resolvedEmp.lastName}`.trim() : null) ||
      actor.displayName

    const nextStatus = existing.status === 'OPEN' ? 'ASSIGNED' : existing.status
    const now = new Date()
    const nextTimeline = [
      ...(Array.isArray(existing.timeline) ? existing.timeline : []),
      {
        action: `Assigned to ${finalResolverName} (${nextTeamName})`,
        by: actor.displayName,
        at: now.toISOString()
      }
    ]

    const updated = await prisma.helpDeskTicket.update({
      where: { id: existing.id },
      data: {
        assignedToId: resolvedEmp?.id || existing.assignedToId || null,
        assignedResolverName: finalResolverName,
        assignedTeamId: nextTeamId,
        assignedTeamName: nextTeamName,
        status: nextStatus,
        timeline: nextTimeline
      },
      include: {
        requester: { include: { department: true } },
        assignedTo: { include: { department: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, employeeCode: true } } }
        }
      }
    })

    await this._logAudit(
      actor,
      'ASSIGN',
      updated.id,
      `Assigned ${updated.ticketNumber} to ${finalResolverName} (${nextTeamName})`,
      { assignedResolverName: existing.assignedResolverName, assignedTeamId: existing.assignedTeamId },
      { assignedResolverName: updated.assignedResolverName, assignedTeamId: updated.assignedTeamId, status: updated.status }
    )

    return this._formatTicket(updated, actor)
  }

  async escalateTicket(idOrNumber, data, actorUser) {
    const actor = this._getActorContext(actorUser)
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'HR_ADMIN') {
      throw new AppError('Only Super Admin or HR Admin can escalate tickets.', 403, 'FORBIDDEN')
    }

    const reason = typeof data === 'string' ? data.trim() : String(data?.reason || '').trim()
    if (reason.length < 5) {
      throw new AppError('Mandatory escalation reason (minimum 5 characters) is required.', 400, 'VALIDATION_FAILED')
    }

    const existing = await this._resolveTicket(idOrNumber)
    if (!existing) {
      throw new AppError(`Ticket '${idOrNumber}' not found.`, 404, 'NOT_FOUND')
    }
    if (existing.status === 'CLOSED') {
      throw new AppError('Cannot escalate a closed ticket.', 400, 'TICKET_CLOSED')
    }

    const nextPriority =
      existing.priority === 'CRITICAL' || existing.priority === 'URGENT'
        ? existing.priority
        : 'HIGH'
    const now = new Date()
    const nextTimeline = [
      ...(Array.isArray(existing.timeline) ? existing.timeline : []),
      {
        type: 'ESCALATION',
        reason,
        previousPriority: ENUM_TO_PRIORITY[existing.priority] || existing.priority,
        newPriority: ENUM_TO_PRIORITY[nextPriority] || nextPriority,
        action: `Escalated: ${reason}`,
        by: actor.displayName,
        at: now.toISOString()
      }
    ]

    const updated = await prisma.helpDeskTicket.update({
      where: { id: existing.id },
      data: {
        isEscalated: true,
        escalationReason: reason,
        escalatedAt: now,
        escalatedByName: actor.displayName,
        priority: nextPriority,
        timeline: nextTimeline
      },
      include: {
        requester: { include: { department: true } },
        assignedTo: { include: { department: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, employeeCode: true } } }
        }
      }
    })

    await this._logAudit(actor, 'ESCALATE', updated.id, `Escalated ${updated.ticketNumber}: ${reason}`)
    return this._formatTicket(updated, actor)
  }

  async updateStatus(idOrNumber, data, actorUser) {
    const actor = this._getActorContext(actorUser)
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'HR_ADMIN') {
      throw new AppError('Only Super Admin or HR Admin can change operational ticket status.', 403, 'FORBIDDEN')
    }

    const rawStatus = String(data?.status || '').trim().toLowerCase()
    const targetEnum = STATUS_TO_ENUM[rawStatus]
    if (!targetEnum || !['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER'].includes(targetEnum)) {
      throw new AppError(`Invalid operational status '${data?.status}'.`, 400, 'VALIDATION_FAILED')
    }

    const existing = await this._resolveTicket(idOrNumber)
    if (!existing) {
      throw new AppError(`Ticket '${idOrNumber}' not found.`, 404, 'NOT_FOUND')
    }
    if (existing.status === 'CLOSED') {
      throw new AppError('Cannot modify a closed ticket. Reopen it first.', 400, 'TICKET_CLOSED')
    }

    const now = new Date()
    const statusLabel = ENUM_TO_STATUS[targetEnum]
    const note = data?.note ? ` (${String(data.note).trim()})` : ''
    const nextTimeline = [
      ...(Array.isArray(existing.timeline) ? existing.timeline : []),
      {
        action: `Status updated to ${statusLabel}${note}`,
        by: actor.displayName,
        at: now.toISOString()
      }
    ]

    const updated = await prisma.helpDeskTicket.update({
      where: { id: existing.id },
      data: {
        status: targetEnum,
        timeline: nextTimeline
      },
      include: {
        requester: { include: { department: true } },
        assignedTo: { include: { department: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, employeeCode: true } } }
        }
      }
    })

    await this._logAudit(actor, 'UPDATE', updated.id, `Status changed on ${updated.ticketNumber} to ${statusLabel}`)
    return this._formatTicket(updated, actor)
  }

  async resolveTicket(idOrNumber, data, actorUser) {
    const actor = this._getActorContext(actorUser)
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'HR_ADMIN') {
      throw new AppError('Only authorized support staff (Super Admin or HR Admin) can resolve tickets.', 403, 'FORBIDDEN')
    }

    const resolutionSummary = data?.resolutionSummary ? String(data.resolutionSummary).trim() : ''
    if (resolutionSummary.length < 10) {
      throw new AppError('Resolution summary is required (minimum 10 characters).', 400, 'VALIDATION_FAILED')
    }

    const existing = await this._resolveTicket(idOrNumber)
    if (!existing) {
      throw new AppError(`Ticket '${idOrNumber}' not found.`, 404, 'NOT_FOUND')
    }
    if (existing.status === 'CLOSED') {
      throw new AppError('Ticket is already closed.', 400, 'TICKET_CLOSED')
    }

    const now = new Date()
    const rawTimeline = Array.isArray(existing.timeline) ? existing.timeline : []
    const hadClosedBeforeReopen = this._hasClosedBeforeReopen(existing)
    const updatedTimeline = this._archivePriorCycleSnapshot(existing, rawTimeline)

    const nextTimeline = [
      ...updatedTimeline,
      {
        action: `Resolved: ${resolutionSummary}`,
        by: actor.displayName,
        at: now.toISOString()
      }
    ]

    const updated = await prisma.helpDeskTicket.update({
      where: { id: existing.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: now,
        resolvedById: actor.employeeId || actor.userId,
        resolvedByName: actor.displayName,
        resolutionSummary,
        ...(hadClosedBeforeReopen
          ? {
              closedAt: null,
              closedByName: null,
              satisfactionRating: null,
              satisfactionFeedback: null
            }
          : {}),
        timeline: nextTimeline
      },
      include: {
        requester: { include: { department: true } },
        assignedTo: { include: { department: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, employeeCode: true } } }
        }
      }
    })

    await this._logAudit(actor, 'RESOLVE', updated.id, `Resolved ${updated.ticketNumber}: ${resolutionSummary}`)
    return this._formatTicket(updated, actor)
  }

  async closeTicket(idOrNumber, feedbackData = {}, actorUser) {
    const actor = this._getActorContext(actorUser)
    const existing = await this._resolveTicket(idOrNumber)
    if (!existing) {
      throw new AppError(`Ticket '${idOrNumber}' not found.`, 404, 'NOT_FOUND')
    }

    const isOwner =
      (actor.employeeId && existing.employeeId === actor.employeeId) ||
      (actor.userId && existing.createdByUserId === actor.userId)
    const isAdmin = actor.role === 'SUPER_ADMIN' || actor.role === 'HR_ADMIN'

    if (!isOwner && !isAdmin) {
      throw new AppError('Only the ticket requester or support administrator can confirm closure.', 403, 'FORBIDDEN')
    }
    if (existing.status === 'CLOSED') {
      throw new AppError('Ticket is already closed.', 400, 'TICKET_CLOSED')
    }
    if (existing.status !== 'RESOLVED' && !isAdmin) {
      throw new AppError('Ticket must be Resolved by support before employee closure confirmation.', 400, 'VALIDATION_FAILED')
    }

    const hadClosedBeforeReopen = this._hasClosedBeforeReopen(existing)

    let rating = hadClosedBeforeReopen ? null : existing.satisfactionRating
    if (feedbackData?.rating !== undefined && feedbackData?.rating !== null && feedbackData?.rating !== '') {
      const parsedRating = Number(feedbackData.rating)
      if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        throw new AppError('Satisfaction rating must be between 1 and 5.', 400, 'VALIDATION_FAILED')
      }
      rating = Math.round(parsedRating)
    }

    const feedback =
      feedbackData?.feedback !== undefined && feedbackData?.feedback !== null
        ? String(feedbackData.feedback).trim()
        : (hadClosedBeforeReopen ? null : existing.satisfactionFeedback)

    const now = new Date()
    const baseTimeline = this._archivePriorCycleSnapshot(
      existing,
      Array.isArray(existing.timeline) ? existing.timeline : []
    )

    const ratingNote = rating ? ` (${rating}-Star Feedback)` : ''
    const nextTimeline = [
      ...baseTimeline,
      {
        action: `Ticket Confirmed Closed${ratingNote}`,
        by: actor.displayName,
        at: now.toISOString()
      }
    ]

    const updated = await prisma.helpDeskTicket.update({
      where: { id: existing.id },
      data: {
        status: 'CLOSED',
        closedAt: now,
        closedByName: actor.displayName,
        satisfactionRating: rating,
        satisfactionFeedback: feedback || null,
        timeline: nextTimeline
      },
      include: {
        requester: { include: { department: true } },
        assignedTo: { include: { department: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, employeeCode: true } } }
        }
      }
    })

    await this._logAudit(actor, 'CLOSE', updated.id, `Closed ${updated.ticketNumber}${ratingNote}`)
    return this._formatTicket(updated, actor)
  }

  async reopenTicket(idOrNumber, data, actorUser) {
    const actor = this._getActorContext(actorUser)
    const reason = typeof data === 'string' ? data.trim() : String(data?.reason || data?.reopenReason || '').trim()
    if (reason.length < 5) {
      throw new AppError('Reopen reason is mandatory (minimum 5 characters).', 400, 'VALIDATION_FAILED')
    }

    const existing = await this._resolveTicket(idOrNumber)
    if (!existing) {
      throw new AppError(`Ticket '${idOrNumber}' not found.`, 404, 'NOT_FOUND')
    }

    const isOwner =
      (actor.employeeId && existing.employeeId === actor.employeeId) ||
      (actor.userId && existing.createdByUserId === actor.userId)
    const isAdmin = actor.role === 'SUPER_ADMIN' || actor.role === 'HR_ADMIN'

    if (!isOwner && !isAdmin) {
      throw new AppError('Only the ticket requester or support administrator can reopen this ticket.', 403, 'FORBIDDEN')
    }

    if (existing.status !== 'RESOLVED' && existing.status !== 'CLOSED') {
      throw new AppError('Only Resolved or Closed tickets can be reopened.', 400, 'VALIDATION_FAILED')
    }

    const now = new Date()
    const priorSnapshot =
      existing.resolvedAt || existing.resolutionSummary || existing.closedAt || existing.satisfactionRating
        ? {
            resolvedAt: existing.resolvedAt ? existing.resolvedAt.toISOString() : null,
            resolvedById: existing.resolvedById || null,
            resolvedByName: existing.resolvedByName || null,
            resolutionSummary: existing.resolutionSummary || null,
            closedAt: existing.closedAt ? existing.closedAt.toISOString() : null,
            closedByName: existing.closedByName || null,
            satisfactionRating: existing.satisfactionRating ?? null,
            satisfactionFeedback: existing.satisfactionFeedback || null
          }
        : null

    const nextTimeline = [
      ...(Array.isArray(existing.timeline) ? existing.timeline : []),
      {
        action: `Ticket Reopened: ${reason}`,
        by: actor.displayName,
        at: now.toISOString(),
        reopenReason: reason,
        ...(priorSnapshot ? { snapshot: priorSnapshot } : {})
      }
    ]

    const updated = await prisma.$transaction(async (tx) => {
      await tx.helpDeskComment.create({
        data: {
          ticketId: existing.id,
          senderEmployeeId: actor.employeeId || null,
          senderUserId: actor.userId,
          senderName: actor.displayName,
          senderRole: this._formatRoleLabel(actor.role),
          message: `[Ticket Reopened]: ${reason}`,
          isInternalNote: false,
          createdAt: now
        }
      })

      return tx.helpDeskTicket.update({
        where: { id: existing.id },
        data: {
          status: 'IN_PROGRESS',
          reopenedAt: now,
          reopenReason: reason,
          timeline: nextTimeline
        },
        include: {
          requester: { include: { department: true } },
          assignedTo: { include: { department: true } },
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { id: true, employeeCode: true } } }
          }
        }
      })
    })

    await this._logAudit(actor, 'REOPEN', updated.id, `Reopened ${updated.ticketNumber}: ${reason}`)
    return this._formatTicket(updated, actor)
  }
}

export const helpDeskService = new HelpDeskService()
export default helpDeskService

