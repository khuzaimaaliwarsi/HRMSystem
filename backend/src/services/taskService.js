/**
 * iSysware HRMS — Task Management Backend Service
 * PostgreSQL-backed service implementing:
 * - Task assignment across employee, team, department
 * - Role-scoped task queries (Employee, Team Lead, Manager, Super Admin)
 * - Status lifecycle, overdue tracking, and actual hours recording
 * - Activity logs, comments, and attachments metadata
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { Prisma } from '@prisma/client'

export class TaskService {
  _getActorDepartmentId(user) {
    return user?.departmentId || user?.employee?.departmentId || null
  }

  _getActorName(user) {
    if (!user) return 'System'
    const first = user.firstName || user.employee?.firstName || ''
    const last = user.lastName || user.employee?.lastName || ''
    const full = `${first} ${last}`.trim()
    return full || user.name || user.username || user.email || 'User'
  }

  _isSoftDeleted(task) {
    return Boolean(
      task?.attachments &&
      typeof task.attachments === 'object' &&
      !Array.isArray(task.attachments) &&
      (task.attachments.isDeleted === true || task.attachments.lifecycleState === 'DELETED')
    )
  }

  _assertDepartmentScope(task, actorUser, actionLabel = 'access') {
    if (actorUser?.role !== 'DEPT_MANAGER') return
    const actorDeptId = this._getActorDepartmentId(actorUser)
    const taskDeptId = task?.assignee?.departmentId || task?.teamId || null
    const sameDept = Boolean(actorDeptId && taskDeptId && actorDeptId === taskDeptId)
    if (!sameDept) {
      throw new AppError(
        `Access denied: Department Managers can only ${actionLabel} tasks within their own department.`,
        403,
        'FORBIDDEN'
      )
    }
  }

  _mapTaskOutput(t, now = new Date()) {
    const att = (t.attachments && typeof t.attachments === 'object' && !Array.isArray(t.attachments))
      ? t.attachments
      : {}
    return {
      ...t,
      progress: att.progress !== undefined
        ? Number(att.progress)
        : (t.status === 'COMPLETED' ? 100 : (t.status === 'IN_PROGRESS' ? 50 : 0)),
      isDeleted: this._isSoftDeleted(t),
      isOverdue: Boolean(t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
    }
  }

  async _generateTaskCode() {
    let seq = (await prisma.taskAssignment.count()) + 1
    // Guard against taskCode collisions if archived or historical codes skipped numbers
    for (let i = 0; i < 25; i++) {
      const candidate = `TSK-${String(seq + i).padStart(3, '0')}`
      const existing = await prisma.taskAssignment.findUnique({
        where: { taskCode: candidate },
        select: { id: true }
      })
      if (!existing) return candidate
    }
    return `TSK-${Date.now().toString().slice(-6)}`
  }

  async getTasks(filters = {}, user) {
    const where = {}
    if (filters.status && String(filters.status).toLowerCase() !== 'all') {
      const sNorm = String(filters.status).toUpperCase().replace(/[\s-]/g, '_')
      let mapped = filters.status
      if (['TODO', 'TO_DO'].includes(sNorm)) mapped = 'TODO'
      else if (['IN_PROGRESS', 'PROGRESS'].includes(sNorm)) mapped = 'IN_PROGRESS'
      else if (['UNDER_REVIEW', 'IN_REVIEW', 'REVIEW'].includes(sNorm)) mapped = 'UNDER_REVIEW'
      else if (sNorm === 'COMPLETED') mapped = 'COMPLETED'
      else if (sNorm === 'BLOCKED') mapped = 'BLOCKED'
      else if (sNorm === 'CANCELLED') mapped = 'CANCELLED'
      where.status = mapped
    }
    if (filters.priority && String(filters.priority).toLowerCase() !== 'all') {
      where.priority = String(filters.priority).toUpperCase()
    }

    const actorDeptId = this._getActorDepartmentId(user)
    const andConditions = []

    // Scoping rules
    if (user?.role === 'EMPLOYEE' && user?.employeeId) {
      andConditions.push({ assigneeId: user.employeeId })
    } else if (user?.role === 'TEAM_LEAD' && user?.employeeId) {
      andConditions.push({
        OR: [
          { assigneeId: user.employeeId },
          { assignedById: user.employeeId }
        ]
      })
    } else if (user?.role === 'DEPT_MANAGER') {
      if (actorDeptId) {
        andConditions.push({
          OR: [
            { assignee: { departmentId: actorDeptId } },
            { teamId: actorDeptId }
          ]
        })
      } else if (user?.employeeId) {
        andConditions.push({ assigneeId: user.employeeId })
      }
    }

    const targetAssignee = filters.assigneeId || filters.assignedToId
    if (targetAssignee && String(targetAssignee).toLowerCase() !== 'all') {
      andConditions.push({
        OR: [
          { assigneeId: targetAssignee },
          { assignee: { employeeCode: targetAssignee } }
        ]
      })
    }

    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    const tasks = await prisma.taskAssignment.findMany({
      where,
      include: {
        assignee: {
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
        assignedBy: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const includeDeleted = filters.includeDeleted === true || filters.includeDeleted === 'true'
    const activeTasks = includeDeleted ? tasks : tasks.filter((t) => !this._isSoftDeleted(t))

    const now = new Date()
    return activeTasks.map((t) => this._mapTaskOutput(t, now))
  }

  async getTaskById(id, user) {
    const task = await prisma.taskAssignment.findFirst({
      where: {
        OR: [
          { id },
          { taskCode: id }
        ]
      },
      include: {
        assignee: true,
        assignedBy: true
      }
    })
    if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND')

    if (user?.role === 'EMPLOYEE' && user?.employeeId && task.assigneeId !== user.employeeId) {
      throw new AppError('Access denied: You can only view your own assigned tasks', 403, 'FORBIDDEN')
    }
    if (user?.role === 'DEPT_MANAGER') {
      this._assertDepartmentScope(task, user, 'view')
    }

    return this._mapTaskOutput(task)
  }

  async createTask(data, actorUser) {
    const targetAssignee = data.assigneeId || data.assignedToId || data.employeeId
    if (!data.title || !targetAssignee) {
      throw new AppError('Title and Assignee are required', 400, 'VALIDATION_FAILED')
    }

    const assignee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: targetAssignee },
          { employeeCode: targetAssignee }
        ]
      }
    })
    if (!assignee) throw new AppError('Assignee employee not found', 404, 'NOT_FOUND')

    const taskCode = data.taskCode || await this._generateTaskCode()

    let priority = 'MEDIUM'
    if (data.priority) {
      const pUpper = String(data.priority).toUpperCase()
      if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(pUpper)) {
        priority = pUpper
      }
    }

    let status = 'TODO'
    if (data.status) {
      const sNorm = String(data.status).toUpperCase().replace(/[\s-]/g, '_')
      if (['TODO', 'TO_DO'].includes(sNorm)) status = 'TODO'
      else if (['IN_PROGRESS', 'PROGRESS'].includes(sNorm)) status = 'IN_PROGRESS'
      else if (['UNDER_REVIEW', 'IN_REVIEW', 'REVIEW'].includes(sNorm)) status = 'UNDER_REVIEW'
      else if (sNorm === 'COMPLETED') status = 'COMPLETED'
      else if (sNorm === 'BLOCKED') status = 'BLOCKED'
      else if (sNorm === 'CANCELLED') status = 'CANCELLED'
    }

    let assignedById = actorUser?.employee?.id || actorUser?.employeeId || null
    if (!assignedById && (data.assignedById || actorUser?.id)) {
      const delegatorTarget = data.assignedById || actorUser?.id
      const delegator = await prisma.employee.findFirst({
        where: {
          OR: [
            { id: delegatorTarget },
            { employeeCode: delegatorTarget }
          ]
        }
      })
      if (delegator) assignedById = delegator.id
    }

    const prog = Number(data.progress) || (status === 'COMPLETED' ? 100 : (status === 'IN_PROGRESS' ? 50 : 0))
    const attachments = (data.attachments && typeof data.attachments === 'object' && !Array.isArray(data.attachments))
      ? { ...data.attachments, progress: prog }
      : { progress: prog }

    const created = await prisma.taskAssignment.create({
      data: {
        taskCode,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        assigneeId: assignee.id,
        assignedById,
        teamId: data.teamId || assignee.departmentId || null,
        priority,
        status,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        estimatedHours: data.estimatedHours ? new Prisma.Decimal(Number(data.estimatedHours) || 8) : null,
        comments: Array.isArray(data.comments) ? data.comments : [],
        attachments
      },
      include: { assignee: true, assignedBy: true }
    })

    return {
      ...created,
      progress: prog,
      isOverdue: Boolean(created.dueDate && new Date(created.dueDate) < new Date() && created.status !== 'COMPLETED')
    }
  }

  async updateTask(id, data, actorUser) {
    const existing = await prisma.taskAssignment.findFirst({
      where: {
        OR: [
          { id },
          { taskCode: id }
        ]
      },
      include: { assignee: { select: { id: true, departmentId: true } } }
    })
    if (!existing) throw new AppError('Task not found', 404, 'NOT_FOUND')
    if (this._isSoftDeleted(existing)) {
      throw new AppError('Cannot modify a deleted/archived task.', 400, 'TASK_DELETED')
    }

    // Authorization check
    if (actorUser?.role === 'EMPLOYEE' && actorUser?.employeeId && existing.assigneeId !== actorUser.employeeId) {
      throw new AppError('Access denied: You can only update your own assigned tasks', 403, 'FORBIDDEN')
    }
    if (actorUser?.role === 'DEPT_MANAGER') {
      this._assertDepartmentScope(existing, actorUser, 'update')
    }

    const updatePayload = {}
    const currentAtt = (existing.attachments && typeof existing.attachments === 'object' && !Array.isArray(existing.attachments))
      ? existing.attachments
      : {}

    if (data.status) {
      const sNorm = String(data.status).toUpperCase().replace(/[\s-]/g, '_')
      if (sNorm === 'CANCELLED' && !['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'].includes(actorUser?.role)) {
        throw new AppError('Access denied: You are not authorized to cancel this task.', 403, 'FORBIDDEN')
      }
      let mappedStatus = data.status
      if (['TODO', 'TO_DO'].includes(sNorm)) mappedStatus = 'TODO'
      else if (['IN_PROGRESS', 'PROGRESS'].includes(sNorm)) mappedStatus = 'IN_PROGRESS'
      else if (['UNDER_REVIEW', 'IN_REVIEW', 'REVIEW'].includes(sNorm)) mappedStatus = 'UNDER_REVIEW'
      else if (sNorm === 'COMPLETED') mappedStatus = 'COMPLETED'
      else if (sNorm === 'BLOCKED') mappedStatus = 'BLOCKED'
      else if (sNorm === 'CANCELLED') mappedStatus = 'CANCELLED'

      if (mappedStatus === 'COMPLETED' && data.progress !== undefined && Number(data.progress) < 100) {
        throw new AppError('A task cannot be marked Completed with progress less than 100%.', 400, 'VALIDATION_FAILED')
      }

      updatePayload.status = mappedStatus
      if (mappedStatus === 'COMPLETED') {
        if (!existing.completedAt) updatePayload.completedAt = new Date()
        updatePayload.attachments = {
          ...currentAtt,
          progress: 100,
          verifiedById: currentAtt.verifiedById || actorUser?.id || null,
          verifiedByName: currentAtt.verifiedByName || this._getActorName(actorUser),
          verifiedAt: currentAtt.verifiedAt || new Date().toISOString()
        }
      } else {
        updatePayload.completedAt = null
      }
    }

    if (data.progress !== undefined) {
      const prog = Math.min(100, Math.max(0, Number(data.progress)))
      const attBase = updatePayload.attachments || currentAtt
      updatePayload.attachments = { ...attBase, progress: prog }
      if (!data.status) {
        if (prog === 100) {
          // Submitting at 100% moves task to review awaiting authorized Manager/Admin verification
          updatePayload.status = 'UNDER_REVIEW'
          updatePayload.completedAt = null
          updatePayload.attachments = {
            ...attBase,
            progress: 100,
            submittedForReviewAt: new Date().toISOString(),
            submittedForReviewById: actorUser?.id || null
          }
        } else {
          updatePayload.completedAt = null
          if (prog > 0 && ['TODO', 'COMPLETED', 'UNDER_REVIEW'].includes(existing.status)) {
            updatePayload.status = 'IN_PROGRESS'
          }
        }
      } else if (updatePayload.status === 'UNDER_REVIEW' && prog === 100) {
        updatePayload.attachments = {
          ...(updatePayload.attachments || currentAtt),
          progress: 100,
          submittedForReviewAt: new Date().toISOString(),
          submittedForReviewById: actorUser?.id || null
        }
      }
    } else if (updatePayload.status === 'UNDER_REVIEW') {
      updatePayload.attachments = {
        ...currentAtt,
        progress: 100,
        submittedForReviewAt: new Date().toISOString(),
        submittedForReviewById: actorUser?.id || null
      }
    }

    if (data.actualHours !== undefined || data.loggedHours !== undefined) {
      const hrs = data.actualHours !== undefined ? data.actualHours : data.loggedHours
      updatePayload.actualHours = new Prisma.Decimal(Number(hrs) || 0)
    }

    // Assignee reassignment or priority/deadline change only permitted for leads/managers/admins
    if (['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'].includes(actorUser?.role)) {
      if (data.assigneeId || data.assignedToId) {
        const targetAssignee = data.assigneeId || data.assignedToId
        const newAssignee = await prisma.employee.findFirst({
          where: {
            OR: [
              { id: targetAssignee },
              { employeeCode: targetAssignee }
            ]
          }
        })
        if (newAssignee) updatePayload.assigneeId = newAssignee.id
      }
      if (data.priority) {
        const pUpper = String(data.priority).toUpperCase()
        if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(pUpper)) {
          updatePayload.priority = pUpper
        }
      }
      if (data.dueDate) updatePayload.dueDate = new Date(data.dueDate)
      if (data.title) updatePayload.title = data.title.trim()
      if (data.description !== undefined) updatePayload.description = data.description
    }

    const updated = await prisma.taskAssignment.update({
      where: { id: existing.id },
      data: updatePayload,
      include: { assignee: true, assignedBy: true }
    })

    return this._mapTaskOutput(updated)
  }

  async submitForReview(id, data = {}, actorUser) {
    const existing = await prisma.taskAssignment.findFirst({
      where: { OR: [{ id }, { taskCode: id }] },
      include: { assignee: { select: { id: true, departmentId: true } } }
    })
    if (!existing) throw new AppError('Task not found', 404, 'NOT_FOUND')
    if (this._isSoftDeleted(existing)) throw new AppError('Cannot submit a deleted task.', 400, 'TASK_DELETED')
    if (actorUser?.role === 'EMPLOYEE' && actorUser?.employeeId && existing.assigneeId !== actorUser.employeeId) {
      throw new AppError('Access denied: You can only submit your own assigned tasks', 403, 'FORBIDDEN')
    }
    if (existing.status === 'CANCELLED') {
      throw new AppError('Cancelled tasks cannot be submitted for review.', 400, 'INVALID_STATUS')
    }

    const currentAtt = (existing.attachments && typeof existing.attachments === 'object' && !Array.isArray(existing.attachments))
      ? existing.attachments
      : {}
    const updated = await prisma.taskAssignment.update({
      where: { id: existing.id },
      data: {
        status: 'UNDER_REVIEW',
        completedAt: null,
        attachments: {
          ...currentAtt,
          progress: 100,
          submittedForReviewAt: new Date().toISOString(),
          submittedForReviewById: actorUser?.id || null,
          submittedNotes: data?.notes ? String(data.notes).trim() : (currentAtt.submittedNotes || null)
        }
      },
      include: {
        assignee: {
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
        assignedBy: true
      }
    })
    return this._mapTaskOutput(updated)
  }

  async verifyTaskCompletion(id, data = {}, actorUser, auditMeta = {}) {
    const role = String(actorUser?.role || '').toUpperCase()
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD'].includes(role)) {
      throw new AppError('Access denied: Only authorized Managers, Team Leads, or Admins can verify task completion.', 403, 'FORBIDDEN')
    }

    const existing = await prisma.taskAssignment.findFirst({
      where: { OR: [{ id }, { taskCode: id }] },
      include: {
        assignee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true } },
        assignedBy: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })
    if (!existing) throw new AppError('Task not found', 404, 'NOT_FOUND')
    if (this._isSoftDeleted(existing)) throw new AppError('Cannot verify a deleted task.', 400, 'TASK_DELETED')
    if (role === 'DEPT_MANAGER') {
      this._assertDepartmentScope(existing, actorUser, 'verify')
    }

    const action = String(data?.action || 'APPROVE').toUpperCase()
    const currentAtt = (existing.attachments && typeof existing.attachments === 'object' && !Array.isArray(existing.attachments))
      ? existing.attachments
      : {}
    const remarks = String(data?.remarks || '').trim()
    const now = new Date()

    const isApprove = action === 'APPROVE' || action === 'COMPLETE'
    const nextProgress = isApprove
      ? 100
      : Math.min(95, Math.max(0, Number(data?.progress ?? currentAtt.progress ?? 75)))

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.taskAssignment.update({
        where: { id: existing.id },
        data: {
          status: isApprove ? 'COMPLETED' : 'IN_PROGRESS',
          completedAt: isApprove ? now : null,
          attachments: {
            ...currentAtt,
            progress: nextProgress,
            verifiedById: isApprove ? (actorUser?.id || null) : null,
            verifiedByName: isApprove ? this._getActorName(actorUser) : null,
            verifiedAt: isApprove ? now.toISOString() : null,
            verificationRemarks: remarks || null
          }
        },
        include: {
          assignee: {
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
          assignedBy: true
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorEmployeeCode: actorUser?.employee?.employeeCode || null,
          actorRole: role || 'SYSTEM',
          sourceModule: 'TASKS',
          actionType: isApprove ? 'APPROVE' : 'REVISION_REQUESTED',
          entityName: 'TaskAssignment',
          entityId: existing.id,
          recordSnapshotBefore: existing,
          recordSnapshotAfter: saved,
          reasonOrNotes: remarks || (isApprove ? 'Task verified and marked Completed (100%)' : 'Returned for revision'),
          ipAddress: auditMeta.ipAddress || null
        }
      })
      return saved
    })

    return this._mapTaskOutput(updated, now)
  }

  async addComment(id, data, actorUser) {
    const task = await prisma.taskAssignment.findFirst({
      where: {
        OR: [
          { id },
          { taskCode: id }
        ]
      }
    })
    if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND')
    if (this._isSoftDeleted(task)) {
      throw new AppError('Cannot comment on a deleted/archived task.', 400, 'TASK_DELETED')
    }

    const commentBody = (data?.commentText || data?.text || data?.comment || '').trim()
    if (!commentBody) {
      throw new AppError('Comment text cannot be empty', 400, 'VALIDATION_FAILED')
    }

    const comments = Array.isArray(task.comments) ? [...task.comments] : []
    const authorName = this._getActorName(actorUser)
    const newComment = {
      id: `CMT-${Date.now()}`,
      authorName,
      author: authorName,
      authorRole: actorUser.role,
      authorId: actorUser.id,
      text: commentBody,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    }
    comments.push(newComment)

    return prisma.taskAssignment.update({
      where: { id: task.id },
      data: { comments }
    })
  }

  async _archiveOrCancelTask(id, reason, actorUser, mode = 'DELETE', auditMeta = {}) {
    const role = String(actorUser?.role || '').toUpperCase()
    const isDelete = mode === 'DELETE'

    if (isDelete) {
      if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(role)) {
        throw new AppError(
          'Access denied: Only Super Admin and HR Admin can delete tasks. Department Managers can cancel department-scoped tasks.',
          403,
          'FORBIDDEN'
        )
      }
    } else if (!['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'].includes(role)) {
      throw new AppError('Access denied: You are not authorized to cancel this task.', 403, 'FORBIDDEN')
    }

    const trimmedReason = String(reason || '').trim()
    if (trimmedReason.length < 3) {
      throw new AppError(
        `${isDelete ? 'Deletion' : 'Cancellation'} reason is required (minimum 3 characters).`,
        400,
        'VALIDATION_FAILED'
      )
    }

    const existing = await prisma.taskAssignment.findFirst({
      where: {
        OR: [
          { id },
          { taskCode: id }
        ]
      },
      include: {
        assignee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true } },
        assignedBy: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })
    if (!existing) throw new AppError('Task not found', 404, 'NOT_FOUND')

    if (this._isSoftDeleted(existing)) {
      throw new AppError('Task is already deleted/archived.', 409, 'ALREADY_DELETED')
    }
    if (!isDelete && existing.status === 'CANCELLED') {
      throw new AppError('Task is already cancelled.', 409, 'ALREADY_CANCELLED')
    }

    if (role === 'DEPT_MANAGER') {
      this._assertDepartmentScope(existing, actorUser, 'cancel')
    }

    const nowIso = new Date().toISOString()
    const actorName = this._getActorName(actorUser)
    const actorEmployeeCode = actorUser?.employee?.employeeCode || actorUser?.employeeId || null
    const existingAtt = (existing.attachments && typeof existing.attachments === 'object' && !Array.isArray(existing.attachments))
      ? existing.attachments
      : {}

    const lifecyclePatch = isDelete
      ? {
          isDeleted: true,
          archived: true,
          lifecycleState: 'DELETED',
          previousStatus: existing.status,
          deletedAt: nowIso,
          deletedById: actorUser?.id || null,
          deletedByEmployeeCode: actorEmployeeCode,
          deletedByName: actorName,
          deletedByRole: role,
          deletionReason: trimmedReason
        }
      : {
          isCancelled: true,
          lifecycleState: 'CANCELLED',
          previousStatus: existing.status,
          cancelledAt: nowIso,
          cancelledById: actorUser?.id || null,
          cancelledByEmployeeCode: actorEmployeeCode,
          cancelledByName: actorName,
          cancelledByRole: role,
          cancellationReason: trimmedReason
        }

    const nextAttachments = {
      ...existingAtt,
      ...lifecyclePatch
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.taskAssignment.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          attachments: nextAttachments
        },
        include: {
          assignee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true } },
          assignedBy: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          actorEmployeeCode,
          actorRole: role || 'SYSTEM',
          sourceModule: 'TASKS',
          actionType: isDelete ? 'DELETE' : 'CANCEL',
          entityName: 'TaskAssignment',
          entityId: existing.id,
          recordSnapshotBefore: existing,
          recordSnapshotAfter: saved,
          reasonOrNotes: trimmedReason,
          ipAddress: auditMeta.ipAddress || null
        }
      })

      return saved
    })

    return this._mapTaskOutput(updated)
  }

  async deleteTask(id, reason, actorUser, auditMeta = {}) {
    return this._archiveOrCancelTask(id, reason, actorUser, 'DELETE', auditMeta)
  }

  async cancelTask(id, reason, actorUser, auditMeta = {}) {
    return this._archiveOrCancelTask(id, reason, actorUser, 'CANCEL', auditMeta)
  }

  async getTaskHistory(user) {
    const role = String(user?.role || '').toUpperCase()
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'].includes(role)) {
      throw new AppError('Access denied: Unauthorized to inspect task audit history.', 403, 'FORBIDDEN')
    }

    const where = { status: 'CANCELLED' }
    if (role === 'DEPT_MANAGER') {
      const actorDeptId = this._getActorDepartmentId(user)
      if (!actorDeptId) {
        return []
      }
      where.OR = [
        { assignee: { departmentId: actorDeptId } },
        { teamId: actorDeptId }
      ]
    }

    const records = await prisma.taskAssignment.findMany({
      where,
      include: {
        assignee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true } },
        assignedBy: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      },
      orderBy: { updatedAt: 'desc' }
    })

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        sourceModule: 'TASKS',
        entityName: 'TaskAssignment',
        entityId: { in: records.map((r) => r.id) }
      },
      orderBy: { createdAt: 'desc' }
    })
    const logByEntity = new Map()
    for (const log of auditLogs) {
      if (!logByEntity.has(log.entityId)) logByEntity.set(log.entityId, log)
    }

    return records.map((r) => {
      const att = (r.attachments && typeof r.attachments === 'object' && !Array.isArray(r.attachments)) ? r.attachments : {}
      const log = logByEntity.get(r.id) || null
      return {
        ...this._mapTaskOutput(r),
        lifecycleState: att.lifecycleState || (this._isSoftDeleted(r) ? 'DELETED' : 'CANCELLED'),
        actorName: att.deletedByName || att.cancelledByName || log?.actorEmployeeCode || log?.actorRole || 'Authorized Admin',
        actorRole: att.deletedByRole || att.cancelledByRole || log?.actorRole || null,
        reason: att.deletionReason || att.cancellationReason || log?.reasonOrNotes || null,
        actionTimestamp: att.deletedAt || att.cancelledAt || log?.createdAt || r.updatedAt,
        auditLogId: log?.id || null
      }
    })
  }

  async getTaskStats(user) {
    const tasks = await this.getTasks({}, user)
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length
    const todo = tasks.filter((t) => t.status === 'TODO').length
    const overdue = tasks.filter((t) => t.isOverdue).length

    return {
      total,
      completed,
      inProgress,
      todo,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }
}

export default new TaskService()

