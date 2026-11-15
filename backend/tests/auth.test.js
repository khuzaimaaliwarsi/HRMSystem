import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import authService from '../src/services/authService.js'

describe('Backend Batch 3 — Secure Authentication & Session Management Suite', () => {
  const testPassword = 'Password123!'
  let testUser = null

  it('1. Bootstrap Super Admin: Provisions protected Super Admin idempotently', async () => {
    // Clean any prior test bootstrap admin
    await prisma.session.deleteMany({}).catch(() => {})
    await prisma.user.deleteMany({ where: { username: 'test_bootstrap_sa' } }).catch(() => {})

    const result = await authService.bootstrapSuperAdmin({
      username: 'test_bootstrap_sa',
      email: 'test_bootstrap_sa@isysware.test',
      password: testPassword
    })

    assert.strictEqual(result.created, true)
    assert.strictEqual(result.username, 'test_bootstrap_sa')

    // Second call must be idempotent
    const secondCall = await authService.bootstrapSuperAdmin({
      username: 'test_bootstrap_sa',
      email: 'test_bootstrap_sa@isysware.test',
      password: 'DifferentPassword999!'
    })

    assert.strictEqual(secondCall.created, false)
    assert.ok(secondCall.message.includes('already exists'))

    testUser = await prisma.user.findUnique({
      where: { username: 'test_bootstrap_sa' }
    })
    assert.strictEqual(testUser.isProtected, true)
    assert.strictEqual(testUser.role, 'SUPER_ADMIN')
  })

  it('2. Login API: Rejects invalid credentials with 401 without leaking internal details', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_bootstrap_sa', password: 'WrongPassword999!' })

    assert.strictEqual(res.status, 401)
    assert.strictEqual(res.body.success, false)
    assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS')
    assert.strictEqual(res.body.error.message, 'Invalid username or password')
  })

  it('3. Login API: Successful login returns access token, refresh token and sets HttpOnly cookies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_bootstrap_sa', password: testPassword })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.success, true)
    assert.ok(res.body.data.accessToken, 'Access token should be issued')
    assert.ok(res.body.data.refreshToken, 'Refresh token should be issued')
    assert.strictEqual(res.body.data.user.username, 'test_bootstrap_sa')
    assert.strictEqual(res.body.data.user.passwordHash, undefined, 'Password hash must never be returned')

    // Verify Set-Cookie headers
    const cookies = res.headers['set-cookie']
    assert.ok(cookies, 'Cookies must be set')
    assert.ok(cookies.some(c => c.includes('access_token=') && c.includes('HttpOnly')))
    assert.ok(cookies.some(c => c.includes('refresh_token=') && c.includes('HttpOnly')))
  })

  it('4. GET /api/v1/auth/me: Returns current user context with valid Bearer token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_bootstrap_sa', password: testPassword })

    const token = loginRes.body.data.accessToken

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)

    assert.strictEqual(meRes.status, 200)
    assert.strictEqual(meRes.body.success, true)
    assert.strictEqual(meRes.body.data.user.username, 'test_bootstrap_sa')
    assert.strictEqual(meRes.body.data.user.role, 'SUPER_ADMIN')
  })

  it('5. GET /api/v1/auth/me: Rejects missing, tampered, or invalid token with 401', async () => {
    const missingRes = await request(app).get('/api/v1/auth/me')
    assert.strictEqual(missingRes.status, 401)
    assert.strictEqual(missingRes.body.error.code, 'UNAUTHORIZED')

    const tamperedRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid_tampered_jwt_token_string')
    assert.strictEqual(tamperedRes.status, 401)
    assert.strictEqual(tamperedRes.body.error.code, 'TOKEN_INVALID')
  })

  it('6. Refresh Token Rotation: Rotates refresh token and issues fresh access token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_bootstrap_sa', password: testPassword })

    const initialRefreshToken = loginRes.body.data.refreshToken
    const initialAccessToken = loginRes.body.data.accessToken

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken })

    assert.strictEqual(refreshRes.status, 200)
    assert.strictEqual(refreshRes.body.success, true)
    assert.ok(refreshRes.body.data.accessToken)
    assert.ok(refreshRes.body.data.refreshToken)
    assert.notStrictEqual(refreshRes.body.data.refreshToken, initialRefreshToken)
  })

  it('7. Replay / Theft Detection: Reusing rotated refresh token revokes all user sessions', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_bootstrap_sa', password: testPassword })

    const firstRefreshToken = loginRes.body.data.refreshToken

    // Legitimate rotation
    const rotationRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
    assert.strictEqual(rotationRes.status, 200)

    // Replay attempt using already-rotated firstRefreshToken
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken })

    assert.strictEqual(replayRes.status, 401)
    assert.strictEqual(replayRes.body.error.code, 'SESSION_REPLAY_DETECTED')

    // Verify all active sessions were invalidated for testUser
    const activeSessions = await prisma.session.count({
      where: { userId: testUser.id, revokedAt: null }
    })
    assert.strictEqual(activeSessions, 0, 'All active sessions must be invalidated on replay')
  })

  it('8. Logout API: Successfully revokes session and clears cookies', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_bootstrap_sa', password: testPassword })

    const refreshToken = loginRes.body.data.refreshToken

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken })

    assert.strictEqual(logoutRes.status, 200)
    assert.strictEqual(logoutRes.body.data.loggedOut, true)

    // Trying to use that refresh token now should fail
    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })

    assert.strictEqual(refreshAfterLogout.status, 401)
  })

  it('9. Password Change: Validates strength, checks current password, and invalidates other sessions', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_bootstrap_sa', password: testPassword })

    const token = loginRes.body.data.accessToken

    // Weak password rejected
    const weakRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: testPassword, newPassword: 'weak' })
    assert.strictEqual(weakRes.status, 400)
    assert.strictEqual(weakRes.body.error.code, 'WEAK_PASSWORD')

    // Wrong current password rejected
    const wrongCurrentRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword!', newPassword: 'NewPassword123!' })
    assert.strictEqual(wrongCurrentRes.status, 401)

    // Valid change
    const validChangeRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: testPassword, newPassword: 'NewPassword123!' })
    assert.strictEqual(validChangeRes.status, 200)
    assert.strictEqual(validChangeRes.body.data.changed, true)

    // Verify login with new password succeeds
    const newLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'test_bootstrap_sa', password: 'NewPassword123!' })
    assert.strictEqual(newLoginRes.status, 200)

    // Cleanup test user & sessions
    await prisma.session.deleteMany({ where: { userId: testUser.id } })
    await prisma.user.delete({ where: { id: testUser.id } })
  })
})
