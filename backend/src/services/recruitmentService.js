/**
 * iSysware HRMS — Recruitment & Onboarding Backend Service
 * PostgreSQL-backed service implementing:
 * - Job requisitions & openings
 * - Candidate applications & pipeline tracking
 * - Interview scheduling & 5-point evaluation scorecards
 * - Job offer governance & candidate acceptance
 * - Idempotent candidate hiring & canonical employee creation
 * - Automatic onboarding checklist & task management
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { Prisma } from '@prisma/client'

export class RecruitmentService {
  /**
   * Generates next code sequence (e.g. REQ-2026-001, JOB-2026-001, CAND-001, OFF-2026-001)
   */
  async _generateNextCode(modelName, prefix, codeField) {
    const count = await prisma[modelName].count()
    const nextNum = String(count + 1).padStart(3, '0')
    const year = new Date().getFullYear()
    if (prefix === 'CAND') return `CAND-${nextNum}`
    return `${prefix}-${year}-${nextNum}`
  }

  // ============================================================================
  // 1. REQUISITIONS
  // ============================================================================

  async getRequisitions(filters = {}, user) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.departmentId) where.departmentId = filters.departmentId

    // Organizational scoping: Department Managers see only their department
    if (user?.role === 'DEPT_MANAGER' && user?.departmentId) {
      where.departmentId = user.departmentId
    }

    return prisma.jobRequisition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        jobOpenings: true
      }
    })
  }

  async createRequisition(data, actorUser) {
    const actorUserId = typeof actorUser === 'object' ? actorUser?.id : actorUser

    // Resolve department
    let departmentId = data.departmentId
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { OR: [{ id: departmentId }, { code: departmentId }] }
      })
      if (dept) departmentId = dept.id
    }

    // Resolve designation
    let designationId = data.designationId
    if (designationId) {
      const desig = await prisma.designation.findFirst({
        where: { OR: [{ id: designationId }, { code: designationId }] }
      })
      if (desig) designationId = desig.id
    }
    if (!designationId) {
      const firstDesig = await prisma.designation.findFirst()
      designationId = firstDesig?.id
    }

    const justification = data.justification || data.hiringReason || data.jobTitle || 'New Headcount Requirement'

    if (!departmentId || !designationId || !justification) {
      throw new AppError('Department, designation, and justification are required', 400, 'VALIDATION_FAILED')
    }

    const requisitionNumber = data.requisitionNumber || await this._generateNextCode('jobRequisition', 'REQ', 'requisitionNumber')

    // Resolve actorUserId to actual user id if possible
    let reqUserId = actorUserId
    if (reqUserId) {
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: reqUserId }, { employeeId: reqUserId }, { username: reqUserId }] }
      })
      if (user) reqUserId = user.id
    }
    if (!reqUserId) {
      const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
      reqUserId = admin?.id || actorUserId
    }

    // Check if creator is Super Admin
    let isSuperAdmin = false
    if (typeof actorUser === 'object' && actorUser?.role === 'SUPER_ADMIN') {
      isSuperAdmin = true
    } else if (reqUserId) {
      const u = await prisma.user.findUnique({ where: { id: reqUserId } })
      if (u?.role === 'SUPER_ADMIN') isSuperAdmin = true
    }

    // Super Admin requisitions are auto-approved directly; others require approval
    const initialStatus = isSuperAdmin ? 'APPROVED' : 'PENDING_APPROVAL'

    const requisition = await prisma.jobRequisition.create({
      data: {
        requisitionNumber,
        departmentId,
        designationId,
        openingsCount: Number(data.openingsCount || data.openPositions) || 1,
        justification,
        budgetRange: data.budgetRange || (data.minSalary && data.maxSalary ? `PKR ${data.minSalary} - ${data.maxSalary}` : null),
        status: initialStatus,
        requestedById: reqUserId,
        approvedById: isSuperAdmin ? reqUserId : null
      }
    })

    // If Super Admin created it, auto-create JobOpening in PostgreSQL immediately!
    if (isSuperAdmin) {
      const openingCode = await this._generateNextCode('jobOpening', 'JOB', 'openingCode')
      const desig = await prisma.designation.findUnique({ where: { id: requisition.designationId } }).catch(() => null)
      await prisma.jobOpening.create({
        data: {
          openingCode,
          requisitionId: requisition.id,
          title: desig?.title || desig?.name || data.jobTitle || 'Open Position',
          departmentId: requisition.departmentId,
          status: 'OPEN'
        }
      }).catch(() => { })
    }

    return requisition
  }

  async reviewRequisition(id, { action, remarks, reviewComments }, reviewerUser) {
    const requisition = await prisma.jobRequisition.findFirst({
      where: { OR: [{ id }, { requisitionNumber: id }] }
    })
    if (!requisition) throw new AppError('Requisition not found', 404, 'NOT_FOUND')

    const reviewerUserId = typeof reviewerUser === 'object' ? reviewerUser?.id : reviewerUser
    let reviewerRole = typeof reviewerUser === 'object' ? reviewerUser?.role : null
    if (!reviewerRole && reviewerUserId) {
      const u = await prisma.user.findUnique({ where: { id: reviewerUserId } })
      reviewerRole = u?.role
    }
    const isSuperAdmin = reviewerRole === 'SUPER_ADMIN'

    // Super Admin can approve any requisition (self or others).
    // For non-super-admin roles, anti-self-approval is strictly enforced.
    if (!isSuperAdmin && requisition.requestedById === reviewerUserId) {
      throw new AppError('Anti-self-approval: Requester cannot approve their own requisition. A Super Admin must approve it.', 403, 'SELF_APPROVAL_PROHIBITED')
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    const finalRemarks = remarks || reviewComments || null

    const updated = await prisma.jobRequisition.update({
      where: { id: requisition.id },
      data: {
        status: newStatus,
        approvedById: reviewerUserId,
        ...(finalRemarks ? { justification: `${requisition.justification || ''} [Review: ${finalRemarks}]`.trim() } : {})
      }
    })

    // If approved, automatically create a JobOpening in PostgreSQL if not already present
    if (newStatus === 'APPROVED') {
      const existingOpening = await prisma.jobOpening.findFirst({
        where: { requisitionId: requisition.id }
      })
      if (!existingOpening) {
        const openingCode = await this._generateNextCode('jobOpening', 'JOB', 'openingCode')
        const desig = await prisma.designation.findUnique({ where: { id: requisition.designationId } }).catch(() => null)
        await prisma.jobOpening.create({
          data: {
            openingCode,
            requisitionId: requisition.id,
            title: desig?.title || 'Open Position',
            departmentId: requisition.departmentId,
            status: 'OPEN'
          }
        }).catch(() => { })
      }
    }

    return updated
  }

  async updateRequisition(id, data, actorUserId) {
    const requisition = await prisma.jobRequisition.findFirst({
      where: { OR: [{ id }, { requisitionNumber: id }] }
    })
    if (!requisition) throw new AppError('Requisition not found', 404, 'NOT_FOUND')

    let departmentId = data.departmentId
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { OR: [{ id: departmentId }, { code: departmentId }] }
      })
      if (dept) departmentId = dept.id
    }

    let designationId = data.designationId
    if (designationId) {
      const desig = await prisma.designation.findFirst({
        where: { OR: [{ id: designationId }, { code: designationId }] }
      })
      if (desig) designationId = desig.id
    }

    const justification = data.justification || data.hiringReason || data.jobTitle || undefined
    const openingsCount = data.openingsCount ? Number(data.openingsCount) : (data.openPositions ? Number(data.openPositions) : undefined)
    const budgetRange = data.budgetRange || (data.minSalary && data.maxSalary ? `PKR ${data.minSalary} - ${data.maxSalary}` : undefined)

    const updated = await prisma.jobRequisition.update({
      where: { id: requisition.id },
      data: {
        departmentId: departmentId || undefined,
        designationId: designationId || undefined,
        openingsCount: openingsCount || undefined,
        justification: justification || undefined,
        budgetRange: budgetRange || undefined
      }
    })

    // Synchronize linked JobOpening records in PostgreSQL
    try {
      let newTitle = data.jobTitle || data.title
      if (!newTitle && designationId) {
        const desig = await prisma.designation.findUnique({ where: { id: designationId } })
        if (desig) newTitle = desig.title || desig.name
      }
      await prisma.jobOpening.updateMany({
        where: { requisitionId: requisition.id },
        data: {
          title: newTitle || undefined,
          departmentId: departmentId || undefined,
          salaryMin: data.salaryRange?.min ? new Prisma.Decimal(data.salaryRange.min) : (data.minSalary ? new Prisma.Decimal(data.minSalary) : undefined),
          salaryMax: data.salaryRange?.max ? new Prisma.Decimal(data.salaryRange.max) : (data.maxSalary ? new Prisma.Decimal(data.maxSalary) : undefined)
        }
      })
    } catch {
      // Non-fatal if no linked opening exists
    }

    return updated
  }

  // ============================================================================
  // 2. JOB OPENINGS
  // ============================================================================

  async getJobOpenings(filters = {}) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.departmentId) where.departmentId = filters.departmentId

    return prisma.jobOpening.findMany({
      where,
      include: {
        requisition: true,
        applications: {
          select: { id: true, status: true, candidateId: true }
        }
      },
      orderBy: { postedAt: 'desc' }
    })
  }

  async getJobOpeningById(id) {
    const opening = await prisma.jobOpening.findUnique({
      where: { id },
      include: {
        requisition: true,
        applications: {
          include: {
            candidate: true,
            interviews: true,
            offer: true
          }
        }
      }
    })
    if (!opening) throw new AppError('Job opening not found', 404, 'NOT_FOUND')
    return opening
  }

  async createJobOpening(data, actorUserId) {
    if (!data.title || !data.departmentId) {
      throw new AppError('Title and Department are required', 400, 'VALIDATION_FAILED')
    }

    const openingCode = data.openingCode || await this._generateNextCode('jobOpening', 'JOB', 'openingCode')

    return prisma.jobOpening.create({
      data: {
        openingCode,
        title: data.title,
        departmentId: data.departmentId,
        requisitionId: data.requisitionId || null,
        employmentType: data.employmentType || 'PERMANENT',
        experienceMinYears: new Prisma.Decimal(data.experienceMinYears || 0),
        experienceMaxYears: data.experienceMaxYears ? new Prisma.Decimal(data.experienceMaxYears) : null,
        salaryMin: data.salaryMin ? new Prisma.Decimal(data.salaryMin) : null,
        salaryMax: data.salaryMax ? new Prisma.Decimal(data.salaryMax) : null,
        status: 'OPEN'
      }
    })
  }

  async updateJobOpening(id, data, actorUserId) {
    const existing = await prisma.jobOpening.findFirst({
      where: { OR: [{ id }, { openingCode: id }] }
    })
    if (!existing) throw new AppError('Job opening not found', 404, 'NOT_FOUND')

    let status = data.status
    if (status) {
      const s = String(status).toUpperCase()
      if (s === 'OPEN' || s === 'ACTIVE') status = 'OPEN'
      else if (s.includes('HOLD')) status = 'ON_HOLD'
      else if (s === 'CLOSED' || s === 'FILLED') status = 'CLOSED'
    }

    let departmentId = data.departmentId
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { OR: [{ id: departmentId }, { code: departmentId }] }
      })
      if (dept) departmentId = dept.id
    }

    const openPositions = data.openPositions !== undefined ? Number(data.openPositions) : (data.openingsCount !== undefined ? Number(data.openingsCount) : undefined)

    // Synchronize headcount with linked JobRequisition in PostgreSQL
    if (openPositions !== undefined && existing.requisitionId) {
      await prisma.jobRequisition.update({
        where: { id: existing.requisitionId },
        data: { openingsCount: openPositions }
      }).catch(() => {})
    }

    return prisma.jobOpening.update({
      where: { id: existing.id },
      data: {
        title: data.title !== undefined ? data.title : undefined,
        departmentId: departmentId || undefined,
        status: status !== undefined ? status : undefined,
        salaryMin: data.salaryMin !== undefined && data.salaryMin !== null ? new Prisma.Decimal(data.salaryMin) : undefined,
        salaryMax: data.salaryMax !== undefined && data.salaryMax !== null ? new Prisma.Decimal(data.salaryMax) : undefined,
        closingDate: data.closingDate || data.targetDate ? new Date(data.closingDate || data.targetDate) : undefined
      },
      include: {
        requisition: true,
        applications: {
          select: { id: true, status: true, candidateId: true }
        }
      }
    })
  }

  async deleteJobOpening(id) {
    const existing = await prisma.jobOpening.findFirst({
      where: { OR: [{ id }, { openingCode: id }] }
    })
    if (!existing) throw new AppError('Job opening not found', 404, 'NOT_FOUND')

    await prisma.jobOpening.delete({
      where: { id: existing.id }
    })
    return { id: existing.id, openingCode: existing.openingCode, deleted: true }
  }

  async deleteRequisition(id) {
    const existing = await prisma.jobRequisition.findFirst({
      where: { OR: [{ id }, { requisitionNumber: id }] }
    })
    if (!existing) throw new AppError('Requisition not found', 404, 'NOT_FOUND')

    await prisma.jobOpening.deleteMany({
      where: { requisitionId: existing.id }
    }).catch(() => {})

    await prisma.jobRequisition.delete({
      where: { id: existing.id }
    })
    return { id: existing.id, requisitionNumber: existing.requisitionNumber, deleted: true }
  }

  async deleteCandidate(id) {
    const existing = await prisma.candidate.findFirst({
      where: { OR: [{ id }, { candidateCode: id }] }
    })
    if (!existing) throw new AppError('Candidate not found', 404, 'NOT_FOUND')

    await prisma.candidate.delete({
      where: { id: existing.id }
    })
    return { id: existing.id, candidateCode: existing.candidateCode, deleted: true }
  }

  // ============================================================================
  // 3. CANDIDATES
  // ============================================================================

  async getCandidates(filters = {}, user) {
    const where = {}
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { candidateCode: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    const isHrOrSuperAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role)

    const candidates = await prisma.candidate.findMany({
      where,
      include: {
        applications: {
          include: {
            opening: { select: { id: true, title: true, openingCode: true } },
            offer: true
          }
        },
        notes: {
          where: isHrOrSuperAdmin ? {} : { isConfidential: false },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return candidates
  }

  async getCandidateById(id, user) {
    const isHrOrSuperAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role)

    const candidate = await prisma.candidate.findFirst({
      where: { OR: [{ id }, { candidateCode: id }] },
      include: {
        applications: {
          include: {
            opening: true,
            interviews: {
              include: { evaluation: true }
            },
            offer: true
          }
        },
        notes: {
          where: isHrOrSuperAdmin ? {} : { isConfidential: false },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    if (!candidate) throw new AppError('Candidate not found', 404, 'NOT_FOUND')
    return candidate
  }

  async addCandidateNote(candidateId, data, actorUser) {
    const candidate = await prisma.candidate.findFirst({
      where: { OR: [{ id: candidateId }, { candidateCode: candidateId }] }
    })
    if (!candidate) throw new AppError('Candidate not found', 404, 'NOT_FOUND')

    const content = String(data.content || data.noteText || data.note || '').trim()
    if (!content) {
      throw new AppError('Note content is required', 400, 'VALIDATION_FAILED')
    }

    const actorUserId = typeof actorUser === 'object' ? actorUser?.id : actorUser
    const actorUserObj = typeof actorUser === 'object' && actorUser?.role
      ? actorUser
      : await prisma.user.findUnique({ where: { id: actorUserId } })

    const isHrOrSuperAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(actorUserObj?.role)
    const isConfidential = isHrOrSuperAdmin ? Boolean(data.isConfidential || data.isConfidentialHrOnly) : false

    const authorName = data.author || data.authorName || actorUserObj?.username || 'HR Recruiter'
    const authorRole = data.authorRole || actorUserObj?.role || 'HR_ADMIN'

    const note = await prisma.candidateNote.create({
      data: {
        candidateId: candidate.id,
        authorId: actorUserId,
        authorName,
        authorRole,
        content,
        isConfidential
      }
    })

    return note
  }

  async getCandidateNotes(candidateId, user) {
    const candidate = await prisma.candidate.findFirst({
      where: { OR: [{ id: candidateId }, { candidateCode: candidateId }] }
    })
    if (!candidate) throw new AppError('Candidate not found', 404, 'NOT_FOUND')

    const isHrOrSuperAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role)

    return prisma.candidateNote.findMany({
      where: {
        candidateId: candidate.id,
        ...(isHrOrSuperAdmin ? {} : { isConfidential: false })
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async createCandidate(data, actorUserId) {
    const firstName = String(data.firstName || (data.fullName ? data.fullName.split(/\s+/)[0] : '')).trim()
    const lastName = String(data.lastName || (data.fullName ? data.fullName.split(/\s+/).slice(1).join(' ') : '') || '.').trim()
    const email = String(data.email || '').trim().toLowerCase()
    const phone = String(data.phone || '').trim()
    let openingId = String(data.openingId || data.vacancyId || data.jobOpeningId || '').trim()

    if (!firstName || !lastName || !email || !phone || !openingId) {
      throw new AppError(
        'First name, last name, email, phone and opening are required',
        400,
        'VALIDATION_FAILED'
      )
    }

    const sourceMap = {
      'LinkedIn Direct': 'LINKEDIN',
      'LinkedIn': 'LINKEDIN',
      'LINKEDIN': 'LINKEDIN',
      'Internal Referral': 'REFERRAL',
      'Employee Referral': 'REFERRAL',
      'REFERRAL': 'REFERRAL',
      'Rozee.pk': 'JOB_PORTAL',
      'Job Portal': 'JOB_PORTAL',
      'JOB_PORTAL': 'JOB_PORTAL',
      'Career Site': 'CAREERS_PAGE',
      'Careers Page': 'CAREERS_PAGE',
      'CAREERS_PAGE': 'CAREERS_PAGE',
      'Headhunted': 'DIRECT',
      'Direct': 'DIRECT',
      'DIRECT': 'DIRECT'
    }

    const source = sourceMap[data.source || 'DIRECT']
    if (!source) {
      throw new AppError('Invalid candidate source', 400, 'INVALID_CANDIDATE_SOURCE')
    }

    const experience = Number(data.totalExperienceYears ?? 0)
    if (!Number.isFinite(experience) || experience < 0) {
      throw new AppError('Invalid years of experience', 400, 'VALIDATION_FAILED')
    }

    const opening = await prisma.jobOpening.findFirst({
      where: {
        OR: [{ id: openingId }, { openingCode: openingId }]
      }
    })

    if (!opening) {
      throw new AppError('Selected vacancy not found', 404, 'OPENING_NOT_FOUND')
    }

    if (opening.status !== 'OPEN') {
      throw new AppError('Selected vacancy is not open', 400, 'OPENING_CLOSED')
    }

    const candidateCode =
      data.candidateCode ||
      await this._generateNextCode('candidate', 'CAND', 'candidateCode')

    return prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: {
          candidateCode,
          firstName,
          lastName,
          email,
          phone,
          currentCompany: data.currentCompany || null,
          currentDesignation: data.currentDesignation || null,
          totalExperienceYears: new Prisma.Decimal(experience),
          resumeUrl: data.resumeUrl || null,
          source
        }
      })

      const application = await tx.jobApplication.create({
        data: {
          openingId: opening.id,
          candidateId: candidate.id,
          status: 'APPLIED',
          stageNotes: 'Candidate application submitted'
        }
      })

      return {
        ...candidate,
        applications: [application]
      }
    })
  }


  // ============================================================================
  // 4. APPLICATIONS
  // ============================================================================

  async applyJob(openingId, candidateId, stageNotes) {
    const opening = await prisma.jobOpening.findUnique({ where: { id: openingId } })
    if (!opening) throw new AppError('Job opening not found', 404, 'NOT_FOUND')
    if (opening.status !== 'OPEN') throw new AppError('Job opening is not open for applications', 400, 'OPENING_CLOSED')

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) throw new AppError('Candidate not found', 404, 'NOT_FOUND')

    const existing = await prisma.jobApplication.findUnique({
      where: { openingId_candidateId: { openingId, candidateId } }
    })
    if (existing) throw new AppError('Candidate has already applied for this opening', 409, 'DUPLICATE_APPLICATION')

    return prisma.jobApplication.create({
      data: {
        openingId,
        candidateId,
        status: 'APPLIED',
        stageNotes: stageNotes || null
      },
      include: { opening: true, candidate: true }
    })
  }

  async updateApplicationStatus(applicationId, newStatus, stageNotes, actorUserId) {
    const application = await prisma.jobApplication.findUnique({ where: { id: applicationId } })
    if (!application) throw new AppError('Application not found', 404, 'NOT_FOUND')

    return prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        stageNotes: stageNotes !== undefined ? stageNotes : application.stageNotes
      }
    })
  }

  // ============================================================================
  // 5. INTERVIEW SCHEDULING & EVALUATION
  // ============================================================================

  async scheduleInterview(applicationId, data, actorUserId) {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { candidate: true }
    })
    if (!application) throw new AppError('Application not found', 404, 'NOT_FOUND')

    if (!data.interviewerId || !data.scheduledAt) {
      throw new AppError('Interviewer and Scheduled Date/Time are required', 400, 'VALIDATION_FAILED')
    }

    const interview = await prisma.interviewSchedule.create({
      data: {
        applicationId,
        interviewerId: data.interviewerId,
        roundNumber: Number(data.roundNumber) || 1,
        roundTitle: data.roundTitle || 'TECHNICAL',
        scheduledAt: new Date(data.scheduledAt),
        meetingLink: data.meetingLink || null,
        status: 'SCHEDULED'
      }
    })

    // Advance application status to INTERVIEWING if APPLIED/SCREENING
    if (['APPLIED', 'SCREENING'].includes(application.status)) {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status: 'INTERVIEWING' }
      })
    }

    return interview
  }

  async evaluateInterview(interviewId, data, actorUserId) {
    const interview = await prisma.interviewSchedule.findUnique({
      where: { id: interviewId },
      include: { application: true }
    })
    if (!interview) throw new AppError('Interview not found', 404, 'NOT_FOUND')

    const techScore = Number(data.technicalScore) || 0
    const commScore = Number(data.communicationScore) || 0
    const cultScore = Number(data.culturalFitScore) || 0

    // Average rating out of 5
    const overallRating = ((techScore + commScore + cultScore) / 3).toFixed(1)

    const evaluation = await prisma.interviewEvaluation.create({
      data: {
        interviewId,
        technicalScore: techScore,
        communicationScore: commScore,
        culturalFitScore: cultScore,
        overallRating: new Prisma.Decimal(overallRating),
        recommendation: data.recommendation || 'HOLD',
        strengths: data.strengths || null,
        weaknesses: data.weaknesses || null,
        notes: data.notes || null
      }
    })

    await prisma.interviewSchedule.update({
      where: { id: interviewId },
      data: { status: 'COMPLETED' }
    })

    return evaluation
  }

  async getInterviews(filters = {}) {
    const where = {}
    if (filters.status) where.status = filters.status
    return prisma.interviewSchedule.findMany({
      where,
      include: {
        application: {
          include: {
            candidate: true,
            opening: true
          }
        },
        evaluation: true
      },
      orderBy: { scheduledAt: 'desc' }
    })
  }

  async getJobOffers(filters = {}) {
    const where = {}
    if (filters.status) where.status = filters.status
    if (filters.candidateId) where.candidateId = filters.candidateId
    return prisma.jobOffer.findMany({
      where,
      include: {
        candidate: true,
        designation: true,
        application: {
          include: {
            opening: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  // ============================================================================
  // 6. OFFERS
  // ============================================================================

  async createJobOffer(applicationId, data, actorUserId) {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { candidate: true, offer: true }
    })
    if (!application) throw new AppError('Application not found', 404, 'NOT_FOUND')
    if (application.offer) throw new AppError('An offer already exists for this application', 409, 'OFFER_ALREADY_EXISTS')

    if (!data.designationId || !data.offeredGrossSalary || !data.offeredBaseSalary || !data.proposedJoiningDate) {
      throw new AppError('Designation, Gross Salary, Base Salary, and Proposed Joining Date are required', 400, 'VALIDATION_FAILED')
    }

    const offerNumber = data.offerNumber || await this._generateNextCode('jobOffer', 'OFF', 'offerNumber')

    const offer = await prisma.jobOffer.create({
      data: {
        offerNumber,
        applicationId,
        candidateId: application.candidateId,
        designationId: data.designationId,
        offeredGrossSalary: new Prisma.Decimal(data.offeredGrossSalary),
        offeredBaseSalary: new Prisma.Decimal(data.offeredBaseSalary),
        proposedJoiningDate: new Date(data.proposedJoiningDate),
        probationMonths: Number(data.probationMonths) || 3,
        status: 'DRAFT'
      }
    })

    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: 'OFFERED' }
    })

    return offer
  }

  async reviewJobOffer(offerId, { action, remarks }, actorUserId) {
    const offer = await prisma.jobOffer.findUnique({ where: { id: offerId } })
    if (!offer) throw new AppError('Job offer not found', 404, 'NOT_FOUND')

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'DECLINED'

    return prisma.jobOffer.update({
      where: { id: offerId },
      data: {
        status: newStatus,
        approvedById: actorUserId,
        sentAt: action === 'APPROVE' ? new Date() : null
      }
    })
  }

  async acceptJobOffer(offerId, acceptedAt) {
    const offer = await prisma.jobOffer.findUnique({ where: { id: offerId } })
    if (!offer) throw new AppError('Job offer not found', 404, 'NOT_FOUND')

    return prisma.jobOffer.update({
      where: { id: offerId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: acceptedAt ? new Date(acceptedAt) : new Date()
      }
    })
  }

  // ============================================================================
  // 7. HIRE CANDIDATE -> CANONICAL EMPLOYEE CONVERSION (IDEMPOTENT & AUTHORIZED)
  // ============================================================================

  async hireCandidateToEmployee(candidateId, data, actorUserId) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        offers: {
          where: { status: 'ACCEPTED' },
          include: { designation: true }
        }
      }
    })
    if (!candidate) throw new AppError('Candidate not found', 404, 'NOT_FOUND')

    // Idempotency: Candidate cannot be converted twice
    if (candidate.linkedEmployeeId) {
      const existingEmp = await prisma.employee.findUnique({ where: { id: candidate.linkedEmployeeId } })
      if (existingEmp) {
        throw new AppError(`Candidate already hired and converted to employee ${existingEmp.employeeCode}`, 409, 'ALREADY_CONVERTED')
      }
    }

    const acceptedOffer = candidate.offers[0]
    if (!acceptedOffer && !data.offerId) {
      throw new AppError('Candidate does not have an accepted job offer', 400, 'NO_ACCEPTED_OFFER')
    }

    const offer = acceptedOffer || await prisma.jobOffer.findUnique({ where: { id: data.offerId } })
    if (!offer) throw new AppError('Offer not found', 404, 'NOT_FOUND')

    const joiningDate = data.joiningDate ? new Date(data.joiningDate) : new Date(offer.proposedJoiningDate)
    const probationMonths = offer.probationMonths || 3
    const probationEndDate = new Date(joiningDate)
    probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths)

    // Generate Employee Code (e.g. EMP-019)
    const empCount = await prisma.employee.count()
    const employeeCode = data.employeeCode || `EMP-${String(empCount + 1).padStart(3, '0')}`

    const departmentId = data.departmentId || offer.designation?.departmentId || (await prisma.department.findFirst())?.id
    const designationId = offer.designationId

    // Execute in PostgreSQL transaction
    return prisma.$transaction(async (tx) => {
      // 1. Create canonical Employee
      const newEmployee = await tx.employee.create({
        data: {
          employeeCode,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          phone: candidate.phone,
          departmentId,
          designationId,
          employmentType: 'PERMANENT',
          employmentStatus: 'PROBATION',
          joiningDate,
          probationEndDate,
          workArrangement: 'OFFICE',
          payBasis: 'MONTHLY'
        }
      })

      // 2. Mark candidate linkedEmployeeId
      await tx.candidate.update({
        where: { id: candidateId },
        data: { linkedEmployeeId: newEmployee.id }
      })

      // 3. Mark offer linkedEmployeeId
      await tx.jobOffer.update({
        where: { id: offer.id },
        data: { linkedEmployeeId: newEmployee.id }
      })

      // 4. Mark application HIRED
      if (offer.applicationId) {
        await tx.jobApplication.update({
          where: { id: offer.applicationId },
          data: { status: 'HIRED' }
        })
      }

      // 5. Automatically seed Onboarding Checklist and Standard Tasks
      const checklistTarget = new Date(joiningDate)
      checklistTarget.setDate(checklistTarget.getDate() + 14) // 2-week onboarding target

      const checklist = await tx.onboardingChecklist.create({
        data: {
          employeeId: newEmployee.id,
          targetCompletionDate: checklistTarget,
          status: 'IN_PROGRESS'
        }
      })

      const defaultTasks = [
        { title: 'Submit CNIC, Degree and Relieving Letters', category: 'DOCUMENTATION' },
        { title: 'Configure Workstation & IT Credentials', category: 'IT_EQUIPMENT' },
        { title: 'Workspace Allocation & Access Keycard', category: 'WORKSPACE' },
        { title: 'HR & Corporate Policy Orientation', category: 'ORIENTATION' },
        { title: 'Health & Insurance Benefits Enrollment', category: 'BENEFITS' }
      ]

      for (const t of defaultTasks) {
        await tx.onboardingTask.create({
          data: {
            checklistId: checklist.id,
            title: t.title,
            category: t.category,
            dueDate: checklistTarget,
            isCompleted: false
          }
        })
      }

      // 6. Seed baseline SalaryStructure from approved offer
      await tx.salaryStructure.create({
        data: {
          employeeId: newEmployee.id,
          effectiveFrom: joiningDate,
          baseSalary: offer.offeredBaseSalary,
          grossSalary: offer.offeredGrossSalary,
          isCurrent: true
        }
      })

      return {
        employee: newEmployee,
        checklistId: checklist.id,
        message: `Candidate ${candidate.firstName} ${candidate.lastName} successfully hired as ${employeeCode}. Portal account creation remains an explicit administrative step.`
      }
    })
  }

  // ============================================================================
  // 8. ONBOARDING CHECKLISTS & TASKS
  // ============================================================================

  async getOnboardingChecklist(employeeId, user) {
    const checklist = await prisma.onboardingChecklist.findUnique({
      where: { employeeId },
      include: {
        tasks: {
          orderBy: { dueDate: 'asc' }
        }
      }
    })
    if (!checklist) throw new AppError('Onboarding checklist not found', 404, 'NOT_FOUND')
    return checklist
  }

  async updateOnboardingTask(taskId, { isCompleted }, actorUserId) {
    const task = await prisma.onboardingTask.findUnique({ where: { id: taskId } })
    if (!task) throw new AppError('Onboarding task not found', 404, 'NOT_FOUND')

    const updated = await prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        isCompleted: Boolean(isCompleted),
        completedAt: isCompleted ? new Date() : null,
        completedBy: isCompleted ? actorUserId : null
      }
    })

    // Check if all tasks completed
    const allTasks = await prisma.onboardingTask.findMany({ where: { checklistId: task.checklistId } })
    const allDone = allTasks.every((t) => t.isCompleted)

    if (allDone) {
      await prisma.onboardingChecklist.update({
        where: { id: task.checklistId },
        data: { status: 'COMPLETED' }
      })
    }

    return updated
  }
}

export default new RecruitmentService()
