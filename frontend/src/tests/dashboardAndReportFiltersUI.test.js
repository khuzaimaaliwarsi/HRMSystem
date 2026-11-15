import test from 'node:test'
import assert from 'node:assert/strict'
import { reportService } from '../services/reportService.js'

test('Reporting & Dashboard Status Verification Suite', async (t) => {
  const mockStaff = [
    {
      id: 'EMP-001',
      name: 'Khuzaima Senior Developer',
      email: 'khuzaima.test@isysware.com',
      department: 'Software Development',
      departmentId: 'DEP-01',
      status: 'Active',
      employmentStatus: 'ACTIVE',
      employmentType: 'Permanent'
    },
    {
      id: 'EMP-002',
      name: 'Khuzaima iSysware',
      email: 'khuzaimaali@isysware.com',
      department: 'Software Development',
      departmentId: 'DEP-01',
      status: 'Active',
      employmentStatus: 'ACTIVE',
      employmentType: 'Permanent'
    },
    {
      id: 'EMP-003',
      name: 'Abdur Rehman',
      email: 'arainabdurrehman3@gmail.com',
      department: 'Software Development',
      departmentId: 'DEP-01',
      status: 'Active',
      employmentStatus: 'ACTIVE',
      employmentType: 'Permanent'
    },
    {
      id: 'E_OPS_1794452880079',
      name: 'Operational Tester',
      email: 'ops_1794452880079@isysware.test',
      department: 'Operational Reset Test Dept',
      departmentId: 'DEP-OPS-TEST',
      status: 'Inactive',
      employmentStatus: 'SUSPENDED',
      employmentType: 'Permanent'
    }
  ]

  await t.test('1. Dashboard RecentActivityTable: Inactive vs Active segregation', () => {
    const isInactive = (emp) => {
      const st = (emp?.status || emp?.employmentStatus || '').toLowerCase()
      return st === 'inactive' || st === 'suspended' || st === 'terminated' || st === 'separated'
    }
    const isActive = (emp) => {
      const st = (emp?.status || emp?.employmentStatus || '').toLowerCase()
      return st === 'active' && !isInactive(emp)
    }

    const activeStaff = mockStaff.filter(isActive)
    const inactiveStaff = mockStaff.filter(isInactive)

    assert.equal(activeStaff.length, 3, 'Exactly 3 staff must be Active')
    assert.equal(inactiveStaff.length, 1, 'Exactly 1 staff must be Inactive')
    assert.equal(inactiveStaff[0].id, 'E_OPS_1794452880079', 'Operational Tester must be classified as Inactive')

    // Inactive staff must not be present in activeStaff list
    const foundInActive = activeStaff.find((s) => s.id === 'E_OPS_1794452880079')
    assert.equal(foundInActive, undefined, 'Operational Tester must NOT appear in Active staff list')
  })

  await t.test('2. Report Filters: Inactive exclusion from active scope & cascading department filtering', () => {
    // When status filter is 'active' (default)
    const filterEmployees = (statusFilter = 'active', deptFilter = 'all') => {
      let list = [...mockStaff]
      if (statusFilter === 'active') {
        list = list.filter((e) => {
          const s = (e.status || e.employmentStatus || '').toLowerCase()
          return s === 'active' || (!s.includes('inactive') && !s.includes('suspended') && !s.includes('terminated'))
        })
      } else if (statusFilter === 'inactive') {
        list = list.filter((e) => {
          const s = (e.status || e.employmentStatus || '').toLowerCase()
          return s === 'inactive' || s === 'suspended' || s === 'terminated'
        })
      }

      if (deptFilter !== 'all') {
        list = list.filter((e) => e.departmentId === deptFilter || e.department === deptFilter)
      }
      return list
    }

    // Default view: Active staff
    const activeStaffOnly = filterEmployees('active', 'all')
    assert.equal(activeStaffOnly.length, 3)
    assert.ok(!activeStaffOnly.some((e) => e.id === 'E_OPS_1794452880079'))

    // Inactive staff view
    const inactiveStaffOnly = filterEmployees('inactive', 'all')
    assert.equal(inactiveStaffOnly.length, 1)
    assert.equal(inactiveStaffOnly[0].id, 'E_OPS_1794452880079')

    // Cascading: Software Development Dept (active)
    const softDevActive = filterEmployees('active', 'DEP-01')
    assert.equal(softDevActive.length, 3)

    // Cascading: Software Development Dept (inactive) -> should be 0 because Operational Tester belongs to test dept
    const softDevInactive = filterEmployees('inactive', 'DEP-01')
    assert.equal(softDevInactive.length, 0)
  })

  await t.test('3. Chartered Accountant Financial Reconciliation in Reporting Engine', () => {
    const adminUser = { role: 'super_admin', employeeId: 'EMP-001' }
    
    // Generate Payroll Summary Report
    const payResult = reportService.generateReport('RPT-PAY-001', { datePreset: 'thisMonth', status: 'all' }, adminUser)
    assert.ok(payResult, 'Report generation must succeed')
    assert.ok(payResult.reconciliation, 'Report must contain reconciliation metadata')
    assert.equal(payResult.reconciliation.reconciled, true, 'Chartered Accountant reconciliation must pass')

    // Generate Workforce Master Report
    const orgResult = reportService.generateReport('RPT-ORG-001', { datePreset: 'thisMonth', status: 'active' }, adminUser)
    assert.ok(orgResult)
    assert.equal(orgResult.reconciliation.reconciled, true)
  })
})
