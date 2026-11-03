import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { BarChart3, Table2 } from 'lucide-react'
import { useState } from 'react'
import { BarChart, BarList, Donut, LineChart, Stat } from '@/components/charts/Charts'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { ChartIcon, DownloadIcon } from '@/components/ui/icons'
import { EmptyState, Panel } from '@/components/ui/Page'
import { SelectField, TextField } from '@/components/ui/TextField'
import { api, ApiError } from '@/lib/api'
import { plural, todayIn } from '@/lib/format'
import { useCohorts, useProgrammes } from '@/pages/admin/programmes/data'
import { kinds, type Kind } from './kinds'

type Section = { heading: string; facts: [string, string][] } | { heading: string; columns: string[]; rows: (string | number)[][]; note?: string }
type Tone = 'present' | 'excused' | 'absent'
type Chart =
  | {
      id: string
      title: string
      kind: 'stacked' | 'bars' | 'line'
      unit?: '%'
      labels: string[]
      series: { name: string; values: (number | null)[]; tone?: Tone }[]
      note?: string
    }
  | { id: string; title: string; kind: 'barlist'; unit?: '%'; max?: number; rows: { label: string; value: number | null; note?: string }[]; note?: string }
  | { id: string; title: string; kind: 'donut'; centre: string; caption?: string; parts: { label: string; value: number }[]; note?: string }

interface Preview {
  title: string
  subtitle: string
  period: string
  sections: Section[]
  highlights: { label: string; value: string; note?: string; tone?: 'warn' }[]
  charts: Chart[]
}

const toneColour: Record<Tone, string> = { present: 'var(--chart-present)', excused: 'var(--chart-excused)', absent: 'var(--chart-absent)' }

const ROWS = 25

