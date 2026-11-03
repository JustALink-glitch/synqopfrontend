import { CalendarDays, Layers } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { BookOpenIcon, PlusIcon } from '@/components/ui/icons'
import { Badge, EmptyState, FilterChips, Panel } from '@/components/ui/Page'
import { CoursesHeader } from '@/pages/admin/sessions/CoursesHeader'
import { SearchField } from '@/components/ui/SearchField'
import { Cell, Row, Stacked, Table, TableFooter, type Column } from '@/components/ui/Table'
import { plural } from '@/lib/format'
import { paginate } from '@/lib/paginate'
import { initials } from '@/lib/people'
import { deleteForever, useCourses, useProgrammes, useRefreshStructure, type Course } from './data'
import { Archive, ArchiveRestore, Download, Trash2 } from 'lucide-react'
import { BulkBar, CardGrid, ItemCard, LayoutSwitch, RowActions } from '@/components/collection/Collection'
import { GRID_PANEL, useLayout } from '@/components/collection/layout'
import { downloadCsv, runBulk, useSelection } from '@/components/collection/selection'
import { api } from '@/lib/api'

const columns: Column[] = [
  { label: 'Course' },
  { label: 'Cohorts', width: 240, hideBelow: 'lg' },
  { label: 'Lead trainer', width: 220 },
  { label: 'Sessions per cohort', width: 160, align: 'right', hideBelow: 'xl' },
  { label: '', width: 56, align: 'right' },
]

