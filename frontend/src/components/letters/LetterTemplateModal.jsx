import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'
import hrLettersService from '@/services/hrLettersService'

export default function LetterTemplateModal({
  isOpen,
  onClose,
  templateToEdit = null,
  onSaveTemplate
}) {
  const isEdit = Boolean(templateToEdit)
  const letterTypes = hrLettersService.getLetterTypes()
  const placeholders = hrLettersService.getAvailablePlaceholders()

  const [formData, setFormData] = useState({
    letterType: 'Offer Letter',
    templateName: '',
    subject: '',
    body: '',
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    headerText: 'iSysware Software Solutions (Pvt) Ltd — Official Communication',
    footerText: 'Tech Park, Shahrah-e-Faisal, Karachi | www.isysware.com',
    status: 'Active',
    isProtectedSalary: false
  })
  const [errorMsg, setErrorMsg] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (templateToEdit) {
        setFormData({
          templateId: templateToEdit.templateId,
          letterType: templateToEdit.letterType || 'Offer Letter',
          templateName: templateToEdit.templateName || '',
          subject: templateToEdit.subject || '',
          body: templateToEdit.body || '',
          authorizedSignatory: templateToEdit.authorizedSignatory || 'Ayesha Khan',
          signatoryTitle: templateToEdit.signatoryTitle || 'Head of Human Resources',
          headerText: templateToEdit.headerText || '',
          footerText: templateToEdit.footerText || '',
          status: templateToEdit.status || 'Active',
          isProtectedSalary: Boolean(templateToEdit.isProtectedSalary)
        })
      } else {
        setFormData({
          letterType: 'General / Custom HR Letter',
          templateName: '',
          subject: 'Official HR Communication — {{employee_name}}',
          body: `Dear {{employee_name}},

This official notification is issued by {{company_name}} regarding your service in the {{department}} Department.

Please feel free to reach out to the Human Resources Desk if you have any questions.`,
          authorizedSignatory: 'Ayesha Khan',
          signatoryTitle: 'Head of Human Resources',
          headerText: 'iSysware Software Solutions (Pvt) Ltd — Official Communication',
          footerText: 'Tech Park, Shahrah-e-Faisal, Karachi | www.isysware.com',
          status: 'Active',
          isProtectedSalary: false
        })
      }
      setErrorMsg('')
      setShowPreview(false)
    }
  }, [isOpen, templateToEdit])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleInsertPlaceholder = (tag) => {
    setFormData((prev) => ({
      ...prev,
      body: prev.body + ' ' + tag
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg('')

    try {
      if (!formData.templateName.trim()) {
        throw new Error('Template title/name is required.')
      }
      if (!formData.subject.trim()) {
        throw new Error('Letter subject is required.')
      }
      if (!formData.body.trim()) {
        throw new Error('Letter template body is required.')
      }

      setIsSubmitting(true)
      await onSaveTemplate({
        ...(templateToEdit ? { templateId: templateToEdit.templateId } : {}),
        ...formData
      })
      onClose()
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save template.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name="fileText" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEdit ? `Edit Template — ${templateToEdit.templateId}` : 'Create New Letter Template'}
              </h3>
              <p className="text-xs text-slate-500">
                Configure corporate letter template with merge placeholders and headers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <AppIcon name="xmark" className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AppIcon name="alertCircle" className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Letter Category / Type *
                </label>
                <select
                  name="letterType"
                  value={formData.letterType}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                >
                  {letterTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Template Name / Reference *
                </label>
                <input
                  type="text"
                  name="templateName"
                  placeholder="e.g. Standard Probation Confirmation 2026"
                  value={formData.templateName}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Letter Subject Line *
                </label>
                <input
                  type="text"
                  name="subject"
                  placeholder="e.g. Confirmation of Employment Services — {{designation}}"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              {/* Dynamic Placeholders Helper */}
              <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center justify-between">
                  <span>Available Dynamic Placeholders (Click to Insert)</span>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    {showPreview ? 'Hide Sample Preview' : 'Show Sample Preview'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {placeholders.map((p) => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => handleInsertPlaceholder(p.tag)}
                      title={p.desc}
                      className="px-2 py-0.5 bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-700 text-slate-700 font-mono text-[11px] rounded transition-colors"
                    >
                      {p.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Letter Body Template Content *
                </label>
                <textarea
                  rows={8}
                  name="body"
                  value={formData.body}
                  onChange={handleChange}
                  className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              {/* Preview Box if active */}
              {showPreview && (
                <div className="sm:col-span-2 p-4 bg-blue-50/50 border border-blue-200 rounded-xl text-xs space-y-2">
                  <div className="font-bold text-blue-900 uppercase tracking-wide text-[11px]">
                    Sample Merge Interpolation Preview
                  </div>
                  <div className="p-3 bg-white rounded border border-blue-100 text-slate-800 whitespace-pre-wrap font-serif leading-relaxed">
                    {hrLettersService.interpolatePlaceholders(formData.body, {
                      name: 'Zeeshan Ali',
                      employeeId: 'EMP-004',
                      designation: 'Senior Frontend Engineer',
                      department: 'Engineering',
                      joiningDate: '2024-03-01',
                      reportingManager: 'Bilal Ahmed'
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Authorized Signatory Name
                </label>
                <input
                  type="text"
                  name="authorizedSignatory"
                  value={formData.authorizedSignatory}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Signatory Designation / Title
                </label>
                <input
                  type="text"
                  name="signatoryTitle"
                  value={formData.signatoryTitle}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Template Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="isProtectedSalary"
                    checked={formData.isProtectedSalary}
                    onChange={handleChange}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  Protected Salary / Compensation Document (Requires Super Admin Approval)
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 rounded-lg shadow-xs transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
