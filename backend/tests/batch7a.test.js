/**
 * iSysware HRMS — Backend Batch 7A Integration Test Suite
 * Tests:
 * 1. Configurable company policies (leaves, overtime, performance, training)
 * 2. Immutability of 31-day salary divisor (strict invariant returns 403)
 * 3. Super Admin permission protection for core financial rules
 * 4. Policy effective-dated audit history and tamper-evident logs
 * 5. Expense category Master CRUD (Add, Edit, Deactivate)
 * 6. Expense claim receipt requirement and category limit enforcement
 * 7. Expense category Safe Delete protection against active/historical claims
 * 8. Reimbursement disbursement payment-account reconciliation
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import supertest from 'supertest'
import app from '../src/app.js'
import prisma from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'
import argon2 from 'argon2'

const request = supertest(app)

describe('Backend Batch 7A — Policy Invariants, Expense Categories & Foundation Suite', () => {
  let superAdminUser, hrAdminUser, deptManagerUser, employeeUser
  let testDepartment, testDesignation, testEmployee, mgrEmployee

  let superAdminToken, hrAdminToken, deptManagerToken, employeeToken

  before(async () => {
    // 1. Create test department & designation
    testDepartment = await prisma.department.create({
      data: {
        code: `DEP-7A-${Date.now()}`,
        name: 'Batch 7A Architecture & Systems',
        status: 'ACTIVE'
      }
    })

    testDesignation = await prisma.designation.create({
      data: {
        code: `DES-7A-${Date.now()}`,
        title: 'Senior Systems Architect',
        level: 'SENIOR',
        status: 'ACTIVE'
      }
    })

    const passwordHash = await argon2.hash('TestAdmin123456!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    })

    // 2. Create actor users
    superAdminUser = await prisma.user.create({
      data: {
        username: `sa7a_${Date.now()}`,
        email: `sa7a_${Date.now()}@isysware.com`,
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        isProtected: true
      }
    })

    hrAdminUser = await prisma.user.create({
      data: {
        username: `hr7a_${Date.now()}`,
        email: `hr7a_${Date.now()}@isysware.com`,
        passwordHash,
        role: 'HR_ADMIN',
        isActive: true
      }
    })

    testEmployee = await prisma.employee.create({
      data: {
        employeeCode: `E7A-${Date.now()}`,
        firstName: 'Zayd',
        lastName: 'Ahmed',
        email: `zayd7a_${Date.now()}@isysware.com`,
        gender: 'MALE',
        dateOfBirth: new Date('1992-05-10'),
        joiningDate: new Date('2026-01-01'),
        departmentId: testDepartment.id,
        designationId: testDesignation.id,
        employmentStatus: 'ACTIVE',
        employmentType: 'PERMANENT',
        workArrangement: 'OFFICE'
      }
    })

    mgrEmployee = await prisma.employee.create({
      data: {
        employeeCode: `M7A-${Date.now()}`,
        firstName: 'Imran',
        lastName: 'Khan',
        email: `imran7a_${Date.now()}@isysware.com`,
        gender: 'MALE',
        dateOfBirth: new Date('1985-04-12'),
        joiningDate: new Date('2025-01-01'),
        departmentId: testDepartment.id,
        designationId: testDesignation.id,
        employmentStatus: 'ACTIVE',
        employmentType: 'PERMANENT',
        workArrangement: 'OFFICE'
      }
    })

    deptManagerUser = await prisma.user.create({
      data: {
        username: `mgr7a_${Date.now()}`,
        email: `mgr7a_${Date.now()}@isysware.com`,
        passwordHash,
        role: 'DEPT_MANAGER',
        employeeId: mgrEmployee.id,
        isActive: true
      }
    })

    employeeUser = await prisma.user.create({
      data: {
        username: `emp7a_${Date.now()}`,
        email: `emp7a_${Date.now()}@isysware.com`,
        passwordHash,
        role: 'EMPLOYEE',
        employeeId: testEmployee.id,
        isActive: true
      }
    })

    superAdminToken = generateAccessToken({ userId: superAdminUser.id, role: superAdminUser.role, email: superAdminUser.email })
    hrAdminToken = generateAccessToken({ userId: hrAdminUser.id, role: hrAdminUser.role, email: hrAdminUser.email })
    deptManagerToken = generateAccessToken({ userId: deptManagerUser.id, role: deptManagerUser.role, email: deptManagerUser.email, employeeId: testEmployee.id })
    employeeToken = generateAccessToken({ userId: employeeUser.id, role: employeeUser.role, email: employeeUser.email, employeeId: testEmployee.id })

    // Clean up any lingering test categories
    const settings = await prisma.organizationSetting.findFirst()
    if (settings && settings.settingsJson?.expenseCategories) {
      const filtered = settings.settingsJson.expenseCategories.filter((c) => c.code !== 'EQUIPMENT')
      await prisma.organizationSetting.update({
        where: { id: settings.id },
        data: { settingsJson: { ...settings.settingsJson, expenseCategories: filtered } }
      })
    }
  })

  after(async () => {
    // Teardown test fixtures
    await prisma.expenseItem.deleteMany({ where: { claim: { employeeId: testEmployee?.id } } })
    await prisma.expenseClaim.deleteMany({ where: { employeeId: testEmployee?.id } })
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: [superAdminUser?.id, hrAdminUser?.id, deptManagerUser?.id, employeeUser?.id].filter(Boolean) } } })
    await prisma.user.deleteMany({ where: { id: { in: [superAdminUser?.id, hrAdminUser?.id, deptManagerUser?.id, employeeUser?.id].filter(Boolean) } } })
    if (testEmployee?.id) await prisma.employee.delete({ where: { id: testEmployee.id } })
    if (mgrEmployee?.id) await prisma.employee.delete({ where: { id: mgrEmployee.id } })
    if (testDesignation?.id) await prisma.designation.delete({ where: { id: testDesignation.id } })
    if (testDepartment?.id) await prisma.department.delete({ where: { id: testDepartment.id } })
  })

  // --------------------------------------------------------------------------
  // 1. POLICY CONFIGURATION & 31-DAY SALARY DIVISOR IMMUTABILITY
  // --------------------------------------------------------------------------

  test('1. Policies API: Fetches company policies with safe default invariants', async () => {
    const res = await request
      .get('/api/v1/admin/policies')
      .set('Authorization', `Bearer ${superAdminToken}`)

    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data.monthlyAllowedLeaves, 2)
    assert.equal(res.body.data.extraLeaveDeductionAmount, 500)
    assert.equal(res.body.data.salaryDivisor, 31)
  })

  test('2. STRICT INVARIANT: Modifying 31-day salary divisor is strictly rejected with 403', async () => {
    const res = await request
      .patch('/api/v1/admin/policies')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        salaryDivisor: 30 // Attempting to change fixed company invariant
      })

    assert.equal(res.status, 403)
    assert.equal(res.body.success, false)
    assert.equal(res.body.error.code, 'FINANCIAL_RULE_PROTECTED')
  })

  test('3. FINANCIAL RULES PERMISSION: Lower roles (HR Admin) blocked from changing financial leave deduction', async () => {
    const res = await request
      .patch('/api/v1/admin/policies')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({
        extraLeaveDeductionAmount: 1000 // Only Super Admin can change core financial rules
      })

    assert.equal(res.status, 403)
    assert.equal(res.body.success, false)
    assert.equal(res.body.error.code, 'SUPER_ADMIN_REQUIRED')
  })

  test('4. Super Admin can update operational policies with audit history trail', async () => {
    const res = await request
      .patch('/api/v1/admin/policies')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        overtimeThresholdMinutes: 75,
        trainingPassingScore: 75,
        effectiveFrom: '2026-11-01T00:00:00.000Z'
      })

    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data.overtimeThresholdMinutes, 75)
    assert.equal(res.body.data.trainingPassingScore, 75)
    assert.equal(res.body.data.salaryDivisor, 31) // Intact
    assert.ok(Array.isArray(res.body.data.auditHistory))
    assert.ok(res.body.data.auditHistory.length > 0)
    assert.equal(res.body.data.auditHistory[0].actorRole, 'SUPER_ADMIN')
  })

  // --------------------------------------------------------------------------
  // 2. EXPENSE CATEGORY MASTER & POLICIES
  // --------------------------------------------------------------------------

  test('5. Expense Categories Master: Lists categories and allows creating new category', async () => {
    const listRes = await request
      .get('/api/v1/expenses/categories')
      .set('Authorization', `Bearer ${superAdminToken}`)

    assert.equal(listRes.status, 200)
    assert.ok(Array.isArray(listRes.body.data))
    assert.ok(listRes.body.data.some((c) => c.code === 'MEALS'))

    const createRes = await request
      .post('/api/v1/expenses/categories')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        code: 'EQUIPMENT',
        name: 'Hardware & Peripheral Supplies',
        maxLimit: 12000,
        receiptRequired: true,
        isActive: true
      })

    assert.equal(createRes.status, 201)
    assert.equal(createRes.body.data.code, 'EQUIPMENT')
    assert.equal(createRes.body.data.maxLimit, 12000)
  })

  test('6. Expense Category Deactivation: Deactivated category rejects new claim submission', async () => {
    // 1. Deactivate category
    const patchRes = await request
      .patch('/api/v1/expenses/categories/EQUIPMENT')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ isActive: false })

    assert.equal(patchRes.status, 200)
    assert.equal(patchRes.body.data.isActive, false)

    // 2. Submit claim with deactivated category -> Rejected
    const claimRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        claimTitle: 'Wireless Keyboard & Mouse',
        items: [
          {
            category: 'EQUIPMENT',
            expenseDate: '2026-11-04',
            amount: 4500,
            merchantName: 'Tech Central',
            receiptUrl: 'https://docs.isysware.com/receipt-001.pdf'
          }
        ]
      })

    assert.equal(claimRes.status, 400)
    assert.equal(claimRes.body.error.code, 'CATEGORY_DEACTIVATED')

    // 3. Reactivate category
    await request
      .patch('/api/v1/expenses/categories/EQUIPMENT')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ isActive: true })
  })

  test('7. Expense Policy Validation: Enforces receipt requirement and category limits', async () => {
    // Explicitly configure MEALS category policy: receiptRequired = true, maxLimit = 5000
    await request
      .patch('/api/v1/expenses/categories/MEALS')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ receiptRequired: true, maxLimit: 5000 })

    // 1. Missing receipt for receiptRequired category -> 400
    const noReceiptRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        claimTitle: 'Official External Meeting Meals',
        items: [
          {
            category: 'MEALS',
            expenseDate: '2026-11-04',
            amount: 2500,
            merchantName: 'Cafe Aylanto'
            // Missing receiptUrl
          }
        ]
      })

    assert.equal(noReceiptRes.status, 400)
    assert.equal(noReceiptRes.body.error.code, 'RECEIPT_REQUIRED')

    // 2. Amount exceeding category maxLimit (MEALS max limit is 5000) -> 400
    const overLimitRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        claimTitle: 'Lavish Team Lunch',
        items: [
          {
            category: 'MEALS',
            expenseDate: '2026-11-04',
            amount: 7500, // Exceeds 5000 PKR max limit
            merchantName: 'PC Hotel Diners',
            receiptUrl: 'https://docs.isysware.com/lunch-pc.pdf'
          }
        ]
      })

    assert.equal(overLimitRes.status, 400)
    assert.equal(overLimitRes.body.error.code, 'CATEGORY_LIMIT_EXCEEDED')

    // Restore MEALS category policy for subsequent suites
    await request
      .patch('/api/v1/expenses/categories/MEALS')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ receiptRequired: false, maxLimit: 20000 })
  })

  test('8. SAFE DELETE PROTECTION: Blocks deleting expense category when claim history exists', async () => {
    // 1. Create valid claim using OTHER category
    const validClaimRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        claimTitle: 'Client Refreshments',
        items: [
          {
            category: 'OTHER',
            expenseDate: '2026-11-04',
            amount: 1500,
            merchantName: 'General Store',
            receiptUrl: 'https://docs.isysware.com/rec-1500.pdf',
            notes: 'Mineral water & cookies'
          }
        ]
      })

    assert.equal(validClaimRes.status, 201)

    // 2. Attempt deleting 'OTHER' category -> BLOCKED with 400
    const deleteRes = await request
      .delete('/api/v1/expenses/categories/OTHER')
      .set('Authorization', `Bearer ${superAdminToken}`)

    assert.equal(deleteRes.status, 400)
    assert.equal(deleteRes.body.error.code, 'CATEGORY_IN_USE_SAFE_DELETE_ENFORCED')

    // 3. Deleting unused 'EQUIPMENT' category -> SUCCEEDS
    const deleteUnusedRes = await request
      .delete('/api/v1/expenses/categories/EQUIPMENT')
      .set('Authorization', `Bearer ${superAdminToken}`)

    assert.equal(deleteUnusedRes.status, 200)
    assert.equal(deleteUnusedRes.body.data.deleted, true)
  })

  test('9. Reimbursement Disbursement: Records payment account reconciliation reference', async () => {
    // 1. Create & approve a claim
    const claimRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        claimTitle: 'Domestic Taxi Dispatch',
        items: [
          {
            category: 'TRANSPORT',
            expenseDate: '2026-11-04',
            amount: 2200,
            merchantName: 'Airport Cab Service',
            receiptUrl: 'https://docs.isysware.com/taxi-receipt.pdf'
          }
        ]
      })

    const claimId = claimRes.body.data.id

    // Approve claim
    await request
      .patch(`/api/v1/expenses/claims/${claimId}/review`)
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({ action: 'APPROVE', remarks: 'Verified taxi receipt' })

    // 2. Disburse claim with explicit payment account reference
    const disburseRes = await request
      .post(`/api/v1/expenses/claims/${claimId}/disburse`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'FT-HBL-20261105-0991',
        paymentAccount: 'Bank Alfalah Corporate Operating A/C #0219-100482810'
      })

    assert.equal(disburseRes.status, 200)
    assert.equal(disburseRes.body.data.status, 'DISBURSED')
    assert.equal(disburseRes.body.data.paymentMethod, 'BANK_TRANSFER')
    assert.equal(disburseRes.body.data.transactionReference, 'FT-HBL-20261105-0991')

    // 3. Verify audit log captured payment account trail
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        entityId: claimId,
        actionType: 'DISBURSE_REIMBURSEMENT'
      }
    })

    assert.ok(auditRecord)
    assert.equal(auditRecord.recordSnapshotAfter.paymentAccount, 'Bank Alfalah Corporate Operating A/C #0219-100482810')
  })
})
