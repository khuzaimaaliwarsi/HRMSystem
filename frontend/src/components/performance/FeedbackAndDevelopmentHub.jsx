import React, { useState, useMemo } from 'react';
import FeedbackModal from './FeedbackModal';
import DevelopmentPlanModal from './DevelopmentPlanModal';
import PipPlanModal from './PipPlanModal';

export default function FeedbackAndDevelopmentHub({
  feedbacks = [],
  plans = [],
  employees = [],
  currentUser,
  canManageFeedback = false,
  canManageIdp = false,
  canInitiatePip = false,
  canClosePip = false,
  onToggleCheckpoint,
  onRefresh
}) {
  const [section, setSection] = useState('feedback'); // 'feedback' | 'idp' | 'pip'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const [selectedIdp, setSelectedIdp] = useState(null);
  const [isIdpModalOpen, setIsIdpModalOpen] = useState(false);

  const [selectedPip, setSelectedPip] = useState(null);
  const [isPipModalOpen, setIsPipModalOpen] = useState(false);

  const idpPlans = useMemo(
    () =>
      plans.filter((p) => {
        const cat = p.planCategory || (String(p.type || '').toUpperCase().includes('PIP') ? 'PIP' : 'IDP');
        return cat === 'IDP';
      }),
    [plans]
  );

  const pipPlans = useMemo(
    () =>
      plans.filter((p) => {
        const cat = p.planCategory || (String(p.type || '').toUpperCase().includes('PIP') ? 'PIP' : 'IDP');
        return cat === 'PIP';
      }),
    [plans]
  );

  const q = searchQuery.trim().toLowerCase();

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((f) => {
      if (statusFilter !== 'ALL' && String(f.status).toUpperCase() !== statusFilter) return false;
      if (typeFilter !== 'ALL' && String(f.feedbackType).toUpperCase() !== typeFilter) return false;
      if (!q) return true;
      return (
        String(f.feedbackCode || '').toLowerCase().includes(q) ||
        String(f.title || '').toLowerCase().includes(q) ||
        String(f.employeeName || '').toLowerCase().includes(q) ||
        String(f.employeeId || '').toLowerCase().includes(q) ||
        String(f.strengths || '').toLowerCase().includes(q)
      );
    });
  }, [feedbacks, statusFilter, typeFilter, q]);

  const filteredIdps = useMemo(() => {
    return idpPlans.filter((p) => {
      if (statusFilter !== 'ALL' && String(p.status).toUpperCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        String(p.planCode || '').toLowerCase().includes(q) ||
        String(p.title || '').toLowerCase().includes(q) ||
        String(p.employeeName || '').toLowerCase().includes(q) ||
        String(p.employeeId || '').toLowerCase().includes(q)
      );
    });
  }, [idpPlans, statusFilter, q]);

  const filteredPips = useMemo(() => {
    return pipPlans.filter((p) => {
      if (statusFilter !== 'ALL' && String(p.status).toUpperCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        String(p.planCode || '').toLowerCase().includes(q) ||
        String(p.title || '').toLowerCase().includes(q) ||
        String(p.employeeName || '').toLowerCase().includes(q) ||
        String(p.employeeId || '').toLowerCase().includes(q) ||
        String(p.documentedConcerns || '').toLowerCase().includes(q)
      );
    });
  }, [pipPlans, statusFilter, q]);

  const switchSection = (next) => {
    setSection(next);
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setSearchQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Top 3-Section Switcher + Action Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchSection('feedback')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                section === 'feedback'
                  ? 'bg-navy-950 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <i className="fa-solid fa-comments"></i>
              <span>Employee Feedback</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${section === 'feedback' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'}`}>
                {feedbacks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => switchSection('idp')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                section === 'idp'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <i className="fa-solid fa-seedling"></i>
              <span>Individual Development Plans</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${section === 'idp' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'}`}>
                {idpPlans.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => switchSection('pip')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                section === 'pip'
                  ? 'bg-rose-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>Performance Improvement Plans (PIP)</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${section === 'pip' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'}`}>
                {pipPlans.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {section === 'feedback' && canManageFeedback && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFeedback(null);
                  setIsFeedbackModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-navy-950 text-white text-xs font-bold hover:bg-navy-800 flex items-center gap-1.5"
              >
                <i className="fa-solid fa-plus"></i> Give Feedback
              </button>
            )}
            {section === 'idp' && canManageIdp && (
              <button
                type="button"
                onClick={() => {
                  setSelectedIdp(null);
                  setIsIdpModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 flex items-center gap-1.5"
              >
                <i className="fa-solid fa-plus"></i> Create Development Plan
              </button>
            )}
            {section === 'pip' && canInitiatePip && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPip(null);
                  setIsPipModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 flex items-center gap-1.5"
              >
                <i className="fa-solid fa-plus"></i> Initiate Formal PIP
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${section === 'feedback' ? 'feedbacks' : section === 'idp' ? 'development plans' : 'PIP records'} by code, title, or employee...`}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {section === 'feedback' && (
            <>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
              >
                <option value="ALL">All Types</option>
                <option value="POSITIVE">Positive</option>
                <option value="CONSTRUCTIVE">Constructive</option>
                <option value="CHECK_IN">Check-In</option>
                <option value="COACHING">Coaching</option>
                <option value="RECOGNITION">Recognition</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="SHARED">Shared</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </>
          )}

          {section === 'idp' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          )}

          {section === 'pip' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="EXTENDED">Extended</option>
              <option value="COMPLETED_SUCCESS">Completed (Success)</option>
              <option value="ESCALATED_TERMINATION">Escalated</option>
              <option value="CLOSED_UNMET">Closed Unmet</option>
            </select>
          )}
        </div>
      </div>

      {/* SECTION 1: EMPLOYEE FEEDBACK */}
      {section === 'feedback' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredFeedbacks.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No feedback records found for the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                    <th className="py-2.5 px-3 font-bold">Code</th>
                    <th className="py-2.5 px-3 font-bold">Employee</th>
                    <th className="py-2.5 px-3 font-bold">Subject & Strengths / Improvement</th>
                    <th className="py-2.5 px-3 font-bold">Type</th>
                    <th className="py-2.5 px-3 font-bold">Author</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFeedbacks.map((fb) => (
                    <tr key={fb.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-semibold text-navy-950">{fb.feedbackCode}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{fb.employeeName}</div>
                        <div className="text-[10px] text-slate-400">{fb.employeeId} • {fb.department}</div>
                      </td>
                      <td className="py-2.5 px-3 max-w-sm">
                        <div className="font-semibold text-navy-950 truncate">{fb.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {fb.strengths || fb.improvementAreas || fb.managerComments}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {fb.feedbackType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{fb.authorName}</div>
                        <div className="text-[10px] text-slate-400">{fb.createdAt}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          fb.status === 'ACKNOWLEDGED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : fb.status === 'ARCHIVED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-blue-100 text-blue-800'
                        }`}>
                          {fb.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFeedback(fb);
                            setIsFeedbackModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded border border-slate-300 text-navy-950 font-semibold hover:bg-slate-100"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: INDIVIDUAL DEVELOPMENT PLANS (IDP) */}
      {section === 'idp' && (
        filteredIdps.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-slate-400 text-xs">
            No Individual Development Plans found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIdps.map((plan) => {
              const completedCount = plan.checkpoints?.filter((c) => c.completed).length || 0;
              const totalCount = plan.checkpoints?.length || 0;
              const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (plan.progressPercent || 0);

              return (
                <div key={plan.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          IDP • {plan.planCode}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {plan.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-navy-950 mt-1">{plan.title}</h4>
                      <div className="text-xs text-slate-500">
                        Employee: <strong>{plan.employeeName}</strong> • Mentor: <strong>{plan.mentorName}</strong>
                      </div>
                      {plan.targetEndDate && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          Deadline: {plan.targetEndDate}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-navy-950">{progressPct}%</span>
                      <span className="text-[10px] text-slate-400 block">Progress</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>

                  {plan.goalsSummary && (
                    <p className="text-xs text-slate-600 line-clamp-2">{plan.goalsSummary}</p>
                  )}

                  <div className="space-y-1.5 text-xs">
                    {plan.checkpoints?.slice(0, 4).map((cp, idx) => (
                      <label
                        key={cp.id || idx}
                        className="flex items-start gap-2 p-2 rounded bg-slate-50 hover:bg-slate-100/80 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(cp.completed)}
                          disabled={Boolean(plan.closedAt)}
                          onChange={() => onToggleCheckpoint?.(plan.id, idx)}
                          className="mt-0.5 rounded text-emerald-700"
                        />
                        <div className="flex-1">
                          <span className={`font-medium ${cp.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {cp.title}
                          </span>
                          {cp.dueDate && (
                            <span className="text-[10px] text-slate-400 font-mono block">Due: {cp.dueDate}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIdp(plan);
                        setIsIdpModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-navy-950 hover:bg-slate-50"
                    >
                      Manage / Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* SECTION 3: PERFORMANCE IMPROVEMENT PLANS (PIP) */}
      {section === 'pip' && (
        filteredPips.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-slate-400 text-xs">
            No formal Performance Improvement Plans (PIPs) found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPips.map((pip) => {
              const targetCount = pip.improvementTargets?.length || 0;
              const metCount = pip.improvementTargets?.filter((t) => t.status === 'MET').length || 0;
              const evalCount = pip.managerEvaluations?.length || 0;

              return (
                <div key={pip.id} className="bg-white rounded-xl border border-rose-200 shadow-sm p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          FORMAL PIP • {pip.planCode}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white">
                          {pip.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pip.employeeAcknowledged ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {pip.employeeAcknowledged ? 'Acknowledged' : 'Pending Ack'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-navy-950 mt-1">{pip.title}</h4>
                      <div className="text-xs text-slate-600">
                        Employee: <strong>{pip.employeeName}</strong> ({pip.employeeId}) • Reviewer: <strong>{pip.mentorName}</strong>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Cadence: {pip.reviewFrequency} • Deadline: {pip.targetEndDate || 'TBD'}
                      </div>
                    </div>
                  </div>

                  {pip.documentedConcerns && (
                    <div className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-100 text-xs text-slate-700">
                      <span className="text-[10px] font-bold uppercase text-rose-800 block mb-0.5">Documented Concerns</span>
                      <p className="line-clamp-2">{pip.documentedConcerns}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                    <span>Targets Met: <strong>{metCount}/{targetCount}</strong></span>
                    <span>Evaluations: <strong>{evalCount}</strong></span>
                    {pip.closureOutcome && (
                      <span className="font-bold text-navy-950">Outcome: {pip.closureOutcome}</span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPip(pip);
                        setIsPipModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800"
                    >
                      Inspect / Review PIP
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modals */}
      {isFeedbackModalOpen && (
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => {
            setIsFeedbackModalOpen(false);
            setSelectedFeedback(null);
          }}
          feedback={selectedFeedback}
          employees={employees}
          currentUser={currentUser}
          canManage={canManageFeedback}
          onSaved={onRefresh}
        />
      )}

      {isIdpModalOpen && (
        <DevelopmentPlanModal
          isOpen={isIdpModalOpen}
          onClose={() => {
            setIsIdpModalOpen(false);
            setSelectedIdp(null);
          }}
          plan={selectedIdp}
          employees={employees}
          currentUser={currentUser}
          canManage={canManageIdp}
          onSaved={onRefresh}
        />
      )}

      {isPipModalOpen && (
        <PipPlanModal
          isOpen={isPipModalOpen}
          onClose={() => {
            setIsPipModalOpen(false);
            setSelectedPip(null);
          }}
          plan={selectedPip}
          employees={employees}
          currentUser={currentUser}
          canManage={canInitiatePip}
          canClose={canClosePip}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}

