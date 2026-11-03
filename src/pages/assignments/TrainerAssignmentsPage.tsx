import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { ChevronRightIcon, ClipboardIcon, PlusIcon } from '@/components/ui/icons'
import { Badge, EmptyState, FilterChips, PageHeader, Panel } from '@/components/ui/Page'
import { Download } from 'lucide-react'
import { BulkBar, CardGrid, ItemCard, LayoutSwitch } from '@/components/collection/Collection'
import { useLayout } from '@/components/collection/layout'
import { useSelection } from '@/components/collection/selection'
import { assignmentsCsv } from './csv'
import { Cell, Row, Stacked, Table, TableFooter, type Column } from '@/components/ui/Table'
import { formatDay, plural } from '@/lib/format'
import { paginate } from '@/lib/paginate'
import { useAssignments, type AssignmentSummary } from './data'

type Filter = 'all' | 'grade' | 'open' | 'drafts'

const columns: Column[] = [
  { label: 'Assignment' },
  { label: 'Due', width: 130 },
  { label: 'Submitted', width: 110, align: 'right' },
  { label: 'To grade', width: 90, align: 'right' },
  { label: 'Grading', width: 170, hideBelow: 'lg' },
  { label: '', width: 80, align: 'right' },
]

const BASE = '/trainer/grading'

function action(a: AssignmentSummary): { label: string; to: string } {
  if (a.status === 'draft') return { label: 'Edit', to: `${BASE}/${a.id}/edit` }
  if (a.canGrade && a.counts.toGrade > 0) return { label: 'Grade', to: `${BASE}/${a.id}` }
  return { label: 'View', to: `${BASE}/${a.id}` }
}

