/**
 * iSysware HRMS — JSON Web Token (JWT) Access Token Utilities
 * Issues and validates short-lived signed access tokens.
 */

import jwt from 'jsonwebtoken'
import env from '../config/env.js'

/**
 * Generates a signed JWT access token.
 * @param {object} payload - user claims { userId, role, employeeId, email, username }
 * @param {string} [expiresIn] - override default expiry
 * @returns {string} signed JWT
 */
export function generateAccessToken(payload, expiresIn = env.jwtAccessExpiry) {
  return jwt.sign(
    {
      sub: payload.userId || payload.id,
      role: payload.role,
      employeeId: payload.employeeId || null,
      email: payload.email,
      username: payload.username
    },
    env.jwtSecret,
    {
      expiresIn,
      issuer: 'isysware-hrms-api',
      audience: 'isysware-hrms-client'
    }
  )
}

/**
 * Verifies and decodes an access token.
 * @param {string} token
 * @returns {object} decoded claims
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, {
      issuer: 'isysware-hrms-api',
      audience: 'isysware-hrms-client'
    })
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Access token has expired')
      error.code = 'TOKEN_EXPIRED'
      error.status = 401
      throw error
    }
    const error = new Error('Invalid access token')
    error.code = 'TOKEN_INVALID'
    error.status = 401
    throw error
  }
}

