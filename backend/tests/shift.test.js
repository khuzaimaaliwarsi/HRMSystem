import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Backend Batch 5 — Shift Management & SHIFT-ISOLATION-01 Suite', () => {
  let saUser = null
  let saToken = null
  let empA = null
  let empB = null
  let dept = null
  let desig = null
  let defaultShift = null
  let qaShift = null

  it('Setup: Prepares test Super Admin, department, designation and two distinct test employees', async () => {
    saUser = await prisma.user.create({
      data: {
        username: 'shift_test_sa',
        email: 'shift_sa@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })
    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })

    dept = await prisma.department.create({
      data: { code: 'DEP-SHIFT-QA', name: 'Quality Assurance' }
    })
    desig = await prisma.designation.create({
      data: { code: 'DES-SHIFT-QA', title: 'QA Engineer', level: 'MID' }
    })

    empA = await prisma.employee.create({
      data: {
        employeeCode: 'TEST-EMP-A',
        firstName: 'Ahmed',
        lastName: 'Test',
        email: 'ahmed.test@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        employmentType: 'PERMANENT',
        employmentStatus: 'ACTIVE'
      }
    })

    empB = await prisma.employee.create({
      data: {
        employeeCode: 'TEST-EMP-B',
        firstName: 'Ali',
        lastName: 'Test',
        email: 'ali.test@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        employmentType: 'PERMANENT',
        employmentStatus: 'ACTIVE'
      }
    })

    assert.ok(saToken)
    assert.ok(empA.id)
    assert.ok(empB.id)
  })

  it('1. POST /api/v1/shifts: Creates canonical Corporate Default Shift (09:00 AM - 06:00 PM)', async () => {
    const res = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        shiftCode: 'GEN-CORP-TEST',
        name: 'General Corporate Day Shift',
        startTime: '09:00',
        endTime: '18:00',
        graceMinutesIn: 15,
        graceMinutesOut: 15,
        fullDayTargetMinutes: 480,
        breakDurationMinutes: 60,
        isDefault: true
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.data.shiftCode, 'GEN-CORP-TEST')
    assert.strictEqual(res.body.data.startTimeFormatted, '09:00 AM')
    assert.strictEqual(res.body.data.endTimeFormatted, '06:00 PM')
    assert.strictEqual(res.body.data.isDefault, true)
    defaultShift = res.body.data
  })

  it('2. POST /api/v1/shifts: Creates QA Morning Shift (08:00 AM - 05:00 PM)', async () => {
    const res = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        shiftCode: 'QA-MOR-TEST',
        name: 'QA Test Morning Shift',
        startTime: '08:00',
        endTime: '17:00',
        graceMinutesIn: 15,
        graceMinutesOut: 15,
        fullDayTargetMinutes: 480,
        breakDurationMinutes: 60,
        isDefault: false
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.data.shiftCode, 'QA-MOR-TEST')
    assert.strictEqual(res.body.data.startTimeFormatted, '08:00 AM')
    assert.strictEqual(res.body.data.endTimeFormatted, '05:00 PM')
    qaShift = res.body.data
  })

  it('3. POST /api/v1/shifts/assignments: Explicitly assigns QA Morning Shift to EMP-A only from 2026-11-05', async () => {
    const res = await request(app)
      .post('/api/v1/shifts/assignments')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: empA.id,
        shiftId: qaShift.id,
        effectiveFrom: '2026-11-05',
        notes: 'Targeted QA morning schedule assignment'
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.data.employeeId, empA.id)
    assert.strictEqual(res.body.data.shift.shiftCode, 'QA-MOR-TEST')
    assert.strictEqual(res.body.data.status, 'ACTIVE')
  })

  it('4. CRITICAL INVARIANT SHIFT-ISOLATION-01: Proves shift isolation across dates and employees', async () => {
    // A. EMP-A on 2026-11-04 (Before assignment effective date) -> Resolves Corporate Default Shift
    const resA_Nov4 = await request(app)
      .get(`/api/v1/shifts/resolve/${empA.id}?date=2026-11-04`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resA_Nov4.status, 200)
    assert.strictEqual(resA_Nov4.body.data.shift.shiftCode, 'GEN-CORP-TEST')
    assert.strictEqual(resA_Nov4.body.data.assignmentType, 'DEFAULT_CORPORATE')

    // B. EMP-A on 2026-11-05 (Effective date) -> Resolves QA Morning Shift
    const resA_Nov5 = await request(app)
      .get(`/api/v1/shifts/resolve/${empA.id}?date=2026-11-05`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resA_Nov5.status, 200)
    assert.strictEqual(resA_Nov5.body.data.shift.shiftCode, 'QA-MOR-TEST')
    assert.strictEqual(resA_Nov5.body.data.assignmentType, 'EXPLICIT')

    // C. EMP-B on 2026-11-05 (NEVER assigned QA shift) -> MUST resolve to Corporate Default Shift
    const resB_Nov5 = await request(app)
      .get(`/api/v1/shifts/resolve/${empB.id}?date=2026-11-05`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resB_Nov5.status, 200)
    assert.strictEqual(resB_Nov5.body.data.shift.shiftCode, 'GEN-CORP-TEST')
    assert.strictEqual(resB_Nov5.body.data.assignmentType, 'DEFAULT_CORPORATE')
    assert.notStrictEqual(resB_Nov5.body.data.shift.shiftCode, 'QA-MOR-TEST', 'QA shift must NEVER leak to EMP-B!')
  })

  it('5. GET /api/v1/shifts: Lists all active shifts with formatted times', async () => {
    const res = await request(app)
      .get('/api/v1/shifts')
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
    const codes = res.body.data.map((s) => s.shiftCode)
    assert.ok(codes.includes('GEN-CORP-TEST'))
    assert.ok(codes.includes('QA-MOR-TEST'))
  })

  it('Teardown: Cleans up shift fixtures and test employees', async () => {
    if (empA?.id) {
      await prisma.shiftAssignment.deleteMany({ where: { employeeId: { in: [empA.id, empB.id] } } }).catch(() => {})
      await prisma.employee.deleteMany({ where: { id: { in: [empA.id, empB.id] } } }).catch(() => {})
    }
    if (desig?.id) {
      await prisma.designation.delete({ where: { id: desig.id } }).catch(() => {})
    }
    if (dept?.id) {
      await prisma.department.delete({ where: { id: dept.id } }).catch(() => {})
    }
    if (defaultShift?.id || qaShift?.id) {
      await prisma.shift.deleteMany({ where: { id: { in: [defaultShift?.id, qaShift?.id].filter(Boolean) } } }).catch(() => {})
    }
    if (saUser?.id) {
      await prisma.user.delete({ where: { id: saUser.id } }).catch(() => {})
    }
  })
})
