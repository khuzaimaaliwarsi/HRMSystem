import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function GaugeMetricCard({
  title = 'Average Time to Fill (Days)',
  target = 'Target: < 20 days (On Track)',
  value = 14,
  max = 180,
  caption = 'Simulate Pulse',
  className = ''
}) {
  const [isMounted, setIsMounted] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)
  const [displayValue, setDisplayValue] = useState(0)

  // Semi-circle gauge dimensions
  const radius = 46
  const circumference = Math.PI * radius
  const normalizedValue = Math.min(Math.max(value, 0), max)
  const progressRatio = normalizedValue / max

  // Trigger smooth entrance animation on mount / reload / module navigation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true)
      setDisplayValue(value)
    }, 60)
    return () => clearTimeout(timer)
  }, [value])

  const strokeDashoffset = isMounted
    ? circumference * (1 - progressRatio)
    : circumference

  const handleSimulatePulse = () => {
    setIsPulsing(true)
    setIsMounted(false)
    setTimeout(() => {
      setIsMounted(true)
    }, 50)
    setTimeout(() => {
      setIsPulsing(false)
    }, 800)
  }

  return (
    <div className={cn("bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between text-left transition-all hover:shadow-md", className)}>
      {/* Title & Target */}
      <div>
        <h4 className="text-[13px] font-bold text-slate-900 tracking-tight">
          {title}
        </h4>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {target}
        </p>
      </div>

      {/* SVG Semi-Circle Gauge */}
      <div className={cn("relative flex flex-col items-center justify-center my-3 transition-transform", isPulsing && "animate-pulse-gauge")}>
        <svg viewBox="0 0 120 70" className="w-40 h-22 overflow-visible">
          {/* Background Track Arc */}
          <path
            d="M 14 62 A 46 46 0 0 1 106 62"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="9"
            strokeLinecap="round"
          />

          {/* Active Blue Accent Arc */}
          <path
            d="M 14 62 A 46 46 0 0 1 106 62"
            fill="none"
            stroke="#1A56DB"
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="chart-stroke-transition"
          />
        </svg>

        {/* Center Big Value (matching screenshot: just big bold number, no extra text) */}
        <div className="absolute bottom-1 text-center select-none">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
            {isMounted ? displayValue : 0}
          </span>
        </div>
      </div>

      {/* Footer Strip with 0, Simulate Pulse button, 180 */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-medium">0</span>
        <button
          type="button"
          onClick={handleSimulatePulse}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors focus:outline-none cursor-pointer"
        >
          {caption}
        </button>
        <span className="font-medium">{max}</span>
      </div>
    </div>
  )
}

export default GaugeMetricCard

