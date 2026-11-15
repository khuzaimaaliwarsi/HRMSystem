import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function IssuedLettersTable({
  letters = [],
  currentUser = null,
  isLoading = false,
  loadError = null,
  hasLoaded = true,
  onRetry = null,
  onViewPrint,
  onSubmitApproval,
  onApprove,
  onReject,
  onIssueLetter
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const isHrOrSuper =
    currentUser?.role === 'super_admin' || currentUser?.role === 'hr_admin'

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase()
    switch (s) {
      case 'issued':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'approved':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'pending approval':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'draft':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const distinctTypes = Array.from(new Set(letters.map((l) => l.letterType).filter(Boolean)))

  const filteredLetters = letters.filter((l) => {
    const matchesSearch =
      l.letterId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.referenceNumber && l.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      l.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.subject?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || l.status?.toLowerCase() === statusFilter.toLowerCase()

    const matchesType = typeFilter === 'all' || l.letterType === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  const canApprove = (letter) => {
    if (!currentUser) return false
    const role = String(currentUser.role || '').toLowerCase()
    if (role === 'super_admin') return true
    const actorId = currentUser.employeeId || currentUser.id
    if (letter.preparedById === actorId) return false // Anti-self-approval for non-Super Admin roles
    if (role === 'hr_admin' && !letter.isProtectedSalary) return true
    return false
  }

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
              placeholder="Search reference, employee, subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="issued">Issued</option>
            <option value="pending approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Letter Types</option>
            {distinctTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          {isLoading && (
            <span className="inline-flex items-center gap-1.5 text-blue-600 font-semibold">
              <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Syncing...
            </span>
          )}
          <span>Showing {filteredLetters.length} of {letters.length} letters</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md disabled:opacity-50 cursor-pointer"
              title="Refresh letters from PostgreSQL"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {loadError && letters.length > 0 && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-800">
          <span>Sync warning: {loadError} (showing last loaded records)</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-semibold cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Ref Number & ID</th>
              <th className="py-3 px-4">Recipient</th>
              <th className="py-3 px-4">Letter Type</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Effective / Issued Date</th>
              <th className="py-3 px-4">Signatory</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && letters.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-10 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2 text-xs font-medium">
                    <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Loading issued letters from PostgreSQL...
                  </div>
                </td>
              </tr>
            ) : loadError && letters.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-10 text-center">
                  <div className="max-w-md mx-auto space-y-2.5">
                    <AppIcon name="alertCircle" className="w-8 h-8 mx-auto text-rose-500" />
                    <div className="text-xs font-semibold text-rose-700">
                      Failed to load issued letters
                    </div>
                    <div className="text-[11px] text-slate-500">{loadError}</div>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                      >
                        Retry Loading Letters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : !hasLoaded && letters.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-10 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2 text-xs font-medium">
                    <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Initializing letters register...
                  </div>
                </td>
              </tr>
            ) : filteredLetters.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-400">
                  <AppIcon name="award" className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No letters recorded in register.
                </td>
              </tr>
            ) : (
              filteredLetters.map((ltr) => (
                <tr key={ltr.letterId || ltr.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    {ltr.referenceNumber ? (
                      <div className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded inline-block text-[11px]">
                        {ltr.referenceNumber}
                      </div>
                    ) : (
                      <div className="font-mono text-slate-500 text-[11px]">{ltr.letterId}</div>
                    )}
                    {ltr.isProtectedSalary && (
                      <span className="block text-[9px] text-rose-600 font-semibold uppercase mt-0.5">
                        Protected Salary
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{ltr.employeeName}</div>
                    <div className="text-[11px] text-slate-500">
                      {ltr.employeeId} • {ltr.department}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{ltr.letterType}</td>
                  <td className="py-3 px-4">
                    <div className="text-slate-700 truncate max-w-[200px]" title={ltr.subject}>
                      {ltr.subject}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <div>Eff: {ltr.effectiveDate || 'Immediate'}</div>
                    {ltr.issuedAt && (
                      <div className="text-[10px] text-slate-400">
                        Issued: {ltr.issuedAt.slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{ltr.signatoryName}</div>
                    <div className="text-[10px] text-slate-400">{ltr.signatoryTitle}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(
                        ltr.status
                      )}`}
                    >
                      {ltr.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View / Print modal button */}
                      <button
                        onClick={() => onViewPrint && onViewPrint(ltr)}
                        className="px-2 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors"
                        title="View Letterhead & Print/PDF"
                      >
                        {ltr.status === 'Issued' ? 'Print / PDF' : 'Preview'}
                      </button>

                      {/* Draft / Returned actions */}
                      {(ltr.status === 'Draft' || ltr.status === 'Rejected') && onSubmitApproval && (
                        <button
                          onClick={() => onSubmitApproval(ltr.letterId)}
                          className="px-2 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded"
                          title="Submit for Executive Approval"
                        >
                          Submit
                        </button>
                      )}

                      {/* Pending Approval actions */}
                      {ltr.status === 'Pending Approval' && canApprove(ltr) && (
                        <>
                          <button
                            onClick={() => onApprove && onApprove(ltr.letterId)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Approve Letter"
                          >
                            <AppIcon name="check" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onReject && onReject(ltr.letterId)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                            title="Reject Letter"
                          >
                            <AppIcon name="xmark" className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Final Issuance action */}
                      {ltr.approvalStatus === 'Approved' && ltr.status !== 'Issued' && isHrOrSuper && (
                        <button
                          onClick={() => onIssueLetter && onIssueLetter(ltr.letterId)}
                          className="px-2 py-1 text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded shadow-2xs"
                          title="Publish and Assign Immutable Reference"
                        >
                          Issue Final
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
