import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Expense History & Audit — PostgreSQL Persistence, Idempotency & Search/Filter Suite', () => {
  let saUser = null
  let saToken = null
  let emp = null
  let cat = null
  let claim = null

  it('Setup: Resolves Super Admin, active Employee, and Category fixtures', async () => {
    saUser = await prisma.user.findFirst({
        where: { role: 'SUPER_ADMIN', isActive: true }
      })
      if (!saUser) {
        saUser = await prisma.user.create({
          data: {
            username: `sa_audit_${Date.now()}`,
            email: `sa.audit.${Date.now()}@isysware.test`,
            passwordHash: '$argon2id$mock',
            role: 'SUPER_ADMIN',
            isProtected: true
          }
        })
      }
      saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })

      emp = await prisma.employee.findFirst({
        where: { employmentStatus: 'ACTIVE' }
      })
      if (!emp) {
        let dept = await prisma.department.findFirst()
        if (!dept) {
          dept = await prisma.department.create({
            data: { code: 'DEP-EXP-QA', name: 'Finance & Accounts' }
          })
        }
        let desig = await prisma.designation.findFirst()
        if (!desig) {
          desig = await prisma.designation.create({
            data: { code: 'DES-EXP-QA', title: 'Accounts Officer', level: 'MID' }
          })
        }
        emp = await prisma.employee.create({
          data: {
            employeeCode: `EMP-EXP-${Date.now()}`,
            firstName: 'Audit',
            lastName: 'Tester',
            email: `audit.tester.${Date.now()}@isysware.test`,
            joiningDate: new Date('2026-10-26'),
            department: { connect: { id: dept.id } },
            designation: { connect: { id: desig.id } },
            employmentStatus: 'ACTIVE'
          }
        })
      }
      assert.ok(emp, 'Active employee must exist in PostgreSQL')

    cat = { code: 'MEALS' }
  })

  it('1. Idempotency Safeguard: Duplicate disbursement calls with same transaction reference return cleanly without duplicate audit logs', async () => {
    // Create an approved expense claim
    const claimRes = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: emp.id,
        category: 'MEALS',
        amount: 2500,
        expenseDate: '2026-11-13',
        description: 'Team working lunch QA test'
      })
    assert.equal(claimRes.status, 201)
    claim = claimRes.body.data

    // Approve claim
    const approveRes = await request(app)
      .patch(`/api/v1/expenses/claims/${claim.id}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ action: 'APPROVE', remarks: 'Approved for QA reimbursement test' })
    assert.equal(approveRes.status, 200)

    const initialAuditCount = await prisma.auditLog.count({
      where: { sourceModule: 'EXPENSES', entityId: claim.id }
    })

    const txnRef = `TXN-IDEMP-${Date.now()}`

    // 1st Disbursement
    const disbRes1 = await request(app)
      .post(`/api/v1/expenses/claims/${claim.id}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: txnRef,
        amount: 2500,
        notes: 'First disbursement attempt'
      })
    assert.equal(disbRes1.status, 200)
    assert.equal(disbRes1.body.data.status, 'DISBURSED')

    const afterFirstDisbCount = await prisma.auditLog.count({
      where: {
        sourceModule: 'EXPENSES',
        entityId: claim.id,
        actionType: 'DISBURSE_REIMBURSEMENT'
      }
    })
    assert.equal(afterFirstDisbCount, 1, 'Exactly 1 DISBURSE_REIMBURSEMENT audit log must be recorded')

    // 2nd Disbursement (Simulate network retry / duplicate click with SAME transaction reference)
    const disbRes2 = await request(app)
      .post(`/api/v1/expenses/claims/${claim.id}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: txnRef,
        amount: 2500,
        notes: 'Duplicate click retry attempt'
      })
    assert.equal(disbRes2.status, 200, 'Idempotent retry should succeed without throwing error')
    assert.equal(disbRes2.body.data.status, 'DISBURSED')

    // Verify audit logs were NOT duplicated!
    const afterSecondDisbCount = await prisma.auditLog.count({
      where: {
        sourceModule: 'EXPENSES',
        entityId: claim.id,
        actionType: 'DISBURSE_REIMBURSEMENT'
      }
    })
    assert.equal(afterSecondDisbCount, 1, 'Idempotency invariant: Audit count must strictly remain 1 (no duplicate emission)')
  })

  it('2. Audit Log API Filtering: Supports action filter, claim search, and pagination', async () => {
    // Query all logs
    const allRes = await request(app)
      .get('/api/v1/expenses/audit-logs')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(allRes.status, 200)
    assert.ok(Array.isArray(allRes.body.data))
    assert.ok(allRes.body.data.length > 0)

    // Filter by action = DISBURSE_REIMBURSEMENT
    const disbOnlyRes = await request(app)
      .get('/api/v1/expenses/audit-logs?action=DISBURSE_REIMBURSEMENT')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(disbOnlyRes.status, 200)
    assert.ok(disbOnlyRes.body.data.every((l) => l.action === 'DISBURSE_REIMBURSEMENT'))

    // Search by specific claimNumber
    const claimSearchRes = await request(app)
      .get(`/api/v1/expenses/audit-logs?search=${encodeURIComponent(claim.claimNumber)}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(claimSearchRes.status, 200)
    assert.ok(claimSearchRes.body.data.some((l) => l.entityId === claim.id || l.claimNumber === claim.claimNumber))

    // Pagination metadata check
    assert.ok(allRes.body.meta?.pagination, 'Response metadata must contain pagination')
    assert.equal(allRes.body.meta.pagination.page, 1)
  })

  it('3. Reversal Integrity: Can reverse reimbursement with mandatory audit log and block double-reversal', async () => {
    const reimbId = (await prisma.auditLog.findFirst({
      where: { entityId: claim.id, actionType: 'DISBURSE_REIMBURSEMENT' }
    }))?.recordSnapshotAfter?.reimbursementId

    assert.ok(reimbId, 'Reimbursement ID must be present in snapshot')

    // Reverse reimbursement
    const revRes = await request(app)
      .post(`/api/v1/expenses/claims/${claim.id}/reverse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        reimbursementId: reimbId,
        reason: 'QA Audit verification: reversing reimbursement payment'
      })
    assert.equal(revRes.status, 200)

    // Check REIMBURSEMENT_REVERSED audit log
    const revLog = await prisma.auditLog.findFirst({
      where: { entityId: claim.id, actionType: 'REIMBURSEMENT_REVERSED' }
    })
    assert.ok(revLog, 'REIMBURSEMENT_REVERSED audit log must be recorded')

    // Attempt second reversal (should fail with 400 ALREADY_REVERSED)
    const revRes2 = await request(app)
      .post(`/api/v1/expenses/claims/${claim.id}/reverse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        reimbursementId: reimbId,
        reason: 'Duplicate reversal attempt'
      })
    assert.equal(revRes2.status, 400)
  })

  it('Teardown: Cleans up temporary claim fixtures while preserving audit trail', async () => {
    // Delete test claim
    if (claim) {
      await prisma.expenseItem.deleteMany({ where: { claimId: claim.id } }).catch(() => {})
      await prisma.expenseClaim.delete({ where: { id: claim.id } }).catch(() => {})
    }
  })
})
