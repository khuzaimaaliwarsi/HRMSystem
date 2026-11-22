import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { PORTAL_CONFIG } from '@/config/navigation'
import AppIcon from '@/components/common/AppIcon'
import BrandLogo from '@/components/common/BrandLogo'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Alert from '@/components/common/Alert'
import notify from '@/lib/notify'

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Redirect if already logged in
  React.useEffect(() => {
    if (isAuthenticated && user?.role) {
      const targetPortal = PORTAL_CONFIG[user.role]?.defaultRoute || '/employee/dashboard'
      navigate(targetPortal, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!identifier.trim()) {
      setError('Please enter your email or username.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const session = await login(identifier, password)
      notify.success(`Welcome back, ${session.name || session.username || 'User'}! Authenticated as ${session.roleLabel}.`)
      const target = PORTAL_CONFIG[session.role]?.defaultRoute || '/employee/dashboard'
      navigate(target, { replace: true })
    } catch (err) {
      const msg = err.message || 'Login failed. Please verify credentials.'
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-hrms-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-hrms-accent-light selection:text-hrms-primary">
      {/* Top Branding Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <BrandLogo size="xl" className="mx-auto mb-4" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-hrms-primary tracking-tight">
          iSysware <span className="text-hrms-accent">HRMS</span>
        </h1>
        <p className="mt-1 text-xs text-hrms-muted font-medium">
          Enterprise Human Resource & Workforce Management System
        </p>

        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100/70 border border-blue-200 text-hrms-accent text-[11px] font-semibold">
          <AppIcon name="lock" className="w-3 h-3 text-hrms-accent" />
          <span>Enterprise Suite • PostgreSQL Server Authentication Active</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-hrms-modal rounded-xl border border-hrms-border">
          {error && (
            <Alert variant="danger" title="Authentication Error" className="mb-5" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email / Employee ID"
              id="identifier"
              name="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder="e.g. superadmin@isysware.com"
              iconLeft="user"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />

            <Input
              label="Password"
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              iconLeft="lock"
              iconRight={showPassword ? 'eyeSlash' : 'eye'}
              onRightIconClick={() => setShowPassword(!showPassword)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-hrms-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-hrms-border text-hrms-primary focus:ring-hrms-accent w-4 h-4"
                />
                <span>Remember this workstation</span>
              </label>

              <span className="text-hrms-muted hover:text-hrms-primary cursor-pointer">
                Help / Support
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={loading}
              iconRight="arrowRight"
            >
              Sign In to HRMS Portal
            </Button>
          </form>
        </div>

        {/* Security & System Notice */}
        <p className="mt-4 text-center text-xs text-hrms-muted leading-relaxed">
          iSysware Software Solutions HRMS • Strict 5-Portals Role Boundary Enforced.
          <br />
          <span className="text-[11px] text-hrms-subtle">
            All reports remain table-based with zero charts per PRD & TRD requirements.
          </span>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
