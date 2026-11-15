import React from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TicketCategoriesModal({
  categories = [],
  teams = [],
  slaTargets = {},
  onClose = () => {}
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <AppIcon name="helpdesk" className="w-4 h-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-800">Support Teams, Categories &amp; SLA Policy</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition"
          >
            <AppIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* SLA Target Matrix */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Service Level Agreement (SLA) Matrix
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(slaTargets).map(([priority, conf]) => (
                <div key={priority} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{priority}</span>
                    <span className={`w-2 h-2 rounded-full ${
                      priority === 'Critical' ? 'bg-rose-500' :
                      priority === 'High' ? 'bg-amber-500' :
                      priority === 'Medium' ? 'bg-blue-500' : 'bg-slate-400'
                    }`}></span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Response: <span className="font-semibold text-slate-700">{conf.firstResponseHours}h</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Resolution: <span className="font-semibold text-slate-700">{conf.resolutionHours}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Categories and Teams */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Configured Categories & Routing Teams
            </h3>
            <div className="space-y-3">
              {categories.map((cat) => {
                const team = teams.find((t) => t.teamId === cat.defaultTeamId)
                return (
                  <div key={cat.categoryId} className="p-3.5 border border-slate-200 rounded-lg bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <i className={`fa-solid ${cat.icon || 'fa-tag'} text-indigo-600 text-sm`}></i>
                        <span className="font-semibold text-xs text-slate-800">{cat.categoryName}</span>
                        {cat.isConfidential && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                            <i className="fa-solid fa-lock text-[9px] mr-1"></i>
                            Confidential Routing
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        Routing: {team?.teamName || cat.defaultTeamId}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(cat.subcategories || []).map((sub, i) => (
                        <span key={i} className="text-[11px] bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-white rounded font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
