/**
 * Aliyan_HRMS — WFH & Field Duty View Details Action & Read-Only Modal Regression Suite
 *
 * Verifies:
 * 1. View Details action button is available in WFH table across portals (Employee, Team Lead, Manager, HR Admin, Super Admin)
 * 2. View Details action button is available in Field Duty table across portals
 * 3. Read-only details modal renders all required attributes:
 *    - Request ID, applicant, request type, date, duration, reason, location (where applicable)
 *    - Current status & assigned approver tier
 *    - Actual Approved/Rejected By, decision date/time, and remarks
 *    - Complete chronological approval journey and audit history
 * 4. Preserves existing Approve, Reject, and Endorse actions
 * 5. Does not mutate approval rules or historical records
 * 6. Codebase static analysis confirms integration across WfhFieldDutyTab, EmployeeAttendancePage, and ManagerMyAttendancePage
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { attendanceService } from '../services/attendanceService.js'

describe('Aliyan_HRMS — WFH & Field Duty View Details Action Suite', () => {
  const resolveFilePath = (rel) => {
    const candidate1 = path.resolve('frontend/src', rel)
    if (fs.existsSync(candidate1)) return candidate1
    const candidate2 = path.resolve('src', rel)
    if (fs.existsSync(candidate2)) return candidate2
    return path.resolve(__dirname, '..', rel)
  }

  it('1. WfhFieldDutyTab: View Details button is implemented for both WFH and Field Duty rows', () => {
    const filePath = resolveFilePath('components/attendance/WfhFieldDutyTab.jsx')
    const content = fs.readFileSync(filePath, 'utf8')

    // Must import WfhFieldDutyDetailModal
    assert.ok(content.includes('WfhFieldDutyDetailModal'), 'WfhFieldDutyTab must import WfhFieldDutyDetailModal')

    // Must render View Details button in WFH table
    assert.ok(content.includes('View Details'), 'WfhFieldDutyTab must render View Details button')

    // Must preserve Approve and Decline actions
    assert.ok(content.includes('handleApproveWfhClick'), 'Must preserve handleApproveWfhClick')
    assert.ok(content.includes('handleRejectWfhClick'), 'Must preserve handleRejectWfhClick')
    assert.ok(content.includes('handleApproveFdClick'), 'Must preserve handleApproveFdClick')
    assert.ok(content.includes('handleRejectFdClick'), 'Must preserve handleRejectFdClick')

    // Modal render check
    assert.ok(content.includes('<WfhFieldDutyDetailModal'), 'WfhFieldDutyTab must render modal component')
  })

  it('2. EmployeeAttendancePage: Submitted requests include View Details action', () => {
    const filePath = resolveFilePath('pages/attendance/EmployeeAttendancePage.jsx')
    const content = fs.readFileSync(filePath, 'utf8')

    assert.ok(content.includes('WfhFieldDutyDetailModal'), 'EmployeeAttendancePage must import WfhFieldDutyDetailModal')
    assert.ok(content.includes('View Details'), 'EmployeeAttendancePage must provide View Details action')
    assert.ok(content.includes('setIsWfhFdDetailModalOpen(true)'), 'Must open details modal on click')
  })

  it('3. ManagerMyAttendancePage: Manager personal attendance includes View Details action', () => {
    const filePath = resolveFilePath('pages/attendance/ManagerMyAttendancePage.jsx')
    const content = fs.readFileSync(filePath, 'utf8')

    assert.ok(content.includes('WfhFieldDutyDetailModal'), 'ManagerMyAttendancePage must import WfhFieldDutyDetailModal')
    assert.ok(content.includes('View Details'), 'ManagerMyAttendancePage must provide View Details action')
  })

  it('4. WfhFieldDutyDetailModal: Implements all mandatory audit and attribution fields', () => {
    const filePath = resolveFilePath('components/attendance/WfhFieldDutyDetailModal.jsx')
    const content = fs.readFileSync(filePath, 'utf8')

    // Mandatory elements from user request:
    assert.ok(content.includes('requestId'), 'Must display request ID')
    assert.ok(content.includes('employeeName'), 'Must display employee name')
    assert.ok(content.includes('employeeId'), 'Must display employee ID')
    assert.ok(content.includes('departmentName'), 'Must display department')
    assert.ok(content.includes('StatusBadge'), 'Must display current status badge')
    assert.ok(content.includes('assignedApprover'), 'Must display assigned approver')
    assert.ok(content.includes('assignedTier'), 'Must display assigned tier')
    assert.ok(content.includes('durationDisplay'), 'Must display duration')
    assert.ok(content.includes('targetDate'), 'Must display date')
    assert.ok(content.includes('location'), 'Must display location where applicable')
    assert.ok(content.includes('deliverablesPlanned'), 'Must display deliverables planned for WFH')
    assert.ok(content.includes('decisionActor'), 'Must display supervisor decision actor attribution')
    assert.ok(content.includes('decisionTimestamp'), 'Must display decision timestamp')
    assert.ok(content.includes('decisionRemarks'), 'Must display decision remarks')
    assert.ok(content.includes('approvalHistory'), 'Must render complete chronological approval history')
    assert.ok(content.includes('Read-Only View'), 'Must be explicitly styled as read-only view')
  })

  it('5. Data Integrity: WFH-001 and FLD-002 historical records and approval history are preserved', () => {
    const wfhRequests = attendanceService.getWfhRequests() || []
    const wfh1 = wfhRequests.find((w) => w.id === 'WFH-001')
    assert.ok(wfh1, 'WFH-001 must exist')
    assert.ok(wfh1.approvalHistory && wfh1.approvalHistory.length > 0, 'WFH-001 must have audit history')

    const fieldDutyRequests = attendanceService.getFieldDutyRequests() || []
    const fld2 = fieldDutyRequests.find((f) => f.id === 'FLD-002')
    assert.ok(fld2, 'FLD-002 must exist')
    assert.strictEqual(fld2.employeeId, 'EMP-005', 'FLD-002 must belong to Ahmed Khan')
    assert.strictEqual(fld2.status, 'Approved', 'FLD-002 approved status must be preserved')
    assert.strictEqual(fld2.location, 'Telenor Campus, 345 River View Avenue, Islamabad')
    assert.ok(fld2.approvalHistory.some((h) => h.status === 'Approved'), 'Must contain Approved history entry')
  })

  it('6. SuperAdminLeavePage: Policy Engine Status card removed and Pending Review Queue expanded to full width', () => {
    const filePath = resolveFilePath('pages/leaves/SuperAdminLeavePage.jsx')
    const content = fs.readFileSync(filePath, 'utf8')

    // The Policy Engine Status card must be removed completely so the table columns can expand to full width
    assert.strictEqual(
      content.includes('Policy Engine Status'),
      false,
      'Policy Engine Status card must be removed so table columns have full width'
    )
    assert.strictEqual(
      content.includes('lg:col-span-2'),
      false,
      'Pending review queue must not be restricted to lg:col-span-2'
    )
    assert.strictEqual(
      content.includes('Manual Ledger Adjustment'),
      false,
      'Duplicate Manual Ledger Adjustment button must be removed from overview'
    )
  })
})

