import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import AppIcon from './AppIcon'

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-lg',
  className = ''
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      {/* Backdrop covering the full screen including navbar and sidebar */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative w-full bg-white rounded-xl shadow-2xl border border-slate-200 text-left overflow-hidden z-10 transition-all transform animate-in zoom-in-95 duration-150",
          maxWidth,
          className
        )}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-hrms-border flex items-center justify-between">
          <div>
            <h3 id="modal-title" className="text-base font-semibold text-hrms-primary">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-hrms-muted mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-hrms-muted hover:text-hrms-text p-1.5 rounded-md hover:bg-hrms-canvas transition-colors focus:outline-none"
            aria-label="Close dialog"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[calc(85vh-120px)] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 bg-hrms-canvas border-t border-hrms-border flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}

export default Modal
