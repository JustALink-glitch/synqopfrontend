import { CircleAlert, MapPin, Video } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { CalendarIcon, ChartIcon, ChevronRightIcon, ClipboardIcon, InfoTriangleIcon, UserGroupIcon } from '@/components/ui/icons'
import { Metrics } from '@/components/ui/Metrics'
import { Badge, EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Stacked, Table, type Column } from '@/components/ui/Table'
import { api } from '@/lib/api'
import { formatDate, formatDay, formatTime, lengthOf, plural, relativeDay } from '@/lib/format'
import { initials } from '@/lib/people'
import { describeFlag, followUpLine, signalOf, useAttention } from '@/pages/admin/attention/data'
import { todayLong } from '@/pages/participant/data'
import { dueLine, minutesUntil, todayIn } from './data'

interface TodaySession {
  id: string
  course: string
  cohort: string
  startsAt: string
  endsAt: string
  mode: 'online' | 'in_person'
  location: string | null
  joinUrl: string | null
  status: 'scheduled' | 'in_progress' | 'held'
  expected: number
  recorded: number
  number: number
  total: number
}

interface Today {
  timeZone: string
  role: 'lead' | 'assistant'
  can: { attendance: boolean; resources: boolean; grade: boolean; createAssignments: boolean; reports: boolean }
  assists: { course: string; cohort: string; lead: string | null }[]
  cohorts: {
    id: string
    name: string
    programme: string
    status: string
    participants: number
    held: number
    planned: number
    attendance: number | null
    nextSessionAt: string | null
    courses: string[]
  }[]
  attendance: { rate: number | null; previous: number | null }
  toGrade: { submissions: number; assignments: number } | null
  flagged: number | null
  today: TodaySession[]
  next: TodaySession | null
  grading: { id: string; title: string; cohort: string; dueAt: string; closed: boolean; expected: number; submitted: number; late: number; toGrade: number }[]
}

const where = (s: TodaySession) => (s.mode === 'in_person' ? (s.location ?? 'In person') : s.joinUrl?.includes('zoom.us') ? 'Online · Zoom' : 'Online')
const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? ''))

