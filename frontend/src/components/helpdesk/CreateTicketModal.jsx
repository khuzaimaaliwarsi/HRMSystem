import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function CreateTicketModal({
  categories = [],
  _currentUser = null,
  onClose = () => {},
  onSave = () => {}
}) {
  const [subject, setSubject] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [relatedModule, setRelatedModule] = useState('')
  const [attachmentRef, setAttachmentRef] = useState('')
  const [description, setDescription] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].categoryId)
      setSubcategory(categories[0].subcategories?.[0] || '')
    }
  }, [categories, categoryId])

  const handleCategoryChange = (e) => {
    const val = e.target.value
    setCategoryId(val)
    const selected = categories.find((c) => c.categoryId === val)
    if (selected && selected.subcategories?.length > 0) {
      setSubcategory(selected.subcategories[0])
    } else {
      setSubcategory('')
    }
  }

  const selectedCategoryObj = categories.find((c) => c.categoryId === categoryId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg('')

    if (!subject || subject.trim().length < 5) {
      setErrorMsg('Ticket subject must be at least 5 characters.')
      return
    }
    if (!description || description.trim().length < 10) {
      setErrorMsg('Ticket description must be at least 10 characters.')
      return
    }
    if (!categoryId) {
      setErrorMsg('Please select a valid ticket category.')
      return
    }

    try {
      setIsSubmitting(true)
      await onSave({
        subject: subject.trim(),
        categoryId,
        subcategory,
        priority,
        relatedModule: relatedModule || null,
        attachmentRef: attachmentRef.trim() || null,
        description: description.trim()
      })
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to submit support ticket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <AppIcon name="helpdesk" className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Submit New Support Ticket</h2>
              <p className="text-xs text-slate-500">
                Log an internal service request for IT, HR, Payroll, or Administrative assistance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition"
          >
            <AppIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="m-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ticket Subject <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., VPN connection timeout on Lahore gateway"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={handleCategoryChange}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.categoryName} {c.isConfidential ? '(Confidential)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subcategory
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {(selectedCategoryObj?.subcategories || []).map((sub, i) => (
                  <option key={i} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority & SLA Target <span className="text-rose-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Low">Low — 48h Resolution Target</option>
                <option value="Medium">Medium — 24h Resolution Target</option>
                <option value="High">High — 8h Resolution Target</option>
                <option value="Critical">Critical — 4h Immediate Resolution</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Related Module (Optional)
              </label>
              <select
                value={relatedModule}
                onChange={(e) => setRelatedModule(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">None / General Inquiry</option>
                <option value="F04 Attendance & Shifts">F04 Attendance & Shifts</option>
                <option value="F05 Leave Management">F05 Leave Management</option>
                <option value="F06 Payroll & Compensation">F06 Payroll & Compensation</option>
                <option value="F07 Performance Management">F07 Performance Management</option>
                <option value="F08 Training & Development">F08 Training & Development</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Demo Attachment Reference (Log file, screenshot name)
            </label>
            <input
              type="text"
              placeholder="e.g., error_log_oct27.txt or vpn_gateway_screenshot.png"
              value={attachmentRef}
              onChange={(e) => setAttachmentRef(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Demo-safe reference file link (no unauthorized binary server uploads).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detailed Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="4"
              placeholder="Provide comprehensive details of the issue, symptoms, steps taken, or specific help requested..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            ></textarea>
          </div>

          {selectedCategoryObj?.isConfidential && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
              <i className="fa-solid fa-lock text-amber-600 mt-0.5"></i>
              <div>
                <span className="font-semibold">Confidential Support Policy:</span> This ticket will only be visible to you and authorized HR / Payroll officers. It will be shielded from your departmental line manager.
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-md shadow-sm transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-paper-plane text-xs"></i>
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
