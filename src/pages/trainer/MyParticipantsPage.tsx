import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Clock } from 'lucide-react'
import { CardGrid, ItemCard, LayoutSwitch } from '@/components/collection/Collection'
import { GRID_PANEL, useLayout } from '@/components/collection/layout'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { DetailList } from '@/components/ui/FormLayout'
import { ChevronRightIcon, MailIcon, PencilIcon, UserGroupIcon } from '@/components/ui/icons'
import { Badge, EmptyState, FilterChips, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Percent } from '@/components/ui/Percent'
import { Cell, Row, Table, TableFooter, type Column } from '@/components/ui/Table'
import { api } from '@/lib/api'
import { formatDay, formatDayWithYear, plural, relativeDay } from '@/lib/format'
import { paginate } from '@/lib/paginate'
import { initials } from '@/lib/people'
import { FlagStatusPanel, InterventionsPanel, RecordInterventionDialog, WhyFlaggedPanel } from '@/pages/admin/attention/AttentionPanels'
import { ruleLabel, useParticipantAttention, type Rule } from '@/pages/admin/attention/data'
import { type ParticipantStatus } from '@/pages/assignments/data'
import { AssignmentsTable } from '@/pages/admin/participants/AssignmentsTable'

interface Row_ {
  id: string
  name: string
  cohort: { id: string; name: string }
  attendance: { present: number; recorded: number; rate: number } | null
  work: { submitted: number; published: number }
  flag: Rule | null
  lastActive: string | null
}

const columns: Column[] = [
  { label: 'Participant' },
  { label: 'Cohort', width: 200, hideBelow: 'lg' },
  { label: 'Attendance', width: 100, align: 'right' },
  { label: 'Submitted', width: 100, align: 'right' },
  { label: 'Flag', width: 140 },
  { label: 'Last active', width: 120, hideBelow: 'xl' },
  { label: '', width: 72, align: 'right' },
]

