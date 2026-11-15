import React from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  breadcrumbs = [],
  className = ''
}) {
  return (
    <div className={cn("flex flex-col gap-2 pb-4 mb-6 border-b border-hrms-border text-left", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-hrms-muted mb-1" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-hrms-subtle">/</span>}
              <span className={idx === breadcrumbs.length - 1 ? "font-medium text-hrms-primary" : "hover:underline cursor-pointer"}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-hrms-primary tracking-tight">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-hrms-muted mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export default PageHeader
