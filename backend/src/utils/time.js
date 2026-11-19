/**
 * iSysware HRMS — Pakistan / Karachi Timezone & Time Calculation Helpers
 * Default timezone: Asia/Karachi (UTC+5).
 * Ensures business dates are decoupled from UTC instants and calculation rules are deterministic.
 */

const TIMEZONE = 'Asia/Karachi'

/**
 * Returns current or specified date string in Asia/Karachi (YYYY-MM-DD).
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export function getKarachiDate(date = new Date()) {
  const d = new Date(date)
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/**
 * Returns current or specified 24-hour time string in Asia/Karachi (HH:MM).
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} HH:MM
 */
export function getKarachiTime(date = new Date(), includeSeconds = false) {
  const d = new Date(date)
  return d.toLocaleTimeString('en-GB', {
    timeZone: TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined
  })
}

/**
 * Converts 24-hour HH:MM string to minutes from midnight.
 * e.g. "09:15" -> 555
 * @param {string} timeStr
 * @returns {number}
 */
export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0
  const [hours, minutes] = timeStr.split(':').map((v) => parseInt(v, 10))
  return (isNaN(hours) ? 0 : hours * 60) + (isNaN(minutes) ? 0 : minutes)
}

/**
 * Converts minutes from midnight to 24-hour HH:MM string.
 * e.g. 555 -> "09:15"
 * @param {number} totalMinutes
 * @returns {string}
 */
export function minutesToTime(totalMinutes) {
  const clamped = Math.max(0, Math.floor(totalMinutes)) % 1440
  const hours = String(Math.floor(clamped / 60)).padStart(2, '0')
  const minutes = String(clamped % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Converts 24-hour HH:MM string to 12-hour AM/PM display format.
 * e.g. "08:00" -> "08:00 AM", "17:00" -> "05:00 PM"
 * @param {string} timeStr
 * @returns {string}
 */
export function format12Hour(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '--:--'
  const [hStr, mStr, sStr] = timeStr.split(':')
  let hours = parseInt(hStr, 10)
  const minutes = mStr ? mStr.slice(0, 2) : '00'
  const seconds = sStr ? sStr.slice(0, 2) : null

  if (isNaN(hours)) return timeStr

  const period = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  const secPart = seconds ? `:${seconds}` : ''
  return `${String(hours).padStart(2, '0')}:${minutes}${secPart} ${period}`
}

/**
 * Calculates work minutes, break deductions, and lateness against shift parameters.
 * @param {object} params
 * @param {string} params.checkInTime - HH:MM
 * @param {string} [params.checkOutTime] - HH:MM
 * @param {object} params.shift
 * @returns {object} calculated minutes
 */
export function calculateAttendanceMetrics({ checkInTime, checkOutTime, shift }) {
  const checkInMin = timeToMinutes(checkInTime)
  const shiftStartMin = timeToMinutes(shift.startTime)
  const shiftEndMin = timeToMinutes(shift.endTime)
  const graceIn = shift.graceMinutesIn || 15
  const graceOut = shift.graceMinutesOut || 15
  const breakDuration = shift.breakDurationMinutes || 0

  // Late Arrival Calculation
  let lateMinutes = 0
  if (checkInMin > shiftStartMin + graceIn) {
    lateMinutes = checkInMin - shiftStartMin
  }

  // Work & Early Exit Calculation
  let totalWorkMinutes = 0
  let actualWorkMinutes = 0
  let earlyExitMinutes = 0

  if (checkOutTime) {
    const checkOutMin = timeToMinutes(checkOutTime)
    
    // Check if overnight shift
    const isOvernight = shiftEndMin < shiftStartMin
    let grossMinutes = 0
    if (isOvernight && checkOutMin < checkInMin) {
      grossMinutes = (1440 - checkInMin) + checkOutMin
    } else {
      grossMinutes = Math.max(0, checkOutMin - checkInMin)
    }

    totalWorkMinutes = grossMinutes
    actualWorkMinutes = Math.max(0, grossMinutes - breakDuration)

    // Early exit
    if (!isOvernight && checkOutMin < shiftEndMin - graceOut) {
      earlyExitMinutes = shiftEndMin - checkOutMin
    }
  }

  return {
    lateMinutes,
    earlyExitMinutes,
    totalWorkMinutes,
    totalBreakMinutes: breakDuration,
    actualWorkMinutes
  }
}

