import React from 'react'
import { cn } from '@/lib/utils'
import AppIcon from './AppIcon'

const COLOR_PALETTES = {
  blue: {
    iconBg: 'bg-blue-50 text-blue-600',
    bars: ['#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8'],
    heights: [16, 12, 8, 4, 0]
  },
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-600',
    bars: ['#A7F3D0', '#6EE7B7', '#34D399', '#10B981', '#059669'],
    heights: [14, 10, 6, 3, 0]
  },
  amber: {
    iconBg: 'bg-amber-50 text-amber-600',
    bars: ['#FDE68A', '#FCD34D', '#FBBF24', '#F59E0B', '#D97706'],
    heights: [18, 12, 15, 8, 2]
  },
  purple: {
    iconBg: 'bg-purple-50 text-purple-600',
    bars: ['#E9D5FF', '#D8B4FE', '#C084FC', '#A855F7', '#7E22CE'],
    heights: [18, 14, 10, 5, 1]
  },
  rose: {
    iconBg: 'bg-rose-50 text-rose-600',
    bars: ['#FECDD3', '#FDA4AF', '#FB7185', '#F43F5E', '#E11D48'],
    heights: [16, 12, 8, 4, 0]
  },
  indigo: {
    iconBg: 'bg-indigo-50 text-indigo-600',
    bars: ['#C7D2FE', '#A5B4FC', '#818CF8', '#6366F1', '#4F46E5'],
    heights: [16, 12, 8, 4, 0]
  },
  cyan: {
    iconBg: 'bg-cyan-50 text-cyan-600',
    bars: ['#A5F3FC', '#67E8F9', '#22D3EE', '#06B6D4', '#0891B2'],
    heights: [14, 10, 6, 3, 0]
  }
}

function resolvePalette(color, title = '', icon = '') {
  if (color && COLOR_PALETTES[color]) return COLOR_PALETTES[color]

  const str = `${title} ${icon}`.toLowerCase()
  if (str.includes('active') || str.includes('present') || str.includes('contract') || str.includes('approved') || str.includes('paid')) {
    return COLOR_PALETTES.emerald
  }
  if (str.includes('leave') || str.includes('pending') || str.includes('warning') || str.includes('open') || str.includes('absent')) {
    return COLOR_PALETTES.amber
  }
  if (str.includes('probation') || str.includes('review') || str.includes('task') || str.includes('hour') || str.includes('time')) {
    return COLOR_PALETTES.purple
  }
  if (str.includes('reject') || str.includes('danger') || str.includes('late') || str.includes('overdue')) {
    return COLOR_PALETTES.rose
  }
  return COLOR_PALETTES.blue
}

/**
 * Standardized Unified Metric KPI Card Component
 * Exactly matches the approved modern sleek card design across all modules:
 * - Rounded 2xl border with subtle shadow
 * - Top row: mini colored icon + label (Arrow completely removed)
 * - Middle: big bold metric value
 * - Bottom: context subtitle + 5-bar sparkline SVG in matching color palette
 */
export function KPICard({
  title,
  label,
  value,
  subtitle,
  description,
  icon = 'employees',
  color,
  trend,
  className = '',
  iconClassName = '',
  onClick
}) {
  const displayTitle = title || label || ''
  const displaySubtitle = subtitle || description || (trend ? `${trend.value || ''} ${trend.label || ''}`.trim() : '')
  const palette = resolvePalette(color, displayTitle, typeof icon === 'string' ? icon : '')
  const heights = palette.heights

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs text-left transition-all",
        onClick && "cursor-pointer hover:border-blue-400 hover:shadow-xs",
        className
      )}
    >
      {/* Top Row: Icon + Title (Arrow permanently removed per design specification) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn("w-5.5 h-5.5 rounded-lg flex items-center justify-center shrink-0", palette.iconBg, iconClassName)}>
            {typeof icon === 'string' ? (
              <AppIcon name={icon} className="w-3 h-3" />
            ) : (
              icon
            )}
          </div>
          <span className="text-xs font-semibold text-slate-700 truncate">{displayTitle}</span>
        </div>
      </div>

      {/* Middle: Metric Value */}
      <div className="mt-1.5">
        <span className="text-xl font-bold text-slate-800 tracking-normal leading-none">{value}</span>
      </div>

      {/* Bottom: Subtitle / Context + 5-Bar Micro-Sparkline */}
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="text-[11px] text-slate-500 font-medium truncate">
          {displaySubtitle}
        </span>
        <svg className="w-11 h-4.5 shrink-0" viewBox="0 0 48 24" fill="none" aria-hidden="true">
          <rect x="2" y={heights[0]} width="5" height={24 - heights[0]} rx="1.5" fill={palette.bars[0]} />
          <rect x="11" y={heights[1]} width="5" height={24 - heights[1]} rx="1.5" fill={palette.bars[1]} />
          <rect x="20" y={heights[2]} width="5" height={24 - heights[2]} rx="1.5" fill={palette.bars[2]} />
          <rect x="29" y={heights[3]} width="5" height={24 - heights[3]} rx="1.5" fill={palette.bars[3]} />
          <rect x="38" y={heights[4]} width="5" height={24 - heights[4]} rx="1.5" fill={palette.bars[4]} />
        </svg>
      </div>
    </div>
  )
}

export default KPICard
