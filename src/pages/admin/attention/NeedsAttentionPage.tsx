import { CheckCircle2, MessageSquarePlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { BulkBar } from '@/components/collection/Collection'
import { useSelection } from '@/components/collection/selection'
import { StatePanel } from '@/components/StatePanel'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { CheckCircleIcon, ChevronRightIcon, DownloadIcon } from '@/components/ui/icons'
import { Badge, EmptyState, FilterChips, PageHeader, Panel } from '@/components/ui/Page'
import { FilterSelect, SearchField } from '@/components/ui/SearchField'
import { Cell, Row, Table, TableFooter, type Column } from '@/components/ui/Table'
import { formatDay, plural } from '@/lib/format'
import { paginate } from '@/lib/paginate'
import { initials } from '@/lib/people'
import { downloadCsv } from '@/pages/admin/sessions/attendanceData'
import {
  describeFlag,
  followUpLine,
  methodLabel,
  outcomeLabel,
  outcomeTone,
  rulesSentence,
  signalLabel,
  signalOf,
  useAttention,
  useInterventions,
  useRecordMany,
  useResolveMany,
  type FlaggedRow,
  type Outcome,
  type Signal,
} from './data'
import { RecordInterventionDialog } from './AttentionPanels'

type SignalFilter = 'all' | Signal
type FollowUp = 'any' | 'none' | Outcome

const columns: Column[] = [
  { label: 'Participant', width: 220 },
  { label: 'Why', hideBelow: undefined },
  { label: 'Signal', width: 130 },
  { label: 'Follow-up', width: 210, hideBelow: 'lg' },
  { label: '', width: 80, align: 'right' },
]

const matchesFollowUp = (f: FollowUp, r: FlaggedRow) => f === 'any' || (f === 'none' ? !r.lastIntervention : r.lastIntervention?.outcome === f)

/** /admin/needs-attention — D1.01 Needs attention, D1.01e nothing flagged. */
export function NeedsAttentionPage() {
  const query = useAttention()
  const navigate = useNavigate()
  const [signal, setSignal] = useState<SignalFilter>('all')
  // Opened from a cohort's "View all" link: start filtered to that cohort.
  const [cohort, setCohort] = useState(() => new URLSearchParams(window.location.search).get('cohort') ?? 'all')
  const [followUp, setFollowUp] = useState<FollowUp>('any')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const rows = query.data?.participants ?? []
  const timeZone = query.data?.timeZone
  const cohorts = [...new Map(rows.map((r) => [r.cohort.id, r.cohort.name])).entries()]
  const term = search.trim().toLowerCase()
  const visible = rows.filter(
    (r) =>
      (signal === 'all' || r.flags.some((f) => signalOf[f.rule] === signal)) &&
      (cohort === 'all' || r.cohort.id === cohort) &&
      matchesFollowUp(followUp, r) &&
      (!term || r.participant.name.toLowerCase().includes(term)),
  )
  const paged = paginate(visible, page, 10)
  // Tick rows to resolve or follow up with several people at once (pilot feedback, Nov 2026).
  const selection = useSelection(paged.rows.map((r) => r.participant.id))
  const chosen = paged.rows.filter((r) => selection.has(r.participant.id))
  const [dialog, setDialog] = useState<'resolve' | 'record' | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const recordMany = useRecordMany()
  const canResolve = query.data?.canResolve ?? false
  const count = (s: Signal) => rows.filter((r) => r.flags.some((f) => signalOf[f.rule] === s)).length
  const cohortCount = new Set(rows.map((r) => r.cohort.id)).size

  const logButton = (
    <Button variant="secondary" onClick={() => navigate('interventions')}>
      Interventions log
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Needs attention"
        description={
          query.data
            ? rows.length
              ? `${plural(rows.length, 'participant')} across ${plural(cohortCount, 'cohort')} match a follow-up rule. Rechecked each time you open this page.`
              : 'Participants who match a follow-up rule appear here.'
            : undefined
        }
        actions={logButton}
      />
      {query.data && (
        <AlertBanner title="Rules are provisional">
          {rulesSentence(query.data.rules)} A flag clears when the rules stop matching, or when an admin resolves it with a note.
        </AlertBanner>
      )}
      {done && <AlertBanner tone="success" title={done} />}
      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Checking participants" className="h-[240px]">
          <span className="sr-only">Checking participants</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t check participants"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<CheckCircleIcon size={24} />}
            title="No one needs attention"
            body="Everyone in your running cohorts is within the rules. Participants appear here as soon as one matches."
          />
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 max-md:flex-col max-md:items-stretch">
            <FilterChips
              label="Signal"
              value={signal}
              onChange={(v) => {
                setSignal(v)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'All signals', count: rows.length },
                { value: 'attendance', label: 'Attendance', count: count('attendance') },
                { value: 'assignments', label: 'Assignments', count: count('assignments') },
                { value: 'activity', label: 'Activity', count: count('activity') },
              ]}
            />
            {cohorts.length > 1 && (
              <FilterSelect aria-label="Cohort" value={cohort} onChange={(e) => setCohort(e.target.value)}>
                <option value="all">All cohorts</option>
                {cohorts.map(([id, n]) => (
                  <option key={id} value={id}>
                    {n}
                  </option>
                ))}
              </FilterSelect>
            )}
            <FilterSelect aria-label="Follow-up" value={followUp} onChange={(e) => setFollowUp(e.target.value as FollowUp)}>
              <option value="any">Any follow-up</option>
              <option value="none">Not contacted yet</option>
              <option value="awaiting_response">Awaiting response</option>
              <option value="reached">Reached</option>
              <option value="no_response">No response</option>
            </FilterSelect>
            <div className="flex-1" />
            <SearchField aria-label="Search participants" placeholder="Search participants" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <BulkBar
            selection={selection}
            noun={['participant', 'participants']}
            actions={[
              ...(canResolve ? [{ label: 'Resolve', icon: <CheckCircle2 aria-hidden className="size-4" />, run: async () => (setDone(null), setDialog('resolve')) }] : []),
              { label: 'Record follow-up', icon: <MessageSquarePlus aria-hidden className="size-4" />, run: async () => (setDone(null), setDialog('record')) },
            ]}
          />
          {dialog === 'resolve' && (
            <ResolveManyDialog
              people={chosen.map((r) => ({ id: r.participant.id, name: r.participant.name }))}
              onClose={() => setDialog(null)}
              onDone={(n) => {
                setDialog(null)
                selection.clear()
                setDone(`Resolved flags for ${plural(n, 'participant')}`)
              }}
            />
          )}
          {dialog === 'record' && (
            <RecordInterventionDialog
              memberId=""
              name={chosen.length === 1 ? chosen[0]!.participant.name : plural(chosen.length, 'participant')}
              cohortName={chosen.length === 1 ? chosen[0]!.cohort.name : ''}
              timeZone={timeZone}
              onClose={() => setDialog(null)}
              onSaved={() => {
                setDialog(null)
                const n = chosen.length
                selection.clear()
                setDone(`Follow-up recorded for ${plural(n, 'participant')}`)
              }}
              save={{
                pending: recordMany.isPending,
                run: async (input) => {
                  const result = await recordMany.mutateAsync({ memberIds: chosen.map((r) => r.participant.id), input })
                  if (result.failed.length) throw new ApiError(400, 'partial', `Saved for ${result.saved}; ${plural(result.failed.length, 'participant')} couldn’t be saved. Try them again.`)
                },
              }}
            />
          )}
          <Panel className="gap-0 max-md:py-2">
            {visible.length === 0 ? (
              <StatePanel kind="no-results" title="No one matches" description="Try another filter." />
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns} select={{ checked: selection.header, onChange: selection.toggleAll, label: 'Select everyone on this page' }}>
                    {paged.rows.map((r) => {
                      const first = r.flags[0]!
                      const what = describeFlag(first, timeZone)
                      const to = `/admin/participants/${r.participant.id}`
                      return (
                        <Row
                          key={r.enrolmentId}
                          to={to}
                          select={{ checked: selection.has(r.participant.id), onChange: () => selection.toggle(r.participant.id), label: `Select ${r.participant.name}` }}
                        >
                          <Cell>
                            <span className="flex min-w-0 items-center gap-3">
                              <Avatar initials={initials(r.participant.name)} seed={r.participant.id} size={32} />
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate text-body-strong">{r.participant.name}</span>
                                <span className="truncate text-caption text-secondary">{r.cohort.name}</span>
                              </span>
                            </span>
                          </Cell>
                          <Cell>
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-body-strong">
                                {what.title}
                                {r.flags.length > 1 && <span className="font-normal text-secondary"> · +{r.flags.length - 1} more</span>}
                              </span>
                              <span className="truncate text-caption text-secondary">{what.detail}</span>
                            </span>
                          </Cell>
                          <Cell>
                            <Badge tone={signalOf[first.rule] === 'activity' ? 'neutral' : 'warning'}>{signalLabel[signalOf[first.rule]]}</Badge>
                          </Cell>
                          <Cell hideBelow="lg">
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-body">{followUpLine(r.lastIntervention, timeZone)}</span>
                              <span className="truncate text-caption text-secondary">Flagged {formatDay(first.raisedAt, timeZone)}</span>
                            </span>
                          </Cell>
                          <Cell align="right">
                            <Link
                              to={to}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline"
                            >
                              Review
                              <ChevronRightIcon size={14} />
                            </Link>
                          </Cell>
                        </Row>
                      )
                    })}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {paged.rows.map((r) => (
                    <li key={r.enrolmentId} className="flex items-center gap-3 border-b border-default last:border-b-0">
                      <Checkbox
                        label={<span className="sr-only">Select {r.participant.name}</span>}
                        checked={selection.has(r.participant.id)}
                        onChange={() => selection.toggle(r.participant.id)}
                        className="-m-2 p-2"
                      />
                      <Link to={`/admin/participants/${r.participant.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">{r.participant.name}</span>
                          <span className="truncate text-caption text-secondary">{describeFlag(r.flags[0]!, timeZone).title}</span>
                          <span className="truncate text-caption text-secondary">{followUpLine(r.lastIntervention, timeZone)}</span>
                        </span>
                        <Badge tone={signalOf[r.flags[0]!.rule] === 'activity' ? 'neutral' : 'warning'}>{signalLabel[signalOf[r.flags[0]!.rule]]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <TableFooter
              summary={`${plural(visible.length, 'participant')} · oldest unresolved first`}
              page={paged.page}
              pageCount={paged.pageCount}
              onPage={setPage}
            />
          </Panel>
        </>
      )}
    </>
  )
}

const logColumns: Column[] = [
  { label: 'Participant', width: 200 },
  { label: 'How · by', width: 180 },
  { label: 'Outcome', width: 170 },
  { label: 'When', width: 150, hideBelow: 'lg' },
  { label: 'Note' },
]

/** /admin/needs-attention/interventions — D1.04 Interventions log. */
export function InterventionsPage() {
  const query = useInterventions()
  const [filter, setFilter] = useState<'all' | Outcome>('all')
  const [page, setPage] = useState(1)
  const all = query.data?.interventions ?? []
  const timeZone = query.data?.timeZone
  const visible = all.filter((i) => filter === 'all' || i.outcome === filter)
  const paged = paginate(visible, page, 10)
  const when = (at: string) =>
    `${formatDay(at, timeZone)}, ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(at))}`
  const by = (i: (typeof all)[number]) => (i.by ? `${i.by.name}${i.by.trainer ? ' (trainer)' : ''}` : 'Someone who has left')

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Needs attention', to: '/admin/needs-attention' }, { label: 'Interventions' }]}
        title="Interventions"
        description="Every contact recorded by admins and trainers. Never visible to participants."
        actions={
          all.length > 0 ? (
            <Button
              variant="secondary"
              icon={<DownloadIcon size={16} />}
              onClick={() =>
                downloadCsv('interventions.csv', [
                  ['Participant', 'Cohort', 'How', 'By', 'Outcome', 'When', 'Review on', 'Note'],
                  ...all.map((i) => [
                    i.participant.name,
                    i.cohort,
                    methodLabel[i.method],
                    by(i),
                    outcomeLabel[i.outcome],
                    when(i.at),
                    i.reviewOn ?? '',
                    i.notes ?? '',
                  ]),
                ])
              }
            >
              Export CSV
            </Button>
          ) : undefined
        }
      />
      {query.isPending ? (
        <Panel aria-busy="true" className="h-[240px]">
          <span className="sr-only">Loading interventions</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel kind="error" title="Couldn’t load interventions" action={{ label: 'Try again', onClick: () => void query.refetch() }} />
        </Panel>
      ) : all.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<CheckCircleIcon size={24} />}
            title="No interventions yet"
            body="When an admin or trainer records a call, email, message or visit, it appears here."
          />
        </Panel>
      ) : (
        <>
          <FilterChips
            label="Outcome"
            value={filter}
            onChange={(v) => {
              setFilter(v)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All', count: all.length },
              ...(['awaiting_response', 'reached', 'no_response', 'resolved'] as const).map((o) => ({
                value: o,
                label: outcomeLabel[o],
                count: all.filter((i) => i.outcome === o).length,
              })),
            ]}
          />
          <Panel className="gap-0 max-md:py-2">
            <div className="max-md:hidden">
              <Table columns={logColumns}>
                {paged.rows.map((i) => (
                  <Row key={i.id} to={`/admin/participants/${i.participant.id}`}>
                    <Cell>
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar initials={initials(i.participant.name)} seed={i.participant.id} />
                        <span className="truncate text-body-strong">{i.participant.name}</span>
                      </span>
                    </Cell>
                    <Cell>
                      <span className="flex flex-col">
                        <span className="text-body-strong">{methodLabel[i.method]}</span>
                        <span className="truncate text-caption text-secondary">{by(i)}</span>
                      </span>
                    </Cell>
                    <Cell>
                      <Badge tone={outcomeTone[i.outcome]}>{outcomeLabel[i.outcome]}</Badge>
                    </Cell>
                    <Cell hideBelow="lg" className="tabular-nums">
                      {when(i.at)}
                    </Cell>
                    <Cell>
                      <span className="line-clamp-2 text-body">{i.notes ?? <span className="text-muted">—</span>}</span>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </div>
            <ul className="md:hidden">
              {paged.rows.map((i) => (
                <li key={i.id} className="border-b border-default last:border-b-0">
                  <Link to={`/admin/participants/${i.participant.id}`} className="flex flex-col gap-1 py-3">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-body-strong text-primary">{i.participant.name}</span>
                      <Badge tone={outcomeTone[i.outcome]}>{outcomeLabel[i.outcome]}</Badge>
                    </span>
                    <span className="text-caption text-secondary">
                      {methodLabel[i.method]} · {by(i)} · {when(i.at)}
                    </span>
                    {i.notes && <span className="line-clamp-2 text-body text-primary">{i.notes}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <TableFooter summary={plural(visible.length, 'intervention')} page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </Panel>
        </>
      )}
    </>
  )
}

/** Resolve several participants' flags with one note (pilot feedback, Nov 2026). */
function ResolveManyDialog({ people, onClose, onDone }: { people: { id: string; name: string }[]; onClose: () => void; onDone: (participants: number) => void }) {
  const resolve = useResolveMany()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const names = people.map((p) => p.name.split(' ')[0])
  const who = names.length <= 3 ? names.join(', ').replace(/, ([^,]*)$/, ' and $1') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!note.trim()) return setError('Add a note. It’s kept with each flag.')
    try {
      const result = await resolve.mutateAsync({ memberIds: people.map((p) => p.id), note })
      onDone(result.participants)
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? err.message : 'Nothing was resolved. Try again.')
    }
  }

  return (
    <Dialog
      open
      onClose={() => !resolve.isPending && onClose()}
      width={440}
      title={`Resolve ${plural(people.length, 'participant')}`}
      description={`Closes the open flags for ${who}. Anyone who matches a rule again later gets a new flag.`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={resolve.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="resolve-many" disabled={resolve.isPending}>
            {resolve.isPending ? 'Resolving…' : `Resolve ${people.length}`}
          </Button>
        </>
      }
    >
      <form id="resolve-many" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextAreaField
          label="Note"
          autoFocus
          value={note}
          maxLength={1000}
          onChange={(e) => {
            setNote(e.target.value)
            setError(null)
          }}
          error={error}
          helper="Required. Kept with each flag; visible to admins and their trainers."
        />
      </form>
    </Dialog>
  )
}
