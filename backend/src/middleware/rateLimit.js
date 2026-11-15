/**
 * iSysware HRMS — Rate Limiting Middleware
 * Protects public authentication endpoints against brute force and credential stuffing.
 */

import rateLimit from 'express-rate-limit'
import env from '../config/env.js'
import { sendError } from '../utils/response.js'

/**
 * Login rate limiter: Max 25 attempts per 15 minutes per IP (1000 in test suites).
 * Prevents brute force and credential stuffing across all runtime environments.
 * Skips loopback/localhost requests during development so testing is never blocked.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (env.isTest || env.isDevelopment) ? 1000 : 25,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (env.isDevelopment || env.isTest) {
      const ip = req.ip || req.connection?.remoteAddress || ''
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || req.hostname === 'localhost'
    }
    return false
  },
  handler: (req, res) => {
    return sendError(
      res,
      'Too many login attempts from this IP address. Please try again after 15 minutes.',
      'RATE_LIMIT_EXCEEDED',
      null,
      429
    )
  }
})

/**
 * General auth rate limiter: Max 60 attempts per 15 minutes per IP.
 * Skips loopback/localhost requests during development.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (env.isTest || env.isDevelopment) ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (env.isDevelopment || env.isTest) {
      const ip = req.ip || req.connection?.remoteAddress || ''
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || req.hostname === 'localhost'
    }
    return false
  },
  handler: (req, res) => {
    return sendError(
      res,
      'Too many requests. Please slow down and try again later.',
      'RATE_LIMIT_EXCEEDED',
      null,
      429
    )
  }
})

