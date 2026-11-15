/**
 * iSysware HRMS — Sales Commissions & Employee Bonus Management Service
 * Comprehensive PostgreSQL-backed service for:
 * - Sales Commission Policy Plans (Percentage & Fixed Amount models, effective-dated)
 * - Commission Plan Assignments & Scope Governance
 * - Commission Deal/Invoice Recording with Duplicate Source Prevention
 * - Commission Review, Approval, Rejection & Reversal Lifecycle
 * - Employee Bonus Management (Performance, Milestone, Annual, Festival)
 * - Anti-Self-Approval & Role-Scoped Visibility
 * - Direct Integration with Monthly Payroll Calculations
 */

import { PrismaClient, Prisma } from '@prisma/client'
import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'

export class CommissionService {
  // ============================================================================
  // 1. COMMISSION PLANS (CRUD & POLICIES)
  // ============================================================================

  async getPlans(filters = {}, user = null) {
    const where = {}

    // Status filter
    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status.toUpperCase()
    }

    // Model filter
    if (filters.model && filters.model !== 'ALL') {
      where.model = filters.model.toUpperCase()
    }

    // Department filter
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      where.departmentId = filters.departmentId
    }

    // Role-based scoping for non-admins
    if (user && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
      const userDeptId = user.employee?.departmentId
      if (user.role === 'DEPT_MANAGER') {
        where.OR = [
          { departmentId: null },
          { departmentId: userDeptId }
        ]
      } else if (user.role === 'TEAM_LEAD') {
        where.OR = [
          { departmentId: null },
          { departmentId: userDeptId }
        ]
      } else if (user.role === 'EMPLOYEE') {
        const empId = user.employee?.id || user.employeeId
        where.OR = [
          { assignments: { some: { employeeId: empId } } },
          { departmentId: null },
          { departmentId: userDeptId }
        ]
      }
    }

    // Search filter
    if (filters.search?.trim()) {
      const q = filters.search.trim()
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
          ]
        }
      ]
    }

    const plans = await prisma.commissionPlan.findMany({
      where,
      include: {
        department: {
          select: { id: true, code: true, name: true }
        },
        assignments: {
          include: {
            employee: {
              select: { id: true, employeeCode: true, firstName: true, lastName: true }
            }
          }
        },
        _count: {
          select: { transactions: true }
        }
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    })

    return plans.map((p) => ({
      ...p,
      ratePercent: p.ratePercent ? Number(p.ratePercent) : null,
      fixedAmount: p.fixedAmount ? Number(p.fixedAmount) : null
    }))
  }

  async getPlanById(id, user = null) {
    const plan = await prisma.commissionPlan.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, code: true, name: true }
        },
        assignments: {
          include: {
            employee: {
              select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true }
            }
          }
        },
        _count: {
          select: { transactions: true }
        }
      }
    })

    if (!plan) {
      throw new AppError(`Commission plan '${id}' not found.`, 404, 'PLAN_NOT_FOUND')
    }

    return {
      ...plan,
      ratePercent: plan.ratePercent ? Number(plan.ratePercent) : null,
      fixedAmount: plan.fixedAmount ? Number(plan.fixedAmount) : null
    }
  }

  async createPlan(data, actorUser) {
    const {
      name,
      code,
      description,
      departmentId,
      model = 'PERCENTAGE',
      ratePercent,
      fixedAmount,
      qualifyingSource = 'COLLECTED_PAYMENT',
      effectiveFrom,
      effectiveTo,
      status = 'ACTIVE',
      employeeIds = []
    } = data

    if (!name?.trim()) {
      throw new AppError('Commission plan name is required.', 400, 'VALIDATION_ERROR')
    }

    const cleanModel = String(model).toUpperCase()
    if (!['PERCENTAGE', 'FIXED_AMOUNT'].includes(cleanModel)) {
      throw new AppError("Commission model must be either 'PERCENTAGE' or 'FIXED_AMOUNT'.", 400, 'INVALID_MODEL')
    }

    let parsedRate = null
    let parsedFixed = null

    if (cleanModel === 'PERCENTAGE') {
      parsedRate = Number(ratePercent)
      if (isNaN(parsedRate) || parsedRate <= 0 || parsedRate > 100) {
        throw new AppError('Percentage commission model requires a rate percent between 0.01% and 100%.', 400, 'INVALID_RATE')
      }
    } else {
      parsedFixed = Number(fixedAmount)
      if (isNaN(parsedFixed) || parsedFixed <= 0) {
        throw new AppError('Fixed amount commission model requires a positive payout amount in PKR.', 400, 'INVALID_FIXED_AMOUNT')
      }
    }

    const cleanSource = String(qualifyingSource).toUpperCase()
    if (!['COLLECTED_PAYMENT', 'ISSUED_INVOICE', 'QUALIFIED_DEAL'].includes(cleanSource)) {
      throw new AppError("Qualifying source must be 'COLLECTED_PAYMENT', 'ISSUED_INVOICE', or 'QUALIFIED_DEAL'.", 400, 'INVALID_SOURCE')
    }

    if (!effectiveFrom) {
      throw new AppError('Effective From date is required.', 400, 'VALIDATION_ERROR')
    }

    const startDate = new Date(effectiveFrom)
    const endDate = effectiveTo ? new Date(effectiveTo) : null
    if (endDate && endDate < startDate) {
      throw new AppError('Effective To date cannot precede Effective From date.', 400, 'INVALID_DATE_RANGE')
    }

    // Plan code generation / uniqueness
    let planCode = code?.trim().toUpperCase()
    if (!planCode) {
      const count = await prisma.commissionPlan.count()
      planCode = `CMP-${String(count + 1).padStart(3, '0')}`
    } else {
      const existing = await prisma.commissionPlan.findUnique({ where: { code: planCode } })
      if (existing) {
        throw new AppError(`A commission plan with code '${planCode}' already exists.`, 409, 'PLAN_EXISTS')
      }
    }

    const createdPlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.commissionPlan.create({
        data: {
          code: planCode,
          name: name.trim(),
          description: description?.trim() || null,
          departmentId: departmentId || null,
          model: cleanModel,
          ratePercent: parsedRate !== null ? new Prisma.Decimal(parsedRate.toFixed(2)) : null,
          fixedAmount: parsedFixed !== null ? new Prisma.Decimal(parsedFixed.toFixed(2)) : null,
          qualifyingSource: cleanSource,
          effectiveFrom: startDate,
          effectiveTo: endDate,
          status: status.toUpperCase(),
          createdById: actorUser?.id || null,
          approvedBy: actorUser?.displayName || actorUser?.username || 'Super Admin'
        }
      })

      if (Array.isArray(employeeIds) && employeeIds.length > 0) {
        const uniqueEmpIds = [...new Set(employeeIds.filter(Boolean))]
        await tx.commissionPlanAssignment.createMany({
          data: uniqueEmpIds.map((empId) => ({
            planId: plan.id,
            employeeId: empId
          }))
        })
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: 'COMMISSION_PLAN_CREATED',
          sourceModule: 'PAYROLL',
          entityName: 'CommissionPlan',
          entityId: plan.id,
          recordSnapshotAfter: {
            code: plan.code,
            name: plan.name,
            model: plan.model,
            ratePercent: parsedRate,
            fixedAmount: parsedFixed,
            status: plan.status
          }
        }
      })

      return plan
    })

    return this.getPlanById(createdPlan.id, actorUser)
  }

  async updatePlan(id, data, actorUser) {
    const existingPlan = await prisma.commissionPlan.findUnique({
      where: { id },
      include: { _count: { select: { transactions: true } } }
    })

    if (!existingPlan) {
      throw new AppError(`Commission plan '${id}' not found.`, 404, 'PLAN_NOT_FOUND')
    }

    const updateData = {}
    if (data.name) updateData.name = data.name.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null
    if (data.status) updateData.status = data.status.toUpperCase()

    // Model and rate updates
    if (data.model) {
      const cleanModel = data.model.toUpperCase()
      if (cleanModel !== existingPlan.model && existingPlan._count.transactions > 0) {
        throw new AppError('Cannot change the calculation model of a plan referenced by historical commission transactions.', 400, 'PLAN_IMMUTABLE_MODEL')
      }
      updateData.model = cleanModel
    }

    const effectiveModel = updateData.model || existingPlan.model

    if (data.ratePercent !== undefined) {
      if (effectiveModel === 'PERCENTAGE') {
        const rate = Number(data.ratePercent)
        if (isNaN(rate) || rate <= 0 || rate > 100) {
          throw new AppError('Percentage model requires a rate percent between 0.01% and 100%.', 400, 'INVALID_RATE')
        }
        updateData.ratePercent = new Prisma.Decimal(rate.toFixed(2))
        updateData.fixedAmount = null
      }
    }

    if (data.fixedAmount !== undefined) {
      if (effectiveModel === 'FIXED_AMOUNT') {
        const amt = Number(data.fixedAmount)
        if (isNaN(amt) || amt <= 0) {
          throw new AppError('Fixed amount model requires a positive payout amount in PKR.', 400, 'INVALID_FIXED_AMOUNT')
        }
        updateData.fixedAmount = new Prisma.Decimal(amt.toFixed(2))
        updateData.ratePercent = null
      }
    }

    if (data.qualifyingSource) {
      updateData.qualifyingSource = data.qualifyingSource.toUpperCase()
    }

    if (data.effectiveFrom) {
      updateData.effectiveFrom = new Date(data.effectiveFrom)
    }
    if (data.effectiveTo !== undefined) {
      updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null
    }

    const startDate = updateData.effectiveFrom || existingPlan.effectiveFrom
    const endDate = updateData.effectiveTo !== undefined ? updateData.effectiveTo : existingPlan.effectiveTo
    if (endDate && endDate < startDate) {
      throw new AppError('Effective To date cannot precede Effective From date.', 400, 'INVALID_DATE_RANGE')
    }

    await prisma.$transaction(async (tx) => {
      await tx.commissionPlan.update({
        where: { id },
        data: updateData
      })

      // Update employee assignments if explicitly provided
      if (Array.isArray(data.employeeIds)) {
        await tx.commissionPlanAssignment.deleteMany({ where: { planId: id } })
        const uniqueEmpIds = [...new Set(data.employeeIds.filter(Boolean))]
        if (uniqueEmpIds.length > 0) {
          await tx.commissionPlanAssignment.createMany({
            data: uniqueEmpIds.map((empId) => ({
              planId: id,
              employeeId: empId
            }))
          })
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: 'COMMISSION_PLAN_UPDATED',
          sourceModule: 'PAYROLL',
          entityName: 'CommissionPlan',
          entityId: id,
          recordSnapshotAfter: updateData
        }
      })
    })

    return this.getPlanById(id, actorUser)
  }

  async togglePlanStatus(id, newStatus, actorUser) {
    const cleanStatus = String(newStatus).toUpperCase()
    if (!['ACTIVE', 'INACTIVE', 'DRAFT'].includes(cleanStatus)) {
      throw new AppError("Invalid status. Allowed: 'ACTIVE', 'INACTIVE', 'DRAFT'.", 400, 'INVALID_STATUS')
    }

    const plan = await prisma.commissionPlan.update({
      where: { id },
      data: { status: cleanStatus }
    })

    await prisma.auditLog.create({
      data: {
        actorUserId: actorUser?.id || null,
        actorRole: actorUser?.role || 'SUPER_ADMIN',
        actionType: 'COMMISSION_PLAN_STATUS_CHANGED',
        sourceModule: 'PAYROLL',
        entityName: 'CommissionPlan',
        entityId: id,
        recordSnapshotAfter: { status: plan.status }
      }
    })

    return plan
  }

  async deletePlan(id, actorUser) {
    const plan = await prisma.commissionPlan.findUnique({
      where: { id },
      include: { _count: { select: { transactions: true } } }
    })

    if (!plan) {
      throw new AppError(`Commission plan '${id}' not found.`, 404, 'PLAN_NOT_FOUND')
    }

    if (plan._count.transactions > 0) {
      throw new AppError(
        `Cannot delete commission plan '${plan.name}' because it has ${plan._count.transactions} associated historical transactions. Deactivate the plan instead to preserve audit history.`,
        400,
        'CANNOT_DELETE_REFERENCED_PLAN'
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.commissionPlanAssignment.deleteMany({ where: { planId: id } })
      await tx.commissionPlan.delete({ where: { id } })

      await tx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: 'COMMISSION_PLAN_DELETED',
          sourceModule: 'PAYROLL',
          entityName: 'CommissionPlan',
          entityId: id,
          recordSnapshotBefore: { name: plan.name, code: plan.code }
        }
      })
    })

    return { success: true, message: `Commission plan '${plan.name}' permanently deleted.` }
  }

  // ============================================================================
  // 2. COMMISSION TRANSACTIONS (SUBLEDGER & DUPLICATE PREVENTION)
  // ============================================================================

  async getTransactions(filters = {}, user = null) {
    const where = {}

    if (filters.period && filters.period !== 'ALL') {
      where.period = filters.period
    }

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status.toUpperCase()
    }

    if (filters.planId && filters.planId !== 'ALL') {
      where.planId = filters.planId
    }

    if (filters.employeeId && filters.employeeId !== 'ALL') {
      where.employeeId = filters.employeeId
    }

    // Role-based scoping
    if (user && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
      if (user.role === 'EMPLOYEE') {
        const empId = user.employee?.id || user.employeeId
        where.employeeId = empId
      } else if (user.role === 'DEPT_MANAGER') {
        where.employee = { departmentId: user.employee?.departmentId }
      } else if (user.role === 'TEAM_LEAD') {
        where.employee = { teamId: user.employee?.teamId }
      }
    }

    if (filters.departmentId && filters.departmentId !== 'ALL') {
      where.employee = { ...where.employee, departmentId: filters.departmentId }
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim()
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { reference: { contains: q, mode: 'insensitive' } },
            { sourceRef: { contains: q, mode: 'insensitive' } },
            { clientDeal: { contains: q, mode: 'insensitive' } },
            { employee: { firstName: { contains: q, mode: 'insensitive' } } },
            { employee: { lastName: { contains: q, mode: 'insensitive' } } },
            { employee: { employeeCode: { contains: q, mode: 'insensitive' } } }
          ]
        }
      ]
    }

    const txs = await prisma.commissionTransaction.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } }
          }
        },
        plan: {
          select: { id: true, code: true, name: true, model: true, ratePercent: true, fixedAmount: true }
        },
        payrollRun: {
          select: { id: true, runNumber: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return txs.map((tx) => ({
      ...tx,
      dealAmount: Number(tx.dealAmount),
      ratePercentSnapshot: tx.ratePercentSnapshot ? Number(tx.ratePercentSnapshot) : null,
      fixedAmountSnapshot: tx.fixedAmountSnapshot ? Number(tx.fixedAmountSnapshot) : null,
      commissionAmount: Number(tx.commissionAmount)
    }))
  }

  async getTransactionById(id, user = null) {
    const tx = await prisma.commissionTransaction.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } }
          }
        },
        plan: true,
        payrollRun: {
          select: { id: true, runNumber: true, status: true }
        }
      }
    })

    if (!tx) {
      throw new AppError(`Commission transaction '${id}' not found.`, 404, 'TRANSACTION_NOT_FOUND')
    }

    return {
      ...tx,
      dealAmount: Number(tx.dealAmount),
      ratePercentSnapshot: tx.ratePercentSnapshot ? Number(tx.ratePercentSnapshot) : null,
      fixedAmountSnapshot: tx.fixedAmountSnapshot ? Number(tx.fixedAmountSnapshot) : null,
      commissionAmount: Number(tx.commissionAmount)
    }
  }

  async recordTransaction(data, actorUser) {
    const {
      employeeId,
      planId,
      sourceType = 'ISSUED_INVOICE',
      sourceRef,
      clientDeal,
      dealAmount,
      period = '2026-11',
      notes
    } = data

    if (!employeeId) throw new AppError('Sales employee is required.', 400, 'VALIDATION_ERROR')
    if (!planId) throw new AppError('Commission plan is required.', 400, 'VALIDATION_ERROR')
    if (!sourceRef?.trim()) throw new AppError('Qualifying source reference (Invoice / Deal ID) is required.', 400, 'VALIDATION_ERROR')
    if (!clientDeal?.trim()) throw new AppError('Client deal description is required.', 400, 'VALIDATION_ERROR')

    const cleanDealAmount = Number(dealAmount)
    if (isNaN(cleanDealAmount) || cleanDealAmount <= 0) {
      throw new AppError('Deal qualifying amount must be a positive number.', 400, 'INVALID_DEAL_AMOUNT')
    }

    const cleanPeriod = period?.trim()
    if (!/^\d{4}-\d{2}$/.test(cleanPeriod)) {
      throw new AppError("Payroll period must be in YYYY-MM format (e.g. '2026-11').", 400, 'INVALID_PERIOD')
    }

    // Verify employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, employmentStatus: true, departmentId: true }
    })
    if (!employee) throw new AppError('Employee not found.', 404, 'EMPLOYEE_NOT_FOUND')
    if (employee.employmentStatus !== 'ACTIVE') {
      throw new AppError('Commissions can only be recorded for ACTIVE employees.', 400, 'EMPLOYEE_NOT_ACTIVE')
    }

    // Verify plan
    const plan = await prisma.commissionPlan.findUnique({
      where: { id: planId }
    })
    if (!plan) throw new AppError('Commission plan not found.', 404, 'PLAN_NOT_FOUND')
    if (plan.status !== 'ACTIVE') {
      throw new AppError(`Commission plan '${plan.name}' is currently ${plan.status} and cannot accept new transactions.`, 400, 'PLAN_INACTIVE')
    }

    // Duplicate check on sourceRef: Prohibit multiple active/approved claims on the same sourceRef
    const cleanSourceRef = sourceRef.trim()
    const duplicate = await prisma.commissionTransaction.findFirst({
      where: {
        sourceRef: { equals: cleanSourceRef, mode: 'insensitive' },
        status: { notIn: ['REVERSED', 'REJECTED'] }
      }
    })
    if (duplicate) {
      throw new AppError(
        `Duplicate commission denied: Source reference '${cleanSourceRef}' has already been processed under transaction ${duplicate.reference}.`,
        409,
        'DUPLICATE_COMMISSION_SOURCE'
      )
    }

    // Calculate commission amount
    let rateSnapshot = null
    let fixedSnapshot = null
    let calculatedAmount = 0

    if (plan.model === 'PERCENTAGE') {
      rateSnapshot = Number(plan.ratePercent || 0)
      calculatedAmount = Math.round((cleanDealAmount * (rateSnapshot / 100)) * 100) / 100
    } else {
      fixedSnapshot = Number(plan.fixedAmount || 0)
      calculatedAmount = fixedSnapshot
    }

    // Auto-approve if created by Super Admin or HR Admin; otherwise SUBMITTED
    const isAdmin = actorUser && ['SUPER_ADMIN', 'HR_ADMIN'].includes(actorUser.role)
    const initialStatus = isAdmin ? 'APPROVED' : 'SUBMITTED'

    // Generate unique reference COMM-YYYYMM-XXX
    const periodDigits = cleanPeriod.replace(/-/g, '')
    const txCount = await prisma.commissionTransaction.count({
      where: { period: cleanPeriod }
    })
    const reference = `COMM-${periodDigits}-${String(txCount + 1).padStart(3, '0')}`

    const newTx = await prisma.$transaction(async (tx) => {
      const created = await tx.commissionTransaction.create({
        data: {
          reference,
          employeeId: employee.id,
          planId: plan.id,
          sourceType: sourceType.toUpperCase(),
          sourceRef: cleanSourceRef,
          clientDeal: clientDeal.trim(),
          dealAmount: new Prisma.Decimal(cleanDealAmount.toFixed(2)),
          ratePercentSnapshot: rateSnapshot !== null ? new Prisma.Decimal(rateSnapshot.toFixed(2)) : null,
          fixedAmountSnapshot: fixedSnapshot !== null ? new Prisma.Decimal(fixedSnapshot.toFixed(2)) : null,
          commissionAmount: new Prisma.Decimal(calculatedAmount.toFixed(2)),
          period: cleanPeriod,
          status: initialStatus,
          notes: notes?.trim() || null,
          createdById: actorUser?.id || null,
          approvedById: isAdmin ? actorUser.id : null,
          approvedAt: isAdmin ? new Date() : null
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: 'COMMISSION_TRANSACTION_RECORDED',
          sourceModule: 'PAYROLL',
          entityName: 'CommissionTransaction',
          entityId: created.id,
          recordSnapshotAfter: {
            reference: created.reference,
            employeeCode: employee.employeeCode,
            sourceRef: created.sourceRef,
            commissionAmount: calculatedAmount,
            status: created.status
          }
        }
      })

      return created
    })

    return this.getTransactionById(newTx.id, actorUser)
  }

  async updateTransactionStatus(id, { status, rejectionReason }, actorUser) {
    const cleanStatus = String(status).toUpperCase()
    if (!['APPROVED', 'REJECTED', 'SUBMITTED'].includes(cleanStatus)) {
      throw new AppError("Invalid transaction status update. Allowed: 'APPROVED', 'REJECTED', 'SUBMITTED'.", 400, 'INVALID_STATUS')
    }

    const tx = await prisma.commissionTransaction.findUnique({
      where: { id },
      include: { employee: true }
    })

    if (!tx) {
      throw new AppError(`Commission transaction '${id}' not found.`, 404, 'TRANSACTION_NOT_FOUND')
    }

    if (tx.status === 'POSTED_TO_PAYROLL') {
      throw new AppError('Cannot modify status of a commission that has already been posted to finalized payroll.', 400, 'POSTED_TRANSACTION_IMMUTABLE')
    }

    if (tx.status === 'REVERSED') {
      throw new AppError('Cannot modify status of a reversed transaction.', 400, 'REVERSED_TRANSACTION_IMMUTABLE')
    }

    // Anti-Self-Approval: Requester cannot approve their own commission
    if (cleanStatus === 'APPROVED' && actorUser?.employeeId && actorUser.employeeId === tx.employeeId) {
      throw new AppError('Anti-self-approval violation: An employee or supervisor cannot approve their own commission.', 403, 'ANTI_SELF_APPROVAL')
    }

    const updated = await prisma.$transaction(async (prismaTx) => {
      const updateData = {
        status: cleanStatus,
        approvedById: cleanStatus === 'APPROVED' ? actorUser?.id : null,
        approvedAt: cleanStatus === 'APPROVED' ? new Date() : null,
        rejectionReason: cleanStatus === 'REJECTED' ? rejectionReason || 'Rejected by management' : null
      }

      const res = await prismaTx.commissionTransaction.update({
        where: { id },
        data: updateData
      })

      await prismaTx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: `COMMISSION_${cleanStatus}`,
          sourceModule: 'PAYROLL',
          entityName: 'CommissionTransaction',
          entityId: id,
          recordSnapshotAfter: { status: cleanStatus, reason: rejectionReason }
        }
      })

      return res
    })

    return this.getTransactionById(updated.id, actorUser)
  }

  async reverseTransaction(id, { reason }, actorUser) {
    if (!reason?.trim()) {
      throw new AppError('A valid reversal justification or deal cancellation reason is required.', 400, 'REVERSAL_REASON_REQUIRED')
    }

    const tx = await prisma.commissionTransaction.findUnique({
      where: { id },
      include: { payrollRun: true }
    })

    if (!tx) {
      throw new AppError(`Commission transaction '${id}' not found.`, 404, 'TRANSACTION_NOT_FOUND')
    }

    if (tx.status === 'REVERSED') {
      throw new AppError(`Commission transaction '${tx.reference}' has already been reversed.`, 400, 'ALREADY_REVERSED')
    }

    // If already posted in a finalized disbursed payroll run, record reversal as an auditable adjustment
    const reversed = await prisma.$transaction(async (prismaTx) => {
      const updated = await prismaTx.commissionTransaction.update({
        where: { id },
        data: {
          status: 'REVERSED',
          reversalReason: reason.trim(),
          reversedAt: new Date(),
          reversedById: actorUser?.id || null,
          // If payroll run is not yet approved/disbursed, detach it
          payrollRunId: tx.payrollRun && ['APPROVED', 'DISBURSED'].includes(tx.payrollRun.status) ? tx.payrollRunId : null
        }
      })

      await prismaTx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: 'COMMISSION_TRANSACTION_REVERSED',
          sourceModule: 'PAYROLL',
          entityName: 'CommissionTransaction',
          entityId: id,
          recordSnapshotAfter: {
            reference: tx.reference,
            status: 'REVERSED',
            reason: reason.trim(),
            reversedAt: updated.reversedAt
          }
        }
      })

      return updated
    })

    return this.getTransactionById(reversed.id, actorUser)
  }

  // ============================================================================
  // 3. EMPLOYEE BONUSES
  // ============================================================================

  async getBonuses(filters = {}, user = null) {
    const where = {}

    if (filters.period && filters.period !== 'ALL') {
      where.period = filters.period
    }

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status.toUpperCase()
    }

    if (filters.bonusType && filters.bonusType !== 'ALL') {
      where.bonusType = filters.bonusType.toUpperCase()
    }

    if (filters.employeeId && filters.employeeId !== 'ALL') {
      where.employeeId = filters.employeeId
    }

    // Role-based scoping
    if (user && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
      if (user.role === 'EMPLOYEE') {
        const empId = user.employee?.id || user.employeeId
        where.employeeId = empId
      } else if (user.role === 'DEPT_MANAGER') {
        where.employee = { departmentId: user.employee?.departmentId }
      } else if (user.role === 'TEAM_LEAD') {
        where.employee = { teamId: user.employee?.teamId }
      }
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim()
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { bonusNumber: { contains: q, mode: 'insensitive' } },
            { reason: { contains: q, mode: 'insensitive' } },
            { employee: { firstName: { contains: q, mode: 'insensitive' } } },
            { employee: { lastName: { contains: q, mode: 'insensitive' } } },
            { employee: { employeeCode: { contains: q, mode: 'insensitive' } } }
          ]
        }
      ]
    }

    const bonuses = await prisma.bonusTransaction.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } }
          }
        },
        payrollRun: {
          select: { id: true, runNumber: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return bonuses.map((b) => ({
      ...b,
      amount: Number(b.amount)
    }))
  }

  async createBonus(data, actorUser) {
    const {
      employeeId,
      bonusType = 'PERFORMANCE',
      amount,
      reason,
      period = '2026-11'
    } = data

    if (!employeeId) throw new AppError('Employee is required for bonus allocation.', 400, 'VALIDATION_ERROR')
    if (!reason?.trim()) throw new AppError('Bonus justification/reason is required.', 400, 'VALIDATION_ERROR')

    const cleanAmount = Number(amount)
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      throw new AppError('Bonus amount must be a positive number.', 400, 'INVALID_AMOUNT')
    }

    const cleanPeriod = period?.trim()
    if (!/^\d{4}-\d{2}$/.test(cleanPeriod)) {
      throw new AppError("Payroll period must be in YYYY-MM format (e.g. '2026-11').", 400, 'INVALID_PERIOD')
    }

    const VALID_BONUS_TYPES = ['PERFORMANCE', 'ANNUAL', 'SIGNING', 'FESTIVAL', 'SPECIAL_RECOGNITION', 'PROJECT_MILESTONE', 'OTHER']
    const cleanType = String(bonusType).toUpperCase()
    if (!VALID_BONUS_TYPES.includes(cleanType)) {
      throw new AppError(`Invalid bonus type. Allowed: ${VALID_BONUS_TYPES.join(', ')}`, 400, 'INVALID_BONUS_TYPE')
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, employmentStatus: true }
    })
    if (!employee) throw new AppError('Employee not found.', 404, 'EMPLOYEE_NOT_FOUND')
    if (employee.employmentStatus !== 'ACTIVE') {
      throw new AppError('Bonuses can only be allocated to ACTIVE employees.', 400, 'EMPLOYEE_NOT_ACTIVE')
    }

    const isAdmin = actorUser && ['SUPER_ADMIN', 'HR_ADMIN'].includes(actorUser.role)
    const initialStatus = isAdmin ? 'APPROVED' : 'SUBMITTED'

    const periodDigits = cleanPeriod.replace(/-/g, '')
    const bonusCount = await prisma.bonusTransaction.count({
      where: { period: cleanPeriod }
    })
    const bonusNumber = `BON-${periodDigits}-${String(bonusCount + 1).padStart(3, '0')}`

    const newBonus = await prisma.$transaction(async (tx) => {
      const created = await tx.bonusTransaction.create({
        data: {
          bonusNumber,
          employeeId: employee.id,
          bonusType: cleanType,
          amount: new Prisma.Decimal(cleanAmount.toFixed(2)),
          reason: reason.trim(),
          period: cleanPeriod,
          status: initialStatus,
          createdById: actorUser?.id || null,
          approvedById: isAdmin ? actorUser.id : null,
          approvedAt: isAdmin ? new Date() : null
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: 'BONUS_ALLOCATED',
          sourceModule: 'PAYROLL',
          entityName: 'BonusTransaction',
          entityId: created.id,
          recordSnapshotAfter: {
            bonusNumber: created.bonusNumber,
            employeeCode: employee.employeeCode,
            bonusType: created.bonusType,
            amount: cleanAmount,
            status: created.status
          }
        }
      })

      return created
    })

    const result = await prisma.bonusTransaction.findUnique({
      where: { id: newBonus.id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } }
          }
        }
      }
    })

    return { ...result, amount: Number(result.amount) }
  }

  async updateBonusStatus(id, { status, rejectionReason }, actorUser) {
    const cleanStatus = String(status).toUpperCase()
    if (!['APPROVED', 'REJECTED', 'SUBMITTED'].includes(cleanStatus)) {
      throw new AppError("Invalid bonus status update. Allowed: 'APPROVED', 'REJECTED', 'SUBMITTED'.", 400, 'INVALID_STATUS')
    }

    const bonus = await prisma.bonusTransaction.findUnique({
      where: { id }
    })

    if (!bonus) {
      throw new AppError(`Bonus transaction '${id}' not found.`, 404, 'BONUS_NOT_FOUND')
    }

    if (bonus.status === 'POSTED_TO_PAYROLL') {
      throw new AppError('Cannot modify status of a bonus that has already been posted to finalized payroll.', 400, 'POSTED_BONUS_IMMUTABLE')
    }

    // Anti-Self-Approval
    if (cleanStatus === 'APPROVED' && actorUser?.employeeId && actorUser.employeeId === bonus.employeeId) {
      throw new AppError('Anti-self-approval violation: An employee or supervisor cannot approve their own bonus.', 403, 'ANTI_SELF_APPROVAL')
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateData = {
        status: cleanStatus,
        approvedById: cleanStatus === 'APPROVED' ? actorUser?.id : null,
        approvedAt: cleanStatus === 'APPROVED' ? new Date() : null,
        rejectionReason: cleanStatus === 'REJECTED' ? rejectionReason || 'Rejected by management' : null
      }

      const res = await tx.bonusTransaction.update({
        where: { id },
        data: updateData
      })

      await tx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: `BONUS_${cleanStatus}`,
          sourceModule: 'PAYROLL',
          entityName: 'BonusTransaction',
          entityId: id,
          recordSnapshotAfter: { status: cleanStatus, reason: rejectionReason }
        }
      })

      return res
    })

    const result = await prisma.bonusTransaction.findUnique({
      where: { id: updated.id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } }
          }
        }
      }
    })

    return { ...result, amount: Number(result.amount) }
  }

  // ============================================================================
  // 4. METRICS & SUMMARY
  // ============================================================================

  async getSummary(filters = {}, user = null) {
    const whereTx = {}
    const whereBonus = {}

    if (filters.period && filters.period !== 'ALL') {
      whereTx.period = filters.period
      whereBonus.period = filters.period
    }

    if (user && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
      const empId = user.employee?.id || user.employeeId
      if (user.role === 'EMPLOYEE') {
        whereTx.employeeId = empId
        whereBonus.employeeId = empId
      } else if (user.role === 'DEPT_MANAGER') {
        whereTx.employee = { departmentId: user.employee?.departmentId }
        whereBonus.employee = { departmentId: user.employee?.departmentId }
      }
    }

    const [allTxs, allBonuses, activePlansCount] = await Promise.all([
      prisma.commissionTransaction.findMany({
        where: whereTx,
        select: { commissionAmount: true, status: true }
      }),
      prisma.bonusTransaction.findMany({
        where: whereBonus,
        select: { amount: true, status: true }
      }),
      prisma.commissionPlan.count({ where: { status: 'ACTIVE' } })
    ])

    let totalPendingCommission = 0
    let totalApprovedCommission = 0
    let totalPostedCommission = 0
    let totalReversedCommission = 0

    for (const tx of allTxs) {
      const amt = Number(tx.commissionAmount)
      if (['SUBMITTED', 'DRAFT'].includes(tx.status)) totalPendingCommission += amt
      else if (tx.status === 'APPROVED') totalApprovedCommission += amt
      else if (tx.status === 'POSTED_TO_PAYROLL') totalPostedCommission += amt
      else if (tx.status === 'REVERSED') totalReversedCommission += amt
    }

    let totalApprovedBonuses = 0
    let totalPendingBonuses = 0
    for (const b of allBonuses) {
      const amt = Number(b.amount)
      if (['APPROVED', 'POSTED_TO_PAYROLL'].includes(b.status)) totalApprovedBonuses += amt
      else if (['SUBMITTED', 'DRAFT'].includes(b.status)) totalPendingBonuses += amt
    }

    return {
      totalPendingCommission: Math.round(totalPendingCommission * 100) / 100,
      totalApprovedCommission: Math.round(totalApprovedCommission * 100) / 100,
      totalPostedCommission: Math.round(totalPostedCommission * 100) / 100,
      totalReversedCommission: Math.round(totalReversedCommission * 100) / 100,
      totalApprovedBonuses: Math.round(totalApprovedBonuses * 100) / 100,
      totalPendingBonuses: Math.round(totalPendingBonuses * 100) / 100,
      activePlansCount,
      totalTransactionsCount: allTxs.length,
      totalBonusesCount: allBonuses.length
    }
  }
}

export const commissionService = new CommissionService()
export default commissionService
