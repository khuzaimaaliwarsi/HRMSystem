import React from 'react'
import { cn } from '@/lib/utils'
import AppIcon from './AppIcon'
import Button from './Button'

export function EmptyState({
  title = 'No records found',
  description = 'There is currently no data to display for the selected view or filters.',
  icon = 'reports',
  actionLabel,
  onAction,
  actionIcon,
  className = ''
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-lg border border-dashed border-hrms-border bg-white", className)}>
      <div className="w-12 h-12 rounded-full bg-hrms-canvas text-hrms-muted flex items-center justify-center mb-3">
        <AppIcon name={icon} className="w-6 h-6 text-hrms-subtle" />
      </div>
      <h4 className="text-sm font-semibold text-hrms-primary mb-1">{title}</h4>
      <p className="text-xs text-hrms-muted max-w-sm mb-4 leading-normal">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" icon={actionIcon} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export default EmptyState
