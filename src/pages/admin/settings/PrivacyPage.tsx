import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { ChevronRightIcon, DownloadIcon, InfoCircleIcon } from '@/components/ui/icons'
import { Badge, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Stacked, Table } from '@/components/ui/Table'
import { TextField } from '@/components/ui/TextField'
import { ApiError, downloadApiFile } from '@/lib/api'
import { formatDay, formatDayWithYear, formatTime } from '@/lib/format'
import { checkPassword } from '@/lib/password-check'
import { useDeletion, usePrivacy, useRequestExport, type DataExport, type ExportPart, type PrivacyView } from './data'
import { SettingsLoader } from './SettingsBits'
import { SettingsTitle } from './SettingsLayout'
import type { Notice } from './settingsForm'

const parts: { key: ExportPart; label: string }[] = [
  { key: 'people', label: 'Participants, trainers and enrolments' },
  { key: 'attendance', label: 'Attendance, including edit history' },
  { key: 'assignments', label: 'Assignments, submissions and grades' },
  { key: 'files', label: 'Submission files (can be large)' },
  { key: 'reports', label: 'Session reports and feedback' },
  { key: 'interventions', label: 'Interventions, outcomes and certificates' },
]

/** /admin/settings/privacy — F1.10 Data & privacy (export, F1.10l preparing) and F1.11 Delete organisation (F1.11b scheduled). */
export function PrivacyPage() {
  const query = usePrivacy()
  return (
    <>
      <SettingsTitle title="Data & privacy" description="Export your organisation’s data, or delete the organisation. Only Owners can do either." />
      <SettingsLoader query={query}>{(data) => <Privacy view={data} />}</SettingsLoader>
    </>
  )
}

