import test from 'node:test';
import assert from 'node:assert/strict';
import { performanceService } from '../services/performanceService.js';

const saUser = { id: 'USR-SA', role: 'super_admin', employeeId: 'EMP-001', departmentId: 'DEP-01' };
const mgrUser = { id: 'USR-MGR', role: 'dept_manager', employeeId: 'EMP-003', departmentId: 'DEP-01' };
const empUser = { id: 'USR-EMP', role: 'employee', employeeId: 'EMP-004', departmentId: 'DEP-01' };
const otherEmpUser = { id: 'USR-OTHER', role: 'employee', employeeId: 'EMP-999', departmentId: 'DEP-02' };

test('1. PerformanceService: _mapBackendFeedback maps PostgreSQL feedback fields cleanly', () => {
  const mapped = performanceService._mapBackendFeedback({
    id: 'fb_cuid_1',
    feedbackCode: 'FDB-2026-001',
    employeeId: 'emp_cuid_4',
    employee: { employeeCode: 'EMP-004', firstName: 'Ayesha', lastName: 'Tariq', departmentId: 'DEP-01', department: { name: 'Engineering' } },
    authorEmployee: { employeeCode: 'EMP-003', firstName: 'Bilal', lastName: 'Siddiqui' },
    authorRole: 'DEPT_MANAGER',
    feedbackType: 'CONSTRUCTIVE',
    title: 'Code Review Thoroughness',
    strengths: 'Clear test coverage',
    improvementAreas: 'PR splitting',
    managerComments: 'Keep up the momentum',
    status: 'SHARED',
    createdAt: '2026-11-12T10:00:00.000Z'
  });

  assert.equal(mapped.feedbackCode, 'FDB-2026-001');
  assert.equal(mapped.employeeId, 'EMP-004');
  assert.equal(mapped.employeeCuid, 'emp_cuid_4');
  assert.equal(mapped.employeeName, 'Ayesha Tariq');
  assert.equal(mapped.authorName, 'Bilal Siddiqui');
  assert.equal(mapped.departmentId, 'DEP-01');
  assert.equal(mapped.status, 'SHARED');
});

test('2. PerformanceService: _mapBackendPlan separates IDP and PIP cleanly', () => {
  const idp = performanceService._mapBackendPlan({
    id: 'plan_idp_1',
    planCode: 'IDP-2026-001',
    planCategory: 'IDP',
    employeeId: 'emp_cuid_4',
    employee: { employeeCode: 'EMP-004', firstName: 'Ayesha', lastName: 'Tariq', departmentId: 'DEP-01' },
    mentor: { employeeCode: 'EMP-003', firstName: 'Bilal', lastName: 'Siddiqui' },
    title: 'Cloud Architecture Growth Plan',
    status: 'IN_PROGRESS',
    progressPercent: 50,
    checkpoints: [
      { id: 'cp1', title: 'Module 1', completed: true },
      { id: 'cp2', title: 'Module 2', completed: false }
    ]
  });

  const pip = performanceService._mapBackendPlan({
    id: 'plan_pip_1',
    planCode: 'PIP-2026-001',
    planCategory: 'PIP',
    employeeId: 'emp_cuid_4',
    employee: { employeeCode: 'EMP-004', firstName: 'Ayesha', lastName: 'Tariq', departmentId: 'DEP-01' },
    title: 'SLA Recovery PIP',
    status: 'UNDER_REVIEW',
    documentedConcerns: 'Missed sprint deadlines',
    improvementTargets: [{ area: 'SLA', metric: '100% on time', status: 'IN_PROGRESS' }],
    employeeAcknowledged: true
  });

  assert.equal(idp.planCategory, 'IDP');
  assert.equal(pip.planCategory, 'PIP');
  assert.equal(pip.employeeAcknowledged, true);

  performanceService.memoryStorage['isysware_hrms_f07_idp_v1'] = [idp, pip];

  const idpList = performanceService.getDevelopmentPlans({ planCategory: 'IDP' }, saUser);
  const pipList = performanceService.getDevelopmentPlans({ planCategory: 'PIP' }, saUser);
  assert.equal(idpList.length, 1);
  assert.equal(idpList[0].planCode, 'IDP-2026-001');
  assert.equal(pipList.length, 1);
  assert.equal(pipList[0].planCode, 'PIP-2026-001');

  // Role scoping checks
  const empVisible = performanceService.getDevelopmentPlans({}, empUser);
  assert.equal(empVisible.length, 2);

  const otherVisible = performanceService.getDevelopmentPlans({}, otherEmpUser);
  assert.equal(otherVisible.length, 0);

  const mgrVisible = performanceService.getDevelopmentPlans({}, mgrUser);
  assert.equal(mgrVisible.length, 2);
});

