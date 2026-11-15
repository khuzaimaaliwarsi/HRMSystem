/**
 * iSysware HRMS — Authentication & Server-Side RBAC Middleware
 * Enforces JWT verification, 5-portal role gates, organizational scope,
 * anti-self-approval guards, and protected Super Admin safeguards.
 */

import { verifyAccessToken } from '../utils/jwt.js'
import { prisma } from '../config/database.js'
import { sendError } from '../utils/response.js'

/**
 * Extracts and verifies JWT access token from Authorization header or HttpOnly cookie.
 * Attaches authenticated user object to req.user.
 */
export async function authenticate(req, res, next) {
  try {
    let token = null

    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token
    }

    if (!token) {
      return sendError(res, 'Authentication required. Please provide a valid Bearer token.', 'UNAUTHORIZED', null, 401)
    }

    const payload = verifyAccessToken(token)

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            departmentId: true,
            subDepartmentId: true,
            teamId: true,
            reportingManagerId: true,
            employmentStatus: true
          }
        }
      }
    })

    if (!user) {
      return sendError(res, 'User session not found or user account deleted.', 'UNAUTHORIZED', null, 401)
    }

    if (!user.isActive) {
      return sendError(res, 'Account is deactivated. Access denied.', 'ACCOUNT_DISABLED', null, 403)
    }

    // Attach verified user identity
    req.user = {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      role: user.role,
      isProtected: user.isProtected,
      employeeId: user.employeeId,
      employee: user.employee
    }

    next()
  } catch (err) {
    if (err.code === 'TOKEN_EXPIRED') {
      return sendError(res, 'Access token expired. Please refresh your session.', 'TOKEN_EXPIRED', null, 401)
    }
    return sendError(res, 'Invalid or malformed authentication token.', 'TOKEN_INVALID', null, 401)
  }
}

/**
 * Enforces Role-Based Access Control (RBAC).
 * Only users possessing one of the allowed roles are authorized.
 * @param {...string} allowedRoles - 'SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD', 'EMPLOYEE'
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 'UNAUTHORIZED', null, 401)
    }

    const normalizedUserRole = String(req.user.role || '').toUpperCase()
    const normalizedAllowedRoles = allowedRoles.map((r) => String(r).toUpperCase())
    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      return sendError(
        res,
        `Access denied. Role '${req.user.role}' is not authorized for this resource.`,
        'FORBIDDEN',
        { requiredRoles: allowedRoles, currentRole: req.user.role },
        403
      )
    }

    next()
  }
}

/**
 * Enforces that the authenticated user possesses an active linked employee record.
 * Used on self-service portals and personal endpoints (attendance punches, leaves, personal expenses)
 * so that unlinked administrative accounts (e.g. root Super Admin) cannot perform invalid self-service actions.
 */
export function requireLinkedEmployee(req, res, next) {
  if (!req.user) {
    return sendError(res, 'Authentication required', 'UNAUTHORIZED', null, 401)
  }

  const empId = req.user.employeeId || req.user.employee?.id
  if (!empId) {
    return sendError(
      res,
      'Employee Self-Service actions are restricted to accounts linked to an active employee record.',
      'UNLINKED_PORTAL_ACCOUNT',
      { userId: req.user.id, role: req.user.role },
      403
    )
  }

  if (req.user.employee && req.user.employee.employmentStatus !== 'ACTIVE') {
    return sendError(
      res,
      'Employee record is not in active employment status.',
      'EMPLOYEE_INACTIVE',
      { status: req.user.employee.employmentStatus },
      403
    )
  }

  next()
}




/**
 * Organizational Scope Verification:
 * Validates that the requester has jurisdiction over the target employee/resource.
 * - SUPER_ADMIN & HR_ADMIN: Company-wide scope.
 * - DEPT_MANAGER: Target employee must belong to manager's authorized department or direct reports.
 * - TEAM_LEAD: Target employee must belong to lead's assigned team(s) or direct reports.
 * - EMPLOYEE: Self-service only (targetEmployeeId === req.user.employeeId).
 */
