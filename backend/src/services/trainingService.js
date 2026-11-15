/**
 * iSysware HRMS — Training & Development Backend Service
 * PostgreSQL-backed service implementing all 5 Training & Development submodules:
 * 1. Course Catalog & Programs (Create, Update, Archive, Toggle Status)
 * 2. Training Plans & Skill-Gap Recommendations (Recommend, Approve, Reject, Anti-Self-Approval)
 * 3. Cohorts & Training Scheduling (Schedule, Reschedule, Cancel, Attendance, Complete)
 * 4. Employee Learning Progress, Enrollments & Assessments
 * 5. Verified Certificates Register & Digital Verification
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { Prisma } from '@prisma/client'

export class TrainingService {
  _getActorContext(userOrId) {
    if (!userOrId) {
      return {
        userId: null,
        employeeId: null,
        departmentId: null,
        role: null,
        displayName: 'HR Admin'
      }
    }
    if (typeof userOrId === 'string') {
      return {
        userId: userOrId,
        employeeId: null,
        departmentId: null,
        role: null,
        displayName: 'Authorized Administrator'
      }
    }
    const emp = userOrId.employee || null
    const fullName = emp
      ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim()
      : null
    return {
      userId: userOrId.id || null,
      employeeId: userOrId.employeeId || emp?.id || null,
      departmentId: userOrId.departmentId || emp?.departmentId || null,
      role: userOrId.role || null,
      displayName: userOrId.name || fullName || userOrId.username || userOrId.email || 'Authorized User'
    }
  }

  _normalizeStringArray(val, fallback = []) {
    if (Array.isArray(val)) {
      return val.map((item) => String(item).trim()).filter(Boolean)
    }
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (!trimmed) return fallback
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean)
    }
    return fallback
  }

  _parseDurationHours(data) {
    if (data.durationHours !== undefined && data.durationHours !== null && data.durationHours !== '') {
      const n = Number(data.durationHours)
      if (Number.isFinite(n) && n > 0) return n
    }
    if (typeof data.duration === 'string') {
      const match = data.duration.match(/[\d.]+/)
      if (match) {
        const n = Number(match[0])
        if (Number.isFinite(n) && n > 0) return n
      }
    }
    return null
  }

  async _resolveProgram(idOrCode) {
    if (!idOrCode) return null
    return prisma.trainingProgram.findFirst({
      where: { OR: [{ id: idOrCode }, { courseCode: idOrCode }] },
      include: {
        department: true,
        _count: { select: { enrollments: true, sessions: true, plans: true } }
      }
    })
  }

  async _resolveEmployee(idOrCode) {
    if (!idOrCode) return null
    return prisma.employee.findFirst({
      where: { OR: [{ id: idOrCode }, { employeeCode: idOrCode }] },
      include: { department: true, designation: true }
    })
  }

  async _resolveDepartment(idOrCodeOrName) {
    if (!idOrCodeOrName || idOrCodeOrName === 'all') return null
    return prisma.department.findFirst({
      where: {
        OR: [
          { id: idOrCodeOrName },
          { code: idOrCodeOrName },
          { name: { equals: idOrCodeOrName, mode: 'insensitive' } }
        ]
      }
    })
  }

  async _generateSequentialCode(modelName, field, prefix, pad = 3) {
    const existing = await prisma[modelName].findMany({
      where: { [field]: { startsWith: prefix } },
      select: { [field]: true }
    })
    let maxNum = 0
    for (const row of existing) {
      const suffix = String(row[field] || '').slice(prefix.length)
      const parsed = parseInt(suffix.replace(/[^0-9]/g, ''), 10)
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed
      }
    }
    return `${prefix}${String(maxNum + 1).padStart(pad, '0')}`
  }

  async _generateCourseCode() {
    return this._generateSequentialCode('trainingProgram', 'courseCode', 'TRN-', 3)
  }

  async _generatePlanCode() {
    return this._generateSequentialCode('trainingPlan', 'planCode', 'PLAN-', 3)
  }

  async _generateSessionCode() {
    return this._generateSequentialCode('trainingSession', 'sessionCode', 'TRN-SES-', 3)
  }

  async _generateCertificateNumber() {
    const year = new Date().getFullYear()
    return this._generateSequentialCode('trainingEnrollment', 'certificateNumber', `CERT-${year}-`, 4)
  }

  async _generateVerificationCode() {
    for (let i = 0; i < 10; i++) {
      const part1 = Math.floor(1000 + Math.random() * 9000)
      const part2 = Math.floor(1000 + Math.random() * 9000)
      const code = `VRF-${part1}-${part2}`
      const exists = await prisma.trainingEnrollment.findUnique({ where: { verificationCode: code } })
      if (!exists) return code
    }
    return `VRF-${Date.now().toString().slice(-8)}`
  }

  async _logAudit(actor, action, entityType, entityId, description, metadata = null) {
    if (!actor?.userId) return
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorRole: actor.role || 'SYSTEM',
          sourceModule: 'TRAINING',
          actionType: action,
          entityName: entityType,
          entityId: String(entityId),
          recordSnapshotAfter: metadata ? { description, ...metadata } : { description },
          reasonOrNotes: description
        }
      })
    } catch {
      // Audit failures must not block business transactions
    }
  }

  // ============================================================================
  // 1. COURSE CATALOG & PROGRAMS
  // ============================================================================

  async getPrograms(filters = {}) {
    const where = {}
    if (filters.status && filters.status !== 'all') {
      where.status = { equals: filters.status, mode: 'insensitive' }
    }
    if (filters.category && filters.category !== 'all') {
      where.category = { equals: filters.category, mode: 'insensitive' }
    }
    if (filters.trainingType && filters.trainingType !== 'all') {
      where.trainingType = { equals: filters.trainingType, mode: 'insensitive' }
    }
    if (filters.departmentId && filters.departmentId !== 'all') {
      where.departmentId = filters.departmentId
    }

    return prisma.trainingProgram.findMany({
      where,
      include: {
        department: true,
        _count: { select: { enrollments: true, sessions: true, plans: true } }
      },
      orderBy: [{ createdAt: 'desc' }]
    })
  }

  async getProgramById(id) {
    const program = await prisma.trainingProgram.findFirst({
      where: { OR: [{ id }, { courseCode: id }] },
      include: {
        department: true,
        sessions: { orderBy: { startDate: 'desc' } },
        enrollments: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                departmentId: true
              }
            }
          }
        },
        _count: { select: { enrollments: true, sessions: true, plans: true } }
      }
    })
    if (!program) throw new AppError('Training program not found', 404, 'NOT_FOUND')
    return program
  }

  async createProgram(data, actorUser) {
    const actor = this._getActorContext(actorUser)
    const title = String(data.title || '').trim()
    const trainerName = String(data.trainerName ?? data.trainer ?? '').trim()
    const durationHours = this._parseDurationHours(data)
    const category = data.category !== undefined ? String(data.category).trim() : 'Technical'
    const trainingType = data.trainingType !== undefined ? String(data.trainingType).trim() : 'Internal'

    if (!title || !trainerName || !Number.isFinite(durationHours) || durationHours <= 0) {
      throw new AppError(
        'Title, Trainer Name, and valid Duration Hours are required',
        400,
        'VALIDATION_FAILED'
      )
    }

    if (data.courseCode) {
      const codeMatch = await prisma.trainingProgram.findUnique({ where: { courseCode: String(data.courseCode).trim() } })
      if (codeMatch) {
        throw new AppError(`Course code '${data.courseCode}' already exists`, 409, 'DUPLICATE_COURSE_CODE')
      }
    }

    const dupProgram = await prisma.trainingProgram.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        trainerName: { equals: trainerName, mode: 'insensitive' },
        status: { not: 'Archived' }
      }
    })
    if (dupProgram) {
      throw new AppError(`Course '${title}' with trainer '${trainerName}' already exists (${dupProgram.courseCode})`, 409, 'DUPLICATE_PROGRAM')
    }

    let departmentId = null
    if (data.departmentId && data.departmentId !== 'all') {
      const dept = await this._resolveDepartment(data.departmentId)
      departmentId = dept ? dept.id : null
    }

    const courseCode = data.courseCode ? String(data.courseCode).trim() : await this._generateCourseCode()
    const skills = this._normalizeStringArray(data.skills, [])
    const eligibleDepartments = this._normalizeStringArray(data.eligibleDepartments, ['all'])
    const eligibleDesignations = this._normalizeStringArray(data.eligibleDesignations, ['all'])

    const created = await prisma.trainingProgram.create({
      data: {
        courseCode,
        title,
        description: data.description !== undefined && data.description !== null ? String(data.description).trim() : null,
        category: category || 'Technical',
        skills,
        eligibleDepartments: eligibleDepartments.length ? eligibleDepartments : ['all'],
        eligibleDesignations: eligibleDesignations.length ? eligibleDesignations : ['all'],
        trainingType: trainingType || 'Internal',
        departmentId,
        trainerName,
        durationHours: new Prisma.Decimal(durationHours.toFixed(1)),
        maxCapacity: Math.max(1, Number(data.maxParticipants || data.maxCapacity) || 20),
        passingScore: Math.min(100, Math.max(1, Number(data.passingScore) || 70)),
        prerequisites: data.prerequisites !== undefined && data.prerequisites !== null ? String(data.prerequisites).trim() : '',
        materials: data.materials !== undefined && data.materials !== null ? String(data.materials).trim() : '',
        costPerParticipant: new Prisma.Decimal((Number(data.costPerParticipant ?? data.estimatedCost) || 0).toFixed(2)),
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : new Date(Date.now() + 30 * 86400000),
        location: data.location || trainingType || 'ONLINE_VIRTUAL',
        status: data.status || 'Active',
        createdByName: actor.displayName,
        updatedByName: actor.displayName
      },
      include: {
        department: true,
        _count: { select: { enrollments: true, sessions: true, plans: true } }
      }
    })

    await this._logAudit(actor, 'CREATE', 'TrainingProgram', created.id, `Created program ${created.courseCode}: ${created.title}`)
    return created
  }

  async updateProgram(id, data, actorUser) {
    const actor = this._getActorContext(actorUser)
    const existing = await this._resolveProgram(id)
    if (!existing) throw new AppError('Training program not found', 404, 'NOT_FOUND')

    const updateData = { updatedByName: actor.displayName }

    if (data.title !== undefined) {
      const t = String(data.title).trim()
      if (!t) throw new AppError('Training title cannot be empty', 400, 'VALIDATION_FAILED')
      updateData.title = t
    }
    if (data.description !== undefined) {
      updateData.description = data.description !== null ? String(data.description).trim() : null
    }
    if (data.category !== undefined) {
      const cat = String(data.category).trim()
      if (!cat) throw new AppError('Course category cannot be empty', 400, 'VALIDATION_FAILED')
      updateData.category = cat
    }
    if (data.skills !== undefined) updateData.skills = this._normalizeStringArray(data.skills, [])
    if (data.eligibleDepartments !== undefined) {
      const depts = this._normalizeStringArray(data.eligibleDepartments, ['all'])
      updateData.eligibleDepartments = depts.length ? depts : ['all']
    }
    if (data.eligibleDesignations !== undefined) {
      const desigs = this._normalizeStringArray(data.eligibleDesignations, ['all'])
      updateData.eligibleDesignations = desigs.length ? desigs : ['all']
    }
    if (data.trainingType !== undefined) {
      const tt = String(data.trainingType).trim()
      if (!tt) throw new AppError('Training type cannot be empty', 400, 'VALIDATION_FAILED')
      updateData.trainingType = tt
    }
    if (data.trainerName !== undefined || data.trainer !== undefined) {
      const tr = String(data.trainerName ?? data.trainer ?? '').trim()
      if (!tr) throw new AppError('Trainer name cannot be empty', 400, 'VALIDATION_FAILED')
      updateData.trainerName = tr
    }
    const parsedDuration = this._parseDurationHours(data)
    if (data.durationHours !== undefined || data.duration !== undefined) {
      if (!parsedDuration || parsedDuration <= 0) {
        throw new AppError('Valid duration hours greater than 0 are required', 400, 'VALIDATION_FAILED')
      }
      updateData.durationHours = new Prisma.Decimal(parsedDuration.toFixed(1))
    }
    if (data.maxParticipants !== undefined || data.maxCapacity !== undefined) {
      const cap = Number(data.maxParticipants ?? data.maxCapacity)
      if (!Number.isFinite(cap) || cap < 1) {
        throw new AppError('Max participant capacity must be at least 1', 400, 'VALIDATION_FAILED')
      }
      updateData.maxCapacity = Math.round(cap)
    }
    if (data.passingScore !== undefined) {
      updateData.passingScore = Math.min(100, Math.max(1, Number(data.passingScore) || 70))
    }
    if (data.prerequisites !== undefined) {
      updateData.prerequisites = data.prerequisites !== null ? String(data.prerequisites).trim() : ''
    }
    if (data.materials !== undefined) {
      updateData.materials = data.materials !== null ? String(data.materials).trim() : ''
    }
    if (data.costPerParticipant !== undefined || data.estimatedCost !== undefined) {
      const cost = Number(data.costPerParticipant ?? data.estimatedCost)
      if (!Number.isFinite(cost) || cost < 0) {
        throw new AppError('Cost per participant cannot be negative', 400, 'VALIDATION_FAILED')
      }
      updateData.costPerParticipant = new Prisma.Decimal(cost.toFixed(2))
    }
    if (data.status !== undefined) {
      const allowedStatuses = ['Active', 'Planned', 'Draft', 'Archived', 'ACTIVE', 'PLANNED', 'DRAFT', 'ARCHIVED']
      if (!allowedStatuses.includes(data.status)) {
        throw new AppError(`Invalid course status '${data.status}'`, 400, 'VALIDATION_FAILED')
      }
      updateData.status = data.status
    }
    if (data.startDate !== undefined && data.startDate) {
      updateData.startDate = new Date(data.startDate)
    }
    if (data.endDate !== undefined && data.endDate) {
      updateData.endDate = new Date(data.endDate)
    }
    if (data.location !== undefined) updateData.location = String(data.location)
    if (data.departmentId !== undefined) {
      if (!data.departmentId || data.departmentId === 'all') {
        updateData.departmentId = null
      } else {
        const dept = await this._resolveDepartment(data.departmentId)
        updateData.departmentId = dept ? dept.id : null
      }
    }

    const nextTitle = updateData.title || existing.title
    const nextTrainer = updateData.trainerName || existing.trainerName
    const dupCheck = await prisma.trainingProgram.findFirst({
      where: {
        id: { not: existing.id },
        title: { equals: nextTitle, mode: 'insensitive' },
        trainerName: { equals: nextTrainer, mode: 'insensitive' },
        status: { not: 'Archived' }
      }
    })
    if (dupCheck) {
      throw new AppError(`Another active course '${nextTitle}' with trainer '${nextTrainer}' already exists (${dupCheck.courseCode})`, 409, 'DUPLICATE_PROGRAM')
    }

    const updated = await prisma.trainingProgram.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        department: true,
        _count: { select: { enrollments: true, sessions: true, plans: true } }
      }
    })

    await this._logAudit(actor, 'UPDATE', 'TrainingProgram', updated.id, `Updated program ${updated.courseCode}: ${updated.title}`, {
      previousStatus: existing.status,
      newStatus: updated.status
    })
    return updated
  }

  async archiveProgram(id, actorUser) {
    const actor = this._getActorContext(actorUser)
    const existing = await this._resolveProgram(id)
    if (!existing) throw new AppError('Training program not found', 404, 'NOT_FOUND')

    const updated = await prisma.trainingProgram.update({
      where: { id: existing.id },
      data: { status: 'Archived', updatedByName: actor.displayName },
      include: { department: true, _count: { select: { enrollments: true, sessions: true, plans: true } } }
    })

    await this._logAudit(actor, 'ARCHIVE', 'TrainingProgram', updated.id, `Archived program ${updated.courseCode}: ${updated.title}`)
    return updated
  }

  async toggleProgramStatus(id, actorUser) {
    const actor = this._getActorContext(actorUser)
    const existing = await this._resolveProgram(id)
    if (!existing) throw new AppError('Training program not found', 404, 'NOT_FOUND')

    const isCurrentlyActive = existing.status === 'Active' || existing.status === 'ACTIVE'
    const nextStatus = isCurrentlyActive ? 'Draft' : 'Active'

    const updated = await prisma.trainingProgram.update({
      where: { id: existing.id },
      data: { status: nextStatus, updatedByName: actor.displayName },
      include: { department: true, _count: { select: { enrollments: true, sessions: true, plans: true } } }
    })

    await this._logAudit(actor, 'STATUS_CHANGE', 'TrainingProgram', updated.id, `Changed program ${updated.courseCode} status from ${existing.status} to ${nextStatus}`)
    return updated
  }

  // ============================================================================
  // 2. TRAINING PLANS & SKILL-GAP RECOMMENDATIONS
  // ============================================================================

  async getPlans(filters = {}, user = null) {
    const actor = this._getActorContext(user)
    const where = {}

    if (filters.status && filters.status !== 'all') where.status = filters.status
    if (filters.planType && filters.planType !== 'all') where.planType = filters.planType
    if (filters.programId && filters.programId !== 'all') where.programId = filters.programId

    if (actor.role === 'EMPLOYEE') {
      where.OR = [
        ...(actor.employeeId ? [{ targetEmployeeId: actor.employeeId }] : []),
        ...(actor.userId ? [{ recommendedById: actor.userId }] : [])
      ]
      if (!where.OR.length) return []
    } else if (actor.role === 'DEPT_MANAGER') {
      const deptConditions = []
      if (actor.departmentId) {
        deptConditions.push({ targetDepartmentId: actor.departmentId })
        deptConditions.push({ targetEmployee: { departmentId: actor.departmentId } })
      }
      if (actor.userId) {
        deptConditions.push({ recommendedById: actor.userId })
      }
      if (deptConditions.length) {
        where.OR = deptConditions
      }
    }

    return prisma.trainingPlan.findMany({
      where,
      include: {
        program: true,
        targetDepartment: true,
        targetEmployee: {
          include: { department: true, designation: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async createTrainingPlan(data, user) {
    const actor = this._getActorContext(user)
    const title = String(
      data.title ||
      (data.reasonForTraining ? `${data.employeeName || 'Employee'} — ${data.reasonForTraining}` : '')
    ).trim()
    const justification = String(data.justification || data.reasonForTraining || '').trim()

    if (!title) {
      throw new AppError('Training plan title is required', 400, 'VALIDATION_FAILED')
    }
    if (!data.programId) {
      throw new AppError('Target training program must be selected', 400, 'VALIDATION_FAILED')
    }
    if (!justification || justification.length < 5) {
      throw new AppError('Audit justification (min 5 characters) is required', 400, 'VALIDATION_FAILED')
    }

    const program = await this._resolveProgram(data.programId)
    if (!program) {
      throw new AppError('Selected training program does not exist', 404, 'NOT_FOUND')
    }

    let targetEmployeeId = null
    let inferredDeptId = null
    if (actor.role === 'EMPLOYEE') {
      if (!actor.employeeId) {
        throw new AppError('Employee profile missing for user account', 400, 'VALIDATION_FAILED')
      }
      targetEmployeeId = actor.employeeId
      inferredDeptId = actor.departmentId
    } else {
      const empKey = data.targetEmployeeId || data.employeeId
      if (empKey && (data.planType === 'Individual' || !data.planType || empKey)) {
        if (data.planType === 'Individual' || !data.planType) {
          const employee = await this._resolveEmployee(empKey)
          if (!employee) {
            throw new AppError('Target employee not found', 404, 'NOT_FOUND')
          }
          if (actor.role === 'DEPT_MANAGER' && actor.departmentId && employee.departmentId !== actor.departmentId) {
            throw new AppError('Managers can only recommend training plans for employees in their own department', 403, 'FORBIDDEN')
          }
          targetEmployeeId = employee.id
          inferredDeptId = employee.departmentId
        }
      }
    }

    let targetDepartmentId = inferredDeptId
    if (data.targetDepartmentId && data.targetDepartmentId !== 'all') {
      const dept = await this._resolveDepartment(data.targetDepartmentId)
      if (dept) targetDepartmentId = dept.id
    } else if (actor.role === 'DEPT_MANAGER' && actor.departmentId && !targetDepartmentId) {
      targetDepartmentId = actor.departmentId
    }

    const isHrOrSuper = actor.role === 'SUPER_ADMIN' || actor.role === 'HR_ADMIN'
    let status = 'Pending HR Review'
    if (actor.role === 'DEPT_MANAGER') {
      status = 'Recommended'
    } else if (isHrOrSuper) {
      status = data.status === 'Pending HR Review' || data.status === 'Recommended' ? data.status : 'Approved'
    }

    const planCode = await this._generatePlanCode()

    const created = await prisma.trainingPlan.create({
      data: {
        planCode,
        title,
        planType: data.planType || 'Individual',
        programId: program.id,
        targetDepartmentId,
        targetEmployeeId,
        isMandatory: Boolean(data.isMandatory),
        skillsGapSource: String(data.skillsGapSource || 'Manager Recommendation').trim(),
        justification,
        priority: data.priority || 'Medium',
        targetQuarter: data.targetQuarter || 'Q4 2026',
        status,
        recommendedById: actor.userId,
        recommendedByName: actor.displayName,
        approvedById: status === 'Approved' ? actor.userId : null,
        approvedByName: status === 'Approved' ? actor.displayName : null,
        approvedAt: status === 'Approved' ? new Date() : null,
        decisionRemarks: status === 'Approved' ? 'Approved on creation by HR/Admin' : null
      },
      include: {
        program: true,
        targetDepartment: true,
        targetEmployee: {
          include: { department: true, designation: true }
        }
      }
    })

    // Auto-enroll employee if approved immediately and an active session exists
    if (created.status === 'Approved' && created.targetEmployeeId) {
      const scheduledSession = await prisma.trainingSession.findFirst({
        where: { programId: created.programId, status: 'Scheduled' },
        orderBy: { startDate: 'asc' }
      })
      if (scheduledSession) {
        try {
          await this.enrollEmployee(created.programId, created.targetEmployeeId, user, { sessionId: scheduledSession.id })
          await prisma.trainingPlan.update({
            where: { id: created.id },
            data: { enrolledCount: { increment: 1 } }
          })
          created.enrolledCount += 1
        } catch {
          // Capacity or existing enrollment does not fail plan creation
        }
      }
    }

    await this._logAudit(actor, 'CREATE', 'TrainingPlan', created.id, `Created training plan ${created.title}`)
    return created
  }

  async approveTrainingPlan(id, { remarks } = {}, user) {
    const actor = this._getActorContext(user)
    const plan = await prisma.trainingPlan.findFirst({
      where: { OR: [{ id }, { planCode: id }] }
    })
    if (!plan) throw new AppError('Training plan not found', 404, 'NOT_FOUND')

    // Anti-self-approval safeguard (bypassed for SUPER_ADMIN universal authority)
    const isSuperAdmin = String(user?.role || '').toUpperCase() === 'SUPER_ADMIN'
    if (
      !isSuperAdmin &&
      plan.recommendedById &&
      actor.userId &&
      plan.recommendedById === actor.userId &&
      plan.targetEmployeeId &&
      actor.employeeId &&
      plan.targetEmployeeId === actor.employeeId
    ) {
      throw new AppError('Anti-Self-Approval: You cannot approve your own training plan request', 403, 'SELF_APPROVAL_FORBIDDEN')
    }

    let enrolledIncrement = 0
    if (plan.targetEmployeeId) {
      const scheduledSession = await prisma.trainingSession.findFirst({
        where: { programId: plan.programId, status: 'Scheduled' },
        orderBy: { startDate: 'asc' }
      })
      if (scheduledSession) {
        try {
          await this.enrollEmployee(plan.programId, plan.targetEmployeeId, user, { sessionId: scheduledSession.id })
          enrolledIncrement = 1
        } catch {
          // Ignore if already enrolled or at capacity
        }
      }
    }

    const updated = await prisma.trainingPlan.update({
      where: { id: plan.id },
      data: {
        status: 'Approved',
        approvedById: actor.userId,
        approvedByName: actor.displayName,
        approvedAt: new Date(),
        decisionRemarks: remarks || 'Approved',
        enrolledCount: plan.enrolledCount + enrolledIncrement
      },
      include: {
        program: true,
        targetDepartment: true,
        targetEmployee: {
          include: { department: true, designation: true }
        }
      }
    })

    await this._logAudit(actor, 'APPROVE', 'TrainingPlan', updated.id, `Approved training plan ${updated.title}`)
    return updated
  }

  async rejectTrainingPlan(id, { reason } = {}, user) {
    const actor = this._getActorContext(user)
    const plan = await prisma.trainingPlan.findFirst({
      where: { OR: [{ id }, { planCode: id }] }
    })
    if (!plan) throw new AppError('Training plan not found', 404, 'NOT_FOUND')

    const updated = await prisma.trainingPlan.update({
      where: { id: plan.id },
      data: {
        status: 'Rejected',
        approvedById: actor.userId,
        approvedByName: actor.displayName,
        approvedAt: new Date(),
        decisionRemarks: reason || 'Declined under review authority'
      },
      include: {
        program: true,
        targetDepartment: true,
        targetEmployee: {
          include: { department: true, designation: true }
        }
      }
    })

    await this._logAudit(actor, 'REJECT', 'TrainingPlan', updated.id, `Rejected training plan ${updated.title}`)
    return updated
  }

  // ============================================================================
  // 3. COHORTS & TRAINING SESSIONS
  // ============================================================================

  async getSessions(filters = {}) {
    const where = {}
    if (filters.programId && filters.programId !== 'all') where.programId = filters.programId
    if (filters.status && filters.status !== 'all') where.status = filters.status

    return prisma.trainingSession.findMany({
      where,
      include: {
        program: true,
        enrollments: {
          include: {
            employee: {
              include: { department: true, designation: true }
            }
          }
        },
        _count: { select: { enrollments: true } }
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }]
    })
  }

  async scheduleSession(data, user) {
    const actor = this._getActorContext(user)
    const program = await this._resolveProgram(data.programId)
    if (!program) throw new AppError('Invalid training program', 404, 'NOT_FOUND')
    if (program.status === 'Archived') {
      throw new AppError('Cannot schedule sessions for an archived course catalog item', 400, 'PROGRAM_ARCHIVED')
    }

    const trainerName = String(data.trainer || data.trainerName || program.trainerName || '').trim()
    if (!trainerName) throw new AppError('Trainer specification is required', 400, 'VALIDATION_FAILED')

    if (!data.startDate || !data.endDate) {
      throw new AppError('Start and end dates are required', 400, 'VALIDATION_FAILED')
    }
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new AppError('Invalid session dates provided', 400, 'VALIDATION_FAILED')
    }
    if (start > end) {
      throw new AppError('Start date cannot be after end date', 400, 'VALIDATION_FAILED')
    }

    const startTime = String(data.startTime || '14:00')
    const endTime = String(data.endTime || '17:00')
    const capacity = Math.max(1, Number(data.capacity || data.maxCapacity || program.maxCapacity) || 20)
    const participantIds = Array.isArray(data.participantIds) ? data.participantIds : []
    if (participantIds.length > capacity) {
      throw new AppError(`Participant count (${participantIds.length}) exceeds capacity (${capacity})`, 400, 'CAPACITY_REACHED')
    }

    // Trainer overlap validation on same start date
    const startIso = start.toISOString().slice(0, 10)
    const sameDaySessions = await prisma.trainingSession.findMany({
      where: {
        status: 'Scheduled',
        trainerName: { equals: trainerName, mode: 'insensitive' }
      }
    })
    const conflict = sameDaySessions.find((s) => {
      const sDate = new Date(s.startDate).toISOString().slice(0, 10)
      if (sDate !== startIso) return false
      return (
        (s.startTime <= startTime && startTime < s.endTime) ||
        (s.startTime < endTime && endTime <= s.endTime) ||
        s.startTime === startTime
      )
    })
    if (conflict) {
      throw new AppError(
        `Trainer ${trainerName} already has scheduled session '${conflict.sessionCode}' at ${startIso} ${conflict.startTime}`,
        409,
        'SCHEDULE_CONFLICT'
      )
    }

    const attendanceRecords = []
    for (const pId of participantIds) {
      const emp = await this._resolveEmployee(pId)
      if (emp) {
        attendanceRecords.push({
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
          department: emp.department?.name || 'General',
          attendanceStatus: 'Registered',
          status: 'Registered',
          attendedHours: 0,
          participationHours: 0,
          remarks: ''
        })
      }
    }

    const sessionCode = await this._generateSessionCode()
    const locationType = String(data.locationType || 'Online')
    const locationOrLink =
      data.locationOrLink ||
      (locationType === 'Online' ? 'https://meet.isysware.internal/training' : 'Main Training Room')

    const created = await prisma.trainingSession.create({
      data: {
        sessionCode,
        programId: program.id,
        sessionName: String(data.sessionName || program.title).trim(),
        trainerName,
        startDate: start,
        endDate: end,
        startTime,
        endTime,
        locationType,
        locationOrLink,
        capacity,
        status: 'Scheduled',
        notes: data.notes ? String(data.notes).trim() : null,
        attendanceRecords,
        scheduledByName: actor.displayName
      },
      include: {
        program: true,
        enrollments: true,
        _count: { select: { enrollments: true } }
      }
    })

    // Sync participant enrollments if provided
    for (const rec of attendanceRecords) {
      try {
        await this.enrollEmployee(program.id, rec.employeeId, user, { sessionId: created.id, skipSessionAppend: true })
      } catch {
        // Already enrolled or ineligible - leave attendance entry intact
      }
    }

    await this._logAudit(actor, 'CREATE', 'TrainingSession', created.id, `Scheduled session ${created.sessionCode}`)
    return created
  }

  async updateSession(id, data, user) {
    const actor = this._getActorContext(user)
    const session = await prisma.trainingSession.findFirst({
      where: { OR: [{ id }, { sessionCode: id }] }
    })
    if (!session) throw new AppError('Training session not found', 404, 'NOT_FOUND')
    if (session.status === 'Completed' || session.status === 'Cancelled') {
      throw new AppError(`Cannot reschedule or edit a ${session.status.toLowerCase()} training session`, 400, 'INVALID_STATUS')
    }

    const startDate = data.startDate ? new Date(data.startDate) : session.startDate
    const endDate = data.endDate ? new Date(data.endDate) : session.endDate
    if (startDate > endDate) {
      throw new AppError('Start date cannot be after end date', 400, 'VALIDATION_FAILED')
    }

    const updated = await prisma.trainingSession.update({
      where: { id: session.id },
      data: {
        trainerName: data.trainer || data.trainerName || undefined,
        startDate,
        endDate,
        startTime: data.startTime || undefined,
        endTime: data.endTime || undefined,
        locationType: data.locationType || undefined,
        locationOrLink: data.locationOrLink || undefined,
        capacity: data.capacity !== undefined ? Math.max(1, Number(data.capacity)) : undefined,
        notes: data.notes !== undefined ? data.notes : undefined
      },
      include: {
        program: true,
        enrollments: true,
        _count: { select: { enrollments: true } }
      }
    })

    await this._logAudit(actor, 'UPDATE', 'TrainingSession', updated.id, `Updated session ${updated.sessionCode}`)
    return updated
  }

  async recordSessionAttendance(sessionId, attendanceList, user) {
    const actor = this._getActorContext(user)
    const session = await prisma.trainingSession.findFirst({
      where: { OR: [{ id: sessionId }, { sessionCode: sessionId }] },
      include: { program: true, enrollments: true }
    })
    if (!session) throw new AppError('Training session not found', 404, 'NOT_FOUND')

    if (['Completed', 'Cancelled'].includes(session.status)) {
      throw new AppError(
        `Attendance cannot be recorded or modified for a ${session.status} cohort`,
        400,
        'INVALID_SESSION_STATUS'
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    const startDate = new Date(session.startDate).toISOString().slice(0, 10)
    if (startDate > today) {
      throw new AppError(
        'Attendance cannot be recorded before the cohort start date',
        400,
        'FUTURE_ATTENDANCE_NOT_ALLOWED'
      )
    }

    if (!Array.isArray(attendanceList) || attendanceList.length === 0) {
      throw new AppError('At least one participant attendance record is required', 400, 'VALIDATION_ERROR')
    }

    const ALLOWED_STATUSES = {
      present: 'Present',
      attended: 'Present',
      absent: 'Absent',
      excused: 'Excused',
      registered: 'Registered'
    }

    const existingRecords = Array.isArray(session.attendanceRecords) ? session.attendanceRecords : []
    const existingByEmp = new Map(existingRecords.map((r) => [r.employeeId, r]))
    const existingByCode = new Map(
      existingRecords.filter((r) => r.employeeCode).map((r) => [r.employeeCode, r])
    )

    const updatedByEmp = new Map(existingByEmp)

    for (const item of attendanceList) {
      const prev =
        existingByEmp.get(item.employeeId) ||
        existingByCode.get(item.employeeCode || item.employeeId) ||
        {}
      const resolvedEmp = !prev.employeeId && item.employeeId
        ? await this._resolveEmployee(item.employeeId)
        : null
      const canonicalEmployeeId = prev.employeeId || resolvedEmp?.id || item.employeeId
      if (!canonicalEmployeeId) {
        throw new AppError('Participant employeeId is required for attendance records', 400, 'VALIDATION_ERROR')
      }

      const rawStatus = item.attendanceStatus ?? item.status ?? prev.attendanceStatus ?? prev.status ?? 'Registered'
      const normalizedStatus = ALLOWED_STATUSES[String(rawStatus).trim().toLowerCase()]
      if (!normalizedStatus) {
        throw new AppError(
          `Invalid participation status "${rawStatus}". Allowed: Present, Absent, Excused, Registered`,
          400,
          'VALIDATION_ERROR'
        )
      }

      const rawHours =
        item.attendedHours !== undefined
          ? item.attendedHours
          : (item.participationHours !== undefined ? item.participationHours : (prev.attendedHours ?? 0))
      const hours = Number(rawHours)
      if (!Number.isFinite(hours) || hours < 0) {
        throw new AppError('Attended hours must be a non-negative number', 400, 'VALIDATION_ERROR')
      }

      const record = {
        employeeId: canonicalEmployeeId,
        employeeCode: item.employeeCode || prev.employeeCode || resolvedEmp?.employeeCode || '',
        employeeName:
          item.employeeName ||
          prev.employeeName ||
          (resolvedEmp ? `${resolvedEmp.firstName} ${resolvedEmp.lastName}`.trim() : 'Employee'),
        department: item.department || prev.department || resolvedEmp?.department?.name || '',
        attendanceStatus: normalizedStatus,
        status: normalizedStatus,
        attendedHours: hours,
        participationHours: hours,
        remarks: item.remarks !== undefined ? String(item.remarks).trim() : (prev.remarks ?? '')
      }
      updatedByEmp.set(canonicalEmployeeId, record)
    }

    const mapped = Array.from(updatedByEmp.values())

    const updated = await prisma.trainingSession.update({
      where: { id: session.id },
      data: {
        attendanceRecords: mapped,
        attendanceRecorded: true,
        attendanceRecordedBy: actor.displayName,
        attendanceRecordedAt: new Date(),
        status: session.status === 'Scheduled' ? 'In Progress' : session.status
      },
      include: {
        program: true,
        enrollments: true,
        _count: { select: { enrollments: true } }
      }
    })

    // Propagate attended hours to matching TrainingEnrollment rows
    for (const rec of mapped) {
      const present = rec.status === 'Present'
      if (!rec.employeeId) continue
      const enrollment = await prisma.trainingEnrollment.findUnique({
        where: { programId_employeeId: { programId: session.programId, employeeId: rec.employeeId } }
      })
      if (enrollment && !['COMPLETED', 'FAILED'].includes(enrollment.status)) {
        const nextStatus = present
          ? 'ATTENDED'
          : (enrollment.status === 'ATTENDED'
            ? (enrollment.progressPercent > 0 ? 'IN_PROGRESS' : 'ENROLLED')
            : enrollment.status)
        await prisma.trainingEnrollment.update({
          where: { id: enrollment.id },
          data: {
            sessionsAttendedCount: present
              ? Math.max(enrollment.sessionsAttendedCount || 0, 1)
              : (enrollment.status === 'ATTENDED' ? 0 : enrollment.sessionsAttendedCount),
            progressPercent: present ? Math.max(enrollment.progressPercent || 0, 50) : enrollment.progressPercent,
            status: nextStatus
          }
        })
      }
    }

    await this._logAudit(actor, 'ATTENDANCE', 'TrainingSession', updated.id, `Recorded attendance for ${updated.sessionCode}`)
    return updated
  }

  async markSessionCompleted(sessionId, user) {
    const actor = this._getActorContext(user)
    const session = await prisma.trainingSession.findFirst({
      where: { OR: [{ id: sessionId }, { sessionCode: sessionId }] },
      include: { enrollments: true }
    })
    if (!session) throw new AppError('Training session not found', 404, 'NOT_FOUND')

    if (session.status !== 'Scheduled' && session.status !== 'In Progress') {
      throw new AppError(
        'Only scheduled or in-progress cohorts can be completed',
        400,
        'INVALID_STATUS'
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    const endDate = new Date(session.endDate).toISOString().slice(0, 10)
    if (today < endDate) {
      throw new AppError(
        'Cannot complete a cohort before its end date',
        400,
        'COHORT_NOT_FINISHED'
      )
    }

    const roster = Array.isArray(session.attendanceRecords) ? session.attendanceRecords : []
    const hasParticipants = roster.length > 0 || (session.enrollments && session.enrollments.length > 0)
    if (hasParticipants && !session.attendanceRecorded) {
      throw new AppError(
        'Cohort attendance must be recorded before marking the cohort completed',
        400,
        'ATTENDANCE_REQUIRED'
      )
    }

    const updated = await prisma.trainingSession.update({
      where: { id: session.id },
      data: {
        status: 'Completed',
        completedByName: actor.displayName,
        completedAt: new Date()
      },
      include: {
        program: true,
        enrollments: true,
        _count: { select: { enrollments: true } }
      }
    })

    await this._logAudit(actor, 'COMPLETE', 'TrainingSession', updated.id, `Completed session ${updated.sessionCode}`)
    return updated
  }

  async cancelSession(sessionId, reason, user) {
    const actor = this._getActorContext(user)
    const session = await prisma.trainingSession.findFirst({
      where: { OR: [{ id: sessionId }, { sessionCode: sessionId }] }
    })
    if (!session) throw new AppError('Training session not found', 404, 'NOT_FOUND')

    if (['Completed', 'Cancelled'].includes(session.status)) {
      throw new AppError(
        `Cannot cancel a ${session.status.toLowerCase()} training cohort`,
        400,
        'INVALID_STATUS'
      )
    }

    const updated = await prisma.trainingSession.update({
      where: { id: session.id },
      data: {
        status: 'Cancelled',
        cancelReason: reason || 'Cancelled by administration',
        cancelledByName: actor.displayName,
        cancelledAt: new Date()
      },
      include: {
        program: true,
        enrollments: true,
        _count: { select: { enrollments: true } }
      }
    })

    await this._logAudit(actor, 'CANCEL', 'TrainingSession', updated.id, `Cancelled session ${updated.sessionCode}`)
    return updated
  }

  // ============================================================================
  // 4. ENROLLMENTS, PROGRESS, ASSESSMENTS & CERTIFICATES
  // ============================================================================

  async getEnrollments(filters = {}, user = null) {
    const actor = this._getActorContext(user)
    const where = {}

    if (filters.programId && filters.programId !== 'all') where.programId = filters.programId
    if (filters.sessionId && filters.sessionId !== 'all') where.sessionId = filters.sessionId
    if (filters.employeeId) where.employeeId = filters.employeeId
    if (filters.status && filters.status !== 'all') {
      where.status = { equals: filters.status, mode: 'insensitive' }
    }

    if (actor.role === 'EMPLOYEE') {
      if (!actor.employeeId) return []
      where.employeeId = actor.employeeId
    } else if (actor.role === 'DEPT_MANAGER' && actor.departmentId) {
      where.employee = { departmentId: actor.departmentId }
    }

    return prisma.trainingEnrollment.findMany({
      where,
      include: {
        program: true,
        session: true,
        employee: {
          include: { department: true, designation: true }
        }
      },
      orderBy: { enrolledAt: 'desc' }
    })
  }

  async enrollEmployee(programOrSessionId, employeeIdOrCode, userOrActorId, options = {}) {
    const actor = this._getActorContext(userOrActorId)
    let session = null
    if (options.sessionId) {
      session = await prisma.trainingSession.findFirst({
        where: { OR: [{ id: options.sessionId }, { sessionCode: options.sessionId }] }
      })
    }

    let program = programOrSessionId ? await this._resolveProgram(programOrSessionId) : null
    if (!program && programOrSessionId) {
      // Check if ID passed was actually a session ID
      const maybeSession = await prisma.trainingSession.findFirst({
        where: { OR: [{ id: programOrSessionId }, { sessionCode: programOrSessionId }] }
      })
      if (maybeSession) {
        session = maybeSession
        program = await this._resolveProgram(maybeSession.programId)
      }
    } else if (!program && session) {
      program = await this._resolveProgram(session.programId)
    }

    if (!program) throw new AppError('Training program not found', 404, 'NOT_FOUND')

    if (['Archived', 'Draft', 'Inactive'].includes(program.status)) {
      throw new AppError(`Cannot enroll in a program with status '${program.status}'`, 400, 'PROGRAM_INACTIVE')
    }

    const employee = await this._resolveEmployee(employeeIdOrCode)
    if (!employee) throw new AppError('Employee not found', 404, 'NOT_FOUND')

    if (actor.role === 'EMPLOYEE' && actor.employeeId && actor.employeeId !== employee.id) {
      throw new AppError('Employees can only enroll themselves', 403, 'FORBIDDEN')
    }
    if (actor.role === 'DEPT_MANAGER' && actor.departmentId && employee.departmentId !== actor.departmentId) {
      throw new AppError('Managers can only enroll employees from their own department', 403, 'FORBIDDEN')
    }

    // 1. Duplicate Prevention
    const existing = await prisma.trainingEnrollment.findUnique({
      where: { programId_employeeId: { programId: program.id, employeeId: employee.id } }
    })
    if (existing) {
      throw new AppError('Employee is already enrolled in this training program', 409, 'ALREADY_ENROLLED')
    }

    // 2. Capacity Enforcement
    if (program._count.enrollments >= program.maxCapacity) {
      throw new AppError(`Program reached maximum capacity of ${program.maxCapacity} participants`, 400, 'CAPACITY_REACHED')
    }

    // 3. Department Eligibility Enforcement
    if (program.departmentId && program.departmentId !== employee.departmentId) {
      throw new AppError('Employee is not eligible for this department-specific training', 400, 'INELIGIBLE_DEPARTMENT')
    }
    const eligibleDepts = Array.isArray(program.eligibleDepartments) ? program.eligibleDepartments : ['all']
    if (eligibleDepts.length > 0 && !eligibleDepts.map((d) => String(d).toLowerCase()).includes('all')) {
      const empDeptMatches = eligibleDepts.some((d) => {
        const dl = String(d).toLowerCase()
        return (
          dl === employee.departmentId?.toLowerCase() ||
          dl === employee.department?.name?.toLowerCase() ||
          dl === employee.department?.code?.toLowerCase()
        )
      })
      if (!empDeptMatches) {
        throw new AppError('Employee department does not meet program eligibility criteria', 400, 'INELIGIBLE_DEPARTMENT')
      }
    }

    const enrollment = await prisma.trainingEnrollment.create({
      data: {
        programId: program.id,
        sessionId: session?.id || null,
        employeeId: employee.id,
        status: 'ENROLLED',
        progressPercent: 0
      },
      include: {
        program: true,
        session: true,
        employee: { include: { department: true, designation: true } }
      }
    })

    // Keep session attendance roster in sync
    if (session && !options.skipSessionAppend) {
      const roster = Array.isArray(session.attendanceRecords) ? [...session.attendanceRecords] : []
      if (!roster.some((r) => r.employeeId === employee.id)) {
        roster.push({
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          department: employee.department?.name || 'General',
          attendanceStatus: 'Registered',
          status: 'Registered',
          attendedHours: 0,
          participationHours: 0,
          remarks: ''
        })
        await prisma.trainingSession.update({
          where: { id: session.id },
          data: { attendanceRecords: roster }
        })
      }
    }

    await this._logAudit(actor, 'ENROLL', 'TrainingEnrollment', enrollment.id, `Enrolled ${employee.employeeCode} in ${program.title}`)
    return enrollment
  }

  _getTrainingStartDate(enrollment) {
    const raw = enrollment.session?.startDate || enrollment.program?.startDate
    return raw ? new Date(raw).toISOString().slice(0, 10) : null
  }

  _getTrainingEndDate(enrollment) {
    const raw = enrollment.session?.endDate || enrollment.program?.endDate
    return raw ? new Date(raw).toISOString().slice(0, 10) : null
  }

  _assertTrainingStartedAndActive(enrollment, actionLabel, errorCode) {
    if (enrollment.status === 'CANCELLED' || enrollment.session?.status === 'Cancelled') {
      throw new AppError(
        `Cannot record ${actionLabel} for a cancelled training enrollment or cohort`,
        400,
        'INVALID_SESSION_STATUS'
      )
    }
    const today = new Date().toISOString().slice(0, 10)
    const startDate = this._getTrainingStartDate(enrollment)
    if (startDate && startDate > today) {
      throw new AppError(
        `Training ${actionLabel} cannot be recorded before the training start date (${startDate})`,
        400,
        errorCode
      )
    }
  }

  async updateEnrollmentProgress(enrollmentId, { progressPercent, notes } = {}, user) {
    const actor = this._getActorContext(user)
    const enrollment = await prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { employee: true, program: true, session: true }
    })
    if (!enrollment) throw new AppError('Enrollment record not found', 404, 'NOT_FOUND')

    if (actor.role === 'EMPLOYEE' && actor.employeeId !== enrollment.employeeId) {
      throw new AppError('You can only update progress on your own enrollment', 403, 'FORBIDDEN')
    }
    if (actor.role === 'DEPT_MANAGER' && actor.departmentId && enrollment.employee.departmentId !== actor.departmentId) {
      throw new AppError('Managers can only update enrollments in their own department', 403, 'FORBIDDEN')
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(enrollment.status)) {
      throw new AppError('Cannot update progress for a finalized or cancelled enrollment', 400, 'INVALID_STATUS')
    }

    this._assertTrainingStartedAndActive(enrollment, 'progress', 'FUTURE_PROGRESS_NOT_ALLOWED')

    if (
      progressPercent === undefined ||
      progressPercent === null ||
      progressPercent === '' ||
      !Number.isFinite(Number(progressPercent))
    ) {
      throw new AppError('Progress percentage must be a valid number between 0 and 100', 400, 'VALIDATION_ERROR')
    }
    const rawPct = Number(progressPercent)
    if (rawPct < 0 || rawPct > 100) {
      throw new AppError('Progress percentage must be between 0 and 100', 400, 'VALIDATION_ERROR')
    }

    const clamped = Math.round(rawPct)
    let nextStatus = enrollment.status
    if (clamped >= 100 || enrollment.status === 'ATTENDED') {
      nextStatus = clamped === 0 ? 'ENROLLED' : 'ATTENDED'
    } else if (clamped > 0) {
      nextStatus = 'IN_PROGRESS'
    } else {
      nextStatus = 'ENROLLED'
    }

    const updated = await prisma.trainingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        progressPercent: clamped,
        status: nextStatus,
        notes: notes !== undefined ? notes : enrollment.notes
      },
      include: {
        program: true,
        session: true,
        employee: { include: { department: true, designation: true } }
      }
    })

    await this._logAudit(actor, 'PROGRESS', 'TrainingEnrollment', updated.id, `Updated progress to ${clamped}%`)
    return updated
  }

  async recordAttendance(enrollmentId, sessionsAttendedCount, userOrActorId) {
    const actor = this._getActorContext(userOrActorId)
    const enrollment = await prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { employee: true, program: true, session: true }
    })
    if (!enrollment) throw new AppError('Enrollment record not found', 404, 'NOT_FOUND')

    if (actor.role === 'DEPT_MANAGER' && actor.departmentId && enrollment.employee.departmentId !== actor.departmentId) {
      throw new AppError('Managers can only record attendance in their own department', 403, 'FORBIDDEN')
    }
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(enrollment.status)) {
      throw new AppError('Cannot record attendance for a finalized or cancelled enrollment', 400, 'INVALID_STATUS')
    }

    this._assertTrainingStartedAndActive(enrollment, 'attendance', 'FUTURE_ATTENDANCE_NOT_ALLOWED')

    const count = Number(sessionsAttendedCount)
    if (!Number.isFinite(count) || count < 1) {
      throw new AppError('Sessions attended count must be at least 1', 400, 'VALIDATION_ERROR')
    }

    const updated = await prisma.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: {
        sessionsAttendedCount: Math.round(count),
        status: 'ATTENDED',
        progressPercent: Math.max(enrollment.progressPercent || 0, 50)
      },
      include: {
        program: true,
        session: true,
        employee: { include: { department: true, designation: true } }
      }
    })

    await this._logAudit(actor, 'ATTENDANCE', 'TrainingEnrollment', updated.id, `Recorded attendance count ${Math.round(count)}`)
    return updated
  }

  async recordAssessment(enrollmentId, payload, userOrActorId) {
    const actor = this._getActorContext(userOrActorId)
    const enrollment = await prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { program: true, session: true, employee: true }
    })
    if (!enrollment) throw new AppError('Enrollment record not found', 404, 'NOT_FOUND')

    if (enrollment.status === 'COMPLETED') {
      throw new AppError('Assessment has already been completed and certified for this enrollment', 400, 'ALREADY_COMPLETED')
    }

    this._assertTrainingStartedAndActive(enrollment, 'assessment', 'FUTURE_ASSESSMENT_NOT_ALLOWED')

    const rawScore = payload?.assessmentScore !== undefined ? payload.assessmentScore : payload?.score
    if (rawScore === undefined || rawScore === null || rawScore === '' || !Number.isFinite(Number(rawScore))) {
      throw new AppError('Assessment score must be a valid number between 0 and 100', 400, 'VALIDATION_ERROR')
    }
    const score = Number(rawScore)
    if (score < 0 || score > 100) {
      throw new AppError('Assessment score must be between 0 and 100', 400, 'VALIDATION_ERROR')
    }

    const passingScore = enrollment.program.passingScore || 70
    const requestedStatus = String(payload?.status || '').trim().toLowerCase()
    const explicitlyFailed = requestedStatus === 'failed'
    const explicitlyPassed = ['completed', 'passed', 'pass'].includes(requestedStatus)

    if (explicitlyPassed && score < passingScore) {
      throw new AppError(
        `Assessment score (${score}%) is below the program passing score (${passingScore}%)`,
        400,
        'SCORE_BELOW_PASS_MARK'
      )
    }

    const isPass = score >= passingScore && !explicitlyFailed

    if (isPass) {
      if (enrollment.session) {
        if (enrollment.session.status !== 'Completed') {
          throw new AppError(
            'Cannot pass or issue a certificate until the assigned training cohort is Completed',
            400,
            'TRAINING_NOT_COMPLETED'
          )
        }
      } else {
        const today = new Date().toISOString().slice(0, 10)
        const endDate = this._getTrainingEndDate(enrollment)
        if (endDate && today < endDate) {
          throw new AppError(
            `Cannot pass or issue a certificate before the course end date (${endDate})`,
            400,
            'TRAINING_NOT_COMPLETED'
          )
        }
      }

      let hasValidAttendance = false
      if (enrollment.session) {
        const roster = Array.isArray(enrollment.session.attendanceRecords)
          ? enrollment.session.attendanceRecords
          : []
        const rec = roster.find((r) => r.employeeId === enrollment.employeeId)
        if (rec) {
          const recStatus = String(rec.attendanceStatus || rec.status || '')
          hasValidAttendance = ['Present', 'Attended'].includes(recStatus)
        } else {
          hasValidAttendance = (enrollment.sessionsAttendedCount || 0) > 0 || enrollment.status === 'ATTENDED'
        }
      } else {
        hasValidAttendance = (enrollment.sessionsAttendedCount || 0) > 0 || enrollment.status === 'ATTENDED'
      }

      if (!hasValidAttendance) {
        throw new AppError(
          'Valid training attendance (Present) is required before passing or issuing a certificate',
          400,
          'VALID_ATTENDANCE_REQUIRED'
        )
      }
    }

    let certificateNumber = null
    let verificationCode = null
    let issuedAt = null
    let certificateExpiryDate = null
    let skillsCertified = []

    if (isPass) {
      certificateNumber = enrollment.certificateNumber || await this._generateCertificateNumber()
      verificationCode = enrollment.verificationCode || await this._generateVerificationCode()
      issuedAt = enrollment.issuedAt || new Date()
      certificateExpiryDate = enrollment.certificateExpiryDate || new Date(Date.now() + 86400000 * 365 * 2)
      skillsCertified = Array.isArray(enrollment.program.skills) && enrollment.program.skills.length
        ? enrollment.program.skills
        : [enrollment.program.category || 'Professional Competency']
    }

    const updated = await prisma.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: {
        assessmentScore: new Prisma.Decimal(score.toFixed(1)),
        status: isPass ? 'COMPLETED' : 'FAILED',
        progressPercent: isPass ? 100 : enrollment.progressPercent,
        evaluatorFeedback: payload?.feedback || payload?.evaluatorFeedback || null,
        evaluatedByName: actor.displayName,
        evaluatedAt: new Date(),
        certificateNumber,
        verificationCode,
        issuedAt,
        certificateExpiryDate,
        skillsCertified
      },
      include: {
        program: true,
        session: true,
        employee: { include: { department: true, designation: true } }
      }
    })

    await this._logAudit(
      actor,
      'ASSESSMENT',
      'TrainingEnrollment',
      updated.id,
      `Finalized assessment (${score}%) -> ${updated.status}`
    )
    return updated
  }

  async getCertificates(filters = {}, user = null) {
    const actor = this._getActorContext(user)
    const where = {
      status: 'COMPLETED',
      certificateNumber: { not: null }
    }

    if (filters.programId && filters.programId !== 'all') where.programId = filters.programId
    if (filters.employeeId) where.employeeId = filters.employeeId

    if (actor.role === 'EMPLOYEE') {
      if (!actor.employeeId) return []
      where.employeeId = actor.employeeId
    } else if (actor.role === 'DEPT_MANAGER' && actor.departmentId) {
      where.employee = { departmentId: actor.departmentId }
    }

    return prisma.trainingEnrollment.findMany({
      where,
      include: {
        program: true,
        employee: { include: { department: true, designation: true } }
      },
      orderBy: { issuedAt: 'desc' }
    })
  }

  async verifyCertificate(codeOrNumber) {
    const q = String(codeOrNumber || '').trim()
    if (!q) return { valid: false, certificate: null }

    const found = await prisma.trainingEnrollment.findFirst({
      where: {
        status: 'COMPLETED',
        OR: [
          { certificateNumber: { equals: q, mode: 'insensitive' } },
          { verificationCode: { equals: q, mode: 'insensitive' } }
        ]
      },
      include: {
        program: true,
        employee: { include: { department: true, designation: true } }
      }
    })

    if (!found) return { valid: false, certificate: null }
    return { valid: true, certificate: found }
  }

  async getEmployeeTranscript(employeeId, user) {
    const actor = this._getActorContext(user)
    if (actor.role === 'EMPLOYEE' && actor.employeeId && employeeId !== actor.employeeId) {
      throw new AppError('Access denied: You can only view your own training transcript', 403, 'FORBIDDEN')
    }

    const enrollments = await prisma.trainingEnrollment.findMany({
      where: { employeeId },
      include: { program: true, session: true },
      orderBy: { enrolledAt: 'desc' }
    })

    const completed = enrollments.filter((e) => e.status === 'COMPLETED')
    const totalHours = completed.reduce((sum, e) => sum + Number(e.program.durationHours || 0), 0)

    return {
      employeeId,
      totalEnrolled: enrollments.length,
      totalCompleted: completed.length,
      totalTrainingHours: totalHours,
      certificates: completed.filter((e) => e.certificateNumber).map((e) => ({
        certificateNumber: e.certificateNumber,
        verificationCode: e.verificationCode,
        courseTitle: e.program.title,
        issuedAt: e.issuedAt,
        score: e.assessmentScore
      })),
      enrollments
    }
  }
}

export default new TrainingService()
