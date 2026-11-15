import React, { useState, useMemo, useEffect } from 'react'
import { AuthContext } from './authContextDef'
import { authService } from '@/services/authService'
import { onSessionExpired } from '@/services/apiClient'
import { syncAllModules } from '@/services/backendSync'
import { DEMO_USERS } from '@/mocks/demoUsers'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getCurrentUser())
  const [loading, setLoading] = useState(() => typeof window !== 'undefined')

  // Verify session on application mount with PostgreSQL backend (/api/v1/auth/me)
  useEffect(() => {
    let isMounted = true

    async function initSession() {
      if (typeof window === 'undefined') {
        setLoading(false)
        return
      }

      try {
        const currentUser = await authService.getMe()
        if (isMounted) {
          setUser(currentUser)
          if (currentUser) {
            syncAllModules()
          }
        }
      } catch {
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initSession()

    // Listen for automatic session expiry when refresh token fails
    const unsubscribe = onSessionExpired(() => {
      if (isMounted) {
        setUser(null)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const login = async (identifier, password) => {
    const session = await authService.login(identifier, password)
    setUser(session)
    if (session) {
      syncAllModules()
    }
    return session
  }

  const logout = async () => {
    try {
      await authService.logout()
    } finally {
      setUser(null)
    }
  }

  const logoutAll = async () => {
    try {
      await authService.logoutAll()
    } finally {
      setUser(null)
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    return authService.changePassword(currentPassword, newPassword)
  }

  const switchRole = (role) => {
    if (typeof window !== 'undefined') {
      console.warn('Unauthorized role switch attempt blocked by security policy.')
      return null
    }
    const session = authService.switchDemoRole(role)
    if (session) {
      setUser(session)
    }
    return session
  }

  const demoUsers = useMemo(() => {
    if (typeof window !== 'undefined') return []
    try {
      return authService.getQuickDemoAccounts()
    } catch {
      return DEMO_USERS
    }
  }, [user])

  const value = {
    user,
    currentUser: user,
    role: user?.role || null,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    logoutAll,
    changePassword,
    switchRole,
    demoUsers
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { useAuth } from './useAuth'
export default AuthProvider
