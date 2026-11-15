import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/config/database.js'
import { Prisma } from '@prisma/client'

describe('Backend Batch 2 — PostgreSQL Schema & Constraint Verification Suite', () => {
  it('1. Schema Integrity: Enforces unique employeeCode constraint (P2002)', async () => {
    // Generate isolated department for foreign key
    const dept = await prisma.department.create({
      data: {
        code: `DEP-TEST-SCHEMA-1`,
        name: 'Schema Test Department'
      }
    })

    const desig = await prisma.designation.create({
      data: {
        code: `DES-TEST-SCHEMA-1`,
        title: 'Schema Test Designation'
      }
    })

    try {
      // First employee
      const emp1 = await prisma.employee.create({
        data: {
          employeeCode: 'EMP-UNIQUE-TEST-001',
          firstName: 'Schema',
          lastName: 'Tester',
          email: 'schema.tester1@isysware.test',
          departmentId: dept.id,
          designationId: desig.id,
          joiningDate: new Date('2026-01-01')
        }
      })

      assert.ok(emp1.id)

      // Second employee with DUPLICATE employeeCode
      let caughtError = null
      try {
        await prisma.employee.create({
          data: {
            employeeCode: 'EMP-UNIQUE-TEST-001', // duplicate
            firstName: 'Duplicate',
            lastName: 'Tester',
            email: 'schema.tester2@isysware.test',
            departmentId: dept.id,
            designationId: desig.id,
            joiningDate: new Date('2026-01-01')
          }
        })
      } catch (err) {
        caughtError = err
      }

      assert.ok(caughtError, 'Should throw unique constraint violation')
      assert.strictEqual(caughtError.code, 'P2002')
      assert.ok(caughtError.meta?.target?.includes('employeeCode'))

      // Clean up emp1
      await prisma.employee.delete({ where: { id: emp1.id } })
    } finally {
      await prisma.designation.delete({ where: { id: desig.id } }).catch(() => {})
      await prisma.department.delete({ where: { id: dept.id } }).catch(() => {})
    }
  })

  it('2. Schema Integrity: Enforces unique username/email on User accounts (P2002)', async () => {
    const user1 = await prisma.user.create({
      data: {
        username: 'schema_unique_user',
        email: 'unique_user@isysware.test',
        passwordHash: '$argon2id$mock_hash_for_test',
        role: 'EMPLOYEE'
      }
    })

    assert.ok(user1.id)

    let duplicateError = null
    try {
      await prisma.user.create({
        data: {
          username: 'schema_unique_user', // duplicate
          email: 'different_user@isysware.test',
          passwordHash: '$argon2id$mock_hash_for_test',
          role: 'EMPLOYEE'
        }
      })
    } catch (err) {
      duplicateError = err
    }

    assert.ok(duplicateError)
    assert.strictEqual(duplicateError.code, 'P2002')

    // Clean up
    await prisma.user.delete({ where: { id: user1.id } })
  })

  it('3. Referential Integrity: Rejects foreign key to non-existent department (P2003)', async () => {
    const desig = await prisma.designation.create({
      data: {
        code: `DES-TEST-SCHEMA-2`,
        title: 'Schema Test Designation 2'
      }
    })

    let fkError = null
    try {
      await prisma.employee.create({
        data: {
          employeeCode: 'EMP-FK-TEST-002',
          firstName: 'Invalid',
          lastName: 'FK',
          email: 'invalid.fk@isysware.test',
          departmentId: 'non-existent-dept-cuid-123456789012345',
          designationId: desig.id,
          joiningDate: new Date('2026-01-01')
        }
      })
    } catch (err) {
      fkError = err
    }

    assert.ok(fkError, 'Foreign key violation must be thrown')
    assert.strictEqual(fkError.code, 'P2003')

    await prisma.designation.delete({ where: { id: desig.id } }).catch(() => {})
  })

  it('4. SHIFT-ISOLATION-01: Shift Assignment is isolated per-employee with effective date range', async () => {
    const dept = await prisma.department.create({
      data: { code: 'DEP-SHIFT-TEST', name: 'Shift Test Dept' }
    })
    const desig = await prisma.designation.create({
      data: { code: 'DES-SHIFT-TEST', title: 'Shift Test Desig' }
    })

    const empA = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-SHIFT-A',
        firstName: 'Ahmed',
        lastName: 'Khan',
        email: 'ahmed.shift@isysware.test',
        departmentId: dept.id,
        designationId: desig.id,
        joiningDate: new Date('2026-01-01')
      }
    })

    const empB = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-SHIFT-B',
        firstName: 'Ali',
        lastName: 'Raza',
        email: 'ali.shift@isysware.test',
        departmentId: dept.id,
        designationId: desig.id,
        joiningDate: new Date('2026-01-01')
      }
    })

    const shiftGeneral = await prisma.shift.create({
      data: {
        shiftCode: 'SHIFT-GEN-01',
        name: 'General Corporate Day Shift',
        startTime: '09:00',
        endTime: '18:00',
        isDefault: true
      }
    })

    const shiftQaMorning = await prisma.shift.create({
      data: {
        shiftCode: 'SHIFT-QA-MOR-01',
        name: 'QA Test Morning Shift',
        startTime: '08:00',
        endTime: '17:00',
        isDefault: false
      }
    })

    try {
      // Assign QA Test Morning Shift EXCLUSIVELY to Ahmed Khan (EMP-SHIFT-A) from Nov 5, 2026
      const assignmentA = await prisma.shiftAssignment.create({
        data: {
          employeeId: empA.id,
          shiftId: shiftQaMorning.id,
          effectiveFrom: new Date('2026-11-05T00:00:00.000Z'),
          status: 'ACTIVE'
        }
      })

      // Query shift assignments for Ali Raza (EMP-SHIFT-B)
      const assignmentsB = await prisma.shiftAssignment.findMany({
        where: { employeeId: empB.id, status: 'ACTIVE' }
      })

      // Invariant: Ali Raza MUST NOT receive Ahmed Khan's shift
      assert.strictEqual(assignmentsB.length, 0, 'Ali Raza has 0 explicit shift assignments')

      // Query shift assignments for Ahmed Khan
      const assignmentsA = await prisma.shiftAssignment.findMany({
        where: { employeeId: empA.id, status: 'ACTIVE' },
        include: { shift: true }
      })

      assert.strictEqual(assignmentsA.length, 1)
      assert.strictEqual(assignmentsA[0].shift.shiftCode, 'SHIFT-QA-MOR-01')
      assert.strictEqual(assignmentsA[0].shift.startTime, '08:00')

      // Clean up
      await prisma.shiftAssignment.delete({ where: { id: assignmentA.id } })
    } finally {
      await prisma.shift.delete({ where: { id: shiftGeneral.id } }).catch(() => {})
      await prisma.shift.delete({ where: { id: shiftQaMorning.id } }).catch(() => {})
      await prisma.employee.delete({ where: { id: empA.id } }).catch(() => {})
      await prisma.employee.delete({ where: { id: empB.id } }).catch(() => {})
      await prisma.designation.delete({ where: { id: desig.id } }).catch(() => {})
      await prisma.department.delete({ where: { id: dept.id } }).catch(() => {})
    }
  })

  it('5. Payroll Precision: Decimal(12, 2) preserves exact PKR currency amounts without float inaccuracy', async () => {
    const dept = await prisma.department.create({
      data: { code: 'DEP-PAY-TEST', name: 'Payroll Test Dept' }
    })
    const desig = await prisma.designation.create({
      data: { code: 'DES-PAY-TEST', title: 'Payroll Test Desig' }
    })

    const emp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-PAY-001',
        firstName: 'Payroll',
        lastName: 'Subject',
        email: 'payroll.subject@isysware.test',
        departmentId: dept.id,
        designationId: desig.id,
        joiningDate: new Date('2026-01-01')
      }
    })

    try {
      const salary = await prisma.salaryStructure.create({
        data: {
          employeeId: emp.id,
          currency: 'PKR',
          baseSalary: new Prisma.Decimal('185450.75'),
          houseRentAllowance: new Prisma.Decimal('83452.83'),
          medicalAllowance: new Prisma.Decimal('18545.08'),
          conveyanceAllowance: new Prisma.Decimal('9272.54'),
          specialAllowance: new Prisma.Decimal('5000.00'),
          grossSalary: new Prisma.Decimal('301721.20'),
          effectiveFrom: new Date('2026-01-01')
        }
      })

      const fetched = await prisma.salaryStructure.findUnique({
        where: { id: salary.id }
      })

      assert.strictEqual(fetched.baseSalary.toString(), '185450.75')
      assert.strictEqual(fetched.grossSalary.toString(), '301721.2')
      assert.strictEqual(fetched.currency, 'PKR')

      await prisma.salaryStructure.delete({ where: { id: salary.id } })
    } finally {
      await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {})
      await prisma.designation.delete({ where: { id: desig.id } }).catch(() => {})
      await prisma.department.delete({ where: { id: dept.id } }).catch(() => {})
    }
  })

  it('6. Leave Management: Supports annualSequenceNumber and single-approver finality fields', async () => {
    const dept = await prisma.department.create({
      data: { code: 'DEP-LEV-TEST', name: 'Leave Test Dept' }
    })
    const desig = await prisma.designation.create({
      data: { code: 'DES-LEV-TEST', title: 'Leave Test Desig' }
    })
    const emp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-LEV-001',
        firstName: 'Leave',
        lastName: 'Requester',
        email: 'leave.requester@isysware.test',
        departmentId: dept.id,
        designationId: desig.id,
        joiningDate: new Date('2026-01-01')
      }
    })
    const leaveType = await prisma.leaveType.create({
      data: {
        code: 'ANNUAL-SCHEMA-TEST',
        name: 'Annual Paid Leave',
        defaultDaysPerYear: new Prisma.Decimal('14.0')
      }
    })

    try {
      const leaveReq = await prisma.leaveRequest.create({
        data: {
          requestCode: 'LV-TEST-001',
          employeeId: emp.id,
          leaveTypeId: leaveType.id,
          startDate: new Date('2026-11-10'),
          endDate: new Date('2026-11-12'),
          durationDays: new Prisma.Decimal('3.0'),
          reason: 'Family event',
          annualSequenceNumber: 3, // 3rd request escalates to Department Manager
          routingTier: 'DEPT_MANAGER',
          status: 'APPROVED',
          approvedByRole: 'DEPT_MANAGER',
          approvedAt: new Date(),
          decisionRemarks: 'Approved as Department Manager'
        }
      })

      assert.strictEqual(leaveReq.annualSequenceNumber, 3)
      assert.strictEqual(leaveReq.routingTier, 'DEPT_MANAGER')
      assert.strictEqual(leaveReq.status, 'APPROVED')
      assert.strictEqual(leaveReq.approvedByRole, 'DEPT_MANAGER')

      await prisma.leaveRequest.delete({ where: { id: leaveReq.id } })
    } finally {
      await prisma.leaveType.delete({ where: { id: leaveType.id } }).catch(() => {})
      await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {})
      await prisma.designation.delete({ where: { id: desig.id } }).catch(() => {})
      await prisma.department.delete({ where: { id: dept.id } }).catch(() => {})
    }
  })

  it('7. Audit History: Preserves immutable actor attribution and JSON record snapshots', async () => {
    const audit = await prisma.auditLog.create({
      data: {
        actorEmployeeCode: 'EMP-001',
        actorRole: 'SUPER_ADMIN',
        sourceModule: 'APPROVALS',
        actionType: 'APPROVE',
        entityName: 'FieldDutyRequest',
        entityId: 'FLD-003',
        recordSnapshotBefore: { status: 'PENDING', durationHours: 9.0 },
        recordSnapshotAfter: { status: 'APPROVED', approvedBy: 'EMP-004' },
        reasonOrNotes: 'Approved under No Duration Limit policy',
        ipAddress: '127.0.0.1'
      }
    })

    assert.ok(audit.id)
    assert.strictEqual(audit.actorRole, 'SUPER_ADMIN')
    assert.strictEqual(audit.entityName, 'FieldDutyRequest')
    assert.strictEqual(audit.recordSnapshotAfter.status, 'APPROVED')

    await prisma.auditLog.delete({ where: { id: audit.id } })
  })
})

