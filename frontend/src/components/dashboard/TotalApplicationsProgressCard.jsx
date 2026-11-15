import React from 'react'

export function TotalApplicationsProgressCard() {
  const applicationStages = [
    {
      id: 'applications',
      label: 'Applications',
      percent: '58%',
      dotColor: 'bg-blue-600',
      badgeBg: 'bg-blue-50 text-blue-600'
    },
    {
      id: 'shortlisted',
      label: 'Shortlisted',
      percent: '22%',
      dotColor: 'bg-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-600'
    },
    {
      id: 'on-hold',
      label: 'On-Hold',
      percent: '12%',
      dotColor: 'bg-amber-500',
      badgeBg: 'bg-amber-50 text-amber-600'
    },
    {
      id: 'rejected',
      label: 'Rejected',
      percent: '08%',
      dotColor: 'bg-rose-500',
      badgeBg: 'bg-rose-50 text-rose-600'
    }
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-[0_2px_12px_-3px_rgba(0,43,73,0.06)] hover:shadow-md transition-shadow flex flex-col justify-between text-left h-full">
      <div>
        <div className="text-slate-800 font-bold text-sm md:text-base tracking-tight mb-4">
          Total Applications
        </div>

        {/* Multi-Segment Horizontal Progress Bar */}
        <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100 gap-0.5 my-3">
          <div style={{ width: '58%' }} className="h-full bg-blue-600 rounded-l-full" title="Applications: 58%" />
          <div style={{ width: '22%' }} className="h-full bg-emerald-600" title="Shortlisted: 22%" />
          <div style={{ width: '12%' }} className="h-full bg-amber-500" title="On-Hold: 12%" />
          <div style={{ width: '8%' }} className="h-full bg-rose-500 rounded-r-full" title="Rejected: 8%" />
        </div>
      </div>

      {/* Vertical Status List */}
      <div className="space-y-3.5 my-2">
        {applicationStages.map((stage) => (
          <div key={stage.id} className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${stage.dotColor} shrink-0`} />
              <span className="font-medium text-slate-700">{stage.label}</span>
            </div>
            <span className={`font-semibold text-xs px-2.5 py-0.5 rounded-md ${stage.badgeBg}`}>
              {stage.percent}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-50 text-[11px] text-slate-400 text-center font-medium">
        Applicant tracking synchronized with active vacancies
      </div>
    </div>
  )
}

export default TotalApplicationsProgressCard
