import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TrainingProgramModal({
  isOpen,
  onClose,
  program = null,
  onSave
}) {
  const isEditing = Boolean(program?.id)

  const [formData, setFormData] = useState({
    title: program?.title || '',
    category: program?.category || 'Engineering & Technology',
    description: program?.description || '',
    skills: Array.isArray(program?.skills) ? program.skills.join(', ') : (program?.skills || ''),
    trainingType: program?.trainingType || 'Internal',
    trainer: program?.trainerName || program?.trainer || '',
    duration: program?.duration || (program?.durationHours ? `${program.durationHours} Hours` : '16 Hours'),
    durationHours: program?.durationHours || 16,
    prerequisites: program?.prerequisites ?? '',
    maxParticipants: program?.maxCapacity ?? program?.maxParticipants ?? 20,
    materials: program?.materials ?? '',
    costPerParticipant: program?.costPerParticipant ?? 0,
    status: program?.status || 'Active'
  })

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingCustomCat, setIsAddingCustomCat] = useState(false)
  const [customCatName, setCustomCatName] = useState('')
  const [customCategories, setCustomCategories] = useState([])

  React.useEffect(() => {
    if (program) {
      setFormData({
        title: program.title || '',
        category: program.category || 'Engineering & Technology',
        description: program.description || '',
        skills: Array.isArray(program.skills) ? program.skills.join(', ') : (program.skills || ''),
        trainingType: program.trainingType || 'Internal',
        trainer: program.trainerName || program.trainer || '',
        duration: program.duration || (program.durationHours ? `${program.durationHours} Hours` : '16 Hours'),
        durationHours: Number(program.durationHours) || 16,
        prerequisites: program.prerequisites ?? '',
        maxParticipants: Number(program.maxCapacity ?? program.maxParticipants) || 20,
        materials: program.materials ?? '',
        costPerParticipant: Number(program.costPerParticipant ?? 0),
        status: program.status || 'Active'
      })
    }
  }, [program])

  const handleAddCustomCategory = () => {
    const trimmed = (customCatName || '').trim()
    if (!trimmed) return
    if (!customCategories.includes(trimmed)) {
      setCustomCategories([trimmed, ...customCategories])
    }
    setFormData((prev) => ({ ...prev, category: trimmed }))
    setIsAddingCustomCat(false)
    setCustomCatName('')
  }

  if (!isOpen) return null


  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    setError('')

    if (!formData.title.trim()) {
      setError('Course title is required.')
      return
    }

    if (!formData.trainer.trim()) {
      setError('Lead trainer or provider name is required.')
      return
    }

    const matchHours = String(formData.duration || '').match(/[\d.]+/)
    const parsedDurationHours = matchHours ? Number(matchHours[0]) : Number(formData.durationHours)
    if (!Number.isFinite(parsedDurationHours) || parsedDurationHours <= 0) {
      setError('Valid numeric duration hours (greater than 0) is required.')
      return
    }

    if (typeof onSave !== 'function') {
      setError('Course saving service is unavailable.')
      return
    }

    setIsSubmitting(true)

    try {
      const skillsArray = formData.skills
        ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
        : []

      await onSave({
        ...formData,
        id: program?.id || undefined,
        skills: skillsArray,
        trainerName: formData.trainer.trim(),
        durationHours: parsedDurationHours,
        maxCapacity: Number(formData.maxParticipants) || 20,
        maxParticipants: Number(formData.maxParticipants) || 20,
        costPerParticipant: Number(formData.costPerParticipant) || 0,
        prerequisites: formData.prerequisites.trim(),
        materials: formData.materials.trim()
      })

      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to save course to database.')
    } finally {
      setIsSubmitting(false)
    }
  }



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl text-left overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-navy-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/30">
              <AppIcon name="training" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isEditing ? `Edit Training Program${program?.courseCode ? ` (${program.courseCode})` : ''}` : 'Create New Course Catalog Item'}
              </h3>
              <p className="text-xs text-slate-300">
                Institutional learning curriculum and workforce competency specifications
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-800 rounded-lg border border-rose-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Course Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Cloud Architecture & High Scalability Systems"
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomCat(!isAddingCustomCat)}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition"
                >
                  {isAddingCustomCat ? '✕ Cancel' : '+ Add Custom Category'}
                </button>
              </div>

              {isAddingCustomCat ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customCatName}
                    onChange={(e) => setCustomCatName(e.target.value)}
                    placeholder="e.g. AI & Data Engineering, Compliance..."
                    className="flex-1 text-xs font-semibold border border-blue-400 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={formData.category}
                  onChange={(e) => {
                    if (e.target.value === '__custom_new__') {
                      setIsAddingCustomCat(true)
                    } else {
                      setFormData({ ...formData, category: e.target.value })
                    }
                  }}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
                >
                  <option value="Technical">Technical</option>
                  <option value="Engineering & Technology">Engineering & Technology</option>
                  <option value="Security & Governance">Security & Governance</option>
                  <option value="Leadership & People Care">Leadership & People Care</option>
                  <option value="Sales & Business Growth">Sales & Business Growth</option>
                  <option value="Health & Safety">Health & Safety</option>
                  <option value="Product & Design">Product & Design</option>
                  {customCategories.map((c) => (
                    <option key={c} value={c}>
                      {c} (Custom)
                    </option>
                  ))}
                  {formData.category &&
                    ![
                      'Technical',
                      'Engineering & Technology',
                      'Security & Governance',
                      'Leadership & People Care',
                      'Sales & Business Growth',
                      'Health & Safety',
                      'Product & Design'
                    ].includes(formData.category) &&
                    !customCategories.includes(formData.category) && (
                      <option value={formData.category}>{formData.category} (Custom)</option>
                    )}
                  <option value="__custom_new__">+ Add Custom Category...</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Training Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.trainingType}
                onChange={(e) => setFormData({ ...formData, trainingType: e.target.value })}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              >
                <option value="Internal">Internal (Company Expert)</option>
                <option value="External">External Academy</option>
                <option value="Online">Online / Self-Paced LMS</option>
                <option value="Onsite">Onsite Workshop</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Trainer / Provider <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.trainer}
                onChange={(e) => setFormData({ ...formData, trainer: e.target.value })}
                placeholder="e.g. Dr. Tariq Mahmood / AWS Academy"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Duration String <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g. 24 Hours (3 Weeks)"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Max Participant Capacity
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.maxParticipants}
                onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estimated Cost / Budget (PKR)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.costPerParticipant}
                onChange={(e) => setFormData({ ...formData, costPerParticipant: e.target.value })}
                placeholder="0 for internal courses"
                className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Competencies / Skills (Comma-separated)
              </label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="e.g. Cloud Architecture, System Design, Microservices"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Prerequisites &amp; Prior Experience
              </label>
              <input
                type="text"
                value={formData.prerequisites}
                onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
                placeholder="e.g. Minimum 2 years software engineering experience"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Course Status
              </label>
              <select
                value={formData.status || 'Active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              >
                <option value="Active">Active</option>
                <option value="Planned">Planned</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Training Materials &amp; Resources
              </label>
              <input
                type="text"
                value={formData.materials || ''}
                onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                placeholder="e.g. Lab Workbook, Slide Deck, Repo Access"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Course Syllabus &amp; Target Outcomes
              </label>
              <textarea
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed objectives and curriculum syllabus overview..."
                className="w-full text-xs border border-slate-300 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>
          </div>

          {/* Footer actions */}
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
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm transition-all"
            >
              {isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Publish Course')}            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
