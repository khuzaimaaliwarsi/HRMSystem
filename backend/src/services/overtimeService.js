/**
 * iSysware HRMS — Overtime Management Service
 * Enforces minimum 60-minute overtime threshold, punch evidence verification,
 * anti-self-approval rules, and status tracking.
 */

import { prisma } from '../config/database.js'
import { getKarachiDate, getKarachiTime, timeToMinutes } from '../utils/time.js'

/** Read-only evidence evaluation. Claimed times never count as punched time. */
export function verifyOvertimePunchEvidence(ot, attendance) {
  const denied = (reason) => ({ verified: false, reason, actualCheckIn: null, actualCheckOut: null })
  if (!attendance) return denied('no attendance record found')
  if (attendance.status === 'ABSENT') return denied('attendance is absent')
  if (!attendance.firstCheckIn || !attendance.lastCheckOut || Number(attendance.actualWorkMinutes) <= 0) {
    return denied('no completed positive-work attendance session')
  }
  const punches = Array.isArray(attendance.punches) ? attendance.punches : []
  const ins = punches.filter((p) => p.punchType === 'CHECK_IN' && p.punchTime)
  const outs = punches.filter((p) => p.punchType === 'CHECK_OUT' && p.punchTime)
  if (!ins.length || !outs.length) return denied('no matching immutable CHECK_IN and CHECK_OUT audit events')
  const date = getKarachiDate(ot.overtimeDate)
  const tomorrow = getKarachiDate(new Date(new Date(`${date}T12:00:00Z`).getTime() + 86400000))
  const toAbsolute = (p) => {
    const punchDate = getKarachiDate(p.punchTime)
    const base = punchDate === date ? 0 : punchDate === tomorrow ? 1440 : NaN
    return base + timeToMinutes(getKarachiTime(p.punchTime))
  }
  const claimStart = timeToMinutes(ot.startTime)
  let claimEnd = timeToMinutes(ot.endTime)
  if (claimEnd < claimStart) claimEnd += 1440
  if (!Number.isFinite(claimStart) || !Number.isFinite(claimEnd) || claimEnd <= claimStart ||
      Number(attendance.actualWorkMinutes) < claimEnd - claimStart) {
    return denied('recorded worked minutes are insufficient for this claim')
  }
  // Require one continuous real IN/OUT session covering the entire claimed window.
  const sorted = [...punches].filter((p) => p.punchTime && ['CHECK_IN', 'CHECK_OUT'].includes(p.punchType))
    .sort((a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime())
  let activeIn = null
  let covering = null
  for (const event of sorted) {
    if (event.punchType === 'CHECK_IN') {
      activeIn = event
    } else if (activeIn) {
      const actualStart = toAbsolute(activeIn)
      const actualEnd = toAbsolute(event)
      if (Number.isFinite(actualStart) && Number.isFinite(actualEnd) &&
          actualStart <= claimStart && actualEnd >= claimEnd && actualEnd >= actualStart) {
        covering = { in: activeIn, out: event }
        break
      }
      activeIn = null
    }
  }
  if (!covering) return denied('no continuous verified punch session covers the requested overtime interval')
  return {
    verified: true,
    reason: null,
    actualCheckIn: getKarachiTime(covering.in.punchTime),
    actualCheckOut: getKarachiTime(covering.out.punchTime)
  }
}

export const overtimeService = {
  /**
   * Applies for overtime.
   * Enforces policy: Minimum 60 minutes duration.
   */
  async requestOvertime(employeeId, data) {
    const {
      overtimeDate,
      startTime,
      endTime,
      durationMinutes,
      reason,
      taskDeliverableRef
    } = data

    if (!employeeId || !overtimeDate || !startTime || !endTime || !reason) {
      const error = new Error('Employee ID, overtime date, start time, end time, and reason are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const emp = await prisma.employee.findFirst({
      where: { OR: [{ id: employeeId }, { employeeCode: employeeId }] }
    })
    if (!emp) {
      const error = new Error(`Employee '${employeeId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }
    const resolvedEmployeeId = emp.id

    // Requested duration must match start/end times. Client cannot override the policy.
    const startMin = timeToMinutes(startTime)
    const endMin = timeToMinutes(endTime)
    const calculatedDuration = endMin > startMin ? endMin - startMin : 1440 - startMin + endMin
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || startMin === endMin ||
        !Number.isInteger(calculatedDuration) || calculatedDuration <= 0 || calculatedDuration > 1440 ||
        (durationMinutes !== undefined && durationMinutes !== null && Number(durationMinutes) !== calculatedDuration)) {
      const error = new Error('Invalid overtime interval or duration mismatch; submitted minutes must match the claimed time window.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }
    // Minimum policy must come from trusted server configuration, never request body.
    const policyMinMinutes = 60
    if (calculatedDuration < policyMinMinutes) {
      const error = new Error(`Overtime policy violation: Minimum overtime duration is ${policyMinMinutes} minutes as per company policy. Requested: ${calculatedDuration} minutes.`)
      error.code = 'MINIMUM_DURATION_VIOLATION'
      error.status = 400
      throw error
    }

    const targetDate = new Date(overtimeDate)
    const dateStr = getKarachiDate(targetDate)
    const datePrefix = dateStr.replace(/-/g, '').slice(2)
    const countTotal = await prisma.overtimeRequest.count()
    const requestCode = `OT-${datePrefix}-${String(countTotal + 1).padStart(3, '0')}`

    const ot = await prisma.overtimeRequest.create({
      data: {
        requestCode,
        employeeId: resolvedEmployeeId,
        overtimeDate: targetDate,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        durationMinutes: calculatedDuration,
        reason: reason.trim(),
        taskDeliverableRef: taskDeliverableRef?.trim() || null,
        status: 'PENDING'
      },
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      }
    })

    return ot
  },

  /**
   * Reviews overtime request.
   * Enforces Anti-Self-Approval.
   */
  async reviewOvertime(overtimeId, decision, reviewerUser, remarks = '') {
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      const error = new Error("Decision must be either 'APPROVED' or 'REJECTED'.")
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const ot = await prisma.overtimeRequest.findFirst({
      where: {
        OR: [
          { id: overtimeId },
          { requestCode: overtimeId }
        ]
      },
      include: { employee: true }
    })

    if (!ot) {
      const error = new Error(`Overtime request '${overtimeId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (ot.status !== 'PENDING') {
      const error = new Error(`Cannot review request already marked as ${ot.status}.`)
      error.code = 'ALREADY_PROCESSED'
      error.status = 400
      throw error
    }

    // Fail-closed backend RBAC: frontend role labels are never authority.
    const allowedRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD']
    if (!reviewerUser?.id || !allowedRoles.includes(reviewerUser.role)) {
      const error = new Error('Authenticated overtime reviewer role is not authorized.')
      error.code = 'UNAUTHORIZED_ROLE'
      error.status = 403
      throw error
    }
    const actorEmployeeId = reviewerUser.employee?.id || reviewerUser.employeeId || null
    if (actorEmployeeId && actorEmployeeId === ot.employeeId) {
      const error = new Error('Anti-Self-Approval Violation: You cannot review your own overtime request.')
      error.code = 'SELF_APPROVAL_PROHIBITED'
      error.status = 403
      throw error
    }
    if (reviewerUser.role === 'DEPT_MANAGER') {
      const mgrDeptId = reviewerUser.employee?.departmentId
      if (!mgrDeptId || !ot.employee?.departmentId || mgrDeptId !== ot.employee.departmentId) {
        const error = new Error('Cross-department or unscoped overtime review is forbidden.')
        error.code = 'UNAUTHORIZED_SCOPE'
        error.status = 403
        throw error
      }
    } else if (reviewerUser.role === 'TEAM_LEAD') {
      const leadTeamId = reviewerUser.employee?.teamId
      if (!leadTeamId || !ot.employee?.teamId || leadTeamId !== ot.employee.teamId) {
        const error = new Error('Unassigned or cross-team overtime review is forbidden.')
        error.code = 'UNAUTHORIZED_SCOPE'
        error.status = 403
        throw error
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let verifiedAttendanceId = null
      if (decision === 'APPROVED') {
        const empIds = [ot.employeeId, ot.employee?.id, ot.employee?.employeeCode].filter(Boolean)
        const attRecord = await tx.attendanceRecord.findFirst({
          where: {
            employeeId: { in: empIds },
            attendanceDate: ot.overtimeDate
          },
          include: { punches: true }
        })
        const evidence = verifyOvertimePunchEvidence(ot, attRecord)
        if (!evidence.verified) {
          const error = new Error(`Overtime approval blocked: ${evidence.reason}. Genuine Check-In/Check-Out punch evidence is required. Claimed time is not actual punch evidence.`)
          error.code = 'ATTENDANCE_VERIFICATION_FAILED'
          error.status = 400
          throw error
        }
        verifiedAttendanceId = attRecord.id
      }

      // Atomic status transition avoids double approval/double overtime-minute increments.
      const updated = await tx.overtimeRequest.updateMany({
        where: { id: ot.id, status: 'PENDING' },
        data: {
          status: decision,
          reviewedById: reviewerUser.id,
          reviewedAt: new Date(),
          decisionRemarks: remarks?.trim() || null
        }
      })
      if (updated.count !== 1) {
        const error = new Error('Overtime claim was already reviewed. Reload the queue.')
        error.code = 'ALREADY_PROCESSED'
        error.status = 409
        throw error
      }
      if (verifiedAttendanceId) {
        await tx.attendanceRecord.update({
          where: { id: verifiedAttendanceId },
          data: { overtimeMinutes: { increment: ot.durationMinutes } }
        })
      }
      return tx.overtimeRequest.findUnique({ where: { id: ot.id } })
    })

    return result
  },

  /**
   * Retrieves overtime requests with filters and scoping.
   */
  async getOvertimeRequests(filters = {}, requesterUser = null) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.employeeId) where.employeeId = filters.employeeId

    if (requesterUser) {
      if (requesterUser.role === 'EMPLOYEE') {
        where.employeeId = requesterUser.employee?.id
      } else if (requesterUser.role === 'TEAM_LEAD' && requesterUser.employee?.teamId) {
        where.employee = { teamId: requesterUser.employee.teamId }
      } else if (requesterUser.role === 'DEPT_MANAGER' && requesterUser.employee?.departmentId) {
        where.employee = { departmentId: requesterUser.employee.departmentId }
      }
    }

    const ots = await prisma.overtimeRequest.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      }
    })

    const reviewerIds = [...new Set(ots.map((o) => o.reviewedById).filter(Boolean))]
    const reviewerMap = {}
    if (reviewerIds.length > 0) {
      const reviewers = await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        include: {
          employee: {
            select: { firstName: true, lastName: true, employeeCode: true }
          }
        }
      })
      reviewers.forEach((r) => {
        let name = r.employee ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim() : (r.username || 'Reviewer')
        if (!r.employee && (r.role === 'SUPER_ADMIN' || r.username === 'admin')) {
          name = 'Super Admin'
        }
        const roleFormatted = r.role === 'SUPER_ADMIN' ? 'Super Admin'
          : r.role === 'HR_ADMIN' ? 'HR Admin'
          : r.role === 'DEPT_MANAGER' ? 'Department Manager'
          : r.role === 'TEAM_LEAD' ? 'Team Lead'
          : 'Reviewer'
        reviewerMap[r.id] = { name, role: roleFormatted }
      })
    }

    // Read-only evidence projection; never generate punches from submitted start/end times.
    const evidenceList = await Promise.all(ots.map(async (o) => {
      const record = await prisma.attendanceRecord.findUnique({
        where: { employeeId_attendanceDate: { employeeId: o.employeeId, attendanceDate: o.overtimeDate } },
        include: { punches: true }
      })
      return verifyOvertimePunchEvidence(o, record)
    }))
    return ots.map((o, i) => {
      const rev = o.reviewedById ? reviewerMap[o.reviewedById] : null
      return {
        ...o,
        reviewedByName: rev?.name || null,
        reviewedByRole: rev?.role || null,
        attendanceVerified: evidenceList[i].verified,
        actualCheckIn: evidenceList[i].verified ? evidenceList[i].actualCheckIn : null,
        actualCheckOut: evidenceList[i].verified ? evidenceList[i].actualCheckOut : null
      }
    })
  }
}

export default overtimeService

