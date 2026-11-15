/**
 * iSysware HRMS — Real Client-Side CSV Export Utility for Dashboard Summaries
 * Generates an actual downloadable CSV file respecting active filters and role scope.
 * Complies with formula injection sanitation and UTF-8 encoding.
 */

function sanitizeCSVCell(value) {
  if (value === null || value === undefined) return '""'
  let str = String(value)
  // Prevent CSV formula injection if string starts with dangerous characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  // Escape internal double quotes
  str = str.replace(/"/g, '""')
  return `"${str}"`
}

export function downloadCSV(filename, rows) {
  if (!rows || rows.length === 0) return false

  const csvContent = rows
    .map((row) => row.map(sanitizeCSVCell).join(','))
    .join('\r\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return true
}

export function exportDashboardSummaryToCSV(roleLabel, filters, data) {
  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `iSysware_HRMS_Dashboard_${roleLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${filters.periodYear || '2026'}_${filters.periodMonth || 'Oct'}_${timestamp}.csv`

  const rows = [
    ['iSysware HRMS — Executive Workforce Dashboard Summary'],
    ['Generated On', new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }), 'Timezone', 'Asia/Karachi (PKT)'],
    ['Authorized Scope', roleLabel, 'Active Period', `${filters.periodMonth || 'Oct'} ${filters.periodYear || '2026'}`],
    ['Department Filter', filters.department || 'All Departments'],
    [],
    ['KEY PERFORMANCE INDICATORS (RECONCILED CURRENT WORKFORCE)'],
    ['Metric', 'Value', 'Classification / Notes'],
    ['Total Headcount', data.kpis.totalEmployees, 'Active canonical personnel in scope'],
    ['Active Permanent Staff', data.kpis.activeEmployees, 'Permanent & probation contracts'],
    ['Present on Shift Today', data.kpis.presentToday, 'Office, field duty, and approved WFH'],
    ['Late Occurrences Today', data.kpis.lateToday, 'Arrivals within grace or exception threshold'],
    ['Absent Today', data.kpis.absentToday, 'Unscheduled absences without leave'],
    ['On Approved Leave Today', data.kpis.onLeaveToday, 'Reconciled from Leave Ledger'],
    ['Workforce Attendance Rate', `${data.kpis.attendanceRate}%`, 'Formula: Present / (Total Staff - On Leave) * 100'],
    ['Pending Governance Approvals', data.kpis.pendingApprovalsCount, 'Awaiting review under authority tiers'],
    [],
    ['GENDER DISTRIBUTION SUMMARY'],
    ['Gender', 'Count', 'Percentage'],
    ['Female', data.headcountDistribution?.female || 0, `${data.headcountDistribution?.femalePercent || 0}%`],
    ['Male', data.headcountDistribution?.male || 0, `${data.headcountDistribution?.malePercent || 0}%`],
    ['Total', data.headcountDistribution?.total || 0, '100%'],
    [],
    ['SERVICE TENURE AGING (COHORTS)'],
    ['Milestone Cohort', 'Count', 'Status'],
    ['< 30 Days', data.tenureAging?.under30 || 0, 'New Joiners'],
    ['< 60 Days', data.tenureAging?.under60 || 0, 'Probation Stage 1'],
    ['< 90 Days', data.tenureAging?.under90 || 0, 'Probation Stage 2'],
    ['> 90 Days', data.tenureAging?.over90 || 0, 'Confirmed / Retained Staff'],
    [],
    ['FILTERED EMPLOYEE ROSTER SNAPSHOT'],
    ['Employee ID', 'Full Name', 'Email', 'Department', 'Designation', 'Contract Type', 'Today Status']
  ]

  if (data.recentActivity && data.recentActivity.length > 0) {
    data.recentActivity.forEach((emp) => {
      rows.push([
        emp.id,
        emp.name,
        emp.email,
        emp.department,
        emp.designation,
        emp.employmentType,
        emp.attendanceToday
      ])
    })
  }

  return { success: downloadCSV(filename, rows), filename }
}

export function exportManagerTeamRosterToCSV(managerData) {
  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `iSysware_HRMS_Development_Team_Roster_${timestamp}.csv`
  const rows = [
    ['iSysware HRMS — Engineering Team Roster (Manager Scoped)'],
    ['Manager', 'Bilal Siddiqui (EMP-003)', 'Department', 'Development'],
    ['Export Date', new Date().toLocaleString()],
    [],
    ['DIRECT REPORTS ROSTER'],
    ['Employee ID', 'Full Name', 'Designation', 'Location', 'Attendance Today', 'Shift'],
    ...managerData.teamMembers.map((m) => [
      m.id,
      m.name,
      m.designation,
      m.workLocation,
      m.attendanceToday,
      m.shift
    ]),
    [],
    ['SPRINT TASKS & DELIVERABLES'],
    ['Task ID', 'Title', 'Assignee', 'Priority', 'Due Date', 'Status'],
    ...managerData.teamTasks.map((t) => [
      t.id,
      t.title,
      t.assigneeName,
      t.priority,
      t.dueDate,
      t.status
    ])
  ]

  return { success: downloadCSV(filename, rows), filename }
}

export function exportEmployeeStatementToCSV(profile, empData) {
  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `iSysware_HRMS_Personal_Statement_${profile.id}_${timestamp}.csv`
  const { todayPunch, leaveBalances, recentRequests, kpis } = empData

  const rows = [
    ['iSysware HRMS — Employee Self-Service Statement'],
    ['Employee Name', profile.name, 'Employee ID', profile.id],
    ['Designation', profile.designation, 'Department', profile.department],
    ['Reporting Manager', profile.managerName, 'Shift', profile.shift],
    ['Generated Date', new Date().toLocaleString()],
    [],
    ['TODAY ATTENDANCE RECORD'],
    ['Status', todayPunch.status, 'Check In', todayPunch.time, 'Hours Logged', todayPunch.hoursWorkedToday],
    [],
    ['LEAVE BALANCES ENTITLEMENT LEDGER'],
    ['Leave Category', 'Entitled', 'Consumed', 'Remaining Days'],
    ['Annual Leave', leaveBalances.annualTotal, leaveBalances.annualUsed, leaveBalances.annualRemaining],
    ['Casual Leave', leaveBalances.casualTotal, leaveBalances.casualUsed, leaveBalances.casualRemaining],
    ['Sick Leave', leaveBalances.sickTotal, leaveBalances.sickUsed, leaveBalances.sickRemaining],
    ['Total Available Days', '', '', kpis.remainingLeavesTotal],
    [],
    ['RECENT REQUESTS LOG'],
    ['Request ID', 'Type', 'Date', 'Approver', 'Current Status'],
    ...recentRequests.map((r) => [r.id, r.type, r.date, r.approver, r.status])
  ]

  return { success: downloadCSV(filename, rows), filename }
}

export default exportDashboardSummaryToCSV
