/**
 * iSysware HRMS — Shift Management & Effective-Dated Assignment Service
 * Enforces SHIFT-ISOLATION-01: Each employee's shift resolves independently
 * by employeeId and effective date, with deterministic corporate default fallback.
 */

import { prisma } from '../config/database.js'
import { format12Hour, getKarachiDate } from '../utils/time.js'

function enrichShift(shift) {
  if (!shift) return null
  return {
    ...shift,
    startTimeFormatted: format12Hour(shift.startTime),
    endTimeFormatted: format12Hour(shift.endTime),
    breakStartTimeFormatted: shift.breakStartTime ? format12Hour(shift.breakStartTime) : null,
    breakEndTimeFormatted: shift.breakEndTime ? format12Hour(shift.breakEndTime) : null
  }
}

export const shiftService = {
  /**
   * Retrieves all shifts with 12-hour display strings.
   */
  async getShifts(filters = {}) {
    const where = {}
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true' || filters.isActive === true
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { shiftCode: 'asc' }],
      include: {
        _count: {
          select: { assignments: true }
        }
      }
    })

    return shifts.map(enrichShift)
  },

  async getShiftAssignments(filters = {}) {
    const where = {}

    if (filters.employeeId) {
      where.employeeId = filters.employeeId
    }

    if (filters.shiftId) {
      where.shiftId = filters.shiftId
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      orderBy: [
        { effectiveFrom: 'desc' },
        { id: 'desc' }
      ],
      include: {
        shift: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    const userIds = Array.from(new Set(assignments.map(a => a.assignedById).filter(Boolean)))
    let userMap = new Map()
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          role: true,
          employee: {
            select: { firstName: true, lastName: true }
          }
        }
      })
      userMap = new Map(users.map(u => {
        const empName = [u.employee?.firstName, u.employee?.lastName].filter(Boolean).join(' ')
        const readable = empName || (u.role === 'SUPER_ADMIN' ? 'Super Admin' : u.role === 'HR_ADMIN' ? 'HR Admin' : u.username || 'Admin')
        return [u.id, readable]
      }))
    }

    return assignments.map(a => {
      const assignedByName = a.assignedById ? (userMap.get(a.assignedById) || 'HR Admin') : 'System Administrator'
      return {
        ...a,
        employeeCode: a.employee?.employeeCode,
        employeeName: [
          a.employee?.firstName,
          a.employee?.lastName
        ].filter(Boolean).join(' ') || a.employee?.employeeCode || 'Employee',
        shiftName: a.shift?.name,
        shift: enrichShift(a.shift),
        assignedBy: assignedByName,
        assignedByName
      }
    })
  },

  /**
   * Retrieves a single shift by ID.
   */
  async getShiftById(id) {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        _count: { select: { assignments: true } }
      }
    })

    if (!shift) {
      const error = new Error(`Shift with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    return enrichShift(shift)
  },

  /**
   * Creates a new Shift Master record.
   */
  async createShift(data) {
    const {
      shiftCode,
      name,
      type = 'FIXED',
      startTime,
      endTime,
      graceMinutesIn = 15,
      graceMinutesOut = 15,
      halfDayThresholdMinutes = 240,
      fullDayTargetMinutes = 480,
      breakDurationMinutes = 60,
      breakStartTime,
      breakEndTime,
      isBreakPaid = false,
      isDefault = false,
      workDaysJson,
      isNightShift = false,
      isActive = true
    } = data

    if (!shiftCode || !name || !startTime || !endTime) {
      const error = new Error('Shift code, name, start time, and end time are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const existing = await prisma.shift.findUnique({
      where: { shiftCode: shiftCode.trim().toUpperCase() }
    })
    if (existing) {
      const error = new Error(`Shift with code '${shiftCode}' already exists.`)
      error.code = 'DUPLICATE_CODE'
      error.status = 409
      throw error
    }

    // If isDefault is true, unset previous default shift
    if (isDefault) {
      await prisma.shift.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    const created = await prisma.shift.create({
      data: {
        shiftCode: shiftCode.trim().toUpperCase(),
        name: name.trim(),
        type,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        graceMinutesIn: parseInt(graceMinutesIn, 10),
        graceMinutesOut: parseInt(graceMinutesOut, 10),
        halfDayThresholdMinutes: parseInt(halfDayThresholdMinutes, 10),
        fullDayTargetMinutes: parseInt(fullDayTargetMinutes, 10),
        breakDurationMinutes: parseInt(breakDurationMinutes, 10),
        breakStartTime: breakStartTime?.trim() || null,
        breakEndTime: breakEndTime?.trim() || null,
        isBreakPaid: Boolean(isBreakPaid),
        isDefault: Boolean(isDefault),
        workDaysJson: workDaysJson || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
        isNightShift: Boolean(isNightShift),
        isActive: Boolean(isActive)
      }
    })

    return enrichShift(created)
  },

  /**
   * Updates an existing shift master.
   */
  async updateShift(id, data) {
    const shift = await prisma.shift.findFirst({
      where: { OR: [{ id }, { shiftCode: id }] }
    })
    if (!shift) {
      const error = new Error(`Shift '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.shift.updateMany({
          where: { id: { not: shift.id }, isDefault: true },
          data: { isDefault: false }
        })
      }

      const updated = await tx.shift.update({
        where: { id: shift.id },
        data: {
          shiftCode: (data.shiftCode || data.code) ? (data.shiftCode || data.code).trim().toUpperCase() : undefined,
          name: data.name ? data.name.trim() : undefined,
          type: data.type ? data.type.toUpperCase() : undefined,
          startTime: data.startTime || undefined,
          endTime: data.endTime || undefined,
          breakDurationMinutes: data.breakDurationMinutes !== undefined ? Number(data.breakDurationMinutes) : (data.breakMinutes !== undefined ? Number(data.breakMinutes) : undefined),
          graceMinutesIn: data.graceMinutesIn !== undefined ? Number(data.graceMinutesIn) : (data.gracePeriodMinutes !== undefined ? Number(data.gracePeriodMinutes) : undefined),
          graceMinutesOut: data.graceMinutesOut !== undefined ? Number(data.graceMinutesOut) : (data.gracePeriodMinutes !== undefined ? Number(data.gracePeriodMinutes) : undefined),
          isDefault: data.isDefault !== undefined ? Boolean(data.isDefault) : undefined,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : (data.status ? data.status === 'Active' : undefined)
        }
      })

      return enrichShift(updated)
    })
  },

  /**
   * Deletes a Shift Master record if it has no active assignments and is not default.
   */
  async deleteShift(id) {
    const shift = await prisma.shift.findFirst({
      where: { OR: [{ id }, { shiftCode: id }] },
      include: {
        _count: { select: { assignments: true, attendanceRecords: true } }
      }
    })

    if (!shift) {
      const error = new Error(`Shift '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (shift.isDefault) {
      const error = new Error(`Cannot delete default corporate shift '${shift.name}'. Designate another default shift first.`)
      error.code = 'DEFAULT_SHIFT_RESTRICTION'
      error.status = 400
      throw error
    }

    if (shift._count.assignments > 0) {
      const error = new Error(`Cannot delete shift '${shift.name}': ${shift._count.assignments} employee assignment(s) are associated with this shift. Reassign or remove employee shift assignments first.`)
      error.code = 'ACTIVE_ASSIGNMENTS_EXIST'
      error.status = 400
      throw error
    }

    if (shift._count.attendanceRecords > 0) {
      const error = new Error(`Cannot delete shift '${shift.name}': ${shift._count.attendanceRecords} historical attendance record(s) reference this shift. Deactivate the shift instead.`)
      error.code = 'HISTORICAL_ATTENDANCE_EXISTS'
      error.status = 400
      throw error
    }

    await prisma.shift.delete({
      where: { id: shift.id }
    })

    return { success: true, message: `Shift '${shift.name}' deleted successfully.` }
  },

  /**
   * Assigns a shift to a specific employee with effective date range.
   * Resolves conflicts by setting previous active overlapping assignments to SUPERSEDED.
   */
  async assignShift(assignmentData, actorUserId = null) {
    const { employeeId, shiftId, effectiveFrom, effectiveUntil, notes } = assignmentData

    if (!employeeId || !shiftId || !effectiveFrom) {
      const error = new Error('employeeId, shiftId, and effectiveFrom date are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const [emp, shift] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employeeId } }),
      prisma.shift.findUnique({ where: { id: shiftId } })
    ])

    if (!emp) {
      const error = new Error(`Employee with ID '${employeeId}' not found`)
      error.code = 'INVALID_EMPLOYEE'
      error.status = 400
      throw error
    }
    if (!shift) {
      const error = new Error(`Shift with ID '${shiftId}' not found`)
      error.code = 'INVALID_SHIFT'
      error.status = 400
      throw error
    }

    const fromDate = new Date(effectiveFrom)
    const untilDate = effectiveUntil ? new Date(effectiveUntil) : null

    // Supersede any overlapping active assignment for THIS employee
    await prisma.shiftAssignment.updateMany({
      where: {
        employeeId,
        status: 'ACTIVE',
        effectiveFrom: { lte: untilDate || new Date('2099-12-31') },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: fromDate } }
        ]
      },
      data: {
        status: 'SUPERSEDED'
      }
    })

    const newAssignment = await prisma.shiftAssignment.create({
      data: {
        employeeId,
        shiftId,
        effectiveFrom: fromDate,
        effectiveUntil: untilDate,
        status: 'ACTIVE',
        assignedById: actorUserId,
        notes: notes?.trim() || null
      },
      include: {
        shift: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })

    return {
      ...newAssignment,
      shift: enrichShift(newAssignment.shift)
    }
  },

  /**
   * Updates an existing shift assignment's effective dates, shift, or notes.
   * Validates date range order and prevents overlapping active assignments for the same employee.
   * Preserves assignment history and audit changes.
   */
  async updateShiftAssignment(id, updateData, actorUserId = null) {
    const { effectiveFrom, effectiveUntil, effectiveTo, shiftId, notes, status } = updateData

    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: {
        shift: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })

    if (!assignment) {
      const error = new Error(`Shift assignment with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const fromDate = effectiveFrom !== undefined ? new Date(effectiveFrom) : new Date(assignment.effectiveFrom)
    const rawUntil = effectiveUntil !== undefined ? effectiveUntil : effectiveTo
    const untilDate = rawUntil !== undefined ? (rawUntil ? new Date(rawUntil) : null) : assignment.effectiveUntil

    if (untilDate && untilDate < fromDate) {
      const error = new Error('Effective Until date cannot precede Effective From date.')
      error.code = 'INVALID_DATE_RANGE'
      error.status = 400
      throw error
    }

    // Overlap prevention with other ACTIVE assignments for this employee
    const targetStatus = status || assignment.status
    if (targetStatus === 'ACTIVE') {
      const otherActive = await prisma.shiftAssignment.findMany({
        where: {
          employeeId: assignment.employeeId,
          id: { not: id },
          status: 'ACTIVE'
        }
      })

      const overlap = otherActive.find((other) => {
        const otherStart = new Date(other.effectiveFrom)
        const otherEnd = other.effectiveUntil ? new Date(other.effectiveUntil) : new Date('2099-12-31')
        const currentEnd = untilDate || new Date('2099-12-31')

        return !(currentEnd < otherStart || fromDate > otherEnd)
      })

      if (overlap) {
        const otherUntilStr = overlap.effectiveUntil ? new Date(overlap.effectiveUntil).toISOString().slice(0, 10) : 'Indefinite'
        const error = new Error(`Cannot save: This employee already has an active assignment from ${new Date(overlap.effectiveFrom).toISOString().slice(0, 10)} to ${otherUntilStr} that overlaps with the selected date range.`)
        error.code = 'OVERLAPPING_ASSIGNMENT'
        error.status = 409
        throw error
      }
    }

    if (shiftId) {
      const targetShift = await prisma.shift.findUnique({ where: { id: shiftId } })
      if (!targetShift) {
        const error = new Error(`Shift with ID '${shiftId}' not found`)
        error.code = 'INVALID_SHIFT'
        error.status = 400
        throw error
      }
    }

    // Preserve audit notes
    let updatedNotes = assignment.notes
    if (notes !== undefined) {
      const cleanNotes = notes?.trim() || ''
      const auditStamp = `[Updated ${new Date().toISOString().slice(0, 10)}${actorUserId ? ` by user ${actorUserId}` : ''}]`
      updatedNotes = cleanNotes ? `${cleanNotes} ${auditStamp}` : (assignment.notes ? `${assignment.notes} ${auditStamp}` : auditStamp)
    }

    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        effectiveFrom: fromDate,
        effectiveUntil: untilDate,
        ...(shiftId ? { shiftId } : {}),
        ...(status ? { status } : {}),
        notes: updatedNotes
      },
      include: {
        shift: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })

    return {
      ...updated,
      employeeCode: updated.employee?.employeeCode,
      employeeName: `${updated.employee?.firstName || ''} ${updated.employee?.lastName || ''}`.trim(),
      shiftName: updated.shift?.name
    }
  },

  /**
   * Previews team shift assignment without saving.
   * Resolves team active employees and detects overlapping assignments.
   */
  async previewTeamShiftAssignment(data) {
    const { teamId, shiftId, effectiveFrom, effectiveUntil, effectiveTo } = data

    if (!teamId || !shiftId || !effectiveFrom) {
      const error = new Error('teamId, shiftId, and effectiveFrom date are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const fromDate = new Date(effectiveFrom)
    const rawUntil = effectiveUntil !== undefined ? effectiveUntil : effectiveTo
    const untilDate = rawUntil ? new Date(rawUntil) : null

    if (untilDate && untilDate < fromDate) {
      const error = new Error('Effective Until date cannot precede Effective From date.')
      error.code = 'INVALID_DATE_RANGE'
      error.status = 400
      throw error
    }

    // Resolve team by CUID or code
    const team = await prisma.team.findFirst({
      where: { OR: [{ id: teamId }, { code: teamId }] },
      include: { department: true }
    })
    if (!team) {
      const error = new Error(`Team '${teamId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Resolve shift by CUID or code
    const shift = await prisma.shift.findFirst({
      where: { OR: [{ id: shiftId }, { shiftCode: shiftId }] }
    })
    if (!shift) {
      const error = new Error(`Shift '${shiftId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Query active employees in this team
    const employees = await prisma.employee.findMany({
      where: { teamId: team.id, employmentStatus: 'ACTIVE' },
      select: { id: true, employeeCode: true, firstName: true, lastName: true }
    })

    const employeeIds = employees.map(e => e.id)

    // Detect overlapping active assignments for team members
    const overlappingAssignments = employeeIds.length > 0 ? await prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'ACTIVE',
        effectiveFrom: { lte: untilDate || new Date('2099-12-31') },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: fromDate } }
        ]
      },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        shift: { select: { id: true, name: true, shiftCode: true } }
      }
    }) : []

    return {
      teamId: team.id,
      teamCode: team.code,
      teamName: team.name,
      departmentName: team.department?.name || '',
      shiftId: shift.id,
      shiftCode: shift.shiftCode,
      shiftName: shift.name,
      totalEmployees: employees.length,
      employees: employees.map(e => ({
        id: e.id,
        employeeCode: e.employeeCode,
        name: `${e.firstName || ''} ${e.lastName || ''}`.trim()
      })),
      overlappingCount: overlappingAssignments.length,
      overlappingAssignments: overlappingAssignments.map(o => ({
        assignmentId: o.id,
        employeeId: o.employeeId,
        employeeCode: o.employee?.employeeCode,
        employeeName: `${o.employee?.firstName || ''} ${o.employee?.lastName || ''}`.trim(),
        currentShiftName: o.shift?.name,
        currentShiftCode: o.shift?.shiftCode,
        effectiveFrom: o.effectiveFrom ? new Date(o.effectiveFrom).toISOString().slice(0, 10) : '',
        effectiveUntil: o.effectiveUntil ? new Date(o.effectiveUntil).toISOString().slice(0, 10) : 'Indefinite'
      }))
    }
  },

  /**
   * Transactionally assigns a shift to all active employees of a functional team.
   * Detects overlaps, optionally supersedes previous assignments, and preserves historical records.
   */
  async assignShiftToTeam(data, actorUserId = null) {
    const { teamId, shiftId, effectiveFrom, effectiveUntil, effectiveTo, overrideOverlapping = true, notes } = data

    if (!teamId || !shiftId || !effectiveFrom) {
      const error = new Error('teamId, shiftId, and effectiveFrom date are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const fromDate = new Date(effectiveFrom)
    const rawUntil = effectiveUntil !== undefined ? effectiveUntil : effectiveTo
    const untilDate = rawUntil ? new Date(rawUntil) : null

    if (untilDate && untilDate < fromDate) {
      const error = new Error('Effective Until date cannot precede Effective From date.')
      error.code = 'INVALID_DATE_RANGE'
      error.status = 400
      throw error
    }

    // Resolve team
    const team = await prisma.team.findFirst({
      where: { OR: [{ id: teamId }, { code: teamId }] },
      include: { department: true }
    })
    if (!team) {
      const error = new Error(`Team '${teamId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Resolve shift
    const shift = await prisma.shift.findFirst({
      where: { OR: [{ id: shiftId }, { shiftCode: shiftId }] }
    })
    if (!shift) {
      const error = new Error(`Shift '${shiftId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Get active employees in team
    const employees = await prisma.employee.findMany({
      where: { teamId: team.id, employmentStatus: 'ACTIVE' },
      select: { id: true, employeeCode: true, firstName: true, lastName: true }
    })

    if (employees.length === 0) {
      return {
        success: true,
        teamId: team.id,
        teamName: team.name,
        shiftId: shift.id,
        shiftName: shift.name,
        assignedCount: 0,
        supersededCount: 0,
        results: [],
        message: `No active employees found in team '${team.name}'.`
      }
    }

    const employeeIds = employees.map(e => e.id)

    // Check overlapping assignments
    const overlapping = await prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'ACTIVE',
        effectiveFrom: { lte: untilDate || new Date('2099-12-31') },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: fromDate } }
        ]
      }
    })

    if (!overrideOverlapping && overlapping.length > 0) {
      const error = new Error(`${overlapping.length} employee(s) in this team have active overlapping shift assignments. Please confirm override to supersede them.`)
      error.code = 'REQUIRES_OVERRIDE_CONFIRMATION'
      error.status = 409
      error.overlappingCount = overlapping.length
      throw error
    }

    // Transactionally supersede overlapping and insert new team assignments
    const results = await prisma.$transaction(async (tx) => {
      // 1. Supersede overlapping active assignments for this team
      let supersededCount = 0
      if (overlapping.length > 0) {
        const updateRes = await tx.shiftAssignment.updateMany({
          where: {
            id: { in: overlapping.map(o => o.id) }
          },
          data: {
            status: 'SUPERSEDED'
          }
        })
        supersededCount = updateRes.count
      }

      // 2. Create new assignments for each active employee
      const createdList = []
      const teamNotes = notes?.trim() || `Team roster assignment for ${team.name}`

      for (const emp of employees) {
        const created = await tx.shiftAssignment.create({
          data: {
            employeeId: emp.id,
            shiftId: shift.id,
            effectiveFrom: fromDate,
            effectiveUntil: untilDate,
            status: 'ACTIVE',
            assignedById: actorUserId,
            notes: teamNotes
          },
          include: {
            shift: true,
            employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
          }
        })
        createdList.push({
          id: created.id,
          employeeId: created.employeeId,
          employeeCode: created.employee?.employeeCode,
          employeeName: `${created.employee?.firstName || ''} ${created.employee?.lastName || ''}`.trim(),
          shiftId: created.shiftId,
          shiftName: created.shift?.name,
          effectiveFrom: created.effectiveFrom ? new Date(created.effectiveFrom).toISOString().slice(0, 10) : '',
          effectiveUntil: created.effectiveUntil ? new Date(created.effectiveUntil).toISOString().slice(0, 10) : null,
          status: created.status
        })
      }

      return {
        supersededCount,
        createdList
      }
    })

    return {
      success: true,
      teamId: team.id,
      teamCode: team.code,
      teamName: team.name,
      shiftId: shift.id,
      shiftCode: shift.shiftCode,
      shiftName: shift.name,
      assignedCount: results.createdList.length,
      supersededCount: results.supersededCount,
      results: results.createdList,
      message: `Successfully assigned '${shift.name}' to ${results.createdList.length} employee(s) of team '${team.name}'.`
    }
  },

  /**
   * Updates an existing shift assignment's effective dates, shift, or notes.
   * Validates date range order and prevents overlapping active assignments for the same employee.
   * Preserves assignment history and audit changes.
   */
  async updateShiftAssignment(id, updateData, actorUserId = null) {
    const { effectiveFrom, effectiveUntil, effectiveTo, shiftId, notes, status } = updateData

    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: {
        shift: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })

    if (!assignment) {
      const error = new Error(`Shift assignment with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const fromDate = effectiveFrom !== undefined ? new Date(effectiveFrom) : new Date(assignment.effectiveFrom)
    const rawUntil = effectiveUntil !== undefined ? effectiveUntil : effectiveTo
    const untilDate = rawUntil !== undefined ? (rawUntil ? new Date(rawUntil) : null) : assignment.effectiveUntil

    if (untilDate && untilDate < fromDate) {
      const error = new Error('Effective Until date cannot precede Effective From date.')
      error.code = 'INVALID_DATE_RANGE'
      error.status = 400
      throw error
    }

    // Overlap prevention with other ACTIVE assignments for this employee
    const targetStatus = status || assignment.status
    if (targetStatus === 'ACTIVE') {
      const otherActive = await prisma.shiftAssignment.findMany({
        where: {
          employeeId: assignment.employeeId,
          id: { not: id },
          status: 'ACTIVE'
        }
      })

      const overlap = otherActive.find((other) => {
        const otherStart = new Date(other.effectiveFrom)
        const otherEnd = other.effectiveUntil ? new Date(other.effectiveUntil) : new Date('2099-12-31')
        const currentEnd = untilDate || new Date('2099-12-31')

        return !(currentEnd < otherStart || fromDate > otherEnd)
      })

      if (overlap) {
        const otherUntilStr = overlap.effectiveUntil ? new Date(overlap.effectiveUntil).toISOString().slice(0, 10) : 'Indefinite'
        const error = new Error(`Cannot save: This employee already has an active assignment from ${new Date(overlap.effectiveFrom).toISOString().slice(0, 10)} to ${otherUntilStr} that overlaps with the selected date range.`)
        error.code = 'OVERLAPPING_ASSIGNMENT'
        error.status = 409
        throw error
      }
    }

    if (shiftId) {
      const targetShift = await prisma.shift.findUnique({ where: { id: shiftId } })
      if (!targetShift) {
        const error = new Error(`Shift with ID '${shiftId}' not found`)
        error.code = 'INVALID_SHIFT'
        error.status = 400
        throw error
      }
    }

    // Preserve audit notes
    let updatedNotes = assignment.notes
    if (notes !== undefined) {
      const cleanNotes = notes?.trim() || ''
      const auditStamp = `[Updated ${new Date().toISOString().slice(0, 10)}${actorUserId ? ` by user ${actorUserId}` : ''}]`
      updatedNotes = cleanNotes ? `${cleanNotes} ${auditStamp}` : (assignment.notes ? `${assignment.notes} ${auditStamp}` : auditStamp)
    }

    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        effectiveFrom: fromDate,
        effectiveUntil: untilDate,
        ...(shiftId ? { shiftId } : {}),
        ...(status ? { status } : {}),
        notes: updatedNotes
      },
      include: {
        shift: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })

    return {
      ...updated,
      employeeCode: updated.employee?.employeeCode,
      employeeName: `${updated.employee?.firstName || ''} ${updated.employee?.lastName || ''}`.trim(),
      shiftName: updated.shift?.name
    }
  },

  /**
   * Previews team shift assignment without saving.
   * Resolves team active employees and detects overlapping assignments.
   */
  async previewTeamShiftAssignment(data) {
    const { teamId, shiftId, effectiveFrom, effectiveUntil, effectiveTo } = data

    if (!teamId || !shiftId || !effectiveFrom) {
      const error = new Error('teamId, shiftId, and effectiveFrom date are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const fromDate = new Date(effectiveFrom)
    const rawUntil = effectiveUntil !== undefined ? effectiveUntil : effectiveTo
    const untilDate = rawUntil ? new Date(rawUntil) : null

    if (untilDate && untilDate < fromDate) {
      const error = new Error('Effective Until date cannot precede Effective From date.')
      error.code = 'INVALID_DATE_RANGE'
      error.status = 400
      throw error
    }

    // Resolve team by CUID or code
    const team = await prisma.team.findFirst({
      where: { OR: [{ id: teamId }, { code: teamId }] },
      include: { department: true }
    })
    if (!team) {
      const error = new Error(`Team '${teamId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Resolve shift by CUID or code
    const shift = await prisma.shift.findFirst({
      where: { OR: [{ id: shiftId }, { shiftCode: shiftId }] }
    })
    if (!shift) {
      const error = new Error(`Shift '${shiftId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Query active employees in this team
    const employees = await prisma.employee.findMany({
      where: { teamId: team.id, employmentStatus: 'ACTIVE' },
      select: { id: true, employeeCode: true, firstName: true, lastName: true }
    })

    const employeeIds = employees.map(e => e.id)

    // Detect overlapping active assignments for team members
    const overlappingAssignments = employeeIds.length > 0 ? await prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'ACTIVE',
        effectiveFrom: { lte: untilDate || new Date('2099-12-31') },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: fromDate } }
        ]
      },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        shift: { select: { id: true, name: true, shiftCode: true } }
      }
    }) : []

    return {
      teamId: team.id,
      teamCode: team.code,
      teamName: team.name,
      departmentName: team.department?.name || '',
      shiftId: shift.id,
      shiftCode: shift.shiftCode,
      shiftName: shift.name,
      totalEmployees: employees.length,
      employees: employees.map(e => ({
        id: e.id,
        employeeCode: e.employeeCode,
        name: `${e.firstName || ''} ${e.lastName || ''}`.trim()
      })),
      overlappingCount: overlappingAssignments.length,
      overlappingAssignments: overlappingAssignments.map(o => ({
        assignmentId: o.id,
        employeeId: o.employeeId,
        employeeCode: o.employee?.employeeCode,
        employeeName: `${o.employee?.firstName || ''} ${o.employee?.lastName || ''}`.trim(),
        currentShiftName: o.shift?.name,
        currentShiftCode: o.shift?.shiftCode,
        effectiveFrom: o.effectiveFrom ? new Date(o.effectiveFrom).toISOString().slice(0, 10) : '',
        effectiveUntil: o.effectiveUntil ? new Date(o.effectiveUntil).toISOString().slice(0, 10) : 'Indefinite'
      }))
    }
  },

  /**
   * Transactionally assigns a shift to all active employees of a functional team.
   * Detects overlaps, optionally supersedes previous assignments, and preserves historical records.
   */
  async assignShiftToTeam(data, actorUserId = null) {
    const { teamId, shiftId, effectiveFrom, effectiveUntil, effectiveTo, overrideOverlapping = true, notes } = data

    if (!teamId || !shiftId || !effectiveFrom) {
      const error = new Error('teamId, shiftId, and effectiveFrom date are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const fromDate = new Date(effectiveFrom)
    const rawUntil = effectiveUntil !== undefined ? effectiveUntil : effectiveTo
    const untilDate = rawUntil ? new Date(rawUntil) : null

    if (untilDate && untilDate < fromDate) {
      const error = new Error('Effective Until date cannot precede Effective From date.')
      error.code = 'INVALID_DATE_RANGE'
      error.status = 400
      throw error
    }

    // Resolve team
    const team = await prisma.team.findFirst({
      where: { OR: [{ id: teamId }, { code: teamId }] },
      include: { department: true }
    })
    if (!team) {
      const error = new Error(`Team '${teamId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Resolve shift
    const shift = await prisma.shift.findFirst({
      where: { OR: [{ id: shiftId }, { shiftCode: shiftId }] }
    })
    if (!shift) {
      const error = new Error(`Shift '${shiftId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    // Get active employees in team
    const employees = await prisma.employee.findMany({
      where: { teamId: team.id, employmentStatus: 'ACTIVE' },
      select: { id: true, employeeCode: true, firstName: true, lastName: true }
    })

    if (employees.length === 0) {
      return {
        success: true,
        teamId: team.id,
        teamName: team.name,
        shiftId: shift.id,
        shiftName: shift.name,
        assignedCount: 0,
        supersededCount: 0,
        results: [],
        message: `No active employees found in team '${team.name}'.`
      }
    }

    const employeeIds = employees.map(e => e.id)

    // Check overlapping assignments
    const overlapping = await prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'ACTIVE',
        effectiveFrom: { lte: untilDate || new Date('2099-12-31') },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: fromDate } }
        ]
      }
    })

    if (!overrideOverlapping && overlapping.length > 0) {
      const error = new Error(`${overlapping.length} employee(s) in this team have active overlapping shift assignments. Please confirm override to supersede them.`)
      error.code = 'REQUIRES_OVERRIDE_CONFIRMATION'
      error.status = 409
      error.overlappingCount = overlapping.length
      throw error
    }

    // Transactionally supersede overlapping and insert new team assignments
    const results = await prisma.$transaction(async (tx) => {
      // 1. Supersede overlapping active assignments for this team
      let supersededCount = 0
      if (overlapping.length > 0) {
        const updateRes = await tx.shiftAssignment.updateMany({
          where: {
            id: { in: overlapping.map(o => o.id) }
          },
          data: {
            status: 'SUPERSEDED'
          }
        })
        supersededCount = updateRes.count
      }

      // 2. Create new assignments for each active employee
      const createdList = []
      const teamNotes = notes?.trim() || `Team roster assignment for ${team.name}`

      for (const emp of employees) {
        const created = await tx.shiftAssignment.create({
          data: {
            employeeId: emp.id,
            shiftId: shift.id,
            effectiveFrom: fromDate,
            effectiveUntil: untilDate,
            status: 'ACTIVE',
            assignedById: actorUserId,
            notes: teamNotes
          },
          include: {
            shift: true,
            employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
          }
        })
        createdList.push({
          id: created.id,
          employeeId: created.employeeId,
          employeeCode: created.employee?.employeeCode,
          employeeName: `${created.employee?.firstName || ''} ${created.employee?.lastName || ''}`.trim(),
          shiftId: created.shiftId,
          shiftName: created.shift?.name,
          effectiveFrom: created.effectiveFrom ? new Date(created.effectiveFrom).toISOString().slice(0, 10) : '',
          effectiveUntil: created.effectiveUntil ? new Date(created.effectiveUntil).toISOString().slice(0, 10) : null,
          status: created.status
        })
      }

      return {
        supersededCount,
        createdList
      }
    })

    return {
      success: true,
      teamId: team.id,
      teamCode: team.code,
      teamName: team.name,
      shiftId: shift.id,
      shiftCode: shift.shiftCode,
      shiftName: shift.name,
      assignedCount: results.createdList.length,
      supersededCount: results.supersededCount,
      results: results.createdList,
      message: `Successfully assigned '${shift.name}' to ${results.createdList.length} employee(s) of team '${team.name}'.`
    }
  },

  /**
   * CRITICAL INVARIANT: SHIFT-ISOLATION-01
   * Resolves an employee's active shift for a given business date.
   * Strictly isolates assignment to employeeId; falls back to default corporate shift if unassigned.
   * NEVER leaks another employee's shift!
   */
  async resolveEmployeeShift(employeeId, businessDateStr = getKarachiDate()) {
    const targetDate = new Date(businessDateStr)

    // 1. Look for explicit per-employee assignment active on businessDate
    const explicitAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId,
        status: 'ACTIVE',
        effectiveFrom: { lte: targetDate },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: targetDate } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' },
      include: { shift: true }
    })

    if (explicitAssignment?.shift) {
      return {
        shift: enrichShift(explicitAssignment.shift),
        assignmentType: 'EXPLICIT',
        effectiveFrom: explicitAssignment.effectiveFrom,
        effectiveUntil: explicitAssignment.effectiveUntil
      }
    }

    // 2. Canonical Corporate Default Fallback
    let defaultShift = await prisma.shift.findFirst({
      where: { isDefault: true, isActive: true }
    })

    if (!defaultShift) {
      // Safe fallback to first active shift if no explicit isDefault configured
      defaultShift = await prisma.shift.findFirst({
        where: { isActive: true },
        orderBy: { shiftCode: 'asc' }
      })
    }

    if (!defaultShift) {
      // Auto-provision standard corporate default shift in database so it exists
      defaultShift = await prisma.shift.upsert({
        where: { shiftCode: 'SHF-GEN' },
        update: {},
        create: {
          shiftCode: 'SHF-GEN',
          name: 'General Day (09:00 - 18:00)',
          startTime: '09:00',
          endTime: '18:00',
          graceMinutesIn: 15,
          graceMinutesOut: 15,
          fullDayTargetMinutes: 480,
          halfDayThresholdMinutes: 240,
          isDefault: true,
          isActive: true
        }
      }).catch(async () => {
        return prisma.shift.findFirst()
      })
    }

    if (!defaultShift) {
      defaultShift = {
        id: 'SHF-DEFAULT',
        shiftCode: 'SHF-GEN',
        name: 'General Day (09:00 - 18:00)',
        startTime: '09:00',
        endTime: '18:00',
        gracePeriodMinutes: 15,
        fullDayTargetMinutes: 480,
        halfDayThresholdMinutes: 240,
        isDefault: true,
        isActive: true
      }
    }

    return {
      shift: enrichShift(defaultShift),
      assignmentType: 'DEFAULT_CORPORATE',
      effectiveFrom: null,
      effectiveUntil: null
    }
  }
}

export default shiftService