/** E1.06 Live view: the report's figures on screen, from today's data, before anything is downloaded. */
export function LiveReport({ onStarted }: { onStarted: (id: string) => void }) {
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const programmes = useProgrammes()
  const cohorts = useCohorts()
  const [kind, setKind] = useState<Kind>('cohort_summary')
  const [programmeId, setProgrammeId] = useState('')
  const [cohortId, setCohortId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const programmeList = (programmes.data?.programmes ?? []).filter((p) => p.status !== 'archived')
  // Start on a programme with a running cohort, where there's something to see.
  const running = programmeList.find((p) => (cohorts.data ?? []).some((c) => c.programme.id === p.id && c.status === 'active'))
  const programme = programmeId || running?.id || programmeList[0]?.id || ''
  const cohortList = (cohorts.data ?? []).filter((c) => c.programme.id === programme && c.status !== 'draft')
  const spec = kinds.find((k) => k.value === kind)!
  const cohort = spec.cohort === 'none' ? '' : cohortId || (spec.cohort === 'required' ? (cohortList[0]?.id ?? '') : '')
  const selected = cohortList.find((c) => c.id === cohort)
  const today = todayIn(timeZone)
  const effectiveFrom = from || selected?.startsOn || ''
  // Up to today (or the end date), but never before the start: a cohort that hasn't begun shows its first day.
  const cappedTo = selected ? (selected.endsOn < today ? selected.endsOn : today) : ''
  const effectiveTo = to || (cappedTo && effectiveFrom && cappedTo < effectiveFrom ? effectiveFrom : cappedTo)
  const params = { kind, programmeId: programme, cohortId: cohort || null, from: effectiveFrom || null, to: effectiveTo || null }
  const ready = Boolean(programme) && (spec.cohort !== 'required' || Boolean(cohort))

  const preview = useQuery({
    queryKey: ['reports-preview', params],
    queryFn: ({ signal }) => api<{ preview: Preview }>('/v1/reports/preview', { method: 'POST', body: params, signal }),
    enabled: ready,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const start = useMutation({
    mutationFn: (format: 'pdf' | 'csv') => api<{ report: { id: string } }>('/v1/reports', { method: 'POST', body: { ...params, format } }),
  })
  const [problem, setProblem] = useState<string | null>(null)
  const [view, setView] = useState<'charts' | 'table'>('charts')

  async function download(format: 'pdf' | 'csv') {
    setProblem(null)
    try {
      onStarted((await start.mutateAsync(format)).report.id)
    } catch (error) {
      setProblem(error instanceof ApiError && error.status < 500 ? error.message : 'It didn’t start. Try again.')
    }
  }

  if (programmes.data && programmeList.length === 0) {
    return (
      <Panel className="py-12">
        <EmptyState
          icon={<ChartIcon size={24} />}
          title="Nothing to report yet"
          body="Reports are built from programmes and their cohorts. Create a programme first."
        />
      </Panel>
    )
  }

  const doc = preview.data?.preview
  return (
    <div className="flex flex-col gap-4">
      <Panel className="gap-3">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_150px_150px] gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
          <SelectField
            label="Report"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind)
              setCohortId('')
            }}
          >
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Programme"
            value={programme}
            onChange={(e) => {
              setProgrammeId(e.target.value)
              setCohortId('')
            }}
          >
            {programmeList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Cohort" value={cohort} onChange={(e) => setCohortId(e.target.value)} disabled={spec.cohort === 'none'}>
            {spec.cohort !== 'required' && <option value="">All cohorts</option>}
            {spec.cohort === 'required' && cohortList.length === 0 && <option value="">No cohorts yet</option>}
            {cohortList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <TextField label="From" type="date" value={effectiveFrom} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="To" type="date" value={effectiveTo} onChange={(e) => setTo(e.target.value)} />
        </div>
        <p className="text-caption text-secondary">{spec.description}</p>
      </Panel>

      {problem && <AlertBanner tone="error" title={problem} />}

      <Panel className="gap-5" aria-busy={preview.isFetching}>
        <div className="flex items-start gap-3 max-md:flex-col">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-heading-section text-primary">{doc?.title ?? spec.label}</h2>
            <span className="text-caption text-secondary">
              {doc ? `${doc.period} · Live, as of now` : 'Choose what to look at above.'}
              {preview.isFetching && doc ? ' · Updating…' : ''}
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <div role="group" aria-label="Show as" className="inline-flex h-9 rounded-md border border-default bg-surface p-0.5">
              {(
                [
                  ['charts', 'Charts', <BarChart3 key="c" aria-hidden className="size-4" />],
                  ['table', 'Table', <Table2 key="t" aria-hidden className="size-4" />],
                ] as const
              ).map(([v, label, icon]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`inline-flex items-center gap-1.5 rounded-[5px] px-2.5 text-label-button transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none ${view === v ? 'bg-brand-subtle text-brand-text' : 'text-secondary hover:text-primary'}`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            <Button variant="secondary" icon={<DownloadIcon size={16} />} disabled={!ready || start.isPending} onClick={() => void download('csv')}>
              CSV
            </Button>
            <Button icon={<DownloadIcon size={16} />} disabled={!ready || start.isPending} onClick={() => void download('pdf')}>
              {start.isPending ? 'Starting…' : 'Download PDF'}
            </Button>
          </div>
        </div>
        {!ready ? (
          <p className="py-6 text-center text-body text-secondary">
            {spec.cohort === 'required' ? 'This report needs a cohort. Add one to the programme first.' : 'Choose a programme.'}
          </p>
        ) : preview.isError ? (
          <StatePanel
            kind="error"
            title="Couldn’t load the figures"
            description={preview.error instanceof ApiError && preview.error.status === 400 ? preview.error.message : 'Check your connection and try again.'}
            action={{ label: 'Try again', onClick: () => void preview.refetch() }}
          />
        ) : !doc ? (
          <div className="h-40" />
        ) : view === 'charts' ? (
          <ChartsView doc={doc} />
        ) : (
          doc.sections.map((section) => <SectionView key={section.heading} section={section} />)
        )}
      </Panel>
    </div>
  )
}

function SectionView({ section }: { section: Section }) {
  const [all, setAll] = useState(false)
  if ('facts' in section) {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-body-strong text-primary">{section.heading}</h3>
        <dl className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
          {section.facts.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 rounded-md border border-default p-3">
              <dt className="text-caption text-secondary">{label}</dt>
              <dd className="text-heading-section text-primary tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }
  const rows = all ? section.rows : section.rows.slice(0, ROWS)
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-body-strong text-primary">
        {section.heading} <span className="text-caption text-secondary">· {plural(section.rows.length, 'row')}</span>
      </h3>
      {section.rows.length === 0 ? (
        <p className="text-body text-secondary">Nothing recorded for this period yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-default">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-surface-subtle">
              <tr>
                {section.columns.map((c, i) => (
                  <th key={c} scope="col" className={`px-3 py-2 text-caption-strong whitespace-nowrap text-secondary ${i > 0 ? 'text-right' : ''}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-default">
                  {row.map((cell, i) => (
                    <td key={i} className={`px-3 py-2 text-body text-primary ${i > 0 ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.rows.length > ROWS && (
        <button type="button" onClick={() => setAll(!all)} className="self-start text-caption-strong text-brand-text hover:underline">
          {all ? 'Show fewer' : `Show all ${section.rows.length} rows`}
        </button>
      )}
      {section.note && <p className="text-caption text-secondary">{section.note}</p>}
    </section>
  )
}

function ChartsView({ doc }: { doc: Preview }) {
  const empty = doc.charts.length === 0
  return (
    <div className="flex flex-col gap-5">
      {doc.highlights.length > 0 && (
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2">
          {doc.highlights.map((h) => (
            <Stat key={h.label} label={h.label} value={h.value} note={h.note} tone={h.tone} />
          ))}
        </div>
      )}
      {empty ? (
        <p className="py-6 text-center text-body text-secondary">
          Nothing recorded for this period yet. Charts appear once there’s attendance, work or feedback.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
          {doc.charts.map((c) => (
            <section
              key={c.id}
              aria-label={c.title}
              className={`flex min-w-0 flex-col gap-3 rounded-md border border-default p-4 ${c.kind === 'stacked' || c.kind === 'line' ? 'lg:col-span-1' : ''}`}
            >
              <h3 className="text-body-strong text-primary">{c.title}</h3>
              <ChartView chart={c} />
              {c.note && <p className="text-caption text-secondary">{c.note}</p>}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ChartView({ chart: c }: { chart: Chart }) {
  if (c.kind === 'donut') return <Donut centre={c.centre} caption={c.caption} parts={c.parts} />
  if (c.kind === 'barlist') {
    if (!c.rows.length) return <p className="text-body text-secondary">Nothing to show yet.</p>
    return <BarList rows={c.rows} unit={c.unit ?? ''} max={c.max} />
  }
  if (c.kind === 'line') return <LineChart labels={c.labels} series={c.series} unit={c.unit ?? ''} max={c.unit === '%' ? 100 : undefined} />
  return (
    <BarChart
      stacked={c.kind === 'stacked'}
      labels={c.labels}
      unit={c.unit ?? ''}
      series={c.series.map((s) => ({ name: s.name, values: s.values.map((v) => v ?? 0), colour: s.tone ? toneColour[s.tone] : undefined }))}
    />
  )
}
