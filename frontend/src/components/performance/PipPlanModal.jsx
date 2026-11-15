import React, { useState, useEffect } from 'react';
import performanceService from '../../services/performanceService';

const PIP_OUTCOMES = [
  { value: 'SUCCESSFULLY_COMPLETED', label: 'Successfully Completed (Met Targets)' },
  { value: 'EXTENDED', label: 'Extend PIP Review Period' },
  { value: 'REASSIGNED', label: 'Role Reassignment / Transfer' },
  { value: 'UNMET_ESCALATED', label: 'Unmet Targets — Escalate to HR Action' },
  { value: 'CANCELLED', label: 'Cancel / Withdraw PIP' }
];

export default function PipPlanModal({
  isOpen,
  onClose,
  plan = null,
  employees = [],
  currentUser,
  canManage = false,
  canClose = false,
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
  const isClosed = Boolean(
    plan?.closedAt ||
    ['COMPLETED_SUCCESS', 'ESCALATED_TERMINATION', 'CLOSED_UNMET', 'CANCELLED'].includes(
      String(plan?.status || '').toUpperCase()
    )
  );
  const canEditPipDetails = (isNew || (canManage && !isTargetEmployee)) && !isClosed;

  const [detail, setDetail] = useState(plan);
  const [employeeId, setEmployeeId] = useState(plan?.employeeCuid || plan?.employeeId || '');
  const [mentorId, setMentorId] = useState(plan?.mentorCuid || plan?.mentorId || '');
  const [title, setTitle] = useState(plan?.title || '');
  const [documentedConcerns, setDocumentedConcerns] = useState(plan?.documentedConcerns || '');
  const [reviewFrequency, setReviewFrequency] = useState(plan?.reviewFrequency || 'BIWEEKLY');
  const [startDate, setStartDate] = useState(plan?.startDate || new Date().toISOString().slice(0, 10));
  const [targetEndDate, setTargetEndDate] = useState(
    plan?.targetEndDate || new Date(Date.now() + 86400000 * 45).toISOString().slice(0, 10)
  );
  const [improvementTargets, setImprovementTargets] = useState(
    Array.isArray(plan?.improvementTargets) && plan.improvementTargets.length > 0
      ? plan.improvementTargets
      : [{ area: '', metric: '', baseline: '', target: '', dueDate: '', status: 'IN_PROGRESS' }]
  );
  const [reviewSchedule, setReviewSchedule] = useState(
    Array.isArray(plan?.reviewSchedule) && plan.reviewSchedule.length > 0
      ? plan.reviewSchedule
      : [{ reviewDate: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10), focus: 'Mid-Point PIP Check-In' }]
  );

  // Evaluation state
  const [evalComments, setEvalComments] = useState('');
  const [evalRating, setEvalRating] = useState('3.0');
  const [evalAssessment, setEvalAssessment] = useState('ON_TRACK');

  // Employee acknowledgement state
  const [employeeStatement, setEmployeeStatement] = useState(plan?.employeeStatement || '');

  // Closure state
  const [closureOutcome, setClosureOutcome] = useState('SUCCESSFULLY_COMPLETED');
  const [closureNotes, setClosureNotes] = useState('');
  const [extendedEndDate, setExtendedEndDate] = useState('');
  const [activeActionTab, setActiveActionTab] = useState('overview'); // 'overview' | 'evaluate' | 'close'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setActiveActionTab('overview');
    setDetail(plan);
    setEmployeeId(plan?.employeeCuid || plan?.employeeId || '');
    setMentorId(plan?.mentorCuid || plan?.mentorId || '');
    setTitle(plan?.title || '');
    setDocumentedConcerns(plan?.documentedConcerns || '');
    setReviewFrequency(plan?.reviewFrequency || 'BIWEEKLY');
    setStartDate(plan?.startDate || new Date().toISOString().slice(0, 10));
    setTargetEndDate(plan?.targetEndDate || new Date(Date.now() + 86400000 * 45).toISOString().slice(0, 10));
    setImprovementTargets(
      Array.isArray(plan?.improvementTargets) && plan.improvementTargets.length > 0
        ? plan.improvementTargets.map((t) => ({ ...t }))
        : [{ area: '', metric: '', baseline: '', target: '', dueDate: '', status: 'IN_PROGRESS' }]
    );
    setReviewSchedule(
      Array.isArray(plan?.reviewSchedule) && plan.reviewSchedule.length > 0
        ? plan.reviewSchedule.map((r) => ({ ...r }))
        : [{ reviewDate: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10), focus: 'Mid-Point PIP Check-In' }]
    );
    setEmployeeStatement(plan?.employeeStatement || '');
    setEvalComments('');
    setClosureNotes('');

    if (plan?.id) {
      performanceService.getDevelopmentPlanByIdAsync(plan.id)
        .then((full) => {
          if (full) {
            setDetail(full);
            if (Array.isArray(full.improvementTargets) && full.improvementTargets.length > 0) {
              setImprovementTargets(full.improvementTargets.map((t) => ({ ...t })));
            }
            if (Array.isArray(full.reviewSchedule) && full.reviewSchedule.length > 0) {
              setReviewSchedule(full.reviewSchedule.map((r) => ({ ...r })));
            }
            setEmployeeStatement(full.employeeStatement || '');
          }
        })
        .catch(() => {});
    }
  }, [isOpen, plan]);

  if (!isOpen) return null;

  const updateTarget = (idx, field, val) => {
    setImprovementTargets((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t)));
  };

  const handleSavePip = async (e) => {
    e.preventDefault();
    setError('');

    const cleanTargets = improvementTargets
      .map((t) => ({
        ...t,
        area: String(t.area || '').trim(),
        metric: String(t.metric || '').trim()
      }))
      .filter((t) => t.area && t.metric);

    if (isNew && !employeeId) {
      setError('Select the employee placed on PIP.');
      return;
    }
    if (!title.trim()) {
      setError('PIP title is required.');
      return;
    }
    if (!documentedConcerns.trim()) {
      setError('Documented performance concerns are mandatory for a formal PIP.');
      return;
    }
    if (cleanTargets.length === 0) {
      setError('Add at least one measurable improvement target (Area + Metric).');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        planCategory: 'PIP',
        employeeId,
        mentorId: mentorId || null,
        title: title.trim(),
        documentedConcerns: documentedConcerns.trim(),
        reviewFrequency,
        startDate,
        targetEndDate,
        improvementTargets: cleanTargets,
        reviewSchedule: reviewSchedule.filter((r) => r.reviewDate)
      };

      if (isNew) {
        await performanceService.createDevelopmentPlanAsync(payload);
      } else {
        await performanceService.updateDevelopmentPlanAsync(plan.id, payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save PIP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEvaluation = async () => {
    setError('');
    if (!evalComments.trim()) {
      setError('Manager evaluation comments are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      await performanceService.addPlanEvaluationAsync(plan.id, {
        comments: evalComments.trim(),
        rating: Number(evalRating),
        progressAssessment: evalAssessment,
        improvementTargets
      });
      setEvalComments('');
      onSaved?.();
      const updated = await performanceService.getDevelopmentPlanByIdAsync(plan.id);
      if (updated) setDetail(updated);
      setActiveActionTab('overview');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record manager evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    setError('');
    try {
      setIsSubmitting(true);
      await performanceService.acknowledgePlanAsync(plan.id, employeeStatement.trim());
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to acknowledge PIP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePip = async () => {
    setError('');
    if (!closureNotes.trim()) {
      setError('Closure rationale / outcome notes are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      await performanceService.closePlanAsync(plan.id, {
        closureOutcome,
        closureNotes: closureNotes.trim(),
        extendedEndDate: closureOutcome === 'EXTENDED' ? extendedEndDate : undefined
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to close PIP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const evaluations = Array.isArray(detail?.managerEvaluations) ? detail.managerEvaluations : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-rose-50/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                FORMAL PIP
              </span>
              <h3 className="text-sm font-bold text-navy-950">
                {isNew ? 'Initiate Performance Improvement Plan' : `${detail?.planCode || plan.planCode} — ${detail?.title || plan.title}`}
              </h3>
              {!isNew && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-bold">
                  {detail?.status || plan.status}
                </span>
              )}
            </div>
            {!isNew && (
              <p className="text-[11px] text-slate-600 mt-0.5">
                Employee: <strong>{detail?.employeeName}</strong> ({detail?.employeeId}) • Supervisor/Mentor: <strong>{detail?.mentorName}</strong>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm px-2 py-1">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Sub-tabs inside modal when inspecting existing PIP */}
        {!isNew && (
          <div className="px-5 pt-2 border-b border-slate-200 flex gap-4 text-xs bg-slate-50">
            <button
              type="button"
              onClick={() => setActiveActionTab('overview')}
              className={`pb-2 font-semibold border-b-2 ${activeActionTab === 'overview' ? 'border-navy-950 text-navy-950' : 'border-transparent text-slate-500'}`}
            >
              Concerns & Targets
            </button>
            {canManage && !isTargetEmployee && !isClosed && (
              <button
                type="button"
                onClick={() => setActiveActionTab('evaluate')}
                className={`pb-2 font-semibold border-b-2 ${activeActionTab === 'evaluate' ? 'border-navy-950 text-navy-950' : 'border-transparent text-slate-500'}`}
              >
                Manager Evaluation ({evaluations.length})
              </button>
            )}
            {canClose && !isTargetEmployee && !isClosed && (
              <button
                type="button"
                onClick={() => setActiveActionTab('close')}
                className={`pb-2 font-semibold border-b-2 ${activeActionTab === 'close' ? 'border-rose-700 text-rose-800' : 'border-transparent text-slate-500'}`}
              >
                Closure & Outcome
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium">
              {error}
            </div>
          )}

          {activeActionTab === 'overview' && (
            <form id="pip-overview-form" onSubmit={handleSavePip} className="space-y-4">
              {detail?.closureOutcome && (
                <div className="p-3 rounded-lg bg-slate-100 border border-slate-300">
                  <div className="font-bold text-navy-950">
                    Final PIP Outcome: {detail.closureOutcome}
                  </div>
                  <p className="text-slate-700 mt-0.5">{detail.closureNotes}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Closed by {detail.closedByName || 'Admin'} at {detail.closedAt}
                  </p>
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
                  <label className="block font-semibold text-slate-700 mb-1">PIP Mentor / Reviewer</label>
                  <select
                    value={mentorId || ''}
                    onChange={(e) => setMentorId(e.target.value)}
                    disabled={!canEditPipDetails}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-50"
                  >
                    <option value="">Select Reviewer / Mentor...</option>
                    {activeEmployees.map((emp) => (
                      <option key={emp.cuid || emp.id} value={emp.cuid || emp.id}>
                        {emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()} ({emp.employeeCode || emp.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-1">
                  <label className="block font-semibold text-slate-700 mb-1">PIP Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!canEditPipDetails}
                    placeholder="e.g., Q4 SLA & Code Quality PIP"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Review Cadence</label>
                  <select
                    value={reviewFrequency}
                    onChange={(e) => setReviewFrequency(e.target.value)}
                    disabled={!canEditPipDetails}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-50"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={!canEditPipDetails}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Review Deadline *</label>
                  <input
                    type="date"
                    value={targetEndDate}
                    onChange={(e) => setTargetEndDate(e.target.value)}
                    disabled={!canEditPipDetails}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-rose-900 mb-1">Documented Performance Concerns *</label>
                <textarea
                  rows={3}
                  value={documentedConcerns}
                  onChange={(e) => setDocumentedConcerns(e.target.value)}
                  disabled={!canEditPipDetails}
                  placeholder="Specific gaps, missed SLAs, or documented examples prompting this formal PIP..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs disabled:bg-slate-50"
                  required
                />
              </div>

              {/* Measurable Improvement Targets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Measurable Improvement Targets *
                  </label>
                  {canEditPipDetails && (
                    <button
                      type="button"
                      onClick={() =>
                        setImprovementTargets((p) => [
                          ...p,
                          { area: '', metric: '', baseline: '', target: '', dueDate: targetEndDate, status: 'IN_PROGRESS' }
                        ])
                      }
                      className="text-[11px] font-semibold text-navy-700 hover:text-navy-950"
                    >
                      + Add Target
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {improvementTargets.map((t, idx) => (
                    <div key={t.id || idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 items-center">
                      <input
                        type="text"
                        value={t.area || ''}
                        onChange={(e) => updateTarget(idx, 'area', e.target.value)}
                        disabled={!canEditPipDetails}
                        placeholder="Improvement Area"
                        className="md:col-span-3 px-2 py-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                      />
                      <input
                        type="text"
                        value={t.metric || ''}
                        onChange={(e) => updateTarget(idx, 'metric', e.target.value)}
                        disabled={!canEditPipDetails}
                        placeholder="Target Metric (e.g. < 2 bugs/sprint)"
                        className="md:col-span-4 px-2 py-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                      />
                      <input
                        type="text"
                        value={t.baseline || ''}
                        onChange={(e) => updateTarget(idx, 'baseline', e.target.value)}
                        disabled={!canEditPipDetails}
                        placeholder="Baseline"
                        className="md:col-span-2 px-2 py-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                      />
                      <select
                        value={t.status || 'IN_PROGRESS'}
                        onChange={(e) => updateTarget(idx, 'status', e.target.value)}
                        disabled={!canEditPipDetails}
                        className="md:col-span-2 px-2 py-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                      >
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="MET">Met</option>
                        <option value="AT_RISK">At Risk</option>
                        <option value="MISSED">Missed</option>
                      </select>
                      {canEditPipDetails && improvementTargets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setImprovementTargets((p) => p.filter((_, i) => i !== idx))}
                          className="md:col-span-1 text-rose-500 hover:text-rose-700 text-center"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Scheduled Reviews */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Review Schedule
                  </label>
                  {canEditPipDetails && (
                    <button
                      type="button"
                      onClick={() => setReviewSchedule((p) => [...p, { reviewDate: targetEndDate, focus: 'Follow-Up Review' }])}
                      className="text-[11px] font-semibold text-navy-700"
                    >
                      + Add Check-In Date
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {reviewSchedule.map((rs, idx) => (
                    <div key={rs.id || idx} className="flex gap-2 items-center p-2 rounded bg-slate-50 border border-slate-200">
                      <input
                        type="date"
                        value={rs.reviewDate || ''}
                        disabled={!canEditPipDetails}
                        onChange={(e) =>
                          setReviewSchedule((p) => p.map((r, i) => (i === idx ? { ...r, reviewDate: e.target.value } : r)))
                        }
                        className="px-2 py-1 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                      />
                      <input
                        type="text"
                        value={rs.focus || ''}
                        disabled={!canEditPipDetails}
                        onChange={(e) =>
                          setReviewSchedule((p) => p.map((r, i) => (i === idx ? { ...r, focus: e.target.value } : r)))
                        }
                        placeholder="Review Focus"
                        className="flex-1 px-2 py-1 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Manager Evaluation History */}
              {!isNew && evaluations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Recorded Manager Evaluations
                  </h4>
                  <div className="space-y-2">
                    {evaluations.map((ev) => (
                      <div key={ev.id} className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-200">
                        <div className="flex justify-between font-semibold text-navy-950">
                          <span>{ev.evaluatorName} ({ev.evaluatorRole}) — {ev.progressAssessment}</span>
                          <span>{ev.rating ? `Score: ${ev.rating}/5` : ''} • {ev.reviewDate}</span>
                        </div>
                        <p className="text-slate-700 mt-1">{ev.comments}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Employee Acknowledgement */}
              {!isNew && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Employee PIP Acknowledgement
                    </span>
                    <span className={`text-[11px] font-bold ${detail?.employeeAcknowledged ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {detail?.employeeAcknowledged ? `Acknowledged (${detail.acknowledgedAt})` : 'Pending Employee Acknowledgement'}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={employeeStatement}
                    onChange={(e) => setEmployeeStatement(e.target.value)}
                    disabled={!isTargetEmployee || Boolean(detail?.employeeAcknowledged)}
                    placeholder={isTargetEmployee ? 'Optional statement before acknowledging receipt of PIP terms...' : 'Employee response pending...'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs disabled:bg-slate-100"
                  />
                </div>
              )}

              {/* Audit Trail */}
              {!isNew && Array.isArray(detail?.auditHistory) && detail.auditHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Audit History
                  </h4>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {detail.auditHistory.map((log) => (
                      <div key={log.id} className="text-[11px] bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 flex justify-between">
                        <span><strong>{log.actionType}</strong> — {log.reasonOrNotes}</span>
                        <span className="text-slate-400 font-mono">{String(log.createdAt).slice(0, 16).replace('T', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}

          {/* Manager Evaluation Form Tab */}
          {activeActionTab === 'evaluate' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Progress Assessment</label>
                  <select
                    value={evalAssessment}
                    onChange={(e) => setEvalAssessment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="EXCEEDING">Exceeding Targets</option>
                    <option value="ON_TRACK">On Track</option>
                    <option value="NEEDS_ATTENTION">Needs Attention</option>
                    <option value="OFF_TRACK">Off Track / At Risk</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Check-In Rating (1.0 - 5.0)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="5"
                    value={evalRating}
                    onChange={(e) => setEvalRating(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Manager Evaluation Notes *</label>
                <textarea
                  rows={4}
                  value={evalComments}
                  onChange={(e) => setEvalComments(e.target.value)}
                  placeholder="Evidence observed during this PIP review cycle..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {/* Closure & Outcome Tab */}
          {activeActionTab === 'close' && (
            <div className="space-y-3 p-4 rounded-xl bg-rose-50/40 border border-rose-200">
              <h4 className="font-bold text-navy-950">Approve Formal PIP Closure & Outcome</h4>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Outcome Decision *</label>
                <select
                  value={closureOutcome}
                  onChange={(e) => setClosureOutcome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {PIP_OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {closureOutcome === 'EXTENDED' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">New Extended Deadline</label>
                  <input
                    type="date"
                    value={extendedEndDate}
                    onChange={(e) => setExtendedEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Final Justification & Closure Notes *</label>
                <textarea
                  rows={3}
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  placeholder="Document final review findings and rationale for this PIP outcome..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50"
          >
            Close
          </button>

          {activeActionTab === 'overview' && isTargetEmployee && !detail?.employeeAcknowledged && !isClosed && !isNew && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleAcknowledge}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Acknowledge PIP'}
            </button>
          )}

          {activeActionTab === 'overview' && canEditPipDetails && (
            <button
              type="submit"
              form="pip-overview-form"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-rose-700 text-white font-semibold text-xs hover:bg-rose-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isNew ? 'Initiate Formal PIP' : 'Save PIP Changes'}
            </button>
          )}

          {activeActionTab === 'evaluate' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitEvaluation}
              className="px-4 py-2 rounded-lg bg-navy-950 text-white font-semibold text-xs hover:bg-navy-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Record Manager Evaluation'}
            </button>
          )}

          {activeActionTab === 'close' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClosePip}
              className="px-4 py-2 rounded-lg bg-rose-700 text-white font-semibold text-xs hover:bg-rose-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Closing...' : 'Approve PIP Closure'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

