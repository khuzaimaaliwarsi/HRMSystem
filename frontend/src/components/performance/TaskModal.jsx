import React, { useState, useEffect } from 'react';
import { employeeService } from '../../services/employeeService'; import taskService from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';

export default function TaskModal({ isOpen, onClose, task = null, employees = [], onTaskSaved }) {
  const { currentUser } = useAuth();
  const isEditing = !!task;

  const [directoryEmployees, setDirectoryEmployees] = useState(
    () => employeeService.getEmployees() || []
  );

  useEffect(() => {
    const refreshEmployees = () => {
      setDirectoryEmployees(employeeService.getEmployees() || []);
    };

    refreshEmployees();
    const unsubscribe = employeeService.subscribe(refreshEmployees);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const activeEmployees = (directoryEmployees.length
    ? directoryEmployees
    : employees
  ).filter(emp =>
    String(emp.status || '').toUpperCase() === 'ACTIVE' ||
    emp.employmentStatus === 'ACTIVE'
  );

  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    departmentId: task?.departmentId || '',
    department: task?.department || '',
    assignedToId: task?.assignedToId || '', priority: task?.priority || 'Medium',
    status: task?.status || 'To Do',
    progress: task?.progress !== undefined ? task.progress : 0,
    estimatedHours: task?.estimatedHours || 16,
    startDate: task?.startDate || new Date().toISOString().slice(0, 10),
    dueDate: task?.dueDate || new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    projectRef: task?.projectRef || ''
  });

  const [newComment, setNewComment] = useState('');
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canVerifyCompletion = ['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'MANAGER', 'TEAM_LEAD']
    .includes(String(currentUser?.role || '').toUpperCase());

  if (!isOpen) return null;

  const handleSubmitForReview = async () => {
    try {
      setError('');
      setIsSubmitting(true);
      await taskService.submitTaskForReviewAsync(task.id, newComment, currentUser);
      setNewComment('');
      setSuccess('Task submitted at 100% for Manager/Admin verification.');
      setTimeout(() => {
        onTaskSaved?.();
        onClose();
      }, 450);
    } catch (err) {
      setError(err.message || 'Failed to submit task for review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyTask = async (action) => {
    try {
      setError('');
      setIsSubmitting(true);
      await taskService.verifyTaskCompletionAsync(task.id, action, verificationRemarks, currentUser);
      setSuccess(
        action === 'APPROVE'
          ? 'Task verified and marked Completed (100%).'
          : 'Revision requested — task returned to In Progress.'
      );
      setTimeout(() => {
        onTaskSaved?.();
        onClose();
      }, 450);
    } catch (err) {
      setError(err.message || 'Verification action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.title.trim()) {
      setError('Task title is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing) {
        await taskService.updateTaskProgressAsync(task.id, formData.progress, formData.status, currentUser);
        if (newComment.trim()) {
          await taskService.addTaskCommentAsync(task.id, newComment, currentUser);
        }
        setSuccess('Task updated successfully.');
      } else {
        const assignedEmp = activeEmployees.find(
          e => String(e.id) === String(formData.assignedToId)
        );

        if (!assignedEmp) {
          setError('Please select an active employee.');
          return;
        } await taskService.createTaskAsync(
          {
            ...formData,
            assignedToName: assignedEmp?.name || formData.assignedToId,
            department: assignedEmp?.department || formData.department
          },
          currentUser
        );
        setSuccess('Task created and assigned successfully.');
      }

      setTimeout(() => {
        onTaskSaved?.();
        onClose();
      }, 500);
    } catch (err) {
      setError(err.message || 'Failed to save task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCommentOnly = async () => {
    if (!newComment.trim() || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await taskService.addTaskCommentAsync(task.id, newComment, currentUser);
      setNewComment('');
      onTaskSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full my-6 overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold">
              {isEditing ? `Task Details: ${task.id}` : 'Create New Deliverable / Task'}
            </h3>
            <p className="text-xs text-slate-300">Department task lifecycle & accountability</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-check"></i>
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Task Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              disabled={isEditing && currentUser?.role === 'employee'}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Implement Responsive Payroll Sheets"
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description & Acceptance Criteria</label>
            <textarea
              rows="3"
              disabled={isEditing && currentUser?.role === 'employee'}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of what is expected..."
              className="w-full text-xs border border-slate-300 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            ></textarea>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Employee</label>

              <select
                disabled={isEditing && currentUser?.role === 'employee'}
                value={formData.assignedToId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    assignedToId: e.target.value
                  })
                }
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="">Select Employee</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.cuid || emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeCode || emp.id}) — {emp.department}
                  </option>
                ))}
              </select>

            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                disabled={isEditing && currentUser?.role === 'employee'}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estimated Hours</label>
              <input
                type="number"
                min="1"
                disabled={isEditing && currentUser?.role === 'employee'}
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                disabled={isEditing && currentUser?.role === 'employee'}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                disabled={isEditing && currentUser?.role === 'employee'}
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Status & Progress Bar */}
          {isEditing && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => {
                      const newSt = e.target.value;
                      const safeStatus = newSt === 'Completed' && !canVerifyCompletion ? 'In Review' : newSt;
                      setFormData({
                        ...formData,
                        status: safeStatus,
                        progress: safeStatus === 'Completed' ? 100 : formData.progress
                      });
                    }}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-bold text-navy-950"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    {canVerifyCompletion && (
                      <option value="Completed">Completed (Verified 100%)</option>
                    )}
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Progress Percentage ({formData.progress}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={formData.progress}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setFormData({
                        ...formData,
                        progress: p,
                        status: p === 100
                          ? (formData.status === 'Completed' && canVerifyCompletion ? 'Completed' : 'In Review')
                          : (p > 0 && ['To Do', 'Completed', 'In Review'].includes(formData.status)
                            ? 'In Progress'
                            : formData.status)
                      });
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
                  />
                </div>
              </div>

              {/* 100% Submission / Manager Verification Controls */}
              {!canVerifyCompletion && formData.progress === 100 && formData.status !== 'Completed' && (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between gap-2">
                  <div className="text-[11px] text-purple-900">
                    <span className="font-bold">Work at 100%:</span> Submit for Manager/Admin verification to mark Completed.
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSubmitForReview}
                    className="px-2.5 py-1 text-[11px] font-bold bg-purple-700 hover:bg-purple-800 text-white rounded shrink-0"
                  >
                    Submit for Review
                  </button>
                </div>
              )}

              {canVerifyCompletion && (formData.status === 'In Review' || task.status === 'In Review') && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                  <div className="text-[11px] font-bold text-emerald-900">
                    Pending Completion Verification (100% Deliverable Review)
                  </div>
                  <input
                    type="text"
                    placeholder="Optional verification remarks or revision feedback..."
                    value={verificationRemarks}
                    onChange={(e) => setVerificationRemarks(e.target.value)}
                    className="w-full text-[11px] border border-emerald-200 rounded px-2.5 py-1.5 bg-white"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleVerifyTask('APPROVE')}
                      className="px-3 py-1 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded"
                    >
                      Approve & Mark Completed
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleVerifyTask('REVISION')}
                      className="px-3 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded"
                    >
                      Request Revision
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity / Comments Log */}
          {isEditing && task.comments && task.comments.length > 0 && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Activity & Discussion Log</label>
              <div className="space-y-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                {task.comments.map((c) => (
                  <div key={c.id} className="text-[11px] p-2 bg-white rounded border border-slate-100">
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span className="font-bold text-slate-700">{c.author}</span>
                      <span>{c.date}</span>
                    </div>
                    <div className="text-slate-800 mt-1">{c.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEditing && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Add Comment</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type an update or comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCommentOnly}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg"
                >
                  Post
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-1.5 font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm flex items-center gap-1.5 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
              {isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
