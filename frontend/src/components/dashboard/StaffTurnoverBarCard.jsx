import React from 'react'

export function StaffTurnoverBarCard() {
  const monthlyData = [
    { month: 'Jan', value: 78 },
    { month: 'Feb', value: 95 },
    { month: 'Mar', value: 148 },
    { month: 'Apr', value: 210 },
    { month: 'May', value: 138 },
    { month: 'Jun', value: 228 },
    { month: 'Jul', value: 298 },
    { month: 'Aug', value: 278 },
    { month: 'Sep', value: 128 }
  ]

  const maxVal = 300

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-[0_2px_12px_-3px_rgba(0,43,73,0.06)] hover:shadow-md transition-shadow flex flex-col justify-between text-left h-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-800 font-bold text-sm md:text-base tracking-tight">
          Staff turnover
        </span>
        <span className="text-[11px] font-medium text-slate-400">
          Monthly Index • 2026
        </span>
      </div>

      {/* Bar Chart Area */}
      <div className="relative pt-2 pb-1">
        <div className="flex">
          {/* Y-Axis Labels */}
          <div className="flex flex-col justify-between h-48 text-[10px] font-mono text-slate-400 pr-2 shrink-0 select-none pb-5">
            <span>300</span>
            <span>200</span>
            <span>100</span>
            <span>0</span>
          </div>

          {/* Bars Area with horizontal gridlines */}
          <div className="relative flex-1 h-48 flex flex-col justify-between">
            {/* Gridlines */}
            <div className="absolute inset-x-0 top-0 border-b border-dashed border-slate-100" />
            <div className="absolute inset-x-0 top-[33.3%] border-b border-dashed border-slate-100" />
            <div className="absolute inset-x-0 top-[66.6%] border-b border-dashed border-slate-100" />
            <div className="absolute inset-x-0 bottom-5 border-b border-slate-200" />

            {/* Bars */}
            <div className="relative h-[calc(100%-20px)] flex items-end justify-between px-2 sm:px-4 z-10">
              {monthlyData.map((d) => {
                const heightPercent = Math.round((d.value / maxVal) * 100)

                return (
                  <div key={d.month} className="flex flex-col items-center flex-1 group">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-3 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded shadow z-20 whitespace-nowrap">
                      {d.month}: {d.value} index
                    </div>

                    {/* Single Vertical Bar (Brand Theme Royal Blue) */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-5 sm:w-7 bg-blue-600/90 hover:bg-blue-600 rounded-t-md transition-all duration-300 shadow-sm"
                      title={`${d.month}: ${d.value}`}
                    />
                  </div>
                )
              })}
            </div>

            {/* X-Axis Month Labels */}
            <div className="flex items-center justify-between px-2 sm:px-4 h-5 text-[11px] text-slate-500 font-medium">
              {monthlyData.map((d) => (
                <div key={d.month} className="flex-1 text-center">
                  {d.month}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-50 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Workforce movement index</span>
        <span className="font-semibold text-slate-600">Peak Q3: Jul (298)</span>
      </div>
    </div>
  )
}

export default StaffTurnoverBarCard
