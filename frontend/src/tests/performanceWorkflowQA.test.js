import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import taskService from '../services/taskService.js';
import performanceService from '../services/performanceService.js';
import { syncTasks, syncPerformance } from '../services/backendSync.js';
import { apiClient } from '../services/apiClient.js';

describe('Frontend Task Approval, Performance Sync & KPI Deduction QA Suite', () => {
  const employee = { id: 'usr_emp', role: 'employee', employeeId: 'EMP-004', name: 'Zeeshan Ali' };
  const manager = { id: 'usr_mgr', role: 'manager', employeeId: 'EMP-003', name: 'Bilal Siddiqui' };

  test('1. Task Approval Workflow: updateTaskProgressAsync at 100% transitions to In Review; verifyTaskCompletionAsync enforces role', async () => {
    taskService.resetToDefaults();
    const task = taskService.createTask({
      title: 'Frontend Approval Flow QA Task',
      departmentId: 'DEP-01',
      assignedToId: 'EMP-004',
      priority: 'High'
    }, manager);

    const submitted = await taskService.updateTaskProgressAsync(task.id, 100, null, employee);
    assert.equal(submitted.progress, 100);
    assert.equal(submitted.status, 'In Review');

    const employeeTriedComplete = await taskService.updateTaskProgressAsync(task.id, 100, 'Completed', employee);
    assert.equal(employeeTriedComplete.status, 'In Review', 'Employee cannot directly force Completed');

    await assert.rejects(
      () => taskService.verifyTaskCompletionAsync(task.id, 'APPROVE', 'Not allowed', employee),
      /Only authorized Managers/i
    );

    const verified = await taskService.verifyTaskCompletionAsync(task.id, 'APPROVE', 'LGTM', manager);
    assert.equal(verified.status, 'Completed');
    assert.equal(verified.progress, 100);
  });

  test('2. syncTasks uses real backend assignee department rather than hardcoded Engineering & Technology', async () => {
    const originalGet = apiClient.get;
    try {
      apiClient.get = async (url) => {
        if (url === '/tasks') {
          return [
            {
              id: 'cuid_task_1',
              taskCode: 'TSK-QA-1',
              title: 'Dept Sync Check',
              priority: 'MEDIUM',
              status: 'UNDER_REVIEW',
              attachments: { progress: 100 },
              assigneeId: 'cuid_emp_1',
              assignee: {
                id: 'cuid_emp_1',
                employeeCode: 'EMP-001',
                firstName: 'Khuzaima',
                lastName: 'Senior',
                departmentId: 'cuid_dept_sw',
                department: { id: 'cuid_dept_sw', name: 'Software Development', code: 'SW' }
              }
            }
          ];
        }
        return [];
      };

      await syncTasks();
      const tasks = taskService.getTasks({}, { role: 'super_admin' });
      const synced = tasks.find((t) => t.id === 'TSK-QA-1');
      assert.ok(synced);
      assert.equal(synced.department, 'Software Development');
      assert.equal(synced.status, 'In Review');
      assert.equal(synced.progress, 100);
    } finally {
      apiClient.get = originalGet;
    }
  });

  test('3. performanceService maps backend cycles & reviews and matches both employeeCode and CUID scoping', () => {
    performanceService.resetToDefaults();
    const mapped = performanceService._mapBackendReview({
      id: 'rev_cuid_1',
      cycleId: 'cyc_cuid_1',
      cycle: { id: 'cyc_cuid_1', title: 'Annual 2026', cycleCode: 'CYC-2026-01' },
      employeeId: 'emp_cuid_1',
      employee: {
        id: 'emp_cuid_1',
        employeeCode: 'EMP-001',
        firstName: 'Khuzaima',
        lastName: 'Developer',
        departmentId: 'dept_sw',
        department: { name: 'Software Development' },
        designation: { title: 'Frontend Developer' }
      },
      reviewerId: 'emp_cuid_mgr',
      reviewer: { id: 'emp_cuid_mgr', employeeCode: 'EMP-003', firstName: 'Bilal', lastName: 'Siddiqui' },
      status: 'HR_MODERATION',
      selfScore: '4.0',
      reviewerScore: '4.6',
      finalNormalizedScore: '4.4',
      ratingCategory: 'EXCEEDS_EXPECTATIONS',
      managerRecommendation: JSON.stringify({
        type: 'SALARY_INCREMENT',
        recommendedPercent: 12,
        selfComments: 'Delivered all sprints',
        managerComments: 'Top performer'
      })
    });

    assert.equal(mapped.status, 'Manager Evaluated');
    assert.equal(mapped.selfRating, 4.0);
    assert.equal(mapped.managerRating, 4.6);
    assert.equal(mapped.finalWeightedRating, 4.4);
    assert.equal(mapped.selfComments, 'Delivered all sprints');
    assert.equal(mapped.managerComments, 'Top performer');
    assert.equal(mapped.department, 'Software Development');

    performanceService.memoryStorage['isysware_hrms_f07_reviews_v1'] = [mapped];
    const byCuid = performanceService.getReviews({}, { role: 'employee', employeeId: 'emp_cuid_1' });
    const byCode = performanceService.getReviews({}, { role: 'employee', employeeId: 'EMP-001' });
    assert.equal(byCuid.length, 1);
    assert.equal(byCode.length, 1);
    assert.equal(typeof syncPerformance, 'function');
  });
});

