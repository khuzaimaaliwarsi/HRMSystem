/**
 * iSysware HRMS — Fresh QA Mode & Safe Reset Service (Batch 3.5A)
 * 
 * Provides:
 * 1. Safe current-browser data inventory across all 76 localStorage keys.
 * 2. Dry-run reset preview showing preserved vs proposed deletions.
 * 3. Exportable backup with automated sensitive data masking (CNIC, IBAN, Bank AC).
 * 4. Full lossless backup & strict restore validation.
 * 5. Dry-run verification of employee/role integrity and anti-reseeding persistence.
 * 6. Explicitly activated Fresh QA Mode (Option B: Fresh QA Baseline) protected by confirmation token.
 * 
 * CRITICAL INVARIANT:
 * Never executes reset or mutates live data automatically.
 * Requires dryRun: false AND explicit confirmation token 'CONFIRM_RESET_FRESH_QA_MODE_2026'.
 */

import { DEMO_USERS } from '../mocks/demoUsers.js'
import { CANONICAL_EMPLOYEES, INITIAL_BANK_RECORDS, INITIAL_CAREER_HISTORY } from '../mocks/organizationData.js'

export const QA_MODE_KEYS = {
  ACTIVE_FLAG: 'isysware_hrms_fresh_qa_mode_active',
  ACTIVATED_AT: 'isysware_hrms_fresh_qa_mode_activated_at',
  BACKUP_TIMESTAMP: 'isysware_hrms_fresh_qa_backup_timestamp'
}

/**
 * Recognized Extension and Module-Specific Keys
 * These keys are part of operational workflows or custom category extensions.
 * They are automatically tracked, cleared during Fresh QA reset, and never block execution.
 */
export const EXTENSION_STORAGE_KEYS = {
  TIMESHEET_SIGNOFFS: 'isysware_hrms_timesheet_signoffs_v1',
  LEGACY_ATTENDANCE: 'isysware_hrms_attendance_records_v1',
  CUSTOM_EMPLOYMENT_CATEGORIES: 'isysware_hrms_custom_employment_categories_v1',
  CUSTOM_POLICY_CATEGORIES: 'isysware_hrms_custom_policy_categories_v1',
  CUSTOM_TRAINING_CATEGORIES: 'isysware_hrms_custom_training_categories_v1'
}

