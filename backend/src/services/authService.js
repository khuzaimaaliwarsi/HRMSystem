/**
 * iSysware HRMS — Authentication & Session Management Service
 * Handles user authentication, Argon2id verification, session lifecycle,
 * refresh token rotation with replay detection, and protected Super Admin bootstrap.
 */

import { prisma } from '../config/database.js'
import env from '../config/env.js'
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashToken,
  validatePasswordStrength
} from '../utils/crypto.js'
import { generateAccessToken } from '../utils/jwt.js'

/**
 * Sanitizes user record for API responses (removes password hashes and internal metadata).
 * @param {object} user
 * @returns {object}
 */
export function sanitizeUser(user) {
  if (!user) return null
  const { passwordHash, failedLoginAttempts, lockedUntil, ...sanitized } = user
  return sanitized
}

/**
 * Creates an audit log entry for security and authentication events.
 */
async function logSecurityEvent({
  userId,
  employeeCode = null,
  role = 'SYSTEM',
  actionType,
  details = null,
  ipAddress = null,
  reason = null
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: userId || null,
        actorEmployeeCode: employeeCode,
        actorRole: role,
        sourceModule: 'AUTH',
        actionType,
        entityName: 'User',
        entityId: userId || 'anonymous',
        recordSnapshotAfter: details,
        reasonOrNotes: reason,
        ipAddress
      }
    })
  } catch (err) {
    // Non-blocking logger error fallback
    console.error('Failed to log security audit event:', err.message)
  }
}

