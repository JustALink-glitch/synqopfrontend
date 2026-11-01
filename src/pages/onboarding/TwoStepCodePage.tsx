import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { OnboardingHeader, OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/auth/useAuth'
import { isCode, verifiedFactor, verifyCode } from '@/auth/twoStep'
import { homePath } from '@/lib/roles'

/** Two-step sign-in: after the password, the 6-digit code from the person's authenticator app. */
export function TwoStepCodePage() {
  const { state, signOut, refresh } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [checking, setChecking] = useState(false)

  if (state.status === 'signed-out') return <Navigate to="/sign-in" replace />
  if (state.status === 'signed-in') return <Navigate to={from ?? homePath(state.me.membership.role)} replace />
  if (state.status === 'no-access' && state.reason !== 'mfa_required') return <Navigate to="/sign-in" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isCode(code)) return setError('Enter the 6-digit code from your authenticator app.')
    setError(null)
    setFailed(false)
    setChecking(true)
    try {
      const factor = await verifiedFactor()
      if (!factor) {
        await refresh()
        return
      }
      const result = await verifyCode(factor.id, code)
      if (result === 'wrong') setError('That code didn’t work. Codes change every 30 seconds, so use the newest one.')
      else if (result === 'error') setFailed(true)
      else await refresh()
    } catch {
      setFailed(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <OnboardingLayout
      panelTitle="Two-step sign-in"
      panelBody="Your account asks for a code from your phone as well as your password, so a stolen password isn’t enough."
      footer="Lost your phone? Contact Synqop support to turn two-step sign-in off for your account."
    >
      <OnboardingHeader compact title="Enter your sign-in code" description="Open your authenticator app and enter the 6-digit code for Synqop." />
      {failed && (
        <AlertBanner tone="error" title="Couldn’t check the code">
          Check your connection and try again.
        </AlertBanner>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <TextField
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={7}
          placeholder="123456"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError(null)
          }}
          error={error}
        />
        <Button type="submit" size="lg" fullWidth disabled={checking}>
          {checking ? 'Checking…' : 'Continue'}
        </Button>
      </form>
      <p className="text-center text-body text-secondary">
        Not you?{' '}
        <button type="button" onClick={() => void signOut()} className="text-body-strong text-brand-text underline-offset-2 hover:underline">
          Sign out
        </button>
      </p>
    </OnboardingLayout>
  )
}
