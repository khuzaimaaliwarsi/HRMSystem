import React, { useState } from 'react'

export default function ReportTable({
  columns = [],
  rows = [],
  totals = {},
  metadata = {},
  reconciliation = {}
}) {
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)

  const totalRows = rows.length
  const effectivePageSize = pageSize === 'all' ? totalRows : pageSize
  const totalPages = Math.max(1, Math.ceil(totalRows / (effectivePageSize || 1)))
  const safePage = Math.min(currentPage, totalPages)

  const startIndex = (safePage - 1) * (effectivePageSize || totalRows)
  const endIndex = pageSize === 'all' ? totalRows : Math.min(startIndex + pageSize, totalRows)
  const visibleRows = rows.slice(startIndex, endIndex)

  /**
   * Value formatting helper
   */
  const formatCellValue = (val, col) => {
    if (val === undefined || val === null || val === '') return '-'

    if (col.type === 'currency' && typeof val === 'number') {
      return (
        <span className="font-mono font-medium text-slate-900">
          {val.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    }

    if (col.type === 'number' && typeof val === 'number') {
      return <span className="font-mono font-medium text-slate-800">{val.toLocaleString('en-PK')}</span>
    }

    // Status / Badge formatting
    if (col.key === 'status' || col.key === 'verificationStatus' || col.key === 'complianceStatus') {
      const s = String(val).toLowerCase()
      let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200'
      if (s.includes('active') || s.includes('verified') || s.includes('approved') || s.includes('compliant') || s.includes('confirmed') || s.includes('clean') || s.includes('settled')) {
        badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      } else if (s.includes('pending') || s.includes('probation') || s.includes('draft') || s.includes('in progress')) {
        badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200'
      } else if (s.includes('excess') || s.includes('rejected') || s.includes('failed') || s.includes('breach') || s.includes('separated')) {
        badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200'
      }

      return (
        <span className={`inline-block px-2 py-0.5 text-[10.5px] font-semibold rounded-full border ${badgeStyle}`}>
          {val}
        </span>
      )
    }

    return String(val)
  }

  return (
    <div className="bg-white border border-hrms-border rounded-lg shadow-xs overflow-hidden">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          {/* Navy Column Header */}
          <thead>
            <tr className="bg-[#102746] text-white divide-x divide-slate-700">
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`py-2.5 px-3 font-semibold text-[11px] tracking-wide whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                  style={{ minWidth: col.width ? `${col.width * 7}px` : '100px' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Data Rows with Alternating Colors */}
          <tbody className="divide-y divide-slate-200">
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-500 italic bg-slate-50"
                >
                  No records found matching the applied filter criteria.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, rIdx) => {
                const isAlt = rIdx % 2 === 1
                return (
                  <tr
                    key={rIdx}
                    className={`transition-colors divide-x divide-slate-100 ${
                      isAlt ? 'bg-[#F4F8FA]' : 'bg-white'
                    } hover:bg-sky-50/60`}
                  >
                    {columns.map((col, cIdx) => (
                      <td
                        key={col.key || cIdx}
                        className={`py-2 px-3 text-slate-800 ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {formatCellValue(row[col.key], col)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>

          {/* Grand Totals Footer */}
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-[#E2E8F0] border-t-2 border-slate-300 divide-x divide-slate-300 font-bold text-slate-900">
                {columns.map((col, cIdx) => {
                  if (cIdx === 0) {
                    return (
                      <td key={cIdx} className="py-2.5 px-3 text-left font-bold text-xs uppercase tracking-wide">
                        GRAND TOTAL
                      </td>
                    )
                  }
                  if ((col.type === 'currency' || col.type === 'number') && totals && totals[col.key] !== null) {
                    const tVal = totals[col.key]
                    return (
                      <td key={cIdx} className="py-2.5 px-3 text-right font-mono text-xs font-bold text-slate-950">
                        {col.type === 'currency'
                          ? tVal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : tVal.toLocaleString('en-PK')}
                      </td>
                    )
                  }
                  return <td key={cIdx} className="py-2.5 px-3"></td>
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-slate-900">{totalRows === 0 ? 0 : startIndex + 1}</strong> to{' '}
            <strong className="text-slate-900">{endIndex}</strong> of{' '}
            <strong className="text-slate-900">{totalRows}</strong> entries
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[11px] text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value)
                setPageSize(val)
                setCurrentPage(1)
              }}
              className="text-xs h-6 px-1.5 bg-white border border-slate-300 rounded text-slate-700"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {pageSize !== 'all' && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-2 text-xs font-medium text-slate-700">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Audit & Reconciliation Statement Footer */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 text-[11px] text-slate-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Reconciliation:</span>
            <span className={reconciliation.reconciled !== false ? 'text-emerald-700 font-medium' : 'text-rose-600 font-bold'}>
              {reconciliation.reconciled !== false ? 'Verified & Reconciled with Source Records' : 'Discrepancy Detected'}
            </span>
          </div>
          <div className="text-slate-500">
            Generated At: <strong>{metadata.generatedAtFormatted}</strong> | Generated By: <strong>{metadata.generatedBy}</strong>
          </div>
        </div>

        <div className="text-right text-slate-500">
          <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 font-semibold rounded text-[10px] uppercase">
            {metadata.confidentialityNotice || 'Internal Use Only'}
          </span>
        </div>
      </div>
    </div>
  )
}
