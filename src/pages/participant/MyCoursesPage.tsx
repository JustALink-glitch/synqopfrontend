import { CalendarClock, ClipboardCheck, UserRound } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { CardGrid, ItemCard, LayoutSwitch } from '@/components/collection/Collection'
import { GRID_PANEL, useLayout } from '@/components/collection/layout'
import { StatePanel } from '@/components/StatePanel'
import { Avatar } from '@/components/ui/Avatar'
import { BookOpenIcon, ChevronRightIcon } from '@/components/ui/icons'
import { Badge, EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Stacked, Table, type Column } from '@/components/ui/Table'
import { formatDay, formatTime, plural, relativeDay } from '@/lib/format'
import { initials } from '@/lib/people'
import { formatDue } from '@/pages/assignments/data'
import { myStatusLabel, useMyAssignments, useMyCourse, useMyCourses, type MyAttendance, type MySession } from './data'
import { ResourceRow, SessionBadge } from './SessionBits'

const BASE = '/participant/courses'

const columns: Column[] = [
  { label: 'Course' },
  { label: 'Sessions attended', width: 170 },
  { label: 'Work submitted', width: 130, hideBelow: 'lg' },
  { label: 'Next session', width: 160 },
  { label: '', width: 72, align: 'right' },
]

const attended = (a: MyAttendance) => (a.recorded ? `${a.present} of ${a.recorded}${a.excused ? ` · ${a.excused} excused` : ''}` : null)
const nextLabel = (s: MySession | null, timeZone?: string) => (s ? `${relativeDay(s.startsAt, timeZone)}, ${formatTime(s.startsAt, timeZone)}` : null)

