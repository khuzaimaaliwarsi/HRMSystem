import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTimeTo24Hour, calculateTimeDuration } from '../lib/dateUtils.js'
import { attendanceService } from '../services/attendanceService.js'

test('WFH & Field Duty Time Conversion: AM, PM, 12 AM, 12 PM normalization', () => {
  // 1. Standard AM Cases (including 11:30 AM bug reproduction)
  assert.equal(normalizeTimeTo24Hour('09:30 AM'), '09:30')
  assert.equal(normalizeTimeTo24Hour('11:30 AM'), '11:30', '11:30 AM must convert to 11:30, NOT 23:30')
  assert.equal(normalizeTimeTo24Hour('8:15 am'), '08:15')
  assert.equal(normalizeTimeTo24Hour('01:00 AM'), '01:00')

  // 2. Standard PM Cases
  assert.equal(normalizeTimeTo24Hour('01:30 PM'), '13:30')
  assert.equal(normalizeTimeTo24Hour('06:30 PM'), '18:30')
  assert.equal(normalizeTimeTo24Hour('11:30 PM'), '23:30')
  assert.equal(normalizeTimeTo24Hour('2:45 pm'), '14:45')

  // 3. 12 AM (Midnight) Cases
  assert.equal(normalizeTimeTo24Hour('12:00 AM'), '00:00', '12:00 AM is midnight (00:00)')
  assert.equal(normalizeTimeTo24Hour('12:30 AM'), '00:30', '12:30 AM is 00:30')
  assert.equal(normalizeTimeTo24Hour('12:00 am'), '00:00')

  // 4. 12 PM (Noon) Cases
  assert.equal(normalizeTimeTo24Hour('12:00 PM'), '12:00', '12:00 PM is noon (12:00)')
  assert.equal(normalizeTimeTo24Hour('12:45 PM'), '12:45', '12:45 PM is 12:45')
  assert.equal(normalizeTimeTo24Hour('12:00 pm'), '12:00')

  // 5. Already 24-Hour Formats
  assert.equal(normalizeTimeTo24Hour('09:30'), '09:30')
  assert.equal(normalizeTimeTo24Hour('11:30'), '11:30')
  assert.equal(normalizeTimeTo24Hour('18:30'), '18:30')
  assert.equal(normalizeTimeTo24Hour('00:00'), '00:00')
  assert.equal(normalizeTimeTo24Hour('23:30'), '23:30')
})

test('WFH & Field Duty Time Conversion: Duration calculation', () => {
  // FLD-003 scenario: 09:30 AM to 11:30 AM -> 2 hours (120 minutes)
  const d1 = calculateTimeDuration('09:30 AM', '11:30 AM')
  assert.equal(d1.start24, '09:30')
  assert.equal(d1.end24, '11:30')
  assert.equal(d1.totalMinutes, 120)
  assert.equal(d1.totalHours, 2)
  assert.equal(d1.formatted, '2h')

  // Afternoon visit: 02:00 PM to 05:30 PM -> 3h 30m
  const d2 = calculateTimeDuration('02:00 PM', '05:30 PM')
  assert.equal(d2.start24, '14:00')
  assert.equal(d2.end24, '17:30')
  assert.equal(d2.totalMinutes, 210)
  assert.equal(d2.totalHours, 3.5)
  assert.equal(d2.formatted, '3h 30m')

  // Overnight visit: 11:00 PM to 03:00 AM -> 4h
  const d3 = calculateTimeDuration('11:00 PM', '03:00 AM')
  assert.equal(d3.start24, '23:00')
  assert.equal(d3.end24, '03:00')
  assert.equal(d3.totalMinutes, 240)
  assert.equal(d3.totalHours, 4)
  assert.equal(d3.formatted, '4h')
})

test('Client Field Duty FLD-003: Submitting 09:30 AM to 11:30 AM stores 09:30-11:30 and persists', () => {
  // Submit new field duty request with 09:30 AM to 11:30 AM
  const req = attendanceService.submitFieldDutyRequest({
    employeeId: 'EMP-007',
    visitDate: '2026-10-30',
    clientName: 'Alfalah Bank Commercial Tower',
    purpose: 'Core banking integration milestone review',
    location: 'Alfalah HQ, Islamabad',
    expectedStartTime: '09:30 AM',
    expectedEndTime: '11:30 AM'
  }, 'Kamran Raza')

  // Verify ID and normalized 24-hour time
  assert.equal(req.expectedStartTime, '09:30', 'Start time must be stored as 09:30')
  assert.equal(req.expectedEndTime, '11:30', 'End time must be stored as 11:30 (NOT 23:30)')
  assert.equal(req.durationHours, 2, 'Duration must be 2 hours')
  assert.equal(req.durationFormatted, '2h')

  // Verify persistence retrieval through getFieldDutyRequests
  const list = attendanceService.getFieldDutyRequests({ employeeId: 'EMP-007' })
  const saved = list.find((f) => f.id === req.id)
  assert.ok(saved, 'Saved request must exist in storage')
  assert.equal(saved.expectedStartTime, '09:30')
  assert.equal(saved.expectedEndTime, '11:30')
  assert.equal(saved.durationHours, 2)
  assert.equal(saved.durationFormatted, '2h')

  // Approve and verify actualStartTime / actualEndTime remain 24h
  const approved = attendanceService.approveFieldDutyRequest(saved.id, 'Approved by Manager', 'Bilal Siddiqui', 'EMP-003')
  assert.equal(approved.status, 'Approved')
  assert.equal(approved.actualStartTime, '09:30')
  assert.equal(approved.actualEndTime, '11:30')
  assert.equal(approved.durationHours, 2)
})

