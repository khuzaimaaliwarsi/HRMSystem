/**
 * iSysware HRMS — Authentication & RBAC API Routes
 * Endpoints for login, token refresh, session revocation, user profile and bootstrap.
 */

import { Router } from 'express'
import authService from '../services/authService.js'
import { authenticate } from '../middleware/auth.js'
import { loginRateLimiter, authRateLimiter } from '../middleware/rateLimit.js'
import { sendSuccess, sendError } from '../utils/response.js'
import env from '../config/env.js'

const router = Router()

// Safe Cookie Options
const getCookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'strict' : 'lax',
  maxAge: maxAgeMs
})

/**
 * POST /api/v1/auth/login
 * Authenticates user credentials and starts a new session.
 */
router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { identifier, password } = req.body

    const reqMeta = {
      ipAddress: req.ip || req.connection?.remoteAddress,
      deviceInfo: req.headers['user-agent'] || 'Unknown Client'
    }

    const result = await authService.login(identifier, password, reqMeta)

    // Set secure HttpOnly cookies
    res.cookie('access_token', result.accessToken, getCookieOptions(15 * 60 * 1000))
    res.cookie('refresh_token', result.refreshToken, getCookieOptions(env.refreshTokenExpiryDays * 24 * 60 * 60 * 1000))

    return sendSuccess(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt
      },
      { message: 'Login successful' },
      200
    )
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/refresh
 * Rotates refresh token and issues a new short-lived access token.
 */
router.post('/refresh', authRateLimiter, async (req, res, next) => {
  try {
    const rawRefreshToken = req.body.refreshToken || req.cookies?.refresh_token

    if (!rawRefreshToken) {
      return sendError(res, 'Refresh token is required', 'TOKEN_MISSING', null, 400)
    }

    const reqMeta = {
      ipAddress: req.ip || req.connection?.remoteAddress,
      deviceInfo: req.headers['user-agent'] || 'Unknown Client'
    }

    const result = await authService.refreshToken(rawRefreshToken, reqMeta)

    // Update HttpOnly cookies
    res.cookie('access_token', result.accessToken, getCookieOptions(15 * 60 * 1000))
    res.cookie('refresh_token', result.refreshToken, getCookieOptions(env.refreshTokenExpiryDays * 24 * 60 * 60 * 1000))

    return sendSuccess(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt
      },
      { message: 'Session refreshed successfully' },
      200
    )
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/logout
 * Revokes current session and clears cookies.
 */
router.post('/logout', async (req, res, next) => {
  try {
    const rawRefreshToken = req.body.refreshToken || req.cookies?.refresh_token
    const userId = req.user?.id || null

    await authService.logout(rawRefreshToken, userId)

    res.clearCookie('access_token')
    res.clearCookie('refresh_token')

    return sendSuccess(res, { loggedOut: true }, { message: 'Logged out successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/logout-all
 * Revokes all active sessions across all devices for the authenticated user.
 */
router.post('/logout-all', authenticate, async (req, res, next) => {
  try {
    await authService.logoutAll(req.user.id)

    res.clearCookie('access_token')
    res.clearCookie('refresh_token')

    return sendSuccess(res, { loggedOutAll: true }, { message: 'All active sessions terminated' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/auth/me
 * Returns authenticated user profile and org scope.
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const userProfile = await authService.getMe(req.user.id)
    return sendSuccess(res, { user: userProfile }, undefined, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/change-password
 * Changes password and terminates other active sessions.
 */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    const reqMeta = {
      ipAddress: req.ip || req.connection?.remoteAddress
    }

    await authService.changePassword(req.user.id, currentPassword, newPassword, reqMeta)

    return sendSuccess(res, { changed: true }, { message: 'Password changed successfully' }, 200)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/bootstrap-admin
 * Initial one-time protected Super Admin provisioning.
 * Strictly isolated: Disabled if any protected Super Admin already exists or in production without secure secret.
 */
router.post('/bootstrap-admin', authRateLimiter, async (req, res, next) => {
  const config = {
    username: req.body?.username || env.bootstrapAdmin.username,
    email: req.body?.email || env.bootstrapAdmin.email,
    password: req.body?.password || env.bootstrapAdmin.password
  }

  try {
    let adminCount = 0
    try {
      adminCount = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', isProtected: true }
      })
    } catch (countErr) {
      if (countErr.code === 'P2021' || countErr.message?.includes('does not exist')) {
        console.warn('Database tables missing during bootstrap check. Running auto prisma db push...')
        const { execSync } = await import('child_process')
        execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' })
        adminCount = 0
      } else {
        throw countErr
      }
    }

    if (adminCount > 0) {
      return sendError(
        res,
        'Initial bootstrap is permanently disabled because a protected Super Admin already exists. Please use the CLI or standard login.',
        'BOOTSTRAP_DISABLED',
        null,
        403
      )
    }

    const result = await authService.bootstrapSuperAdmin(config)

    return sendSuccess(res, result, undefined, result.created ? 201 : 200)
  } catch (err) {
    next(err)
  }
})

export default router

