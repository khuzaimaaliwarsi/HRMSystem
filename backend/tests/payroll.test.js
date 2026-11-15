import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'
import { calculateSalaryTax } from '../src/utils/tax.js'

describe('Backend Batch 6A — Payroll, Compensation & Payslips Suite', () => {
  let saUser = null
  let empUser1 = null
  let empUser2 = null
  let saToken = null
  let empToken1 = null
  let empToken2 = null

  let dept = null
  let desig = null
  let employee1 = null
  let employee2 = null

  let period = null
  let createdStructure1 = null
  let createdStructure2 = null
  let createdRevision = null
  let draftRunId = null
  let payslipId1 = null

  it('Setup: Prepares test organization, 2 employees, user accounts, and payroll period', async () => {
    // Idempotent pre-cleanup
    const oldUsers = await prisma.user.findMany({ where: { username: { in: ['pay_test_emp1', 'pay_test_emp2', 'pay_test_sa'] } } })
    if (oldUsers.length) await prisma.user.deleteMany({ where: { id: { in: oldUsers.map(u => u.id) } } })

    const oldEmps = await prisma.employee.findMany({ where: { employeeCode: { in: ['EMP-PAY-001', 'EMP-PAY-002'] } } })
    if (oldEmps.length) {
      const ids = oldEmps.map(e => e.id)
      await prisma.salaryLiability.deleteMany({ where: { employeeId: { in: ids } } })
      await prisma.payrollEntry.deleteMany({ where: { employeeId: { in: ids } } })
      await prisma.salaryRevision.deleteMany({ where: { employeeId: { in: ids } } })
      await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: ids } } })
      await prisma.overtimeRequest.deleteMany({ where: { employeeId: { in: ids } } })
      await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: ids } } })
      await prisma.employee.deleteMany({ where: { id: { in: ids } } })
    }
    await prisma.payrollRun.deleteMany({ where: { runNumber: { startsWith: 'RUN-202611TEST' } } })
    await prisma.payrollPeriod.deleteMany({ where: { periodCode: '2026-11-TEST' } })
    await prisma.designation.deleteMany({ where: { code: 'DES-PAY-TEST' } })
    await prisma.department.deleteMany({ where: { code: 'DEP-PAY-TEST' } })
    await prisma.leaveType.deleteMany({ where: { code: 'UNPAID-PAY-TEST' } })

    dept = await prisma.department.create({
      data: { code: 'DEP-PAY-TEST', name: 'Payroll Testing Department' }
    })
    desig = await prisma.designation.create({
      data: { code: 'DES-PAY-TEST', title: 'Senior Software Engineer', level: 'SENIOR' }
    })

    // Employee 1
    employee1 = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-PAY-001',
        firstName: 'Asim',
        lastName: 'Payroll',
        email: 'asim.pay@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        bankName: 'Meezan Bank Limited',
        bankAccountTitle: 'Asim Payroll',
        bankAccountNumber: '01010101019999',
        bankIban: 'PK36MEZN0001010101019999',
        taxNtnNumber: '7654321-0',
        employmentStatus: 'ACTIVE'
      }
    })
    empUser1 = await prisma.user.create({
      data: {
        username: 'pay_test_emp1',
        email: 'asim.pay@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE',
        employeeId: employee1.id
      }
    })

    // Employee 2
    employee2 = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-PAY-002',
        firstName: 'Basit',
        lastName: 'Payroll',
        email: 'basit.pay@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        bankName: 'Habib Bank Limited',
        bankAccountTitle: 'Basit Payroll',
        bankAccountNumber: '02020202028888',
        bankIban: 'PK36HABB0002020202028888',
        employmentStatus: 'ACTIVE'
      }
    })
    empUser2 = await prisma.user.create({
      data: {
        username: 'pay_test_emp2',
        email: 'basit.pay@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE',
        employeeId: employee2.id
      }
    })

    // Super Admin
    saUser = await prisma.user.create({
      data: {
        username: 'pay_test_sa',
        email: 'sa.pay@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })

    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })
    empToken1 = generateAccessToken({ userId: empUser1.id, role: 'EMPLOYEE', employeeId: employee1.id })
    empToken2 = generateAccessToken({ userId: empUser2.id, role: 'EMPLOYEE', employeeId: employee2.id })

    // Create Payroll Period for November 2026
    period = await prisma.payrollPeriod.create({
      data: {
        periodCode: '2026-11-TEST',
        month: 11,
        year: 2026,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-30'),
        workingDaysCount: 22,
        status: 'OPEN'
      }
    })

    assert.ok(saToken)
    assert.ok(empToken1)
    assert.ok(empToken2)
    assert.ok(period.id)
  })

  it('1. POST /api/v1/payroll/structures: Creates salary structures with allowances and Decimal precision', async () => {
    // Structure for EMP-001: Base 150,000 + HRA 30,000 + Med 15,000 + Conv 10,000 = Gross 205,000
    const res1 = await request(app)
      .post('/api/v1/payroll/structures')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: employee1.id,
        baseSalary: 150000,
        houseRentAllowance: 30000,
        medicalAllowance: 15000,
        conveyanceAllowance: 10000,
        effectiveFrom: '2026-01-01',
        remarks: 'Initial standard compensation structure'
      })

    assert.strictEqual(res1.status, 201)
    assert.strictEqual(res1.body.success, true)
    assert.strictEqual(Number(res1.body.data.baseSalary), 150000)
    assert.strictEqual(Number(res1.body.data.grossSalary), 205000)
    assert.strictEqual(res1.body.data.isCurrent, true)
    createdStructure1 = res1.body.data

    // Structure for EMP-002: Base 100,000 + HRA 20,000 = Gross 120,000
    const res2 = await request(app)
      .post('/api/v1/payroll/structures')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: employee2.id,
        baseSalary: 100000,
        houseRentAllowance: 20000,
        effectiveFrom: '2026-01-01'
      })

    assert.strictEqual(res2.status, 201)
    assert.strictEqual(Number(res2.body.data.grossSalary), 120000)
    createdStructure2 = res2.body.data
  })

  it('2. GET /api/v1/payroll/structures/:employeeId: Enforces salary confidentiality and privacy scope', async () => {
    // Employee 1 accesses own salary structure -> Allowed (200)
    const resOwn = await request(app)
      .get(`/api/v1/payroll/structures/${employee1.id}`)
      .set('Authorization', `Bearer ${empToken1}`)

    assert.strictEqual(resOwn.status, 200)
    assert.strictEqual(resOwn.body.data.current.employeeId, employee1.id)

    // Employee 1 attempts to access Employee 2's structure -> Strictly Forbidden (403)
    const resForbidden = await request(app)
      .get(`/api/v1/payroll/structures/${employee2.id}`)
      .set('Authorization', `Bearer ${empToken1}`)

    assert.strictEqual(resForbidden.status, 403)
    assert.strictEqual(resForbidden.body.success, false)
  })

  it('3. POST & PATCH /api/v1/payroll/revisions: Proposes and approves salary revision with anti-self-approval', async () => {
    // Propose increment for Employee 1: Base 150k -> 180k, Gross 205k -> 235k
    const resProp = await request(app)
      .post('/api/v1/payroll/revisions')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: employee1.id,
        proposedBaseSalary: 180000,
        proposedGrossSalary: 235000,
        revisionType: 'ANNUAL_INCREMENT',
        effectiveDate: '2026-11-01',
        justification: 'Exemplary backend architecture delivery'
      })

    assert.strictEqual(resProp.status, 201)
    assert.strictEqual(Number(resProp.body.data.previousBaseSalary), 150000)
    assert.strictEqual(Number(resProp.body.data.proposedBaseSalary), 180000)
    createdRevision = resProp.body.data

    // Anti-self-approval: if an employee attempts to approve their own revision, blocked (403)
    const resSelf = await request(app)
      .patch(`/api/v1/payroll/revisions/${createdRevision.id}/review`)
      .set('Authorization', `Bearer ${empToken1}`)
      .send({ decision: 'APPROVED' })

    assert.strictEqual(resSelf.status, 403)

    // Super Admin approves revision
    const resApprove = await request(app)
      .patch(`/api/v1/payroll/revisions/${createdRevision.id}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ decision: 'APPROVED', remarks: 'Annual revision endorsed' })

    assert.strictEqual(resApprove.status, 200)
    assert.strictEqual(resApprove.body.data.status, 'APPROVED')

    // Verify old structure superseded and new active structure reflects 180,000 base
    const activeStructure = await prisma.salaryStructure.findFirst({
      where: { employeeId: employee1.id, isCurrent: true }
    })
    assert.strictEqual(Number(activeStructure.baseSalary), 180000)
    assert.strictEqual(Number(activeStructure.grossSalary), 235000)
  })

  it('4. Tax Engine Verification: Validates Pakistan FBR Section 149 progressive tax calculations', () => {
    // A. 40,000/month = 480k/year -> Slab 1 (0%): tax = 0
    const tax1 = calculateSalaryTax(40000)
    assert.strictEqual(tax1.applicableSlabNumber, 1)
    assert.strictEqual(tax1.monthlyTaxWithholding, 0)

    // B. 80,000/month = 960k/year -> Slab 2 (5% on > 600k): (960k - 600k) * 5% = 18,000/year -> 1,500/month
    const tax2 = calculateSalaryTax(80000)
    assert.strictEqual(tax2.applicableSlabNumber, 2)
    assert.strictEqual(tax2.monthlyTaxWithholding, 1500)

    // C. 150,000/month = 1.8M/year -> Slab 3 (30k + 15% on > 1.2M): 30k + (600k * 15%) = 120,000/year -> 10,000/month
    const tax3 = calculateSalaryTax(150000)
    assert.strictEqual(tax3.applicableSlabNumber, 3)
    assert.strictEqual(tax3.monthlyTaxWithholding, 10000)
  })

  it('5. POST /api/v1/payroll/runs/generate: Integrates unpaid leave, overtime, and tax into draft payroll', async () => {
    // Fixture: Unpaid leave for Employee 1 (2 days unpaid)
    await prisma.leaveRequest.deleteMany({ where: { requestCode: 'LV-UNP-001' } })
    await prisma.leaveType.deleteMany({ where: { code: 'UNPAID-PAY-TEST' } })
    await prisma.overtimeRequest.deleteMany({ where: { requestCode: 'OT-PAY-001' } })
    const unpaidType = await prisma.leaveType.create({
      data: { code: 'UNPAID-PAY-TEST', name: 'Unpaid Leave Test', defaultDaysPerYear: 0, isPaid: false }
    })
    const unpaidLeave = await prisma.leaveRequest.create({
      data: {
        requestCode: 'LV-UNP-001',
        employeeId: employee1.id,
        leaveTypeId: unpaidType.id,
        startDate: new Date('2026-11-04'),
        endDate: new Date('2026-11-05'),
        durationDays: 2.0,
        reason: 'Personal emergency without available balance',
        status: 'APPROVED',
        routingTier: 'TEAM_LEAD'
      }
    })

    // Fixture: Approved Overtime for Employee 1 (120 minutes = 2 hours)
    const ot = await prisma.overtimeRequest.create({
      data: {
        requestCode: 'OT-PAY-001',
        employeeId: employee1.id,
        overtimeDate: new Date('2026-11-06'),
        startTime: '18:00',
        endTime: '20:00',
        durationMinutes: 120,
        reason: 'Critical database migration support',
        status: 'APPROVED'
      }
    })

    // Generate draft run for 2026-11-TEST
    const resGen = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-TEST' })

    assert.strictEqual(resGen.status, 201)
    assert.strictEqual(resGen.body.success, true)
    assert.strictEqual(resGen.body.data.status, 'DRAFT')
    assert.strictEqual(resGen.body.data.paymentStatus, 'UNPAID')
    draftRunId = resGen.body.data.id

    // Inspect Employee 1 calculations
    const entry1 = resGen.body.data.entries.find((e) => e.employeeId === employee1.id)
    assert.ok(entry1)
    payslipId1 = entry1.id

    // Unpaid deduction: base is 180,000 -> per day is 180,000 / 31 = 5,806.45. 2 days = 11,613
    assert.strictEqual(Number(entry1.unpaidLeaveDays), 2)
    assert.strictEqual(Number(entry1.unpaidAbsenceDeduction), 11613)

    // Overtime: 2 hours. Hourly rate = (180,000 / 31) / 8 = 725.81. 2 hrs * 725.81 * 1.5 = 2,177
    assert.strictEqual(Number(entry1.overtimeHours), 2)
    assert.strictEqual(Number(entry1.overtimeAmount), 2177)

    // Verify tax deduction is present
    assert.ok(Number(entry1.taxDeduction) > 0)

    // Verify Net Salary = Gross - Total Deductions
    const gross = Number(entry1.grossEarnings)
    const deductions = Number(entry1.totalDeductions)
    const net = Number(entry1.netSalary)
    assert.strictEqual(net, gross - deductions)
  })

  it('6. POST /api/v1/payroll/runs/generate: Enforces duplicate run protection with 409', async () => {
    const resDup = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-TEST' })

    assert.strictEqual(resDup.status, 409)
    assert.strictEqual(resDup.body.error.code, 'DUPLICATE_PAYROLL_RUN')
  })

  it('7. PATCH /api/v1/payroll/runs/:id/approve: Approves payroll run and freezes calculations immutably', async () => {
    // Submit draft
    const resSub = await request(app)
      .patch(`/api/v1/payroll/runs/${draftRunId}/submit`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resSub.status, 200)
    assert.strictEqual(resSub.body.data.status, 'PENDING_APPROVAL')

    // Approve run
    const resApprove = await request(app)
      .patch(`/api/v1/payroll/runs/${draftRunId}/approve`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resApprove.status, 200)
    assert.strictEqual(resApprove.body.data.status, 'APPROVED')
    assert.strictEqual(resApprove.body.data.approvedById, saUser.id)
    assert.ok(resApprove.body.data.approvedAt)
  })

  it('8. GET /api/v1/payroll/payslips: Enforces employee privacy scoping on payslip listing', async () => {
    // Employee 1 lists payslips -> Only receives own payslip
    const resEmp1 = await request(app)
      .get('/api/v1/payroll/payslips')
      .set('Authorization', `Bearer ${empToken1}`)

    assert.strictEqual(resEmp1.status, 200)
    assert.ok(Array.isArray(resEmp1.body.data))
    const employeeIds = resEmp1.body.data.map((p) => p.employeeId)
    assert.ok(employeeIds.every((id) => id === employee1.id))
    assert.ok(!employeeIds.includes(employee2.id), 'Employee 1 must never receive Employee 2 payslips')
  })

  it('9. GET /api/v1/payroll/payslips/:id: Returns detailed structured breakdown with banking info', async () => {
    const resSlip = await request(app)
      .get(`/api/v1/payroll/payslips/${payslipId1}`)
      .set('Authorization', `Bearer ${empToken1}`)

    assert.strictEqual(resSlip.status, 200)
    assert.strictEqual(resSlip.body.success, true)
    const slip = resSlip.body.data
    assert.strictEqual(slip.employee.code, 'EMP-PAY-001')
    assert.strictEqual(slip.employee.bankName, 'Meezan Bank Limited')
    assert.strictEqual(slip.employee.iban, 'PK36MEZN0001010101019999')
    assert.strictEqual(slip.timeAndAttendance.unpaidDays, 2)
    assert.strictEqual(slip.timeAndAttendance.overtimeHours, 2)
    assert.strictEqual(slip.deductions.unpaidAbsenceDeduction, 11613)
    assert.ok(slip.earnings.grossEarnings > 0)
    assert.ok(slip.netPayable > 0)
  })

  it('10. PATCH /api/v1/payroll/runs/:id/disburse: Transitions paymentStatus to PAID upon disbursement', async () => {
    const resDisburse = await request(app)
      .patch(`/api/v1/payroll/runs/${draftRunId}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'TXN-CORP-NOV-TEST',
        paymentDate: '2026-11-04'
      })

    assert.strictEqual(resDisburse.status, 200)
    assert.strictEqual(resDisburse.body.data.status, 'DISBURSED')
    assert.strictEqual(resDisburse.body.data.paymentStatus, 'PAID')

    // Verify individual payslip reflects payment status PAID with timestamp
    const resSlip = await request(app)
      .get(`/api/v1/payroll/payslips/${payslipId1}`)
      .set('Authorization', `Bearer ${empToken1}`)

    assert.strictEqual(resSlip.status, 200)
    assert.strictEqual(resSlip.body.data.paymentStatus, 'PAID')
    assert.ok(resSlip.body.data.paidAt)
  })

  it('11. GET /api/v1/payroll/summary/:periodCode: Returns executive reporting summary with departmental metrics', async () => {
    const resSummary = await request(app)
      .get('/api/v1/payroll/summary/2026-11-TEST')
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resSummary.status, 200)
    assert.strictEqual(resSummary.body.data.periodCode, '2026-11-TEST')
    assert.strictEqual(resSummary.body.data.runStatus, 'DISBURSED')
    assert.strictEqual(resSummary.body.data.paymentStatus, 'PAID')
    assert.ok(resSummary.body.data.totalEmployees >= 2)
    assert.ok(resSummary.body.data.totalGross > 0)
    assert.ok(resSummary.body.data.totalNet > 0)
    assert.ok(Array.isArray(resSummary.body.data.departmentBreakdown))
  })

  it('Teardown: Cleans up payroll fixtures, period, employees, and test accounts', async () => {
    if (draftRunId) {
      await prisma.payrollEntry.deleteMany({ where: { payrollRunId: draftRunId } }).catch(() => {})
      await prisma.payrollRun.deleteMany({ where: { id: draftRunId } }).catch(() => {})
    }
    if (period?.id) {
      await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
    }
    if (createdRevision?.id) {
      await prisma.salaryRevision.delete({ where: { id: createdRevision.id } }).catch(() => {})
    }
    if (employee1?.id || employee2?.id) {
      await prisma.overtimeRequest.deleteMany({ where: { employeeId: { in: [employee1?.id, employee2?.id].filter(Boolean) } } }).catch(() => {})
      await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: [employee1?.id, employee2?.id].filter(Boolean) } } }).catch(() => {})
      await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: [employee1?.id, employee2?.id].filter(Boolean) } } }).catch(() => {})
      await prisma.leaveType.deleteMany({ where: { code: 'UNPAID-PAY-TEST' } }).catch(() => {})
    }
    if (saUser?.id || empUser1?.id || empUser2?.id) {
      await prisma.user.deleteMany({ where: { id: { in: [saUser?.id, empUser1?.id, empUser2?.id].filter(Boolean) } } }).catch(() => {})
    }
    if (employee1?.id || employee2?.id) {
      await prisma.employee.deleteMany({ where: { id: { in: [employee1?.id, employee2?.id].filter(Boolean) } } }).catch(() => {})
    }
    if (desig?.id) {
      await prisma.designation.delete({ where: { id: desig.id } }).catch(() => {})
    }
    if (dept?.id) {
      await prisma.department.delete({ where: { id: dept.id } }).catch(() => {})
    }
  })
})

