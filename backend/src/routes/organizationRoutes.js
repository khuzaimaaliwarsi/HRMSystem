/**
 * iSysware HRMS — Organization Management Routes
 * Endpoints for Departments, Sub-Departments, Teams, Designations, and Hierarchy.
 */

import { Router } from 'express'
import organizationService from '../services/organizationService.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()

// All organization routes require authentication
router.use(authenticate)

// ==============================================================================
// 1. DEPARTMENTS
// ==============================================================================
router.get('/departments', async (req, res, next) => {
  try {
    const result = await organizationService.getDepartments(req.query)
    return sendSuccess(res, result.departments, result.pagination, 200)
  } catch (err) {
    next(err)
  }
})

router.get('/departments/:id', async (req, res, next) => {
  try {
    const department = await organizationService.getDepartmentById(req.params.id)
    return sendSuccess(res, department, undefined, 200)
  } catch (err) {
    next(err)
  }
})

router.post('/departments', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const department = await organizationService.createDepartment(req.body, req.user?.id)
    return sendSuccess(res, department, { message: 'Department created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

router.patch('/departments/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await organizationService.updateDepartment(req.params.id, req.body, req.user?.id)
    return sendSuccess(res, updated, { message: 'Department updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

router.delete('/departments/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await organizationService.deleteDepartment(req.params.id, req.user?.id)
    return sendSuccess(res, result.department, { message: result.message }, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 2. SUB-DEPARTMENTS
// ==============================================================================
router.get('/sub-departments', async (req, res, next) => {
  try {
    const subDepartments = await organizationService.getSubDepartments(req.query)
    return sendSuccess(res, subDepartments, undefined, 200)
  } catch (err) {
    next(err)
  }
})

router.post('/sub-departments', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const subDept = await organizationService.createSubDepartment(req.body)
    return sendSuccess(res, subDept, { message: 'Sub-department created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

router.patch('/sub-departments/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await organizationService.updateSubDepartment(req.params.id, req.body)
    return sendSuccess(res, updated, { message: 'Sub-department updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

router.delete('/sub-departments/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await organizationService.deleteSubDepartment(req.params.id, req.user?.id)
    return sendSuccess(res, result, { message: result.message }, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 3. TEAMS
// ==============================================================================
router.get('/teams', async (req, res, next) => {
  try {
    const teams = await organizationService.getTeams(req.query)
    return sendSuccess(res, teams, undefined, 200)
  } catch (err) {
    next(err)
  }
})

router.get('/teams/:id', async (req, res, next) => {
  try {
    const team = await organizationService.getTeamById(req.params.id)
    return sendSuccess(res, team, undefined, 200)
  } catch (err) {
    next(err)
  }
})

router.post('/teams', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const team = await organizationService.createTeam(req.body, req.user?.id)
    return sendSuccess(res, team, { message: 'Team created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

router.patch('/teams/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await organizationService.updateTeam(req.params.id, req.body)
    return sendSuccess(res, updated, { message: 'Team updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

router.delete('/teams/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await organizationService.deleteTeam(req.params.id, req.user?.id)
    return sendSuccess(res, result, { message: result.message }, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 4. DESIGNATIONS
// ==============================================================================
router.get('/designations', async (req, res, next) => {
  try {
    const designations = await organizationService.getDesignations(req.query)
    return sendSuccess(res, designations, undefined, 200)
  } catch (err) {
    next(err)
  }
})

router.post('/designations', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const designation = await organizationService.createDesignation(req.body)
    return sendSuccess(res, designation, { message: 'Designation created successfully' }, 201)
  } catch (err) {
    next(err)
  }
})

router.patch('/designations/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const updated = await organizationService.updateDesignation(req.params.id, req.body)
    return sendSuccess(res, updated, { message: 'Designation updated successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

router.delete('/designations/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
  try {
    const result = await organizationService.deleteDesignation(req.params.id, req.user?.id)
    return sendSuccess(res, result, { message: result.message }, 200)
  } catch (err) {
    next(err)
  }
})

// ==============================================================================
// 5. ORGANIZATIONAL HIERARCHY
// ==============================================================================
router.get('/hierarchy', async (req, res, next) => {
  try {
    const hierarchy = await organizationService.getHierarchyTree()
    return sendSuccess(res, hierarchy, undefined, 200)
  } catch (err) {
    next(err)
  }
})

export default router