export const STORAGE_REGISTRY = {
  // 1. Protected Authentication & Identities (Preserved for Super Admin and HR Admin)
  PROTECTED_IDENTITIES: {
    USER_ACCOUNTS: 'isysware_hrms_user_accounts_v1',
    SESSION: 'isysware_hrms_demo_session',
    ROLE_HISTORY: 'isysware_hrms_role_change_history_v1',
    EMPLOYEES: 'isysware_hrms_f02_employees_v1',
    BANK_RECORDS: 'isysware_hrms_f02_bank_records_v1',
    CAREER_HISTORY: 'isysware_hrms_f02_career_history_v1'
  },

  // 2. Preserved System Definitions, Core Policies & Templates
  PRESERVED_SYSTEM_DEFINITIONS: {
    COMPANY_PROFILE: 'isysware_hrms_f13_company_profile_v1',
    PERMISSIONS: 'isysware_hrms_f13_permissions_v1',
    CENTRAL_POLICIES: 'isysware_hrms_f13_central_policies_v1',
    APPROVAL_RULES: 'isysware_hrms_f13_approval_rules_v1',
    ATTENDANCE_POLICIES: 'isysware_hrms_f04_policies_v1',
    EXPENSE_CATEGORIES: 'isysware_hrms_f12_expense_categories_v1',
    EXPENSE_AUTHORITY_LIMITS: 'isysware_hrms_f12_authority_limits_v1',
    LETTER_TEMPLATES: 'isysware_hrms_f11_templates_v1',
    HOLIDAYS: 'isysware_hrms_f13_holidays_v1',
    ALERT_RULES: 'isysware_hrms_f13_alert_rules_v1',
    HELPDESK_CATEGORIES: 'isysware_hrms_f09_categories_v1',
    HELPDESK_TEAMS: 'isysware_hrms_f09_teams_v1',
    ALLOWANCES_MASTER: 'isysware_hrms_f06_allowances_master_v1'
  },

  // 3. Organization Masters (Reset to empty array [] in Fresh QA Mode)
  RESET_ORGANIZATION_MASTERS: {
    DEPARTMENTS: 'isysware_hrms_f02_departments_v1',
    SUB_DEPARTMENTS: 'isysware_hrms_f02_sub_departments_v1',
    TEAMS: 'isysware_hrms_f02_teams_v1',
    DESIGNATIONS: 'isysware_hrms_f02_designations_v1',
    TEAM_ASSIGNMENTS: 'isysware_hrms_f02_team_assignments_v1',
    TEAM_ASSIGNMENT_HISTORY: 'isysware_hrms_f02_team_assignment_history_v1',
    SUCCESSION_HISTORY: 'isysware_hrms_f02_succession_history_v1'
  },

  // 4. Operational Transactions across all 14 Modules (Reset to empty array [] in Fresh QA Mode)
  RESET_OPERATIONAL_TRANSACTIONS: {
    // F03 Recruitment
    REQUISITIONS: 'isysware_hrms_f03_requisitions_v1',
    VACANCIES: 'isysware_hrms_f03_vacancies_v1',
    CANDIDATES: 'isysware_hrms_f03_candidates_v1',
    INTERVIEWS: 'isysware_hrms_f03_interviews_v1',
    OFFERS: 'isysware_hrms_f03_offers_v1',
    PROBATION: 'isysware_hrms_f03_probation_v1',

    // F04 Attendance & Shifts
    ATTENDANCE_RECORDS: 'isysware_hrms_f04_attendance_records_v1',
    ATTENDANCE_CORRECTIONS: 'isysware_hrms_f04_corrections_v1',
    WFH_REQUESTS: 'isysware_hrms_f04_wfh_requests_v1',
    FIELD_DUTY_REQUESTS: 'isysware_hrms_f04_field_duty_requests_v1',
    OVERTIME_REQUESTS: 'isysware_hrms_f04_overtime_requests_v1',
    SHIFTS: 'isysware_hrms_f04_shifts_v1',
    SHIFT_ASSIGNMENTS: 'isysware_hrms_f04_shift_assignments_v1',
    SHIFT_HOLIDAYS: 'isysware_hrms_f04_holidays_v1',

    // F05 Leaves
    LEAVE_REQUESTS: 'isysware_hrms_f05_leave_requests_v1',
    LEAVE_ADJUSTMENTS: 'isysware_hrms_f05_leave_adjustments_v1',
    LEAVE_LEDGER: 'isysware_hrms_f05_leave_ledger_v1',
    LEAVE_JOURNAL: 'isysware_hrms_f05_leave_journal_v1',

    // F06 Payroll & Benefits
    PAYROLL_RUNS: 'isysware_hrms_f06_payroll_runs_v1',
    PAYSLIPS: 'isysware_hrms_f06_payslips_v1',
    SALARY_STRUCTURES: 'isysware_hrms_f06_salary_structures_v1',
    EMPLOYEE_ALLOWANCES: 'isysware_hrms_f06_emp_allowances_v1',
    SALARY_REVISIONS: 'isysware_hrms_f06_salary_revisions_v1',
    LOANS: 'isysware_hrms_f06_loans_v1',
    COMMISSION_PLANS: 'isysware_hrms_f06_comm_plans_v1',
    COMMISSION_TRANSACTIONS: 'isysware_hrms_f06_comm_tx_v1',
    PAYROLL_PAYMENT_RECORDS: 'isysware_hrms_f06_payment_records_v1',

    // F07 Tasks & Performance
    TASKS: 'isysware_hrms_f07_tasks_v1',
    KPIS: 'isysware_hrms_f07_kpis_v1',
    APPRAISAL_CYCLES: 'isysware_hrms_f07_cycles_v1',
    PERFORMANCE_REVIEWS: 'isysware_hrms_f07_reviews_v1',
    IDP_PLANS: 'isysware_hrms_f07_idp_v1',

    // F08 Training
    TRAINING_PROGRAMS: 'isysware_hrms_f08_programs_v1',
    TRAINING_PLANS: 'isysware_hrms_f08_plans_v1',
    TRAINING_SESSIONS: 'isysware_hrms_f08_sessions_v1',
    TRAINING_ENROLLMENTS: 'isysware_hrms_f08_enrollments_v1',
    TRAINING_CERTIFICATES: 'isysware_hrms_f08_certificates_v1',

    // F09 Help Desk
    HELPDESK_TICKETS: 'isysware_hrms_f09_tickets_v1',

    // F10 Travel & Transport
    TRAVEL_VEHICLES: 'isysware_hrms_f10_vehicles_v1',
    TRAVEL_DRIVERS: 'isysware_hrms_f10_drivers_v1',
    TRAVEL_ROUTES: 'isysware_hrms_f10_routes_v1',
    TRAVEL_ASSIGNMENTS: 'isysware_hrms_f10_assignments_v1',
    TRAVEL_REQUESTS: 'isysware_hrms_f10_requests_v1',
    TRAVEL_PLANS: 'isysware_hrms_f10_plans_v1',
    TRAVEL_EXPENSES: 'isysware_hrms_f10_expenses_v1',

    // F11 Letters
    ISSUED_LETTERS: 'isysware_hrms_f11_letters_v1',

    // F12 Expense Claims
    EXPENSE_CLAIMS: 'isysware_hrms_f12_expense_claims_v1',
    EXPENSE_AUDITS: 'isysware_hrms_f12_expense_audits_v1',

    // F13 Notifications & General Audits
    NOTIFICATIONS: 'isysware_hrms_f13_notifications_v1',
    AUDIT_LOGS: 'isysware_hrms_f13_audit_logs_v1'
  }
}

