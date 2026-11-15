import React, { useState, useEffect } from 'react';
import performanceService from '../../services/performanceService';

const FEEDBACK_TYPES = [
  { value: 'POSITIVE', label: 'Positive Recognition' },
  { value: 'CONSTRUCTIVE', label: 'Constructive Coaching' },
  { value: 'CHECK_IN', label: 'Regular Check-In' },
  { value: 'COACHING', label: 'Skill Coaching' },
  { value: 'RECOGNITION', label: 'Peer / Star Recognition' }
];

export default function FeedbackModal({
  isOpen,
  onClose,
  feedback = null,
  employees = [],
  currentUser,
  canManage = false,
  onSaved
}) {
  const isNew = !feedback?.id;
  const activeEmployees = employees.filter(
    (e) => String(e?.status || e?.employmentStatus || '').toUpperCase() === 'ACTIVE'
  );
  const myEmpIds = new Set([currentUser?.employeeId, currentUser?.id].filter(Boolean));
  const isTargetEmployee = Boolean(
    feedback && (myEmpIds.has(feedback.employeeId) || myEmpIds.has(feedback.employeeCuid))
  );
  const canEditManagerFields = canManage && !isTargetEmployee && feedback?.status !== 'ARCHIVED';

  const [detail, setDetail] = useState(feedback);
  const [employeeId, setEmployeeId] = useState(feedback?.employeeCuid || feedback?.employeeId || '');
  const [feedbackType, setFeedbackType] = useState(feedback?.feedbackType || 'CONSTRUCTIVE');
  const [title, setTitle] = useState(feedback?.title || '');
  const [strengths, setStrengths] = useState(feedback?.strengths || '');
  const [improvementAreas, setImprovementAreas] = useState(feedback?.improvementAreas || '');
  const [managerComments, setManagerComments] = useState(feedback?.managerComments || '');
  const [employeeResponse, setEmployeeResponse] = useState(feedback?.employeeResponse || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setDetail(feedback);
    setEmployeeId(feedback?.employeeCuid || feedback?.employeeId || '');
    setFeedbackType(feedback?.feedbackType || 'CONSTRUCTIVE');
    setTitle(feedback?.title || '');
    setStrengths(feedback?.strengths || '');
    setImprovementAreas(feedback?.improvementAreas || '');
    setManagerComments(feedback?.managerComments || '');
    setEmployeeResponse(feedback?.employeeResponse || '');

    if (feedback?.id) {
      performanceService.getFeedbackByIdAsync(feedback.id)
        .then((full) => {
          if (full) setDetail(full);
        })
        .catch(() => {});
    }
  }, [isOpen, feedback]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (isNew && !employeeId) {
      setError('Please select an active employee.');
      return;
    }
    if (!title.trim()) {
      setError('Feedback title / subject is required.');
      return;
    }
    if (!strengths.trim() && !improvementAreas.trim() && !managerComments.trim()) {
      setError('Provide at least strengths, improvement areas, or manager comments.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isNew) {
        await performanceService.createFeedbackAsync({
          employeeId,
          feedbackType,
          title: title.trim(),
          strengths: strengths.trim(),
          improvementAreas: improvementAreas.trim(),
          managerComments: managerComments.trim()
        });
      } else {
        await performanceService.updateFeedbackAsync(feedback.id, {
          feedbackType,
          title: title.trim(),
          strengths: strengths.trim(),
          improvementAreas: improvementAreas.trim(),
          managerComments: managerComments.trim()
        });
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!feedback?.id) return;
    setError('');
    try {
      setIsSubmitting(true);
      await performanceService.acknowledgeFeedbackAsync(feedback.id, employeeResponse.trim());
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to acknowledge feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStatus = detail?.status || feedback?.status || 'SHARED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-navy-950">
                {isNew ? 'Give Employee Feedback' : `Feedback Record (${detail?.feedbackCode || feedback.feedbackCode})`}
              </h3>
              {!isNew && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  currentStatus === 'ACKNOWLEDGED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentStatus === 'ARCHIVED'
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-blue-100 text-blue-800'
                }`}>
                  {currentStatus}
                </span>
              )}
            </div>
            {!isNew && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Employee: <strong>{detail?.employeeName}</strong> ({detail?.employeeId}) • By: <strong>{detail?.authorName}</strong>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm px-2 py-1">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {isNew && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Employee *</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-navy-500 outline-none"
                  required
                >
                  <option value="">Select Employee...</option>
                  {activeEmployees
                    .filter((e) => !myEmpIds.has(e.id) && !myEmpIds.has(e.cuid))
                    .map((emp) => (
                      <option key={emp.cuid || emp.id} value={emp.cuid || emp.id}>
                        {emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()} ({emp.employeeCode || emp.id})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className={isNew ? '' : 'md:col-span-2'}>
              <label className="block font-semibold text-slate-700 mb-1">Feedback Category</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                disabled={!canEditManagerFields && !isNew}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-50"
              >
                {FEEDBACK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Subject / Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEditManagerFields && !isNew}
              placeholder="e.g., Q4 Architecture Delivery & Code Review Feedback"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-emerald-800 mb-1">Observed Strengths</label>
              <textarea
                rows={3}
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                disabled={!canEditManagerFields && !isNew}
                placeholder="Key wins, strengths, and positive behaviors..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-amber-800 mb-1">Improvement Areas</label>
              <textarea
                rows={3}
                value={improvementAreas}
                onChange={(e) => setImprovementAreas(e.target.value)}
                disabled={!canEditManagerFields && !isNew}
                placeholder="Constructive growth recommendations..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Manager Comments & Follow-Up</label>
            <textarea
              rows={2}
              value={managerComments}
              onChange={(e) => setManagerComments(e.target.value)}
              disabled={!canEditManagerFields && !isNew}
              placeholder="Summary notes and coaching action items..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
            />
          </div>

          {/* Employee Acknowledgement Section */}
          {!isNew && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Employee Acknowledgement & Reflection
                </span>
                {detail?.acknowledgedAt && (
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    Acknowledged: {detail.acknowledgedAt}
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                value={employeeResponse}
                onChange={(e) => setEmployeeResponse(e.target.value)}
                disabled={!isTargetEmployee || currentStatus === 'ACKNOWLEDGED'}
                placeholder={isTargetEmployee ? 'Optional reflection or acknowledgement note...' : 'Awaiting employee response...'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-100"
              />
            </div>
          )}

          {/* Audit History */}
          {!isNew && Array.isArray(detail?.auditHistory) && detail.auditHistory.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Audit History
              </h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {detail.auditHistory.map((log) => (
                  <div key={log.id} className="text-[11px] bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 flex justify-between gap-2">
                    <span className="text-slate-700">
                      <strong>{log.actionType}</strong> — {log.reasonOrNotes} ({log.actorRole})
                    </span>
                    <span className="text-slate-400 font-mono shrink-0">
                      {String(log.createdAt).slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
            >
              Close
            </button>
            {isTargetEmployee && currentStatus !== 'ACKNOWLEDGED' && !isNew && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleAcknowledge}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Acknowledge Feedback'}
              </button>
            )}
            {(isNew || canEditManagerFields) && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-navy-950 text-white font-semibold hover:bg-navy-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : isNew ? 'Share Feedback' : 'Save Updates'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

