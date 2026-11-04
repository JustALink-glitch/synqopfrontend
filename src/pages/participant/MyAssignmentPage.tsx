import clsx from 'clsx'
import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { FileRow } from '@/components/ui/FileRow'
import { DetailList } from '@/components/ui/FormLayout'
import { ChevronRightIcon, CloseIcon, DownloadIcon } from '@/components/ui/icons'
import { FilterChips, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { openFile, fileSize, MAX_FILE_BYTES, uploadFile } from '@/lib/files'
import { formatDue, type SubmissionType } from '@/pages/assignments/data'
import { gradingWords, submitWays, useMyAssignment, useSubmit, type MyAssignmentDetail, type MySubmission } from './data'
import { MyStatusBadge } from './MyAssignmentsPage'

const BASE = '/participant/assignments'
const typeLabel: Record<SubmissionType, string> = { file: 'File', link: 'Link', text: 'Text' }

/** /participant/assignments/:id — P5.02 submit (file, link, text, late, closed) and P5.03 submitted. */
export function MyAssignmentPage() {
  const { id = '' } = useParams()
  const query = useMyAssignment(id)
  if (query.isPending) return <div aria-busy="true" aria-label="Loading assignment" className="h-40" />
  if (query.isError) {
    const notFound = (query.error as { status?: number }).status === 404
    return (
      <>
        <PageHeader title={notFound ? 'Assignment not found' : 'Couldn’t load the assignment'} breadcrumb={[{ label: 'Assignments', to: BASE }]} />
        <Panel>
          <StatePanel
            kind={notFound ? 'no-results' : 'error'}
            title={notFound ? 'It isn’t in your courses.' : 'Something went wrong'}
            description="Go back to your assignments."
          />
        </Panel>
      </>
    )
  }
  return <MyAssignmentView key={query.data.submission?.submittedAt ?? 'none'} {...query.data} />
}

function MyAssignmentView({ timeZone, assignment: a, submission: s }: { timeZone: string; assignment: MyAssignmentDetail; submission: MySubmission | null }) {
  const [replacing, setReplacing] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const trainer = a.trainer ?? 'your trainer'
  const showForm = a.canSubmit && (!s || replacing)
  // Only work that's still open can be submitted after the due time, and it's marked overdue.
  const pastDue = a.status === 'overdue'

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Assignments', to: BASE }, { label: a.title }]}
        title={a.title}
        badge={<MyStatusBadge status={a.status} />}
        description={[a.course.name, a.trainer, `Due ${formatDue(a.dueAt, timeZone)}`].filter(Boolean).join(' · ')}
      />

      {a.status === 'overdue' && (
        <AlertBanner tone="warning" title="The due time has passed">
          You can still submit — it’ll be marked late for your trainer.
        </AlertBanner>
      )}
      {a.status === 'closed' && (
        <AlertBanner tone="error" title="Submissions are closed">
          This assignment doesn’t accept late work. Talk to {trainer} if something got in the way.
        </AlertBanner>
      )}
      {s && a.status !== 'graded' && !replacing && (
        <AlertBanner tone="success" title={`${justSubmitted ? 'Submitted' : 'Submitted on'} ${formatDue(s.submittedAt, timeZone)}`}>
          {s.late ? 'Marked late.' : 'On time.'} {a.trainer ?? 'Your trainer'} will grade it; you’ll see the grade here when they do.
        </AlertBanner>
      )}
      {a.status === 'graded' && (
        <AlertBanner tone="success" title="Graded">
          <Link to={`/participant/grades/${a.id}`} className="inline-flex items-center gap-1 text-brand-text hover:underline">
            See your grade and feedback
            <ChevronRightIcon size={14} />
          </Link>
        </AlertBanner>
      )}
      {a.cantSubmitBecause === 'enrolment' && !s && (
        <AlertBanner title="You can’t submit this">You’re not active in this cohort any more. Talk to your programme team if that’s wrong.</AlertBanner>
      )}

      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          {(a.brief || a.links.length > 0 || a.files.length > 0) && (
            <Panel aria-labelledby="brief-title" className="gap-3">
              <PanelHeader id="brief-title" title="Brief" />
              {a.brief && <p className="text-body whitespace-pre-line text-primary">{a.brief}</p>}
              {a.files.map((f) => (
                <FileRow key={f.id} name={f.name} size={f.size} onDownload={() => openFile(`/v1/my/assignments/${a.id}/files/${f.id}`, f.name)} />
              ))}
              {a.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit max-w-full items-center gap-1 text-caption-strong text-brand-text hover:underline"
                >
                  <span className="truncate">{l.name}</span>
                  <ChevronRightIcon size={14} className="shrink-0" />
                </a>
              ))}
            </Panel>
          )}

          {showForm ? (
            <SubmitForm
              assignment={a}
              replacing={Boolean(s)}
              pastDue={pastDue}
              onCancel={s ? () => setReplacing(false) : undefined}
              onDone={() => {
                setReplacing(false)
                setJustSubmitted(true)
              }}
            />
          ) : s ? (
            <Panel aria-labelledby="mine-title" className="gap-3">
              <PanelHeader id="mine-title" title="Your submission" />
              <SubmissionContent assignmentId={a.id} submission={s} />
              {a.status !== 'graded' && (
                <div className="flex flex-col items-start gap-2">
                  <Button variant="secondary" disabled={!a.canSubmit} onClick={() => setReplacing(true)}>
                    Replace submission
                  </Button>
                  <p className="text-caption text-secondary">
                    {a.canSubmit ? `You can replace it until ${formatDue(a.dueAt, timeZone)}.` : 'Replacing closed at the due time.'}
                  </p>
                </div>
              )}
            </Panel>
          ) : null}
        </div>

        <aside className="w-[356px] shrink-0 max-lg:w-full">
          <Panel aria-labelledby="details-title">
            <PanelHeader id="details-title" title="Details" />
            <DetailList
              items={[
                ...(s ? [] : [{ label: 'Due', value: formatDue(a.dueAt, timeZone) }]),
                { label: 'Grading', value: gradingWords(a) },
                ...(s
                  ? [{ label: 'Status', value: a.status === 'graded' ? `Graded · ${a.grade}` : 'Waiting for a grade' }]
                  : [
                      { label: 'You can submit', value: submitWays(a.submissionTypes) },
                      { label: 'Late work', value: a.latePolicy === 'accept_late' ? 'Accepted, marked late' : 'Not accepted' },
                    ]),
              ]}
            />
          </Panel>
        </aside>
      </div>
    </>
  )
}