/** /trainer/participants — T7.01 My participants, T7.01e empty. */
export function MyParticipantsPage() {
  const query = useQuery({
    queryKey: ['trainer', 'participants'],
    queryFn: ({ signal }) => api<{ timeZone: string; participants: Row_[] }>('/v1/trainer/participants', { signal }),
  })
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const all = query.data?.participants ?? []
  const timeZone = query.data?.timeZone
  const cohorts = [...new Map(all.map((r) => [r.cohort.id, r.cohort.name])).entries()]
  const visible = all.filter((r) => filter === 'all' || (filter === 'flagged' ? r.flag : r.cohort.id === filter))
  const paged = paginate(visible, page)
  const [layout, setLayout] = useLayout('trainer-participants')
  const flagBadge = (r: Row_) => (r.flag ? <Badge tone={r.flag === 'inactive' ? 'neutral' : 'warning'}>{ruleLabel[r.flag]}</Badge> : undefined)

  return (
    <>
      <PageHeader
        title="My participants"
        description="People in the cohorts you teach. Attendance and work are from your courses only; flags use your organisation’s follow-up rules."
      />
      {query.isPending ? (
        <Panel aria-busy="true" className="h-[240px]">
          <span className="sr-only">Loading participants</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel kind="error" title="Couldn’t load your participants" action={{ label: 'Try again', onClick: () => void query.refetch() }} />
        </Panel>
      ) : all.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<UserGroupIcon size={24} />}
            title="No participants yet"
            body="When you’re teaching a course in a cohort, its participants appear here with their attendance and work in your course."
          />
        </Panel>
      ) : (
        <>
          <div className="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
            <div className="min-w-0 flex-1">
              <FilterChips
                label="Participants"
                value={filter}
                onChange={(v) => {
                  setFilter(v)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'All', count: all.length },
                  {
                    value: 'flagged',
                    label: 'Needs attention',
                    count: all.filter((r) => r.flag).length,
                  },
                  ...(cohorts.length > 1
                    ? cohorts.map(([id, n]) => ({
                        value: id,
                        label: n,
                        count: all.filter((r) => r.cohort.id === id).length,
                      }))
                    : []),
                ]}
              />
            </div>
            <LayoutSwitch value={layout} onChange={setLayout} />
          </div>
          <Panel className={layout === 'grid' ? GRID_PANEL : 'gap-0 max-md:py-2'}>
            {layout === 'grid' ? (
              <CardGrid label="My participants">
                {paged.rows.map((r) => (
                  <ItemCard
                    key={`${r.id}-${r.cohort.id}`}
                    to={r.id}
                    title={r.name}
                    description={r.cohort.name}
                    leading={<Avatar size={24} initials={initials(r.name)} seed={r.id} />}
                    badge={flagBadge(r)}
                    progress={{
                      label: 'Attendance in your course',
                      value: r.attendance?.rate ?? null,
                    }}
                    meta={[
                      {
                        icon: <ClipboardCheck />,
                        text: r.work.published ? `${r.work.submitted} of ${r.work.published} handed in` : 'Nothing due yet',
                      },
                      {
                        icon: <Clock />,
                        text: r.lastActive ? relativeDay(r.lastActive, timeZone) : 'Never signed in',
                        label: 'Last active',
                      },
                    ]}
                  />
                ))}
              </CardGrid>
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns}>
                    {paged.rows.map((r) => (
                      <Row key={`${r.id}-${r.cohort.id}`} to={r.id}>
                        <Cell>
                          <span className="flex min-w-0 items-center gap-2">
                            <Avatar initials={initials(r.name)} seed={r.id} />
                            <span className="truncate text-body-strong">{r.name}</span>
                          </span>
                        </Cell>
                        <Cell hideBelow="lg">{r.cohort.name}</Cell>
                        <Cell align="right">
                          <Percent value={r.attendance?.rate} />
                        </Cell>
                        <Cell align="right">{r.work.published ? `${r.work.submitted} of ${r.work.published}` : <span className="text-muted">—</span>}</Cell>
                        <Cell>
                          {r.flag ? (
                            <Badge tone={r.flag === 'inactive' ? 'neutral' : 'warning'}>{ruleLabel[r.flag]}</Badge>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </Cell>
                        <Cell hideBelow="xl">{r.lastActive ? relativeDay(r.lastActive, timeZone) : <span className="text-muted">Never</span>}</Cell>
                        <Cell align="right">
                          <Link
                            to={r.id}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline"
                          >
                            View
                            <ChevronRightIcon size={14} />
                          </Link>
                        </Cell>
                      </Row>
                    ))}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {paged.rows.map((r) => (
                    <li key={`${r.id}-${r.cohort.id}`} className="border-b border-default last:border-b-0">
                      <Link to={r.id} className="flex items-center gap-3 py-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">{r.name}</span>
                          <span className="truncate text-caption text-secondary">
                            {[r.cohort.name, r.attendance ? `${r.attendance.rate}% attendance` : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {r.flag && <Badge tone={r.flag === 'inactive' ? 'neutral' : 'warning'}>{ruleLabel[r.flag]}</Badge>}
                        <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <TableFooter summary={plural(visible.length, 'participant')} page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </Panel>
        </>
      )}
    </>
  )
}

interface TrainerParticipant {
  timeZone: string
  participant: {
    id: string
    name: string
    firstName: string
    email: string
    enrolledAt: string
  }
  cohort: { id: string; name: string }
  courses: string[]
  trainers: string[]
  attendance: { present: number; recorded: number }
  sessions: {
    id: string
    startsAt: string
    course: string
    mark: 'present' | 'absent' | 'excused' | null
  }[]
  assignments: {
    id: string
    title: string
    course: string
    dueAt: string
    submittedAt: string | null
    status: ParticipantStatus
    grade: string | null
  }[]
}

const markTone = {
  present: 'success',
  absent: 'warning',
  excused: 'info',
} as const
const markLabel = {
  present: 'Present',
  absent: 'Absent',
  excused: 'Excused',
} as const

/** /trainer/participants/:id — T7.02 Participant (own course only), T7.03 record intervention. */
export function TrainerParticipantPage() {
  const { id = '' } = useParams()
  const query = useQuery({
    queryKey: ['trainer', 'participant', id],
    queryFn: ({ signal }) => api<TrainerParticipant>(`/v1/trainer/participants/${id}`, { signal }),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })
  const attention = useParticipantAttention(id)
  const [recording, setRecording] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (query.isPending) return <div aria-busy="true" aria-label="Loading participant" className="h-40" />
  if (query.isError) {
    return (
      <>
        <PageHeader title="Participant not found" breadcrumb={[{ label: 'My participants', to: '/trainer/participants' }]} />
        <Panel>
          <StatePanel kind="no-results" title="They aren’t in a cohort you teach." description="Go back to My participants." />
        </Panel>
      </>
    )
  }
  const d = query.data
  const flags = attention.data?.flags ?? []
  const tz = d.timeZone
  const pct = d.attendance.recorded ? Math.round((d.attendance.present / d.attendance.recorded) * 100) : null

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'My participants', to: '/trainer/participants' }, { label: d.participant.name }]}
        leading={<Avatar size={40} initials={initials(d.participant.name)} seed={d.participant.id} enlarge={d.participant.name} />}
        title={d.participant.name}
        badge={flags.length ? <Badge tone="warning">Needs attention</Badge> : undefined}
        description={`Participant · ${d.cohort.name}${d.courses.length ? ` · in your course${d.courses.length > 1 ? 's' : ''}, ${d.courses.join(', ')}` : ''}`}
        actions={
          <>
            <a
              href={`mailto:${d.participant.email}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-strong bg-surface pr-4 pl-3 text-label-button text-primary hover:bg-surface-hover"
            >
              <MailIcon size={16} />
              Email
            </a>
            {attention.data && (
              <Button icon={<PencilIcon size={16} />} onClick={() => setRecording(true)}>
                Record intervention
              </Button>
            )}
          </>
        }
      />
      {notice && <AlertBanner tone="success" title={notice} />}
      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          {attention.data && flags.length > 0 && <WhyFlaggedPanel firstName={d.participant.firstName} data={attention.data} />}
          <Panel aria-labelledby="att-title" className="gap-3">
            <PanelHeader
              id="att-title"
              title="Attendance in your course"
              description={
                pct === null
                  ? 'Nothing recorded yet.'
                  : `${d.attendance.present} of ${plural(d.attendance.recorded, 'session')} (${pct}%). The cohort’s flag uses every course; admins see the full picture.`
              }
            />
            {d.sessions.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {d.sessions.map((s) => (
                  <li key={s.id} className="flex flex-col gap-1 rounded-md border border-default px-3 py-2">
                    <span className="text-caption-strong text-primary">{formatDay(s.startsAt, tz)}</span>
                    {s.mark ? <Badge tone={markTone[s.mark]}>{markLabel[s.mark]}</Badge> : <Badge tone="neutral">Not recorded</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel aria-labelledby="work-title" className="gap-2">
            <PanelHeader
              id="work-title"
              title="Assignments"
              description={
                d.assignments.length
                  ? `${d.courses.join(', ')} · ${d.assignments.filter((a) => a.submittedAt).length} of ${d.assignments.length} submitted`
                  : 'No published assignments in your course yet.'
              }
            />
            {d.assignments.length > 0 && (
              <AssignmentsTable
                rows={d.assignments}
                loading={false}
                timeZone={tz}
                linkFor={(a) => (a.submittedAt ? `/trainer/grading/${a.id}/submissions/${d.participant.id}` : `/trainer/grading/${a.id}`)}
              />
            )}
          </Panel>
        </div>
        <aside className="flex w-[356px] shrink-0 flex-col gap-4 max-lg:w-full">
          {attention.data && <InterventionsPanel data={attention.data} onRecord={() => setRecording(true)} limit={3} />}
          {attention.data && flags.length > 0 && <FlagStatusPanel data={attention.data} onResolve={() => undefined} />}
          <Panel aria-labelledby="t-details">
            <PanelHeader id="t-details" title="Details" />
            <DetailList
              compact
              items={[
                { label: 'Email', value: d.participant.email },
                { label: 'Cohort', value: d.cohort.name },
                { label: 'Trainers', value: d.trainers.join(', ') },
                {
                  label: 'Enrolled',
                  value: formatDayWithYear(d.participant.enrolledAt, tz),
                },
              ]}
            />
          </Panel>
        </aside>
      </div>
      {recording && attention.data && (
        <RecordInterventionDialog
          memberId={d.participant.id}
          name={d.participant.name}
          cohortName={d.cohort.name}
          timeZone={tz}
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false)
            setNotice('Intervention recorded. Admins can see it in the interventions log.')
          }}
        />
      )}
    </>
  )
}
