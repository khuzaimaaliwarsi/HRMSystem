import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TrainingPlanModal({
  isOpen,
  onClose,
  programs = [],
  employees = [],
  onSave
}) {
  const [formData, setFormData] = useState({
    title: '',
    planType: 'Individual',
    programId: programs[0]?.id || '',
    targetEmployeeId: employees[0]?.id || '',
    targetDepartmentId: 'all',
    isMandatory: false,
    skillsGapSource: 'Manager Recommendation',
    justification: ''
  })

  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.title.trim()) {
      setError('Recommendation title is required.')
      return
    }
    if (!formData.justification.trim() || formData.justification.trim().length < 5) {
      setError('Audit justification (min 5 characters) is required.')
      return
    }

    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      setError(err.message || 'Error submitting recommendation.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg text-left overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-navy-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
              <AppIcon name="tasks" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Training Plan &amp; Skill-Gap Recommendation</h3>
              <p className="text-xs text-slate-300">Audited workforce learning assignment workflow</p>
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
              Plan Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Frontend Architecture Upskilling Plan 2026"
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Plan Scope
              </label>
              <select
                value={formData.planType}
                onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              >
                <option value="Individual">Individual Staff Member</option>
                <option value="Team">Team / Squad</option>
                <option value="Department">Full Department</option>
                <option value="Role-Specific">Role-Specific Path</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Program <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.programId}
                onChange={(e) => setFormData({ ...formData, programId: e.target.value })}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.planType === 'Individual' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Employee <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.targetEmployeeId}
                onChange={(e) => setFormData({ ...formData, targetEmployeeId: e.target.value })}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name || emp.fullName} ({emp.employeeCode || emp.id}) — {emp.designation || 'Staff'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Skills-Gap Origin / Source
            </label>
            <input
              type="text"
              value={formData.skillsGapSource}
              onChange={(e) => setFormData({ ...formData, skillsGapSource: e.target.value })}
              placeholder="e.g. F07 Performance Review / Probation Evaluation"
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Justification &amp; Expected Impact <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="3"
              required
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              placeholder="State the observed competency deficit and anticipated project benefit..."
              className="w-full text-xs border border-slate-300 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isMandatoryCheck"
              checked={formData.isMandatory}
              onChange={(e) => setFormData({ ...formData, isMandatory: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <label htmlFor="isMandatoryCheck" className="text-xs font-semibold text-slate-700">
              Mandatory Corporate Training Requirement
            </label>
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
              Submit Recommendation
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
