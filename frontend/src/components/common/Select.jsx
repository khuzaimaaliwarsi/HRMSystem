import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import AppIcon from './AppIcon'

export const Select = forwardRef(function Select(
  {
    label,
    id,
    options = [],
    placeholder = 'Select...',
    error,
    helperText,
    required = false,
    className = '',
    selectClassName = '',
    value,
    onChange,
    ...props
  },
  ref
) {
  const selectId = id || props.name

  return (
    <div className={cn("w-full flex flex-col gap-1.5 text-left", className)}>
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-hrms-text flex items-center gap-1">
          {label}
          {required && <span className="text-hrms-danger">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={onChange}
          required={required}
          className={cn(
            "w-full appearance-none rounded-md border border-hrms-border bg-white px-3 py-2 pr-9 text-sm text-hrms-text transition-colors focus:border-hrms-accent focus:outline-none focus:ring-1 focus:ring-hrms-accent disabled:cursor-not-allowed disabled:bg-gray-50",
            error && "border-hrms-danger focus:border-hrms-danger focus:ring-hrms-danger",
            selectClassName
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 text-hrms-muted flex items-center">
          <AppIcon name="chevronDown" className="w-3.5 h-3.5" />
        </div>
      </div>

      {error ? (
        <p className="text-xs text-hrms-danger font-medium mt-0.5">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-hrms-muted mt-0.5">{helperText}</p>
      ) : null}
    </div>
  )
})

export default Select
