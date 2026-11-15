/**
 * iSysware HRMS — Administration & Settings API Routes
 */

import { Router } from 'express'
import adminSettingsService from '../services/adminSettingsService.js'
import { payrollTaxService } from '../services/payrollTaxService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()
router.use(authenticate)

// 1. Settings
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await adminSettingsService.getSettings()
    return sendSuccess(res, settings)
  } catch (err) { next(err) }
})

router.get('/tax-config', async (req, res, next) => {
  try {
    const config = await payrollTaxService.getTaxConfig()
    return sendSuccess(res, config)
  } catch (err) { next(err) }
})

router.put('/tax-config', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const updated = await payrollTaxService.updateTaxConfig(req.body, req.user)
    return sendSuccess(res, updated, { message: 'Payroll tax configuration updated successfully' })
  } catch (err) { next(err) }
})

router.patch('/settings', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const setting = await adminSettingsService.updateSettings(req.body, req.user.id)
    return sendSuccess(res, setting, { message: 'Organization settings updated' })
  } catch (err) { next(err) }
})

router.put('/settings', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const setting = await adminSettingsService.updateSettings(req.body, req.user.id)
    return sendSuccess(res, setting, { message: 'Organization settings updated' })
  } catch (err) { next(err) }
})

// 1B. Configurable Policies & Invariants (Batch 7A)
router.get('/policies', async (req, res, next) => {
  try {
    const policies = await adminSettingsService.getPolicies()
    return sendSuccess(res, policies)
  } catch (err) { next(err) }
})

router.patch('/policies', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const policies = await adminSettingsService.updatePolicies(req.body, req.user)
    return sendSuccess(res, policies, { message: 'Company policies updated successfully' })
  } catch (err) { next(err) }
})

// 1C. Company Policies & Rule Builder Registry (Batch F13)
router.get('/company-policies', async (req, res, next) => {
  try {
    const policies = await adminSettingsService.getCompanyPolicies()
    return sendSuccess(res, policies)
  } catch (err) { next(err) }
})

router.post('/company-policies', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const created = await adminSettingsService.createCompanyPolicy(req.body, req.user)
    return sendSuccess(res, created, { message: 'Company policy created successfully' }, 201)
  } catch (err) { next(err) }
})

router.put('/company-policies/:id', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const updated = await adminSettingsService.updateCompanyPolicy(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Company policy updated successfully' })
  } catch (err) { next(err) }
})

router.get('/company-policies/:id/history', async (req, res, next) => {
  try {
    const history = await adminSettingsService.getCompanyPolicyHistory(req.params.id)
    return sendSuccess(res, history)
  } catch (err) { next(err) }
})

router.patch('/company-policies/:id/status', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.body || {}
    const updated = await adminSettingsService.toggleCompanyPolicyStatus(req.params.id, status || 'Active', req.user)
    return sendSuccess(res, updated, { message: `Policy status updated to ${status}` })
  } catch (err) { next(err) }
})

router.delete('/company-policies/:id', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const result = await adminSettingsService.deleteCompanyPolicy(req.params.id, req.user)
    return sendSuccess(res, result)
  } catch (err) { next(err) }
})

// 2. User Accounts Management (Super Admin ONLY)
router.get('/users', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const users = await adminSettingsService.getUsers(req.query)
    return sendSuccess(res, users)
  } catch (err) { next(err) }
})

router.post('/users', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const newUser = await adminSettingsService.createUser(req.body, req.user)
    return sendSuccess(res, newUser, { message: 'Portal account created successfully' }, 201)
  } catch (err) { next(err) }
})

router.patch('/users/:id', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const updated = await adminSettingsService.updateUser(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'Portal account updated successfully' })
  } catch (err) { next(err) }
})

router.patch('/users/:id/status', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const updated = await adminSettingsService.updateUserStatus(req.params.id, req.body, req.user)
    return sendSuccess(res, updated, { message: 'User status updated successfully' })
  } catch (err) { next(err) }
})

router.post('/users/:id/reset-password', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const result = await adminSettingsService.adminResetPassword(req.params.id, req.body, req.user)
    return sendSuccess(res, result)
  } catch (err) { next(err) }
})

router.delete('/users/:id', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const result = await adminSettingsService.deleteUser(req.params.id, req.user)
    return sendSuccess(res, result)
  } catch (err) { next(err) }
})

// 3. Operational Data Management (Super Admin ONLY)
router.post('/data/delete-selective', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { modules, confirmationToken } = req.body || {}
    const result = await adminSettingsService.deleteSelectiveOperationalData({ modules, confirmationToken }, req.user)
    return sendSuccess(res, result)
  } catch (err) { next(err) }
})

router.post('/data/delete-all', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { confirmationToken } = req.body || {}
    if (confirmationToken !== 'DELETE ALL DATA') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONFIRMATION_TOKEN',
          message: 'Confirmation token must exactly match "DELETE ALL DATA"'
        }
      })
    }
    const result = await adminSettingsService.deleteAllOperationalData(req.user)
    return sendSuccess(res, result)
  } catch (err) { next(err) }
})

// 4. Security Audit Trail
router.get('/audit-logs', requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const auditData = await adminSettingsService.getAuditLogs(req.query)
    return sendSuccess(res, auditData.logs, auditData.pagination)
  } catch (err) { next(err) }
})

export default router
