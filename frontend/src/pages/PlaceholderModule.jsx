import React from 'react'
import { useLocation } from 'react-router-dom'
import { PORTAL_CONFIG } from '@/config/navigation'
import { useAuth } from '@/context/useAuth'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import PageHeader from '@/components/common/PageHeader'

/**
 * Honest Placeholder Module for F00 batch
 * Explicitly states the module name, scope, and target batch ID according to PRD/TRD/Agent guidelines.
 */
export function PlaceholderModule({ moduleName, batchId, description }) {
  const location = useLocation()
  const { user } = useAuth()

  // Find matching nav item details
  let matchedItem = null
  let matchedGroup = null

  if (user?.role && PORTAL_CONFIG[user.role]) {
    for (const group of PORTAL_CONFIG[user.role].menuGroups) {
      const found = group.items.find((item) => item.path === location.pathname)
      if (found) {
        matchedItem = found
        matchedGroup = group.groupLabel
        break
      }
    }
  }

  const title = moduleName || matchedItem?.label || 'HRMS Module'
  const targetBatch = batchId || matchedItem?.batchId || 'Future Batch'
  const icon = matchedItem?.icon || 'settings'

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={description || `Scheduled for independent implementation in ${targetBatch}`}
        badge={<StatusBadge status="Not Implemented in F00" variant="warning" />}
        breadcrumbs={[
          user?.roleLabel || 'Portal',
          matchedGroup || 'Modules',
          title
        ]}
      />

      <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card p-8 sm:p-12 text-center max-w-3xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-hrms-accent-light text-hrms-accent flex items-center justify-center mx-auto mb-4 border border-blue-100">
          <AppIcon name={icon} className="w-8 h-8 text-hrms-accent" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 mb-3">
          <AppIcon name="lock" className="w-3.5 h-3.5 text-slate-500" />
          <span>Batch Gate: {targetBatch}</span>
        </div>

        <h3 className="text-xl font-bold text-hrms-primary mb-2">
          {title}
        </h3>

        <p className="text-sm text-hrms-muted max-w-lg mx-auto mb-6 leading-relaxed">
          In strict compliance with the project delivery guidelines (<strong>Batch F00 Foundation Only</strong>), business logic for this module is deliberately not executed here. It will be built in its own dedicated prompt after owner sign-off.
        </p>

        <div className="bg-hrms-canvas rounded-lg p-4 border border-hrms-border text-left text-xs space-y-2 max-w-xl mx-auto">
          <div className="flex items-center justify-between font-semibold text-hrms-primary border-b border-hrms-border/70 pb-1.5">
            <span>Module Architectural Invariant</span>
            <span className="text-hrms-accent font-mono">{location.pathname}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-hrms-muted">
            <div>
              <span className="font-medium text-hrms-text">Target Delivery:</span> {targetBatch}
            </div>
            <div>
              <span className="font-medium text-hrms-text">Active Role Scope:</span> {user?.roleLabel}
            </div>
            <div>
              <span className="font-medium text-hrms-text">Stack Standard:</span> JavaScript ES/JSX
            </div>
            <div>
              <span className="font-medium text-hrms-text">Database Layer:</span> Not Started (Gate)
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-hrms-border/70 flex items-center justify-center gap-2 text-xs text-hrms-muted">
          <AppIcon name="shield" className="w-3.5 h-3.5 text-hrms-accent" />
          <span>iSysware HRMS — Batch Foundation Verified. Ready for owner-authorized module prompts.</span>
        </div>
      </div>
    </div>
  )
}

export default PlaceholderModule
