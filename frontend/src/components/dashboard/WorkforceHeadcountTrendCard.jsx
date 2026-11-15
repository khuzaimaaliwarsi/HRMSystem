import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function WorkforceHeadcountTrendCard({
  title = 'Workforce Headcount & Hiring Trend',
  subtitle = 'Monthly talent expansion index',
  className = ''
}) {
  const [isMounted, setIsMounted] = useState(false)

  // 11 monthly points matching the user Screenshot 1 (Feb through Dec)
  const data = [
    { m: 'Feb', val: 1.8, label: '1.8M' },
    { m: 'Mar', val: 2.7, label: '2.7M' },
    { m: 'Apr', val: 2.9, label: '2.9M' },
    { m: 'May', val: 2.1, label: '2.1M' },
    { m: 'Jun', val: 2.2, label: '2.2M' },
    { m: 'Jul', val: 1.8, label: '1.8M' },
    { m: 'Aug', val: 2.8, label: '2.8M' },
    { m: 'Sep', val: 2.1, label: '2.1M' },
    { m: 'Oct', val: 1.9, label: '1.9M' },
    { m: 'Nov', val: 2.8, label: '2.8M' },
    { m: 'Dec', val: 2.8, label: '2.8M' }
  ]

  const minVal = 1.7
  const maxVal = 3.0
  const height = 65
  const width = 340

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Calculate coordinates
  const points = data.map((d, idx) => {
    const x = (idx / (data.length - 1)) * (width - 36) + 18
    const y = height - ((d.val - minVal) / (maxVal - minVal)) * (height - 24) - 8
    return { ...d, x, y }
  })

  const pathD = points.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
  }, '')

  // Approximate path length for SVG line drawing animation
  const totalLength = 500

  return (
    <div className={cn("bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between text-left transition-all hover:shadow-md", className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-[13px] font-bold text-slate-900 tracking-tight">
            {title}
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 tracking-wide">
          +12.4% YoY
        </span>
      </div>

      {/* SVG Trend Line with animation */}
      <div className="relative my-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <svg viewBox={`0 0 ${width} ${height + 26}`} className="w-full h-28 overflow-visible">
          {/* Area gradient under line */}
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${height + 6} L ${points[0].x} ${height + 6} Z`}
            fill="#EBF3FE"
            opacity={isMounted ? 0.65 : 0}
            className="transition-opacity duration-1000 ease-out"
          />

          {/* Animated Trend Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#1A56DB"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={totalLength}
            strokeDashoffset={isMounted ? 0 : totalLength}
            className="transition-all duration-1000 ease-out"
          />

          {/* Data Points, Top Value Pills & Month Labels */}
          {points.map((pt, idx) => (
            <g
              key={idx}
              className="cursor-pointer group"
              style={{
                opacity: isMounted ? 1 : 0,
                transition: `opacity 0.4s ease-out ${idx * 60 + 300}ms`
              }}
            >
              {/* Value label above node */}
              <text
                x={pt.x}
                y={pt.y - 7}
                fontSize="7.5"
                fill="#1E293B"
                textAnchor="middle"
                fontWeight="700"
              >
                {pt.label}
              </text>

              {/* Node dot */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#FFFFFF"
                stroke="#1A56DB"
                strokeWidth="2.5"
                className="transition-transform group-hover:scale-150"
              />

              {/* Month label below */}
              <text
                x={pt.x}
                y={height + 20}
                fontSize="9"
                fill="#64748B"
                textAnchor="middle"
                fontWeight="500"
              >
                {pt.m}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Footer */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Annual organizational growth trajectory</span>
        <span className="font-semibold text-slate-900">2.8M peak staffing capacity</span>
      </div>
    </div>
  )
}

export default WorkforceHeadcountTrendCard

