import React from 'react'

export default function HelpDeskAnalyticsView({ kpis = {}, tickets = [] }) {
  const categoryCounts = kpis.categoryCounts || {}
  const teamWorkload = kpis.teamWorkload || {}
  const total = kpis.totalTickets || 1
  const feedbackList = Array.isArray(kpis.feedbackList) ? kpis.feedbackList : []
  const historicalFeedbackList = Array.isArray(kpis.historicalFeedbackList) ? kpis.historicalFeedbackList : []
  const historyTickets = tickets.filter(
    (t) => (!t.isReopenedActive && (t.status === 'Resolved' || t.status === 'Closed')) || Boolean(t.previousResolutionSummary)
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Category Breakdown */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Category Distribution
            </h3>
            <span className="text-[11px] text-slate-400">Total: {kpis.totalTickets || 0}</span>
          </div>

          <div className="space-y-2.5">
            {Object.entries(categoryCounts).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No data available</p>
            ) : (
              Object.entries(categoryCounts).map(([cat, count]) => {
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-700">
                      <span className="font-medium">{cat}</span>
                      <span className="text-slate-500 font-mono">{count} tickets ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Support Team Workload */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Support Team Workload
            </h3>
            <span className="text-[11px] text-slate-400">Assigned Inquiries</span>
          </div>

          <div className="space-y-2.5">
            {Object.entries(teamWorkload).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No data available</p>
            ) : (
              Object.entries(teamWorkload).map(([team, count]) => {
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={team} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-700">
                      <span className="font-medium">{team}</span>
                      <span className="text-slate-500 font-mono">{count} tickets ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* SLA Performance Metrics Table */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
          Operational SLA Performance & Satisfaction Benchmarks
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[11px] text-slate-500 uppercase font-semibold">Avg First Response</span>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {kpis.avgFirstResponseHours || '0.0'} <span className="text-xs font-normal text-slate-500">hours</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[11px] text-slate-500 uppercase font-semibold">Avg Resolution Time</span>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {kpis.avgResolutionHours || '0.0'} <span className="text-xs font-normal text-slate-500">hours</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[11px] text-slate-500 uppercase font-semibold">SLA Compliance / Breaches</span>
            <div className={`text-xl font-bold mt-1 ${kpis.slaBreaches > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {kpis.slaComplianceRate ?? 100}% <span className="text-xs font-normal text-slate-500">({kpis.slaBreaches || 0} breached)</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[11px] text-slate-500 uppercase font-semibold">Confirmed Closed Ratio</span>
            <div className="text-xl font-bold text-indigo-600 mt-1">
              {kpis.totalTickets > 0 ? Math.round(((kpis.closedTickets || 0) / kpis.totalTickets) * 100) : 0}%
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[11px] text-slate-500 uppercase font-semibold">Avg CSAT Score</span>
            <div className="text-xl font-bold text-amber-600 mt-1">
              {kpis.avgSatisfactionRating ? `${kpis.avgSatisfactionRating} / 5` : 'No Active Ratings'}
            </div>
          </div>
        </div>
      </div>

      {/* CSAT Feedback & Closed Ticket History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Employee Satisfaction Feedback ({feedbackList.length} Active{historicalFeedbackList.length > 0 ? ` • ${historicalFeedbackList.length} Historical` : ''})
            </h3>
          </div>
          {feedbackList.length === 0 && historicalFeedbackList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No CSAT ratings recorded yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {feedbackList.map((fb) => (
                <div key={fb.ticketId} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-indigo-700">{fb.ticketId}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <i
                          key={star}
                          className={`fa-solid fa-star text-[10px] ${
                            star <= fb.rating ? 'text-amber-400' : 'text-slate-300'
                          }`}
                        ></i>
                      ))}
                    </div>
                  </div>
                  <div className="font-medium text-slate-800">{fb.subject}</div>
                  {fb.feedback && <p className="text-slate-600 italic">&quot;{fb.feedback}&quot;</p>}
                  <div className="text-[10px] text-slate-400">
                    Requester: {fb.employeeName} {fb.resolvedByName ? `• Resolved by: ${fb.resolvedByName}` : ''}
                  </div>
                </div>
              ))}
              {historicalFeedbackList.map((fb, idx) => (
                <div key={`${fb.ticketId}-hist-${idx}`} className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-indigo-700">{fb.ticketId}</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                        Historical (Pre-Reopen)
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <i
                          key={star}
                          className={`fa-solid fa-star text-[10px] ${
                            star <= fb.rating ? 'text-amber-400' : 'text-slate-300'
                          }`}
                        ></i>
                      ))}
                    </div>
                  </div>
                  <div className="font-medium text-slate-800">{fb.subject}</div>
                  {fb.feedback && <p className="text-slate-600 italic">&quot;{fb.feedback}&quot;</p>}
                  <div className="text-[10px] text-slate-500">
                    Requester: {fb.employeeName} {fb.resolvedByName ? `• Prior Resolver: ${fb.resolvedByName}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Resolution &amp; Reopened History ({historyTickets.length})
            </h3>
          </div>
          {historyTickets.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No resolved or closed tickets recorded yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {historyTickets.map((t) => {
                const isHistoricalOnly = Boolean(t.isReopenedActive && t.previousResolutionSummary)
                const summaryText = isHistoricalOnly ? t.previousResolutionSummary : t.resolutionSummary
                const resolverText = isHistoricalOnly ? t.previousResolvedByName : t.resolvedByName
                return (
                  <div key={t.ticketId} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-indigo-700">{t.ticketId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isHistoricalOnly
                          ? 'bg-amber-100 text-amber-800'
                          : t.status === 'Closed'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isHistoricalOnly ? `Prior Cycle (${t.status} Now)` : t.status}
                      </span>
                    </div>
                    <div className="font-medium text-slate-800 truncate">{t.subject}</div>
                    {summaryText && (
                      <div className="text-[11px] text-slate-600 line-clamp-2">{summaryText}</div>
                    )}
                    <div className="text-[10px] text-slate-400">
                      {resolverText ? `Resolver: ${resolverText} • ` : ''}
                      {t.closedAt && !isHistoricalOnly
                        ? `Closed: ${new Date(t.closedAt).toLocaleDateString()}`
                        : t.resolvedAt && !isHistoricalOnly
                        ? `Resolved: ${new Date(t.resolvedAt).toLocaleDateString()}`
                        : t.previousResolvedAt
                        ? `Prior Resolved: ${new Date(t.previousResolvedAt).toLocaleDateString()}`
                        : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
