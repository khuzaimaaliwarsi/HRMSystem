import React from 'react'
import { cn } from '@/lib/utils'

export function StatusBadge({
  status,
  variant,
  children,
  size = 'md',
  showDot = true,
  className = ''
}) {
  const normalized = (status || children || '').toString().trim().toLowerCase().replace(/[_-]+/g, ' ')
  const rawLower = (status || children || '').toString().trim().toLowerCase()
  const labelOverrides = {
    separated: 'Inactive',
    pending_approval: 'Pending Approval',
    pending_super_admin_review: 'Pending Review',
    disbursed: 'Disbursed',
    approved: 'Approved',
    draft: 'Draft',
    void: 'Void',
    processing: 'Processing'
  }
  const displayLabel = children || labelOverrides[rawLower] || status

  let resolvedVariant = variant
  if (!resolvedVariant) {
    if (['active', 'approved', 'paid', 'disbursed', 'posted', 'finalized', 'completed', 'present', 'verified', 'passed', 'confirmed', 'accepted', 'joined', 'hired'].includes(normalized)) {
      resolvedVariant = 'success'
    } else if (['pending', 'pending approval', 'pending super admin review', 'in review', 'under review', 'submitted', 'draft', 'in progress', 'processing', 'partial', 'on probation', 'grace'].includes(normalized)) {
      resolvedVariant = 'warning'
    } else if (['rejected', 'inactive', 'separated', 'failed', 'absent', 'unpaid', 'overdue', 'breached', 'cancelled', 'declined', 'void'].includes(normalized)) {
      resolvedVariant = 'danger'
    } else if (['wfh', 'hybrid', 'field duty', 'escalated', 'assigned', 'scheduled', 'issued'].includes(normalized)) {
      resolvedVariant = 'info'
    } else {
      resolvedVariant = 'neutral'
    }
  }

  const variantStyles = {
    success: 'bg-hrms-success-light text-hrms-success border-hrms-success/20',
    warning: 'bg-hrms-warning-light text-hrms-warning border-hrms-warning/30',
    danger: 'bg-hrms-danger-light text-hrms-danger border-hrms-danger/20',
    info: 'bg-hrms-info-light text-hrms-info border-hrms-info/20',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    primary: 'bg-hrms-accent-light text-hrms-primary border-hrms-accent/20'
  }

  const dotColors = {
    success: 'bg-hrms-success',
    warning: 'bg-hrms-warning',
    danger: 'bg-hrms-danger',
    info: 'bg-hrms-info',
    neutral: 'bg-gray-400',
    primary: 'bg-hrms-primary'
  }

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5'
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border leading-none select-none",
        variantStyles[resolvedVariant] || variantStyles.neutral,
        sizeStyles[size] || sizeStyles.md,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            dotColors[resolvedVariant] || dotColors.neutral
          )}
        />
      )}
      <span className="capitalize">{displayLabel}</span>
    </span>
  )
}

export default StatusBadge
