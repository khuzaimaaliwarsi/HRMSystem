import React, { useState } from 'react'

export default function TrainingPlansTable({
  plans = [],
  onApprovePlan,
  onRejectPlan,
  canApprove = false
}) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')

  const filtered = plans.filter((p) => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterType !== 'all' && p.planType !== filterType) return false
    return true
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-left">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-600"
          >
            <option value="all">All Approval Statuses</option>
            <option value="Recommended">Recommended</option>
            <option value="Pending HR Review">Pending HR Review</option>
            <option value="Pending Super Admin Approval">Pending Super Admin Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-600"
          >
            <option value="all">All Plan Scopes</option>
            <option value="Individual">Individual Staff</option>
            <option value="Department">Department Track</option>
            <option value="Team">Team Track</option>
            <option value="Role-Specific">Role-Specific Track</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filtered.length}</strong> of {plans.length} recommendations
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
              <th className="py-2.5 px-4">Plan Ref &amp; Title</th>
              <th className="py-2.5 px-4">Scope &amp; Target</th>
              <th className="py-2.5 px-4">Course Program</th>
              <th className="py-2.5 px-4">Origin / Skill Gap Source</th>
              <th className="py-2.5 px-4">Recommended By</th>
              <th className="py-2.5 px-4">Status</th>
              {canApprove && <th className="py-2.5 px-4 text-right">Approval Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canApprove ? 7 : 6} className="py-8 text-center text-slate-400">
                  No training plan recommendations found.
                </td>
              </tr>
            ) : (
              filtered.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-bold text-navy-950 text-xs">
                      {plan.title}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                      <span>{plan.planCode || plan.planId || plan.id}</span>
                      {plan.isMandatory && (
                        <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[9px] font-bold">
                          MANDATORY
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">
                      {plan.targetEmployeeName || plan.targetDepartmentName || 'Company-Wide'}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      {plan.planType} Plan
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700 max-w-[200px] truncate">
                    {plan.programTitle}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-[200px]">
                    <div className="truncate text-slate-800 font-medium">{plan.skillsGapSource}</div>
                    <div className="text-[11px] text-slate-500 truncate" title={plan.justification}>
                      {plan.justification}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-medium">
                    {plan.recommendedByName}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                      plan.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : plan.status === 'Rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {plan.status}
                    </span>
                    {plan.approvedBy && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        By {plan.approvedBy}
                      </div>
                    )}
                  </td>
                  {canApprove && (
                    <td className="py-3 px-4 text-right">
                      {plan.status !== 'Approved' && plan.status !== 'Rejected' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onApprovePlan(plan.id)}
                            className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors flex items-center gap-1 shadow-2xs"
                          >
                            <i className="fa-solid fa-check text-[10px]"></i>
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectPlan(plan.id)}
                            className="px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-medium">Archived</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
