import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TrainingCatalogTable({
  programs = [],
  onEditProgram,
  onArchiveProgram,
  onToggleStatus,
  canManage = false,
  onViewProgram
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const dynamicCategories = Array.from(
    new Set([
      'Technical',
      'Engineering & Technology',
      'Security & Governance',
      'Leadership & People Care',
      'Sales & Business Growth',
      'Health & Safety',
      ...programs.map((p) => p.category).filter(Boolean)
    ])
  )

  const filtered = programs.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
    if (typeFilter !== 'all' && p.trainingType !== typeFilter) return false
    if (statusFilter !== 'all' && String(p.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase().trim()
    return (
      (p.courseCode || '').toLowerCase().includes(q) ||
      (p.title || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.trainer || p.trainerName || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (Array.isArray(p.skills) && p.skills.some((s) => String(s).toLowerCase().includes(q)))
    )
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-left">
      {/* Header with Search & Filters */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search courses, skills, trainer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg pl-3 pr-8 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-600"
          >
            <option value="all">All Categories</option>
            {dynamicCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-600"
          >
            <option value="all">All Delivery Modes</option>
            <option value="Internal">Internal Lead</option>
            <option value="External">External Academy</option>
            <option value="Online">Online Self-Paced</option>
            <option value="Onsite">Onsite Workshop</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-600"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Planned">Planned</option>
            <option value="Draft">Draft</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filtered.length}</strong> of {programs.length} courses
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
              <th className="py-2.5 px-4">Course ID &amp; Title</th>
              <th className="py-2.5 px-4">Category</th>
              <th className="py-2.5 px-4">Delivery Mode</th>
              <th className="py-2.5 px-4">Lead Trainer / Provider</th>
              <th className="py-2.5 px-4">Duration &amp; Capacity</th>
              <th className="py-2.5 px-4">Skills Acquired</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-400">
                  No training programs match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-bold text-navy-950 text-xs hover:text-blue-700 cursor-pointer" onClick={() => onViewProgram?.(p)}>
                      {p.title}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {p.courseCode || p.programId || p.id}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium">
                      {p.category || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                      p.trainingType === 'Online'
                        ? 'bg-blue-50 text-blue-700'
                        : p.trainingType === 'Internal'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-purple-50 text-purple-700'
                    }`}>
                      {p.trainingType || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-800 font-medium">
                    {p.trainer || p.trainerName || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                    <div>{p.duration}</div>
                    <div className="text-slate-400">Max: {p.maxParticipants ?? p.maxCapacity} seats</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {(p.skills || []).slice(0, 3).map((s, idx) => (
                        <span key={idx} className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px]">
                          {s}
                        </span>
                      ))}
                      {(p.skills || []).length > 3 && (
                        <span className="text-[10px] text-slate-400 font-bold">
                          +{(p.skills || []).length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                      p.status === 'Active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.status === 'Planned'
                        ? 'bg-indigo-100 text-indigo-800'
                        : p.status === 'Draft'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewProgram?.(p)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-navy-950 transition-colors"
                        title="View Course Details"
                      >
                        <AppIcon name="eye" className="w-3.5 h-3.5" />
                      </button>
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditProgram?.(p)}
                            className="p-1.5 rounded hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
                            title="Edit Course"
                          >
                            <AppIcon name="settings" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleStatus?.(p.id)}
                            className="p-1.5 rounded hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-colors"
                            title={p.status === 'Active' ? 'Set Course to Draft' : 'Activate Course'}
                          >
                            <AppIcon name="refresh" className="w-3.5 h-3.5" />
                          </button>
                          {p.status !== 'Archived' && (
                            <button
                              type="button"
                              onClick={() => onArchiveProgram?.(p.id)}
                              className="p-1.5 rounded hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition-colors"
                              title="Archive Course"
                            >
                              <AppIcon name="lock" className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
