import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock, Percent as PercentIcon, Users } from 'lucide-react'
import { CardGrid, ItemCard, LayoutSwitch } from '@/components/collection/Collection'
import { GRID_PANEL, useLayout } from '@/components/collection/layout'
import { CourseResourcesPanel } from '@/components/resources/CourseResourcesPanel'
import { Link, Outlet, useNavigate, useOutletContext, useParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { CalendarIcon, ChartIcon, ChevronRightIcon, InfoTriangleIcon, UserGroupIcon } from '@/components/ui/icons'
import { Metrics } from '@/components/ui/Metrics'
import { Badge, EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Percent } from '@/components/ui/Percent'
import { Cell, Row, Stacked, Table, type Column } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { api } from '@/lib/api'
import { formatDateRange, formatDay, formatTime, plural, relativeDay } from '@/lib/format'
import { initials } from '@/lib/people'
import { describeFlag, followUpLine, ruleLabel, signalOf, useAttention, type Rule } from '@/pages/admin/attention/data'
import { CohortSessionsList } from '@/pages/admin/sessions/CohortSessionsList'
import { UpcomingSessions } from '@/pages/admin/sessions/UpcomingSessions'
import { useMyCohort, useMyCohorts, type MyCohortDetail } from './data'

const statusBadge: Record<string, { tone: 'success' | 'info' | 'neutral'; label: string }> = {
  active: { tone: 'success', label: 'Active' },
  upcoming: { tone: 'info', label: 'Upcoming' },
  completed: { tone: 'neutral', label: 'Completed' },
  draft: { tone: 'neutral', label: 'Draft' },
  archived: { tone: 'neutral', label: 'Archived' },
}

const columns: Column[] = [
  { label: 'Cohort' },
  { label: 'Your course', width: 240 },
  { label: 'Participants', width: 110, align: 'right', hideBelow: 'lg' },
  { label: 'Attendance', width: 110, align: 'right' },
  { label: 'Next session', width: 150, hideBelow: 'xl' },
  { label: 'Status', width: 110, hideBelow: 'lg' },
  { label: '', width: 72, align: 'right' },
]

/** /trainer/cohorts — T3.04 My cohorts. */
export function MyCohortsPage() {
  const query = useMyCohorts()
  const timeZone = query.data?.timeZone
  const rows = query.data?.cohorts ?? []
  const delivery = (r: (typeof rows)[number]) =>
    `${r.course.lead ? 'Lead' : 'Assistant'} · ${r.course.planned ? `${r.course.held} of ${r.course.planned} held` : plural(r.course.held, 'session') + ' held'}${r.status === 'completed' ? ' · finished' : ''}`
  const next = (at: string | null) => (at ? `${relativeDay(at, timeZone)}, ${formatTime(at, timeZone)}` : '—')
  const [layout, setLayout] = useLayout('trainer-cohorts')

  return (
    <>
      <PageHeader
        title="My cohorts"
        description="Cohorts where you teach at least one course."
        actions={
          rows.length > 0 ? (
            // Phones stretch header actions; keep the switch its own size, on the right.
            <div className="flex items-center justify-end">
              <LayoutSwitch value={layout} onChange={setLayout} />
            </div>
          ) : undefined
        }
      />
      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Loading cohorts" className="h-[200px]">
          <span className="sr-only">Loading cohorts</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load your cohorts"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<CalendarIcon size={24} />}
            title="You’re not teaching in a cohort yet"
            body="When an admin adds you to a course in a cohort, it shows here with its sessions and participants."
          />
        </Panel>
      ) : (
        <>
          {layout === 'grid' ? (
            <Panel className={GRID_PANEL}>
              <CardGrid label="My cohorts">
                {rows.map((r) => (
                  <ItemCard
                    key={`${r.id}-${r.course.name}`}
                    to={r.id}
                    title={r.name}
                    description={`${r.course.name} · ${r.programme}`}
                    badge={
                      <>
                        <Badge tone={statusBadge[r.status]?.tone ?? 'neutral'}>{statusBadge[r.status]?.label ?? r.status}</Badge>
                        <Badge tone="neutral">{r.course.lead ? 'Lead' : 'Assistant'}</Badge>
                      </>
                    }
                    progress={{
                      label: 'Sessions delivered',
                      value: r.course.planned ? Math.round((r.course.held / r.course.planned) * 100) : null,
                      text: r.course.planned ? `${r.course.held} of ${r.course.planned}` : `${r.course.held} held`,
                    }}
                    meta={[
                      {
                        icon: <Users />,
                        text: r.participants,
                        label: 'Participants',
                      },
                      {
                        icon: <PercentIcon />,
                        text: r.attendance === null ? '—' : `${r.attendance}%`,
                        label: 'Attendance',
                      },
                      r.nextSessionAt
                        ? {
                            icon: <Clock />,
                            text: next(r.nextSessionAt),
                            label: 'Next session',
                          }
                        : {
                            icon: <CalendarDays />,
                            text: formatDateRange(r.startsOn, r.endsOn),
                            label: 'Dates',
                          },
                    ]}
                  />
                ))}
              </CardGrid>
            </Panel>
          ) : (
            <Panel className="gap-0 max-md:py-2">
              <div className="max-md:hidden">
                <Table columns={columns}>
                  {rows.map((r) => (
                    <Row key={`${r.id}-${r.course.name}`} to={r.id}>
                      <Cell>
                        <Stacked primary={r.name} secondary={r.programme} />
                      </Cell>
                      <Cell>
                        <Stacked primary={r.course.name} secondary={delivery(r)} />
                      </Cell>
                      <Cell align="right" hideBelow="lg" className="tabular-nums">
                        {r.participants}
                      </Cell>
                      <Cell align="right">
                        <Percent value={r.attendance} />
                      </Cell>
                      <Cell hideBelow="xl">{next(r.nextSessionAt)}</Cell>
                      <Cell hideBelow="lg">
                        <Badge tone={statusBadge[r.status]?.tone ?? 'neutral'}>{statusBadge[r.status]?.label ?? r.status}</Badge>
                      </Cell>
                      <Cell align="right">
                        <Link to={r.id} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-caption-strong text-brand-text">
                          Open
                          <ChevronRightIcon size={14} />
                        </Link>
                      </Cell>
                    </Row>
                  ))}
                </Table>
              </div>
              <ul className="md:hidden">
                {rows.map((r) => (
                  <li key={`${r.id}-${r.course.name}`} className="border-b border-default last:border-b-0">
                    <Link to={r.id} className="flex items-center gap-3 py-3">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-body-strong text-primary">{r.name}</span>
                        <span className="truncate text-caption text-secondary">
                          {r.course.name} · {delivery(r)}
                        </span>
                        <span className="text-caption text-secondary">Next: {next(r.nextSessionAt)}</span>
                      </span>
                      <Badge tone={statusBadge[r.status]?.tone ?? 'neutral'}>{statusBadge[r.status]?.label ?? r.status}</Badge>
                      <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <p className="text-caption text-secondary">You only see cohorts you’re assigned to. Ask an admin to add you to another.</p>
        </>
      )}
    </>
  )
}

type Context = { data: MyCohortDetail }

/** /trainer/cohorts/:id — T3.05 Cohort detail, with Overview | Participants | Sessions | Courses. */
export function MyCohortLayout() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { state } = useAuth()
  const assistant = state.status === 'signed-in' && state.me.membership.role === 'assistant_trainer'
  const query = useMyCohort(id)
  if (query.isPending) return <div aria-busy="true" aria-label="Loading cohort" className="h-40" />
  if (query.isError) {
    const missing = (query.error as { status?: number }).status === 404
    return (
      <>
        <PageHeader title={missing ? 'Not your cohort' : 'Couldn’t load this cohort'} breadcrumb={[{ label: 'My cohorts', to: '/trainer/cohorts' }]} />
        <Panel className="mx-auto w-full max-w-[400px]">
          {missing ? (
            <StatePanel
              kind="restricted"
              title="You’re not assigned to this cohort"
              description="It’s taught by another trainer, so its participants and grades aren’t visible to you. Ask a programme admin if you should have access."
              action={{
                label: 'Back to my cohorts',
                onClick: () => navigate('/trainer/cohorts'),
              }}
            />
          ) : (
            <StatePanel
              kind="error"
              title="Something went wrong"
              description="Check your connection and try again."
              action={{
                label: 'Try again',
                onClick: () => void query.refetch(),
              }}
            />
          )}
        </Panel>
      </>
    )
  }
  const { cohort, courses } = query.data
  const open = ['active', 'upcoming'].includes(cohort.status)
  const canSchedule = open && !assistant && courses.some((c) => c.mine)
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'My cohorts', to: '/trainer/cohorts' }, { label: cohort.name }]}
        title={cohort.name}
        badge={<Badge tone={statusBadge[cohort.status]?.tone ?? 'neutral'}>{statusBadge[cohort.status]?.label ?? cohort.status}</Badge>}
        description={[cohort.programme.name, formatDateRange(cohort.startsOn, cohort.endsOn), cohort.usualLocation].filter(Boolean).join(' · ')}
        actions={
          canSchedule && (
            <Button icon={<CalendarIcon size={16} />} onClick={() => navigate(`/trainer/sessions/new?cohort=${cohort.id}`)}>
              Schedule session
            </Button>
          )
        }
      />
      <Tabs
        label="Cohort"
        items={[
          { label: 'Overview', to: `/trainer/cohorts/${cohort.id}`, end: true },
          {
            label: 'Participants',
            to: `/trainer/cohorts/${cohort.id}/participants`,
            count: cohort.participants,
          },
          { label: 'Sessions', to: `/trainer/cohorts/${cohort.id}/sessions` },
          {
            label: 'Courses',
            to: `/trainer/cohorts/${cohort.id}/courses`,
            count: courses.length,
          },
        ]}
      />
      <Outlet context={{ data: query.data } satisfies Context} />
    </>
  )
}

