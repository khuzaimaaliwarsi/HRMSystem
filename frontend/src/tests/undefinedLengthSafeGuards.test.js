import { describe, it } from 'node:test'
import assert from 'node:assert'
import { attendanceService } from '../services/attendanceService.js'
import { leaveService } from '../services/leaveService.js'
import { dashboardService } from '../services/dashboardService.js'
import { reportService } from '../services/reportService.js'

describe('Aliyan_HRMS — Safe Length Fallbacks & Null-Safety Guard Verification', () => {
  it('1. attendanceService getWfhRequests & getFieldDutyRequests safely handle missing filters', () => {
    const user = { employeeId: 'EMP-005', role: 'employee' }
    const wfh = attendanceService.getWfhRequests({}, user)
    const fieldDuty = attendanceService.getFieldDutyRequests({}, user)
    const overtime = attendanceService.getOvertimeRequests({}, user)

    assert.ok(Array.isArray(wfh), 'WFH requests must be an array')
    assert.ok(Array.isArray(fieldDuty), 'Field Duty requests must be an array')
    assert.ok(Array.isArray(overtime), 'Overtime requests must be an array')

    // Filter simulation
    const approvedWfh = (wfh || []).filter(w => w?.status === 'Approved')
    assert.doesNotThrow(() => {
      const len = approvedWfh.length
      assert.strictEqual(typeof len, 'number')
    })
  })

  it('2. leaveService getLeaveRequests returns safe iterable array for employee with 0 leaves', () => {
    const user = { employeeId: 'EMP-999', role: 'employee' }
    const requests = leaveService.getLeaveRequests({}, user)
    assert.ok(Array.isArray(requests))

    // Assert safe operations that previously risked undefined .length
    const pendingCount = (requests || []).filter(r => r?.status && r.status.toLowerCase().includes('pending'))?.length || 0
    const upcomingLeaves = (requests || []).filter(r => r?.status === 'Approved')
    assert.strictEqual(typeof pendingCount, 'number')
    assert.strictEqual(typeof upcomingLeaves.length, 'number')
  })

  it('3. dashboardService getEmployeeData returns fully structured fallbacks for clean employee', () => {
    const data = dashboardService.getEmployeeData('EMP-005')
    assert.ok(data, 'Employee data exists')
    assert.ok(Array.isArray(data.activeTasks))
    assert.ok(Array.isArray(data.recentRequests))
    assert.ok(Array.isArray(data.upcomingHolidays))

    // Safe filtered requests check
    const filteredRequests = (data.recentRequests || []).filter(r => r?.status?.toLowerCase().includes('pending'))
    assert.doesNotThrow(() => {
      const isZero = (filteredRequests || []).length === 0
      assert.strictEqual(typeof isZero, 'boolean')
    })
  })

  it('4. dashboardService getTeamLeadData safely returns teamTasks and teamApprovals arrays', () => {
    const leadData = dashboardService.getTeamLeadData('EMP-006')
    assert.ok(Array.isArray(leadData.teamTasks))
    assert.ok(Array.isArray(leadData.teamApprovals))
    assert.strictEqual(typeof (leadData.teamTasks || []).length, 'number')
    assert.strictEqual(typeof (leadData.teamApprovals || []).length, 'number')
  })

  it('5. reportService generateReport does not throw on metadata or allowedRoles length check', () => {
    const reports = reportService.getReports()
    const report = reports[0]
    const res = reportService.generateReport(report.id, {
      role: 'super_admin',
      employeeId: 'EMP-001'
    })
    assert.ok(res)
    assert.ok(Array.isArray(res.rows))
  })
})
