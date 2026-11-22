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
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    '2xl': 'w-24 h-24'
  }

  const baseClasses = cn(
    'rounded-full overflow-hidden select-none flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40 ring-1 ring-white/25 bg-[#001138]',
    sizeClasses[size] || sizeClasses.md,
    onClick && 'cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none active:outline-none',
    className
  )

  const content = (
    <img
      src="/logo.png"
      alt={ariaLabel}
      className="w-full h-full object-cover rounded-full select-none pointer-events-none drop-shadow-sm"
      style={{ imageRendering: '-webkit-optimize-contrast' }}
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
