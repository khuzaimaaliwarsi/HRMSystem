import React from 'react';

export default function DevelopmentPlanTable({ plans = [], onToggleCheckpoint }) {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h4 className="text-sm font-bold text-navy-950">Individual Development Plans & Improvement Tracks</h4>
          <p className="text-xs text-slate-500">Structured growth goals, mentor checkpoints, and performance improvement milestones</p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 bg-purple-100 text-purple-800 rounded">
          {plans.length} Active Tracks
        </span>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-slate-400 text-xs">
          No development plans or PIP tracks found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const completedCount = plan.checkpoints?.filter((c) => c.completed).length || 0;
            const totalCount = plan.checkpoints?.length || 1;
            const progressPct = Math.round((completedCount / totalCount) * 100);

            return (
              <div key={plan.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      plan.type.includes('PIP')
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {plan.type}
                    </span>
                    <h4 className="text-sm font-bold text-navy-950 mt-1">{plan.title}</h4>
                    <div className="text-xs text-slate-500">
                      Employee: <strong>{plan.employeeName}</strong> • Mentor: <strong>{plan.mentorName}</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono font-bold text-navy-950">{progressPct}%</span>
                    <span className="text-[10px] text-slate-400 block">Progress</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-navy-950 h-full rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>

                {/* Checkpoints list */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1.5 uppercase tracking-wider">
                    Checkpoints & Deliverables:
                  </span>
                  <div className="space-y-1.5 text-xs">
                    {plan.checkpoints?.map((cp, idx) => (
                      <label
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={cp.completed}
                          onChange={() => onToggleCheckpoint?.(plan.id, idx)}
                          className="mt-0.5 rounded text-navy-950 focus:ring-navy-600"
                        />
                        <div className="flex-1">
                          <span className={`font-medium ${cp.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {cp.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">Due: {cp.dueDate}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Recommended Training Banner */}
                {plan.recommendedTraining && (
                  <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200 text-xs flex items-center gap-2">
                    <i className="fa-solid fa-graduation-cap text-blue-700"></i>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-blue-900 block">Suggested Training</span>
                      <span className="text-slate-700 font-medium">{plan.recommendedTraining}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
