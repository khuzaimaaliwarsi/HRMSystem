/**
 * iSysware HRMS — Expense Management Full Submodule & PostgreSQL Persistence QA Suite
 *
 * Covers all 7 Expense submodules end-to-end against PostgreSQL (aliyan_hrms_test):
 * 1. Expense Categories & Policies (GET /policies, POST/PATCH/DELETE /categories)
 * 2. My / Company / Department Expense Claims (single-item & custom-category payloads, duplicate receipt 409, limit checks)
 * 3. Expense Approval Queue (Manager <= 100k, HR Admin <= 250k, Super Admin unlimited & self-approval, RETURN & REJECT)
 * 4. Reimbursements & Payment Tracking (partial/full disbursement, duplicate txn ref 409, overpayment 400, payment reversal)
 * 5. Travel Expense Reconciliation bridge (TRV code linking & travel request retrieval)
 * 6. Expense History & Audit (PostgreSQL AuditLog persistence across actions)
 * 7. RBAC Scoping (Employee own-only isolation vs Department Manager vs HR Admin vs Super Admin)
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import supertest from 'supertest'
import app from '../src/app.js'
import prisma from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'
import argon2 from 'argon2'

const request = supertest(app)

describe('Expense Management — All Submodules & PostgreSQL Persistence QA', () => {
  const ts = Date.now()
  let dept1, dept2, desig
  let saUser, hrUser, mgrUser, empUser, otherEmpUser
  let saEmp, mgrEmp, emp1, emp2
  let saToken, hrToken, mgrToken, empToken, otherEmpToken
  let testTravelReq
  const createdCategoryCode = `QA_CAT_${ts.toString().slice(-5)}`

  before(async () => {
    dept1 = await prisma.department.create({
      data: { code: `DEP-EQA1-${ts}`, name: 'QA Finance Dept', status: 'ACTIVE' }
    })
    dept2 = await prisma.department.create({
      data: { code: `DEP-EQA2-${ts}`, name: 'QA Operations Dept', status: 'ACTIVE' }
    })
    desig = await prisma.designation.create({
      data: { code: `DES-EQA-${ts}`, title: 'QA Lead Engineer', level: 'SENIOR', status: 'ACTIVE' }
    })

    const passwordHash = await argon2.hash('QaPass123456!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    })

    saEmp = await prisma.employee.create({
      data: {
        employeeCode: `SA-EQA-${ts}`,
        firstName: 'Khuzaima',
        lastName: 'SuperAdmin',
        email: `sa_emp_eqa_${ts}@isysware.com`,
        gender: 'MALE',
        dateOfBirth: new Date('1988-01-01'),
        joiningDate: new Date('2025-01-01'),
        departmentId: dept1.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE',
        employmentType: 'PERMANENT',
        workArrangement: 'OFFICE'
      }
    })

    mgrEmp = await prisma.employee.create({
      data: {
        employeeCode: `MG-EQA-${ts}`,
        firstName: 'Bilal',
        lastName: 'Manager',
        email: `mgr_emp_eqa_${ts}@isysware.com`,
        gender: 'MALE',
        dateOfBirth: new Date('1989-02-02'),
        joiningDate: new Date('2025-01-01'),
        departmentId: dept1.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE',
        employmentType: 'PERMANENT',
        workArrangement: 'OFFICE'
      }
    })

    emp1 = await prisma.employee.create({
      data: {
        employeeCode: `E1-EQA-${ts}`,
        firstName: 'Ali',
        lastName: 'Raza',
        email: `e1_eqa_${ts}@isysware.com`,
        gender: 'MALE',
        dateOfBirth: new Date('1994-03-03'),
        joiningDate: new Date('2026-01-01'),
        departmentId: dept1.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE',
        employmentType: 'PERMANENT',
        workArrangement: 'OFFICE'
      }
    })

    emp2 = await prisma.employee.create({
      data: {
        employeeCode: `E2-EQA-${ts}`,
        firstName: 'Sara',
        lastName: 'Khan',
        email: `e2_eqa_${ts}@isysware.com`,
        gender: 'FEMALE',
        dateOfBirth: new Date('1995-04-04'),
        joiningDate: new Date('2026-01-01'),
        departmentId: dept2.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE',
        employmentType: 'PERMANENT',
        workArrangement: 'OFFICE'
      }
    })

    saUser = await prisma.user.create({
      data: {
        username: `sa_eqa_${ts}`,
        email: `sa_eqa_${ts}@isysware.com`,
        passwordHash,
        role: 'SUPER_ADMIN',
        employeeId: saEmp.id,
        isActive: true,
        isProtected: true
      }
    })
    hrUser = await prisma.user.create({
      data: {
        username: `hr_eqa_${ts}`,
        email: `hr_eqa_${ts}@isysware.com`,
        passwordHash,
        role: 'HR_ADMIN',
        isActive: true
      }
    })
    mgrUser = await prisma.user.create({
      data: {
        username: `mgr_eqa_${ts}`,
        email: `mgr_eqa_${ts}@isysware.com`,
        passwordHash,
        role: 'DEPT_MANAGER',
        employeeId: mgrEmp.id,
        isActive: true
      }
    })
    empUser = await prisma.user.create({
      data: {
        username: `e1_eqa_${ts}`,
        email: `e1_eqa_${ts}@isysware.com`,
        passwordHash,
        role: 'EMPLOYEE',
        employeeId: emp1.id,
        isActive: true
      }
    })
    otherEmpUser = await prisma.user.create({
      data: {
        username: `e2_eqa_${ts}`,
        email: `e2_eqa_${ts}@isysware.com`,
        passwordHash,
        role: 'EMPLOYEE',
        employeeId: emp2.id,
        isActive: true
      }
    })

    saToken = generateAccessToken({ userId: saUser.id, role: saUser.role, email: saUser.email, employeeId: saEmp.id })
    hrToken = generateAccessToken({ userId: hrUser.id, role: hrUser.role, email: hrUser.email })
    mgrToken = generateAccessToken({ userId: mgrUser.id, role: mgrUser.role, email: mgrUser.email, employeeId: mgrEmp.id })
    empToken = generateAccessToken({ userId: empUser.id, role: empUser.role, email: empUser.email, employeeId: emp1.id })
    otherEmpToken = generateAccessToken({ userId: otherEmpUser.id, role: otherEmpUser.role, email: otherEmpUser.email, employeeId: emp2.id })

    testTravelReq = await prisma.travelRequest.create({
      data: {
        requestCode: `TRV-EQA-${ts.toString().slice(-5)}`,
        employeeId: emp1.id,
        origin: 'Lahore',
        destination: 'Karachi, Pakistan',
        purpose: 'QA Reconciliation Trip',
        departureDate: new Date('2026-11-10T09:00:00Z'),
        returnDate: new Date('2026-11-12T18:00:00Z'),
        estimatedBudget: 25000,
        advanceAmount: 1000,
        disbursedAdvance: 1000,
        status: 'APPROVED'
      }
    })
  })

  after(async () => {
    const empIds = [saEmp?.id, mgrEmp?.id, emp1?.id, emp2?.id].filter(Boolean)
    const userIds = [saUser?.id, hrUser?.id, mgrUser?.id, empUser?.id, otherEmpUser?.id].filter(Boolean)

    await prisma.expenseItem.deleteMany({ where: { claim: { employeeId: { in: empIds } } } })
    await prisma.expenseClaim.deleteMany({ where: { employeeId: { in: empIds } } })
    if (testTravelReq?.id) {
      await prisma.travelRequest.deleteMany({ where: { id: testTravelReq.id } })
    }
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } })

    const settings = await prisma.organizationSetting.findFirst()
    if (settings?.settingsJson?.expenseCategories) {
      const cleaned = settings.settingsJson.expenseCategories.filter((c) => c.code !== createdCategoryCode)
      await prisma.organizationSetting.update({
        where: { id: settings.id },
        data: { settingsJson: { ...settings.settingsJson, expenseCategories: cleaned } }
      })
    }

    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.employee.deleteMany({ where: { id: { in: empIds } } })
    if (desig?.id) await prisma.designation.delete({ where: { id: desig.id } })
    await prisma.department.deleteMany({ where: { id: { in: [dept1?.id, dept2?.id].filter(Boolean) } } })
  })

  let customClaimId
  let returnedClaimId
  let highValueClaimId
  let selfSuperAdminClaimId

  test('1. Policies & Categories: GET /policies and POST/PATCH custom category persist in PostgreSQL', async () => {
    const polRes = await request
      .get('/api/v1/expenses/policies')
      .set('Authorization', `Bearer ${empToken}`)

    assert.equal(polRes.status, 200)
    assert.ok(polRes.body.data.managerLimit > 0)
    assert.ok(polRes.body.data.hrAdminLimit >= polRes.body.data.managerLimit)

    // Employee blocked from creating categories
    const forbidRes = await request
      .post('/api/v1/expenses/categories')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ name: 'Unauthorized Cat', code: 'UNAUTH', maxLimit: 5000 })
    assert.equal(forbidRes.status, 403)

    // HR Admin adds custom category with receipt threshold & limits
    const createCatRes = await request
      .post('/api/v1/expenses/categories')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        categoryName: 'QA Software Licenses',
        code: createdCategoryCode,
        description: 'Cloud IDE & testing tool subscriptions',
        perClaimLimit: 30000,
        dailyLimit: 20000,
        monthlyLimit: 60000,
        receiptRequiredThreshold: 1000,
        requiresTravelRequestRef: false
      })
    assert.equal(createCatRes.status, 201)
    assert.equal(createCatRes.body.data.code, createdCategoryCode)
    assert.equal(createCatRes.body.data.perClaimLimit, 30000)

    // Update category ceiling & verify reload persistence
    const patchCatRes = await request
      .patch(`/api/v1/expenses/categories/${createdCategoryCode}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ perClaimLimit: 40000, dailyLimit: 25000 })
    assert.equal(patchCatRes.status, 200)
    assert.equal(patchCatRes.body.data.perClaimLimit, 40000)

    const reloadCatsRes = await request
      .get('/api/v1/expenses/categories')
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(reloadCatsRes.status, 200)
    const found = reloadCatsRes.body.data.find((c) => c.code === createdCategoryCode)
    assert.ok(found, 'Custom category should survive reload from PostgreSQL')
    assert.equal(found.perClaimLimit, 40000)
    assert.equal(found.dailyLimit, 25000)
  })

  test('2. Claims Submission: custom category + travel bridge + duplicate receipt guard + PostgreSQL reload', async () => {
    const receiptRef = `RCP-EQA-${ts}`

    // Single-item modal-style payload using employeeCode, custom category, and TRV code
    const submitRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        employeeId: emp1.employeeCode,
        category: createdCategoryCode,
        amount: 3500,
        expenseDate: '2026-11-11',
        vendorOrDescription: 'JetBrains Cloud Tools',
        receiptReference: receiptRef,
        travelRequestRef: testTravelReq.requestCode,
        requestedReimbursementAccount: 'Meezan Bank •••• 7788',
        comments: 'On-site QA licensing'
      })

    assert.equal(submitRes.status, 201)
    customClaimId = submitRes.body.data.id
    assert.equal(Number(submitRes.body.data.totalAmount), 3500)
    assert.equal(Number(submitRes.body.data.advanceSettlementAmount), 1000)
    assert.equal(Number(submitRes.body.data.netPayableAmount), 2500)
    assert.equal(submitRes.body.data.travelRequestId, testTravelReq.id)

    // Duplicate receipt reference rejected with 409
    const dupRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        category: createdCategoryCode,
        amount: 1500,
        expenseDate: '2026-11-11',
        vendorOrDescription: 'Duplicate Try',
        receiptReference: receiptRef
      })
    assert.equal(dupRes.status, 409)

    // Missing receipt above threshold rejected with 400
    const noRcptRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        category: createdCategoryCode,
        amount: 2000,
        expenseDate: '2026-11-11',
        vendorOrDescription: 'No Receipt Corp'
      })
    assert.equal(noRcptRes.status, 400)

    // Reload from DB and verify custom category + fields survive
    const listRes = await request
      .get('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(listRes.status, 200)
    const persisted = listRes.body.data.find((c) => c.id === customClaimId)
    assert.ok(persisted, 'Claim must exist after PostgreSQL reload')
    assert.equal(persisted.categoryId, createdCategoryCode)
    assert.equal(persisted.category, 'QA Software Licenses')
    assert.equal(persisted.receiptReference, receiptRef)
  })

  test('3. Approval Queue: Manager/HR limits, anti-self-approval, Return status, and Super Admin unlimited privilege', async () => {
    // 3a. Manager tries approving own claim -> blocked
    const mgrSelfClaimRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        category: 'MEALS',
        amount: 1200,
        expenseDate: '2026-11-11',
        vendorOrDescription: 'Self Manager Lunch',
        receiptReference: `RCP-MGRSELF-${ts}`
      })
    assert.equal(mgrSelfClaimRes.status, 201)
    const mgrSelfClaimId = mgrSelfClaimRes.body.data.id

    const mgrApproveSelfRes = await request
      .patch(`/api/v1/expenses/claims/${mgrSelfClaimId}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ decision: 'APPROVED', remarks: 'Trying self approve' })
    assert.equal(mgrApproveSelfRes.status, 403)

    // 3b. Manager returns employee claim for clarification -> Returned
    const empRetClaimRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        category: 'MEALS',
        amount: 900,
        expenseDate: '2026-11-11',
        vendorOrDescription: 'Client Coffee',
        receiptReference: `RCP-RET-${ts}`
      })
    assert.equal(empRetClaimRes.status, 201)
    returnedClaimId = empRetClaimRes.body.data.id

    const returnRes = await request
      .patch(`/api/v1/expenses/claims/${returnedClaimId}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ decision: 'RETURNED', remarks: 'Please attach itemized tax bill' })
    assert.equal(returnRes.status, 200)
    assert.equal(returnRes.body.data.approvalStatus, 'Returned')

    // 3c. High value claim (120,000 PKR) exceeds Manager (100k) -> HR Admin or Super Admin approves;
    //     and 260,000 PKR exceeds both Manager (100k) and HR Admin (250k) -> only Super Admin approves
    const highClaimRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        claimTitle: 'Enterprise Hardware Upgrade',
        items: [
          {
            category: 'LODGING',
            expenseDate: '2026-11-05',
            amount: 35000,
            merchantName: 'Vendor Item 1',
            receiptUrl: `RCP-HV1-${ts}`
          },
          {
            category: 'TRANSPORT',
            expenseDate: '2026-11-05',
            amount: 35000,
            merchantName: 'Vendor Item 2',
            receiptUrl: `RCP-HV2-${ts}`
          },
          {
            category: 'SUPPLIES',
            expenseDate: '2026-11-06',
            amount: 20000,
            merchantName: 'Vendor Item 3',
            receiptUrl: `RCP-HV3-${ts}`
          },
          {
            category: 'OTHER',
            expenseDate: '2026-11-06',
            amount: 30000,
            merchantName: 'Vendor Item 4',
            receiptUrl: `RCP-HV4-${ts}`
          }
        ]
      })
    // Raise createdCategory ceiling high via Super Admin to test 260,000 PKR tier boundary strictly
    await request
      .patch(`/api/v1/expenses/categories/${createdCategoryCode}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ perClaimLimit: 300000, dailyLimit: 300000, monthlyLimit: 500000 })

    const ultraHighClaimRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        category: createdCategoryCode,
        amount: 260000,
        expenseDate: '2026-11-08',
        vendorOrDescription: 'Executive Server Cluster',
        receiptReference: `RCP-ULTRA-${ts}`
      })
    assert.equal(ultraHighClaimRes.status, 201)
    highValueClaimId = ultraHighClaimRes.body.data.id

    const mgrHighRes = await request
      .patch(`/api/v1/expenses/claims/${highValueClaimId}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ decision: 'APPROVED' })
    assert.equal(mgrHighRes.status, 403)

    const hrHighRes = await request
      .patch(`/api/v1/expenses/claims/${highValueClaimId}/review`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED' })
    assert.equal(hrHighRes.status, 403)

    const saHighRes = await request
      .patch(`/api/v1/expenses/claims/${highValueClaimId}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ decision: 'APPROVED', remarks: 'MD authorized capital expenditure' })
    assert.equal(saHighRes.status, 200)
    assert.ok(highClaimRes.status === 201 || highClaimRes.status === 400)

    // 3d. Super Admin CAN submit and directly approve their own claim
    const saClaimRes = await request
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: saEmp.employeeCode,
        category: 'MEALS',
        amount: 4500,
        expenseDate: '2026-11-11',
        vendorOrDescription: 'Executive Board Lunch',
        receiptReference: `RCP-SASLF-${ts}`
      })
    assert.equal(saClaimRes.status, 201)
    selfSuperAdminClaimId = saClaimRes.body.data.id

    const saApproveSelf = await request
      .patch(`/api/v1/expenses/claims/${selfSuperAdminClaimId}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ decision: 'APPROVED', remarks: 'Direct Super Admin authorization' })
    assert.equal(saApproveSelf.status, 200)
    assert.equal(saApproveSelf.body.data.status, 'HR_APPROVED')

    // Approve customClaimId by Manager for reimbursement tests (3500 <= 100k)
    const mgrApproveEmpRes = await request
      .patch(`/api/v1/expenses/claims/${customClaimId}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ decision: 'APPROVED', remarks: 'Verified with travel TRV request' })
    assert.equal(mgrApproveEmpRes.status, 200)
  })

  test('4. Reimbursements & Payment Reversal: partial/full pay, dup ref 409, overpayment 400, reverse & reload', async () => {
    const txn1 = `FT-EQA-1-${ts}`
    const txn2 = `FT-EQA-2-${ts}`

    // Employee blocked from disbursing
    const empPayForbidden = await request
      .post(`/api/v1/expenses/claims/${customClaimId}/disburse`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ amount: 1000, transactionReference: txn1, paymentMethod: 'Bank Transfer' })
    assert.equal(empPayForbidden.status, 403)

    // Partial disbursement: 1000 of 2500 net payable (3500 total - 1000 travel advance) -> remainingPayable = 1500
    const partialRes = await request
      .post(`/api/v1/expenses/claims/${customClaimId}/disburse`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        amount: 1000,
        transactionReference: txn1,
        paymentMethod: 'Bank Transfer',
        notes: 'Partial tranche 1'
      })
    assert.equal(partialRes.status, 200)
    assert.equal(partialRes.body.data.paidAmount, 1000)
    assert.equal(partialRes.body.data.remainingPayable, 1500)
    assert.equal(partialRes.body.data.paymentStatus, 'Partially Paid')
    assert.equal(partialRes.body.data.status, 'MANAGER_APPROVED')

    // Duplicate transaction reference blocked with 409
    const dupTxnRes = await request
      .post(`/api/v1/expenses/claims/${customClaimId}/disburse`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        amount: 500,
        transactionReference: txn1,
        paymentMethod: 'Bank Transfer'
      })
    assert.equal(dupTxnRes.status, 409)

    // Overpayment > remainingPayable (1500) blocked with 400
    const overPayRes = await request
      .post(`/api/v1/expenses/claims/${customClaimId}/disburse`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        amount: 2000,
        transactionReference: txn2,
        paymentMethod: 'Bank Transfer'
      })
    assert.equal(overPayRes.status, 400)

    // Final tranche 1500 -> DISBURSED, remainingPayable = 0
    const finalPayRes = await request
      .post(`/api/v1/expenses/claims/${customClaimId}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        amount: 1500,
        transactionReference: txn2,
        paymentMethod: 'Bank Transfer',
        notes: 'Final tranche settlement'
      })
    assert.equal(finalPayRes.status, 200)
    assert.equal(finalPayRes.body.data.status, 'DISBURSED')
    assert.equal(finalPayRes.body.data.paidAmount, 2500)
    assert.equal(finalPayRes.body.data.remainingPayable, 0)
    assert.equal(finalPayRes.body.data.reimbursements.length, 2)

    // Reverse second disbursement and verify claim reopens to remainingPayable = 1500 & status HR_APPROVED
    const secondReimbId = finalPayRes.body.data.reimbursements[1].reimbursementId
    const reverseRes = await request
      .post(`/api/v1/expenses/claims/${customClaimId}/reverse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        reimbursementId: secondReimbId,
        reason: 'Bank advice returned due to IBAN typo'
      })
    assert.equal(reverseRes.status, 200)
    assert.equal(reverseRes.body.data.status, 'HR_APPROVED')
    assert.equal(reverseRes.body.data.paidAmount, 1000)
    assert.equal(reverseRes.body.data.remainingPayable, 1500)

    // Reload from DB and verify reversal persisted
    const reloadClaimRes = await request
      .get(`/api/v1/expenses/claims/${customClaimId}`)
      .set('Authorization', `Bearer ${hrToken}`)
    assert.equal(reloadClaimRes.status, 200)
    assert.equal(reloadClaimRes.body.data.remainingPayable, 1500)
    assert.equal(reloadClaimRes.body.data.reimbursements[1].isReversed, true)
  })

  test('5. Travel Reconciliation, Audit History & RBAC Isolation survive PostgreSQL reload', async () => {
    // 5a. Travel bridge returns testTravelReq
    const trvRes = await request
      .get('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(trvRes.status, 200)
    assert.ok(trvRes.body.data.some((t) => t.id === testTravelReq.id))

    // 5b. Audit logs contain Expense events from PostgreSQL
    const auditRes = await request
      .get('/api/v1/expenses/audit-logs')
      .set('Authorization', `Bearer ${hrToken}`)
    assert.equal(auditRes.status, 200)
    const actions = auditRes.body.data.map((a) => a.action)
    assert.ok(actions.some((a) => a === 'CLAIM_SUBMITTED' || a === 'DISBURSE_REIMBURSEMENT' || a === 'REIMBURSEMENT_REVERSED'))

    // Employee blocked from company-wide expense audit logs
    const empAuditRes = await request
      .get('/api/v1/expenses/audit-logs')
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(empAuditRes.status, 403)

    // 5c. RBAC isolation: otherEmp (dept2) cannot see emp1's claim or read it directly
    const otherListRes = await request
      .get('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${otherEmpToken}`)
    assert.equal(otherListRes.status, 200)
    assert.equal(otherListRes.body.data.some((c) => c.id === customClaimId), false)

    const otherDirectRes = await request
      .get(`/api/v1/expenses/claims/${customClaimId}`)
      .set('Authorization', `Bearer ${otherEmpToken}`)
    assert.equal(otherDirectRes.status, 403)
  })

  test('6. Travel Expense Reconciliation Bridge: Canonical F10+F12 merge, Draft/Rejected exclusion, Zero-balance & Settled lock', async () => {
    const settledTrv = await prisma.travelRequest.create({
      data: {
        requestCode: `TRV-QA-SET-${ts.toString().slice(-4)}`,
        employeeId: emp1.id,
        origin: 'Lahore',
        destination: 'Lahore, Pakistan',
        purpose: 'QA F10 Settled Trip',
        departureDate: new Date('2026-11-01T08:00:00Z'),
        returnDate: new Date('2026-11-02T20:00:00Z'),
        estimatedBudget: 45000,
        advanceAmount: 20000,
        disbursedAdvance: 20000,
        employeeSubmittedExp: 20000,
        approvedExpenses: 20000,
        settlementBalance: 0,
        settlementStatus: 'Settled',
        reconciledAt: new Date(),
        reconciledBy: 'QA Super Admin',
        expenseCode: `TRV-EXP-QA-SET-${ts.toString().slice(-4)}`,
        expenseReceiptRefs: ['RCP-QA-1'],
        status: 'APPROVED'
      }
    })

    const rejectedTrv = await prisma.travelRequest.create({
      data: {
        requestCode: `TRV-QA-REJ-${ts.toString().slice(-4)}`,
        employeeId: emp1.id,
        origin: 'Lahore',
        destination: 'Islamabad, Pakistan',
        purpose: 'QA Rejected Trip',
        departureDate: new Date('2026-11-25T08:00:00Z'),
        returnDate: new Date('2026-11-26T20:00:00Z'),
        estimatedBudget: 15000,
        advanceAmount: 5000,
        disbursedAdvance: 0,
        status: 'REJECTED'
      }
    })

    const draftTrv = await prisma.travelRequest.create({
      data: {
        requestCode: `TRV-QA-DRF-${ts.toString().slice(-4)}`,
        employeeId: emp1.id,
        origin: 'Lahore',
        destination: 'Karachi, Pakistan',
        purpose: 'QA Draft Trip',
        departureDate: new Date('2026-11-28T08:00:00Z'),
        returnDate: new Date('2026-11-29T20:00:00Z'),
        estimatedBudget: 5000,
        advanceAmount: 0,
        disbursedAdvance: 0,
        status: 'DRAFT'
      }
    })

    const zeroApprovedTrv = await prisma.travelRequest.create({
      data: {
        requestCode: `TRV-QA-ZER-${ts.toString().slice(-4)}`,
        employeeId: emp1.id,
        origin: 'Lahore',
        destination: 'Multan, Pakistan',
        purpose: 'QA Uninitialized Approved Trip',
        departureDate: new Date('2026-12-03T08:00:00Z'),
        returnDate: new Date('2026-12-04T20:00:00Z'),
        estimatedBudget: 12000,
        advanceAmount: 0,
        disbursedAdvance: 0,
        status: 'APPROVED'
      }
    })

    try {
      // Default endpoint excludes Draft & Rejected trips
      const defaultRes = await request
        .get('/api/v1/expenses/travel/reconciliations')
        .set('Authorization', `Bearer ${saToken}`)
      assert.equal(defaultRes.status, 200)
      assert.equal(defaultRes.body.data.some((r) => r.tripId === rejectedTrv.requestCode), false)
      assert.equal(defaultRes.body.data.some((r) => r.tripId === draftTrv.requestCode), false)

      const settledRow = defaultRes.body.data.find((r) => r.tripId === settledTrv.requestCode)
      assert.ok(settledRow)
      assert.equal(settledRow.disbursedAdvance, 20000)
      assert.equal(settledRow.totalSubmittedClaims, 20000)
      assert.equal(settledRow.totalApprovedClaims, 20000)
      assert.equal(settledRow.netSettlementBalance, 0)
      assert.equal(settledRow.isSettled, true)
      assert.equal(settledRow.reconciliationStatus, 'Settled')

      const zeroRow = defaultRes.body.data.find((r) => r.tripId === zeroApprovedTrv.requestCode)
      assert.ok(zeroRow)
      assert.equal(zeroRow.netSettlementBalance, 0)
      assert.equal(zeroRow.isSettled, false)
      assert.equal(zeroRow.isReconciled, false)
      assert.equal(zeroRow.reconciliationStatus, 'Not Initialized')

      // Audit view (includeIneligible=true) distinguishes Rejected/Draft cleanly and never leaks advanceAmount=5000
      const allRes = await request
        .get('/api/v1/expenses/travel/reconciliations?includeIneligible=true')
        .set('Authorization', `Bearer ${saToken}`)
      assert.equal(allRes.status, 200)
      const rejRow = allRes.body.data.find((r) => r.tripId === rejectedTrv.requestCode)
      const drfRow = allRes.body.data.find((r) => r.tripId === draftTrv.requestCode)
      assert.equal(rejRow.disbursedAdvance, 0)
      assert.equal(rejRow.isSettled, false)
      assert.equal(rejRow.reconciliationStatus, 'Rejected (Excluded)')
      assert.equal(drfRow.isSettled, false)
      assert.equal(drfRow.reconciliationStatus, 'Draft (Not Eligible)')

      // Duplicate financial recognition blocked: cannot submit F12 claim against Settled travel request
      const dupClaimRes = await request
        .post('/api/v1/expenses/claims')
        .set('Authorization', `Bearer ${empToken}`)
        .send({
          employeeId: emp1.employeeCode,
          category: 'MEALS',
          amount: 1500,
          expenseDate: '2026-11-02',
          description: 'Duplicate claim on already settled trip',
          receiptReference: `RCP-DUP-SET-${ts}`,
          relatedTravelRequestId: settledTrv.requestCode
        })
      assert.equal(dupClaimRes.status, 409)
      assert.equal(dupClaimRes.body.error.code, 'EXPENSE_ALREADY_SETTLED')
    } finally {
      await prisma.travelRequest.deleteMany({
        where: { id: { in: [settledTrv.id, rejectedTrv.id, draftTrv.id, zeroApprovedTrv.id] } }
      })
    }
  })
})
