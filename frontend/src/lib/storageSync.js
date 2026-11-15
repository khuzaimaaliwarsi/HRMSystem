import { employeeService } from '../services/employeeService.js'
import { attendanceService } from '../services/attendanceService.js'
import { shiftService } from '../services/shiftService.js'
import { attendancePolicyService } from '../services/attendancePolicyService.js'
import { leaveService } from '../services/leaveService.js'
import { leaveBalanceService } from '../services/leaveBalanceService.js'
import { payrollService } from '../services/payrollService.js'
import { loanService } from '../services/loanService.js'
import { compensationService } from '../services/compensationService.js'
import { performanceService } from '../services/performanceService.js'
import { taskService } from '../services/taskService.js'
import { recruitmentService } from '../services/recruitmentService.js'
import { trainingService } from '../services/trainingService.js'
import { helpDeskService } from '../services/helpDeskService.js'
import { travelService } from '../services/travelService.js'
import { expenseService } from '../services/expenseService.js'
import { hrLettersService } from '../services/hrLettersService.js'
import { companySettingsService } from '../services/companySettingsService.js'
import { permissionService } from '../services/permissionService.js'

/**
 * Service mapping registry for cross-tab synchronization.
 * Associates storage key substrings with their respective services.
 */
const SERVICE_KEY_MAPPING = [
  { match: ['employee', 'hierarchy', 'department', 'team', 'designation'], services: [employeeService] },
  { match: ['attendance', 'clock', 'checkin', 'punch', 'correction', 'wfh', 'field_duty', 'overtime', 'timesheet'], services: [attendanceService] },
  { match: ['shift', 'roster'], services: [shiftService, attendanceService] },
  { match: ['attendance_policy'], services: [attendancePolicyService] },
  { match: ['leave', 'holiday', 'entitlement'], services: [leaveService, leaveBalanceService] },
  { match: ['payroll', 'payslip', 'salary'], services: [payrollService] },
  { match: ['loan', 'advance'], services: [loanService] },
  { match: ['compensation', 'structure', 'allowance'], services: [compensationService] },
  { match: ['performance', 'appraisal', 'review', 'goal'], services: [performanceService] },
  { match: ['task'], services: [taskService] },
  { match: ['recruitment', 'candidate', 'vacancy', 'requisition', 'offer', 'interview'], services: [recruitmentService] },
  { match: ['training', 'course', 'enrollment'], services: [trainingService] },
  { match: ['helpdesk', 'ticket'], services: [helpDeskService] },
  { match: ['travel'], services: [travelService] },
  { match: ['expense'], services: [expenseService] },
  { match: ['letter', 'hrletters'], services: [hrLettersService] },
  { match: ['company', 'settings'], services: [companySettingsService] },
  { match: ['permission', 'role'], services: [permissionService] }
]

const ALL_SERVICES = [
  employeeService,
  attendanceService,
  shiftService,
  attendancePolicyService,
  leaveService,
  leaveBalanceService,
  payrollService,
  loanService,
  compensationService,
  performanceService,
  taskService,
  recruitmentService,
  trainingService,
  helpDeskService,
  travelService,
  expenseService,
  hrLettersService,
  companySettingsService,
  permissionService
]

let isInitialized = false
let scheduledNotifies = new Set()
let debounceTimer = null

/**
 * Safely triggers _notify on a service without triggering storage events or loops.
 */
function safelyNotifyService(service) {
  if (service && typeof service._notify === 'function') {
    try {
      service._notify()
    } catch (err) {
      console.warn('[storageSync] Error notifying service:', err)
    }
  }
}

/**
 * Debounced batch processor to prevent multiple notifications for quick burst writes.
 */
function flushPendingNotifies() {
  const targets = Array.from(scheduledNotifies)
  scheduledNotifies.clear()
  debounceTimer = null

  for (const service of targets) {
    safelyNotifyService(service)
  }
}

/**
 * Schedules a service notification with 35ms debounce.
 */
function queueServiceNotify(service) {
  scheduledNotifies.add(service)
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(flushPendingNotifies, 35)
}

/**
 * Primary Storage Event Handler.
 * Fired by the browser when another open tab/window modifies localStorage.
 */
export function handleStorageEvent(event) {
  if (!event) return

  // Full clear or reset event (key === null)
  if (event.key === null) {
    ALL_SERVICES.forEach(service => queueServiceNotify(service))
    return
  }

  const key = (event.key || '').toLowerCase()

  // Only handle HRMS keys
  if (!key.startsWith('isysware_') && !key.startsWith('hrms_')) {
    return
  }

  let matched = false
  for (const mapping of SERVICE_KEY_MAPPING) {
    if (mapping.match.some(m => key.includes(m))) {
      mapping.services.forEach(s => queueServiceNotify(s))
      matched = true
    }
  }

  // If unrecognized HRMS key, notify all as safe fallback
  if (!matched) {
    ALL_SERVICES.forEach(s => queueServiceNotify(s))
  }
}

/**
 * Initializes cross-tab synchronization listener.
 * Safe to call multiple times (idempotent).
 */
export function initStorageSynchronization() {
  if (typeof window === 'undefined' || isInitialized) {
    return () => {}
  }

  window.addEventListener('storage', handleStorageEvent)
  isInitialized = true

  return () => {
    window.removeEventListener('storage', handleStorageEvent)
    isInitialized = false
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    scheduledNotifies.clear()
  }
}

export default {
  initStorageSynchronization,
  handleStorageEvent
}
