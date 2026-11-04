import { Eye } from 'lucide-react'
import clsx from 'clsx'
import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useAuth } from '@/auth/useAuth'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { ChevronRightIcon, DownloadIcon } from '@/components/ui/icons'
import { Panel, PanelHeader } from '@/components/ui/Page'
import { SelectField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { openFile, fileKind, fileSize, uploadFile, viewKind } from '@/lib/files'
import { formatDay } from '@/lib/format'
import { useAddResource, type SessionDetail, type SessionResource } from './data'

/** Resources for this session (T3.02, C1.03): its own and the course-wide ones. */
export function ResourcesPanel({ data }: { data: SessionDetail }) {
  const { session: s, can, resources } = data
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <Panel className="gap-0">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader title="Resources for this session" description="Participants see these on the session." />
        {can.resources && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-7 shrink-0 items-center gap-1 text-caption-strong text-brand-text hover:underline"
          >
            Add
            <ChevronRightIcon size={14} />
          </button>
        )}
      </div>
      {notice && (
        <div className="pt-3">
          <AlertBanner tone="success" title={notice} />
        </div>
      )}
      {resources.length === 0 ? (
        <p className="py-3 text-body text-secondary">
          {can.resources ? 'Nothing yet. Add slides, notes or links participants need for this session.' : 'Nothing has been added yet.'}
        </p>
      ) : (
        <ul className="mt-1">
          {resources.map((r) => (
            <ResourceItem key={r.id} sessionId={s.id} resource={r} />
          ))}
        </ul>
      )}
      {adding && (
        <AddResourceDialog
          data={data}
          onClose={() => setAdding(false)}
          onAdded={(name) => {
            setAdding(false)
            setNotice(`${name} added`)
          }}
        />
      )}
    </Panel>
  )
}

function ResourceItem({ sessionId, resource: r }: { sessionId: string; resource: SessionResource }) {
  const [failed, setFailed] = useState(false)
  const meta = [
    r.kind === 'link' ? `${hostOf(r.url)} · Link` : [fileKind(r.name, r.type), r.size !== null ? fileSize(r.size) : null].filter(Boolean).join(' · '),
    r.addedBy && `added by ${r.addedBy}`,
    r.wholeCourse && 'whole course',
    !r.visible && 'hidden from participants',
  ]
    .filter(Boolean)
    .join(' · ')
  async function open() {
    setFailed(false)
    try {
      if (r.kind === 'link' && r.url) window.open(r.url, '_blank', 'noopener')
      else await openFile(`/v1/sessions/${sessionId}/resources/${r.id}`, r.name, r.type)
    } catch {
      setFailed(true)
    }
  }
  return (
    <li className="border-b border-default last:border-b-0">
      <button
        type="button"
        onClick={() => void open()}
        className="flex w-full items-center gap-3 py-3 text-left hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body-strong text-primary">{r.name}</span>
          <span className={clsx('text-caption md:truncate', failed ? 'text-error-fg' : 'text-secondary')}>
            {failed ? 'Couldn’t open it. Try again.' : meta}
          </span>
        </span>
        {r.kind === 'file' ? (
          viewKind(r.name, r.type) ? (
            <Eye className="size-4 shrink-0 text-icon-muted" aria-hidden />
          ) : (
            <DownloadIcon size={16} className="shrink-0 text-icon-muted" />
          )
        ) : (
          <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
        )}
      </button>
    </li>
  )
}

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).host.replace(/^www\./, '') : ''
  } catch {
    return url ?? ''
  }
}

const stripExtension = (name: string) => name.replace(/\.[^.]+$/, '')

/** T8.01 Add a resource: a file or a link, on this session or the whole course. */
export function AddResourceDialog({ data, onClose, onAdded }: { data: SessionDetail; onClose: () => void; onAdded: (name: string) => void }) {
  const s = data.session
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const add = useAddResource(s.id)
  return (
    <ResourceDialog
      description={`For ${s.course.name} in ${s.cohort.name}.`}
      uploadsEndpoint={`/v1/sessions/${s.id}/resources/uploads`}
      scopes={{ session: `This session · ${formatDay(s.startsAt, timeZone)}`, course: `The whole course · ${s.course.name}` }}
      add={(input) => add.mutateAsync(input)}
      onClose={onClose}
      onAdded={onAdded}
    />
  )
}

