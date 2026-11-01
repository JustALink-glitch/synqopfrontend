import clsx from 'clsx'
import { useRef, useState, type DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { DetailList } from '@/components/ui/FormLayout'
import { CheckIcon, DownloadIcon, FileIcon } from '@/components/ui/icons'
import { Badge, FilterChips, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Table, type Column } from '@/components/ui/Table'
import { SelectField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { CSV_TEMPLATE, readParticipantCsv, type ParticipantRow } from '@/lib/csv'
import { formatDay, formatTime, plural } from '@/lib/format'
import { useCohorts } from '@/pages/admin/programmes/data'
import { useImport, useImportPreview, type ImportResult, type ReviewedRow } from './data'

const MAX_ROWS = 500
type Step = 1 | 2 | 3

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** /admin/participants/import?cohort= — B1.03a upload, B1.03b review, B1.03c done. */
export function ImportParticipantsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const cohorts = useCohorts()
  const preview = useImportPreview()
  const runImport = useImport()

  const [step, setStep] = useState<Step>(1)
  const [cohortId, setCohortId] = useState(params.get('cohort') ?? '')
  const [file, setFile] = useState<{ name: string; rows: ParticipantRow[] } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [cohortError, setCohortError] = useState<string | null>(null)
  const [sendEmails, setSendEmails] = useState(true)
  const [reviewed, setReviewed] = useState<ReviewedRow[]>([])
  const [filter, setFilter] = useState<'error' | 'ready' | 'all'>('all')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const openCohorts = (cohorts.data ?? []).filter((c) => c.status === 'active' || c.status === 'upcoming' || c.status === 'draft')
  const cohortName = openCohorts.find((c) => c.id === cohortId)?.name ?? ''
  const ready = reviewed.filter((r) => r.status === 'ready')
  const errors = reviewed.filter((r) => r.status === 'error')

  async function readFile(picked: File | undefined) {
    setFileError(null)
    setFile(null)
    if (!picked) return
    if (!/\.csv$/i.test(picked.name) && picked.type !== 'text/csv') {
      setFileError('Choose a .csv file. In Excel or Google Sheets, use File › Download › CSV.')
      return
    }
    if (picked.size > 2 * 1024 * 1024) {
      setFileError('That file is larger than 2 MB. Split it into files of up to 500 rows.')
      return
    }
    const { rows, error } = readParticipantCsv(await picked.text())
    if (error) setFileError(error)
    else if (rows.length > MAX_ROWS) setFileError(`The file has ${rows.length} rows. Import up to ${MAX_ROWS} at a time.`)
    else setFile({ name: picked.name, rows })
  }

  async function review() {
    setCohortError(cohortId ? null : 'Choose a cohort.')
    if (!file) setFileError((prev) => prev ?? 'Choose a CSV file.')
    if (!cohortId || !file) return
    setFailed(null)
    try {
      const res = await preview.mutateAsync({ cohortId, fileName: file.name, rows: file.rows })
      setReviewed(res.rows)
      setFilter(res.rows.some((r) => r.status === 'error') ? 'error' : 'all')
      setStep(2)
    } catch (error) {
      setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'The file couldn’t be checked. Try again.')
    }
  }

  async function importRows() {
    if (!file) return
    setFailed(null)
    try {
      setResult(await runImport.mutateAsync({ cohortId, fileName: file.name, rows: file.rows, sendEmails }))
      setStep(3)
    } catch (error) {
      setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'Nothing was imported. Check your connection and try again.')
    }
  }

  function startOver() {
    setStep(1)
    setFile(null)
    setReviewed([])
    setResult(null)
    if (input.current) input.current.value = ''
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void readFile(event.dataTransfer.files[0])
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Participants', to: '/admin/participants' }, { label: 'Import participants' }]}
        title="Import participants"
        description="Add people to a cohort from a CSV file."
      />
      <Steps current={step} />

      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          {failed && (
            <AlertBanner tone="error" title="Something went wrong">
              {failed}
            </AlertBanner>
          )}

          {step === 1 && (
            <Panel className="gap-4">
              <PanelHeader title="Upload a CSV file" description="Each row becomes a participant in the cohort you choose." />
              <SelectField
                label="Add to cohort"
                value={cohortId}
                onChange={(e) => {
                  setCohortId(e.target.value)
                  setCohortError(null)
                }}
                error={cohortError}
                helper={openCohorts.length === 0 && !cohorts.isPending ? 'There are no active or upcoming cohorts. Create one first.' : undefined}
              >
                <option value="">Select a cohort</option>
                {openCohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={clsx(
                  'flex flex-col items-center gap-1.5 rounded-md border border-dashed p-6 text-center transition-colors',
                  dragging ? 'border-brand bg-brand-subtle' : fileError ? 'border-error' : 'border-strong bg-surface-subtle',
                )}
              >
                {file ? (
                  <>
                    <FileIcon size={20} className="text-icon-brand" />
                    <p className="text-body-strong text-primary">{file.name}</p>
                    <p className="text-caption text-secondary">{plural(file.rows.length, 'row')} found</p>
                    <button type="button" onClick={() => input.current?.click()} className="text-caption-strong text-brand-text hover:underline">
                      Choose a different file
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-body text-primary">
                      Drop a CSV file here, or{' '}
                      <button type="button" onClick={() => input.current?.click()} className="font-medium text-brand-text hover:underline">
                        browse
                      </button>
                    </p>
                    <p className="text-caption text-secondary">Up to {MAX_ROWS} rows. Columns: full_name, email, phone (optional).</p>
                  </>
                )}
                <input
                  ref={input}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label="CSV file"
                  onChange={(e) => void readFile(e.target.files?.[0])}
                />
              </div>
              {fileError && <p className="text-caption text-error-fg">{fileError}</p>}
              <Checkbox label="Email invitations when the import finishes" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} />
              <div className="flex gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
                <Button variant="secondary" onClick={() => navigate('/admin/participants')}>
                  Cancel
                </Button>
                <Button onClick={review} disabled={preview.isPending}>
                  {preview.isPending ? 'Checking…' : 'Review rows'}
                </Button>
              </div>
            </Panel>
          )}

          {step === 2 && file && (
            <>
              {errors.length > 0 ? (
                <AlertBanner tone="warning" title={`${plural(errors.length, 'row needs', 'rows need')} fixing`}>
                  {plural(ready.length, 'row is', 'rows are')} ready. Rows that still need fixing are skipped when you import.
                </AlertBanner>
              ) : (
                <AlertBanner tone="success" title={`All ${plural(ready.length, 'row')} ${ready.length === 1 ? 'is' : 'are'} ready`}>
                  Nothing needs fixing.
                </AlertBanner>
              )}
              <Panel className="gap-3">
                <div className="flex items-center gap-3 max-md:flex-col max-md:items-start">
                  <div className="flex flex-1 items-center gap-3">
                    <FileIcon size={20} className="shrink-0 text-icon" />
                    <div className="flex flex-col">
                      <span className="text-body-strong text-primary">{file.name}</span>
                      <span className="text-caption text-secondary">
                        {plural(reviewed.length, 'row')} · adding to {cohortName}
                      </span>
                    </div>
                  </div>
                  <FilterChips
                    label="Rows"
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { value: 'error', label: 'Needs fixing', count: errors.length },
                      { value: 'ready', label: 'Ready', count: ready.length },
                      { value: 'all', label: 'All', count: reviewed.length },
                    ]}
                  />
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  <ReviewTable rows={reviewed.filter((r) => filter === 'all' || r.status === filter)} />
                </div>
                <div className="flex gap-3 border-t border-default pt-4 max-md:flex-col-reverse max-md:[&>*]:h-11">
                  <Button variant="secondary" onClick={startOver} disabled={runImport.isPending}>
                    Upload a corrected file
                  </Button>
                  <Button onClick={importRows} disabled={ready.length === 0 || runImport.isPending}>
                    {runImport.isPending ? 'Importing…' : ready.length === 0 ? 'Nothing to import' : `Import ${plural(ready.length, 'participant')}`}
                  </Button>
                </div>
              </Panel>
            </>
          )}

          {step === 3 && result && file && (
            <Panel className="gap-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
                  <CheckIcon size={18} />
                </span>
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-heading-section text-primary">
                    {plural(result.added, 'participant')} added to {result.cohort.name}
                  </h2>
                  <p className="text-caption text-secondary">
                    {file.name} · {formatDay(result.importedAt, timeZone)}, {formatTime(result.importedAt, timeZone)}
                  </p>
                </div>
              </div>
              <DetailList
                items={[
                  { label: 'Added', value: plural(result.added, 'participant') },
                  { label: 'Skipped', value: result.skipped.length ? `${plural(result.skipped.length, 'row')} that still needed fixing` : 'None' },
                  {
                    label: 'Invitations',
                    value:
                      result.invited === 0
                        ? 'None needed — everyone already had an account'
                        : !sendEmails
                          ? `${plural(result.invited, 'invitation')} not emailed — resend from each profile`
                          : `${result.emailed} emailed · links expire ${formatDay(result.invitationExpiresAt, timeZone)}, ${formatTime(result.invitationExpiresAt, timeZone)}`,
                  },
                ]}
              />
              <div className="flex flex-wrap gap-3 max-md:flex-col max-md:[&>*]:h-11">
                {result.skipped.length > 0 && (
                  <Button
                    variant="secondary"
                    icon={<DownloadIcon size={16} />}
                    onClick={() =>
                      download(
                        `skipped-${file.name}`,
                        [
                          'full_name,email,phone,problem',
                          ...result.skipped.map((r) => [r.fullName, r.email, r.phone ?? '', r.message ?? ''].map(csvCell).join(',')),
                        ].join('\n'),
                      )
                    }
                  >
                    Download skipped rows
                  </Button>
                )}
                <Button variant="secondary" onClick={startOver}>
                  Import another file
                </Button>
                <Button onClick={() => navigate(`/admin/cohorts/${result.cohort.id}/participants`)}>View cohort</Button>
              </div>
            </Panel>
          )}
        </div>

        <aside className="w-[356px] shrink-0 max-lg:w-full">
          <Panel>
            <PanelHeader title="CSV format" description="What each row needs." />
            <DetailList
              items={[
                { label: 'full_name', value: 'Required' },
                { label: 'email', value: 'Required · one per person' },
                { label: 'phone', value: <span className="font-normal text-secondary">Optional</span> },
              ]}
            />
            <button
              type="button"
              onClick={() => download('synqop-participants-template.csv', CSV_TEMPLATE)}
              className="inline-flex w-fit items-center gap-1 text-caption-strong text-brand-text hover:underline"
            >
              <DownloadIcon size={14} />
              Download template
            </button>
          </Panel>
        </aside>
      </div>
    </>
  )
}

