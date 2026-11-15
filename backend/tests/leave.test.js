import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Backend Batch 5 — Leave Management & Annual Escalation Suite', () => {
  let saUser = null
  let mgrUser = null
  let tlUser = null
  let empUser = null
  let saToken = null
  let mgrToken = null
  let tlToken = null
  let empToken = null

  let dept = null
  let team = null
  let desigMgr = null
  let desigTl = null
  let desigEmp = null

  let manager = null
  let teamLead = null
  let employee = null
  let leaveType = null

  let req1Id = null
  let req2Id = null
  let req3Id = null

  it('Setup: Prepares 3-tier reporting hierarchy, accounts, leave type, and 14-day balance', async () => {
    dept = await prisma.department.create({
      data: { code: 'DEP-LV-TEST', name: 'Leave Testing Department' }
    })
    team = await prisma.team.create({
      data: { code: 'TEAM-LV-TEST', name: 'Core Platform Team', departmentId: dept.id }
    })

    desigMgr = await prisma.designation.create({
      data: { code: 'DES-LV-MGR', title: 'Department Director', level: 'EXECUTIVE' }
    })
    desigTl = await prisma.designation.create({
      data: { code: 'DES-LV-TL', title: 'Engineering Lead', level: 'SENIOR' }
    })
    desigEmp = await prisma.designation.create({
      data: { code: 'DES-LV-EMP', title: 'Software Engineer', level: 'MID' }
    })

    // 1. Manager
    manager = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-LV-MGR',
        firstName: 'Imran',
        lastName: 'Manager',
        email: 'imran.mgr@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desigMgr.id,
        employmentStatus: 'ACTIVE'
      }
    })
    mgrUser = await prisma.user.create({
      data: {
        username: 'lv_test_mgr',
        email: 'imran.mgr@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'DEPT_MANAGER',
        employeeId: manager.id
      }
    })

    // 2. Team Lead
    teamLead = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-LV-TL',
        firstName: 'Farhan',
        lastName: 'Lead',
        email: 'farhan.tl@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        teamId: team.id,
        designationId: desigTl.id,
        reportingManagerId: manager.id,
        employmentStatus: 'ACTIVE'
      }
    })
    tlUser = await prisma.user.create({
      data: {
        username: 'lv_test_tl',
        email: 'farhan.tl@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'TEAM_LEAD',
        employeeId: teamLead.id
      }
    })

    // 3. Regular Employee
    employee = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-LV-001',
        firstName: 'Kashif',
        lastName: 'Staff',
        email: 'kashif.staff@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        teamId: team.id,
        designationId: desigEmp.id,
        reportingManagerId: teamLead.id,
        employmentStatus: 'ACTIVE'
      }
    })
    empUser = await prisma.user.create({
      data: {
        username: 'lv_test_emp',
        email: 'kashif.staff@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE',
        employeeId: employee.id
      }
    })

    // 4. Super Admin
    saUser = await prisma.user.create({
      data: {
        username: 'lv_test_sa',
        email: 'sa.lv@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })

    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })
    mgrToken = generateAccessToken({ userId: mgrUser.id, role: 'DEPT_MANAGER', employeeId: manager.id })
    tlToken = generateAccessToken({ userId: tlUser.id, role: 'TEAM_LEAD', employeeId: teamLead.id })
    empToken = generateAccessToken({ userId: empUser.id, role: 'EMPLOYEE', employeeId: employee.id })

    // Create Leave Type
    leaveType = await prisma.leaveType.create({
      data: {
        code: 'ANNUAL-TEST',
        name: 'Annual Paid Leave',
        defaultDaysPerYear: 14.0,
        isPaid: true
      }
    })

    // Initialize 14 days entitlement
    await prisma.leaveEntitlement.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        calendarYear: 2026,
        openingBalance: 14.0,
        allocatedDays: 14.0,
        utilizedDays: 0,
        pendingDays: 0,
        availableBalance: 14.0
      }
    })

    assert.ok(saToken)
    assert.ok(mgrToken)
    assert.ok(tlToken)
    assert.ok(empToken)
  })

  it('1. POST /api/v1/leaves/apply: Applies for 1st leave -> routes to TEAM_LEAD', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/apply')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType.id,
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        durationDays: 1.0,
        reason: 'Personal family event'
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.success, true)
    assert.strictEqual(res.body.data.annualSequenceNumber, 1)
    assert.strictEqual(res.body.data.routingTier, 'TEAM_LEAD')
    req1Id = res.body.data.id

    // Verify available balance decreased from 14 to 13
    const ent = await prisma.leaveEntitlement.findFirst({
      where: { employeeId: employee.id, leaveTypeId: leaveType.id }
    })
    assert.strictEqual(Number(ent.availableBalance), 13)
    assert.strictEqual(Number(ent.pendingDays), 1)
  })

  it('2. PATCH /api/v1/leaves/:id/review: Team Lead approves Request 1', async () => {
    const res = await request(app)
      .patch(`/api/v1/leaves/${req1Id}/review`)
      .set('Authorization', `Bearer ${tlToken}`)
      .send({
        decision: 'APPROVED',
        remarks: 'Approved by Team Lead'
      })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.data.status, 'APPROVED')

    // Verify balance moved from pending to utilized
    const ent = await prisma.leaveEntitlement.findFirst({
      where: { employeeId: employee.id, leaveTypeId: leaveType.id }
    })
    assert.strictEqual(Number(ent.pendingDays), 0)
    assert.strictEqual(Number(ent.utilizedDays), 1)

    // Verify journal utilization record
    const journal = await prisma.leaveBalanceJournal.findFirst({
      where: { referenceRequestId: req1Id }
    })
    assert.ok(journal)
    assert.strictEqual(journal.transactionType, 'UTILIZATION')
  })

  it('3. POST & PATCH /api/v1/leaves: Applies and approves 2nd leave -> still routes to TEAM_LEAD', async () => {
    const resApply = await request(app)
      .post('/api/v1/leaves/apply')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType.id,
        startDate: '2026-11-12',
        endDate: '2026-11-12',
        durationDays: 1.0,
        reason: 'Routine appointment'
      })

    assert.strictEqual(resApply.status, 201)
    assert.strictEqual(resApply.body.data.annualSequenceNumber, 2)
    assert.strictEqual(resApply.body.data.routingTier, 'TEAM_LEAD')
    req2Id = resApply.body.data.id

    const resReview = await request(app)
      .patch(`/api/v1/leaves/${req2Id}/review`)
      .set('Authorization', `Bearer ${tlToken}`)
      .send({
        decision: 'APPROVED',
        remarks: 'Approved 2nd request'
      })

    assert.strictEqual(resReview.status, 200)
    assert.strictEqual(resReview.body.data.status, 'APPROVED')
  })

  it('4. CRITICAL INVARIANT: 3rd leave request in calendar year ESCALATES to DEPT_MANAGER', async () => {
    // Normal employee's 3rd approved qualifying request in the year must route to DEPT_MANAGER!
    const resApply = await request(app)
      .post('/api/v1/leaves/apply')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType.id,
        startDate: '2026-11-15',
        endDate: '2026-11-16',
        durationDays: 2.0,
        reason: 'Out of station travel'
      })

    assert.strictEqual(resApply.status, 201)
    assert.strictEqual(resApply.body.data.annualSequenceNumber, 3, 'Must be identified as 3rd request in year')
    assert.strictEqual(
      resApply.body.data.routingTier,
      'DEPT_MANAGER',
      'CRITICAL INVARIANT: Request 3+ must escalate to DEPT_MANAGER'
    )
    req3Id = resApply.body.data.id
  })

  it('5. PATCH /api/v1/leaves/:id/review: Enforces Anti-Self-Approval', async () => {
    const res = await request(app)
      .patch(`/api/v1/leaves/${req3Id}/review`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        decision: 'APPROVED',
        remarks: 'Attempting self-approval'
      })

    assert.strictEqual(res.status, 403)
  })

  it('6. PATCH /api/v1/leaves/:id/review: Department Manager approves escalated 3rd request', async () => {
    const res = await request(app)
      .patch(`/api/v1/leaves/${req3Id}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        decision: 'APPROVED',
        remarks: 'Escalated 3rd leave request approved by Department Director'
      })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.data.status, 'APPROVED')
    assert.strictEqual(res.body.data.approvedByRole, 'DEPT_MANAGER')
  })

  it('7. POST /api/v1/leaves/:id/cancel: Idempotent cancellation posts reversal journal entry and restores balance', async () => {
    // Current utilized is 1 + 1 + 2 = 4 days
    // Cancelling Request 3 (2 days)
    const resCancel = await request(app)
      .post(`/api/v1/leaves/${req3Id}/cancel`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        reason: 'Travel plans called off due to urgent project sprint'
      })

    assert.strictEqual(resCancel.status, 200)
    assert.strictEqual(resCancel.body.data.status, 'CANCELLED')

    // Verify balance restored: utilized decreased by 2, available increased by 2
    const ent = await prisma.leaveEntitlement.findFirst({
      where: { employeeId: employee.id, leaveTypeId: leaveType.id }
    })
    assert.strictEqual(Number(ent.utilizedDays), 2)
    assert.strictEqual(Number(ent.availableBalance), 12)

    // Verify offsetting reversal ledger journal entry
    const reversalJournal = await prisma.leaveBalanceJournal.findFirst({
      where: { referenceRequestId: req3Id, transactionType: 'REVERSAL' }
    })
    assert.ok(reversalJournal, 'Reversal journal entry must be created')
    assert.strictEqual(Number(reversalJournal.days), 2)

    // Duplicate cancellation attempt must be rejected with 400
    const resDupCancel = await request(app)
      .post(`/api/v1/leaves/${req3Id}/cancel`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        reason: 'Duplicate cancellation'
      })

    assert.strictEqual(resDupCancel.status, 400)
    assert.strictEqual(resDupCancel.body.error.code, 'ALREADY_CANCELLED')
  })

  it('Teardown: Cleans up leave fixtures, entitlements, and test accounts', async () => {
    if (employee?.id) {
      await prisma.leaveBalanceJournal.deleteMany({ where: { employeeId: employee.id } }).catch(() => {})
      await prisma.leaveRequest.deleteMany({ where: { employeeId: employee.id } }).catch(() => {})
      await prisma.leaveEntitlement.deleteMany({ where: { employeeId: employee.id } }).catch(() => {})
    }
    if (leaveType?.id) {
      await prisma.leavePolicy.deleteMany({ where: { leaveTypeId: leaveType.id } }).catch(() => {})
      await prisma.leaveType.delete({ where: { id: leaveType.id } }).catch(() => {})
    }
    if (saUser?.id || mgrUser?.id || tlUser?.id || empUser?.id) {
      await prisma.user.deleteMany({
        where: { id: { in: [saUser?.id, mgrUser?.id, tlUser?.id, empUser?.id].filter(Boolean) } }
      }).catch(() => {})
    }
    if (employee?.id || teamLead?.id || manager?.id) {
      await prisma.employee.deleteMany({
        where: { id: { in: [employee?.id, teamLead?.id, manager?.id].filter(Boolean) } }
      }).catch(() => {})
    }
    if (team?.id) {
      await prisma.team.delete({ where: { id: team.id } }).catch(() => {})
    }
    if (desigEmp?.id || desigTl?.id || desigMgr?.id) {
      await prisma.designation.deleteMany({
        where: { id: { in: [desigEmp?.id, desigTl?.id, desigMgr?.id].filter(Boolean) } }
      }).catch(() => {})
    }
    if (dept?.id) {
      await prisma.department.delete({ where: { id: dept.id } }).catch(() => {})
    }
  })
})
