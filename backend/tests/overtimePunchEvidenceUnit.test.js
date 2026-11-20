/**
 * iSysware HRMS — Overtime Attendance Punch Evidence & Verification Unit Suite
 * Tests verifyOvertimePunchEvidence without requiring a live PostgreSQL instance.
 * Ensures:
 * 1. Claimed hours are NEVER accepted as punched time.
 * 2. Absent days fail verification.
 * 3. Continuous verified IN/OUT session covering the claim window is required.
 * 4. Actual Karachi punch times are reported upon success.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { verifyOvertimePunchEvidence } from '../src/services/overtimeService.js'

describe('Overtime Punch Evidence Verification Unit Suite', () => {
  it('1. Rejects if attendance record is null or missing completed sessions', () => {
    const ot = { overtimeDate: '2026-11-19', startTime: '18:00', endTime: '20:00', durationMinutes: 120 }
    const result1 = verifyOvertimePunchEvidence(ot, null)
    assert.strictEqual(result1.verified, false)
    assert.strictEqual(result1.actualCheckIn, null)

    const result2 = verifyOvertimePunchEvidence(ot, { status: 'PRESENT', actualWorkMinutes: 0, firstCheckIn: null, lastCheckOut: null })
    assert.strictEqual(result2.verified, false)
  })

  it('2. Rejects if attendance status is ABSENT', () => {
    const ot = { overtimeDate: '2026-11-19', startTime: '18:00', endTime: '20:00', durationMinutes: 120 }
    const att = {
      status: 'ABSENT',
      actualWorkMinutes: 0,
      firstCheckIn: null,
      lastCheckOut: null,
      punches: []
    }
    const result = verifyOvertimePunchEvidence(ot, att)
    assert.strictEqual(result.verified, false)
    assert.ok(result.reason.includes('absent'))
  })

  it('3. Rejects if no matching CHECK_IN and CHECK_OUT punches exist', () => {
    const ot = { overtimeDate: '2026-11-19', startTime: '18:00', endTime: '20:00', durationMinutes: 120 }
    const att = {
      status: 'PRESENT',
      firstCheckIn: new Date('2026-11-19T04:00:00Z'),
      lastCheckOut: new Date('2026-11-19T16:00:00Z'),
      actualWorkMinutes: 480,
      punches: [
        { punchType: 'CHECK_IN', punchTime: new Date('2026-11-19T04:00:00Z') }
        // Missing CHECK_OUT punch
      ]
    }
    const result = verifyOvertimePunchEvidence(ot, att)
    assert.strictEqual(result.verified, false)
    assert.ok(result.reason.includes('CHECK_IN and CHECK_OUT'))
  })

  it('4. Rejects if recorded worked minutes are insufficient for the claim', () => {
    const ot = { overtimeDate: '2026-11-19', startTime: '18:00', endTime: '20:00', durationMinutes: 120 }
    const att = {
      status: 'PRESENT',
      firstCheckIn: new Date('2026-11-19T13:00:00Z'),
      lastCheckOut: new Date('2026-11-19T15:00:00Z'),
      actualWorkMinutes: 60, // Only 60 min recorded vs 120 min claimed
      punches: [
        { punchType: 'CHECK_IN', punchTime: new Date('2026-11-19T13:00:00Z') }, // 18:00 PKT
        { punchType: 'CHECK_OUT', punchTime: new Date('2026-11-19T15:00:00Z') } // 20:00 PKT
      ]
    }
    const result = verifyOvertimePunchEvidence(ot, att)
    assert.strictEqual(result.verified, false)
    assert.ok(result.reason.includes('insufficient'))
  })

  it('5. Rejects if punch session ends before the claimed overtime window', () => {
    const ot = { overtimeDate: '2026-11-19', startTime: '18:00', endTime: '20:00', durationMinutes: 120 }
    // Punch out at 19:30 PKT (14:30 UTC), but claim was until 20:00 PKT
    const att = {
      status: 'PRESENT',
      firstCheckIn: new Date('2026-11-19T04:00:00Z'), // 09:00 PKT
      lastCheckOut: new Date('2026-11-19T14:30:00Z'), // 19:30 PKT
      actualWorkMinutes: 630,
      punches: [
        { punchType: 'CHECK_IN', punchTime: new Date('2026-11-19T04:00:00Z') },
        { punchType: 'CHECK_OUT', punchTime: new Date('2026-11-19T14:30:00Z') }
      ]
    }
    const result = verifyOvertimePunchEvidence(ot, att)
    assert.strictEqual(result.verified, false)
    assert.ok(result.reason.includes('no continuous verified punch session covers'))
  })

  it('6. Verifies successfully when real punches enclose the claimed window', () => {
    const ot = { overtimeDate: '2026-11-19', startTime: '18:00', endTime: '20:00', durationMinutes: 120 }
    // Check in 08:50 PKT (03:50 UTC), Check out 20:15 PKT (15:15 UTC)
    const att = {
      status: 'PRESENT',
      firstCheckIn: new Date('2026-11-19T03:50:00Z'),
      lastCheckOut: new Date('2026-11-19T15:15:00Z'),
      actualWorkMinutes: 685,
      punches: [
        { punchType: 'CHECK_IN', punchTime: new Date('2026-11-19T03:50:00Z') },
        { punchType: 'CHECK_OUT', punchTime: new Date('2026-11-19T15:15:00Z') }
      ]
    }
    const result = verifyOvertimePunchEvidence(ot, att)
    assert.strictEqual(result.verified, true)
    assert.strictEqual(result.reason, null)
    assert.strictEqual(result.actualCheckIn, '08:50')
    assert.strictEqual(result.actualCheckOut, '20:15')
  })
})
