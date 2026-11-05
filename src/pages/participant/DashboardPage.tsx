import { MapPin, Video } from 'lucide-react'
import { Link } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { BookOpenIcon, CalendarIcon, ChevronRightIcon, ClipboardIcon } from '@/components/ui/icons'
import { Metrics } from '@/components/ui/Metrics'
import { EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Stacked, Table, type Column } from '@/components/ui/Table'
import { formatDate, formatDay, formatTime, lengthOf, plural, relativeDay } from '@/lib/format'
import { initials } from '@/lib/people'
import { formatDue } from '@/pages/assignments/data'
import { daysUntil, sessionWhere, todayLong, useMyAssignments, useMyGrades, useMyOverview, type MyAssignment, type MyOverview, type MySession } from './data'
import { MyStatusBadge } from './MyAssignmentsPage'
import { SessionBadge } from './SessionBits'

const columns: Column[] = [
  { label: 'Assignment' },
  { label: 'Due', width: 150 },
  { label: 'Status', width: 140 },
  { label: 'Grade', width: 90, align: 'right' },
  { label: '', width: 80, align: 'right' },
]

const linkClass = 'inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline'

/** /participant — P2.01 Dashboard, P2.01e before you start, P2.01d deferred, P2.01x partial error. */
export function DashboardPage() {
  const overview = useMyOverview()
  if (overview.isPending) return <div aria-busy="true" aria-label="Loading your dashboard" className="h-40" />
  if (overview.isError) {
    return (
      <>
        <PageHeader title="Your learning" />
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load your dashboard"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void overview.refetch() }}
          />
        </Panel>
      </>
    )
  }
  return <Dashboard data={overview.data} />
}