/** /trainer — T2.01 Today's teaching, T2.01a assistant, T2.01e not assigned, T2.01l loading, T2.01x partial error. */
export function TodayPage() {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['trainer', 'today'], queryFn: ({ signal }) => api<Today>('/v1/trainer/today', { signal }) })
  const data = query.data
  const timeZone = data?.timeZone
  const needsRegister = data?.today.find((s) => s.status !== 'scheduled' && s.recorded === 0) ?? data?.today.find((s) => s.status !== 'held')

  const header = (
    <PageHeader
      eyebrow={todayLong(timeZone)}
      title="Today’s teaching"
      description={
        !data
          ? ' '
          : data.cohorts.length === 0
            ? 'You’re not assigned to a cohort yet'
            : data.role === 'assistant'
              ? `You assist on ${list(data.assists.map((a) => `${a.course} · ${a.cohort}`))}`
              : `Your cohorts: ${list(data.cohorts.map((c) => c.name))}`
      }
      actions={
        <>
          <Button
            variant="secondary"
            icon={<ClipboardIcon size={16} />}
            disabled={!data?.toGrade || data.cohorts.length === 0}
            onClick={() => navigate('/trainer/grading')}
          >
            Grade assignments
          </Button>
          {data?.can.attendance !== false && (
            <Button
              icon={<CalendarIcon size={16} />}
              disabled={!needsRegister}
              onClick={() => needsRegister && navigate(`/trainer/sessions/${needsRegister.id}${needsRegister.status === 'scheduled' ? '' : '/attendance'}`)}
            >
              Take attendance
            </Button>
          )}
        </>
      }
    />
  )

  if (query.isPending) {
    return (
      <>
        {header}
        <div aria-busy="true" aria-label="Loading today’s teaching" className="flex flex-col gap-4">
          <div className="h-[104px] animate-pulse rounded-lg bg-skeleton" />
          <div className="grid grid-cols-[minmax(0,1fr)_356px] gap-4 max-lg:grid-cols-1">
            <div className="h-[260px] animate-pulse rounded-lg bg-skeleton" />
            <div className="h-[260px] animate-pulse rounded-lg bg-skeleton" />
          </div>
        </div>
      </>
    )
  }
  if (query.isError) {
    return (
      <>
        {header}
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load today’s teaching"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      </>
    )
  }
  const d = query.data
  if (d.cohorts.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<CalendarIcon size={24} />}
          title="No cohorts assigned yet"
          body="When an admin assigns you to a cohort, its sessions, grading queue and participants appear here. Nothing to do until then."
        />
      </>
    )
  }

  const assistant = d.role === 'assistant'
  const participants = d.cohorts.reduce((n, c) => n + c.participants, 0)
  const lead = [...new Set(d.assists.map((a) => a.lead).filter(Boolean))] as string[]
  const assistantCan = [
    d.can.attendance && 'take attendance',
    d.can.resources && 'add resources',
    d.can.grade && 'grade work',
    d.can.createAssignments && 'create assignments',
  ].filter(Boolean) as string[]
  const nextLine = d.next
    ? `${relativeDay(d.next.startsAt, timeZone)}, ${formatTime(d.next.startsAt, timeZone)} · ${d.next.course} · ${d.next.cohort} · ${where(d.next)}`
    : null

  return (
    <>
      {header}
      {assistant && (
        <AlertBanner tone="info" title="You’re an assistant on this course">
          You can {assistantCan.length ? list(assistantCan) : 'see sessions and participants'}.{' '}
          {lead.length
            ? `${list(lead)}, the lead trainer${lead.length > 1 ? 's' : ''}, ${d.can.reports ? 'creates assignments' : 'creates assignments and writes session reports'}.`
            : ''}{' '}
          Your admin decides what assistants can do.
        </AlertBanner>
      )}
      <Metrics
        items={
          assistant
            ? [
                {
                  label: 'Next session',
                  icon: <CalendarIcon size={18} />,
                  value: d.today[0] ? 'Today' : d.next ? formatDay(d.next.startsAt, timeZone) : '—',
                  context: d.today[0]
                    ? `${d.today[0].course} · ${formatTime(d.today[0].startsAt, timeZone)}`
                    : d.next
                      ? `${d.next.course}${d.can.attendance ? ' · you take attendance' : ''}`
                      : 'Nothing scheduled',
                },
                {
                  label: 'To grade',
                  icon: <ClipboardIcon size={18} />,
                  value: d.toGrade?.submissions ?? '—',
                  context: d.toGrade ? `Across ${plural(d.toGrade.assignments, 'assignment')}` : 'Grading is off for assistants',
                },
                { label: 'Participants', icon: <UserGroupIcon size={18} />, value: participants, context: list(d.cohorts.map((c) => c.name)) },
              ]
            : [
                {
                  label: 'My cohorts',
                  icon: <UserGroupIcon size={18} />,
                  value: d.cohorts.length,
                  context: `${plural(participants, 'participant')} · ${d.cohorts.every((c) => c.status === 'active') ? (d.cohorts.length > 1 ? 'all active' : 'active') : 'active and upcoming'}`,
                },
                {
                  label: 'Attendance, last 4 weeks',
                  icon: <ChartIcon size={18} />,
                  value: d.attendance.rate === null ? '—' : <AttendanceValue rate={d.attendance.rate} previous={d.attendance.previous} />,
                  context:
                    d.attendance.rate === null
                      ? 'Nothing recorded yet'
                      : `Your courses${d.attendance.previous !== null ? ` · prev. ${d.attendance.previous}%` : ''}`,
                },
                {
                  label: 'To grade',
                  icon: <ClipboardIcon size={18} />,
                  value: d.toGrade?.submissions ?? 0,
                  context: d.toGrade?.assignments ? `Submissions across ${plural(d.toGrade.assignments, 'assignment')}` : 'Nothing waiting',
                },
                {
                  label: 'Needs attention',
                  icon: <InfoTriangleIcon size={18} />,
                  value: d.flagged ?? '—',
                  tone: d.flagged ? ('warning' as const) : undefined,
                  context: d.flagged === null ? 'Only admins see flags' : 'Participants in your cohorts',
                },
              ]
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)_356px] items-start gap-4 max-lg:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          <TodayPanel data={d} nextLine={nextLine} />
          {d.toGrade && <GradingQueue data={d} />}
        </div>
        <div className="flex flex-col gap-4">
          {d.flagged !== null && <AttentionPanel timeZone={d.timeZone} />}
          <CohortsPanel data={d} />
        </div>
      </div>
    </>
  )
}

