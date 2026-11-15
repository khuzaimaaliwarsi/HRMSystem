import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { employeeService } from '@/services/employeeService'

export function TalentzoJobLevelCard() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState(() => employeeService.getEmployees())

  useEffect(() => {
    const unsub = employeeService.subscribe(() => {
      setEmployees(employeeService.getEmployees())
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [])

  const total = employees.length
  const fullTimeCount = employees.filter((e) => !e.employmentType || e.employmentType === 'Permanent' || e.employmentType === 'Full-Time').length
  const partTimeCount = employees.filter((e) => e.employmentType === 'Part-Time' || e.employmentType === 'Contract').length
  const freelanceCount = employees.filter((e) => e.employmentType === 'Freelance').length
  const internshipCount = employees.filter((e) => e.employmentType === 'Internship' || e.employmentType === 'Probation').length

  const getPercent = (count) => (total > 0 ? `${Math.round((count / total) * 100)}%` : '0%')

  const categories = [
    {
      label: 'Full-Time',
      count: fullTimeCount,
      percent: getPercent(fullTimeCount),
      colorClass: 'bg-blue-600',
      lineHeights: total > 0 ? [35, 65, 45, 80, 55, 95, 70, 85, 50, 75] : [4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
    },
    {
      label: 'Part-Time',
      count: partTimeCount,
      percent: getPercent(partTimeCount),
      colorClass: 'bg-cyan-500',
      lineHeights: total > 0 ? [40, 70, 50, 85, 60, 75, 45, 80, 65, 55] : [4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
    },
    {
      label: 'Freelance',
      count: freelanceCount,
      percent: getPercent(freelanceCount),
      colorClass: 'bg-indigo-600',
      lineHeights: total > 0 ? [50, 80, 60, 90, 70, 85, 55, 75, 65, 80] : [4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
    },
    {
      label: 'Internship',
      count: internshipCount,
      percent: getPercent(internshipCount),
      colorClass: 'bg-teal-400',
      lineHeights: total > 0 ? [30, 55, 40, 70, 50, 65, 45, 60, 35, 50] : [4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
    }
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs text-left h-full flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Job Level</h2>
          <button
            type="button"
            onClick={() => navigate('/super-admin/employees')}
            className="px-3 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-2xs transition-colors"
          >
            See details
          </button>
        </div>

        {/* Total Stat */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900 tracking-tight">{total}</span>
          <span className="text-xs text-slate-400 font-medium">Total employee</span>
        </div>
      </div>

      {/* 4 Categorical Breakdown Columns */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-1 flex-1 items-end">
        {categories.map((cat) => (
          <div key={cat.label} className="flex flex-col justify-end h-full">
            <span className="text-xs text-slate-400 font-medium truncate">{cat.label}</span>
            <span className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{cat.count}</span>

            {/* Vertical Barcode Stripes matching screenshot */}
            <div className="flex items-end gap-0.5 sm:gap-1 h-24 sm:h-32 my-3 overflow-hidden">
              {cat.lineHeights.map((h, idx) => (
                <div
                  key={idx}
                  className={`flex-1 rounded-full ${cat.colorClass} opacity-90`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>

            <span className="text-xs font-semibold text-slate-400">{cat.percent}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TalentzoJobLevelCard

