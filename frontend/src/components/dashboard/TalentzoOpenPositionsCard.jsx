import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { recruitmentService } from '@/services/recruitmentService'
import { syncRecruitment } from '@/services/backendSync'

const THEMES = [
  {
    bg: 'bg-amber-50',
    text: 'text-amber-500',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    )
  },
  {
    bg: 'bg-sky-50',
    text: 'text-sky-500',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    bg: 'bg-pink-50',
    text: 'text-pink-500',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    )
  },
  {
    bg: 'bg-purple-50',
    text: 'text-purple-500',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    bg: 'bg-teal-50',
    text: 'text-teal-500',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    bg: 'bg-blue-50',
    text: 'text-blue-500',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )
  }
]

function getThemeForRole(title = '', idx = 0) {
  const t = (title || '').toLowerCase()
  if (t.includes('design') || t.includes('ui') || t.includes('ux')) return THEMES[2]
  if (t.includes('front') || t.includes('web') || t.includes('react')) return THEMES[0]
  if (t.includes('back') || t.includes('dev') || t.includes('engineer') || t.includes('software')) return THEMES[1]
  if (t.includes('hr') || t.includes('human') || t.includes('people') || t.includes('resource')) return THEMES[3]
  if (t.includes('business') || t.includes('sales')) return THEMES[4]
  if (t.includes('media') || t.includes('marketing')) return THEMES[5]
  return THEMES[idx % THEMES.length]
}

export function TalentzoOpenPositionsCard() {
  const navigate = useNavigate()
  const [vacancies, setVacancies] = useState(() => recruitmentService.getVacancies({ status: 'Open' }))

  useEffect(() => {
    syncRecruitment().then(() => {
      setVacancies(recruitmentService.getVacancies({ status: 'Open' }))
    })
    const unsub = recruitmentService.subscribe(() => {
      setVacancies(recruitmentService.getVacancies({ status: 'Open' }))
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs text-left h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Open Positions</h2>
          <span className="text-[11px] text-slate-400 font-medium">
            {vacancies.length} Active {vacancies.length === 1 ? 'Opening' : 'Openings'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/super-admin/recruitment')}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
        >
          View All
        </button>
      </div>

      {/* Grid or Empty State */}
      {vacancies.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-xl my-2">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-slate-700">No active job openings</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Post a job opening to publish public vacancies.</p>
          <button
            type="button"
            onClick={() => navigate('/super-admin/recruitment')}
            className="mt-3 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
          >
            + Post Opening
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {vacancies.slice(0, 6).map((pos, idx) => {
            const theme = getThemeForRole(pos.title || pos.jobTitle, idx)
            return (
              <div
                key={pos.id}
                onClick={() => navigate('/super-admin/recruitment')}
                className="rounded-2xl border border-slate-100 hover:border-slate-300 p-3.5 bg-white hover:bg-slate-50/70 transition-all cursor-pointer shadow-2xs group flex flex-col justify-start"
              >
                <div className={`w-8 h-8 rounded-full ${theme.bg} ${theme.text} flex items-center justify-center shrink-0`}>
                  {theme.icon}
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs sm:text-[13px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                    {pos.title || pos.jobTitle}
                  </h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium truncate">
                    {pos.type || 'Full-time'} • {pos.openings || pos.positions || 1} {Number(pos.openings || pos.positions || 1) === 1 ? 'Position' : 'Positions'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TalentzoOpenPositionsCard