function Privacy({ view }: { view: PrivacyView }) {
  const { refresh } = useAuth()
  const [notice, setNotice] = useState<Notice | null>(null)
  const [deleting, setDeleting] = useState(false)
  const cancel = useDeletion()
  const tz = view.timeZone
  const d = view.deletion

  async function cancelDeletion() {
    setNotice(null)
    try {
      await cancel.mutateAsync(null)
      await refresh()
      setNotice({ tone: 'success', title: 'Deletion cancelled', body: `${view.organisation} is back to normal. Everyone can make changes again.` })
    } catch (e) {
      setNotice({ tone: 'error', title: e instanceof ApiError && e.status < 500 ? e.message : 'The deletion wasn’t cancelled. Try again.' })
    }
  }

  return (
    <>
      {d && (
        <AlertBanner tone="error" title={`${view.organisation} will be deleted on ${formatDayWithYear(d.scheduledFor, tz)}`}>
          Scheduled by {d.requestedBy ?? 'the owner'} on {formatDay(d.requestedAt, tz)}. The workspace is read-only until then. Owners can still export data or
          cancel the deletion.
        </AlertBanner>
      )}
      {notice && (
        <AlertBanner tone={notice.tone} title={notice.title}>
          {notice.body}
        </AlertBanner>
      )}
      <ExportPanel view={view} />
      {d ? (
        <section aria-labelledby="scheduled-title" className="flex flex-col rounded-lg border border-error bg-surface p-5 max-md:p-4">
          <h3 id="scheduled-title" className="text-heading-section text-primary">
            Deletion scheduled
          </h3>
          <dl className="mt-2 flex flex-col">
            {(
              [
                ['Deletes on', `${formatDayWithYear(d.scheduledFor, tz)}, ${formatTime(d.scheduledFor, tz)}`],
                ['Members told', `${formatDay(d.requestedAt, tz)} · every admin, trainer and participant`],
                ['Billing', 'Stopped · no further charges'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex gap-4 border-b border-default py-3 text-body max-md:flex-col max-md:gap-1">
                <dt className="w-[134px] shrink-0 text-secondary">{k}</dt>
                <dd className="text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          {view.canManage && (
            <div className="pt-3">
              <Button variant="secondary" onClick={cancelDeletion} disabled={cancel.isPending}>
                {cancel.isPending ? 'Cancelling…' : 'Cancel deletion'}
              </Button>
            </div>
          )}
        </section>
      ) : (
        <section aria-labelledby="delete-title" className="flex flex-col gap-2 rounded-lg border border-error bg-surface p-5 max-md:p-4">
          <h3 id="delete-title" className="text-heading-section text-primary">
            Delete organisation
          </h3>
          <p className="text-body text-secondary">
            Deletes {view.organisation}’s workspace and everything in it: programmes, cohorts, participants, attendance, grades, reports and certificates.
            Issued certificates can no longer be verified.
          </p>
          <p className="flex gap-1.5 text-caption text-secondary">
            <InfoCircleIcon size={14} className="mt-px shrink-0" />
            You get 30 days to change your mind. During that time everyone can still sign in to read and download their own records, but nothing can be changed.
          </p>
          <div className="pt-1">
            <Button variant="destructive" onClick={() => setDeleting(true)} disabled={!view.canManage} className="max-md:w-full">
              Delete organisation…
            </Button>
          </div>
          {!view.canManage && <p className="text-caption text-secondary">Only the owner can delete the organisation.</p>}
        </section>
      )}
      {deleting && (
        <DeleteDialog
          view={view}
          onClose={() => setDeleting(false)}
          onDone={() => {
            setDeleting(false)
            setNotice(null)
          }}
        />
      )}
    </>
  )
}

function ExportPanel({ view }: { view: PrivacyView }) {
  const request = useRequestExport()
  const [chosen, setChosen] = useState<ExportPart[]>(['people', 'attendance', 'assignments', 'reports', 'interventions'])
  const [error, setError] = useState<string | null>(null)
  const preparing = view.exports.find((e) => e.status === 'queued' || e.status === 'running')
  const tz = view.timeZone

  async function submit() {
    setError(null)
    if (!chosen.length) return setError('Choose at least one thing to export.')
    try {
      await request.mutateAsync(parts.map((p) => p.key).filter((k) => chosen.includes(k)))
    } catch (e) {
      setError(e instanceof ApiError && e.status < 500 ? e.message : 'The export didn’t start. Try again.')
    }
  }

  return (
    <Panel aria-labelledby="export-title" className="gap-3">
      <PanelHeader
        id="export-title"
        title="Export data"
        description="A ZIP of CSV files. We email you a download link when it’s ready; the link works for 7 days."
      />
      <fieldset className="flex flex-col gap-2" disabled={!view.canManage || Boolean(preparing)}>
        <legend className="sr-only">What to include</legend>
        {parts.map((p) => (
          <Checkbox
            key={p.key}
            label={p.label}
            checked={chosen.includes(p.key)}
            onChange={(e) => {
              setError(null)
              setChosen((c) => (e.target.checked ? [...c, p.key] : c.filter((k) => k !== p.key)))
            }}
          />
        ))}
      </fieldset>
      {preparing && (
        <AlertBanner tone="info" title="Preparing your export">
          Started {formatDay(preparing.requestedAt, tz)}, {formatTime(preparing.requestedAt, tz)}
          {preparing.requestedBy ? ` by ${preparing.requestedBy}` : ''}. We’ll email you when it’s ready — you can leave this page.
        </AlertBanner>
      )}
      {error && <p className="text-caption text-error-fg">{error}</p>}
      <div className="flex flex-col items-start gap-1">
        <Button onClick={submit} disabled={!view.canManage || Boolean(preparing) || request.isPending} className="max-md:w-full">
          {!preparing && <DownloadIcon size={16} />}
          {preparing ? 'Export in progress' : request.isPending ? 'Starting…' : 'Request export'}
        </Button>
        {!view.canManage && <p className="text-caption text-secondary">Only the owner can export the organisation’s data.</p>}
      </div>
      {view.exports.length > 0 && <RecentExports exports={view.exports} timeZone={tz} canDownload={view.canManage} />}
    </Panel>
  )
}

function exportStatus(e: DataExport, timeZone: string) {
  if (e.status === 'ready') return <Badge tone="success">Ready · until {e.expiresAt ? formatDay(e.expiresAt, timeZone) : '—'}</Badge>
  if (e.status === 'queued' || e.status === 'running') return <Badge tone="info">Preparing</Badge>
  if (e.status === 'failed') return <Badge tone="error">Failed</Badge>
  return <Badge tone="neutral">Expired</Badge>
}

function RecentExports({ exports, timeZone, canDownload }: { exports: DataExport[]; timeZone: string; canDownload: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const download = (e: DataExport) => {
    setError(null)
    downloadApiFile(`/v1/privacy/exports/${e.id}/file`, e.fileName ?? 'Synqop data export.zip').catch((x) =>
      setError(x instanceof ApiError ? x.message : 'The download didn’t start. Try again.'),
    )
  }
  const action = (e: DataExport) =>
    e.status === 'ready' && canDownload ? (
      <button type="button" onClick={() => download(e)} className="inline-flex items-center gap-0.5 text-body-strong text-brand-text hover:underline">
        Download
        <ChevronRightIcon size={14} />
      </button>
    ) : null
  const when = (e: DataExport) => `${formatDay(e.requestedAt, timeZone)}, ${formatTime(e.requestedAt, timeZone)}`

  return (
    <div className="flex flex-col gap-2 pt-2">
      <h4 className="text-body-strong text-primary">Recent exports</h4>
      {error && <p className="text-caption text-error-fg">{error}</p>}
      <div className="max-md:hidden">
        <Table columns={[{ label: 'Requested', width: 190 }, { label: 'Includes' }, { label: 'Status', width: 200 }, { label: '', width: 100 }]}>
          {exports.map((e) => (
            <Row key={e.id}>
              <Cell>
                <Stacked primary={when(e)} secondary={e.requestedBy ?? undefined} />
              </Cell>
              <Cell>{e.includes}</Cell>
              <Cell>{exportStatus(e, timeZone)}</Cell>
              <Cell align="right">{action(e)}</Cell>
            </Row>
          ))}
        </Table>
      </div>
      <ul className="flex flex-col md:hidden">
        {exports.map((e) => (
          <li key={e.id} className="flex items-center gap-3 border-b border-default py-3 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-body-strong text-primary">{when(e)}</span>
              <span className="text-caption text-secondary">{e.includes}</span>
              <span>{exportStatus(e, timeZone)}</span>
            </div>
            {action(e)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DeleteDialog({ view, onClose, onDone }: { view: PrivacyView; onClose: () => void; onDone: () => void }) {
  const { state, refresh } = useAuth()
  const email = state.status === 'signed-in' ? (state.me.user.email ?? '') : ''
  const schedule = useDeletion()
  const [exported, setExported] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [checking, setChecking] = useState(false)
  // Today + 30 days, as the server will set it.
  const [deletesOn] = useState(() => new Date(new Date().getTime() + 30 * 86_400_000).toISOString())

  async function submit() {
    const errs: Record<string, string> = {}
    if (!exported) errs.exported = 'Confirm you’ve exported what you need.'
    if (name.trim() !== view.organisation) errs.confirmName = `Type ${view.organisation} exactly as shown.`
    if (!password) errs.password = 'Enter your password.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setChecking(true)
    try {
      // We ask for the password again because this can't be undone after 30 days.
      if (!(await checkPassword(email, password))) return setErrors({ password: 'That isn’t your password.' })
      await schedule.mutateAsync({ confirmName: name.trim() })
      await refresh()
      onDone()
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details))
        setErrors(Object.fromEntries((e.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
      else setErrors({ form: e instanceof ApiError && e.status < 500 ? e.message : 'The deletion wasn’t scheduled. Try again.' })
    } finally {
      setChecking(false)
    }
  }

  const busy = checking || schedule.isPending
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Delete ${view.organisation}?`}
      description="The workspace is deleted for everyone after 30 days. After that it can’t be undone."
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete organisation'}
          </Button>
        </>
      }
    >
      <AlertBanner tone="warning" title="What happens next">
        Today: the workspace becomes read-only, billing stops and every member is emailed. {formatDay(deletesOn, view.timeZone)}: everything is permanently
        deleted, including certificates participants may still need.
      </AlertBanner>
      <div className="flex flex-col gap-1">
        <Checkbox label="I’ve exported the data we need to keep" checked={exported} onChange={(e) => (setExported(e.target.checked), setErrors({}))} />
        {errors.exported && <p className="text-caption text-error-fg">{errors.exported}</p>}
      </div>
      <TextField
        label={`Type ${view.organisation} to confirm`}
        autoComplete="off"
        value={name}
        onChange={(e) => (setName(e.target.value), setErrors({}))}
        error={errors.confirmName}
      />
      <TextField
        label="Your password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => (setPassword(e.target.value), setErrors({}))}
        error={errors.password}
        helper="We ask again because this can’t be undone."
      />
      {errors.form && <p className="text-caption text-error-fg">{errors.form}</p>}
    </Dialog>
  )
}
