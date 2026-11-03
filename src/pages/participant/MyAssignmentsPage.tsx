import { Award, CalendarClock } from 'lucide-react'
import { useState } from 'react'
import { CardGrid, ItemCard, LayoutSwitch } from '@/components/collection/Collection'
import { GRID_PANEL, useLayout } from '@/components/collection/layout'
import { Link } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { ChevronRightIcon, ClipboardIcon } from '@/components/ui/icons'
import { Badge, EmptyState, FilterChips, PageHeader, Panel } from '@/components/ui/Page'
import { Cell, Row, Stacked, Table, type Column } from '@/components/ui/Table'
import { plural } from '@/lib/format'
import { formatDue } from '@/pages/assignments/data'
import { dueWithinDays, myStatusLabel, myStatusTone, useMyAssignments, type MyAssignment, type MyStatus } from './data'

type Filter = 'all' | 'todo' | 'submitted' | 'graded'

const columns: Column[] = [
  { label: 'Assignment' },
  { label: 'Due', width: 170 },
  { label: 'Status', width: 150 },
  { label: 'Grade', width: 120 },
  { label: '', width: 80, align: 'right' },
]

const TODO: MyStatus[] = ['not_submitted', 'overdue']
const matches = (f: Filter, a: MyAssignment) =>
  f === 'all' ||
  (f === 'todo' && TODO.includes(a.status)) ||
  (f === 'submitted' && (a.status === 'submitted' || a.status === 'late')) ||
  (f === 'graded' && a.status === 'graded')

export function MyStatusBadge({ status }: { status: MyStatus }) {
  return <Badge tone={myStatusTone[status]}>{myStatusLabel[status]}</Badge>
}

const dot = (s: MyStatus) =>
  s === 'overdue' ? 'var(--chart-5)' : s === 'not_submitted' ? 'var(--chart-3)' : s === 'graded' ? 'var(--chart-6)' : 'var(--chart-1)'

const gradeCell = (a: MyAssignment) => a.grade ?? (a.status === 'submitted' || a.status === 'late' ? 'Waiting' : null)

/** /participant/assignments — P5.01 Assignments, P5.01e empty. */
export function MyAssignmentsPage() {
  const query = useMyAssignments()
  const [filter, setFilter] = useState<Filter>('all')
  const [layout, setLayout] = useLayout('my-assignments')
  const all = query.data?.assignments ?? []
  const timeZone = query.data?.timeZone
  // To do first (soonest due), then the rest, most recent first.
  const visible = all
    .filter((a) => matches(filter, a))
    .sort((x, y) => {
      const xt = TODO.includes(x.status) ? 0 : 1
      const yt = TODO.includes(y.status) ? 0 : 1
      if (xt !== yt) return xt - yt
      return (xt === 0 ? 1 : -1) * (new Date(x.dueAt).getTime() - new Date(y.dueAt).getTime())
    })
  const dueThisWeek = all.filter((a) => a.status === 'not_submitted' && dueWithinDays(a.dueAt, 7)).length
  const description =
    all.length === 0
      ? 'Work your trainers set appears here.'
      : `${dueThisWeek ? `${dueThisWeek} to do this week. ` : ''}You can replace a submission until its due time.`

  return (
    <>
      <PageHeader title="Assignments" description={description} />
      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Loading assignments" className="h-[240px]">
          <span className="sr-only">Loading assignments</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load your assignments"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : all.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<ClipboardIcon size={24} />}
            title="No assignments yet"
            body="When your trainers set work for your courses, it shows here with its due date. You’ll get a reminder the day before it’s due."
          />
        </Panel>
      ) : (
        <>
          <div className="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
            <div className="min-w-0 flex-1">
              <FilterChips
                label="Assignments"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All', count: all.length },
                  {
                    value: 'todo',
                    label: 'To do',
                    count: all.filter((a) => matches('todo', a)).length,
                  },
                  {
                    value: 'submitted',
                    label: 'Submitted',
                    count: all.filter((a) => matches('submitted', a)).length,
                  },
                  {
                    value: 'graded',
                    label: 'Graded',
                    count: all.filter((a) => matches('graded', a)).length,
                  },
                ]}
              />
            </div>
            <LayoutSwitch value={layout} onChange={setLayout} />
          </div>
          <Panel className={layout === 'grid' && visible.length > 0 ? GRID_PANEL : 'gap-0 max-md:py-2'}>
            {visible.length === 0 ? (
              <StatePanel
                kind="no-results"
                title={filter === 'todo' ? 'Nothing to do right now' : 'Nothing here'}
                description={filter === 'todo' ? 'You’re up to date.' : 'Try another filter.'}
              />
            ) : layout === 'grid' ? (
              <CardGrid label="Assignments">
                {visible.map((a) => (
                  <ItemCard
                    key={a.id}
                    to={a.id}
                    title={a.title}
                    description={[a.course.name, a.trainer].filter(Boolean).join(' · ')}
                    accent={dot(a.status)}
                    badge={<MyStatusBadge status={a.status} />}
                    meta={[
                      {
                        icon: <CalendarClock />,
                        text: `Due ${formatDue(a.dueAt, timeZone)}`,
                        label: 'Due',
                      },
                      {
                        icon: <Award />,
                        text: gradeCell(a) ?? a.scaleLabel,
                        label: a.grade ? 'Grade' : 'Scale',
                      },
                    ]}
                    footer={
                      TODO.includes(a.status) ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-caption-strong text-brand-text">
                          Submit
                          <ChevronRightIcon size={14} />
                        </span>
                      ) : undefined
                    }
                  />
                ))}
              </CardGrid>
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns}>
                    {visible.map((a) => {
                      const submit = TODO.includes(a.status)
                      return (
                        <Row key={a.id} to={a.id}>
                          <Cell>
                            <Stacked primary={a.title} secondary={a.course.name} />
                          </Cell>
                          <Cell className="tabular-nums">{formatDue(a.dueAt, timeZone)}</Cell>
                          <Cell>
                            <MyStatusBadge status={a.status} />
                          </Cell>
                          <Cell className="tabular-nums">{gradeCell(a) ?? <span className="text-muted">—</span>}</Cell>
                          <Cell align="right">
                            <Link
                              to={a.id}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline"
                            >
                              {submit ? 'Submit' : 'View'}
                              <ChevronRightIcon size={14} />
                            </Link>
                          </Cell>
                        </Row>
                      )
                    })}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {visible.map((a) => (
                    <li key={a.id} className="border-b border-default last:border-b-0">
                      <Link to={a.id} className="flex items-center gap-3 py-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">{a.title}</span>
                          <span className="truncate text-caption text-secondary">
                            Due {formatDue(a.dueAt, timeZone)}
                            {gradeCell(a) ? ` · ${gradeCell(a)}` : ''}
                          </span>
                        </span>
                        <MyStatusBadge status={a.status} />
                        <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <footer
              className={
                layout === 'grid' && visible.length > 0 ? 'pt-1 text-caption text-secondary' : 'border-t border-default pt-3 text-caption text-secondary'
              }
            >
              {plural(visible.length, 'assignment')}
            </footer>
          </Panel>
        </>
      )}
    </>
  )
}
