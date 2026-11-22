import React from 'react'
import { cn } from '@/lib/utils'

/**
 * iSysware HRMS — Brand Logo Mark
 * Official corporate circular logo with 'iSysware Business Software Solutions' branding.
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
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14',
    '2xl': 'w-16 h-16'
  }

  const baseClasses = cn(
    'rounded-full overflow-hidden select-none flex items-center justify-center shrink-0 shadow-md shadow-blue-900/30 border border-blue-400/30 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none select-none bg-[#0a1835]',
    sizeClasses[size] || sizeClasses.md,
    onClick && 'cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none active:outline-none',
    className
  )

  const content = (
    <img
      src="/logo.png"
      alt={ariaLabel}
      className="w-full h-full object-cover rounded-full select-none pointer-events-none"
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
