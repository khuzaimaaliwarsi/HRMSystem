import React, { useState, useMemo } from 'react'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import { cn } from '@/lib/utils'

export function LeaveCalendarView({
  events = [],
  calendarEvents = [],
  onRequestClick,
  onSelectRequest,
  initialYear = 2026,
  initialMonth = 11,
  _currentUser = null
}) {
  const allEvents = useMemo(() => {
    return events && events.length > 0 ? events : (Array.isArray(calendarEvents) ? calendarEvents : [])
  }, [events, calendarEvents])

  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth) // 1-indexed (10 = October)
  const [filterType, setFilterType] = useState('all') // 'all' | 'leave' | 'holiday'

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10))

  // Days in month calculation
  const calendarGrid = useMemo(() => {
    const firstDayDate = new Date(year, month - 1, 1)
    const totalDays = new Date(year, month, 0).getDate()

    // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    // Convert so Monday is index 0: (day + 6) % 7
    const startWeekday = (firstDayDate.getDay() + 6) % 7

    const days = []
    // Previous month padding
    for (let i = 0; i < startWeekday; i++) {
      days.push({ dayNumber: null, isCurrentMonth: false, dateStr: null })
    }
    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ dayNumber: d, isCurrentMonth: true, dateStr })
    }
    return days
  }, [year, month])

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  // Filter events by date and type
  const getEventsForDate = (dateStr) => {
    if (!dateStr) return []
    return allEvents.filter((ev) => {
      if (filterType !== 'all' && ev.type !== filterType) return false
      // Match if date falls within [startDate, endDate]
      return dateStr >= ev.startDate && dateStr <= ev.endDate
    })
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden text-left">
      {/* Calendar Control Header */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handlePrevMonth} className="p-2">
            <AppIcon name="chevronLeft" className="w-3.5 h-3.5" />
          </Button>

          <span className="text-sm font-black text-slate-900 tracking-tight min-w-[150px] text-center">
            {monthNames[month - 1]} {year}
          </span>

          <Button type="button" size="sm" variant="outline" onClick={handleNextMonth} className="p-2">
            <AppIcon name="chevronRight" className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                "px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer",
                filterType === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              All Events
            </button>
            <button
              type="button"
              onClick={() => setFilterType('leave')}
              className={cn(
                "px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer",
                filterType === 'leave' ? "bg-blue-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Leaves Only
            </button>
            <button
              type="button"
              onClick={() => setFilterType('holiday')}
              className={cn(
                "px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer",
                filterType === 'holiday' ? "bg-amber-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Holidays
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Columns Header */}
      <div className="grid grid-cols-7 border-b border-slate-200 text-center bg-slate-50 font-extrabold text-[10px] text-slate-500 uppercase tracking-widest py-2">
        {weekdays.map((w, idx) => (
          <div key={w} className={cn(idx >= 5 && "text-slate-400")}>
            {w}
          </div>
        ))}
      </div>

      {/* Calendar Grid Cells */}
      <div className="grid grid-cols-7 auto-rows-[100px] divide-x divide-y divide-slate-100">
        {calendarGrid.map((day, idx) => {
          if (!day.isCurrentMonth) {
            return (
              <div key={`empty-${idx}`} className="bg-slate-50/40 p-2 min-h-[90px]" />
            )
          }

          const dayEvents = getEventsForDate(day.dateStr)
          const isToday = day.dateStr === todayStr
          const isWeekend = idx % 7 >= 5

          return (
            <div
              key={day.dateStr}
              className={cn(
                "p-1.5 transition-colors overflow-y-auto [scrollbar-width:none] min-h-[90px] flex flex-col justify-between",
                isWeekend ? "bg-slate-50/60" : "bg-white",
                isToday && "ring-2 ring-inset ring-blue-500/50 bg-blue-50/20"
              )}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full",
                  isToday ? "bg-blue-600 text-white" : isWeekend ? "text-slate-400" : "text-slate-700"
                )}>
                  {day.dayNumber}
                </span>

                {isToday && (
                  <span className="text-[9px] font-extrabold text-blue-600 uppercase tracking-wider">
                    Today
                  </span>
                )}
              </div>

              {/* Day Events Stack */}
              <div className="space-y-1 mt-1 overflow-hidden">
                {dayEvents.slice(0, 2).map((ev) => {
                  const isHoliday = ev.type === 'holiday'
                  const handleAction = onSelectRequest || onRequestClick
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => !isHoliday && handleAction?.(ev)}
                      className={cn(
                        "w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate block transition-all",
                        isHoliday
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : ev.status === 'Approved'
                          ? "bg-blue-50 text-blue-800 border border-blue-200 hover:border-blue-400"
                          : "bg-amber-50 text-amber-800 border border-dashed border-amber-300"
                      )}
                      title={`${ev.title} (${ev.startDate} to ${ev.endDate})`}
                    >
                      {ev.title}
                    </button>
                  )
                })}

                {dayEvents.length > 2 && (
                  <span className="text-[9px] text-slate-500 font-bold block pl-1">
                    +{dayEvents.length - 2} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default LeaveCalendarView
