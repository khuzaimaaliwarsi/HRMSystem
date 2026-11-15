/**
 * iSysware HRMS — Attendance Regularization & Missed Punch Service
 * Handles correction requests for missed check-in/out, hours adjustments,
 * enforces strict anti-self-approval guards and updates attendance snapshots upon approval.
 */

import { prisma } from '../config/database.js'
import {
  getKarachiDate,
  getKarachiTime,
  calculateAttendanceMetrics,
  format12Hour
} from '../utils/time.js'

function parseTimeToDateTime(dateStr, timeVal) {
  if (!timeVal) return null
  if (timeVal instanceof Date) return isNaN(timeVal.getTime()) ? null : timeVal
  const str = String(timeVal).trim()
  if (!str) return null
  if (str.includes('T') && str.includes('-')) {
    const d = new Date(str)
    return isNaN(d.getTime()) ? null : d
  }
  const parts = str.split(':')
  const hours = parts[0]?.padStart(2, '0') || '00'
  const minutes = parts[1]?.padStart(2, '0') || '00'
  const seconds = parts[2]?.padStart(2, '0') || '00'
  const combined = `${dateStr}T${hours}:${minutes}:${seconds}.000Z`
  const d = new Date(combined)
  return isNaN(d.getTime()) ? null : d
}

