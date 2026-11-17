/**
 * iSysware HRMS — Centralized Frontend API Client
 * Enterprise-grade Fetch wrapper implementing:
 * - Environment-configured base URL (VITE_API_URL or relative /api/v1)
 * - Strict credentials: 'include' for HttpOnly cookie sessions
 * - Automatic silent token refresh on 401 with concurrency request queuing
 * - Normalized response and error structures
 * - Event-based session expiry notifications
 */

import { syncServerTime } from '../lib/dateUtils.js'

export class ApiError extends Error {
  constructor(message, status = 500, code = 'API_ERROR', details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

// In-flight refresh token promise to prevent duplicate concurrent refresh calls
let isRefreshing = false
let refreshPromise = null
let defaultAuthToken = null

export function setApiAuthToken(token) {
  defaultAuthToken = token
}

// Session expiry listeners (e.g. AuthContext subscriber)
const sessionExpiryListeners = new Set()

export function onSessionExpired(callback) {
  sessionExpiryListeners.add(callback)
  return () => sessionExpiryListeners.delete(callback)
}

function notifySessionExpired() {
  for (const listener of sessionExpiryListeners) {
    try {
      listener()
    } catch (err) {
      console.error('Error in session expiry listener:', err)
    }
  }
}

/**
 * Resolves standard API base URL
 */
export function getApiBaseUrl() {
  const envUrl =
    (typeof process !== 'undefined' && process.env?.VITE_API_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl
  }
  return '/api/v1'
}

/**
 * Formats full URL for the request
 */
function buildUrl(endpoint) {
  const base = getApiBaseUrl()
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${base}${cleanEndpoint}`
}

/**
 * Executes standard fetch with JSON handling, credentials, and 401 auto-refresh
 */
async function request(endpoint, options = {}, isRetry = false) {
  const url = buildUrl(endpoint)
  const isAuthEndpoint =
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/refresh') ||
    endpoint.includes('/auth/logout') ||
    endpoint.includes('/auth/bootstrap-admin')

  const headers = {
    Accept: 'application/json',
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  }

  if (defaultAuthToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${defaultAuthToken}`
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
    credentials: 'include', // Essential for HttpOnly cookies
    ...options
  }

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  let response
  const method = String(fetchOptions.method || 'GET').toUpperCase()
  const isSafeIdempotent = method === 'GET' || method === 'HEAD'

  try {
    response = await fetch(url, fetchOptions)
    try {
      const serverTime = response.headers?.get?.('x-server-time') || response.headers?.get?.('date')
      if (serverTime) syncServerTime(serverTime)
    } catch (_) {}
  } catch (networkError) {
    if (isSafeIdempotent && !isRetry) {
      await new Promise((resolve) => setTimeout(resolve, 600))
      return await request(endpoint, options, true)
    }
    throw new ApiError(
      networkError.message || 'Unable to connect to the HRMS server. Please verify your network and backend status.',
      0,
      'NETWORK_ERROR',
      networkError
    )
  }

  // Retry safe idempotent reads once on transient gateway errors (e.g. backend restarting)
  if (isSafeIdempotent && !isRetry && [502, 503, 504].includes(response.status)) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return await request(endpoint, options, true)
  }

  // Handle 401 Unauthorized — Automatic Token Refresh
  if (response.status === 401 && !isAuthEndpoint && !isRetry) {
    try {
      if (!isRefreshing) {
        isRefreshing = true
        refreshPromise = request('/auth/refresh', { method: 'POST' })
          .finally(() => {
            isRefreshing = false
            refreshPromise = null
          })
      }

      await refreshPromise
      // Retry original request once
      return await request(endpoint, options, true)
    } catch (refreshErr) {
      notifySessionExpired()
      throw new ApiError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED')
    }
  }

  // Parse JSON response
  let json = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      json = await response.json()
    } catch {
      json = null
    }
  }

  if (!response.ok) {
    const errorPayload = json?.error || {}
    const isGatewayError = response.status >= 502 && response.status <= 504
    const fallbackMsg = isGatewayError
      ? 'HRMS backend API server is temporarily unreachable or restarting (502 Bad Gateway). Please wait a moment and try again.'
      : response.statusText || 'Request failed'
    const message = errorPayload.message || json?.message || fallbackMsg
    const code = errorPayload.code || json?.code || (isGatewayError ? 'BAD_GATEWAY' : `HTTP_${response.status}`)
    const details = errorPayload.details || null

    throw new ApiError(message, response.status, code, details)
  }

  // Return standard data payload
  if (json && typeof json === 'object') {
    if (json.data !== undefined) {
      return json.data
    }
    return json
  }

  return json
}

export const apiClient = {
  get(endpoint, options = {}) {
    return request(endpoint, { ...options, method: 'GET' })
  },

  post(endpoint, body = {}, options = {}) {
    return request(endpoint, { ...options, method: 'POST', body })
  },

  put(endpoint, body = {}, options = {}) {
    return request(endpoint, { ...options, method: 'PUT', body })
  },

  patch(endpoint, body = {}, options = {}) {
    return request(endpoint, { ...options, method: 'PATCH', body })
  },

  delete(endpoint, options = {}) {
    return request(endpoint, { ...options, method: 'DELETE' })
  },

  getBaseUrl: getApiBaseUrl
}

export default apiClient