function AttendanceValue({ rate, previous }: { rate: number; previous: number | null }) {
  const change = previous === null ? null : rate - previous
  return (
    <span className="inline-flex items-center gap-2">
      {rate}%
      {change !== null && change !== 0 && (
        <span className={`rounded-sm px-1.5 text-caption-strong ${change < 0 ? 'bg-warning-bg text-warning-fg' : 'bg-success-bg text-success-fg'}`}>
          {change < 0 ? '↓' : '↑'} {Math.abs(change)} pts
        </span>
      )}
    </span>
  )
}

function TodayPanel({ data: d, nextLine }: { data: Today; nextLine: string | null }) {
  const navigate = useNavigate()
  const timeZone = d.timeZone
  return (
    <Panel className="gap-0">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader
          title={`Today · ${formatDate(todayIn(timeZone))}`}
          description={d.today.length ? 'Take attendance during or right after each session.' : undefined}
        />
        <Link to="/trainer/sessions" className="inline-flex h-7 shrink-0 items-center gap-1 text-caption-strong text-brand-text hover:underline">
          My sessions
          <ChevronRightIcon size={14} />
        </Link>
      </div>
      {d.today.length === 0 ? (
        <p className="py-3 text-body text-secondary">
          {d.next
            ? `No sessions today. Your next one is ${d.next.course} on ${formatDay(d.next.startsAt, timeZone)}.`
            : 'No sessions today, and nothing else scheduled yet.'}
        </p>
      ) : (
        <ul className="mt-2">
          {d.today.map((s) => {
            const mins = minutesUntil(s.startsAt)
            const line =
              s.status === 'scheduled'
                ? mins <= 90
                  ? `Starts in ${mins} min · attendance not recorded`
                  : null
                : s.recorded
                  ? `Attendance recorded · ${s.recorded} of ${s.expected}`
                  : s.status === 'in_progress'
                    ? 'In progress · attendance not recorded'
                    : 'Attendance not recorded yet'
            return (
              <li key={s.id} className="flex gap-3 border-b border-default py-3 last:border-b-0 max-md:flex-col">
                <Link to={`/trainer/sessions/${s.id}`} className="flex min-w-0 flex-1 gap-3 hover:opacity-90">
                  <span className="flex w-12 shrink-0 flex-col text-caption tabular-nums">
                    <span className="text-body-strong text-primary">{formatTime(s.startsAt, timeZone)}</span>
                    <span className="whitespace-nowrap text-secondary">{lengthOf(s.startsAt, s.endsAt)}</span>
                  </span>
                  <span className={`w-[3px] shrink-0 rounded-full ${s.mode === 'online' ? 'bg-brand' : 'bg-success'}`} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{s.course}</span>
                    <span className="truncate text-caption text-secondary">
                      {s.cohort} · Session {s.number} of {s.total}
                    </span>
                    <span className="flex items-center gap-1 text-caption text-secondary">
                      {s.mode === 'online' ? <Video aria-hidden className="size-3.5 shrink-0" /> : <MapPin aria-hidden className="size-3.5 shrink-0" />}
                      {where(s)}
                    </span>
                    {line && (
                      <span className={`flex items-center gap-1 text-caption ${s.recorded ? 'text-secondary' : 'text-warning-fg'}`}>
                        {!s.recorded && <CircleAlert aria-hidden className="size-3.5 shrink-0" />}
                        {line}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-start gap-1 text-caption text-secondary">
                    <UserGroupIcon size={14} />
                    {s.expected}
                  </span>
                </Link>
                {d.can.attendance && (
                  <div className="flex items-center">
                    <Button variant="secondary" onClick={() => navigate(`/trainer/sessions/${s.id}${s.status === 'scheduled' ? '' : '/attendance'}`)}>
                      {s.recorded ? 'Open register' : 'Take attendance'}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {d.today.length > 0 && nextLine && <p className="border-t border-default pt-3 text-caption text-secondary">Next: {nextLine}</p>}
    </Panel>
  )
}

const queueColumns: Column[] = [
  { label: 'Assignment' },
  { label: 'Due', width: 130 },
  { label: 'Submitted', width: 150, hideBelow: 'lg' },
  { label: 'Late', width: 60, align: 'right', hideBelow: 'xl' },
  { label: 'To grade', width: 80, align: 'right' },
  { label: '', width: 72, align: 'right' },
]

function GradingQueue({ data: d }: { data: Today }) {
  return (
    <Panel className="gap-0 max-md:py-2">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader title="Grading queue" description="Submissions waiting for your grade, oldest deadline first." />
        <Link to="/trainer/grading" className="inline-flex h-7 shrink-0 items-center gap-1 text-caption-strong text-brand-text hover:underline">
          Grade assignments
          <ChevronRightIcon size={14} />
        </Link>
      </div>
      {d.grading.length === 0 ? (
        <p className="py-3 text-body text-secondary">Nothing waiting. New submissions show here.</p>
      ) : (
        <>
          <div className="mt-2 max-md:hidden">
            <Table columns={queueColumns}>
              {d.grading.map((a) => (
                <Row key={a.id} to={`/trainer/grading/${a.id}`}>
                  <Cell>
                    <Stacked primary={a.title} secondary={a.cohort} />
                  </Cell>
                  <Cell>
                    <Stacked primary={formatDay(a.dueAt, d.timeZone)} secondary={dueLine(a.dueAt, a.closed)} />
                  </Cell>
                  <Cell hideBelow="lg">
                    <span className="flex flex-col gap-1">
                      <span className="h-1.5 w-full rounded-full bg-chart-track">
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${a.expected ? Math.min(100, Math.round((a.submitted / a.expected) * 100)) : 0}%` }}
                        />
                      </span>
                      <span className="text-caption text-secondary tabular-nums">
                        {a.submitted} of {a.expected}
                      </span>
                    </span>
                  </Cell>
                  <Cell align="right" hideBelow="xl" className="tabular-nums">
                    {a.late}
                  </Cell>
                  <Cell align="right" className="text-body-strong tabular-nums">
                    {a.toGrade}
                  </Cell>
                  <Cell align="right">
                    {a.toGrade > 0 && (
                      <Link
                        to={`/trainer/grading/${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-caption-strong text-brand-text"
                      >
                        Grade
                        <ChevronRightIcon size={14} />
                      </Link>
                    )}
                  </Cell>
                </Row>
              ))}
            </Table>
          </div>
          <ul className="md:hidden">
            {d.grading.map((a) => (
              <li key={a.id} className="border-b border-default last:border-b-0">
                <Link to={`/trainer/grading/${a.id}`} className="flex items-center gap-3 py-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{a.title}</span>
                    <span className="text-caption text-secondary">
                      {a.cohort} · {a.submitted} of {a.expected} submitted · due {formatDay(a.dueAt, d.timeZone)}
                    </span>
                  </span>
                  <Badge tone={a.toGrade ? 'warning' : 'neutral'}>{a.toGrade} to grade</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

const signalTone = { attendance: 'warning', assignments: 'warning', activity: 'neutral' } as const
const signalName = { attendance: 'Attendance', assignments: 'Assignments', activity: 'Activity' } as const

/** Needs attention for my cohorts. Loads on its own, so a failure here doesn't take the page down (T2.01x). */
function AttentionPanel({ timeZone }: { timeZone: string }) {
  const query = useAttention()
  const rows = query.data?.participants ?? []
  return (
    <Panel className="gap-0">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader title="Needs attention" description="Participants in your cohorts who match a follow-up rule." />
        {rows.length > 0 && (
          <Link to="/trainer/participants" className="inline-flex h-7 shrink-0 items-center gap-1 text-caption-strong text-brand-text hover:underline">
            View all {rows.length}
            <ChevronRightIcon size={14} />
          </Link>
        )}
      </div>
      {query.isPending ? (
        <div className="h-24" aria-busy="true" />
      ) : query.isError ? (
        <div className="py-3">
          <AlertBanner tone="error" title="Couldn’t load who needs attention">
            The rest of the page is up to date.{' '}
            <button type="button" className="text-brand-text underline" onClick={() => void query.refetch()}>
              Try again
            </button>
          </AlertBanner>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-body text-secondary">No one in your cohorts needs attention right now.</p>
      ) : (
        <ul className="mt-1">
          {rows.slice(0, 3).map((r) => {
            const first = r.flags[0]!
            const d = describeFlag(first, timeZone)
            const signal = signalOf[first.rule]
            return (
              <li key={r.enrolmentId} className="border-b border-default last:border-b-0">
                <Link to={`/trainer/participants/${r.participant.id}`} className="flex items-start gap-3 py-3 hover:bg-surface-hover">
                  <Avatar size={32} initials={initials(r.participant.name)} seed={r.participant.id} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-body-strong text-primary">{r.participant.name}</span>
                      <Badge tone={signalTone[signal]}>{signalName[signal]}</Badge>
                    </span>
                    <span className="text-body text-primary">{d.title}</span>
                    <span className="truncate text-caption text-secondary">
                      {r.cohort.name} · {d.detail}
                    </span>
                    <span className="text-caption text-secondary">{followUpLine(r.lastIntervention, timeZone)}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <p className="border-t border-default pt-3 text-caption text-secondary">Only participants in your cohorts are shown.</p>
    </Panel>
  )
}

function CohortsPanel({ data: d }: { data: Today }) {
  return (
    <Panel className="gap-0">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader title="My cohorts" />
        <Link to="/trainer/cohorts" className="inline-flex h-7 shrink-0 items-center gap-1 text-caption-strong text-brand-text hover:underline">
          All
          <ChevronRightIcon size={14} />
        </Link>
      </div>
      <ul className="mt-1">
        {d.cohorts.map((c) => (
          <li key={c.id} className="border-b border-default last:border-b-0">
            <Link to={`/trainer/cohorts/${c.id}`} className="flex flex-col gap-2 py-3 hover:bg-surface-hover">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-body-strong text-primary">{c.name}</span>
                <Badge tone={c.status === 'active' ? 'success' : 'info'}>{c.status === 'active' ? 'Active' : 'Upcoming'}</Badge>
              </span>
              <span className="text-caption text-secondary">
                {c.programme} · {plural(c.participants, 'participant')}
              </span>
              <span className="flex items-center gap-3">
                <span className="h-1.5 flex-1 rounded-full bg-chart-track">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${c.planned ? Math.round((c.held / c.planned) * 100) : 0}%` }} />
                </span>
                <span className="shrink-0 text-caption text-secondary tabular-nums">
                  {c.held} of {c.planned} sessions
                </span>
              </span>
              <span className="flex justify-between gap-2 text-caption">
                <span className="text-body-strong text-primary">Attendance {c.attendance === null ? '—' : `${c.attendance}%`}</span>
                <span className="text-secondary">
                  Next: {c.nextSessionAt ? `${relativeDay(c.nextSessionAt, d.timeZone)}, ${formatTime(c.nextSessionAt, d.timeZone)}` : '—'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** /trainer/restricted — O1.01r: an admin page opened by a trainer. */
export function AdminOnlyPage() {
  const navigate = useNavigate()
  return (
    <>
      <PageHeader title="Programme overview" />
      <Panel className="mx-auto w-full max-w-[420px]">
        <StatePanel
          kind="restricted"
          title="Programme overview is for admins"
          description="You’re signed in as a trainer. Organisation-wide figures, other trainers’ cohorts and reports aren’t available to this role. Your sessions, grading and participants are on your dashboard."
          action={{ label: 'Go to my dashboard', onClick: () => navigate('/trainer') }}
        />
      </Panel>
    </>
  )
}
