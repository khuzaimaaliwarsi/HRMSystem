/**
 * iSysware HRMS — LocalStorage Business Data Elimination & Shield Verification Suite
 * Verifies:
 * 1. ZERO business data can ever be saved to browser localStorage.
 * 2. Attempted writes of any business key (isysware_*, hrms_data_*, employee, payroll, etc.) are strictly blocked and dropped.
 * 3. Preserved UI keys (hrms_theme, hrms_sidebar_collapsed, hrms_table_density) are permitted.
 * 4. executeCutoverCleanup() sweeps and purges any legacy business keys.
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  executeCutoverCleanup,
  installLocalStorageShield,
  isBusinessKey,
  PRESERVED_UI_KEYS,
  BUSINESS_STORAGE_KEYS
} from '../services/storageCutover.js'

describe('LocalStorage Business Data Elimination & Shield Suite', () => {
  let mockStore = {}

  beforeEach(() => {
    mockStore = {}
    globalThis.window = {
      localStorage: {
        getItem: (k) => mockStore[k] ?? null,
        setItem: (k, v) => { mockStore[k] = String(v) },
        removeItem: (k) => { delete mockStore[k] },
        key: (idx) => Object.keys(mockStore)[idx] ?? null,
        get length() { return Object.keys(mockStore).length }
      }
    }
  })

  it('1. isBusinessKey: Correctly identifies business keys vs UI preference keys', () => {
    // UI keys must NOT be classified as business keys
    for (const uiKey of PRESERVED_UI_KEYS) {
      assert.strictEqual(isBusinessKey(uiKey), false, `${uiKey} must be allowed as UI key`)
    }

    // Business keys must be classified as business keys
    assert.strictEqual(isBusinessKey('isysware_hrms_employees_data'), true)
    assert.strictEqual(isBusinessKey('isysware_hrms_f06_payroll_runs_v1'), true)
    assert.strictEqual(isBusinessKey('isysware_hrms_attendance_records_v1'), true)
    assert.strictEqual(isBusinessKey('isysware_wfh_requests'), true)
    assert.strictEqual(isBusinessKey('isysware_field_duty_requests'), true)
    assert.strictEqual(isBusinessKey('hrms_data_custom_categories'), true)
  })

  it('2. executeCutoverCleanup: Purges all legacy business keys from localStorage', () => {
    mockStore['isysware_hrms_employees_data'] = JSON.stringify([{ id: 'emp_1' }])
    mockStore['isysware_hrms_f06_payroll_runs_v1'] = JSON.stringify([{ id: 'run_1' }])
    mockStore['hrms_sidebar_collapsed'] = 'true'
    mockStore['hrms_theme'] = 'dark'

    const result = executeCutoverCleanup()
    assert.ok(result.cleanedCount >= 2)

    // Business keys must be purged
    assert.strictEqual(mockStore['isysware_hrms_employees_data'], undefined)
    assert.strictEqual(mockStore['isysware_hrms_f06_payroll_runs_v1'], undefined)

    // UI preference keys must be strictly preserved
    assert.strictEqual(mockStore['hrms_sidebar_collapsed'], 'true')
    assert.strictEqual(mockStore['hrms_theme'], 'dark')
  })

  it('3. installLocalStorageShield: Blocks any subsequent business data writes to localStorage', () => {
    installLocalStorageShield()

    // Attempt to write business data
    window.localStorage.setItem('isysware_hrms_employees_data', JSON.stringify([{ id: 'leaked_emp' }]))
    window.localStorage.setItem('isysware_wfh_requests', JSON.stringify([{ id: 'wfh_1' }]))
    window.localStorage.setItem('hrms_data_loan_records', JSON.stringify([{ id: 'loan_1' }]))
    window.localStorage.setItem('isysware_hrms_f05_leave_types_v1', JSON.stringify([{ id: 'leave_1' }]))
    window.localStorage.setItem('isysware_hrms_f12_expense_categories_v1', JSON.stringify([{ id: 'exp_1' }]))
    window.localStorage.setItem('isysware_hrms_f06_loans_v1', JSON.stringify([{ id: 'loan_1' }]))
    window.localStorage.setItem('isysware_hrms_f09_tickets_v1', JSON.stringify([{ id: 'ticket_1' }]))

    // Must be completely blocked and dropped
    assert.strictEqual(mockStore['isysware_hrms_employees_data'], undefined)
    assert.strictEqual(mockStore['isysware_wfh_requests'], undefined)
    assert.strictEqual(mockStore['hrms_data_loan_records'], undefined)
    assert.strictEqual(mockStore['isysware_hrms_f05_leave_types_v1'], undefined)
    assert.strictEqual(mockStore['isysware_hrms_f12_expense_categories_v1'], undefined)
    assert.strictEqual(mockStore['isysware_hrms_f06_loans_v1'], undefined)
    assert.strictEqual(mockStore['isysware_hrms_f09_tickets_v1'], undefined)

    // Attempt to read business data directly via getItem returns null
    assert.strictEqual(window.localStorage.getItem('isysware_hrms_employees_data'), null)
    assert.strictEqual(window.localStorage.getItem('isysware_hrms_f05_leave_types_v1'), null)

    // Attempt to write preserved UI preference key must succeed
    window.localStorage.setItem('hrms_sidebar_collapsed', 'false')
    window.localStorage.setItem('hrms_table_density', 'compact')
    assert.strictEqual(mockStore['hrms_sidebar_collapsed'], 'false')
    assert.strictEqual(mockStore['hrms_table_density'], 'compact')
  })
})
