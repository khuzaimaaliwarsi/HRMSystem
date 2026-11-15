import React, { useState } from 'react';

export default function TaskTable({
  tasks = [],
  onUpdateProgress,
  onOpenTask,
  onAddTask,
  onDeleteTask,
  onCancelTask,
  onViewHistory,
  canCreate = true,
  canDelete = false,
  canCancel = false
}) {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTasks = tasks.filter((task) => {
    if (filterStatus !== 'ALL' && String(task.status || '').toLowerCase() !== filterStatus.toLowerCase()) return false;
    if (filterPriority !== 'ALL' && String(task.priority || '').toLowerCase() !== filterPriority.toLowerCase()) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchTitle = String(task.title || '').toLowerCase().includes(q);
      const matchEmp = String(task.assignedToName || '').toLowerCase().includes(q);
      const matchDept = String(task.department || '').toLowerCase().includes(q);
      if (!matchTitle && !matchEmp && !matchDept) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Search tasks, assignees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 w-full"
            />
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="In Review">In Review</option>
              <option value="Completed">Completed</option>
              <option value="Blocked">Blocked</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onViewHistory && (canDelete || canCancel) && (
            <button
              type="button"
              onClick={onViewHistory}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all flex items-center gap-1.5"
              title="View Deleted & Cancelled Task History"
            >
              <i className="fa-solid fa-clock-rotate-left text-slate-500"></i>
              Audit History
            </button>
          )}
          {canCreate && (
            <button
              onClick={onAddTask}
              className="px-3.5 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-plus"></i>
              Create New Task
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4">Task Details</th>
                <th className="py-2.5 px-4">Assignee</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Priority</th>
                <th className="py-2.5 px-4">Due Date</th>
                <th className="py-2.5 px-4 w-40">Progress</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No tasks match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-navy-950 hover:text-blue-600 cursor-pointer" onClick={() => onOpenTask?.(task)}>
                        {task.title}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{task.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{task.id} • Ref: {task.projectRef}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{task.assignedToName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{task.assignedToId}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{task.department}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${task.priority === 'Urgent'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : task.priority === 'High'
                          ? 'bg-amber-100 text-amber-800'
                          : task.priority === 'Medium'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      <div>{task.dueDate || '—'}</div>
                      {task.isOverdue && (
                        <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                          <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${task.progress === 100
                              ? 'bg-emerald-500'
                              : task.progress >= 50
                                ? 'bg-navy-900'
                                : 'bg-amber-500'
                              }`}

                            style={{
                              width: `${task.status === 'Completed' ? 100 : task.progress}%`
                            }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-700 min-w-[32px]">
                          {task.status === 'Completed' ? 100 : task.progress}%
                        </span>
                      </div>

                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${task.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : task.status === 'In Review'
                          ? 'bg-purple-100 text-purple-800'
                          : task.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : task.status === 'Cancelled'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                        }`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {task.status !== 'Completed' && task.status !== 'Cancelled' && task.status !== 'In Review' && task.progress < 100 && onUpdateProgress && (
                          <button
                            onClick={() => onUpdateProgress(task, Math.min(100, task.progress + 25))}
                            title="Quick +25% Progress (100% moves to In Review)"
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                          >
                            +25%
                          </button>
                        )}
                        <button
                          onClick={() => onOpenTask?.(task)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-navy-950 hover:bg-navy-900 text-white rounded transition-colors flex items-center gap-1"
                        >
                          <i className="fa-solid fa-eye"></i>
                          Details
                        </button>
                        {canDelete && onDeleteTask && (
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task)}
                            title="Delete Task"
                            className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded transition-colors flex items-center gap-1"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                            Delete
                          </button>
                        )}
                        {!canDelete && canCancel && onCancelTask && task.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => onCancelTask(task)}
                            title="Cancel Department Task"
                            className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-200 hover:border-amber-600 rounded transition-colors flex items-center gap-1"
                          >
                            <i className="fa-solid fa-ban"></i>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
