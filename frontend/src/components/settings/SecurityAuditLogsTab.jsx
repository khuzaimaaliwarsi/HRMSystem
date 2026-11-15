import React, { useState, useEffect, useMemo } from 'react'
import { auditService } from '@/services/auditService'
import { useAuth } from '@/context/useAuth'
import AppIcon from '@/components/common/AppIcon'

/**
 * Helper to display snapshot values or 'Not recorded'
 */
function formatSnapshotValue(val) {
  if (val === undefined || val === null || val === '' || val === 'N/A') {
    return 'Not recorded'
  }
  return String(val)
}

/**
 * Helper to parse comma-separated key-value fields for detailed before/after comparison
 */
function parseFieldDiff(prevVal, newVal) {
  if (!prevVal || !newVal || typeof prevVal !== 'string' || typeof newVal !== 'string') return null
  if (prevVal === 'Not recorded' || newVal === 'Not recorded' || prevVal === 'N/A' || newVal === 'N/A') return null

  const parsePairs = (str) => {
    const pairs = {}
    const items = str.split(',').map((s) => s.trim())
    for (const item of items) {
      const idx = item.indexOf(':')
      if (idx > 0) {
        const key = item.slice(0, idx).trim()
        const val = item.slice(idx + 1).trim()
        pairs[key] = val
      }
    }
    return pairs
  }

  const prevPairs = parsePairs(prevVal)
  const newPairs = parsePairs(newVal)
  const keys = Array.from(new Set([...Object.keys(prevPairs), ...Object.keys(newPairs)]))

  if (keys.length === 0) return null

  return keys.map((key) => ({
    field: key,
    previous: prevPairs[key] !== undefined ? prevPairs[key] : 'Not recorded',
    current: newPairs[key] !== undefined ? newPairs[key] : 'Not recorded',
    hasChanged: prevPairs[key] !== newPairs[key]
  }))
}

