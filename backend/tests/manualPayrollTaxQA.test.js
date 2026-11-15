import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Backend QA — Manual Payroll Tax Configuration & Statutory Accounting Suite', () => {
  let saUser, hrUser, empUser1, empUser2
  let saToken, hrToken, empToken1
  let employee1, employee2
  let dept, desig, period

  before(async () => {
    // Clean up any existing test records
    const oldUsers = await prisma.user.findMany({
      where: { username: { in: ['tax_qa_sa', 'tax_qa_hr', 'tax_qa_emp1', 'tax_qa_emp2'] } }
    })
    if (oldUsers.length) await prisma.user.deleteMany({ where: { id: { in: oldUsers.map((u) => u.id) } } })

    const oldRuns = await prisma.payrollRun.findMany({
      where: { runNumber: { startsWith: 'RUN-202611TAX' } },
      select: { id: true }
    })
    if (oldRuns.length) {
      const runIds = oldRuns.map((r) => r.id)
      await prisma.salaryLiability.deleteMany({ where: { payrollEntry: { payrollRunId: { in: runIds } } } }).catch(() => {})
      await prisma.payrollEntry.deleteMany({ where: { payrollRunId: { in: runIds } } }).catch(() => {})
      await prisma.payrollRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => {})
    }

    const oldEmps = await prisma.employee.findMany({
      where: { employeeCode: { in: ['EMP-TAX-001', 'EMP-TAX-002'] } }
    })
    if (oldEmps.length) {
      const ids = oldEmps.map((e) => e.id)
      await prisma.salaryLiability.deleteMany({ where: { employeeId: { in: ids } } }).catch(() => {})
      await prisma.payrollEntry.deleteMany({ where: { employeeId: { in: ids } } }).catch(() => {})
      await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: ids } } }).catch(() => {})
      await prisma.employee.deleteMany({ where: { id: { in: ids } } }).catch(() => {})
    }

    await prisma.payrollPeriod.deleteMany({ where: { periodCode: '2026-11-TAX' } }).catch(() => {})
    await prisma.designation.deleteMany({ where: { code: 'DES-TAX-QA' } }).catch(() => {})
    await prisma.department.deleteMany({ where: { code: 'DEP-TAX-QA' } }).catch(() => {})

    // Create test Department & Designation
    dept = await prisma.department.create({
      data: { code: 'DEP-TAX-QA', name: 'Tax QA Department' }
    })
    desig = await prisma.designation.create({
      data: { code: 'DES-TAX-QA', title: 'Tax QA Engineer', level: 'MID' }
    })

    // Create Employee 1 (EMP-TAX-001) - Gross 100,000
    employee1 = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-TAX-001',
        firstName: 'Farhan',
        lastName: 'TaxTest',
        email: 'farhan.tax@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE',
        bankName: 'Standard Chartered',
        bankAccountNumber: '1234567890',
        bankIban: 'PK36SCBL0000123456789001'
      }
    })

    await prisma.salaryStructure.create({
      data: {
        employeeId: employee1.id,
        baseSalary: 70000,
        houseRentAllowance: 20000,
        medicalAllowance: 10000,
        grossSalary: 100000,
        effectiveFrom: new Date('2026-01-01'),
        isCurrent: true
      }
    })

    // Create Employee 2 (EMP-TAX-002) - Gross 50,000
    employee2 = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-TAX-002',
        firstName: 'Bilal',
        lastName: 'TaxTest',
        email: 'bilal.tax@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE',
        bankName: 'HBL',
        bankAccountNumber: '9876543210',
        bankIban: 'PK36HABB0000987654321001'
      }
    })

    await prisma.salaryStructure.create({
      data: {
        employeeId: employee2.id,
        baseSalary: 40000,
        houseRentAllowance: 10000,
        grossSalary: 50000,
        effectiveFrom: new Date('2026-01-01'),
        isCurrent: true
      }
    })

    // Users
    saUser = await prisma.user.create({
      data: {
        username: 'tax_qa_sa',
        email: 'sa.tax@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })
    hrUser = await prisma.user.create({
      data: {
        username: 'tax_qa_hr',
        email: 'hr.tax@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'HR_ADMIN'
      }
    })
    empUser1 = await prisma.user.create({
      data: {
        username: 'tax_qa_emp1',
        email: 'farhan.tax@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE',
        employeeId: employee1.id
      }
    })

    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })
    hrToken = generateAccessToken({ userId: hrUser.id, role: 'HR_ADMIN' })
    empToken1 = generateAccessToken({ userId: empUser1.id, role: 'EMPLOYEE', employeeId: employee1.id })

    period = await prisma.payrollPeriod.create({
      data: {
        periodCode: '2026-11-TAX',
        month: 11,
        year: 2026,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-30'),
        workingDaysCount: 22,
        status: 'OPEN'
      }
    })
  })

  after(async () => {
    // Restore default statutory tax configuration
    const org = await prisma.organizationSetting.findFirst()
    if (org) {
      await prisma.organizationSetting.update({
        where: { id: org.id },
        data: {
          settingsJson: {
            ...(org.settingsJson || {}),
            payrollTaxConfig: {
              enabled: true,
              mode: 'FBR_STATUTORY',
              ratePercentage: 0,
              fixedAmount: 0,
              employeeOverrides: []
            }
          }
        }
      })
    }

    // Cleanup test records in correct foreign key order
    if (period?.id) {
      await prisma.salaryLiability.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
      await prisma.payrollEntry.deleteMany({ where: { payrollRun: { payrollPeriodId: period.id } } }).catch(() => {})
      await prisma.payrollRun.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
      await prisma.payrollPeriod.deleteMany({ where: { id: period.id } }).catch(() => {})
    }
    await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: [employee1?.id, employee2?.id].filter(Boolean) } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [saUser?.id, hrUser?.id, empUser1?.id].filter(Boolean) } } }).catch(() => {})
    await prisma.employee.deleteMany({ where: { id: { in: [employee1?.id, employee2?.id].filter(Boolean) } } }).catch(() => {})
    await prisma.designation.deleteMany({ where: { id: desig?.id } }).catch(() => {})
    await prisma.department.deleteMany({ where: { id: dept?.id } }).catch(() => {})
  })

  it('1. Authorization & RBAC: Super Admin alone can modify tax config; HR and Employee are rejected (403)', async () => {
    // Employee blocked
    const resEmp = await request(app)
      .put('/api/v1/payroll/tax-config')
      .set('Authorization', `Bearer ${empToken1}`)
      .send({ mode: 'OFF', enabled: false })
    assert.strictEqual(resEmp.status, 403)

    // HR Admin blocked
    const resHr = await request(app)
      .put('/api/v1/payroll/tax-config')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ mode: 'OFF', enabled: false })
    assert.strictEqual(resHr.status, 403)

    // Super Admin allowed
    const resSa = await request(app)
      .put('/api/v1/payroll/tax-config')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        enabled: true,
        mode: 'PERCENTAGE',
        ratePercentage: 5,
        reason: 'Authorized 5% flat withholding policy'
      })
    assert.strictEqual(resSa.status, 200)
    assert.strictEqual(resSa.body.data.mode, 'PERCENTAGE')
    assert.strictEqual(resSa.body.data.ratePercentage, 5)

    // Verify PostgreSQL persistence in organization_settings
    const org = await prisma.organizationSetting.findFirst()
    assert.strictEqual(org.settingsJson?.payrollTaxConfig?.mode, 'PERCENTAGE')
    assert.strictEqual(org.settingsJson?.payrollTaxConfig?.ratePercentage, 5)

    // Verify audit log record
    const auditLog = await prisma.auditLog.findFirst({
      where: { sourceModule: 'PAYROLL_TAX', actionType: 'UPDATE_TAX_CONFIG' },
      orderBy: { createdAt: 'desc' }
    })
    assert.ok(auditLog)
    assert.strictEqual(auditLog.actorRole, 'SUPER_ADMIN')
  })

  it('2. Tax Mode: OFF -> Generates Draft with PKR 0 tax deduction while tracking statutory obligation', async () => {
    // Set Tax mode to OFF
    await request(app)
      .put('/api/v1/payroll/tax-config')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        enabled: false,
        mode: 'OFF',
        reason: 'Temporary company tax relief month'
      })

    // Generate Draft
    const resDraft = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-TAX' })

    assert.strictEqual(resDraft.status, 201)
    const run = resDraft.body.data

    // Employee 1 (Gross: 100,000)
    const e1 = run.entries.find((e) => e.employeeId === employee1.id)
    assert.ok(e1)
    assert.strictEqual(Number(e1.taxDeduction), 0)
    // Full gross disbursed as net (assuming no other deductions)
    assert.strictEqual(Number(e1.netSalary), 100000)

    // Total run tax deduction is 0
    const totalTaxWithheld = run.entries.reduce((acc, cur) => acc + Number(cur.taxDeduction), 0)
    assert.strictEqual(totalTaxWithheld, 0)

    // Cleanup run for next test
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: run.id } })
    await prisma.payrollRun.delete({ where: { id: run.id } })
  })

  it('3. Tax Mode: PERCENTAGE (e.g. 5%) -> Deducts exactly 5% from gross earnings for all employees', async () => {
    // Set Tax mode to 5%
    await request(app)
      .put('/api/v1/payroll/tax-config')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        enabled: true,
        mode: 'PERCENTAGE',
        ratePercentage: 5,
        reason: '5% flat tax withholding policy'
      })

    const resDraft = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-TAX' })

    assert.strictEqual(resDraft.status, 201)
    const run = resDraft.body.data

    // Employee 1: Gross 100,000 * 5% = 5,000
    const e1 = run.entries.find((e) => e.employeeId === employee1.id)
    assert.strictEqual(Number(e1.taxDeduction), 5000)
    assert.strictEqual(Number(e1.netSalary), 95000)

    // Employee 2: Gross 50,000 * 5% = 2,500
    const e2 = run.entries.find((e) => e.employeeId === employee2.id)
    assert.strictEqual(Number(e2.taxDeduction), 2500)
    assert.strictEqual(Number(e2.netSalary), 47500)

    // Cleanup run
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: run.id } })
    await prisma.payrollRun.delete({ where: { id: run.id } })
  })

  it('4. Tax Mode: FIXED_AMOUNT (e.g. PKR 1,500) -> Deducts exact fixed amount from each employee', async () => {
    // Set Tax mode to Fixed 1,500 PKR
    await request(app)
      .put('/api/v1/payroll/tax-config')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        enabled: true,
        mode: 'FIXED_AMOUNT',
        fixedAmount: 1500,
        reason: 'Fixed 1,500 PKR flat deduction'
      })

    const resDraft = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-TAX' })

    assert.strictEqual(resDraft.status, 201)
    const run = resDraft.body.data

    const e1 = run.entries.find((e) => e.employeeId === employee1.id)
    assert.strictEqual(Number(e1.taxDeduction), 1500)
    assert.strictEqual(Number(e1.netSalary), 98500)

    const e2 = run.entries.find((e) => e.employeeId === employee2.id)
    assert.strictEqual(Number(e2.taxDeduction), 1500)
    assert.strictEqual(Number(e2.netSalary), 48500)

    // Cleanup run
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: run.id } })
    await prisma.payrollRun.delete({ where: { id: run.id } })
  })

  it('5. Global Tax Policy Enforcement: All employees uniformly follow global policy (overrides removed)', async () => {
    await request(app)
      .put('/api/v1/payroll/tax-config')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        enabled: true,
        mode: 'PERCENTAGE',
        ratePercentage: 10
      })

    const resDraft = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-TAX' })

    assert.strictEqual(resDraft.status, 201)
    const run = resDraft.body.data

    // Employee 1: follows global 10% on 100,000 -> 10,000
    const e1 = run.entries.find((e) => e.employeeId === employee1.id)
    assert.strictEqual(Number(e1.taxDeduction), 10000)
    assert.strictEqual(Number(e1.netSalary), 90000)

    // Employee 2: follows global 10% on 50,000 -> 5,000
    const e2 = run.entries.find((e) => e.employeeId === employee2.id)
    assert.strictEqual(Number(e2.taxDeduction), 5000)
    assert.strictEqual(Number(e2.netSalary), 45000)

    // Keep this run for Test 6 (controlled recalculation)
    globalDraftRun = run
  })

  let globalDraftRun = null

  it('6. Controlled Recalculation: POST /api/v1/payroll/runs/:id/recalculate-tax recalculates Drafts and updates snapshot', async () => {
    assert.ok(globalDraftRun)

    // Switch policy to Fixed 3,000 PKR globally with NO overrides
    await request(app)
      .put('/api/v1/payroll/tax-config')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        enabled: true,
        mode: 'FIXED_AMOUNT',
        fixedAmount: 3000,
        employeeOverrides: [],
        reason: 'Recalculating draft under revised uniform fixed tax policy'
      })

    // Trigger recalculation on the draft run
    const resRecalc = await request(app)
      .post(`/api/v1/payroll/runs/${globalDraftRun.id}/recalculate-tax`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resRecalc.status, 200)
    const updated = resRecalc.body.data

    // Verify both employees now have 3,000 deducted
    const e1 = updated.entries.find((e) => e.employeeId === employee1.id)
    assert.strictEqual(Number(e1.taxDeduction), 3000)
    assert.strictEqual(Number(e1.netSalary), 97000)

    const e2 = updated.entries.find((e) => e.employeeId === employee2.id)
    assert.strictEqual(Number(e2.taxDeduction), 3000)
    assert.strictEqual(Number(e2.netSalary), 47000)

    // Verify snapshot in organization_settings
    const org = await prisma.organizationSetting.findFirst()
    const snapshot = org.settingsJson?.runTaxSnapshots?.[globalDraftRun.id]
    assert.ok(snapshot)
    assert.strictEqual(snapshot.config?.mode, 'FIXED_AMOUNT')
    assert.strictEqual(snapshot.config?.fixedAmount, 3000)
  })

  it('7. Immutability Guard: Rejects recalculation on APPROVED and VOID runs (409 IMMUTABLE_HISTORICAL_RUN)', async () => {
    // Approve the run
    await request(app)
      .patch(`/api/v1/payroll/runs/${globalDraftRun.id}/submit`)
      .set('Authorization', `Bearer ${saToken}`)

    await request(app)
      .patch(`/api/v1/payroll/runs/${globalDraftRun.id}/approve`)
      .set('Authorization', `Bearer ${saToken}`)

    // Attempt recalculation on APPROVED run -> Must fail with 409
    const resBlockApproved = await request(app)
      .post(`/api/v1/payroll/runs/${globalDraftRun.id}/recalculate-tax`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resBlockApproved.status, 409)
    assert.strictEqual(resBlockApproved.body.error.code, 'IMMUTABLE_HISTORICAL_RUN')

    // Void the run
    await request(app)
      .post(`/api/v1/payroll/runs/${globalDraftRun.id}/void`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ reason: 'Testing VOID run immutability' })

    // Attempt recalculation on VOID run -> Must fail with 409
    const resBlockVoid = await request(app)
      .post(`/api/v1/payroll/runs/${globalDraftRun.id}/recalculate-tax`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resBlockVoid.status, 409)
    assert.strictEqual(resBlockVoid.body.error.code, 'IMMUTABLE_HISTORICAL_RUN')
  })

  it('8. Statutory Obligation & Variance Reporting: Exposes statutory tax and variance alongside withheld amounts', async () => {
    // Clean up any existing run for clean period test
    const oldRuns = await prisma.payrollRun.findMany({ where: { payrollPeriod: { periodCode: '2026-11-TAX' } } })
    for (const r of oldRuns) {
      await prisma.payrollEntry.deleteMany({ where: { payrollRunId: r.id } })
      await prisma.payrollRun.delete({ where: { id: r.id } })
    }

    // Generate fresh draft with 5% tax
    await request(app)
      .put('/api/v1/payroll/tax-config')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        enabled: true,
        mode: 'PERCENTAGE',
        ratePercentage: 5,
        employeeOverrides: [],
        reason: 'Statutory compliance tracking verification'
      })

    const resDraft = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-TAX' })

    assert.strictEqual(resDraft.status, 201)
    const run = resDraft.body.data

    // Check Run Details endpoint
    const resDetail = await request(app)
      .get(`/api/v1/payroll/runs/${run.id}`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resDetail.status, 200)
    assert.ok(resDetail.body.data.taxCompliance)
    assert.ok(typeof resDetail.body.data.taxCompliance.totalTaxWithheld === 'number')
    assert.ok(typeof resDetail.body.data.taxCompliance.statutoryTaxObligationTotal === 'number')
    assert.ok(typeof resDetail.body.data.taxCompliance.statutoryVariance === 'number')

    // Check Tax Compliance API endpoint
    const resCompliance = await request(app)
      .get('/api/v1/payroll/tax-compliance/2026-11-TAX')
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resCompliance.status, 200)
    assert.strictEqual(resCompliance.body.data.hasRun, true)
    assert.strictEqual(resCompliance.body.data.totalTaxWithheld, resDetail.body.data.taxCompliance.totalTaxWithheld)

    // Check Payslip endpoint for Employee 1
    const entry1 = run.entries.find((e) => e.employeeId === employee1.id)
    const resSlip = await request(app)
      .get(`/api/v1/payroll/payslips/${entry1.id}`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resSlip.status, 200)
    assert.strictEqual(resSlip.body.data.deductions.incomeTaxWithholding, 5000)
    assert.ok(typeof resSlip.body.data.deductions.statutoryTaxObligation === 'number')
    assert.ok(typeof resSlip.body.data.deductions.statutoryVariance === 'number')

    // Cleanup
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: run.id } })
    await prisma.payrollRun.delete({ where: { id: run.id } })
  })
})
