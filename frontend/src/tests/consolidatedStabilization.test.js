import test from 'node:test'
import assert from 'node:assert/strict'
import { shiftService } from '../services/shiftService.js'
import { attendanceService } from '../services/attendanceService.js'
import { attendancePolicyService } from '../services/attendancePolicyService.js'
import { approvalRuleService } from '../services/approvalRuleService.js'
import { leaveService } from '../services/leaveService.js'
import { formatTimeTo12Hour } from '../lib/dateUtils.js'

test('ALIYAN_HRMS — FINAL CONSOLIDATED FRONTEND STABILIZATION SUITE', async (t) => {

  // -------------------------------------------------------------------------
  // 1. Critical Bug A — Shift Effective-Date Synchronization
  // -------------------------------------------------------------------------
  await t.test('1. Shift Effective-Date Resolver: Resolves proper shift by effective dates without premature activation', () => {
    // Ahmed Khan (EMP-005)
    // 1. Establish existing shift: General Corporate Day Shift (09:00 AM - 06:00 PM)
    shiftService.assignShiftToEmployee({
      employeeId: 'EMP-005',
      shiftId: 'SHIFT-01',
      shiftName: 'General Corporate Day Shift',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      notes: 'General Corporate Day Shift assignment'
    }, 'HR Admin')

    // 2. Find or create the QA Test Morning Shift (08:00 - 17:00)
    let morningShift = shiftService.getShifts().find((s) => s.name === 'QA Test Morning Shift')
    if (!morningShift) {
      morningShift = shiftService.createShift({
        code: 'QA-MRN',
        name: 'QA Test Morning Shift',
        type: 'Fixed',
        startTime: '08:00',
        endTime: '17:00',
        breakMinutes: 60,
        paidBreak: false,
        expectedWorkingHours: 8.0,
        status: 'Active',
        effectiveFrom: '2026-01-01'
      }, 'Tariq Mehmood')
    }

    // 3. Assign new QA Test Morning Shift starting November 5, 2026
    shiftService.assignShiftToEmployee({
      employeeId: 'EMP-005',
      shiftId: morningShift.id,
      shiftName: morningShift.name,
      effectiveFrom: '2026-11-05',
      effectiveTo: null,
      notes: 'QA Test Morning Shift rollout'
    }, 'HR Admin')

    // On November 4, 2026: Must resolve to General Corporate Day Shift (09:00 - 18:00)
    const nov4Shift = shiftService.resolveEmployeeShiftForDate('EMP-005', '2026-11-04')
    assert.ok(nov4Shift, 'Nov 4 shift must be resolved')
    assert.equal(nov4Shift.name, 'General Corporate Day Shift', 'Nov 4 must resolve to previous active shift')
    assert.equal(nov4Shift.startTime, '09:00')
    assert.equal(nov4Shift.endTime, '18:00')

    // On November 5, 2026: Must resolve to QA Test Morning Shift (08:00 - 17:00)
    const nov5Shift = shiftService.resolveEmployeeShiftForDate('EMP-005', '2026-11-05')
    assert.ok(nov5Shift, 'Nov 5 shift must be resolved')
    assert.equal(nov5Shift.name, 'QA Test Morning Shift', 'Nov 5 must resolve to newly effective shift')
    assert.equal(nov5Shift.startTime, '08:00')
    assert.equal(nov5Shift.endTime, '17:00')

    // On November 6, 2026: Remains QA Test Morning Shift
    const nov6Shift = shiftService.resolveEmployeeShiftForDate('EMP-005', '2026-11-06')
    assert.equal(nov6Shift.name, 'QA Test Morning Shift')
  })

  await t.test('2. 12-Hour AM/PM Time Format helper displays canonical 12-hour values', () => {
    assert.equal(formatTimeTo12Hour('08:00'), '08:00 AM')
    assert.equal(formatTimeTo12Hour('09:00'), '09:00 AM')
    assert.equal(formatTimeTo12Hour('12:00'), '12:00 PM')
    assert.equal(formatTimeTo12Hour('17:00'), '05:00 PM')
    assert.equal(formatTimeTo12Hour('18:00'), '06:00 PM')
    assert.equal(formatTimeTo12Hour('23:59'), '11:59 PM')
    assert.equal(formatTimeTo12Hour('00:30'), '12:30 AM')
    assert.equal(formatTimeTo12Hour(null), '')
    assert.equal(formatTimeTo12Hour(''), '')
  })

  // -------------------------------------------------------------------------
  // 2. Critical Bug B — Field Duty Approval Workflow & FLD-003 Protection
  // -------------------------------------------------------------------------
  await t.test('3. FLD-003 Initial State & Policy Baseline: Active policy is no_limit, FLD-003 is Pending Team Lead Review', () => {
    attendancePolicyService.setFieldDutyApprovalMode('no_limit')
    const activePolicy = attendancePolicyService.getActivePolicy()
    assert.equal(activePolicy.fieldDutyApprovalLimits.mode, 'no_limit')

    const list = attendanceService.getFieldDutyRequests()
    const fld003 = list.find((f) => f.id === 'FLD-003')
    assert.ok(fld003, 'FLD-003 exists')
    assert.equal(fld003.employeeId, 'EMP-005')
    assert.equal(fld003.status, 'Pending Team Lead Review', 'FLD-003 must remain Pending Team Lead Review')
    assert.equal(fld003.currentApproverId, 'EMP-004')
  })

  await t.test('4. Under No Duration Limit: Both Team Lead and Dept Manager can directly approve (isolated fixture)', () => {
    // Use an isolated test fixture so FLD-003 is not mutated
    const fixtureReq = attendanceService.submitFieldDutyRequest({
      employeeId: 'EMP-005',
      employeeName: 'Ahmed Khan',
      departmentId: 'DEP-01',
      departmentName: 'Software Development',
      visitDate: '2026-11-12',
      clientName: 'Test Client Bank',
      purpose: 'Technical audit session',
      location: 'Islamabad Tech Zone',
      expectedStartTime: '09:00',
      expectedEndTime: '18:00'
    }, 'Ahmed Khan')

    assert.equal(fixtureReq.status, 'Pending Team Lead Review')

    // Self-approval by Ahmed Khan must throw
    assert.throws(
      () => {
        attendanceService.approveFieldDutyRequest(
          fixtureReq.id,
          'Self approval attempt',
          'Ahmed Khan',
          'EMP-005',
          'employee'
        )
      },
      /Self-approval prohibited/
    )

    // Team Lead (Ali Raza, EMP-004) directly approves
    const approvedByTL = attendanceService.approveFieldDutyRequest(
      fixtureReq.id,
      'Authorized by Team Lead',
      'Ali Raza',
      'EMP-004',
      'team_lead'
    )

    assert.equal(approvedByTL.status, 'Approved')
    assert.equal(approvedByTL.approverRole, 'Team Lead')
    assert.equal(approvedByTL.decidedBy, 'Ali Raza')

    // Duplicate decision is blocked
    assert.throws(
      () => {
        attendanceService.approveFieldDutyRequest(
          fixtureReq.id,
          'Second approval attempt',
          'Hamza Ahmed',
          'EMP-003',
          'manager'
        )
      },
      /already finalized/
    )
  })

  // -------------------------------------------------------------------------
  // 3. Attendance Punches & Regularization: "Wrong Shift Applied"
  // -------------------------------------------------------------------------
  await t.test('5. Wrong Shift Applied Regularization: captures intended shift, updates record shift, adheres to presence threshold', () => {
    const morningShift = shiftService.getShifts().find((s) => s.name === 'QA Test Morning Shift') || {
      id: 'SHIFT-01',
      name: 'General Corporate Day Shift'
    }

    // Case A: Normal 8-hour workday regularization -> status: 'Present'
    const corrA = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-005',
      attendanceDate: '2026-11-10',
      correctionType: 'Wrong Shift Applied',
      intendedShiftId: morningShift.id,
      intendedShiftName: morningShift.name,
      requestedCheckIn: '08:00',
      requestedCheckOut: '17:00',
      reason: 'Assigned to night shift mistakenly by scheduler; worked morning roster.',
      supportingReference: 'Roster notice Nov 1'
    }, 'Ahmed Khan', 'EMP-005')

    assert.equal(corrA.correctionType, 'Wrong Shift Applied')
    assert.equal(corrA.intendedShiftId, morningShift.id)
    assert.equal(corrA.intendedShiftName, morningShift.name)

    // Approve Case A
    const decidedA = attendanceService.approveAttendanceCorrection(
      corrA.id,
      'Shift error verified and approved; regularized for roster',
      'Ali Raza',
      'team_lead',
      'EMP-004',
      { isFinalApproval: true }
    )
    assert.equal(decidedA.status, 'Approved')
    assert.equal(decidedA.decidedBy, 'Ali Raza (Team Lead)')

    // Verify attendance record
    const recA = attendanceService.getAttendanceRecords({ date: '2026-11-10', employeeId: 'EMP-005' })
      .find((r) => r.employeeId === 'EMP-005' && r.date === '2026-11-10')
    assert.ok(recA, 'Attendance record must exist')
    assert.equal(recA.shiftId, morningShift.id)
    assert.equal(recA.shiftName, morningShift.name)
    assert.equal(recA.workedHours, 8.0)
    assert.equal(recA.status, 'Present', '8 hours must be Present')
    assert.equal(recA.isHalfDay, false)

    // Case B: Short attendance (<4h) must NOT be blindly forced to Present -> must be 'Absent'
    const corrB = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-005',
      attendanceDate: '2026-11-11',
      correctionType: 'Wrong Shift Applied',
      intendedShiftId: 'SHIFT-01',
      intendedShiftName: 'General Corporate Day Shift',
      requestedCheckIn: '09:00',
      requestedCheckOut: '12:00', // 3 hours elapsed, paidBreak false => <4h
      reason: 'Medical emergency early exit',
      supportingReference: 'Clinic slip #440'
    }, 'Ahmed Khan', 'EMP-005')

    attendanceService.approveAttendanceCorrection(
      corrB.id,
      'Emergency departure verified and approved; regularized',
      'Ali Raza',
      'team_lead',
      'EMP-004',
      { isFinalApproval: true }
    )

    const recB = attendanceService.getAttendanceRecords({ date: '2026-11-11', employeeId: 'EMP-005' })
      .find((r) => r.employeeId === 'EMP-005' && r.date === '2026-11-11')
    assert.ok(recB)
    assert.ok(recB.workedHours < 4, 'Worked hours must be < 4h')
    assert.equal(recB.status, 'Absent', 'Attendance < 4 hours must evaluate to Absent, never blindly forced to Present')
    assert.equal(recB.isHalfDay, false)

    // Case C: 4h - 6h attendance must evaluate to 'Half Day'
    const corrC = attendanceService.submitAttendanceCorrection({
      employeeId: 'EMP-005',
      attendanceDate: '2026-11-13',
      correctionType: 'Missing Check-Out',
      requestedCheckIn: '09:00',
      requestedCheckOut: '14:00', // 5 hours elapsed, 1h break = 4h or 5h
      reason: 'Half-day worked due to client demo',
      supportingReference: 'Meeting invite #88'
    }, 'Ahmed Khan', 'EMP-005')

    attendanceService.approveAttendanceCorrection(
      corrC.id,
      'Approved half day regularization',
      'Ali Raza',
      'team_lead',
      'EMP-004',
      { isFinalApproval: true }
    )

    const recC = attendanceService.getAttendanceRecords({ date: '2026-11-13', employeeId: 'EMP-005' })
      .find((r) => r.employeeId === 'EMP-005' && r.date === '2026-11-13')
    assert.ok(recC)
    assert.equal(recC.status, 'Half Day', 'Worked hours between 4h and 6h must evaluate to Half Day')
    assert.equal(recC.isHalfDay, true)
  })

  // -------------------------------------------------------------------------
  // 4. Leave Routing Decisions: Annual Approved Request Count Policy
  // -------------------------------------------------------------------------
  await t.test('6. Leave Approval Routing: Normal employee routes 1st & 2nd to TL, 3rd+ to Dept Manager', () => {
    // Normal Employee: Ahmed Khan (EMP-005), TL is Ali Raza (EMP-004), Manager is Hamza Ahmed (EMP-003)
    const route1 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-005',
      priorApprovedRequestsThisYear: 0
    })
    assert.equal(route1.currentApproverRole, 'team_lead', '1st annual request routes to Team Lead')
    assert.equal(route1.currentApproverId, 'EMP-004')

    const route2 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-005',
      priorApprovedRequestsThisYear: 1
    })
    assert.equal(route2.currentApproverRole, 'team_lead', '2nd annual request routes to Team Lead')
    assert.equal(route2.currentApproverId, 'EMP-004')

    const route3 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-005',
      priorApprovedRequestsThisYear: 2
    })
    assert.equal(route3.currentApproverRole, 'manager', '3rd annual request escalates to Department Manager')
    assert.equal(route3.currentApproverId, 'EMP-003')

    const route4 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-005',
      priorApprovedRequestsThisYear: 5
    })
    assert.equal(route4.currentApproverRole, 'manager', 'Subsequent annual requests escalate to Department Manager')
  })

  await t.test('7. Leave Approval Routing: Team Lead routes 1st & 2nd to Dept Manager, 3rd+ to HR Admin', () => {
    // Team Lead: Ali Raza (EMP-004), Manager is Hamza Ahmed (EMP-003), HR Admin is Ayesha Khan (EMP-002)
    const routeTL1 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-004',
      priorApprovedRequestsThisYear: 0
    })
    assert.equal(routeTL1.currentApproverRole, 'manager', 'TL 1st request routes to Department Manager')
    assert.equal(routeTL1.currentApproverId, 'EMP-003')

    const routeTL2 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-004',
      priorApprovedRequestsThisYear: 1
    })
    assert.equal(routeTL2.currentApproverRole, 'manager', 'TL 2nd request routes to Department Manager')
    assert.equal(routeTL2.currentApproverId, 'EMP-003')

    const routeTL3 = approvalRuleService.evaluateApprovalRouting({
      module: 'leaves',
      applicantId: 'EMP-004',
      priorApprovedRequestsThisYear: 2
    })
    assert.equal(routeTL3.currentApproverRole, 'hr_admin', 'TL 3rd request escalates to HR Admin')
    assert.equal(routeTL3.currentApproverId, 'EMP-002')
  })

  await t.test('8. Cancelled and Rejected leaves do not consume annual approved count threshold', () => {
    const applicant = 'EMP-005'
    const priorApproved = approvalRuleService.getPriorApprovedLeaveCountThisYear(applicant, 2026)
    
    // Submitting a request that gets rejected
    const rejectedReq = leaveService.submitLeaveRequest({
      employeeId: applicant,
      leaveTypeId: 'LT-CASUAL',
      leaveType: 'Casual Leave',
      startDate: '2026-11-20',
      endDate: '2026-11-20',
      reason: 'Rejected test leave'
    }, { employeeId: applicant, name: 'Ahmed Khan', role: 'employee' })

    leaveService.rejectLeaveRequest(
      rejectedReq.id,
      'Testing rejected count neutrality',
      { employeeId: 'EMP-004', name: 'Ali Raza', role: 'team_lead' }
    )

    const countAfterReject = approvalRuleService.getPriorApprovedLeaveCountThisYear(applicant, 2026)
    assert.equal(countAfterReject, priorApproved, 'Rejected request must not increment approved request count')
  })

  // -------------------------------------------------------------------------
  // 5. Verification of FLD-003 State Persistence
  // -------------------------------------------------------------------------
  await t.test('9. Verify FLD-003 state persistence: retains valid status without forced mutation to Pending', () => {
    const list = attendanceService.getFieldDutyRequests()
    const fld003 = list.find((f) => f.id === 'FLD-003')
    assert.ok(fld003)
    assert.ok(['Pending Team Lead Review', 'Approved'].includes(fld003.status))
  })

  // -------------------------------------------------------------------------
  // 6. Shift and Attendance Reconciliation & Lateness Calculation
  // -------------------------------------------------------------------------
  await t.test('10. Ahmed Khan Nov 4 lateness = 0 with 08:43 AM check-in against General Corporate Day Shift', () => {
    // 08:43 is within 09:00 + 15m grace period -> lateness must be 0
    const records = attendanceService.getAttendanceRecords({ date: '2026-11-04', employeeId: 'EMP-005' })
    const ahmedRec = records.find((r) => r.employeeId === 'EMP-005' && r.date === '2026-11-04')
    if (ahmedRec && ahmedRec.checkInTime) {
      assert.equal(ahmedRec.shiftName, 'General Corporate Day Shift')
      assert.equal(ahmedRec.isLate, false)
      assert.equal(ahmedRec.lateMinutes, 0)
    }
  })

  await t.test('11. Shift Isolation: Non-Ahmed employees on Nov 5 resolve to their canonical shifts, not QA Test Morning Shift', () => {
    // Non-Ahmed staff (e.g. EMP-001, EMP-002, EMP-003, EMP-004)
    const emp001Shift = shiftService.resolveEmployeeShiftForDate('EMP-001', '2026-11-05')
    assert.notEqual(emp001Shift.name, 'QA Test Morning Shift', 'EMP-001 must not have QA Test Morning Shift')
    assert.equal(emp001Shift.name, 'General Corporate Day Shift')

    const emp004Shift = shiftService.resolveEmployeeShiftForDate('EMP-004', '2026-11-05')
    assert.notEqual(emp004Shift.name, 'QA Test Morning Shift', 'EMP-004 must not have QA Test Morning Shift')

    // Ahmed Khan (EMP-005) explicitly has QA Test Morning Shift on Nov 5
    const ahmedShift = shiftService.resolveEmployeeShiftForDate('EMP-005', '2026-11-05')
    assert.equal(ahmedShift.name, 'QA Test Morning Shift', 'Ahmed Khan must have QA Test Morning Shift')
  })

  await t.test('12. Canonical Default Shift SHIFT-01 exists in Shift Management master table', () => {
    const shifts = shiftService.getShifts()
    const shift01 = shifts.find((s) => s.id === 'SHIFT-01' || s.name === 'General Corporate Day Shift')
    assert.ok(shift01, 'General Corporate Day Shift (SHIFT-01) must exist in master shifts')
    assert.equal(shift01.startTime, '09:00')
    assert.equal(shift01.endTime, '18:00')
  })

  await t.test('13. Future-date attendance rows are marked Scheduled, not Absent', () => {
    const futureDate = '2026-12-15'
    attendanceService.syncScheduledAttendance(futureDate)
    const futureRecords = attendanceService.getAttendanceRecords({ date: futureDate })
    assert.ok(futureRecords.length > 0, 'Future records must be generated')
    for (const rec of futureRecords) {
      if (!rec.checkInTime) {
        assert.equal(rec.status, 'Scheduled', `Unpunched future date record for ${rec.employeeName} must be Scheduled, not Absent`)
        assert.equal(rec.primaryClassification, 'Scheduled')
      }
    }
  })

  await t.test('14. WFH Request duplicate prevention on the same date for the same employee', () => {
    const date = '2026-11-28'
    // First submission succeeds
    const req1 = attendanceService.submitWfhRequest({
      employeeId: 'EMP-005',
      requestedDate: date,
      reason: 'Focused sprint delivery'
    }, 'Ahmed Khan')
    assert.ok(req1)

    // Second submission on same date must throw duplicate error
    assert.throws(
      () => {
        attendanceService.submitWfhRequest({
          employeeId: 'EMP-005',
          requestedDate: date,
          reason: 'Duplicate request attempt'
        }, 'Ahmed Khan')
      },
      /Duplicate WFH request prevented/
    )
  })

  // -------------------------------------------------------------------------
  // 6. Bug 1, 2, 3 — Attendance Register Isolation, Pre-Shift Scheduling & Rate
  // -------------------------------------------------------------------------
  await t.test('15. Bug 1: November 5 Attendance Register Shift Isolation across all employees', () => {
    // Synchronize scheduled attendance for Nov 5
    attendanceService.syncScheduledAttendance('2026-11-05')
    const records = attendanceService.getAttendanceRecords({ date: '2026-11-05' })
    assert.ok(records.length > 0, 'Must have records for Nov 5')

    // Find records for each key staff member
    const emp001 = records.find((r) => r.employeeId === 'EMP-001')
    const emp002 = records.find((r) => r.employeeId === 'EMP-002')
    const emp003 = records.find((r) => r.employeeId === 'EMP-003')
    const emp004 = records.find((r) => r.employeeId === 'EMP-004')
    const emp005 = records.find((r) => r.employeeId === 'EMP-005')
    const emp006 = records.find((r) => r.employeeId === 'EMP-006')

    // Only Ahmed Khan (EMP-005) receives QA Test Morning Shift
    assert.equal(emp005?.shiftName, 'QA Test Morning Shift', 'Ahmed Khan must have QA Test Morning Shift')

    // All other employees must strictly resolve to their own canonical shifts, NEVER QA Test Morning Shift
    assert.notEqual(emp001?.shiftName, 'QA Test Morning Shift', 'EMP-001 must not have QA Test Morning Shift')
    assert.equal(emp001?.shiftName, 'General Corporate Day Shift')

    assert.notEqual(emp002?.shiftName, 'QA Test Morning Shift', 'EMP-002 must not have QA Test Morning Shift')
    assert.equal(emp002?.shiftName, 'General Corporate Day Shift')

    assert.notEqual(emp003?.shiftName, 'QA Test Morning Shift', 'EMP-003 must not have QA Test Morning Shift')
    assert.equal(emp003?.shiftName, 'Engineering Flexible Development Shift')

    assert.notEqual(emp004?.shiftName, 'QA Test Morning Shift', 'EMP-004 must not have QA Test Morning Shift')
    assert.equal(emp004?.shiftName, 'Engineering Flexible Development Shift')

    assert.notEqual(emp006?.shiftName, 'QA Test Morning Shift', 'EMP-006 must not have QA Test Morning Shift')
    assert.equal(emp006?.shiftName, 'Engineering Flexible Development Shift')
  })

  await t.test('16. Bug 2: Unpunched employees on Nov 5 are Scheduled, not Absent (no fake absences before shift ends)', () => {
    const records = attendanceService.getAttendanceRecords({ date: '2026-11-05' })
    for (const rec of records) {
      if (!rec.checkInTime && !['Weekly Off', 'Holiday', 'On Leave', 'WFH', 'Field Duty'].includes(rec.status)) {
        assert.equal(rec.status, 'Scheduled', `Staff ${rec.employeeName} (${rec.employeeId}) must be Scheduled, not Absent`)
        assert.equal(rec.primaryClassification, 'Scheduled')
        assert.equal(rec.hoursVariance, 0, 'Variance must be 0 for scheduled unpunched shifts')
      }
    }
  })

  await t.test('17. Bug 1 & 2 Self-Healing: Corrupted localStorage records with leaked shift and premature Absent are repaired on query', () => {
    const prevRecords = attendanceService._getItem('isysware_hrms_f04_attendance_records_v1', null)
    try {
      // Inject corrupt record into storage
      const corruptRecords = [
        {
          id: 'ATT-20261105-001',
          employeeId: 'EMP-001',
          employeeName: 'Tariq Mehmood',
          date: '2026-11-05',
          shiftId: 'QA-MOR-01',
          shiftName: 'QA Test Morning Shift',
          status: 'Absent',
          primaryClassification: 'Absent',
          checkInTime: null,
          workedHours: 0,
          hoursVariance: -8.0
        },
        {
          id: 'ATT-20261105-004',
          employeeId: 'EMP-004',
          employeeName: 'Ali Raza',
          date: '2026-11-05',
          shiftId: 'QA-MOR-01',
          shiftName: 'QA Test Morning Shift',
          status: 'Absent',
          primaryClassification: 'Absent',
          checkInTime: null,
          workedHours: 0,
          hoursVariance: -8.0
        }
      ]

      attendanceService._setItem('isysware_hrms_f04_attendance_records_v1', corruptRecords)

      // Call getAttendanceRecords -> must heal both shift and status
      const healed = attendanceService.getAttendanceRecords({ date: '2026-11-05' })
      const healedEmp001 = healed.find((r) => r.employeeId === 'EMP-001')
      const healedEmp004 = healed.find((r) => r.employeeId === 'EMP-004')

      assert.equal(healedEmp001?.shiftName, 'General Corporate Day Shift', 'Corrupt EMP-001 QA shift must be healed to General Corporate Day Shift')
      assert.equal(healedEmp001?.status, 'Scheduled', 'Corrupt Absent status must be healed to Scheduled')
      assert.equal(healedEmp001?.hoursVariance, 0)

      assert.equal(healedEmp004?.shiftName, 'Engineering Flexible Development Shift', 'Corrupt EMP-004 QA shift must be healed to Engineering Flexible Dev Shift')
      assert.equal(healedEmp004?.status, 'Scheduled', 'Corrupt Absent status must be healed to Scheduled')
      assert.equal(healedEmp004?.hoursVariance, 0)
    } finally {
      if (prevRecords) {
        attendanceService._setItem('isysware_hrms_f04_attendance_records_v1', prevRecords)
      } else {
        attendanceService.resetToDefaults()
      }
    }
  })

  await t.test('18. Bug 3: Attendance Rate is 0% when no active punches and N/A when scheduled workforce is 0', () => {
    // On Nov 5 when all staff are Scheduled (no punches):
    const nov5Stats = attendanceService.getAttendanceOverviewStats({ date: '2026-11-05' })
    assert.equal(nov5Stats.workingToday, 0, 'No staff has punched in yet')
    assert.equal(nov5Stats.attendanceRate, 0, 'Attendance rate must be 0%, not 100% when no punches exist')

    // Baseline stats without arguments defaults to canonical active baseline (2026-10-26)
    const baselineStats = attendanceService.getAttendanceOverviewStats()
    assert.equal(baselineStats.attendanceRate, 92.3, 'Canonical baseline attendance rate is 92.3%')

    // When scheduled workforce is 0:
    const emptyStats = attendanceService.getAttendanceOverviewStats({ departmentId: 'NON_EXISTENT', date: '2026-11-05' })
    assert.equal(emptyStats.scheduledWorkforce, 0)
    assert.equal(emptyStats.attendanceRate, null, 'Must be null (rendered as N/A in UI) when denominator is 0')
  })
})
