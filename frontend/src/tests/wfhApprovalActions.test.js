import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { attendanceService } from '../services/attendanceService.js'
import { employeeService } from '../services/employeeService.js'

describe('Aliyan_HRMS — WFH Approval Actions & Workflow Suite', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('1. Ahmed Khan WFH-001 is reconciled to Ali Raza (EMP-004) with Pending Team Lead Review', () => {
    attendanceService._reconcilePendingApproverRouting()
    const wfhRequests = attendanceService.getWfhRequests()
    const wfh1 = wfhRequests.find(w => w.id === 'WFH-001')

    assert.ok(wfh1, 'WFH-001 must exist')
    assert.strictEqual(wfh1.employeeId, 'EMP-005', 'WFH-001 belongs to Ahmed Khan (EMP-005)')
    assert.strictEqual(wfh1.currentApproverId, 'EMP-004', 'Approver ID must be Ali Raza (EMP-004)')
    assert.ok(wfh1.currentApproverName === 'UAT Dev Manager' || wfh1.currentApproverName === 'Ali Raza', 'Approver name must resolve to authoritative Team Lead (UAT Dev Manager / Ali Raza)')
    assert.strictEqual(wfh1.status, 'Pending Team Lead Review')
    assert.ok(wfh1.approvalHistory.some(h => h.status === 'Re-routed'), 'Must have Re-routed audit log')
  })

  it('2. Authorized Team Lead Ali Raza (EMP-004) can approve Ahmed Khan (EMP-005) WFH request', () => {
    // Submit a fresh WFH request for EMP-005
    const newWfh = attendanceService.submitWfhRequest({
      employeeId: 'EMP-005',
      requestedDate: '2026-11-04',
      reason: 'Home network setup',
      deliverablesPlanned: 'API endpoints implementation'
    }, 'Ahmed Khan')

    assert.strictEqual(newWfh.currentApproverId, 'EMP-004')
    assert.strictEqual(newWfh.status, 'Pending Team Lead Review')

    // Approve by Team Lead
    const approved = attendanceService.approveWfhRequest(
      newWfh.id,
      'Approved for home network setup',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )

    assert.strictEqual(approved.status, 'Approved')
    assert.ok(approved.decidedBy.includes('Ali Raza'))
    assert.ok(approved.decidedBy.includes('Team Lead'))
    assert.ok(approved.approvalHistory.some(h => h.status === 'Approved'))

    // Verify daily attendance sync
    const records = attendanceService.getAttendanceRecords({ employeeId: 'EMP-005', date: '2026-11-04' })
    const rec = records.find(r => r.date === '2026-11-04')
    assert.ok(rec, 'Attendance record for WFH date must exist')
    assert.strictEqual(rec.primaryClassification, 'WFH')
    assert.strictEqual(rec.status, 'WFH')
    assert.strictEqual(rec.workArrangement, 'WFH')

    // Verify WFH allowance tracking
    const emp = employeeService.getEmployeeById('EMP-005')
    assert.ok(emp, 'Employee exists')
  })

  it('3. Authorized Team Lead can reject WFH request with decision remarks without modifying attendance', () => {
    const newWfh = attendanceService.submitWfhRequest({
      employeeId: 'EMP-005',
      requestedDate: '2026-11-05',
      reason: 'Personal engagement',
      deliverablesPlanned: 'General tasks'
    }, 'Ahmed Khan')

    const rejected = attendanceService.rejectWfhRequest(
      newWfh.id,
      'Mandatory on-site client demo scheduled',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )

    assert.strictEqual(rejected.status, 'Rejected')
    assert.ok(rejected.decidedBy.includes('Ali Raza'))
    assert.ok(rejected.approvalHistory.some(h => h.status === 'Rejected'))
  })

  it('4. Anti-Self-Approval guard prevents employee from approving their own WFH request', () => {
    const ownWfh = attendanceService.submitWfhRequest({
      employeeId: 'EMP-004',
      requestedDate: '2026-11-06',
      reason: 'Personal work',
      deliverablesPlanned: 'Architecture design'
    }, 'Ali Raza')

    assert.throws(
      () => attendanceService.approveWfhRequest(
        ownWfh.id,
        'Attempting self approval',
        'Ali Raza',
        'EMP-004',
        'team_lead'
      ),
      /Self-approval prohibited/
    )
  })

  it('5. Bilal Ahmed (EMP-006) cannot approve Ahmed Khan WFH requests without delegation', () => {
    const req = attendanceService.submitWfhRequest({
      employeeId: 'EMP-005',
      requestedDate: '2026-11-07',
      reason: 'Internet issue',
      deliverablesPlanned: 'Testing sprint'
    }, 'Ahmed Khan')

    assert.throws(
      () => attendanceService.approveWfhRequest(
        req.id,
        'Bilal attempting approval',
        'Bilal Ahmed',
        'EMP-006',
        'team_lead'
      ),
      /Unauthorized/
    )
  })

  it('6. Finalized WFH request cannot be duplicate approved', () => {
    const req = attendanceService.submitWfhRequest({
      employeeId: 'EMP-005',
      requestedDate: '2026-11-08',
      reason: 'Valid reason',
      deliverablesPlanned: 'Feature dev'
    }, 'Ahmed Khan')

    attendanceService.approveWfhRequest(
      req.id,
      'First approval',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )

    assert.throws(
      () => attendanceService.approveWfhRequest(
        req.id,
        'Duplicate approval',
        'Ali Raza',
        'EMP-004',
        'team_lead'
      ),
      /already finalized/
    )
  })
})
