import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { OnboardingHeader, OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Prompt, TextLink } from '@/components/ui/TextLink'
import { useAuth } from '@/auth/useAuth'
import { homePath } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

/** R1.02 Sign in (+ x incorrect email or password). One sign-in for every role. */
export function SignInPage() {
  const { state } = useAuth()
  const location = useLocation()
  const routeState = location.state as { from?: string; confirmEmail?: string; email?: string } | null
  const [email, setEmail] = useState(routeState?.confirmEmail ?? routeState?.email ?? '')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState<'credentials' | 'unconfirmed' | 'network' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (state.status === 'signed-in') {
    return <Navigate to={routeState?.from ?? homePath(state.me.membership.role)} replace />
  }
  if (state.status === 'no-access' && state.reason === 'mfa_required') {
    return <Navigate to="/sign-in/code" replace state={{ from: routeState?.from }} />
  }
  if (state.status === 'no-access' && state.reason === 'no_organisation') {
    // R1.03a — resumed after sign-in.
    return <Navigate to="/signup/organisation" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFailed(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }).catch(() => ({ error: { code: 'network' } }))
    setSubmitting(false)
    if (error) {
      setFailed(error.code === 'email_not_confirmed' ? 'unconfirmed' : error.code === 'network' ? 'network' : 'credentials')
    }
  }

  const ended = state.status === 'no-access' && state.reason === 'access_ended'

  return (
    <OnboardingLayout
      panelTitle="Welcome back"
      panelBody="Sign in to continue. If you didn’t finish setting up, we’ll take you to where you left off."
      footer="Owners and admins manage plans and billing from Settings after setup."
    >
      <OnboardingHeader title="Sign in to Synqop" />

      {routeState?.confirmEmail && !failed && (
        <AlertBanner title="Confirm your email">We sent a link to {routeState.confirmEmail}. Open it to confirm your account, then sign in.</AlertBanner>
      )}
      {failed === 'unconfirmed' && (
        <AlertBanner tone="warning" title="Confirm your email first">
          Open the link we sent to {email.trim()} to confirm your account, then sign in.
        </AlertBanner>
      )}
      {failed === 'network' && (
        <AlertBanner tone="error" title="Couldn’t reach Synqop">
          Check your connection and try again.
        </AlertBanner>
      )}
      {ended && (
        <AlertBanner tone="error" title="Your access has ended">
          Your organisation has ended your access. Contact your administrator if you think this is a mistake.
        </AlertBanner>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <TextField
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="name@organisation.org"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={failed === 'credentials'}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={failed === 'credentials' ? 'Email or password is incorrect.' : null}
          />
          <TextLink to="/forgot-password" state={{ email: email.trim() }} className="self-start">
            Forgot password?
          </TextLink>
        </div>
        <Button type="submit" fullWidth disabled={submitting || !email || !password}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <Prompt text="New to Synqop?" to="/signup" label="Create an account" />
    </OnboardingLayout>
  )
}
