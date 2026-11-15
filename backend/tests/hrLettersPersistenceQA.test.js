import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('HR Letters Management — Complete PostgreSQL Persistence, Reload & RBAC QA Suite', () => {
  let dept = null
  let otherDept = null
  let desig = null

  let saUser = null
  let hrUser = null
  let hr2User = null
  let mgrUser = null
  let empUser = null
  let otherEmpUser = null

  let saToken = null
  let hrToken = null
  let hr2Token = null
  let mgrToken = null
  let empToken = null
  let otherEmpToken = null

  let saEmp = null
  let hrEmp = null
  let hr2Emp = null
  let mgrEmp = null
  let emp = null
  let otherEmp = null

  let customTemplate = null
  let salaryTemplate = null
  let draftLetter = null
  let salaryLetter = null
  let directIssuedLetter = null
  let rejectedLetter = null

  async function cleanup() {
    await prisma.auditLog.deleteMany({ where: { sourceModule: 'HR_LETTERS' } }).catch(() => {})
    await prisma.issuedHrLetter.deleteMany({}).catch(() => {})
    if (customTemplate?.templateId) {
      await prisma.hrLetterTemplate.deleteMany({ where: { templateCode: customTemplate.templateId } }).catch(() => {})
    }
    await prisma.hrLetterTemplate.deleteMany({ where: { title: { startsWith: 'QA ' } } }).catch(() => {})
    const empIds = [saEmp?.id, hrEmp?.id, hr2Emp?.id, mgrEmp?.id, emp?.id, otherEmp?.id].filter(Boolean)
    if (empIds.length) {
      await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {})
      await prisma.user.deleteMany({ where: { employeeId: { in: empIds } } }).catch(() => {})
      await prisma.employee.deleteMany({ where: { id: { in: empIds } } }).catch(() => {})
    }
    if (desig?.id) await prisma.designation.deleteMany({ where: { id: desig.id } }).catch(() => {})
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {})
    if (otherDept?.id) await prisma.department.deleteMany({ where: { id: otherDept.id } }).catch(() => {})
  }

  before(async () => {
    await prisma.auditLog.deleteMany({ where: { sourceModule: 'HR_LETTERS' } }).catch(() => {})
    await prisma.issuedHrLetter.deleteMany({}).catch(() => {})
    await prisma.user.deleteMany({ where: { username: { startsWith: 'qa_ltr_' } } }).catch(() => {})
    await prisma.employee.deleteMany({ where: { employeeCode: { startsWith: 'QA-LTR-' } } }).catch(() => {})
    await prisma.designation.deleteMany({ where: { code: 'QA-LTR-DESIG' } }).catch(() => {})
    await prisma.department.deleteMany({ where: { code: { in: ['QA-LTR-ENG', 'QA-LTR-FIN'] } } }).catch(() => {})

    dept = await prisma.department.create({ data: { code: 'QA-LTR-ENG', name: 'QA Letters Engineering', status: 'ACTIVE' } })
    otherDept = await prisma.department.create({ data: { code: 'QA-LTR-FIN', name: 'QA Letters Finance', status: 'ACTIVE' } })
    desig = await prisma.designation.create({ data: { code: 'QA-LTR-DESIG', title: 'QA Software Engineer', level: 'SENIOR', departmentId: dept.id } })

    const makeActor = async (code, firstName, lastName, role, departmentId, uname) => {
      const e = await prisma.employee.create({
        data: {
          employeeCode: code,
          firstName,
          lastName,
          email: `${uname}@example.com`,
          joiningDate: new Date('2024-02-01'),
          department: { connect: { id: departmentId } },
          designation: { connect: { id: desig.id } }
        }
      })
      const u = await prisma.user.create({
        data: { username: uname, email: `${uname}@example.com`, passwordHash: 'x', role, employeeId: e.id }
      })
      const t = generateAccessToken({ id: u.id, role: u.role })
      return { e, u, t }
    }

    ;({ e: saEmp, u: saUser, t: saToken } = await makeActor('QA-LTR-SA01', 'Tariq', 'SuperAdmin', 'SUPER_ADMIN', dept.id, 'qa_ltr_sa'))
    ;({ e: hrEmp, u: hrUser, t: hrToken } = await makeActor('QA-LTR-HR01', 'Ayesha', 'HRAdmin', 'HR_ADMIN', dept.id, 'qa_ltr_hr'))
    ;({ e: hr2Emp, u: hr2User, t: hr2Token } = await makeActor('QA-LTR-HR02', 'Asim', 'SecondHR', 'HR_ADMIN', dept.id, 'qa_ltr_hr2'))
    ;({ e: mgrEmp, u: mgrUser, t: mgrToken } = await makeActor('QA-LTR-MGR01', 'Bilal', 'Manager', 'DEPT_MANAGER', dept.id, 'qa_ltr_mgr'))
    ;({ e: emp, u: empUser, t: empToken } = await makeActor('QA-LTR-EMP01', 'Zeeshan', 'Employee', 'EMPLOYEE', dept.id, 'qa_ltr_emp'))
    ;({ e: otherEmp, u: otherEmpUser, t: otherEmpToken } = await makeActor('QA-LTR-EMP02', 'Hina', 'FinanceEmp', 'EMPLOYEE', otherDept.id, 'qa_ltr_other'))

    await prisma.salaryStructure.create({
      data: {
        employeeId: emp.id,
        baseSalary: 140000,
        grossSalary: 185000,
        effectiveFrom: new Date('2025-01-01'),
        isCurrent: true
      }
    })
  })

  after(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  it('1. Submodule 1 (Templates Management): seeds standard templates, creates/edits with version bump, rejects unprivileged edits & persists across reload', async () => {
    // Manager/Employee cannot create or edit templates
    const denyMgr = await request(app)
      .post('/api/v1/letters/templates')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ letterType: 'Experience Letter', templateName: 'QA Blocked Template', subject: 'S', body: 'B' })
    assert.equal(denyMgr.status, 403)

    // HR creates new custom template
    const createRes = await request(app)
      .post('/api/v1/letters/templates')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        letterType: 'Experience Letter',
        templateName: 'QA Persistent Experience Template',
        subject: 'Service Verification — {{employee_name}}',
        body: 'This confirms {{employee_name}} ({{employee_id}}) worked in {{department}} as {{designation}}.',
        authorizedSignatory: 'Ayesha Khan',
        signatoryTitle: 'Head of HR',
        status: 'Active'
      })
    assert.equal(createRes.status, 201)
    customTemplate = createRes.body.data
    assert.equal(customTemplate.version, '1.0')
    assert.ok(customTemplate.templateId.startsWith('TMP-'))

    // Edit template -> version increments cleanly (1.0 -> 1.1)
    const patchRes = await request(app)
      .patch(`/api/v1/letters/templates/${customTemplate.templateId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        letterType: 'Experience Letter',
        templateName: 'QA Persistent Experience Template v2',
        subject: 'Official Experience Certificate — {{employee_name}}',
        body: 'Original verified tenure record for {{employee_name}} ({{employee_id}}) in {{department}}.',
        status: 'Active'
      })
    assert.equal(patchRes.status, 200)
    assert.equal(patchRes.body.data.version, '1.1')

    // Simulated page reload -> persisted in PostgreSQL
    const reloadRes = await request(app).get('/api/v1/letters/templates').set('Authorization', `Bearer ${empToken}`)
    assert.equal(reloadRes.status, 200)
    const found = reloadRes.body.data.find((t) => t.templateId === customTemplate.templateId)
    assert.ok(found)
    assert.equal(found.templateName, 'QA Persistent Experience Template v2')
    assert.equal(found.version, '1.1')

    salaryTemplate = reloadRes.body.data.find((t) => t.letterType === 'Salary Increment Letter')
    assert.ok(salaryTemplate)
    assert.equal(salaryTemplate.isProtectedSalary, true)
  })

  it('2. Submodule 2 & 3 (Salary Protection, Draft, Submit, Anti-Self-Approval & Official Issuance with Immutable Snapshot)', async () => {
    // Manager blocked from creating protected salary letter
    const denySal = await request(app)
      .post('/api/v1/letters')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({
        templateId: salaryTemplate.templateId,
        employeeId: emp.employeeCode,
        letterType: salaryTemplate.letterType
      })
    assert.equal(denySal.status, 403)

    // HR creates draft from customTemplate
    const draftRes = await request(app)
      .post('/api/v1/letters')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        templateId: customTemplate.templateId,
        employeeId: emp.employeeCode,
        letterType: customTemplate.letterType
      })
    assert.equal(draftRes.status, 201)
    draftLetter = draftRes.body.data
    assert.equal(draftLetter.status, 'Draft')
    assert.ok(draftLetter.contentSnapshot.includes('Zeeshan Employee'))

    // Submit for approval -> Pending Approval
    const subRes = await request(app)
      .post(`/api/v1/letters/${draftLetter.letterId}/submit`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({})
    assert.equal(subRes.status, 200)
    assert.equal(subRes.body.data.status, 'Pending Approval')

    // Creator HR1 blocked by Anti-Self-Approval
    const selfDeny = await request(app)
      .patch(`/api/v1/letters/${draftLetter.letterId}/approve`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ remarks: 'Attempt self signoff' })
    assert.equal(selfDeny.status, 403)
    assert.equal(selfDeny.body.error.code, 'SELF_APPROVAL_PROHIBITED')

    // Second HR approves
    const approveRes = await request(app)
      .patch(`/api/v1/letters/${draftLetter.letterId}/approve`)
      .set('Authorization', `Bearer ${hr2Token}`)
      .send({ remarks: 'Verified HR peer signoff' })
    assert.equal(approveRes.status, 200)
    assert.equal(approveRes.body.data.status, 'Approved')

    // Final Issuance assigns ISW-LTR-YYYY-NNNNN
    const issueRes = await request(app)
      .post(`/api/v1/letters/${draftLetter.letterId}/issue`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ remarks: 'Published officially' })
    assert.equal(issueRes.status, 200)
    const issued = issueRes.body.data
    assert.equal(issued.status, 'Issued')
    assert.ok(issued.referenceNumber?.startsWith('ISW-LTR-'))
    const frozenSnapshot = issued.contentSnapshot

    // Duplicate issuance prevented (409)
    const dupRes = await request(app)
      .post(`/api/v1/letters/${issued.letterId}/issue`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({})
    assert.equal(dupRes.status, 409)

    // Modify template after issuance -> issued content snapshot remains immutable
    await request(app)
      .patch(`/api/v1/letters/templates/${customTemplate.templateId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        letterType: 'Experience Letter',
        templateName: customTemplate.templateName,
        subject: 'MODIFIED SUBJECT',
        body: 'RADICAL OVERWRITE SHOULD NEVER ALTER ISSUED SNAPSHOT',
        status: 'Active'
      })
    const afterTmplEdit = await request(app).get(`/api/v1/letters/${issued.referenceNumber}`).set('Authorization', `Bearer ${saToken}`)
    assert.equal(afterTmplEdit.status, 200)
    assert.equal(afterTmplEdit.body.data.contentSnapshot, frozenSnapshot)
    assert.ok(!afterTmplEdit.body.data.contentSnapshot.includes('RADICAL OVERWRITE'))
  })

  it('3. Protected Salary Letter Governance & Rejection Persistence: only Super Admin can approve salary letters', async () => {
    // HR drafts & submits protected salary increment letter
    const salCreate = await request(app)
      .post('/api/v1/letters')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        templateId: salaryTemplate.templateId,
        employeeId: emp.employeeCode,
        letterType: salaryTemplate.letterType,
        customValues: { revisedSalary: 230000, incrementAmount: 45000 },
        submitNow: true
      })
    assert.equal(salCreate.status, 201)
    salaryLetter = salCreate.body.data
    assert.equal(salaryLetter.isProtectedSalary, true)
    assert.ok(salaryLetter.contentSnapshot.includes('230,000'))

    // Second HR cannot approve protected salary letter -> requires Super Admin
    const hr2Deny = await request(app)
      .patch(`/api/v1/letters/${salaryLetter.letterId}/approve`)
      .set('Authorization', `Bearer ${hr2Token}`)
      .send({})
    assert.equal(hr2Deny.status, 403)

    // Super Admin approves & issues protected salary letter
    const saApprove = await request(app)
      .patch(`/api/v1/letters/${salaryLetter.letterId}/approve`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ remarks: 'CEO Remuneration Signoff' })
    assert.equal(saApprove.status, 200)
    assert.equal(saApprove.body.data.approvalStatus, 'Approved')

    const saIssue = await request(app)
      .post(`/api/v1/letters/${salaryLetter.letterId}/issue`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({})
    assert.equal(saIssue.status, 200)
    assert.equal(saIssue.body.data.status, 'Issued')

    // Reject workflow test & persistence across reload
    const rejDraft = await request(app)
      .post('/api/v1/letters')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ templateId: customTemplate.templateId, employeeId: otherEmp.employeeCode, letterType: 'Experience Letter', submitNow: true })
    assert.equal(rejDraft.status, 201)
    const rejRes = await request(app)
      .patch(`/api/v1/letters/${rejDraft.body.data.letterId}/reject`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ reason: 'Missing clearance verification' })
    assert.equal(rejRes.status, 200)
    rejectedLetter = rejRes.body.data
    assert.equal(rejectedLetter.status, 'Rejected')
    assert.equal(rejectedLetter.rejectionReason, 'Missing clearance verification')
  })

  it('4. Super Admin Direct Issue & Role-Based Scoping Across Reload (Employee, Manager, HR, Super Admin)', async () => {
    // Super Admin directly authorizes & issues a letter for self without other approval
    const directRes = await request(app)
      .post('/api/v1/letters')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        templateId: salaryTemplate.templateId,
        employeeId: saEmp.employeeCode,
        letterType: salaryTemplate.letterType,
        customValues: { revisedSalary: 500000, incrementAmount: 50000 },
        directIssue: true
      })
    assert.equal(directRes.status, 201)
    directIssuedLetter = directRes.body.data
    assert.equal(directIssuedLetter.status, 'Issued')
    assert.ok(directIssuedLetter.referenceNumber.startsWith('ISW-LTR-'))

    // Reload: Employee (emp) sees ONLY their own issued letters (NOT otherEmp's letters, NOT unissued HR drafts)
    const empReload = await request(app).get('/api/v1/letters').set('Authorization', `Bearer ${empToken}`)
    assert.equal(empReload.status, 200)
    assert.equal(empReload.body.data.length, 2)
    assert.ok(empReload.body.data.every((l) => l.employeeId === emp.employeeCode && l.status === 'Issued'))

    // Other employee (otherEmp) sees ONLY their own issued letters (0 issued so far; rejectedLetter belongs to otherEmp but is NOT issued)
    const otherReload = await request(app).get('/api/v1/letters').set('Authorization', `Bearer ${otherEmpToken}`)
    assert.equal(otherReload.status, 200)
    assert.equal(otherReload.body.data.length, 0)

    // Manager in dept sees non-salary issued letters in dept (draftLetter) but NOT emp's protected salaryLetter!
    const mgrReload = await request(app).get('/api/v1/letters').set('Authorization', `Bearer ${mgrToken}`)
    assert.equal(mgrReload.status, 200)
    assert.ok(mgrReload.body.data.some((l) => l.letterId === draftLetter.letterId))
    assert.ok(!mgrReload.body.data.some((l) => l.letterId === salaryLetter.letterId))
    assert.ok(!mgrReload.body.data.some((l) => l.letterId === directIssuedLetter.letterId))

    // Super Admin sees all 4 letters across reload
    const saReload = await request(app).get('/api/v1/letters').set('Authorization', `Bearer ${saToken}`)
    assert.equal(saReload.status, 200)
    assert.equal(saReload.body.data.length, 4)

    // Employee self-requested document persists across reload
    const empReqRes = await request(app)
      .post('/api/v1/letters')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        templateId: customTemplate.templateId,
        employeeId: emp.employeeCode,
        letterType: 'Experience Letter',
        submitNow: true
      })
    assert.equal(empReqRes.status, 201)
    const empReload2 = await request(app).get('/api/v1/letters').set('Authorization', `Bearer ${empToken}`)
    assert.ok(empReload2.body.data.some((l) => l.letterId === empReqRes.body.data.letterId))
  })

  it('5. Submodule 4 (Governance & Audit History) + KPIs persist accurately in PostgreSQL', async () => {
    const auditRes = await request(app).get('/api/v1/letters/audit-logs').set('Authorization', `Bearer ${saToken}`)
    assert.equal(auditRes.status, 200)
    const types = new Set(auditRes.body.data.map((a) => a.actionType))
    assert.ok(types.has('TEMPLATE_CREATED'))
    assert.ok(types.has('TEMPLATE_UPDATED'))
    assert.ok(types.has('LETTER_DRAFTED'))
    assert.ok(types.has('LETTER_APPROVED'))
    assert.ok(types.has('LETTER_ISSUED'))
    assert.ok(types.has('LETTER_REJECTED'))
    assert.ok(types.has('LETTER_DIRECTLY_ISSUED'))

    // KPIs match exact DB counts
    const kpiRes = await request(app).get('/api/v1/letters/kpis').set('Authorization', `Bearer ${saToken}`)
    assert.equal(kpiRes.status, 200)
    assert.equal(kpiRes.body.data.issuedCount, 3)
    assert.equal(kpiRes.body.data.pendingApprovalCount, 1)
    assert.equal(kpiRes.body.data.totalLetters, 5)
  })

  it('6. Editing TMP-001 signatory persists to PostgreSQL with v1.2 -> v1.3 bump across reload & rejects unknown template ID with 404', async () => {
    const beforeTpl = await prisma.hrLetterTemplate.findFirst({ where: { templateCode: 'TMP-001' } })
    assert.ok(beforeTpl, 'Starter template TMP-001 must exist in PostgreSQL')
    const prevMeta = beforeTpl.placeholdersJson && typeof beforeTpl.placeholdersJson === 'object' ? beforeTpl.placeholdersJson : {}

    try {
      // Ensure TMP-001 starts at known v1.2 baseline in test DB
      await prisma.hrLetterTemplate.update({
        where: { id: beforeTpl.id },
        data: {
          placeholdersJson: {
            ...prevMeta,
            authorizedSignatory: 'Ayesha Khan',
            version: '1.2'
          }
        }
      })

      const updateRes = await request(app)
        .patch('/api/v1/letters/templates/TMP-001')
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          templateId: 'TMP-001',
          letterType: beforeTpl.category,
          templateName: beforeTpl.title,
          subject: prevMeta.subject || 'Offer of Employment — {{designation}}',
          body: beforeTpl.templateBodyHtml,
          authorizedSignatory: 'Khuzaima Senior Developer',
          signatoryTitle: prevMeta.signatoryTitle || 'Head of Human Resources',
          headerText: prevMeta.headerText || '',
          footerText: prevMeta.footerText || '',
          status: 'Active',
          isProtectedSalary: true
        })

      assert.equal(updateRes.status, 200)
      assert.equal(updateRes.body.data.templateId, 'TMP-001')
      assert.equal(updateRes.body.data.authorizedSignatory, 'Khuzaima Senior Developer')
      assert.equal(updateRes.body.data.version, '1.3')

      // Verify reload from PostgreSQL reflects updated signatory and v1.3
      const reloadRes = await request(app)
        .get('/api/v1/letters/templates')
        .set('Authorization', `Bearer ${saToken}`)
      assert.equal(reloadRes.status, 200)
      const reloadedTmp001 = reloadRes.body.data.find((t) => t.templateId === 'TMP-001')
      assert.ok(reloadedTmp001)
      assert.equal(reloadedTmp001.authorizedSignatory, 'Khuzaima Senior Developer')
      assert.equal(reloadedTmp001.version, '1.3')

      // Verify AuditLog captures signatory change
      const auditRow = await prisma.auditLog.findFirst({
        where: { sourceModule: 'HR_LETTERS', actionType: 'TEMPLATE_UPDATED', entityId: 'TMP-001' },
        orderBy: { createdAt: 'desc' }
      })
      assert.ok(auditRow)
      assert.equal(auditRow.recordSnapshotBefore?.authorizedSignatory, 'Ayesha Khan')
      assert.equal(auditRow.recordSnapshotAfter?.authorizedSignatory, 'Khuzaima Senior Developer')
      assert.equal(auditRow.recordSnapshotAfter?.version, '1.3')

      // Non-existent template PATCH must return 404 instead of silently creating a duplicate
      const notFoundRes = await request(app)
        .patch('/api/v1/letters/templates/TMP-999-MISSING')
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          letterType: 'Offer Letter',
          templateName: 'Missing Template',
          subject: 'Subject',
          body: 'Body'
        })
      assert.equal(notFoundRes.status, 404)
      assert.equal(notFoundRes.body?.error?.code, 'TEMPLATE_NOT_FOUND')
    } finally {
      // Restore TMP-001 baseline in test DB so repeated runs remain deterministic
      await prisma.hrLetterTemplate.update({
        where: { id: beforeTpl.id },
        data: {
          title: beforeTpl.title,
          category: beforeTpl.category,
          templateBodyHtml: beforeTpl.templateBodyHtml,
          isActive: beforeTpl.isActive,
          placeholdersJson: prevMeta
        }
      })
    }
  })
})
