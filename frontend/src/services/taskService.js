/**
 * iSysware HRMS — Batch F07: Task Management Service
 * Controls:
 * - Task Creation, Assignment & Reassignment
 * - Status Lifecycle: To Do -> In Progress -> In Review -> Completed (Blocked / Overdue)
 * - Percentage Progress Updates
 * - Task Comments & Audit Logs
 * - Role-Scoped Task Lists (Manager oversees team, Employee oversees personal tasks)
 * - Independent from Attendance/Payroll (Task progress does not mutate payroll hours)
 */

import { INITIAL_TASKS } from '../mocks/performanceData.js';
import { employeeService } from './employeeService.js';
import { apiClient } from './apiClient.js';

const STORAGE_KEY = 'isysware_hrms_f07_tasks_v1';
const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT);
let localTaskSeq = 0;

const mapPriorityToBackend = (p) => {
  if (!p) return 'MEDIUM';
  const upper = String(p).toUpperCase();
  if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(upper)) return upper;
  return 'MEDIUM';
};

const mapStatusToBackend = (s) => {
  if (!s) return 'TODO';
  const norm = String(s).toUpperCase().replace(/[\s-]/g, '_');
  if (['TODO', 'TO_DO'].includes(norm)) return 'TODO';
  if (['IN_PROGRESS', 'PROGRESS'].includes(norm)) return 'IN_PROGRESS';
  if (['UNDER_REVIEW', 'IN_REVIEW', 'REVIEW'].includes(norm)) return 'UNDER_REVIEW';
  if (norm === 'COMPLETED') return 'COMPLETED';
  if (norm === 'BLOCKED') return 'BLOCKED';
  if (norm === 'CANCELLED') return 'CANCELLED';
  return 'TODO';
};

const mapPriorityToFrontend = (p) => {
  const map = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
  return map[String(p).toUpperCase()] || p || 'Medium';
};

const mapStatusToFrontend = (s) => {
  const map = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    UNDER_REVIEW: 'In Review',
    COMPLETED: 'Completed',
    BLOCKED: 'Blocked',
    CANCELLED: 'Cancelled'
  };
  return map[String(s).toUpperCase().replace(/[\s-]/g, '_')] || s || 'To Do';
};

class TaskService {
  constructor() {
    this.listeners = new Set();
    this.memoryStorage = {};
    this._initialize();
  }