/** /trainer/grading — T6.01 Grade assignments, T6.01e nothing to grade. */
export function TrainerAssignmentsPage() {
  const query = useAssignments()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = location.state as {
    published?: string
    drafted?: string
  } | null
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)

  const all = query.data?.assignments ?? []
  const timeZone = query.data?.timeZone
  // Oldest deadline first for grading; newest first otherwise.
  const visible = all
    .filter((a) => (filter === 'grade' ? a.counts.toGrade > 0 : filter === 'open' ? a.status === 'open' : filter === 'drafts' ? a.status === 'draft' : true))
    // Work waiting for a grade first (T6.01), then newest deadline first; the grade filter is oldest deadline first.
    .sort((x, y) =>
      filter === 'grade'
        ? new Date(x.dueAt).getTime() - new Date(y.dueAt).getTime()
        : Number(y.counts.toGrade > 0) - Number(x.counts.toGrade > 0) || new Date(y.dueAt).getTime() - new Date(x.dueAt).getTime(),
    )
  const paged = paginate(visible, page)
  const [layout, setLayout] = useLayout('trainer-assignments')
  const selection = useSelection(paged.rows.map((a) => a.id))
  const chosen = paged.rows.filter((a) => selection.has(a.id))
  const canCreate = query.data?.canCreate ?? false

  const newButton = (
    <Button
      icon={<PlusIcon size={16} />}
      onClick={() => navigate(`${BASE}/new`)}
      disabled={!canCreate}
      title={canCreate ? undefined : 'You can set assignments once you teach a course'}
    >
      New assignment
    </Button>
  )

  return (
    <>
      <PageHeader title="Assignments" description="Assignments you set. Grade from the queue; participants see grades when you save." actions={newButton} />
      {notice?.published && (
        <AlertBanner tone="success" title={`${notice.published} was published`}>
          Participants in the cohort can see it on their course.
        </AlertBanner>
      )}
      {notice?.drafted && (
        <AlertBanner tone="success" title={`${notice.drafted} was saved as a draft`}>
          Only you and the course’s other trainers can see it. Publish it when it’s ready.
        </AlertBanner>
      )}

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
            title="Nothing to grade"
            body={
              canCreate
                ? 'When participants submit work in your cohorts, it shows here — oldest deadline first.'
                : 'You aren’t teaching a course yet. Once an admin adds you to one, you can set assignments for it here.'
            }
            actions={canCreate ? newButton : undefined}
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
                value: 'grade',
                label: 'To grade',
                count: all.filter((a) => a.counts.toGrade > 0).length,
              },
              {
                value: 'open',
                label: 'Open',
                count: all.filter((a) => a.status === 'open').length,
              },
              {
                value: 'drafts',
                label: 'Drafts',
                count: all.filter((a) => a.status === 'draft').length,
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
          <Panel className="gap-0 max-md:py-2">
            {visible.length === 0 ? (
              <StatePanel
                kind="no-results"
                title={filter === 'grade' ? 'You’re all caught up' : 'Nothing here'}
                description={filter === 'grade' ? 'Every submission has a grade.' : 'Try another filter.'}
              />
            ) : layout === 'grid' ? (
              <div className="py-2">
                <CardGrid label="Assignments">
                  {paged.rows.map((a) => {
                    const next = action(a)
                    return (
                      <ItemCard
                        key={a.id}
                        to={next.to}
                        title={a.title}
                        subtitle={`${a.course.name} · ${a.cohort.name}`}
                        badge={
                          <>
                            <Badge tone={a.status === 'open' ? 'info' : 'neutral'}>
                              {a.status === 'open' ? 'Open' : a.status === 'closed' ? 'Past due' : 'Draft'}
                            </Badge>
                            {a.counts.toGrade > 0 && <Badge tone="warning">{a.counts.toGrade} to grade</Badge>}
                          </>
                        }
                        select={{ checked: selection.has(a.id), onChange: () => selection.toggle(a.id) }}
                        facts={[
                          { label: 'Due', value: formatDay(a.dueAt, timeZone) },
                          { label: 'Submitted', value: a.status === 'draft' ? 'Draft' : `${a.counts.submitted} of ${a.counts.expected}` },
                          { label: 'To grade', value: a.status === 'draft' ? '—' : a.counts.toGrade },
                          { label: 'Grading', value: a.scaleLabel },
                        ]}
                        footer={
                          <Link to={next.to} className="relative z-[1] inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline">
                            {next.label}
                            <ChevronRightIcon size={14} />
                          </Link>
                        }
                      />
                    )
                  })}
                </CardGrid>
              </div>
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns} select={{ checked: selection.header, onChange: selection.toggleAll, label: 'Select all assignments on this page' }}>
                    {paged.rows.map((a) => {
                      const next = action(a)
                      return (
                        <Row
                          key={a.id}
                          to={next.to}
                          select={{ checked: selection.has(a.id), onChange: () => selection.toggle(a.id), label: `Select ${a.title}` }}
                        >
                          <Cell>
                            <Stacked primary={a.title} secondary={`${a.course.name} · ${a.cohort.name}`} />
                          </Cell>
                          <Cell className="tabular-nums">{formatDay(a.dueAt, timeZone)}</Cell>
                          <Cell align="right" className="text-body-strong tabular-nums">
                            {a.status === 'draft' ? 'Draft' : `${a.counts.submitted} of ${a.counts.expected}`}
                          </Cell>
                          <Cell align="right" className="tabular-nums">
                            {a.status === 'draft' ? <span className="text-muted">—</span> : a.counts.toGrade}
                          </Cell>
                          <Cell hideBelow="lg">{a.scaleLabel}</Cell>
                          <Cell align="right">
                            <Link
                              to={next.to}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline"
                            >
                              {next.label}
                              <ChevronRightIcon size={14} />
                            </Link>
                          </Cell>
                        </Row>
                      )
                    })}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {paged.rows.map((a) => (
                    <li key={a.id} className="border-b border-default last:border-b-0">
                      <Link to={action(a).to} className="flex items-center gap-3 py-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">{a.title}</span>
                          <span className="truncate text-caption text-secondary">
                            {a.status === 'draft'
                              ? `Draft · due ${formatDay(a.dueAt, timeZone)}`
                              : `Due ${formatDay(a.dueAt, timeZone)} · ${a.counts.submitted} of ${a.counts.expected} in${a.counts.toGrade ? ` · ${a.counts.toGrade} to grade` : ''}`}
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
