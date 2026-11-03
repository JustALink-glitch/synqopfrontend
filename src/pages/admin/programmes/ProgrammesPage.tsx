import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { ChevronRightIcon, GridIcon, PlusIcon, SearchIcon } from '@/components/ui/icons'
import { EmptyState, FilterChips, PageHeader, Panel } from '@/components/ui/Page'
import { SearchField } from '@/components/ui/SearchField'
import { Cell, Row, Stacked, Table, TableFooter, type Column } from '@/components/ui/Table'
import { Percent } from '@/components/ui/Percent'
import { plural } from '@/lib/format'
import { paginate } from '@/lib/paginate'
import { ProgrammeStatusBadge } from './badges'
import { useProgrammes, type Programme } from './data'
import { coursesSummary } from './labels'

const DESCRIPTION = 'Programmes group cohorts that follow the same curriculum.'
type Filter = 'all' | 'active' | 'draft' | 'archived'

const columns: Column[] = [
  { label: 'Programme' },
  { label: 'Status', width: 110 },
  { label: 'Cohorts', width: 170 },
  { label: 'Participants', width: 110, align: 'right' },
  { label: 'Attendance, 4 wks', width: 140, align: 'right', hideBelow: 'xl' },
  { label: 'Needs attention', width: 130, align: 'right', hideBelow: 'xl' },
  { label: '', width: 80 },
]

/** "2 active · 1 upcoming". */
function cohortBreakdown(p: Programme): string {
  const parts = [
    p.cohorts.active && `${p.cohorts.active} active`,
    p.cohorts.upcoming && `${p.cohorts.upcoming} upcoming`,
    p.cohorts.completed && `${p.cohorts.completed} completed`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

/** /admin/programmes — A1.01 Programmes, A1.01e empty, A1.01n no results. */
export function ProgrammesPage() {
  const query = useProgrammes()
  const location = useLocation()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const notice = (location.state as { archived?: string } | null)?.archived
  const deletedName = (location.state as { deleted?: string } | null)?.deleted

  const all = useMemo(() => query.data?.programmes ?? [], [query.data])
  const live = all.filter((p) => p.status !== 'archived')
  const counts = {
    all: live.length,
    active: all.filter((p) => p.status === 'active').length,
    draft: all.filter((p) => p.status === 'draft').length,
    archived: all.filter((p) => p.status === 'archived').length,
  }
  const term = search.trim().toLowerCase()
  const visible = all.filter((p) => (filter === 'all' ? p.status !== 'archived' : p.status === filter) && (!term || p.name.toLowerCase().includes(term)))
  const paged = paginate(visible, page)

  const newButton = (
    <Button icon={<PlusIcon size={16} />} onClick={() => navigate('new')}>
      New programme
    </Button>
  )

  return (
    <>
      <PageHeader title="Programmes" description={DESCRIPTION} actions={all.length > 0 ? newButton : undefined} />
      {deletedName && <AlertBanner tone="success" title={`${deletedName} was deleted`} />}
      {notice && (
        <AlertBanner tone="success" title={`${notice} was archived`}>
          It’s read-only now. You can restore it from the Archived filter.
        </AlertBanner>
      )}

      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Loading programmes" className="h-[240px]">
          <span className="sr-only">Loading programmes</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load programmes"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : all.length === 0 ? (
        <Panel className="py-16">
          <EmptyState
            icon={<GridIcon size={24} />}
            title="No programmes yet"
            body="A programme holds your course library and cohorts. Create one to start, then add courses and your first cohort."
            actions={newButton}
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
                { value: 'all', label: 'All', count: counts.all },
                { value: 'active', label: 'Active', count: counts.active },
                { value: 'draft', label: 'Draft', count: counts.draft },
                { value: 'archived', label: 'Archived', count: counts.archived },
              ]}
            />
            <div className="flex-1" />
            <SearchField
              aria-label="Search programmes"
              placeholder="Search programmes"
              width={280}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <Panel className="gap-0 max-md:py-2">
            {visible.length === 0 ? (
              term ? (
                <div role="status" className="flex flex-col items-center gap-3 p-8 text-center">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-brand-subtle text-icon-brand">
                    <SearchIcon size={24} />
                  </span>
                  <h2 className="text-heading-section text-primary">No programmes match “{search.trim()}”</h2>
                  <p className="text-body text-secondary">Check the spelling, or clear the search to see all {plural(counts.all, 'programme')}.</p>
                  <Button variant="secondary" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                </div>
              ) : (
                <StatePanel kind="no-results" title={filter === 'archived' ? 'No archived programmes' : 'No programmes here'} />
              )
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns}>
                    {paged.rows.map((p) => (
                      <Row key={p.id} to={p.id}>
                        <Cell>
                          <Stacked
                            primary={
                              <Link
                                to={p.id}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline focus-visible:underline focus-visible:outline-none"
                              >
                                {p.name}
                              </Link>
                            }
                            secondary={coursesSummary(p.courseNames)}
                          />
                        </Cell>
                        <Cell>
                          <ProgrammeStatusBadge status={p.status} />
                        </Cell>
                        <Cell>
                          <Stacked primary={p.cohorts.total ? plural(p.cohorts.total, 'cohort') : 'No cohorts'} secondary={cohortBreakdown(p)} />
                        </Cell>
                        <Cell align="right" className="text-body-strong">
                          {p.cohorts.total ? p.participants : '—'}
                        </Cell>
                        <Cell align="right" hideBelow="xl">
                          <Percent value={p.attendance4w} />
                        </Cell>
                        <Cell align="right" hideBelow="xl" className={p.needsAttention ? 'text-body-strong' : 'text-muted'}>
                          {p.needsAttention || '—'}
                        </Cell>
                        <Cell>
                          <span className="inline-flex items-center gap-1 text-caption-strong text-brand-text">
                            {p.status === 'draft' ? 'Set up' : 'View'}
                            <ChevronRightIcon size={14} />
                          </span>
                        </Cell>
                      </Row>
                    ))}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {paged.rows.map((p) => (
                    <li key={p.id} className="border-b border-default last:border-b-0">
                      <Link to={p.id} className="flex items-center gap-3 py-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">{p.name}</span>
                          <span className="truncate text-caption text-secondary">
                            {p.cohorts.total ? plural(p.cohorts.total, 'cohort') : 'No cohorts'} · {coursesSummary(p.courseNames)}
                          </span>
                        </span>
                        <ProgrammeStatusBadge status={p.status} />
                        <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <TableFooter summary={plural(visible.length, 'programme')} page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </Panel>
        </>
      )}
    </>
  )
}