export type NewResource = { kind: 'file' | 'link'; name: string; url?: string; path?: string; scope: 'session' | 'course'; visible: boolean }

/** The add-resource form, for a session (with a choice of scope) or a whole course in a cohort (pilot feedback, Nov 2026). */
export function ResourceDialog({
  description,
  uploadsEndpoint,
  scopes,
  add,
  onClose,
  onAdded,
}: {
  description: string
  uploadsEndpoint: string
  /** Labels for "this session" and "whole course"; leave out for course-only. */
  scopes?: { session: string; course: string }
  add: (input: NewResource) => Promise<unknown>
  onClose: () => void
  onAdded: (name: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<'file' | 'link'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [scope, setScope] = useState<'session' | 'course'>(scopes ? 'session' : 'course')
  const [visible, setVisible] = useState(true)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<string | null>(null)

  function choose(f: File | undefined) {
    if (!f) return
    setFile(f)
    setErrors({})
    if (!name.trim()) setName(stripExtension(f.name))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (kind === 'file' && !file) next.path = 'Choose a file.'
    if (kind === 'link' && !/^https?:\/\/\S+$/.test(url.trim())) next.url = 'Paste the full link, starting with https://'
    const title = name.trim() || (file ? stripExtension(file.name) : '')
    if (!title) next.name = 'Enter a title.'
    setErrors(next)
    setFailed(null)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const path = kind === 'file' ? await uploadFile(uploadsEndpoint, file!) : undefined
      await add({ kind, name: title, ...(kind === 'link' ? { url: url.trim() } : { path }), scope, visible })
      onAdded(title)
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details))
        setErrors(Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
      else setFailed(error instanceof Error ? error.message : 'It wasn’t added. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    choose(e.dataTransfer.files[0])
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title="Add a resource"
      description={description}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-resource" disabled={busy}>
            {busy ? (kind === 'file' ? 'Uploading…' : 'Adding…') : 'Add resource'}
          </Button>
        </>
      }
    >
      <form id="add-resource" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {failed && <AlertBanner tone="error" title={failed} />}
        <div role="radiogroup" aria-label="Kind" className="flex gap-1.5">
          {(['file', 'link'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k)
                setErrors({})
              }}
              className={clsx(
                'h-7 rounded-full border px-3 text-caption-strong transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
                kind === k ? 'border-transparent bg-surface-selected text-brand-text' : 'border-default bg-surface text-secondary hover:text-primary',
              )}
            >
              {k === 'file' ? 'File' : 'Link'}
            </button>
          ))}
        </div>
        {kind === 'file' ? (
          <div className="flex flex-col gap-1.5">
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={drop}
              className={clsx(
                'flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-6 text-center transition-colors focus-within:shadow-[var(--shadow-focus)]',
                errors.path ? 'border-error' : over ? 'border-brand bg-brand-subtle' : 'border-strong bg-canvas hover:bg-surface-hover',
              )}
            >
              <DownloadIcon size={20} className="text-icon-brand" />
              <span className="text-body-strong text-primary">{file ? file.name : 'Drop a file here, or browse'}</span>
              <span className="text-caption text-secondary">
                {file ? fileSize(file.size) : 'Slides, documents, spreadsheets, images or video · up to 25 MB'}
              </span>
              <input ref={input} type="file" className="sr-only" aria-label="Choose a file" onChange={(e) => choose(e.target.files?.[0])} />
            </label>
            {errors.path && <p className="text-caption text-error-fg">{errors.path}</p>}
          </div>
        ) : (
          <TextField label="Link" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} error={errors.url} />
        )}
        <TextField
          label="Title"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          helper={kind === 'file' ? 'Defaults to the file name.' : undefined}
        />
        {scopes && (
          <SelectField
            label="Show on"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'session' | 'course')}
            helper="Or the whole course, so every session shows it."
          >
            <option value="session">{scopes.session}</option>
            <option value="course">{scopes.course}</option>
          </SelectField>
        )}
        <Checkbox label="Visible to participants" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
      </form>
    </Dialog>
  )
}