function Steps({ current }: { current: Step }) {
  const steps = ['Upload file', 'Review rows', 'Import']
  return (
    <ol className="grid grid-cols-3 gap-2 max-md:gap-1">
      {steps.map((label, index) => {
        const n = (index + 1) as Step
        const done = n < current || current === 3
        const active = n === current && current !== 3
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={clsx('flex items-center gap-3 rounded-md px-3 py-2.5', active ? 'bg-surface-selected' : 'bg-surface')}
          >
            <span
              className={clsx(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-caption-strong',
                done ? 'bg-brand text-on-brand' : active ? 'bg-brand text-on-brand' : 'bg-neutral-bg text-neutral-fg',
              )}
            >
              {done ? <CheckIcon size={14} /> : n}
            </span>
            <span className={clsx('truncate text-body-strong', active ? 'text-brand-text' : done ? 'text-primary' : 'text-secondary')}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

const reviewColumns: Column[] = [{ label: 'Row', width: 64 }, { label: 'Full name' }, { label: 'Email' }, { label: 'Check', width: 220 }]

function ReviewTable({ rows }: { rows: ReviewedRow[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-body text-secondary">No rows here.</p>
  return (
    <Table columns={reviewColumns}>
      {rows.map((r) => (
        <Row key={r.row}>
          <Cell className="text-secondary tabular-nums">{r.row}</Cell>
          <Cell className={r.fullName ? 'truncate' : 'text-muted'}>{r.fullName || '—'}</Cell>
          <Cell className={r.email ? 'truncate' : 'text-muted'}>{r.email || '—'}</Cell>
          <Cell>{r.status === 'ready' ? <Badge tone="success">Ready</Badge> : <Badge tone="error">{r.message}</Badge>}</Cell>
        </Row>
      ))}
    </Table>
  )
}