/** /admin/courses — A2.01 Courses, A2.01e empty. */
export function CoursesPage() {
  const [showArchived, setShowArchived] = useState(false)
  const courses = useCourses(undefined, showArchived)
  const programmes = useProgrammes()
  const navigate = useNavigate()
  const location = useLocation()
  const created = (location.state as { created?: string } | null)?.created
  const archivedName = (location.state as { archived?: string } | null)?.archived
  const deletedName = (location.state as { deleted?: string } | null)?.deleted
  const [programme, setProgramme] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const all = useMemo(() => courses.data ?? [], [courses.data])
  const liveProgrammes = (programmes.data?.programmes ?? []).filter((p) => p.status !== 'archived')
  const term = search.trim().toLowerCase()
  const visible = all.filter((c) => (programme === 'all' || c.programme.id === programme) && (!term || c.name.toLowerCase().includes(term)))
  const paged = paginate(visible, page)
  const [layout, setLayout] = useLayout('courses')
  const selection = useSelection(paged.rows.map((c) => c.id))
  const chosen = paged.rows.filter((c) => selection.has(c.id))
  const refresh = useRefreshStructure()
  const [single, setSingle] = useState<string | null>(null)
  const archive = (c: Course) => api(`/v1/courses/${c.id}/archive`, { method: 'POST' })
  const restore = (c: Course) => api(`/v1/courses/${c.id}/restore`, { method: 'POST' })
  async function bulk(action: string, items: Course[], run: (c: Course) => Promise<unknown>) {
    const outcome = await runBulk(action, items, (c) => c.name, run)
    await refresh()
    return outcome
  }
  async function one(action: string, c: Course, run: (c: Course) => Promise<unknown>) {
    const o = await bulk(action, [c], run)
    setSingle(o.skipped.length ? `${c.name}: ${o.skipped[0]!.reason}` : null)
  }
  const rowActions = (c: Course) => (
    <RowActions
      label={c.name}
      items={[
        { label: 'Open', onSelect: () => navigate(`/admin/courses/library/${c.id}`) },
        ...(showArchived
          ? [{ label: 'Restore', onSelect: () => void one('Restored', c, restore) }]
          : [
              { label: 'Edit', onSelect: () => navigate(`/admin/courses/library/${c.id}/edit`) },
              { label: 'Archive', onSelect: () => void one('Archived', c, archive) },
            ]),
      ]}
    />
  )

  const newButton = (
    <Button
      icon={<PlusIcon size={16} />}
      onClick={() => navigate(programme !== 'all' ? `/admin/courses/new?programme=${programme}` : '/admin/courses/new')}
      disabled={liveProgrammes.length === 0}
      title={liveProgrammes.length === 0 ? 'Create a programme first' : undefined}
    >
      New course
    </Button>
  )

  return (
    <>
      <CoursesHeader tab="courses" actions={all.length > 0 ? newButton : undefined} courseCount={courses.data?.length} />
      {created && (
        <AlertBanner tone="success" title={`${created} was added`}>
          Cohorts you ticked now run it, with its lead trainer.
        </AlertBanner>
      )}

      {deletedName && <AlertBanner tone="success" title={`${deletedName} was deleted`} />}
      {archivedName && (
        <AlertBanner tone="success" title={`${archivedName} was archived`}>
          Cohorts that run it keep everything. Find it under Archived to restore it.
        </AlertBanner>
      )}

      {courses.isPending || programmes.isPending ? (
        <Panel aria-busy="true" aria-label="Loading courses" className="h-[240px]">
          <span className="sr-only">Loading courses</span>
        </Panel>
      ) : courses.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load courses"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void courses.refetch() }}
          />
        </Panel>
      ) : all.length === 0 && !showArchived ? (
        <Panel className="py-16">
          <EmptyState
            icon={<BookOpenIcon size={24} />}
            title="No courses yet"
            body={
              liveProgrammes.length === 0
                ? 'Courses belong to a programme. Create a programme first, then add its courses.'
                : 'Courses hold sessions, assignments and resources. Add one to a programme, then it can run in that programme’s cohorts.'
            }
            actions={
              liveProgrammes.length === 0 ? (
                <Button icon={<PlusIcon size={16} />} onClick={() => navigate('/admin/programmes/new')}>
                  New programme
                </Button>
              ) : (
                <>
                  {newButton}
                  <Button variant="secondary" onClick={() => setShowArchived(true)}>
                    Archived courses
                  </Button>
                </>
              )
            }
          />
        </Panel>
      ) : (
        <>
          <div className="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
            <FilterChips
              label="Programme"
              value={programme}
              onChange={(value) => {
                setProgramme(value)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'All programmes', count: all.length },
                ...liveProgrammes
                  .filter((p) => all.some((c) => c.programme.id === p.id))
                  .map((p) => ({ value: p.id, label: p.name, count: all.filter((c) => c.programme.id === p.id).length })),
              ]}
            />
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => {
                setShowArchived((v) => !v)
                setProgramme('all')
                setPage(1)
              }}
              className={`h-8 shrink-0 rounded-full border px-3 text-caption-strong ${showArchived ? 'border-transparent bg-surface-selected text-brand-text' : 'border-default bg-surface text-secondary hover:text-primary'}`}
            >
              Archived
            </button>
            <div className="flex-1" />
            <SearchField
              aria-label="Search courses"
              placeholder="Search courses"
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
            noun={['course', 'courses']}
            actions={[
              {
                label: 'Export CSV',
                icon: <Download aria-hidden className="size-4" />,
                run: async () =>
                  downloadCsv(
                    'Courses.csv',
                    ['Course', 'Programme', 'Cohorts', 'Lead trainer', 'Sessions per cohort'],
                    chosen.map((c) => [c.name, c.programme.name, c.cohorts.map((h) => h.name).join('; '), c.defaultLead?.name ?? '', c.plannedSessions ?? '']),
                  ),
              },
              showArchived
                ? { label: 'Restore', icon: <ArchiveRestore aria-hidden className="size-4" />, run: () => bulk('Restored', chosen, restore) }
                : {
                    label: 'Archive',
                    icon: <Archive aria-hidden className="size-4" />,
                    confirm: {
                      title: `Archive ${plural(selection.count, 'course')}?`,
                      body: 'Cohorts that run them keep everything. You can restore them from Archived.',
                      button: 'Archive',
                    },
                    run: () => bulk('Archived', chosen, archive),
                  },
              {
                label: 'Delete permanently',
                icon: <Trash2 aria-hidden className="size-4" />,
                destructive: true,
                confirm: {
                  title: `Delete ${plural(selection.count, 'course')} permanently?`,
                  body: 'Only courses with nothing recorded are deleted, with their sessions and assignments. The rest are skipped, and you’ll see why. This can’t be undone.',
                  button: 'Delete permanently',
                  typed: 'delete',
                },
                run: () => bulk('Deleted', chosen, (c) => deleteForever('courses', c.id)),
              },
            ]}
          />
          <Panel className={layout === 'grid' ? GRID_PANEL : 'gap-0 max-md:py-2'}>
            {visible.length === 0 ? (
              <StatePanel
                kind="no-results"
                title={showArchived && all.length === 0 ? 'No archived courses' : 'No courses match'}
                description={
                  showArchived && all.length === 0 ? 'Courses you archive show here, ready to restore.' : 'Try another name, or choose All programmes.'
                }
              />
            ) : layout === 'grid' ? (
              <div>
                <CardGrid label="Courses">
                  {paged.rows.map((c) => (
                    <ItemCard
                      key={c.id}
                      to={`/admin/courses/library/${c.id}`}
                      title={c.name}
                      description={c.description || `Part of ${c.programme.name}.`}
                      badge={<Badge tone="neutral">{c.programme.name}</Badge>}
                      select={{ checked: selection.has(c.id), onChange: () => selection.toggle(c.id) }}
                      selecting={selection.count > 0}
                      actions={rowActions(c)}
                      people={c.defaultLead ? [{ id: c.defaultLead.id, name: c.defaultLead.name }] : undefined}
                      meta={[
                        {
                          icon: <Layers />,
                          text: c.cohorts.length ? plural(c.cohorts.length, 'cohort') : 'Not running yet',
                          label: c.cohorts.map((h) => h.name).join(', '),
                        },
                        { icon: <CalendarDays />, text: c.plannedSessions ? `${c.plannedSessions} sessions` : 'Sessions not set' },
                      ]}
                    />
                  ))}
                </CardGrid>
              </div>
            ) : (
              <Table columns={columns} select={{ checked: selection.header, onChange: selection.toggleAll, label: 'Select all courses on this page' }}>
                {paged.rows.map((course) => (
                  <Row
                    key={course.id}
                    to={`/admin/courses/library/${course.id}`}
                    select={{ checked: selection.has(course.id), onChange: () => selection.toggle(course.id), label: `Select ${course.name}` }}
                  >
                    <Cell>
                      <Stacked primary={course.name} secondary={course.programme.name} />
                    </Cell>
                    <Cell hideBelow="lg">
                      <Stacked
                        primary={course.cohorts.length ? plural(course.cohorts.length, 'cohort') : 'Not running yet'}
                        muted={course.cohorts.length === 0}
                        secondary={course.cohorts.map((c) => c.name).join(' · ') || undefined}
                      />
                    </Cell>
                    <Cell>
                      {course.defaultLead ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar initials={initials(course.defaultLead.name)} seed={course.defaultLead.id} />
                          <span className="truncate text-body-strong">{course.defaultLead.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted">Not assigned</span>
                      )}
                    </Cell>
                    <Cell align="right" hideBelow="xl" className="text-body-strong">
                      {course.plannedSessions ?? '—'}
                    </Cell>
                    <Cell align="right">{rowActions(course)}</Cell>
                  </Row>
                ))}
              </Table>
            )}
            <TableFooter summary={plural(visible.length, 'course')} page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </Panel>
        </>
      )}
    </>
  )
}
