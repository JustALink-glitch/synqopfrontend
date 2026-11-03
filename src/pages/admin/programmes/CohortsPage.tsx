import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { CalendarIcon, ChevronRightIcon, PlusIcon } from '@/components/ui/icons'
import { EmptyState, FilterChips, PageHeader, Panel } from '@/components/ui/Page'
import { Percent } from '@/components/ui/Percent'
import { SearchField } from '@/components/ui/SearchField'
import { Cell, Row, Stacked, Table, TableFooter, type Column } from '@/components/ui/Table'
import { formatDateRange, formatTime, plural, relativeDay } from '@/lib/format'
import { useAuth } from '@/auth/useAuth'
import { paginate } from '@/lib/paginate'
import { CohortStatusBadge } from './badges'
import { useCohorts, useProgrammes } from './data'
import { DeliveryProgress } from './DeliveryProgress'

type Filter = 'all' | 'active' | 'upcoming' | 'completed' | 'archived'

const columns: Column[] = [
  { label: 'Cohort' },
  { label: 'Status', width: 110 },
  { label: 'Participants', width: 100, align: 'right' },
  { label: 'Delivery', width: 150, hideBelow: 'lg' },
  { label: 'Attendance, 4 wks', width: 130, align: 'right', hideBelow: 'xl' },
  { label: 'Needs attention', width: 120, align: 'right', hideBelow: 'xl' },
  { label: 'Next session', width: 160, hideBelow: 'xl' },
]

/** /admin/cohorts — A3.01 Cohorts, A3.01e empty. */
export function CohortsPage() {
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const query = useCohorts()
  const programmes = useProgrammes()
  const navigate = useNavigate()
  const location = useLocation()
  const archivedName = (location.state as { archived?: string } | null)?.archived
  const deletedName = (location.state as { deleted?: string } | null)?.deleted
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const all = useMemo(() => query.data ?? [], [query.data])
  const hasProgramme = (programmes.data?.programmes ?? []).some((p) => p.status !== 'archived')
  const count = (status: Filter) => all.filter((c) => (status === 'upcoming' ? c.status === 'upcoming' || c.status === 'draft' : c.status === status)).length
  const term = search.trim().toLowerCase()
  const visible = all.filter((c) => {
    const statusMatch =
      filter === 'all' ? c.status !== 'archived' : filter === 'upcoming' ? c.status === 'upcoming' || c.status === 'draft' : c.status === filter
    return statusMatch && (!term || c.name.toLowerCase().includes(term) || c.programme.name.toLowerCase().includes(term))
  })
  const paged = paginate(visible, page)

  const newButton = (
    <Button
      icon={<PlusIcon size={16} />}
      onClick={() => navigate('new')}
      disabled={!hasProgramme}
      title={hasProgramme ? undefined : 'Create a programme first'}
    >
      New cohort
    </Button>
  )

  return (
    <>
      <PageHeader title="Cohorts" description="Every cohort across your programmes." actions={all.length > 0 ? newButton : undefined} />
      {deletedName && <AlertBanner tone="success" title={`${deletedName} was deleted`} />}
      {archivedName && (
        <AlertBanner tone="success" title={`${archivedName} was archived`}>
          It’s read-only now. You can restore it from the Archived filter.
        </AlertBanner>
      )}

      {query.isPending || programmes.isPending ? (
        <Panel aria-busy="true" aria-label="Loading cohorts" className="h-[240px]">
          <span className="sr-only">Loading cohorts</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load cohorts"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : all.length === 0 ? (
        <Panel className="py-16">
          <EmptyState
            icon={<CalendarIcon size={24} />}
            title="No cohorts yet"
            body={
              hasProgramme
                ? 'A cohort runs a programme’s courses between a start and end date. Create one, then add participants and trainers.'
                : 'A cohort runs a programme’s courses between a start and end date. Create a programme first.'
            }
            actions={
              hasProgramme ? (
                newButton
              ) : (
                <Button icon={<PlusIcon size={16} />} onClick={() => navigate('/admin/programmes/new')}>
                  New programme
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <>
          <div className="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
            <FilterChips
              label="Status"
              value={filter}
              onChange={(value) => {
                setFilter(value)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'All', count: all.filter((c) => c.status !== 'archived').length },
                { value: 'active', label: 'Active', count: count('active') },
                { value: 'upcoming', label: 'Upcoming', count: count('upcoming') },
                { value: 'completed', label: 'Completed', count: count('completed') },
                { value: 'archived', label: 'Archived', count: count('archived') },
              ]}
            />
            <div className="flex-1" />
            <SearchField
              aria-label="Search cohorts"
              placeholder="Search cohorts"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <Panel className="gap-0 max-md:py-2">
            {visible.length === 0 ? (
              <StatePanel kind="no-results" title="No cohorts match" description="Try another name, or clear the filter." />
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns}>
                    {paged.rows.map((cohort) => (
                      <Row key={cohort.id} to={cohort.id}>
                        <Cell>
                          <Stacked
                            primary={
                              <Link
                                to={cohort.id}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline focus-visible:underline focus-visible:outline-none"
                              >
                                {cohort.name}
                              </Link>
                            }
                            secondary={`${cohort.programme.name} · ${plural(cohort.courseNames.length, 'course')}`}
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
                          <Percent value={cohort.attendance4w} />
                        </Cell>
                        <Cell align="right" hideBelow="xl" className={cohort.status === 'active' ? 'text-body-strong' : 'text-muted'}>
                          {cohort.status === 'active' ? (cohort.needsAttention ?? 0) : '—'}
                        </Cell>
                        <Cell hideBelow="xl" className={cohort.nextSession ? undefined : 'text-muted'}>
                          {cohort.nextSession ? (
                            <Stacked
                              primary={`${relativeDay(cohort.nextSession.startsAt, timeZone)}, ${formatTime(cohort.nextSession.startsAt, timeZone)}`}
                              secondary={cohort.nextSession.mode === 'online' ? 'Online · Zoom' : (cohort.nextSession.location ?? 'In person')}
                            />
                          ) : (
                            'None scheduled'
                          )}
                        </Cell>
                      </Row>
                    ))}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {paged.rows.map((cohort) => (
                    <li key={cohort.id} className="border-b border-default last:border-b-0">
                      <Link to={cohort.id} className="flex items-center gap-3 py-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">{cohort.name}</span>
                          <span className="truncate text-caption text-secondary">
                            {cohort.programme.name} · {formatDateRange(cohort.startsOn, cohort.endsOn)}
                          </span>
                        </span>
                        <CohortStatusBadge status={cohort.status} />
                        <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <TableFooter summary={plural(visible.length, 'cohort')} page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </Panel>
        </>
      )}
    </>
  )
}
