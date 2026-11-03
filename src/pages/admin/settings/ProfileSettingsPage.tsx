import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/useAuth'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { ProfilePhoto } from '@/components/profile/ProfilePhoto'
import { Panel, PanelHeader } from '@/components/ui/Page'
import { TextField } from '@/components/ui/TextField'
import { api, ApiError } from '@/lib/api'
import { formatDay, formatTime } from '@/lib/format'
import { roleLabel, shortName } from '@/lib/people'
import { supabase } from '@/lib/supabase'
import { checkPassword } from '@/lib/password-check'
import { SaveBar } from './SettingsBits'
import { TwoStepPanel } from './TwoStepPanel'
import { SettingsTitle } from './SettingsLayout'
import type { Notice } from './settingsForm'

type Field = 'fullName' | 'displayName' | 'phone' | 'current' | 'next' | 'confirm'

/** /admin/settings/profile — G1.04 Profile & password, for owners and admins. */
export function ProfileSettingsPage() {
  const { state, refresh } = useAuth()
  const me = state.status === 'signed-in' ? state.me : null
  const email = me?.user.email ?? ''
  const timeZone = me?.organisation?.timeZone
  const saved = {
    fullName: `${me?.membership.firstName ?? ''} ${me?.membership.lastName ?? ''}`.trim(),
    displayName: me?.membership.displayName ?? '',
    phone: me?.membership.phone ?? '',
  }
  const [profile, setProfile] = useState(saved)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [notice, setNotice] = useState<Notice | null>(null)
  const [saving, setSaving] = useState(false)

  const profileChanged = JSON.stringify(profile) !== JSON.stringify(saved)
  const passwordStarted = Boolean(current || next || confirm)
  const changed = profileChanged || passwordStarted
  const defaultDisplay = me ? shortName(me.membership.firstName, me.membership.lastName) : ''

  const edit = (key: Field, value: string) => {
    if (key === 'current') setCurrent(value)
    else if (key === 'next') setNext(value)
    else if (key === 'confirm') setConfirm(value)
    else setProfile((p) => ({ ...p, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setNotice(null)
  }

  function discard() {
    setProfile(saved)
    setCurrent('')
    setNext('')
    setConfirm('')
    setErrors({})
    setNotice(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const name = profile.fullName.trim()
    const errs: Partial<Record<Field, string>> = {
      fullName: !name ? 'Enter your name.' : !name.includes(' ') ? 'Enter your first and last name.' : undefined,
      phone: profile.phone.trim() && !/^\+?[\d\s()-]{7,}$/.test(profile.phone.trim()) ? 'Enter a phone number, e.g. +234 806 555 0121.' : undefined,
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
        await api('/v1/me', { method: 'PATCH', body: { fullName: name, displayName: profile.displayName.trim() || null, phone: profile.phone.trim() || null } })
        done.push('profile')
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
      // The top bar and this form read from the refreshed profile.
      if (done.includes('profile')) await refresh()
      setNotice({ tone: 'success', title: 'Profile saved', body: done.includes('password') ? 'Your new password works from your next sign-in.' : undefined })
    } catch (error) {
      if (done.includes('profile')) await refresh()
      if (!(error instanceof Error && error.message === 'password')) {
        if (error instanceof ApiError && Array.isArray(error.details)) {
          setErrors(Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
        } else {
          setNotice({ tone: 'error', title: 'Your changes weren’t saved', body: 'Check your connection and try again.' })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SettingsTitle title="Profile & password" description="Your own details. Other admins can’t see your password." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {notice && (
          <AlertBanner tone={notice.tone} title={notice.title}>
            {notice.body}
          </AlertBanner>
        )}
        <Panel aria-labelledby="profile-title" className="gap-4">
          <PanelHeader
            id="profile-title"
            title="Profile"
            description={`Shown to other admins and trainers in ${me?.organisation?.name ?? 'your organisation'}.`}
          />
          <ProfilePhoto name={profile.fullName || saved.fullName} />
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <TextField
              label="Full name"
              autoComplete="name"
              value={profile.fullName}
              maxLength={160}
              onChange={(e) => edit('fullName', e.target.value)}
              error={errors.fullName}
            />
            <TextField
              label="Display name"
              optional
              value={profile.displayName}
              maxLength={80}
              placeholder={defaultDisplay}
              onChange={(e) => edit('displayName', e.target.value)}
              error={errors.displayName}
              helper="In the top bar and history. Leave empty to use your first name and initial."
            />
          </div>
          <TextField label="Email" value={email} disabled helper={`Your sign-in email belongs to ${me?.organisation?.name ?? 'your organisation'} only.`} />
          <TextField
            label="Phone"
            optional
            type="tel"
            autoComplete="tel"
            value={profile.phone}
            onChange={(e) => edit('phone', e.target.value)}
            error={errors.phone}
          />
        </Panel>

        <Panel aria-labelledby="password-title" className="gap-4">
          <PanelHeader id="password-title" title="Password" description="At least 10 characters. Leave these empty to keep your password." />
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => edit('current', e.target.value)}
            error={errors.current}
          />
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter a new password"
              value={next}
              onChange={(e) => edit('next', e.target.value)}
              error={errors.next}
            />
            <TextField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat it"
              value={confirm}
              onChange={(e) => edit('confirm', e.target.value)}
              error={errors.confirm}
            />
          </div>
        </Panel>

        {me && (me.membership.role === 'owner' || me.membership.role === 'admin') && <TwoStepPanel />}

        <Panel aria-labelledby="signin-title" className="gap-0">
          <PanelHeader id="signin-title" title="Sign-in" />
          <dl className="mt-2 flex flex-col">
            <div className="flex gap-4 border-b border-default py-3 text-body">
              <dt className="w-[134px] shrink-0 text-secondary">Role</dt>
              <dd className="text-body-strong text-primary">{me ? roleLabel[me.membership.role] : ''}</dd>
            </div>
            <div className="flex gap-4 border-b border-default py-3 text-body last:border-b-0">
              <dt className="w-[134px] shrink-0 text-secondary">Last sign-in</dt>
              <dd className="text-body-strong text-primary">
                {me?.membership.lastSignInAt ? `${formatDay(me.membership.lastSignInAt, timeZone)}, ${formatTime(me.membership.lastSignInAt, timeZone)}` : '—'}
              </dd>
            </div>
          </dl>
        </Panel>

        <SaveBar changed={changed} saving={saving} onDiscard={discard} />
      </form>
    </>
  )
}
