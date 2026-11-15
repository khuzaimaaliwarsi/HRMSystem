import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dashboardService } from '../services/dashboardService.js'

test('Super Admin: Total workforce count matches canonical workforce data (exact values)', () => {
  const data = dashboardService.getSuperAdminData()
  assert.equal(data.kpis.totalEmployees, 14)
  assert.equal(data.kpis.permanentCount, 11)
  assert.equal(data.kpis.contractCount, 1)
  assert.equal(data.kpis.probationCount, 2)
  assert.equal(data.kpis.activeEmployees, 14)
})

test('Super Admin: Daily attendance reconciliation (exact counts)', () => {
  const data = dashboardService.getSuperAdminData()
  const { presentToday, lateToday, wfhToday, fieldDutyToday, absentToday, onLeaveToday } = data.kpis
  // Present: 8 in office on-time + 1 late = 9 in office
  assert.equal(presentToday, 9)
  assert.equal(lateToday, 1)
  assert.equal(wfhToday, 1)
  assert.equal(fieldDutyToday, 2)
  assert.equal(absentToday, 1)
  assert.equal(onLeaveToday, 1)

  // Reconciled total working today = in-office (9) + WFH (1) + field duty (2) = 12
  const totalWorking = presentToday + wfhToday + fieldDutyToday
  assert.equal(totalWorking, 12)

  // Scheduled workforce denominator = Total Staff (14) - On Leave (1) = 13
  assert.equal(data.kpis.scheduledWorkforce, 13)

  // Attendance rate = (12 / 13) * 100 = 92.3076... -> 92.3%
  assert.equal(data.kpis.attendanceRate, 92.3)
})

test('Super Admin: Gender breakdown reconciles to total headcount (exact values)', () => {
  const data = dashboardService.getSuperAdminData()
  const { total, female, male, femalePercent, malePercent } = data.headcountDistribution
  assert.equal(female, 5)
  assert.equal(male, 9)
  assert.equal(total, 14)
  assert.equal(femalePercent, 35.7)
  assert.equal(malePercent, 64.3)
})

test('Super Admin: Tenure aging cohorts reconcile to total headcount (exact values)', () => {
  const data = dashboardService.getSuperAdminData()
  const { under30, under60, under90, over90 } = data.tenureAging
  assert.ok(under30 >= 0)
  assert.ok(under60 >= 0)
  assert.ok(under90 >= 0)
  assert.ok(over90 >= 0)
  assert.equal(under30 + under60 + under90 + over90, 14)
})

test('Super Admin: Department filter recalculates headcount & metrics dynamically', () => {
  // Filter by Development (DEP-01)
  const devData = dashboardService.getSuperAdminData({ department: 'DEP-01' })
  assert.equal(devData.kpis.totalEmployees, 4)
  assert.equal(devData.recentActivity.length, 4)
  assert.ok(devData.recentActivity.every((m) => m.departmentId === 'DEP-01'))

  // Filter by Sales & Business (DEP-02)
  const salesData = dashboardService.getSuperAdminData({ department: 'DEP-02' })
  assert.equal(salesData.kpis.totalEmployees, 3)
  assert.ok(salesData.recentActivity.every((m) => m.departmentId === 'DEP-02'))
})

test('Super Admin: Year 2026 has 12 monthly movements, Year 2027 returns empty/unrecorded', () => {
  const data2026 = dashboardService.getSuperAdminData({ periodYear: '2026' })
  assert.equal(data2026.monthlyMovement.length, 12)
  assert.equal(data2026.hasHistoricalMovementData, true)

  const data2027 = dashboardService.getSuperAdminData({ periodYear: '2027' })
  assert.equal(data2027.monthlyMovement.length, 0)
  assert.equal(data2027.hasHistoricalMovementData, false)
})

test('HR Admin: Operational metrics and probation milestone filtering', () => {
  const hrData = dashboardService.getHrAdminData()
  assert.equal(hrData.kpis.totalEmployees, 14)
  assert.equal(hrData.kpis.probationCount, 2)
  assert.equal(hrData.kpis.openVacancies, 3)
  assert.equal(hrData.probationMembers.length, 2)
  assert.equal(hrData.escalatedApprovals.length, 2)
})

test('Manager: Bilal Siddiqui EMP-003 only sees his 3 assigned direct reports', () => {
  const managerData = dashboardService.getManagerData('EMP-003')
  assert.equal(managerData.teamMembers.length, 3)
  const reportIds = managerData.teamMembers.map((m) => m.id)
  assert.deepEqual(reportIds.sort(), ['EMP-004', 'EMP-005', 'EMP-006'].sort())

  // Tasks filtering
  const allTasks = dashboardService.getManagerData('EMP-003', { taskStatus: 'all' })
  assert.equal(allTasks.teamTasks.length, 2)

  const inProgressTasks = dashboardService.getManagerData('EMP-003', { taskStatus: 'in progress' })
  assert.equal(inProgressTasks.teamTasks.length, 2)

  const overdueTasks = dashboardService.getManagerData('EMP-003', { taskStatus: 'overdue' })
  assert.equal(overdueTasks.teamTasks.length, 0)
})

test('Employee: Zeeshan Ali EMP-004 personal data and exact leave balance ledger', () => {
  const empData = dashboardService.getEmployeeData('EMP-004')
  assert.equal(empData.profile.id, 'EMP-004')
  assert.equal(empData.profile.name, 'Zeeshan Ali')
  assert.equal(empData.leaveBalances.annualTotal, 14)
  assert.equal(empData.leaveBalances.annualRemaining, 8)
  assert.equal(empData.leaveBalances.casualTotal, 10)
  assert.equal(empData.leaveBalances.casualRemaining, 6)
  assert.equal(empData.leaveBalances.sickTotal, 8)
  assert.equal(empData.leaveBalances.sickRemaining, 6)
  assert.equal(empData.kpis.remainingLeavesTotal, 20)
  assert.equal(empData.todayPunch.status, 'Checked In')
  assert.equal(empData.todayPunch.time, '08:45 AM')
})

test('Manager Scope: New manager with no direct reports has exactly 0 roster members, 0 tasks, 0 approvals', () => {
  const newMgrData = dashboardService.getManagerData('EMP-NON-EXISTENT-MGR')
  assert.equal(newMgrData.teamMembers.length, 0)
  assert.equal(newMgrData.kpis.teamMembers, 0)
  assert.equal(newMgrData.kpis.presentToday, 0)
  assert.equal(newMgrData.teamTasks.length, 0)
  assert.equal(newMgrData.teamApprovals.length, 0)
})

test('Manager Scope: Cross-department isolation guarantees EMP-001 and EMP-002 never leak into manager team roster', () => {
  const mgrData = dashboardService.getManagerData('EMP-003')
  const teamMemberIds = mgrData.teamMembers.map((m) => m.id)
  assert.equal(teamMemberIds.includes('EMP-001'), false, 'EMP-001 Super Admin must not leak into manager roster')
  assert.equal(teamMemberIds.includes('EMP-002'), false, 'EMP-002 HR Admin must not leak into manager roster')
})

test('Manager Scope: Roster counts reconcile exactly with scoped team dataset', () => {
  const mgrData = dashboardService.getManagerData('EMP-003')
  assert.equal(mgrData.kpis.teamMembers, mgrData.teamMembers.length)
  const calculatedPresent = mgrData.teamMembers.filter((m) => ['Present', 'Late', 'WFH', 'Field Duty'].includes(m.attendanceToday)).length
  assert.equal(mgrData.kpis.presentToday, calculatedPresent)
})
