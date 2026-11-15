import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import taskService from '../services/taskService.js';
import { syncTasks } from '../services/backendSync.js';
import { apiClient } from '../services/apiClient.js';

describe('Task Management PostgreSQL Persistence & Frontend Integration QA Suite', () => {
  const superAdmin = { id: 'cmw316bzw000fu8noerxd49tc', name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001' };
  const hrAdmin = { id: 'cmw44e9d40001u8cc6djmtpr2', name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002' };
  const manager = { id: 'cmw_mgr_003', name: 'Bilal Siddiqui', role: 'manager', employeeId: 'EMP-003' };
  const employee = { id: 'cmw_emp_004', name: 'Zeeshan Ali', role: 'employee', employeeId: 'EMP-004' };

  test('1. Task Creation: creates task with required fields, default status and priority', () => {
    taskService.resetToDefaults();
    const task = taskService.createTask(
      {
        title: 'PostgreSQL Backend Migration',
        description: 'Verify database persistence for tasks module',
        departmentId: 'DEP-01',
        department: 'Engineering & Technology',
        assignedToId: 'EMP-004',
        assignedToName: 'Zeeshan Ali',
        priority: 'High',
        estimatedHours: 16,
        dueDate: '2026-11-30'
      },
      manager
    );

    assert.ok(task.id, 'Task must have an ID');
    assert.equal(task.title, 'PostgreSQL Backend Migration');
    assert.equal(task.status, 'To Do');
    assert.equal(task.progress, 0);
    assert.equal(task.assignedToId, 'EMP-004');
    assert.equal(task.assignedById, 'EMP-003');
    assert.equal(task.priority, 'High');
  });

  test('2. Progress & Lifecycle: transitions through In Progress and Completed with completionDate', () => {
    taskService.resetToDefaults();
    const created = taskService.createTask(
      {
        title: 'API Client Synchronization',
        assignedToId: 'EMP-004',
        priority: 'Medium'
      },
      manager
    );

    // Update to 50%
    const p50 = taskService.updateTaskProgress(created.id, 50, null, employee);
    assert.equal(p50.progress, 50);
    assert.equal(p50.status, 'In Progress');

    // Update to 100%
    const p100 = taskService.updateTaskProgress(created.id, 100, null, employee);
    assert.equal(p100.progress, 100);
    assert.equal(p100.status, 'Completed');
    assert.ok(p100.completionDate, 'Completed task must have completionDate');
  });

  test('3. Comments: appends comment and preserves existing audit logs', () => {
    taskService.resetToDefaults();
    const created = taskService.createTask(
      {
        title: 'Task Comments Audit',
        assignedToId: 'EMP-004'
      },
      manager
    );

    const c1 = taskService.addTaskComment(created.id, 'Initial progress report submitted.', employee);
    assert.ok(c1.id);
    assert.equal(c1.text, 'Initial progress report submitted.');
    assert.equal(c1.author, employee.name);

    const c2 = taskService.addTaskComment(created.id, 'Reviewed and approved by manager.', manager);
    assert.equal(c2.author, manager.name);

    const reloaded = taskService.getTaskById(created.id);
    assert.equal(reloaded.comments.length, 2);
    assert.equal(reloaded.comments[0].text, 'Initial progress report submitted.');
    assert.equal(reloaded.comments[1].text, 'Reviewed and approved by manager.');
  });

  test('4. Role Isolation: Employee sees only their tasks, Manager sees team', () => {
    taskService.resetToDefaults();
    // Create task for EMP-004
    taskService.createTask(
      { title: 'Emp 4 Task', assignedToId: 'EMP-004' },
      manager
    );
    // Create task for EMP-001
    taskService.createTask(
      { title: 'Emp 1 Task', assignedToId: 'EMP-001' },
      superAdmin
    );

    const empTasks = taskService.getTasks({}, employee);
    for (const t of empTasks) {
      assert.equal(t.assignedToId, 'EMP-004');
    }

    const adminTasks = taskService.getTasks({}, superAdmin);
    assert.ok(adminTasks.length >= empTasks.length);
  });

  test('5. Backend Sync: syncTasks maps backend PostgreSQL schema to frontend memory storage', async () => {
    // Mock apiClient.get for /tasks
    const originalGet = apiClient.get;
    try {
      apiClient.get = async (url) => {
        if (url === '/tasks') {
          return [
            {
              id: 'cmw_pg_task_1',
              taskCode: 'TSK-999',
              title: 'PostgreSQL Live Synced Deliverable',
              description: 'Fetched from PostgreSQL backend',
              priority: 'URGENT',
              status: 'IN_PROGRESS',
              dueDate: '2026-12-01T00:00:00.000Z',
              completedAt: null,
              estimatedHours: '12.0',
              actualHours: '4.0',
              attachments: { progress: 65 },
              progress: 65,
              comments: [
                {
                  id: 'CMT-001',
                  authorName: 'Tariq Mehmood',
                  author: 'Tariq Mehmood',
                  text: 'Database synced comment',
                  createdAt: '2026-11-12T00:00:00.000Z'
                }
              ],
              assignee: {
                id: 'cmw6xxjfu0001u804pra5o2tv',
                employeeCode: 'EMP-001',
                firstName: 'Tariq',
                lastName: 'Mehmood',
                departmentId: 'DEP-01'
              },
              assignedBy: {
                id: 'cmw6xxjfu0001u804pra5o2tv',
                employeeCode: 'EMP-001',
                firstName: 'Tariq',
                lastName: 'Mehmood'
              }
            }
          ];
        }
        return [];
      };

      let notified = false;
      const unsub = taskService.subscribe(() => { notified = true; });

      await syncTasks();
      unsub();

      assert.equal(notified, true, 'Subscribers should be notified on sync');

      const tasks = taskService.getTasks({}, superAdmin);
      const syncedTask = tasks.find((t) => t.id === 'TSK-999');
      assert.ok(syncedTask, 'Synced task TSK-999 must exist in memory storage');
      assert.equal(syncedTask.title, 'PostgreSQL Live Synced Deliverable');
      assert.equal(syncedTask.priority, 'Urgent', 'Enum URGENT should map to Urgent');
      assert.equal(syncedTask.status, 'In Progress', 'Enum IN_PROGRESS should map to In Progress');
      assert.equal(syncedTask.progress, 65, 'Progress should be 65%');
      assert.equal(syncedTask.estimatedHours, 12);
      assert.equal(syncedTask.loggedHours, 4);
      assert.equal(syncedTask.comments.length, 1);
      assert.equal(syncedTask.comments[0].text, 'Database synced comment');
    } finally {
      apiClient.get = originalGet;
    }
  });

  test('6. Overdue Detection: dynamic isOverdue flag calculation', () => {
    taskService.resetToDefaults();
    const overdueTask = taskService.createTask(
      {
        title: 'Overdue Sprint Item',
        assignedToId: 'EMP-004',
        dueDate: '2026-10-01' // Past date
      },
      manager
    );

    const tasks = taskService.getTasks({}, superAdmin);
    const item = tasks.find((t) => t.id === overdueTask.id);
    assert.ok(item);
    assert.equal(item.isOverdue, true, 'Past due incomplete task must be marked isOverdue');

    // Completing the task clears overdue flag
    taskService.updateTaskProgress(overdueTask.id, 100);
    const updatedTasks = taskService.getTasks({}, superAdmin);
    const completedItem = updatedTasks.find((t) => t.id === overdueTask.id);
    assert.equal(completedItem.isOverdue, false, 'Completed task must not be marked isOverdue');
  });
});