function Dashboard({ data }: { data: MyOverview }) {
  const { timeZone, enrolment: e, deferred } = data
  const header = (
    <PageHeader
      eyebrow={todayLong(timeZone)}
      title="Your learning"
      description={e ? `${e.cohort.name} · ${e.programme}` : undefined}
      actions={
        data.nextSession?.status === 'in_progress' && data.nextSession.joinUrl ? (
          <a
            href={data.nextSession.joinUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand pr-4 pl-3 text-label-button text-on-brand hover:bg-brand-hover"
          >
            <Video aria-hidden className="size-4" />
            Join session
          </a>
        ) : undefined
      }
    />
  )

  if (!e) {
    return (
      <>
        {header}
        {deferred ? (
          <>
            <AlertBanner title={`Your place in ${deferred.cohort} is deferred`}>
              Your attendance and grades so far are saved. Your programme team will tell you when you rejoin a cohort.
            </AlertBanner>
            <Panel className="py-12">
              <EmptyState
                icon={<CalendarIcon size={24} />}
                title="Nothing scheduled for you right now"
                body="Courses, sessions and assignments appear here again when you’re back in a cohort."
              />
            </Panel>
          </>
        ) : (
          <Panel className="py-12">
            <EmptyState
              icon={<CalendarIcon size={24} />}
              title="You’re not in a cohort yet"
              body="When your programme team adds you to a cohort, your courses, sessions and assignments appear here."
            />
          </Panel>
        )}
      </>
    )
  }

  if (e.cohort.status === 'upcoming') {
    const days = daysUntil(e.cohort.startsOn, timeZone)
    const first = data.nextSession
    return (
      <>
        {header}
        <Panel className="py-12">
          <EmptyState
            icon={<CalendarIcon size={24} />}
            title={days <= 1 ? `${e.cohort.name} starts ${days === 1 ? 'tomorrow' : 'today'}` : `Your cohort starts in ${days} days`}
            body={
              first
                ? `First session: ${first.course.name}${first.trainer ? ` with ${first.trainer}` : ''}, ${formatDay(first.startsAt, timeZone)} at ${formatTime(first.startsAt, timeZone)}, ${sessionWhere(first).toLowerCase()}.${first.mode === 'online' ? ' The joining link appears here the day before.' : ''}`
                : `${e.cohort.name} starts on ${formatDate(e.cohort.startsOn, { year: true })}. Courses, sessions and assignments appear here as your trainers publish them.`
            }
          />
        </Panel>
      </>
    )
  }

  return (
    <>
      {header}
      <DashboardMetrics data={data} />
      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          <AssignmentsPanel timeZone={timeZone} />
          <FeedbackPanel timeZone={timeZone} />
        </div>
        <aside className="flex w-[356px] shrink-0 flex-col gap-4 max-lg:w-full">
          <UpcomingPanel sessions={data.upcoming} timeZone={timeZone} />
          <AttendancePanel data={data} />
        </aside>
      </div>
    </>
  )
}

function DashboardMetrics({ data }: { data: MyOverview }) {
  const assignments = useMyAssignments()
  const { timeZone, nextSession: next, attendance: a } = data
  const due = (assignments.data?.assignments ?? []).filter((x) => x.status === 'not_submitted' || x.status === 'overdue')
  const nextDue = [...due].sort((x, y) => Date.parse(x.dueAt) - Date.parse(y.dueAt))[0]
  return (
    <Metrics
      items={[
        {
          label: 'Next session',
          icon: <CalendarIcon size={18} />,
          value: next ? formatTime(next.startsAt, timeZone) : '—',
          context: next ? `${relativeDay(next.startsAt, timeZone)} · ${next.course.name} · ${sessionWhere(next)}` : 'Nothing scheduled yet',
        },
        {
          label: 'Your attendance',
          icon: <CalendarIcon size={18} />,
          value: a.recorded ? `${a.present} of ${a.recorded}` : '—',
          context: a.recorded ? `Sessions attended so far · ${a.rate}%` : 'Shows after your first session',
        },
        {
          label: 'Assignments due',
          icon: <ClipboardIcon size={18} />,
          value: assignments.isPending ? '…' : due.length,
          context: nextDue
            ? `Next: ${nextDue.title} · ${formatDay(nextDue.dueAt, timeZone)}`
            : assignments.isError
              ? 'Couldn’t load assignments'
              : 'Nothing to hand in',
        },
        {
          label: 'Programme progress',
          icon: <BookOpenIcon size={18} />,
          value: data.progress.total ? `${data.progress.held} of ${data.progress.total}` : '—',
          context: `Sessions delivered in ${data.enrolment!.cohort.name}`,
        },
      ]}
    />
  )
}

function AssignmentsPanel({ timeZone }: { timeZone: string }) {
  const query = useMyAssignments()
  const todo = (a: MyAssignment) => a.status === 'not_submitted' || a.status === 'overdue'
  const list = [...(query.data?.assignments ?? [])]
    .sort((x, y) => (todo(x) === todo(y) ? (todo(x) ? 1 : -1) * (Date.parse(x.dueAt) - Date.parse(y.dueAt)) : todo(x) ? -1 : 1))
    .slice(0, 4)
  return (
    <Panel aria-labelledby="dash-assignments" className="gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <PanelHeader id="dash-assignments" title="Assignments" description="What’s due and where each submission stands." />
        </div>
        <Link to="/participant/assignments" className={linkClass}>
          All assignments
          <ChevronRightIcon size={14} />
        </Link>
      </div>
      {query.isError ? (
        <StatePanel kind="error" title="Couldn’t load assignments" action={{ label: 'Try again', onClick: () => void query.refetch() }} />
      ) : query.isPending ? (
        <div aria-busy="true" className="h-24" />
      ) : list.length === 0 ? (
        <p className="py-4 text-body text-secondary">No assignments yet. Work your trainers set shows here.</p>
      ) : (
        <>
          <div className="max-md:hidden">
            <Table columns={columns}>
              {list.map((a) => (
                <Row key={a.id} to={`/participant/assignments/${a.id}`}>
                  <Cell>
                    <Stacked primary={a.title} secondary={a.course.name} />
                  </Cell>
                  <Cell>
                    <Stacked
                      primary={formatDue(a.dueAt, timeZone)}
                      secondary={todo(a) && a.status !== 'overdue' ? dueIn(a.dueAt, timeZone) : a.status === 'overdue' ? 'Late work accepted' : 'Closed'}
                    />
                  </Cell>
                  <Cell>
                    <MyStatusBadge status={a.status} />
                  </Cell>
                  <Cell align="right">{a.grade ?? <span className="text-muted">—</span>}</Cell>
                  <Cell align="right">
                    <Link to={`/participant/assignments/${a.id}`} onClick={(ev) => ev.stopPropagation()} className={linkClass}>
                      {todo(a) ? 'Submit' : 'View'}
                      <ChevronRightIcon size={14} />
                    </Link>
                  </Cell>
                </Row>
              ))}
            </Table>
          </div>
          <ul className="md:hidden">
            {list.map((a) => (
              <li key={a.id} className="border-b border-default last:border-b-0">
                <Link to={`/participant/assignments/${a.id}`} className="flex items-center gap-3 py-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{a.title}</span>
                    <span className="truncate text-caption text-secondary">Due {formatDue(a.dueAt, timeZone)}</span>
                  </span>
                  <MyStatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

function dueIn(at: string, timeZone: string) {
  const days = daysUntil(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at)), timeZone)
  return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
}

function FeedbackPanel({ timeZone }: { timeZone: string }) {
  const query = useMyGrades()
  const recent = (query.data?.grades ?? []).filter((g) => g.grade && g.feedback).slice(0, 2)
  if (query.isPending || (query.isSuccess && recent.length === 0)) return null
  return (
    <Panel aria-labelledby="dash-feedback" className="gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <PanelHeader id="dash-feedback" title="Recent feedback" description="From your trainers on graded work." />
        </div>
        <Link to="/participant/grades" className={linkClass}>
          Grades & feedback
          <ChevronRightIcon size={14} />
        </Link>
      </div>
      {query.isError ? (
        <StatePanel kind="error" title="Couldn’t load your feedback" action={{ label: 'Try again', onClick: () => void query.refetch() }} />
      ) : (
        <ul>
          {recent.map((g) => (
            <li key={g.id} className="border-b border-default last:border-b-0">
              <Link to={`/participant/grades/${g.id}`} className="flex gap-3 py-3 hover:bg-surface-hover">
                <Avatar initials={initials(g.gradedBy ?? g.trainer ?? '?')} seed={g.gradedBy ?? g.id} size={32} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-body-strong text-primary">{g.title}</span>
                    <span className="shrink-0 text-body-strong text-primary tabular-nums">{g.grade}</span>
                  </span>
                  <span className="line-clamp-2 text-body text-primary">{g.feedback}</span>
                  <span className="text-caption text-secondary">
                    {[g.gradedBy, g.gradedAt && `graded ${formatDay(g.gradedAt, timeZone)}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function UpcomingPanel({ sessions, timeZone }: { sessions: MySession[]; timeZone: string }) {
  const days = new Map<string, MySession[]>()
  for (const s of sessions) {
    const key = relativeDay(s.startsAt, timeZone) === 'Today' ? `Today · ${formatDay(s.startsAt, timeZone)}` : formatDay(s.startsAt, timeZone)
    days.set(key, [...(days.get(key) ?? []), s])
  }
  return (
    <Panel aria-labelledby="dash-upcoming" className="gap-3">
      <div className="flex items-start gap-3">
        <h2 id="dash-upcoming" className="flex-1 text-heading-section text-primary">
          Upcoming sessions
        </h2>
        <Link to="/participant/sessions" className={linkClass}>
          All sessions
          <ChevronRightIcon size={14} />
        </Link>
      </div>
      {sessions.length === 0 ? (
        <p className="text-body text-secondary">Nothing scheduled yet.</p>
      ) : (
        [...days].map(([label, list]) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="text-caption text-secondary">{label}</span>
            {list.map((s) => (
              <Link key={s.id} to={`/participant/sessions/${s.id}`} className="flex gap-3 border-b border-default pb-3 last:border-b-0 hover:bg-surface-hover">
                <span className="flex w-12 shrink-0 flex-col tabular-nums">
                  <span className="text-body-strong text-primary">{formatTime(s.startsAt, timeZone)}</span>
                  <span className="text-caption whitespace-nowrap text-secondary">{lengthOf(s.startsAt, s.endsAt)}</span>
                </span>
                <span className={`flex min-w-0 flex-1 flex-col gap-0.5 border-l-[3px] pl-3 ${s.mode === 'online' ? 'border-brand' : 'border-success'}`}>
                  <span className="truncate text-body-strong text-primary">{s.course.name}</span>
                  {s.trainer && <span className="truncate text-caption text-secondary">{s.trainer}</span>}
                  <span className="flex min-w-0 items-center gap-1 text-caption text-secondary">
                    {s.mode === 'online' ? <Video aria-hidden className="size-3.5 shrink-0" /> : <MapPin aria-hidden className="size-3.5 shrink-0" />}
                    <span className="truncate">{sessionWhere(s)}</span>
                  </span>
                </span>
                {s.status === 'in_progress' && <SessionBadge session={s} />}
              </Link>
            ))}
          </div>
        ))
      )}
    </Panel>
  )
}

function AttendancePanel({ data }: { data: MyOverview }) {
  const { attendance: a, recentAttendance: recent, timeZone } = data
  return (
    <Panel aria-labelledby="dash-attendance" className="gap-2">
      <PanelHeader
        id="dash-attendance"
        title="My attendance"
        description={
          a.recorded
            ? `${a.present} of ${plural(a.recorded, 'session')} attended. Excused absences count as not attended.`
            : 'Your attendance shows here after your first session.'
        }
      />
      {recent.length > 0 && (
        <ul>
          {recent.map((s) => (
            <li key={s.id} className="border-b border-default last:border-b-0">
              <Link to={`/participant/sessions/${s.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-hover">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-strong text-primary">{s.course.name}</span>
                  <span className="text-caption text-secondary">{formatDay(s.startsAt, timeZone)}</span>
                </span>
                <SessionBadge session={s} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {a.recorded > recent.length && (
        <p className="text-caption text-secondary">
          Showing the last {recent.length} of {plural(a.recorded, 'session')}.
        </p>
      )}
    </Panel>
  )
}
