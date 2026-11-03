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
import { Archive, ArchiveRestore, Download, Trash2 } from 'lucide-react'
import { BulkBar, CardGrid, ItemCard, LayoutSwitch, RowActions } from '@/components/collection/Collection'
import { useLayout } from '@/components/collection/layout'
import { downloadCsv, runBulk, useSelection } from '@/components/collection/selection'
import { api } from '@/lib/api'
import { deleteForever, useRefreshStructure, type CohortSummary } from './data'

type Filter = 'all' | 'active' | 'upcoming' | 'completed' | 'archived'

const columns: Column[] = [
  { label: 'Cohort' },
  { label: 'Status', width: 110 },
  { label: 'Participants', width: 100, align: 'right' },
  { label: 'Delivery', width: 150, hideBelow: 'lg' },
  { label: 'Attendance, 4 wks', width: 130, align: 'right', hideBelow: 'xl' },
  { label: 'Needs attention', width: 120, align: 'right', hideBelow: 'xl' },
  { label: 'Next session', width: 160, hideBelow: 'xl' },
  { label: '', width: 56, align: 'right' },
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
  const [layout, setLayout] = useLayout('cohorts')
  const selection = useSelection(paged.rows.map((c) => c.id))
  const chosen = paged.rows.filter((c) => selection.has(c.id))
  const refresh = useRefreshStructure()
  const [single, setSingle] = useState<string | null>(null)

  async function bulk(action: string, items: CohortSummary[], run: (c: CohortSummary) => Promise<unknown>) {
    const outcome = await runBulk(action, items, (c) => c.name, run)
    await refresh()
    return outcome
  }
  async function one(action: string, c: CohortSummary, run: (c: CohortSummary) => Promise<unknown>) {
    const o = await bulk(action, [c], run)
    setSingle(o.skipped.length ? `${c.name}: ${o.skipped[0]!.reason}` : null)
  }
  const archive = (c: CohortSummary) => api(`/v1/cohorts/${c.id}/archive`, { method: 'POST' })
  const restore = (c: CohortSummary) => api(`/v1/cohorts/${c.id}/restore`, { method: 'POST' })
  const nextLabel = (c: CohortSummary) =>
    c.nextSession ? `${relativeDay(c.nextSession.startsAt, timeZone)}, ${formatTime(c.nextSession.startsAt, timeZone)}` : 'None scheduled'

  const rowActions = (c: CohortSummary) => (
    <RowActions
      label={c.name}
      items={[
        { label: 'Open', onSelect: () => navigate(c.id) },
        ...(c.status !== 'archived'
          ? [
              { label: 'Edit', onSelect: () => navigate(`${c.id}/edit`) },
              { label: 'Schedule session', onSelect: () => navigate(`/admin/courses/sessions/new?cohort=${c.id}`) },
              { label: 'Archive', onSelect: () => void one('Archived', c, archive) },
            ]
          : [{ label: 'Restore', onSelect: () => void one('Restored', c, restore) }]),
      ]}
    />
  )

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
            <LayoutSwitch value={layout} onChange={setLayout} />
          </div>
          {single && <AlertBanner tone="error" title={single} />}
          <BulkBar
            selection={selection}
            noun={['cohort', 'cohorts']}
            actions={[
              {
                label: 'Export CSV',
                icon: <Download aria-hidden className="size-4" />,
                run: async () =>
                  downloadCsv(
                    'Cohorts.csv',
                    [
                      'Cohort',
                      'Programme',
                      'Status',
                      'Starts',
                      'Ends',
                      'Participants',
                      'Sessions held',
                      'Sessions planned',
                      'Attendance (4 weeks)',
                      'Needs attention',
                    ],
                    chosen.map((c) => [
                      c.name,
                      c.programme.name,
                      c.status,
                      c.startsOn,
                      c.endsOn,
                      c.participants,
                      c.heldSessions,
                      c.plannedSessions,
                      c.attendance4w === null ? '' : `${c.attendance4w}%`,
                      c.needsAttention ?? 0,
                    ]),
                  ),
              },
              filter === 'archived'
                ? { label: 'Restore', icon: <ArchiveRestore aria-hidden className="size-4" />, run: () => bulk('Restored', chosen, restore) }
                : {
                    label: 'Archive',
                    icon: <Archive aria-hidden className="size-4" />,
                    confirm: {
                      title: `Archive ${plural(selection.count, 'cohort')}?`,
                      body: 'They become read-only. Running cohorts are skipped until they end. You can restore them later.',
                      button: 'Archive',
                    },
                    run: () => bulk('Archived', chosen, archive),
                  },
              {
                label: 'Delete permanently',
                icon: <Trash2 aria-hidden className="size-4" />,
                destructive: true,
                confirm: {
                  title: `Delete ${plural(selection.count, 'cohort')} permanently?`,
                  body: 'Only cohorts with nothing recorded (no attendance, submissions, reports or certificates) are deleted, with their sessions and enrolments. The rest are skipped, and you’ll see why. This can’t be undone.',
                  button: 'Delete permanently',
                  typed: 'delete',
                },
                run: () => bulk('Deleted', chosen, (c) => deleteForever('cohorts', c.id)),
              },
            ]}
          />
          <Panel className="gap-0 max-md:py-2">
            {visible.length === 0 ? (
              <StatePanel kind="no-results" title="No cohorts match" description="Try another name, or clear the filter." />
            ) : layout === 'grid' ? (
              <div className="py-2">
                <CardGrid label="Cohorts">
                  {paged.rows.map((c) => (
                    <ItemCard
                      key={c.id}
                      to={c.id}
                      title={c.name}
                      subtitle={`${c.programme.name} · ${formatDateRange(c.startsOn, c.endsOn)}`}
                      badge={<CohortStatusBadge status={c.status} />}
                      select={{ checked: selection.has(c.id), onChange: () => selection.toggle(c.id) }}
                      actions={rowActions(c)}
                      facts={[
                        { label: 'Participants', value: c.participants },
                        { label: 'Sessions', value: `${c.heldSessions} of ${c.plannedSessions || '—'}` },
                        { label: 'Attendance, 4 wks', value: <Percent value={c.attendance4w} /> },
                        { label: 'Needs attention', value: c.status === 'active' ? (c.needsAttention ?? 0) : '—' },
                      ]}
                      footer={`Next session: ${nextLabel(c)}`}
                    />
                  ))}
                </CardGrid>
              </div>
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns} select={{ checked: selection.header, onChange: selection.toggleAll, label: 'Select all cohorts on this page' }}>
                    {paged.rows.map((cohort) => (
                      <Row
                        key={cohort.id}
                        to={cohort.id}
                        select={{ checked: selection.has(cohort.id), onChange: () => selection.toggle(cohort.id), label: `Select ${cohort.name}` }}
                      >
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
                        <Cell align="right">{rowActions(cohort)}</Cell>
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
