import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Backend Batch 5 — Attendance, Regularization, Overtime & WFH/Field Duty Suite', () => {
  let saUser = null
  let mgrUser = null
  let empUser = null
  let saToken = null
  let mgrToken = null
  let empToken = null
  let dept = null
  let desig = null
  let employee = null
  let manager = null
  let corporateShift = null
  let createdCorrectionId = null
  let createdOtId = null
  let createdWfhId = null
  let createdFdId = null

  it('Setup: Prepares test hierarchy, shift, and actor accounts', async () => {
    dept = await prisma.department.create({
      data: { code: 'DEP-ATT-TEST', name: 'Attendance Testing Dept' }
    })
    desig = await prisma.designation.create({
      data: { code: 'DES-ATT-TEST', title: 'Quality Engineer', level: 'MID' }
    })

    corporateShift = await prisma.shift.create({
      data: {
        shiftCode: 'ATT-CORP-SHIFT',
        name: 'Attendance Standard Corporate Shift',
        startTime: '09:00',
        endTime: '18:00',
        graceMinutesIn: 15,
        graceMinutesOut: 15,
        halfDayThresholdMinutes: 240,
        fullDayTargetMinutes: 480,
        breakDurationMinutes: 60,
        isDefault: true
      }
    })

    manager = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-ATT-MGR',
        firstName: 'Tariq',
        lastName: 'Manager',
        email: 'att_mgr@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE'
      }
    })

    mgrUser = await prisma.user.create({
      data: {
        username: 'att_test_mgr',
        email: 'att_mgr@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'DEPT_MANAGER',
        employeeId: manager.id
      }
    })

    employee = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-ATT-001',
        firstName: 'Ahmed',
        lastName: 'Punches',
        email: 'att_emp@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        reportingManagerId: manager.id,
        employmentStatus: 'ACTIVE'
      }
    })

    empUser = await prisma.user.create({
      data: {
        username: 'att_test_emp',
        email: 'att_emp@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE',
        employeeId: employee.id
      }
    })

    saUser = await prisma.user.create({
      data: {
        username: 'att_test_sa',
        email: 'att_sa@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })

    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })
    mgrToken = generateAccessToken({ userId: mgrUser.id, role: 'DEPT_MANAGER', employeeId: manager.id })
    empToken = generateAccessToken({ userId: empUser.id, role: 'EMPLOYEE', employeeId: employee.id })

    assert.ok(saToken)
    assert.ok(mgrToken)
    assert.ok(empToken)
  })

  it('1. POST /api/v1/attendance/check-in: Records check-in with grace period & late calculation', async () => {
    // Check-in at 09:10 AM Asia/Karachi (within 15m grace for 09:00 shift) -> lateMinutes = 0
    const res = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        punchTime: '2026-11-04T09:10:00+05:00',
        source: 'WEB'
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.success, true)
    assert.strictEqual(res.body.data.employeeId, employee.id)
    assert.strictEqual(res.body.data.lateMinutes, 0, 'Arrival within 15-minute grace period must have 0 late minutes')
  })

  it('2. POST /api/v1/attendance/check-in: Rejects duplicate check-in on the same day with 409', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        punchTime: '2026-11-04T09:25:00+05:00',
        source: 'WEB'
      })

    assert.strictEqual(res.status, 409)
    assert.strictEqual(res.body.success, false)
    assert.strictEqual(res.body.error.code, 'ALREADY_CHECKED_IN')
  })

  it('3. POST /api/v1/attendance/check-out: Calculates work duration, break deductions, and early exit', async () => {
    // Check-out at 18:00 (06:00 PM Asia/Karachi)
    const res = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        punchTime: '2026-11-04T18:00:00+05:00',
        source: 'WEB'
      })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.success, true)
    assert.strictEqual(res.body.data.employeeId, employee.id)
    assert.ok(res.body.data.actualWorkMinutes > 0)
    assert.strictEqual(res.body.data.earlyExitMinutes, 0)
  })

  it('4. GET /api/v1/attendance/register: Validates future date rule and attendance rate calculation', async () => {
    // A. Future date: must mark active employees as SCHEDULED, not ABSENT
    const resFuture = await request(app)
      .get('/api/v1/attendance/register?date=2099-01-01')
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resFuture.status, 200)
    assert.strictEqual(resFuture.body.data.isFutureDate, true)
    const futureStatuses = resFuture.body.data.register.map((r) => r.status)
    assert.ok(futureStatuses.includes('SCHEDULED'), 'Future dates must be marked SCHEDULED, never ABSENT')
    assert.ok(!futureStatuses.includes('ABSENT'), 'Future dates must never mark employees as ABSENT')

    // B. Register for checked-in date (2026-11-04): register reflects our present checked-in employee
    const resDate = await request(app)
      .get('/api/v1/attendance/register?date=2026-11-04')
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resDate.status, 200)
    assert.ok(resDate.body.data.summary.present >= 1)
  })

  it('5. POST /api/v1/attendance/corrections: Submits attendance regularization request', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/corrections')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        attendanceDate: '2026-11-04',
        adjustmentType: 'MISSING_CHECK_OUT',
        requestedCheckIn: '2026-11-04T09:00:00.000Z',
        requestedCheckOut: '2026-11-04T18:00:00.000Z',
        reason: 'Office power failure caused early browser session termination',
        supportingTicketRef: 'IT-HELP-992'
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.success, true)
    assert.strictEqual(res.body.data.adjustmentType, 'MISSING_CHECK_OUT')
    assert.strictEqual(res.body.data.status, 'PENDING')
    createdCorrectionId = res.body.data.id
  })

  it('6. PATCH /api/v1/attendance/corrections/:id/review: Enforces Anti-Self-Approval', async () => {
    // Employee tries to approve their own correction
    const res = await request(app)
      .patch(`/api/v1/attendance/corrections/${createdCorrectionId}/review`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        decision: 'APPROVED',
        remarks: 'Self approval attempt'
      })

    // Blocked by RBAC or Anti-Self-Approval guard (403)
    assert.strictEqual(res.status, 403)
  })

  it('7. PATCH /api/v1/attendance/corrections/:id/review: Manager approves correction', async () => {
    const res = await request(app)
      .patch(`/api/v1/attendance/corrections/${createdCorrectionId}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        decision: 'APPROVED',
        remarks: 'Approved by Department Manager after verifying IT helpdesk ticket'
      })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.data.status, 'APPROVED')
  })

  it('8. POST /api/v1/attendance/overtime: Enforces minimum 60 minutes policy threshold', async () => {
    // A. 45 minutes request should be REJECTED by policy
    const resShort = await request(app)
      .post('/api/v1/attendance/overtime')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        overtimeDate: '2026-11-04',
        startTime: '18:00',
        endTime: '18:45',
        durationMinutes: 45,
        reason: 'Extra bug fixing session'
      })

    assert.strictEqual(resShort.status, 400)
    assert.strictEqual(resShort.body.error.code, 'MINIMUM_DURATION_VIOLATION')

    // B. 90 minutes request should SUCCEED
    const resValid = await request(app)
      .post('/api/v1/attendance/overtime')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        overtimeDate: '2026-11-04',
        startTime: '18:00',
        endTime: '19:30',
        durationMinutes: 90,
        reason: 'Critical production deployment support',
        taskDeliverableRef: 'PR-882'
      })

    assert.strictEqual(resValid.status, 201)
    assert.strictEqual(resValid.body.data.durationMinutes, 90)
    createdOtId = resValid.body.data.id
  })

  it('9. POST /api/v1/attendance/wfh: Submits WFH and rejects duplicate overlapping dates', async () => {
    // First valid WFH
    const res1 = await request(app)
      .post('/api/v1/attendance/wfh')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        reason: 'Remote sprint execution',
        deliverables: 'API integration endpoints'
      })

    assert.strictEqual(res1.status, 201)
    createdWfhId = res1.body.data.id

    // Overlapping WFH request on same dates -> 409 OVERLAPPING_REQUEST
    const resOverlap = await request(app)
      .post('/api/v1/attendance/wfh')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        startDate: '2026-11-11',
        endDate: '2026-11-13',
        reason: 'Duplicate remote request'
      })

    assert.strictEqual(resOverlap.status, 409)
    assert.strictEqual(resOverlap.body.error.code, 'OVERLAPPING_REQUEST')
  })

  it('10. POST & PATCH /api/v1/attendance/field-duty: Enforces No Duration Limit single-approval finality', async () => {
    const resApply = await request(app)
      .post('/api/v1/attendance/field-duty')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        dutyDate: '2026-11-20',
        startTime: '10:00',
        endTime: '16:00',
        durationHours: 6.0,
        clientName: 'Bank Alfalah Corporate HQ',
        siteLocation: 'I.I. Chundrigar Road, Karachi',
        purpose: 'On-site core banking infrastructure audit',
        transportRequired: true
      })

    assert.strictEqual(resApply.status, 201)
    createdFdId = resApply.body.data.id

    // Multi-authority single approver: Department Manager executes first approval
    const resReview = await request(app)
      .patch(`/api/v1/attendance/field-duty/${createdFdId}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        decision: 'APPROVED',
        remarks: 'Client on-site engagement approved per project scope'
      })

    assert.strictEqual(resReview.status, 200)
    assert.strictEqual(resReview.body.data.status, 'APPROVED')
    assert.strictEqual(resReview.body.data.approvedByRole, 'DEPT_MANAGER')

    // Second approval attempt should be rejected with ALREADY_PROCESSED
    const resSecondReview = await request(app)
      .patch(`/api/v1/attendance/field-duty/${createdFdId}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        decision: 'APPROVED',
        remarks: 'Redundant approval'
      })

    assert.strictEqual(resSecondReview.status, 400)
    assert.strictEqual(resSecondReview.body.error.code, 'ALREADY_PROCESSED')
  })

  it('Teardown: Cleans up attendance fixtures and test records', async () => {
    if (createdFdId) {
      await prisma.fieldDutyRequest.deleteMany({ where: { id: createdFdId } }).catch(() => {})
    }
    if (createdWfhId) {
      await prisma.wfhRequest.deleteMany({ where: { employeeId: employee.id } }).catch(() => {})
    }
    if (createdOtId) {
      await prisma.overtimeRequest.deleteMany({ where: { id: createdOtId } }).catch(() => {})
    }
    if (createdCorrectionId) {
      await prisma.attendanceCorrectionRequest.deleteMany({ where: { id: createdCorrectionId } }).catch(() => {})
    }
    if (saUser?.id || mgrUser?.id || empUser?.id) {
      await prisma.user.deleteMany({ where: { id: { in: [saUser?.id, mgrUser?.id, empUser?.id].filter(Boolean) } } }).catch(() => {})
    }
    if (employee?.id) {
      await prisma.attendancePunch.deleteMany({ where: { employeeId: employee.id } }).catch(() => {})
      await prisma.attendanceRecord.deleteMany({ where: { employeeId: employee.id } }).catch(() => {})
      await prisma.employee.deleteMany({ where: { id: { in: [employee.id, manager.id] } } }).catch(() => {})
    }
    if (corporateShift?.id) {
      await prisma.shift.delete({ where: { id: corporateShift.id } }).catch(() => {})
    }
    if (desig?.id) {
      await prisma.designation.delete({ where: { id: desig.id } }).catch(() => {})
    }
    if (dept?.id) {
      await prisma.department.delete({ where: { id: dept.id } }).catch(() => {})
    }
  })
})