const signalTone = {
  attendance: 'warning',
  assignments: 'warning',
  activity: 'neutral',
} as const
const signalName = {
  attendance: 'Attendance',
  assignments: 'Assignments',
  activity: 'Activity',
} as const

/** T3.05 Overview. */
export function MyCohortOverview() {
  const { data } = useOutletContext<Context>()
  const { cohort, courses, flagged, timeZone } = data
  const attention = useAttention()
  const rows = (attention.data?.participants ?? []).filter((r) => r.cohort.id === cohort.id)
  const trainers = [
    ...new Map(
      courses.flatMap((c) =>
        c.trainers.map((t) => [
          t.id,
          {
            ...t,
            courses: courses.filter((x) => x.trainers.some((y) => y.id === t.id)).map((x) => x.name),
          },
        ]),
      ),
    ).values(),
  ]

  return (
    <>
      <Metrics
        items={[
          {
            label: 'Participants',
            icon: <UserGroupIcon size={18} />,
            value: cohort.participants,
            context: 'Enrolled in this cohort',
          },
          {
            label: 'Delivery',
            icon: <CalendarIcon size={18} />,
            value: cohort.plannedSessions ? `${cohort.heldSessions} of ${cohort.plannedSessions}` : cohort.heldSessions,
            context: 'Sessions held so far',
          },
          {
            label: 'Attendance, last 4 weeks',
            icon: <ChartIcon size={18} />,
            value: cohort.attendance4w === null ? '—' : `${cohort.attendance4w}%`,
            context:
              cohort.attendance4w === null
                ? 'Nothing recorded yet'
                : `Present ÷ recorded${cohort.attendanceAll !== null ? ` · ${cohort.attendanceAll}% overall` : ''}`,
          },
          {
            label: 'Needs attention',
            icon: <InfoTriangleIcon size={18} />,
            value: flagged ?? '—',
            tone: flagged ? ('warning' as const) : undefined,
            context: flagged === null ? 'Only admins see flags' : 'Participants in this cohort',
          },
        ]}
      />
      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          {flagged !== null && (
            <Panel className="gap-0">
              <div className="flex items-start justify-between gap-3">
                <PanelHeader title="Needs attention" description="Participants in this cohort who match a follow-up rule." />
                {rows.length > 3 && (
                  <Link to="participants" className="inline-flex h-7 shrink-0 items-center gap-1 text-caption-strong text-brand-text hover:underline">
                    View all {rows.length}
                    <ChevronRightIcon size={14} />
                  </Link>
                )}
              </div>
              {attention.isPending ? (
                <div className="h-20" />
              ) : rows.length === 0 ? (
                <p className="py-3 text-body text-secondary">No one in this cohort needs attention right now.</p>
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
                            <span className="text-body-strong text-primary">{r.participant.name}</span>
                            <span className="text-body text-primary">{d.title}</span>
                            <span className="text-caption text-secondary">{d.detail}</span>
                            <span className="text-caption text-secondary">{followUpLine(r.lastIntervention, timeZone)}</span>
                          </span>
                          <Badge tone={signalTone[signal]}>{signalName[signal]}</Badge>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          )}
          <UpcomingSessions cohort={cohort} />
        </div>
        <div className="flex w-[356px] shrink-0 flex-col gap-4 max-lg:w-full">
          <Panel className="gap-0">
            <PanelHeader title="Trainers" />
            <ul className="mt-1">
              {trainers.map((t) => (
                <li key={t.id} className="flex items-center gap-3 border-b border-default py-3 last:border-b-0">
                  <Avatar size={32} initials={initials(t.name)} seed={t.id} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{t.name}</span>
                    <span className="truncate text-caption text-secondary">{t.courses.join(' · ')}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="gap-0">
            <PanelHeader title="Courses" description="Sessions held in this cohort." />
            <ul className="mt-1">
              {courses.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-default py-3 last:border-b-0">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{c.name}</span>
                    <span className="text-caption text-secondary">{courseLine(c, timeZone)}</span>
                  </span>
                  <span className="text-body-strong text-primary tabular-nums">
                    {c.plannedSessions ? `${Math.round((c.heldSessions / c.plannedSessions) * 100)}%` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}

const courseLine = (c: MyCohortDetail['courses'][number], timeZone: string) =>
  c.heldSessions === 0 && c.firstSessionAt
    ? `Starts ${formatDay(c.firstSessionAt, timeZone)}`
    : c.plannedSessions
      ? `${c.heldSessions} of ${c.plannedSessions} sessions held`
      : `${plural(c.heldSessions, 'session')} held`

interface ParticipantRow {
  id: string
  name: string
  cohort: { id: string; name: string }
  attendance: { present: number; recorded: number; rate: number } | null
  work: { submitted: number; published: number }
  flag: Rule | null
  lastActive: string | null
}

const participantColumns: Column[] = [
  { label: 'Participant' },
  { label: 'Attendance', width: 110, align: 'right' },
  { label: 'Submitted', width: 110, align: 'right', hideBelow: 'lg' },
  { label: 'Flag', width: 150 },
  { label: 'Last active', width: 130, hideBelow: 'xl' },
]

/** T3.05 Participants: from your courses only. */
export function MyCohortParticipants() {
  const { data } = useOutletContext<Context>()
  const query = useQuery({
    queryKey: ['trainer', 'participants'],
    queryFn: ({ signal }) => api<{ timeZone: string; participants: ParticipantRow[] }>('/v1/trainer/participants', { signal }),
  })
  const rows = (query.data?.participants ?? []).filter((r) => r.cohort.id === data.cohort.id)
  return (
    <Panel className="gap-0 max-md:py-2">
      <PanelHeader title="Participants" description="Attendance and work are from your courses only." />
      {query.isPending ? (
        <div className="h-24" />
      ) : rows.length === 0 ? (
        <p className="py-4 text-body text-secondary">No one is enrolled yet.</p>
      ) : (
        <>
          <div className="mt-2 max-md:hidden">
            <Table columns={participantColumns}>
              {rows.map((r) => (
                <Row key={r.id} to={`/trainer/participants/${r.id}`}>
                  <Cell>
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar initials={initials(r.name)} seed={r.id} />
                      <span className="truncate text-body-strong text-primary">{r.name}</span>
                    </span>
                  </Cell>
                  <Cell align="right">
                    <Percent value={r.attendance?.rate} />
                  </Cell>
                  <Cell align="right" hideBelow="lg" className="tabular-nums">
                    {r.work.submitted} of {r.work.published}
                  </Cell>
                  <Cell>{r.flag ? <Badge tone="warning">{ruleLabel[r.flag]}</Badge> : <span className="text-muted">—</span>}</Cell>
                  <Cell hideBelow="xl">{r.lastActive ? relativeDay(r.lastActive, query.data?.timeZone) : <span className="text-muted">Not yet</span>}</Cell>
                </Row>
              ))}
            </Table>
          </div>
          <ul className="md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="border-b border-default last:border-b-0">
                <Link to={`/trainer/participants/${r.id}`} className="flex items-center gap-3 py-3">
                  <Avatar size={32} initials={initials(r.name)} seed={r.id} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{r.name}</span>
                    <span className="text-caption text-secondary">
                      {r.attendance ? `${r.attendance.rate}% attendance` : 'No attendance yet'} · {r.work.submitted} of {r.work.published} submitted
                    </span>
                  </span>
                  {r.flag && <Badge tone="warning">{ruleLabel[r.flag]}</Badge>}
                  <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

/** T3.05 Sessions: your courses’ sessions in this cohort. */
export function MyCohortSessions() {
  const { data } = useOutletContext<Context>()
  return <CohortSessionsList cohort={data.cohort} />
}

const courseColumns: Column[] = [
  { label: 'Course' },
  { label: 'Trainers', hideBelow: 'lg' },
  { label: 'Sessions', width: 140 },
  { label: 'First session', width: 140, hideBelow: 'xl' },
]

/** T3.05 Courses. */
export function MyCohortCourses() {
  const { data } = useOutletContext<Context>()
  const mine = data.courses.filter((c) => c.mine)
  return (
    <div className="flex flex-col gap-4">
      <Panel className="gap-0 max-md:py-2">
        <PanelHeader title="Courses" description="Every course this cohort runs. You can schedule and take registers for yours." />
        <div className="mt-2">
          <Table columns={courseColumns}>
            {data.courses.map((c) => (
              <Row key={c.id}>
                <Cell>
                  <span className="flex items-center gap-2">
                    <span className="text-body-strong text-primary">{c.name}</span>
                    {c.mine && <Badge tone="info">Yours</Badge>}
                  </span>
                </Cell>
                <Cell hideBelow="lg" className="truncate">
                  {c.trainers.map((t) => `${t.name}${t.isLead ? ' (lead)' : ''}`).join(', ') || <span className="text-muted">None yet</span>}
                </Cell>
                <Cell className="tabular-nums">{c.plannedSessions ? `${c.heldSessions} of ${c.plannedSessions} held` : `${c.heldSessions} held`}</Cell>
                <Cell hideBelow="xl">{c.firstSessionAt ? formatDay(c.firstSessionAt, data.timeZone) : <span className="text-muted">—</span>}</Cell>
              </Row>
            ))}
          </Table>
        </div>
      </Panel>
      {mine.map((c) => (
        <CourseResourcesPanel key={c.id} cohortCourseId={c.id} courseName={c.name} cohortName={data.cohort.name} />
      ))}
    </div>
  )
}
