import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { prisma } from '../src/config/database.js'
import {
  authenticate,
  requireRoles,
  requireEmployeeScope,
  antiSelfApproval,
  protectSuperAdminTarget
} from '../src/middleware/auth.js'
import { generateAccessToken } from '../src/utils/jwt.js'
import { hashPassword } from '../src/utils/crypto.js'

describe('Backend Batch 3 — Server-Side RBAC & Organizational Scope Suite', () => {
  let deptA = null
  let deptB = null
  let desig = null
  let managerUser = null
  let managerEmp = null
  let leadUser = null
  let leadEmp = null
  let employeeUserA = null
  let employeeEmpA = null
  let employeeUserB = null
  let employeeEmpB = null
  let superAdminUser = null

  // Create isolated test router to exercise middleware directly
  const testApp = express()
  testApp.use(express.json())

  // Protected Routes
  testApp.get('/test/super-admin-only', authenticate, requireRoles('SUPER_ADMIN'), (req, res) => {
    res.json({ success: true, message: 'Super admin granted' })
  })

  testApp.get('/test/manager-or-admin', authenticate, requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'), (req, res) => {
    res.json({ success: true, message: 'Manager or admin granted' })
  })

  testApp.get('/test/employee-record/:employeeId', authenticate, requireEmployeeScope(), (req, res) => {
    res.json({ success: true, message: 'Scope access granted', targetId: req.params.employeeId })
  })

  testApp.post('/test/approve-request', authenticate, antiSelfApproval((req) => req.body.requesterEmployeeId), (req, res) => {
    res.json({ success: true, message: 'Approval permitted' })
  })

  testApp.patch('/test/users/:userId/status', authenticate, protectSuperAdminTarget(), (req, res) => {
    res.json({ success: true, message: 'Status updated' })
  })

  it('Setup: Provisions isolated organizational hierarchy fixtures', async () => {
    const passwordHash = await hashPassword('TestPassword123!')

    // Departments
    deptA = await prisma.department.create({ data: { code: 'DEP-RBAC-A', name: 'RBAC Dept A' } })
    deptB = await prisma.department.create({ data: { code: 'DEP-RBAC-B', name: 'RBAC Dept B' } })
    desig = await prisma.designation.create({ data: { code: 'DES-RBAC-1', title: 'RBAC Designation' } })

    // Team in Dept A
    const teamA = await prisma.team.create({
      data: { code: 'TEAM-RBAC-A', name: 'RBAC Team A', departmentId: deptA.id }
    })

    // Super Admin User
    superAdminUser = await prisma.user.create({
      data: {
        username: 'rbac_super_admin',
        email: 'rbac_sa@isysware.test',
        passwordHash,
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })

    // Department Manager for Dept A
    managerEmp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-MGR-A',
        firstName: 'Dept',
        lastName: 'Manager',
        email: 'mgr.a@isysware.test',
        departmentId: deptA.id,
        designationId: desig.id,
        joiningDate: new Date('2026-01-01')
      }
    })
    managerUser = await prisma.user.create({
      data: {
        username: 'rbac_manager_a',
        email: 'mgr.a@isysware.test',
        passwordHash,
        role: 'DEPT_MANAGER',
        employeeId: managerEmp.id
      }
    })

    // Team Lead for Team A
    leadEmp = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-LEAD-A',
        firstName: 'Team',
        lastName: 'Lead',
        email: 'lead.a@isysware.test',
        departmentId: deptA.id,
        teamId: teamA.id,
        reportingManagerId: managerEmp.id,
        designationId: desig.id,
        joiningDate: new Date('2026-01-01')
      }
    })
    leadUser = await prisma.user.create({
      data: {
        username: 'rbac_lead_a',
        email: 'lead.a@isysware.test',
        passwordHash,
        role: 'TEAM_LEAD',
        employeeId: leadEmp.id
      }
    })
    await prisma.teamAssignment.create({
      data: { employeeId: leadEmp.id, teamId: teamA.id, role: 'TEAM_LEAD' }
    })

    // Employee in Dept A, Team A (reports to Lead A)
    employeeEmpA = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-STAFF-A',
        firstName: 'Staff',
        lastName: 'Alpha',
        email: 'staff.a@isysware.test',
        departmentId: deptA.id,
        teamId: teamA.id,
        reportingManagerId: leadEmp.id,
        designationId: desig.id,
        joiningDate: new Date('2026-01-01')
      }
    })
    employeeUserA = await prisma.user.create({
      data: {
        username: 'rbac_staff_a',
        email: 'staff.a@isysware.test',
        passwordHash,
        role: 'EMPLOYEE',
        employeeId: employeeEmpA.id
      }
    })

    // Employee in Dept B (completely separate department)
    employeeEmpB = await prisma.employee.create({
      data: {
        employeeCode: 'EMP-STAFF-B',
        firstName: 'Staff',
        lastName: 'Beta',
        email: 'staff.b@isysware.test',
        departmentId: deptB.id,
        designationId: desig.id,
        joiningDate: new Date('2026-01-01')
      }
    })
    employeeUserB = await prisma.user.create({
      data: {
        username: 'rbac_staff_b',
        email: 'staff.b@isysware.test',
        passwordHash,
        role: 'EMPLOYEE',
        employeeId: employeeEmpB.id
      }
    })

    assert.ok(superAdminUser.id)
    assert.ok(managerUser.id)
    assert.ok(leadUser.id)
    assert.ok(employeeUserA.id)
    assert.ok(employeeUserB.id)
  })

  it('1. Role Authorization: Super Admin accesses admin routes; Employee receives 403 Forbidden', async () => {
    const saToken = generateAccessToken({ userId: superAdminUser.id, role: 'SUPER_ADMIN' })
    const empToken = generateAccessToken({ userId: employeeUserA.id, role: 'EMPLOYEE', employeeId: employeeEmpA.id })

    // Super Admin authorized
    const saRes = await request(testApp)
      .get('/test/super-admin-only')
      .set('Authorization', `Bearer ${saToken}`)
    assert.strictEqual(saRes.status, 200)
    assert.strictEqual(saRes.body.success, true)

    // Employee denied with 403
    const empRes = await request(testApp)
      .get('/test/super-admin-only')
      .set('Authorization', `Bearer ${empToken}`)
    assert.strictEqual(empRes.status, 403)
    assert.strictEqual(empRes.body.error.code, 'FORBIDDEN')
  })

  it('2. Organizational Scope: Manager can access employee in their department, but 403 for other department', async () => {
    const mgrToken = generateAccessToken({ userId: managerUser.id, role: 'DEPT_MANAGER', employeeId: managerEmp.id })

    // Manager A accesses Staff A (same department Dept A)
    const allowedRes = await request(testApp)
      .get(`/test/employee-record/${employeeEmpA.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
    assert.strictEqual(allowedRes.status, 200)

    // Manager A attempts to access Staff B (different department Dept B) -> 403 Forbidden Scope
    const blockedRes = await request(testApp)
      .get(`/test/employee-record/${employeeEmpB.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
    assert.strictEqual(blockedRes.status, 403)
    assert.strictEqual(blockedRes.body.error.code, 'FORBIDDEN_SCOPE')
  })

  it('3. Employee Privacy Scope: Employee can access own record, but 403 when probing another employee', async () => {
    const empAToken = generateAccessToken({ userId: employeeUserA.id, role: 'EMPLOYEE', employeeId: employeeEmpA.id })

    // Employee A accesses own record
    const ownRes = await request(testApp)
      .get(`/test/employee-record/${employeeEmpA.id}`)
      .set('Authorization', `Bearer ${empAToken}`)
    assert.strictEqual(ownRes.status, 200)

    // Employee A probes Employee B -> 403 Forbidden Scope
    const probeRes = await request(testApp)
      .get(`/test/employee-record/${employeeEmpB.id}`)
      .set('Authorization', `Bearer ${empAToken}`)
    assert.strictEqual(probeRes.status, 403)
    assert.strictEqual(probeRes.body.error.code, 'FORBIDDEN_SCOPE')
  })

  it('4. Anti-Self-Approval: Strictly blocks supervisor or employee from self-approving requests', async () => {
    const leadToken = generateAccessToken({ userId: leadUser.id, role: 'TEAM_LEAD', employeeId: leadEmp.id })

    // Lead approves Staff A's request -> 200 OK
    const legitApprovalRes = await request(testApp)
      .post('/test/approve-request')
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ requesterEmployeeId: employeeEmpA.id })
    assert.strictEqual(legitApprovalRes.status, 200)

    // Lead attempts to approve OWN request -> 403 SELF_APPROVAL_PROHIBITED
    const selfApprovalRes = await request(testApp)
      .post('/test/approve-request')
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ requesterEmployeeId: leadEmp.id })
    assert.strictEqual(selfApprovalRes.status, 403)
    assert.strictEqual(selfApprovalRes.body.error.code, 'SELF_APPROVAL_PROHIBITED')
  })

  it('5. Protected Super Admin Safeguards: Lower roles blocked from modifying protected Super Admin', async () => {
    const mgrToken = generateAccessToken({ userId: managerUser.id, role: 'DEPT_MANAGER', employeeId: managerEmp.id })

    // Manager attempts to deactivate Super Admin -> 403 PROTECTED_ACCOUNT_VIOLATION
    const attackRes = await request(testApp)
      .patch(`/test/users/${superAdminUser.id}/status`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ isActive: false })
    assert.strictEqual(attackRes.status, 403)
    assert.strictEqual(attackRes.body.error.code, 'PROTECTED_ACCOUNT_VIOLATION')
  })

  it('6. Last Active Protected Super Admin: System blocks deactivating the only remaining protected admin', async () => {
    // Ensure this test accurately simulates the scenario where no other active protected admin remains
    const otherProtected = await prisma.user.findMany({
      where: {
        role: 'SUPER_ADMIN',
        isProtected: true,
        isActive: true,
        id: { not: superAdminUser.id }
      }
    })

    if (otherProtected.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherProtected.map((u) => u.id) } },
        data: { isActive: false }
      })
    }

    try {
      const saToken = generateAccessToken({ userId: superAdminUser.id, role: 'SUPER_ADMIN' })

      // Super Admin tries to deactivate their own (sole remaining active) protected account -> 403 LAST_ADMIN_PROTECTED
      const deactivateRes = await request(testApp)
        .patch(`/test/users/${superAdminUser.id}/status`)
        .set('Authorization', `Bearer ${saToken}`)
        .send({ isActive: false })
      assert.strictEqual(deactivateRes.status, 403)
      assert.strictEqual(deactivateRes.body.error.code, 'LAST_ADMIN_PROTECTED')
    } finally {
      if (otherProtected.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: otherProtected.map((u) => u.id) } },
          data: { isActive: true }
        })
      }
    }
  })

  it('Teardown: Cleans up isolated fixtures cleanly', async () => {
    await prisma.teamAssignment.deleteMany({ where: { employeeId: leadEmp.id } }).catch(() => {})
    await prisma.session.deleteMany({ where: { userId: { in: [superAdminUser.id, managerUser.id, leadUser.id, employeeUserA.id, employeeUserB.id] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [superAdminUser.id, managerUser.id, leadUser.id, employeeUserA.id, employeeUserB.id] } } }).catch(() => {})
    await prisma.employee.deleteMany({ where: { id: { in: [employeeEmpA.id, employeeEmpB.id, leadEmp.id, managerEmp.id] } } }).catch(() => {})
    await prisma.team.deleteMany({ where: { departmentId: deptA.id } }).catch(() => {})
    await prisma.designation.deleteMany({ where: { id: desig.id } }).catch(() => {})
    await prisma.department.deleteMany({ where: { id: { in: [deptA.id, deptB.id] } } }).catch(() => {})
  })
})

