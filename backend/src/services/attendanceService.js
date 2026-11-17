/**
 * iSysware HRMS — Attendance Management Service
 * Implements check-in/out, punch logging, late/early calculations,
 * deterministic employee-isolated Attendance Register, and attendance rate rules.
 *
 * Enforces SHIFT-ISOLATION-01: Each employee resolves their own shift independently.
 */

import { prisma } from '../config/database.js'
import { shiftService } from './shiftService.js'
import {
  getKarachiDate,
  getKarachiTime,
  calculateAttendanceMetrics,
  format12Hour,
  timeToMinutes
} from '../utils/time.js'

export const attendanceService = {
  /**
   * Web/Biometric Check-In
   */
  async checkIn(employeeId, punchTime = new Date(), source = 'WEB', reqMeta = {}) {
    if (!employeeId) {
      const error = new Error('Employee ID is required for check-in.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true, designation: true }
    })

    if (!employee || employee.employmentStatus !== 'ACTIVE') {
      const error = new Error('Active employee record not found.')
      error.code = 'EMPLOYEE_NOT_FOUND'
      error.status = 404
      throw error
    }

    // Authoritative server timestamp for web punches to prevent client clock manipulation
    const isWebPunch = String(source || '').toUpperCase() === 'WEB'
    const punchDateTime = (isWebPunch || !punchTime) ? new Date() : new Date(punchTime)
    const businessDateStr = getKarachiDate(punchDateTime)
    const businessDate = new Date(businessDateStr)
    const punchTimeStr = getKarachiTime(punchDateTime)

    // 1. Resolve this employee's shift strictly isolated
    const { shift } = await shiftService.resolveEmployeeShift(employeeId, businessDateStr)

    // 2. Check for existing attendance record today
    let record = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate: businessDate
        }
      },
      include: { punches: true }
    })

    if (record && record.firstCheckIn) {
      const error = new Error(`Employee ${employee.employeeCode} has already checked in for today at ${format12Hour(getKarachiTime(record.firstCheckIn))}.`)
      error.code = 'ALREADY_CHECKED_IN'
      error.status = 409
      throw error
    }

    // 3. Calculate initial late arrival metrics against resolved shift
    const metrics = calculateAttendanceMetrics({
      checkInTime: punchTimeStr,
      shift
    })

    const initialStatus = metrics.lateMinutes > 0 ? 'PRESENT' : 'PRESENT'

    // 4. Create or update record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let attRecord = record
      if (!attRecord) {
        attRecord = await tx.attendanceRecord.create({
          data: {
            employeeId,
            attendanceDate: businessDate,
            shiftId: shift.id,
            shiftNameSnapshot: shift.name,
            shiftStartTimeSnapshot: shift.startTime,
            shiftEndTimeSnapshot: shift.endTime,
            firstCheckIn: punchDateTime,
            lateMinutes: metrics.lateMinutes,
            status: initialStatus,
            workArrangement: reqMeta.workArrangement || 'OFFICE',
            remarks: reqMeta.remarks || null
          }
        })
      } else {
        attRecord = await tx.attendanceRecord.update({
          where: { id: attRecord.id },
          data: {
            shiftId: shift.id,
            shiftNameSnapshot: shift.name,
            shiftStartTimeSnapshot: shift.startTime,
            shiftEndTimeSnapshot: shift.endTime,
            firstCheckIn: punchDateTime,
            lateMinutes: metrics.lateMinutes,
            status: initialStatus,
            workArrangement: reqMeta.workArrangement || attRecord.workArrangement
          }
        })
      }

      // Record Punch event
      const punch = await tx.attendancePunch.create({
        data: {
          attendanceRecordId: attRecord.id,
          employeeId,
          punchType: 'CHECK_IN',
          punchTime: punchDateTime,
          source: source.toUpperCase(),
          ipAddress: reqMeta.ipAddress || null,
          deviceInfo: reqMeta.deviceInfo || null,
          notes: reqMeta.notes || null
        }
      })

      return { record: attRecord, punch }
    })

    return {
      message: 'Check-in recorded successfully.',
      attendanceId: result.record.id,
      employeeId,
      punchTime: punchDateTime,
      punchTimeFormatted: format12Hour(punchTimeStr),
      lateMinutes: metrics.lateMinutes,
      shift: {
        id: shift.id,
        name: shift.name,
        startTimeFormatted: shift.startTimeFormatted,
        endTimeFormatted: shift.endTimeFormatted
      }
    }
  },

  /**
   * Web/Biometric Check-Out
   */
  async checkOut(employeeId, punchTime = new Date(), source = 'WEB', reqMeta = {}) {
    if (!employeeId) {
      const error = new Error('Employee ID is required for check-out.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    // Authoritative server timestamp for web punches to prevent client clock manipulation
    const isWebPunch = String(source || '').toUpperCase() === 'WEB'
    const punchDateTime = (isWebPunch || !punchTime) ? new Date() : new Date(punchTime)
    const businessDateStr = getKarachiDate(punchDateTime)
    const businessDate = new Date(businessDateStr)
    const punchTimeStr = getKarachiTime(punchDateTime)

    // Find today's attendance record
    const record = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate: businessDate
        }
      },
      include: { shift: true }
    })

    if (!record || !record.firstCheckIn) {
      const error = new Error('No check-in record found for today. Check in first before checking out.')
      error.code = 'NO_CHECK_IN'
      error.status = 400
      throw error
    }

    // Resolve shift snapshot from record
    const shift = record.shift || (await shiftService.resolveEmployeeShift(employeeId, businessDateStr)).shift

    const checkInTimeStr = getKarachiTime(record.firstCheckIn)
    const metrics = calculateAttendanceMetrics({
      checkInTime: checkInTimeStr,
      checkOutTime: punchTimeStr,
      shift
    })

    const result = await prisma.$transaction(async (tx) => {
      const updatedRecord = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: {
          lastCheckOut: punchDateTime,
          totalWorkMinutes: metrics.totalWorkMinutes,
          totalBreakMinutes: metrics.breakDurationMinutes,
          actualWorkMinutes: metrics.actualWorkMinutes,
          earlyExitMinutes: metrics.earlyExitMinutes,
          lateMinutes: metrics.lateMinutes,
          status: metrics.actualWorkMinutes >= (shift.halfDayThresholdMinutes || 240) ? 'PRESENT' : 'HALF_DAY'
        }
      })

      const punch = await tx.attendancePunch.create({
        data: {
          attendanceRecordId: record.id,
          employeeId,
          punchType: 'CHECK_OUT',
          punchTime: punchDateTime,
          source: source.toUpperCase(),
          ipAddress: reqMeta.ipAddress || null,
          deviceInfo: reqMeta.deviceInfo || null,
          notes: reqMeta.notes || null
        }
      })

      return { record: updatedRecord, punch }
    })

    return {
      message: 'Check-out recorded successfully.',
      attendanceId: result.record.id,
      employeeId,
      firstCheckIn: result.record.firstCheckIn,
      lastCheckOut: punchDateTime,
      checkOutTimeFormatted: format12Hour(punchTimeStr),
      actualWorkMinutes: result.record.actualWorkMinutes,
      actualHours: (result.record.actualWorkMinutes / 60).toFixed(1) + 'h',
      earlyExitMinutes: result.record.earlyExitMinutes,
      lateMinutes: result.record.lateMinutes
    }
  },

  /**
   * CRITICAL INVARIANT: SHIFT-ISOLATION-01 in Attendance Register
   * Resolves each employee's shift independently on the requested date.
   * If scheduledStaff == 0, attendanceRate is 'N/A' (NOT 100%).
   * Future dates are never marked ABSENT; they are marked SCHEDULED.
   */
  async getAttendanceRegister(dateStr = getKarachiDate(), filters = {}, requesterUser = null) {
    const businessDateStr = dateStr ? dateStr.trim() : getKarachiDate()
    const targetDate = new Date(businessDateStr)
    const todayStr = getKarachiDate()
    const isFutureDate = businessDateStr > todayStr

    // Build employee query based on requester role and filters
    const empWhere = { employmentStatus: 'ACTIVE' }
    if (filters.departmentId) empWhere.departmentId = filters.departmentId

    if (requesterUser) {
      if (requesterUser.role === 'DEPT_MANAGER' && requesterUser.employee?.departmentId) {
        empWhere.departmentId = requesterUser.employee.departmentId
      } else if (requesterUser.role === 'TEAM_LEAD' && requesterUser.employee?.teamId) {
        empWhere.teamId = requesterUser.employee.teamId
      }
    }

    const employees = await prisma.employee.findMany({
      where: empWhere,
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } }
      },
      orderBy: [{ employeeCode: 'asc' }]
    })

    // Fetch existing attendance records for this date
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        attendanceDate: targetDate,
        employeeId: { in: employees.map((e) => e.id) }
      },
      include: {
        punches: { orderBy: { punchTime: 'asc' } },
        corrections: { where: { status: 'PENDING' } }
      }
    })

    const recordsByEmpId = new Map(attendanceRecords.map((r) => [r.employeeId, r]))

    // Also fetch approved WFH, Field Duty, and Leave for employees on this date
    const [wfhApproved, fieldDutyApproved, leaveApproved] = await Promise.all([
      prisma.wfhRequest.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          status: 'APPROVED',
          startDate: { lte: targetDate },
          endDate: { gte: targetDate }
        }
      }),
      prisma.fieldDutyRequest.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          status: 'APPROVED',
          dutyDate: targetDate
        }
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          status: 'APPROVED',
          startDate: { lte: targetDate },
          endDate: { gte: targetDate }
        },
        include: { leaveType: true }
      })
    ])

    const wfhEmpIds = new Set(wfhApproved.map((w) => w.employeeId))
    const fieldDutyEmpIds = new Set(fieldDutyApproved.map((f) => f.employeeId))
    const leaveByEmpId = new Map(leaveApproved.map((l) => [l.employeeId, l]))

    let presentCount = 0
    let wfhCount = 0
    let fieldDutyCount = 0
    let absentCount = 0
    let lateCount = 0
    let pendingCorrectionsCount = 0

    // Resolve each employee row deterministically
    const registerRows = await Promise.all(
      employees.map(async (emp) => {
        // Resolve employee's shift strictly isolated
        const { shift } = await shiftService.resolveEmployeeShift(emp.id, businessDateStr)

        const existingRecord = recordsByEmpId.get(emp.id)
        let rowStatus = 'ABSENT'
        let workArrangement = 'OFFICE'
        let checkInFormatted = '--:--'
        let checkOutFormatted = '--:--'
        let workedMinutes = 0
        let lateMin = 0
        let earlyExitMin = 0
        let hasPendingCorrection = false

        if (existingRecord) {
          rowStatus = existingRecord.status
          workArrangement = existingRecord.workArrangement
          workedMinutes = existingRecord.actualWorkMinutes
          lateMin = existingRecord.lateMinutes
          earlyExitMin = existingRecord.earlyExitMinutes
          if (existingRecord.firstCheckIn) {
            checkInFormatted = format12Hour(getKarachiTime(existingRecord.firstCheckIn))
          }
          if (existingRecord.lastCheckOut) {
            checkOutFormatted = format12Hour(getKarachiTime(existingRecord.lastCheckOut))
          }
          if (existingRecord.corrections?.length > 0) {
            hasPendingCorrection = true
            pendingCorrectionsCount += existingRecord.corrections.length
          }
        } else {
          // Check approved leaves / WFH / Field Duty
          if (leaveByEmpId.has(emp.id)) {
            rowStatus = 'ON_LEAVE'
          } else if (wfhEmpIds.has(emp.id)) {
            rowStatus = 'WFH'
            workArrangement = 'WFH'
          } else if (fieldDutyEmpIds.has(emp.id)) {
            rowStatus = 'FIELD_DUTY'
            workArrangement = 'FIELD_DUTY'
          } else if (isFutureDate) {
            rowStatus = 'SCHEDULED'
          } else {
            rowStatus = 'ABSENT'
          }
        }

        // Aggregate statistics
        if (rowStatus === 'PRESENT' || rowStatus === 'HALF_DAY') presentCount++
        else if (rowStatus === 'WFH') wfhCount++
        else if (rowStatus === 'FIELD_DUTY') fieldDutyCount++
        else if (rowStatus === 'ABSENT') absentCount++

        if (lateMin > 0) lateCount++

        // Map punches for Immutable Raw Punch Audit modal
        const rawPunches = existingRecord?.punches || []
        const punches = rawPunches.map((p) => ({
          id: p.id,
          type: p.punchType === 'CHECK_IN' ? 'IN' : p.punchType === 'CHECK_OUT' ? 'OUT' : (String(p.punchType).includes('IN') ? 'IN' : 'OUT'),
          punchType: p.punchType,
          timestamp: format12Hour(getKarachiTime(p.punchTime)),
          punchTimeFormatted: format12Hour(getKarachiTime(p.punchTime)),
          source: p.source || 'WEB',
          verified: true,
          notes: p.notes || null
        }))

        // Fallback: If attendance_punches has 0 rows but record has firstCheckIn / lastCheckOut
        if (punches.length === 0 && (existingRecord?.firstCheckIn || existingRecord?.lastCheckOut)) {
          if (existingRecord.firstCheckIn) {
            punches.push({
              id: `${existingRecord.id}-in`,
              type: 'IN',
              punchType: 'CHECK_IN',
              timestamp: format12Hour(getKarachiTime(existingRecord.firstCheckIn)),
              punchTimeFormatted: format12Hour(getKarachiTime(existingRecord.firstCheckIn)),
              source: 'WEB',
              verified: true,
              notes: 'Recorded Check-In'
            })
          }
          if (existingRecord.lastCheckOut) {
            punches.push({
              id: `${existingRecord.id}-out`,
              type: 'OUT',
              punchType: 'CHECK_OUT',
              timestamp: format12Hour(getKarachiTime(existingRecord.lastCheckOut)),
              punchTimeFormatted: format12Hour(getKarachiTime(existingRecord.lastCheckOut)),
              source: 'WEB',
              verified: true,
              notes: 'Recorded Check-Out'
            })
          }
        }

        let recordNotes = existingRecord?.remarks || null
        if (!recordNotes) {
          if (existingRecord?.firstCheckIn && existingRecord?.lastCheckOut) {
            recordNotes = `Shift completed (${(workedMinutes / 60).toFixed(1)}h worked)`
          } else if (existingRecord?.firstCheckIn) {
            recordNotes = 'Shift in progress (Checked In)'
          }
        }

        return {
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          department: emp.department?.name || 'Unassigned',
          designation: emp.designation?.title || 'Unassigned',
          shift: {
            id: shift?.id || 'SHF-DEFAULT',
            name: shift?.name || 'General Day (09:00 - 18:00)',
            shiftCode: shift?.shiftCode || 'SHF-GEN',
            startTimeFormatted: shift?.startTimeFormatted || '09:00 AM',
            endTimeFormatted: shift?.endTimeFormatted || '06:00 PM',
            workHours: `${(((shift?.fullDayTargetMinutes || 480)) / 60).toFixed(0)}h`
          },
          workArrangement,
          checkIn: checkInFormatted,
          checkOut: checkOutFormatted,
          workedHours: `${(workedMinutes / 60).toFixed(1)}h`,
          workedMinutes,
          lateMinutes: lateMin,
          earlyExitMinutes: earlyExitMin,
          status: rowStatus,
          hasPendingCorrection,
          attendanceRecordId: existingRecord?.id || null,
          punches,
          notes: recordNotes
        }
      })
    )

    // Calculate Scheduled Staff (exclude on leave or scheduled off)
    const scheduledStaff = employees.filter((e) => {
      return !leaveByEmpId.has(e.id)
    }).length

    // INVARIANT: When scheduledStaff === 0, rate is 'N/A' (NOT 100%)
    let attendanceRate = 'N/A'
    if (scheduledStaff > 0) {
      const activeWorkforce = presentCount + wfhCount + fieldDutyCount
      const rateNumber = Math.min(100, Math.round((activeWorkforce / scheduledStaff) * 100))
      attendanceRate = `${rateNumber}%`
    }

    return {
      date: businessDateStr,
      isFutureDate,
      summary: {
        scheduledStaff,
        present: presentCount,
        wfh: wfhCount,
        fieldDuty: fieldDutyCount,
        absent: absentCount,
        late: lateCount,
        pendingCorrections: pendingCorrectionsCount,
        attendanceRate
      },
      register: registerRows
    }
  },

  /**
   * Retrieves individual employee attendance history with punches
   */
  async getEmployeeAttendance(employeeId, startDate, endDate, requesterUser = null) {
    if (!employeeId) {
      const error = new Error('Employee ID is required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    let targetId = employeeId
    try {
      const emp = await prisma.employee.findFirst({
        where: { OR: [{ id: employeeId }, { employeeCode: employeeId }] }
      })
      if (emp) targetId = emp.id
    } catch (_) {}

    const where = {
      employeeId: targetId,
      attendanceDate: {
        gte: new Date(startDate || '2000-01-01'),
        lte: new Date(endDate || '2099-12-31')
      }
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      orderBy: { attendanceDate: 'desc' },
      include: {
        shift: true,
        punches: { orderBy: { punchTime: 'asc' } },
        corrections: true
      }
    })

    return records.map((r) => ({
      ...r,
      firstCheckInFormatted: r.firstCheckIn ? format12Hour(getKarachiTime(r.firstCheckIn)) : '--:--',
      lastCheckOutFormatted: r.lastCheckOut ? format12Hour(getKarachiTime(r.lastCheckOut)) : '--:--',
      punches: r.punches.map((p) => ({
        ...p,
        punchTimeFormatted: format12Hour(getKarachiTime(p.punchTime))
      }))
    }))
  },

  /**
   * Returns immutable punch events for an attendance record with fallback to firstCheckIn/lastCheckOut
   */
  async getRecordPunches(recordId) {
    if (!recordId) return []
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: {
        punches: { orderBy: { punchTime: 'asc' } }
      }
    })
    if (!record) return []

    const list = (record.punches || []).map((p) => ({
      id: p.id,
      type: p.punchType === 'CHECK_IN' ? 'IN' : p.punchType === 'CHECK_OUT' ? 'OUT' : (String(p.punchType).includes('IN') ? 'IN' : 'OUT'),
      punchType: p.punchType,
      timestamp: format12Hour(getKarachiTime(p.punchTime)),
      punchTimeFormatted: format12Hour(getKarachiTime(p.punchTime)),
      source: p.source || 'WEB',
      verified: true,
      notes: p.notes || null
    }))

    if (list.length === 0 && (record.firstCheckIn || record.lastCheckOut)) {
      if (record.firstCheckIn) {
        list.push({
          id: `${record.id}-in`,
          type: 'IN',
          punchType: 'CHECK_IN',
          timestamp: format12Hour(getKarachiTime(record.firstCheckIn)),
          punchTimeFormatted: format12Hour(getKarachiTime(record.firstCheckIn)),
          source: 'WEB',
          verified: true,
          notes: 'Recorded Check-In'
        })
      }
      if (record.lastCheckOut) {
        list.push({
          id: `${record.id}-out`,
          type: 'OUT',
          punchType: 'CHECK_OUT',
          timestamp: format12Hour(getKarachiTime(record.lastCheckOut)),
          punchTimeFormatted: format12Hour(getKarachiTime(record.lastCheckOut)),
          source: 'WEB',
          verified: true,
          notes: 'Recorded Check-Out'
        })
      }
    }

    return list
  }
}

export default attendanceService