/** What the participant handed in: file, link or text, plus their note (P5.03, P6.02). */
export function SubmissionContent({ assignmentId, submission: s }: { assignmentId: string; submission: MySubmission }) {
  return (
    <>
      {s.files.map((f) => (
        <FileRow key={f.id} name={f.name} size={f.size} onDownload={() => openFile(`/v1/my/assignments/${assignmentId}/files/${f.id}`, f.name)} />
      ))}
      {s.link && (
        <a href={s.link} target="_blank" rel="noreferrer" className="flex flex-col rounded-md border border-default p-3 hover:bg-surface-hover">
          <span className="text-caption text-secondary">Link</span>
          <span className="truncate text-body-strong text-brand-text">{s.link}</span>
        </a>
      )}
      {s.text && <p className="rounded-md border border-default p-3 text-body whitespace-pre-line text-primary">{s.text}</p>}
      {s.note && <p className="text-body text-secondary">“{s.note}”</p>}
    </>
  )
}

function SubmitForm({
  assignment: a,
  replacing,
  pastDue,
  onCancel,
  onDone,
}: {
  assignment: MyAssignmentDetail
  replacing: boolean
  pastDue: boolean
  onCancel?: () => void
  onDone: () => void
}) {
  const submit = useSubmit(a.id)
  const input = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<SubmissionType>(a.submissionTypes[0]!)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [link, setLink] = useState('')
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const busy = uploading || submit.isPending

  function choose(f: File | undefined) {
    if (!f) return
    setError(f.size > MAX_FILE_BYTES ? `${f.name} is ${fileSize(f.size)}. Files can be up to 25 MB.` : f.size === 0 ? 'This file is empty.' : null)
    setFile(f.size > MAX_FILE_BYTES || f.size === 0 ? null : f)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFailed(null)
    if (type === 'file' && !file) return setError('Choose a file to submit.')
    if (type === 'link' && !/^https?:\/\/\S+$/.test(link.trim()))
      return setError(link.trim() ? 'Paste the full link, starting with https://' : 'Paste a link to your work.')
    if (type === 'text' && !text.trim()) return setError('Write your answer.')
    try {
      if (type === 'file') {
        setUploading(true)
        const path = await uploadFile(`/v1/my/assignments/${a.id}/uploads`, file!)
        setUploading(false)
        await submit.mutateAsync({ type, file: { path, name: file!.name }, note })
      } else if (type === 'link') {
        await submit.mutateAsync({ type, link: link.trim(), note })
      } else {
        await submit.mutateAsync({ type, text, note })
      }
      onDone()
    } catch (err) {
      setUploading(false)
      if (err instanceof ApiError && Array.isArray(err.details) && err.details.length) setError((err.details as { message: string }[])[0]!.message)
      else setFailed(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Nothing was submitted. Try again.')
    }
  }

  const label = busy ? (uploading ? 'Uploading…' : 'Submitting…') : replacing ? 'Replace submission' : pastDue ? 'Submit late' : 'Submit'

  return (
    <Panel aria-labelledby="submit-title">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <PanelHeader
          id="submit-title"
          title={replacing ? 'Replace your submission' : 'Your submission'}
          description={pastDue ? 'It’ll be marked late.' : 'You can replace it until the due time.'}
        />
        {failed && (
          <AlertBanner tone="error" title="Couldn’t submit">
            {failed}
          </AlertBanner>
        )}
        {a.submissionTypes.length > 1 && (
          <FilterChips
            label="How you’re submitting"
            value={type}
            onChange={(value) => {
              setType(value)
              setError(null)
            }}
            options={a.submissionTypes.map((t) => ({ value: t, label: typeLabel[t] }))}
          />
        )}
        {type === 'file' &&
          (file ? (
            <FileRow
              name={file.name}
              size={file.size}
              action={
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  disabled={busy}
                  onClick={() => setFile(null)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-icon hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
                >
                  <CloseIcon size={16} />
                </button>
              }
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={clsx(
                  'flex flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-7 text-center transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
                  dragging ? 'border-brand bg-brand-subtle' : error ? 'border-error' : 'border-strong hover:bg-surface-hover',
                )}
              >
                <DownloadIcon size={20} className="text-icon-brand" />
                <span className="text-body-strong text-primary">
                  Drop your file here, or <span className="text-brand-text">browse</span>
                </span>
                <span className="text-caption text-secondary">Notebook, PDF, document or zip · up to 25 MB</span>
              </button>
              <input ref={input} type="file" aria-label="Choose a file" className="sr-only" tabIndex={-1} onChange={(e) => choose(e.target.files?.[0])} />
            </div>
          ))}
        {type === 'link' && (
          <TextField
            label="Link to your work"
            type="url"
            placeholder="https://github.com/…"
            value={link}
            onChange={(e) => {
              setLink(e.target.value)
              setError(null)
            }}
            error={error}
            helper="Make sure your trainer can open it."
          />
        )}
        {type === 'text' && (
          <TextAreaField
            label="Your answer"
            value={text}
            maxLength={20000}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            error={error}
            helper="Plain text. Your trainer sees it exactly as written."
            className="h-40"
          />
        )}
        {type === 'file' && error && <p className="text-caption text-error-fg">{error}</p>}
        <TextAreaField
          label="Note for your trainer"
          optional
          value={note}
          maxLength={1000}
          placeholder="Anything they should know"
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {label}
          </Button>
        </div>
      </form>
    </Panel>
  )
}
