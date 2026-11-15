/**
 * iSysware HRMS — Performance Management Backend Service
 * PostgreSQL-backed service implementing:
 * - Appraisal review cycles (PerformanceCycle)
 * - Employee goals & KPIs with progress tracking (PerformanceGoal)
 * - Self-assessments & Manager reviews with Anti-Self-Approval (PerformanceReview)
 * - Score normalization & automatic rating category classification
 * - Role-scoped appraisal visibility and immutable finalization
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { Prisma } from '@prisma/client'

export class PerformanceService {
  _getActorDepartmentId(user) {
    return user?.departmentId || user?.employee?.departmentId || null
  }

  _parseRecommendationMeta(raw) {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    const str = String(raw).trim()
    if (str.startsWith('{')) {
      try {
        return JSON.parse(str)
      } catch {
        return { type: str }
      }
    }
    return { type: str }
  }

  _enrichReviewOutput(review) {
    if (!review) return null
    const meta = this._parseRecommendationMeta(review.managerRecommendation)
    return {
      ...review,
      reviewMeta: meta
    }
  }

  async _generateCycleCode() {
    let seq = (await prisma.performanceCycle.count()) + 1
    const year = new Date().getFullYear()
    for (let i = 0; i < 25; i++) {
      const candidate = `CYC-${year}-${String(seq + i).padStart(2, '0')}`
      const existing = await prisma.performanceCycle.findUnique({ where: { cycleCode: candidate }, select: { id: true } })
      if (!existing) return candidate
    }
    return `CYC-${year}-${Date.now().toString().slice(-5)}`
  }

  // ============================================================================
  // 1. PERFORMANCE CYCLES
  // ============================================================================

  async getCycles(filters = {}) {
    const where = {}
    if (filters.status) where.status = filters.status

    return prisma.performanceCycle.findMany({
      where,
      include: {
        _count: {
          select: { goals: true, reviews: true }
        }
      },
      orderBy: { startDate: 'desc' }
    })
  }

  async createCycle(data, actorUserId) {
    if (!data.title || !data.startDate || !data.endDate) {
      throw new AppError('Title, Start Date, and End Date are required', 400, 'VALIDATION_FAILED')
    }

    if (new Date(data.startDate) > new Date(data.endDate)) {
      throw new AppError('Start date must be before or equal to end date', 400, 'INVALID_DATE_RANGE')
    }

    const cycleCode = data.cycleCode || await this._generateCycleCode()

    return prisma.performanceCycle.create({
      data: {
        cycleCode,
        title: data.title,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status || 'DRAFT'
      }
    })
  }

  async updateCycleStatus(id, newStatus) {
    const cycle = await prisma.performanceCycle.findUnique({ where: { id } })
    if (!cycle) throw new AppError('Performance cycle not found', 404, 'NOT_FOUND')

    return prisma.performanceCycle.update({
      where: { id },
      data: { status: newStatus }
    })
  }

  // ============================================================================
  // 2. PERFORMANCE GOALS & KPIS
  // ============================================================================

  async getGoals(filters = {}, user) {
    const where = {}
    if (filters.cycleId) where.cycleId = filters.cycleId
    if (filters.employeeId) where.employeeId = filters.employeeId

    // Scoping
    const actorDeptId = this._getActorDepartmentId(user)
    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      where.employeeId = user.employeeId
    } else if (user?.role === 'DEPT_MANAGER' && actorDeptId) {
      where.employee = { departmentId: actorDeptId }
    }

    return prisma.performanceGoal.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async createGoal(data, user) {
    if (!data.cycleId || !data.employeeId || !data.kpiTitle) {
      throw new AppError('Cycle, Employee, and KPI Title are required', 400, 'VALIDATION_FAILED')
    }

    return prisma.performanceGoal.create({
      data: {
        cycleId: data.cycleId,
        employeeId: data.employeeId,
        kpiTitle: data.kpiTitle,
        description: data.description || null,
        weightage: Number(data.weightage) || 20,
        targetMetric: data.targetMetric || null,
        achievedMetric: data.achievedMetric || null,
        progressPercent: Number(data.progressPercent) || 0,
        status: data.status || 'IN_PROGRESS'
      }
    })
  }

  async updateGoalProgress(id, data, user) {
    const goal = await prisma.performanceGoal.findUnique({ where: { id } })
    if (!goal) throw new AppError('Performance goal not found', 404, 'NOT_FOUND')

    if (user?.role === 'EMPLOYEE' && user?.employeeId && goal.employeeId !== user.employeeId) {
      throw new AppError('Access denied: You can only update your own goals', 403, 'FORBIDDEN')
    }

    const progressPercent = data.progressPercent !== undefined ? Math.min(100, Math.max(0, Number(data.progressPercent))) : goal.progressPercent
    const status = progressPercent >= 100 ? 'COMPLETED' : 'IN_PROGRESS'

    return prisma.performanceGoal.update({
      where: { id },
      data: {
        progressPercent,
        achievedMetric: data.achievedMetric !== undefined ? data.achievedMetric : goal.achievedMetric,
        status
      }
    })
  }

  // Department KPI configuration — PostgreSQL

  async getKpis(filters = {}, user) {
    const where = {};

    if (filters.departmentId && String(filters.departmentId).toUpperCase() !== 'ALL') {
      const dept = await prisma.department.findFirst({
        where: {
          OR: [
            { id: filters.departmentId },
            { code: filters.departmentId }
          ]
        }
      });
      if (dept) {
        where.departmentId = dept.id;
      } else {
        where.departmentId = filters.departmentId;
      }
    }

    if (filters.reviewCycle && String(filters.reviewCycle).toUpperCase() !== 'ALL') {
      where.reviewCycle = filters.reviewCycle;
    }

    const actorDeptId = this._getActorDepartmentId(user)
    if (
      user?.role === 'DEPT_MANAGER' &&
      actorDeptId
    ) {
      where.departmentId = actorDeptId;
    }

    return prisma.departmentKpi.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async createKpi(data, user) {
    const code = String(data.code || '').trim().toUpperCase();
    const name = String(data.name || '').trim();
    const departmentId = String(data.departmentId || '').trim();
    const weight = Number(data.weightPercent);
    const target = Number(data.targetValue);

    if (code.length < 2 || name.length < 3 || !departmentId) {
      throw new AppError(
        'KPI Code, Name and Department are required',
        400,
        'VALIDATION_FAILED'
      );
    }

    if (!Number.isFinite(target) || target < 0) {
      throw new AppError(
        'Target must be a valid non-negative number',
        400,
        'INVALID_TARGET'
      );
    }

    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
      throw new AppError(
        'Weight must be between 1 and 100',
        400,
        'INVALID_WEIGHT'
      );
    }

    const metricType = data.metricType || 'Percentage';
    const reviewCycle = data.reviewCycle || 'Quarterly';

    if (!['Percentage', 'Rating (1-5)', 'Numeric (PKR)', 'Count'].includes(metricType)) {
      throw new AppError('Invalid measurement type', 400, 'INVALID_METRIC_TYPE');
    }

    if (!['Monthly', 'Quarterly', 'Annual'].includes(reviewCycle)) {
      throw new AppError('Invalid review cycle', 400, 'INVALID_REVIEW_CYCLE');
    }

    const department = await prisma.department.findFirst({
      where: {
        OR: [
          { id: departmentId },
          { code: departmentId }
        ]
      }
    });

    if (!department) {
      throw new AppError(
        'Department not found',
        404,
        'DEPARTMENT_NOT_FOUND'
      );
    }

    if (String(department.status || '').toUpperCase() !== 'ACTIVE') {
      throw new AppError(
        'Cannot create KPI for an inactive department',
        400,
        'INACTIVE_DEPARTMENT'
      );
    }

    const existingKpi = await prisma.departmentKpi.findFirst({
      where: {
        departmentId: department.id,
        code: { equals: code, mode: 'insensitive' }
      }
    });

    if (existingKpi) {
      throw new AppError(
        'KPI code already exists for this department',
        409,
        'DUPLICATE_KPI'
      );
    }

    try {
      return await prisma.departmentKpi.create({
        data: {
          code,
          name,
          departmentId: department.id,
          department: department.name,
          metricType,
          targetValue: target,
          weightPercent: weight,
          reviewCycle,
          description: String(data.description || '').trim(),
          createdBy: user?.id || null
        }
      });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new AppError(
          'KPI code already exists for this department',
          409,
          'DUPLICATE_KPI'
        );
      }
      throw err;
    }
  }

  // ============================================================================
  // 3. PERFORMANCE REVIEWS & APPRAISALS
  // ============================================================================

  _getReviewInclude() {
    return {
      cycle: true,
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
          designation: { select: { id: true, title: true } }
        }
      },
      reviewer: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          designation: { select: { id: true, title: true } }
        }
      }
    }
  }

  _calculateRatingCategory(finalScore) {
    if (finalScore >= 4.5) return 'OUTSTANDING'
    if (finalScore >= 3.8) return 'EXCEEDS_EXPECTATIONS'
    if (finalScore >= 2.8) return 'MEETS_EXPECTATIONS'
    if (finalScore >= 2.0) return 'NEEDS_IMPROVEMENT'
    return 'UNSATISFACTORY'
  }

  async _writeReviewAudit(actorUser, actionType, entityId, oldValues, newValues, description) {
    const actorObj = typeof actorUser === 'object' ? actorUser : { id: actorUser }
    if (!actorObj?.id && !actorObj?.role) return
    await prisma.auditLog.create({
      data: {
        actorUserId: actorObj?.id || null,
        actorEmployeeCode: actorObj?.employee?.employeeCode || null,
        actorRole: actorObj?.role || 'SYSTEM',
        sourceModule: 'PERFORMANCE',
        actionType,
        entityName: 'PerformanceReview',
        entityId,
        recordSnapshotBefore: oldValues || undefined,
        recordSnapshotAfter: newValues || undefined,
        reasonOrNotes: description
      }
    }).catch(() => {})
  }

  async getReviews(filters = {}, user) {
    const where = {}
    if (filters.cycleId) where.cycleId = filters.cycleId
    if (filters.employeeId) where.employeeId = filters.employeeId
    if (filters.status) where.status = filters.status

    const employeeWhere = {}
    if (filters.departmentId) employeeWhere.departmentId = filters.departmentId

    // Scoping
    const actorDeptId = this._getActorDepartmentId(user)
    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      where.employeeId = user.employeeId
    } else if (user?.role === 'DEPT_MANAGER' && actorDeptId) {
      employeeWhere.departmentId = actorDeptId
    }

    if (Object.keys(employeeWhere).length > 0) {
      where.employee = employeeWhere
    }

    const reviews = await prisma.performanceReview.findMany({
      where,
      include: this._getReviewInclude(),
      orderBy: [{ finalizedAt: 'desc' }, { reviewedAt: 'desc' }, { submittedAt: 'desc' }]
    })

    return reviews.map((r) => this._enrichReviewOutput(r))
  }

  async getReviewById(id, user) {
    const review = await prisma.performanceReview.findUnique({
      where: { id },
      include: this._getReviewInclude()
    })
    if (!review) throw new AppError('Performance review not found', 404, 'NOT_FOUND')

    const actorDeptId = this._getActorDepartmentId(user)
    if (user?.role === 'EMPLOYEE' && user?.employeeId && review.employeeId !== user.employeeId) {
      throw new AppError('Access denied: You can only view your own appraisal', 403, 'FORBIDDEN')
    }
    if (user?.role === 'DEPT_MANAGER' && actorDeptId && review.employee?.departmentId !== actorDeptId) {
      throw new AppError('Access denied: Review belongs to another department', 403, 'FORBIDDEN')
    }

    return this._enrichReviewOutput(review)
  }

  async initiateReview(data, actorUser) {
    if (!data.cycleId || !data.employeeId) {
      throw new AppError('Cycle and Employee are required', 400, 'VALIDATION_FAILED')
    }

    const cycle = await prisma.performanceCycle.findFirst({
      where: {
        OR: [{ id: data.cycleId }, { cycleCode: data.cycleId }]
      }
    })
    if (!cycle) {
      throw new AppError('Appraisal cycle not found', 404, 'CYCLE_NOT_FOUND')
    }
    if (['CLOSED', 'ARCHIVED'].includes(String(cycle.status).toUpperCase())) {
      throw new AppError('Cannot initiate reviews inside a closed appraisal cycle', 400, 'CYCLE_CLOSED')
    }

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [{ id: data.employeeId }, { employeeCode: data.employeeId }]
      },
      include: { department: true }
    })
    if (!employee) {
      throw new AppError('Target employee not found', 404, 'EMPLOYEE_NOT_FOUND')
    }
    if (employee.employmentStatus !== 'ACTIVE') {
      throw new AppError('Appraisal reviews can only be initiated for ACTIVE employees', 400, 'EMPLOYEE_INACTIVE')
    }

    const actorObj = typeof actorUser === 'object' ? actorUser : { id: actorUser }
    const actorDeptId = this._getActorDepartmentId(actorObj)
    if (actorObj?.role === 'DEPT_MANAGER' && actorDeptId && employee.departmentId !== actorDeptId) {
      throw new AppError('Managers can only initiate reviews for employees in their own department', 403, 'FORBIDDEN')
    }

    let resolvedReviewerId = null
    if (data.reviewerId) {
      const reviewer = await prisma.employee.findFirst({
        where: { OR: [{ id: data.reviewerId }, { employeeCode: data.reviewerId }] },
        select: { id: true }
      })
      if (!reviewer) {
        throw new AppError('Selected reviewer not found', 404, 'REVIEWER_NOT_FOUND')
      }
      if (reviewer.id === employee.id) {
        throw new AppError('Employee cannot be assigned as their own appraisal reviewer', 400, 'SELF_REVIEWER_INVALID')
      }
      resolvedReviewerId = reviewer.id
    }

    const existing = await prisma.performanceReview.findUnique({
      where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: employee.id } }
    })
    if (existing) throw new AppError('Review for this employee in this cycle already exists', 409, 'REVIEW_ALREADY_EXISTS')

    const initialMeta = {
      type: 'NO_CHANGE',
      initiatedById: actorObj?.id || null,
      initiatedAt: new Date().toISOString()
    }

    const created = await prisma.performanceReview.create({
      data: {
        cycleId: cycle.id,
        employeeId: employee.id,
        reviewerId: resolvedReviewerId,
        status: 'SELF_REVIEW',
        managerRecommendation: JSON.stringify(initialMeta)
      },
      include: this._getReviewInclude()
    })

    await this._writeReviewAudit(
      actorObj,
      'CREATE',
      created.id,
      null,
      { cycleId: cycle.id, employeeId: employee.id, reviewerId: resolvedReviewerId, status: 'SELF_REVIEW' },
      `Initiated review for ${employee.employeeCode} in cycle ${cycle.title}`
    )

    return this._enrichReviewOutput(created)
  }

  async submitSelfReview(reviewId, data, user) {
    const review = await prisma.performanceReview.findUnique({ where: { id: reviewId } })
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND')

    const existingMeta = this._parseRecommendationMeta(review.managerRecommendation)
    if (review.status === 'COMPLETED' || existingMeta.isLocked) {
      throw new AppError('Review is already finalized and cannot be modified', 400, 'ALREADY_FINALIZED')
    }

    if (user?.role === 'EMPLOYEE' && user?.employeeId && review.employeeId !== user.employeeId) {
      throw new AppError('Access denied: You can only submit self-review for your own appraisal', 403, 'FORBIDDEN')
    }

    const selfScore = Number(data.selfScore) || 0
    if (selfScore < 1 || selfScore > 5) {
      throw new AppError('Self score must be between 1.0 and 5.0', 400, 'INVALID_SCORE')
    }

    const updatedMeta = {
      ...existingMeta,
      selfComments: data.selfComments ?? existingMeta.selfComments ?? '',
      selfSubmittedById: user?.id || null,
      selfSubmittedAt: new Date().toISOString()
    }

    const updated = await prisma.performanceReview.update({
      where: { id: reviewId },
      data: {
        selfScore: new Prisma.Decimal(selfScore.toFixed(1)),
        strengths: data.strengths !== undefined ? (data.strengths || null) : review.strengths,
        growthAreas: data.growthAreas !== undefined ? (data.growthAreas || null) : review.growthAreas,
        managerRecommendation: JSON.stringify(updatedMeta),
        status: 'MANAGER_REVIEW',
        submittedAt: new Date()
      },
      include: this._getReviewInclude()
    })

    await this._writeReviewAudit(
      user,
      'SUBMIT_SELF_REVIEW',
      reviewId,
      { status: review.status, selfScore: review.selfScore },
      { status: 'MANAGER_REVIEW', selfScore },
      `Employee submitted self-review score ${selfScore}`
    )

    return this._enrichReviewOutput(updated)
  }

  async submitManagerReview(reviewId, data, reviewerUser) {
    const review = await prisma.performanceReview.findUnique({
      where: { id: reviewId },
      include: { employee: { select: { id: true, departmentId: true, employeeCode: true } } }
    })
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND')

    const existingMeta = this._parseRecommendationMeta(review.managerRecommendation)
    if (review.status === 'COMPLETED' || existingMeta.isLocked) {
      throw new AppError('Review is already finalized and cannot be modified', 400, 'ALREADY_FINALIZED')
    }

    // Critical Anti-Self-Approval (bypassed for SUPER_ADMIN universal authority)
    const isSuperAdmin = String(reviewerUser?.role || '').toUpperCase() === 'SUPER_ADMIN'
    if (!isSuperAdmin && reviewerUser?.employeeId && review.employeeId === reviewerUser.employeeId) {
      throw new AppError('Anti-self-approval: You cannot conduct manager evaluation on your own review', 403, 'SELF_APPROVAL_PROHIBITED')
    }

    const actorDeptId = this._getActorDepartmentId(reviewerUser)
    if (reviewerUser?.role === 'DEPT_MANAGER' && actorDeptId && review.employee?.departmentId !== actorDeptId) {
      throw new AppError('Access denied: Cannot evaluate an employee outside your department', 403, 'FORBIDDEN')
    }

    const reviewerScore = Number(data.reviewerScore) || 0
    if (reviewerScore < 1 || reviewerScore > 5) {
      throw new AppError('Reviewer score must be between 1.0 and 5.0', 400, 'INVALID_SCORE')
    }

    // Normalized Score: 30% self (if provided) + 70% manager, or 100% manager
    let finalNormalized = reviewerScore
    if (review.selfScore) {
      const selfVal = Number(review.selfScore)
      finalNormalized = (selfVal * 0.3) + (reviewerScore * 0.7)
    }
    const finalScore = Number(finalNormalized.toFixed(1))
    const ratingCategory = this._calculateRatingCategory(finalScore)

    const finalizeImmediately = data.finalizeImmediately !== false
    const nextStatus = finalizeImmediately ? 'COMPLETED' : 'HR_MODERATION'
    const recType = data.recommendationType || data.managerRecommendation || existingMeta.type || 'NO_CHANGE'
    const hasExtendedMeta = Boolean(
      data.recommendationType !== undefined ||
      data.recommendedPercent !== undefined ||
      data.justification !== undefined ||
      data.managerComments !== undefined ||
      data.finalizeImmediately === false ||
      existingMeta.selfComments
    )

    const mergedMeta = {
      ...existingMeta,
      type: recType,
      recommendedPercent: data.recommendedPercent !== undefined ? Number(data.recommendedPercent) || 0 : (existingMeta.recommendedPercent || 0),
      justification: data.justification ?? existingMeta.justification ?? '',
      managerComments: data.managerComments ?? existingMeta.managerComments ?? '',
      reviewedByUserId: reviewerUser?.id || null,
      isLocked: finalizeImmediately
    }

    const storedRecommendation = hasExtendedMeta ? JSON.stringify(mergedMeta) : recType

    const updated = await prisma.performanceReview.update({
      where: { id: reviewId },
      data: {
        reviewerId: reviewerUser?.employeeId || review.reviewerId || null,
        reviewerScore: new Prisma.Decimal(reviewerScore.toFixed(1)),
        finalNormalizedScore: new Prisma.Decimal(finalScore.toFixed(1)),
        ratingCategory,
        managerRecommendation: storedRecommendation,
        strengths: data.strengths || review.strengths,
        growthAreas: data.growthAreas || review.growthAreas,
        status: nextStatus,
        reviewedAt: new Date(),
        finalizedAt: finalizeImmediately ? new Date() : null
      },
      include: this._getReviewInclude()
    })

    await this._writeReviewAudit(
      reviewerUser,
      'SUBMIT_MANAGER_REVIEW',
      reviewId,
      { status: review.status, reviewerScore: review.reviewerScore },
      { status: nextStatus, reviewerScore, finalNormalizedScore: finalScore, ratingCategory },
      `Manager review scored ${reviewerScore} (normalized ${finalScore}, status ${nextStatus})`
    )

    return this._enrichReviewOutput(updated)
  }

  async hrModerateReview(reviewId, data, hrUser) {
    const review = await prisma.performanceReview.findUnique({ where: { id: reviewId } })
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND')

    const existingMeta = this._parseRecommendationMeta(review.managerRecommendation)
    if (review.status === 'COMPLETED' || existingMeta.isLocked) {
      throw new AppError('Review is already finalized and cannot be moderated', 400, 'ALREADY_FINALIZED')
    }
    const isSuperAdmin = String(hrUser?.role || '').toUpperCase() === 'SUPER_ADMIN'
    if (!isSuperAdmin && hrUser?.employeeId && review.employeeId === hrUser.employeeId) {
      throw new AppError('Anti-self-approval: HR cannot moderate their own appraisal', 403, 'SELF_APPROVAL_PROHIBITED')
    }

    const hrRating = Number(data.hrRating)
    if (!Number.isFinite(hrRating) || hrRating < 1 || hrRating > 5) {
      throw new AppError('Moderated HR score must be between 1.0 and 5.0', 400, 'INVALID_SCORE')
    }

    const finalScore = Number(hrRating.toFixed(1))
    const ratingCategory = this._calculateRatingCategory(finalScore)
    const updatedMeta = {
      ...existingMeta,
      hrComments: data.hrComments || '',
      hrRating: finalScore,
      hrModeratedById: hrUser?.id || null,
      hrModeratedAt: new Date().toISOString()
    }

    const updated = await prisma.performanceReview.update({
      where: { id: reviewId },
      data: {
        finalNormalizedScore: new Prisma.Decimal(finalScore.toFixed(1)),
        ratingCategory,
        managerRecommendation: JSON.stringify(updatedMeta),
        status: 'FINAL_APPROVAL'
      },
      include: this._getReviewInclude()
    })

    await this._writeReviewAudit(
      hrUser,
      'HR_MODERATE_REVIEW',
      reviewId,
      { status: review.status, finalNormalizedScore: review.finalNormalizedScore },
      { status: 'FINAL_APPROVAL', finalNormalizedScore: finalScore, ratingCategory },
      `HR moderated appraisal score to ${finalScore}`
    )

    return this._enrichReviewOutput(updated)
  }

  async finalizeReview(reviewId, adminUser) {
    const review = await prisma.performanceReview.findUnique({ where: { id: reviewId } })
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND')

    const existingMeta = this._parseRecommendationMeta(review.managerRecommendation)
    if (review.status === 'COMPLETED' && existingMeta.isLocked) {
      throw new AppError('Review is already finalized', 400, 'ALREADY_FINALIZED')
    }

    const scoreNum = Number(review.finalNormalizedScore || review.reviewerScore || review.selfScore || 0)
    if (scoreNum < 1) {
      throw new AppError('Cannot finalize review before evaluation scores are submitted', 400, 'VALIDATION_FAILED')
    }

    const updatedMeta = {
      ...existingMeta,
      isLocked: true,
      finalizedById: adminUser?.id || null,
      finalizedAtIso: new Date().toISOString()
    }

    const updated = await prisma.performanceReview.update({
      where: { id: reviewId },
      data: {
        finalNormalizedScore: new Prisma.Decimal(scoreNum.toFixed(1)),
        ratingCategory: review.ratingCategory || this._calculateRatingCategory(scoreNum),
        managerRecommendation: JSON.stringify(updatedMeta),
        status: 'COMPLETED',
        finalizedAt: new Date()
      },
      include: this._getReviewInclude()
    })

    await this._writeReviewAudit(
      adminUser,
      'APPROVE',
      reviewId,
      { status: review.status },
      { status: 'COMPLETED', finalNormalizedScore: scoreNum },
      'Finalized and locked performance review'
    )

    return this._enrichReviewOutput(updated)
  }

  async acknowledgeReview(reviewId, user) {
    const review = await prisma.performanceReview.findUnique({ where: { id: reviewId } })
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND')

    if (!user?.employeeId || review.employeeId !== user.employeeId) {
      throw new AppError('Only the evaluated employee can acknowledge their appraisal', 403, 'FORBIDDEN')
    }
    if (review.status !== 'COMPLETED') {
      throw new AppError('Appraisal must be finalized before employee acknowledgement', 400, 'NOT_FINALIZED')
    }

    const existingMeta = this._parseRecommendationMeta(review.managerRecommendation)
    const updatedMeta = {
      ...existingMeta,
      isLocked: true,
      acknowledgedByEmployee: true,
      acknowledgedAt: new Date().toISOString()
    }

    const updated = await prisma.performanceReview.update({
      where: { id: reviewId },
      data: {
        managerRecommendation: JSON.stringify(updatedMeta)
      },
      include: this._getReviewInclude()
    })

    await this._writeReviewAudit(
      user,
      'ACKNOWLEDGE_REVIEW',
      reviewId,
      null,
      { acknowledgedByEmployee: true },
      'Employee acknowledged finalized performance appraisal'
    )

    return this._enrichReviewOutput(updated)
  }
}

export default new PerformanceService()

