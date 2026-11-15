/**
 * iSysware HRMS — Employee Feedback, Individual Development Plans (IDP) & Performance Improvement Plans (PIP) Service
 * PostgreSQL-backed service via Prisma ORM with:
 * - Employee Feedback (creation, strengths, improvement areas, manager comments, acknowledgement, history)
 * - Individual Development Plans (goals, mentors, deadlines, milestones/checkpoints, progress & completion)
 * - Formal Performance Improvement Plans (concerns, measurable targets, review schedules, manager evaluations, employee acknowledgement, governed closure & outcomes)
 * - Strict separation between IDP and PIP tracks
 * - Role-based & department-scoped access control + anti-self-approval + AuditLog attribution
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'

const VALID_FEEDBACK_TYPES = ['POSITIVE', 'CONSTRUCTIVE', 'RECOGNITION', 'CHECK_IN', 'COACHING']
const VALID_FEEDBACK_STATUSES = ['SHARED', 'ACKNOWLEDGED', 'ARCHIVED']
const VALID_PLAN_CATEGORIES = ['IDP', 'PIP']
const VALID_REVIEW_FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY']
const VALID_PIP_OUTCOMES = [
  'SUCCESSFULLY_COMPLETED',
  'EXTENDED',
  'REASSIGNED',
  'UNMET_ESCALATED',
  'CANCELLED'
]

function normalizeDateInput(val) {
  if (!val) return null
  const str = String(val).trim()
  if (!str) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T00:00:00.000Z`)
  }
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function getEmployeeInclude() {
  return {
    id: true,
    employeeCode: true,
    firstName: true,
    lastName: true,
    departmentId: true,
    employmentStatus: true,
    department: { select: { id: true, code: true, name: true } },
    designation: { select: { id: true, code: true, title: true } }
  }
}

export class FeedbackDevelopmentService {
  _getActorDeptId(user) {
    return user?.departmentId || user?.employee?.departmentId || null
  }

  _getActorName(user) {
    if (user?.employee) {
      const n = `${user.employee.firstName || ''} ${user.employee.lastName || ''}`.trim()
      if (n) return n
    }
    return user?.username || user?.email || user?.role || 'System User'
  }

  _isSuperAdmin(user) {
    return String(user?.role || '').toUpperCase() === 'SUPER_ADMIN'
  }

  _isAdmin(user) {
    return ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role)
  }

  _isManagerOrLead(user) {
    return ['DEPT_MANAGER', 'TEAM_LEAD'].includes(user?.role)
  }

  async _resolveEmployee(employeeRef) {
    if (!employeeRef) return null
    return prisma.employee.findFirst({
      where: {
        OR: [{ id: String(employeeRef) }, { employeeCode: String(employeeRef) }]
      },
      select: getEmployeeInclude()
    })
  }

  async _writeAudit(actorUser, actionType, entityName, entityId, beforeSnap, afterSnap, notes) {
    if (!actorUser?.id && !actorUser?.role) return
    await prisma.auditLog
      .create({
        data: {
          actorUserId: actorUser?.id || null,
          actorEmployeeCode: actorUser?.employee?.employeeCode || null,
          actorRole: actorUser?.role || 'SYSTEM',
          sourceModule: 'PERFORMANCE',
          actionType,
          entityName,
          entityId,
          recordSnapshotBefore: beforeSnap || undefined,
          recordSnapshotAfter: afterSnap || undefined,
          reasonOrNotes: notes || null
        }
      })
      .catch(() => {})
  }

  async _generateCode(modelName, prefix, fieldName) {
    const year = new Date().getFullYear()
    const baseCount = (await prisma[modelName].count()) + 1
    for (let i = 0; i < 30; i++) {
      const code = `${prefix}-${year}-${String(baseCount + i).padStart(3, '0')}`
      const exists = await prisma[modelName].findUnique({
        where: { [fieldName]: code },
        select: { id: true }
      })
      if (!exists) return code
    }
    return `${prefix}-${year}-${Date.now().toString().slice(-6)}`
  }

  _assertDepartmentScope(user, targetEmployee, { allowOwnRecord = false } = {}) {
    if (this._isAdmin(user)) return
    const isSelf = Boolean(user?.employeeId && targetEmployee?.id === user.employeeId)
    if (allowOwnRecord && isSelf) return

    if (user?.role === 'EMPLOYEE') {
      if (!isSelf) {
        throw new AppError('Access denied: You can only access your own performance records', 403, 'FORBIDDEN')
      }
      return
    }

    if (this._isManagerOrLead(user)) {
      const actorDeptId = this._getActorDeptId(user)
      if (!actorDeptId || targetEmployee?.departmentId !== actorDeptId) {
        throw new AppError(
          'Access denied: You can only manage records for employees in your own department',
          403,
          'FORBIDDEN_DEPARTMENT_SCOPE'
        )
      }
      return
    }

    throw new AppError('Insufficient permissions for this performance record', 403, 'FORBIDDEN')
  }

  _normalizeCheckpoints(rawList) {
    if (!Array.isArray(rawList)) return []
    return rawList
      .map((item, idx) => {
        if (!item) return null
        const title = String(item.title || '').trim()
        if (!title) return null
        return {
          id: item.id || `cp_${Date.now()}_${idx}`,
          title,
          metric: String(item.metric || '').trim() || null,
          targetValue: String(item.targetValue || '').trim() || null,
          dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : '',
          completed: Boolean(item.completed),
          completedAt: item.completed ? (item.completedAt || new Date().toISOString()) : null,
          completedBy: item.completed ? (item.completedBy || null) : null,
          notes: item.notes ? String(item.notes).trim() : ''
        }
      })
      .filter(Boolean)
  }

  _normalizeImprovementTargets(rawList) {
    if (!Array.isArray(rawList)) return []
    return rawList
      .map((item, idx) => {
        if (!item) return null
        const area = String(item.area || item.title || '').trim()
        const metric = String(item.metric || item.target || '').trim()
        if (!area || !metric) return null
        return {
          id: item.id || `tgt_${Date.now()}_${idx}`,
          area,
          metric,
          baseline: String(item.baseline || '').trim() || '',
          target: String(item.target || metric).trim(),
          dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : '',
          status: ['NOT_STARTED', 'IN_PROGRESS', 'MET', 'AT_RISK', 'MISSED'].includes(
            String(item.status || '').toUpperCase()
          )
            ? String(item.status).toUpperCase()
            : 'IN_PROGRESS',
          achievedValue: String(item.achievedValue || '').trim() || '',
          managerNotes: String(item.managerNotes || '').trim() || ''
        }
      })
      .filter(Boolean)
  }

  _normalizeReviewSchedule(rawList) {
    if (!Array.isArray(rawList)) return []
    return rawList
      .map((item, idx) => {
        if (!item || !item.reviewDate) return null
        return {
          id: item.id || `rev_${Date.now()}_${idx}`,
          reviewDate: String(item.reviewDate).slice(0, 10),
          focus: String(item.focus || 'Scheduled PIP Check-In').trim(),
          status: item.status || 'SCHEDULED'
        }
      })
      .filter(Boolean)
  }

  _computeCheckpointsProgress(checkpoints, fallbackPercent = 0) {
    if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
      return Math.min(100, Math.max(0, Number(fallbackPercent) || 0))
    }
    const done = checkpoints.filter((c) => c.completed).length
    return Math.round((done / checkpoints.length) * 100)
  }

  // ============================================================================
  // SECTION 1: EMPLOYEE FEEDBACK
  // ============================================================================

  async getFeedbacks(filters = {}, user) {
    const where = {}
    if (filters.status && filters.status !== 'ALL') {
      where.status = String(filters.status).toUpperCase()
    }
    if (filters.feedbackType && filters.feedbackType !== 'ALL') {
      where.feedbackType = String(filters.feedbackType).toUpperCase()
    }
    if (filters.employeeId) {
      const emp = await this._resolveEmployee(filters.employeeId)
      if (!emp) return []
      where.employeeId = emp.id
    }

    const employeeWhere = {}
    if (filters.departmentId) employeeWhere.departmentId = filters.departmentId

    if (user?.role === 'EMPLOYEE') {
      if (!user.employeeId) return []
      where.employeeId = user.employeeId
    } else if (this._isManagerOrLead(user)) {
      const actorDeptId = this._getActorDeptId(user)
      if (!actorDeptId) {
        if (!user.employeeId) return []
        where.employeeId = user.employeeId
      } else {
        employeeWhere.departmentId = actorDeptId
      }
    }

    if (Object.keys(employeeWhere).length > 0) {
      where.employee = employeeWhere
    }

    if (filters.search) {
      const q = String(filters.search).trim()
      where.OR = [
        { feedbackCode: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { strengths: { contains: q, mode: 'insensitive' } },
        { improvementAreas: { contains: q, mode: 'insensitive' } },
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
        { employee: { employeeCode: { contains: q, mode: 'insensitive' } } }
      ]
    }

    return prisma.employeeFeedback.findMany({
      where,
      include: {
        employee: { select: getEmployeeInclude() },
        authorEmployee: { select: getEmployeeInclude() }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async getFeedbackById(id, user) {
    const feedback = await prisma.employeeFeedback.findUnique({
      where: { id },
      include: {
        employee: { select: getEmployeeInclude() },
        authorEmployee: { select: getEmployeeInclude() }
      }
    })
    if (!feedback) throw new AppError('Feedback record not found', 404, 'NOT_FOUND')

    this._assertDepartmentScope(user, feedback.employee, { allowOwnRecord: true })

    const auditHistory = await prisma.auditLog.findMany({
      where: { entityName: 'EmployeeFeedback', entityId: id },
      orderBy: { createdAt: 'desc' }
    })

    return { ...feedback, auditHistory }
  }

  async createFeedback(data, user) {
    if (!this._isAdmin(user) && !this._isManagerOrLead(user)) {
      throw new AppError('Only authorized managers or HR/Admins can issue structured feedback', 403, 'FORBIDDEN')
    }

    const target = await this._resolveEmployee(data.employeeId)
    if (!target) throw new AppError('Target employee not found', 404, 'EMPLOYEE_NOT_FOUND')
    if (target.employmentStatus !== 'ACTIVE') {
      throw new AppError('Feedback can only be recorded for ACTIVE employees', 400, 'EMPLOYEE_INACTIVE')
    }

    if (!this._isSuperAdmin(user) && user?.employeeId && target.id === user.employeeId) {
      throw new AppError('Anti-self-approval: You cannot submit formal manager feedback for yourself', 403, 'SELF_FEEDBACK_FORBIDDEN')
    }

    this._assertDepartmentScope(user, target)

    const title = String(data.title || '').trim()
    const strengths = String(data.strengths || '').trim()
    const improvementAreas = String(data.improvementAreas || '').trim()
    const managerComments = String(data.managerComments || '').trim()
    const feedbackType = String(data.feedbackType || 'CONSTRUCTIVE').toUpperCase()

    if (!title) throw new AppError('Feedback title/subject is required', 400, 'VALIDATION_FAILED')
    if (!VALID_FEEDBACK_TYPES.includes(feedbackType)) {
      throw new AppError(`Invalid feedback type: ${feedbackType}`, 400, 'VALIDATION_FAILED')
    }
    if (!strengths && !improvementAreas && !managerComments) {
      throw new AppError('Provide at least strengths, improvement areas, or manager comments', 400, 'VALIDATION_FAILED')
    }

    const feedbackCode = await this._generateCode('employeeFeedback', 'FDB', 'feedbackCode')

    const created = await prisma.employeeFeedback.create({
      data: {
        feedbackCode,
        employeeId: target.id,
        authorEmployeeId: user?.employeeId || null,
        authorUserId: user?.id || null,
        authorName: this._getActorName(user),
        authorRole: user?.role || null,
        feedbackType,
        title,
        strengths: strengths || null,
        improvementAreas: improvementAreas || null,
        managerComments: managerComments || null,
        status: 'SHARED'
      },
      include: {
        employee: { select: getEmployeeInclude() },
        authorEmployee: { select: getEmployeeInclude() }
      }
    })

    await this._writeAudit(
      user,
      'CREATE',
      'EmployeeFeedback',
      created.id,
      null,
      { feedbackCode: created.feedbackCode, employeeId: target.employeeCode, feedbackType, status: created.status },
      `Created ${feedbackType} feedback (${created.feedbackCode}) for ${target.employeeCode}`
    )

    return created
  }

  async updateFeedback(id, data, user) {
    if (!this._isAdmin(user) && !this._isManagerOrLead(user)) {
      throw new AppError('Only authorized managers or HR/Admins can update feedback', 403, 'FORBIDDEN')
    }

    const existing = await prisma.employeeFeedback.findUnique({
      where: { id },
      include: { employee: { select: getEmployeeInclude() } }
    })
    if (!existing) throw new AppError('Feedback record not found', 404, 'NOT_FOUND')

    if (!this._isSuperAdmin(user) && user?.employeeId && existing.employeeId === user.employeeId) {
      throw new AppError('Anti-self-approval: You cannot modify manager feedback on your own record', 403, 'SELF_FEEDBACK_FORBIDDEN')
    }

    this._assertDepartmentScope(user, existing.employee)

    const updateData = {}
    if (data.title !== undefined) {
      const t = String(data.title).trim()
      if (!t) throw new AppError('Title cannot be empty', 400, 'VALIDATION_FAILED')
      updateData.title = t
    }
    if (data.feedbackType !== undefined) {
      const ft = String(data.feedbackType).toUpperCase()
      if (!VALID_FEEDBACK_TYPES.includes(ft)) {
        throw new AppError(`Invalid feedback type: ${ft}`, 400, 'VALIDATION_FAILED')
      }
      updateData.feedbackType = ft
    }
    if (data.strengths !== undefined) updateData.strengths = String(data.strengths).trim() || null
    if (data.improvementAreas !== undefined) updateData.improvementAreas = String(data.improvementAreas).trim() || null
    if (data.managerComments !== undefined) updateData.managerComments = String(data.managerComments).trim() || null
    if (data.status !== undefined) {
      const st = String(data.status).toUpperCase()
      if (!VALID_FEEDBACK_STATUSES.includes(st)) {
        throw new AppError(`Invalid feedback status: ${st}`, 400, 'VALIDATION_FAILED')
      }
      if (st === 'ACKNOWLEDGED') {
        throw new AppError('Managers cannot force-acknowledge feedback on behalf of the employee', 403, 'SELF_ACKNOWLEDGE_ONLY')
      }
      updateData.status = st
    }

    const updated = await prisma.employeeFeedback.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: getEmployeeInclude() },
        authorEmployee: { select: getEmployeeInclude() }
      }
    })

    await this._writeAudit(
      user,
      'UPDATE',
      'EmployeeFeedback',
      id,
      { status: existing.status, title: existing.title },
      { status: updated.status, title: updated.title },
      `Updated feedback ${existing.feedbackCode}`
    )

    return updated
  }

  async acknowledgeFeedback(id, data, user) {
    const existing = await prisma.employeeFeedback.findUnique({
      where: { id },
      include: { employee: { select: getEmployeeInclude() } }
    })
    if (!existing) throw new AppError('Feedback record not found', 404, 'NOT_FOUND')

    if (!user?.employeeId || existing.employeeId !== user.employeeId) {
      throw new AppError('Only the recipient employee can acknowledge their feedback', 403, 'FORBIDDEN')
    }

    const employeeResponse = data?.employeeResponse !== undefined ? String(data.employeeResponse).trim() : existing.employeeResponse

    const updated = await prisma.employeeFeedback.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        employeeResponse: employeeResponse || null,
        acknowledgedAt: new Date(),
        acknowledgedById: user.id
      },
      include: {
        employee: { select: getEmployeeInclude() },
        authorEmployee: { select: getEmployeeInclude() }
      }
    })

    await this._writeAudit(
      user,
      'ACKNOWLEDGE',
      'EmployeeFeedback',
      id,
      { status: existing.status },
      { status: updated.status, acknowledgedAt: updated.acknowledgedAt },
      `Employee ${existing.employee.employeeCode} acknowledged feedback ${existing.feedbackCode}`
    )

    return updated
  }

  // ============================================================================
  // SECTION 2 & 3: DEVELOPMENT PLANS (IDP) & PERFORMANCE IMPROVEMENT PLANS (PIP)
  // ============================================================================

  async getDevelopmentPlans(filters = {}, user) {
    const where = {}
    if (filters.planCategory && filters.planCategory !== 'ALL') {
      const cat = String(filters.planCategory).toUpperCase()
      if (!VALID_PLAN_CATEGORIES.includes(cat)) {
        throw new AppError(`Invalid planCategory: ${cat}`, 400, 'VALIDATION_FAILED')
      }
      where.planCategory = cat
    }
    if (filters.status && filters.status !== 'ALL') {
      where.status = String(filters.status).toUpperCase()
    }
    if (filters.employeeId) {
      const emp = await this._resolveEmployee(filters.employeeId)
      if (!emp) return []
      where.employeeId = emp.id
    }

    const employeeWhere = {}
    if (filters.departmentId) employeeWhere.departmentId = filters.departmentId

    if (user?.role === 'EMPLOYEE') {
      if (!user.employeeId) return []
      where.employeeId = user.employeeId
    } else if (this._isManagerOrLead(user)) {
      const actorDeptId = this._getActorDeptId(user)
      if (!actorDeptId) {
        if (!user.employeeId) return []
        where.employeeId = user.employeeId
      } else {
        employeeWhere.departmentId = actorDeptId
      }
    }

    if (Object.keys(employeeWhere).length > 0) {
      where.employee = employeeWhere
    }

    if (filters.search) {
      const q = String(filters.search).trim()
      where.OR = [
        { planCode: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { goalsSummary: { contains: q, mode: 'insensitive' } },
        { documentedConcerns: { contains: q, mode: 'insensitive' } },
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
        { employee: { employeeCode: { contains: q, mode: 'insensitive' } } }
      ]
    }

    return prisma.developmentPlan.findMany({
      where,
      include: {
        employee: { select: getEmployeeInclude() },
        mentor: { select: getEmployeeInclude() }
      },
      orderBy: [{ createdAt: 'desc' }]
    })
  }

  async getDevelopmentPlanById(id, user) {
    const plan = await prisma.developmentPlan.findUnique({
      where: { id },
      include: {
        employee: { select: getEmployeeInclude() },
        mentor: { select: getEmployeeInclude() }
      }
    })
    if (!plan) throw new AppError('Development plan not found', 404, 'NOT_FOUND')

    this._assertDepartmentScope(user, plan.employee, { allowOwnRecord: true })

    const auditHistory = await prisma.auditLog.findMany({
      where: { entityName: 'DevelopmentPlan', entityId: id },
      orderBy: { createdAt: 'desc' }
    })

    return { ...plan, auditHistory }
  }

  async createDevelopmentPlan(data, user) {
    const planCategory = String(data.planCategory || 'IDP').toUpperCase()
    if (!VALID_PLAN_CATEGORIES.includes(planCategory)) {
      throw new AppError('planCategory must be IDP or PIP', 400, 'VALIDATION_FAILED')
    }

    if (planCategory === 'PIP') {
      if (!this._isAdmin(user) && user?.role !== 'DEPT_MANAGER') {
        throw new AppError('Only Super Admin, HR Admin, or Department Managers can initiate a formal PIP', 403, 'FORBIDDEN')
      }
    } else if (!this._isAdmin(user) && !this._isManagerOrLead(user)) {
      throw new AppError('Only authorized managers or HR/Admins can create development plans', 403, 'FORBIDDEN')
    }

    const target = await this._resolveEmployee(data.employeeId)
    if (!target) throw new AppError('Target employee not found', 404, 'EMPLOYEE_NOT_FOUND')
    if (target.employmentStatus !== 'ACTIVE') {
      throw new AppError('Plans can only be created for ACTIVE employees', 400, 'EMPLOYEE_INACTIVE')
    }

    if (!this._isSuperAdmin(user) && planCategory === 'PIP' && user?.employeeId && target.id === user.employeeId) {
      throw new AppError('Anti-self-approval: You cannot initiate a formal PIP on yourself', 403, 'SELF_PIP_FORBIDDEN')
    }
    if (planCategory === 'IDP' && !this._isAdmin(user) && user?.employeeId && target.id === user.employeeId) {
      throw new AppError('Managers cannot approve or assign their own standalone IDP without HR/Admin oversight', 403, 'SELF_ASSIGN_FORBIDDEN')
    }

    this._assertDepartmentScope(user, target)

    const title = String(data.title || '').trim()
    if (!title) throw new AppError('Plan title is required', 400, 'VALIDATION_FAILED')

    let mentor = null
    if (data.mentorId) {
      mentor = await this._resolveEmployee(data.mentorId)
      if (!mentor) throw new AppError('Selected mentor employee not found', 404, 'MENTOR_NOT_FOUND')
    }

    const startDate = normalizeDateInput(data.startDate) || new Date()
    const targetEndDate = normalizeDateInput(data.targetEndDate || data.deadline)
    if (targetEndDate && startDate > targetEndDate) {
      throw new AppError('Start date must be on or before the target deadline', 400, 'INVALID_DATE_RANGE')
    }

    const checkpoints = this._normalizeCheckpoints(data.checkpoints)
    const improvementTargets = this._normalizeImprovementTargets(data.improvementTargets)
    const reviewSchedule = this._normalizeReviewSchedule(data.reviewSchedule)

    let documentedConcerns = String(data.documentedConcerns || '').trim() || null
    let reviewFrequency = data.reviewFrequency ? String(data.reviewFrequency).toUpperCase() : null

    if (planCategory === 'PIP') {
      if (!documentedConcerns) {
        throw new AppError('Formal PIP requires documented performance concerns', 400, 'VALIDATION_FAILED')
      }
      if (improvementTargets.length === 0) {
        throw new AppError('Formal PIP requires at least one measurable improvement target', 400, 'VALIDATION_FAILED')
      }
      if (!targetEndDate) {
        throw new AppError('Formal PIP requires a target review end date / deadline', 400, 'VALIDATION_FAILED')
      }
      reviewFrequency = VALID_REVIEW_FREQUENCIES.includes(reviewFrequency) ? reviewFrequency : 'BIWEEKLY'
    } else {
      if (!String(data.goalsSummary || '').trim() && checkpoints.length === 0) {
        throw new AppError('Development plan requires goals or at least one milestone checkpoint', 400, 'VALIDATION_FAILED')
      }
    }

    const progressPercent = this._computeCheckpointsProgress(checkpoints, data.progressPercent)
    const planCode = await this._generateCode(
      'developmentPlan',
      planCategory === 'PIP' ? 'PIP' : 'IDP',
      'planCode'
    )

    const created = await prisma.developmentPlan.create({
      data: {
        planCode,
        planCategory,
        employeeId: target.id,
        mentorId: mentor?.id || null,
        createdByEmployeeId: user?.employeeId || null,
        createdByUserId: user?.id || null,
        createdByName: this._getActorName(user),
        createdByRole: user?.role || null,
        title,
        description: String(data.description || '').trim() || null,
        goalsSummary: String(data.goalsSummary || '').trim() || null,
        recommendedTraining: String(data.recommendedTraining || '').trim() || null,
        startDate,
        targetEndDate,
        status: 'ACTIVE',
        progressPercent,
        checkpoints,
        documentedConcerns,
        improvementTargets: planCategory === 'PIP' ? improvementTargets : undefined,
        reviewFrequency: planCategory === 'PIP' ? reviewFrequency : null,
        reviewSchedule: planCategory === 'PIP' ? reviewSchedule : undefined,
        managerEvaluations: planCategory === 'PIP' ? [] : undefined
      },
      include: {
        employee: { select: getEmployeeInclude() },
        mentor: { select: getEmployeeInclude() }
      }
    })

    await this._writeAudit(
      user,
      'CREATE',
      'DevelopmentPlan',
      created.id,
      null,
      {
        planCode: created.planCode,
        planCategory,
        employeeCode: target.employeeCode,
        status: created.status
      },
      `Created ${planCategory} (${created.planCode}) for ${target.employeeCode}`
    )

    return created
  }

  async updateDevelopmentPlan(id, data, user) {
    const existing = await prisma.developmentPlan.findUnique({
      where: { id },
      include: { employee: { select: getEmployeeInclude() } }
    })
    if (!existing) throw new AppError('Development plan not found', 404, 'NOT_FOUND')

    if (existing.closedAt || ['COMPLETED_SUCCESS', 'CLOSED_UNMET', 'CANCELLED'].includes(existing.status)) {
      throw new AppError('Closed plans cannot be modified', 400, 'PLAN_CLOSED')
    }

    const isSelf = Boolean(user?.employeeId && existing.employeeId === user.employeeId)
    this._assertDepartmentScope(user, existing.employee, { allowOwnRecord: true })

    // Employees may ONLY update progress / milestone checkpoints on their own plan
    if (user?.role === 'EMPLOYEE' || (isSelf && !this._isAdmin(user))) {
      if (!isSelf) throw new AppError('Access denied', 403, 'FORBIDDEN')
      const forbiddenFields = [
        'documentedConcerns',
        'mentorId',
        'startDate',
        'targetEndDate',
        'closureOutcome',
        'closureNotes',
        'status',
        'planCategory'
      ]
      for (const f of forbiddenFields) {
        if (data[f] !== undefined) {
          throw new AppError(`Employees cannot modify governance field '${f}'`, 403, 'FORBIDDEN_FIELD_EDIT')
        }
      }

      const empUpdate = {}
      if (Array.isArray(data.checkpoints)) {
        empUpdate.checkpoints = this._normalizeCheckpoints(data.checkpoints)
        empUpdate.progressPercent = this._computeCheckpointsProgress(empUpdate.checkpoints, existing.progressPercent)
      } else if (data.progressPercent !== undefined && existing.planCategory === 'IDP') {
        empUpdate.progressPercent = Math.min(100, Math.max(0, Number(data.progressPercent) || 0))
      }

      if (existing.planCategory === 'IDP' && empUpdate.progressPercent > 0 && existing.status === 'ACTIVE') {
        empUpdate.status = 'IN_PROGRESS'
      }

      const updated = await prisma.developmentPlan.update({
        where: { id },
        data: empUpdate,
        include: {
          employee: { select: getEmployeeInclude() },
          mentor: { select: getEmployeeInclude() }
        }
      })

      await this._writeAudit(
        user,
        'PROGRESS_UPDATE',
        'DevelopmentPlan',
        id,
        { progressPercent: existing.progressPercent, status: existing.status },
        { progressPercent: updated.progressPercent, status: updated.status },
        `Updated milestone progress (${updated.progressPercent}%) on ${existing.planCode}`
      )
      return updated
    }

    // Manager / HR / Super Admin full edit (excluding silent status close)
    const updateData = {}
    if (data.title !== undefined) {
      const t = String(data.title).trim()
      if (!t) throw new AppError('Title cannot be empty', 400, 'VALIDATION_FAILED')
      updateData.title = t
    }
    if (data.description !== undefined) updateData.description = String(data.description).trim() || null
    if (data.goalsSummary !== undefined) updateData.goalsSummary = String(data.goalsSummary).trim() || null
    if (data.recommendedTraining !== undefined) updateData.recommendedTraining = String(data.recommendedTraining).trim() || null

    if (data.mentorId !== undefined) {
      if (!data.mentorId) {
        updateData.mentorId = null
      } else {
        const mentor = await this._resolveEmployee(data.mentorId)
        if (!mentor) throw new AppError('Selected mentor not found', 404, 'MENTOR_NOT_FOUND')
        updateData.mentorId = mentor.id
      }
    }

    const startDate = data.startDate !== undefined ? normalizeDateInput(data.startDate) : existing.startDate
    const targetEndDate = data.targetEndDate !== undefined ? normalizeDateInput(data.targetEndDate) : existing.targetEndDate
    if (startDate && targetEndDate && startDate > targetEndDate) {
      throw new AppError('Start date must be on or before target deadline', 400, 'INVALID_DATE_RANGE')
    }
    if (data.startDate !== undefined) updateData.startDate = startDate
    if (data.targetEndDate !== undefined) updateData.targetEndDate = targetEndDate

    if (Array.isArray(data.checkpoints)) {
      updateData.checkpoints = this._normalizeCheckpoints(data.checkpoints)
      updateData.progressPercent = this._computeCheckpointsProgress(updateData.checkpoints, data.progressPercent ?? existing.progressPercent)
    } else if (data.progressPercent !== undefined) {
      updateData.progressPercent = Math.min(100, Math.max(0, Number(data.progressPercent) || 0))
    }

    if (existing.planCategory === 'PIP') {
      if (data.documentedConcerns !== undefined) {
        const c = String(data.documentedConcerns).trim()
        if (!c) throw new AppError('Documented concerns cannot be empty on a PIP', 400, 'VALIDATION_FAILED')
        updateData.documentedConcerns = c
      }
      if (Array.isArray(data.improvementTargets)) {
        const targets = this._normalizeImprovementTargets(data.improvementTargets)
        if (targets.length === 0) throw new AppError('PIP must keep at least one improvement target', 400, 'VALIDATION_FAILED')
        updateData.improvementTargets = targets
      }
      if (data.reviewFrequency !== undefined) {
        const freq = String(data.reviewFrequency).toUpperCase()
        if (!VALID_REVIEW_FREQUENCIES.includes(freq)) throw new AppError('Invalid review frequency', 400, 'VALIDATION_FAILED')
        updateData.reviewFrequency = freq
      }
      if (Array.isArray(data.reviewSchedule)) {
        updateData.reviewSchedule = this._normalizeReviewSchedule(data.reviewSchedule)
      }
    }

    const updated = await prisma.developmentPlan.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: getEmployeeInclude() },
        mentor: { select: getEmployeeInclude() }
      }
    })

    await this._writeAudit(
      user,
      'UPDATE',
      'DevelopmentPlan',
      id,
      { title: existing.title, progressPercent: existing.progressPercent, status: existing.status },
      { title: updated.title, progressPercent: updated.progressPercent, status: updated.status },
      `Updated ${existing.planCategory} ${existing.planCode}`
    )

    return updated
  }

  async togglePlanCheckpoint(id, checkpointIndex, user) {
    const existing = await prisma.developmentPlan.findUnique({
      where: { id },
      include: { employee: { select: getEmployeeInclude() } }
    })
    if (!existing) throw new AppError('Development plan not found', 404, 'NOT_FOUND')
    if (existing.closedAt) throw new AppError('Cannot modify checkpoints on a closed plan', 400, 'PLAN_CLOSED')

    this._assertDepartmentScope(user, existing.employee, { allowOwnRecord: true })

    const checkpoints = Array.isArray(existing.checkpoints) ? [...existing.checkpoints] : []
    const idx = Number(checkpointIndex)
    if (!Number.isInteger(idx) || idx < 0 || idx >= checkpoints.length) {
      throw new AppError('Checkpoint index out of range', 400, 'VALIDATION_FAILED')
    }

    const targetCp = { ...checkpoints[idx] }
    targetCp.completed = !targetCp.completed
    targetCp.completedAt = targetCp.completed ? new Date().toISOString() : null
    targetCp.completedBy = targetCp.completed ? this._getActorName(user) : null
    checkpoints[idx] = targetCp

    const progressPercent = this._computeCheckpointsProgress(checkpoints, existing.progressPercent)

    let nextStatus = existing.status
    if (existing.planCategory === 'IDP') {
      if (progressPercent === 100) nextStatus = 'COMPLETED'
      else if (progressPercent > 0) nextStatus = 'IN_PROGRESS'
      else nextStatus = 'ACTIVE'
    } else if (existing.planCategory === 'PIP' && progressPercent > 0 && existing.status === 'ACTIVE') {
      nextStatus = 'UNDER_REVIEW'
    }

    const updated = await prisma.developmentPlan.update({
      where: { id },
      data: { checkpoints, progressPercent, status: nextStatus },
      include: {
        employee: { select: getEmployeeInclude() },
        mentor: { select: getEmployeeInclude() }
      }
    })

    await this._writeAudit(
      user,
      'CHECKPOINT_TOGGLE',
      'DevelopmentPlan',
      id,
      { checkpoint: existing.checkpoints[idx]?.title, completed: existing.checkpoints[idx]?.completed },
      { checkpoint: targetCp.title, completed: targetCp.completed, progressPercent },
      `Marked milestone "${targetCp.title}" ${targetCp.completed ? 'completed' : 'incomplete'} on ${existing.planCode}`
    )

    return updated
  }

  async addPlanEvaluation(id, data, user) {
    if (!this._isAdmin(user) && !this._isManagerOrLead(user)) {
      throw new AppError('Only authorized managers or HR/Admins can submit PIP/plan evaluations', 403, 'FORBIDDEN')
    }

    const existing = await prisma.developmentPlan.findUnique({
      where: { id },
      include: { employee: { select: getEmployeeInclude() } }
    })
    if (!existing) throw new AppError('Development plan not found', 404, 'NOT_FOUND')
    if (existing.closedAt) throw new AppError('Cannot evaluate a closed plan', 400, 'PLAN_CLOSED')

    if (!this._isSuperAdmin(user) && user?.employeeId && existing.employeeId === user.employeeId) {
      throw new AppError('Anti-self-approval: You cannot submit a manager evaluation on your own plan', 403, 'SELF_EVALUATION_FORBIDDEN')
    }

    this._assertDepartmentScope(user, existing.employee)

    const comments = String(data.comments || '').trim()
    if (!comments) throw new AppError('Evaluation comments are required', 400, 'VALIDATION_FAILED')

    const rating = data.rating !== undefined && data.rating !== null && data.rating !== ''
      ? Number(data.rating)
      : null
    if (rating !== null && (Number.isNaN(rating) || rating < 1 || rating > 5)) {
      throw new AppError('Evaluation rating must be between 1.0 and 5.0', 400, 'INVALID_SCORE')
    }

    const evaluations = Array.isArray(existing.managerEvaluations) ? [...existing.managerEvaluations] : []
    const entry = {
      id: `eval_${Date.now()}`,
      evaluatorUserId: user?.id || null,
      evaluatorEmployeeCode: user?.employee?.employeeCode || null,
      evaluatorName: this._getActorName(user),
      evaluatorRole: user?.role || null,
      reviewDate: data.reviewDate ? String(data.reviewDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      rating,
      progressAssessment: String(data.progressAssessment || 'ON_TRACK').toUpperCase(),
      comments,
      createdAt: new Date().toISOString()
    }
    evaluations.unshift(entry)

    // Optionally update improvement target statuses if sent
    let updatedTargets = existing.improvementTargets
    if (Array.isArray(data.improvementTargets) && existing.planCategory === 'PIP') {
      const normalized = this._normalizeImprovementTargets(data.improvementTargets)
      if (normalized.length > 0) updatedTargets = normalized
    }

    const updated = await prisma.developmentPlan.update({
      where: { id },
      data: {
        managerEvaluations: evaluations,
        improvementTargets: updatedTargets,
        status: existing.planCategory === 'PIP' ? 'UNDER_REVIEW' : existing.status
      },
      include: {
        employee: { select: getEmployeeInclude() },
        mentor: { select: getEmployeeInclude() }
      }
    })

    await this._writeAudit(
      user,
      'MANAGER_EVALUATION',
      'DevelopmentPlan',
      id,
      { status: existing.status },
      { status: updated.status, evaluation: entry },
      `Submitted manager review on ${existing.planCode} (${entry.progressAssessment})`
    )

    return updated
  }

  async acknowledgeDevelopmentPlan(id, data, user) {
    const existing = await prisma.developmentPlan.findUnique({
      where: { id },
      include: { employee: { select: getEmployeeInclude() } }
    })
    if (!existing) throw new AppError('Development plan not found', 404, 'NOT_FOUND')

    if (!user?.employeeId || existing.employeeId !== user.employeeId) {
      throw new AppError('Only the assigned employee can acknowledge their development plan / PIP', 403, 'FORBIDDEN')
    }

    const statement = data?.employeeStatement !== undefined
      ? String(data.employeeStatement).trim()
      : existing.employeeStatement

    const nextStatus = existing.planCategory === 'PIP' && existing.status === 'ACTIVE'
      ? 'ACKNOWLEDGED'
      : existing.status

    const updated = await prisma.developmentPlan.update({
      where: { id },
      data: {
        employeeAcknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedById: user.id,
        employeeStatement: statement || null,
        status: nextStatus
      },
      include: {
        employee: { select: getEmployeeInclude() },
        mentor: { select: getEmployeeInclude() }
      }
    })

    await this._writeAudit(
      user,
      'ACKNOWLEDGE',
      'DevelopmentPlan',
      id,
      { employeeAcknowledged: existing.employeeAcknowledged, status: existing.status },
      { employeeAcknowledged: true, status: updated.status, acknowledgedAt: updated.acknowledgedAt },
      `Employee ${existing.employee.employeeCode} acknowledged ${existing.planCode}`
    )

    return updated
  }

  async closeDevelopmentPlan(id, data, user) {
    if (!this._isAdmin(user) && user?.role !== 'DEPT_MANAGER') {
      throw new AppError('Only Super Admin, HR Admin, or Department Managers can approve closure of plans/PIPs', 403, 'FORBIDDEN')
    }

    const existing = await prisma.developmentPlan.findUnique({
      where: { id },
      include: { employee: { select: getEmployeeInclude() } }
    })
    if (!existing) throw new AppError('Development plan not found', 404, 'NOT_FOUND')
    if (existing.closedAt) throw new AppError('Plan is already closed', 400, 'ALREADY_CLOSED')

    if (!this._isSuperAdmin(user) && user?.employeeId && existing.employeeId === user.employeeId) {
      throw new AppError('Anti-self-approval: You cannot approve or close your own plan or PIP', 403, 'SELF_CLOSURE_FORBIDDEN')
    }

    this._assertDepartmentScope(user, existing.employee)

    const closureOutcome = String(data.closureOutcome || (existing.planCategory === 'IDP' ? 'SUCCESSFULLY_COMPLETED' : '')).toUpperCase()
    const closureNotes = String(data.closureNotes || '').trim()

    if (!closureOutcome || !VALID_PIP_OUTCOMES.includes(closureOutcome)) {
      throw new AppError(`Valid closure outcome is required (${VALID_PIP_OUTCOMES.join(', ')})`, 400, 'VALIDATION_FAILED')
    }
    if (!closureNotes) {
      throw new AppError('Closure rationale / outcome notes are required', 400, 'VALIDATION_FAILED')
    }

    let finalStatus = 'COMPLETED'
    if (existing.planCategory === 'PIP') {
      if (closureOutcome === 'SUCCESSFULLY_COMPLETED') finalStatus = 'COMPLETED_SUCCESS'
      else if (closureOutcome === 'EXTENDED') finalStatus = 'EXTENDED'
      else if (closureOutcome === 'UNMET_ESCALATED') finalStatus = 'ESCALATED_TERMINATION'
      else if (closureOutcome === 'CANCELLED') finalStatus = 'CANCELLED'
      else finalStatus = 'CLOSED_UNMET'
    } else {
      finalStatus = closureOutcome === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED'
    }

    const isExtended = existing.planCategory === 'PIP' && closureOutcome === 'EXTENDED'

    const updated = await prisma.developmentPlan.update({
      where: { id },
      data: {
        status: finalStatus,
        closureOutcome,
        closureNotes,
        closedAt: isExtended ? null : new Date(),
        targetEndDate: isExtended && data.extendedEndDate ? normalizeDateInput(data.extendedEndDate) : existing.targetEndDate,
        closedByUserId: user?.id || null,
        closedByEmployeeCode: user?.employee?.employeeCode || null,
        closedByName: this._getActorName(user),
        progressPercent: closureOutcome === 'SUCCESSFULLY_COMPLETED' ? 100 : existing.progressPercent
      },
      include: {
        employee: { select: getEmployeeInclude() },
        mentor: { select: getEmployeeInclude() }
      }
    })

    await this._writeAudit(
      user,
      'CLOSE',
      'DevelopmentPlan',
      id,
      { status: existing.status },
      { status: updated.status, closureOutcome, closureNotes, closedAt: updated.closedAt },
      `Closed ${existing.planCode} with outcome ${closureOutcome}: ${closureNotes}`
    )

    return updated
  }
}

export const feedbackDevelopmentService = new FeedbackDevelopmentService()
export default feedbackDevelopmentService

