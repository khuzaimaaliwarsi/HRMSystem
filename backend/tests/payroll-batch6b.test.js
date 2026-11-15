import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'
import { getTaxScheduleForDate } from '../src/utils/tax.js'

describe('Backend Batch 6B — Owner Leave Formula (PKR 500 / Extra Day), 31-Day Divisor & Payroll Integrity Suite', () => {
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

  let periodNov = null
  let periodFeb = null
  let paidLeaveType = null
  let unpaidLeaveType = null
  let standardShift = null

  async function cleanupAllFixtures() {
    try {
      const emps = await prisma.employee.findMany({
        where: { employeeCode: { in: ['EMP-6B-001', 'EMP-6B-002'] } },
        select: { id: true }
      })
      const empIds = emps.map((e) => e.id)

      const periods = await prisma.payrollPeriod.findMany({
        where: { periodCode: { in: ['2026-11-6B', '2027-02-6B'] } },
        select: { id: true }
      })
      const periodIds = periods.map((p) => p.id)

      if (periodIds.length > 0) {
        await prisma.salaryLiability.deleteMany({ where: { payrollPeriodId: { in: periodIds } } }).catch(() => {})
        const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: { in: periodIds } }, select: { id: true } })
        const runIds = runs.map((r) => r.id)
        if (runIds.length > 0) {
          await prisma.payrollEntry.deleteMany({ where: { payrollRunId: { in: runIds } } }).catch(() => {})
          await prisma.payrollRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => {})
        }
        await prisma.payrollPeriod.deleteMany({ where: { id: { in: periodIds } } }).catch(() => {})
      }

      if (empIds.length > 0) {
        await prisma.salaryLiability.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {})
        const loans = await prisma.employeeLoan.findMany({ where: { employeeId: { in: empIds } }, select: { id: true } })
        const loanIds = loans.map((l) => l.id)
        if (loanIds.length > 0) {
          await prisma.loanRepayment.deleteMany({ where: { loanId: { in: loanIds } } }).catch(() => {})
          await prisma.employeeLoan.deleteMany({ where: { id: { in: loanIds } } }).catch(() => {})
        }
        await prisma.overtimeRequest.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {})
        await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {})
        await prisma.shiftAssignment.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {})
        await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {})
      }

      await prisma.user.deleteMany({ where: { username: { in: ['usr_6b_emp1', 'usr_6b_emp2', 'usr_6b_sa'] } } }).catch(() => {})
      if (empIds.length > 0) {
        await prisma.employee.deleteMany({ where: { id: { in: empIds } } }).catch(() => {})
      }

      await prisma.shift.deleteMany({ where: { shiftCode: 'SHF-6B-08H' } }).catch(() => {})
      await prisma.leaveType.deleteMany({ where: { code: { in: ['CASUAL-6B', 'UNPAID-6B'] } } }).catch(() => {})
      await prisma.designation.deleteMany({ where: { code: 'DES-6B-TEST' } }).catch(() => {})
      await prisma.department.deleteMany({ where: { code: 'DEP-6B-TEST' } }).catch(() => {})
    } catch {
      // ignore
    }
  }

  it('Setup: Prepares test organization, 2 employees, shift, leave types, and periods', async () => {
    await cleanupAllFixtures()

    dept = await prisma.department.create({
      data: { code: 'DEP-6B-TEST', name: 'Batch 6B Testing Department' }
    })
    desig = await prisma.designation.create({
      data: { code: 'DES-6B-TEST', title: 'Senior Systems Engineer', level: 'SENIOR' }
    })

    // Standard Shift: 09:00 to 18:00 (8 hours paid)
    standardShift = await prisma.shift.create({
      data: {
        shiftCode: 'SHF-6B-08H',
        name: 'Batch 6B Standard 8H Shift',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '18:00',
        breakDurationMinutes: 60,
        fullDayTargetMinutes: 480,
        halfDayThresholdMinutes: 240,
        isDefault: false,
        isActive: true
      }
    })

    // Employee 1: Basic salary 62,000 PKR (exact owner formula test)
    employee1 = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-6B-001',
        firstName: 'Zeeshan',
        lastName: 'Ahmed',
        email: 'zeeshan.6b@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        bankName: 'Meezan Bank Limited',
        bankAccountTitle: 'Zeeshan Ahmed',
        bankAccountNumber: '03030303031111',
        bankIban: 'PK36MEZN0003030303031111',
        employmentStatus: 'ACTIVE'
      }
    })
    empUser1 = await prisma.user.create({
      data: {
        username: 'usr_6b_emp1',
        email: 'zeeshan.6b@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE',
        employeeId: employee1.id
      }
    })

    await prisma.shiftAssignment.create({
      data: {
        employeeId: employee1.id,
        shiftId: standardShift.id,
        effectiveFrom: new Date('2026-01-01'),
        status: 'ACTIVE',
        isPrimary: true
      }
    })

    // Employee 2: Basic salary 100,000 PKR
    employee2 = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-6B-002',
        firstName: 'Farhan',
        lastName: 'Siddiqui',
        email: 'farhan.6b@isysware.test',
        joiningDate: new Date('2026-01-01'),
        departmentId: dept.id,
        designationId: desig.id,
        bankName: 'Standard Chartered Bank',
        bankAccountTitle: 'Farhan Siddiqui',
        bankAccountNumber: '04040404042222',
        bankIban: 'PK36SCBL0004040404042222',
        employmentStatus: 'ACTIVE'
      }
    })
    empUser2 = await prisma.user.create({
      data: {
        username: 'usr_6b_emp2',
        email: 'farhan.6b@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE',
        employeeId: employee2.id
      }
    })

    // Super Admin
    saUser = await prisma.user.create({
      data: {
        username: 'usr_6b_sa',
        email: 'sa.6b@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })

    // Tokens
    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })
    empToken1 = generateAccessToken({ userId: empUser1.id, role: 'EMPLOYEE', employeeId: employee1.id })
    empToken2 = generateAccessToken({ userId: empUser2.id, role: 'EMPLOYEE', employeeId: employee2.id })

    // Salary Structures:
    // Emp 1: Base 62,000 PKR + HRA 8,000 PKR = Gross 70,000 PKR
    await prisma.salaryStructure.create({
      data: {
        employeeId: employee1.id,
        baseSalary: 62000,
        houseRentAllowance: 8000,
        grossSalary: 70000,
        effectiveFrom: new Date('2026-01-01'),
        isCurrent: true
      }
    })

    // Emp 2: Base 100,000 PKR + HRA 20,000 PKR = Gross 120,000 PKR
    await prisma.salaryStructure.create({
      data: {
        employeeId: employee2.id,
        baseSalary: 100000,
        houseRentAllowance: 20000,
        grossSalary: 120000,
        effectiveFrom: new Date('2026-01-01'),
        isCurrent: true
      }
    })

    // Leave Types
    paidLeaveType = await prisma.leaveType.create({
      data: { code: 'CASUAL-6B', name: 'Casual Paid Leave 6B', defaultDaysPerYear: 12, isPaid: true }
    })
    unpaidLeaveType = await prisma.leaveType.create({
      data: { code: 'UNPAID-6B', name: 'Unpaid Special Leave 6B', defaultDaysPerYear: 0, isPaid: false }
    })

    // Periods:
    periodNov = await prisma.payrollPeriod.create({
      data: {
        periodCode: '2026-11-6B',
        month: 11,
        year: 2026,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-30'),
        workingDaysCount: 22,
        status: 'OPEN'
      }
    })

    periodFeb = await prisma.payrollPeriod.create({
      data: {
        periodCode: '2027-02-6B',
        month: 2,
        year: 2027,
        startDate: new Date('2027-02-01'),
        endDate: new Date('2027-02-28'),
        workingDaysCount: 20,
        status: 'OPEN'
      }
    })

    assert.ok(saToken)
    assert.ok(periodNov.id)
    assert.ok(periodFeb.id)
  })

  // ============================================================================
  // 1. MANDATORY OWNER FORMULA: FIXED 31-DAY DIVISOR FOR EXPLICIT UNPAID LEAVE
  // ============================================================================
  it('1. CRITICAL: Enforces Fixed 31-Day Divisor for Explicitly Unpaid Absence (62,000 / 31 * 2 = 4,000 PKR)', async () => {
    const leave = await prisma.leaveRequest.create({
      data: {
        requestCode: 'LV-6B-UNP-01',
        employeeId: employee1.id,
        leaveTypeId: unpaidLeaveType.id, // explicitly unpaid
        startDate: new Date('2026-11-05'),
        endDate: new Date('2026-11-06'),
        durationDays: 2.0,
        reason: 'Unpaid personal absence',
        status: 'APPROVED',
        routingTier: 'SUPER_ADMIN'
      }
    })

    const resGen = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-6B' })

    assert.strictEqual(resGen.status, 201)
    const entry1 = resGen.body.data.entries.find((e) => e.employeeId === employee1.id)
    assert.ok(entry1)

    // Formula verification:
    // Daily Basic Rate = 62,000 / 31 = 2,000 PKR
    // Unpaid Deduction = 2,000 * 2 = 4,000 PKR
    assert.strictEqual(Number(entry1.unpaidAbsenceDeduction), 4000)
    assert.strictEqual(Number(entry1.otherDeductions), 0)

    // Clean up
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: resGen.body.data.id } })
    await prisma.payrollRun.delete({ where: { id: resGen.body.data.id } })
    await prisma.leaveRequest.delete({ where: { id: leave.id } })
  })

  // ============================================================================
  // 2. FEBRUARY CALENDAR PRESERVATION (100% FULL BASIC SALARY)
  // ============================================================================
  it('2. CRITICAL: Preserves 100% Full Monthly Salary in February (28-day month receives full basic salary)', async () => {
    const resGenFeb = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2027-02-6B' })

    assert.strictEqual(resGenFeb.status, 201)
    const entry1 = resGenFeb.body.data.entries.find((e) => e.employeeId === employee1.id)
    assert.ok(entry1)

    assert.strictEqual(Number(entry1.calendarDays), 28)
    assert.strictEqual(Number(entry1.unpaidAbsenceDeduction), 0)
    assert.strictEqual(Number(entry1.otherDeductions), 0)
    assert.strictEqual(Number(entry1.basicSalary), 62000)
    assert.strictEqual(Number(entry1.grossEarnings), 70000)

    // Clean up
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: resGenFeb.body.data.id } })
    await prisma.payrollRun.delete({ where: { id: resGenFeb.body.data.id } })
  })

  // ============================================================================
  // 3. OWNER LEAVE POLICY TABLE: 0, 1, 2, 3, 4, 5 LEAVE DAYS VERIFICATION
  // ============================================================================
  it('3. OWNER LEAVE POLICY TABLE: Verifies 0, 1, 2, 3, 4, 5 leave days with exactly PKR 500 / extra day', async () => {
    // Test scenarios from Owner's table:
    // [days, expectedExtraDays, expectedDeduction, expectedRemainingBasic]
    // Base salary is PKR 62,000.
    const scenarios = [
      { days: 0, extra: 0, deduction: 0, remainingBase: 62000 },
      { days: 1, extra: 0, deduction: 0, remainingBase: 62000 },
      { days: 2, extra: 0, deduction: 0, remainingBase: 62000 },
      { days: 3, extra: 1, deduction: 500, remainingBase: 61500 },
      { days: 4, extra: 2, deduction: 1000, remainingBase: 61000 }, // Owner Example: 62,000 - 1,000 = 61,000 PKR
      { days: 5, extra: 3, deduction: 1500, remainingBase: 60500 }
    ]

    for (const sc of scenarios) {
      let createdLeave = null
      if (sc.days > 0) {
        // Create approved casual leave for November
        createdLeave = await prisma.leaveRequest.create({
          data: {
            requestCode: `LV-6B-TBL-${sc.days}`,
            employeeId: employee1.id,
            leaveTypeId: paidLeaveType.id,
            startDate: new Date('2026-11-02'),
            endDate: new Date(`2026-11-${String(1 + sc.days).padStart(2, '0')}`),
            durationDays: sc.days,
            reason: `Testing ${sc.days} leave days scenario`,
            status: 'APPROVED',
            routingTier: 'SUPER_ADMIN'
          }
        })
      }

      const resGen = await request(app)
        .post('/api/v1/payroll/runs/generate')
        .set('Authorization', `Bearer ${saToken}`)
        .send({ periodCode: '2026-11-6B' })

      assert.strictEqual(resGen.status, 201)
      const entry1 = resGen.body.data.entries.find((e) => e.employeeId === employee1.id)

      // 1. Extra leave days check
      assert.strictEqual(Number(entry1.unpaidLeaveDays), sc.extra)

      // 2. Extra leave deduction check: EXACTLY sc.extra * 500
      assert.strictEqual(Number(entry1.otherDeductions), sc.deduction)

      // 3. Unpaid absence deduction MUST BE ZERO (NO baseSalary / 31 deduction applied!)
      assert.strictEqual(Number(entry1.unpaidAbsenceDeduction), 0)

      // 4. Remaining basic salary check: Base 62,000 - Leave Deduction = sc.remainingBase
      // Basic is 62,000; HRA is 8,000. Gross = 70,000.
      const netWithoutTax = Number(entry1.grossEarnings) - Number(entry1.otherDeductions) - 8000
      assert.strictEqual(netWithoutTax, sc.remainingBase)

      // Payslip verification
      const resSlip = await request(app)
        .get(`/api/v1/payroll/payslips/${entry1.id}`)
        .set('Authorization', `Bearer ${empToken1}`)

      assert.strictEqual(resSlip.status, 200)
      assert.strictEqual(resSlip.body.data.deductions.extraLeaveDeduction, sc.deduction)
      assert.strictEqual(resSlip.body.data.deductions.unpaidAbsenceDeduction, 0)

      // Clean up run and leave
      await prisma.payrollEntry.deleteMany({ where: { payrollRunId: resGen.body.data.id } })
      await prisma.payrollRun.delete({ where: { id: resGen.body.data.id } })
      if (createdLeave) {
        await prisma.leaveRequest.delete({ where: { id: createdLeave.id } })
      }
    }
  })

  // ============================================================================
  // 4. ATTENDANCE & LEAVE RECONCILIATION: CANCELLED & REJECTED LEAVES INCUR 0 DEDUCTION
  // ============================================================================
  it('4. RECONCILIATION: Cancelled and Rejected leaves incur ZERO deduction', async () => {
    // 3 days leave that was REJECTED
    const rejLeave = await prisma.leaveRequest.create({
      data: {
        requestCode: 'LV-6B-REJ-01',
        employeeId: employee1.id,
        leaveTypeId: paidLeaveType.id,
        startDate: new Date('2026-11-10'),
        endDate: new Date('2026-11-12'),
        durationDays: 3.0,
        reason: 'Unapproved holiday request',
        status: 'REJECTED',
        routingTier: 'SUPER_ADMIN'
      }
    })

    // 2 days leave that was CANCELLED
    const canLeave = await prisma.leaveRequest.create({
      data: {
        requestCode: 'LV-6B-CAN-01',
        employeeId: employee1.id,
        leaveTypeId: paidLeaveType.id,
        startDate: new Date('2026-11-15'),
        endDate: new Date('2026-11-16'),
        durationDays: 2.0,
        reason: 'Cancelled personal trip',
        status: 'CANCELLED',
        routingTier: 'SUPER_ADMIN'
      }
    })

    const resGen = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-6B' })

    assert.strictEqual(resGen.status, 201)
    const entry1 = resGen.body.data.entries.find((e) => e.employeeId === employee1.id)

    // Neither rejected nor cancelled leaves deduct anything
    assert.strictEqual(Number(entry1.otherDeductions), 0)
    assert.strictEqual(Number(entry1.unpaidAbsenceDeduction), 0)

    // Clean up
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: resGen.body.data.id } })
    await prisma.payrollRun.delete({ where: { id: resGen.body.data.id } })
    await prisma.leaveRequest.deleteMany({ where: { id: { in: [rejLeave.id, canLeave.id] } } })
  })

  // ============================================================================
  // 5. ATTENDANCE & LEAVE RECONCILIATION: CROSS-MONTH ALLOCATION & QUOTA RESET
  // ============================================================================
  it('5. RECONCILIATION: Cross-Month Leave Allocation & Monthly Quota Reset', async () => {
    // 4 days leave spanning Oct 30 to Nov 2 (2 days in Oct, 2 days in Nov)
    const crossLeave = await prisma.leaveRequest.create({
      data: {
        requestCode: 'LV-6B-CROSS-01',
        employeeId: employee1.id,
        leaveTypeId: paidLeaveType.id,
        startDate: new Date('2026-10-30'),
        endDate: new Date('2026-11-02'),
        durationDays: 4.0,
        reason: 'Cross-month medical recovery',
        status: 'APPROVED',
        routingTier: 'SUPER_ADMIN'
      }
    })

    const resGen = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-6B' })

    assert.strictEqual(resGen.status, 201)
    const entry1 = resGen.body.data.entries.find((e) => e.employeeId === employee1.id)

    // Exactly 2 days fall into November (Nov 1 and Nov 2).
    // First 2 days are company-allowed (PKR 0).
    // Therefore, extraLeaveDays = 0, otherDeductions = 0!
    assert.strictEqual(Number(entry1.unpaidLeaveDays), 0)
    assert.strictEqual(Number(entry1.otherDeductions), 0)
    assert.strictEqual(Number(entry1.unpaidAbsenceDeduction), 0)

    // Clean up
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: resGen.body.data.id } })
    await prisma.payrollRun.delete({ where: { id: resGen.body.data.id } })
    await prisma.leaveRequest.delete({ where: { id: crossLeave.id } })
  })

  // ============================================================================
  // 6. 31-DAY HOURLY OVERTIME FORMULA
  // ============================================================================
  it('6. 31-DAY HOURLY OVERTIME: (62,000 / 31) / 8 = 250 PKR/hr -> 4 hrs @ 1.5x = 1,500 PKR', async () => {
    const ot = await prisma.overtimeRequest.create({
      data: {
        requestCode: 'OT-6B-001',
        employeeId: employee1.id,
        overtimeDate: new Date('2026-11-12'),
        startTime: '18:00',
        endTime: '22:00',
        durationMinutes: 240,
        reason: 'Production deployment coverage',
        status: 'APPROVED'
      }
    })

    const resGen = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-6B' })

    assert.strictEqual(resGen.status, 201)
    const entry1 = resGen.body.data.entries.find((e) => e.employeeId === employee1.id)

    assert.strictEqual(Number(entry1.overtimeHours), 4)
    assert.strictEqual(Number(entry1.overtimeAmount), 1500)
    assert.strictEqual(Number(entry1.grossEarnings), 71500)

    // Clean up
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: resGen.body.data.id } })
    await prisma.payrollRun.delete({ where: { id: resGen.body.data.id } })
    await prisma.overtimeRequest.delete({ where: { id: ot.id } })
  })

  // ============================================================================
  // 7. STRUCTURED NEGATIVE NET SALARY & SALARY LIABILITY ACCOUNTING
  // ============================================================================
  it('7. LIABILITY ACCOUNTING: Creates auditable SalaryLiability record when deductions exceed gross', async () => {
    // Setup loan with 100,000 installment on 70,000 gross
    const bigLoan = await prisma.employeeLoan.create({
      data: {
        loanNumber: 'LN-6B-BIG-01',
        employeeId: employee1.id,
        loanType: 'PERSONAL_LOAN',
        principalAmount: 200000,
        repaymentMonths: 2,
        monthlyInstallment: 100000,
        totalRepaidAmount: 0,
        remainingBalance: 200000,
        status: 'DISBURSED'
      }
    })

    const resGen = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-6B' })

    assert.strictEqual(resGen.status, 201)
    const entry1 = resGen.body.data.entries.find((e) => e.employeeId === employee1.id)

    // Net salary is capped at 0
    assert.strictEqual(Number(entry1.netSalary), 0)

    // Structured monetary liability column is populated on entry
    assert.ok(Number(entry1.unrecoveredLiability) > 0)
    const liabilityAmt = Number(entry1.unrecoveredLiability)

    // An auditable SalaryLiability record is created in database
    const liabilityRecord = await prisma.salaryLiability.findFirst({
      where: { employeeId: employee1.id, payrollPeriodId: periodNov.id }
    })
    assert.ok(liabilityRecord)
    assert.strictEqual(Number(liabilityRecord.originalAmount), liabilityAmt)
    assert.strictEqual(Number(liabilityRecord.outstandingBalance), liabilityAmt)
    assert.strictEqual(liabilityRecord.status, 'OUTSTANDING')

    // Clean up
    await prisma.salaryLiability.deleteMany({ where: { payrollPeriodId: periodNov.id } })
    await prisma.employeeLoan.delete({ where: { id: bigLoan.id } })
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: resGen.body.data.id } })
    await prisma.payrollRun.delete({ where: { id: resGen.body.data.id } })
  })

  // ============================================================================
  // 8. DISBURSEMENT VERIFICATION & INTEGRITY
  // ============================================================================
  it('8. DISBURSEMENT INTEGRITY: Validates payment metadata, persists actor attribution, and prevents duplicates', async () => {
    const resGen = await request(app)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ periodCode: '2026-11-6B' })

    const runId = resGen.body.data.id
    await request(app).patch(`/api/v1/payroll/runs/${runId}/submit`).set('Authorization', `Bearer ${saToken}`)
    await request(app).patch(`/api/v1/payroll/runs/${runId}/approve`).set('Authorization', `Bearer ${saToken}`)

    // A. Validation failure: missing transaction reference
    const resNoRef = await request(app)
      .patch(`/api/v1/payroll/runs/${runId}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ paymentMethod: 'BANK_TRANSFER', transactionReference: '' })

    assert.strictEqual(resNoRef.status, 400)
    assert.strictEqual(resNoRef.body.error.code, 'VALIDATION_ERROR')

    // B. Validation failure: future paymentDate
    const resFuture = await request(app)
      .patch(`/api/v1/payroll/runs/${runId}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'TXN-CORP-VALID',
        paymentDate: '2099-01-01'
      })

    assert.strictEqual(resFuture.status, 400)
    assert.strictEqual(resFuture.body.error.code, 'VALIDATION_ERROR')

    // C. Successful authorized disbursement
    const resDisb = await request(app)
      .patch(`/api/v1/payroll/runs/${runId}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'TXN-CORP-NOV-2026',
        paymentDate: '2026-11-04'
      })

    assert.strictEqual(resDisb.status, 200)
    assert.strictEqual(resDisb.body.data.status, 'DISBURSED')
    assert.strictEqual(resDisb.body.data.paymentStatus, 'PAID')

    // Verify actor attribution persisted on database record
    const runInDb = await prisma.payrollRun.findUnique({ where: { id: runId } })
    assert.strictEqual(runInDb.disbursedById, saUser.id)
    assert.ok(runInDb.disbursedAt)

    // D. Duplicate disbursement strictly rejected
    const resDup = await request(app)
      .patch(`/api/v1/payroll/runs/${runId}/disburse`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'TXN-CORP-NOV-DUPLICATE'
      })

    assert.strictEqual(resDup.status, 400)
    assert.strictEqual(resDup.body.error.code, 'ALREADY_DISBURSED')

    // E. Immutability: cannot submit or regenerate disbursed run
    const resSub = await request(app)
      .patch(`/api/v1/payroll/runs/${runId}/submit`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(resSub.status, 400)

    // Clean up
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: runId } })
    await prisma.payrollRun.delete({ where: { id: runId } })
  })

  // ============================================================================
  // 9. TAX ENGINE SCHEDULE SAFEGUARDS
  // ============================================================================
  it('9. TAX ENGINE: Resolves active schedule and throws MISSING_TAX_CONFIGURATION outside configured dates', () => {
    const sched2026 = getTaxScheduleForDate(new Date('2026-11-01'))
    assert.strictEqual(sched2026.taxYear, '2026-2027')

    assert.throws(
      () => {
        getTaxScheduleForDate(new Date('2024-01-01'))
      },
      (err) => err.code === 'MISSING_TAX_CONFIGURATION'
    )
  })

  it('Teardown: Cleans up all Batch 6B test fixtures', async () => {
    await cleanupAllFixtures()
  })
})
