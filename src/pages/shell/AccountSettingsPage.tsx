import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { ProfilePhoto } from '@/components/profile/ProfilePhoto'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { api, ApiError } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { checkPassword } from '@/lib/password-check'
import { PushPanel } from '@/components/notifications/PushPanel'
import { useNotificationPreferences, type NotificationPreference } from '@/pages/participant/data'

type Errors = Partial<Record<'fullName' | 'phone' | 'bio' | 'current' | 'next' | 'confirm', string>>
type Area = 'trainer' | 'participant'

/** /trainer/settings and /participant/settings — T9.01 / P8.01 Settings: profile, password, notifications. */
export function AccountSettingsPage({ area }: { area: Area }) {
  const { state } = useAuth()
  const prefs = useNotificationPreferences()
  if (state.status !== 'signed-in' || prefs.isPending) return <div aria-busy="true" aria-label="Loading settings" className="h-40" />
  if (prefs.isError) {
    return (
      <>
        <PageHeader title="Settings" />
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load your settings"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void prefs.refetch() }}
          />
        </Panel>
      </>
    )
  }
  return <SettingsForm area={area} initialPrefs={prefs.data.preferences} />
}

function SettingsForm({ area, initialPrefs }: { area: Area; initialPrefs: NotificationPreference[] }) {
  const trainer = area === 'trainer'
  const { state, refresh } = useAuth()
  const client = useQueryClient()
  const me = state.status === 'signed-in' ? state.me : null
  const email = me?.user.email ?? ''
  // What's saved; moves forward after each successful save so the form never resets under the person.
  const [initialName, setInitialName] = useState(`${me?.membership.firstName ?? ''} ${me?.membership.lastName ?? ''}`.trim())
  const [initialPhone, setInitialPhone] = useState(me?.membership.phone ?? '')
  const [initialBio, setInitialBio] = useState(me?.membership.bio ?? '')
  const [savedPrefs, setSavedPrefs] = useState(initialPrefs)
  const [fullName, setFullName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [bio, setBio] = useState(initialBio)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [prefs, setPrefs] = useState(initialPrefs)
  const [errors, setErrors] = useState<Errors>({})
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; title: string; body?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const profileChanged = fullName.trim() !== initialName || phone.trim() !== initialPhone || bio.trim() !== initialBio
  const prefsChanged = JSON.stringify(prefs) !== JSON.stringify(savedPrefs)
  const passwordStarted = Boolean(current || next || confirm)
  const changed = profileChanged || prefsChanged || passwordStarted

  function discard() {
    setFullName(initialName)
    setPhone(initialPhone)
    setBio(initialBio)
    setCurrent('')
    setNext('')
    setConfirm('')
    setPrefs(savedPrefs)
    setErrors({})
    setNotice(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const errs: Errors = {
      fullName: !fullName.trim() ? 'Enter your name.' : !fullName.trim().includes(' ') ? 'Enter your first and last name.' : undefined,
      phone: phone.trim() && !/^\+?[\d\s()-]{7,}$/.test(phone.trim()) ? 'Enter a phone number, e.g. +234 806 555 0121.' : undefined,
      bio: bio.trim().length > 300 ? 'Keep it to 300 characters or fewer.' : undefined,
      ...(passwordStarted && {
        current: current ? undefined : 'Enter your current password.',
        next: next.length < 10 ? 'Use at least 10 characters.' : next.length > 72 ? 'Use at most 72 characters.' : undefined,
        confirm: confirm !== next ? 'Passwords don’t match.' : undefined,
      }),
    }
    setErrors(errs)
    setNotice(null)
    if (Object.values(errs).some(Boolean)) return
    setSaving(true)
    const done: string[] = []
    try {
      if (profileChanged) {
        await api('/v1/me', { method: 'PATCH', body: { fullName: fullName.trim(), phone: phone.trim() || null, ...(trainer && { bio: bio.trim() || null }) } })
        setInitialName(fullName.trim())
        setInitialPhone(phone.trim())
        setInitialBio(bio.trim())
        done.push('profile')
      }
      if (prefsChanged) {
        await api('/v1/me/notification-preferences', {
          method: 'PUT',
          body: { preferences: prefs.map(({ event, email: e, inApp }) => ({ event, email: e, inApp })) },
        })
        setSavedPrefs(prefs)
        client.setQueryData(['me', 'notification-preferences'], { preferences: prefs })
        done.push('notifications')
      }
      if (passwordStarted) {
        // Check the current password (without replacing this session), then set the new one.
        if (!(await checkPassword(email, current))) {
          setErrors({ current: 'That isn’t your current password.' })
          throw new Error('password')
        }
        const update = await supabase.auth.updateUser({ password: next })
        if (update.error) {
          setErrors({ next: update.error.code === 'same_password' ? 'Choose a password you haven’t used here.' : 'Choose a stronger password.' })
          throw new Error('password')
        }
        setCurrent('')
        setNext('')
        setConfirm('')
        done.push('password')
      }
      if (done.includes('profile')) await refresh()
      setNotice({ tone: 'success', title: 'Settings saved', body: done.includes('password') ? 'Your new password works from your next sign-in.' : undefined })
    } catch (error) {
      if (!(error instanceof Error && error.message === 'password')) {
        if (error instanceof ApiError && Array.isArray(error.details)) {
          setErrors(Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
        } else {
          setNotice({
            tone: 'error',
            title: 'Some changes weren’t saved',
            body: done.length ? `Saved: ${done.join(', ')}. Try the rest again.` : 'Check your connection and try again.',
          })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const set =
    <T,>(setter: (v: T) => void, key: keyof Errors) =>
    (value: T) => {
      setter(value)
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          trainer ? 'Your profile, password and notifications. Organisation settings are managed by admins.' : 'Your profile, password and notifications.'
        }
      />
      <form onSubmit={onSubmit} noValidate className="flex w-[760px] max-w-full flex-col gap-4">
        {notice && (
          <AlertBanner tone={notice.tone} title={notice.title}>
            {notice.body}
          </AlertBanner>
        )}
        <Panel aria-labelledby="profile-title" className="gap-4">
          <PanelHeader
            id="profile-title"
            title="Profile"
            description={trainer ? 'Participants and admins see your name, photo and bio.' : 'Your trainers and programme team see this.'}
          />
          <ProfilePhoto name={fullName || initialName} />
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <TextField
              label="Display name"
              autoComplete="name"
              value={fullName}
              maxLength={160}
              onChange={(e) => set(setFullName, 'fullName')(e.target.value)}
              error={errors.fullName}
            />
            <TextField
              label="Phone"
              optional
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => set(setPhone, 'phone')(e.target.value)}
              error={errors.phone}
              helper={trainer ? 'Only admins see this.' : 'Only the programme team sees this.'}
            />
          </div>
          <TextField
            label="Email"
            value={email}
            disabled
            helper={
              trainer
                ? `Set by ${me?.organisation?.name ?? 'your organisation'}.`
                : 'Use this email in Zoom so your attendance counts. Ask your programme team to change it.'
            }
          />
          {trainer && (
            <TextAreaField
              label="Short bio"
              optional
              value={bio}
              maxLength={300}
              onChange={(e) => set(setBio, 'bio')(e.target.value)}
              error={errors.bio}
              helper="Shown to participants on your sessions."
            />
          )}
        </Panel>

        <Panel aria-labelledby="password-title" className="gap-4">
          <PanelHeader id="password-title" title="Password" description="At least 10 characters. Leave these empty to keep your password." />
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => set(setCurrent, 'current')(e.target.value)}
            error={errors.current}
          />
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter a new password"
              value={next}
              onChange={(e) => set(setNext, 'next')(e.target.value)}
              error={errors.next}
            />
            <TextField
              label="Confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat it"
              value={confirm}
              onChange={(e) => set(setConfirm, 'confirm')(e.target.value)}
              error={errors.confirm}
            />
          </div>
        </Panel>

        <PushPanel />

        <Panel aria-labelledby="notifications-title" className="gap-2">
          <PanelHeader id="notifications-title" title="Notifications" description="Choose how you hear about each event." />
          <table className="w-full">
            <thead>
              <tr className="border-b border-default text-caption text-secondary">
                <th scope="col" className="py-2 text-left font-normal">
                  Event
                </th>
                <th scope="col" className="w-16 py-2 text-center font-normal">
                  Email
                </th>
                <th scope="col" className="w-16 py-2 text-center font-normal">
                  In-app
                </th>
              </tr>
            </thead>
            <tbody>
              {prefs.map((p, i) => (
                <tr key={p.event} className="border-b border-default last:border-b-0">
                  <td className="py-3">
                    <span className="block text-body-strong text-primary">{p.label}</span>
                    <span className="block text-caption text-secondary">{p.when}</span>
                  </td>
                  <td className="py-3 text-center">
                    <Checkbox
                      label={<span className="sr-only">Email for {p.label}</span>}
                      className="mx-auto"
                      checked={p.email}
                      onChange={(e) => setPrefs((prev) => prev.map((x, j) => (j === i ? { ...x, email: e.target.checked } : x)))}
                    />
                  </td>
                  <td className="py-3 text-center">
                    <Checkbox
                      label={<span className="sr-only">In-app for {p.label}</span>}
                      className="mx-auto"
                      checked={p.inApp}
                      onChange={(e) => setPrefs((prev) => prev.map((x, j) => (j === i ? { ...x, inApp: e.target.checked } : x)))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="flex justify-end gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
          <Button variant="secondary" onClick={discard} disabled={!changed || saving}>
            Discard
          </Button>
          <Button type="submit" disabled={!changed || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </>
  )
}
