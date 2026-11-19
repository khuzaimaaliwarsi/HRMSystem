import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatLateDuration } from '../lib/dateUtils.js'

describe('formatLateDuration QA Suite', () => {
  it('1. Correctly formats 443 minutes to 7h 23m Late', () => {
    assert.equal(formatLateDuration(443, 'Late'), '7h 23m Late')
  })

  it('2. Correctly formats round hours (e.g. 60m, 120m) without 0m suffix', () => {
    assert.equal(formatLateDuration(60, 'Late'), '1h Late')
    assert.equal(formatLateDuration(120, 'Late'), '2h Late')
  })

  it('3. Correctly formats sub-hour minutes (e.g. 13m, 45m)', () => {
    assert.equal(formatLateDuration(13, 'Late'), '13m Late')
    assert.equal(formatLateDuration(45, 'Late'), '45m Late')
  })

  it('4. Correctly formats Early exit duration (e.g. 97m -> 1h 37m Early)', () => {
    assert.equal(formatLateDuration(97, 'Early'), '1h 37m Early')
    assert.equal(formatLateDuration(30, 'Early'), '30m Early')
  })

  it('5. Handles 0, null, and non-numeric safely', () => {
    assert.equal(formatLateDuration(0, 'Late'), '0m Late')
    assert.equal(formatLateDuration(null, 'Late'), '0m Late')
    assert.equal(formatLateDuration(undefined, 'Late'), '0m Late')
  })
})
