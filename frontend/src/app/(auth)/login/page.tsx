'use client'

/**
 * Login Page
 *
 * Features:
 *  - Calls POST /api/v1/auth/login
 *  - Stores JWT + user in Zustand (persisted to localStorage)
 *  - Redirects to /dashboard on success
 *  - Shows inline field errors + global error banner
 *  - Password show/hide toggle
 *  - Loading state on submit button
 *  - Keyboard: Enter submits, Tab navigates fields
 */

import { useState, useRef, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MarketStatus from '@/components/MarketStatus'
import { loginUser, getMe, ApiError } from '../../../lib/api'
import { useAuthStore } from '../../../store/useAuthStore'
import s from './login.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormErrors {
  email?:    string
  password?: string
}

// ── Validation ────────────────────────────────────────────────────────────────
function validate(email: string, password: string): FormErrors {
  const errors: FormErrors = {}

  if (!email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address'
  }

  if (!password) {
    errors.password = 'Password is required'
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
  }

  return errors
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router  = useRouter()
  const setAuth = useAuthStore((s: any) => s.setAuth)

  // Form state
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [errors,      setErrors]      = useState<FormErrors>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)

  const emailRef    = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setGlobalError(null)

    // Client-side validation
    const fieldErrors = validate(email, password)
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      // Focus first error field
      if (fieldErrors.email)    emailRef.current?.focus()
      else if (fieldErrors.password) passwordRef.current?.focus()
      return
    }

    setErrors({})
    setLoading(true)

    try {
      // 1. Get JWT token
      const { access_token } = await loginUser(email.trim().toLowerCase(), password)

      // 2. Fetch user profile with the token
      //    We temporarily set token so getMe() can read it
      useAuthStore.setState({ token: access_token })
      const user = await getMe()

      // 3. Persist to store (Zustand → localStorage)
      setAuth(access_token, user)

      // 4. Navigate to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 400) {
          setGlobalError('Invalid email or password. Please try again.')
        } else if (err.status === 422) {
          setGlobalError('Please check your input and try again.')
        } else {
          setGlobalError('Something went wrong. Please try again shortly.')
        }
      } else {
        setGlobalError('Unable to connect. Check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Fish — bottom-left
      <FloatingElement bottom="12%" left="8%" animVariant="swim">
        <Fish />
      </FloatingElement> */}

      <MarketStatus />

      <main className={s.page}>
        <div className={s.card}>

          {/* Logo */}
          <div className={s.logoRow}>
            <div className={s.logoMark}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <polyline points="1,11 4,6 8,9 13,2"
                  stroke="white" strokeWidth="1.7"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className={s.logoName}>AlgoWealth</span>
          </div>

          {/* Heading */}
          <div className={s.heading}>
            <h1 className={s.title}>Chart your course</h1>
            <p className={s.subtitle}>Sign in to your trading account</p>
          </div>

          {/* Global error */}
          {globalError && (
            <div className={s.errorBanner} role="alert">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="7" cy="7" r="6" stroke="#FF6B8A" strokeWidth="1.5" fill="none" />
                <line x1="7" y1="4" x2="7" y2="8" stroke="#FF6B8A" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="7" cy="10.5" r="0.8" fill="#FF6B8A" />
              </svg>
              {globalError}
            </div>
          )}

          {/* Form */}
          <form className={s.form} onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className={s.field}>
              <label className={s.label} htmlFor="email">Email</label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                className={`${s.input} ${errors.email ? s.error : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                }}
                disabled={loading}
              />
              {errors.email && (
                <span className={s.fieldError} role="alert">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="4.5" stroke="#FF6B8A" strokeWidth="1" fill="none" />
                    <line x1="5" y1="3" x2="5" y2="6" stroke="#FF6B8A" strokeWidth="1" strokeLinecap="round" />
                    <circle cx="5" cy="7.5" r="0.6" fill="#FF6B8A" />
                  </svg>
                  {errors.email}
                </span>
              )}
            </div>

            {/* Password */}
            <div className={s.field}>
              <label className={s.label} htmlFor="password">Password</label>
              <div className={s.passwordWrap}>
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`${s.input} ${errors.password ? s.error : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                  }}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={s.eyeBtn}
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPass ? (
                    // Eye-off icon
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2,2 L14,14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M6.5,4.5 Q8,4 10,5.5 M11.5,7 Q12.5,9 10,11 Q8,12 6,11 Q4.5,10 3.5,8.5"
                        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                      <path d="M2.5,5.5 Q4,3.5 8,3 Q11,3 13.5,5.5 Q15,7 15,8 Q14,9.5 12.5,10.5"
                        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                    </svg>
                  ) : (
                    // Eye icon
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M1,8 Q4,3 8,3 Q12,3 15,8 Q12,13 8,13 Q4,13 1,8 Z"
                        stroke="currentColor" strokeWidth="1.4" fill="none" />
                      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <span className={s.fieldError} role="alert">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="4.5" stroke="#FF6B8A" strokeWidth="1" fill="none" />
                    <line x1="5" y1="3" x2="5" y2="6" stroke="#FF6B8A" strokeWidth="1" strokeLinecap="round" />
                    <circle cx="5" cy="7.5" r="0.6" fill="#FF6B8A" />
                  </svg>
                  {errors.password}
                </span>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className={s.submitBtn}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className={s.spinner} />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>

          </form>

          {/* Footer */}
          <p className={s.footer}>
            No account yet?{' '}
            <Link href="/register" className={s.footerLink}>
              Drop anchor here →
            </Link>
          </p>

        </div>
      </main>
    </>
  )
}