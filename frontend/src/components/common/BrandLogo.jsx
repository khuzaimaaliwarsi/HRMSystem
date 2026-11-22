import React from 'react'
import { cn } from '@/lib/utils'

/**
 * iSysware HRMS — Brand Logo Mark
 * Official corporate circular logo with 'iSysware Business Software Solutions' branding.
 * 100% exact transparent vector rendering matching official branding.
 */
export function BrandLogo({
  size = 'md',
  className = '',
  onClick,
  title,
  ariaLabel = 'iSysware HRMS Logo'
}) {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-24 h-24',
    '2xl': 'w-28 h-28'
  }

  const baseClasses = cn(
    'select-none flex items-center justify-center shrink-0',
    sizeClasses[size] || sizeClasses.md,
    onClick && 'cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none active:outline-none',
    className
  )

  const content = (
    <img
      src="/logo.png"
      alt={ariaLabel}
      className="w-full h-full object-contain select-none pointer-events-none drop-shadow-sm"
      draggable={false}
    />
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
        {content}
      </button>
    )
  }

  return (
    <div className={baseClasses} title={title} aria-label={ariaLabel}>
      {content}
    </div>
  )
}

export default BrandLogo
