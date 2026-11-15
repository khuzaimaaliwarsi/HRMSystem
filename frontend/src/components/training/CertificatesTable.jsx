import React, { useState } from 'react'

export default function CertificatesTable({
  certificates = [],
  onPreviewCertificate
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = certificates.filter((c) => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase().trim()
    return (
      c.employeeName.toLowerCase().includes(q) ||
      c.employeeId.toLowerCase().includes(q) ||
      c.programTitle.toLowerCase().includes(q) ||
      c.certificateNumber.toLowerCase().includes(q) ||
      c.verificationCode.toLowerCase().includes(q)
    )
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-left">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Search certificate #, employee, code..."
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

        <div className="text-xs text-slate-500 font-medium">
          Total Issued: <strong>{filtered.length}</strong> certificates
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
              <th className="py-2.5 px-4">Certificate ID &amp; Code</th>
              <th className="py-2.5 px-4">Recipient</th>
              <th className="py-2.5 px-4">Certified Syllabus / Program</th>
              <th className="py-2.5 px-4">Issue &amp; Expiry Date</th>
              <th className="py-2.5 px-4">Grade / Achievement</th>
              <th className="py-2.5 px-4">Authorized Directorate</th>
              <th className="py-2.5 px-4 text-right">Certificate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-400">
                  No verified certificates match your search.
                </td>
              </tr>
            ) : (
              filtered.map((cert) => (
                <tr key={cert.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-navy-950 font-mono text-xs">
                      {cert.certificateNumber}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                      <i className="fa-solid fa-shield-check text-emerald-600"></i>
                      <span>{cert.verificationCode}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 text-xs">{cert.employeeName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{cert.employeeId} • {cert.department}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 max-w-[200px] truncate" title={cert.programTitle}>
                    {cert.programTitle}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                    <div>Issued: {cert.issueDate}</div>
                    <div className="text-slate-400">Valid: {cert.expiryDate || 'Lifetime'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {cert.grade}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-[11px] max-w-[160px] truncate">
                    {cert.authorizedIssuer}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onPreviewCertificate?.(cert)}
                      className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <i className="fa-solid fa-award text-blue-600"></i>
                      View Certificate
                    </button>
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
