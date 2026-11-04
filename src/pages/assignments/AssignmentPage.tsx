import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { FileRow } from '@/components/ui/FileRow'
import { DetailList } from '@/components/ui/FormLayout'
import { ArrowRightIcon, ChevronRightIcon, DownloadIcon, MailIcon } from '@/components/ui/icons'
import { Badge, FilterChips, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Table, TableFooter, type Column } from '@/components/ui/Table'
import { openFile } from '@/lib/files'
import { plural } from '@/lib/format'
import { paginate } from '@/lib/paginate'
import { initials } from '@/lib/people'
import { downloadCsv } from '@/pages/admin/sessions/attendanceData'
import { assignmentBase, type Area } from './paths'
import { formatDue, statusLabel, statusTone, useAssignment, type AssignmentDetail, type ParticipantRow, type ParticipantStatus } from './data'

type Filter = 'all' | 'grade' | 'graded' | 'late' | 'missing'

const columns: Column[] = [
  { label: 'Participant' },
  { label: 'Status', width: 140 },
  { label: 'Submitted', width: 170, hideBelow: 'lg' },
  { label: 'Grade', width: 110 },
  { label: '', width: 80, align: 'right' },
]

export function StatusBadge({ status }: { status: ParticipantStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
}

const matches = (filter: Filter, r: ParticipantRow) =>
  filter === 'all' ||
  (filter === 'grade' && (r.status === 'submitted' || r.status === 'late')) ||
  (filter === 'graded' && r.status === 'graded') ||
  (filter === 'late' && r.status === 'late') ||
  (filter === 'missing' && (r.status === 'not_submitted' || r.status === 'overdue'))

/** T6.03 Assignment submissions (trainer) and C4.02 Assignment detail (admin, read-only). */
export function AssignmentPage({ area }: { area: Area }) {
  const { id = '' } = useParams()
  const query = useAssignment(id)
  const base = assignmentBase(area)
  const crumbs =
    area === 'admin'
      ? [
          { label: 'Courses & sessions', to: '/admin/courses' },
          { label: 'Assignments', to: base },
        ]
      : [{ label: 'Assignments', to: base }]
  if (query.isPending) return <div aria-busy="true" aria-label="Loading assignment" className="h-40" />
  if (query.isError) {
    const notFound = (query.error as { status?: number }).status === 404
    return (
      <>
        <PageHeader title={notFound ? 'Assignment not found' : 'Couldn’t load the assignment'} breadcrumb={crumbs} />
        <Panel>
          <StatePanel
            kind={notFound ? 'no-results' : 'error'}
            title={notFound ? 'It may have been removed, or it isn’t in your courses.' : 'Something went wrong'}
            description="Go back to the assignments list."
          />
        </Panel>
      </>
    )
  }
  return <AssignmentView area={area} crumbs={crumbs} {...query.data} />
}

function AssignmentView({
  area,
  crumbs,
  timeZone,
  assignment: a,
  participants,
  queue,
}: {
  area: Area
  crumbs: { label: string; to: string }[]
  timeZone: string
  assignment: AssignmentDetail
  participants: ParticipantRow[]
  queue: string[]
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const saved = (location.state as { saved?: 'saved' | 'published' } | null)?.saved
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const base = assignmentBase(area)
  const grading = area === 'trainer' && a.canGrade
  const pastDue = a.status === 'closed'
  const missingLabel = pastDue && a.latePolicy === 'accept_late' ? 'Overdue' : 'Not submitted'
  const visible = participants.filter((r) => matches(filter, r))
  const paged = paginate(visible, page)
  const submissionPath = (memberId: string) => `${base}/${a.id}/submissions/${memberId}`

  function exportGrades() {
    downloadCsv(`grades-${a.title}.csv`.replace(/\s+/g, '-').toLowerCase(), [
      ['Participant', 'Email', 'Status', 'Submitted', 'Grade'],
      ...participants.map((r) => [r.name, r.email, statusLabel[r.status], r.submittedAt ? formatDue(r.submittedAt, timeZone) : '', r.grade ?? '']),
    ])
  }

  const description = [
    a.course.name,
    a.cohort.name,
    a.status === 'draft' ? `Draft · due ${formatDue(a.dueAt, timeZone)}` : `${pastDue ? 'Closed' : 'Due'} ${formatDue(a.dueAt, timeZone)}`,
    area === 'admin' && a.setBy ? `Set by ${a.setBy.name}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const actions =
    area === 'trainer' ? (
      <>
        {a.canEdit && (
          <Button variant="secondary" onClick={() => navigate(`${base}/${a.id}/edit`)}>
            Edit
          </Button>
        )}
        {grading && queue.length > 0 && (
          <Button icon={<ArrowRightIcon size={16} />} onClick={() => navigate(submissionPath(queue[0]!))}>
            Grade next
          </Button>
        )}
      </>
    ) : (
      <>
        <Button variant="secondary" icon={<DownloadIcon size={16} />} onClick={exportGrades}>
          Export grades
        </Button>
        {a.setBy?.email && (
          <a
            href={`mailto:${a.setBy.email}?subject=${encodeURIComponent(a.title)}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-strong bg-surface pr-4 pl-3 text-label-button text-primary hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
          >
            <MailIcon size={16} />
            Email trainer
          </a>
        )}
      </>
    )

  return (
    <>
      <PageHeader
        breadcrumb={[...crumbs, { label: a.title }]}
        title={a.title}
        badge={a.status === 'draft' ? <Badge tone="neutral">Draft</Badge> : undefined}
        description={description}
        actions={actions}
      />
      {saved && (
        <AlertBanner tone="success" title={saved === 'published' ? `${a.title} was published` : 'Changes saved'}>
          {saved === 'published' ? 'Participants in the cohort can see it on their course.' : 'Participants see the updated assignment.'}
        </AlertBanner>
      )}
      {a.status === 'draft' && <AlertBanner title="This is a draft">Participants can’t see it yet. Open Edit and publish it when it’s ready.</AlertBanner>}

      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-3 max-lg:w-full">
          <FilterChips
            label="Submissions"
            value={filter}
            onChange={(value) => {
              setFilter(value)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All', count: participants.length },
              {
                value: 'grade',
                label: 'To grade',
                count: participants.filter((r) => matches('grade', r)).length,
              },
              {
                value: 'graded',
                label: 'Graded',
                count: participants.filter((r) => r.status === 'graded').length,
              },
              {
                value: 'late',
                label: 'Late',
                count: participants.filter((r) => r.status === 'late').length,
              },
              {
                value: 'missing',
                label: missingLabel,
                count: participants.filter((r) => matches('missing', r)).length,
              },
            ]}
          />
          <Panel aria-labelledby="submissions-title" className="gap-3">
            <PanelHeader
              id="submissions-title"
              title="Submissions"
              description={
                area === 'admin'
                  ? 'Admins can open any submission. Grades are set by the trainer.'
                  : grading
                    ? 'Grade from the queue; participants see a grade as soon as you save it.'
                    : undefined
              }
            />
            {participants.length === 0 ? (
              <StatePanel kind="empty" title="No one is enrolled in this cohort" description="Participants appear here once they’re added to the cohort." />
            ) : visible.length === 0 ? (
              <StatePanel
                kind="no-results"
                title={filter === 'grade' ? 'Nothing to grade' : 'No one here'}
                description={filter === 'grade' ? 'Every submission has a grade.' : 'Try another filter.'}
              />
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns}>
                    {paged.rows.map((r) => {
                      const canOpen = Boolean(r.submittedAt)
                      const label = grading && (r.status === 'submitted' || r.status === 'late') ? 'Grade' : 'View'
                      return (
                        <Row key={r.memberId} to={canOpen ? submissionPath(r.memberId) : undefined}>
                          <Cell>
                            <span className="flex min-w-0 items-center gap-2">
                              <Avatar initials={initials(r.name)} seed={r.memberId} />
                              <span className="truncate text-body-strong">{r.name}</span>
                            </span>
                          </Cell>
                          <Cell>
                            <StatusBadge status={r.status} />
                          </Cell>
                          <Cell hideBelow="lg" className="tabular-nums">
                            {r.submittedAt ? formatDue(r.submittedAt, timeZone) : <span className="text-muted">—</span>}
                          </Cell>
                          <Cell className="tabular-nums">{r.grade ?? <span className="text-muted">—</span>}</Cell>
                          <Cell align="right">
                            {canOpen && (
                              <Link
                                to={submissionPath(r.memberId)}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline"
                              >
                                {label}
                                <ChevronRightIcon size={14} />
                              </Link>
                            )}
                          </Cell>
                        </Row>
                      )
                    })}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {paged.rows.map((r) => {
                    const body = (
                      <>
                        <Avatar initials={initials(r.name)} seed={r.memberId} size={32} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">{r.name}</span>
                          <span className="truncate text-caption text-secondary">
                            {r.submittedAt ? `${formatDue(r.submittedAt, timeZone)}${r.grade ? ` · ${r.grade}` : ''}` : 'Nothing submitted'}
                          </span>
                        </span>
                        <StatusBadge status={r.status} />
                      </>
                    )
                    return (
                      <li key={r.memberId} className="border-b border-default last:border-b-0">
                        {r.submittedAt ? (
                          <Link to={submissionPath(r.memberId)} className="flex items-center gap-3 py-3">
                            {body}
                            <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 py-3">{body}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            <TableFooter summary={plural(visible.length, 'participant')} page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </Panel>
        </div>

        <aside className="flex w-[356px] shrink-0 flex-col gap-4 max-lg:w-full">
          <Panel aria-labelledby="details-title">
            <PanelHeader id="details-title" title="Details" />
            <DetailList
              items={[
                { label: 'Due', value: formatDue(a.dueAt, timeZone) },
                {
                  label: 'Grading',
                  value: a.gradingScale === 'rubric' ? `${a.scaleLabel} · ${a.criteriaCount * 4} points` : a.scaleLabel,
                },
                {
                  label: 'Submitted',
                  value: `${a.counts.submitted} of ${a.counts.expected}${a.counts.late ? ` · ${a.counts.late} late` : ''}`,
                },
                {
                  label: 'Graded',
                  value: `${a.counts.graded} of ${a.counts.submitted}`,
                },
                {
                  label: 'Late work',
                  value: a.latePolicy === 'accept_late' ? 'Accepted, marked late' : 'Not accepted',
                },
                {
                  label: 'Can submit',
                  value: a.submissionTypes.map((t) => ({ file: 'File', link: 'Link', text: 'Text' })[t]).join(', '),
                },
              ]}
            />
          </Panel>
          {(a.brief || a.links.length > 0 || a.files.length > 0 || a.criteria.length > 0) && (
            <Panel aria-labelledby="brief-title" className="gap-3">
              <PanelHeader id="brief-title" title="Brief" />
              {a.brief && <p className="text-body whitespace-pre-line text-primary">{a.brief}</p>}
              {a.files.map((f) => (
                <FileRow key={f.id} name={f.name} size={f.size} onDownload={() => openFile(`/v1/assignments/${a.id}/files/${f.id}`, f.name)} />
              ))}
              {a.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit max-w-full items-center gap-1 text-caption-strong text-brand-text hover:underline"
                >
                  <span className="truncate">{l.name}</span>
                  <ChevronRightIcon size={14} className="shrink-0" />
                </a>
              ))}
              {a.criteria.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-default pt-3">
                  <span className="text-caption-strong text-secondary">Rubric · each criterion scored 1–4</span>
                  <ol className="flex flex-col gap-1.5">
                    {a.criteria.map((c) => (
                      <li key={c.id} className="flex flex-col">
                        <span className="text-body-strong text-primary">{c.title}</span>
                        {c.description && <span className="text-caption text-secondary">{c.description}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Panel>
          )}
        </aside>
      </div>
    </>
  )
}