  // Safe in-memory storage abstraction — strictly zero business data in browser localStorage
  _getItem(key, defaultVal) {
    if (this.memoryStorage[key] !== undefined) return this.memoryStorage[key];
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          try { return JSON.parse(val); } catch { return val; }
        }
      } catch {
        // ignore
      }
    }
    return defaultVal !== undefined ? defaultVal : [];
  }

  _setItem(key, value) {
    this.memoryStorage[key] = value;
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch {
        // ignore
      }
    }
  }

  _initialize() {
    const existing = this._getItem(STORAGE_KEY, null);
    if (!existing || existing.length === 0) {
      this._setItem(STORAGE_KEY, JSON.parse(JSON.stringify(INITIAL_TASKS)));
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in taskService listener:', err);
      }
    }
  }

  resetToDefaults() {
    const defaults = isTest ? INITIAL_TASKS : [];
    this._setItem(STORAGE_KEY, JSON.parse(JSON.stringify(defaults)));
    this._notify();
  }

  /**
   * Get tasks filtered by role and criteria
   */
  getTasks(filters = {}, requestingUser = null) {
    const fallback = isTest ? INITIAL_TASKS : [];
    let list = [...this._getItem(STORAGE_KEY, fallback)].filter((t) => !t?.isDeleted);

    // Role-based visibility
    if (requestingUser) {
      const userRole = String(requestingUser.role || '').toLowerCase();
      const myId = requestingUser.employeeId || requestingUser.id;

      if (userRole === 'employee') {
        list = list.filter((t) => t.assignedToId === myId || t.assignedToCuid === myId);
      } else if (userRole === 'manager' || userRole === 'dept_manager') {
        // Manager sees tasks in their department, assigned to self, or direct reports
        const teamMembers = employeeService.getDirectReports(myId) || [];
        const allowedIds = new Set([myId, ...teamMembers.map((m) => m.id), ...teamMembers.map((m) => m.cuid).filter(Boolean)]);
        const deptId = requestingUser.departmentId;
        list = list.filter((t) =>
          allowedIds.has(t.assignedToId) ||
          allowedIds.has(t.assignedToCuid) ||
          t.assignedById === myId ||
          (deptId && t.departmentId === deptId)
        );
      } else if (userRole === 'team_lead') {
        const teamMembers = employeeService.getDirectReports(myId) || [];
        const allowedIds = new Set([myId, ...teamMembers.map((m) => m.id), ...teamMembers.map((m) => m.cuid).filter(Boolean)]);
        list = list.filter((t) => allowedIds.has(t.assignedToId) || allowedIds.has(t.assignedToCuid) || t.assignedById === myId);
      }
      // Super Admin and HR Admin see all tasks
    }

    if (filters.status && filters.status !== 'all') {
      list = list.filter((t) => t.status.toLowerCase() === filters.status.toLowerCase());
    }
    if (filters.priority && filters.priority !== 'all') {
      list = list.filter((t) => t.priority.toLowerCase() === filters.priority.toLowerCase());
    }
    if (filters.departmentId && filters.departmentId !== 'all') {
      list = list.filter((t) => t.departmentId === filters.departmentId);
    }
    if (filters.assignedToId) {
      list = list.filter((t) => t.assignedToId === filters.assignedToId);
    }

    // Auto-mark overdue tasks
    const today = new Date().toISOString().slice(0, 10);
    return list.map((task) => {
      const isOverdue = Boolean(task.status !== 'Completed' && task.dueDate && task.dueDate < today && task.status !== 'Overdue');
      return { ...task, isOverdue };
    });
  }

  /**
   * Get single task by ID or taskCode
   */
  getTaskById(taskId) {
    const fallback = isTest ? INITIAL_TASKS : [];
    const list = this._getItem(STORAGE_KEY, fallback);
    return list.find((t) => t.id === taskId || t.backendId === taskId || t.cuid === taskId || t.taskCode === taskId) || null;
  }

  /**
   * Create new task asynchronously with PostgreSQL backend persistence
   */
  async createTaskAsync(data, requestingUser = null) {
    const {
      title,
      description,
      departmentId,
      department,
      assignedToId,
      assignedToName,
      priority = 'Medium',
      estimatedHours = 8,
      startDate,
      dueDate,
      projectRef = null,
      progress = 0
    } = data;

    if (!title || title.trim().length < 3) {
      throw new Error('Task title must be at least 3 characters.');
    }
    if (!assignedToId) {
      throw new Error('Task assignee is required.');
    }

    let backendTask = null;
    if (typeof window !== 'undefined' && apiClient?.post) {
      try {
        const payload = {
          title: title.trim(),
          description: description?.trim() || null,
          assigneeId: assignedToId,
          assignedToId,
          priority: mapPriorityToBackend(priority),
          status: mapStatusToBackend(data.status || 'To Do'),
          dueDate: dueDate || null,
          estimatedHours: Number(estimatedHours) || 8,
          progress: Number(progress) || 0
        };
        const res = await apiClient.post('/tasks', payload);
        backendTask = res?.data || res;
      } catch (err) {
        console.warn('[taskService] Failed to persist task via API:', err?.message || err);
        if (!isTest) throw err;
      }
    }

    const newTask = {
      id: backendTask?.taskCode || `TSK-${Date.now().toString().slice(-6)}-${++localTaskSeq}`,
      cuid: backendTask?.id || null,
      backendId: backendTask?.id || null,
      taskCode: backendTask?.taskCode || null,
      title: title.trim(),
      description: description?.trim() || '',
      departmentId: departmentId || 'DEP-01',
      department: department || 'General',
      assignedToId,
      assignedToName: assignedToName || assignedToId,
      assignedById: requestingUser?.employeeId || requestingUser?.id || 'EMP-001',
      assignedByName: requestingUser?.name || 'Tariq Mehmood',
      priority: mapPriorityToFrontend(backendTask?.priority || priority),
      status: mapStatusToFrontend(backendTask?.status || data.status || 'To Do'),
      progress: backendTask?.progress !== undefined ? backendTask.progress : (Number(progress) || 0),
      estimatedHours: Number(estimatedHours) || 8,
      loggedHours: 0,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      dueDate: dueDate || null,
      completionDate: null,
      projectRef: projectRef || 'GENERAL',
      comments: []
    };

    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [newTask, ...this._getItem(STORAGE_KEY, fallback)];
    this._setItem(STORAGE_KEY, list);
    this._notify();
    return newTask;
  }

  /**
   * Create new task (synchronous for test harness and immediate UI response)
   */
  createTask(data, requestingUser = null) {
    const {
      title,
      description,
      departmentId,
      department,
      assignedToId,
      assignedToName,
      priority = 'Medium',
      estimatedHours = 8,
      startDate,
      dueDate,
      projectRef = null
    } = data;

    if (!title || title.trim().length < 3) {
      throw new Error('Task title must be at least 3 characters.');
    }
    if (!assignedToId) {
      throw new Error('Task assignee is required.');
    }

    const localId = `TSK-${Date.now().toString().slice(-6)}-${++localTaskSeq}`;
    const newTask = {
      id: localId,
      title: title.trim(),
      description: description?.trim() || '',
      departmentId: departmentId || 'DEP-01',
      department: department || 'General',
      assignedToId,
      assignedToName: assignedToName || assignedToId,
      assignedById: requestingUser?.employeeId || requestingUser?.id || 'EMP-001',
      assignedByName: requestingUser?.name || 'Tariq Mehmood',
      priority,
      status: 'To Do',
      progress: 0,
      estimatedHours: Number(estimatedHours) || 8,
      loggedHours: 0,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      dueDate: dueDate || null,
      completionDate: null,
      projectRef: projectRef || 'GENERAL',
      comments: []
    };

    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [newTask, ...this._getItem(STORAGE_KEY, fallback)];
    this._setItem(STORAGE_KEY, list);
    this._notify();

    // Background sync to PostgreSQL API in browser/production
    if (!isTest && typeof window !== 'undefined' && apiClient?.post) {
      apiClient.post('/tasks', {
        title: title.trim(),
        description: description?.trim() || null,
        assigneeId: assignedToId,
        assignedToId,
        priority: mapPriorityToBackend(priority),
        status: 'TODO',
        dueDate: dueDate || null,
        estimatedHours: Number(estimatedHours) || 8,
        progress: 0
      }).then((res) => {
        const bt = res?.data || res;
        if (bt?.taskCode || bt?.id) {
          const current = this._getItem(STORAGE_KEY, []);
          const idx = current.findIndex((t) => t.id === localId);
          if (idx !== -1) {
            current[idx].id = bt.taskCode || current[idx].id;
            current[idx].cuid = bt.id;
            current[idx].backendId = bt.id;
            current[idx].taskCode = bt.taskCode;
            this._setItem(STORAGE_KEY, current);
            this._notify();
          }
        }
      }).catch((err) => {
        console.warn('[taskService] Background task creation failed:', err?.message || err);
      });
    }

    return newTask;
  }

  /**
   * Update task progress and status (synchronous + background API sync)
   */
  updateTaskProgress(taskId, progressPercent, newStatus = null, _actor = null) {
    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [...this._getItem(STORAGE_KEY, fallback)];
    const idx = list.findIndex((t) => t.id === taskId || t.backendId === taskId || t.cuid === taskId);
    if (idx === -1) throw new Error(`Task '${taskId}' not found.`);

    const task = { ...list[idx] };
    const prog = Math.min(100, Math.max(0, Number(progressPercent) || 0));
    task.progress = prog;

    if (newStatus) {
      task.status = newStatus;
    } else if (prog === 100) {
      task.status = 'Completed';
      task.completionDate = new Date().toISOString().slice(0, 10);
    } else if (prog > 0 && task.status === 'To Do') {
      task.status = 'In Progress';
    }

    list[idx] = task;
    this._setItem(STORAGE_KEY, list);
    this._notify();

    // Background sync to backend if available
    if (!isTest && typeof window !== 'undefined' && apiClient?.patch) {
      const targetId = task.backendId || task.cuid || task.id;
      apiClient.patch(`/tasks/${targetId}`, {
        progress: prog,
        status: newStatus ? mapStatusToBackend(newStatus) : (prog === 100 ? 'COMPLETED' : (prog > 0 ? 'IN_PROGRESS' : undefined))
      }).catch((err) => {
        console.warn('[taskService] Background task update failed:', err?.message || err);
      });
    }

    return task;
  }

  _canVerifyTask(actor) {
    const role = String(actor?.role || '').toUpperCase();
    return ['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'MANAGER', 'TEAM_LEAD'].includes(role);
  }

  /**
   * Update task progress and status asynchronously with PostgreSQL confirmation
   */
  async updateTaskProgressAsync(taskId, progressPercent, newStatus = null, actor = null) {
    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [...this._getItem(STORAGE_KEY, fallback)];
    const idx = list.findIndex((t) => t.id === taskId || t.backendId === taskId || t.cuid === taskId);
    if (idx === -1) throw new Error(`Task '${taskId}' not found.`);

    const task = { ...list[idx] };
    const isVerifier = this._canVerifyTask(actor);
    let prog = Math.min(100, Math.max(0, Number(progressPercent) || 0));

    let effectiveStatus = newStatus;
    if (effectiveStatus === 'Completed' && !isVerifier) {
      effectiveStatus = 'In Review';
    }
    if (effectiveStatus === 'Completed') {
      prog = 100;
    }

    task.progress = prog;

    if (effectiveStatus) {
      task.status = effectiveStatus;
      if (effectiveStatus === 'Completed') {
        task.completionDate = new Date().toISOString().slice(0, 10);
      }
    } else if (prog === 100) {
      task.status = 'In Review';
      task.submittedForReviewAt = new Date().toISOString();
    } else if (prog > 0 && (task.status === 'To Do' || task.status === 'In Review')) {
      task.status = 'In Progress';
    }

    if (typeof window !== 'undefined' && apiClient?.patch) {
      try {
        const targetId = task.backendId || task.cuid || task.id;
        const res = await apiClient.patch(`/tasks/${targetId}`, {
          progress: prog,
          status: mapStatusToBackend(task.status)
        });
        const bt = res?.data || res;
        if (bt) {
          task.status = mapStatusToFrontend(bt.status);
          task.progress = bt.progress !== undefined ? bt.progress : prog;
          if (bt.completedAt) {
            task.completionDate = String(bt.completedAt).slice(0, 10);
          }
        }
      } catch (err) {
        console.warn('[taskService] API task update failed:', err?.message || err);
        if (!isTest) throw err;
      }
    }

    list[idx] = task;
    this._setItem(STORAGE_KEY, list);
    this._notify();
    return task;
  }

  /**
   * Employee submits 100%-complete task work for Manager/Admin verification
   */
  async submitTaskForReviewAsync(taskId, notes = '', actor = null) {
    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [...this._getItem(STORAGE_KEY, fallback)];
    const idx = list.findIndex((t) => t.id === taskId || t.backendId === taskId || t.cuid === taskId);
    if (idx === -1) throw new Error(`Task '${taskId}' not found.`);

    const task = { ...list[idx] };
    task.progress = 100;
    task.status = 'In Review';
    task.submittedForReviewAt = new Date().toISOString();

    if (typeof window !== 'undefined' && apiClient?.post) {
      const targetId = task.backendId || task.cuid || task.id;
      const res = await apiClient.post(`/tasks/${targetId}/submit-review`, {
        notes: notes?.trim() || undefined
      });
      const bt = res?.data || res;
      if (bt) {
        task.status = mapStatusToFrontend(bt.status || 'UNDER_REVIEW');
        task.progress = bt.progress !== undefined ? bt.progress : 100;
      }
    }

    if (notes?.trim() && (!actor || typeof window === 'undefined')) {
      task.comments = [
        ...(task.comments || []),
        {
          id: `CMT-${Date.now().toString().slice(-5)}`,
          author: actor?.name || 'Employee',
          date: new Date().toISOString().slice(0, 10),
          text: `Submitted for review: ${notes.trim()}`
        }
      ];
    }

    list[idx] = task;
    this._setItem(STORAGE_KEY, list);
    this._notify();
    return task;
  }

  /**
   * Authorized Manager / HR / Super Admin verifies 100% task and approves Completed or requests Revision
   */
  async verifyTaskCompletionAsync(taskId, action = 'APPROVE', remarks = '', actor = null) {
    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [...this._getItem(STORAGE_KEY, fallback)];
    const idx = list.findIndex((t) => t.id === taskId || t.backendId === taskId || t.cuid === taskId);
    if (idx === -1) throw new Error(`Task '${taskId}' not found.`);

    if (actor && !this._canVerifyTask(actor)) {
      throw new Error('Only authorized Managers, HR Admin, or Super Admin can verify and complete tasks.');
    }

    const task = { ...list[idx] };
    const normalizedAction = String(action || 'APPROVE').toUpperCase() === 'REVISION' ? 'REVISION' : 'APPROVE';

    if (typeof window !== 'undefined' && apiClient?.patch) {
      const targetId = task.backendId || task.cuid || task.id;
      const res = await apiClient.patch(`/tasks/${targetId}/verify`, {
        action: normalizedAction,
        remarks: remarks?.trim() || undefined
      });
      const bt = res?.data || res;
      if (bt) {
        task.status = mapStatusToFrontend(bt.status);
        task.progress = bt.progress !== undefined ? bt.progress : (normalizedAction === 'APPROVE' ? 100 : 75);
        task.completionDate = bt.completedAt ? String(bt.completedAt).slice(0, 10) : null;
      }
    } else if (normalizedAction === 'APPROVE') {
      task.status = 'Completed';
      task.progress = 100;
      task.completionDate = new Date().toISOString().slice(0, 10);
      task.verifiedByName = actor?.name || 'Manager';
    } else {
      task.status = 'In Progress';
      task.progress = Math.min(task.progress || 75, 75);
      task.completionDate = null;
    }

    list[idx] = task;
    this._setItem(STORAGE_KEY, list);
    this._notify();
    return task;
  }

  /**
   * Add comment to task (synchronous + background API sync)
   */
  addTaskComment(taskId, commentText, authorUser = null) {
    if (!commentText || !commentText.trim()) throw new Error('Comment cannot be empty.');

    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [...this._getItem(STORAGE_KEY, fallback)];
    const idx = list.findIndex((t) => t.id === taskId || t.backendId === taskId || t.cuid === taskId);
    if (idx === -1) throw new Error(`Task '${taskId}' not found.`);

    const task = { ...list[idx] };
    const comment = {
      id: `CMT-${Date.now().toString().slice(-5)}`,
      author: authorUser?.name || 'User',
      date: new Date().toISOString().slice(0, 10),
      text: commentText.trim()
    };

    task.comments = [...(task.comments || []), comment];
    list[idx] = task;
    this._setItem(STORAGE_KEY, list);
    this._notify();

    if (!isTest && typeof window !== 'undefined' && apiClient?.post) {
      const targetId = task.backendId || task.cuid || task.id;
      apiClient.post(`/tasks/${targetId}/comments`, {
        commentText: commentText.trim()
      }).catch((err) => {
        console.warn('[taskService] Background comment submission failed:', err?.message || err);
      });
    }

    return comment;
  }

  /**
   * Add comment to task asynchronously with PostgreSQL confirmation
   */
  async addTaskCommentAsync(taskId, commentText, authorUser = null) {
    if (!commentText || !commentText.trim()) throw new Error('Comment cannot be empty.');

    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [...this._getItem(STORAGE_KEY, fallback)];
    const idx = list.findIndex((t) => t.id === taskId || t.backendId === taskId || t.cuid === taskId);
    if (idx === -1) throw new Error(`Task '${taskId}' not found.`);

    const task = { ...list[idx] };
    let newComment = {
      id: `CMT-${Date.now().toString().slice(-5)}`,
      author: authorUser?.name || 'User',
      date: new Date().toISOString().slice(0, 10),
      text: commentText.trim()
    };

    if (typeof window !== 'undefined' && apiClient?.post) {
      try {
        const targetId = task.backendId || task.cuid || task.id;
        const res = await apiClient.post(`/tasks/${targetId}/comments`, {
          commentText: commentText.trim()
        });
        const bt = res?.data || res;
        if (bt?.comments && Array.isArray(bt.comments)) {
          task.comments = bt.comments.map((c) => ({
            id: c.id,
            author: c.authorName || c.author || 'User',
            date: c.date || (c.createdAt ? String(c.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)),
            text: c.text || c.commentText || ''
          }));
          newComment = task.comments[task.comments.length - 1] || newComment;
        }
      } catch (err) {
        console.warn('[taskService] API comment addition failed:', err?.message || err);
        if (!isTest) throw err;
      }
    }

    if (!task.comments.some((c) => c.id === newComment.id)) {
      task.comments = [...(task.comments || []), newComment];
    }
    list[idx] = task;
    this._setItem(STORAGE_KEY, list);
    this._notify();
    return newComment;
  }

  /**
   * Soft-delete / archive task with mandatory reason (Super Admin & HR Admin only)
   */
  async deleteTaskAsync(taskId, reason, actorUser = null) {
    const role = String(actorUser?.role || '').toUpperCase();
    if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(role)) {
      throw new Error('Only Super Admin or HR Admin can delete tasks.');
    }
    const trimmedReason = String(reason || '').trim();
    if (trimmedReason.length < 3) {
      throw new Error('Deletion reason is required (minimum 3 characters).');
    }

    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [...this._getItem(STORAGE_KEY, fallback)];
    const idx = list.findIndex((t) => t.id === taskId || t.backendId === taskId || t.cuid === taskId || t.taskCode === taskId);
    if (idx === -1) throw new Error(`Task '${taskId}' not found.`);

    const task = list[idx];
    const targetId = task.backendId || task.cuid || task.id;
    let deletedRecord = null;

    if (typeof window !== 'undefined' && apiClient?.delete) {
      const res = await apiClient.delete(`/tasks/${targetId}`, {
        body: { reason: trimmedReason }
      });
      deletedRecord = res?.data || res;
    } else if (!isTest) {
      throw new Error('Backend API client is unavailable.');
    }

    const updatedActiveList = list.filter((_, i) => i !== idx);
    this._setItem(STORAGE_KEY, updatedActiveList);

    const history = [...this._getItem('isysware_hrms_f07_task_history_v1', [])];
    history.unshift({
      ...task,
      status: 'Cancelled',
      isDeleted: true,
      lifecycleState: 'DELETED',
      actorName: actorUser?.name || 'Authorized Admin',
      actorRole: role,
      reason: trimmedReason,
      actionTimestamp: deletedRecord?.attachments?.deletedAt || new Date().toISOString()
    });
    this._setItem('isysware_hrms_f07_task_history_v1', history);
    this._notify();
    return deletedRecord || { id: targetId, deleted: true };
  }

  /**
   * Cancel department-scoped task with mandatory reason (Department Manager, HR Admin, Super Admin)
   */
  async cancelTaskAsync(taskId, reason, actorUser = null) {
    const role = String(actorUser?.role || '').toUpperCase();
    const isManager = role === 'MANAGER' || role === 'DEPT_MANAGER';
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'MANAGER'].includes(role)) {
      throw new Error('You are not authorized to cancel tasks.');
    }
    const trimmedReason = String(reason || '').trim();
    if (trimmedReason.length < 3) {
      throw new Error('Cancellation reason is required (minimum 3 characters).');
    }

    const fallback = isTest ? INITIAL_TASKS : [];
    const list = [...this._getItem(STORAGE_KEY, fallback)];
    const idx = list.findIndex((t) => t.id === taskId || t.backendId === taskId || t.cuid === taskId || t.taskCode === taskId);
    if (idx === -1) throw new Error(`Task '${taskId}' not found.`);

    const task = { ...list[idx] };
    if (isManager && actorUser?.departmentId && task.departmentId && task.departmentId !== actorUser.departmentId) {
      throw new Error('Department Managers can only cancel tasks within their own department.');
    }

    const targetId = task.backendId || task.cuid || task.id;
    let updatedBackend = null;

    if (typeof window !== 'undefined' && apiClient?.patch) {
      const res = await apiClient.patch(`/tasks/${targetId}/cancel`, {
        reason: trimmedReason
      });
      updatedBackend = res?.data || res;
    } else if (!isTest) {
      throw new Error('Backend API client is unavailable.');
    }

    task.status = 'Cancelled';
    task.cancellationReason = trimmedReason;
    list[idx] = task;
    this._setItem(STORAGE_KEY, list);
    this._notify();
    return updatedBackend || task;
  }

  /**
   * Fetch deleted & cancelled task audit history from backend
   */
  async getTaskHistoryAsync() {
    if (typeof window !== 'undefined' && apiClient?.get) {
      const res = await apiClient.get('/tasks/history');
      const rows = Array.isArray(res) ? res : (res?.data || []);
      return rows;
    }
    return this._getItem('isysware_hrms_f07_task_history_v1', []);
  }
}

export const taskService = new TaskService();
export default taskService;
