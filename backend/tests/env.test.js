import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateEnv } from '../src/config/env.js'

describe('Backend Environment Configuration', () => {
  it('should validate and return a healthy configuration object with defaults', () => {
    const config = validateEnv()

    assert.ok(config, 'Configuration object should be defined')
    assert.strictEqual(typeof config.port, 'number')
    assert.ok(config.port > 0 && config.port <= 65535, 'Port should be valid')
    assert.strictEqual(config.apiVersion, 'v1')
    assert.strictEqual(config.apiPrefix, '/api/v1')
    assert.ok(Array.isArray(config.corsOrigins), 'corsOrigins should be an array')
    assert.strictEqual(config.isValid, true, 'Environment should be valid')
    assert.strictEqual(config.errors.length, 0, 'There should be no blocking errors')
  })

  it('should detect invalid ports gracefully', () => {
    const originalPort = process.env.PORT
    process.env.PORT = '999999'

    const config = validateEnv()
    assert.strictEqual(config.isValid, false)
    assert.ok(config.errors.some(e => e.includes('Invalid PORT')))

    process.env.PORT = originalPort
  })
})

