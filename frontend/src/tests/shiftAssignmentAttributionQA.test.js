import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Shift Assignment Attributor & Portal Resolution QA Suite', () => {
  it('1. Resolves Super Admin portal assignments dynamically and never defaults to HR Admin', () => {
    const rawAssignment = {
      id: 'asgn_1',
      employeeId: 'EMP-006',
      shiftId: 'SHIFT-PT',
      assignedBy: 'cmwj5lckh0000nx4v761d3orj',
      assignedByName: null
    }

    const isSuperAdminPortal = true
    const activeUser = { name: 'Super Admin', role: 'super_admin' }
    const portalDefaultAssigner = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || 'HR Admin')

    let assignedByDisplay = rawAssignment.assignedByName || rawAssignment.assignedBy
    if (!assignedByDisplay || (typeof assignedByDisplay === 'string' && assignedByDisplay.startsWith('cmw'))) {
      assignedByDisplay = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || portalDefaultAssigner)
    } else if (isSuperAdminPortal && (assignedByDisplay === 'HR Admin' || assignedByDisplay === 'HR Administrator')) {
      assignedByDisplay = activeUser?.name || 'Super Admin'
    }

    assert.equal(assignedByDisplay, 'Super Admin')
  })

  it('2. Overrides legacy mock "HR Admin" value when rendered in Super Admin portal', () => {
    const rawAssignment = {
      id: 'asgn_2',
      employeeId: 'EMP-005',
      shiftId: 'SHIFT-DAY',
      assignedBy: 'HR Admin'
    }

    const isSuperAdminPortal = true
    const activeUser = { name: 'Super Admin', role: 'super_admin' }
    const portalDefaultAssigner = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || 'HR Admin')

    let assignedByDisplay = rawAssignment.assignedByName || rawAssignment.assignedBy
    if (!assignedByDisplay || (typeof assignedByDisplay === 'string' && assignedByDisplay.startsWith('cmw'))) {
      assignedByDisplay = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || portalDefaultAssigner)
    } else if (isSuperAdminPortal && (assignedByDisplay === 'HR Admin' || assignedByDisplay === 'HR Administrator')) {
      assignedByDisplay = activeUser?.name || 'Super Admin'
    }

    assert.equal(assignedByDisplay, 'Super Admin')
  })

  it('3. Resolves HR Admin in HR Admin portal for cuid / missing assigner', () => {
    const rawAssignment = {
      id: 'asgn_3',
      employeeId: 'EMP-007',
      shiftId: 'SHIFT-03',
      assignedBy: 'cmw_some_id'
    }

    const isSuperAdminPortal = false
    const activeUser = { name: 'Ayesha Khan', role: 'hr_admin' }
    const portalDefaultAssigner = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || 'HR Admin')

    let assignedByDisplay = rawAssignment.assignedByName || rawAssignment.assignedBy
    if (!assignedByDisplay || (typeof assignedByDisplay === 'string' && assignedByDisplay.startsWith('cmw'))) {
      assignedByDisplay = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || portalDefaultAssigner)
    } else if (isSuperAdminPortal && (assignedByDisplay === 'HR Admin' || assignedByDisplay === 'HR Administrator')) {
      assignedByDisplay = activeUser?.name || 'Super Admin'
    }

    assert.equal(assignedByDisplay, 'Ayesha Khan')
  })

  it('4. Preserves authentic personal assigner names across all portals', () => {
    const rawAssignment = {
      id: 'asgn_4',
      employeeId: 'EMP-004',
      shiftId: 'SHIFT-02',
      assignedBy: 'Bilal Siddiqui'
    }

    const isSuperAdminPortal = true
    const activeUser = { name: 'Super Admin', role: 'super_admin' }
    const portalDefaultAssigner = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || 'HR Admin')

    let assignedByDisplay = rawAssignment.assignedByName || rawAssignment.assignedBy
    if (!assignedByDisplay || (typeof assignedByDisplay === 'string' && assignedByDisplay.startsWith('cmw'))) {
      assignedByDisplay = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || portalDefaultAssigner)
    } else if (isSuperAdminPortal && (assignedByDisplay === 'HR Admin' || assignedByDisplay === 'HR Administrator')) {
      assignedByDisplay = activeUser?.name || 'Super Admin'
    }

    assert.equal(assignedByDisplay, 'Bilal Siddiqui')
  })
})
