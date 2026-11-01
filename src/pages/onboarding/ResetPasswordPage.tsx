import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { OnboardingHeader, OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Prompt } from '@/components/ui/TextLink'
import { formatTime } from '@/lib/format'
import { initialUrl, supabase } from '@/lib/supabase'
import { requestPasswordReset } from './passwordReset'
import { useHumanCheck } from '@/components/ui/HumanCheck'
import { MIN_PASSWORD_LENGTH } from './validation'

const FOOTER = 'The same for admins, trainers and participants.'

/** What the reset link told us when the app opened. */
function readLink() {
  const hash = new URLSearchParams(initialUrl.hash.replace(/^#/, ''))
  const query = initialUrl.searchParams
  const get = (key: string) => hash.get(key) ?? query.get(key)
  return {
    // Supabase redirects with error=access_denied&error_code=otp_expired for expired or used links.
    error: get('error_code') ?? get('error'),
    isRecovery: get('type') === 'recovery' || query.has('code'),
    sentAt: query.get('sent'),
    email: query.get('email'),
  }
}

type View = 'checking' | 'form' | 'done' | 'expired'

/** /reset-password — S1.04 Set a new password (+ x), S1.05 Password updated, S1.06 Reset link expired. */
export function ResetPasswordPage() {
  const [link] = useState(readLink)
  const [view, setView] = useState<View>(link.error ? 'expired' : link.isRecovery ? 'checking' : 'expired')
  const [email, setEmail] = useState<string | null>(link.email)

  // Supabase turns the link into a short recovery session while the app starts.
  useEffect(() => {
    if (view !== 'checking') return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session) {
        setEmail(data.session.user.email ?? link.email)
        setView('form')
      } else {
        setView('expired')
      }
    })
    return () => {
      active = false
    }
  }, [view, link.email])

  if (view === 'checking') return <div aria-busy="true" aria-label="Checking your link" className="min-h-dvh bg-canvas" />
  if (view === 'expired') return <LinkExpired sentAt={link.sentAt} email={link.email} />
  if (view === 'done') return <PasswordUpdated email={email} />
  return <NewPasswordForm email={email} onDone={() => setView('done')} />
}

function NewPasswordForm({ email, onDone }: { email: string | null; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = {
      password: password.length < MIN_PASSWORD_LENGTH ? `Too short — at least ${MIN_PASSWORD_LENGTH} characters.` : undefined,
      confirm: confirm !== password ? 'Passwords don’t match.' : undefined,
    }
    setErrors(next)
    setFailed(null)
    if (next.password || next.confirm) return

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setSaving(false)
      if (error.code === 'same_password') setErrors({ password: 'Choose a password you haven’t used for this account.' })
      else if (error.code === 'weak_password') setErrors({ password: 'Choose a stronger password.' })
      else setFailed('Your password wasn’t changed. Request a new link and try again.')
      return
    }
    // Proposal (§12): other devices are signed out after a reset. "global" ends every session,
    // including this short recovery one, so they sign in fresh with the new password (S1.05).
    await supabase.auth.signOut({ scope: 'global' }).catch(() => undefined)
    onDone()
  }

  const hasFieldErrors = Boolean(errors.password || errors.confirm)

  return (
    <OnboardingLayout
      panelTitle="Almost done"
      panelBody="Choose a password you don’t use anywhere else. You’ll be signed out on other devices."
      footer={FOOTER}
    >
      <OnboardingHeader compact title="Choose a new password" description={email ? `For ${email}` : undefined} />
      {hasFieldErrors && (
        <AlertBanner tone="error" title="Check your password">
          It must be at least {MIN_PASSWORD_LENGTH} characters, and both entries must match.
        </AlertBanner>
      )}
      {failed && (
        <AlertBanner tone="error" title="Couldn’t update your password">
          {failed}
        </AlertBanner>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {/* Lets password managers save the new password against the right account. */}
        {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
        <div className="flex flex-col gap-4">
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setErrors((prev) => ({ ...prev, password: undefined }))
            }}
            helper={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            error={errors.password}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              setErrors((prev) => ({ ...prev, confirm: undefined }))
            }}
            error={errors.confirm}
          />
        </div>
        <Button type="submit" size="lg" fullWidth disabled={saving}>
          {saving ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </OnboardingLayout>
  )
}

function PasswordUpdated({ email }: { email: string | null }) {
  const navigate = useNavigate()
  return (
    <OnboardingLayout panelTitle="You’re all set" panelBody="If you didn’t make this change, contact your programme admin straight away." footer={FOOTER}>
      <OnboardingHeader compact title="Password updated" description="Sign in with your new password. You’ve been signed out on other devices." />
      <Button size="lg" fullWidth onClick={() => navigate('/sign-in', { replace: true, state: { email } })}>
        Sign in
      </Button>
    </OnboardingLayout>
  )
}

function LinkExpired({ sentAt, email }: { sentAt: string | null; email: string | null }) {
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const human = useHumanCheck()

  const sent = sentAt && !Number.isNaN(Date.parse(sentAt)) ? new Date(sentAt) : null
  const detail = sent
    ? `Reset links work once and last 1 hour. This one was sent at ${formatTime(sent)} and expired at ${formatTime(new Date(sent.getTime() + 3600_000))}.`
    : 'Reset links work once and last 1 hour.'

  async function sendNewLink() {
    if (!email) {
      navigate('/forgot-password')
      return
    }
    setSending(true)
    setFailed(false)
    try {
      await requestPasswordReset(email, human.token)
      navigate('/forgot-password', { replace: true, state: { sentTo: email } })
    } catch {
      human.reset()
      setFailed(true)
      setSending(false)
    }
  }

  return (
    <OnboardingLayout
      panelTitle="Reset your password"
      panelBody="We’ll email you a link to choose a new password. It works once and expires after 1 hour."
      footer={FOOTER}
    >
      <OnboardingHeader compact title="This link has expired" description={detail} />
      {failed && (
        <AlertBanner tone="error" title="Couldn’t send a new link">
          Check your connection and try again.
        </AlertBanner>
      )}
      {human.widget}
      <Button size="lg" fullWidth disabled={sending || !human.ready} onClick={sendNewLink}>
        {sending ? 'Sending…' : 'Send a new link'}
      </Button>
      <Prompt text="Remembered it?" to="/sign-in" label="Back to sign in" />
    </OnboardingLayout>
  )
}
