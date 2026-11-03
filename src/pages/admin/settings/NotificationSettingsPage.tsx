import { useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useAuth } from '@/auth/useAuth'
import { PushPanel } from '@/components/notifications/PushPanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Checkbox } from '@/components/ui/Choice'
import { Panel, PanelHeader } from '@/components/ui/Page'
import { SelectField, TextField } from '@/components/ui/TextField'
import { api } from '@/lib/api'
import { timeZoneLabel } from '@/lib/format'
import { useNotificationPreferences, type NotificationPreference } from '@/pages/participant/data'
import { SaveBar, SettingsLoader } from './SettingsBits'
import { SettingsTitle } from './SettingsLayout'
import { useSettingsForm } from './settingsForm'

type Draft = { preferences: NotificationPreference[]; digestTime: string }

const times = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

/** /admin/settings/notifications — F1.09 Notifications. Each admin's own choices. */
export function NotificationSettingsPage() {
  const query = useNotificationPreferences()
  return (
    <>
      <SettingsTitle title="Notifications" description="Choose what you hear about. These settings are yours; other admins set their own." />
      <SettingsLoader query={query}>
        {(data) => <NotificationsForm initial={{ preferences: data.preferences, digestTime: data.digestTime ?? '08:00' }} />}
      </SettingsLoader>
    </>
  )
}

function NotificationsForm({ initial }: { initial: Draft }) {
  const { state } = useAuth()
  const client = useQueryClient()
  const me = state.status === 'signed-in' ? state.me : null
  const zone = me?.organisation?.timeZone ?? 'Africa/Lagos'
  const zoneName = timeZoneLabel(zone)
    .split(' — ')[0]!
    .replace(/ \(UTC.*$/, '')
  const form = useSettingsForm(initial)
  const { draft, set } = form
  const when = (p: NotificationPreference) => (p.event === 'attention_flags' ? `Daily digest at ${draft.digestTime}` : p.when)

  const toggle = (i: number, key: 'email' | 'inApp', on: boolean) => set({ preferences: draft.preferences.map((p, j) => (j === i ? { ...p, [key]: on } : p)) })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await form.save(
      async () => {
        await api('/v1/me/notification-preferences', {
          method: 'PUT',
          body: { preferences: draft.preferences.map(({ event, email, inApp }) => ({ event, email, inApp })), digestTime: draft.digestTime },
        })
        client.setQueryData(['me', 'notification-preferences'], draft)
        return draft
      },
      { tone: 'success', title: 'Notification settings saved' },
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {form.notice && <AlertBanner tone={form.notice.tone} title={form.notice.title} />}
      <PushPanel />
      <Panel aria-labelledby="events-title" className="gap-2">
        <PanelHeader id="events-title" title="Events" />
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
            {draft.preferences.map((p, i) => (
              <tr key={p.event} className="border-b border-default last:border-b-0">
                <td className="py-3">
                  <span className="block text-body text-primary">{p.label}</span>
                  {when(p) && <span className="block text-caption text-secondary">{when(p)}</span>}
                </td>
                <td className="py-3 text-center">
                  <Checkbox
                    label={<span className="sr-only">Email for {p.label}</span>}
                    className="mx-auto"
                    checked={p.email}
                    onChange={(e) => toggle(i, 'email', e.target.checked)}
                  />
                </td>
                <td className="py-3 text-center">
                  <Checkbox
                    label={<span className="sr-only">In-app for {p.label}</span>}
                    className="mx-auto"
                    checked={p.inApp}
                    onChange={(e) => toggle(i, 'inApp', e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel aria-labelledby="delivery-title" className="gap-4">
        <PanelHeader id="delivery-title" title="Delivery" />
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <TextField label="Email" value={me?.user.email ?? ''} disabled helper="Your sign-in email." />
          <SelectField label="Digest time" value={draft.digestTime} onChange={(e) => set({ digestTime: e.target.value })}>
            {times.map((t) => (
              <option key={t} value={t}>
                {t} · {zoneName}
              </option>
            ))}
          </SelectField>
        </div>
      </Panel>
      <SaveBar changed={form.changed} saving={form.saving} onDiscard={form.discard} />
    </form>
  )
}
