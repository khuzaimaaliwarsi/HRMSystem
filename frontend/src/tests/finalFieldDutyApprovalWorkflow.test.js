import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceService } from '../services/attendanceService.js'
import { attendancePolicyService } from '../services/attendancePolicyService.js'
import { approvalRuleService } from '../services/approvalRuleService.js'
import { employeeService } from '../services/employeeService.js'
import { INITIAL_FIELD_DUTY_REQUESTS } from '../mocks/attendanceData.js'

test('Aliyan_HRMS — Final Field Duty Approval Workflow Suite', async (t) => {
  // Ensure active policy is No Duration Limit baseline
  attendancePolicyService.setFieldDutyApprovalMode('no_limit')

  await t.test('1. FLD-003 state: Ahmed Khan 9h request exists with Ali Raza assigned', () => {
    const list = attendanceService.getFieldDutyRequests()
    const fld003 = list.find((f) => f.id === 'FLD-003')

    assert.ok(fld003, 'FLD-003 must exist in initial/reconciled field duty requests')
    assert.equal(fld003.employeeId, 'EMP-005')
    assert.equal(fld003.employeeName, 'Ahmed Khan')
    assert.ok(['Pending Team Lead Review', 'Approved'].includes(fld003.status))
    assert.equal(fld003.durationHours, 9.0)
    assert.equal(fld003.isEscalated, false)
  })

  await t.test('2. No Duration Limit policy: Approval Matrix Simulator routes 9h request to Team Lead without escalation', () => {
    const routing = approvalRuleService.evaluateApprovalRouting({
      module: 'attendance',
      applicantId: 'EMP-005',
      amountOrDays: 9.0
    })

    assert.equal(routing.currentApproverTier, 'Team Lead')
    assert.equal(routing.currentApproverRole, 'team_lead')
    assert.equal(routing.currentApproverId, 'EMP-004')
    assert.equal(routing.isEscalated, false)
    assert.equal(routing.escalationReason, null)
  })

  await t.test('3. Ali Raza (Team Lead) approves FLD-003 directly -> becomes Final Approved without second approval', () => {
    const current = attendanceService.getFieldDutyRequests().find((f) => f.id === 'FLD-003')
    let approved = current
    if (current && current.status !== 'Approved') {
      approved = attendanceService.approveFieldDutyRequest(
        'FLD-003',
        'Client integration review verified and authorized on-site',
        'Ali Raza',
        'EMP-004',
        'team_lead'
      )
    }

    assert.equal(approved.status, 'Approved')
    assert.equal(approved.approverRole, 'Team Lead')
    assert.equal(approved.approverName, 'Ali Raza')
    assert.equal(approved.approverId, 'EMP-004')
    assert.equal(approved.decidedBy, 'Ali Raza')
    assert.equal(approved.isEscalated, false)

    // Complete audit history is preserved
    assert.ok(approved.approvalHistory.length >= 2)
    const approvalEntry = approved.approvalHistory.find((h) => h.status === 'Approved')
    assert.ok(approvalEntry, 'Must have an Approved audit entry')
    assert.ok(approvalEntry.actor.includes('Ali Raza'))

    // Attendance record for visitDate (2026-11-04) synchronized
    const records = attendanceService.getAttendanceRecords({ date: '2026-11-04', employeeId: 'EMP-005' })
    const ahmedRec = records.find((r) => r.employeeId === 'EMP-005' && r.date === '2026-11-04')
    if (ahmedRec) {
      assert.equal(ahmedRec.workArrangement, 'Field Duty')
      assert.equal(ahmedRec.primaryClassification, 'Field Duty')
    }
  })

  await t.test('4. Cross-Portal Consistency: Once approved, FLD-003 is Approved across all portals with actions disabled', () => {
    // 1. Employee portal (Ahmed Khan)
    const empView = attendanceService.getFieldDutyRequests({}, { role: 'employee', employeeId: 'EMP-005' })
    const empFld = empView.find((f) => f.id === 'FLD-003')
    assert.ok(empFld)
    assert.equal(empFld.status, 'Approved')

    // 2. Team Lead portal (Ali Raza)
    const tlView = attendanceService.getFieldDutyRequests({}, { role: 'team_lead', employeeId: 'EMP-004' })
    const tlFld = tlView.find((f) => f.id === 'FLD-003')
    assert.ok(tlFld)
    assert.equal(tlFld.status, 'Approved')

    // 3. Department Manager portal (Hamza Ahmed)
    const mgrView = attendanceService.getFieldDutyRequests({}, { role: 'manager', employeeId: 'EMP-003' })
    const mgrFld = mgrView.find((f) => f.id === 'FLD-003')
    assert.ok(mgrFld)
    assert.equal(mgrFld.status, 'Approved')

    // 4. HR Admin portal (Ayesha Khan)
    const hrView = attendanceService.getFieldDutyRequests({}, { role: 'hr_admin', employeeId: 'EMP-002' })
    const hrFld = hrView.find((f) => f.id === 'FLD-003')
    assert.ok(hrFld)
    assert.equal(hrFld.status, 'Approved')

    // 5. Super Admin portal (Tariq Mehmood)
    const adminView = attendanceService.getFieldDutyRequests({}, { role: 'super_admin', employeeId: 'EMP-001' })
    const adminFld = adminView.find((f) => f.id === 'FLD-003')
    assert.ok(adminFld)
    assert.equal(adminFld.status, 'Approved')
  })

  await t.test('5. Isolated Fixture: Department Manager approves first -> becomes Final Approved without second approval', () => {
    // Fresh fixture request
    const freshReq = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005',
      visitDate: '2026-11-10',
      clientName: 'Jazz B2B Operations',
      location: 'F-8 Islamabad',
      purpose: 'Technical discovery workshop',
      expectedStartTime: '09:30',
      expectedEndTime: '18:30' // 9 hours
    }, 'Ahmed Khan')

    assert.equal(freshReq.status, 'Pending Team Lead Review')

    // Hamza Ahmed (Department Manager) approves first
    const mgrApproved = attendanceService.approveFieldDutyRequest(
      freshReq.id,
      'Direct authorized by Department Manager under No Duration Limit policy',
      'Hamza Ahmed',
      'EMP-003',
      'manager'
    )

    assert.equal(mgrApproved.status, 'Approved')
    assert.equal(mgrApproved.approverRole, 'Manager')
    assert.equal(mgrApproved.approverName, 'Hamza Ahmed')
    assert.equal(mgrApproved.decidedBy, 'Hamza Ahmed')

    // Team Lead view now sees Approved (no further approval required)
    const tlView = attendanceService.getFieldDutyRequests({}, { role: 'team_lead', employeeId: 'EMP-004' })
    const checkReq = tlView.find((f) => f.id === freshReq.id)
    assert.equal(checkReq.status, 'Approved')
  })

  await t.test('6. Duplicate & Concurrent decision prevention: Finalized requests cannot be re-approved or declined', () => {
    // Attempt duplicate approval on already finalized FLD-003
    assert.throws(
      () => {
        attendanceService.approveFieldDutyRequest(
          'FLD-003',
          'Second approval attempt',
          'Hamza Ahmed',
          'EMP-003',
          'manager'
        )
      },
      /already finalized/
    )

    // Attempt rejection on already finalized FLD-003
    assert.throws(
      () => {
        attendanceService.rejectFieldDutyRequest(
          'FLD-003',
          'Decline after approval attempt',
          'Hamza Ahmed',
          'EMP-003',
          'manager'
        )
      },
      /already finalized/
    )
  })

  await t.test('7. Anti-Self-Approval guard: Employees cannot approve their own Field Duty requests', () => {
    const selfReq = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005',
      visitDate: '2026-11-12',
      clientName: 'Ufone HQ',
      location: 'Blue Area',
      purpose: 'API Testing',
      expectedStartTime: '10:00',
      expectedEndTime: '14:00'
    }, 'Ahmed Khan')

    assert.throws(
      () => {
        attendanceService.approveFieldDutyRequest(
          selfReq.id,
          'Self-approving my own request',
          'Ahmed Khan',
          'EMP-005',
          'employee'
        )
      },
      /Anti-Self-Approval|Self-approval prohibited/i
    )
  })

  await t.test('8. Cross-department authorization guard: Out-of-scope supervisors cannot approve', () => {
    const devReq = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005', // DEP-01 Software Development
      visitDate: '2026-11-14',
      clientName: 'PTCL NOC',
      location: 'H-9 Islamabad',
      purpose: 'Network audit',
      expectedStartTime: '09:00',
      expectedEndTime: '13:00'
    }, 'Ahmed Khan')

    // Supervisor from another department (e.g. EMP-007 Kamran Raza in DEP-02)
    assert.throws(
      () => {
        attendanceService.approveFieldDutyRequest(
          devReq.id,
          'Unauthorized cross-dept approval',
          'Kamran Raza',
          'EMP-007',
          'team_lead'
        )
      },
      /Cross-department|Unauthorized/i
    )
  })

  await t.test('9. Duration-Based Mode Configurable: Escalation occurs when mode is switched to duration_based', () => {
    // Switch to duration_based
    attendancePolicyService.setFieldDutyApprovalMode('duration_based', { teamLeadMaxHours: 4.0, managerMaxHours: 9.0 })

    const durReq = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005',
      visitDate: '2026-11-16',
      clientName: 'Telenor Pakistan',
      location: 'Islamabad',
      purpose: 'Integration Review',
      expectedStartTime: '09:00',
      expectedEndTime: '18:00' // 9.0 hours > 4.0h TL limit
    }, 'Ahmed Khan')

    // Team Lead endorses (escalates)
    const endorsed = attendanceService.approveFieldDutyRequest(
      durReq.id,
      'Verified by TL, duration exceeds 4h',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )

    assert.equal(endorsed.status, 'Pending Manager Review')
    assert.equal(endorsed.isEscalated, true)

    // Department Manager finalizes
    const mgrFinal = attendanceService.approveFieldDutyRequest(
      durReq.id,
      'Authorized by Dept Manager',
      'Hamza Ahmed',
      'EMP-003',
      'manager'
    )
    assert.equal(mgrFinal.status, 'Approved')

    // Reset back to no_limit mode
    attendancePolicyService.setFieldDutyApprovalMode('no_limit')
  })

  await t.test('10. Manager-Only Mode Configurable: Blocks Team Lead and enforces Department Manager', () => {
    attendancePolicyService.setFieldDutyApprovalMode('manager_only')

    const moReq = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005',
      visitDate: '2026-11-18',
      clientName: 'Alfalah Bank',
      location: 'F-6 Islamabad',
      purpose: 'Consultation',
      expectedStartTime: '10:00',
      expectedEndTime: '12:00'
    }, 'Ahmed Khan')

    assert.throws(
      () => {
        attendanceService.approveFieldDutyRequest(
          moReq.id,
          'Unauthorized attempt',
          'Ali Raza',
          'EMP-004',
          'team_lead'
        )
      },
      /Policy requires Department Manager approval/
    )

    // Manager approves
    const approved = attendanceService.approveFieldDutyRequest(
      moReq.id,
      'Manager approved',
      'Hamza Ahmed',
      'EMP-003',
      'manager'
    )
    assert.equal(approved.status, 'Approved')

    // Reset back to no_limit mode
    attendancePolicyService.setFieldDutyApprovalMode('no_limit')
  })

  await t.test('11. Historical records FLD-001 and FLD-002 are preserved intact', () => {
    const list = attendanceService.getFieldDutyRequests()
    const fld001 = list.find((f) => f.id === 'FLD-001')
    const fld002 = list.find((f) => f.id === 'FLD-002')

    assert.ok(fld001, 'FLD-001 must exist')
    assert.equal(fld001.status, 'Approved')
    assert.equal(fld001.clientName, 'Mobilink Microfinance Bank')

    assert.ok(fld002, 'FLD-002 must exist')
    assert.equal(fld002.status, 'Approved')
    assert.equal(fld002.durationHours, 9.0)
    assert.equal(fld002.approverName, 'Hamza Ahmed')
  })

  await t.test('12. FLD-003 is preserved in Final Approved state for manual browser QA', () => {
    const list = attendanceService.getFieldDutyRequests()
    const check = list.find((f) => f.id === 'FLD-003')
    assert.ok(check, 'FLD-003 must exist')
    assert.equal(check.status, 'Approved', 'FLD-003 must remain in its Final Approved state and not be reset to Pending')
    assert.equal(check.approverName, 'Ali Raza')
  })
})
