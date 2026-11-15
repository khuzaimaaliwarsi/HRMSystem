import React, { useState } from 'react';

export default function AppraisalListTable({
  reviews = [],
  onOpenReview,
  cycles = [],
  canInitiate = false,
  canManageCycles = false,
  onStartReview,
  onCreateCycle
}) {
  const [selectedCycle, setSelectedCycle] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

  const uniqueDepartments = Array.from(
    new Set(reviews.map((r) => r.department).filter(Boolean))
  ).sort();

  const filteredReviews = reviews.filter((r) => {
    if (selectedCycle !== 'ALL' && r.cycleId !== selectedCycle) return false;
    if (selectedDepartment !== 'ALL' && r.department !== selectedDepartment) return false;
    if (selectedStatus !== 'ALL' && String(r.status || '').toLowerCase() !== selectedStatus.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Appraisal Cycle</label>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Cycles</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {uniqueDepartments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Review Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending Self Assessment">Pending Self Assessment</option>
              <option value="Self Assessment Submitted">Self Assessment Submitted</option>
              <option value="Manager Evaluated">Manager Evaluated</option>
              <option value="HR Moderated">HR Moderated</option>
              <option value="Finalized">Finalized</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="text-xs text-slate-500 font-medium mr-1">
            Showing <strong>{filteredReviews.length}</strong> evaluation records
          </div>
          {canManageCycles && onCreateCycle && (
            <button
              type="button"
              onClick={onCreateCycle}
              className="px-3 py-1.5 text-xs font-bold text-navy-950 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5"
            >
              <i className="fa-solid fa-calendar-plus"></i>
              Create Cycle
            </button>
          )}
          {canInitiate && onStartReview && (
            <button
              type="button"
              onClick={onStartReview}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm flex items-center gap-1.5"
            >
              <i className="fa-solid fa-plus"></i>
              Start Review
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
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-4">Cycle</th>
                <th className="py-2.5 px-4">Reviewer</th>
                <th className="py-2.5 px-4 text-center">Self</th>
                <th className="py-2.5 px-4 text-center">Manager</th>
                <th className="py-2.5 px-4 text-center">Final Rating</th>
                <th className="py-2.5 px-4">Recommendation</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No appraisals found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredReviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-950">{rev.employeeName}</div>
                      <div className="text-[11px] text-slate-500">{rev.designation} • {rev.department}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{rev.cycleName}</td>
                    <td className="py-3 px-4 text-slate-600">{rev.reviewerName}</td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                      {rev.selfRating ? `${rev.selfRating} / 5` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                      {rev.managerRating ? `${rev.managerRating} / 5` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-navy-950 px-2 py-0.5 bg-slate-100 rounded text-xs">
                        <i className="fa-solid fa-star text-amber-500 text-[10px]"></i>
                        {rev.finalWeightedRating ? `${rev.finalWeightedRating} / 5.0` : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {rev.managerRecommendation && !['NONE', 'NO_CHANGE'].includes(rev.managerRecommendation.type) ? (
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            rev.managerRecommendation.type === 'SALARY_INCREMENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rev.managerRecommendation.type === 'SALARY_DECREMENT'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {((rev.managerRecommendation.type || '') + '').replace('_', ' ')}
                            {rev.managerRecommendation.recommendedIncreasePercent > 0 && ` (+${rev.managerRecommendation.recommendedIncreasePercent}%)`}
                          </span>
                          {rev.managerRecommendation.handoffStatus === 'PROPOSAL_CREATED' && (
                            <span className="block text-[10px] text-emerald-700 font-semibold mt-0.5">
                              <i className="fa-solid fa-link text-[9px] mr-1"></i>F06 Proposal Linked
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        rev.status === 'Finalized'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rev.status === 'HR Moderated'
                          ? 'bg-blue-100 text-blue-800'
                          : rev.status === 'Manager Evaluated'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {rev.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onOpenReview?.(rev)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-navy-950 hover:bg-navy-900 text-white rounded transition-colors flex items-center gap-1.5 ml-auto"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                        Open Review
                      </button>
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
