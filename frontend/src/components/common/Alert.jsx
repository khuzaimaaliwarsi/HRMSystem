import React from 'react'
import { cn } from '@/lib/utils'
import AppIcon from './AppIcon'

export function Alert({
  variant = 'info', // 'info' | 'success' | 'warning' | 'danger'
  title,
  children,
  onClose,
  className = ''
}) {
  const styles = {
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-900',
      icon: 'info',
      iconColor: 'text-blue-600'
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: 'success',
      iconColor: 'text-emerald-600'
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: 'warning',
      iconColor: 'text-amber-600'
    },
    danger: {
      container: 'bg-red-50 border-red-200 text-red-900',
      icon: 'danger',
      iconColor: 'text-red-600'
    }
  }

  const current = styles[variant] || styles.info

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 p-3.5 rounded-md border text-sm transition-all",
        current.container,
        className
      )}
    >
      <AppIcon name={current.icon} className={cn("w-4 h-4 shrink-0 mt-0.5", current.iconColor)} />
      <div className="flex-1 text-left">
        {title && <h5 className="font-semibold text-xs mb-0.5 uppercase tracking-wider">{title}</h5>}
        <div className="text-xs leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 p-0.5 rounded focus:outline-none"
        >
          <AppIcon name="close" className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export default Alert
