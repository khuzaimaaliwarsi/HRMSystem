/**
 * iSysware HRMS — Compensation & Salary Structure Service
 * Manages employee salary structures, allowances, effective-dated revisions,
 * and enforces strict anti-self-approval guards and salary confidentiality.
 */

import { prisma } from '../config/database.js'
import { Prisma } from '@prisma/client'
import adminSettingsService from './adminSettingsService.js'

/**
 * Safely parses calendar dates across format variants (DD/MM/YYYY, YYYY-MM-DD, ISO).
 * Decouples date parsing from local server timezones to prevent accidental 1-day rollbacks.
 */
export function parseCalendarDate(input) {
  if (!input) return null
  if (input instanceof Date) return input
  if (typeof input === 'string') {
    const s = input.trim()
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (dmy) {
      const [, day, month, year] = dmy
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    }
    // YYYY-MM-DD
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (ymd) {
      const [, year, month, day] = ymd
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    }
  }
  const d = new Date(input)
  return isNaN(d.getTime()) ? null : d
}

export const compensationService = {
  /**
   * Retrieves salary structures with privacy and organizational scoping.
   */
  async getSalaryStructures(filters = {}, requestingUser = null) {
    const where = {}

    if (filters.isCurrent !== undefined) {
      where.isCurrent = filters.isCurrent === 'true' || filters.isCurrent === true
    }
    if (filters.employeeId) {
      where.employeeId = filters.employeeId
    }

    // Role-based privacy scoping
    if (requestingUser) {
      if (requestingUser.role === 'EMPLOYEE') {
        if (!requestingUser.employee?.id) {
          return []
        }
        where.employeeId = requestingUser.employee.id
      } else if (requestingUser.role === 'DEPT_MANAGER' && requestingUser.employee?.departmentId) {
        where.employee = { departmentId: requestingUser.employee.departmentId }
      } else if (requestingUser.role === 'TEAM_LEAD' && requestingUser.employee?.teamId) {
        where.employee = { teamId: requestingUser.employee.teamId }
      }
    }

    const structures = await prisma.salaryStructure.findMany({
      where,
      orderBy: [{ isCurrent: 'desc' }, { effectiveFrom: 'desc' }],
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
            allowanceAllocations: {
              where: { isActive: true },
              include: { allowance: true }
            }
          }
        }
      }
    })

    return structures.map((s) => {
      const baseSalary = Number(s.baseSalary || 0)
      const houseRent = Number(s.houseRentAllowance || 0)
      const medical = Number(s.medicalAllowance || 0)
      const conveyance = Number(s.conveyanceAllowance || 0)
      const special = Number(s.specialAllowance || 0)
      const structureAllowances = houseRent + medical + conveyance + special

      // Dynamic allowances without double counting
      let dynamicAllowances = 0
      const now = new Date()
      for (const alloc of s.employee?.allowanceAllocations || []) {
        if (!alloc.isActive) continue
        if (alloc.effectiveUntil && new Date(alloc.effectiveUntil) < now) continue

        const code = String(alloc.allowance?.code || '').toUpperCase()
        const cat = String(alloc.allowance?.category || '').toUpperCase()

        // Double-counting prevention:
        if ((['RENT', 'HOUSE_RENT', 'HRA'].includes(code) || ['HOUSE_RENT_ALLOWANCE', 'HOUSE_RENT'].includes(cat)) && houseRent > 0) {
          continue
        }
        if ((['MED', 'MEDICAL'].includes(code) || cat === 'MEDICAL') && medical > 0) {
          continue
        }
        if ((['CONV', 'CONVEYANCE', 'TRANSPORT'].includes(code) || ['CONVEYANCE', 'TRANSPORT'].includes(cat)) && conveyance > 0) {
          continue
        }
        if ((code === 'SPECIAL' || cat === 'SPECIAL') && special > 0) {
          continue
        }

        dynamicAllowances += Number(alloc.amount || 0)
      }

      const totalAllowances = structureAllowances + dynamicAllowances
      const grossSalary = baseSalary + totalAllowances

      return {
        ...s,
        baseSalary,
        basicSalary: baseSalary,
        structureAllowances,
        dynamicAllowances,
        totalAllowances,
        grossSalary
      }
    })
  },

  /**
   * Retrieves single employee's salary history with privacy verification.
   */
  async getSalaryStructureByEmployeeId(employeeId, requestingUser = null) {
    if (!employeeId) {
      const error = new Error('Employee ID is required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    if (requestingUser?.role === 'EMPLOYEE' && requestingUser.employee?.id !== employeeId) {
      const error = new Error('Access denied: You are not authorized to view another employee’s compensation details.')
      error.code = 'FORBIDDEN'
      error.status = 403
      throw error
    }

    const structures = await prisma.salaryStructure.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      }
    })

    const current = structures.find((s) => s.isCurrent) || structures[0] || null

    return {
      current,
      history: structures
    }
  },

  /**
   * Creates or assigns a salary structure to an employee.
   * Automatically supersedes previously active structures.
   */
  async createSalaryStructure(data, actorUserId = null) {
    const {
      employeeId,
      currency = 'PKR',
      baseSalary,
      houseRentAllowance = 0,
      medicalAllowance = 0,
      conveyanceAllowance = 0,
      specialAllowance = 0,
      effectiveFrom,
      remarks
    } = data

    if (!employeeId || baseSalary === undefined || !effectiveFrom) {
      const error = new Error('employeeId, baseSalary, and effectiveFrom date are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      const error = new Error(`Employee with ID '${employeeId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const base = Number(baseSalary)
    const hra = Number(houseRentAllowance) || 0
    const med = Number(medicalAllowance) || 0
    const conv = Number(conveyanceAllowance) || 0
    const spec = Number(specialAllowance) || 0
    const gross = base + hra + med + conv + spec
    const effectiveDate = parseCalendarDate(effectiveFrom) || new Date(effectiveFrom)

    const createdStructure = await prisma.$transaction(async (tx) => {
      // Supersede any existing current structure for this employee
      await tx.salaryStructure.updateMany({
        where: {
          employeeId,
          isCurrent: true
        },
        data: {
          isCurrent: false,
          effectiveUntil: effectiveDate
        }
      })

      const newStructure = await tx.salaryStructure.create({
        data: {
          employeeId,
          currency,
          baseSalary: new Prisma.Decimal(base.toFixed(2)),
          houseRentAllowance: new Prisma.Decimal(hra.toFixed(2)),
          medicalAllowance: new Prisma.Decimal(med.toFixed(2)),
          conveyanceAllowance: new Prisma.Decimal(conv.toFixed(2)),
          specialAllowance: new Prisma.Decimal(spec.toFixed(2)),
          grossSalary: new Prisma.Decimal(gross.toFixed(2)),
          effectiveFrom: effectiveDate,
          isCurrent: true,
          approvedById: actorUserId,
          remarks: remarks?.trim() || null
        },
        include: {
          employee: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true }
          }
        }
      })

      return newStructure
    })

    return createdStructure
  },

  /**
   * Retrieves salary revision proposals.
   */
  async getSalaryRevisions(filters = {}, requestingUser = null) {
    const where = {}
    if (filters.status && filters.status.toLowerCase() !== 'all') {
      const s = String(filters.status).toUpperCase()
      if (s.includes('PENDING')) where.status = 'PENDING'
      else if (s.includes('APPROV')) where.status = 'APPROVED'
      else if (s.includes('REJECT')) where.status = 'REJECTED'
      else if (s.includes('RETURN')) where.status = 'RETURNED'
      else where.status = s
    }
    if (filters.employeeId) {
      where.OR = [
        { employeeId: filters.employeeId },
        { employee: { employeeCode: filters.employeeId } }
      ]
    }

    if (requestingUser) {
      if (requestingUser.role === 'EMPLOYEE') {
        if (!requestingUser.employee?.id) return []
        where.employeeId = requestingUser.employee.id
        where.status = 'APPROVED' // Employees only see finalized approved revisions
      } else if (requestingUser.role === 'DEPT_MANAGER' && requestingUser.employee?.departmentId) {
        where.employee = { departmentId: requestingUser.employee.departmentId }
      }
    }

    return prisma.salaryRevision.findMany({
      where,
      orderBy: { proposedAt: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        }
      }
    })
  },

  /**
   * Proposes a salary revision (Increment / Decrement / Market Adjustment).
   */
  async proposeSalaryRevision(data, actorUserId, requestingUser = null) {
    const {
      employeeId,
      proposedBaseSalary,
      proposedGrossSalary,
      proposedSalary,
      currentSalary,
      revisionType = 'ANNUAL_INCREMENT',
      effectiveDate,
      justification
    } = data

    const targetEmpId = employeeId || data.employeeCode
    const rawProposedBase = proposedBaseSalary !== undefined ? proposedBaseSalary : proposedSalary

    if (!targetEmpId || rawProposedBase === undefined || !effectiveDate) {
      const error = new Error('employeeId, proposedBaseSalary (or proposedSalary), and effectiveDate are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const proposedBase = Number(rawProposedBase)
    if (!Number.isFinite(proposedBase) || proposedBase <= 0) {
      const error = new Error('Proposed salary must be a positive number greater than zero.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    if (!justification || justification.trim().length < 5) {
      const error = new Error('Mandatory justification (minimum 5 characters) is required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: targetEmpId },
          { employeeCode: targetEmpId }
        ]
      },
      include: {
        salaryStructures: {
          where: { isCurrent: true },
          orderBy: { effectiveFrom: 'desc' },
          take: 1
        }
      }
    })

    if (!employee) {
      const error = new Error(`Employee '${targetEmpId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const currentStructure = employee.salaryStructures[0]
    const previousBase = currentStructure ? Number(currentStructure.baseSalary) : (Number(currentSalary) || 0)
    const previousGross = currentStructure ? Number(currentStructure.grossSalary) : previousBase

    let proposedGross
    if (proposedGrossSalary !== undefined && proposedGrossSalary !== null && Number(proposedGrossSalary) > 0) {
      proposedGross = Number(proposedGrossSalary)
    } else if (previousBase > 0) {
      const delta = proposedBase - previousBase
      proposedGross = previousGross + delta
    } else {
      proposedGross = proposedBase
    }

    let resolvedRevisionType = revisionType
    if (!['ANNUAL_INCREMENT', 'PROMOTION_INCREMENT', 'MARKET_ADJUSTMENT', 'PERFORMANCE_DECREMENT', 'OTHER'].includes(resolvedRevisionType)) {
      if (proposedBase >= previousBase) {
        resolvedRevisionType = 'ANNUAL_INCREMENT'
      } else {
        resolvedRevisionType = 'PERFORMANCE_DECREMENT'
      }
    }

    // Enforce POL-PAY-001: Salary Revision Governance Increment Cap
    if (previousBase > 0 && proposedBase > previousBase) {
      const incrementPct = ((proposedBase - previousBase) / previousBase) * 100
      try {
        const policies = await adminSettingsService.getCompanyPolicies()
        const payPolicy = policies.find((p) => p.id === 'POL-PAY-001')
        const cap = Number(payPolicy?.rules?.maxAnnualIncrementPercentage ?? 25)
        const requireBoardApproval = payPolicy?.rules?.requireBoardApprovalAboveCap !== false
        if (incrementPct > cap && requireBoardApproval) {
          const hasBoardApproval = Boolean(
            data.boardApproval === true ||
            data.boardApprovalRef ||
            /board\s+approval/i.test(justification || '')
          )
          if (!hasBoardApproval) {
            const error = new Error(
              `Proposed salary increment (${incrementPct.toFixed(1)}%) exceeds the annual policy cap of ${cap}%. Formal Board Approval reference is required.`
            )
            error.code = 'INCREMENT_EXCEEDS_ANNUAL_CAP'
            error.status = 400
            throw error
          }
        }
      } catch (err) {
        if (err.code === 'INCREMENT_EXCEEDS_ANNUAL_CAP') throw err
      }
    }

    const parsedEffectiveDate = parseCalendarDate(effectiveDate) || new Date(effectiveDate)

    // Generate revision number e.g. REV-2026-001 with collision prevention
    const year = parsedEffectiveDate.getFullYear()
    const countTotal = await prisma.salaryRevision.count()
    let seq = countTotal + 1
    let revisionNumber = `REV-${year}-${String(seq).padStart(3, '0')}`
    while (await prisma.salaryRevision.findUnique({ where: { revisionNumber } })) {
      seq++
      revisionNumber = `REV-${year}-${String(seq).padStart(3, '0')}`
    }

    const revision = await prisma.salaryRevision.create({
      data: {
        revisionNumber,
        employeeId: employee.id,
        previousBaseSalary: new Prisma.Decimal(previousBase.toFixed(2)),
        previousGrossSalary: new Prisma.Decimal(previousGross.toFixed(2)),
        proposedBaseSalary: new Prisma.Decimal(proposedBase.toFixed(2)),
        proposedGrossSalary: new Prisma.Decimal(proposedGross.toFixed(2)),
        revisionType: resolvedRevisionType,
        effectiveDate: parsedEffectiveDate,
        proposedById: actorUserId || 'cmw316bzw000fu8noerxd49tc',
        status: 'PENDING',
        justification: justification?.trim() || null
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        }
      }
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId || null,
        actorRole: requestingUser?.role || 'SUPER_ADMIN',
        sourceModule: 'PAYROLL',
        actionType: 'CREATE',
        entityName: 'SalaryRevision',
        entityId: revision.id,
        recordSnapshotAfter: {
          revisionNumber,
          employeeCode: employee.employeeCode,
          previousBaseSalary: previousBase,
          proposedBaseSalary: proposedBase,
          previousGrossSalary: previousGross,
          proposedGrossSalary: proposedGross,
          effectiveDate: parsedEffectiveDate.toISOString().slice(0, 10),
          status: 'PENDING',
          justification
        },
        reasonOrNotes: justification?.trim() || 'Salary revision proposed'
      }
    }).catch((err) => console.warn('[CompensationService] Proposal audit log warning:', err))

    return revision
  },

  /**
   * Reviews and approves/rejects/returns a salary revision.
   * Enforces Anti-Self-Approval for non-super-admin users.
   * On approval, automatically supersedes current structure and creates an updated current SalaryStructure.
   */
  async reviewSalaryRevision(revisionId, decision, reviewerUser, remarks = '') {
    const rawDecision = String(decision || '').toUpperCase()
    const normalizedDecision = rawDecision === 'RETURN' ? 'RETURNED' : rawDecision

    if (!['APPROVED', 'REJECTED', 'RETURNED'].includes(normalizedDecision)) {
      const error = new Error("Decision must be either 'APPROVED', 'REJECTED', or 'RETURNED'.")
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const revision = await prisma.salaryRevision.findUnique({
      where: { id: revisionId },
      include: {
        employee: {
          include: {
            salaryStructures: {
              where: { isCurrent: true },
              orderBy: { effectiveFrom: 'desc' },
              take: 1
            }
          }
        }
      }
    })

    if (!revision) {
      const error = new Error(`Salary revision '${revisionId}' not found.`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (revision.status !== 'PENDING') {
      const error = new Error(`Salary revision has already been processed with status '${revision.status}'.`)
      error.code = 'ALREADY_PROCESSED'
      error.status = 400
      throw error
    }

    // CRITICAL SECURITY GUARD: Anti-Self-Approval (bypassed for SUPER_ADMIN universal authority)
    const isSuperAdmin = String(reviewerUser?.role || '').toUpperCase() === 'SUPER_ADMIN'
    if (!isSuperAdmin && reviewerUser?.employee?.id && reviewerUser.employee.id === revision.employeeId) {
      const error = new Error('Anti-Self-Approval Violation: You cannot approve or reject your own salary revision proposal.')
      error.code = 'SELF_APPROVAL_PROHIBITED'
      error.status = 403
      throw error
    }

    // POL-PAY-001 Approval Authority Enforcement
    if (normalizedDecision === 'APPROVED') {
      try {
        const policies = await adminSettingsService.getCompanyPolicies()
        const payPolicy = policies.find((p) => p.id === 'POL-PAY-001')
        const requiredAuth = String(payPolicy?.rules?.salaryRevisionApprovalAuthority || 'SUPER_ADMIN').toUpperCase()
        const reviewerRole = String(reviewerUser?.role || '').toUpperCase()
        if (requiredAuth === 'SUPER_ADMIN' && reviewerRole !== 'SUPER_ADMIN') {
          const error = new Error('Salary revision approval authority is restricted exclusively to Super Admin under POL-PAY-001.')
          error.code = 'UNAUTHORIZED_AUTHORITY'
          error.status = 403
          throw error
        }
      } catch (err) {
        if (err.code === 'UNAUTHORIZED_AUTHORITY') throw err
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let createdStructure = null

      if (normalizedDecision === 'APPROVED') {
        const currentStruct = revision.employee.salaryStructures[0]

        // Supersede active structure
        await tx.salaryStructure.updateMany({
          where: {
            employeeId: revision.employeeId,
            isCurrent: true
          },
          data: {
            isCurrent: false,
            effectiveUntil: revision.effectiveDate
          }
        })

        const hra = currentStruct ? currentStruct.houseRentAllowance : new Prisma.Decimal(0)
        const med = currentStruct ? currentStruct.medicalAllowance : new Prisma.Decimal(0)
        const conv = currentStruct ? currentStruct.conveyanceAllowance : new Prisma.Decimal(0)
        const spec = currentStruct ? currentStruct.specialAllowance : new Prisma.Decimal(0)

        // Create new active structure
        createdStructure = await tx.salaryStructure.create({
          data: {
            employeeId: revision.employeeId,
            currency: 'PKR',
            baseSalary: revision.proposedBaseSalary,
            houseRentAllowance: hra,
            medicalAllowance: med,
            conveyanceAllowance: conv,
            specialAllowance: spec,
            grossSalary: revision.proposedGrossSalary,
            effectiveFrom: revision.effectiveDate,
            isCurrent: true,
            approvedById: reviewerUser?.id || null,
            remarks: `Activated via Salary Revision ${revision.revisionNumber}: ${remarks || 'Approved by Super Admin'}`
          }
        })
      }

      const updated = await tx.salaryRevision.update({
        where: { id: revisionId },
        data: {
          status: normalizedDecision,
          approvedById: reviewerUser?.id || null,
          approvedAt: new Date()
        },
        include: {
          employee: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true }
          }
        }
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId: reviewerUser?.id || null,
          actorRole: reviewerUser?.role || 'SUPER_ADMIN',
          sourceModule: 'PAYROLL',
          actionType: normalizedDecision === 'APPROVED' ? 'APPROVE' : (normalizedDecision === 'REJECTED' ? 'REJECT' : 'UPDATE'),
          entityName: 'SalaryRevision',
          entityId: revisionId,
          recordSnapshotBefore: {
            revisionNumber: revision.revisionNumber,
            status: revision.status
          },
          recordSnapshotAfter: {
            revisionNumber: revision.revisionNumber,
            status: normalizedDecision,
            approvedById: reviewerUser?.id || null,
            approvedAt: new Date().toISOString(),
            newStructureId: createdStructure?.id || null
          },
          reasonOrNotes: remarks || `Salary revision ${normalizedDecision.toLowerCase()} by Super Admin`
        }
      }).catch((err) => console.warn('[CompensationService] Review audit log warning:', err))

      return updated
    })

    return result
  },

  // ============================================================================
  // ALLOWANCE MASTER & EMPLOYEE ALLOCATIONS (POSTGRESQL INTEGRATION)
  // ============================================================================

  /**
   * Retrieves all corporate allowance master definitions.
   */
  async getAllowances(filters = {}) {
    const where = {}
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true' || filters.isActive === true
    }
    if (filters.category) {
      where.category = filters.category.toUpperCase()
    }

    return prisma.allowance.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { allocations: true } }
      }
    })
  },

  /**
   * Retrieves single corporate allowance by ID.
   */
  async getAllowanceById(id) {
    const allowance = await prisma.allowance.findUnique({
      where: { id },
      include: {
        allocations: {
          include: {
            employee: {
              select: { id: true, employeeCode: true, firstName: true, lastName: true }
            }
          }
        }
      }
    })

    if (!allowance) {
      const err = new Error(`Allowance with ID '${id}' not found.`)
      err.code = 'NOT_FOUND'
      err.status = 404
      throw err
    }

    return allowance
  },

  /**
   * Creates a new corporate allowance category.
   */
  async createAllowance(data, actorUserId = null) {
    const {
      code,
      name,
      category = 'GENERAL',
      description,
      defaultAmount = 0,
      isTaxable = true,
      isActive = true
    } = data

    if (!code || !name) {
      const err = new Error('Allowance code and name are required.')
      err.code = 'VALIDATION_ERROR'
      err.status = 400
      throw err
    }

    const formattedCode = code.trim().toUpperCase()
    const existing = await prisma.allowance.findUnique({ where: { code: formattedCode } })
    if (existing) {
      const err = new Error(`Allowance with code '${formattedCode}' already exists.`)
      err.code = 'DUPLICATE_RESOURCE'
      err.status = 409
      throw err
    }

    const parsedDefault = Number(defaultAmount) || 0

    return prisma.allowance.create({
      data: {
        code: formattedCode,
        name: name.trim(),
        category: category.trim().toUpperCase(),
        description: description?.trim() || null,
        defaultAmount: new Prisma.Decimal(parsedDefault.toFixed(2)),
        isTaxable: Boolean(isTaxable),
        isActive: Boolean(isActive)
      }
    })
  },

  /**
   * Updates an existing corporate allowance category.
   */
  async updateAllowance(id, data, actorUserId = null) {
    const allowance = await prisma.allowance.findUnique({ where: { id } })
    if (!allowance) {
      const err = new Error(`Allowance with ID '${id}' not found.`)
      err.code = 'NOT_FOUND'
      err.status = 404
      throw err
    }

    const updateData = {}
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.category !== undefined) updateData.category = data.category.trim().toUpperCase()
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.defaultAmount !== undefined) {
      const parsed = Number(data.defaultAmount) || 0
      updateData.defaultAmount = new Prisma.Decimal(parsed.toFixed(2))
    }
    if (data.isTaxable !== undefined) updateData.isTaxable = Boolean(data.isTaxable)
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive)

    return prisma.allowance.update({
      where: { id },
      data: updateData
    })
  },

  /**
   * Safely deactivates an allowance category (soft-delete to preserve audit integrity).
   */
  async deleteAllowance(id, actorUserId = null) {
    const allowance = await prisma.allowance.findUnique({ where: { id } })
    if (!allowance) {
      const err = new Error(`Allowance with ID '${id}' not found.`)
      err.code = 'NOT_FOUND'
      err.status = 404
      throw err
    }

    return prisma.allowance.update({
      where: { id },
      data: { isActive: false }
    })
  },

  /**
   * Retrieves employee allowance allocations with role-based privacy scoping.
   */
  async getEmployeeAllowances(filters = {}, requestingUser = null) {
    const where = {}

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true' || filters.isActive === true
    }
    if (filters.allowanceId) {
      where.allowanceId = filters.allowanceId
    }
    if (filters.employeeId) {
      const emp = await prisma.employee.findFirst({
        where: {
          OR: [{ id: filters.employeeId }, { employeeCode: filters.employeeId }]
        },
        select: { id: true }
      })
      where.employeeId = emp ? emp.id : filters.employeeId
    }

    // Role-based privacy scoping
    if (requestingUser) {
      if (requestingUser.role === 'EMPLOYEE') {
        if (!requestingUser.employee?.id) return []
        where.employeeId = requestingUser.employee.id
      } else if (requestingUser.role === 'DEPT_MANAGER' && requestingUser.employee?.departmentId) {
        where.employee = { departmentId: requestingUser.employee.departmentId }
      } else if (requestingUser.role === 'TEAM_LEAD' && requestingUser.employee?.teamId) {
        where.employee = { teamId: requestingUser.employee.teamId }
      }
    }

    const allocations = await prisma.employeeAllowance.findMany({
      where,
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      include: {
        allowance: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        }
      }
    })

    // Resolve approver details if approvedById is present
    const approvedByIds = [...new Set(allocations.map((a) => a.approvedById).filter(Boolean))]
    const approverMap = {}
    if (approvedByIds.length > 0) {
      const [users, emps] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: approvedByIds } },
          select: {
            id: true,
            displayName: true,
            username: true,
            role: true,
            employee: { select: { firstName: true, lastName: true, employeeCode: true } }
          }
        }),
        prisma.employee.findMany({
          where: { id: { in: approvedByIds } },
          select: { id: true, firstName: true, lastName: true, employeeCode: true }
        })
      ])

      users.forEach((u) => {
        const name = u.role === 'SUPER_ADMIN'
          ? (u.displayName || 'Super Admin')
          : (u.displayName || (u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.username))
        approverMap[u.id] = `${name} (${u.role})`
      })
      emps.forEach((e) => {
        approverMap[e.id] = `${e.firstName} ${e.lastName} (${e.employeeCode})`
      })
    }

    const now = new Date()

    const mapped = allocations.map((a) => {
      let computedStatus = 'Active'
      let revokedBy = null
      let revokedAt = null

      if (a.remarks && /\[Revoked by (.*?) on (.*?)\]/i.test(a.remarks)) {
        const match = a.remarks.match(/\[Revoked by (.*?) on (.*?)\]/i)
        if (match) {
          let revoker = match[1].trim()
          if (revoker.includes('|')) {
            revoker = revoker.split('|')[0].trim()
          }
          if (revoker.includes('Khuzaima Senior Developer')) {
            revoker = 'Super Admin (superadmin)'
          }
          revokedBy = revoker
          revokedAt = match[2].trim()
        }
      } else if (a.remarks && /Revoked/i.test(a.remarks)) {
        revokedBy = 'Super Admin (superadmin)'
        revokedAt = a.updatedAt
      }

      if (!a.isActive) {
        if (revokedBy || (a.remarks && /Revoked/i.test(a.remarks))) {
          computedStatus = 'Revoked'
        } else if (a.effectiveUntil && new Date(a.effectiveUntil) <= now) {
          computedStatus = 'Expired'
        } else {
          computedStatus = 'Revoked'
        }
      } else if (a.effectiveUntil && new Date(a.effectiveUntil) < now) {
        computedStatus = 'Expired'
      }

      const assignedBy = a.approvedById ? (approverMap[a.approvedById] || a.approvedById) : 'Super Admin'

      return {
        ...a,
        computedStatus,
        assignedBy,
        assignedAt: a.createdAt,
        revokedBy,
        revokedAt: revokedAt || (computedStatus === 'Revoked' ? a.updatedAt : null)
      }
    })

    if (filters.status && filters.status.toUpperCase() !== 'ALL') {
      const target = filters.status.toUpperCase()
      return mapped.filter((item) => item.computedStatus.toUpperCase() === target)
    }

    return mapped
  },

  /**
   * Allocates an allowance to an employee with effective-date overlap protection & audit trail.
   */
  async assignEmployeeAllowance(data, actorUser = null) {
    const {
      employeeId,
      allowanceId,
      amount,
      effectiveFrom,
      effectiveUntil,
      remarks
    } = data

    if (!employeeId || !allowanceId || amount === undefined || !effectiveFrom) {
      const err = new Error('employeeId, allowanceId, amount, and effectiveFrom date are required.')
      err.code = 'VALIDATION_ERROR'
      err.status = 400
      throw err
    }

    const parsedAmount = Number(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      const err = new Error('Amount must be a positive number.')
      err.code = 'VALIDATION_ERROR'
      err.status = 400
      throw err
    }

    // Resolve employee by CUID or employeeCode
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [{ id: employeeId }, { employeeCode: employeeId }]
      }
    })
    if (!employee) {
      const err = new Error(`Employee '${employeeId}' not found.`)
      err.code = 'NOT_FOUND'
      err.status = 404
      throw err
    }

    // Enforce eligibility at the canonical API/service layer, not only the UI.
    // Existing allocations and their audit history remain untouched.
    if (employee.employmentStatus !== 'ACTIVE') {
      const err = new Error(`Cannot assign an allowance to employee '${employee.employeeCode}' because employment status is '${employee.employmentStatus}'. Only ACTIVE employees are eligible.`)
      err.code = 'EMPLOYEE_NOT_ACTIVE'
      err.status = 403
      throw err
    }

    // Salary-first invariant: a new allowance requires an effective current salary structure.
    // Do not change or delete pre-existing allocations from before this rule.
    const validSalary = await prisma.salaryStructure.findFirst({
      where: {
        employeeId: employee.id,
        isCurrent: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }]
      },
      select: { id: true }
    })
    if (!validSalary) {
      const err = new Error(`Initial Salary Structure required for employee '${employee.employeeCode}' before assigning an allowance.`)
      err.code = 'SALARY_STRUCTURE_REQUIRED'
      err.status = 409
      throw err
    }

    // Resolve allowance by CUID or code
    const allowance = await prisma.allowance.findFirst({
      where: {
        OR: [{ id: allowanceId }, { code: allowanceId }]
      }
    })
    if (!allowance) {
      const err = new Error(`Allowance '${allowanceId}' not found.`)
      err.code = 'NOT_FOUND'
      err.status = 404
      throw err
    }

    if (!allowance.isActive) {
      const err = new Error(`Allowance '${allowance.name}' (${allowance.code}) is inactive and cannot be allocated.`)
      err.code = 'INACTIVE_ALLOWANCE'
      err.status = 400
      throw err
    }

    const newEffectiveDate = parseCalendarDate(effectiveFrom) || new Date(effectiveFrom)
    if (isNaN(newEffectiveDate.getTime())) {
      const err = new Error("Invalid 'effectiveFrom' date format.")
      err.code = 'VALIDATION_ERROR'
      err.status = 400
      throw err
    }

    const newEffectiveUntil = effectiveUntil ? (parseCalendarDate(effectiveUntil) || new Date(effectiveUntil)) : null
    if (newEffectiveUntil && newEffectiveUntil < newEffectiveDate) {
      const err = new Error("'effectiveUntil' cannot be earlier than 'effectiveFrom'.")
      err.code = 'VALIDATION_ERROR'
      err.status = 400
      throw err
    }

    // Effective-date overlap protection & supersede previously active allocation for this employee + allowance
    const allocation = await prisma.$transaction(async (tx) => {
      const existingActive = await tx.employeeAllowance.findMany({
        where: {
          employeeId: employee.id,
          allowanceId: allowance.id,
          isActive: true
        }
      })

      // Supersede active allocations
      for (const active of existingActive) {
        await tx.employeeAllowance.update({
          where: { id: active.id },
          data: {
            isActive: false,
            effectiveUntil: newEffectiveDate
          }
        })
      }

      return tx.employeeAllowance.create({
        data: {
          employeeId: employee.id,
          allowanceId: allowance.id,
          amount: new Prisma.Decimal(parsedAmount.toFixed(2)),
          effectiveFrom: newEffectiveDate,
          effectiveUntil: newEffectiveUntil,
          isActive: true,
          approvedById: actorUser?.id || actorUser?.employee?.id || null,
          remarks: remarks?.trim() || null
        },
        include: {
          allowance: true,
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
              designation: { select: { title: true } }
            }
          }
        }
      })
    })

    return allocation
  },

  /**
   * Updates an existing employee allowance allocation.
   */
  async updateEmployeeAllowance(id, data, actorUser = null) {
    const existing = await prisma.employeeAllowance.findUnique({ where: { id } })
    if (!existing) {
      const err = new Error(`Employee allowance allocation '${id}' not found.`)
      err.code = 'NOT_FOUND'
      err.status = 404
      throw err
    }

    // Re-activating a historical allocation must obey the same employment eligibility.
    if (data.isActive === true && !existing.isActive) {
      const employee = await prisma.employee.findUnique({
        where: { id: existing.employeeId },
        select: { employeeCode: true, employmentStatus: true }
      })
      if (!employee || employee.employmentStatus !== 'ACTIVE') {
        const err = new Error('Cannot reactivate an allowance unless its employee is ACTIVE.')
        err.code = 'EMPLOYEE_NOT_ACTIVE'
        err.status = 403
        throw err
      }
    }

    // Prevent direct API updates from bypassing salary-first and employment eligibility.
    if (data.isActive === true || data.amount !== undefined || data.effectiveFrom !== undefined || data.effectiveUntil !== undefined) {
      const employee = await prisma.employee.findUnique({ where: { id: existing.employeeId }, select: { id: true, employeeCode: true, employmentStatus: true } })
      if (!employee || employee.employmentStatus !== 'ACTIVE') {
        const err = new Error('Only ACTIVE employees may receive or modify payable allowances.')
        err.code = 'EMPLOYEE_NOT_ACTIVE'
        err.status = 403
        throw err
      }
      const validSalary = await prisma.salaryStructure.findFirst({
        where: {
          employeeId: employee.id,
          isCurrent: true,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }]
        },
        select: { id: true }
      })
      if (!validSalary) {
        const err = new Error(`Initial Salary Structure required for employee '${employee.employeeCode}' before allowance allocation changes.`)
        err.code = 'SALARY_STRUCTURE_REQUIRED'
        err.status = 409
        throw err
      }
    }

    const updateData = {}
    if (data.amount !== undefined) {
      const parsed = Number(data.amount)
      if (isNaN(parsed) || parsed <= 0) {
        const err = new Error('Amount must be a positive number.')
        err.code = 'VALIDATION_ERROR'
        err.status = 400
        throw err
      }
      updateData.amount = new Prisma.Decimal(parsed.toFixed(2))
    }
    if (data.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(data.effectiveFrom)
    if (data.effectiveUntil !== undefined) updateData.effectiveUntil = data.effectiveUntil ? new Date(data.effectiveUntil) : null
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive)
    if (data.remarks !== undefined) updateData.remarks = data.remarks?.trim() || null

    return prisma.employeeAllowance.update({
      where: { id },
      data: updateData,
      include: {
        allowance: true,
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      }
    })
  },

  /**
   * Revokes/deactivates an employee allowance allocation.
   */
  async revokeEmployeeAllowance(id, actorUser = null, remarks = null) {
    const existing = await prisma.employeeAllowance.findUnique({ where: { id } })
    if (!existing) {
      const err = new Error(`Employee allowance allocation '${id}' not found.`)
      err.code = 'NOT_FOUND'
      err.status = 404
      throw err
    }


    if (!actorUser?.id || !actorUser?.role) {
      const err = new Error(
        'Authenticated user identity and role are required for allowance revocation.'
      )
      err.code = 'UNAUTHORIZED'
      err.status = 401
      throw err
    }

    // Use actual authenticated portal user identity for audit attribution
    const actorRole = actorUser?.role || 'SUPER_ADMIN'
    const isSuperAdmin = actorRole === 'SUPER_ADMIN'
    const actorDisplayName = isSuperAdmin
      ? (actorUser?.displayName || 'Super Admin')
      : (actorUser?.displayName || (actorUser?.employee ? `${actorUser.employee.firstName} ${actorUser.employee.lastName}` : (actorUser?.username || 'Authorized User')))
    const actorUsername = actorUser?.username || (isSuperAdmin ? 'superadmin' : actorRole)
    const actorName = `${actorDisplayName} (${actorUsername})`

    const nowIso = new Date().toISOString()
    const actorId = actorUser?.id || 'UNKNOWN'
    const revocationAudit = `[Revoked by ${actorName} | userId:${actorId} | role:${actorRole} on ${nowIso}] Reason: ${remarks?.trim() || 'Administrative revocation'}`
    const updatedRemarks = existing.remarks ? `${existing.remarks}\n${revocationAudit}` : revocationAudit

    return prisma.employeeAllowance.update({
      where: { id },
      data: {
        isActive: false,
        effectiveUntil: new Date(),
        remarks: updatedRemarks
      },
      include: {
        allowance: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        }
      }
    })
  }
}

export default compensationService

