'use client'

/**
 * Register Page
 *
 * Features:
 *  - Calls POST /api/v1/auth/register
 *  - $100K virtual balance badge — highlights the paper trading value
 *  - Password strength meter (4 bars)
 *  - Confirm password field
 *  - Same glass card aesthetic as login
 *  - On success: auto-login (store JWT) → /dashboard
 */

import { useState, useRef, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MarketStatus from '@/components/MarketStatus'
import { registerUser, getMe, ApiError } from '../../../lib/api'
import { useAuthStore } from '../../../store/useAuthStore'
import s from './register.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormErrors {
  email?:    string
  password?: string
  confirm?:  string
}

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  let score = 0
  if (password.length >= 8)                       score++
  if (/[A-Z]/.test(password))                     score++
  if (/[0-9]/.test(password))                     score++
  if (/[^A-Za-z0-9]/.test(password))              score++
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_CLASS  = ['', s.strengthWeak, s.strengthFair, s.strengthGood, s.strengthStrong]

// ── Validation ────────────────────────────────────────────────────────────────
function validate(email: string, password: string, confirm: string): FormErrors {
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

  if (!confirm) {
    errors.confirm = 'Please confirm your password'
  } else if (password !== confirm) {
    errors.confirm = 'Passwords do not match'
  }

  return errors
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router  = useRouter()
  const setAuth = useAuthStore((state: any) => state.setAuth)

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors,      setErrors]      = useState<FormErrors>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)

  const emailRef    = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef  = useRef<HTMLInputElement>(null)

  const strength      = getStrength(password)
  const strengthLabel = STRENGTH_LABELS[strength]

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setGlobalError(null)

    const fieldErrors = validate(email, password, confirm)
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      if (fieldErrors.email)    emailRef.current?.focus()
      else if (fieldErrors.password) passwordRef.current?.focus()
      else if (fieldErrors.confirm)  confirmRef.current?.focus()
      return
    }

    setErrors({})
    setLoading(true)

    try {
      // 1. Register
      const { access_token } = await registerUser(email.trim().toLowerCase(), password)

      // 2. Fetch user profile
      useAuthStore.setState({ token: access_token })
      const user = await getMe()

      // 3. Store auth
      setAuth(access_token, user)

      // 4. Go to dashboard
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setGlobalError('An account with this email already exists. Try signing in.')
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
            <h1 className={s.title}>Drop anchor</h1>
            <p className={s.subtitle}>Create your account and start paper trading</p>
          </div>

          {/* $100K badge */}
          <div className={s.balanceBadge}>
            <div className={s.badgeDot} />
            <p className={s.badgeText}>
              You'll receive{' '}
              <span className={s.badgeAmount}>$100,000</span>
              {' '}virtual capital to trade with — zero risk
            </p>
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
              <label className={s.label} htmlFor="reg-email">Email</label>
              <input
                ref={emailRef}
                id="reg-email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                className={`${s.input} ${errors.email ? s.error : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }))
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
              <label className={s.label} htmlFor="reg-password">
                Password
                {password && (
                  <span className={`${s.strengthLabel} ${STRENGTH_CLASS[strength]}`}>
                    {' '}· {strengthLabel}
                  </span>
                )}
              </label>
              <div className={s.passwordWrap}>
                <input
                  ref={passwordRef}
                  id="reg-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`${s.input} ${errors.password ? s.error : ''}`}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors((p) => ({ ...p, password: undefined }))
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
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2,2 L14,14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M6.5,4.5 Q8,4 10,5.5 M11.5,7 Q12.5,9 10,11 Q8,12 6,11 Q4.5,10 3.5,8.5"
                        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                      <path d="M2.5,5.5 Q4,3.5 8,3 Q11,3 13.5,5.5 Q15,7 15,8 Q14,9.5 12.5,10.5"
                        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M1,8 Q4,3 8,3 Q12,3 15,8 Q12,13 8,13 Q4,13 1,8 Z"
                        stroke="currentColor" strokeWidth="1.4" fill="none" />
                      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Strength bars */}
              {password && (
                <div className={s.strengthWrap} role="progressbar"
                  aria-valuenow={strength} aria-valuemin={0} aria-valuemax={4}
                  aria-label={`Password strength: ${strengthLabel}`}>
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`${s.strengthBar} ${
                        strength >= level ? (
                          strength === 1 ? s.weak :
                          strength === 2 ? s.fair :
                          strength === 3 ? s.good : s.strong
                        ) : ''
                      }`}
                    />
                  ))}
                </div>
              )}

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

            {/* Confirm password */}
            <div className={s.field}>
              <label className={s.label} htmlFor="reg-confirm">Confirm password</label>
              <div className={s.passwordWrap}>
                <input
                  ref={confirmRef}
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`${s.input} ${errors.confirm ? s.error : ''}`}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value)
                    if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }))
                  }}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={s.eyeBtn}
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2,2 L14,14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M2.5,5.5 Q4,3.5 8,3 Q11,3 13.5,5.5 Q15,7 15,8 Q14,9.5 12.5,10.5"
                        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M1,8 Q4,3 8,3 Q12,3 15,8 Q12,13 8,13 Q4,13 1,8 Z"
                        stroke="currentColor" strokeWidth="1.4" fill="none" />
                      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirm && (
                <span className={s.fieldError} role="alert">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="4.5" stroke="#FF6B8A" strokeWidth="1" fill="none" />
                    <line x1="5" y1="3" x2="5" y2="6" stroke="#FF6B8A" strokeWidth="1" strokeLinecap="round" />
                    <circle cx="5" cy="7.5" r="0.6" fill="#FF6B8A" />
                  </svg>
                  {errors.confirm}
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
                <><span className={s.spinner} />Creating account...</>
              ) : (
                'Create account'
              )}
            </button>

          </form>

          {/* Footer */}
          <p className={s.footer}>
            Already have an account?{' '}
            <Link href="/login" className={s.footerLink}>
              Chart your course →
            </Link>
          </p>

        </div>
      </main>
    </>
  )
}