export const authService = {
  /**
   * Authenticates user via username or email and establishes a new server-side session.
   */
  async login(identifier, password, reqMeta = {}) {
    if (!identifier || !password) {
      const error = new Error('Username/email and password are required')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    // Lookup user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier.trim(), mode: 'insensitive' } },
          { email: { equals: identifier.trim().toLowerCase(), mode: 'insensitive' } }
        ]
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            departmentId: true,
            teamId: true,
            reportingManagerId: true
          }
        }
      }
    })

    if (!user) {
      await logSecurityEvent({
        role: 'GUEST',
        actionType: 'LOGIN_FAILED',
        reason: `Failed login attempt for non-existent identifier: ${identifier.slice(0, 4)}***`,
        ipAddress: reqMeta.ipAddress
      })
      const error = new Error('Invalid username or password')
      error.code = 'INVALID_CREDENTIALS'
      error.status = 401
      throw error
    }

    // Account state check
    if (!user.isActive) {
      const error = new Error('Account is inactive. Please contact your HR administrator.')
      error.code = 'ACCOUNT_DISABLED'
      error.status = 403
      throw error
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      const error = new Error(`Account temporarily locked. Please try again in ${remainingMinutes} minute(s).`)
      error.code = 'ACCOUNT_LOCKED'
      error.status = 423 // Locked
      throw error
    }

    // Verify Argon2id password hash
    const isPasswordValid = await verifyPassword(user.passwordHash, password)

    if (!isPasswordValid) {
      const attempts = user.failedLoginAttempts + 1
      let lockUpdate = {}

      if (attempts >= 5) {
        // Lock account for 15 minutes after 5 consecutive failures
        lockUpdate = {
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000)
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          ...lockUpdate
        }
      })

      await logSecurityEvent({
        userId: user.id,
        employeeCode: user.employee?.employeeCode,
        role: user.role,
        actionType: 'LOGIN_FAILED',
        reason: `Invalid password. Attempt #${attempts}`,
        ipAddress: reqMeta.ipAddress
      })

      const error = new Error('Invalid username or password')
      error.code = 'INVALID_CREDENTIALS'
      error.status = 401
      throw error
    }

    // Reset failed attempts & update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date()
      }
    })

    // Generate cryptographically random refresh token (stored ONLY as SHA-256 hash)
    const rawRefreshToken = generateRandomToken(48)
    const tokenHash = hashToken(rawRefreshToken)
    const expiresAt = new Date(Date.now() + env.refreshTokenExpiryDays * 24 * 60 * 60 * 1000)

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceInfo: reqMeta.deviceInfo || 'Unknown Client',
        ipAddress: reqMeta.ipAddress || null,
        expiresAt
      }
    })

    // Generate short-lived signed JWT access token
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      employeeId: user.employeeId,
      email: user.email,
      username: user.username
    })

    await logSecurityEvent({
      userId: user.id,
      employeeCode: user.employee?.employeeCode,
      role: user.role,
      actionType: 'LOGIN_SUCCESS',
      reason: 'User successfully authenticated',
      ipAddress: reqMeta.ipAddress
    })

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken: rawRefreshToken,
      expiresAt
    }
  },

  /**
   * Refreshes access token with token rotation and replay/theft detection.
   */
  async refreshToken(rawRefreshToken, reqMeta = {}) {
    if (!rawRefreshToken) {
      const error = new Error('Refresh token is required')
      error.code = 'TOKEN_MISSING'
      error.status = 400
      throw error
    }

    const tokenHash = hashToken(rawRefreshToken)

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            employee: true
          }
        }
      }
    })

    // REPLAY / THEFT DETECTION:
    // If token exists but was already revoked, an attacker or compromised client is reusing a dead token!
    // Instantly invalidate ALL active sessions for this user as a safeguard.
    if (session && session.revokedAt) {
      await prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })

      await logSecurityEvent({
        userId: session.userId,
        role: session.user.role,
        actionType: 'TOKEN_THEFT_DETECTED',
        reason: 'Revoked refresh token presented. All active sessions invalidated.',
        ipAddress: reqMeta.ipAddress
      })

      const error = new Error('Invalid session. Please login again.')
      error.code = 'SESSION_REPLAY_DETECTED'
      error.status = 401
      throw error
    }

    if (!session || session.expiresAt < new Date()) {
      const error = new Error('Session has expired or is invalid. Please login again.')
      error.code = 'SESSION_EXPIRED'
      error.status = 401
      throw error
    }

    if (!session.user.isActive) {
      const error = new Error('Account is inactive')
      error.code = 'ACCOUNT_DISABLED'
      error.status = 403
      throw error
    }

    // TOKEN ROTATION: Revoke old session and issue new session
    const newRawRefreshToken = generateRandomToken(48)
    const newTokenHash = hashToken(newRawRefreshToken)
    const newExpiresAt = new Date(Date.now() + env.refreshTokenExpiryDays * 24 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() }
      }),
      prisma.session.create({
        data: {
          userId: session.userId,
          tokenHash: newTokenHash,
          deviceInfo: reqMeta.deviceInfo || session.deviceInfo,
          ipAddress: reqMeta.ipAddress || session.ipAddress,
          expiresAt: newExpiresAt
        }
      })
    ])

    const accessToken = generateAccessToken({
      userId: session.user.id,
      role: session.user.role,
      employeeId: session.user.employeeId,
      email: session.user.email,
      username: session.user.username
    })

    return {
      user: sanitizeUser(session.user),
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresAt: newExpiresAt
    }
  },

  /**
   * Revokes the current session upon logout.
   */
  async logout(rawRefreshToken, userId = null) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken)
      await prisma.session.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    }

    if (userId) {
      await logSecurityEvent({
        userId,
        actionType: 'LOGOUT',
        reason: 'User logged out'
      })
    }

    return { success: true }
  },

  /**
   * Revokes all active sessions for a user (e.g. from all devices).
   */
  async logoutAll(userId) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    })

    await logSecurityEvent({
      userId,
      actionType: 'LOGOUT_ALL',
      reason: 'All active sessions revoked'
    })

    return { success: true }
  },

  /**
   * Changes password with strength validation and verification of existing password.
   */
  async changePassword(userId, currentPassword, newPassword, reqMeta = {}) {
    const strength = validatePasswordStrength(newPassword)
    if (!strength.isValid) {
      const error = new Error(strength.message)
      error.code = 'WEAK_PASSWORD'
      error.status = 400
      throw error
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      const error = new Error('User not found')
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const isCurrentValid = await verifyPassword(user.passwordHash, currentPassword)
    if (!isCurrentValid) {
      const error = new Error('Current password does not match')
      error.code = 'INVALID_CREDENTIALS'
      error.status = 401
      throw error
    }

    const newPasswordHash = await hashPassword(newPassword)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      }),
      // Revoke all existing sessions for security
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ])

    await logSecurityEvent({
      userId,
      role: user.role,
      actionType: 'PASSWORD_CHANGE',
      reason: 'User successfully changed password',
      ipAddress: reqMeta.ipAddress
    })

    return { success: true, message: 'Password changed successfully' }
  },

  /**
   * Fetches the current authenticated user's profile with org/team context.
   */
  async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          include: {
            department: { select: { id: true, code: true, name: true } },
            team: { select: { id: true, code: true, name: true } },
            designation: { select: { id: true, code: true, title: true, level: true } },
            reportingManager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
            teamAssignments: {
              include: {
                team: { select: { id: true, code: true, name: true } }
              }
            }
          }
        }
      }
    })

    if (!user) {
      const error = new Error('User account not found')
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    return sanitizeUser(user)
  },

  /**
   * One-time, idempotent protected Super Admin bootstrap mechanism.
   * If a protected Super Admin already exists, returns existing status without modifying it.
   */
  async bootstrapSuperAdmin(config = env.bootstrapAdmin) {
    const username = config?.username || env.bootstrapAdmin.username || 'superadmin'
    const email = config?.email || env.bootstrapAdmin.email || 'superadmin@isysware.com'
    const password = config?.password || env.bootstrapAdmin.password || 'Admin123456!'

    // Check if this protected Super Admin already exists in the database
    const existingAdmin = await prisma.user.findFirst({
      where: {
        role: 'SUPER_ADMIN',
        isProtected: true,
        OR: [
          { username },
          { email }
        ]
      }
    })

    if (existingAdmin) {
      return {
        created: false,
        message: 'Protected Super Admin account already exists. Bootstrap skipped.',
        adminId: existingAdmin.id,
        username: existingAdmin.username
      }
    }

    const passwordHash = await hashPassword(password)

    const newAdmin = await prisma.user.create({
      data: {
        displayName: 'Super Admin',
        username,
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        isProtected: true,
        isActive: true
      }
    })

    await logSecurityEvent({
      userId: newAdmin.id,
      role: 'SUPER_ADMIN',
      actionType: 'BOOTSTRAP_ADMIN',
      reason: 'Protected initial Super Admin account provisioned successfully.'
    })

    return {
      created: true,
      message: 'Protected Super Admin account provisioned successfully.',
      adminId: newAdmin.id,
      username: newAdmin.username,
      email: newAdmin.email
    }
  }
}

export default authService

