import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Backend Batch 4 — Employee Management API Suite', () => {
  let saUser = null
  let empUser = null
  let saToken = null
  let empToken = null
  let deptA = null
  let deptB = null
  let desig1 = null
  let desig2 = null
  let createdEmp = null

  it('Setup: Prepares departments, designations, and actor accounts', async () => {
    saUser = await prisma.user.create({
      data: {
        username: 'emp_mgmt_sa',
        email: 'emp_mgmt_sa@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'SUPER_ADMIN',
        isProtected: true
      }
    })

    empUser = await prisma.user.create({
      data: {
        username: 'emp_mgmt_regular',
        email: 'emp_mgmt_reg@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE'
      }
    })

    saToken = generateAccessToken({ userId: saUser.id, role: 'SUPER_ADMIN' })
    empToken = generateAccessToken({ userId: empUser.id, role: 'EMPLOYEE' })

    deptA = await prisma.department.create({ data: { code: 'DEP-EMP-A', name: 'Software Engineering' } })
    deptB = await prisma.department.create({ data: { code: 'DEP-EMP-B', name: 'Product Management' } })
    desig1 = await prisma.designation.create({ data: { code: 'DES-EMP-1', title: 'Software Engineer', level: 'MID' } })
    desig2 = await prisma.designation.create({ data: { code: 'DES-EMP-2', title: 'Senior Software Architect', level: 'SENIOR' } })

    assert.ok(saToken)
    assert.ok(empToken)
  })

  it('1. POST /api/v1/employees: Creates a canonical employee profile with demographics and banking details', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeCode: 'EMP-BATCH4-001',
        firstName: 'Zeeshan',
        lastName: 'Ahmed',
        email: 'zeeshan.ahmed@isysware.test',
        phone: '+92 300 1234567',
        cnic: '42101-1234567-1',
        joiningDate: '2026-01-15',
        departmentId: deptA.id,
        designationId: desig1.id,
        bankName: 'Meezan Bank Limited',
        bankAccountTitle: 'Zeeshan Ahmed',
        bankAccountNumber: '01010101012345',
        bankIban: 'PK36MEZN0001010101012345',
        taxNtnNumber: '1234567-8'
      })

    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.success, true)
    assert.strictEqual(res.body.data.employeeCode, 'EMP-BATCH4-001')
    assert.strictEqual(res.body.data.firstName, 'Zeeshan')
    createdEmp = res.body.data
  })

  it('2. POST /api/v1/employees: Rejects duplicate employee code with 409', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeCode: 'EMP-BATCH4-001', // duplicate
        firstName: 'Duplicate',
        lastName: 'Person',
        email: 'duplicate.person@isysware.test',
        joiningDate: '2026-01-15',
        departmentId: deptA.id,
        designationId: desig1.id
      })

    assert.strictEqual(res.status, 409)
    assert.strictEqual(res.body.error.code, 'DUPLICATE_EMPLOYEE_CODE')
  })

  it('3. Sensitive Data Masking: Admin sees full banking info; Employee sees masked details', async () => {
    // Super Admin view
    const adminRes = await request(app)
      .get(`/api/v1/employees/${createdEmp.id}`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(adminRes.status, 200)
    assert.strictEqual(adminRes.body.data.bankAccountNumber, '01010101012345')
    assert.strictEqual(adminRes.body.data.taxNtnNumber, '1234567-8')

    // Coworker Employee view (via directory)
    const empListRes = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${empToken}`)

    assert.strictEqual(empListRes.status, 200)
    const targetInList = empListRes.body.data.find(e => e.id === createdEmp.id)
    assert.ok(targetInList)
    assert.strictEqual(targetInList.bankAccountNumber, '•••• •••• ••••', 'Banking details must be masked')
    assert.strictEqual(targetInList.taxNtnNumber, '•••••••-•', 'NTN must be masked')
  })

  it('4. POST /api/v1/employees/:id/transfer: Lateral transfer updates department and records career history', async () => {
    const res = await request(app)
      .post(`/api/v1/employees/${createdEmp.id}/transfer`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        departmentId: deptB.id,
        remarks: 'Transferred to Product Management'
      })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.data.departmentId, deptB.id)

    // Verify career history record was atomically created
    const historyRes = await request(app)
      .get(`/api/v1/employees/${createdEmp.id}/career-history`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(historyRes.status, 200)
    assert.ok(historyRes.body.data.some(h => h.changeType === 'DEPARTMENT_TRANSFER'))
  })

  it('5. POST /api/v1/employees/:id/promote: Upgrades designation and preserves compensation independence', async () => {
    const res = await request(app)
      .post(`/api/v1/employees/${createdEmp.id}/promote`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        newDesignationId: desig2.id,
        remarks: 'Promoted to Senior Software Architect'
      })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.data.designationId, desig2.id)

    // Verify career history record
    const historyRes = await request(app)
      .get(`/api/v1/employees/${createdEmp.id}/career-history`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(historyRes.status, 200)
    assert.ok(historyRes.body.data.some(h => h.changeType === 'PROMOTION'))
  })

  it('6. PATCH /api/v1/employees/:id/status: Updates status and deactivates portal account on separation', async () => {
    // Create linked user account for createdEmp
    const user = await prisma.user.create({
      data: {
        employeeId: createdEmp.id,
        username: 'emp_separated_user',
        email: 'emp_separated@isysware.test',
        passwordHash: '$argon2id$mock',
        role: 'EMPLOYEE',
        isActive: true
      }
    })

    const res = await request(app)
      .patch(`/api/v1/employees/${createdEmp.id}/status`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        status: 'RESIGNED',
        reason: 'Career transition'
      })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.data.employmentStatus, 'RESIGNED')

    // Confirm user account deactivated
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
    assert.strictEqual(updatedUser.isActive, false, 'User portal account must be deactivated upon resignation')

    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  })

  it('7. Employee Documents Metadata: Add and verify document metadata', async () => {
    const addRes = await request(app)
      .post(`/api/v1/employees/${createdEmp.id}/documents`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        documentType: 'EXPERIENCE_LETTER',
        fileName: 'previous_company_exp.pdf',
        fileUrl: 'https://storage.isysware.internal/docs/exp_001.pdf',
        fileSize: 1048576,
        mimeType: 'application/pdf'
      })

    assert.strictEqual(addRes.status, 201)
    const docId = addRes.body.data.id

    // Verify document
    const verifyRes = await request(app)
      .patch(`/api/v1/employees/documents/${docId}/verify`)
      .set('Authorization', `Bearer ${saToken}`)

    assert.strictEqual(verifyRes.status, 200)
    assert.strictEqual(verifyRes.body.data.isVerified, true)
  })

  it('Teardown: Cleans up employee fixtures', async () => {
    if (createdEmp?.id) {
      await prisma.employeeDocument.deleteMany({ where: { employeeId: createdEmp.id } }).catch(() => {})
      await prisma.employeeCareerHistory.deleteMany({ where: { employeeId: createdEmp.id } }).catch(() => {})
      await prisma.employee.delete({ where: { id: createdEmp.id } }).catch(() => {})
    }
    await prisma.designation.deleteMany({ where: { id: { in: [desig1.id, desig2.id] } } }).catch(() => {})
    await prisma.department.deleteMany({ where: { id: { in: [deptA.id, deptB.id] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [saUser.id, empUser.id] } } }).catch(() => {})
  })
})

