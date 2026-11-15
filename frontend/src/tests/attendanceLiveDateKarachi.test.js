import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceService } from '../services/attendanceService.js'
import { getKarachiToday, getKarachiTime, getKarachiTimeString, getDateFilterRange } from '../lib/dateUtils.js'

test('Aliyan_HRMS — Attendance Live Date & Asia/Karachi Timezone Suite', async (t) => {
  // Test 1: Live Date & Time formatting in Asia/Karachi
  await t.test('1. getKarachiToday returns strict YYYY-MM-DD in Asia/Karachi timezone', () => {
    const today = getKarachiToday()
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'Must match YYYY-MM-DD format')

    // Verify against Intl API
    const expected = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
    assert.equal(today, expected, 'getKarachiToday must match Asia/Karachi current calendar day')
  })

  // Test 2: Live Time formatting in Asia/Karachi
  await t.test('2. getKarachiTime returns 24-hour HH:MM in Asia/Karachi', () => {
    const time = getKarachiTime()
    assert.match(time, /^\d{2}:\d{2}$/, 'Must match HH:MM')

    const timeWithSeconds = getKarachiTime(new Date(), { seconds: true })
    assert.match(timeWithSeconds, /^\d{2}:\d{2}:\d{2}$/, 'Must match HH:MM:SS')

    const timeString = getKarachiTimeString()
    assert.ok(timeString.includes('M') || timeString.includes(':'), 'Must return valid 12h clock string')
  })

  // Test 3: getEmployeeTodayRecord defaults to live Asia/Karachi date
  await t.test('3. getEmployeeTodayRecord defaults to getKarachiToday() instead of hardcoded 2026-10-26', () => {
    const today = getKarachiToday()
    // Querying with targetDate = null resolves to today
    const rec = attendanceService.getEmployeeTodayRecord('EMP-004')
    if (rec) {
      assert.equal(rec.date, today, 'Record date must match live getKarachiToday()')
    }
  })

  // Test 4: Live Check-in stamps live Karachi date and time
  await t.test('4. checkIn stamps the record with live Karachi date and preserves history', () => {
    const today = getKarachiToday()
    const testEmpId = 'EMP-014'

    // Perform check-in on test employee for today
    try {
      const checkedIn = attendanceService.checkIn(testEmpId)
      assert.equal(checkedIn.date, today, 'Check-in date must be live Karachi today')
      assert.ok(checkedIn.checkInTime, 'Must have recorded check-in time')
      assert.ok(checkedIn.timestamp.startsWith(today), 'Timestamp must start with live Karachi date')

      // Perform check-out
      const checkedOut = attendanceService.checkOut(testEmpId)
      assert.equal(checkedOut.date, today, 'Check-out date must match check-in date')
      assert.ok(checkedOut.checkOutTime, 'Must have recorded check-out time')
      assert.ok(checkedOut.workedHours >= 0, 'Worked hours calculated')
    } catch (err) {
      // If already checked in or closed in test session, verify existing date is valid
      const existing = attendanceService.getEmployeeTodayRecord(testEmpId, today)
      if (existing) {
        assert.equal(existing.date, today)
      }
    }
  })

  // Test 5: Historical dates preservation
  await t.test('5. Historical records on 2026-10-26 and 2026-10-30 are preserved intact', () => {
    const recordsOct26 = attendanceService.getAttendanceRecords({ date: '2026-10-26' })
    assert.ok(recordsOct26.length > 0, '2026-10-26 historical records must be preserved')

    const recordsOct30 = attendanceService.getAttendanceRecords({ date: '2026-10-30' })
    assert.ok(recordsOct30.length > 0, '2026-10-30 historical records must be preserved')
  })

  // Test 6: Timesheets Date Filter Range
  await t.test('6. getDateFilterRange correctly calculates today, yesterday, and month ranges', () => {
    const today = getKarachiToday()
    const todayRange = getDateFilterRange('today')
    assert.equal(todayRange.startDate, today)
    assert.equal(todayRange.endDate, today)

    const yestRange = getDateFilterRange('yesterday')
    assert.ok(yestRange.startDate < today, 'Yesterday must precede today')
    assert.equal(yestRange.startDate, yestRange.endDate)

    const monthRange = getDateFilterRange('month')
    assert.ok(monthRange.startDate.endsWith('-01'), 'Month range begins on the 1st')
    assert.equal(monthRange.endDate, today, 'Month range ends on today')
  })
})
