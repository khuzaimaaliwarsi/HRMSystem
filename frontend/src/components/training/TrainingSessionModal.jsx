import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TrainingSessionModal({
  isOpen,
  onClose,
  programs = [],
  onSave
}) {
  const [formData, setFormData] = useState({
    programId: programs[0]?.id || '',
    trainer: programs[0]?.trainer || 'Dr. Tariq Mahmood',
    startDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 86400000 * 17).toISOString().slice(0, 10),
    startTime: '14:00',
    endTime: '17:00',
    locationType: 'Online',
    locationOrLink: 'https://meet.isysware.internal/training-room',
    capacity: 20,
    notes: 'Standard cohort syllabus with interactive hands-on lab exercises.'
  })

  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleProgramChange = (e) => {
    const pId = e.target.value
    const selected = programs.find((p) => p.id === pId)
    setFormData({
      ...formData,
      programId: pId,
      trainer: selected?.trainer || formData.trainer,
      capacity: selected?.maxParticipants || formData.capacity
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      setError(err.message || 'Error scheduling session.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg text-left overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-navy-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/30">
              <AppIcon name="calendar" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Schedule Training Cohort Session</h3>
              <p className="text-xs text-slate-300">Set venue, calendar interval, trainer and seat limits</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <AppIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-800 rounded-lg border border-rose-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Curriculum Course <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.programId}
              onChange={handleProgramChange}
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.duration})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Assigned Trainer / Instructor <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.trainer}
              onChange={(e) => setFormData({ ...formData, trainer: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Daily Start Time
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Daily End Time
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Delivery Venue Type
              </label>
              <select
                value={formData.locationType}
                onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              >
                <option value="Online">Online Video / Teams</option>
                <option value="Internal Lab">Main Office Lab</option>
                <option value="Auditorium">Corporate Auditorium</option>
                <option value="External Facility">External Facility</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Seat Capacity Ceiling
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Location Link / Room Details
            </label>
            <input
              type="text"
              value={formData.locationOrLink}
              onChange={(e) => setFormData({ ...formData, locationOrLink: e.target.value })}
              placeholder="e.g. Conference Room 3B or https://meet.isysware.internal/training"
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Session Instructions &amp; Lab Notes
            </label>
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm transition-all"
            >
              Confirm Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
