import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function WorkforcePayrollRevenueCard({ className = '' }) {
  // Mount state for initial smooth animation, defaults to true for immediate paint
  const [isMounted, setIsMounted] = useState(false)

  // Exact 12-month data matching the user's reference Screenshot 2 (100% fidelity)
  const monthsData = [
    { m: 'Jan', rev: 7.2, cost: 0.73, pct: '10.2%' },
    { m: 'Feb', rev: 7.5, cost: 0.83, pct: '11.1%' },
    { m: 'Mar', rev: 7.1, cost: 0.70, pct: '9.9%' },
    { m: 'Apr', rev: 7.9, cost: 0.85, pct: '10.7%' },
    { m: 'May', rev: 7.5, cost: 0.74, pct: '9.8%' },
    { m: 'Jun', rev: 7.0, cost: 0.79, pct: '11.3%' },
    { m: 'Jul', rev: 7.6, cost: 0.87, pct: '11.5%' },
    { m: 'Aug', rev: 7.9, cost: 0.85, pct: '10.8%' },
    { m: 'Sep', rev: 6.8, cost: 0.73, pct: '10.7%' },
    { m: 'Oct', rev: 7.4, cost: 0.89, pct: '12%' },
    { m: 'Nov', rev: 7.7, cost: 0.81, pct: '10.5%' },
    { m: 'Dec', rev: 7.5, cost: 0.86, pct: '11.4%' }
  ]

  const maxRev = 8.2 // 8.2M ceiling reference for realistic ~90-95% fill on tall bars

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Precise SVG dimensions for the trend line overlay
  const svgWidth = 600
  const svgHeight = 170
  const colWidth = svgWidth / monthsData.length // 50px per column
  const topY = 16
  const bottomY = 160

  const linePoints = monthsData.map((d, idx) => {
    const x = idx * colWidth + colWidth / 2 // Centered right over the two bars
    const val = parseFloat(d.pct)
    const y = bottomY - (val / 15.0) * (bottomY - topY)
    return { x, y, pct: d.pct, m: d.m }
  })

  const pathD = linePoints.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
  }, '')

  const totalLength = 800

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-sm flex flex-col justify-between text-left transition-all hover:shadow-md',
        className
      )}
    >
      {/* Header and Legend matching reference screenshot 100% */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <h4 className="text-[13px] font-bold text-slate-900 tracking-tight">
          Workforce Payroll Cost vs Revenue
        </h4>
        <div className="flex items-center gap-3.5 text-[11px] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#0284c7] inline-block shadow-2xs" />
            <span className="text-slate-700 font-medium">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#1d4ed8] inline-block shadow-2xs" />
            <span className="text-slate-700 font-medium">Payroll Cost</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-[#d97706] inline-block" />
            <span className="text-slate-700 font-medium">— Cost %</span>
          </div>
        </div>
      </div>

      {/* Main Chart Area with Dual Y-Axes */}
      <div className="relative pt-4 pb-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-stretch min-w-[540px]">
          {/* Left Y-Axis: 8M, 6M, 4M, 2M, 0M */}
          <div className="flex flex-col justify-between text-[9.5px] text-slate-400 font-mono pr-2.5 h-[170px] select-none text-right shrink-0">
            <span>8M</span>
            <span>6M</span>
            <span>4M</span>
            <span>2M</span>
            <span>0M</span>
          </div>

          {/* Central Plot Area: Grid lines + Double Candle Bars + SVG Trend Line */}
          <div className="relative flex-1">
            {/* 170px explicit height container guarantees bars NEVER collapse */}
            <div className="relative w-full h-[170px] border-b border-slate-200">
              {/* Horizontal grid lines */}
              <div className="absolute inset-x-0 top-0 border-b border-slate-100" />
              <div className="absolute inset-x-0 top-[25%] border-b border-slate-100" />
              <div className="absolute inset-x-0 top-[50%] border-b border-slate-100" />
              <div className="absolute inset-x-0 top-[75%] border-b border-slate-100" />

              {/* Candle Bars Container */}
              <div className="absolute inset-0 flex items-end justify-between z-0">
                {monthsData.map((d, idx) => {
                  // Revenue percentage height (tall sky/cyan bar)
                  const revHeightPercent = Math.min(Math.round((d.rev / maxRev) * 100), 100)
                  // Payroll cost percentage height (short royal blue bar ~9-11%)
                  const costHeightPercent = Math.max(Math.round((d.cost / maxRev) * 100), 9)

                  return (
                    <div
                      key={d.m}
                      className="flex-1 flex flex-col items-center justify-end h-full group"
                    >
                      <div className="flex items-end justify-center gap-1 w-full h-full pb-0.5">
                        {/* Taller Cyan / Sky Blue Revenue Bar */}
                        <div
                          style={{
                            height: isMounted ? `${revHeightPercent}%` : `${revHeightPercent * 0.15}%`,
                            transition: `height 0.8s cubic-bezier(0.34, 1.25, 0.64, 1) ${idx * 30}ms`
                          }}
                          className="w-2 sm:w-2.5 md:w-3 bg-[#0284c7] hover:bg-sky-600 rounded-t-xs shadow-xs transition-colors cursor-pointer"
                          title={`${d.m} Revenue: $${d.rev}M`}
                        />

                        {/* Shorter Deep Blue Payroll Cost Bar */}
                        <div
                          style={{
                            height: isMounted ? `${costHeightPercent}%` : `${costHeightPercent * 0.2}%`,
                            transition: `height 0.8s cubic-bezier(0.34, 1.25, 0.64, 1) ${idx * 30 + 15}ms`
                          }}
                          className="w-2 sm:w-2.5 md:w-2.5 bg-[#1d4ed8] hover:bg-blue-800 rounded-t-xs shadow-xs transition-colors cursor-pointer"
                          title={`${d.m} Payroll: $${d.cost}M (${d.pct})`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Overlay Trend Line SVG */}
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
              >
                {/* Gold / Amber Trend Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={totalLength}
                  strokeDashoffset={isMounted ? 0 : totalLength}
                  className="transition-all duration-1000 ease-out"
                />

                {/* Circular dots and data labels above each point matching screenshot */}
                {linePoints.map((pt, idx) => (
                  <g
                    key={idx}
                    style={{
                      opacity: isMounted ? 1 : 0,
                      transition: `opacity 0.35s ease-out ${idx * 30 + 250}ms`
                    }}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="3"
                      fill="#d97706"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 6}
                      fontSize="8.5"
                      fill="#b45309"
                      textAnchor="middle"
                      fontWeight="700"
                      className="select-none"
                    >
                      {pt.pct}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Month Labels along bottom aligned with each column */}
            <div className="flex items-center justify-between h-6 text-[10px] text-slate-500 font-medium pt-1.5">
              {monthsData.map((d) => (
                <div key={d.m} className="flex-1 text-center">
                  {d.m}
                </div>
              ))}
            </div>
          </div>

          {/* Right Y-Axis: 15%, 10%, 5%, 0% */}
          <div className="flex flex-col justify-between text-[9.5px] text-slate-400 font-mono pl-2.5 h-[170px] select-none text-left shrink-0">
            <span>15%</span>
            <span>10%</span>
            <span>5%</span>
            <span>0%</span>
          </div>
        </div>
      </div>

      {/* Footer matching reference screenshot 100% */}
      <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Payroll cost ratio stays balanced within healthy 10-12% bandwidth</span>
        <span className="text-[#0f766e] font-bold">10.9% Average</span>
      </div>
    </div>
  )
}

export default WorkforcePayrollRevenueCard
