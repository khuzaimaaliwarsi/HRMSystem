import React, { useState, useEffect } from 'react';

export default function TaskDeleteModal({
  isOpen,
  onClose,
  task,
  mode = 'delete',
  onConfirm
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const isCancelMode = mode === 'cancel';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError(`Please provide a ${isCancelMode ? 'cancellation' : 'deletion'} reason (at least 3 characters).`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onConfirm(task, trimmed);
      onClose();
    } catch (err) {
      setError(err?.message || `Failed to ${isCancelMode ? 'cancel' : 'delete'} task.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        <div className={`px-6 py-4 text-white flex justify-between items-center ${isCancelMode ? 'bg-amber-700' : 'bg-rose-700'}`}>
          <div className="flex items-center gap-2.5">
            <i className={`fa-solid ${isCancelMode ? 'fa-ban' : 'fa-trash-can'} text-base`}></i>
            <div>
              <h3 className="text-sm font-bold">
                {isCancelMode ? 'Cancel Department Task' : 'Delete Task'}
              </h3>
              <p className="text-[11px] text-white/80">
                {isCancelMode
                  ? 'Department Manager cancellation with audit trail'
                  : 'Soft-archive removal preserving PostgreSQL audit history'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Target Task</div>
            <div className="font-bold text-navy-950 text-sm">{task.title}</div>
            <div className="text-[11px] text-slate-500 font-mono">
              {task.taskCode || task.id} • Assignee: {task.assignedToName}
            </div>
          </div>

          <div className={`p-2.5 rounded-lg border text-[11px] ${isCancelMode ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {isCancelMode
              ? 'This will mark the department task as Cancelled and log your reason in PostgreSQL audit history.'
              : 'This task will be removed from active task lists while preserving comments, actor attribution, and timestamps in audit history.'}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {isCancelMode ? 'Cancellation Reason' : 'Deletion Reason'} <span className="text-red-500">*</span>
            </label>
            <textarea
              rows="3"
              required
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Enter mandatory ${isCancelMode ? 'cancellation' : 'deletion'} reason...`}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5 ${
                isCancelMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
              } disabled:opacity-60`}
            >
              <i className={`fa-solid ${isCancelMode ? 'fa-ban' : 'fa-trash-can'}`}></i>
              {isSubmitting
                ? (isCancelMode ? 'Cancelling...' : 'Deleting...')
                : (isCancelMode ? 'Confirm Cancel Task' : 'Confirm Delete')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

