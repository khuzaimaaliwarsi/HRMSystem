import {
  WORKFORCE_MEMBERS,
  MONTHLY_WORKFORCE_MOVEMENT,
  PENDING_APPROVALS,
  UPCOMING_MILESTONES,
  DEMO_TASKS,
  EMPLOYEE_PERSONAL_DATA
} from '../mocks/workforceData.js'
import { DEMO_DEPARTMENTS } from '../mocks/demoUsers.js'
import { employeeService } from './employeeService.js'
import { recruitmentService } from './recruitmentService.js'
import { attendanceService } from './attendanceService.js'
import { leaveService } from './leaveService.js'
import { taskService } from './taskService.js'
import { helpDeskService } from './helpDeskService.js'

const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)

export const dashboardService = {
  /**
   * Super Admin Company-Wide Metrics & Analytics
   */
  getSuperAdminData(filters = {}) {
    const { department = 'all', periodMonth = 'Oct', periodYear = '2026' } = filters

    // Single Canonical Source of truth from employeeService
    const canonicalStaff = employeeService?.getEmployees?.() || (isTest ? WORKFORCE_MEMBERS : [])

    // Filter workforce by department if selected
    let filteredStaff = canonicalStaff
    if (department && department !== 'all') {
      filteredStaff = filteredStaff.filter((m) => m.departmentId === department)
    }

    const totalStaff = filteredStaff.length
    // Active employment status vs Probation
    const permanentCount = filteredStaff.filter((m) => m.employmentType === 'Permanent').length
    const contractCount = filteredStaff.filter((m) => m.employmentType === 'Contract').length
    const probationStaff = filteredStaff.filter((m) => m.employmentType === 'Probation').length
    const activeStaff = permanentCount + contractCount + probationStaff

    // Daily attendance status breakdown for the active day
    const presentCount = filteredStaff.filter((m) => m.attendanceToday === 'Present').length
    const lateCount = filteredStaff.filter((m) => m.attendanceToday === 'Late').length
    const wfhCount = filteredStaff.filter((m) => m.attendanceToday === 'WFH').length
    const fieldDutyCount = filteredStaff.filter((m) => m.attendanceToday === 'Field Duty').length
    const absentCount = filteredStaff.filter((m) => m.attendanceToday === 'Absent').length
    const onLeaveStaff = filteredStaff.filter((m) => m.attendanceToday === 'On Leave').length

    // Reconciled effective working today = Present + Late + WFH + Field Duty
    const effectiveWorking = presentCount + lateCount + wfhCount + fieldDutyCount
    const scheduledWorkforce = totalStaff - onLeaveStaff
    const attendanceRate = scheduledWorkforce > 0
      ? Math.round((effectiveWorking / scheduledWorkforce) * 1000) / 10
      : 100

    // Gender breakdown
    const femaleCount = filteredStaff.filter((m) => m.gender === 'Female').length
    const maleCount = filteredStaff.filter((m) => m.gender === 'Male').length
    const femalePercent = totalStaff > 0 ? Math.round((femaleCount / totalStaff) * 1000) / 10 : 0
    const malePercent = totalStaff > 0 ? Math.round((maleCount / totalStaff) * 1000) / 10 : 0

    // Service Tenure distribution (days since join date)
    const under30Days = filteredStaff.filter((m) => m.tenureDays <= 30).length
    const under60Days = filteredStaff.filter((m) => m.tenureDays > 30 && m.tenureDays <= 60).length
    const under90Days = filteredStaff.filter((m) => m.tenureDays > 60 && m.tenureDays <= 90).length
    const over90Days = filteredStaff.filter((m) => m.tenureDays > 90).length

    // Department breakdown
    const departmentSummary = totalStaff > 0
      ? DEMO_DEPARTMENTS.map((dept) => {
          const deptMembers = filteredStaff.filter((m) => m.departmentId === dept.id)
          const count = deptMembers.length
          const working = deptMembers.filter((m) => ['Present', 'Late', 'WFH', 'Field Duty'].includes(m.attendanceToday)).length
          const onLeave = deptMembers.filter((m) => m.attendanceToday === 'On Leave').length
          return {
            id: dept.id,
            code: dept.code,
            name: dept.name,
            total: count,
            present: working,
            onLeave,
            rate: count > 0 ? Math.round((working / count) * 100) : 0
          }
        })
      : []

    // Handle Historical vs Future Year for Monthly Movement
    // If year 2027 is selected, return empty/projected movement because 2027 historical data is not yet recorded!
    let monthlyMovement = []
    let selectedMonthStats = null

    if (totalStaff > 0 && periodYear === '2026') {
      monthlyMovement = MONTHLY_WORKFORCE_MOVEMENT
      selectedMonthStats = MONTHLY_WORKFORCE_MOVEMENT.find((m) => m.month.toLowerCase() === periodMonth.toLowerCase()) || MONTHLY_WORKFORCE_MOVEMENT[9]
    }

    return {
      kpis: {
        totalEmployees: totalStaff,
        activeEmployees: activeStaff,
        permanentCount,
        contractCount,
        probationCount: probationStaff,
        presentToday: presentCount + lateCount, // In office
        lateToday: lateCount,
        absentToday: absentCount,
        fieldDutyToday: fieldDutyCount,
        wfhToday: wfhCount,
        onLeaveToday: onLeaveStaff,
        pendingApprovalsCount: totalStaff > 0 ? PENDING_APPROVALS.length : 0,
        openHelpdeskCount: totalStaff > 0 ? 4 : 0,
        avgTimeToFillDays: totalStaff > 0 ? 14 : 0,
        avgTimeToHireDays: totalStaff > 0 ? 27 : 0,
        attendanceRate: totalStaff > 0 ? attendanceRate : 0,
        scheduledWorkforce
      },
      headcountDistribution: {
        total: totalStaff,
        female: femaleCount,
        male: maleCount,
        femalePercent,
        malePercent
      },
      tenureAging: {
        under30: under30Days,
        under60: under60Days,
        under90: under90Days,
        over90: over90Days
      },
      monthlyMovement,
      selectedMonthStats,
      hasHistoricalMovementData: monthlyMovement.length > 0,
      departmentSummary,
      pendingApprovals: totalStaff > 0 ? PENDING_APPROVALS : [],
      recentActivity: filteredStaff,
      upcomingMilestones: totalStaff > 0 ? UPCOMING_MILESTONES : [],
      selectedMonth: periodMonth,
      selectedYear: periodYear,
      selectedDepartment: department
    }
  },

  /**
   * HR / Admin Operational Dashboard Data with period and search filters
   */
  getHrAdminData(filters = {}) {
    const { periodMonth = 'Oct', periodYear = '2026', department = 'all' } = filters

    const canonicalStaff = employeeService?.getEmployees?.() || (isTest ? WORKFORCE_MEMBERS : [])
    let staff = canonicalStaff
    if (department && department !== 'all') {
      staff = staff.filter((m) => m.departmentId === department)
    }

    const totalStaff = staff.length
    const presentToday = staff.filter((m) => ['Present', 'Late', 'WFH', 'Field Duty'].includes(m.attendanceToday)).length
    const lateToday = staff.filter((m) => m.attendanceToday === 'Late').length
    const absentToday = staff.filter((m) => m.attendanceToday === 'Absent').length
    const onLeaveToday = staff.filter((m) => m.attendanceToday === 'On Leave').length
    const probationMembers = staff.filter((m) => m.status === 'Probation')

    const pendingHrLeaves = totalStaff > 0 && leaveService?.getLeaveRequests
      ? (leaveService.getLeaveRequests({ status: 'Pending HR Review' }, { role: 'hr_admin' }) || []).length
      : 0

    // Recruitment pipeline stages (derived dynamically from live candidate stages)
    const allCandidates = recruitmentService?.getCandidates?.() || []
    const sourcedCount = allCandidates.filter((c) => !c.stage || c.stage === 'Applied' || c.stage === 'Screening').length
    const screeningCount = allCandidates.filter((c) => c.stage === 'Screening' || c.status === 'Screening').length
    const techCount = allCandidates.filter((c) => c.stage === 'Interview' || c.stage === 'Technical').length
    const finalInterviewCount = allCandidates.filter((c) => c.stage === 'Final Interview').length
    const offerCount = allCandidates.filter((c) => c.stage === 'Offered' || c.stage === 'Hired').length

    const recruitmentPipeline = allCandidates.length > 0
      ? [
          { stage: 'Sourced Candidates', count: sourcedCount, color: 'bg-blue-500' },
          { stage: 'Screening Call', count: screeningCount, color: 'bg-indigo-500' },
          { stage: 'Technical Evaluation', count: techCount, color: 'bg-purple-500' },
          { stage: 'Final Interview', count: finalInterviewCount, color: 'bg-teal-500' },
          { stage: 'Offer Extended', count: offerCount, color: 'bg-emerald-500' }
        ]
      : []

    const openTicketsCount = (helpDeskService?.getTickets?.() || []).filter(
      (t) => t.status !== 'Closed' && t.status !== 'Resolved'
    ).length

    return {
      kpis: {
        totalEmployees: totalStaff,
        presentToday,
        lateToday,
        absentToday,
        onLeaveToday,
        openVacancies: recruitmentService?.getVacancies ? (recruitmentService.getVacancies({ status: 'Open' }) || []).length : 0,
        probationCount: probationMembers.length,
        pendingHrLeaves,
        openTickets: openTicketsCount
      },
      probationMembers,
      recruitmentPipeline,
      escalatedApprovals: totalStaff > 0 ? PENDING_APPROVALS.filter((a) => a.tier.includes('HR') || a.tier.includes('Escalated')) : [],
      recentUpdates: staff,
      milestones: totalStaff > 0 ? UPCOMING_MILESTONES : [],
      selectedMonth: periodMonth,
      selectedYear: periodYear
    }
  },

  /**
   * Manager Team Scoped Data with status filtering
   */
  getManagerData(managerId = 'EMP-003', filters = {}) {
    const { taskStatus = 'all' } = filters

    // Derived directly from canonical employee hierarchy
    const teamMembers = employeeService?.getAuthorizedTeamEmployees?.(managerId, 'manager') || employeeService?.getDirectReports?.(managerId) || WORKFORCE_MEMBERS.filter((m) => m.managerId === managerId)
    const directReports = employeeService?.getDirectReports?.(managerId) || teamMembers.filter((m) => m.managerId === managerId)
    const teamCount = teamMembers.length
    const directReportsCount = directReports.length

    const presentCount = teamMembers.filter((m) => m.attendanceToday === 'Present').length
    const lateCount = teamMembers.filter((m) => m.attendanceToday === 'Late').length
    const wfhCount = teamMembers.filter((m) => m.attendanceToday === 'WFH').length
    const fieldDutyCount = teamMembers.filter((m) => m.attendanceToday === 'Field Duty').length
    const absentCount = teamMembers.filter((m) => m.attendanceToday === 'Absent').length
    const onLeaveCount = teamMembers.filter((m) => m.attendanceToday === 'On Leave').length

    // Manager approval limit invariant (Max 2 cumulative days/month)
    let teamApprovals = []
    if (teamCount > 0) {
      if (leaveService?.getLeaveRequests) {
        try {
          const rawLeaves = leaveService.getLeaveRequests({}, { role: 'manager', id: managerId, employeeId: managerId })
          teamApprovals = rawLeaves
            .filter((r) => ['Pending Manager Review', 'Pending Review', 'Pending Team Lead Review'].includes(r.status))
            .map((r) => ({
              id: r.id,
              applicantId: r.employeeId,
              applicantName: r.employeeName,
              status: r.status,
              details: `${r.leaveTypeName} (${r.startDate} to ${r.endDate}) - ${r.calculatedDays || 1} day(s)`,
              tier: 'Manager Scope',
              requestedDate: r.createdAt || r.startDate
            }))
        } catch {
          teamApprovals = []
        }
      } else {
        teamApprovals = PENDING_APPROVALS.filter(
          (a) => teamMembers.some((tm) => tm.id === a.applicantId)
        )
      }
    }

    // Team tasks
    let teamTasks = []
    if (teamCount > 0) {
      if (taskService?.getTasks) {
        try {
          const rawTasks = taskService.getTasks(
            { status: taskStatus !== 'all' ? taskStatus : undefined },
            { role: 'manager', id: managerId, employeeId: managerId }
          )
          teamTasks = rawTasks.map((t) => ({
            id: t.id,
            title: t.title,
            assigneeId: t.assignedToId,
            assigneeName: t.assignedToName || teamMembers.find((m) => m.id === t.assignedToId)?.name || 'Team Member',
            status: t.status,
            dueDate: t.dueDate,
            priority: t.priority
          }))
        } catch {
          teamTasks = []
        }
      } else {
        teamTasks = isTest
          ? DEMO_TASKS.filter((t) => teamMembers.some((tm) => tm.id === t.assigneeId))
          : []
        if (taskStatus && taskStatus !== 'all') {
          teamTasks = teamTasks.filter((t) => t.status.toLowerCase() === taskStatus.toLowerCase())
        }
      }
    }

    const managerProfile = employeeService?.getEmployeeById?.(managerId) || (isTest && teamCount > 0 ? WORKFORCE_MEMBERS.find((m) => m.id === managerId) : null) || { id: managerId, name: 'Authorized Manager', department: 'Management' }

    return {
      managerProfile,
      teamCount,
      teamMembers,
      directReports,
      kpis: {
        teamMembers: teamCount,
        directReportsCount,
        totalDepartmentStaff: teamCount,
        presentToday: presentCount + lateCount + wfhCount + fieldDutyCount,
        lateToday: lateCount,
        absentToday: absentCount,
        onLeaveToday: onLeaveCount,
        fieldDutyToday: fieldDutyCount,
        pendingApprovalsCount: teamApprovals.length,
        tasksInProgress: teamTasks.filter((t) => t.status === 'In Progress').length,
        overdueTasks: teamTasks.filter((t) => t.status === 'Overdue').length,
        monthlyLeaveCap: '2 Days / Month'
      },
      teamTasks,
      teamApprovals,
      clientVisits: teamMembers.filter((m) => m.attendanceToday === 'Field Duty')
    }
  },

  /**
   * Team Lead Scoped Data (strictly assigned team only)
   */
  getTeamLeadData(teamLeadId = 'EMP-005', filters = {}) {
    const { taskStatus = 'all' } = filters
    const teamMembers = employeeService?.getAuthorizedTeamEmployees?.(teamLeadId, 'team_lead') || []
    const teamCount = teamMembers.length

    const presentCount = teamMembers.filter((m) => m.attendanceToday === 'Present').length
    const lateCount = teamMembers.filter((m) => m.attendanceToday === 'Late').length
    const wfhCount = teamMembers.filter((m) => m.attendanceToday === 'WFH').length
    const fieldDutyCount = teamMembers.filter((m) => m.attendanceToday === 'Field Duty').length
    const absentCount = teamMembers.filter((m) => m.attendanceToday === 'Absent').length
    const onLeaveCount = teamMembers.filter((m) => m.attendanceToday === 'On Leave').length

    let teamApprovals = []
    if (teamCount > 0) {
      if (leaveService?.getLeaveRequests) {
        try {
          const rawLeaves = leaveService.getLeaveRequests({}, { role: 'team_lead', id: teamLeadId, employeeId: teamLeadId })
          teamApprovals = rawLeaves
            .filter((r) => ['Pending Team Lead Review', 'Pending Review'].includes(r.status))
            .map((r) => ({
              id: r.id,
              applicantId: r.employeeId,
              applicantName: r.employeeName,
              status: r.status,
              details: `${r.leaveTypeName} (${r.startDate} to ${r.endDate}) - ${r.calculatedDays || 1} day(s)`,
              tier: 'Team Lead Scope',
              requestedDate: r.createdAt || r.startDate
            }))
        } catch {
          teamApprovals = []
        }
      } else {
        teamApprovals = PENDING_APPROVALS.filter(
          (a) => teamMembers.some((tm) => tm.id === a.applicantId)
        )
      }
    }

    let teamTasks = []
    if (teamCount > 0) {
      if (taskService?.getTasks) {
        try {
          const rawTasks = taskService.getTasks(
            { status: taskStatus !== 'all' ? taskStatus : undefined },
            { role: 'team_lead', id: teamLeadId, employeeId: teamLeadId }
          )
          teamTasks = rawTasks.map((t) => ({
            id: t.id,
            title: t.title,
            assigneeId: t.assignedToId,
            assigneeName: t.assignedToName || teamMembers.find((m) => m.id === t.assignedToId)?.name || 'Team Member',
            status: t.status,
            dueDate: t.dueDate,
            priority: t.priority
          }))
        } catch {
          teamTasks = []
        }
      } else {
        teamTasks = isTest
          ? DEMO_TASKS.filter((t) => teamMembers.some((tm) => tm.id === t.assigneeId))
          : []
        if (taskStatus && taskStatus !== 'all') {
          teamTasks = teamTasks.filter((t) => t.status.toLowerCase() === taskStatus.toLowerCase())
        }
      }
    }

    const leadProfile = employeeService?.getEmployeeById?.(teamLeadId) || (isTest && teamCount > 0 ? WORKFORCE_MEMBERS.find((m) => m.id === teamLeadId) : null) || { id: teamLeadId, name: 'Assigned Lead', teamName: 'Assigned Team' }

    return {
      leadProfile,
      managerProfile: leadProfile,
      teamCount,
      teamMembers,
      directReports: teamMembers,
      kpis: {
        teamMembers: teamCount,
        directReportsCount: teamCount,
        totalDepartmentStaff: teamCount,
        presentToday: presentCount + lateCount + wfhCount + fieldDutyCount,
        lateToday: lateCount,
        absentToday: absentCount,
        onLeaveToday: onLeaveCount,
        fieldDutyToday: fieldDutyCount,
        pendingApprovalsCount: teamApprovals.length,
        tasksInProgress: teamTasks.filter((t) => t.status === 'In Progress').length,
        overdueTasks: teamTasks.filter((t) => t.status === 'Overdue').length,
        monthlyLeaveCap: '2 Days / Month'
      },
      teamTasks,
      teamApprovals,
      clientVisits: teamMembers.filter((m) => m.attendanceToday === 'Field Duty')
    }
  },

  /**
   * Employee Personal Data (e.g. Zeeshan Ali / EMP-004)
   */
  getEmployeeData(employeeId = 'EMP-004') {
    const allEmps = employeeService?.getEmployees?.() || []
    const isWiped = allEmps.length === 0
    const liveProfile = employeeService?.getEmployeeById?.(employeeId)

    if (!isTest || isWiped || (!liveProfile && employeeId !== 'EMP-004')) {
      return {
        profile: liveProfile || {
          id: employeeId || 'Unlinked',
          name: 'Employee Profile Not Linked',
          department: 'Unassigned',
          designation: 'Staff'
        },
        todayPunch: {
          status: 'Not Recorded',
          time: '--:--',
          hoursWorkedToday: '0 hrs',
          shift: 'Standard Shift',
          location: 'On Site'
        },
        leaveBalances: {
          annualRemaining: 0,
          casualRemaining: 0,
          sickRemaining: 0,
          pendingRequests: 0
        },
        recentRequests: [],
        activeTasks: [],
        upcomingHolidays: [],
        kpis: {
          attendanceToday: 'Not Recorded',
          checkInTime: '--:--',
          hoursToday: '0 hrs',
          remainingLeavesTotal: 0,
          pendingRequestsCount: 0,
          activeTasksCount: 0,
          openTicketsCount: 0
        }
      }
    }

    const personal = EMPLOYEE_PERSONAL_DATA
    const profile = liveProfile || WORKFORCE_MEMBERS.find((m) => m.id === employeeId) || personal

    const liveRecord = attendanceService?.getEmployeeTodayRecord?.(employeeId)
    const todayPunch = liveRecord ? {
      status: liveRecord.status || 'Present',
      time: liveRecord.checkInTime || personal.todayPunch.time,
      hoursWorkedToday: `${liveRecord.workedHours || 0} hrs`,
      shift: liveRecord.shiftName || personal.todayPunch.shift,
      location: liveRecord.workArrangement || personal.todayPunch.location
    } : personal.todayPunch

    const liveRequests = leaveService?.getLeaveRequests
      ? leaveService.getLeaveRequests({ employeeId }, { role: 'employee', employeeId })
      : []

    return {
      profile,
      todayPunch,
      leaveBalances: personal.leaveBalances,
      recentRequests: (liveRequests || []).length > 0 ? liveRequests : (personal.recentRequests || []),
      activeTasks: personal.activeTasks,
      upcomingHolidays: personal.upcomingHolidays,
      kpis: {
        attendanceToday: todayPunch.status,
        checkInTime: todayPunch.time,
        hoursToday: todayPunch.hoursWorkedToday,
        remainingLeavesTotal: personal.leaveBalances.annualRemaining + personal.leaveBalances.casualRemaining + personal.leaveBalances.sickRemaining,
        pendingRequestsCount: personal.leaveBalances.pendingRequests,
        activeTasksCount: (personal?.activeTasks || []).length,
        openTicketsCount: 1
      }
    }
  }
}

export default dashboardService
