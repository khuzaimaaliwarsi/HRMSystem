import React from 'react'

export function ProjectEmploymentBarCard() {
  // 7 days data matching visual proportions in user reference screenshot
  const daysData = [
    { day: 'Sun', project: 75, bench: 45 },
    { day: 'Mon', project: 90, bench: 65 },
    { day: 'Tur', project: 145, bench: 125 },
    { day: 'Wed', project: 205, bench: 165 },
    { day: 'Thu', project: 135, bench: 85 },
    { day: 'Fri', project: 225, bench: 170 },
    { day: 'Sat', project: 290, bench: 250 }
  ]

  const maxVal = 300

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-[0_2px_12px_-3px_rgba(0,43,73,0.06)] hover:shadow-md transition-shadow flex flex-col justify-between text-left h-full">
      <div className="text-slate-800 font-bold text-sm md:text-base tracking-tight mb-4">
        Project employment
      </div>

      {/* Chart container with Y-Axis grid lines */}
      <div className="relative pt-2 pb-1">
        <div className="flex">
          {/* Y-Axis Labels */}
          <div className="flex flex-col justify-between h-44 text-[10px] font-mono text-slate-400 pr-2 shrink-0 select-none pb-5">
            <span>300</span>
            <span>200</span>
            <span>100</span>
            <span>0</span>
          </div>

          {/* Bars Area with horizontal gridlines */}
          <div className="relative flex-1 h-44 flex flex-col justify-between">
            {/* Gridlines */}
            <div className="absolute inset-x-0 top-0 border-b border-dashed border-slate-100" />
            <div className="absolute inset-x-0 top-[33.3%] border-b border-dashed border-slate-100" />
            <div className="absolute inset-x-0 top-[66.6%] border-b border-dashed border-slate-100" />
            <div className="absolute inset-x-0 bottom-5 border-b border-slate-200" />

            {/* Bars group */}
            <div className="relative h-[calc(100%-20px)] flex items-end justify-between px-1 sm:px-2 z-10">
              {daysData.map((d) => {
                const projectHeight = Math.round((d.project / maxVal) * 100)
                const benchHeight = Math.round((d.bench / maxVal) * 100)

                return (
                  <div key={d.day} className="flex flex-col items-center flex-1 group">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-3 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded shadow z-20 whitespace-nowrap">
                      {d.day}: Project {d.project} | Bench {d.bench}
                    </div>

                    {/* Dual Bars Side by Side */}
                    <div className="flex items-end gap-1 sm:gap-1.5 h-full">
                      {/* Project Bar (Brand Blue) */}
                      <div
                        style={{ height: `${projectHeight}%` }}
                        className="w-2.5 sm:w-3.5 bg-blue-600 rounded-t-sm transition-all duration-500 group-hover:brightness-110"
                        title={`Project: ${d.project}`}
                      />
                      {/* Bench Bar (Soft Sky Blue) */}
                      <div
                        style={{ height: `${benchHeight}%` }}
                        className="w-2.5 sm:w-3.5 bg-sky-200 rounded-t-sm transition-all duration-500 group-hover:brightness-105"
                        title={`Bench: ${d.bench}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* X-Axis Day Labels */}
            <div className="flex items-center justify-between px-1 sm:px-2 h-5 text-[11px] text-slate-500 font-medium">
              {daysData.map((d) => (
                <div key={d.day} className="flex-1 text-center">
                  {d.day}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="flex items-center justify-start gap-6 pt-4 border-t border-slate-50 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
          <span className="font-semibold text-slate-700">Project</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-200 shrink-0" />
          <span className="font-semibold text-slate-700">Bench</span>
        </div>
      </div>
    </div>
  )
}

export default ProjectEmploymentBarCard
