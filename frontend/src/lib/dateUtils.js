/**
 * iSysware HRMS — Date Utilities & Normalization Engine
 * Handles canonical ISO dates (YYYY-MM-DD), enterprise DD/MM/YYYY parsing,
 * total service/tenure calculations, and probation schedules without timezone shift.
 */

/**
 * Normalizes any date string, Date instance, or number to strict YYYY-MM-DD.
 * Reliably treats 3-part slash/dash dates with year in last position as DD/MM/YYYY (UK/Pakistan HRMS standard),
 * preventing JavaScript's default US MM/DD/YYYY misinterpretation.
 *
 * Example:
 *  '02/11/2026' -> '2026-11-02' (2nd November 2026)
 *  '2026-11-02' -> '2026-11-02'
 *  '15/01/2025' -> '2025-01-15'
 */
export function normalizeDateToISO(dateVal) {
  if (!dateVal) return ''

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return ''
    const y = dateVal.getFullYear()
    const m = String(dateVal.getMonth() + 1).padStart(2, '0')
    const d = String(dateVal.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const str = String(dateVal).trim()
  if (!str) return ''

  // Already standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str
  }

  // ISO timestamp (YYYY-MM-DDTHH:mm:ss...)
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.slice(0, 10)
  }

  // Parse strings with separators: '/', '-', '.'
  const parts = str.split(/[/.-]/)
  if (parts.length === 3) {
    // Case A: YYYY/MM/DD
    if (parts[0].length === 4) {
      const y = parts[0]
      const m = String(parseInt(parts[1], 10)).padStart(2, '0')
      const d = String(parseInt(parts[2], 10)).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    // Case B: DD/MM/YYYY (or MM/DD/YYYY if parts[1] > 12)
    if (parts[2].length === 4) {
      const p1 = parseInt(parts[0], 10)
      const p2 = parseInt(parts[1], 10)
      const y = parts[2]

      let d, m
      if (p2 > 12 && p1 <= 12) {
        // User entered MM/DD/YYYY (e.g. 11/28/2026)
        m = String(p1).padStart(2, '0')
        d = String(p2).padStart(2, '0')
      } else {
        // Default Pakistan/UK standard: DD/MM/YYYY (e.g. 02/11/2026 -> 2 Nov 2026)
        d = String(p1).padStart(2, '0')
        m = String(p2).padStart(2, '0')
      }
      return `${y}-${m}-${d}`
    }
  }

  // Fallback: Try native Date parser with calendar components
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return str
}

/**
 * Formats an ISO or standard date string to display format (e.g. DD/MM/YYYY or DD MMM YYYY).
 */
export function formatDateDisplay(dateVal, format = 'ISO') {
  const iso = normalizeDateToISO(dateVal)
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateVal || '—'

  const [y, m, d] = iso.split('-')
  if (format === 'DD/MM/YYYY') {
    return `${d}/${m}/${y}`
  }

  if (format === 'readable') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const mIdx = parseInt(m, 10) - 1
    return `${d} ${months[mIdx] || m} ${y}`
  }

  return iso
}

/**
 * Calculates total tenure / service days from joining date to today.
 * If join date is in the future, returns 0.
 */
export function calculateTenureDays(joinDateVal, referenceDate = new Date()) {
  const iso = normalizeDateToISO(joinDateVal)
  if (!iso) return 1

  const join = new Date(`${iso}T00:00:00`)
  if (isNaN(join.getTime())) return 1

  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)
  const diffTime = ref.getTime() - join.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 0 // Future joining
  return Math.max(1, diffDays)
}

/**
 * Calculates readable service duration (Years, Months, Days).
 */
export function formatTotalService(joinDateVal, referenceDate = new Date()) {
  const iso = normalizeDateToISO(joinDateVal)
  if (!iso) return '1 Day'

  const days = calculateTenureDays(iso, referenceDate)
  if (days === 0) {
    return `0 Days (Starts ${formatDateDisplay(iso, 'readable')})`
  }

  if (days < 30) {
    return `${days} ${days === 1 ? 'Day' : 'Days'}`
  }

  const months = Math.floor(days / 30.4375)
  if (months < 12) {
    const remDays = Math.floor(days % 30.4375)
    return `${months} ${months === 1 ? 'Mo' : 'Mos'}${remDays > 0 ? ` ${remDays}d` : ''}`
  }

  const years = Math.floor(days / 365.25)
  const remMonths = Math.floor((days % 365.25) / 30.4375)
  return `${years} ${years === 1 ? 'Yr' : 'Yrs'}${remMonths > 0 ? ` ${remMonths}m` : ''} (${days}d)`
}

