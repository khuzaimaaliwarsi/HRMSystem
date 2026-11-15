import React from 'react'

/**
 * Format helper for summary metrics
 */
function formatMetric(val) {
  if (typeof val === 'number') {
    if (val >= 1000) {
      return val.toLocaleString('en-PK')
    }
    return val
  }
  return val || 0
}

/**
 * Format label nicely
 */
function humanizeKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .replace('Total', 'Total ')
    .replace('Count', '')
    .trim()
}

export default function ReportSummary({ summary = {} }) {
  const entries = Object.entries(summary).filter(([k]) => k !== 'reconciliation' && k !== 'error')

  if (entries.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="bg-white border border-hrms-border/70 rounded-lg p-3 shadow-xs flex flex-col justify-between"
        >
          <span className="text-[11px] font-semibold text-hrms-muted truncate uppercase tracking-wider">
            {humanizeKey(key)}
          </span>
          <div className="text-lg font-bold text-hrms-primary tracking-tight mt-1">
            {formatMetric(value)}
          </div>
        </div>
      ))}
    </div>
  )
}
