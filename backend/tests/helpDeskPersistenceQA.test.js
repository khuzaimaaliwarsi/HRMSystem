import './helpers/testIsolation.js'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import prisma, { getSanitizedDbDetails } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'
import { assertIsolatedTestDatabase, cleanupTestFixtures } from './helpers/testIsolation.js'

describe('Backend Help Desk Management End-to-End Persistence QA Suite', () => {
  const tag = `HD_QA_${Date.now()}`
  const createdIds = {
    userIds: [],
    employeeIds: [],
    departmentIds: [],
    designationIds: []
  }
  const createdTicketIds = []

  let deptEng = null
  let deptFin = null
  let desig = null

  let saToken = ''
  let hrToken = ''
  let mgrToken = ''
  let empEngToken = ''
  let empFinToken = ''

  let saUser = null
  let hrUser = null
  let empEng = null
  let empFin = null

  before(async () => {
    assertIsolatedTestDatabase(prisma, getSanitizedDbDetails)

    deptEng = await prisma.department.create({ data: { code: `D_HD_ENG_${tag}`, name: 'QA HelpDesk Eng', status: 'Active' } })
    deptFin = await prisma.department.create({ data: { code: `D_HD_FIN_${tag}`, name: 'QA HelpDesk Fin', status: 'Active' } })
    desig = await prisma.designation.create({ data: { code: `DS_HD_${tag}`, title: 'Engineer', level: 'MID' } })
    createdIds.departmentIds.push(deptEng.id, deptFin.id)
    createdIds.designationIds.push(desig.id)

    const pw = '$2a$10$dummyhashfortestingonly000000000000000000000000000'
    const createActor = async (suffix, role, departmentId) => {
      const emp = await prisma.employee.create({
        data: {
          employeeCode: `EMP_HD_${suffix}_${tag}`,
          firstName: suffix,
          lastName: 'HelpDeskQA',
          email: `hd.${suffix.toLowerCase()}.${tag}@isysware.qa`,
          departmentId,
          designationId: desig.id,
          employmentType: 'PERMANENT',
          employmentStatus: 'ACTIVE',
          joiningDate: new Date('2025-01-01T00:00:00.000Z')
        }
      })
      const usr = await prisma.user.create({
        data: {
          username: `usr_hd_${suffix.toLowerCase()}_${tag}`,
          email: `u.hd.${suffix.toLowerCase()}.${tag}@isysware.qa`,
          passwordHash: pw,
          role,
          employeeId: emp.id,
          isActive: true
        }
      })
      createdIds.employeeIds.push(emp.id)
      createdIds.userIds.push(usr.id)
      return { emp, usr, token: generateAccessToken({ userId: usr.id, role: usr.role }) }
    }

    const sa = await createActor('SA', 'SUPER_ADMIN', deptEng.id)
    const hr = await createActor('HR', 'HR_ADMIN', deptEng.id)
    const mgr = await createActor('MGR', 'DEPT_MANAGER', deptEng.id)
    const e1 = await createActor('ENG1', 'EMPLOYEE', deptEng.id)
    const e2 = await createActor('FIN1', 'EMPLOYEE', deptFin.id)

    saUser = sa.usr; saToken = sa.token
    hrUser = hr.usr; hrToken = hr.token
    mgrToken = mgr.token
    empEng = e1.emp; empEngToken = e1.token
    empFin = e2.emp; empFinToken = e2.token
  })

  after(async () => {
    try {
      if (createdTicketIds.length > 0) {
        await prisma.helpDeskTicket.deleteMany({
          where: { id: { in: createdTicketIds } }
        })
      }
      await prisma.auditLog.deleteMany({
        where: { actorUserId: { in: createdIds.userIds } }
      })
    } finally {
      await cleanupTestFixtures(prisma, createdIds)
      await prisma.$disconnect()
    }
  })

  it('1. Config, Ticket Creation, Routing, Validation & Reload Persistence across Roles', async () => {
    const cfgRes = await request(app)
      .get('/api/v1/helpdesk/config')
      .set('Authorization', `Bearer ${empEngToken}`)
    assert.equal(cfgRes.status, 200)
    assert.equal(cfgRes.body.data.categories.length, 4)
    assert.equal(cfgRes.body.data.teams.length, 4)
    assert.equal(cfgRes.body.data.slaTargets.Critical.resolutionHours, 4)

    // Validation rejections
    const shortSubj = await request(app)
      .post('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ subject: 'VPN', description: 'Long enough VPN error description', categoryId: 'CAT-IT' })
    assert.equal(shortSubj.status, 400)

    const shortDesc = await request(app)
      .post('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ subject: 'Valid VPN Issue Subject', description: 'short', categoryId: 'CAT-IT' })
    assert.equal(shortDesc.status, 400)

    // Create IT ticket by Engineering employee
    const itRes = await request(app)
      .post('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({
        subject: `QA ${tag} Laptop Docker SSD Exhausted`,
        categoryId: 'CAT-IT',
        subcategory: 'Laptop Hardware Malfunction',
        priority: 'High',
        relatedModule: 'F08 Training & Development',
        attachmentRef: 'docker_df.log',
        description: 'Root partition hits 100% during local HRMS container builds and freezes KDE.'
      })
    assert.equal(itRes.status, 201)
    const itTicket = itRes.body.data
    createdTicketIds.push(itTicket.id)
    assert.ok(itTicket.ticketId.startsWith('HD-'))
    assert.equal(itTicket.assignedTeamId, 'TEAM-IT')
    assert.equal(itTicket.status, 'Open')
    assert.equal(itTicket.priority, 'High')
    assert.equal(itTicket.attachmentRef, 'docker_df.log')

    // Create confidential HR ticket by Engineering employee
    const hrRes = await request(app)
      .post('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({
        subject: `QA ${tag} Confidential Workplace Grievance`,
        categoryId: 'CAT-HR',
        priority: 'Critical',
        description: 'Sensitive confidential workplace grievance submitted directly to HR team.'
      })
    assert.equal(hrRes.status, 201)
    const hrTicket = hrRes.body.data
    createdTicketIds.push(hrTicket.id)
    assert.equal(hrTicket.assignedTeamId, 'TEAM-HR')
    assert.equal(hrTicket.isEscalated, true) // Critical auto-escalated

    // Create Finance employee IT ticket (different dept)
    const finRes = await request(app)
      .post('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${empFinToken}`)
      .send({
        subject: `QA ${tag} Finance Excel Plugin Crash`,
        categoryId: 'CAT-IT',
        priority: 'Low',
        description: 'Financial workbook macro crashes when exporting monthly ledger CSV.'
      })
    assert.equal(finRes.status, 201)
    const finTicket = finRes.body.data
    createdTicketIds.push(finTicket.id)

    // Reload persistence & Role privacy checks
    const empList = await request(app)
      .get('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${empEngToken}`)
    assert.equal(empList.status, 200)
    assert.ok(empList.body.data.some((t) => t.id === itTicket.id))
    assert.ok(!empList.body.data.some((t) => t.id === finTicket.id))

    const empForbiddenFin = await request(app)
      .get(`/api/v1/helpdesk/tickets/${finTicket.id}`)
      .set('Authorization', `Bearer ${empEngToken}`)
    assert.equal(empForbiddenFin.status, 403)

    // Dept Manager sees same-dept non-confidential CAT-IT, but is shielded from CAT-HR & Finance dept ticket
    const mgrList = await request(app)
      .get('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${mgrToken}`)
    assert.equal(mgrList.status, 200)
    assert.ok(mgrList.body.data.some((t) => t.id === itTicket.id))
    assert.ok(!mgrList.body.data.some((t) => t.id === hrTicket.id))
    assert.ok(!mgrList.body.data.some((t) => t.id === finTicket.id))

    const mgrForbiddenHr = await request(app)
      .get(`/api/v1/helpdesk/tickets/${hrTicket.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
    assert.equal(mgrForbiddenHr.status, 403)

    // Super Admin sees all 3 across reload
    const saList = await request(app)
      .get('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(saList.status, 200)
    assert.ok(saList.body.data.some((t) => t.id === itTicket.id))
    assert.ok(saList.body.data.some((t) => t.id === hrTicket.id))
    assert.ok(saList.body.data.some((t) => t.id === finTicket.id))
  })

  it('2. Assignment, Escalation, Internal Notes Shielding, Pending Status, Resolution, CSAT Closure, Reopen & Analytics Persist in PostgreSQL', async () => {
    const createRes = await request(app)
      .post('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({
        subject: `QA ${tag} Payroll Tax Deduction Slip Discrepancy`,
        categoryId: 'CAT-PAY',
        subcategory: 'Salary Slip & Withholding Tax Clarification',
        priority: 'Medium',
        description: 'Monthly withholding tax calculation appears higher than approved slab rate.'
      })
    assert.equal(createRes.status, 201)
    const ticketId = createRes.body.data.id
    createdTicketIds.push(ticketId)

    // RBAC blocks employee & manager on admin support operations
    for (const token of [empEngToken, mgrToken]) {
      const rAssign = await request(app).post(`/api/v1/helpdesk/tickets/${ticketId}/assign`).set('Authorization', `Bearer ${token}`).send({ resolverName: 'Hack' })
      assert.equal(rAssign.status, 403)
      const rEsc = await request(app).post(`/api/v1/helpdesk/tickets/${ticketId}/escalate`).set('Authorization', `Bearer ${token}`).send({ reason: 'Unauthorized escalate' })
      assert.equal(rEsc.status, 403)
      const rRes = await request(app).post(`/api/v1/helpdesk/tickets/${ticketId}/resolve`).set('Authorization', `Bearer ${token}`).send({ resolutionSummary: 'Unauthorized resolve attempt' })
      assert.equal(rRes.status, 403)
    }

    // Assign resolver -> Assigned
    const assignRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ resolverId: hrUser.employeeId, resolverName: 'HR Payroll Resolver', teamId: 'TEAM-PAY' })
    assert.equal(assignRes.status, 200)
    assert.equal(assignRes.body.data.status, 'Assigned')
    assert.equal(assignRes.body.data.assignedResolverName, 'HR Payroll Resolver')
    assert.equal(assignRes.body.data.assignedTeamId, 'TEAM-PAY')

    // Internal note by HR Admin -> persisted, hidden from employee
    const intNoteRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/replies`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ message: 'Internal Note: Verified FBR slab mapping in payroll engine.', isInternalNote: true })
    assert.equal(intNoteRes.status, 201)
    assert.ok(intNoteRes.body.data.conversations.some((c) => c.isInternalNote))

    const empViewWithNote = await request(app)
      .get(`/api/v1/helpdesk/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${empEngToken}`)
    assert.equal(empViewWithNote.status, 200)
    assert.equal(empViewWithNote.body.data.conversations.filter((c) => c.isInternalNote).length, 0)

    // Public reply by HR Admin -> firstResponseAt set & status transitions Assigned -> In Progress
    const pubReplyRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/replies`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ message: 'Hi, please confirm if you submitted updated investment tax credit proofs.', isInternalNote: false })
    assert.equal(pubReplyRes.status, 201)
    assert.equal(pubReplyRes.body.data.status, 'In Progress')
    assert.ok(pubReplyRes.body.data.firstResponseAt)

    // Mark Pending Employee -> employee replies -> automatically resumes In Progress
    const pendingRes = await request(app)
      .patch(`/api/v1/helpdesk/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Pending Employee', note: 'Awaiting tax credit slip upload' })
    assert.equal(pendingRes.status, 200)
    assert.equal(pendingRes.body.data.status, 'Pending Employee')

    const empReplyRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/replies`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ message: 'Attached proof reference and confirmed slab exemption details.', isInternalNote: true })
    assert.equal(empReplyRes.status, 201)
    assert.equal(empReplyRes.body.data.status, 'In Progress')
    // Employee cannot force internal note
    const lastMsg = empReplyRes.body.data.conversations[empReplyRes.body.data.conversations.length - 1]
    assert.equal(lastMsg.isInternalNote, false)

    // Escalate -> priority becomes High & isEscalated true
    const escRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/escalate`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ reason: 'Payroll cutoff deadline in 2 hours' })
    assert.equal(escRes.status, 200)
    assert.equal(escRes.body.data.isEscalated, true)
    assert.equal(escRes.body.data.priority, 'High')

    // Resolve -> validation (< 10 chars fails) then valid resolution succeeds
    const badResolve = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ resolutionSummary: 'Fixed' })
    assert.equal(badResolve.status, 400)

    const resolveRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ resolutionSummary: 'Adjusted tax exemption slab in payroll run and regenerated PDF payslip.' })
    assert.equal(resolveRes.status, 200)
    assert.equal(resolveRes.body.data.status, 'Resolved')
    assert.ok(resolveRes.body.data.resolvedAt)

    // Reopen resolved ticket -> In Progress, previous resolution becomes historical (NOT current)
    const reopenRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/reopen`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ reason: 'Reopening briefly because allowance tax line still shows old slab.' })
    assert.equal(reopenRes.status, 200)
    assert.equal(reopenRes.body.data.status, 'In Progress')
    assert.equal(reopenRes.body.data.isReopened, true)
    assert.equal(reopenRes.body.data.isReopenedActive, true)
    assert.equal(reopenRes.body.data.resolutionSummary, null)
    assert.equal(reopenRes.body.data.resolvedAt, null)
    assert.equal(
      reopenRes.body.data.previousResolutionSummary,
      'Adjusted tax exemption slab in payroll run and regenerated PDF payslip.'
    )
    assert.ok(Array.isArray(reopenRes.body.data.resolutionHistory))
    assert.equal(reopenRes.body.data.resolutionHistory.length, 1)

    // Internal note timeline & non-assigned manager privacy shielding
    const mgrTimelineView = await request(app)
      .post(`/api/v1/helpdesk/tickets/${createRes.body.data.id}/replies`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ message: 'Attempted unauthorized manager internal note.', isInternalNote: true })
    assert.equal(mgrTimelineView.status, 403) // Confidential payroll ticket blocked for manager

    const empReopenedView = await request(app)
      .get(`/api/v1/helpdesk/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${empEngToken}`)
    assert.equal(empReopenedView.status, 200)
    assert.equal(
      empReopenedView.body.data.timeline.filter((evt) =>
        String(evt.action || '').toLowerCase().includes('internal note')
      ).length,
      0
    )

    // Resolve again and Close with CSAT Rating & Feedback (Cycle 1), then Reopen from Closed & Verify Historical Feedback
    const resolve2Res = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ resolutionSummary: 'Recalculated allowance slab exemption and verified zero tax variance.' })
    assert.equal(resolve2Res.status, 200)
    assert.equal(
      resolve2Res.body.data.resolutionSummary,
      'Recalculated allowance slab exemption and verified zero tax variance.'
    )

    // Non-owner employee cannot close
    const otherEmpClose = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/close`)
      .set('Authorization', `Bearer ${empFinToken}`)
      .send({ rating: 1, feedback: 'Unauthorized' })
    assert.equal(otherEmpClose.status, 403)

    // Invalid CSAT rating rejected
    const badRatingClose = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/close`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ rating: 9, feedback: 'Out of range' })
    assert.equal(badRatingClose.status, 400)

    // Valid closure + feedback
    const closeRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/close`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ rating: 5, feedback: 'Resolved cleanly before payroll freeze!' })
    assert.equal(closeRes.status, 200)
    assert.equal(closeRes.body.data.status, 'Closed')
    assert.equal(closeRes.body.data.satisfactionRating, 5)
    assert.equal(closeRes.body.data.satisfactionFeedback, 'Resolved cleanly before payroll freeze!')

    // Reopen closed ticket -> Closed rating/feedback & resolution move to historical, NOT current
    const reopenClosedRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/reopen`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ reason: 'Checking historical resolution & CSAT isolation after reopening a closed ticket.' })
    assert.equal(reopenClosedRes.status, 200)
    assert.equal(reopenClosedRes.body.data.status, 'In Progress')
    assert.equal(reopenClosedRes.body.data.resolutionSummary, null)
    assert.equal(reopenClosedRes.body.data.closedAt, null)
    assert.equal(reopenClosedRes.body.data.satisfactionRating, null)
    assert.equal(reopenClosedRes.body.data.satisfactionFeedback, null)
    assert.equal(reopenClosedRes.body.data.previousSatisfactionRating, 5)
    assert.equal(reopenClosedRes.body.data.previousSatisfactionFeedback, 'Resolved cleanly before payroll freeze!')
    assert.equal(
      reopenClosedRes.body.data.previousResolutionSummary,
      'Recalculated allowance slab exemption and verified zero tax variance.'
    )

    // Escalate a second time & verify Escalation History preserves multiple escalations chronologically
    const esc2Res = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/escalate`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ reason: 'Escalated again to Director for reopened variance audit' })
    assert.equal(esc2Res.status, 200)
    assert.ok(Array.isArray(esc2Res.body.data.escalationHistory))
    assert.equal(esc2Res.body.data.escalationHistory.length, 2)

    // Re-resolve and Close again cleanly for active CSAT KPI check
    const resolve3Res = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ resolutionSummary: 'Final verified payroll adjustment confirmed across audit trail.' })
    assert.equal(resolve3Res.status, 200)
    assert.equal(resolve3Res.body.data.satisfactionRating, null)
    assert.equal(resolve3Res.body.data.closedAt, null)

    const close2Res = await request(app)
      .post(`/api/v1/helpdesk/tickets/${ticketId}/close`)
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({ rating: 5, feedback: 'Resolved cleanly after reopen!' })
    assert.equal(close2Res.status, 200)

    // KPIs & CSAT Analytics verification + AuditLog persistence
    const kpiRes = await request(app)
      .get('/api/v1/helpdesk/kpis')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(kpiRes.status, 200)
    assert.ok(kpiRes.body.data.totalTickets >= 4)
    assert.ok(kpiRes.body.data.closedTickets >= 1)
    assert.ok(kpiRes.body.data.feedbackList.some((f) => f.feedback === 'Resolved cleanly after reopen!'))
    assert.ok(
      kpiRes.body.data.historicalFeedbackList.some((f) => f.feedback === 'Resolved cleanly before payroll freeze!')
    )

    const auditRows = await prisma.auditLog.findMany({
      where: { sourceModule: 'HELP_DESK', entityId: ticketId }
    })
    assert.ok(auditRows.length >= 8, 'All ticket lifecycle actions must be recorded in AuditLog')
  })

  it('3. SLA First-Response & Resolution Deadline Breach Detection + Manager Non-Assigned Internal Note Shielding', async () => {
    const slaRes = await request(app)
      .post('/api/v1/helpdesk/tickets')
      .set('Authorization', `Bearer ${empEngToken}`)
      .send({
        subject: `QA ${tag} Network Switch Response SLA Breach Check`,
        categoryId: 'CAT-IT',
        priority: 'High',
        description: 'Testing first-response SLA breach and non-assigned manager internal-note privacy.'
      })
    assert.equal(slaRes.status, 201)
    const slaTicketId = slaRes.body.data.id
    createdTicketIds.push(slaTicketId)

    // Support adds an internal note on non-confidential Engineering ticket
    const intNoteRes = await request(app)
      .post(`/api/v1/helpdesk/tickets/${slaTicketId}/replies`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ message: 'Internal Support Diagnostic: Port flapping on Floor 2 switch.', isInternalNote: true })
    assert.equal(intNoteRes.status, 201)

    // Dept Manager CAN view same-dept IT ticket, but MUST NOT see internal note or internal timeline entry
    const mgrView = await request(app)
      .get(`/api/v1/helpdesk/tickets/${slaTicketId}`)
      .set('Authorization', `Bearer ${mgrToken}`)
    assert.equal(mgrView.status, 200)
    assert.equal(mgrView.body.data.conversations.filter((c) => c.isInternalNote).length, 0)
    assert.equal(
      mgrView.body.data.timeline.filter((e) =>
        String(e.action || '').toLowerCase().includes('internal note')
      ).length,
      0
    )

    // Backdate firstResponseDue past now while slaDueDate remains in future -> First Response SLA Breached!
    await prisma.helpDeskTicket.update({
      where: { id: slaTicketId },
      data: {
        firstResponseDue: new Date(Date.now() - 3600000),
        slaDueDate: new Date(Date.now() + 7200000)
      }
    })

    const breachedView = await request(app)
      .get(`/api/v1/helpdesk/tickets/${slaTicketId}`)
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(breachedView.status, 200)
    assert.equal(breachedView.body.data.isResponseSlaBreached, true)
    assert.equal(breachedView.body.data.firstResponseSlaStatus, 'Breached')
    assert.equal(breachedView.body.data.isSlaBreached, true)
    assert.equal(breachedView.body.data.slaStatus, 'Breached')

    const breachedKpis = await request(app)
      .get('/api/v1/helpdesk/kpis')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(breachedKpis.status, 200)
    assert.ok(breachedKpis.body.data.responseSlaBreaches >= 1)
    assert.ok(breachedKpis.body.data.slaBreaches >= 1)
  })
})

