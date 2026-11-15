import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getSanitizedDbDetails, verifyDatabaseConnection } from '../src/config/database.js'

describe('Database Configuration & Health Probe', () => {
  it('should sanitize database URLs without leaking credentials', () => {
    const sanitized = getSanitizedDbDetails('postgresql://my_secret_user:my_secret_pw@db.example.com:5433/prod_hrms?sslmode=require')

    assert.strictEqual(sanitized.host, 'db.example.com')
    assert.strictEqual(sanitized.port, '5433')
    assert.strictEqual(sanitized.database, 'prod_hrms')
    assert.strictEqual(sanitized.user, '***configured***')
    assert.ok(!JSON.stringify(sanitized).includes('my_secret_pw'))
    assert.ok(!JSON.stringify(sanitized).includes('my_secret_user'))
  })

  it('should handle invalid database connection gracefully without crashing', async () => {
    // Testing connection helper returns a structured object rather than throwing
    const result = await verifyDatabaseConnection(2000)

    assert.strictEqual(typeof result.connected, 'boolean')
    assert.strictEqual(typeof result.latencyMs, 'number')
    assert.ok(result.details)
    assert.strictEqual(result.details.database, 'aliyan_hrms_test')

    if (result.connected) {
      assert.strictEqual(result.error, null)
      assert.ok(result.version)
    } else {
      assert.strictEqual(typeof result.error, 'string')
    }
  })
})

