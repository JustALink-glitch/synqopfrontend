import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { OnboardingHeader, OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { Prompt } from '@/components/ui/TextLink'
import { supabase } from '@/lib/supabase'

/** Only Synqop's own pages, so the link can't send anyone elsewhere. */
const safeNext = (next: string | null, fallback: string) => (next && next.startsWith('/') && !next.startsWith('//') ? next : fallback)
const withParam = (path: string, key: string, value: string) => `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`

/**
 * /auth/confirm — where confirmation and password-reset emails land (Nov 2026), so their links show app.synqop.com
 * instead of the Supabase project address. Checks the one-time token here, in the browser, then continues.
 */
export function ConfirmLinkPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const type = params.get('type') === 'recovery' ? 'recovery' : 'signup'
    const next = safeNext(params.get('next'), type === 'recovery' ? '/reset-password' : '/signup/organisation')
    void (async () => {
      const { error } = tokenHash ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type }) : { error: new Error('No token') }
      if (type === 'recovery') {
        // The reset page shows "link expired" (S1.06) with a button for a new one.
        navigate(error ? withParam(next, 'error_code', 'otp_expired') : withParam(next, 'type', 'recovery'), { replace: true })
        return
      }
      if (error) return setFailed(true)
      await refresh()
      navigate(next, { replace: true })
    })()
  }, [navigate, refresh])

  if (!failed) return <div aria-busy="true" aria-label="Checking your link" className="min-h-dvh bg-canvas" />
  return (
    <OnboardingLayout
      panelTitle="Confirm your email"
      panelBody="Confirmation links work once and expire after 24 hours."
      footer="The same for admins, trainers and participants."
    >
      <OnboardingHeader
        compact
        title="This link has expired"
        description="It may have been used already. If you confirmed your email before, sign in to carry on. Otherwise, sign up again for a new link."
      />
      <Prompt text="Already confirmed?" to="/sign-in" label="Sign in" />
      <Prompt text="Need a new link?" to="/signup" label="Sign up again" />
    </OnboardingLayout>
  )
}