export function requireEmployeeScope(getTargetEmployeeId = (req) => req.params.employeeId || req.body.employeeId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required', 'UNAUTHORIZED', null, 401)
      }

      const targetEmpId = getTargetEmployeeId(req)
      if (!targetEmpId) {
        // No target employee specified in request
        return next()
      }

      // Super Admin and HR Admin have company-wide authority
      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role)) {
        return next()
      }

      // Employee self-service
      if (req.user.role === 'EMPLOYEE') {
        const userEmpId = req.user.employee?.id || req.user.employeeId
        const userEmpCode = req.user.employee?.employeeCode
        if (targetEmpId !== userEmpId && targetEmpId !== userEmpCode && targetEmpId !== req.user.employeeId) {
          return sendError(res, 'Employees can only access their own records.', 'FORBIDDEN_SCOPE', null, 403)
        }
        return next()
      }

      // Department Manager / Team Lead Scope Resolution
      const targetEmployee = await prisma.employee.findFirst({
        where: { OR: [{ id: targetEmpId }, { employeeCode: targetEmpId }] },
        select: {
          id: true,
          departmentId: true,
          teamId: true,
          reportingManagerId: true
        }
      })

      if (!targetEmployee) {
        return sendError(res, 'Target employee not found', 'NOT_FOUND', null, 404)
      }

      // Allow if requester is direct reporting manager
      if (targetEmployee.reportingManagerId === req.user.employeeId) {
        return next()
      }

      if (req.user.role === 'DEPT_MANAGER') {
        // Must match manager's department
        if (req.user.employee?.departmentId === targetEmployee.departmentId) {
          return next()
        }
      } else if (req.user.role === 'TEAM_LEAD') {
        // Check assigned teams
        const leadAssignments = await prisma.teamAssignment.findMany({
          where: { employeeId: req.user.employeeId }
        })
        const assignedTeamIds = leadAssignments.map((a) => a.teamId)
        if (req.user.employee?.teamId) {
          assignedTeamIds.push(req.user.employee.teamId)
        }

        if (targetEmployee.teamId && assignedTeamIds.includes(targetEmployee.teamId)) {
          return next()
        }
      }

      return sendError(
        res,
        'Access denied. You do not have authority over this employee or team.',
        'FORBIDDEN_SCOPE',
        null,
        403
      )
    } catch (err) {
      next(err)
    }
  }
}

/**
 * Anti-Self-Approval Guard:
 * Strictly blocks an employee or supervisor from approving their own request.
 */
export function antiSelfApproval(getRequestOwnerEmployeeId = (req) => req.body.employeeId || req.targetRequest?.employeeId) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 'UNAUTHORIZED', null, 401)
    }

    if (String(req.user.role || '').toUpperCase() === 'SUPER_ADMIN') {
      return next()
    }

    const ownerEmployeeId = getRequestOwnerEmployeeId(req)
    if (ownerEmployeeId && req.user.employeeId === ownerEmployeeId) {
      return sendError(
        res,
        'Anti-Self-Approval: You cannot approve, endorse, or verify your own request.',
        'SELF_APPROVAL_PROHIBITED',
        null,
        403
      )
    }

    next()
  }
}

/**
 * Protected Super Admin Guard:
 * Prevents non-Super-Admin roles from mutating or deleting protected Super Admin accounts.
 * Also ensures the last active protected Super Admin account can never be deactivated or deleted.
 */
export function protectSuperAdminTarget(getTargetUserId = (req) => req.params.userId || req.body.userId) {
  return async (req, res, next) => {
    try {
      const targetUserId = getTargetUserId(req)
      if (!targetUserId) return next()

      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId }
      })

      if (!targetUser) {
        return sendError(res, 'Target user not found', 'NOT_FOUND', null, 404)
      }

      if (targetUser.isProtected) {
        // Only another protected Super Admin can modify a protected Super Admin
        if (req.user.role !== 'SUPER_ADMIN' || !req.user.isProtected) {
          return sendError(
            res,
            'Permission denied. Protected Super Admin accounts cannot be modified or demoted by this user.',
            'PROTECTED_ACCOUNT_VIOLATION',
            null,
            403
          )
        }

        // Check if an operation would deactivate or delete the last active protected Super Admin
        if (req.body.isActive === false || req.method === 'DELETE') {
          const activeProtectedAdminsCount = await prisma.user.count({
            where: {
              role: 'SUPER_ADMIN',
              isProtected: true,
              isActive: true,
              id: { not: targetUserId }
            }
          })

          if (activeProtectedAdminsCount === 0) {
            return sendError(
              res,
              'Operation blocked. At least one active protected Super Admin must remain in the system.',
              'LAST_ADMIN_PROTECTED',
              null,
              403
            )
          }
        }
      }

      next()
    } catch (err) {
      next(err)
    }
  }
}

