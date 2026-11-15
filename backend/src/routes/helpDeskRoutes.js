/**
 * iSysware HRMS — Help Desk Management API Routes
 */

import { Router } from 'express'
import helpDeskService from '../services/helpDeskService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()
router.use(authenticate)

// Config (Categories, Support Teams, SLA Matrix)
router.get('/config', async (_req, res, next) => {
  try {
    return sendSuccess(res, helpDeskService.getConfig())
  } catch (err) {
    next(err)
  }
})

// Operational KPIs & Analytics
router.get('/kpis', async (req, res, next) => {
  try {
    const kpis = await helpDeskService.getKPIs(req.user)
    return sendSuccess(res, kpis)
  } catch (err) {
    next(err)
  }
})

// List Tickets (Role-Scoped)
router.get('/tickets', async (req, res, next) => {
  try {
    const tickets = await helpDeskService.getTickets(req.query, req.user)
    return sendSuccess(res, tickets)
  } catch (err) {
    next(err)
  }
})

// Single Ticket Details
router.get('/tickets/:id', async (req, res, next) => {
  try {
    const ticket = await helpDeskService.getTicketById(req.params.id, req.user)
    return sendSuccess(res, ticket)
  } catch (err) {
    next(err)
  }
})

// Create Ticket (Any authenticated role)
router.post('/tickets', async (req, res, next) => {
  try {
    const ticket = await helpDeskService.createTicket(req.body, req.user)
    return sendSuccess(res, ticket, { message: 'Support ticket created' }, 201)
  } catch (err) {
    next(err)
  }
})

// Add Reply or Internal Note
router.post('/tickets/:id/replies', async (req, res, next) => {
  try {
    const ticket = await helpDeskService.addReply(req.params.id, req.body, req.user)
    return sendSuccess(res, ticket, { message: 'Reply recorded' }, 201)
  } catch (err) {
    next(err)
  }
})

// Assign Resolver / Route Team
router.post('/tickets/:id/assign', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const ticket = await helpDeskService.assignTicket(req.params.id, req.body, req.user)
    return sendSuccess(res, ticket, { message: 'Ticket assigned' })
  } catch (err) {
    next(err)
  }
})

// Escalate Ticket
router.post('/tickets/:id/escalate', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const ticket = await helpDeskService.escalateTicket(req.params.id, req.body, req.user)
    return sendSuccess(res, ticket, { message: 'Ticket escalated' })
  } catch (err) {
    next(err)
  }
})

// Update Operational Status (Pending Employee / In Progress / Assigned)
router.patch('/tickets/:id/status', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const ticket = await helpDeskService.updateStatus(req.params.id, req.body, req.user)
    return sendSuccess(res, ticket, { message: 'Ticket status updated' })
  } catch (err) {
    next(err)
  }
})

// Resolve Ticket
router.post('/tickets/:id/resolve', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const ticket = await helpDeskService.resolveTicket(req.params.id, req.body, req.user)
    return sendSuccess(res, ticket, { message: 'Ticket resolved' })
  } catch (err) {
    next(err)
  }
})

// Close Ticket & Record CSAT Feedback
router.post('/tickets/:id/close', async (req, res, next) => {
  try {
    const ticket = await helpDeskService.closeTicket(req.params.id, req.body, req.user)
    return sendSuccess(res, ticket, { message: 'Ticket closed' })
  } catch (err) {
    next(err)
  }
})

// Reopen Resolved/Closed Ticket
router.post('/tickets/:id/reopen', async (req, res, next) => {
  try {
    const ticket = await helpDeskService.reopenTicket(req.params.id, req.body, req.user)
    return sendSuccess(res, ticket, { message: 'Ticket reopened' })
  } catch (err) {
    next(err)
  }
})

export default router

