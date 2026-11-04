import { Eye } from 'lucide-react'
import clsx from 'clsx'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ChevronRightIcon, DownloadIcon, PencilIcon, PlusIcon } from '@/components/ui/icons'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Table } from '@/components/ui/Table'
import { openFile, fileKind, fileSize, viewKind } from '@/lib/files'
import { formatDay, formatTimeRange, plural } from '@/lib/format'
import { initials } from '@/lib/people'
import { SessionStatusBadge } from '@/pages/admin/sessions/SessionRow'
import type { SessionStatus } from '@/pages/admin/sessions/data'
import { AddCourseResourceDialog } from './AddCourseResourceDialog'
import { CohortStatusBadge } from './badges'
import { useCourseDetail, useRemoveCourseResource, useRestoreCourse, type CourseDetail, type CourseResource } from './data'
import type { CohortStatus } from './data'

type Tab = 'overview' | 'cohorts' | 'sessions' | 'assignments' | 'resources'

const scaleLabel = (scale: string, max: number | null) =>
  ({ points: `Points / ${max ?? 100}`, percentage: 'Percentage', letter: 'Letter grade', pass_fail: 'Pass / fail', rubric: 'Rubric' })[scale] ?? scale

/** /admin/courses/library/:id — A2.02 Course detail. */
export function CourseDetailPage() {
  const { id = '' } = useParams()
  const query = useCourseDetail(id)
  if (query.isPending) return <div aria-busy="true" aria-label="Loading course" className="h-40" />
  if (query.isError) {
    const missing = (query.error as { status?: number }).status === 404
    return (
      <>
        <PageHeader
          title={missing ? 'Course not found' : 'Couldn’t load the course'}
          breadcrumb={[
            { label: 'Courses & sessions', to: '/admin/courses' },
            { label: 'Courses', to: '/admin/courses/library' },
          ]}
        />
        <Panel>
          <StatePanel
            kind={missing ? 'no-results' : 'error'}
            title={missing ? 'This course doesn’t exist' : 'Something went wrong'}
            description={missing ? 'It may have been removed. Go back to Courses.' : 'Check your connection and try again.'}
            action={missing ? undefined : { label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      </>
    )
  }
  return <CourseView data={query.data} />
}

function CourseView({ data }: { data: CourseDetail }) {
  const { course: c } = data
  const navigate = useNavigate()
  const location = useLocation()
  const restore = useRestoreCourse(c.id)
  const [tab, setTab] = useState<Tab>('overview')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>((location.state as { saved?: string } | null)?.saved ?? null)
  const archived = Boolean(c.archivedAt)
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'cohorts', label: 'Cohorts', count: data.cohorts.length },
    { key: 'sessions', label: 'Sessions', count: data.sessions.length },
    { key: 'assignments', label: 'Assignments', count: data.assignments.length },
    { key: 'resources', label: 'Resources', count: data.resources.length },
  ]

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Courses & sessions', to: '/admin/courses' }, { label: 'Courses', to: '/admin/courses/library' }, { label: c.name }]}
        title={c.name}
        description={[
          c.programme.name,
          c.defaultLead && `Lead trainer ${c.defaultLead.name}`,
          c.plannedSessions !== null && `${c.plannedSessions} sessions per cohort`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          archived ? (
            <Button
              onClick={() => restore.mutate(undefined, { onSuccess: () => setNotice(`${c.name} is back in the course library`) })}
              disabled={restore.isPending}
            >
              {restore.isPending ? 'Restoring…' : 'Restore course'}
            </Button>
          ) : (
            <>
              <Button variant="secondary" icon={<PencilIcon size={16} />} onClick={() => navigate('edit')}>
                Edit course
              </Button>
              <Button icon={<PlusIcon size={16} />} onClick={() => setAdding(true)}>
                Add resource
              </Button>
            </>
          )
        }
      />
      {archived && (
        <AlertBanner title="This course is archived">
          New cohorts can’t use it. Cohorts that already run it keep everything. Restore it to make changes.
        </AlertBanner>
      )}
      {notice && <AlertBanner tone="success" title={notice} />}

      <div role="tablist" aria-label="Course" className="-mb-px flex gap-1 overflow-x-auto border-b border-default">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-1 text-body-strong whitespace-nowrap transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
              tab === t.key ? 'border-brand text-brand-text' : 'border-transparent text-secondary hover:text-primary',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-neutral-bg px-1.5 text-[11px] leading-[14px] font-medium text-neutral-fg">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="flex items-start gap-4 max-lg:flex-col">
          <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
            <ResourcesPanel data={data} limit={5} onAll={() => setTab('resources')} canEdit={!archived} />
            <AssignmentsPanel data={data} limit={5} onAll={() => setTab('assignments')} />
          </div>
          <div className="flex w-[320px] shrink-0 flex-col gap-4 max-lg:w-full">
            <RunningIn data={data} />
            <Panel aria-labelledby="about-title" className="gap-0">
              <PanelHeader id="about-title" title="About" />
              <dl className="mt-2 flex flex-col">
                {[
                  [
                    'Programme',
                    <Link key="p" to={`/admin/programmes/${c.programme.id}`} className="hover:underline">
                      {c.programme.name}
                    </Link>,
                  ],
                  ['Lives in', c.libraryMode === 'shared' ? 'Programme course library' : 'Each cohort’s own course list'],
                  ['Sessions', c.plannedSessions !== null ? `${c.plannedSessions} per cohort` : 'Not planned'],
                  ...(c.description ? [['Description', c.description] as const] : []),
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex gap-4 border-b border-default py-3 text-body last:border-b-0">
                    <dt className="w-[110px] shrink-0 text-secondary">{label}</dt>
                    <dd className="min-w-0 text-body-strong break-words text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </div>
      )}
      {tab === 'cohorts' && <RunningIn data={data} wide />}
      {tab === 'sessions' && <SessionsPanel data={data} />}
      {tab === 'assignments' && <AssignmentsPanel data={data} />}
      {tab === 'resources' && <ResourcesPanel data={data} canEdit={!archived} />}

      {adding && (
        <AddCourseResourceDialog
          data={data}
          onClose={() => setAdding(false)}
          onAdded={(name) => {
            setAdding(false)
            setNotice(`${name} added`)
          }}
        />
      )}
    </>
  )
}

