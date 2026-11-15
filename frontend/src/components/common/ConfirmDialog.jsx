import React from 'react'
import Modal from './Modal'
import Button from './Button'
import AppIcon from './AppIcon'

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this action?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'primary'
  loading = false
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3.5">
        <div className={`p-2.5 rounded-full shrink-0 ${variant === 'danger' ? 'bg-red-50 text-hrms-danger' : 'bg-blue-50 text-hrms-primary'}`}>
          <AppIcon name={variant === 'danger' ? 'warning' : 'info'} className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-hrms-text leading-relaxed">{message}</p>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
