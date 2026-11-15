import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PORTAL_CONFIG } from '../config/navigation.js'

describe('F15 Navigation Restoration & Complete Submodules Verification Suite', () => {

  test('1. Super Admin Portal displays all 14 main modules in exact canonical order', () => {
    const saConfig = PORTAL_CONFIG.super_admin
    assert.ok(saConfig, 'Super Admin portal configuration must exist')

    // Flatten all items across groups
    const allItems = saConfig.menuGroups.flatMap(g => g.items)
    assert.equal(allItems.length, 14, 'Super Admin portal must display exactly 14 main modules')

    const expectedOrder = [
      { batchId: 'F01', key: 'dashboard', label: 'Dashboard' },
      { batchId: 'F02', key: 'employees', label: 'Employee Management' },
      { batchId: 'F03', key: 'recruitment', label: 'Recruitment & Onboarding' },
      { batchId: 'F04', key: 'attendance', label: 'Attendance & Shifts' },
      { batchId: 'F05', key: 'leaves', label: 'Leave Management' },
      { batchId: 'F06', key: 'payroll', label: 'Payroll, Compensation & Benefits' },
      { batchId: 'F07', key: 'performance', label: 'Tasks & Performance Management' },
      { batchId: 'F08', key: 'training', label: 'Training & Development' },
      { batchId: 'F09', key: 'helpdesk', label: 'Help Desk Management' },
      { batchId: 'F10', key: 'travel', label: 'Travel & Transport Management' },
      { batchId: 'F11', key: 'letters', label: 'HR Letters Management' },
      { batchId: 'F12', key: 'expenses', label: 'Expense Management' },
      { batchId: 'F14', key: 'reports', label: 'Reports & Analytics' },
      { batchId: 'F13', key: 'settings', label: 'Administration & Settings' }
    ]

    expectedOrder.forEach((expected, index) => {
      const actual = allItems[index]
      assert.equal(actual.key, expected.key, `Module at index ${index} must be ${expected.key}`)
      assert.equal(actual.batchId, expected.batchId, `Module ${actual.key} must have batchId ${expected.batchId}`)
      assert.equal(actual.label, expected.label, `Module ${actual.key} label must match`)
    })
  })

  test('2. F09 Help Desk, F10 Travel, F11 HR Letters and F12 Expense are restored and present', () => {
    const saItems = PORTAL_CONFIG.super_admin.menuGroups.flatMap(g => g.items)
    const keys = saItems.map(i => i.key)

    assert.ok(keys.includes('helpdesk'), 'F09 Help Desk Management must be present')
    assert.ok(keys.includes('travel'), 'F10 Travel & Transport Management must be present')
    assert.ok(keys.includes('letters'), 'F11 HR Letters Management must be present')
    assert.ok(keys.includes('expenses'), 'F12 Expense Management must be present')

    // Check paths
    assert.equal(saItems.find(i => i.key === 'helpdesk').path, '/super-admin/helpdesk')
    assert.equal(saItems.find(i => i.key === 'travel').path, '/super-admin/travel')
    assert.equal(saItems.find(i => i.key === 'letters').path, '/super-admin/letters')
    assert.equal(saItems.find(i => i.key === 'expenses').path, '/super-admin/expenses')
  })

  test('3. Every applicable main module defines working submodules with deep links', () => {
    const saItems = PORTAL_CONFIG.super_admin.menuGroups.flatMap(g => g.items)

    // Check F02 Employee submodules
    const emp = saItems.find(i => i.key === 'employees')
    assert.ok(emp.submodules && emp.submodules.length >= 3, 'F02 must have at least 3 submodules')
    assert.ok(emp.submodules.some(s => s.path.includes('tab=directory')), 'F02 must link to directory tab')
    assert.ok(emp.submodules.some(s => s.path.includes('tab=org')), 'F02 must link to org tab')

    // Check F03 Recruitment submodules
    const rec = saItems.find(i => i.key === 'recruitment')
    assert.ok(rec.submodules && rec.submodules.length >= 5, 'F03 must have 5 submodules')
    assert.ok(rec.submodules.some(s => s.path.includes('tab=vacancies')))
    assert.ok(rec.submodules.some(s => s.path.includes('tab=candidates')))
    assert.ok(rec.submodules.some(s => s.path.includes('tab=interviews')))
    assert.ok(rec.submodules.some(s => s.path.includes('tab=offers')))
    assert.ok(rec.submodules.some(s => s.path.includes('tab=probation')))

    // Check F04 Attendance submodules
    const att = saItems.find(i => i.key === 'attendance')
    assert.ok(att.submodules && att.submodules.length >= 6)
    assert.ok(att.submodules.some(s => s.path.includes('tab=register')))
    assert.ok(att.submodules.some(s => s.path.includes('tab=shifts')))
    assert.ok(att.submodules.some(s => s.path.includes('tab=corrections')))

    // Check F05 Leave submodules
    const lev = saItems.find(i => i.key === 'leaves')
    assert.ok(lev.submodules && lev.submodules.length >= 6)
    assert.ok(lev.submodules.some(s => s.path.includes('tab=queue')))
    assert.ok(lev.submodules.some(s => s.path.includes('tab=balances')))

    // Check F06 Payroll submodules
    const pay = saItems.find(i => i.key === 'payroll')
    assert.ok(pay.submodules && pay.submodules.length >= 8)
    assert.ok(pay.submodules.some(s => s.path.includes('tab=runs')))
    assert.ok(pay.submodules.some(s => s.path.includes('tab=tax')))
    assert.ok(pay.submodules.some(s => s.path.includes('tab=loans')))

    // Check F14 Reports submodules (12 families)
    const rpt = saItems.find(i => i.key === 'reports')
    assert.ok(rpt.submodules && rpt.submodules.length === 12, 'F14 Reports must display all 12 families')
    assert.ok(rpt.submodules.some(s => s.path.includes('family=fam_org')))
    assert.ok(rpt.submodules.some(s => s.path.includes('family=fam_pay')))
    assert.ok(rpt.submodules.some(s => s.path.includes('family=fam_tax')))
  })

  test('4. HR / Admin portal displays all 14 operational modules with delegated settings', () => {
    const hrConfig = PORTAL_CONFIG.hr_admin
    assert.ok(hrConfig, 'HR Admin portal must exist')
    const hrItems = hrConfig.menuGroups.flatMap(g => g.items)
    assert.equal(hrItems.length, 14, 'HR Admin must have 14 operational modules')

    const hrKeys = hrItems.map(i => i.key)
    assert.ok(hrKeys.includes('dashboard'))
    assert.ok(hrKeys.includes('employees'))
    assert.ok(hrKeys.includes('recruitment'))
    assert.ok(hrKeys.includes('attendance'))
    assert.ok(hrKeys.includes('leaves'))
    assert.ok(hrKeys.includes('payroll'))
    assert.ok(hrKeys.includes('performance'))
    assert.ok(hrKeys.includes('training'))
    assert.ok(hrKeys.includes('helpdesk'))
    assert.ok(hrKeys.includes('travel'))
    assert.ok(hrKeys.includes('letters'))
    assert.ok(hrKeys.includes('expenses'))
    assert.ok(hrKeys.includes('settings'))
    assert.ok(hrKeys.includes('reports'))
  })

  test('5. Manager portal displays permitted team and personal modules with team submodules', () => {
    const mgrConfig = PORTAL_CONFIG.manager
    assert.ok(mgrConfig, 'Manager portal configuration must exist')
    const mgrItems = mgrConfig.menuGroups.flatMap(g => g.items)

    const mgrKeys = mgrItems.map(i => i.key)
    assert.ok(mgrKeys.includes('dashboard'))
    assert.ok(mgrKeys.includes('team'))
    assert.ok(mgrKeys.includes('recruitment'))
    assert.ok(mgrKeys.includes('attendance'))
    assert.ok(mgrKeys.includes('leaves'))
    assert.ok(mgrKeys.includes('my_payroll'))
    assert.ok(mgrKeys.includes('tasks'))
    assert.ok(mgrKeys.includes('training'))
    assert.ok(mgrKeys.includes('helpdesk'))
    assert.ok(mgrKeys.includes('travel'))
    assert.ok(mgrKeys.includes('letters'))
    assert.ok(mgrKeys.includes('expenses'))
    assert.ok(mgrKeys.includes('reports'))

    // Manager must NOT have global company Administration & Settings
    assert.ok(!mgrKeys.includes('settings'), 'Manager portal must NOT contain company-wide Administration & Settings')
  })

  test('6. Employee portal displays authorized self-service modules without administrative bypass', () => {
    const empConfig = PORTAL_CONFIG.employee
    assert.ok(empConfig, 'Employee portal configuration must exist')
    const empItems = empConfig.menuGroups.flatMap(g => g.items)

    const empKeys = empItems.map(i => i.key)
    assert.ok(empKeys.includes('dashboard'))
    assert.ok(empKeys.includes('profile'))
    assert.ok(empKeys.includes('onboarding'))
    assert.ok(empKeys.includes('attendance'))
    assert.ok(empKeys.includes('leaves'))
    assert.ok(empKeys.includes('payroll'))
    assert.ok(empKeys.includes('tasks'))
    assert.ok(empKeys.includes('training'))
    assert.ok(empKeys.includes('helpdesk'))
    assert.ok(empKeys.includes('travel'))
    assert.ok(empKeys.includes('letters'))
    assert.ok(empKeys.includes('expenses'))
    assert.ok(empKeys.includes('reports'))
    assert.ok(empKeys.includes('notifications'))

    // Employee must NOT have company-wide settings or recruitment management
    assert.ok(!empKeys.includes('settings'), 'Employee portal must NOT contain company Administration & Settings')
  })

  test('7. Team Lead portal displays dedicated team operations: Dashboard, My Team, Attendance, Leaves, Tasks, Performance, and Team Reports', () => {
    const tlConfig = PORTAL_CONFIG.team_lead
    assert.ok(tlConfig, 'Team Lead portal configuration must exist')
    const tlItems = tlConfig.menuGroups.flatMap(g => g.items)
    const tlKeys = tlItems.map(i => i.key)

    assert.equal(tlItems.length, 7, 'Team Lead portal must display exactly 7 core operational modules')
    assert.ok(tlKeys.includes('dashboard'), 'Team Lead must have Dashboard')
    assert.ok(tlKeys.includes('team'), 'Team Lead must have My Team')
    assert.ok(tlKeys.includes('attendance'), 'Team Lead must have Attendance & Shifts')
    assert.ok(tlKeys.includes('leaves'), 'Team Lead must have Leaves')
    assert.ok(tlKeys.includes('tasks'), 'Team Lead must have Tasks')
    assert.ok(tlKeys.includes('performance'), 'Team Lead must have Performance')
    assert.ok(tlKeys.includes('reports'), 'Team Lead must have Team Reports')

    // Team Lead must NOT have company administration & settings
    assert.ok(!tlKeys.includes('settings'), 'Team Lead portal must NOT contain company Administration & Settings')
  })

  test('8. No empty, dead, or duplicate paths in any of the 5 portals', () => {
    assert.equal(Object.keys(PORTAL_CONFIG).length, 5, 'Exact 5 portals must be registered in PORTAL_CONFIG')
    Object.keys(PORTAL_CONFIG).forEach(portalId => {
      const cfg = PORTAL_CONFIG[portalId]
      const items = cfg.menuGroups.flatMap(g => g.items)
      const allPaths = []

      items.forEach(item => {
        assert.ok(item.path && item.path.length > 0, `Item ${item.key} must have a path`)
        allPaths.push(item.path)

        if (item.submodules) {
          item.submodules.forEach(sub => {
            assert.ok(sub.path && sub.path.length > 0, `Submodule ${sub.key} in ${item.key} must have a path`)
            assert.ok(sub.label && sub.label.length > 0, `Submodule ${sub.key} in ${item.key} must have a label`)
          })
        }
      })

      // Check unique paths among main items
      const uniquePaths = new Set(allPaths)
      assert.equal(allPaths.length, uniquePaths.size, `Portal ${portalId} contains duplicate main item paths`)
    })
  })
})

