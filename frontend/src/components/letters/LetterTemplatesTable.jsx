import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function LetterTemplatesTable({
  templates = [],
  currentUser = null,
  onEditTemplate,
  onUseTemplate,
  onPreviewTemplate
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const isHrOrSuper =
    currentUser?.role === 'super_admin' || currentUser?.role === 'hr_admin'

  const distinctTypes = Array.from(new Set(templates.map((t) => t.letterType).filter(Boolean)))

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.templateId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.letterType?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = typeFilter === 'all' || t.letterType === typeFilter
    return matchesSearch && matchesType
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Control Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <AppIcon
              name="search"
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder="Search templates, subjects, types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Letter Types</option>
            {distinctTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredTemplates.length} of {templates.length} templates
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Template ID & Name</th>
              <th className="py-3 px-4">Letter Type</th>
              <th className="py-3 px-4">Subject Preview</th>
              <th className="py-3 px-4">Authorized Signatory</th>
              <th className="py-3 px-4">Version</th>
              <th className="py-3 px-4">Classification</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-400">
                  <AppIcon name="fileText" className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No templates found.
                </td>
              </tr>
            ) : (
              filteredTemplates.map((tmpl) => (
                <tr key={tmpl.templateId || tmpl.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{tmpl.templateName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{tmpl.templateId}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {tmpl.letterType}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-700 truncate max-w-[220px]" title={tmpl.subject}>
                      {tmpl.subject}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{tmpl.authorizedSignatory}</div>
                    <div className="text-[11px] text-slate-500">{tmpl.signatoryTitle}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">
                    v{tmpl.version || '1.0'}
                  </td>
                  <td className="py-3 px-4">
                    {tmpl.isProtectedSalary ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <AppIcon name="lock" className="w-2.5 h-2.5" />
                        Salary Protected
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        Standard
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        tmpl.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {tmpl.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onUseTemplate && onUseTemplate(tmpl)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors"
                        title="Generate letter from this template"
                      >
                        Generate
                      </button>

                      {onPreviewTemplate && (
                        <button
                          onClick={() => onPreviewTemplate(tmpl)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="Preview Template Content"
                        >
                          <AppIcon name="eye" className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isHrOrSuper && onEditTemplate && (
                        <button
                          onClick={() => onEditTemplate(tmpl)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded"
                          title="Edit Template"
                        >
                          <AppIcon name="edit" className="w-3.5 h-3.5" />
                        </button>
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
