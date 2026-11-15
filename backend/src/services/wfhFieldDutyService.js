/**
 * iSysware HRMS — Work From Home (WFH) & Field Duty Service
 * Handles WFH date deduplication and Field Duty multi-authority single-approval finality.
 * Enforces anti-self-approval and syncs status with Attendance records.
 */

import { prisma } from '../config/database.js'
import { getKarachiDate, timeToMinutes } from '../utils/time.js'

export const wfhFieldDutyService = {
  // ============================================================================
  // WORK FROM HOME (WFH)
  // ============================================================================

  /**
   * Applies for WFH. Enforces duplicate/overlapping date prevention.
   */
  async requestWfh(employeeId, data) {
    const { startDate, endDate, durationDays, reason, deliverables, contactInfo } = data

    if (!employeeId || !startDate || !endDate || !reason) {
      const error = new Error('Employee ID, start date, end date, and reason are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const emp = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeId },
          { employeeCode: employeeId },
          { userAccount: { id: employeeId } },
          { userAccount: { username: employeeId } },
          { email: employeeId }
        ]
      }
    })
    if (!emp) {
      const error = new Error(`Employee '${employeeId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }
    const resolvedEmployeeId = emp.id

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end < start) {
      const error = new Error('End date cannot precede start date.')
      error.code = 'INVALID_DATE_RANGE'
      error.status = 400
      throw error
    }

    // Check for overlapping pending or approved requests
    const overlapping = await prisma.wfhRequest.findFirst({
      where: {
        employeeId: resolvedEmployeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start }
      }
    })

    if (overlapping) {
      const error = new Error(`An overlapping WFH request (${overlapping.requestCode}) already exists for this period.`)
      error.code = 'OVERLAPPING_REQUEST'
      error.status = 409
      throw error
    }

    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    const totalDays = durationDays ? parseFloat(durationDays) : diffDays

    const dateStr = getKarachiDate(start)
    const datePrefix = dateStr.replace(/-/g, '').slice(2)
    const countTotal = await prisma.wfhRequest.count()
    const requestCode = `WFH-${datePrefix}-${String(countTotal + 1).padStart(3, '0')}`

    const wfh = await prisma.wfhRequest.create({
      data: {
        requestCode,
        employeeId: resolvedEmployeeId,
        startDate: start,
        endDate: end,
        durationDays: totalDays,
        reason: reason.trim(),
        deliverables: (deliverables || data.deliverablesPlanned)?.trim() || null,
        contactInfo: contactInfo?.trim() || null,
        status: 'PENDING'
      },
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

    return wfh
  },

  /**
   * Reviews WFH request. Enforces anti-self-approval.
   */
  async reviewWfh(wfhId, decision, reviewerUser, remarks = '') {
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      const error = new Error("Decision must be either 'APPROVED' or 'REJECTED'.")
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const wfh = await prisma.wfhRequest.findFirst({
      where: { OR: [{ id: wfhId }, { requestCode: wfhId }] },
      include: { employee: true }
    })

    if (!wfh) {
      const error = new Error(`WFH request '${wfhId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (wfh.status !== 'PENDING') {
      const error = new Error(`Cannot review request already marked as ${wfh.status}.`)
      error.code = 'ALREADY_PROCESSED'
      error.status = 400
      throw error
    }

    // ANTI-SELF-APPROVAL GUARD (bypassed for SUPER_ADMIN authority)
    const isSuperAdmin = reviewerUser?.role === 'SUPER_ADMIN'
    if (!isSuperAdmin && reviewerUser?.employee?.id && reviewerUser.employee.id === wfh.employeeId) {
      const error = new Error('Anti-Self-Approval Violation: You cannot approve or reject your own WFH request.')
      error.code = 'SELF_APPROVAL_PROHIBITED'
      error.status = 403
      throw error
    }

    const result = await prisma.$transaction(async (tx) => {
      // If approved, create or update attendance records for each day in range
      if (decision === 'APPROVED') {
        const curDate = new Date(wfh.startDate)
        const lastDate = new Date(wfh.endDate)

        while (curDate <= lastDate) {
          const businessDate = new Date(curDate)
          const existing = await tx.attendanceRecord.findUnique({
            where: {
              employeeId_attendanceDate: {
                employeeId: wfh.employeeId,
                attendanceDate: businessDate
              }
            }
          })

          if (existing) {
            await tx.attendanceRecord.update({
              where: { id: existing.id },
              data: {
                status: 'WFH',
                workArrangement: 'WFH',
                remarks: `WFH Approved (${wfh.requestCode})`
              }
            })
          }

          curDate.setDate(curDate.getDate() + 1)
        }
      }

      return tx.wfhRequest.update({
        where: { id: wfhId },
        data: {
          status: decision,
          reviewedById: reviewerUser?.id || null,
          reviewedByRole: reviewerUser?.role || null,
          reviewedAt: new Date(),
          decisionRemarks: remarks?.trim() || null
        }
      })
    })

    return result
  },

  /**
   * Retrieves WFH requests with filters and scoping.
   */
  async getWfhRequests(filters = {}, requesterUser = null) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.employeeId) where.employeeId = filters.employeeId

    if (requesterUser) {
      const empId = requesterUser.employee?.id || requesterUser.employeeId
      if (requesterUser.role === 'EMPLOYEE' && empId) {
        where.employeeId = empId
      } else if (requesterUser.role === 'TEAM_LEAD' && (requesterUser.employee?.teamId || requesterUser.teamId)) {
        where.employee = { teamId: requesterUser.employee?.teamId || requesterUser.teamId }
      } else if (requesterUser.role === 'DEPT_MANAGER' && (requesterUser.employee?.departmentId || requesterUser.departmentId)) {
        where.employee = { departmentId: requesterUser.employee?.departmentId || requesterUser.departmentId }
      }
    }

    return prisma.wfhRequest.findMany({
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
  },

  // ============================================================================
  // FIELD DUTY
  // ============================================================================

  /**
   * Submits a Field Duty request.
   */
  async requestFieldDuty(employeeId, data) {
    const {
      dutyDate,
      startTime,
      endTime,
      durationHours,
      clientName,
      siteLocation,
      purpose,
      transportRequired = false
    } = data

    if (!employeeId || !dutyDate || !startTime || !endTime || !clientName || !siteLocation || !purpose) {
      const error = new Error('Employee ID, date, start/end times, client name, site location, and purpose are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const emp = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeId },
          { employeeCode: employeeId },
          { userAccount: { id: employeeId } },
          { userAccount: { username: employeeId } },
          { email: employeeId }
        ]
      }
    })
    if (!emp) {
      const error = new Error(`Employee '${employeeId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }
    const resolvedEmployeeId = emp.id

    const startMin = timeToMinutes(startTime)
    const endMin = timeToMinutes(endTime)
    const diffMinutes = endMin >= startMin ? endMin - startMin : 1440 - startMin + endMin
    const calculatedHours = durationHours ? parseFloat(durationHours) : parseFloat((diffMinutes / 60).toFixed(1))

    const targetDate = new Date(dutyDate)
    const dateStr = getKarachiDate(targetDate)
    const datePrefix = dateStr.replace(/-/g, '').slice(2)
    const countTotal = await prisma.fieldDutyRequest.count()
    const requestCode = `FLD-${datePrefix}-${String(countTotal + 1).padStart(3, '0')}`

    const fieldDuty = await prisma.fieldDutyRequest.create({
      data: {
        requestCode,
        employeeId: resolvedEmployeeId,
        dutyDate: targetDate,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        durationHours: calculatedHours,
        clientName: clientName.trim(),
        siteLocation: siteLocation.trim(),
        purpose: purpose.trim(),
        transportRequired: Boolean(transportRequired),
        status: 'PENDING'
      },
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

    return fieldDuty
  },

  /**
   * Reviews Field Duty request.
   * CRITICAL INVARIANT: No Duration Limit Policy
   * First valid approval by an authorized role (TL, DM, HR_ADMIN, SUPER_ADMIN)
   * immediately becomes FINAL APPROVED.
   * Enforces Anti-Self-Approval.
   */
  async reviewFieldDuty(fieldDutyId, decision, reviewerUser, remarks = '') {
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      const error = new Error("Decision must be either 'APPROVED' or 'REJECTED'.")
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const fieldDuty = await prisma.fieldDutyRequest.findFirst({
      where: { OR: [{ id: fieldDutyId }, { requestCode: fieldDutyId }] },
      include: { employee: true }
    })

    if (!fieldDuty) {
      const error = new Error(`Field Duty request '${fieldDutyId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (fieldDuty.status !== 'PENDING') {
      const error = new Error(`Cannot review request already marked as ${fieldDuty.status}.`)
      error.code = 'ALREADY_PROCESSED'
      error.status = 400
      throw error
    }

    // ANTI-SELF-APPROVAL GUARD (bypassed for SUPER_ADMIN authority)
    const isSuperAdmin = reviewerUser?.role === 'SUPER_ADMIN'
    if (!isSuperAdmin && reviewerUser?.employee?.id && reviewerUser.employee.id === fieldDuty.employeeId) {
      const error = new Error('Anti-Self-Approval Violation: You cannot approve or reject your own field duty request.')
      error.code = 'SELF_APPROVAL_PROHIBITED'
      error.status = 403
      throw error
    }

    const result = await prisma.$transaction(async (tx) => {
      // If approved, sync attendance record to FIELD_DUTY
      if (decision === 'APPROVED') {
        const existing = await tx.attendanceRecord.findUnique({
          where: {
            employeeId_attendanceDate: {
              employeeId: fieldDuty.employeeId,
              attendanceDate: fieldDuty.dutyDate
            }
          }
        })

        if (existing) {
          await tx.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              status: 'FIELD_DUTY',
              workArrangement: 'FIELD_DUTY',
              remarks: `Field Duty Approved at ${fieldDuty.clientName} (${fieldDuty.requestCode})`
            }
          })
        }
      }

      // Single-approver finality: directly updates status to APPROVED or REJECTED
      return tx.fieldDutyRequest.update({
        where: { id: fieldDutyId },
        data: {
          status: decision,
          approvedById: reviewerUser?.id || null,
          approvedByRole: reviewerUser?.role || null,
          approvedAt: new Date(),
          decisionRemarks: remarks?.trim() || null
        }
      })
    })

    return result
  },

  /**
   * Retrieves Field Duty requests with filters and scoping.
   */
  async getFieldDutyRequests(filters = {}, requesterUser = null) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.employeeId) where.employeeId = filters.employeeId

    if (requesterUser) {
      const empId = requesterUser.employee?.id || requesterUser.employeeId
      if (requesterUser.role === 'EMPLOYEE' && empId) {
        where.employeeId = empId
      } else if (requesterUser.role === 'TEAM_LEAD' && (requesterUser.employee?.teamId || requesterUser.teamId)) {
        where.employee = { teamId: requesterUser.employee?.teamId || requesterUser.teamId }
      } else if (requesterUser.role === 'DEPT_MANAGER' && (requesterUser.employee?.departmentId || requesterUser.departmentId)) {
        where.employee = { departmentId: requesterUser.employee?.departmentId || requesterUser.departmentId }
      }
    }

    return prisma.fieldDutyRequest.findMany({
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
  }
}

export default wfhFieldDutyService

