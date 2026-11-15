import test from 'node:test'
import assert from 'node:assert/strict'
import { employeeService } from '../services/employeeService.js'
import { dashboardService } from '../services/dashboardService.js'
import { attendanceService } from '../services/attendanceService.js'
import { leaveService } from '../services/leaveService.js'
import { reportService } from '../services/reportService.js'
import { authService } from '../services/authService.js'
import { PORTAL_CONFIG } from '../config/navigation.js'

test('Aliyan_HRMS — Team Lead Portal & Modules Stability Suite', async (t) => {
  // Test 1: Team Lead Portal Navigation Registry
  await t.test('1. PORTAL_CONFIG.team_lead has exactly 7 core operational modules', () => {
    const tl = PORTAL_CONFIG.team_lead
    assert.ok(tl, 'team_lead config must exist')
    const items = tl.menuGroups.flatMap((g) => g.items)
    assert.equal(items.length, 7, 'Team Lead portal must display exactly 7 core operational modules')

    const keys = items.map((i) => i.key)
    assert.ok(keys.includes('dashboard'))
    assert.ok(keys.includes('team'))
    assert.ok(keys.includes('attendance'))
    assert.ok(keys.includes('leaves'))
    assert.ok(keys.includes('tasks'))
    assert.ok(keys.includes('performance'))
    assert.ok(keys.includes('reports'))
    assert.ok(!keys.includes('settings'), 'Team Lead must not have company Administration & Settings')
  })

  // Test 2: Startup Stability — Co-leadership assignment without crash or conflict
  await t.test('2. Multi-lead co-leadership is permitted and assignTeamLeadOrManager succeeds for co-leads', () => {
    // Both Ali Raza and Bilal Ahmed can be active co-leads on TEAM-01
    const bilalAssignmentId = employeeService.assignTeamLeadOrManager(
      {
        teamId: 'TEAM-01',
        employeeId: 'EMP-006',
        role: 'team_lead',
        effectiveDate: '2026-11-01',
        notes: 'Co-Team Lead assignment for Frontend Team'
      },
      'Super Admin'
    )
    assert.ok(bilalAssignmentId, 'Assignment must succeed without throwing duplicate conflict')

    const activeLeads = employeeService.getTeamAssignments().filter(
      (a) => a.teamId === 'TEAM-01' && a.role === 'team_lead' && a.status === 'Active'
    )
    assert.ok(activeLeads.length >= 2, 'Both Team Leads remain active co-leads on TEAM-01')
    assert.ok(activeLeads.some((a) => a.employeeId === 'EMP-006'), 'Bilal Ahmed active on TEAM-01')
  })

  // Test 3: Reporting Scope Isolation
  await t.test('3. Canonical direct reporting hierarchy isolates lead without reports from lead with reports', () => {
    // EMP-006 has 0 direct reports
    const bilalDirectReports = employeeService.getAuthorizedTeamEmployees('EMP-006', 'team_lead')
    assert.ok(Array.isArray(bilalDirectReports), 'Must return an array')
    assert.equal(bilalDirectReports.length, 0, 'Bilal Ahmed has 0 direct reports')

    // Manager EMP-003 or Lead EMP-005 has direct reports
    const leadReports = employeeService.getAuthorizedTeamEmployees('EMP-005', 'team_lead')
    assert.ok(Array.isArray(leadReports), 'Must return an array')
  })

  // Test 4: Dashboard Data Safety
  await t.test('4. dashboardService.getTeamLeadData returns complete guarded data with 0 direct reports without undefined length', () => {
    const bilalDashboard = dashboardService.getTeamLeadData('EMP-006')
    assert.ok(bilalDashboard, 'Dashboard data must exist')
    assert.equal(bilalDashboard.kpis.directReportsCount, 0, 'Bilal directReportsCount must be 0')
    assert.equal(bilalDashboard.kpis.presentToday, 0, 'Bilal presentToday must be 0')
    assert.ok(Array.isArray(bilalDashboard.teamMembers), 'teamMembers must be an array')
    assert.equal(bilalDashboard.teamMembers.length, 0, 'teamMembers array must be empty')
    assert.ok(Array.isArray(bilalDashboard.teamTasks), 'teamTasks must be an array')
    assert.ok(Array.isArray(bilalDashboard.teamApprovals), 'teamApprovals must be an array')
  })

  // Test 5: Operational Reports Authorization for team_lead
  await t.test('5. reportService authorizes team_lead for attendance and leave operational reports', () => {
    const tlActor = { name: 'Bilal Ahmed', role: 'team_lead', employeeId: 'EMP-006', departmentId: 'DEP-01' }

    // Attendance register report
    const attReport = reportService.generateReport('RPT-ATT-001', {}, tlActor)
    assert.ok(attReport, 'Team Lead can generate RPT-ATT-001 Daily Attendance Register')
    assert.ok(Array.isArray(attReport.rows), 'Report rows must be an array')

    // Leave utilization report
    const levReport = reportService.generateReport('RPT-LEV-001', {}, tlActor)
    assert.ok(levReport, 'Team Lead can generate RPT-LEV-001 Leave Summary')
    assert.ok(Array.isArray(levReport.rows), 'Report rows must be an array')
  })

  // Test 6: Attendance & Leave Safe Queries for Lead with 0 Reports
  await t.test('6. attendanceService & leaveService queries return safe arrays for lead with 0 reports', () => {
    const tlActor = { name: 'Bilal Ahmed', role: 'team_lead', employeeId: 'EMP-006' }
    const attRecords = attendanceService.getAttendanceRecords({}, tlActor)
    assert.ok(Array.isArray(attRecords), 'Attendance records must be an array')

    const leaveRequests = leaveService.getLeaveRequests({}, tlActor)
    assert.ok(Array.isArray(leaveRequests), 'Leave requests must be an array')
  })
})
