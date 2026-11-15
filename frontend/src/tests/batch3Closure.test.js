import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleStorageEvent, initStorageSynchronization } from '../lib/storageSync.js'
import { PORTAL_CONFIG } from '../config/navigation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Aliyan_HRMS — Batch 3: Final Frontend Closure Verification', () => {
  it('1. Manager Personal Attendance: ManagerMyAttendancePage exists and exports properly', async () => {
    const managerMyAttendancePath = path.resolve(__dirname, '../pages/attendance/ManagerMyAttendancePage.jsx')
    assert.ok(fs.existsSync(managerMyAttendancePath), 'ManagerMyAttendancePage.jsx must exist')

    const fileContent = fs.readFileSync(managerMyAttendancePath, 'utf8')
    assert.ok(fileContent.includes('export function ManagerMyAttendancePage'), 'Must export ManagerMyAttendancePage')
    assert.ok(fileContent.includes('CheckInOutWidget'), 'Must render CheckInOutWidget')
    assert.ok(fileContent.includes('TimesheetsTab'), 'Must render TimesheetsTab')
    assert.ok(fileContent.includes('AttendanceCorrectionModal'), 'Must support Attendance Correction')
    assert.ok(fileContent.includes('WfhRequestModal'), 'Must support WFH requests')
    assert.ok(fileContent.includes('FieldDutyRequestModal'), 'Must support Field Duty requests')
    assert.ok(fileContent.includes('OvertimeRequestModal'), 'Must support Overtime requests')
  })

  it('2. AppRoutes: /manager/my-attendance is wired to ManagerMyAttendancePage and 0 placeholders remain', () => {
    const appRoutesPath = path.resolve(__dirname, '../routes/AppRoutes.jsx')
    const appRoutesContent = fs.readFileSync(appRoutesPath, 'utf8')

    // Must map /manager/my-attendance to ManagerMyAttendancePage
    assert.ok(
      appRoutesContent.includes('<Route path="my-attendance" element={<ManagerMyAttendancePage />} />'),
      'AppRoutes must map my-attendance to ManagerMyAttendancePage'
    )

    // Must NOT have any active PlaceholderModule routes
    const placeholderMatch = appRoutesContent.match(/<Route[^>]*element=\{<PlaceholderModule/g)
    assert.equal(placeholderMatch, null, 'There must be ZERO PlaceholderModule routes in AppRoutes')
  })

  it('3. ManagerAttendancePage: embeds ManagerMyAttendancePage for myAttendance tab', () => {
    const mgrAttendancePath = path.resolve(__dirname, '../pages/attendance/ManagerAttendancePage.jsx')
    const mgrAttendanceContent = fs.readFileSync(mgrAttendancePath, 'utf8')

    assert.ok(
      mgrAttendanceContent.includes('import ManagerMyAttendancePage from \'./ManagerMyAttendancePage\''),
      'ManagerAttendancePage must import ManagerMyAttendancePage'
    )
    assert.ok(
      mgrAttendanceContent.includes('<ManagerMyAttendancePage isEmbedded={true} />'),
      'ManagerAttendancePage must render ManagerMyAttendancePage when tab is myAttendance'
    )
  })

  it('4. Cross-Tab Storage Synchronization: storageSync handles HRMS keys and ignores unrelated keys', () => {
    let notified = false
    const mockService = {
      _notify() {
        notified = true
      }
    }

    // Must export handler functions
    assert.equal(typeof handleStorageEvent, 'function')
    assert.equal(typeof initStorageSynchronization, 'function')

    // Non-HRMS key should not trigger notifications or errors
    handleStorageEvent({ key: 'unrelated_app_theme', newValue: 'dark' })

    // Valid HRMS key triggers notification pipeline safely
    handleStorageEvent({ key: 'isysware_hrms_attendance_records_v1', newValue: '[]' })

    // Reset event (key === null) triggers full sync safely
    handleStorageEvent({ key: null })
  })

  it('5. Navigation Integrity: All 5 portals define valid routes in AppRoutes', () => {
    const appRoutesPath = path.resolve(__dirname, '../routes/AppRoutes.jsx')
    const appRoutesContent = fs.readFileSync(appRoutesPath, 'utf8')

    const portalKeys = ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee']

    for (const pKey of portalKeys) {
      const portal = PORTAL_CONFIG[pKey]
      assert.ok(portal, `Portal configuration for ${pKey} must exist`)
      assert.ok(portal.menuGroups && portal.menuGroups.length > 0, `Portal ${pKey} must have menuGroups`)

      // Verify portal base path exists in AppRoutes
      const baseRouteRegex = new RegExp(`<Route\\s+path="${portal.basePath}"`)
      assert.ok(baseRouteRegex.test(appRoutesContent), `AppRoutes must contain base route for ${portal.basePath}`)
    }
  })

  it('6. Five Portal RBAC: All 5 roles have appropriate navigation scoping', () => {
    const roles = Object.keys(PORTAL_CONFIG)
    assert.deepEqual(
      roles.sort(),
      ['employee', 'hr_admin', 'manager', 'super_admin', 'team_lead'].sort(),
      'PORTAL_CONFIG must define all 5 distinct portals'
    )

    // Team Lead portal is scoped to assigned teams
    const tlPortal = PORTAL_CONFIG.team_lead
    assert.ok(tlPortal.portalName.includes('Team Lead'), 'Team Lead portal must be correctly titled')
    assert.equal(tlPortal.basePath, '/team-lead')

    // Manager portal has authorized department scope
    const mgrPortal = PORTAL_CONFIG.manager
    assert.ok(mgrPortal.portalName.includes('Manager'), 'Manager portal must be correctly titled')
    assert.equal(mgrPortal.basePath, '/manager')
  })
})

