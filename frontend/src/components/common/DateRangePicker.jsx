import React, { useState, useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function formatDate(d) {
  const day = d.getDate()
  const m = MONTH_NAMES[d.getMonth()]
  const y = d.getFullYear()
  return `${day} ${m} ${y}`
}

function toIsoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/**
 * iSysware HRMS — Dynamic Calendar & Date Range Picker
 * Automatically aligns to real current month/year, provides instant presets,
 * and allows users to pick any custom date range or jump to any month/year.
 */
export function DateRangePicker({
  value,
  onChange,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Current system date calculations
  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonthIdx = now.getMonth()
  const currentQuarter = Math.floor(currentMonthIdx / 3) + 1

  // Dynamic presets based on real time
  const presets = useMemo(() => {
    // 1. This Month
    const thisMonthDays = getDaysInMonth(currentYear, currentMonthIdx)
    const thisMonthLabel = `This Month (${MONTH_NAMES[currentMonthIdx]} ${currentYear})`
    const thisMonthValue = `1 ${MONTH_NAMES[currentMonthIdx]} ${currentYear} - ${thisMonthDays} ${MONTH_NAMES[currentMonthIdx]} ${currentYear}`

    // 2. Last 30 Days (Rolling)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const rolling30Value = `${formatDate(thirtyDaysAgo)} - ${formatDate(now)}`

    // 3. Current Quarter
    const qStartMonthIdx = (currentQuarter - 1) * 3
    const qEndMonthIdx = qStartMonthIdx + 2
    const qEndDays = getDaysInMonth(currentYear, qEndMonthIdx)
    const quarterValue = `1 ${MONTH_NAMES[qStartMonthIdx]} ${currentYear} - ${qEndDays} ${MONTH_NAMES[qEndMonthIdx]} ${currentYear}`

    // 4. Year to Date (YTD)
    const ytdValue = `1 Jan ${currentYear} - ${formatDate(now)}`

    // 5. Full Current Year
    const thisYearValue = `1 Jan ${currentYear} - 31 Dec ${currentYear}`

    // 6. Previous Month
    const prevMonthDate = new Date(currentYear, currentMonthIdx - 1, 1)
    const prevY = prevMonthDate.getFullYear()
    const prevMIdx = prevMonthDate.getMonth()
    const prevDays = getDaysInMonth(prevY, prevMIdx)
    const prevMonthLabel = `Last Month (${MONTH_NAMES[prevMIdx]} ${prevY})`
    const prevMonthValue = `1 ${MONTH_NAMES[prevMIdx]} ${prevY} - ${prevDays} ${MONTH_NAMES[prevMIdx]} ${prevY}`

    return [
      { id: 'this_month', label: thisMonthLabel, range: thisMonthValue, badge: 'Current' },
      { id: 'rolling_30', label: 'Last 30 Days (Rolling)', range: rolling30Value, badge: '30 Days' },
      { id: 'this_quarter', label: `Current Quarter (Q${currentQuarter})`, range: quarterValue, badge: `Q${currentQuarter}` },
      { id: 'ytd', label: `Year to Date (YTD ${currentYear})`, range: ytdValue, badge: 'YTD' },
      { id: 'this_year', label: `Full Year (${currentYear})`, range: thisYearValue, badge: 'Annual' },
      { id: 'last_month', label: prevMonthLabel, range: prevMonthValue, badge: 'Previous' }
    ]
  }, [now, currentYear, currentMonthIdx, currentQuarter])

  // Custom date state
  const [customStart, setCustomStart] = useState(() => toIsoDate(new Date(currentYear, currentMonthIdx, 1)))
  const [customEnd, setCustomEnd] = useState(() => toIsoDate(now))
  const [customYear, setCustomYear] = useState(currentYear)
  const [customMonth, setCustomMonth] = useState(currentMonthIdx)
  const [activeTab, setActiveTab] = useState('presets') // 'presets' | 'custom'

  // Close popup on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Quick jump by month/year selector
  const handleQuickMonthSelect = (mIdx, yr) => {
    const days = getDaysInMonth(yr, mIdx)
    const newRange = `1 ${MONTH_NAMES[mIdx]} ${yr} - ${days} ${MONTH_NAMES[mIdx]} ${yr}`
    onChange?.(newRange)
    setIsOpen(false)
  }

  // Handle custom range submission
  const handleApplyCustom = (e) => {
    e?.preventDefault()
    if (!customStart || !customEnd) return
    const sDate = new Date(customStart)
    const eDate = new Date(customEnd)
    if (sDate > eDate) {
      const formatted = `${formatDate(eDate)} - ${formatDate(sDate)}`
      onChange?.(formatted)
    } else {
      const formatted = `${formatDate(sDate)} - ${formatDate(eDate)}`
      onChange?.(formatted)
    }
    setIsOpen(false)
  }

  // Display label resolution
  const displayLabel = useMemo(() => {
    if (!value) return presets[0].range
    // Match preset if possible
    const match = presets.find((p) => p.range === value || p.label === value)
    if (match) return match.range
    return value
  }, [value, presets])

  return (
    <div className={cn('relative inline-block text-left select-none', className)} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          isOpen && 'border-blue-500 ring-2 ring-blue-500/20'
        )}
        title="Change calendar filter & date range"
        aria-expanded={isOpen}
      >
        <div className="w-5 h-5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <span className="truncate max-w-[210px] text-slate-800 font-bold">{displayLabel}</span>

        <svg
          className={cn('w-3.5 h-3.5 text-slate-400 ml-0.5 transition-transform duration-200', isOpen && 'rotate-180 text-blue-600')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu Modal */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2.5 z-50 text-xs font-medium text-slate-700 animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header Mode Switcher Tabs */}
          <div className="flex items-center justify-between px-3.5 pb-2.5 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Calendar Filter
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={cn(
                  'px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer',
                  activeTab === 'presets' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Quick Presets
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={cn(
                  'px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer',
                  activeTab === 'custom' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Custom Range
              </button>
            </div>
          </div>

          {/* TAB 1: Quick Presets */}
          {activeTab === 'presets' && (
            <div className="py-1 max-h-[340px] overflow-y-auto">
              <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Current Time Presets
              </div>
              {presets.map((preset) => {
                const isSelected = value === preset.range || value === preset.label
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onChange?.(preset.range)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group',
                      isSelected && 'bg-blue-50/70 text-blue-600 font-bold'
                    )}
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {preset.range}
                      </span>
                    </div>

                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-bold',
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'
                      )}
                    >
                      {preset.badge}
                    </span>
                  </button>
                )
              })}

              {/* Jump to Any Month (Current Year) */}
              <div className="mt-2 pt-2 border-t border-slate-100 px-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Jump to Month ({currentYear})
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {MONTH_NAMES.map((m, idx) => {
                    const isCurrent = idx === currentMonthIdx
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleQuickMonthSelect(idx, currentYear)}
                        className={cn(
                          'py-1 text-center rounded-lg text-xs font-semibold transition-all cursor-pointer border',
                          isCurrent
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-50 border-slate-200/60 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                        )}
                        title={`Select all of ${FULL_MONTH_NAMES[idx]} ${currentYear}`}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Custom Date Range Picker */}
          {activeTab === 'custom' && (
            <form onSubmit={handleApplyCustom} className="p-3.5 space-y-3">
              <div className="text-[11px] font-bold text-slate-600">
                Pick Exact Start & End Dates:
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Quick Specific Year & Month Jumper */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Or Select Full Month by Year:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={customMonth}
                    onChange={(e) => setCustomMonth(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {FULL_MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>

                  <select
                    value={customYear}
                    onChange={(e) => setCustomYear(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickMonthSelect(customMonth, customYear)}
                  className="mt-2 w-full py-1 text-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Apply {FULL_MONTH_NAMES[customMonth]} {customYear}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const thisMonthDays = getDaysInMonth(currentYear, currentMonthIdx)
                    const thisMonthValue = `1 ${MONTH_NAMES[currentMonthIdx]} ${currentYear} - ${thisMonthDays} ${MONTH_NAMES[currentMonthIdx]} ${currentYear}`
                    onChange?.(thisMonthValue)
                    setIsOpen(false)
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Apply Custom Range
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export default DateRangePicker
