import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  identityRepairService,
  REPAIR_CONFIRMATION_TOKEN,
  CANONICAL_KEYS
} from '../services/identityRepairService.js'
import { CANONICAL_EMPLOYEES } from '../mocks/organizationData.js'
import { DEMO_USERS } from '../mocks/demoUsers.js'

function createMockStorage(initialData = {}) {
  const store = new Map()
  for (const [k, v] of Object.entries(initialData)) {
    store.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] || null,
    get length() {
      return store.size
    }
  }
}

describe('P0 Critical Identity Collision & Safe Repair Test Suite', () => {
  test('1. detectCollision: identifies Hamza holding EMP-001 and missing Super Admin profile', () => {
    const mockStorage = createMockStorage({
      [CANONICAL_KEYS.EMPLOYEES]: [
        {
          id: 'EMP-001',
          name: 'Hamza Ahmed',
          email: 'hamza.manager@example.com',
          role: 'employee',
          departmentId: 'DEP-01',
          status: 'Active'
        }
      ],
      [CANONICAL_KEYS.USER_ACCOUNTS]: DEMO_USERS
    })

    const detection = identityRepairService.detectCollision(mockStorage)
    assert.equal(detection.hasCollision, true)
    assert.equal(detection.isEmp001Collided, true)
    assert.equal(detection.collidedEmployee.name, 'Hamza Ahmed')
    assert.equal(detection.isSuperAdminMissing, true)
    assert.equal(detection.isHrAdminMissing, true)
    assert.equal(detection.issues.length >= 2, true)
  })

  test('2. generateRepairPreview: non-destructive dry-run accurately plans remapping to EMP-003 and recovers canonical admins', () => {
    const mockStorage = createMockStorage({
      [CANONICAL_KEYS.EMPLOYEES]: [
        {
          id: 'EMP-001',
          name: 'Hamza Ahmed',
          email: 'hamza.manager@example.com',
          departmentId: 'DEP-01'
        }
      ],
      [CANONICAL_KEYS.DEPARTMENTS]: [
        {
          id: 'DEP-01',
          name: 'Software Development',
          headId: 'EMP-001',
          headName: 'Hamza Ahmed'
        }
      ],
      [CANONICAL_KEYS.TEAMS]: [
        {
          id: 'TEAM-01',
          name: 'Frontend Team',
          departmentId: 'DEP-01',
          managerId: 'EMP-001'
        }
      ],
      [CANONICAL_KEYS.BANK_RECORDS]: [
        {
          id: 'BNK-HAMZA',
          employeeId: 'EMP-001',
          accountTitle: 'Hamza Ahmed'
        }
      ],
      [CANONICAL_KEYS.CAREER_HISTORY]: [
        {
          id: 'HIST-HAMZA',
          employeeId: 'EMP-001',
          changeType: 'JOINING'
        }
      ],
      [CANONICAL_KEYS.USER_ACCOUNTS]: DEMO_USERS
    })

    const preview = identityRepairService.generateRepairPreview(mockStorage)
    assert.equal(preview.canRepair, true)
    assert.equal(preview.targetHamzaId, 'EMP-003')
    assert.equal(preview.collidedEmployee.name, 'Hamza Ahmed')

    // Check planned foreign key updates
    assert.equal(preview.impactedReferences.departments.length, 1)
    assert.equal(preview.impactedReferences.departments[0].proposedHeadId, 'EMP-003')

    assert.equal(preview.impactedReferences.teams.length, 1)
    assert.equal(preview.impactedReferences.teams[0].proposedManagerId, 'EMP-003')

    assert.equal(preview.impactedReferences.bankRecords.length, 1)
    assert.equal(preview.impactedReferences.bankRecords[0].proposedEmployeeId, 'EMP-003')

    assert.equal(preview.impactedReferences.careerHistory.length, 1)
    assert.equal(preview.impactedReferences.careerHistory[0].proposedEmployeeId, 'EMP-003')

    // Canonical admins to recover
    assert.equal(preview.canonicalSuperAdmin.id, 'EMP-001')
    assert.equal(preview.canonicalSuperAdmin.email, 'superadmin@isysware.com')
    assert.equal(preview.canonicalHrAdmin.id, 'EMP-002')
    assert.equal(preview.canonicalHrAdmin.email, 'hr@isysware.com')

    // Verify storage was NOT mutated by preview
    const empsAfter = JSON.parse(mockStorage.getItem(CANONICAL_KEYS.EMPLOYEES))
    assert.equal(empsAfter.length, 1)
    assert.equal(empsAfter[0].id, 'EMP-001')
  })

  test('3. executeRepair: rejects unauthorized confirmation token', () => {
    const mockStorage = createMockStorage({
      [CANONICAL_KEYS.EMPLOYEES]: [{ id: 'EMP-001', name: 'Hamza', email: 'hamza@example.com' }]
    })

    assert.throws(
      () => identityRepairService.executeRepair('WRONG_TOKEN', { dryRun: false }, mockStorage),
      /Invalid confirmation token/
    )
  })

  test('4. executeRepair: transactional live execution reallocates Hamza to EMP-003, updates department head, and restores EMP-001 & EMP-002 without data loss', () => {
    const mockStorage = createMockStorage({
      [CANONICAL_KEYS.EMPLOYEES]: [
        {
          id: 'EMP-001',
          name: 'Hamza Ahmed',
          email: 'hamza.manager@example.com',
          departmentId: 'DEP-01',
          role: 'employee',
          status: 'Active'
        }
      ],
      [CANONICAL_KEYS.DEPARTMENTS]: [
        {
          id: 'DEP-01',
          name: 'Software Development',
          code: 'DEV',
          headId: 'EMP-001',
          headName: 'Hamza Ahmed'
        }
      ],
      [CANONICAL_KEYS.TEAMS]: [
        {
          id: 'TEAM-01',
          name: 'Frontend Team',
          departmentId: 'DEP-01',
          managerId: 'EMP-001',
          teamLeadId: 'EMP-001'
        }
      ],
      [CANONICAL_KEYS.BANK_RECORDS]: [
        {
          id: 'BNK-HAMZA',
          employeeId: 'EMP-001',
          accountTitle: 'Hamza Ahmed',
          bankName: 'Standard Chartered'
        }
      ],
      [CANONICAL_KEYS.CAREER_HISTORY]: [
        {
          id: 'HIST-HAMZA',
          employeeId: 'EMP-001',
          changeType: 'JOINING'
        }
      ],
      [CANONICAL_KEYS.USER_ACCOUNTS]: DEMO_USERS
    })

    const res = identityRepairService.executeRepair(REPAIR_CONFIRMATION_TOKEN, { dryRun: false }, mockStorage)
    assert.equal(res.success, true)
    assert.equal(res.remappedEmployeeId, 'EMP-003')
    assert.equal(res.superAdminId, 'EMP-001')
    assert.equal(res.hrAdminId, 'EMP-002')

    // Invariant Verification: EMP-001 is Super Admin
    const emps = JSON.parse(mockStorage.getItem(CANONICAL_KEYS.EMPLOYEES))
    assert.equal(emps.length, 3, 'Must have exactly 3 employees: Super Admin, HR Admin, Hamza')

    const superAdmin = emps.find((e) => e.id === 'EMP-001')
    assert.ok(superAdmin, 'EMP-001 must exist')
    assert.equal(superAdmin.email, 'superadmin@isysware.com')

    const hrAdmin = emps.find((e) => e.id === 'EMP-002')
    assert.ok(hrAdmin, 'EMP-002 must exist')
    assert.equal(hrAdmin.email, 'hr@isysware.com')

    const hamza = emps.find((e) => e.id === 'EMP-003')
    assert.ok(hamza, 'Hamza must exist with ID EMP-003')
    assert.equal(hamza.name, 'Hamza Ahmed')
    assert.equal(hamza.email, 'hamza.manager@example.com')

    // Invariant Verification: Department Head points to Hamza's new ID EMP-003
    const depts = JSON.parse(mockStorage.getItem(CANONICAL_KEYS.DEPARTMENTS))
    assert.equal(depts.length, 1)
    assert.equal(depts[0].headId, 'EMP-003')
    assert.equal(depts[0].headName, 'Hamza Ahmed')

    // Invariant Verification: Team pointers updated
    const teams = JSON.parse(mockStorage.getItem(CANONICAL_KEYS.TEAMS))
    assert.equal(teams[0].managerId, 'EMP-003')
    assert.equal(teams[0].teamLeadId, 'EMP-003')

    // Invariant Verification: Bank & Career records updated
    const banks = JSON.parse(mockStorage.getItem(CANONICAL_KEYS.BANK_RECORDS))
    const hamzaBank = banks.find((b) => b.id === 'BNK-HAMZA')
    assert.equal(hamzaBank.employeeId, 'EMP-003')

    const career = JSON.parse(mockStorage.getItem(CANONICAL_KEYS.CAREER_HISTORY))
    const hamzaCareer = career.find((c) => c.id === 'HIST-HAMZA')
    assert.equal(hamzaCareer.employeeId, 'EMP-003')

    // Post-repair collision detection must now report HEALTHY (no collision)
    const postDetection = identityRepairService.detectCollision(mockStorage)
    assert.equal(postDetection.hasCollision, false)
  })

  test('5. Rollback on verification failure: aborts and restores original state cleanly', () => {
    const mockStorage = createMockStorage({
      [CANONICAL_KEYS.EMPLOYEES]: [
        {
          id: 'EMP-001',
          name: 'Hamza Ahmed',
          email: 'hamza.manager@example.com'
        }
      ]
    })

    // Corrupt CANONICAL_EMPLOYEES temporarily in the runner or force failure by mocking setItem
    const originalSetItem = mockStorage.setItem
    let writeCount = 0
    mockStorage.setItem = (k, v) => {
      writeCount++
      if (writeCount === 3) {
        throw new Error('Simulated IO or storage failure mid-transaction')
      }
      originalSetItem(k, v)
    }

    assert.throws(
      () => identityRepairService.executeRepair(REPAIR_CONFIRMATION_TOKEN, { dryRun: false }, mockStorage),
      /Identity repair aborted and rolled back/
    )

    // Restore setItem to inspect state
    mockStorage.setItem = originalSetItem
    const emps = JSON.parse(mockStorage.getItem(CANONICAL_KEYS.EMPLOYEES))
    assert.equal(emps.length, 1)
    assert.equal(emps[0].id, 'EMP-001', 'Rollback must preserve original pre-repair state')
  })
})

