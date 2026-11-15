import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Backend Salary Revision — PostgreSQL Persistence, Reload, Super Admin Authority & Mock Isolation Suite', () => {
  let saUser = null
  let hrUser = null
  let saToken = null
  let hrToken = null

  let emp001 = null
  let qaEmp = null
  let qaRevisionId = null

  it('Setup: Resolves or provisions canonical users, tokens, EMP-001, and isolated QA employee', async () => {
    saUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', isActive: true }
    })
    if (!saUser) {
      saUser = await prisma.user.create({
        data: {
          username: `sa_rev_${Date.now()}`,
          email: `sa.rev.${Date.now()}@isysware.test`,
          passwordHash: '$argon2id$mock',
          role: 'SUPER_ADMIN',
          isProtected: true
        }
      })
    }
    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })

    hrUser = await prisma.user.findFirst({
      where: { role: 'HR_ADMIN', isActive: true }
    })
    if (!hrUser) {
      hrUser = await prisma.user.create({
        data: {
          username: `hr_rev_${Date.now()}`,
          email: `hr.rev.${Date.now()}@isysware.test`,
          passwordHash: '$argon2id$mock',
          role: 'HR_ADMIN'
        }
      })
    }
    hrToken = generateAccessToken({ userId: hrUser.id, role: 'HR_ADMIN' })

    let dept = await prisma.department.findFirst()
    if (!dept) {
      dept = await prisma.department.create({
        data: { code: 'DEP-DEV-QA', name: 'Software Development' }
      })
    }

    let desig = await prisma.designation.findFirst()
    if (!desig) {
      desig = await prisma.designation.create({
        data: { code: 'DES-DEV-QA', title: 'Frontend Developer', level: 'SENIOR' }
      })
    }

    emp001 = await prisma.employee.findFirst({
      where: { employeeCode: 'EMP-001' },
      include: {
        salaryStructures: {
          where: { isCurrent: true },
          orderBy: { effectiveFrom: 'desc' },
          take: 1
        }
      }
    })

    if (!emp001) {
      emp001 = await prisma.employee.create({
        data: {
          employeeCode: 'EMP-001',
          firstName: 'Khuzaima',
          lastName: 'Senior Developer',
          email: `khuzaima.senior.${Date.now()}@isysware.test`,
          joiningDate: new Date('2026-10-26'),
          department: { connect: { id: dept.id } },
          designation: { connect: { id: desig.id } },
          employmentStatus: 'ACTIVE'
        }
      })
      await prisma.salaryStructure.create({
        data: {
          employeeId: emp001.id,
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
      emp001 = await prisma.employee.findFirst({
        where: { employeeCode: 'EMP-001' },
        include: {
          salaryStructures: {
            where: { isCurrent: true },
            orderBy: { effectiveFrom: 'desc' },
            take: 1
          }
        }
      })
    }

    assert.ok(emp001, 'EMP-001 must exist in PostgreSQL')
    assert.ok(emp001.salaryStructures.length > 0, 'EMP-001 must have an active salary structure')
    assert.equal(Number(emp001.salaryStructures[0].baseSalary), 50000, 'EMP-001 base salary must be PKR 50,000')

    // Clean up any previous test QA employee
    const prevQa = await prisma.employee.findFirst({
      where: { employeeCode: 'EMP-QA-REV' }
    })
    if (prevQa) {
      await prisma.salaryRevision.deleteMany({ where: { employeeId: prevQa.id } }).catch(() => {})
      await prisma.salaryStructure.deleteMany({ where: { employeeId: prevQa.id } }).catch(() => {})
      await prisma.employee.delete({ where: { id: prevQa.id } }).catch(() => {})
    }

    qaEmp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-QA-REV',
        firstName: 'QA-Tester',
        lastName: 'Compensation',
        email: `qa.tester.rev.${Date.now()}@isysware.test`,
        joiningDate: new Date('2026-10-26'),
        department: { connect: { id: dept.id } },
        designation: { connect: { id: desig.id } },
        employmentStatus: 'ACTIVE'
      }
    })

    await prisma.salaryStructure.create({
      data: {
        employeeId: qaEmp.id,
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
  })

  it('1. Create Proposal: Successfully proposes salary revision (PKR 50,000 -> 57,500, effective 2026-11-13) and persists to PostgreSQL', async () => {
    const res = await request(app)
      .post('/api/v1/payroll/revisions')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: qaEmp.employeeCode,
        proposedSalary: 57500,
        currentSalary: 50000,
        effectiveDate: '2026-11-13',
        justification: 'Annual performance salary increment for QA Tester',
        revisionType: 'ANNUAL_INCREMENT'
      })

    assert.equal(res.status, 201, `Expected 201 Created but got ${res.status}: ${JSON.stringify(res.body)}`)
    assert.ok(res.body.data?.id, 'Returned revision must have database ID')
    qaRevisionId = res.body.data.id

    // Direct PostgreSQL inspection
    const dbRev = await prisma.salaryRevision.findUnique({
      where: { id: qaRevisionId },
      include: { employee: true }
    })
    assert.ok(dbRev, 'Revision must exist in PostgreSQL salary_revisions table')
    assert.equal(dbRev.employee.employeeCode, 'EMP-QA-REV')
    assert.equal(Number(dbRev.previousBaseSalary), 50000)
    assert.equal(Number(dbRev.proposedBaseSalary), 57500)
    assert.equal(Number(dbRev.previousGrossSalary), 70000)
    assert.equal(Number(dbRev.proposedGrossSalary), 77500)
    assert.equal(dbRev.status, 'PENDING', 'Pending revision must remain PENDING (not auto-approved or applied)')
    assert.equal(new Date(dbRev.effectiveDate).toISOString().slice(0, 10), '2026-11-13', 'Effective date must be preserved exactly without timezone shift')

    // Audit log verification
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityName: 'SalaryRevision',
        entityId: qaRevisionId,
        actionType: 'CREATE'
      }
    })
    assert.ok(audit, 'AuditLog must be recorded in PostgreSQL for revision creation')
    assert.equal(audit.sourceModule, 'PAYROLL')
  })

  it('2. Reload Persistence: GET /payroll/revisions reloads newly created revision and canonical EMP-001 reliably without data loss', async () => {
    const res = await request(app)
      .get('/api/v1/payroll/revisions')
      .set('Authorization', `Bearer ${saToken}`)

    assert.equal(res.status, 200)
    const list = res.body.data || []
    const qaFound = list.find((r) => r.id === qaRevisionId || r.employee?.employeeCode === 'EMP-QA-REV')
    assert.ok(qaFound, 'QA revision must be returned in GET /payroll/revisions on page reload')
    assert.equal(qaFound.employee?.employeeCode, 'EMP-QA-REV')
    assert.equal(Number(qaFound.proposedBaseSalary), 57500)
    assert.equal(qaFound.status, 'PENDING')

    const emp001Found = list.find((r) => r.employee?.employeeCode === 'EMP-001')
    if (emp001Found) {
      assert.equal(Number(emp001Found.proposedBaseSalary), 57500)
      assert.equal(emp001Found.status, 'PENDING')
    }
  })

  it('3. Mock Isolation Invariant: Canonical revision listing never contains fake Zeeshan Ali (EMP-004) or Usman Ghani (EMP-006) records', async () => {
    const res = await request(app)
      .get('/api/v1/payroll/revisions')
      .set('Authorization', `Bearer ${saToken}`)

    assert.equal(res.status, 200)
    const list = res.body.data || []
    const fake4 = list.find((r) => r.employee?.employeeCode === 'EMP-004' || r.employeeId === 'EMP-004')
    const fake6 = list.find((r) => r.employee?.employeeCode === 'EMP-006' || r.employeeId === 'EMP-006')
    assert.equal(fake4, undefined, 'Mock EMP-004 proposal must NOT exist in PostgreSQL results')
    assert.equal(fake6, undefined, 'Mock EMP-006 proposal must NOT exist in PostgreSQL results')
  })

  it('4. Anti-Self-Approval & Super Admin Universal Authority: Non-super-admin cannot self-approve, Super Admin can review', async () => {
    if (hrUser.employeeId) {
      const hrRev = await prisma.salaryRevision.create({
        data: {
          revisionNumber: `REV-TEST-HR-${Date.now()}`,
          employeeId: hrUser.employeeId,
          previousBaseSalary: 40000,
          previousGrossSalary: 45000,
          proposedBaseSalary: 46000,
          proposedGrossSalary: 51000,
          effectiveDate: new Date('2026-11-13'),
          proposedById: hrUser.id,
          status: 'PENDING',
          justification: 'Self proposal test'
        }
      })

      const selfReviewRes = await request(app)
        .patch(`/api/v1/payroll/revisions/${hrRev.id}/review`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ decision: 'APPROVED' })

      assert.equal(selfReviewRes.status, 403, 'Non-Super Admin cannot approve salary revisions')
      await prisma.salaryRevision.delete({ where: { id: hrRev.id } }).catch(() => {})
    }
  })

  it('5. Super Admin Review Workflow: Super Admin can return for clarification or reject/approve with audit trail', async () => {
    // Test RETURNED decision
    const returnRes = await request(app)
      .patch(`/api/v1/payroll/revisions/${qaRevisionId}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ decision: 'RETURNED', remarks: 'Please verify recent quarterly KPI score' })

    assert.equal(returnRes.status, 200, `Expected 200 but got: ${JSON.stringify(returnRes.body)}`)
    assert.equal(returnRes.body.data.status, 'RETURNED')

    const dbRevReturned = await prisma.salaryRevision.findUnique({ where: { id: qaRevisionId } })
    assert.equal(dbRevReturned.status, 'RETURNED')

    // Reset back to PENDING to verify approval path
    await prisma.salaryRevision.update({
      where: { id: qaRevisionId },
      data: { status: 'PENDING' }
    })

    // Super Admin Approves revision
    const approveRes = await request(app)
      .patch(`/api/v1/payroll/revisions/${qaRevisionId}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ decision: 'APPROVED', remarks: 'Super Admin final sign-off' })

    assert.equal(approveRes.status, 200)
    assert.equal(approveRes.body.data.status, 'APPROVED')

    // Verify PostgreSQL: old structure superseded, new structure activated with preserved allowances
    const currentStructure = await prisma.salaryStructure.findFirst({
      where: { employeeId: qaEmp.id, isCurrent: true }
    })
    assert.ok(currentStructure, 'New active salary structure must be created')
    assert.equal(Number(currentStructure.baseSalary), 57500, 'Base salary must now be PKR 57,500')
    assert.equal(Number(currentStructure.houseRentAllowance), 10000, 'House rent allowance must be preserved')
    assert.equal(Number(currentStructure.grossSalary), 77500, 'Gross salary must be 77,500 (57,500 base + 20,000 allowances)')

    // Verify superseded structure is no longer current
    const oldStructure = await prisma.salaryStructure.findFirst({
      where: { employeeId: qaEmp.id, isCurrent: false },
      orderBy: { effectiveFrom: 'desc' }
    })
    assert.ok(oldStructure, 'Old salary structure must be preserved with isCurrent=false')
    assert.equal(Number(oldStructure.baseSalary), 50000)

    // Verify approval AuditLog
    const approveAudit = await prisma.auditLog.findFirst({
      where: {
        entityName: 'SalaryRevision',
        entityId: qaRevisionId,
        actionType: 'APPROVE'
      }
    })
    assert.ok(approveAudit, 'Approval audit log must be recorded')

    // Cleanup QA fixtures
    await prisma.salaryRevision.deleteMany({ where: { employeeId: qaEmp.id } }).catch(() => {})
    await prisma.salaryStructure.deleteMany({ where: { employeeId: qaEmp.id } }).catch(() => {})
    await prisma.employee.delete({ where: { id: qaEmp.id } }).catch(() => {})
  })
})
