import React, { useState, useEffect } from 'react';
import performanceService from '../../services/performanceService';

export default function DevelopmentPlanModal({
  isOpen,
  onClose,
  plan = null,
  employees = [],
  currentUser,
  canManage = false,
  onSaved
}) {
  const isNew = !plan?.id;
  const activeEmployees = employees.filter(
    (e) => String(e?.status || e?.employmentStatus || '').toUpperCase() === 'ACTIVE'
  );
  const myEmpIds = new Set([currentUser?.employeeId, currentUser?.id].filter(Boolean));
  const isTargetEmployee = Boolean(
    plan && (myEmpIds.has(plan.employeeId) || myEmpIds.has(plan.employeeCuid))
  );
  const isClosed = Boolean(plan?.closedAt || ['COMPLETED', 'CANCELLED'].includes(String(plan?.status || '').toUpperCase()));
  const canEditGovernance = (isNew || (canManage && (!isTargetEmployee || ['SUPER_ADMIN', 'HR_ADMIN'].includes(String(currentUser?.role || '').toUpperCase())))) && !isClosed;

  const [detail, setDetail] = useState(plan);
  const [employeeId, setEmployeeId] = useState(plan?.employeeCuid || plan?.employeeId || '');
  const [mentorId, setMentorId] = useState(plan?.mentorCuid || plan?.mentorId || '');
  const [title, setTitle] = useState(plan?.title || '');
  const [goalsSummary, setGoalsSummary] = useState(plan?.goalsSummary || '');
  const [recommendedTraining, setRecommendedTraining] = useState(plan?.recommendedTraining || '');
  const [startDate, setStartDate] = useState(plan?.startDate || new Date().toISOString().slice(0, 10));
  const [targetEndDate, setTargetEndDate] = useState(
    plan?.targetEndDate || new Date(Date.now() + 86400000 * 60).toISOString().slice(0, 10)
  );
  const [checkpoints, setCheckpoints] = useState(
    Array.isArray(plan?.checkpoints) && plan.checkpoints.length > 0
      ? plan.checkpoints
      : [{ title: '', dueDate: '', completed: false }]
  );
  const [closureNotes, setClosureNotes] = useState('');
  const [showCloseBox, setShowCloseBox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setShowCloseBox(false);
    setClosureNotes('');
    setDetail(plan);
    setEmployeeId(plan?.employeeCuid || plan?.employeeId || '');
    setMentorId(plan?.mentorCuid || plan?.mentorId || '');
    setTitle(plan?.title || '');
    setGoalsSummary(plan?.goalsSummary || '');
    setRecommendedTraining(plan?.recommendedTraining || '');
    setStartDate(plan?.startDate || new Date().toISOString().slice(0, 10));
    setTargetEndDate(plan?.targetEndDate || new Date(Date.now() + 86400000 * 60).toISOString().slice(0, 10));
    setCheckpoints(
      Array.isArray(plan?.checkpoints) && plan.checkpoints.length > 0
        ? plan.checkpoints.map((c) => ({ ...c }))
        : [{ title: '', dueDate: '', completed: false }]
    );

    if (plan?.id) {
      performanceService.getDevelopmentPlanByIdAsync(plan.id)
        .then((full) => {
          if (full) {
            setDetail(full);
            if (Array.isArray(full.checkpoints) && full.checkpoints.length > 0) {
              setCheckpoints(full.checkpoints.map((c) => ({ ...c })));
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, plan]);

  if (!isOpen) return null;

  const handleCheckpointChange = (idx, field, val) => {
    setCheckpoints((prev) => prev.map((cp, i) => (i === idx ? { ...cp, [field]: val } : cp)));
  };

  const handleAddCheckpoint = () => {
    setCheckpoints((prev) => [...prev, { title: '', dueDate: targetEndDate, completed: false }]);
  };

  const handleRemoveCheckpoint = (idx) => {
    setCheckpoints((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const cleanCheckpoints = checkpoints
      .map((c) => ({ ...c, title: String(c.title || '').trim() }))
      .filter((c) => c.title.length > 0);

    if (isNew && !employeeId) {
      setError('Please select an employee.');
      return;
    }
    if (!title.trim()) {
      setError('Plan title is required.');
      return;
    }
    if (!goalsSummary.trim() && cleanCheckpoints.length === 0) {
      setError('Enter development goals or at least one milestone checkpoint.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isNew) {
        await performanceService.createDevelopmentPlanAsync({
          planCategory: 'IDP',
          employeeId,
          mentorId: mentorId || null,
          title: title.trim(),
          goalsSummary: goalsSummary.trim(),
          recommendedTraining: recommendedTraining.trim(),
          startDate,
          targetEndDate,
          checkpoints: cleanCheckpoints
        });
      } else if (canEditGovernance) {
        await performanceService.updateDevelopmentPlanAsync(plan.id, {
          mentorId: mentorId || null,
          title: title.trim(),
          goalsSummary: goalsSummary.trim(),
          recommendedTraining: recommendedTraining.trim(),
          startDate,
          targetEndDate,
          checkpoints: cleanCheckpoints
        });
      } else if (isTargetEmployee) {
        await performanceService.updateDevelopmentPlanAsync(plan.id, {
          checkpoints: cleanCheckpoints
        });
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save development plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseIdp = async (outcome) => {
    if (!plan?.id) return;
    if (!closureNotes.trim()) {
      setError('Completion / closure notes are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      await performanceService.closePlanAsync(plan.id, {
        closureOutcome: outcome,
        closureNotes: closureNotes.trim()
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to complete development plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const completedCount = checkpoints.filter((c) => c.completed && String(c.title || '').trim()).length;
  const totalCount = checkpoints.filter((c) => String(c.title || '').trim()).length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (detail?.progressPercent || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">IDP</span>
              <h3 className="text-sm font-bold text-navy-950">
                {isNew ? 'Create Individual Development Plan' : `${detail?.planCode || plan.planCode} — ${detail?.title || plan.title}`}
              </h3>
              {!isNew && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                  {detail?.status || plan.status} ({pct}%)
                </span>
              )}
            </div>
            {!isNew && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Employee: <strong>{detail?.employeeName}</strong> • Mentor: <strong>{detail?.mentorName}</strong>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm px-2 py-1">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  required
                >
                  <option value="">Select Employee...</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.cuid || emp.id} value={emp.cuid || emp.id}>
                      {emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()} ({emp.employeeCode || emp.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={isNew ? '' : 'md:col-span-2'}>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Mentor / Coach</label>
              <select
                value={mentorId || ''}
                onChange={(e) => setMentorId(e.target.value)}
                disabled={!canEditGovernance}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-50"
              >
                <option value="">No mentor assigned</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.cuid || emp.id} value={emp.cuid || emp.id}>
                    {emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()} ({emp.employeeCode || emp.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <label className="block font-semibold text-slate-700 mb-1">Plan Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEditGovernance}
                placeholder="e.g., Cloud Architecture Growth Track"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!canEditGovernance}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Deadline *</label>
              <input
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                disabled={!canEditGovernance}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Development Goals Summary</label>
              <textarea
                rows={2}
                value={goalsSummary}
                onChange={(e) => setGoalsSummary(e.target.value)}
                disabled={!canEditGovernance}
                placeholder="Core skills, competencies, or career progression objectives..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recommended Training / Courses</label>
              <textarea
                rows={2}
                value={recommendedTraining}
                onChange={(e) => setRecommendedTraining(e.target.value)}
                disabled={!canEditGovernance}
                placeholder="Optional courses, workshops, certifications..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Milestones & Checkpoints */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Milestones & Checkpoints ({completedCount}/{totalCount} Complete)
              </label>
              {canEditGovernance && (
                <button
                  type="button"
                  onClick={handleAddCheckpoint}
                  className="text-[11px] font-semibold text-navy-700 hover:text-navy-950"
                >
                  + Add Milestone
                </button>
              )}
            </div>

            <div className="space-y-2">
              {checkpoints.map((cp, idx) => (
                <div key={cp.id || idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  {!isNew && (
                    <input
                      type="checkbox"
                      checked={Boolean(cp.completed)}
                      disabled={isClosed}
                      onChange={(e) => handleCheckpointChange(idx, 'completed', e.target.checked)}
                      className="rounded text-navy-950"
                    />
                  )}
                  <input
                    type="text"
                    value={cp.title || ''}
                    onChange={(e) => handleCheckpointChange(idx, 'title', e.target.value)}
                    disabled={!canEditGovernance}
                    placeholder={`Milestone #${idx + 1}`}
                    className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                  />
                  <input
                    type="date"
                    value={cp.dueDate || ''}
                    onChange={(e) => handleCheckpointChange(idx, 'dueDate', e.target.value)}
                    disabled={!canEditGovernance}
                    className="px-2 py-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                  />
                  {canEditGovernance && checkpoints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCheckpoint(idx)}
                      className="text-rose-500 hover:text-rose-700 px-1.5"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Close / Complete IDP section */}
          {!isNew && showCloseBox && canManage && !isTargetEmployee && !isClosed && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="font-bold text-emerald-900">Complete & Close Development Plan</div>
              <textarea
                rows={2}
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                placeholder="Mandatory summary of achievements or reason for closing..."
                className="w-full px-3 py-2 border border-emerald-300 rounded-lg bg-white text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseBox(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCloseIdp('CANCELLED')}
                  className="px-3 py-1.5 rounded bg-slate-600 text-white font-semibold hover:bg-slate-700"
                >
                  Cancel Plan
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCloseIdp('SUCCESSFULLY_COMPLETED')}
                  className="px-3 py-1.5 rounded bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
                >
                  Mark Plan Completed
                </button>
              </div>
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

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <div>
              {!isNew && canManage && !isTargetEmployee && !isClosed && !showCloseBox && (
                <button
                  type="button"
                  onClick={() => setShowCloseBox(true)}
                  className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-800 bg-emerald-50 font-semibold hover:bg-emerald-100"
                >
                  Complete / Close Plan
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Close
              </button>
              {(isNew || canEditGovernance || (isTargetEmployee && !isClosed)) && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-navy-950 text-white font-semibold hover:bg-navy-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : isNew ? 'Create Development Plan' : 'Save Progress & Changes'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

