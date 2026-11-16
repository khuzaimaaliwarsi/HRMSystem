import React from 'react'
import { cn } from '@/lib/utils'

/**
 * iSysware HRMS — Brand Logo Mark
 * Circular vivid blue badge with bold white 'IS' branding.
 * Aligns strictly with brand identity across Login, Navbars, Sidebars & Modals.
 */
export function BrandLogo({
  size = 'md',
  className = '',
  onClick,
  title,
  ariaLabel = 'iSysware HRMS Logo'
}) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-14 h-14 text-2xl',
    '2xl': 'w-16 h-16 text-3xl'
  }

  const baseClasses = cn(
    'rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-400 text-white font-black tracking-tight select-none flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30 border border-blue-400/40 outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 select-none',
    sizeClasses[size] || sizeClasses.md,
    onClick && 'cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none active:outline-none',
    className
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
        className={baseClasses}
        title={title || ariaLabel}
        aria-label={ariaLabel}
      >
        <span>IS</span>
      </button>
    )
  }

  return (
    <div className={baseClasses} title={title} aria-label={ariaLabel}>
      <span>IS</span>
    </div>
  )
}

export default BrandLogo
