import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { CalendarIcon, CheckCircleIcon, ChevronRightIcon, FileIcon, InfoTriangleIcon } from '@/components/ui/icons'
import { Metrics } from '@/components/ui/Metrics'
import { Badge, EmptyState, FilterChips, PageHeader, Panel } from '@/components/ui/Page'
import { Cell, Row, Stacked, Table, TableFooter, type Column } from '@/components/ui/Table'
import { formatDay, formatTime, plural } from '@/lib/format'
import { paginate } from '@/lib/paginate'
import { initials } from '@/lib/people'
import { CoursesHeader } from '@/pages/admin/sessions/CoursesHeader'
import { Bell, Download } from 'lucide-react'
import { BulkBar, CardGrid, ItemCard, LayoutSwitch } from '@/components/collection/Collection'
import { useLayout } from '@/components/collection/layout'
import { downloadCsv, runBulk, useSelection } from '@/components/collection/selection'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { reportBadge, useRemind, useReportPaths, useReports, type ReportList, type ReportRow, type ReportState } from './data'

type Filter = 'all' | ReportState

/** /trainer/reports — T5.03 Session reports; /admin/courses/reports — C3.01. */
export function SessionReportsPage() {
  const navigate = useNavigate()
  const paths = useReportPaths()
  const query = useReports()
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const data = query.data

  const header = paths.trainer ? (
    <PageHeader title="Session reports" description={`One short report after every session you lead, due within ${data?.dueHours ?? 24} hours.`} />
  ) : (
    <CoursesHeader
      tab="reports"
      overdueReports={data?.counts.overdue}
      actions={
        <Button icon={<CalendarIcon size={16} />} onClick={() => navigate('/admin/courses/sessions/new')}>
          Schedule session
        </Button>
      }
    />
  )

  return (
    <>
      {header}
      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Loading reports" className="h-[240px]">
          <span className="sr-only">Loading reports</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load session reports"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : (
        <ReportsBody
          data={query.data}
          filter={filter}
          page={page}
          onFilter={(f) => {
            setFilter(f)
            setPage(1)
          }}
          onPage={setPage}
        />
      )}
    </>
  )
}

