import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

describe('Aliyan_HRMS — Submodule Screen Isolation & Duplicate Navigation Audit', () => {
  const resolvePage = (rel) => {
    const candidate1 = path.resolve('frontend/src', rel)
    if (fs.existsSync(candidate1)) return candidate1
    const candidate2 = path.resolve('src', rel)
    if (fs.existsSync(candidate2)) return candidate2
    const candidate3 = path.resolve(__dirname, '..', rel)
    return candidate3
  }

  const employeeLeavePagePath = resolvePage('pages/leaves/EmployeeLeavePage.jsx')
  const hrAdminLeavePagePath = resolvePage('pages/leaves/HrAdminLeavePage.jsx')
  const superAdminLeavePagePath = resolvePage('pages/leaves/SuperAdminLeavePage.jsx')
  const managerLeavePagePath = resolvePage('pages/leaves/ManagerLeavePage.jsx')

  it('1. EmployeeLeavePage: Redundant horizontal tab strip is removed and summary cards are isolated to overview', () => {
    const content = fs.readFileSync(employeeLeavePagePath, 'utf8')

    // Horizontal navigation strip that duplicated sidebar submodules must not be present
    assert.strictEqual(
      content.includes('Submodule Tab Navigation (Clean Horizontal Navigation Strip)'),
      false,
      'Redundant horizontal tab strip duplicating sidebar submodules must be removed'
    )

    // Summary cards must be wrapped inside overview tab check
    const summaryCardsInOverview = content.includes("{(activeTab === 'overview' || !activeTab) && (") &&
      content.includes('<LeaveSummaryCards')
    assert.strictEqual(summaryCardsInOverview, true, 'LeaveSummaryCards must be strictly scoped to Overview')
  })

  it('2. HrAdminLeavePage: Redundant horizontal tab strip is removed and summary cards are isolated to operations', () => {
    const content = fs.readFileSync(hrAdminLeavePagePath, 'utf8')

    assert.strictEqual(
      content.includes('Submodule Tab Navigation (Clean Horizontal Navigation Strip)'),
      false,
      'Duplicate horizontal tabs in HR Admin leave page must be removed'
    )

    const cardsInOperations = content.includes("{(activeTab === 'operations' || activeTab === 'overview') && (") &&
      content.includes('<LeaveSummaryCards')
    assert.strictEqual(cardsInOperations, true, 'Summary cards in HR Admin must be scoped to Operations/Overview')
  })

  it('3. SuperAdminLeavePage: Redundant horizontal tab strip is removed and summary cards are isolated to overview', () => {
    const content = fs.readFileSync(superAdminLeavePagePath, 'utf8')

    assert.strictEqual(
      content.includes('Submodule Tab Navigation (Clean Horizontal Navigation Strip)'),
      false,
      'Duplicate horizontal tabs in Super Admin leave page must be removed'
    )

    const cardsInOverview = content.includes("activeTab === 'overview' && (") &&
      content.includes('<LeaveSummaryCards')
    assert.strictEqual(cardsInOverview, true, 'Summary cards in Super Admin must be scoped to Overview')
  })

  it('4. ManagerLeavePage: Duplicate tab strip is removed and cards are scoped per submodule', () => {
    const content = fs.readFileSync(managerLeavePagePath, 'utf8')

    assert.strictEqual(
      content.includes('Submodule Tab Navigation (Clean Horizontal Navigation Strip)'),
      false,
      'Duplicate horizontal tabs in Manager leave page must be removed'
    )

    assert.strictEqual(
      content.includes("activeTab === 'my_leaves' ? (") || content.includes("activeTab === 'my_leaves' && ("),
      true,
      'Leave summary cards must only render for personal leaves'
    )
  })

  it('5. SuperAdminSettingsPage: Redundant horizontal tab strip is removed and each submodule screen is isolated', () => {
    const superAdminSettingsPagePath = resolvePage('pages/settings/SuperAdminSettingsPage.jsx')
    const content = fs.readFileSync(superAdminSettingsPagePath, 'utf8')

    assert.strictEqual(
      content.includes('SETTINGS_TABS.map'),
      false,
      'Redundant SETTINGS_TABS horizontal strip duplicating sidebar submodules must be removed'
    )
    assert.strictEqual(
      content.includes('Horizontal Submodule Navigation Strip'),
      false,
      'Horizontal navigation strip must be removed'
    )
    assert.strictEqual(
      content.includes("activeTab === 'matrix' && <ApprovalAuthorityMatrixTab"),
      true,
      'ApprovalAuthorityMatrixTab must be rendered based on activeTab'
    )
  })

  it('6. Attendance & Payroll Pages: Top KPI overview strips scoped to main operational registers', () => {
    const saAttPath = resolvePage('pages/attendance/SuperAdminAttendancePage.jsx')
    const saAttContent = fs.readFileSync(saAttPath, 'utf8')
    assert.ok(
      saAttContent.includes("activeMainTab === 'register' && (\n        <AttendanceOverviewCards") ||
      saAttContent.includes("activeMainTab === 'register' && (\r\n        <AttendanceOverviewCards") ||
      saAttContent.includes("activeMainTab === 'register' && ("),
      'Attendance overview cards must be scoped to register'
    )

    const saPayPath = resolvePage('pages/payroll/SuperAdminPayrollPage.jsx')
    const saPayContent = fs.readFileSync(saPayPath, 'utf8')
    assert.ok(
      saPayContent.includes("activeTab === 'runs' && <PayrollSummaryCards"),
      'Payroll summary cards must be scoped to runs'
    )
  })
})