export function SecurityAuditLogsTab() {
  const { user } = useAuth()
  const isAuthorized = !user || user.role === 'super_admin' || user.role === 'hr_admin'

  const [logs, setLogs] = useState(() => {
    try {
      const res = auditService.getLogs({}, user)
      return Array.isArray(res) ? res : []
    } catch {
      try {
        const fallback = auditService.getLogs()
        return Array.isArray(fallback) ? fallback : []
      } catch {
        return []
      }
    }
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAction, setSelectedAction] = useState('all')
  const [selectedLog, setSelectedLog] = useState(null)

  useEffect(() => {
    return auditService.subscribe(() => {
      try {
        const res = auditService.getLogs({}, user)
        setLogs(Array.isArray(res) ? res : [])
      } catch {
        try {
          const fallback = auditService.getLogs()
          setLogs(Array.isArray(fallback) ? fallback : [])
        } catch {
          setLogs([])
        }
      }
    })
  }, [user])

  const filteredLogs = useMemo(() => {
    if (!Array.isArray(logs)) return []
    return logs.filter((l) => {
      if (!l) return false
      if (selectedAction !== 'all') {
        const actionMatch = l.action && l.action.toLowerCase().includes(selectedAction.toLowerCase())
        const categoryMatch = l.category && l.category.toLowerCase().includes(selectedAction.toLowerCase())
        if (!actionMatch && !categoryMatch) return false
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const idMatch = l.id && l.id.toLowerCase().includes(q)
        const actorMatch = l.actor && l.actor.toLowerCase().includes(q)
        const actionMatch = l.action && l.action.toLowerCase().includes(q)
        const entityNameMatch = l.entityName && l.entityName.toLowerCase().includes(q)
        const entityMatch = l.entity && l.entity.toLowerCase().includes(q)
        const reasonMatch = (l.reason || l.description || l.summary || '').toLowerCase().includes(q)
        return idMatch || actorMatch || actionMatch || entityNameMatch || entityMatch || reasonMatch
      }
      return true
    })
  }, [logs, selectedAction, searchTerm])

  if (!isAuthorized) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AppIcon name="lock" className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Security and Configuration Audit Logs are restricted to Super Admin and HR Admin personnel.
        </p>
      </div>
    )
  }

  const parsedDiff = selectedLog
    ? parseFieldDiff(selectedLog.previousValue, selectedLog.newValue)
    : null

  return (
    <div className="space-y-5 text-left">
      {/* Submodule Header & Aligned Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Security, Configuration &amp; Audit Logs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable read-only ledger preserving all policy revisions, permission updates, company settings, and administrative events.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-slate-600 font-semibold">Tamper-Evident Immutable Store</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500 text-[11px] shrink-0">Action Filter:</span>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="all">All Actions ({(logs || []).length})</option>
            <option value="POLICY">Policy Updates</option>
            <option value="APPROVAL_MATRIX">Approval Matrix</option>
            <option value="ROLE_PERMISSION">Role Permissions</option>
            <option value="COMPANY_SETTINGS">Company Settings</option>
            <option value="ALERT_RULE">Alert Rules</option>
            <option value="HOLIDAY">Working Calendar</option>
            <option value="FRESH_QA">QA Governance / Baseline</option>
          </select>
        </div>

        <div className="relative min-w-[280px]">
          <AppIcon name="search" className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by event ID, actor, entity, reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Event ID &amp; Time</th>
                <th className="py-3 px-3">Actor</th>
                <th className="py-3 px-3">Action Type</th>
                <th className="py-3 px-3">Entity Affected</th>
                <th className="py-3 px-3">Change Summary</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!filteredLogs || filteredLogs.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <p className="font-medium text-xs">No matching audit records found.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your search query or choosing another action filter.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const summaryText = log.reason || log.description || log.summary || log.newValue || 'Not recorded'
                  const entityName = log.entityName || log.category || 'System'
                  const entityId = log.entity || log.entityId || log.id

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-blue-50/40 transition cursor-pointer group"
                      title="Click row to inspect audit snapshot"
                    >
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors block">
                          {log.id}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {log.timestamp || 'Not recorded'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 block">
                          {log.actor || 'Not recorded'}
                        </span>
                        {log.actorId && (
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {log.actorId}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60 inline-block">
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 block">
                          {entityName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {entityId}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={summaryText}>
                        {summaryText}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(log)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
                          title={`Inspect Snapshot: ${log.id}`}
                        >
                          <AppIcon name="eye" className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Audit Snapshot: {selectedLog.id}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {selectedLog.action}
                  </span>
                  {selectedLog.policyVersion && (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      v{selectedLog.policyVersion}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Tamper-evident read-only event snapshot captured on {selectedLog.timestamp || 'Not recorded'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Close modal"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            {/* Event Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Actor</span>
                <span className="font-bold text-slate-900 block truncate">{selectedLog.actor || 'Not recorded'}</span>
                <span className="text-[10px] font-mono text-slate-500 block truncate">
                  {selectedLog.actorId ? `ID: ${selectedLog.actorId}` : 'Not recorded'}
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Action Type</span>
                <span className="font-bold text-slate-900 font-mono block break-all text-[11px] leading-tight mt-0.5">{selectedLog.action || 'Not recorded'}</span>
                <span className="text-[10px] text-slate-500 capitalize block mt-0.5">
                  {selectedLog.actorRole ? `Role: ${selectedLog.actorRole}` : 'System Event'}
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Governance Scope</span>
                <span className="font-semibold text-slate-800 capitalize block truncate">
                  {selectedLog.scope || 'Company-Wide'}
                </span>
                <span className="text-[10px] font-mono text-slate-400 block truncate">
                  {selectedLog.timestamp || 'Not recorded'}
                </span>
              </div>

              <div className="sm:col-span-2 md:col-span-3 pt-1 border-t border-slate-200/70">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Entity Affected</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-slate-900">
                    {selectedLog.entityName || selectedLog.category || 'System Configuration'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                    ID: {selectedLog.entity || selectedLog.entityId || selectedLog.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Change Summary & Administrative Reason */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1">
                Change Summary &amp; Administrative Reason:
              </span>
              <p className="text-slate-800 bg-slate-50/80 p-3 rounded-xl border border-slate-200 text-xs leading-relaxed">
                {selectedLog.reason || selectedLog.description || selectedLog.summary || 'Not recorded'}
              </p>
            </div>

            {/* Historical Snapshot: Before vs After */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">
                  Historical State Snapshots (Preserved at Event Time):
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Read-Only Immutable Values
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Previous Snapshot */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                      Previous Snapshot (Before)
                    </span>
                    <span className="text-[10px] text-slate-400">Baseline</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/40 border border-rose-200 font-mono text-[11px] text-slate-800 break-all min-h-[64px] flex items-center">
                    {formatSnapshotValue(selectedLog.previousValue)}
                  </div>
                </div>

                {/* New Snapshot */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      New Snapshot (After)
                    </span>
                    <span className="text-[10px] text-slate-400">Applied</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-200 font-mono text-[11px] text-slate-800 break-all min-h-[64px] flex items-center">
                    {formatSnapshotValue(selectedLog.newValue)}
                  </div>
                </div>
              </div>

              {/* Detailed Field Diff Breakdown if parsed pairs exist */}
              {parsedDiff && parsedDiff.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 block">
                    Structured Field Changes:
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Field</th>
                          <th className="py-2 px-3 text-rose-700">Before Change</th>
                          <th className="py-2 px-3 text-emerald-700">After Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {parsedDiff.map((row) => (
                          <tr key={row.field} className={row.hasChanged ? 'bg-amber-50/30' : ''}>
                            <td className="py-2 px-3 font-semibold text-slate-800 font-sans">
                              {row.field}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {row.previous}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {row.current}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <AppIcon name="lock" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Historical audit snapshots are immutable and cannot be altered.</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SecurityAuditLogsTab