function ReportsBody({
  data,
  filter,
  page,
  onFilter,
  onPage,
}: {
  data: ReportList
  filter: Filter
  page: number
  onFilter: (f: Filter) => void
  onPage: (p: number) => void
}) {
  const paths = useReportPaths()
  const { timeZone, counts } = data
  const visible = data.reports.filter((r) => filter === 'all' || r.state === filter)
  const paged = paginate(visible, page)
  const overdue = data.reports.filter((r) => r.state === 'overdue')
  const [layout, setLayout] = useLayout(paths.trainer ? 'trainer-reports' : 'session-reports')
  const selection = useSelection(paged.rows.map((r) => r.sessionId))
  const chosen = paged.rows.filter((r) => selection.has(r.sessionId))
  const client = useQueryClient()
  const label = (r: ReportRow) => `${r.course}, ${formatDay(r.startsAt, timeZone)}`
  const remindAll = async () => {
    const o = await runBulk('Reminder sent', chosen, label, (r) =>
      r.state === 'submitted'
        ? Promise.reject(new ApiError(409, 'submitted', 'Already submitted.'))
        : !r.trainer
          ? Promise.reject(new ApiError(409, 'no_trainer', 'No trainer to remind.'))
          : api(`/v1/session-reports/${r.sessionId}/remind`, { method: 'POST' }),
    )
    await client.invalidateQueries({ queryKey: ['reports'] })
    return o
  }
  const columns: Column[] = [
    { label: 'Session' },
    ...(paths.trainer ? [] : [{ label: 'Trainer', width: 200, hideBelow: 'lg' as const }]),
    { label: 'Due', width: 170, hideBelow: 'lg' },
    { label: 'Report', width: 130 },
    { label: '', width: 96, align: 'right' },
  ]

  if (data.reports.length === 0) {
    return (
      <Panel className="py-12">
        <EmptyState
          icon={<FileIcon size={24} />}
          title={paths.trainer && !data.canWrite ? 'Session reports are written by lead trainers' : 'No reports yet'}
          body={
            paths.trainer && !data.canWrite
              ? 'Your organisation doesn’t ask assistant trainers for session reports. The course’s lead trainer writes one after each session.'
              : `A report opens when a session ends and is due ${plural(data.dueHours, 'hour')} later. Held sessions appear here.`
          }
        />
      </Panel>
    )
  }

  return (
    <>
      {paths.trainer && overdue.length > 0 && (
        <AlertBanner tone="error" title={`${plural(overdue.length, 'report is', 'reports are')} overdue`}>
          {overdue
            .slice(0, 2)
            .map((r) => `${r.course}, ${formatDay(r.startsAt, timeZone)} — due ${formatDay(r.dueAt, timeZone)}, ${formatTime(r.dueAt, timeZone)}`)
            .join(' · ')}
          .
        </AlertBanner>
      )}
      {!paths.trainer && (
        <Metrics
          items={[
            { label: 'Due now', icon: <CalendarIcon size={18} />, value: counts.due, context: `Within ${plural(data.dueHours, 'hour')} of the session` },
            {
              label: 'Overdue',
              icon: <InfoTriangleIcon size={18} />,
              value: counts.overdue,
              tone: counts.overdue ? 'warning' : undefined,
              context: `Past the ${data.dueHours}-hour window`,
            },
            {
              label: 'Submitted this month',
              icon: <CheckCircleIcon size={18} />,
              value: counts.submittedThisMonth,
              context: `${counts.onTimeThisMonth} on time`,
            },
          ]}
        />
      )}
      <div className="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
        <FilterChips
          label="Report"
          value={filter}
          onChange={onFilter}
          options={[
            { value: 'all', label: 'All', count: data.reports.length },
            { value: 'due', label: 'Due', count: counts.due },
            { value: 'overdue', label: 'Overdue', count: counts.overdue },
            { value: 'submitted', label: 'Submitted', count: counts.submitted },
          ]}
        />
        <div className="flex-1" />
        <LayoutSwitch value={layout} onChange={setLayout} />
      </div>
      <BulkBar
        selection={selection}
        noun={['report', 'reports']}
        actions={[
          {
            label: 'Export CSV',
            icon: <Download aria-hidden className="size-4" />,
            run: async () =>
              downloadCsv(
                'Session reports.csv',
                ['Course', 'Cohort', 'Session', 'Date', 'Trainer', 'Due', 'Report', 'Submitted'],
                chosen.map((r) => [
                  r.course,
                  r.cohort.name,
                  r.number ?? '',
                  formatDay(r.startsAt, timeZone),
                  r.trainer?.name ?? '',
                  `${formatDay(r.dueAt, timeZone)} ${formatTime(r.dueAt, timeZone)}`,
                  r.state,
                  r.submittedAt ? formatDay(r.submittedAt, timeZone) : '',
                ]),
              ),
          },
          ...(!paths.trainer
            ? [
                {
                  label: 'Send reminder',
                  icon: <Bell aria-hidden className="size-4" />,
                  confirm: {
                    title: 'Send reminders?',
                    body: 'Each ticked report that isn’t submitted yet gets an email to its trainer. Submitted ones are skipped.',
                    button: 'Send reminders',
                  },
                  run: remindAll,
                },
              ]
            : []),
        ]}
      />
      <Panel className="gap-0 max-md:py-2">
        {visible.length === 0 ? (
          <p role="status" className="p-8 text-center text-body text-secondary">
            No reports here.
          </p>
        ) : layout === 'grid' ? (
          <div className="py-2">
            <CardGrid label="Session reports">
              {paged.rows.map((r) => (
                <ItemCard
                  key={r.sessionId}
                  to={paths.report(r.sessionId)}
                  title={r.course}
                  subtitle={sessionLine(r, timeZone)}
                  badge={<StateBadge row={r} />}
                  select={{ checked: selection.has(r.sessionId), onChange: () => selection.toggle(r.sessionId) }}
                  actions={<RowAction row={r} canWrite={data.canWrite} />}
                  facts={[
                    ...(!paths.trainer ? [{ label: 'Trainer', value: r.trainer?.name ?? 'No trainer' }] : []),
                    { label: 'Due', value: `${formatDay(r.dueAt, timeZone)}, ${formatTime(r.dueAt, timeZone)}` },
                  ]}
                />
              ))}
            </CardGrid>
          </div>
        ) : (
          <>
            <div className="max-md:hidden">
              <Table columns={columns} select={{ checked: selection.header, onChange: selection.toggleAll, label: 'Select all reports on this page' }}>
                {paged.rows.map((r) => (
                  <Row
                    key={r.sessionId}
                    to={paths.report(r.sessionId)}
                    select={{ checked: selection.has(r.sessionId), onChange: () => selection.toggle(r.sessionId), label: `Select ${label(r)}` }}
                  >
                    <Cell>
                      <Stacked primary={r.course} secondary={sessionLine(r, timeZone)} />
                    </Cell>
                    {!paths.trainer && (
                      <Cell hideBelow="lg">
                        {r.trainer ? (
                          <span className="flex min-w-0 items-center gap-2">
                            <Avatar initials={initials(r.trainer.name)} seed={r.trainer.id} />
                            <span className="truncate text-body-strong text-primary">{r.trainer.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted">No trainer</span>
                        )}
                      </Cell>
                    )}
                    <Cell hideBelow="lg" className="tabular-nums">
                      {formatDay(r.dueAt, timeZone)}, {formatTime(r.dueAt, timeZone)}
                    </Cell>
                    <Cell>
                      <StateBadge row={r} />
                    </Cell>
                    <Cell align="right">
                      <RowAction row={r} canWrite={data.canWrite} />
                    </Cell>
                  </Row>
                ))}
              </Table>
            </div>
            <ul className="md:hidden">
              {paged.rows.map((r) => (
                <li key={r.sessionId} className="flex items-center gap-2 border-b border-default last:border-b-0">
                  <Link to={paths.report(r.sessionId)} className="flex min-w-0 flex-1 items-center gap-3 py-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-body-strong text-primary">{r.course}</span>
                      <span className="truncate text-caption text-secondary">
                        {sessionLine(r, timeZone)}
                        {!paths.trainer && r.trainer?.name ? ` · ${r.trainer.name}` : ''}
                      </span>
                      <span className="text-caption text-secondary">
                        Due {formatDay(r.dueAt, timeZone)}, {formatTime(r.dueAt, timeZone)}
                      </span>
                    </span>
                    <StateBadge row={r} />
                  </Link>
                  {!paths.trainer && r.state === 'overdue' && r.trainer ? (
                    <RowAction row={r} canWrite={false} />
                  ) : (
                    <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <TableFooter summary={plural(visible.length, 'report')} page={paged.page} pageCount={paged.pageCount} onPage={onPage} />
      </Panel>
    </>
  )
}

const sessionLine = (r: ReportRow, timeZone: string) =>
  [r.cohort.name, r.number && `Session ${r.number}`, formatDay(r.startsAt, timeZone)].filter(Boolean).join(' · ')

function StateBadge({ row }: { row: ReportRow }) {
  const b = reportBadge[row.state]
  return <Badge tone={b.tone}>{row.draft && row.state !== 'submitted' ? `${b.label} · draft` : b.label}</Badge>
}

function RowAction({ row, canWrite }: { row: ReportRow; canWrite: boolean }) {
  const paths = useReportPaths()
  const remind = useRemind(row.sessionId)
  const [sent, setSent] = useState(false)
  const style =
    'inline-flex h-9 items-center gap-1 text-caption-strong text-brand-text hover:underline focus-visible:underline focus-visible:outline-none disabled:opacity-50'
  if (!paths.trainer && row.state === 'overdue' && row.trainer) {
    return (
      <button
        type="button"
        className={style}
        disabled={remind.isPending || sent}
        onClick={async (event) => {
          event.stopPropagation()
          try {
            await remind.mutateAsync(undefined)
            setSent(true)
          } catch {
            setSent(false)
          }
        }}
      >
        {sent ? 'Reminded' : 'Remind'}
        {!sent && <ChevronRightIcon size={14} />}
      </button>
    )
  }
  return (
    <Link to={paths.report(row.sessionId)} onClick={(e) => e.stopPropagation()} className={style}>
      {paths.trainer && canWrite && row.state !== 'submitted' ? 'Write' : 'View'}
      <ChevronRightIcon size={14} />
    </Link>
  )
}
