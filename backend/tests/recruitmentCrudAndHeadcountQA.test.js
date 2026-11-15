import test from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/config/database.js'
import recruitmentService from '../src/services/recruitmentService.js'

test('Recruitment CRUD & Headcount PostgreSQL Suite', async (t) => {
  // Ensure department and designation exist for tests
  let dept = await prisma.department.findFirst()
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: 'Engineering QA', code: 'ENG_QA' }
    })
  }

  let desig = await prisma.designation.findFirst()
  if (!desig) {
    desig = await prisma.designation.create({
      data: { title: 'Software Engineer QA', code: 'SE_QA', departmentId: dept.id }
    })
  }

  let adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } })

  // 1. Requisition Creation & Headcount Persistence
  let testReq = await prisma.jobRequisition.findFirst({
    where: { requisitionNumber: 'REQ-2026-002' }
  })
  if (!testReq) {
    testReq = await prisma.jobRequisition.create({
      data: {
        requisitionNumber: 'REQ-2026-002',
        departmentId: dept.id,
        designationId: desig.id,
        openingsCount: 5,
        justification: 'Project Expansion & New Feature Roadmap',
        requestedById: adminUser?.id || 'admin-test',
        status: 'APPROVED'
      }
    })
  }

  await t.test('1. Requisition REQ-2026-002 has openingsCount = 5 in PostgreSQL', async () => {
    const req = await prisma.jobRequisition.findFirst({
      where: { requisitionNumber: 'REQ-2026-002' }
    })
    assert.ok(req, 'Requisition REQ-2026-002 exists')
    assert.strictEqual(req.openingsCount, 5, 'Headcount is 5 in PostgreSQL')
  })

  // 2. Ensure JOB-2026-004 exists linked to REQ-2026-002
  let testJob = await prisma.jobOpening.findFirst({
    where: { openingCode: 'JOB-2026-004' }
  })
  if (!testJob) {
    testJob = await prisma.jobOpening.create({
      data: {
        openingCode: 'JOB-2026-004',
        title: 'Frontend Developer',
        departmentId: dept.id,
        requisitionId: testReq.id,
        status: 'OPEN'
      }
    })
  }

  await t.test('2. Job Opening JOB-2026-004 includes linked requisition with openingsCount = 5', async () => {
    const openings = await recruitmentService.getJobOpenings()
    const job004 = openings.find((o) => o.openingCode === 'JOB-2026-004')
    assert.ok(job004, 'JOB-2026-004 exists')
    assert.ok(job004.requisition, 'JOB-2026-004 has linked requisition')
    assert.strictEqual(job004.requisition.openingsCount, 5, 'Linked requisition has openingsCount 5')
  })

  // 3. Test updateJobOpening updates title, status, and synchronizes headcount
  await t.test('3. updateJobOpening updates details and updates linked requisition headcount in PostgreSQL', async () => {
    const job004 = await prisma.jobOpening.findFirst({
      where: { openingCode: 'JOB-2026-004' }
    })
    assert.ok(job004, 'JOB-2026-004 found in DB')

    // Update headcount to 7 via updateJobOpening
    const updated = await recruitmentService.updateJobOpening(job004.id, {
      title: 'Senior Frontend Developer',
      openPositions: 7
    })
    assert.strictEqual(updated.title, 'Senior Frontend Developer')

    // Verify linked requisition updated in PostgreSQL
    const req = await prisma.jobRequisition.findUnique({
      where: { id: job004.requisitionId }
    })
    assert.strictEqual(req.openingsCount, 7, 'Requisition openingsCount updated to 7 in DB')

    // Restore back to 5
    await recruitmentService.updateJobOpening(job004.id, {
      title: 'Frontend Developer',
      openPositions: 5
    })
    const restoredReq = await prisma.jobRequisition.findUnique({
      where: { id: job004.requisitionId }
    })
    assert.strictEqual(restoredReq.openingsCount, 5, 'Requisition openingsCount restored to 5 in DB')
  })

  // 4. Test Full CRUD: create test opening, read it, update it, and delete it in PostgreSQL
  await t.test('4. Full CRUD on Job Opening persists and deletes cleanly in PostgreSQL', async () => {
    // Create
    const created = await recruitmentService.createJobOpening({
      title: 'QA Test Position CRUD',
      departmentId: dept.id
    })
    assert.ok(created.id, 'Created opening has ID')
    assert.strictEqual(created.title, 'QA Test Position CRUD')

    // Read
    const fetched = await recruitmentService.getJobOpeningById(created.id)
    assert.strictEqual(fetched.id, created.id)
    assert.strictEqual(fetched.title, 'QA Test Position CRUD')

    // Update
    const updated = await recruitmentService.updateJobOpening(created.id, {
      title: 'QA Test Position Updated'
    })
    assert.strictEqual(updated.title, 'QA Test Position Updated')

    // Delete
    const deleted = await recruitmentService.deleteJobOpening(created.id)
    assert.strictEqual(deleted.deleted, true)

    // Verify gone
    const checkDeleted = await prisma.jobOpening.findUnique({ where: { id: created.id } })
    assert.strictEqual(checkDeleted, null, 'Deleted opening is removed from PostgreSQL')
  })
})
