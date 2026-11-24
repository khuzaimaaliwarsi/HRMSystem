/**
 * iSysware HRMS — LocalStorage Cutover & Safe Business Data Elimination Utility
 * Enforces the strict architectural requirement:
 * "NO HRMS business data may be saved in LocalStorage again."
 *
 * Exact Strategy:
 * 1. Strictly identifies and removes all business data keys (f02 through f13, demo sessions, mock accounts).
 * 2. Strictly preserves UI preferences ONLY:
 *    - hrms_theme
 *    - hrms_sidebar_collapsed
 *    - hrms_table_density
 *    - Any non-HRMS browser preferences.
 * 3. Installs an impermeable shield on window.localStorage:
 *    - Intercepts and drops ANY subsequent writes of business data to window.localStorage in browser runtime.
 *    - Intercepts and returns null on any reads of business keys from localStorage.
 */

export const BUSINESS_STORAGE_KEYS = [
  'isysware_hrms_attendance_records_v1',
  'isysware_hrms_custom_employment_categories_v1',
  'isysware_hrms_custom_policy_categories_v1',
  'isysware_hrms_custom_training_categories_v1',
  'isysware_hrms_demo_session',
  'isysware_hrms_employees_data',
  'isysware_hrms_f02_bank_records_v1',
  'isysware_hrms_f02_career_history_v1',
  'isysware_hrms_f02_departments_v1',
  'isysware_hrms_f02_designations_v1',
  'isysware_hrms_f02_employees_v1',
  'isysware_hrms_f02_sub_departments_v1',
  'isysware_hrms_f02_succession_history_v1',
  'isysware_hrms_f02_team_assignment_history_v1',
  'isysware_hrms_f02_team_assignments_v1',
  'isysware_hrms_f02_teams_v1',
  'isysware_hrms_f03_candidates_v1',
  'isysware_hrms_f03_interviews_v1',
  'isysware_hrms_f03_offers_v1',
  'isysware_hrms_f03_probation_v1',
  'isysware_hrms_f03_requisitions_v1',
  'isysware_hrms_f03_vacancies_v1',
  'isysware_hrms_f04_attendance_records_v1',
  'isysware_hrms_f04_corrections_v1',
  'isysware_hrms_f04_field_duty_requests_v1',
  'isysware_hrms_f04_holidays_v1',
  'isysware_hrms_f04_overtime_requests_v1',
  'isysware_hrms_f04_policies_v1',
  'isysware_hrms_f04_shift_assignments_v1',
  'isysware_hrms_f04_shifts_v1',
  'isysware_hrms_f04_wfh_requests_v1',
  'isysware_hrms_f05_leave_adjustments_v1',
  'isysware_hrms_f05_leave_balances_v1',
  'isysware_hrms_f05_leave_journal_v1',
  'isysware_hrms_f05_leave_ledger_v1',
  'isysware_hrms_f05_leave_requests_v1',
  'isysware_hrms_f06_allowances_master_v1',
  'isysware_hrms_f06_comm_plans_v1',
  'isysware_hrms_f06_comm_tx_v1',
  'isysware_hrms_f06_emp_allowances_v1',
  'isysware_hrms_f06_loans_v1',
  'isysware_hrms_f06_payment_records_v1',
  'isysware_hrms_f06_payroll_runs_v1',
  'isysware_hrms_f06_payslips_v1',
  'isysware_hrms_f06_salary_revisions_v1',
  'isysware_hrms_f06_salary_structures_v1',
  'isysware_hrms_f07_cycles_v1',
  'isysware_hrms_f07_idp_v1',
  'isysware_hrms_f07_kpis_v1',
  'isysware_hrms_f07_reviews_v1',
  'isysware_hrms_f07_tasks_v1',
  'isysware_hrms_f08_certificates_v1',
  'isysware_hrms_f08_enrollments_v1',
  'isysware_hrms_f08_plans_v1',
  'isysware_hrms_f08_programs_v1',
  'isysware_hrms_f08_sessions_v1',
  'isysware_hrms_f09_categories_v1',
  'isysware_hrms_f09_teams_v1',
  'isysware_hrms_f09_tickets_v1',
  'isysware_hrms_f10_assignments_v1',
  'isysware_hrms_f10_drivers_v1',
  'isysware_hrms_f10_expenses_v1',
  'isysware_hrms_f10_plans_v1',
  'isysware_hrms_f10_requests_v1',
  'isysware_hrms_f10_routes_v1',
  'isysware_hrms_f10_vehicles_v1',
  'isysware_hrms_f11_letters_v1',
  'isysware_hrms_f11_templates_v1',
  'isysware_hrms_f12_authority_limits_v1',
  'isysware_hrms_f12_expense_audits_v1',
  'isysware_hrms_f12_expense_categories_v1',
  'isysware_hrms_f12_expense_claims_v1',
  'isysware_hrms_f13_alert_rules_v1',
  'isysware_hrms_f13_approval_rules_v1',
  'isysware_hrms_f13_audit_logs_v1',
  'isysware_hrms_f13_central_policies_v1',
  'isysware_hrms_f13_company_profile_v1',
  'isysware_hrms_f13_holidays_v1',
  'isysware_hrms_f13_notifications_v1',
  'isysware_hrms_f13_permissions_v1',
  'isysware_hrms_fresh_qa_backup_timestamp',
  'isysware_hrms_fresh_qa_mode_activated_at',
  'isysware_hrms_fresh_qa_mode_active',
  'isysware_hrms_legacy_test_key_v99',
  'isysware_hrms_role_change_history_v1',
  'isysware_hrms_timesheet_signoffs_v1',
  'isysware_hrms_unknown_experimental_key_v99',
  'isysware_hrms_user_accounts',
  'isysware_hrms_user_accounts_v1',
  'isysware_wfh_requests',
  'isysware_field_duty_requests',
  'isysware_operational_data_cleared'
]

