import React, { useState, useEffect, useMemo } from 'react'
import { payrollService } from '@/services/payrollService'
import { syncPayroll } from '@/services/backendSync'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_MONTH_NAMES = {
  Jan: 'January',
  Feb: 'February',
  Mar: 'March',
  Apr: 'April',
  May: 'May',
  Jun: 'June',
  Jul: 'July',
  Aug: 'August',
  Sep: 'September',
  Oct: 'October',
  Nov: 'November',
  Dec: 'December'
}

export function TalentzoPayrollOverviewCard({
  selectedDateRange = '1 Jan 2026 - 31 Dec 2026',
  onDateRangeChange
}) {
  const [selectedRange, setSelectedRange] = useState('This Year')
  const [isRangeOpen, setIsRangeOpen] = useState(false)
  const [runs, setRuns] = useState(() => payrollService.getPayrollRuns())

  // Determine active year dynamically from selectedDateRange
  const activeYear = useMemo(() => {
    const yrMatch = selectedDateRange?.match(/\b(20\d\d)\b/)
    if (yrMatch) return parseInt(yrMatch[1], 10)
    return new Date().getFullYear()
  }, [selectedDateRange])

  // Sync internal dropdown selection with selectedDateRange
  useEffect(() => {
    if (selectedDateRange?.includes('Last Month')) {
      setSelectedRange('Last Month')
    } else if (selectedDateRange?.includes('This Month')) {
      setSelectedRange('This Month')
    } else if (selectedDateRange?.includes('Last 30 Days')) {
      setSelectedRange('Last 30 Days')
    } else if (selectedDateRange?.includes('Quarter')) {
      setSelectedRange('Current Quarter')
    } else if (selectedDateRange?.includes('YTD')) {
      setSelectedRange('Year to Date')
    } else if (selectedDateRange?.includes('2025')) {
      setSelectedRange('Last Year')
    } else {
      setSelectedRange('This Year')
    }
  }, [selectedDateRange])

  // Dynamically resolve active month based on selectedDateRange or current date
  const [activeMonth, setActiveMonth] = useState(() => {
    const monthMatch = selectedDateRange ? MONTH_NAMES.find((m) => selectedDateRange.includes(m)) : null
    return monthMatch || MONTH_NAMES[new Date().getMonth()] || 'Nov'
  })

  useEffect(() => {
    const monthMatch = selectedDateRange ? MONTH_NAMES.find((m) => selectedDateRange.includes(m)) : null
    if (monthMatch) {
      setActiveMonth(monthMatch)
    } else {
      setActiveMonth(MONTH_NAMES[new Date().getMonth()] || 'Nov')
    }
  }, [selectedDateRange])

  useEffect(() => {
    // Sync live payroll runs from PostgreSQL on mount
    syncPayroll().then(() => {
      setRuns(payrollService.getPayrollRuns())
    })

    const unsub = payrollService.subscribe(() => {
      setRuns(payrollService.getPayrollRuns())
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [])

  const monthlyData = useMemo(() => {
    const map = {}
    MONTH_NAMES.forEach((m) => {
      map[m] = { month: m, cost: 0, expense: 0 }
    })

    if (Array.isArray(runs) && runs.length > 0) {
      for (const run of runs) {
        // Year filter
        const runYear =
          run.payrollPeriod?.year ||
          (run.period ? parseInt(String(run.period).slice(0, 4), 10) : null)

        if (runYear && runYear !== activeYear && !selectedDateRange?.includes('Rolling')) {
          continue
        }

        // Match month
        const periodMonth = run.payrollPeriod?.month
        let matchedMonth = null
        if (periodMonth && periodMonth >= 1 && periodMonth <= 12) {
          matchedMonth = MONTH_NAMES[periodMonth - 1]
        } else {
          const monthStr = run.periodName || run.month || run.period || ''
          matchedMonth = MONTH_NAMES.find((m) => monthStr.toLowerCase().includes(m.toLowerCase()))
        }

        if (matchedMonth) {
          const gross = Number(
            run.grossPayroll ??
            run.totalGross ??
            run.totalGrossSalary ??
            run.netPayable ??
            run.totalNet ??
            0
          )
          const exp = Number(
            run.totalTaxWithheld ??
            run.totalDeductions ??
            run.totalAllowances ??
            0
          )
          map[matchedMonth].cost += gross
          map[matchedMonth].expense += exp
        }
      }
    }

    return MONTH_NAMES.map((m) => map[m])
  }, [runs, activeYear, selectedDateRange])

  const maxVal = Math.max(...monthlyData.map((d) => d.cost + d.expense), 0)
  const maxScale = maxVal > 0 ? Math.max(120000, Math.ceil(maxVal * 1.25 / 10000) * 10000) : 100000

  const handleSelectOption = (option) => {
    setSelectedRange(option)
    setIsRangeOpen(false)
    if (option === 'Last Year') {
      onDateRangeChange?.('1 Jan 2025 - 31 Dec 2025')
    } else if (option === 'This Year') {
      onDateRangeChange?.('1 Jan 2026 - 31 Dec 2026')
    } else if (option === 'Last 6 Months') {
      onDateRangeChange?.('Current Quarter (Q4)')
    }
  }

  // Format currency labels for Y-axis
  const formatYAxis = (val) => {
    if (val >= 1000) {
      return `$${Math.round(val / 1000)}k`
    }
    return `$${val}`
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs text-left h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Payroll Overview</h2>
          <div className="flex items-center gap-3.5 mt-0.5 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
              <span>Cost</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-200 inline-block" />
              <span>Expense</span>
            </div>
          </div>
        </div>

        {/* Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsRangeOpen(!isRangeOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{selectedRange}</span>
            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isRangeOpen && (
            <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20 text-xs font-medium text-slate-700">
              {['This Year', 'Last Year', 'Last 6 Months'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 ${selectedRange === option ? 'text-blue-600 font-bold bg-blue-50/50' : ''}`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart Body */}
      <div className="mt-4 pt-1 relative flex-1 flex flex-col justify-end">
        <div className="relative h-48 flex">
          {/* Y-Axis Labels */}
          <div className="flex flex-col justify-between text-[11px] font-medium text-slate-400 pr-3 pb-6 shrink-0 w-12 text-right select-none">
            <span>{formatYAxis(maxScale)}</span>
            <span>{formatYAxis(Math.round(maxScale * 0.75))}</span>
            <span>{formatYAxis(Math.round(maxScale * 0.5))}</span>
            <span>{formatYAxis(Math.round(maxScale * 0.25))}</span>
            <span>$0</span>
          </div>

          {/* Grid lines and Bars */}
          <div className="relative flex-1 flex flex-col justify-between">
            {/* Horizontal Dashed Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
              <div className="border-b border-dashed border-slate-100 w-full" />
              <div className="border-b border-dashed border-slate-100 w-full" />
              <div className="border-b border-dashed border-slate-100 w-full" />
              <div className="border-b border-dashed border-slate-100 w-full" />
              <div className="border-b border-slate-200 w-full" />
            </div>

            {/* Bars Column Container */}
            <div className="relative flex-1 flex items-end justify-between px-1 sm:px-2 pb-6">
              {monthlyData.map((item) => {
                const isSelected = activeMonth === item.month
                const totalVal = Math.min(maxScale, item.cost + item.expense * 0.4)
                const heightPercent = totalVal > 0 ? Math.min(100, Math.max(8, Math.round((totalVal / maxScale) * 100))) : 0
                const expensePercent = totalVal > 0 && item.expense > 0 ? Math.min(45, Math.round(((item.expense * 0.4) / totalVal) * 100)) : 0
                const costPercent = 100 - expensePercent

                return (
                  <div
                    key={item.month}
                    className="relative flex flex-col items-center flex-1 h-full justify-end cursor-pointer group"
                    onMouseEnter={() => setActiveMonth(item.month)}
                  >
                    {/* Floating Tooltip */}
                    {isSelected && (
                      <div className="absolute -top-14 z-30 pointer-events-none transform -translate-x-1/2 left-1/2 transition-all duration-200">
                        <div className="bg-slate-950 text-white rounded-lg px-2.5 py-1.5 shadow-xl text-[10px] whitespace-nowrap border border-slate-800">
                          <div className="font-semibold text-slate-200 text-left mb-0.5">
                            {FULL_MONTH_NAMES[item.month] || item.month} {activeYear}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                            <span>PKR {item.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-300 inline-block" />
                            <span>PKR {item.expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          {/* Triangle Pointer */}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 border-r border-b border-slate-800 rotate-45" />
                        </div>
                      </div>
                    )}

                    {/* Dual Stacked Bar */}
                    <div
                      className="w-4 sm:w-6 rounded-t-lg overflow-hidden flex flex-col justify-end transition-all duration-200"
                      style={{ height: `${heightPercent}%` }}
                    >
                      {/* Top Expense segment */}
                      {expensePercent > 0 && (
                        <div
                          className={`w-full transition-colors ${
                            isSelected ? 'bg-blue-300' : 'bg-blue-100 group-hover:bg-blue-200'
                          }`}
                          style={{ height: `${expensePercent}%` }}
                        />
                      )}
                      {/* Bottom Cost segment with gradient */}
                      <div
                        className={`w-full transition-all ${
                          isSelected
                            ? 'bg-gradient-to-t from-blue-700 to-blue-500 shadow-sm'
                            : 'bg-gradient-to-t from-blue-600 to-blue-400 group-hover:from-blue-600 group-hover:to-blue-500'
                        }`}
                        style={{ height: `${costPercent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* X-Axis Month Labels */}
            <div className="flex justify-between items-center px-1 sm:px-2 pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-400">
              {monthlyData.map((d) => (
                <button
                  key={d.month}
                  type="button"
                  onClick={() => setActiveMonth(d.month)}
                  className={`flex-1 text-center transition-colors ${
                    activeMonth === d.month ? 'text-blue-600 font-bold' : 'hover:text-slate-600'
                  }`}
                >
                  {d.month}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TalentzoPayrollOverviewCard
