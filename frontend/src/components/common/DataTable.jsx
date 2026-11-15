import React from 'react'
import { cn } from '@/lib/utils'
import EmptyState from './EmptyState'
import AppIcon from './AppIcon'

/**
 * DataTable Component (structural primitive)
 */
export function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  loading = false,
  emptyTitle = 'No data available',
  emptyDescription = 'There are no records matching the selected parameters.',
  className = '',
  onRowClick
}) {
  return (
    <div className={cn("w-full bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-hrms-canvas border-b border-hrms-border text-xs uppercase font-semibold text-hrms-muted tracking-wider">
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={cn(
                    "px-4 py-3 select-none",
                    col.align === 'right' && "text-right",
                    col.align === 'center' && "text-center",
                    col.className
                  )}
                >
                  <div className={cn(
                    "inline-flex items-center gap-1.5",
                    col.align === 'right' && "justify-end",
                    col.align === 'center' && "justify-center"
                  )}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <AppIcon name="chevronDown" className="w-3 h-3 text-hrms-subtle" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hrms-border/70">
            {loading ? (
              <tr>
                <td colSpan={(columns || []).length} className="px-4 py-12 text-center text-hrms-muted">
                  <div className="flex items-center justify-center gap-2">
                    <AppIcon name="spinner" spin className="text-hrms-primary" />
                    <span>Loading records...</span>
                  </div>
                </td>
              </tr>
            ) : (data || []).length === 0 ? (
              <tr>
                <td colSpan={(columns || []).length} className="p-4">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              (data || []).map((row, rowIdx) => (
                <tr
                  key={row?.[keyField] || rowIdx}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "hover:bg-hrms-canvas/80 transition-colors",
                    onRowClick && "cursor-pointer",
                    rowIdx % 2 === 1 && "bg-slate-50/40"
                  )}
                >
                  {(columns || []).map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={cn(
                        "px-4 py-3 text-xs text-hrms-text whitespace-nowrap",
                        col.align === 'right' && "text-right font-mono",
                        col.align === 'center' && "text-center",
                        col.tdClassName
                      )}
                    >
                      {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer / Summary Strip */}
      {(data || []).length > 0 && (
        <div className="px-4 py-2.5 bg-hrms-canvas border-t border-hrms-border flex items-center justify-between text-xs text-hrms-muted">
          <span>Showing {(data || []).length} record{(data || []).length > 1 ? 's' : ''}</span>
          <span className="text-[11px] text-hrms-subtle">iSysware HRMS Tabular Standard</span>
        </div>
      )}
    </div>
  )
}

export default DataTable
