import React from 'react'
import { cn } from '@/lib/utils'
import AppIcon from './AppIcon'

export function LoadingState({
  message = 'Loading data...',
  description,
  className = ''
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 sm:p-12 text-center", className)}>
      <div className="w-10 h-10 rounded-full bg-hrms-accent-light text-hrms-primary flex items-center justify-center mb-3">
        <AppIcon name="spinner" spin className="w-5 h-5 text-hrms-primary" />
      </div>
      <p className="text-sm font-medium text-hrms-primary">{message}</p>
      {description && (
        <p className="text-xs text-hrms-muted mt-1">{description}</p>
      )}
    </div>
  )
}

export default LoadingState