export const regularizationService = {
  /**
   * Submits an attendance correction / regularization request.
   */
  async requestCorrection(employeeId, data) {
    const {
      attendanceDate,
      adjustmentType,
      correctionType,
      requestedCheckIn,
      requestedCheckOut,
      reason,
      supportingTicketRef
    } = data

    const rawType = correctionType || adjustmentType || 'MISSING_CHECK_OUT'
    const typeMap = {
      'Missing Check-In': 'MISSING_CHECK_IN',
      'Missing Check-Out': 'MISSING_CHECK_OUT',
      'Incorrect Hours': 'INCORRECT_HOURS',
      'Status Adjustment': 'STATUS_ADJUSTMENT',
      'Other': 'OTHER'
    }
    const resolvedType = typeMap[rawType] || rawType.toUpperCase()

    if (!employeeId || !attendanceDate || !reason) {
      const error = new Error('Employee ID, attendance date, and reason are required.')
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

    const targetDate = new Date(attendanceDate)
    const dateStr = getKarachiDate(targetDate)

    // Find linked attendance record if it exists
    const record = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: resolvedEmployeeId,
          attendanceDate: targetDate
        }
      }
    })

    // Generate readable request code
    const datePrefix = dateStr.replace(/-/g, '').slice(2)
    const countToday = await prisma.attendanceCorrectionRequest.count()
    const requestCode = `CORR-${datePrefix}-${String(countToday + 1).padStart(3, '0')}`

    const checkInDateTime = parseTimeToDateTime(dateStr, requestedCheckIn)
    const checkOutDateTime = parseTimeToDateTime(dateStr, requestedCheckOut)

    const correction = await prisma.attendanceCorrectionRequest.create({
      data: {
        requestCode,
        employeeId: resolvedEmployeeId,
        attendanceDate: targetDate,
        attendanceRecordId: record?.id || null,
        adjustmentType: resolvedType,
        requestedCheckIn: checkInDateTime,
        requestedCheckOut: checkOutDateTime,
        reason: reason.trim(),
        supportingTicketRef: supportingTicketRef?.trim() || null,
        status: 'PENDING'
      },
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      }
    })

    return correction
  },

  /**
   * Reviews and approves or rejects an attendance correction request.
   * Enforces Anti-Self-Approval.
   */
  async reviewCorrection(correctionId, decision, reviewerUser, remarks = '') {
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      const error = new Error("Decision must be either 'APPROVED' or 'REJECTED'.")
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const correction = await prisma.attendanceCorrectionRequest.findFirst({
      where: { OR: [{ id: correctionId }, { requestCode: correctionId }] },
      include: {
        employee: true,
        attendanceRecord: { include: { shift: true } }
      }
    })

    if (!correction) {
      const error = new Error(`Correction request '${correctionId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (correction.status !== 'PENDING') {
      const error = new Error(`Cannot review request already marked as ${correction.status}.`)
      error.code = 'ALREADY_PROCESSED'
      error.status = 400
      throw error
    }

    // CRITICAL SECURITY GUARD: Anti-Self-Approval (bypassed for SUPER_ADMIN authority)
    const isSuperAdmin = reviewerUser?.role === 'SUPER_ADMIN'
    if (!isSuperAdmin && reviewerUser?.employee?.id && reviewerUser.employee.id === correction.employeeId) {
      const error = new Error('Anti-Self-Approval Violation: You cannot approve or reject your own attendance correction.')
      error.code = 'SELF_APPROVAL_PROHIBITED'
      error.status = 403
      throw error
    }

    const result = await prisma.$transaction(async (tx) => {
      // If approved, update attendance record
      if (decision === 'APPROVED') {
        let attRecord = correction.attendanceRecord

        // If no attendance record exists, resolve shift and create one
        if (!attRecord) {
          const shift = await tx.shift.findFirst({
            where: { isDefault: true, isActive: true }
          })
          attRecord = await tx.attendanceRecord.create({
            data: {
              employeeId: correction.employeeId,
              attendanceDate: correction.attendanceDate,
              shiftId: shift.id,
              shiftNameSnapshot: shift.name,
              shiftStartTimeSnapshot: shift.startTime,
              shiftEndTimeSnapshot: shift.endTime,
              status: 'PRESENT'
            },
            include: { shift: true }
          })
        }

        const newCheckIn = correction.requestedCheckIn || attRecord.firstCheckIn
        const newCheckOut = correction.requestedCheckOut || attRecord.lastCheckOut

        let calculatedMetrics = {
          totalWorkMinutes: attRecord.totalWorkMinutes,
          actualWorkMinutes: attRecord.actualWorkMinutes,
          lateMinutes: attRecord.lateMinutes,
          earlyExitMinutes: attRecord.earlyExitMinutes
        }

        if (newCheckIn && attRecord.shift) {
          calculatedMetrics = calculateAttendanceMetrics({
            checkInTime: getKarachiTime(newCheckIn),
            checkOutTime: newCheckOut ? getKarachiTime(newCheckOut) : null,
            shift: attRecord.shift
          })
        }

        await tx.attendanceRecord.update({
          where: { id: attRecord.id },
          data: {
            firstCheckIn: newCheckIn,
            lastCheckOut: newCheckOut,
            totalWorkMinutes: calculatedMetrics.totalWorkMinutes,
            actualWorkMinutes: calculatedMetrics.actualWorkMinutes,
            lateMinutes: calculatedMetrics.lateMinutes,
            earlyExitMinutes: calculatedMetrics.earlyExitMinutes,
            isRegularized: true,
            status: calculatedMetrics.actualWorkMinutes >= (attRecord.shift?.halfDayThresholdMinutes || 240) ? 'PRESENT' : 'HALF_DAY',
            remarks: `Regularized via ${correction.requestCode}: ${remarks || 'Approved by manager'}`
          }
        })
      }

      // Update correction status
      const updatedCorrection = await tx.attendanceCorrectionRequest.update({
        where: { id: correctionId },
        data: {
          status: decision,
          reviewedById: reviewerUser?.id || null,
          reviewedAt: new Date(),
          decisionRemarks: remarks?.trim() || null
        }
      })

      return updatedCorrection
    })

    return result
  },

  /**
   * Retrieves correction requests with filters and organizational scoping.
   */
  async getCorrections(filters = {}, requesterUser = null) {
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

    const corrections = await prisma.attendanceCorrectionRequest.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        },
        attendanceRecord: true
      }
    })

    return corrections
  }
}

export default regularizationService

