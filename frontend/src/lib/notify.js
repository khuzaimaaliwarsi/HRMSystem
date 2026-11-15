/**
 * iSysware HRMS — Global Sonner Notification Utility
 * Standardized notification helper across all five portals.
 */

import { toast } from 'sonner'

export const notify = {
  success(message, options = {}) {
    return toast.success(message, {
      duration: 3500,
      ...options
    })
  },

  error(message, options = {}) {
    return toast.error(message, {
      duration: 5000,
      ...options
    })
  },

  warning(message, options = {}) {
    return toast.warning(message, {
      duration: 4000,
      ...options
    })
  },

  info(message, options = {}) {
    return toast.info(message, {
      duration: 3000,
      ...options
    })
  },

  dismiss(toastId) {
    toast.dismiss(toastId)
  }
}

export default notify

