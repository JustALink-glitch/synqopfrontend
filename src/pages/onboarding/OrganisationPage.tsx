import { useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { OnboardingHeader, OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { signUpSteps } from '@/components/onboarding/steps'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/TextField'
import { useAuth } from '@/auth/useAuth'
import { api, ApiError } from '@/lib/api'
import { browserTimeZone, timeZoneOptions } from '@/lib/format'
import { validateFullName } from './validation'

/**
 * R1.03 Organisation (+ l saving, x validation, b save failed, a resumed after sign-in).
 * "Organisation type" and "Country or region" are proposed fields not in the PRD, so they are
 * left out until confirmed. Plan (R1.04–R1.05) is skipped: plans and payment are placeholders.
 */
export function OrganisationPage() {
  const { state, refresh } = useAuth()
  const navigate = useNavigate()
  const session = state.status === 'no-access' ? state.session : null
  const savedName = (session?.user.user_metadata?.full_name as string | undefined) ?? ''

  const [organisationName, setOrganisationName] = useState('')
  const [fullName, setFullName] = useState('')
  const [timeZone, setTimeZone] = useState(browserTimeZone)
  const [errors, setErrors] = useState<{ organisationName?: string; fullName?: string }>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const zones = useMemo(() => timeZoneOptions(), [])

  if (state.status === 'loading') return <div aria-busy="true" className="min-h-dvh bg-canvas" />
  if (state.status === 'signed-out') return <Navigate to="/sign-in" replace />
  if (state.status === 'signed-in') return <Navigate to="/signup/ready" replace />
  if (state.reason === 'access_ended') return <Navigate to="/sign-in" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = {
      organisationName: organisationName.trim() ? undefined : 'Enter your organisation’s name.',
      fullName: savedName ? undefined : validateFullName(fullName),
    }
    setErrors(next)
    setFailed(null)
    if (next.organisationName || next.fullName) return

    setSaving(true)
    try {
      await api('/v1/organisations', {
        method: 'POST',
        // The name from sign-up (R1.01) if we have it; otherwise what they typed here.
        body: { organisationName: organisationName.trim(), fullName: savedName || fullName.trim(), timeZone },
      })
      await refresh()
      navigate('/signup/ready', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'already_member') {
        await refresh()
        navigate('/signup/ready', { replace: true })
        return
      }
      setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'Your organisation wasn’t saved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingLayout
      panelTitle="Set up your organisation"
      panelBody="A few details now. Programmes, cohorts and people come next, from your dashboard."
      steps={signUpSteps(2)}
      footer={`Signed in as ${session?.user.email ?? ''}. Progress is saved as you go.`}
    >
      <OnboardingHeader
        eyebrow="Step 2 of 4"
        title="Tell us about your organisation"
        description="This creates your organisation’s private workspace. You’ll be its Owner."
      />

      {failed && (
        <AlertBanner tone="error" title="Couldn’t save">
          {failed}
        </AlertBanner>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <TextField
            label="Organisation name"
            placeholder="e.g. ALIWA Foundation"
            autoFocus
            maxLength={120}
            value={organisationName}
            onChange={(e) => setOrganisationName(e.target.value)}
            helper="Shown to your trainers and participants."
            error={errors.organisationName}
          />
          {!savedName && (
            <TextField label="Your full name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
          )}
          <SelectField
            label="Time zone"
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            helper="Used for session times and attendance. Detected from your browser."
          >
            {zones.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </SelectField>
        </div>
        <Button type="submit" fullWidth disabled={saving}>
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </OnboardingLayout>
  )
}
