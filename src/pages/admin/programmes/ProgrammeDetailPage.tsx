import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { DetailList } from '@/components/ui/FormLayout'
import { BookOpenIcon, CalendarIcon, ChartIcon, ChevronRightIcon, InfoTriangleIcon, PlusIcon, UserGroupIcon } from '@/components/ui/icons'
import { Metrics } from '@/components/ui/Metrics'
import { Percent } from '@/components/ui/Percent'
import { EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Stacked, Table, type Column } from '@/components/ui/Table'
import { ApiError } from '@/lib/api'
import { formatDateRange, formatDayWithYear, plural } from '@/lib/format'
import { CohortStatusBadge, ProgrammeStatusBadge } from './badges'
import { useProgramme, useRestoreProgramme, type CohortSummary } from './data'
import { DeliveryProgress } from './DeliveryProgress'

const cohortColumns: Column[] = [
  { label: 'Cohort' },
  { label: 'Status', width: 110 },
  { label: 'Participants', width: 100, align: 'right' },
  { label: 'Delivery', width: 150, hideBelow: 'lg' },
  { label: 'Attendance', width: 100, align: 'right', hideBelow: 'xl' },
]

/** /admin/programmes/:id — A1.02 Programme detail. */
export function ProgrammeDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const query = useProgramme(id)
  const restore = useRestoreProgramme(id)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  if (query.isPending) return <div aria-busy="true" aria-label="Loading programme" className="h-40" />
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <>
        <PageHeader title={missing ? 'Programme not found' : 'Couldn’t load this programme'} breadcrumb={[{ label: 'Programmes', to: '/admin/programmes' }]} />
        <Panel>
          <StatePanel
            kind={missing ? 'no-results' : 'error'}
            title={missing ? 'This programme doesn’t exist' : 'Something went wrong'}
            description={missing ? undefined : 'Check your connection and try again.'}
          />
        </Panel>
      </>
    )
  }

  const { programme, cohorts, courses, outcomes } = query.data
  const archived = programme.status === 'archived'
  const description = [programme.description, programme.lead?.name && `Managed by ${programme.lead.name}`].filter(Boolean).join(' · ')
  const breakdown = [
    programme.cohorts.active && `${programme.cohorts.active} active`,
    programme.cohorts.upcoming && `${programme.cohorts.upcoming} upcoming`,
    programme.cohorts.completed && `${programme.cohorts.completed} completed`,
  ]
    .filter(Boolean)
    .join(' · ')

  async function onRestore() {
    setRestoreError(null)
    try {
      await restore.mutateAsync()
    } catch (error) {
      setRestoreError(error instanceof ApiError && error.status < 500 ? error.message : 'It wasn’t restored. Try again.')
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Programmes', to: '/admin/programmes' }, { label: programme.name }]}
        title={programme.name}
        badge={<ProgrammeStatusBadge status={programme.status} />}
        description={description || undefined}
        actions={
          archived ? (
            <Button onClick={onRestore} disabled={restore.isPending}>
              {restore.isPending ? 'Restoring…' : 'Restore programme'}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => navigate('edit')}>
                Edit programme
              </Button>
              <Button icon={<PlusIcon size={16} />} onClick={() => navigate(`/admin/cohorts/new?programme=${programme.id}`)}>
                New cohort
              </Button>
            </>
          )
        }
      />

      {archived && (
        <AlertBanner title="This programme is archived">
          It and its cohorts are read-only. Restore it to make changes; cohorts archived with it come back too.
        </AlertBanner>
      )}
      {restoreError && (
        <AlertBanner tone="error" title="Couldn’t restore">
          {restoreError}
        </AlertBanner>
      )}

      <Metrics
        items={[
          { label: 'Cohorts', icon: <CalendarIcon size={18} />, value: programme.cohorts.total, context: breakdown || 'None yet' },
          {
            label: 'Participants',
            icon: <UserGroupIcon size={18} />,
            value: programme.participants,
            context: programme.participants ? 'Across this programme’s cohorts' : 'None enrolled yet',
          },
          {
            label: 'Attendance, last 4 weeks',
            icon: <ChartIcon size={18} />,
            value: programme.attendance4w === null ? '—' : `${programme.attendance4w}%`,
            context: programme.attendance4w === null ? 'Nothing recorded in the last 4 weeks' : 'Active cohorts · present ÷ recorded',
          },
          { label: 'Needs attention', icon: <InfoTriangleIcon size={18} />, value: '—', context: 'Checked once sessions are held' },
        ]}
      />

      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          <Panel aria-labelledby="cohorts-title">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <PanelHeader id="cohorts-title" title="Cohorts" />
              </div>
              {cohorts.length > 0 && (
                <Link to="/admin/cohorts" className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline">
                  All cohorts
                  <ChevronRightIcon size={14} />
                </Link>
              )}
            </div>
            {cohorts.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon size={24} />}
                title="No cohorts yet"
                body={
                  courses.length === 0
                    ? 'Add courses first, then create a cohort to run them between a start and end date.'
                    : 'A cohort runs this programme’s courses between a start and end date.'
                }
                actions={
                  !archived && (
                    <Button icon={<PlusIcon size={16} />} onClick={() => navigate(`/admin/cohorts/new?programme=${programme.id}`)}>
                      New cohort
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={cohortColumns}>
                    {cohorts.map((cohort) => (
                      <CohortRow key={cohort.id} cohort={cohort} />
                    ))}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {cohorts.map((cohort) => (
                    <li key={cohort.id} className="border-b border-default last:border-b-0">
                      <Link to={`/admin/cohorts/${cohort.id}`} className="flex items-center gap-3 py-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">{cohort.name}</span>
                          <span className="truncate text-caption text-secondary">
                            {formatDateRange(cohort.startsOn, cohort.endsOn)} · {plural(cohort.participants, 'participant')}
                          </span>
                        </span>
                        <CohortStatusBadge status={cohort.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>

        <div className="flex w-[356px] shrink-0 flex-col gap-4 max-lg:w-full">
          <Panel aria-labelledby="courses-title">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <PanelHeader id="courses-title" title="Courses" description="Shared by every cohort in this programme." />
              </div>
              {!archived && courses.length > 0 && (
                <Link
                  to={`/admin/courses/new?programme=${programme.id}`}
                  className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline"
                >
                  <PlusIcon size={14} />
                  Add course
                </Link>
              )}
            </div>
            {courses.length === 0 ? (
              <EmptyState
                icon={<BookOpenIcon size={24} />}
                title="No courses yet"
                body="Courses hold sessions, assignments and resources. Every cohort in this programme can run them."
                actions={
                  !archived && (
                    <Button icon={<PlusIcon size={16} />} onClick={() => navigate(`/admin/courses/new?programme=${programme.id}`)}>
                      Add course
                    </Button>
                  )
                }
              />
            ) : (
              <ul>
                {courses.map((course) => (
                  <li key={course.id} className="flex items-center gap-3 border-b border-default py-3 last:border-b-0">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body-strong text-primary">{course.name}</span>
                      <span className="truncate text-caption text-secondary">
                        {[
                          course.defaultLead?.name ?? 'No lead trainer yet',
                          course.plannedSessions != null && `${plural(course.plannedSessions, 'session')} per cohort`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel aria-labelledby="details-title">
            <PanelHeader id="details-title" title="Programme details" />
            <DetailList
              items={[
                { label: 'Programme lead', value: programme.lead?.name ?? <span className="font-normal text-muted">Not set</span> },
                { label: 'Created', value: formatDayWithYear(programme.createdAt, timeZone) },
                { label: 'Outcomes tracked', value: outcomes.length ? outcomes.join(', ') : <span className="font-normal text-muted">None</span> },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  )
}

function CohortRow({ cohort }: { cohort: CohortSummary }) {
  return (
    <Row to={`/admin/cohorts/${cohort.id}`}>
      <Cell>
        <Stacked
          primary={
            <Link
              to={`/admin/cohorts/${cohort.id}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {cohort.name}
            </Link>
          }
          secondary={formatDateRange(cohort.startsOn, cohort.endsOn)}
        />
      </Cell>
      <Cell>
        <CohortStatusBadge status={cohort.status} />
      </Cell>
      <Cell align="right" className="text-body-strong">
        {cohort.participants}
      </Cell>
      <Cell hideBelow="lg">
        <DeliveryProgress cohort={cohort} />
      </Cell>
      <Cell align="right" hideBelow="xl">
        <Percent value={cohort.attendanceAll} />
      </Cell>
    </Row>
  )
}