function AllLink({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-7 shrink-0 items-center gap-1 text-caption-strong text-brand-text hover:underline">
      All {count}
      <ChevronRightIcon size={14} />
    </button>
  )
}

function ResourcesPanel({ data, limit, onAll, canEdit }: { data: CourseDetail; limit?: number; onAll?: () => void; canEdit: boolean }) {
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const remove = useRemoveCourseResource(data.course.id)
  const [failed, setFailed] = useState<string | null>(null)
  const shown = limit ? data.resources.slice(0, limit) : data.resources

  async function open(r: CourseResource) {
    setFailed(null)
    try {
      if (r.kind === 'link' && r.url) window.open(r.url, '_blank', 'noopener')
      else await openFile(`/v1/courses/${data.course.id}/resources/${r.id}`, r.name, r.type)
    } catch {
      setFailed(r.id)
    }
  }

  return (
    <Panel aria-labelledby="resources-title" className="gap-0">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader id="resources-title" title="Resources" description="Files and links shared with participants and trainers in every cohort." />
        {onAll && data.resources.length > (limit ?? 0) && <AllLink count={data.resources.length} onClick={onAll} />}
      </div>
      {shown.length === 0 ? (
        <p className="py-3 text-body text-secondary">Nothing yet. Add slides, datasets or links every cohort needs.</p>
      ) : (
        <ul className="mt-1">
          {shown.map((r) => {
            const meta = [
              r.kind === 'link' ? `${hostOf(r.url)} · Link` : [fileKind(r.name, r.type), r.size !== null ? fileSize(r.size) : null].filter(Boolean).join(' · '),
              r.addedBy,
              r.cohort ? `${r.cohort}${r.sessionStartsAt ? ` · session on ${formatDay(r.sessionStartsAt, timeZone)}` : ''}` : formatDay(r.addedAt, timeZone),
              !r.visible && 'trainers only',
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={r.id} className="flex items-center gap-3 border-b border-default py-3 last:border-b-0">
                <button type="button" onClick={() => void open(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left hover:underline">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{r.name}</span>
                    <span className={clsx('truncate text-caption', failed === r.id ? 'text-error-fg' : 'text-secondary')}>
                      {failed === r.id ? 'Couldn’t open it. Try again.' : meta}
                    </span>
                  </span>
                  {r.kind === 'file' ? (
                    viewKind(r.name, r.type) ? (
                      <Eye className="size-4 shrink-0 text-icon" aria-hidden />
                    ) : (
                      <DownloadIcon size={16} className="shrink-0 text-icon" />
                    )
                  ) : (
                    <ChevronRightIcon size={16} className="shrink-0 text-icon" />
                  )}
                </button>
                {canEdit && <RemoveButton name={r.name} busy={remove.isPending} onConfirm={() => remove.mutate(r.id)} />}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/** Two taps to remove, so a slip doesn't delete a file every cohort uses. */
function RemoveButton({ name, busy, onConfirm }: { name: string; busy: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  return armed ? (
    <span className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={onConfirm} disabled={busy} className="text-caption-strong text-error-fg hover:underline">
        Remove for everyone
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-caption-strong text-secondary hover:underline">
        Keep
      </button>
    </span>
  ) : (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      onClick={() => setArmed(true)}
      className="shrink-0 text-caption-strong text-secondary hover:text-error-fg hover:underline"
    >
      Remove
    </button>
  )
}

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).host.replace(/^www\./, '') : ''
  } catch {
    return url ?? ''
  }
}

function AssignmentsPanel({ data, limit, onAll }: { data: CourseDetail; limit?: number; onAll?: () => void }) {
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const shown = limit ? data.assignments.slice(0, limit) : data.assignments
  return (
    <Panel aria-labelledby="assignments-title" className="gap-3">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader id="assignments-title" title="Assignments" description="Created by trainers. Each assignment uses its own grading scale." />
        {onAll && data.assignments.length > (limit ?? 0) && <AllLink count={data.assignments.length} onClick={onAll} />}
      </div>
      {shown.length === 0 ? (
        <p className="text-body text-secondary">No assignments yet. Trainers create them for their cohorts.</p>
      ) : (
        <Table
          columns={[
            { label: 'Assignment' },
            { label: 'Grading', width: 140, hideBelow: 'lg' },
            { label: 'Due', width: 150 },
            { label: 'Set by', width: 170, hideBelow: 'lg' },
          ]}
        >
          {shown.map((a) => (
            <Row key={a.id} to={`/admin/courses/assignments/${a.id}`}>
              <Cell>
                <Link to={`/admin/courses/assignments/${a.id}`} className="flex min-w-0 flex-col">
                  <span className="truncate text-body-strong text-primary">{a.title}</span>
                  <span className="truncate text-caption text-secondary">
                    {a.cohort}
                    {a.published ? '' : ' · Draft'}
                  </span>
                </Link>
              </Cell>
              <Cell hideBelow="lg">{scaleLabel(a.scale, a.maxPoints)}</Cell>
              <Cell>{formatDay(a.dueAt, timeZone)}</Cell>
              <Cell hideBelow="lg">
                {a.setBy ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar initials={initials(a.setBy)} />
                    <span className="truncate">{a.setBy}</span>
                  </span>
                ) : (
                  '—'
                )}
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </Panel>
  )
}

function RunningIn({ data, wide }: { data: CourseDetail; wide?: boolean }) {
  return (
    <Panel aria-labelledby="running-title" className="gap-0">
      <PanelHeader id="running-title" title="Running in" description="Trainers are assigned per course in each cohort." />
      {data.cohorts.length === 0 ? (
        <p className="py-3 text-body text-secondary">Not running in any cohort yet. Add it when you create or edit a cohort.</p>
      ) : (
        <ul className="mt-1">
          {data.cohorts.map((h) => {
            const trainers = h.trainers.length ? h.trainers.map((t) => `${t.name}${t.lead ? '' : ' (assistant)'}`).join(', ') : 'Trainer not assigned yet'
            return (
              <li key={h.id} className="border-b border-default last:border-b-0">
                <Link to={`/admin/cohorts/${h.id}/courses`} className="flex items-center gap-3 py-3 hover:bg-surface-hover">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{h.name}</span>
                    <span className={clsx('text-caption text-secondary', !wide && 'truncate')}>
                      {trainers}
                      {h.status !== 'upcoming' && ` · ${h.held} of ${plural(h.planned, 'session')} held`}
                    </span>
                  </span>
                  <CohortStatusBadge status={h.status as CohortStatus} />
                  <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function SessionsPanel({ data }: { data: CourseDetail }) {
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  return (
    <Panel aria-labelledby="sessions-title" className="gap-3">
      <PanelHeader id="sessions-title" title="Sessions" description="Across every cohort that runs this course." />
      {data.sessions.length === 0 ? (
        <p className="text-body text-secondary">No sessions scheduled yet. Schedule them from a cohort, or from Courses & sessions.</p>
      ) : (
        <Table columns={[{ label: 'When' }, { label: 'Cohort', width: 220 }, { label: 'Status', width: 140 }]}>
          {data.sessions.map((s) => (
            <Row key={s.id} to={`/admin/courses/sessions/${s.id}`}>
              <Cell>
                <Link to={`/admin/courses/sessions/${s.id}`} className="text-body-strong text-primary">
                  {formatDay(s.startsAt, timeZone)}, {formatTimeRange(s.startsAt, s.endsAt, timeZone)}
                </Link>
              </Cell>
              <Cell className="truncate">{s.cohort}</Cell>
              <Cell>
                <SessionStatusBadge status={s.status as SessionStatus} />
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </Panel>
  )
}
