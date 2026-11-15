import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function AttendanceHealthCard({
  title = 'Workforce Attendance & Settlement Health',
  rate = 0,
  totalStaff = 0,
  presentCount = 0,
  onLeaveCount = 0,
  pendingReviews = 0,
  className = ''
}) {
  const navigate = useNavigate()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const targetWidth = `${Math.min(rate, 100)}%`

  return (
    <div className={cn("bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between text-left transition-all hover:shadow-md", className)}>
      {/* Header matching screenshot */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h4 className="text-[13px] font-bold text-slate-900 tracking-tight">
          {title}
        </h4>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Synced
        </span>
      </div>

      {/* Attendance Rate Progress Section */}
      <div className="my-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-800">
            Workforce Attendance Rate
          </span>
          <span className="text-sm font-black text-blue-600">
            {rate}%
          </span>
        </div>

        {/* Thick smooth progress bar */}
        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
          <div
            style={{
              width: isMounted ? targetWidth : '0%',
              transition: 'width 1s cubic-bezier(0.34, 1.25, 0.64, 1)'
            }}
            className="h-full rounded-full bg-[#1A56DB] shadow-xs"
          />
        </div>

        {/* Sub-text under progress bar */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-medium">
          <span>{presentCount} Present on shift</span>
          <span>{pendingReviews} Pending Reviews</span>
        </div>
      </div>

      {/* 3 Bottom Summary Metric Boxes matching screenshot */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        {/* Box 1: TOTAL STAFF */}
        <button
          type="button"
          onClick={() => navigate('/super-admin/employees')}
          className="bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200 rounded-lg p-3 text-center transition-all cursor-pointer focus:outline-none"
        >
          <span className="text-[9.5px] uppercase font-bold text-slate-500 block tracking-wider">
            TOTAL STAFF
          </span>
          <span className="text-lg font-black text-slate-900 mt-1 block leading-tight">
            {totalStaff}
          </span>
        </button>

        {/* Box 2: PRESENT TODAY */}
        <button
          type="button"
          onClick={() => navigate('/super-admin/attendance')}
          className="bg-emerald-50/40 hover:bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center transition-all cursor-pointer focus:outline-none"
        >
          <span className="text-[9.5px] uppercase font-bold text-emerald-800 block tracking-wider">
            PRESENT TODAY
          </span>
          <span className="text-lg font-black text-emerald-600 mt-1 block leading-tight">
            {presentCount}
          </span>
        </button>

        {/* Box 3: ON LEAVE / ABS */}
        <button
          type="button"
          onClick={() => navigate('/super-admin/leaves')}
          className="bg-amber-50/40 hover:bg-amber-50 border border-amber-200 rounded-lg p-3 text-center transition-all cursor-pointer focus:outline-none"
        >
          <span className="text-[9.5px] uppercase font-bold text-amber-800 block tracking-wider">
            ON LEAVE / ABS
          </span>
          <span className="text-lg font-black text-amber-600 mt-1 block leading-tight">
            {onLeaveCount}
          </span>
        </button>
      </div>
    </div>
  )
}

export default AttendanceHealthCard