/**
 * Checks whether a given date is strictly in the future compared to today.
 */
export function isFutureDate(dateVal) {
  const iso = normalizeDateToISO(dateVal)
  if (!iso) return false
  const today = new Date().toISOString().slice(0, 10)
  return iso > today
}

/**
 * Calculates probation timeline milestones from joining date.
 */
export function calculateProbationTimeline(joinDateVal, durationMonths = 3) {
  const startIso = normalizeDateToISO(joinDateVal) || new Date().toISOString().slice(0, 10)
  const [y, m, d] = startIso.split('-').map((v) => parseInt(v, 10))

  const targetDate = new Date(y, m - 1 + durationMonths, d)
  const endIso = normalizeDateToISO(targetDate)

  // Review due date: 14 days before end date
  const reviewDate = new Date(targetDate.getTime() - 14 * 86400000)
  const reviewIso = normalizeDateToISO(reviewDate)

  return {
    startDate: startIso,
    expectedEndDate: endIso,
    reviewDueDate: reviewIso
  }
}

/**
 * Normalizes any time string (12-hour AM/PM or 24-hour) to strict 24-hour HH:mm format.
 * Correctly handles:
 *  - 12 AM -> 00:xx (midnight)
 *  - 12 PM -> 12:xx (noon)
 *  - Standard AM: 01:00 AM to 11:59 AM -> 01:00 to 11:59
 *  - Standard PM: 01:00 PM to 11:59 PM -> 13:00 to 23:59
 *  - Already 24h: 00:00 to 23:59 -> unchanged
 */
