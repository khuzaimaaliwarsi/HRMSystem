import React from 'react'

export function WorkingFormatDonutCard({ totalCount = 108, remoteCount = 42, _onSiteCount = 66 }) {
  const total = totalCount || 108
  const remote = remoteCount || 42

  const remotePercent = Math.round((remote / total) * 100)
  const onSitePercent = 100 - remotePercent

  // SVG Donut calculation
  const radius = 62
  const circumference = 2 * Math.PI * radius
  const remoteStroke = (remotePercent / 100) * circumference
  const onSiteStroke = (onSitePercent / 100) * circumference

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-[0_2px_12px_-3px_rgba(0,43,73,0.06)] hover:shadow-md transition-shadow flex flex-col justify-between text-left h-full">
      <div className="text-slate-800 font-bold text-sm md:text-base tracking-tight mb-4">
        Working Format
      </div>

      {/* Donut Chart with Center Text */}
      <div className="relative flex items-center justify-center my-3">
        <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 160 160">
          {/* Background circle track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            className="text-slate-100"
            strokeWidth="16"
            stroke="currentColor"
            fill="transparent"
          />
          {/* On Site Segment (Soft Blue / Sky) */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#BAE6FD"
            strokeWidth="16"
            strokeDasharray={`${onSiteStroke} ${circumference}`}
            strokeDashoffset="0"
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
          {/* Remote Segment (Royal Blue / Navy Accent) */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#2563EB"
            strokeWidth="16"
            strokeDasharray={`${remoteStroke} ${circumference}`}
            strokeDashoffset={-onSiteStroke}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Text inside Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total
          </span>
          <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
            {total}
          </span>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-50 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
          <span className="font-semibold text-slate-700">Remote</span>
          <span className="text-slate-400 text-[11px] font-mono">({remotePercent}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-200 shrink-0" />
          <span className="font-semibold text-slate-700">On Site</span>
          <span className="text-slate-400 text-[11px] font-mono">({onSitePercent}%)</span>
        </div>
      </div>
    </div>
  )
}

export default WorkingFormatDonutCard
