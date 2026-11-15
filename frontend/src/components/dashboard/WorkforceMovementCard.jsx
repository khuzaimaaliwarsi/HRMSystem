import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function WorkforceMovementCard({
  title = 'Net Monthly Workforce Movement',
  subtitle = 'New joiners onboarded vs employee exits',
  selectedMonth = 'Oct',
  onSelectMonth,
  className = ''
}) {
  const [isMounted, setIsMounted] = useState(false)

  // Exact data from screenshot: Jan -1.3M, Feb +1.6M, Mar -0.4M, Apr -1.2M, May -0.7M, Jun -1M, Jul -0.7M, Aug -0.9M, Sep -0.8M, Oct -0.3M, Nov +0.7M, Dec -1.7M
  const movements = [
    { month: 'Jan', val: -1.3, label: '-1.3M', isPositive: false },
    { month: 'Feb', val: 1.6, label: '1.6M', isPositive: true },
    { month: 'Mar', val: -0.4, label: '-0.4M', isPositive: false },
    { month: 'Apr', val: -1.2, label: '-1.2M', isPositive: false },
    { month: 'May', val: -0.7, label: '-0.7M', isPositive: false },
    { month: 'Jun', val: -1.0, label: '-1M', isPositive: false },
    { month: 'Jul', val: -0.7, label: '-0.7M', isPositive: false },
    { month: 'Aug', val: -0.9, label: '-0.9M', isPositive: false },
    { month: 'Sep', val: -0.8, label: '-0.8M', isPositive: false },
    { month: 'Oct', val: -0.3, label: '-0.3M', isPositive: false },
    { month: 'Nov', val: 0.7, label: '0.7M', isPositive: true },
    { month: 'Dec', val: -1.7, label: '-1.7M', isPositive: false }
  ]

  const maxVal = 2.0 // scale max absolute value

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 120)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn("bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-sm flex flex-col justify-between text-left transition-all hover:shadow-md", className)}>
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div>
          <h4 className="text-[13px] font-bold text-slate-900 tracking-tight">
            {title}
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981] inline-block" />
            <span className="text-slate-600">+ Net Joiners</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#F87171] inline-block" />
            <span className="text-slate-600">- Departures / Exits</span>
          </div>
        </div>
      </div>

      {/* Diverging Waterfall / Candle Bars */}
      <div className="pt-5 pb-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-12 gap-1.5 sm:gap-2.5 items-center min-w-[500px] h-44">
          {movements.map((item, idx) => {
            const heightPercent = Math.round((Math.abs(item.val) / maxVal) * 58)
            const isSelected = item.month.toLowerCase() === selectedMonth.toLowerCase()

            return (
              <div
                key={idx}
                onClick={() => onSelectMonth?.(item.month)}
                className={cn(
                  "flex flex-col items-center justify-between h-full rounded p-1 transition-all cursor-pointer group hover:bg-slate-50 select-none",
                  isSelected && "bg-blue-50/60 ring-1 ring-blue-300 rounded-md"
                )}
                title={`${item.month}: ${item.label}`}
              >
                {/* Upper Half: Positive Joiners */}
                <div className="flex-1 w-full flex flex-col justify-end items-center">
                  {item.isPositive && (
                    <>
                      <span
                        style={{
                          opacity: isMounted ? 1 : 0,
                          transition: `opacity 0.4s ease-out ${idx * 60 + 200}ms`
                        }}
                        className="text-[9.5px] font-bold text-emerald-800 leading-none mb-1.5"
                      >
                        {item.label}
                      </span>
                      <div
                        style={{
                          height: isMounted ? `${heightPercent}px` : '0px',
                          transition: `height 0.8s cubic-bezier(0.34, 1.4, 0.64, 1) ${idx * 60}ms`
                        }}
                        className="w-full max-w-[28px] bg-[#10B981] rounded-t-sm shadow-xs group-hover:brightness-95"
                      />
                    </>
                  )}
                </div>

                {/* Center Baseline */}
                <div className="w-full h-[1.5px] bg-slate-300 my-0.5" />

                {/* Lower Half: Negative Exits */}
                <div className="flex-1 w-full flex flex-col justify-start items-center">
                  {!item.isPositive && (
                    <>
                      <div
                        style={{
                          height: isMounted ? `${heightPercent}px` : '0px',
                          transition: `height 0.8s cubic-bezier(0.34, 1.4, 0.64, 1) ${idx * 60}ms`
                        }}
                        className="w-full max-w-[28px] bg-[#F87171] rounded-b-sm shadow-xs group-hover:brightness-95"
                      />
                      <span
                        style={{
                          opacity: isMounted ? 1 : 0,
                          transition: `opacity 0.4s ease-out ${idx * 60 + 200}ms`
                        }}
                        className="text-[9.5px] font-bold text-rose-700 leading-none mt-1.5"
                      >
                        {item.label}
                      </span>
                    </>
                  )}
                </div>

                {/* Month Label */}
                <span className="text-[10px] font-medium text-slate-500 mt-1">
                  {item.month}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer matching reference screenshot */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Workforce net retention baseline monitored monthly</span>
        <span className="font-semibold text-slate-900">12-Month Audited HR Flow</span>
      </div>
    </div>
  )
}

export default WorkforceMovementCard

