import test from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/config/database.js'
import adminSettingsService from '../src/services/adminSettingsService.js'
import { compensationService } from '../src/services/compensationService.js'
import { loanService } from '../src/services/loanService.js'
import travelExpenseService from '../src/services/travelExpenseService.js'
import payrollTaxService from '../src/services/payrollTaxService.js'
import { requireLinkedEmployee } from '../src/middleware/auth.js'

test('iSysware HRMS — Payroll & Expense Policies & Portal Eligibility QA Test Suite', async (t) => {
  // Setup users for test
  let superAdminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
  if (!superAdminUser) {
    superAdminUser = await prisma.user.create({
      data: {
        username: 'superadmin_qa_test',
        email: 'superadmin_qa@isysware.com',
        passwordHash: 'dummy',
        displayName: 'Super Admin QA',
        role: 'SUPER_ADMIN',
        isActive: true,
        isProtected: true,
        employeeId: null
      }
    })
  }

  let hrAdminUser = await prisma.user.findFirst({ where: { role: 'HR_ADMIN' } })
  if (!hrAdminUser) {
    hrAdminUser = await prisma.user.create({
      data: {
        username: 'hradmin_qa_test',
        email: 'hradmin_qa@isysware.com',
        passwordHash: 'dummy',
        displayName: 'HR Admin QA',
        role: 'HR_ADMIN',
        isActive: true,
        employeeId: null
      }
    })
  }

  // Setup test department & designation & employee
  let dept = await prisma.department.findFirst()
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: 'Engineering QA', code: 'ENG-QA' }
    })
  }

  let desig = await prisma.designation.findFirst()
  if (!desig) {
    desig = await prisma.designation.create({
      data: { title: 'Senior QA Engineer', code: 'SQA-01' }
    })
  }

  let testEmp = await prisma.employee.findFirst({ where: { employeeCode: 'EMP-POL-QA' } })
  if (!testEmp) {
    testEmp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-POL-QA',
        firstName: 'Policy',
        lastName: 'Tester',
        email: 'policy.qa@isysware.com',
        departmentId: dept.id,
        designationId: desig.id,
        joiningDate: new Date('2026-01-01'),
        employmentStatus: 'ACTIVE'
      }
    })
  }

  // Ensure active salary structure (basic: 50,000)
  let salaryStruct = await prisma.salaryStructure.findFirst({
    where: { employeeId: testEmp.id, isCurrent: true }
  })
  if (!salaryStruct) {
    salaryStruct = await prisma.salaryStructure.create({
      data: {
        employeeId: testEmp.id,
        baseSalary: 50000,
        grossSalary: 65000,
        isCurrent: true,
        effectiveFrom: new Date('2026-01-01')
      }
    })
  }

  // Ensure base company policies are initialized
  await adminSettingsService.getCompanyPolicies()

  // --------------------------------------------------------------------------
  // TEST 1: Payroll Tax Configuration update without employee overrides
  // --------------------------------------------------------------------------
  await t.test('1. Payroll Tax Configuration: Update global config and calculate tax', async () => {
    const updated = await payrollTaxService.updateTaxConfig(
      {
        enabled: true,
        mode: 'PERCENTAGE',
        ratePercentage: 7.5,
        fixedAmount: 0,
        reason: 'Automated QA flat percentage tax policy test'
      },
      superAdminUser
    )
    assert.equal(updated.mode, 'PERCENTAGE')
    assert.equal(updated.ratePercentage, 7.5)

    // Calculate tax on gross 100,000 -> should be 7.5% = 7,500
    const taxResult = await payrollTaxService.calculateEmployeeTax(testEmp, 100000, '2026-11-15')
    assert.equal(taxResult.taxDeduction, 7500)
    assert.equal(taxResult.appliedTaxMode, 'PERCENTAGE')
    assert.equal(taxResult.appliedTaxRate, 7.5)
  })

  // --------------------------------------------------------------------------
  // TEST 2: Company Policy RBAC: Only Super Admin can modify policies
  // --------------------------------------------------------------------------
  await t.test('2. Company Policies RBAC: Non-Super-Admin gets 403 on policy edit', async () => {
    await assert.rejects(
      async () => {
        await adminSettingsService.updateCompanyPolicy(
          'POL-PAY-001',
          {
            changeReason: 'Unauthorized HR Admin attempt',
            rules: { maxAnnualIncrementPercentage: 50 }
          },
          hrAdminUser
        )
      },
      (err) => err.statusCode === 403 || err.status === 403 || err.code === 'SUPER_ADMIN_REQUIRED'
    )
  })

  // --------------------------------------------------------------------------
  // TEST 3: Super Admin can update POL-PAY-001, POL-EXP-001, POL-TRV-001 with audit logs
  // --------------------------------------------------------------------------
  await t.test('3. Super Admin updates policies and audit trail is created', async () => {
    const updatedPay = await adminSettingsService.updateCompanyPolicy(
      'POL-PAY-001',
      {
        changeReason: 'QA Board ratified revision',
        rules: {
          salaryRevisionApprovalAuthority: 'SUPER_ADMIN',
          maxAnnualIncrementPercentage: 25.0,
          requireBoardApprovalAboveCap: true,
          loanMaxAmountMultiplier: 3.0,
          loanMaxDeductionPercent: 30.0,
          salaryDivisor: 31
        }
      },
      superAdminUser
    )
    assert.equal(updatedPay.rules.maxAnnualIncrementPercentage, 25.0)

    // Check history endpoint
    const history = await adminSettingsService.getCompanyPolicyHistory('POL-PAY-001')
    assert.ok(Array.isArray(history))
    assert.ok(history.length > 0)
    assert.equal(history[0].entityId, 'POL-PAY-001')
  })

  // --------------------------------------------------------------------------
  // TEST 4: Salary Revision Governance: Increment cap enforcement (> 25% without board approval rejected)
  // --------------------------------------------------------------------------
  await t.test('4. Salary Revision: Increments > 25% without board approval are rejected', async () => {
    // Current basic is 50,000. Proposing 70,000 is a 40% increment (> 25% cap)
    await assert.rejects(
      async () => {
        await compensationService.proposeSalaryRevision(
          {
            employeeId: testEmp.id,
            proposedBaseSalary: 70000,
            effectiveDate: '2026-12-01',
            justification: 'Performance appreciation routine increment'
          },
          superAdminUser.id,
          superAdminUser
        )
      },
      (err) => err.code === 'INCREMENT_EXCEEDS_ANNUAL_CAP'
    )

    // With board approval reference, it succeeds
    const approvedRevision = await compensationService.proposeSalaryRevision(
      {
        employeeId: testEmp.id,
        proposedBaseSalary: 70000,
        effectiveDate: '2026-12-01',
        boardApproval: true,
        justification: 'Board Approval Ref # BOD-2026-11 granted for exceptional achievement'
      },
      superAdminUser.id,
      superAdminUser
    )
    assert.ok(approvedRevision.id)
    assert.equal(Number(approvedRevision.proposedBaseSalary), 70000)
  })

  // --------------------------------------------------------------------------
  // TEST 5: Salary Revision Governance: Approval Authority enforcement (Super Admin only)
  // --------------------------------------------------------------------------
  await t.test('5. Salary Revision: Non-Super-Admin approval is rejected under POL-PAY-001', async () => {
    const revision = await compensationService.proposeSalaryRevision(
      {
        employeeId: testEmp.id,
        proposedBaseSalary: 55000, // 10% increment (within 25% cap)
        effectiveDate: '2026-12-01',
        justification: 'Within normal increment cap'
      },
      superAdminUser.id,
      superAdminUser
    )

    // HR Admin attempts to approve -> Rejected
    await assert.rejects(
      async () => {
        await compensationService.reviewSalaryRevision(revision.id, 'APPROVED', hrAdminUser, 'HR Admin signoff')
      },
      (err) => err.code === 'UNAUTHORIZED_AUTHORITY'
    )

    // Super Admin approves -> Succeeds
    const approved = await compensationService.reviewSalaryRevision(
      revision.id,
      'APPROVED',
      superAdminUser,
      'Super Admin executive signoff'
    )
    assert.equal(approved.status, 'APPROVED')
  })

  // --------------------------------------------------------------------------
  // TEST 6: Loan Service: Loan maximum multiplier and monthly deduction cap
  // --------------------------------------------------------------------------
  await t.test('6. Loan Governance: Maximum 3x basic salary and 30% monthly installment cap', async () => {
    // Basic salary is now 55,000 (after approved revision above)
    // 3x basic = 165,000. Applying for 200,000 should be rejected
    await assert.rejects(
      async () => {
        await loanService.applyLoan(testEmp.id, {
          principalAmount: 200000,
          repaymentMonths: 12,
          remarks: 'Excessive loan request'
        })
      },
      (err) => err.code === 'LOAN_EXCEEDS_POLICY_CEILING'
    )

    // Applying for 100,000 over 2 months: monthly installment = 50,000.
    // 30% of 55,000 basic = 16,500. 50,000 > 16,500 -> Installment exceeds cap!
    await assert.rejects(
      async () => {
        await loanService.applyLoan(testEmp.id, {
          principalAmount: 100000,
          repaymentMonths: 2,
          remarks: 'Too high monthly installment'
        })
      },
      (err) => err.code === 'INSTALLMENT_EXCEEDS_CAP'
    )

    // Applying for 90,000 over 6 months: installment = 15,000 <= 16,500 cap -> Succeeds!
    const validLoan = await loanService.applyLoan(testEmp.id, {
      principalAmount: 90000,
      repaymentMonths: 6,
      remarks: 'Compliant loan request'
    })
    assert.ok(validLoan.id)
    assert.equal(Number(validLoan.principalAmount), 90000)
    assert.equal(Number(validLoan.monthlyInstallment), 15000)
  })

  // --------------------------------------------------------------------------
  // TEST 7: Expense Governance: POL-EXP-001 receipt threshold, fuel cap, meal cap
  // --------------------------------------------------------------------------
  await t.test('7. Expense Tiers & Receipts: Threshold and category caps enforced', async () => {
    // 1. Mandatory receipt for claims >= 1,000
    await assert.rejects(
      async () => {
        await travelExpenseService.createExpenseClaim(
          {
            employeeId: testEmp.id,
            claimTitle: 'Team Lunch No Receipt',
            category: 'MEALS',
            amount: 2500,
            receiptReference: '' // No receipt
          },
          superAdminUser
        )
      },
      (err) => err.code === 'RECEIPT_REQUIRED'
    )

    // 2. Daily meals limit > 4,000
    await assert.rejects(
      async () => {
        await travelExpenseService.createExpenseClaim(
          {
            employeeId: testEmp.id,
            claimTitle: 'Lavish Banquet',
            category: 'MEALS',
            amount: 6500,
            receiptReference: 'REC-MEAL-001'
          },
          superAdminUser
        )
      },
      (err) => err.code === 'DAILY_MEAL_LIMIT_EXCEEDED'
    )

    // 3. Daily fuel limit > 6,000
    await assert.rejects(
      async () => {
        await travelExpenseService.createExpenseClaim(
          {
            employeeId: testEmp.id,
            claimTitle: 'Long haul fuel tank',
            category: 'FUEL',
            amount: 8500,
            receiptReference: 'REC-FUEL-001'
          },
          superAdminUser
        )
      },
      (err) => err.code === 'DAILY_FUEL_LIMIT_EXCEEDED'
    )
  })

  // --------------------------------------------------------------------------
  // TEST 8: Travel Governance: POL-TRV-001 advance ceiling (80% of budget)
  // --------------------------------------------------------------------------
  await t.test('8. Travel Advance: Advance > 80% of estimated budget is rejected', async () => {
    // Clean up any existing travel requests for testEmp to avoid overlap conflict across test runs
    await prisma.travelRequest.deleteMany({ where: { employeeId: testEmp.id } })

    await assert.rejects(
      async () => {
        await travelExpenseService.createTravelRequest(
          {
            employeeId: testEmp.id,
            purpose: 'Client onsite technical installation',
            origin: 'Lahore',
            destination: 'Islamabad',
            departureDate: '2026-12-10',
            returnDate: '2026-12-12',
            estimatedBudget: 50000,
            advanceAmount: 45000 // 45,000 / 50,000 = 90% > 80% cap
          },
          superAdminUser
        )
      },
      (err) => err.code === 'ADVANCE_EXCEEDS_BUDGET_CAP'
    )

    // Advance of 40,000 (80% of 50,000) -> Allowed
    const validTravel = await travelExpenseService.createTravelRequest(
      {
        employeeId: testEmp.id,
        purpose: 'Client onsite technical installation',
        origin: 'Lahore',
        destination: 'Islamabad',
        departureDate: '2026-12-25',
        returnDate: '2026-12-27',
        estimatedBudget: 50000,
        advanceAmount: 40000
      },
      superAdminUser
    )
    assert.ok(validTravel.id)
  })

  // --------------------------------------------------------------------------
  // TEST 9: Super Admin Portal Eligibility: requireLinkedEmployee middleware
  // --------------------------------------------------------------------------
  await t.test('9. Portal Eligibility: Unlinked account blocked from self-service actions', async () => {
    // Fake request from unlinked Super Admin (employeeId is null)
    let statusCode = null
    let responseBody = null
    const req = {
      user: {
        id: superAdminUser.id,
        role: 'SUPER_ADMIN',
        employeeId: null,
        employee: null
      }
    }
    const res = {
      status(code) {
        statusCode = code
        return this
      },
      json(data) {
        responseBody = data
        return this
      }
    }
    let nextCalled = false
    const next = () => {
      nextCalled = true
    }

    requireLinkedEmployee(req, res, next)
    assert.equal(nextCalled, false)
    assert.equal(statusCode, 403)
    assert.equal(responseBody?.error?.code || responseBody?.code, 'UNLINKED_PORTAL_ACCOUNT')
  })
})
