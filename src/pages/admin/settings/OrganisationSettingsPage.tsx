import { useMemo, type FormEvent } from 'react'
import { useAuth } from '@/auth/useAuth'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Panel, PanelHeader } from '@/components/ui/Page'
import { SelectField, TextField } from '@/components/ui/TextField'
import { formatDayWithYear, timeZoneOptions } from '@/lib/format'
import { useOrganisationSettings, useSaveOrganisationSettings, type OrganisationSettings } from './data'
import { countryOptions, ORGANISATION_TYPES } from './organisationOptions'
import { OrganisationLogo } from './OrganisationLogo'
import { SaveBar, SettingsLoader } from './SettingsBits'
import { SettingsTitle } from './SettingsLayout'
import { useSettingsForm } from './settingsForm'

type Draft = { name: string; type: string; country: string; timeZone: string }
const toDraft = (s: OrganisationSettings): Draft => ({ name: s.name, type: s.type ?? '', country: s.country ?? '', timeZone: s.timeZone })

/** /admin/settings/organisation — F1.01 Organisation details. */
export function OrganisationSettingsPage() {
  const query = useOrganisationSettings()
  return (
    <>
      <SettingsTitle title="Organisation details" description="How your organisation appears in Synqop." />
      <SettingsLoader query={query}>{(data) => <OrganisationForm settings={data.settings} />}</SettingsLoader>
    </>
  )
}

function OrganisationForm({ settings }: { settings: OrganisationSettings }) {
  const save = useSaveOrganisationSettings()
  const { refresh } = useAuth()
  const form = useSettingsForm(toDraft(settings))
  const zones = useMemo(() => timeZoneOptions(), [])
  const countries = useMemo(() => countryOptions(), [])
  const { draft, set, errors } = form

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft.name.trim()) return form.setErrors({ name: 'Enter your organisation’s name.' })
    const ok = await form.save(
      async () =>
        toDraft(
          (await save.mutateAsync({ name: draft.name.trim(), type: draft.type || null, country: draft.country || null, timeZone: draft.timeZone }))
            .settings as OrganisationSettings,
        ),
      { tone: 'success', title: 'Organisation details saved' },
    )
    // The top bar shows the name.
    if (ok) await refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {form.notice && <AlertBanner tone={form.notice.tone} title={form.notice.title} />}
      <Panel aria-labelledby="org-title" className="gap-4">
        <PanelHeader id="org-title" title="Organisation details" description="Shown to your trainers and participants." />
        <OrganisationLogo />
        <TextField label="Organisation name" value={draft.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
        <SelectField label="Organisation type" optional value={draft.type} onChange={(e) => set({ type: e.target.value })} error={errors.type}>
          <option value="">Not set</option>
          {[...ORGANISATION_TYPES, ...(draft.type && !ORGANISATION_TYPES.includes(draft.type) ? [draft.type] : [])].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <SelectField label="Country or region" optional value={draft.country} onChange={(e) => set({ country: e.target.value })} error={errors.country}>
            <option value="">Not set</option>
            {countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Time zone"
            value={draft.timeZone}
            onChange={(e) => set({ timeZone: e.target.value })}
            error={errors.timeZone}
            helper="Used for session times and attendance."
          >
            {zones.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </SelectField>
        </div>
      </Panel>
      <Panel aria-labelledby="about-title" className="gap-0">
        <PanelHeader id="about-title" title="About this workspace" />
        <dl className="flex flex-col">
          <div className="flex gap-4 border-b border-default py-3 text-body">
            <dt className="w-[134px] shrink-0 text-secondary">Owner</dt>
            <dd className="text-body-strong text-primary">{settings.owner ?? '—'}</dd>
          </div>
          <div className="flex gap-4 border-b border-default py-3 text-body">
            <dt className="w-[134px] shrink-0 text-secondary">Created</dt>
            <dd className="text-body-strong text-primary">{formatDayWithYear(settings.createdAt, settings.timeZone)}</dd>
          </div>
        </dl>
        <p className="pt-3 text-caption text-secondary">
          Each email belongs to one organisation. Your organisation’s data is never shared with another organisation.
        </p>
      </Panel>
      <SaveBar changed={form.changed} saving={save.isPending} onDiscard={form.discard} />
    </form>
  )
}
