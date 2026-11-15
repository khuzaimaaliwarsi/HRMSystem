import React from 'react'
import { cn } from '@/lib/utils'
import AppIcon from './AppIcon'

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
  ...props
}) {
  return (
    <div className={cn("relative flex items-center w-full max-w-xs", className)}>
      <div className="absolute left-3 text-hrms-muted pointer-events-none flex items-center">
        <AppIcon name="search" className="w-3.5 h-3.5 text-hrms-muted" />
      </div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-md border border-hrms-border bg-white pl-9 pr-8 py-1.5 text-sm text-hrms-text placeholder:text-hrms-subtle transition-colors focus:border-hrms-accent focus:outline-none focus:ring-1 focus:ring-hrms-accent"
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 text-hrms-muted hover:text-hrms-text p-0.5 rounded focus:outline-none"
        >
          <AppIcon name="close" className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export default SearchInput
