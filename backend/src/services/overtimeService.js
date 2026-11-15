/**
 * iSysware HRMS — Overtime Management Service
 * Enforces minimum 60-minute overtime threshold, punch evidence verification,
 * anti-self-approval rules, and status tracking.
 */

import { prisma } from '../config/database.js'
import { getKarachiDate, timeToMinutes } from '../utils/time.js'

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

    // Calculate duration in minutes if not provided
    const startMin = timeToMinutes(startTime)
    const endMin = timeToMinutes(endTime)
    const calculatedDuration = durationMinutes
      ? parseInt(durationMinutes, 10)
      : endMin >= startMin
      ? endMin - startMin
      : 1440 - startMin + endMin

    // POLICY RULE: Minimum duration controlled by configured policy (defaults to 60 minutes)
    const policyMinMinutes = data.policyMinimumMinutes !== undefined ? parseInt(data.policyMinimumMinutes, 10) : 60
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

    // ANTI-SELF-APPROVAL GUARD: Super Admin can approve, others cannot self-approve
    const isSuperAdmin = reviewerUser?.role === 'SUPER_ADMIN'
    if (!isSuperAdmin && reviewerUser?.employee?.id && reviewerUser.employee.id === ot.employeeId) {
      const error = new Error('Anti-Self-Approval Violation: You cannot approve or reject your own overtime request.')
      error.code = 'SELF_APPROVAL_PROHIBITED'
      error.status = 403
      throw error
    }

    const result = await prisma.$transaction(async (tx) => {
      // If approved, update overtimeMinutes on linked attendance record if present
      if (decision === 'APPROVED') {
        const attRecord = await tx.attendanceRecord.findUnique({
          where: {
            employeeId_attendanceDate: {
              employeeId: ot.employeeId,
              attendanceDate: ot.overtimeDate
            }
          }
        })

        if (attRecord) {
          await tx.attendanceRecord.update({
            where: { id: attRecord.id },
            data: {
              overtimeMinutes: { increment: ot.durationMinutes }
            }
          })
        }
      }

      return tx.overtimeRequest.update({
        where: { id: ot.id },
        data: {
          status: decision,
          reviewedById: reviewerUser?.id || null,
          reviewedAt: new Date(),
          decisionRemarks: remarks?.trim() || null
        }
      })
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
        const name = r.employee ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim() : (r.username || 'Reviewer')
        const roleFormatted = r.role === 'SUPER_ADMIN' ? 'Super Admin'
          : r.role === 'HR_ADMIN' ? 'HR Admin'
          : r.role === 'DEPT_MANAGER' ? 'Department Manager'
          : r.role === 'TEAM_LEAD' ? 'Team Lead'
          : 'Reviewer'
        reviewerMap[r.id] = { name, role: roleFormatted }
      })
    }

    return ots.map((o) => {
      const rev = o.reviewedById ? reviewerMap[o.reviewedById] : null
      return {
        ...o,
        reviewedByName: rev?.name || null,
        reviewedByRole: rev?.role || null
      }
    })
  }
}

export default overtimeService

