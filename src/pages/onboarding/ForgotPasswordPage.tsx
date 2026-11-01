import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { OnboardingHeader, OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Prompt, TextLink } from '@/components/ui/TextLink'
import { requestPasswordReset } from './passwordReset'
import { humanCheckFailedMessage, useHumanCheck } from '@/components/ui/HumanCheck'
import { ApiError } from '@/lib/api'

const PANEL = {
  panelTitle: 'Reset your password',
  panelBody: 'We’ll email you a link to choose a new password. It works once and expires after 1 hour.',
  footer: 'The same for admins, trainers and participants.',
}

const COOLDOWN_SECONDS = 60
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())

/** /forgot-password — S1.01 Forgot password (+ x invalid email) → S1.02 Check your email. One flow for all roles. */
export function ForgotPasswordPage() {
  const location = useLocation()
  const routeState = location.state as { email?: string; sentTo?: string } | null
  const [email, setEmail] = useState(routeState?.email ?? '')
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(routeState?.sentTo ?? null)
  const human = useHumanCheck()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isEmail(email)) {
      setError('Enter a full email address, like name@example.org.')
      return
    }
    setError(null)
    setFailed(false)
    setSending(true)
    try {
      await requestPasswordReset(email, human.token)
      setSentTo(email.trim().toLowerCase())
    } catch (e) {
      if (e instanceof ApiError && e.code === 'captcha_failed') setError(humanCheckFailedMessage)
      else setFailed(true)
    } finally {
      human.reset()
      setSending(false)
    }
  }

  if (sentTo) return <CheckYourEmail email={sentTo} />

  return (
    <OnboardingLayout {...PANEL}>
      <OnboardingHeader compact title="Forgot your password?" description="Enter the email you sign in with." />
      {failed && (
        <AlertBanner tone="error" title="Couldn’t send the link">
          Check your connection and try again.
        </AlertBanner>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
          error={error}
        />
        {human.widget}
        {human.failed && <p className="-mt-3 text-caption text-error">{humanCheckFailedMessage}</p>}
        <Button type="submit" size="lg" fullWidth disabled={sending || !human.ready}>
          {sending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <Prompt text="Remembered it?" to="/sign-in" label="Back to sign in" />
    </OnboardingLayout>
  )
}

/** S1.02 — sent. The resend button counts down; the API also allows one email a minute. */
function CheckYourEmail({ email }: { email: string }) {
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const human = useHumanCheck()

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  async function resend() {
    setResending(true)
    try {
      await requestPasswordReset(email, human.token)
      setResent(true)
      setSecondsLeft(COOLDOWN_SECONDS)
    } catch {
      // Same answer either way; the countdown simply doesn't restart.
    } finally {
      human.reset()
      setResending(false)
    }
  }

  const waiting = secondsLeft > 0
  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`

  return (
    <OnboardingLayout {...PANEL}>
      <OnboardingHeader compact title="Check your email" description={`If an account uses ${email}, we’ve sent it a reset link. It expires in 1 hour.`} />
      <AlertBanner title="Nothing arrived?">
        Check spam or promotions. Links come from notifications@mail.synqop.com. You can ask for another in a minute.
      </AlertBanner>
      {human.widget}
      <Button
        variant="secondary"
        size="lg"
        fullWidth
        disabled={waiting || resending || !human.ready}
        onClick={resend}
        className="disabled:border-transparent disabled:bg-surface-hover disabled:text-disabled disabled:opacity-100"
      >
        {resending ? 'Sending…' : waiting ? `Resend in ${countdown}` : 'Resend email'}
      </Button>
      {resent && waiting && (
        <p role="status" className="-mt-3 text-center text-caption text-secondary">
          Sent again. Use the newest email.
        </p>
      )}
      <p className="text-center">
        <TextLink to="/sign-in" state={{ email }}>
          Back to sign in
        </TextLink>
      </p>
    </OnboardingLayout>
  )
}
