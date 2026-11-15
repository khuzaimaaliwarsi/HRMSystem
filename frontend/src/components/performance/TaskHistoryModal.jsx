import React, { useEffect, useState } from 'react';
import taskService from '../../services/taskService';

export default function TaskHistoryModal({ isOpen, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError('');
    taskService.getTaskHistoryAsync()
      .then((rows) => {
        if (active) setRecords(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Failed to load task audit history.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[82vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-clock-rotate-left text-slate-300"></i>
            <div>
              <h3 className="text-sm font-bold">Deleted & Cancelled Task Audit History</h3>
              <p className="text-[11px] text-slate-300">PostgreSQL-preserved soft-deleted and cancelled deliverables</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-3">
          {loading && <div className="py-8 text-center text-slate-500">Loading archived task history...</div>}
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}
          {!loading && !error && records.length === 0 && (
            <div className="py-8 text-center text-slate-400">No deleted or cancelled tasks recorded yet.</div>
          )}
          {!loading && !error && records.map((rec) => (
            <div key={rec.id || rec.taskCode} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-navy-950">
                  {rec.title} <span className="font-mono text-[11px] text-slate-400 font-normal">({rec.taskCode || rec.id})</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  rec.lifecycleState === 'DELETED'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {rec.lifecycleState === 'DELETED' ? 'Deleted / Archived' : 'Cancelled'}
                </span>
              </div>
              <div className="text-[11px] text-slate-600">
                <span className="font-semibold">Reason:</span> {rec.reason || '—'}
              </div>
              <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                <span><strong className="text-slate-700">Actor:</strong> {rec.actorName || '—'} ({rec.actorRole || '—'})</span>
                <span><strong className="text-slate-700">Timestamp:</strong> {rec.actionTimestamp ? new Date(rec.actionTimestamp).toLocaleString() : '—'}</span>
                <span><strong className="text-slate-700">Comments Preserved:</strong> {Array.isArray(rec.comments) ? rec.comments.length : 0}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-navy-950 text-white rounded-lg hover:bg-navy-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

