import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Backend Payroll QA — Eligibility, Reconciliation, Approval Guards & RBAC', () => {
  const TEST_PERIOD_CODE = '2026-11-QA'
  let dept = null
  let desig = null
  let saUser = null
  let hrUser = null
  let empUser = null
  let saToken = null
  let hrToken = null
  let empToken = null

  let activeEmp = null
  let suspendedEmp = null
  let noStructEmp = null
  let futureEmp = null
  let periodQa = null

  async function cleanupFixtures() {
    const periods = await prisma.payrollPeriod.findMany({
      where: { periodCode: TEST_PERIOD_CODE },
      select: { id: true }
    })
    const periodIds = periods.map((p) => p.id)

    if (periodIds.length > 0) {
      await prisma.salaryLiability.deleteMany({ where: { payrollPeriodId: { in: periodIds } } }).catch(() => {})
      const runs = await prisma.payrollRun.findMany({
        where: { payrollPeriodId: { in: periodIds } },
        select: { id: true }
      })
      const runIds = runs.map((r) => r.id)
      if (runIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { entityName: 'PayrollRun', entityId: { in: runIds } } }).catch(() => {})
        await prisma.payrollEntry.deleteMany({ where: { payrollRunId: { in: runIds } } }).catch(() => {})
        await prisma.payrollRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => {})
      }
      await prisma.payrollPeriod.deleteMany({ where: { id: { in: periodIds } } }).catch(() => {})
    }

    const emps = await prisma.employee.findMany({
      where: {
        employeeCode: {
          in: ['EMP-QA-ACT', 'EMP-QA-SUSP', 'EMP-QA-NOSTRUCT', 'EMP-QA-FUT']
        }
      },
      select: { id: true }
    })
    const empIds = emps.map((e) => e.id)
    if (empIds.length > 0) {
      await prisma.payrollEntry.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {})
      await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {})
    }

    await prisma.user.deleteMany({
      where: { username: { in: ['usr_qa_pay_sa', 'usr_qa_pay_hr', 'usr_qa_pay_emp'] } }
    }).catch(() => {})

    if (empIds.length > 0) {
      await prisma.employee.deleteMany({ where: { id: { in: empIds } } }).catch(() => {})
    }

    await prisma.designation.deleteMany({ where: { code: 'DES-QA-PAY' } }).catch(() => {})
    await prisma.department.deleteMany({ where: { code: 'DEP-QA-PAY' } }).catch(() => {})
  }

  it('Setup: Prepares isolated QA org, active/suspended/no-structure/future employees, and tokens', async () => {
    await cleanupFixtures()

    dept = await prisma.department.create({
      data: { code: 'DEP-QA-PAY', name: 'Payroll QA Engineering' }
    })
    desig = await prisma.designation.create({
      data: { code: 'DES-QA-PAY', title: 'QA Compensation Engineer', level: 'SENIOR' }
    })

    activeEmp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-QA-ACT',
        firstName: 'Active',
        lastName: 'Eligible',
        email: 'active.qa.pay@isysware.test',
        joiningDate: new Date('2026-10-26'),
        departmentId: dept.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE'
      }
    })

    await prisma.salaryStructure.create({
      data: {
        employeeId: activeEmp.id,
        currency: 'PKR',
        baseSalary: 50000,
        houseRentAllowance: 10000,
        medicalAllowance: 5000,
        conveyanceAllowance: 3000,
        specialAllowance: 2000,
        grossSalary: 70000,
        effectiveFrom: new Date('2026-11-01'),
        isCurrent: true
      }
    })

    suspendedEmp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-QA-SUSP',
        firstName: 'Suspended',
        lastName: 'Tester',
        email: 'suspended.qa.pay@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        employmentStatus: 'SUSPENDED'
      }
    })

    noStructEmp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-QA-NOSTRUCT',
        firstName: 'NoStruct',
        lastName: 'Employee',
        email: 'nostruct.qa.pay@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE'
      }
    })

    futureEmp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-QA-FUT',
        firstName: 'Future',
        lastName: 'Hire',
        email: 'future.qa.pay@isysware.test',
        joiningDate: new Date('2026-12-01'),
        departmentId: dept.id,
        designationId: desig.id,
        employmentStatus: 'ACTIVE'
      }
    })

    await prisma.salaryStructure.create({
      data: {
        employeeId: futureEmp.id,
        currency: 'PKR',
        baseSalary: 80000,
        grossSalary: 80000,
        effectiveFrom: new Date('2026-12-01'),
        isCurrent: true
      }
    })

    saUser = await prisma.user.create({
      data: {
        username: 'usr_qa_pay_sa',
        email: 'sa.qa.pay@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })
    hrUser = await prisma.user.create({
      data: {
        username: 'usr_qa_pay_hr',
        email: 'hr.qa.pay@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'HR_ADMIN'
      }
    })
    empUser = await prisma.user.create({
      data: {
        username: 'usr_qa_pay_emp',
        email: 'emp.qa.pay@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE',
        employeeId: activeEmp.id
      }
    })

    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })
    hrToken = generateAccessToken({ userId: hrUser.id, role: 'HR_ADMIN' })
    empToken = generateAccessToken({ userId: empUser.id, role: 'EMPLOYEE', employeeId: activeEmp.id })

    periodQa = await prisma.payrollPeriod.create({
      data: {
        periodCode: TEST_PERIOD_CODE,
        month: 11,
        year: 2026,
        startDate: new Date(Date.UTC(2026, 10, 1)),
        endDate: new Date(Date.UTC(2026, 10, 30)),
        workingDaysCount: 22,
        status: 'OPEN'
      }
    })

    assert.ok(periodQa.id)
  })

  it('1. Draft generation includes EMP-001 (if present) & eligible active employee (70,000 gross) and excludes suspended, unstructured, and future-dated employees', async () => {
    const resGen = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: TEST_PERIOD_CODE })

    assert.strictEqual(resGen.status, 201)
    const run = resGen.body.data
    assert.strictEqual(run.totalEmployees, run.entries.length)

    const qaEntry = run.entries.find((e) => e.employeeId === activeEmp.id)
    assert.ok(qaEntry, 'Eligible active employee must be included')
    assert.strictEqual(Number(qaEntry.basicSalary), 50000)
    assert.strictEqual(
      Number(qaEntry.houseRentAllowance) +
      Number(qaEntry.medicalAllowance) +
      Number(qaEntry.conveyanceAllowance) +
      Number(qaEntry.specialAllowance),
      20000
    )
    assert.strictEqual(Number(qaEntry.grossEarnings), 70000)

    assert.ok(!run.entries.some((e) => e.employeeId === suspendedEmp.id), 'SUSPENDED employee must be excluded')
    assert.ok(!run.entries.some((e) => e.employeeId === noStructEmp.id), 'Employee without salary structure must be excluded')
    assert.ok(!run.entries.some((e) => e.employeeId === futureEmp.id), 'Future joiner/effective salary structure must be excluded')

    const liveEmp001 = await prisma.employee.findUnique({ where: { employeeCode: 'EMP-001' } })
    if (liveEmp001 && liveEmp001.employmentStatus === 'ACTIVE') {
      const emp001Entry = run.entries.find((e) => e.employeeId === liveEmp001.id)
      assert.ok(emp001Entry, 'EMP-001 must be included cleanly by real CUID without merging with EMP-002')
      assert.strictEqual(Number(emp001Entry.basicSalary), 50000)
      assert.strictEqual(Number(emp001Entry.grossEarnings), 70000)
    }

    // Verify GET /runs returns complete employee details including employmentStatus
    const resList = await request(app)
      .get('/api/v1/payroll/runs')
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(resList.status, 200)
    const fetchedQa = resList.body.data.find((r) => r.id === run.id)
    assert.ok(fetchedQa)
    const fetchedEntry = fetchedQa.entries.find((e) => e.employeeId === activeEmp.id)
    assert.strictEqual(fetchedEntry.employee.employmentStatus, 'ACTIVE')
  })

  it('2. Blocks canonical 2026-11 duplicate generation when active Nov 2026 draft already exists', async () => {
    const existingCanonical = await prisma.payrollRun.findFirst({
      where: {
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISBURSED'] },
        payrollPeriod: { periodCode: '2026-11' }
      }
    })
    const dupTargetCode = existingCanonical ? '2026-11' : TEST_PERIOD_CODE
    const resDup = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: dupTargetCode })
    assert.strictEqual(resDup.status, 409)
    assert.strictEqual(resDup.body.error.code, 'DUPLICATE_PAYROLL_RUN')
  })

  it('3. Rejects approval & submission for headcount mismatch, total mismatch, and inactive employees', async () => {
    const existingQa = await prisma.payrollRun.findFirst({
      where: { payrollPeriodId: periodQa.id, status: 'DRAFT' }
    })
    assert.ok(existingQa)

    // Tamper headcount
    await prisma.payrollRun.update({
      where: { id: existingQa.id },
      data: { totalEmployees: 0 }
    })

    const resSubHead = await request(app)
      .patch(`/api/v1/payroll/runs/${existingQa.id}/submit`)
      .set('Authorization', `Bearer ${hrToken}`)
    assert.strictEqual(resSubHead.status, 400)
    assert.strictEqual(resSubHead.body.error.code, 'PAYROLL_HEADCOUNT_MISMATCH')

    const resAppHead = await request(app)
      .patch(`/api/v1/payroll/runs/${existingQa.id}/approve`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(resAppHead.status, 400)
    assert.strictEqual(resAppHead.body.error.code, 'PAYROLL_HEADCOUNT_MISMATCH')

    // Restore headcount, tamper totalGross
    const entryCount = await prisma.payrollEntry.count({ where: { payrollRunId: existingQa.id } })
    await prisma.payrollRun.update({
      where: { id: existingQa.id },
      data: { totalEmployees: entryCount, totalGross: 999999 }
    })

    const resAppTotal = await request(app)
      .patch(`/api/v1/payroll/runs/${existingQa.id}/approve`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(resAppTotal.status, 400)
    assert.strictEqual(resAppTotal.body.error.code, 'PAYROLL_TOTAL_MISMATCH')

    // Insert invalid suspended employee entry directly and ensure approval blocks
    const badRun = await prisma.payrollRun.create({
      data: {
        runNumber: 'RUN-QA-BAD-EMP',
        payrollPeriodId: periodQa.id,
        processedById: saUser.id,
        totalEmployees: 1,
        totalGross: 50000,
        totalDeductions: 0,
        totalNet: 50000,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        entries: {
          create: [{
            employeeId: suspendedEmp.id,
            calendarDays: 30,
            payableDays: 30,
            basicSalary: 50000,
            grossEarnings: 50000,
            totalDeductions: 0,
            netSalary: 50000,
            paymentStatus: 'UNPAID'
          }]
        }
      }
    })

    const resBadEmp = await request(app)
      .patch(`/api/v1/payroll/runs/${badRun.id}/approve`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(resBadEmp.status, 400)
    assert.strictEqual(resBadEmp.body.error.code, 'INVALID_PAYROLL_EMPLOYEES')
  })

  it('4. Enforces RBAC and writes Void AuditLog before allowing regeneration', async () => {
    const qaRuns = await prisma.payrollRun.findMany({
      where: { payrollPeriodId: periodQa.id, status: { not: 'VOID' } }
    })
    assert.ok(qaRuns.length > 0)

    // Employee blocked from generating, viewing runs, voiding
    const resEmpGen = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ periodCode: TEST_PERIOD_CODE })
    assert.strictEqual(resEmpGen.status, 403)

    const resEmpRuns = await request(app)
      .get('/api/v1/payroll/runs')
      .set('Authorization', `Bearer ${empToken}`)
    assert.strictEqual(resEmpRuns.status, 403)

    // HR Admin blocked from voiding or approving
    const resHrVoid = await request(app)
      .post(`/api/v1/payroll/runs/${qaRuns[0].id}/void`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ reason: 'Unauthorized attempt' })
    assert.strictEqual(resHrVoid.status, 403)

    const resHrApprove = await request(app)
      .patch(`/api/v1/payroll/runs/${qaRuns[0].id}/approve`)
      .set('Authorization', `Bearer ${hrToken}`)
    assert.strictEqual(resHrApprove.status, 403)

    // Super Admin voids runs cleanly with AuditLog
    for (const r of qaRuns) {
      const resVoid = await request(app)
        .post(`/api/v1/payroll/runs/${r.id}/void`)
        .set('Authorization', `Bearer ${saToken}`)
        .send({ reason: 'QA invalid test cleanup' })
      assert.strictEqual(resVoid.status, 200)
      assert.strictEqual(resVoid.body.data.status, 'VOID')

      const audit = await prisma.auditLog.findFirst({
        where: { entityName: 'PayrollRun', entityId: r.id, actionType: 'VOID' }
      })
      assert.ok(audit, 'AuditLog must persist VOID record')
    }
  })

  it('5. Reconcile endpoint voids invalid draft (preserving history + entries), excludes suspended/no-structure employees, and guards bank-advice exports', async () => {
    // 5a. Create an invalid draft mirroring the historical bug: headcount=0, entry for SUSPENDED employee, plus entry missing salary structure
    const staleInvalidRun = await prisma.payrollRun.create({
      data: {
        runNumber: 'RUN-QA-STALE-INV',
        payrollPeriodId: periodQa.id,
        processedById: saUser.id,
        totalEmployees: 0,
        totalGross: 50000,
        totalDeductions: 0,
        totalNet: 50000,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        entries: {
          create: [{
            employeeId: suspendedEmp.id,
            calendarDays: 30,
            payableDays: 30,
            basicSalary: 50000,
            grossEarnings: 50000,
            totalDeductions: 0,
            netSalary: 50000,
            paymentStatus: 'UNPAID'
          }]
        }
      }
    })

    // Verify GET /runs flags staleInvalidRun as unreconciled
    const listBefore = await request(app)
      .get(`/api/v1/payroll/runs?periodCode=${TEST_PERIOD_CODE}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(listBefore.status, 200)
    const flagged = listBefore.body.data.find((r) => r.id === staleInvalidRun.id)
    assert.ok(flagged)
    assert.strictEqual(flagged.isReconciled, false)
    assert.strictEqual(flagged.hasInactiveEmployees, true)
    assert.strictEqual(flagged.entryCount, 1)

    // Summary must expose validation hold too
    const summaryRes = await request(app)
      .get(`/api/v1/payroll/summary/${TEST_PERIOD_CODE}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(summaryRes.status, 200)
    assert.strictEqual(summaryRes.body.data.isReconciled, false)

    // Bank advice strictly blocked for DRAFT run
    const adviceDraft = await request(app)
      .get(`/api/v1/payroll/runs/${staleInvalidRun.id}/bank-advice`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(adviceDraft.status, 400)
    assert.strictEqual(adviceDraft.body.error.code, 'BANK_ADVICE_BLOCKED')

    // HR Admin cannot invoke Super Admin reconcile
    const hrReconcile = await request(app)
      .post(`/api/v1/payroll/runs/${staleInvalidRun.id}/reconcile`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ reason: 'Unauthorized reconcile' })
    assert.strictEqual(hrReconcile.status, 403)

    // Create a draft containing an ACTIVE employee WITHOUT salary structure and verify MISSING_SALARY_STRUCTURE blocks approval
    const noStructDraft = await prisma.payrollRun.create({
      data: {
        runNumber: 'RUN-QA-NOSTRUCT',
        payrollPeriodId: periodQa.id,
        processedById: saUser.id,
        totalEmployees: 1,
        totalGross: 25000,
        totalDeductions: 0,
        totalNet: 25000,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        entries: {
          create: [{
            employeeId: noStructEmp.id,
            calendarDays: 30,
            payableDays: 30,
            basicSalary: 25000,
            grossEarnings: 25000,
            totalDeductions: 0,
            netSalary: 25000,
            paymentStatus: 'UNPAID'
          }]
        }
      }
    })

    const approveNoStruct = await request(app)
      .patch(`/api/v1/payroll/runs/${noStructDraft.id}/approve`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(approveNoStruct.status, 400)
    assert.strictEqual(approveNoStruct.body.error.code, 'MISSING_SALARY_STRUCTURE')

    await request(app)
      .post(`/api/v1/payroll/runs/${noStructDraft.id}/void`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ reason: 'Void unstructured test draft' })

    // Reconcile staleInvalidRun: must preserve voided run + entries, create AuditLog, and build canonical reconciled draft
    const resReconcile = await request(app)
      .post(`/api/v1/payroll/runs/${staleInvalidRun.id}/reconcile`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ reason: 'QA Reconciliation Verification' })
    assert.strictEqual(resReconcile.status, 200)

    const { voidedRun, reconciledRun } = resReconcile.body.data
    assert.strictEqual(voidedRun.id, staleInvalidRun.id)
    assert.strictEqual(voidedRun.status, 'VOID')

    // Historical row & entry preserved (not deleted!)
    const preservedEntries = await prisma.payrollEntry.count({ where: { payrollRunId: staleInvalidRun.id } })
    assert.strictEqual(preservedEntries, 1)

    // Reconciled run excludes suspended & no-structure employees, includes eligible activeEmp (70,000 gross)
    assert.strictEqual(reconciledRun.isReconciled, true)
    assert.strictEqual(reconciledRun.totalEmployees, reconciledRun.entries.length)
    assert.ok(reconciledRun.entries.some((e) => e.employeeId === activeEmp.id))
    assert.ok(!reconciledRun.entries.some((e) => e.employeeId === suspendedEmp.id))
    assert.ok(!reconciledRun.entries.some((e) => e.employeeId === noStructEmp.id))

    const reconcileAudit = await prisma.auditLog.findFirst({
      where: { entityName: 'PayrollRun', entityId: reconciledRun.id, actionType: 'RECONCILE' }
    })
    assert.ok(reconcileAudit, 'AuditLog must persist RECONCILE record')

    // Approve reconciledRun -> now bank-advice can be inspected; activeEmp has no bank info -> HOLD & strict export blocked without synthetic bank data
    const approveRes = await request(app)
      .patch(`/api/v1/payroll/runs/${reconciledRun.id}/approve`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(approveRes.status, 200)

    const advicePreview = await request(app)
      .get(`/api/v1/payroll/runs/${reconciledRun.id}/bank-advice`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(advicePreview.status, 200)
    assert.ok(advicePreview.body.data.holdCount >= 1)
    const activeAdviceRow = advicePreview.body.data.items.find((i) => i.employeeCuid === activeEmp.id)
    assert.ok(activeAdviceRow)
    assert.strictEqual(activeAdviceRow.bankName, null)
    assert.strictEqual(activeAdviceRow.iban, null)
    assert.strictEqual(activeAdviceRow.isVerified, false)
    assert.strictEqual(activeAdviceRow.holdReason, 'MISSING_BANK_DETAILS')
    assert.ok(!advicePreview.body.data.exportableItems.some((i) => i.employeeCuid === activeEmp.id), 'Employee without bank details must be excluded from exportableItems')

    // Isolated single-employee approved run with missing bank details must block strict export (400 NO_VERIFIED_BANK_ACCOUNTS)
    const missingBankRun = await prisma.payrollRun.create({
      data: {
        runNumber: 'RUN-QA-NOBANK-ISO',
        payrollPeriodId: periodQa.id,
        processedById: saUser.id,
        totalEmployees: 1,
        totalGross: 70000,
        totalDeductions: 0,
        totalNet: 70000,
        status: 'APPROVED',
        paymentStatus: 'UNPAID',
        entries: {
          create: [{
            employeeId: activeEmp.id,
            calendarDays: 30,
            payableDays: 30,
            basicSalary: 50000,
            houseRentAllowance: 10000,
            medicalAllowance: 5000,
            conveyanceAllowance: 3000,
            specialAllowance: 2000,
            grossEarnings: 70000,
            totalDeductions: 0,
            netSalary: 70000,
            paymentStatus: 'UNPAID'
          }]
        }
      }
    })

    const isoPreview = await request(app)
      .get(`/api/v1/payroll/runs/${missingBankRun.id}/bank-advice`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(isoPreview.status, 200)
    assert.strictEqual(isoPreview.body.data.canExport, false)

    const adviceStrictFail = await request(app)
      .get(`/api/v1/payroll/runs/${missingBankRun.id}/bank-advice?strict=true`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(adviceStrictFail.status, 400)
    assert.strictEqual(adviceStrictFail.body.error.code, 'NO_VERIFIED_BANK_ACCOUNTS')

    // Assign valid Pakistani IBAN + ownership to activeEmp -> strict bank advice export succeeds!
    await prisma.employee.update({
      where: { id: activeEmp.id },
      data: {
        bankName: 'Meezan Bank Limited',
        bankAccountTitle: 'Active Eligible',
        bankAccountNumber: '010199998888',
        bankIban: 'PK36MEZN0001019999888801'
      }
    })

    const adviceStrictPass = await request(app)
      .get(`/api/v1/payroll/runs/${reconciledRun.id}/bank-advice?strict=true`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(adviceStrictPass.status, 200)
    assert.strictEqual(adviceStrictPass.body.data.canExport, true)
    assert.ok(adviceStrictPass.body.data.exportableItems.some((i) => i.employeeCuid === activeEmp.id && i.iban === 'PK36MEZN0001019999888801'))
  })

  it('Teardown: Cleans up isolated QA payroll fixtures without touching live November data', async () => {
    await cleanupFixtures()
  })
})
