/**
 * iSysware HRMS — Leave Management Service
 * Implements leave types, entitlement tracking, leave application,
 * annual approval threshold escalation (Requests 1 & 2 -> TL; 3+ -> DM),
 * anti-self-approval guards, and idempotent cancellation ledger reversals.
 */

import { prisma } from '../config/database.js'
import { getKarachiDate } from '../utils/time.js'
export const leaveService = {
  // ============================================================================
  // LEAVE TYPES & POLICIES
  // ============================================================================

  async getLeaveTypes(filters = {}) {
    const where = {}
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true' || filters.isActive === true
    }

    return prisma.leaveType.findMany({
      where,
      orderBy: { code: 'asc' },
      include: { policies: { where: { isActive: true } } }
    })
  },

  async createLeaveType(data) {
    const {
      code,
      name,
      defaultDaysPerYear,
      isPaid = true,
      isEncashable = false,
      carryForwardLimit = 0,
      requiresAttachment = false,
      annualApprovalThreshold = 2
    } = data

    if (!code || !name || defaultDaysPerYear === undefined) {
      const error = new Error('Code, name, and defaultDaysPerYear are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const cleanCode = code.trim().toUpperCase()
    const existing = await prisma.leaveType.findUnique({ where: { code: cleanCode } })
    if (existing) {
      const error = new Error(`Leave type '${cleanCode}' already exists.`)
      error.code = 'DUPLICATE_CODE'
      error.status = 409
      throw error
    }

    return prisma.$transaction(async (tx) => {
      const createdType = await tx.leaveType.create({
        data: {
          code: cleanCode,
          name: name.trim(),
          defaultDaysPerYear: parseFloat(defaultDaysPerYear),
          isPaid: Boolean(isPaid),
          isEncashable: Boolean(isEncashable),
          carryForwardLimit: parseFloat(carryForwardLimit || 0),
          requiresAttachment: Boolean(requiresAttachment)
        }
      })

      await tx.leavePolicy.create({
        data: {
          leaveTypeId: createdType.id,
          policyName: `${cleanCode} Standard Corporate Policy`,
          annualApprovalThreshold: parseInt(annualApprovalThreshold, 10) || 2,
          effectiveFrom: new Date('2026-01-01')
        }
      })

      return createdType
    })
  },

  // ============================================================================
  // EMPLOYEE ENTITLEMENTS
  // ============================================================================

  async getAllEntitlements(filters = {}) {
    const where = {}
    if (filters.calendarYear || filters.year) {
      where.calendarYear = parseInt(filters.calendarYear || filters.year, 10)
    }
    if (filters.employeeId) {
      let emp = await prisma.employee.findUnique({ where: { id: filters.employeeId } })
      if (!emp) {
        emp = await prisma.employee.findFirst({ where: { employeeCode: filters.employeeId } })
      }
      if (emp) {
        where.employeeId = emp.id
      }
    }
    if (filters.leaveTypeId) {
      where.leaveTypeId = filters.leaveTypeId
    }

    return prisma.leaveEntitlement.findMany({
      where,
      orderBy: [{ calendarYear: 'desc' }, { employeeId: 'asc' }],
      include: {
        leaveType: true,
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

  async getEmployeeEntitlements(employeeId, calendarYear = new Date().getFullYear()) {
    const year = parseInt(calendarYear, 10)

    let emp = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!emp) {
      emp = await prisma.employee.findFirst({ where: { employeeCode: employeeId } })
    }
    const realEmpId = emp ? emp.id : employeeId

    let entitlements = await prisma.leaveEntitlement.findMany({
      where: { employeeId: realEmpId, calendarYear: year },
      include: { leaveType: true }
    })

    if (entitlements.length === 0 && emp) {
      const activeTypes = await prisma.leaveType.findMany({ where: { isActive: true } })
      for (const lt of activeTypes) {
        const defaultDays = parseFloat(lt.defaultDaysPerYear || 10)
        const ent = await prisma.leaveEntitlement.create({
          data: {
            employeeId: realEmpId,
            leaveTypeId: lt.id,
            calendarYear: year,
            allocatedDays: defaultDays,
            utilizedDays: 0,
            pendingDays: 0,
            availableBalance: defaultDays
          },
          include: { leaveType: true }
        })
        entitlements.push(ent)
      }
    }

    return entitlements
  },

  async setEmployeeEntitlement(employeeId, leaveTypeId, calendarYear, allocatedDays) {
    const year = parseInt(calendarYear, 10)
    const days = parseFloat(allocatedDays)

    const existing = await prisma.leaveEntitlement.findUnique({
      where: {
        employeeId_leaveTypeId_calendarYear: {
          employeeId,
          leaveTypeId,
          calendarYear: year
        }
      }
    })

    if (existing) {
      const balanceDelta = days - parseFloat(existing.allocatedDays)
      const newAvailable = Math.max(0, parseFloat(existing.availableBalance) + balanceDelta)

      return prisma.leaveEntitlement.update({
        where: { id: existing.id },
        data: {
          allocatedDays: days,
          availableBalance: newAvailable
        },
        include: { leaveType: true }
      })
    }

    return prisma.leaveEntitlement.create({
      data: {
        employeeId,
        leaveTypeId,
        calendarYear: year,
        openingBalance: days,
        allocatedDays: days,
        utilizedDays: 0,
        pendingDays: 0,
        availableBalance: days
      },
      include: { leaveType: true }
    })
  },

  // ============================================================================
  // LEAVE APPLICATION & ROUTING RULES
  // ============================================================================

  /**
   * Applies for a leave request.
   * Enforces:
   * 1. Balance sufficiency from leave_entitlements
   * 2. Annual sequence escalation:
   *    - Normal Employee: requests 1 & 2 -> TEAM_LEAD, requests 3+ -> DEPT_MANAGER
   *    - Team Lead: requests 1 & 2 -> DEPT_MANAGER, requests 3+ -> HR_ADMIN
   * 3. Pending balance deduction in transaction
   */
  async applyLeave(employeeId, data) {
    const {
      leaveTypeId,
      startDate,
      endDate,
      durationDays,
      isHalfDay = false,
      halfDayType = null,
      reason,
      emergencyContact,
      attachmentUrl
    } = data

    if (!employeeId || !leaveTypeId || !startDate || !endDate || !reason) {
      const error = new Error('Employee ID, leaveTypeId, start date, end date, and reason are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end < start) {
      const error = new Error('End date cannot precede start date.')
      error.code = 'INVALID_DATE_RANGE'
      error.status = 400
      throw error
    }

    const requestedDays = isHalfDay
      ? 0.5
      : durationDays
        ? parseFloat(durationDays)
        : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

    const calendarYear = start.getFullYear()

    // Fetch employee with user and organization links
    let employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { userAccount: true, department: true }
    })
    if (!employee) {
      employee = await prisma.employee.findFirst({
        where: { employeeCode: employeeId },
        include: { userAccount: true, department: true }
      })
    }

    if (!employee) {
      const error = new Error('Employee record not found.')
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    let leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } })
    if (!leaveType) {
      leaveType = await prisma.leaveType.findFirst({ where: { code: leaveTypeId } })
    }
    if (!leaveType) {
      const error = new Error(`Leave type '${leaveTypeId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const targetEmployeeId = employee.id
    const targetLeaveTypeId = leaveType.id

    // Check entitlement balance
    let entitlement = await prisma.leaveEntitlement.findUnique({
      where: {
        employeeId_leaveTypeId_calendarYear: {
          employeeId: targetEmployeeId,
          leaveTypeId: targetLeaveTypeId,
          calendarYear
        }
      }
    })

    if (!entitlement) {
      const defaultDays = parseFloat(leaveType.defaultDaysPerYear || 10)
      entitlement = await prisma.leaveEntitlement.create({
        data: {
          employeeId: targetEmployeeId,
          leaveTypeId: targetLeaveTypeId,
          calendarYear,
          allocatedDays: defaultDays,
          utilizedDays: 0,
          pendingDays: 0,
          availableBalance: defaultDays
        }
      })
    }

    if (parseFloat(entitlement.availableBalance) < requestedDays) {
      const available = parseFloat(entitlement.availableBalance)
      const error = new Error(`Insufficient leave balance. Requested: ${requestedDays} days, Available: ${available} days.`)
      error.code = 'INSUFFICIENT_BALANCE'
      error.status = 400
      throw error
    }

    // COUNT prior approved requests for this employee in the calendar year
    const approvedCountInYear = await prisma.leaveRequest.count({
      where: {
        employeeId: targetEmployeeId,
        status: 'APPROVED',
        startDate: {
          gte: new Date(`${calendarYear}-01-01`),
          lte: new Date(`${calendarYear}-12-31`)
        }
      }
    })

    const annualSequenceNumber = approvedCountInYear + 1

    // RESOLVE ROUTING TIER ACCORDING TO INVARIANT RULES
    let routingTier = 'TEAM_LEAD'
    const userRole = employee.userAccount?.role || 'EMPLOYEE'

    if (userRole === 'TEAM_LEAD') {
      routingTier = annualSequenceNumber <= 2 ? 'DEPT_MANAGER' : 'HR_ADMIN'
    } else if (userRole === 'DEPT_MANAGER' || !employee.teamId) {
      routingTier = annualSequenceNumber <= 2 ? 'DEPT_MANAGER' : 'HR_ADMIN'
    } else {
      // Normal employee with a team
      routingTier = annualSequenceNumber <= 2 ? 'TEAM_LEAD' : 'DEPT_MANAGER'
    }

    let normalizedHalfDayType = null
    if (isHalfDay) {
      if (halfDayType === 'SECOND_HALF' || halfDayType === 'Second-Half' || halfDayType === 'second_half') {
        normalizedHalfDayType = 'SECOND_HALF'
      } else {
        normalizedHalfDayType = 'FIRST_HALF'
      }
    }

    // Generate request code LV-YYYYMM-XXXX
    const dateStr = getKarachiDate(start)
    const datePrefix = dateStr.replace(/-/g, '').slice(0, 6)
    const totalRequests = await prisma.leaveRequest.count()
    const requestCode = `LV-${datePrefix}-${String(totalRequests + 1).padStart(3, '0')}`

    const result = await prisma.$transaction(async (tx) => {
      // Create leave request
      const request = await tx.leaveRequest.create({
        data: {
          requestCode,
          employeeId: targetEmployeeId,
          leaveTypeId: targetLeaveTypeId,
          startDate: start,
          endDate: end,
          durationDays: requestedDays,
          isHalfDay: Boolean(isHalfDay),
          halfDayType: normalizedHalfDayType,
          reason: reason.trim(),
          emergencyContact: emergencyContact?.trim() || null,
          attachmentUrl: attachmentUrl?.trim() || null,
          status: 'PENDING',
          annualSequenceNumber,
          routingTier
        },
        include: {
          leaveType: true,
          employee: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true }
          }
        }
      })

      // Hold requested days in pendingDays and reduce availableBalance
      await tx.leaveEntitlement.update({
        where: { id: entitlement.id },
        data: {
          pendingDays: { increment: requestedDays },
          availableBalance: { decrement: requestedDays }
        }
      })

      return request
    })

    return result
  },

  // ============================================================================
  // LEAVE REVIEW (APPROVE / REJECT)
  // ============================================================================

  /**
   * Reviews and decides on a leave request.
   * Enforces Anti-Self-Approval.
   * Updates balance journal and syncs attendance records.
   */
  async reviewLeave(leaveId, decision, reviewerUser, remarks = '') {
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      const error = new Error("Decision must be either 'APPROVED' or 'REJECTED'.")
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        employee: true,
        leaveType: true
      }
    })

    if (!leave) {
      const error = new Error(`Leave request '${leaveId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (leave.status !== 'PENDING') {
      const error = new Error(`Cannot review leave request already marked as ${leave.status}.`)
      error.code = 'ALREADY_PROCESSED'
      error.status = 400
      throw error
    }

    // ANTI-SELF-APPROVAL GUARD (bypassed for SUPER_ADMIN universal authority)
    const isSuperAdmin = String(reviewerUser?.role || '').toUpperCase() === 'SUPER_ADMIN'
    if (!isSuperAdmin && reviewerUser?.employee?.id && reviewerUser.employee.id === leave.employeeId) {
      const error = new Error('Anti-Self-Approval Violation: You cannot approve or reject your own leave request.')
      error.code = 'SELF_APPROVAL_PROHIBITED'
      error.status = 403
      throw error
    }

    const requestedDays = parseFloat(leave.durationDays)
    const calendarYear = new Date(leave.startDate).getFullYear()

    const result = await prisma.$transaction(async (tx) => {
      const entitlement = await tx.leaveEntitlement.findUnique({
        where: {
          employeeId_leaveTypeId_calendarYear: {
            employeeId: leave.employeeId,
            leaveTypeId: leave.leaveTypeId,
            calendarYear
          }
        }
      })

      if (decision === 'APPROVED') {
        // Move from pending to utilized
        if (entitlement) {
          await tx.leaveEntitlement.update({
            where: { id: entitlement.id },
            data: {
              pendingDays: { decrement: requestedDays },
              utilizedDays: { increment: requestedDays }
            }
          })
        }

        // Record in ledger journal
        await tx.leaveBalanceJournal.create({
          data: {
            employeeId: leave.employeeId,
            leaveTypeId: leave.leaveTypeId,
            transactionType: 'UTILIZATION',
            days: requestedDays,
            referenceRequestId: leave.id,
            notes: `Leave approved (${leave.requestCode})`,
            createdById: reviewerUser?.id || null
          }
        })

        // Sync attendance records for each day of leave
        const curDate = new Date(leave.startDate)
        const lastDate = new Date(leave.endDate)

        while (curDate <= lastDate) {
          const businessDate = new Date(curDate)
          const existing = await tx.attendanceRecord.findUnique({
            where: {
              employeeId_attendanceDate: {
                employeeId: leave.employeeId,
                attendanceDate: businessDate
              }
            }
          })

          if (existing) {
            await tx.attendanceRecord.update({
              where: { id: existing.id },
              data: {
                status: 'ON_LEAVE',
                remarks: `On Approved Leave: ${leave.leaveType.name} (${leave.requestCode})`
              }
            })
          }

          curDate.setDate(curDate.getDate() + 1)
        }
      } else {
        // REJECTED: Restore pending balance back to available balance
        if (entitlement) {
          await tx.leaveEntitlement.update({
            where: { id: entitlement.id },
            data: {
              pendingDays: { decrement: requestedDays },
              availableBalance: { increment: requestedDays }
            }
          })
        }
      }

      return tx.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: decision,
          approvedById: reviewerUser?.id || null,
          approvedByRole: reviewerUser?.role || null,
          approvedAt: new Date(),
          decisionRemarks: remarks?.trim() || null
        },
        include: {
          leaveType: true,
          employee: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true }
          }
        }
      })
    })

    return result
  },

  // ============================================================================
  // LEAVE CANCELLATION (IDEMPOTENT REVERSAL)
  // ============================================================================

  /**
   * Cancels a leave request and posts an idempotent offsetting reversal in the journal.
   */
  async cancelLeave(leaveId, cancelledByUserId, reason = 'User requested cancellation') {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { leaveType: true }
    })

    if (!leave) {
      const error = new Error(`Leave request '${leaveId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (leave.status === 'CANCELLED') {
      const error = new Error('Leave request has already been cancelled.')
      error.code = 'ALREADY_CANCELLED'
      error.status = 400
      throw error
    }

    if (leave.status === 'REJECTED') {
      const error = new Error('Cannot cancel an already rejected leave request.')
      error.code = 'INVALID_STATE'
      error.status = 400
      throw error
    }

    const requestedDays = parseFloat(leave.durationDays)
    const calendarYear = new Date(leave.startDate).getFullYear()

    const result = await prisma.$transaction(async (tx) => {
      const entitlement = await tx.leaveEntitlement.findUnique({
        where: {
          employeeId_leaveTypeId_calendarYear: {
            employeeId: leave.employeeId,
            leaveTypeId: leave.leaveTypeId,
            calendarYear
          }
        }
      })

      // If it was APPROVED, reverse utilization and create journal reversal entry
      if (leave.status === 'APPROVED') {
        if (entitlement) {
          await tx.leaveEntitlement.update({
            where: { id: entitlement.id },
            data: {
              utilizedDays: { decrement: requestedDays },
              availableBalance: { increment: requestedDays }
            }
          })
        }

        // Idempotent reversal ledger entry
        await tx.leaveBalanceJournal.create({
          data: {
            employeeId: leave.employeeId,
            leaveTypeId: leave.leaveTypeId,
            transactionType: 'REVERSAL',
            days: requestedDays,
            referenceRequestId: leave.id,
            notes: `Cancellation refund for ${leave.requestCode}: ${reason}`,
            createdById: cancelledByUserId
          }
        })
      } else if (leave.status === 'PENDING') {
        // If it was PENDING, clear pendingDays and restore availableBalance
        if (entitlement) {
          await tx.leaveEntitlement.update({
            where: { id: entitlement.id },
            data: {
              pendingDays: { decrement: requestedDays },
              availableBalance: { increment: requestedDays }
            }
          })
        }
      }

      return tx.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: 'CANCELLED',
          cancelledById: cancelledByUserId,
          cancelledAt: new Date(),
          cancellationReason: reason.trim()
        }
      })
    })

    return result
  },

  // ============================================================================
  // LEAVE QUERIES & CALENDAR
  // ============================================================================

  async getLeaveRequests(filters = {}, requesterUser = null) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.employeeId) where.employeeId = filters.employeeId
    if (filters.leaveTypeId) where.leaveTypeId = filters.leaveTypeId

    if (requesterUser) {
      if (requesterUser.role === 'EMPLOYEE') {
        where.employeeId = requesterUser.employee?.id
      } else if (requesterUser.role === 'TEAM_LEAD' && requesterUser.employee?.teamId) {
        where.employee = { teamId: requesterUser.employee.teamId }
      } else if (requesterUser.role === 'DEPT_MANAGER' && requesterUser.employee?.departmentId) {
        where.employee = { departmentId: requesterUser.employee.departmentId }
      }
    }

    return prisma.leaveRequest.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        }
      }
    })
  },

  async getLeaveCalendar(year = new Date().getFullYear(), month = null) {
    const startStr = month
      ? `${year}-${String(month).padStart(2, '0')}-01`
      : `${year}-01-01`
    const endStr = month
      ? `${year}-${String(month).padStart(2, '0')}-31`
      : `${year}-12-31`

    const [approvedLeaves, publicHolidays] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { lte: new Date(endStr) },
          endDate: { gte: new Date(startStr) }
        },
        include: {
          employee: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true }
          },
          leaveType: true
        }
      }),
      prisma.publicHoliday.findMany({
        where: {
          holidayDate: {
            gte: new Date(startStr),
            lte: new Date(endStr)
          }
        }
      })
    ])

    return {
      year,
      month,
      leaves: approvedLeaves,
      holidays: publicHolidays
    }
  }
}

export default leaveService
