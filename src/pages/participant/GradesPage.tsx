import { Link, useParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { CheckCircleIcon, ChevronRightIcon } from '@/components/ui/icons'
import { Badge, EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Stacked, Table, type Column } from '@/components/ui/Table'
import { formatDay } from '@/lib/format'
import { formatDue, scaleName } from '@/pages/assignments/data'
import { useMyAssignment, useMyGrades } from './data'
import { GradesHeader } from './ProgressPage'
import { SubmissionContent } from './MyAssignmentPage'

const BASE = '/participant/grades'

const columns: Column[] = [
  { label: 'Assignment' },
  { label: 'Grade', width: 120 },
  { label: 'Scale', width: 140, hideBelow: 'lg' },
  { label: 'Graded', width: 130 },
  { label: '', width: 80, align: 'right' },
]

/** /participant/grades — P6.01 Grades & feedback, P6.01e empty. */
export function GradesPage() {
  const query = useMyGrades()
  const grades = query.data?.grades ?? []
  const timeZone = query.data?.timeZone

  return (
    <>
      <GradesHeader />
      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Loading grades" className="h-[240px]">
          <span className="sr-only">Loading grades</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load your grades"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : grades.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<CheckCircleIcon size={24} />}
            title="No grades yet"
            body="When you hand in an assignment, it shows here. Your grade and your trainer’s feedback appear as soon as they’re saved."
            actions={
              <Link
                to="/participant/assignments"
                className="inline-flex h-9 items-center rounded-md border border-strong bg-surface px-4 text-label-button text-primary hover:bg-surface-hover"
              >
                Go to assignments
              </Link>
            }
          />
        </Panel>
      ) : (
        <Panel className="gap-0 max-md:py-2">
          <div className="max-md:hidden">
            <Table columns={columns}>
              {grades.map((g) => (
                <Row key={g.id} to={g.grade ? g.id : undefined}>
                  <Cell>
                    <Stacked primary={g.title} secondary={g.course.name} />
                  </Cell>
                  <Cell className="text-body-strong tabular-nums">{g.grade ?? <span className="font-normal text-secondary">Waiting</span>}</Cell>
                  <Cell hideBelow="lg">{scaleName[g.gradingScale]}</Cell>
                  <Cell className="tabular-nums">{g.gradedAt ? formatDay(g.gradedAt, timeZone) : <span className="text-muted">—</span>}</Cell>
                  <Cell align="right">
                    {g.grade && (
                      <Link
                        to={g.id}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline"
                      >
                        View
                        <ChevronRightIcon size={14} />
                      </Link>
                    )}
                  </Cell>
                </Row>
              ))}
            </Table>
          </div>
          <ul className="md:hidden">
            {grades.map((g) => {
              const body = (
                <>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{g.title}</span>
                    <span className="truncate text-caption text-secondary">
                      {g.course.name}
                      {g.gradedAt ? ` · ${formatDay(g.gradedAt, timeZone)}` : ''}
                    </span>
                  </span>
                  <span className="text-body-strong text-primary tabular-nums">{g.grade ?? <span className="font-normal text-secondary">Waiting</span>}</span>
                </>
              )
              return (
                <li key={g.id} className="border-b border-default last:border-b-0">
                  {g.grade ? (
                    <Link to={g.id} className="flex items-center gap-3 py-3">
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
        </Panel>
      )}
    </>
  )
}

/** /participant/grades/:id — P6.02 Feedback, P6.02b with rubric. */
export function FeedbackPage() {
  const { id = '' } = useParams()
  const query = useMyAssignment(id)
  if (query.isPending) return <div aria-busy="true" aria-label="Loading feedback" className="h-40" />
  if (query.isError || !query.data.grade) {
    return (
      <>
        <PageHeader title="No grade yet" breadcrumb={[{ label: 'Grades & feedback', to: BASE }]} />
        <Panel>
          <StatePanel
            kind="no-results"
            title="This hasn’t been graded yet"
            description="Your grade and feedback appear here as soon as your trainer saves them."
          />
        </Panel>
      </>
    )
  }
  const { timeZone, assignment: a, submission: s, grade: g } = query.data
  const [score, outOf] = a.gradingScale === 'points' || a.gradingScale === 'rubric' ? (g.display ?? '').split(' / ') : [g.display, null]
  const scoreOf = (criterionId: string) => g.rubric.find((r) => r.criterionId === criterionId)?.score ?? 0

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Grades & feedback', to: BASE }, { label: a.title }]}
        title={a.title}
        badge={<Badge tone="success">Graded</Badge>}
        description={[a.course.name, s ? `Submitted ${formatDue(s.submittedAt, timeZone)} · ${s.late ? 'late' : 'on time'}` : null].filter(Boolean).join(' · ')}
      />
      <div className="flex items-start gap-4 max-lg:flex-col-reverse">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          <Panel aria-labelledby="feedback-title" className="gap-3">
            <PanelHeader id="feedback-title" title={g.gradedBy ? `Feedback from ${g.gradedBy}` : 'Feedback'} />
            <p className="text-body whitespace-pre-line text-primary">
              {g.feedback ?? <span className="text-secondary">No written feedback for this one.</span>}
            </p>
          </Panel>
          {a.gradingScale === 'rubric' && (
            <Panel aria-labelledby="rubric-title" className="gap-0">
              <PanelHeader id="rubric-title" title="Rubric" description="Each criterion is scored 1–4." />
              <ol className="mt-3 border-t border-default">
                {a.criteria.map((c) => {
                  const score = scoreOf(c.id)
                  return (
                    <li key={c.id} className="flex items-center gap-4 border-b border-default py-3 max-md:flex-col max-md:items-start max-md:gap-2">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body-strong text-primary">{c.title}</span>
                        {c.description && <span className="text-caption text-secondary">{c.description}</span>}
                      </span>
                      <span className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex gap-1">
                          {[1, 2, 3, 4].map((n) => (
                            <span key={n} className={n <= score ? 'h-1.5 w-5 rounded-full bg-brand' : 'h-1.5 w-5 rounded-full bg-[var(--chart-track)]'} />
                          ))}
                        </span>
                        <span className="w-10 text-right text-body-strong text-primary tabular-nums">{score} / 4</span>
                      </span>
                    </li>
                  )
                })}
              </ol>
              <p className="flex justify-between pt-3 text-body-strong text-primary">
                <span>Total</span>
                <span className="tabular-nums">{g.display}</span>
              </p>
            </Panel>
          )}
          {s && (
            <Panel aria-labelledby="yours-title" className="gap-3">
              <PanelHeader id="yours-title" title="Your submission" />
              <SubmissionContent assignmentId={a.id} submission={s} />
            </Panel>
          )}
        </div>
        <aside className="w-[356px] shrink-0 max-lg:w-full">
          <Panel aria-labelledby="grade-title" className="gap-1">
            <PanelHeader id="grade-title" title="Grade" />
            <p className="flex items-baseline gap-2 pt-1">
              <span className="text-metric-large text-primary">{score}</span>
              {outOf && <span className="text-body text-secondary">/ {outOf}</span>}
            </p>
            <p className="text-caption text-secondary">
              {scaleName[a.gradingScale]} · graded{g.gradedBy ? ` by ${g.gradedBy}` : ''} on {formatDay(g.gradedAt, timeZone)}
            </p>
          </Panel>
        </aside>
      </div>
    </>
  )
}
