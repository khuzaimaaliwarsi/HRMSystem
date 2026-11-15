import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function HeadcountDonutCard({
  title = 'Headcount',
  data = { total: 562, female: 186, male: 376, femalePercent: 33.1, malePercent: 66.9 },
  className = ''
}) {
  const [isMounted, setIsMounted] = useState(false)

  // Explicit values from user's screenshot 1
  const total = data?.total || 562
  const femaleCount = data?.female || 186
  const maleCount = data?.male || 376
  const femalePct = data?.femalePercent || 33.1
  const malePct = data?.malePercent || 66.9

  // Donut geometry: radius 44, circumference = 2 * PI * 44 = 276.46
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const femaleRatio = femaleCount / total
  const maleRatio = maleCount / total

  const femaleArc = circumference * femaleRatio
  const maleArc = circumference * maleRatio

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn("bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between text-left h-full transition-all hover:shadow-md", className)}>
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h4 className="text-[13px] font-bold text-slate-900 tracking-tight">
          {title}
        </h4>
        <span className="text-[11px] font-mono text-slate-400">
          {total} Total
        </span>
      </div>

      {/* Main Donut and Metrics Container matching Screenshot 1 */}
      <div className="flex items-center justify-between gap-2 my-auto py-2">
        {/* Left: Female */}
        <div className="flex flex-col text-left shrink-0 pl-1">
          <span className="text-[10px] uppercase font-bold text-[#E11D48] tracking-wider">
            FEMALE
          </span>
          <span className="text-xl font-black text-rose-600 leading-tight mt-0.5">
            {femaleCount}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            ({femalePct}%)
          </span>
        </div>

        {/* Center Donut SVG */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg viewBox="0 0 110 110" className="w-28 h-28 sm:w-32 sm:h-32 transform -rotate-90">
            {/* Background ring */}
            <circle
              cx="55"
              cy="55"
              r={radius}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth="12"
            />

            {/* Male arc (Blue) */}
            <circle
              cx="55"
              cy="55"
              r={radius}
              fill="none"
              stroke="#1A56DB"
              strokeWidth="12"
              strokeDasharray={`${isMounted ? maleArc : 0} ${circumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              className="chart-stroke-transition"
            />

            {/* Female arc (Coral/Rose) */}
            <circle
              cx="55"
              cy="55"
              r={radius}
              fill="none"
              stroke="#E11D48"
              strokeWidth="12"
              strokeDasharray={`${isMounted ? femaleArc : 0} ${circumference}`}
              strokeDashoffset={isMounted ? -maleArc : 0}
              strokeLinecap="round"
              className="chart-stroke-transition"
            />
          </svg>

          {/* Donut Center Display */}
          <div className="absolute text-center select-none">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none block">
              {total}
            </span>
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mt-0.5 block">
              TOTAL
            </span>
          </div>
        </div>

        {/* Right: Male & Legend matching Screenshot 1 */}
        <div className="flex flex-col text-left shrink-0 pr-1 space-y-1.5">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#1A56DB] tracking-wider block">
              MALE
            </span>
            <span className="text-xl font-black text-blue-600 leading-tight mt-0.5 block">
              {maleCount}
            </span>
            <span className="text-[11px] text-slate-400 font-medium block">
              ({malePct}%)
            </span>
          </div>

          <div className="pt-1 border-t border-slate-100">
            <span className="text-[8.5px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
              HEADCOUNT TYPE
            </span>
            <div className="space-y-0.5 text-[10px] font-medium">
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-[#E11D48] inline-block shrink-0" />
                <span>Female</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-[#1A56DB] inline-block shrink-0" />
                <span>Male</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer matching screenshot */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Diversity and gender parity representation</span>
        <span className="font-semibold text-emerald-700 bg-emerald-50/60 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
          Compliant EEOC
        </span>
      </div>
    </div>
  )
}

export default HeadcountDonutCard