export function normalizeTimeTo24Hour(timeInput) {
  if (!timeInput) return '09:00'
  const str = String(timeInput).trim()
  if (!str) return '09:00'

  // Match: [H]H:MM[:SS] [AM|PM] or [H]H:MM
  const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i)
  if (!match) {
    if (/^\d{2}:\d{2}$/.test(str)) return str
    return str
  }

  let hours = parseInt(match[1], 10)
  const minutes = String(parseInt(match[2], 10)).padStart(2, '0')
  const period = match[3] ? match[3].toUpperCase() : null

  if (period === 'AM') {
    if (hours === 12) {
      hours = 0
    }
  } else if (period === 'PM') {
    if (hours < 12) {
      hours += 12
    }
  } else {
    // No AM/PM: already 24h
    if (hours < 0 || hours > 23) hours = 0
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`
}

/**
 * Formats any time string (24-hour HH:mm or existing 12-hour) to strict 12-hour AM/PM format.
 * Examples:
 *  - '08:00' -> '08:00 AM'
 *  - '17:00' -> '05:00 PM'
 *  - '18:00' -> '06:00 PM'
 *  - '00:00' -> '12:00 AM'
 *  - '12:00' -> '12:00 PM'
 *  - '09:30' -> '09:30 AM'
 *  - '18:30' -> '06:30 PM'
 */
export function formatTimeTo12Hour(timeInput) {
  if (!timeInput) return ''
  if (timeInput instanceof Date) {
    return getKarachiTime(timeInput, { hour12: true, seconds: true })
  }
  const str = String(timeInput).trim()
  if (!str || str === '—' || str === '-' || str === 'None' || str === '— : —' || str === '--:--') return str

  // If ISO date string in UTC/Z, convert to Asia/Karachi (PKT UTC+5)
  if (str.includes('T') || str.endsWith('Z')) {
    const d = new Date(str)
    if (!isNaN(d.getTime())) {
      return getKarachiTime(d, { hour12: true, seconds: true })
    }
  }

  // Check if it already has AM/PM (with optional seconds)
  const matchWithAmPm = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (matchWithAmPm) {
    const h = parseInt(matchWithAmPm[1], 10)
    const m = matchWithAmPm[2]
    const s = matchWithAmPm[3]
    const p = matchWithAmPm[4].toUpperCase()
    const secPart = s ? `:${s}` : ''
    return `${String(h).padStart(2, '0')}:${m}${secPart} ${p}`
  }

  // Check for 24-hour with optional seconds: HH:MM:SS
  const match24Sec = str.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (match24Sec) {
    let h = parseInt(match24Sec[1], 10)
    const m = match24Sec[2]
    const s = match24Sec[3]
    const period = h >= 12 ? 'PM' : 'AM'
    let displayHour = h % 12
    if (displayHour === 0) displayHour = 12
    return `${String(displayHour).padStart(2, '0')}:${m}:${s} ${period}`
  }

  // Parse standard 24-hour format
  const norm24 = normalizeTimeTo24Hour(str)
  if (!norm24 || !norm24.includes(':')) return str

  const [hStr, mStr] = norm24.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr ? mStr.slice(0, 2) : '00'

  if (isNaN(h)) return str

  const period = h >= 12 ? 'PM' : 'AM'
  let displayHour = h % 12
  if (displayHour === 0) displayHour = 12

  return `${String(displayHour).padStart(2, '0')}:${m} ${period}`
}

/**
 * Formats a start and end time range to 12-hour AM/PM format (e.g. '08:00 AM – 05:00 PM').
 */
export function formatTimeRangeTo12Hour(startTime, endTime) {
  if (!startTime && !endTime) return '—'
  const startFmt = formatTimeTo12Hour(startTime)
  const endFmt = formatTimeTo12Hour(endTime)
  if (startFmt && endFmt) return `${startFmt} – ${endFmt}`
  return startFmt || endFmt || '—'
}

/**
 * Calculates duration between two time strings (HH:mm or AM/PM format).
 * Returns total minutes, total hours (decimal), and formatted duration (e.g. '2h', '2h 30m').
 */
export function calculateTimeDuration(startTime, endTime) {
  const start = normalizeTimeTo24Hour(startTime)
  const end = normalizeTimeTo24Hour(endTime)

  const [sH, sM] = start.split(':').map((v) => parseInt(v, 10))
  const [eH, eM] = end.split(':').map((v) => parseInt(v, 10))

  let startMins = sH * 60 + sM
  let endMins = eH * 60 + eM

  if (endMins < startMins) {
    // Overnight duty
    endMins += 24 * 60
  }

  const diffMins = endMins - startMins
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60

  return {
    start24: start,
    end24: end,
    totalMinutes: diffMins,
    totalHours: Number((diffMins / 60).toFixed(2)),
    formatted: mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
}

let serverTimeSkewMs = 0

/**
 * Synchronizes client clock with authoritative server timestamp.
 * Decouples system clock/calendar from laptop's manual time.
 * @param {string|number|Date} serverTimeInput
 */
export function syncServerTime(serverTimeInput) {
  if (!serverTimeInput) return
  const serverTime = new Date(serverTimeInput).getTime()
  if (isNaN(serverTime)) return
  serverTimeSkewMs = serverTime - Date.now()
}

export function getServerTimeSkew() {
  return serverTimeSkewMs
}

/**
 * Returns current Date object synchronized to authoritative server time.
 */
export function getTrustedNow() {
  return new Date(Date.now() + serverTimeSkewMs)
}

/**
 * Returns current business date in Asia/Karachi timezone as strict YYYY-MM-DD.
 */
export function getKarachiToday() {
  try {
    const d = getTrustedNow()
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' })
    return formatter.format(d)
  } catch {
    return getTrustedNow().toISOString().slice(0, 10)
  }
}

/**
 * Returns current time in Asia/Karachi timezone in 24-hour format HH:MM (or HH:MM:SS).
 */
export function getKarachiTime(d = null, options = {}) {
  const dateObj = d ? new Date(d) : getTrustedNow()
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: options.seconds ? '2-digit' : undefined,
      hour12: options.hour12 !== undefined ? options.hour12 : false
    }).format(dateObj)
  } catch {
    return dateObj.toTimeString().slice(0, options.seconds ? 8 : 5)
  }
}

/**
 * Returns current formatted live clock time string in Asia/Karachi timezone (e.g. 08:35:10 PM).
 */
export function getKarachiTimeString(d = null) {
  const dateObj = d ? new Date(d) : getTrustedNow()
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(dateObj)
  } catch {
    return dateObj.toLocaleTimeString()
  }
}

/**
 * Resolves standard enterprise date filter presets (Today, Yesterday, Last 7 Days, This Month, Custom).
 */
export function getDateFilterRange(preset, customStart = null, customEnd = null) {
  const today = getKarachiToday()
  const todayDate = new Date(`${today}T00:00:00`)

  if (preset === 'today') {
    return { startDate: today, endDate: today }
  }

  if (preset === 'yesterday') {
    const yest = new Date(todayDate.getTime() - 86400000)
    const yestStr = normalizeDateToISO(yest)
    return { startDate: yestStr, endDate: yestStr }
  }

  if (preset === 'last7' || preset === 'last_7_days' || preset === 'week') {
    const start7 = new Date(todayDate.getTime() - 6 * 86400000)
    return { startDate: normalizeDateToISO(start7), endDate: today }
  }

  if (preset === 'month' || preset === 'this_month') {
    const [y, m] = today.split('-')
    const startMonth = `${y}-${m}-01`
    return { startDate: startMonth, endDate: today }
  }

  if (preset === 'custom' && customStart && customEnd) {
    return {
      startDate: normalizeDateToISO(customStart),
      endDate: normalizeDateToISO(customEnd)
    }
  }

  return { startDate: null, endDate: null }
}

/**
 * Sorts any collection of date-based objects Latest First (descending).
 */
export function sortByDateDescending(records = [], dateField = 'date') {
  return [...records].sort((a, b) => {
    const dateA = a[dateField] || a.createdDate || a.createdAt || a.joinDate || a.attendanceDate || a.recordedAt || ''
    const dateB = b[dateField] || b.createdDate || b.createdAt || b.joinDate || b.attendanceDate || b.recordedAt || ''
    return String(dateB).localeCompare(String(dateA))
  })
}

/**
 * Sorts any collection of date-based objects Oldest First (ascending).
 */
export function sortByDateAscending(records = [], dateField = 'date') {
  return [...records].sort((a, b) => {
    const dateA = a[dateField] || a.createdDate || a.createdAt || a.joinDate || a.attendanceDate || a.recordedAt || ''
    const dateB = b[dateField] || b.createdDate || b.createdAt || b.joinDate || b.attendanceDate || b.recordedAt || ''
    return String(dateA).localeCompare(String(dateB))
  })
}

/**
 * Safely formats any calendar date into canonical UK/Pakistan display format (DD/MM/YYYY).
 * Strictly preserves the calendar day without UTC/negative-offset rollback (e.g. 01/11/2026 never becomes 31/10/2026).
 * @param {string|Date|number} value
 * @returns {string} DD/MM/YYYY or '—'
 */
export function fmtDate(value) {
  if (!value) return '—'
  if (typeof value === 'string') {
    const s = value.trim()
    // Direct DD/MM/YYYY or DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (dmy) {
      const [, day, month, year] = dmy
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
    }
    // Strict calendar date YYYY-MM-DD
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (ymd) {
      const [, year, month, day] = ymd
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
    }
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' })
}

/**
 * Formats late or early arrival/exit minutes into human-readable duration format.
 * Examples:
 *  - 443 minutes, 'Late' -> '7h 23m Late'
 *  - 60 minutes, 'Late'  -> '1h Late'
 *  - 13 minutes, 'Late'  -> '13m Late'
 *  - 97 minutes, 'Early' -> '1h 37m Early'
 *  - 0 minutes, 'Late'   -> '0m Late'
 *
 * @param {number|string} minutes
 * @param {string} label - 'Late' or 'Early'
 * @returns {string}
 */
export function formatLateDuration(minutes, label = 'Late') {
  const m = Math.max(0, parseInt(minutes, 10) || 0)
  if (m === 0) return `0m ${label}`
  const hours = Math.floor(m / 60)
  const remMinutes = m % 60
  if (hours > 0 && remMinutes > 0) {
    return `${hours}h ${remMinutes}m ${label}`
  }
  if (hours > 0) {
    return `${hours}h ${label}`
  }
  return `${remMinutes}m ${label}`
}
