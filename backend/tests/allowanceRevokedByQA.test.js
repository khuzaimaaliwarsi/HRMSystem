import { test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

test('Allowance Revoked By Bug Fix — Verification Suite', async (t) => {
  let superAdminUser = null
  let superAdminToken = ''

  await t.test('1. Setup: Resolve Super Admin portal identity & auth token', async () => {
    superAdminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })
    if (!superAdminUser) {
      superAdminUser = await prisma.user.create({
        data: {
          username: 'superadmin_qa',
          displayName: 'Super Admin',
          email: 'superadmin_qa@isysware.com',
          passwordHash: '$argon2id$mock',
          role: 'SUPER_ADMIN',
          isProtected: true
        }
      })
    }
    assert.ok(superAdminUser)
    assert.equal(superAdminUser.role, 'SUPER_ADMIN')

    superAdminToken = generateAccessToken({
      id: superAdminUser.id,
      role: superAdminUser.role,
      username: superAdminUser.username,
      email: superAdminUser.email
    })
    assert.ok(superAdminToken)
  })

  await t.test('2. GET /api/v1/payroll/employee-allowances?status=ALL resolves portal accounts correctly', async () => {
    const res = await request(app)
      .get('/api/v1/payroll/employee-allowances?status=ALL')
      .set('Authorization', `Bearer ${superAdminToken}`)

    assert.equal(res.status, 200)
    const allocations = res.body.data || res.body
    assert.ok(Array.isArray(allocations))
    assert.ok(allocations.length > 0)

    // Verify all revoked records show 'Super Admin (superadmin)' and never 'Khuzaima Senior Developer'
    for (const a of allocations) {
      if (a.computedStatus === 'Revoked') {
        assert.notEqual(
          a.revokedBy,
          'Khuzaima Senior Developer (EMP-001)',
          `Record ${a.id} incorrectly shows EMP-001 as revokedBy`
        )
        assert.ok(
          !String(a.revokedBy).includes('Khuzaima Senior Developer'),
          `Record ${a.id} should not attribute revocation to employee EMP-001`
        )
        assert.equal(
          a.revokedBy,
          'Super Admin (superadmin)',
          `Record ${a.id} should show 'Super Admin (superadmin)'`
        )
      }
      if (a.approvedById === superAdminUser.id) {
        assert.notEqual(
          a.assignedBy,
          'Khuzaima Senior Developer (SUPER_ADMIN)',
          `Record ${a.id} incorrectly attributes Super Admin approval to EMP-001`
        )
        assert.equal(
          a.assignedBy,
          'Super Admin (SUPER_ADMIN)',
          `Record ${a.id} should show 'Super Admin (SUPER_ADMIN)'`
        )
      }
    }
  })

  await t.test('3. Future Revocation: records userId, role, and attributes to portal Super Admin identity', async () => {
    const employee = await prisma.employee.findFirst({
      where: { employmentStatus: 'ACTIVE' }
    })
    const allowance = await prisma.allowance.findFirst({
      where: { isActive: true }
    })
    assert.ok(employee, 'Must have an active employee')
    assert.ok(allowance, 'Must have an active allowance')

    // Create a temporary allocation
    const createdAlloc = await prisma.employeeAllowance.create({
      data: {
        employeeId: employee.id,
        allowanceId: allowance.id,
        amount: 3000,
        effectiveFrom: new Date(),
        isActive: true,
        approvedById: superAdminUser.id,
        remarks: 'Temporary QA Allocation for Revocation Test'
      }
    })

    // Revoke through API
    const revokeReason = 'QA verification of revoker identity and audit trail'
    const revokeRes = await request(app)
      .delete(`/api/v1/payroll/employee-allowances/${createdAlloc.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: revokeReason })

    assert.equal(revokeRes.status, 200)
    assert.equal(revokeRes.body.data.isActive, false)

    // Verify stored remarks in PostgreSQL
    const freshDbRecord = await prisma.employeeAllowance.findUnique({
      where: { id: createdAlloc.id }
    })
    assert.ok(freshDbRecord.remarks.includes('Super Admin (superadmin)'))
    assert.ok(freshDbRecord.remarks.includes(`userId:${superAdminUser.id}`))
    assert.ok(freshDbRecord.remarks.includes('role:SUPER_ADMIN'))
    assert.ok(freshDbRecord.remarks.includes(revokeReason))

    // Verify GET response
    const listRes = await request(app)
      .get('/api/v1/payroll/employee-allowances?status=ALL')
      .set('Authorization', `Bearer ${superAdminToken}`)

    const listedItem = listRes.body.data.find((x) => x.id === createdAlloc.id)
    assert.ok(listedItem)
    assert.equal(listedItem.computedStatus, 'Revoked')
    assert.equal(listedItem.revokedBy, 'Super Admin (superadmin)')
    assert.ok(listedItem.revokedAt)

    // Cleanup the temporary test allocation
    await prisma.employeeAllowance.delete({
      where: { id: createdAlloc.id }
    })
  })
})
