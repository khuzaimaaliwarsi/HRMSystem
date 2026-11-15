/**
 * iSysware HRMS — HR Letters Management API Routes
 * Mounts under /api/v1/letters
 */

import { Router } from 'express'
import hrLettersService, { AVAILABLE_PLACEHOLDERS, LETTER_TYPES } from '../services/hrLettersService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()
router.use(authenticate)

// Metadata (letter types & placeholders)
router.get('/meta', async (req, res, next) => {
  try {
    return sendSuccess(res, { letterTypes: LETTER_TYPES, placeholders: AVAILABLE_PLACEHOLDERS })
  } catch (err) {
    next(err)
  }
})

// Templates CRUD
router.get('/templates', async (req, res, next) => {
  try {
    const list = await hrLettersService.getTemplates(req.query)
    return sendSuccess(res, list)
  } catch (err) {
    next(err)
  }
})

router.post('/templates', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const template = await hrLettersService.saveTemplate(req.body, req.user)
    return sendSuccess(res, template, { message: 'Letter template created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

const updateTemplateHandler = async (req, res, next) => {
  try {
    const template = await hrLettersService.saveTemplate(
      { ...req.body, templateId: req.params.id, isUpdate: true },
      req.user
    )
    return sendSuccess(res, template, { message: 'Letter template updated successfully' })
  } catch (err) {
    next(err)
  }
}

router.patch('/templates/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), updateTemplateHandler)
router.put('/templates/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), updateTemplateHandler)

// Governance Audit Logs & KPIs (static routes MUST come before /:id)
router.get('/audit-logs', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'), async (req, res, next) => {
  try {
    const logs = await hrLettersService.getAuditLogs(req.user)
    return sendSuccess(res, logs)
  } catch (err) {
    next(err)
  }
})

router.get('/kpis', async (req, res, next) => {
  try {
    const kpis = await hrLettersService.getKPIs(req.user)
    return sendSuccess(res, kpis)
  } catch (err) {
    next(err)
  }
})

// Letters Register & Issuance Lifecycle
router.get('/', async (req, res, next) => {
  try {
    const letters = await hrLettersService.getLetters(req.query, req.user)
    return sendSuccess(res, letters)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const letter = await hrLettersService.getLetterById(req.params.id, req.user)
    return sendSuccess(res, letter)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const letter = await hrLettersService.createLetterDraft(req.body, req.user)
    return sendSuccess(res, letter, { message: 'HR letter record saved successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

router.post('/:id/submit', async (req, res, next) => {
  try {
    const letter = await hrLettersService.submitForApproval(req.params.id, req.user)
    return sendSuccess(res, letter, { message: 'Letter submitted for executive approval' })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/approve', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const letter = await hrLettersService.approveLetter(req.params.id, req.user, req.body?.remarks)
    return sendSuccess(res, letter, { message: 'Letter approved successfully' })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/reject', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const letter = await hrLettersService.rejectLetter(req.params.id, req.user, req.body?.reason || req.body?.remarks)
    return sendSuccess(res, letter, { message: 'Letter rejected and returned for revision' })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/issue', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const letter = await hrLettersService.issueLetter(req.params.id, req.user, req.body?.remarks)
    return sendSuccess(res, letter, { message: 'Letter officially issued with immutable reference' })
  } catch (err) {
    next(err)
  }
})

export default router

