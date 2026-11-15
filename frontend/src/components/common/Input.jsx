import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import AppIcon from './AppIcon'

export const Input = forwardRef(function Input(
  {
    label,
    id,
    type = 'text',
    error,
    helperText,
    iconLeft,
    iconRight,
    onRightIconClick,
    required = false,
    className = '',
    inputClassName = '',
    labelClassName = '',
    ...props
  },
  ref
) {
  const inputId = id || props.name

  return (
    <div className={cn("w-full flex flex-col gap-1.5 text-left", className)}>
      {label && (
        <label htmlFor={inputId} className={cn("text-xs font-semibold text-hrms-text flex items-center gap-1", labelClassName)}>
          {label}
          {required && <span className="text-hrms-danger">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {iconLeft && (
          <div className="absolute left-3 text-hrms-muted pointer-events-none flex items-center">
            <AppIcon name={iconLeft} className="w-4 h-4 text-hrms-muted" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          required={required}
          className={cn(
            "w-full rounded-md border border-hrms-border bg-white px-3 py-2 text-sm text-hrms-text placeholder:text-hrms-subtle transition-colors focus:border-hrms-accent focus:outline-none focus:ring-1 focus:ring-hrms-accent disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
            iconLeft && "pl-9",
            iconRight && "pr-9",
            error && "border-hrms-danger focus:border-hrms-danger focus:ring-hrms-danger",
            inputClassName
          )}
          {...props}
        />

        {iconRight && (
          <button
            type="button"
            onClick={onRightIconClick}
            tabIndex={onRightIconClick ? 0 : -1}
            aria-label="Toggle input visibility"
            className={cn(
              "absolute right-2.5 z-10 p-1 text-hrms-muted hover:text-hrms-text flex items-center justify-center transition-colors rounded",
              onRightIconClick ? "cursor-pointer" : "pointer-events-none"
            )}
          >
            <AppIcon name={iconRight} className="w-4 h-4" />
          </button>
        )}
      </div>

      {error ? (
        <p className="text-xs text-hrms-danger font-medium mt-0.5">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-hrms-muted mt-0.5">{helperText}</p>
      ) : null}
    </div>
  )
})

export default Input
