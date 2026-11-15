/**
 * iSysware HRMS — Cryptography & Hashing Utilities
 * Implements Argon2id password hashing and SHA-256 token digest generation.
 */

import crypto from 'crypto'
import argon2 from 'argon2'

/**
 * Hashes a plaintext password using Argon2id.
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1
  })
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 * @param {string} hash
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

/**
 * Generates a cryptographically secure random token.
 * @param {number} [bytes=32]
 * @returns {string} hex-encoded token
 */
export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Computes a deterministic SHA-256 hex digest of a token.
 * Refresh tokens are stored ONLY as hashes in the database.
 * @param {string} token
 * @returns {string}
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Validates password complexity:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * @param {string} password
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required' }
  }
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' }
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' }
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' }
  }
  return { isValid: true }
}

