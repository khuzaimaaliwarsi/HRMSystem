import React, { useState, useEffect, useMemo } from 'react'
import { expenseService } from '@/services/expenseService'

export function ExpenseAuditHistoryTab() {
  const [rawLogs, setRawLogs] = useState(() => expenseService.getAuditLogs())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAction, setSelectedAction] = useState('ALL')
  const [selectedClaim, setSelectedClaim] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    // Initial fetch from backend if empty
    if (!rawLogs || rawLogs.length === 0) {
      expenseService._refreshAuditLogsSafeAsync?.().catch(() => {})
    }
    const unsub = expenseService.subscribe(() => {
      setRawLogs(expenseService.getAuditLogs())
    })
    return () => unsub()
  }, [])

  // Sorted latest first
  const sortedLogs = useMemo(() => {
    return [...rawLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [rawLogs])

  // Extract distinct claims for quick filter
  const distinctClaims = useMemo(() => {
    const set = new Set()
    sortedLogs.forEach((l) => {
      const cn = l.claimNumber || l.metadata?.claimNumber
      if (cn) set.add(cn)
    })
    return Array.from(set).sort()
  }, [sortedLogs])

  // Apply filters
  const filteredLogs = useMemo(() => {
    return sortedLogs.filter((log) => {
      // Action filter
      if (selectedAction !== 'ALL') {
        if (selectedAction === 'DISBURSEMENTS' && log.action !== 'DISBURSE_REIMBURSEMENT') return false
        if (selectedAction === 'REVERSALS' && log.action !== 'REIMBURSEMENT_REVERSED') return false
        if (selectedAction === 'APPROVALS' && !['CLAIM_APPROVED', 'CLAIM_REJECTED', 'CLAIM_RETURNED'].includes(log.action)) return false
        if (selectedAction === 'SUBMISSIONS' && log.action !== 'CLAIM_SUBMITTED') return false
        if (selectedAction === 'POLICIES' && !['CATEGORY_CREATED', 'CATEGORY_UPDATED', 'POLICY_STATUS_TOGGLED'].includes(log.action)) return false
      }

      // Claim filter
      const claimNo = log.claimNumber || log.metadata?.claimNumber || ''
      if (selectedClaim !== 'ALL' && claimNo !== selectedClaim) {
        return false
      }

      // Search keyword filter
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        const textToMatch = [
          log.action,
          log.actor,
          log.summary,
          claimNo,
          log.transactionReference || log.metadata?.transactionReference || '',
          log.id
        ].join(' ').toLowerCase()
        if (!textToMatch.includes(q)) return false
      }

      return true
    })
  }, [sortedLogs, selectedAction, selectedClaim, searchTerm])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedAction, selectedClaim, pageSize])

  // Pagination calculation
  const totalItems = filteredLogs.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredLogs.slice(start, start + pageSize)
  }, [filteredLogs, currentPage, pageSize])

  const getActionBadgeStyle = (action) => {
    switch (action) {
      case 'DISBURSE_REIMBURSEMENT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'REIMBURSEMENT_REVERSED':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'CLAIM_APPROVED':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'CLAIM_REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'CLAIM_RETURNED':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'CLAIM_SUBMITTED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const getActionLabel = (action) => {
    switch (action) {
      case 'DISBURSE_REIMBURSEMENT':
        return 'Disbursement Paid'
      case 'REIMBURSEMENT_REVERSED':
        return 'Payment Reversed'
      case 'CLAIM_APPROVED':
        return 'Claim Approved'
      case 'CLAIM_REJECTED':
        return 'Claim Rejected'
      case 'CLAIM_RETURNED':
        return 'Claim Returned'
      case 'CLAIM_SUBMITTED':
        return 'Claim Submitted'
      default:
        return action
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden text-left">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Expense Management Immutable Audit Trail</h3>
          <p className="text-xs text-slate-500 mt-0.5">Chronological log of claims, reviews, disbursements and reversals</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            {totalItems} of {sortedLogs.length} Events
          </span>
          <button
            onClick={() => expenseService.loadExpensesDataAsync().catch(() => {})}
            className="text-xs px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium transition-colors"
            title="Refresh from PostgreSQL"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-slate-50/60 border-b border-slate-200/70 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Keyword Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by claim number, transaction ref, actor, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-400"
            />
          </div>

          {/* Claim Filter Dropdown */}
          {distinctClaims.length > 0 && (
            <div className="sm:w-56">
              <select
                value={selectedClaim}
                onChange={(e) => setSelectedClaim(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
              >
                <option value="ALL">All Claims ({distinctClaims.length})</option>
                {distinctClaims.map((cn) => (
                  <option key={cn} value={cn}>
                    {cn}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Page Size */}
          <div className="sm:w-32">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>

        {/* Action Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Filter Action:</span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'DISBURSEMENTS', label: 'Disbursements' },
            { id: 'REVERSALS', label: 'Reversals' },
            { id: 'APPROVALS', label: 'Approvals & Reviews' },
            { id: 'SUBMISSIONS', label: 'Submissions' },
            { id: 'POLICIES', label: 'Categories / Policies' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedAction(tab.id)}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                selectedAction === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {(searchTerm || selectedAction !== 'ALL' || selectedClaim !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedAction('ALL')
                setSelectedClaim('ALL')
              }}
              className="text-[11px] text-blue-600 hover:underline ml-2 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Timeline List */}
      <div className="p-5">
        {paginatedLogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xs text-slate-400">
              No audit records matching current filters.
            </p>
            {(searchTerm || selectedAction !== 'ALL' || selectedClaim !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedAction('ALL')
                  setSelectedClaim('ALL')
                }}
                className="mt-2 text-xs text-blue-600 hover:underline font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {paginatedLogs.map((log) => {
              const claimNo = log.claimNumber || log.metadata?.claimNumber
              const txnRef = log.transactionReference || log.metadata?.transactionReference
              const amount = log.amount ?? log.metadata?.amount
              const paymentAccount = log.metadata?.paymentAccount

              return (
                <div key={log.id} className="relative group">
                  <div
                    className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${
                      log.action === 'DISBURSE_REIMBURSEMENT'
                        ? 'bg-emerald-600'
                        : log.action === 'REIMBURSEMENT_REVERSED'
                          ? 'bg-purple-600'
                          : log.action === 'CLAIM_APPROVED'
                            ? 'bg-blue-600'
                            : log.action === 'CLAIM_REJECTED'
                              ? 'bg-rose-600'
                              : 'bg-slate-500'
                    }`}
                  />
                  <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/80 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${getActionBadgeStyle(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {getActionLabel(log.action)}
                        </span>
                        {claimNo && (
                          <span className="text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                            {claimNo}
                          </span>
                        )}
                        {amount !== undefined && amount !== null && (
                          <span className="text-[10px] font-bold text-slate-800 bg-emerald-50/80 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                            PKR {Number(amount).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 mt-2 font-medium">
                      {log.summary}
                    </p>

                    {/* Metadata strip */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                      <span className="font-semibold text-blue-700">Actor: {log.actor}</span>
                      {txnRef && (
                        <span>
                          Txn Ref: <span className="font-mono font-medium text-slate-700">{txnRef}</span>
                        </span>
                      )}
                      {paymentAccount && (
                        <span>
                          A/C: <span className="font-medium text-slate-700">{paymentAccount}</span>
                        </span>
                      )}
                      <span className="font-mono text-slate-400">ID: {log.id}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-700">
                {Math.min(currentPage * pageSize, totalItems)}
              </span>{' '}
              of <span className="font-semibold text-slate-700">{totalItems}</span> events
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 font-medium"
              >
                Previous
              </button>

              <span className="px-2 text-slate-600 font-mono">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExpenseAuditHistoryTab
