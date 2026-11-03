import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { OnboardingHeader, OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { signUpSteps } from '@/components/onboarding/steps'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Prompt, TextLink } from '@/components/ui/TextLink'
import { useAuth } from '@/auth/useAuth'
import { homePath } from '@/lib/roles'
import { api, ApiError } from '@/lib/api'
import { humanCheckFailedMessage, useHumanCheck } from '@/components/ui/HumanCheck'
import { validateEmail, validateFullName, validatePassword } from './validation'

type Errors = Partial<Record<'fullName' | 'email' | 'password', string>>

/** R1.01 Create account (+ l submitting, x validation, a email in use, b network error). */
export function SignUpPage() {
  const { state } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [emailInUse, setEmailInUse] = useState(false)
  const [networkError, setNetworkError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [robot, setRobot] = useState(false)
  const human = useHumanCheck()

  if (state.status === 'signed-in') return <Navigate to={homePath(state.me.membership.role)} replace />
  if (state.status === 'no-access' && state.reason === 'no_organisation') return <Navigate to="/signup/organisation" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Errors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
    }
    setErrors(next)
    setEmailInUse(false)
    setNetworkError(false)
    setRobot(false)
    if (Object.values(next).some(Boolean)) return

    setSubmitting(true)
    const normalised = email.trim().toLowerCase()
    try {
      // Through the API, which runs the bot check and sends the Synqop confirmation email.
      await api('/v1/auth/sign-up', {
        method: 'POST',
        body: { fullName: fullName.trim().replace(/\s+/g, ' '), email: normalised, password, captchaToken: human.token },
      })
      navigate('/sign-in', { state: { confirmEmail: normalised } })
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'email_exists' || e.code === 'account_exists')) setEmailInUse(true)
      else if (e instanceof ApiError && e.code === 'weak_password') setErrors({ password: 'Choose a stronger password.' })
      else if (e instanceof ApiError && e.code === 'captcha_failed') setRobot(true)
      else setNetworkError(true)
    } finally {
      human.reset()
      setSubmitting(false)
    }
  }

  return (
    <OnboardingLayout
      panelTitle="Run your programmes in one place"
      panelBody="Create your account, then set up your organisation. It takes a couple of minutes."
      steps={signUpSteps(1)}
      footer="Progress is saved as you go. You can leave and come back."
    >
      <OnboardingHeader eyebrow="Step 1 of 4" title="Create your account" description="You’ll own your organisation’s Synqop workspace." />

      {networkError && (
        <AlertBanner tone="error" title="Couldn’t create your account">
          Check your connection and try again.
        </AlertBanner>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <TextField
            label="Full name"
            autoComplete="name"
            placeholder="Your full name"
            autoFocus
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value)
              setErrors((prev) => ({ ...prev, fullName: undefined }))
            }}
            error={errors.fullName}
          />
          <TextField
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="name@organisation.org"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailInUse(false)
              setErrors((prev) => ({ ...prev, email: undefined }))
            }}
            helper="We’ll use this to sign you in."
            error={errors.email ?? (emailInUse ? 'An account with this email already exists.' : null)}
          />
          {emailInUse && (
            <p className="-mt-2 text-caption text-secondary">
              <TextLink to="/sign-in">Sign in instead</TextLink>
            </p>
          )}
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setErrors((prev) => ({ ...prev, password: undefined }))
            }}
            helper="Use at least 10 characters."
            error={errors.password}
          />
        </div>
        {human.widget}
        {(robot || human.failed) && <p className="-mt-3 text-caption text-error">{humanCheckFailedMessage}</p>}
        <Button type="submit" fullWidth disabled={submitting || !human.ready}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <Prompt text="Already have an account?" to="/sign-in" label="Sign in" />
    </OnboardingLayout>
  )
}
