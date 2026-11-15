import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function TenureAgingCard({
  title = 'Workforce Service & Tenure Aging',
  subtitle = 'Employee probation & retention milestones',
  className = ''
}) {
  const [isMounted, setIsMounted] = useState(false)

  // Exact data values matching the reference screenshot 1
  const buckets = [
    { label: '<30 Days', value: '1.75M', num: 1.75 },
    { label: '<60 Days', value: '1.63M', num: 1.63 },
    { label: '<90 Days', value: '0.97M', num: 0.97 },
    { label: '>90 Days', value: '0.09M', num: 0.09 }
  ]

  const maxVal = 2.0 // scale ceiling

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn("bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between text-left transition-all hover:shadow-md", className)}>
      {/* Header matching screenshot */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-[13px] font-bold text-slate-900 tracking-tight">
            {title}
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-blue-50/80 text-blue-700 border border-blue-200/90 font-semibold tracking-wide">
          Cohort Active
        </span>
      </div>

      {/* Bar Chart Representation with staggered candle animation */}
      <div className="grid grid-cols-4 gap-3 items-end h-28 my-3 pt-4">
        {buckets.map((b, idx) => {
          const targetHeightPercent = Math.round((b.num / maxVal) * 100)
          const currentHeight = isMounted ? `${targetHeightPercent}%` : '0%'

          return (
            <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group">
              <span
                style={{
                  opacity: isMounted ? 1 : 0,
                  transition: `opacity 0.4s ease-out ${idx * 120 + 200}ms`
                }}
                className="text-[11px] font-bold text-slate-900 leading-none select-none"
              >
                {b.value}
              </span>
              <div
                style={{
                  height: currentHeight,
                  transition: `height 0.8s cubic-bezier(0.34, 1.4, 0.64, 1) ${idx * 100}ms`
                }}
                className="w-full bg-[#1A56DB] rounded-t-sm shadow-xs group-hover:bg-blue-700 transition-colors cursor-pointer"
                title={`${b.label}: ${b.value}`}
              />
              <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap mt-0.5">
                {b.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer Insight matching screenshot 1 */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Concentration in &lt;60 days cohort</span>
        <span className="font-bold text-blue-600">92.4% Onboarding Rate</span>
      </div>
    </div>
  )
}

export default TenureAgingCard