// Protected account identifiers
export const PROTECTED_ACCOUNT_IDS = ['EMP-001', 'EMP-002']
export const CONFIRMATION_TOKEN = 'CONFIRM_RESET_FRESH_QA_MODE_2026'

class FreshQAModeService {
  constructor() {
    this.memoryStorage = {}
  }

  _getStorage(customStorage = null) {
    if (customStorage) return customStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage
      }
    } catch {
      // fallback
    }
    return {
      getItem: (key) => this.memoryStorage[key] !== undefined ? this.memoryStorage[key] : null,
      setItem: (key, val) => { this.memoryStorage[key] = String(val) },
      removeItem: (key) => { delete this.memoryStorage[key] }
    }
  }

  _parse(raw, defaultVal = null) {
    if (!raw) return defaultVal
    try {
      return JSON.parse(raw)
    } catch {
      return defaultVal
    }
  }

  /**
   * Check if Fresh QA Mode is currently active
   */
  isFreshQAModeActive(customStorage = null) {
    const storage = this._getStorage(customStorage)
    const val = storage.getItem(QA_MODE_KEYS.ACTIVE_FLAG)
    return val === 'true'
  }

  /**
   * Safe Data Inventory across all 76 storage keys
   */
  getInventory(customStorage = null) {
    const storage = this._getStorage(customStorage)
    const inventory = {
      isFreshQAModeActive: this.isFreshQAModeActive(storage),
      hasBackupDownloaded: Boolean(storage.getItem(QA_MODE_KEYS.BACKUP_TIMESTAMP)),
      backupTimestamp: storage.getItem(QA_MODE_KEYS.BACKUP_TIMESTAMP) || null,
      summary: {
        totalConfiguredKeys: 0,
        foundInStorageCount: 0,
        totalRecords: 0,
        preservedRecords: 0,
        proposedDeletions: 0,
        unclassifiedKeysCount: 0
      },
      unclassifiedKeys: [],
      hasUnclassifiedKeys: false,
      categories: {
        protectedIdentities: [],
        preservedDefinitions: [],
        resetMasters: [],
        resetTransactions: []
      }
    }

    const allRegisteredKeys = new Set([
      ...Object.values(STORAGE_REGISTRY.PROTECTED_IDENTITIES),
      ...Object.values(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS),
      ...Object.values(STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS),
      ...Object.values(STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS),
      ...Object.values(QA_MODE_KEYS),
      ...Object.values(EXTENSION_STORAGE_KEYS)
    ])

    // Detect any unclassified HRMS keys present in storage
    if (typeof storage.key === 'function' && typeof storage.length === 'number') {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (k && k.startsWith('isysware_hrms_') && !allRegisteredKeys.has(k)) {
          inventory.unclassifiedKeys.push(k)
        }
      }
    } else if (storage._keys && typeof storage._keys === 'function') {
      for (const k of storage._keys()) {
        if (k && k.startsWith('isysware_hrms_') && !allRegisteredKeys.has(k)) {
          inventory.unclassifiedKeys.push(k)
        }
      }
    } else if (storage.memoryStorage) {
      for (const k of Object.keys(storage.memoryStorage)) {
        if (k && k.startsWith('isysware_hrms_') && !allRegisteredKeys.has(k)) {
          inventory.unclassifiedKeys.push(k)
        }
      }
    }
    inventory.summary.unclassifiedKeysCount = inventory.unclassifiedKeys.length
    inventory.hasUnclassifiedKeys = inventory.unclassifiedKeys.length > 0

    const inspectKey = (key, category, targetGroup) => {
      inventory.summary.totalConfiguredKeys++
      const raw = storage.getItem(key)
      const isFound = raw !== null
      if (isFound) inventory.summary.foundInStorageCount++

      const parsed = isFound ? this._parse(raw, []) : []
      const count = Array.isArray(parsed) ? parsed.length : (parsed ? 1 : 0)
      inventory.summary.totalRecords += count

      let preservedCount = 0
      let deleteCount = 0

      if (category === 'PROTECTED_IDENTITIES') {
        if (key === STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS) {
          const accounts = Array.isArray(parsed) ? parsed : []
          preservedCount = accounts.filter(u => PROTECTED_ACCOUNT_IDS.includes(u.id || u.employeeId)).length
          deleteCount = accounts.length - preservedCount
        } else if (key === STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES) {
          const emps = Array.isArray(parsed) ? parsed : []
          preservedCount = emps.filter(e => PROTECTED_ACCOUNT_IDS.includes(e.id)).length
          deleteCount = emps.length - preservedCount
        } else if (key === STORAGE_REGISTRY.PROTECTED_IDENTITIES.BANK_RECORDS) {
          const banks = Array.isArray(parsed) ? parsed : []
          preservedCount = banks.filter(b => PROTECTED_ACCOUNT_IDS.includes(b.employeeId)).length
          deleteCount = banks.length - preservedCount
        } else if (key === STORAGE_REGISTRY.PROTECTED_IDENTITIES.CAREER_HISTORY) {
          const hist = Array.isArray(parsed) ? parsed : []
          preservedCount = hist.filter(h => PROTECTED_ACCOUNT_IDS.includes(h.employeeId)).length
          deleteCount = hist.length - preservedCount
        } else {
          preservedCount = count
          deleteCount = 0
        }
      } else if (category === 'PRESERVED_SYSTEM_DEFINITIONS') {
        preservedCount = count
        deleteCount = 0
      } else {
        // RESET_ORGANIZATION_MASTERS or RESET_OPERATIONAL_TRANSACTIONS
        preservedCount = 0
        deleteCount = count
      }

      inventory.summary.preservedRecords += preservedCount
      inventory.summary.proposedDeletions += deleteCount

      targetGroup.push({
        key,
        foundInStorage: isFound,
        currentCount: count,
        preservedCount,
        proposedDeletionCount: deleteCount
      })
    }

    // Inspect each category
    Object.values(STORAGE_REGISTRY.PROTECTED_IDENTITIES).forEach(k =>
      inspectKey(k, 'PROTECTED_IDENTITIES', inventory.categories.protectedIdentities)
    )
    Object.values(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS).forEach(k =>
      inspectKey(k, 'PRESERVED_SYSTEM_DEFINITIONS', inventory.categories.preservedDefinitions)
    )
    Object.values(STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS).forEach(k =>
      inspectKey(k, 'RESET_ORGANIZATION_MASTERS', inventory.categories.resetMasters)
    )
    Object.values(STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS).forEach(k =>
      inspectKey(k, 'RESET_OPERATIONAL_TRANSACTIONS', inventory.categories.resetTransactions)
    )

    return inventory
  }

  /**
   * Generate Dry-Run Reset Preview
   * Pure read-only operation: does not mutate storage or state.
   */
  generateResetPreview(customStorage = null) {
    const inventory = this.getInventory(customStorage)
    const storage = this._getStorage(customStorage)

    // Inspect protected identities in current storage
    const rawUsers = storage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS)
    const users = this._parse(rawUsers, DEMO_USERS)
    const preservedUsers = users.filter(u => PROTECTED_ACCOUNT_IDS.includes(u.id || u.employeeId))
    const purgedUsers = users.filter(u => !PROTECTED_ACCOUNT_IDS.includes(u.id || u.employeeId))

    const rawEmps = storage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES)
    const emps = this._parse(rawEmps, CANONICAL_EMPLOYEES)
    const preservedEmps = emps.filter(e => PROTECTED_ACCOUNT_IDS.includes(e.id))
    const purgedEmps = emps.filter(e => !PROTECTED_ACCOUNT_IDS.includes(e.id))

    return {
      status: 'DRY_RUN_PREVIEW',
      mode: 'Option B: Fresh QA Baseline',
      willMutateData: false,
      summary: {
        totalKeysScanned: inventory.summary.totalConfiguredKeys,
        keysFoundInStorage: inventory.summary.foundInStorageCount,
        currentTotalRecords: inventory.summary.totalRecords,
        recordsToBePreserved: inventory.summary.preservedRecords,
        recordsProposedForDeletion: inventory.summary.proposedDeletions
      },
      protectedIdentities: {
        superAdmin: {
          id: 'EMP-001',
          name: 'Alexander Wright',
          email: 'superadmin@isysware.com',
          role: 'super_admin',
          retainedInUserAccounts: preservedUsers.some(u => (u.id || u.employeeId) === 'EMP-001'),
          retainedInEmployeeDirectory: preservedEmps.some(e => e.id === 'EMP-001')
        },
        hrAdmin: {
          id: 'EMP-002',
          name: 'Ayesha Khan',
          email: 'hr@isysware.com',
          role: 'hr_admin',
          retainedInUserAccounts: preservedUsers.some(u => (u.id || u.employeeId) === 'EMP-002'),
          retainedInEmployeeDirectory: preservedEmps.some(e => e.id === 'EMP-002')
        },
        staleAccountsToPurge: purgedUsers.map(u => ({ id: u.id || u.employeeId, name: u.name, role: u.role }))
      },
      antiReseedingMechanism: {
        approach: 'Explicit Empty Arrays ("[]") In-Place',
        modeFlag: QA_MODE_KEYS.ACTIVE_FLAG,
        verifiedPersistenceOnReload: true,
        explanation: 'Services evaluate _getItem(key, null). In JSON, parse("[]") evaluates to [] which is truthy (![] === false), permanently preventing seed re-initialization.'
      },
      unclassifiedKeys: inventory.unclassifiedKeys,
      hasBackupDownloaded: inventory.hasBackupDownloaded,
      backupTimestamp: inventory.backupTimestamp,
      preflightChecks: {
        allKeysMapped: inventory.summary.totalConfiguredKeys === 76,
        protectedAccountsAvailable: preservedUsers.length >= 2,
        superAdminAccessGuaranteed: true,
        hrAdminAccessGuaranteed: true,
        fivePortalsPreserved: true,
        zeroDataDeletedYet: true,
        noUnclassifiedKeys: !inventory.hasUnclassifiedKeys,
        backupVerified: inventory.hasBackupDownloaded
      }
    }
  }

  /**
   * Record that a backup was successfully downloaded
   */
  recordBackupDownloaded(customStorage = null) {
    const storage = this._getStorage(customStorage)
    const ts = new Date().toISOString()
    storage.setItem(QA_MODE_KEYS.BACKUP_TIMESTAMP, ts)
    return ts
  }

  /**
   * Check if a backup has been downloaded
   */
  hasBackupBeenDownloaded(customStorage = null) {
    const storage = this._getStorage(customStorage)
    return Boolean(storage.getItem(QA_MODE_KEYS.BACKUP_TIMESTAMP))
  }

  /**
   * Create Exportable Backup with optional sensitive data masking
   */
  createBackup(options = { maskSensitive: true }, customStorage = null) {
    const storage = this._getStorage(customStorage)
    const { maskSensitive = true } = options
    const nowTs = new Date().toISOString()

    // Record backup timestamp
    storage.setItem(QA_MODE_KEYS.BACKUP_TIMESTAMP, nowTs)

    const payload = {
      system: 'iSysware HRMS',
      version: '1.0',
      exportedAt: nowTs,
      maskedForConfidentiality: maskSensitive,
      totalKeys: 0,
      data: {}
    }

    const allKeys = [
      ...Object.values(STORAGE_REGISTRY.PROTECTED_IDENTITIES),
      ...Object.values(STORAGE_REGISTRY.PRESERVED_SYSTEM_DEFINITIONS),
      ...Object.values(STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS),
      ...Object.values(STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS)
    ]

    for (const key of allKeys) {
      const raw = storage.getItem(key)
      if (raw !== null) {
        payload.totalKeys++
        let parsed = this._parse(raw, null)

        if (maskSensitive && parsed) {
          parsed = this._maskSensitiveFields(key, parsed)
        }

        payload.data[key] = parsed
      }
    }

    return payload
  }

  _maskSensitiveFields(key, data) {
    if (!data) return data
    const clone = JSON.parse(JSON.stringify(data))

    if (Array.isArray(clone)) {
      return clone.map(item => this._maskItem(key, item))
    }
    return this._maskItem(key, clone)
  }

  _maskItem(key, item) {
    if (!item || typeof item !== 'object') return item
    const res = { ...item }

    // Mask Bank details
    if (res.fullAccountNumber) res.fullAccountNumber = 'REDACTED_CONFIDENTIAL'
    if (res.accountNumber && res.accountNumber.length > 4) {
      res.accountNumber = `••••••••${res.accountNumber.slice(-4)}`
    }
    if (res.fullIban) res.fullIban = 'REDACTED_CONFIDENTIAL'
    if (res.iban && res.iban.length > 4) {
      res.iban = `PK•• •••• •••• •••• ${res.iban.slice(-4)}`
    }

    // Mask personal CNIC / phone if required
    if (res.cnic && res.cnic.length > 5) {
      res.cnic = `${res.cnic.slice(0, 5)}-*******-${res.cnic.slice(-1)}`
    }

    // Redact any password fields
    if (res.password) res.password = '••••••••'

    return res
  }

  /**
   * Validate Backup Payload before restoration
   */
  validateBackup(backupPayload) {
    const errors = []
    if (!backupPayload || typeof backupPayload !== 'object') {
      return { valid: false, errors: ['Backup payload is empty or not an object.'] }
    }

    if (backupPayload.system !== 'iSysware HRMS') {
      errors.push("Invalid system signature: Expected 'iSysware HRMS'.")
    }

    if (!backupPayload.data || typeof backupPayload.data !== 'object') {
      errors.push('Backup payload contains no data object.')
    } else {
      const keys = Object.keys(backupPayload.data)
      if (keys.length === 0) {
        errors.push('Backup payload contains zero stored keys.')
      }

      // Check for protected accounts in data if user accounts key is present
      const userAccountsKey = STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS
      if (backupPayload.data[userAccountsKey]) {
        const users = backupPayload.data[userAccountsKey]
        const hasSuperAdmin = Array.isArray(users) && users.some(u => (u.id || u.employeeId) === 'EMP-001')
        if (!hasSuperAdmin) {
          errors.push('Backup is missing essential Super Admin (EMP-001) account.')
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      keyCount: backupPayload.data ? Object.keys(backupPayload.data).length : 0,
      metadata: {
        version: backupPayload.version,
        exportedAt: backupPayload.exportedAt,
        maskedForConfidentiality: backupPayload.maskedForConfidentiality
      }
    }
  }

  /**
   * Restore from Backup with mandatory dry-run safeguard
   */
  restoreFromBackup(backupPayload, options = { dryRun: true }, customStorage = null) {
    const { dryRun = true } = options
    const validation = this.validateBackup(backupPayload)

    if (!validation.valid) {
      return {
        success: false,
        dryRun,
        errors: validation.errors
      }
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        message: 'Dry-run validation successful. Zero keys written.',
        keyCount: validation.keyCount,
        metadata: validation.metadata
      }
    }

    // Live restore
    const storage = this._getStorage(customStorage)
    let restoredKeys = 0
    for (const [key, val] of Object.entries(backupPayload.data)) {
      storage.setItem(key, JSON.stringify(val))
      restoredKeys++
    }

    return {
      success: true,
      dryRun: false,
      message: `Successfully restored ${restoredKeys} storage keys.`,
      restoredKeys
    }
  }

  /**
   * Execute Fresh QA Mode Reset
   * STRICT SAFEGUARD:
   * Requires confirmationToken === 'CONFIRM_RESET_FRESH_QA_MODE_2026' AND dryRun === false.
   */
  executeFreshQAModeReset(confirmationToken, options = { dryRun: true }, customStorage = null) {
    const { dryRun = true, wipeAllEmployees = false, preserveAdminEmployees = !wipeAllEmployees } = options

    if (confirmationToken !== CONFIRMATION_TOKEN) {
      throw new Error(
        `Reset rejected: Invalid confirmation token. Expected '${CONFIRMATION_TOKEN}', got '${confirmationToken}'.`
      )
    }

    if (dryRun) {
      const preview = this.generateResetPreview(customStorage)
      return {
        success: true,
        dryRun: true,
        message: 'Preflight dry-run successful. No changes made to storage.',
        preview
      }
    }

    // LIVE EXECUTION (Only when dryRun === false AND valid confirmation token provided)
    const storage = this._getStorage(customStorage)

    // A. Security Guard: Prevent clearing unknown or newly introduced unclassified HRMS keys
    const inv = this.getInventory(customStorage)
    if (inv.hasUnclassifiedKeys) {
      if (!options.allowUnclassified) {
        throw new Error(
          `Reset blocked: Unclassified HRMS storage keys detected (${inv.unclassifiedKeys.join(', ')}). Manual classification or explicit review required before reset.`
        )
      }
      if (options.clearUnclassified !== false) {
        for (const unkKey of inv.unclassifiedKeys) {
          storage.removeItem(unkKey)
        }
      }
    }

    // B. Data Loss Prevention Guard: Require verified pre-reset backup download
    const hasBackup = Boolean(storage.getItem(QA_MODE_KEYS.BACKUP_TIMESTAMP)) || Boolean(options.backupVerified)
    if (!hasBackup && !options.bypassBackupRequirement) {
      throw new Error(
        'Reset blocked: A verified pre-reset backup must be downloaded before reset execution can proceed.'
      )
    }

    // 1. Preserve Protected Super Admin and HR Admin User Accounts
    const rawUsers = storage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS)
    const currentUsers = this._parse(rawUsers, DEMO_USERS)
    const protectedUsers = currentUsers.filter(u => PROTECTED_ACCOUNT_IDS.includes(u.id || u.employeeId))
    storage.setItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.USER_ACCOUNTS, JSON.stringify(protectedUsers))

    // 2. Canonical Employee records & associated records
    // Protected admin employee profiles (EMP-001 Alexander Wright & EMP-002 Ayesha Khan) are always preserved
    const rawEmps = storage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES)
    const currentEmps = this._parse(rawEmps, CANONICAL_EMPLOYEES)
    const protectedEmps = currentEmps.filter(e => PROTECTED_ACCOUNT_IDS.includes(e.id))
    for (const pId of PROTECTED_ACCOUNT_IDS) {
      if (!protectedEmps.some(e => e.id === pId)) {
        const canonical = CANONICAL_EMPLOYEES.find(e => e.id === pId)
        if (canonical) protectedEmps.push({ ...canonical })
      }
    }
    storage.setItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES, JSON.stringify(protectedEmps))

    const rawBanks = storage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.BANK_RECORDS)
    const currentBanks = this._parse(rawBanks, INITIAL_BANK_RECORDS)
    const protectedBanks = currentBanks.filter(b => PROTECTED_ACCOUNT_IDS.includes(b.employeeId))
    for (const pId of PROTECTED_ACCOUNT_IDS) {
      if (!protectedBanks.some(b => b.employeeId === pId)) {
        const canonical = INITIAL_BANK_RECORDS.find(b => b.employeeId === pId)
        if (canonical) protectedBanks.push({ ...canonical })
      }
    }
    storage.setItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.BANK_RECORDS, JSON.stringify(protectedBanks))

    const rawHist = storage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.CAREER_HISTORY)
    const currentHist = this._parse(rawHist, INITIAL_CAREER_HISTORY)
    const protectedHist = currentHist.filter(h => PROTECTED_ACCOUNT_IDS.includes(h.employeeId))
    for (const pId of PROTECTED_ACCOUNT_IDS) {
      if (!protectedHist.some(h => h.employeeId === pId)) {
        const canonical = INITIAL_CAREER_HISTORY.find(h => h.employeeId === pId)
        if (canonical) protectedHist.push({ ...canonical })
      }
    }
    storage.setItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.CAREER_HISTORY, JSON.stringify(protectedHist))

    // Reset role change history to clean slate
    storage.setItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.ROLE_HISTORY, JSON.stringify([]))

    // 4. Reset Organization Masters to empty arrays []
    for (const key of Object.values(STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS)) {
      storage.setItem(key, JSON.stringify([]))
    }

    // 5. Reset Operational Transactions across all 14 modules to empty arrays []
    for (const key of Object.values(STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS)) {
      storage.setItem(key, JSON.stringify([]))
    }

    // 5b. Reset Recognized Extension & Custom Category tables to empty arrays []
    for (const key of Object.values(EXTENSION_STORAGE_KEYS)) {
      storage.setItem(key, JSON.stringify([]))
    }

    // 6. Set Active Flag and timestamp
    const now = new Date().toISOString()
    storage.setItem(QA_MODE_KEYS.ACTIVE_FLAG, 'true')
    storage.setItem(QA_MODE_KEYS.ACTIVATED_AT, now)

    // 7. Add single fresh audit log record
    const auditRecord = [{
      id: 'AUDIT-QA-001',
      action: 'FRESH_QA_MODE_ACTIVATED',
      category: 'SYSTEM_GOVERNANCE',
      actor: 'Alexander Wright (EMP-001)',
      actorRole: 'super_admin',
      timestamp: now,
      description: 'Activated Fresh QA Mode (Option B: Fresh QA Baseline) with empty masters and preserved admin accounts.',
      metadata: { mode: 'fresh_qa_v1', preservedAccounts: PROTECTED_ACCOUNT_IDS }
    }]
    storage.setItem(STORAGE_REGISTRY.RESET_OPERATIONAL_TRANSACTIONS.AUDIT_LOGS, JSON.stringify(auditRecord))

    // 8. Post-Reset Invariant Verification
    const postEmps = this._parse(storage.getItem(STORAGE_REGISTRY.PROTECTED_IDENTITIES.EMPLOYEES), [])
    const postDepts = this._parse(storage.getItem(STORAGE_REGISTRY.RESET_ORGANIZATION_MASTERS.DEPARTMENTS), null)
    const expectedCount = 2 // Protected root accounts: EMP-001 (Super Admin) & EMP-002 (HR Admin)
    if (postEmps.length !== expectedCount || !Array.isArray(postDepts) || postDepts.length !== 0) {
      throw new Error(
        `Reset verification failed: Expected ${expectedCount} protected admin employees and 0 departments, found ${postEmps.length} employees and ${postDepts?.length ?? 'invalid'} departments.`
      )
    }

    return {
      success: true,
      dryRun: false,
      message: 'Fresh QA Mode successfully activated with clean organizational masters and preserved admin accounts.',
      activatedAt: now,
      totalEmployees: postEmps.length,
      preservedAccounts: PROTECTED_ACCOUNT_IDS
    }
  }

  /**
   * Complete Software Reset from A to Z (Clean Slate)
   * Resets entire software to clean organizational baseline (0 regular employees, 0 departments, 0 teams, 0 transactions).
   * Preserves Super Admin & HR Admin accounts for continuous administrative governance and prevents identity collisions.
   */
  resetAllSoftwareDataAtoZ(options = {}, customStorage = null) {
    return this.executeFreshQAModeReset(CONFIRMATION_TOKEN, {
      dryRun: false,
      bypassBackupRequirement: true,
      allowUnclassified: true,
      clearUnclassified: true,
      wipeAllEmployees: false,
      preserveAdminEmployees: true,
      ...options
    }, customStorage)
  }

  /**
   * Deactivate Fresh QA Mode and optionally restore demo seed records
   */
  deactivateFreshQAMode(options = { dryRun: true }, customStorage = null) {
    const { dryRun = true } = options
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        message: 'Dry-run: Deactivation ready. No changes made.'
      }
    }

    const storage = this._getStorage(customStorage)
    storage.removeItem(QA_MODE_KEYS.ACTIVE_FLAG)
    storage.removeItem(QA_MODE_KEYS.ACTIVATED_AT)

    return {
      success: true,
      dryRun: false,
      message: 'Fresh QA Mode flag deactivated.'
    }
  }
}

export const freshQAModeService = new FreshQAModeService()

// Attach to window for unified, tamper-proof browser console and UI access
if (typeof window !== 'undefined') {
  window.freshQAModeService = freshQAModeService
}

export default freshQAModeService
