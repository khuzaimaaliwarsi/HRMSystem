import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'

describe('API Foundation & Health Endpoints', () => {
  it('GET / should return basic service info', async () => {
    const res = await request(app).get('/')
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.name, 'iSysware HRMS Backend API')
    assert.strictEqual(res.body.status, 'active')
  })

  it('GET /api/v1/health should return standardized health payload (ok or degraded)', async () => {
    const res = await request(app).get('/api/v1/health')
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.success, true)
    assert.ok(res.body.data)
    assert.ok(['ok', 'degraded'].includes(res.body.data.status))
    assert.strictEqual(res.body.data.service, 'isysware-hrms-backend')
    assert.ok(res.body.data.database)
    assert.strictEqual(typeof res.body.data.database.connected, 'boolean')
  })

  it('GET /api/v1/health/db should return 200 or 503 based on database connectivity', async () => {
    const res = await request(app).get('/api/v1/health/db')
    assert.ok([200, 503].includes(res.status))
    assert.strictEqual(res.body.success, true)
    assert.ok(res.body.data)
    assert.strictEqual(typeof res.body.data.connected, 'boolean')
  })

  it('GET /non-existent-route should return standardized 404 JSON error', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint-xyz')
    assert.strictEqual(res.status, 404)
    assert.strictEqual(res.body.success, false)
    assert.strictEqual(res.body.error.code, 'NOT_FOUND')
    assert.ok(res.body.error.message.includes('Route not found'))
  })
})

