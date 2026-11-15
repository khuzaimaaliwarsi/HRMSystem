import React, { useState, useEffect } from 'react'
import { holidayCalendarService } from '@/services/holidayCalendarService'
import { companySettingsService } from '@/services/companySettingsService'
import { useAuth } from '@/context/useAuth'
import AppIcon from '@/components/common/AppIcon'

export function WorkingCalendarTab() {
  const { user } = useAuth()
  const roleLower = String(user?.role || '').toLowerCase()
  const backendRoleLower = String(user?.backendRole || '').toLowerCase()
  const isSuperAdmin = ['super_admin', 'superadmin', 'admin'].includes(roleLower) || ['super_admin', 'superadmin', 'admin'].includes(backendRoleLower) || user?.username === 'superadmin'
  const isHrOrSuper = isSuperAdmin || ['hr_admin', 'hradmin'].includes(roleLower) || ['hr_admin', 'hradmin'].includes(backendRoleLower) || user?.username?.includes('hr')

  const [holidays, setHolidays] = useState(() => holidayCalendarService.getHolidays('2026'))
  const [profile, setProfile] = useState(() => companySettingsService.getCompanyProfile())
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingHoliday, setViewingHoliday] = useState(null)
  const [editingHoliday, setEditingHoliday] = useState(null)
  const [deletingHoliday, setDeletingHoliday] = useState(null)
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: '2026-06-01',
    type: 'Company',
    isWorkingDay: false,
    description: ''
  })

  // Date range calculator
  const [calcStart, setCalcStart] = useState('2026-03-20') // Eid Day 1
  const [calcEnd, setCalcEnd] = useState('2026-03-25')
  const [calculatedWorkingDays, setCalculatedWorkingDays] = useState(0)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    const unsub1 = holidayCalendarService.subscribe(() => {
      setHolidays(holidayCalendarService.getHolidays('2026'))
    })
    const unsub2 = companySettingsService.subscribe(() => {
      setProfile(companySettingsService.getCompanyProfile())
    })
    return () => {
      unsub1()
      unsub2()
    }
  }, [])

  useEffect(() => {
    if (calcStart && calcEnd) {
      const days = holidayCalendarService.calculateWorkingDays(calcStart, calcEnd)
      setCalculatedWorkingDays(days)
    }
  }, [calcStart, calcEnd, holidays])

  const handleAddHoliday = (e) => {
    e.preventDefault()
    try {
      holidayCalendarService.addHoliday(newHoliday, {
        name: user?.name || 'Tariq Mehmood',
        role: user?.role || 'super_admin',
        id: user?.id || 'EMP-001'
      })
      setFeedback({ type: 'success', text: `Holiday '${newHoliday.name}' added to 2026 calendar.` })
      setIsAddModalOpen(false)
      setNewHoliday({
        name: '',
        date: '2026-06-01',
        type: 'Company',
        isWorkingDay: false,
        description: ''
      })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  const handleOpenEditHoliday = (holiday) => {
    setEditingHoliday({ ...holiday })
  }

  const handleUpdateHoliday = (e) => {
    e.preventDefault()
    if (!editingHoliday) return
    try {
      holidayCalendarService.updateHoliday(editingHoliday.id, editingHoliday, {
        name: user?.name || 'Tariq Mehmood',
        role: user?.role || 'super_admin',
        id: user?.id || 'EMP-001'
      })
      setFeedback({ type: 'success', text: `Holiday '${editingHoliday.name}' updated successfully.` })
      setEditingHoliday(null)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  const handleConfirmDeleteHoliday = () => {
    if (!deletingHoliday || !isSuperAdmin) return
    try {
      holidayCalendarService.deleteHoliday(deletingHoliday.id, {
        name: user?.name || 'Tariq Mehmood',
        role: user?.role || 'super_admin',
        id: user?.id || 'EMP-001'
      })
      setFeedback({ type: 'success', text: `Holiday '${deletingHoliday.name}' removed from calendar.` })
      setDeletingHoliday(null)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Submodule Header & Aligned Action Button — One Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Holidays &amp; Working Calendar (2026)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Defines working week schedule, statutory national holidays, and working-day evaluation logic.
          </p>
        </div>

        {isHrOrSuper && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm self-start sm:self-auto shrink-0"
          >
            <AppIcon name="plus" className="w-3 h-3" />
            <span>Add Official Holiday</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <i
            className={`fa-solid ${
              feedback.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-rose-600'
            }`}
          ></i>
          {feedback.text}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Working Week Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-2 text-xs">
          <span className="font-bold text-slate-900 block">Weekly Working Schedule</span>
          <div className="flex flex-wrap gap-1">
            {profile.workingWeekDays?.map((d) => (
              <span key={d} className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[11px]">
                {d}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Standard 5-day corporate working schedule</p>
        </div>

        {/* Weekly Offs Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-2 text-xs">
          <span className="font-bold text-slate-900 block">Configured Weekly Offs</span>
          <div className="flex flex-wrap gap-1">
            {profile.weeklyOffDays?.map((d) => (
              <span key={d} className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold text-[11px] border border-rose-200">
                {d}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Non-working days excluded from leave deductions</p>
        </div>

        {/* Working Days Calculator Preview */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">Working Days Resolver</span>
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-sm">
              {calculatedWorkingDays} Days
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block">Start Date</label>
              <input
                type="date"
                value={calcStart}
                onChange={(e) => setCalcStart(e.target.value)}
                className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] font-mono text-slate-700"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block">End Date</label>
              <input
                type="date"
                value={calcEnd}
                onChange={(e) => setCalcEnd(e.target.value)}
                className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] font-mono text-slate-700"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Deducts registered holidays &amp; configured weekend days
          </p>
        </div>
      </div>

      {/* Holidays Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900">2026 Pakistan Statutory &amp; Corporate Holiday Schedule</h3>
            <p className="text-[11px] text-slate-400">Official gazette holidays governing Leave, Attendance, and SLA timers</p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
            {(holidays || []).length} Registered Days
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Date &amp; Day</th>
                <th className="py-2.5 px-3">Holiday Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.map((h) => {
                const isReligious = h.type === 'Religious'
                const isCompany = h.type === 'Company'

                return (
                  <tr key={h.id} className="hover:bg-slate-50/40 transition">
                    <td className="py-2.5 px-4 font-mono">
                      <span className="font-bold text-slate-900 block">{h.date}</span>
                      <span className="text-[10px] text-slate-400">{h.day}</span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {h.name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isReligious
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : isCompany
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {h.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {h.description || 'Statutory Public Holiday'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {/* View Holiday Details */}
                        <button
                          type="button"
                          onClick={() => setViewingHoliday(h)}
                          title="View Holiday Details"
                          className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center justify-center transition border border-transparent hover:border-slate-200"
                        >
                          <AppIcon name="eye" className="w-3.5 h-3.5" />
                        </button>

                        {isHrOrSuper && (
                          <>
                            {/* Edit Holiday */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditHoliday(h)}
                              title="Edit Holiday Details"
                              className="w-7 h-7 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 inline-flex items-center justify-center transition border border-transparent hover:border-blue-200"
                            >
                              <AppIcon name="edit" className="w-3.5 h-3.5 text-blue-600" />
                            </button>

                            {/* Delete Holiday (Super Admin only) */}
                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => setDeletingHoliday(h)}
                                title="Remove Holiday from Calendar"
                                className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 inline-flex items-center justify-center transition border border-transparent hover:border-rose-200"
                              >
                                <AppIcon name="trash" className="w-3.5 h-3.5 text-rose-500" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Holiday Modal */}
      {viewingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <AppIcon name="eye" className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Holiday Details</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Statutory & Corporate Calendar Entry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingHoliday(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                <AppIcon name="close" className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Holiday Name:</span>
                  <span className="font-bold text-slate-900">{viewingHoliday.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Scheduled Date:</span>
                  <span className="font-mono font-bold text-slate-800">{viewingHoliday.date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Category / Classification:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {viewingHoliday.type}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Working Day Status:</span>
                  <span className="font-semibold text-slate-700">
                    {viewingHoliday.isWorkingDay ? 'Declared Working Day' : 'Official Non-Working Holiday'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-medium block mb-1">Official Description / Scope:</span>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
                  {viewingHoliday.description || 'Statutory Public Holiday under Pakistan Ministry of Interior Gazette.'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingHoliday(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Holiday Modal */}
      {editingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Official Holiday</h3>
                <p className="text-xs text-slate-400 mt-0.5">Modify holiday details on the 2026 calendar</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingHoliday(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                <AppIcon name="close" className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleUpdateHoliday} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Holiday Name</label>
                <input
                  type="text"
                  required
                  value={editingHoliday.name}
                  onChange={(e) => setEditingHoliday({ ...editingHoliday, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editingHoliday.date}
                    onChange={(e) => setEditingHoliday({ ...editingHoliday, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Holiday Type</label>
                  <select
                    value={editingHoliday.type}
                    onChange={(e) => setEditingHoliday({ ...editingHoliday, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="Public">Public (National)</option>
                    <option value="Religious">Religious</option>
                    <option value="Company">Company Special</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editingHoliday.description || ''}
                  onChange={(e) => setEditingHoliday({ ...editingHoliday, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingHoliday(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                <AppIcon name="trash" className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Remove Holiday from Calendar</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action deletes the selected gazette holiday.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-semibold text-slate-800">{deletingHoliday.name}</p>
              <p className="font-mono text-[11px] text-slate-500">
                {deletingHoliday.date} ({deletingHoliday.day}) • {deletingHoliday.type}
              </p>
            </div>

            <p className="text-xs text-slate-500">
              Are you sure you want to remove this holiday from the 2026 calendar? Leave calculations and working day calculations will reflect this change immediately.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingHoliday(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteHoliday}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
              >
                <AppIcon name="trash" className="w-3.5 h-3.5" />
                <span>Remove Holiday</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Holiday Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Official Holiday</h3>
                <p className="text-xs text-slate-400 mt-0.5">Registers a new statutory holiday on the 2026 calendar</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                <AppIcon name="close" className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleAddHoliday} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Holiday Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Youm-e-Takbeer"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Holiday Type</label>
                  <select
                    value={newHoliday.type}
                    onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="Public">Public (National)</option>
                    <option value="Religious">Religious</option>
                    <option value="Company">Company Special</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Official gazette description..."
                  value={newHoliday.description}
                  onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Add to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkingCalendarTab
