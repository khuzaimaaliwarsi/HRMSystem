/**
 * iSysware HRMS — Reports & Analytics Backend Service
 * PostgreSQL-derived aggregation engine for executive and departmental reporting:
 * - Headcount & employee demographics
 * - Attendance & punctuality analytics
 * - Leave utilization & quota rollforward
 * - Overtime, WFH, and Field Duty metrics
 * - Confidential payroll & compensation aggregates (strict RBAC protection)
 * - Recruitment funnel conversion
 * - Task productivity & completion rates
 * - Performance rating distribution
 * - Training & certification transcripts
 * - Expense claims & reimbursement disbursements
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'

export class ReportService {
  // 1. Headcount & Distribution
  async getHeadcountReport(filters = {}, user) {
    const where = {}
    if (filters.departmentId) where.departmentId = filters.departmentId
    if (user?.role === 'DEPT_MANAGER' && user?.departmentId) {
      where.departmentId = user.departmentId
    }

    const totalEmployees = await prisma.employee.count({ where })
    const activeEmployees = await prisma.employee.count({ where: { ...where, employmentStatus: 'ACTIVE' } })
    const probationEmployees = await prisma.employee.count({ where: { ...where, employmentStatus: 'PROBATION' } })
    const noticeEmployees = await prisma.employee.count({ where: { ...where, employmentStatus: 'NOTICE_PERIOD' } })
    const departedEmployees = await prisma.employee.count({ where: { ...where, employmentStatus: 'TERMINATED' } })

    const byDepartment = await prisma.department.findMany({
      include: {
        _count: { select: { employees: true } }
      }
    })

    return {
      totalEmployees,
      activeEmployees,
      probationEmployees,
      noticeEmployees,
      departedEmployees,
      departmentBreakdown: byDepartment.map((d) => ({
        departmentId: d.id,
        departmentName: d.name,
        count: d._count.employees
      }))
    }
  }

  // 2. Attendance & Punctuality
  async getAttendanceReport(filters = {}, user) {
    const where = {}
    if (filters.startDate && filters.endDate) {
      where.attendanceDate = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate)
      }
    }
    if (filters.employeeId) where.employeeId = filters.employeeId
    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      where.employeeId = user.employeeId
    } else if (user?.role === 'DEPT_MANAGER' && user?.departmentId) {
      where.employee = { departmentId: user.departmentId }
    }

    const totalRecords = await prisma.attendanceRecord.count({ where })
    const presentCount = await prisma.attendanceRecord.count({ where: { ...where, status: 'PRESENT' } })
    const lateCount = await prisma.attendanceRecord.count({ where: { ...where, lateMinutes: { gt: 0 } } })
    const halfDayCount = await prisma.attendanceRecord.count({ where: { ...where, status: 'HALF_DAY' } })
    const absentCount = await prisma.attendanceRecord.count({ where: { ...where, status: 'ABSENT' } })

    return {
      totalRecords,
      presentCount,
      lateCount,
      halfDayCount,
      absentCount,
      attendanceRate: totalRecords > 0 ? Number(((presentCount / totalRecords) * 100).toFixed(1)) : 0
    }
  }

  // 3. Leave Utilization
  async getLeaveReport(filters = {}, user) {
    const where = {}
    if (filters.startDate && filters.endDate) {
      where.startDate = { gte: new Date(filters.startDate) }
      where.endDate = { lte: new Date(filters.endDate) }
    }
    if (filters.employeeId) where.employeeId = filters.employeeId
    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      where.employeeId = user.employeeId
    } else if (user?.role === 'DEPT_MANAGER' && user?.departmentId) {
      where.employee = { departmentId: user.departmentId }
    }

    const totalRequests = await prisma.leaveRequest.count({ where })
    const approvedRequests = await prisma.leaveRequest.count({ where: { ...where, status: 'APPROVED' } })
    const pendingRequests = await prisma.leaveRequest.count({ where: { ...where, status: 'PENDING' } })
    const rejectedRequests = await prisma.leaveRequest.count({ where: { ...where, status: 'REJECTED' } })

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: { ...where, status: 'APPROVED' },
      select: { durationDays: true }
    })
    const totalDaysTaken = approvedLeaves.reduce((sum, l) => sum + Number(l.durationDays || 0), 0)

    return {
      totalRequests,
      approvedRequests,
      pendingRequests,
      rejectedRequests,
      totalDaysTaken
    }
  }

  // 4. Overtime & Remote Operations
  async getOvertimeRemoteReport(filters = {}, user) {
    const where = {}
    if (filters.employeeId) where.employeeId = filters.employeeId
    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      where.employeeId = user.employeeId
    } else if (user?.role === 'DEPT_MANAGER' && user?.departmentId) {
      where.employee = { departmentId: user.departmentId }
    }

    const overtimeRecords = await prisma.overtimeRequest.findMany({
      where: { ...where, status: 'APPROVED' },
      select: { requestedMinutes: true }
    })
    const totalOvertimeMinutes = overtimeRecords.reduce((sum, r) => sum + Number(r.requestedMinutes || 0), 0)

    const wfhCount = await prisma.wfhRequest.count({ where: { ...where, status: 'APPROVED' } })
    const fieldDutyCount = await prisma.fieldDutyRequest.count({ where: { ...where, status: 'APPROVED' } })

    return {
      approvedOvertimeMinutes: totalOvertimeMinutes,
      approvedOvertimeHours: Number((totalOvertimeMinutes / 60).toFixed(1)),
      approvedWfhDays: wfhCount,
      approvedFieldDuties: fieldDutyCount
    }
  }

  // 5. Payroll Summary (Strictly Confidential - SUPER_ADMIN & HR_ADMIN only)
  async getPayrollReport(periodCode, user) {
    if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role)) {
      throw new AppError('Access denied: Confidential payroll reporting is restricted to authorized HR & Super Admin', 403, 'FORBIDDEN')
    }

    const where = {}
    if (periodCode) {
      const period = await prisma.payrollPeriod.findUnique({ where: { periodCode } })
      if (period) where.payrollPeriodId = period.id
    }

    const runs = await prisma.payrollRun.findMany({
      where,
      include: {
        entries: true,
        payrollPeriod: true
      }
    })

    let totalGross = 0
    let totalTaxWithheld = 0
    let totalDeductions = 0
    let totalNetPaid = 0
    let totalEmployeesPaid = 0

    runs.forEach((r) => {
      r.entries.forEach((e) => {
        totalGross += Number(e.grossSalary || 0)
        totalTaxWithheld += Number(e.incomeTax || 0)
        totalDeductions += Number(e.totalDeductions || 0)
        totalNetPaid += Number(e.netSalary || 0)
        totalEmployeesPaid += 1
      })
    })

    return {
      periodCode: periodCode || 'ALL',
      totalRuns: runs.length,
      totalEmployeesPaid,
      totalGross: Number(totalGross.toFixed(2)),
      totalTaxWithheld: Number(totalTaxWithheld.toFixed(2)),
      totalDeductions: Number(totalDeductions.toFixed(2)),
      totalNetPaid: Number(totalNetPaid.toFixed(2)),
      currency: 'PKR'
    }
  }

  // 6. Recruitment Funnel
  async getRecruitmentFunnel(filters = {}) {
    const totalRequisitions = await prisma.jobRequisition.count()
    const activeOpenings = await prisma.jobOpening.count({ where: { status: 'OPEN' } })
    const totalApplications = await prisma.jobApplication.count()
    const interviewingCount = await prisma.jobApplication.count({ where: { status: 'INTERVIEWING' } })
    const offersDrafted = await prisma.jobOffer.count()
    const offersAccepted = await prisma.jobOffer.count({ where: { status: 'ACCEPTED' } })
    const hiredEmployees = await prisma.jobApplication.count({ where: { status: 'HIRED' } })

    return {
      totalRequisitions,
      activeOpenings,
      totalApplications,
      interviewingCount,
      offersDrafted,
      offersAccepted,
      hiredEmployees,
      interviewRate: totalApplications > 0 ? Number(((interviewingCount / totalApplications) * 100).toFixed(1)) : 0,
      offerAcceptanceRate: offersDrafted > 0 ? Number(((offersAccepted / offersDrafted) * 100).toFixed(1)) : 0
    }
  }

  // 7. Task Productivity
  async getTaskProductivity(user) {
    const where = {}
    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      where.assigneeId = user.employeeId
    } else if (user?.role === 'DEPT_MANAGER' && user?.departmentId) {
      where.assignee = { departmentId: user.departmentId }
    }

    const total = await prisma.taskAssignment.count({ where })
    const completed = await prisma.taskAssignment.count({ where: { ...where, status: 'COMPLETED' } })
    const inProgress = await prisma.taskAssignment.count({ where: { ...where, status: 'IN_PROGRESS' } })
    const todo = await prisma.taskAssignment.count({ where: { ...where, status: 'TODO' } })

    const now = new Date()
    const overdue = await prisma.taskAssignment.count({
      where: {
        ...where,
        dueDate: { lt: now },
        status: { not: 'COMPLETED' }
      }
    })

    return {
      totalTasks: total,
      completedTasks: completed,
      inProgressTasks: inProgress,
      todoTasks: todo,
      overdueTasks: overdue,
      completionRate: total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0
    }
  }

  // 8. Expense & Reimbursement Summary
  async getExpenseSummary(user) {
    const where = {}
    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      where.employeeId = user.employeeId
    } else if (user?.role === 'DEPT_MANAGER' && user?.departmentId) {
      where.employee = { departmentId: user.departmentId }
    }

    const totalClaims = await prisma.expenseClaim.count({ where })
    const approvedClaims = await prisma.expenseClaim.count({ where: { ...where, status: { in: ['MANAGER_APPROVED', 'HR_APPROVED'] } } })
    const disbursedClaims = await prisma.expenseClaim.count({ where: { ...where, status: 'DISBURSED' } })

    const disbursedItems = await prisma.expenseClaim.findMany({
      where: { ...where, status: 'DISBURSED' },
      select: { netPayableAmount: true }
    })
    const totalDisbursedAmount = disbursedItems.reduce((sum, c) => sum + Number(c.netPayableAmount || 0), 0)

    return {
      totalClaims,
      approvedClaims,
      disbursedClaims,
      totalReimbursedAmount: Number(totalDisbursedAmount.toFixed(2)),
      currency: 'PKR'
    }
  }
}

export default new ReportService()
