import { CalendarDays, ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { CalendarIcon, ChevronRightIcon, ClipboardIcon } from '@/components/ui/icons'
import { Cell, Row, Stacked, Table, TableFooter, type Column } from '@/components/ui/Table'
import { plural } from '@/lib/format'
import { paginate } from '@/lib/paginate'
import { initials } from '@/lib/people'
import { useCourses } from '@/pages/admin/programmes/data'
import { CoursesHeader } from '@/pages/admin/sessions/CoursesHeader'
import { formatDue, useAssignments, type AssignmentSummary } from './data'
import { Download } from 'lucide-react'
import { Badge, EmptyState, FilterChips, Panel } from '@/components/ui/Page'
import { BulkBar, CardGrid, ItemCard, LayoutSwitch, RowActions } from '@/components/collection/Collection'
import { GRID_PANEL, useLayout } from '@/components/collection/layout'
import { useSelection } from '@/components/collection/selection'
import { assignmentsCsv } from './csv'

type Filter = 'all' | 'open' | 'past' | 'grading'

const columns: Column[] = [
  { label: 'Assignment' },
  { label: 'Set by', width: 180, hideBelow: 'xl' },
  { label: 'Due', width: 160 },
  { label: 'Submitted', width: 100, align: 'right' },
  { label: 'Graded', width: 80, align: 'right' },
  { label: 'Grading', width: 160, hideBelow: 'lg' },
  { label: '', width: 56, align: 'right' },
]

const BASE = '/admin/courses/assignments'
const matches = (filter: Filter, a: AssignmentSummary) =>
  filter === 'all' ||
  (filter === 'open' && a.status === 'open') ||
  (filter === 'past' && a.status === 'closed') ||
  (filter === 'grading' && a.counts.toGrade > 0)

/** /admin/courses/assignments — C4.01 Assignments (read-only for admins). */
export function AdminAssignmentsPage() {
  const query = useAssignments()
  const courses = useCourses()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const all = query.data?.assignments ?? []
  const timeZone = query.data?.timeZone
  const visible = all.filter((a) => matches(filter, a))
  const paged = paginate(visible, page)
  const [layout, setLayout] = useLayout('admin-assignments')
  const selection = useSelection(paged.rows.map((a) => a.id))
  const chosen = paged.rows.filter((a) => selection.has(a.id))
  const rowActions = (a: AssignmentSummary) => (
    <RowActions
      label={a.title}
      items={[
        { label: 'Open', onSelect: () => navigate(`${BASE}/${a.id}`) },
        { label: 'Open cohort', onSelect: () => navigate(`/admin/cohorts/${a.cohort.id}`) },
        { label: 'Export CSV', onSelect: () => assignmentsCsv([a], timeZone) },
      ]}
    />
  )

  return (
    <>
      <CoursesHeader
        tab="assignments"
        courseCount={courses.data?.length}
        assignmentCount={query.data ? all.length : undefined}
        actions={
          <Button icon={<CalendarIcon size={16} />} onClick={() => navigate('/admin/courses/sessions/new')}>
            Schedule session
          </Button>
        }
      />
      <AlertBanner title="Trainers create and grade assignments">
        You can see every assignment and submission. Each assignment uses the grading scale its trainer chose.{' '}
        <Link to={`${BASE}/grading-scales`} className="text-brand-text underline-offset-2 hover:underline">
          How grades appear
        </Link>
      </AlertBanner>

      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Loading assignments" className="h-[240px]">
          <span className="sr-only">Loading assignments</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load assignments"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : all.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<ClipboardIcon size={24} />}
            title="No assignments yet"
            body="Trainers set assignments from Grade assignments in their area. They appear here once published, with every submission and grade."
          />
        </Panel>
      ) : (
        <>
          <FilterChips
            label="Assignments"
            value={filter}
            onChange={(value) => {
              setFilter(value)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All', count: all.length },
              {
                value: 'open',
                label: 'Open',
                count: all.filter((a) => matches('open', a)).length,
              },
              {
                value: 'past',
                label: 'Past due',
                count: all.filter((a) => matches('past', a)).length,
              },
              {
                value: 'grading',
                label: 'Needs grading',
                count: all.filter((a) => matches('grading', a)).length,
              },
            ]}
          />
          <div className="-mt-1 flex justify-end">
            <LayoutSwitch value={layout} onChange={setLayout} />
          </div>
          <BulkBar
            selection={selection}
            noun={['assignment', 'assignments']}
            actions={[{ label: 'Export CSV', icon: <Download aria-hidden className="size-4" />, run: async () => assignmentsCsv(chosen, timeZone) }]}
          />
          <Panel className={layout === 'grid' ? GRID_PANEL : 'gap-0 max-md:py-2'}>
            {visible.length === 0 ? (
              <StatePanel kind="no-results" title="Nothing here" description="Try another filter." />
            ) : layout === 'grid' ? (
              <div>
                <CardGrid label="Assignments">
                  {paged.rows.map((a) => (
                    <ItemCard
                      key={a.id}
                      to={`${BASE}/${a.id}`}
                      title={a.title}
                      description={`${a.course.name} · ${a.cohort.name}`}
                      accent={a.counts.toGrade > 0 ? 'var(--chart-3)' : a.status === 'open' ? 'var(--chart-1)' : 'var(--chart-6)'}
                      badge={
                        <>
                          <Badge tone={a.status === 'open' ? 'info' : 'neutral'}>
                            {a.status === 'open' ? 'Open' : a.status === 'closed' ? 'Past due' : 'Draft'}
                          </Badge>
                          {a.counts.toGrade > 0 && <Badge tone="warning">{a.counts.toGrade} to grade</Badge>}
                        </>
                      }
                      select={{ checked: selection.has(a.id), onChange: () => selection.toggle(a.id) }}
                      selecting={selection.count > 0}
                      actions={rowActions(a)}
                      progress={{
                        label: 'Handed in',
                        value: a.counts.expected ? Math.round((a.counts.submitted / a.counts.expected) * 100) : null,
                        text: a.status === 'draft' ? 'Draft' : `${a.counts.submitted} of ${a.counts.expected}`,
                      }}
                      people={a.setBy ? [{ id: a.setBy.id, name: a.setBy.name }] : undefined}
                      meta={[
                        { icon: <ClipboardCheck />, text: a.counts.submitted ? `${a.counts.graded} graded` : 'None graded', label: a.scaleLabel },
                        { icon: <CalendarDays />, text: formatDue(a.dueAt, timeZone), label: 'Due' },
                      ]}
                    />
                  ))}
                </CardGrid>
              </div>
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns} select={{ checked: selection.header, onChange: selection.toggleAll, label: 'Select all assignments on this page' }}>
                    {paged.rows.map((a) => (
                      <Row
                        key={a.id}
                        to={`${BASE}/${a.id}`}
                        select={{ checked: selection.has(a.id), onChange: () => selection.toggle(a.id), label: `Select ${a.title}` }}
                      >
                        <Cell>
                          <Stacked primary={a.title} secondary={`${a.course.name} · ${a.cohort.name}`} />
                        </Cell>
                        <Cell hideBelow="xl">
                          {a.setBy ? (
                            <span className="flex min-w-0 items-center gap-2">
                              <Avatar initials={initials(a.setBy.name)} seed={a.setBy.id} />
                              <span className="truncate text-body-strong">{a.setBy.name}</span>
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </Cell>
                        <Cell className="tabular-nums">{formatDue(a.dueAt, timeZone)}</Cell>
                        <Cell align="right" className="text-body-strong">
                          {a.counts.submitted} of {a.counts.expected}
                        </Cell>
                        <Cell align="right">{a.counts.submitted ? a.counts.graded : <span className="text-muted">—</span>}</Cell>
                        <Cell hideBelow="lg">{a.scaleLabel}</Cell>
                        <Cell align="right">{rowActions(a)}</Cell>
                      </Row>
                    ))}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {paged.rows.map((a) => (
                    <li key={a.id} className="border-b border-default last:border-b-0">
                      <Link to={`${BASE}/${a.id}`} className="flex items-center gap-3 py-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">{a.title}</span>
                          <span className="truncate text-caption text-secondary">
                            {a.cohort.name} · due {formatDue(a.dueAt, timeZone)} · {a.counts.submitted} of {a.counts.expected} in
                          </span>
                        </span>
                        <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <TableFooter summary={plural(visible.length, 'assignment')} page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </Panel>
        </>
      )}
    </>
  )
}
