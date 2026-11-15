import React from 'react'
import { cn } from '@/lib/utils'
import AppIcon from './AppIcon'

/**
 * Enterprise Button Component supporting multiple variants & loading states
 */
export function Button({
  children,
  type = 'button',
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon = null,
  iconRight = null,
  loading = false,
  disabled = false,
  className = '',
  onClick,
  ...props
}) {
  const baseClasses = "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 rounded-md select-none disabled:opacity-50 disabled:cursor-not-allowed"

  const sizeClasses = {
    sm: "text-xs px-2.5 py-1.5 gap-1.5",
    md: "text-sm px-3.5 py-2 gap-2",
    lg: "text-base px-4 py-2.5 gap-2.5"
  }

  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm",
    secondary: "bg-blue-50 text-blue-900 hover:bg-blue-100 focus:ring-blue-500 border border-blue-200",
    outline: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus:ring-blue-500",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-blue-500",
    danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-sm"
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
      {...props}
    >
      {loading && <AppIcon name="spinner" spin className="text-current" />}
      {!loading && icon && <AppIcon name={icon} className="text-current" />}
      <span>{children}</span>
      {!loading && iconRight && <AppIcon name={iconRight} className="text-current" />}
    </button>
  )
}

export default Button