/** /participant/courses — P3.01 My courses. */
export function MyCoursesPage() {
  const query = useMyCourses()
  const courses = query.data?.courses ?? []
  const timeZone = query.data?.timeZone
  const first = courses[0]
  const [layout, setLayout] = useLayout('my-courses')
  return (
    <>
      <PageHeader
        title="My courses"
        description={first ? `${first.cohort.name} · ${first.programme}` : undefined}
        actions={
          courses.length > 0 ? (
            // Phones stretch header actions; keep the switch its own size, on the right.
            <div className="flex items-center justify-end">
              <LayoutSwitch value={layout} onChange={setLayout} />
            </div>
          ) : undefined
        }
      />
      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Loading courses" className="h-[200px]">
          <span className="sr-only">Loading courses</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load your courses"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : courses.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<BookOpenIcon size={24} />}
            title="No courses yet"
            body="When you’re in a cohort, its courses appear here with your attendance and work."
          />
        </Panel>
      ) : layout === 'grid' ? (
        <Panel className={GRID_PANEL}>
          <CardGrid label="My courses">
            {courses.map((c) => (
              <ItemCard
                key={c.id}
                to={c.id}
                title={c.name}
                description={[c.where === 'online' ? 'Online' : c.where, c.cohort.name].filter(Boolean).join(' · ')}
                progress={{
                  label: 'Sessions attended',
                  value: c.attendance.recorded ? Math.round((c.attendance.present / c.attendance.recorded) * 100) : null,
                  text: c.attendance.recorded ? `${c.attendance.present} of ${c.attendance.recorded}` : 'None yet',
                }}
                meta={[
                  ...(c.trainer
                    ? [
                        {
                          icon: <UserRound />,
                          text: c.trainer,
                          label: 'Trainer',
                        },
                      ]
                    : []),
                  ...(c.work
                    ? [
                        {
                          icon: <ClipboardCheck />,
                          text: `${c.work.submitted} of ${c.work.published} handed in`,
                        },
                      ]
                    : []),
                  {
                    icon: <CalendarClock />,
                    text: nextLabel(c.nextSession, timeZone) ?? 'No session scheduled',
                    label: 'Next session',
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
              {courses.map((c) => (
                <Row key={c.id} to={c.id}>
                  <Cell>
                    <Stacked primary={c.name} secondary={[c.trainer, c.where].filter(Boolean).join(' · ') || undefined} />
                  </Cell>
                  <Cell className="tabular-nums">{attended(c.attendance) ?? <span className="text-muted">—</span>}</Cell>
                  <Cell hideBelow="lg" className="tabular-nums">
                    {c.work ? `${c.work.submitted} of ${c.work.published}` : <span className="text-muted">—</span>}
                  </Cell>
                  <Cell>{nextLabel(c.nextSession, timeZone) ?? <span className="text-muted">None scheduled</span>}</Cell>
                  <Cell align="right">
                    <Link
                      to={c.id}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline"
                    >
                      Open
                      <ChevronRightIcon size={14} />
                    </Link>
                  </Cell>
                </Row>
              ))}
            </Table>
          </div>
          <ul className="md:hidden">
            {courses.map((c) => (
              <li key={c.id} className="border-b border-default last:border-b-0">
                <Link to={c.id} className="flex items-center gap-3 py-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{c.name}</span>
                    <span className="truncate text-caption text-secondary">
                      {[
                        attended(c.attendance) && `Attended ${attended(c.attendance)}`,
                        nextLabel(c.nextSession, timeZone) && `Next ${nextLabel(c.nextSession, timeZone)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ') || c.trainer}
                    </span>
                  </span>
                  <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}

/** /participant/courses/:id — P3.02 Course detail. */
export function CoursePage() {
  const { id = '' } = useParams()
  const query = useMyCourse(id)
  const assignments = useMyAssignments()
  if (query.isPending) return <div aria-busy="true" aria-label="Loading course" className="h-40" />
  if (query.isError) {
    const notFound = (query.error as { status?: number }).status === 404
    return (
      <>
        <PageHeader title={notFound ? 'Course not found' : 'Couldn’t load the course'} breadcrumb={[{ label: 'My courses', to: BASE }]} />
        <Panel>
          <StatePanel
            kind={notFound ? 'no-results' : 'error'}
            title={notFound ? 'It isn’t one of your courses.' : 'Something went wrong'}
            description="Go back to My courses."
          />
        </Panel>
      </>
    )
  }
  const { course, sessions, resources, timeZone } = query.data
  const live = sessions.filter((s) => s.status !== 'cancelled')
  const total = live[0]?.total ?? live.length
  const where = [...new Set(live.map((s) => (s.mode === 'online' ? 'Online' : (s.location ?? 'In person'))))].slice(0, 2).join(' · ')
  const work = (assignments.data?.assignments ?? []).filter((a) => a.course.id === sessions[0]?.course.id && a.cohort.id === course.cohort.id)

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'My courses', to: BASE }, { label: course.name }]}
        title={course.name}
        description={[course.trainer?.name, total ? plural(total, 'session') : null, where || null].filter(Boolean).join(' · ')}
      />
      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          <Panel aria-labelledby="course-sessions" className="gap-2">
            <PanelHeader id="course-sessions" title="Sessions" description="Your attendance for each session." />
            {sessions.length === 0 ? (
              <p className="py-4 text-body text-secondary">No sessions scheduled yet.</p>
            ) : (
              <ul>
                {sessions.map((s) => (
                  <li key={s.id} className="border-b border-default last:border-b-0">
                    <Link to={`/participant/sessions/${s.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-hover">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body-strong text-primary">{s.number ? `Session ${s.number}` : 'Cancelled session'}</span>
                        <span className="text-caption text-secondary">
                          {s.status === 'in_progress' || relativeDay(s.startsAt, timeZone) === 'Today'
                            ? `Today, ${formatTime(s.startsAt, timeZone)}`
                            : formatDay(s.startsAt, timeZone)}
                        </span>
                      </span>
                      <SessionBadge session={s} />
                      <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {work.length > 0 && (
            <Panel aria-labelledby="course-work" className="gap-2">
              <PanelHeader id="course-work" title="Assignments" />
              <ul>
                {work.map((a) => {
                  const todo = a.status === 'not_submitted' || a.status === 'overdue'
                  return (
                    <li key={a.id} className="border-b border-default last:border-b-0">
                      <Link to={`/participant/assignments/${a.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-hover">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-body-strong text-primary">{a.title}</span>
                          <span className="truncate text-caption text-secondary">
                            {a.status === 'graded' ? `Graded · ${a.grade}` : `Due ${formatDue(a.dueAt, timeZone)} · ${a.scaleLabel}`}
                          </span>
                        </span>
                        <Badge tone={todo ? (a.status === 'overdue' ? 'error' : 'warning') : a.status === 'graded' ? 'success' : 'info'}>
                          {todo ? (a.status === 'overdue' ? 'Overdue' : 'To do') : myStatusLabel[a.status]}
                        </Badge>
                        <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}
        </div>
        <aside className="flex w-[356px] shrink-0 flex-col gap-4 max-lg:w-full">
          {course.trainer && (
            <Panel aria-labelledby="course-trainer" className="gap-3">
              <PanelHeader id="course-trainer" title="Your trainer" />
              <div className="flex items-start gap-3">
                <Avatar initials={initials(course.trainer.name)} seed={course.trainer.id} size={32} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body-strong text-primary">{course.trainer.name}</span>
                  {course.trainer.bio && <span className="line-clamp-2 text-caption text-secondary">{course.trainer.bio}</span>}
                </span>
              </div>
            </Panel>
          )}
          {resources.length > 0 && (
            <Panel aria-labelledby="course-resources" className="gap-1">
              <PanelHeader id="course-resources" title="Resources" />
              <div>
                {resources.map((r) => (
                  <ResourceRow key={r.id} resource={r} />
                ))}
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </>
  )
}
