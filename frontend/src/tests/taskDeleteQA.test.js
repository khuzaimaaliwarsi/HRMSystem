import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import taskService from '../services/taskService.js';
import { syncTasks } from '../services/backendSync.js';
import { apiClient } from '../services/apiClient.js';

describe('Frontend Task Delete, Department Cancel & RBAC QA Suite', () => {
  const superAdmin = { id: 'sa_1', name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001' };
  const hrAdmin = { id: 'hr_1', name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002' };
  const manager = { id: 'mgr_1', name: 'Bilal Siddiqui', role: 'manager', employeeId: 'EMP-003', departmentId: 'DEP-01' };
  const employee = { id: 'emp_1', name: 'Zeeshan Ali', role: 'employee', employeeId: 'EMP-004', departmentId: 'DEP-01' };

  test('1. deleteTaskAsync enforces Super Admin/HR Admin role and mandatory reason', async () => {
    taskService.resetToDefaults();
    const t = taskService.createTask({
      title: 'Frontend Delete Target Task',
      departmentId: 'DEP-01',
      assignedToId: 'EMP-004',
      priority: 'Medium'
    }, superAdmin);

    await assert.rejects(
      () => taskService.deleteTaskAsync(t.id, 'Manager cannot delete', manager),
      /Only Super Admin or HR Admin/i
    );
    await assert.rejects(
      () => taskService.deleteTaskAsync(t.id, 'Employee cannot delete', employee),
      /Only Super Admin or HR Admin/i
    );
    await assert.rejects(
      () => taskService.deleteTaskAsync(t.id, 'x', superAdmin),
      /reason is required/i
    );

    const res = await taskService.deleteTaskAsync(t.id, 'Duplicate deliverable cleaned up', hrAdmin);
    assert.equal(res.deleted, true);

    const active = taskService.getTasks({}, superAdmin);
    assert.equal(active.some((item) => item.id === t.id), false, 'Deleted task must disappear from active list');

    const history = await taskService.getTaskHistoryAsync();
    const histEntry = history.find((item) => item.id === t.id);
    assert.ok(histEntry, 'Deleted task must remain in history');
    assert.equal(histEntry.reason, 'Duplicate deliverable cleaned up');
    assert.equal(histEntry.actorRole, 'HR_ADMIN');
  });

  test('2. cancelTaskAsync allows Department Manager for same-dept tasks and rejects cross-dept/employee', async () => {
    taskService.resetToDefaults();
    const sameDeptTask = taskService.createTask({
      title: 'Same Dept Task',
      departmentId: 'DEP-01',
      assignedToId: 'EMP-004'
    }, manager);
    const otherDeptTask = taskService.createTask({
      title: 'Other Dept Task',
      departmentId: 'DEP-09',
      assignedToId: 'EMP-009'
    }, superAdmin);

    await assert.rejects(
      () => taskService.cancelTaskAsync(sameDeptTask.id, 'Employee cannot cancel', employee),
      /not authorized/i
    );
    await assert.rejects(
      () => taskService.cancelTaskAsync(otherDeptTask.id, 'Cross dept reason', manager),
      /only cancel tasks within their own department/i
    );

    const cancelled = await taskService.cancelTaskAsync(sameDeptTask.id, 'Scope moved to Q4', manager);
    assert.equal(cancelled.status, 'Cancelled');
    assert.equal(cancelled.cancellationReason, 'Scope moved to Q4');
  });

  test('3. syncTasks excludes soft-deleted backend tasks after refresh', async () => {
    const originalGet = apiClient.get;
    try {
      apiClient.get = async (url) => {
        if (url === '/tasks') {
          return [
            {
              id: 't_active_1',
              taskCode: 'TSK-101',
              title: 'Active Task',
              priority: 'MEDIUM',
              status: 'TODO',
              attachments: { progress: 10 },
              assignee: { id: 'e1', employeeCode: 'EMP-004', firstName: 'Zeeshan', lastName: 'Ali', departmentId: 'DEP-01' }
            },
            {
              id: 't_deleted_1',
              taskCode: 'TSK-102',
              title: 'Soft Deleted Task',
              priority: 'HIGH',
              status: 'CANCELLED',
              attachments: { progress: 0, isDeleted: true, lifecycleState: 'DELETED' },
              assignee: { id: 'e1', employeeCode: 'EMP-004', firstName: 'Zeeshan', lastName: 'Ali', departmentId: 'DEP-01' }
            }
          ];
        }
        return [];
      };

      await syncTasks();
      const tasks = taskService.getTasks({}, superAdmin);
      assert.equal(tasks.some((t) => t.taskCode === 'TSK-101'), true);
      assert.equal(tasks.some((t) => t.taskCode === 'TSK-102'), false, 'Soft-deleted task must not appear after sync refresh');
    } finally {
      apiClient.get = originalGet;
    }
  });

  test('4. TaskTable and role portals enforce UI visibility controls next to Details', () => {
    const baseDir = path.resolve(import.meta.dirname, '..');
    const tableSrc = fs.readFileSync(path.join(baseDir, 'components/performance/TaskTable.jsx'), 'utf8');
    const saSrc = fs.readFileSync(path.join(baseDir, 'pages/performance/SuperAdminPerformancePage.jsx'), 'utf8');
    const hrSrc = fs.readFileSync(path.join(baseDir, 'pages/performance/HrAdminPerformancePage.jsx'), 'utf8');
    const mgrSrc = fs.readFileSync(path.join(baseDir, 'pages/performance/ManagerPerformancePage.jsx'), 'utf8');
    const empSrc = fs.readFileSync(path.join(baseDir, 'pages/performance/EmployeePerformancePage.jsx'), 'utf8');

    assert.ok(tableSrc.includes('fa-trash-can'), 'TaskTable must include trash icon for Delete button');
    assert.ok(tableSrc.includes('canDelete && onDeleteTask'), 'Delete button must be guarded by canDelete');
    assert.ok(saSrc.includes('canDelete={true}') && saSrc.includes('TaskDeleteModal'), 'Super Admin enables Delete');
    assert.ok(hrSrc.includes('canDelete={true}') && hrSrc.includes('TaskDeleteModal'), 'HR Admin enables Delete');
    assert.ok(mgrSrc.includes('canDelete={false}') && mgrSrc.includes('canCancel={canManagerCancel}'), 'Manager cannot delete, can cancel');
    assert.equal(empSrc.includes('canDelete={true}'), false, 'Employee must never have delete permission');
  });
});