export const PRESERVED_UI_KEYS = [
  'hrms_theme',
  'hrms_sidebar_collapsed',
  'hrms_table_density'
]

/**
 * Storage guard: In browser runtime, checks if a key represents business data.
 */
export function isBusinessKey(key) {
  if (typeof key !== 'string') return false
  if (PRESERVED_UI_KEYS.includes(key)) return false
  return (
    key.startsWith('isysware_') ||
    key.startsWith('hrms_data_') ||
    (key.startsWith('hrms_') && !PRESERVED_UI_KEYS.includes(key)) ||
    BUSINESS_STORAGE_KEYS.includes(key)
  )
}

/**
 * Installs an impermeable shield on window.localStorage in browser runtime.
 * Any attempt to write business data is intercepted and dropped immediately.
 */
export function installLocalStorageShield() {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (window.__hrms_shield_active) return

  try {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    const originalGetItem = window.localStorage.getItem.bind(window.localStorage)

    window.localStorage.setItem = function (key, value) {
      if (typeof key === 'string' && isBusinessKey(key)) {
        // Strictly prevent saving business data in browser localStorage
        return
      }
      return originalSetItem(key, value)
    }

    window.localStorage.getItem = function (key) {
      if (typeof key === 'string' && isBusinessKey(key)) {
        // Return null for business keys so services rely strictly on API and in-memory state
        return null
      }
      return originalGetItem(key)
    }

    if (typeof Storage !== 'undefined' && Storage.prototype) {
      const origStorageSetItem = Storage.prototype.setItem
      const origStorageGetItem = Storage.prototype.getItem
      Storage.prototype.setItem = function (key, value) {
        if (typeof key === 'string' && isBusinessKey(key)) {
          return
        }
        return origStorageSetItem.call(this, key, value)
      }
      Storage.prototype.getItem = function (key) {
        if (typeof key === 'string' && isBusinessKey(key)) {
          return null
        }
        return origStorageGetItem.call(this, key)
      }
    }

    window.__hrms_shield_active = true
  } catch (err) {
    console.warn('[storageCutover] Shield setup warning:', err.message)
  }
}

/**
 * Executes idempotent one-time exact key cleanup on browser initialization.
 * Purges all legacy HRMS business keys while strictly preserving UI preferences.
 */
export function executeCutoverCleanup() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { cleanedCount: 0, preservedCount: 0 }
  }

  let cleaned = 0

  // 1. Purge all known legacy business keys
  for (const key of BUSINESS_STORAGE_KEYS) {
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key)
        cleaned++
      }
    } catch (_) {}
  }

  // 2. Dynamic sweep for any remaining isysware_* or business keys
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i)
      if (k && isBusinessKey(k)) {
        window.localStorage.removeItem(k)
        cleaned++
      }
    }
  } catch (_) {}

  // 3. Remove any __hrms_shield_active key from localStorage if previously stored
  try {
    window.localStorage.removeItem('__hrms_shield_active')
  } catch (_) {}

  // 4. Install permanent interceptor shield
  installLocalStorageShield()

  return { cleanedCount: cleaned, preservedCount: PRESERVED_UI_KEYS.length }
}

// Automatically enforce cutover and shield on module import
if (typeof window !== 'undefined' && window.localStorage) {
  executeCutoverCleanup()
}

export default {
  executeCutoverCleanup,
  installLocalStorageShield,
  BUSINESS_STORAGE_KEYS,
  PRESERVED_UI_KEYS,
  isBusinessKey
}
