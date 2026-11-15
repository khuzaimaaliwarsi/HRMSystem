import React, { useState, useEffect } from 'react';
import performanceService from '../../services/performanceService';
import { useAuth } from '../../context/AuthContext';

export default function AppraisalReviewModal({ review, isOpen, onClose, onReviewUpdated }) {
  const { currentUser } = useAuth();

  const userRole = currentUser?.role?.toLowerCase();
  const myEmpId = currentUser?.employeeId;
  const myUserId = currentUser?.id;
  const isTargetEmployee = Boolean(
    review && (
      (myEmpId && (myEmpId === review.employeeId || myEmpId === review.employeeCuid)) ||
      (myUserId && (myUserId === review.employeeId || myUserId === review.employeeCuid))
    )
  );
  const isManager = ['manager', 'dept_manager', 'super_admin'].includes(userRole);
  const isHrAdmin = ['hr_admin', 'super_admin'].includes(userRole);
  const isSuperAdmin = userRole === 'super_admin';

  // Form states
  const [selfRating, setSelfRating] = useState(review?.selfRating || 4.0);
  const [selfComments, setSelfComments] = useState(review?.selfComments || '');

  const [managerRating, setManagerRating] = useState(review?.managerRating || 4.0);
  const [managerComments, setManagerComments] = useState(review?.managerComments || '');
  const [recommendationType, setRecommendationType] = useState(
    review?.managerRecommendation?.type === 'NO_CHANGE' ? 'NONE' : (review?.managerRecommendation?.type || 'NONE')
  );
  const [recommendedPercent, setRecommendedPercent] = useState(review?.managerRecommendation?.recommendedIncreasePercent || 10);
  const [recommendationJustification, setRecommendationJustification] = useState(review?.managerRecommendation?.justification || '');

  const [hrRating, setHrRating] = useState(review?.hrRating || review?.managerRating || 4.0);
  const [hrComments, setHrComments] = useState(review?.hrComments || '');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (review) {
      setSelfRating(review.selfRating || 4.0);
      setSelfComments(review.selfComments || '');
      setManagerRating(review.managerRating || 4.0);
      setManagerComments(review.managerComments || '');
      setRecommendationType(
        review.managerRecommendation?.type === 'NO_CHANGE' ? 'NONE' : (review.managerRecommendation?.type || 'NONE')
      );
      setRecommendedPercent(review.managerRecommendation?.recommendedIncreasePercent || 10);
      setRecommendationJustification(review.managerRecommendation?.justification || '');
      setHrRating(review.hrRating || review.managerRating || 4.0);
      setHrComments(review.hrComments || '');
    }
  }, [review]);

  if (!isOpen || !review) return null;

  // Handlers
  const handleSaveSelfAssessment = async () => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      const updated = await performanceService.submitSelfAssessmentAsync(
        review.id,
        selfRating,
        selfComments,
        currentUser
      );
      setSuccess('Self-assessment submitted successfully.');
      onReviewUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveManagerEvaluation = async () => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      const updated = await performanceService.submitManagerEvaluationAsync(
        review.id,
        {
          managerRating,
          managerComments,
          recommendationType: recommendationType === 'NONE' ? 'NO_CHANGE' : recommendationType,
          recommendedPercent: recommendationType === 'NONE' ? 0 : recommendedPercent,
          justification: recommendationJustification,
          finalizeImmediately: false
        },
        currentUser
      );
      setSuccess('Manager evaluation and recommendations saved.');
      onReviewUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveHrModeration = async () => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      const updated = await performanceService.moderateReviewAsync(
        review.id,
        hrRating,
        hrComments,
        currentUser
      );
      setSuccess('HR moderation saved successfully.');
      onReviewUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeReview = async () => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      const updated = await performanceService.finalizeReviewAsync(review.id, currentUser);
      setSuccess('Performance appraisal finalized and authorized by Super Admin.');
      onReviewUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      const updated = await performanceService.acknowledgeReviewAsync(review.id, currentUser);
      setSuccess('Performance appraisal acknowledged.');
      onReviewUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHandoffToPayroll = () => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      const res = performanceService.handoffSalaryRecommendationToPayroll(review.id, currentUser);
      setSuccess(`Salary revision proposal (${res.proposal.id}) drafted into F06 Payroll. Super Admin approval required.`);
      onReviewUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stages = [
    { label: 'Self Assessment', done: !!review.selfRating },
    { label: 'Manager Review', done: !!review.managerRating },
    { label: 'HR Moderation', done: !!review.hrRating },
    { label: 'Super Admin Finalized', done: review.status === 'Finalized' },
    { label: 'Acknowledged', done: review.isAcknowledged }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-6 overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-navy-800 rounded text-slate-300">
                {review.cycleName}
              </span>
              <span className="text-xs text-slate-400">Ref: {review.id}</span>
            </div>
            <h3 className="text-base font-bold mt-1">
              {review.employeeName} — Appraisal & Evaluation
            </h3>
            <p className="text-xs text-slate-300">
              {review.designation} • {review.department} • Reviewer: {review.reviewerName}
            </p>
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

        {/* Lifecycle Progress Bar */}
        <div className="bg-slate-100/80 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-[11px] overflow-x-auto">
          {stages.map((st, i) => (
            <div key={i} className="flex items-center gap-1.5 whitespace-nowrap">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                  st.done
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-300 text-slate-600'
                }`}
              >
                {st.done ? <i className="fa-solid fa-check text-[9px]"></i> : i + 1}
              </div>
              <span className={`font-semibold ${st.done ? 'text-navy-950' : 'text-slate-400'}`}>
                {st.label}
              </span>
              {i < stages.length - 1 && <span className="text-slate-300 mx-1">→</span>}
            </div>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
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

          {/* Section 1: Employee Self-Assessment */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-navy-950 flex items-center gap-1.5">
                <i className="fa-solid fa-user-pen text-slate-500"></i>
                1. Employee Self-Assessment
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Self Score:</span>
                {isTargetEmployee && review.status !== 'Finalized' ? (
                  <select
                    value={selfRating}
                    onChange={(e) => setSelfRating(Number(e.target.value))}
                    className="border border-slate-300 rounded px-2 py-0.5 bg-white font-bold"
                  >
                    {[1, 2, 3, 3.5, 4, 4.5, 5].map((v) => (
                      <option key={v} value={v}>{v} / 5.0</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono font-bold text-navy-900">{review.selfRating || '—'} / 5.0</span>
                )}
              </div>
            </div>

            {isTargetEmployee && review.status !== 'Finalized' ? (
              <div className="space-y-2">
                <textarea
                  rows="2"
                  value={selfComments}
                  onChange={(e) => setSelfComments(e.target.value)}
                  placeholder="Outline your deliverables, major achievements and core milestones..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                ></textarea>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveSelfAssessment}
                    className="px-3 py-1 bg-navy-950 hover:bg-navy-900 text-white rounded font-bold"
                  >
                    Submit Self-Assessment
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-700 italic bg-white p-2.5 rounded border border-slate-100">
                "{review.selfComments || 'No self-assessment comments submitted.'}"
              </p>
            )}
          </div>

          {/* Section 2: Manager Evaluation & Salary Revision Recommendation */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-navy-950 flex items-center gap-1.5">
                <i className="fa-solid fa-user-tie text-slate-500"></i>
                2. Manager Evaluation & Recommendation
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Manager Rating:</span>
                {isManager && !isTargetEmployee && review.status !== 'Finalized' ? (
                  <select
                    value={managerRating}
                    onChange={(e) => setManagerRating(Number(e.target.value))}
                    className="border border-slate-300 rounded px-2 py-0.5 bg-white font-bold"
                  >
                    {[1, 2, 2.5, 3, 3.5, 4, 4.2, 4.5, 4.7, 5].map((v) => (
                      <option key={v} value={v}>{v} / 5.0</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono font-bold text-navy-900">{review.managerRating || '—'} / 5.0</span>
                )}
              </div>
            </div>

            {isManager && !isTargetEmployee && review.status !== 'Finalized' ? (
              <div className="space-y-3">
                <textarea
                  rows="2"
                  value={managerComments}
                  onChange={(e) => setManagerComments(e.target.value)}
                  placeholder="Manager observations regarding technical quality, velocity and teamwork..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                ></textarea>

                {/* Compensation recommendation sub-panel */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <div className="font-semibold text-slate-700">Compensation Recommendation (F06 Bridge)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500">Recommendation Action</label>
                      <select
                        value={recommendationType}
                        onChange={(e) => setRecommendationType(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 bg-slate-50"
                      >
                        <option value="NONE">No Compensation Change</option>
                        <option value="SALARY_INCREMENT">Recommend Salary Increment</option>
                        <option value="SALARY_DECREMENT">Recommend Salary Decrement</option>
                        <option value="ONE_TIME_BONUS">Recommend One-Time Bonus</option>
                      </select>
                    </div>

                    {recommendationType !== 'NONE' && (
                      <div>
                        <label className="block text-[11px] text-slate-500">Proposed Change (%)</label>
                        <input
                          type="number"
                          step="1"
                          value={recommendedPercent}
                          onChange={(e) => setRecommendedPercent(Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 bg-slate-50"
                        />
                      </div>
                    )}
                  </div>

                  {recommendationType !== 'NONE' && (
                    <div>
                      <label className="block text-[11px] text-slate-500">Justification for Executive Review</label>
                      <input
                        type="text"
                        value={recommendationJustification}
                        onChange={(e) => setRecommendationJustification(e.target.value)}
                        placeholder="Justification linking rating to compensation change..."
                        className="w-full border border-slate-300 rounded px-2 py-1 bg-slate-50"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveManagerEvaluation}
                    className="px-3 py-1 bg-navy-950 hover:bg-navy-900 text-white rounded font-bold"
                  >
                    Save Manager Evaluation
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-slate-700 italic bg-white p-2.5 rounded border border-slate-100">
                  "{review.managerComments || 'No manager comments recorded.'}"
                </p>
                {review.managerRecommendation && !['NONE', 'NO_CHANGE'].includes(review.managerRecommendation.type) && (
                  <div className="p-2.5 bg-blue-50/70 rounded border border-blue-200 flex justify-between items-center text-[11px]">
                    <div>
                      <span className="font-bold text-navy-950">
                        {((review.managerRecommendation.type || '') + '').replace('_', ' ')}:
                      </span>{' '}
                      <span className="text-slate-700">{review.managerRecommendation.justification}</span>
                      {review.managerRecommendation.recommendedIncreasePercent > 0 && (
                        <span className="font-bold text-emerald-700 ml-1">
                          (+{review.managerRecommendation.recommendedIncreasePercent}%)
                        </span>
                      )}
                    </div>
                    {/* Handoff button for HR Admin or Super Admin */}
                    {isHrAdmin && review.managerRecommendation.handoffStatus === 'NOT_STARTED' && (
                      <button
                        onClick={handleHandoffToPayroll}
                        disabled={isSubmitting}
                        className="px-2.5 py-1 text-xs font-bold bg-navy-950 hover:bg-navy-900 text-white rounded shadow-sm flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                        Draft F06 Proposal
                      </button>
                    )}
                    {review.managerRecommendation.handoffStatus === 'PROPOSAL_CREATED' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        <i className="fa-solid fa-check mr-1"></i>F06 Proposal Linked
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: HR Moderation */}
          {isHrAdmin && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-navy-950 flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved text-slate-500"></i>
                  3. HR Governance Moderation
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Moderated Score:</span>
                  {review.status !== 'Finalized' ? (
                    <select
                      value={hrRating}
                      onChange={(e) => setHrRating(Number(e.target.value))}
                      className="border border-slate-300 rounded px-2 py-0.5 bg-white font-bold"
                    >
                      {[1, 2, 2.5, 3, 3.5, 4, 4.2, 4.5, 4.7, 5].map((v) => (
                        <option key={v} value={v}>{v} / 5.0</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono font-bold text-navy-900">{review.hrRating || '—'} / 5.0</span>
                  )}
                </div>
              </div>

              {review.status !== 'Finalized' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={hrComments}
                    onChange={(e) => setHrComments(e.target.value)}
                    placeholder="HR moderation notes regarding policy and attendance reconciliation..."
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveHrModeration}
                      className="px-3 py-1 bg-navy-950 hover:bg-navy-900 text-white rounded font-bold"
                    >
                      Save HR Moderation
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-700 italic bg-white p-2.5 rounded border border-slate-100">
                  "{review.hrComments || 'No HR remarks recorded.'}"
                </p>
              )}
            </div>
          )}

          {/* Section 4: Super Admin Final Authorization Banner */}
          {isSuperAdmin && review.status !== 'Finalized' && (
            <div className="p-4 bg-navy-950 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-sm block">Super Admin Final Approval Authority</span>
                <p className="text-xs text-slate-300">
                  Lock and finalize this performance review under executive governance.
                </p>
              </div>
              <button
                onClick={handleFinalizeReview}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-sm"
              >
                Finalize & Approve
              </button>
            </div>
          )}

          {/* Section 5: Employee Acknowledgement Banner */}
          {isTargetEmployee && review.status === 'Finalized' && !review.isAcknowledged && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-emerald-900 block">Acknowledge Performance Appraisal</span>
                <p className="text-xs text-emerald-700">
                  Your review has been finalized by executive management. Please acknowledge receipt.
                </p>
              </div>
              <button
                onClick={handleAcknowledge}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-sm"
              >
                Acknowledge Review
              </button>
            </div>
          )}

          {review.isAcknowledged && (
            <div className="text-center text-[11px] text-emerald-700 font-semibold p-2 bg-emerald-50 rounded-lg border border-emerald-200">
              <i className="fa-solid fa-circle-check mr-1.5"></i>
              Electronically acknowledged by {review.employeeName} at {review.acknowledgedAt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
