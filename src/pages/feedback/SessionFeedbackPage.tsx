import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { Button } from '@/components/ui/Button'
import { CheckCircleIcon, DownloadIcon, FileIcon } from '@/components/ui/icons'
import { Metrics } from '@/components/ui/Metrics'
import { EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { api } from '@/lib/api'
import { formatDay, relativeDay } from '@/lib/format'
import { downloadCsv } from '@/pages/admin/sessions/attendanceData'

interface FeedbackSummary {
  timeZone: string
  session: { id: string; status: string; startsAt: string; course: string; cohort: string; number: number | null }
  responses: number
  attended: number
  average: number | null
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>
  comments: { comment: string; at: string }[]
}

type Area = 'admin' | 'trainer'

/** /admin/courses/sessions/:id/feedback (C5.01) and /trainer/sessions/:id/feedback (T7.04). Anonymous results. */
export function SessionFeedbackPage({ area }: { area: Area }) {
  const { id = '' } = useParams()
  const query = useQuery({
    queryKey: ['session-feedback', id],
    queryFn: ({ signal }) => api<FeedbackSummary>(`/v1/session-feedback/${id}`, { signal }),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })
  const sessionsBase = area === 'admin' ? '/admin/courses/sessions' : '/trainer/sessions'
  const root = area === 'admin' ? { label: 'Courses & sessions', to: '/admin/courses' } : { label: 'My sessions', to: '/trainer/sessions' }

  if (query.isPending) return <div aria-busy="true" aria-label="Loading feedback" className="h-40" />
  if (query.isError) {
    const notFound = (query.error as { status?: number }).status === 404
    return (
      <>
        <PageHeader title="Participant feedback" breadcrumb={[root]} />
        <Panel>
          <StatePanel
            kind={notFound ? 'no-results' : 'error'}
            title={notFound ? 'Session not found' : 'Couldn’t load the feedback'}
            description={notFound ? 'It may not be one of your sessions.' : 'Check your connection and try again.'}
          />
        </Panel>
      </>
    )
  }

  const d = query.data
  const day = relativeDay(d.session.startsAt, d.timeZone)
  const dayLabel = day === 'Today' || day === 'Yesterday' ? day : formatDay(d.session.startsAt, d.timeZone)
  const max = Math.max(1, ...Object.values(d.distribution))
  const commentRate = d.responses ? `${d.comments.length} of ${d.responses} left a comment. Shown without names.` : ''

  function exportCsv() {
    downloadCsv(`feedback-${d.session.course}-${dayLabel}.csv`.replace(/\s+/g, '-').toLowerCase(), [
      ['Rating', 'Count'],
      ...(['5', '4', '3', '2', '1'] as const).map((r) => [r, String(d.distribution[r])]),
      [],
      ['Comment', 'Date'],
      ...d.comments.map((c) => [c.comment, formatDay(c.at, d.timeZone)]),
    ])
  }

  return (
    <>
      <PageHeader
        breadcrumb={[root, { label: `${d.session.course} · ${dayLabel}`, to: `${sessionsBase}/${d.session.id}` }, { label: 'Feedback' }]}
        title="Participant feedback"
        description={
          [d.session.course, d.session.cohort, d.session.number ? `Session ${d.session.number}` : null, dayLabel].filter(Boolean).join(' · ') +
          (area === 'admin' ? '. Feedback is optional for participants.' : '. Anonymous — only you and admins see it.')
        }
        actions={
          d.responses > 0 ? (
            <Button variant="secondary" icon={<DownloadIcon size={16} />} onClick={exportCsv}>
              Export CSV
            </Button>
          ) : undefined
        }
      />
      {d.responses === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<FileIcon size={24} />}
            title="No responses yet"
            body={
              d.session.status === 'held'
                ? 'Participants can leave feedback from the session page. Results appear here as they come in.'
                : 'Participants can leave feedback once the session ends. Results appear here as they come in.'
            }
          />
        </Panel>
      ) : (
        <>
          <div className="[&>section]:grid-cols-2 max-md:[&>section]:grid-cols-1">
            <Metrics
              items={[
                {
                  label: 'Responses',
                  icon: <FileIcon size={18} />,
                  value: d.responses,
                  context: d.attended ? `of ${d.attended} who attended · ${Math.round((d.responses / d.attended) * 100)}%` : 'Attendance not recorded yet',
                },
                { label: 'Average rating', icon: <CheckCircleIcon size={18} />, value: d.average?.toFixed(1) ?? '—', context: 'out of 5' },
              ]}
            />
          </div>
          <div className="flex items-start gap-4 max-lg:flex-col">
            <Panel aria-labelledby="ratings-title" className="min-w-0 flex-1 gap-3 max-lg:w-full">
              <PanelHeader id="ratings-title" title="How useful was this session?" description="1 = not useful, 5 = very useful" />
              <dl className="flex flex-col gap-2.5">
                {(['5', '4', '3', '2', '1'] as const).map((r) => (
                  <div key={r} className="flex items-center gap-4">
                    <dt className="w-28 shrink-0 text-body text-secondary">{r === '5' ? '5 · Very useful' : r === '1' ? '1 · Not useful' : r}</dt>
                    <dd className="flex flex-1 items-center gap-4">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--chart-track)]" aria-hidden="true">
                        <span className="block h-full rounded-full bg-[var(--chart-present)]" style={{ width: `${(d.distribution[r] / max) * 100}%` }} />
                      </span>
                      <span className="w-8 text-right text-body-strong text-primary tabular-nums">{d.distribution[r]}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel aria-labelledby="comments-title" className="w-[460px] shrink-0 gap-2 max-lg:w-full">
              <PanelHeader id="comments-title" title="Comments" description={commentRate} />
              {d.comments.length === 0 ? (
                <p className="py-2 text-body text-secondary">No one left a comment.</p>
              ) : (
                <ul className="max-h-[480px] overflow-y-auto">
                  {d.comments.map((c, i) => (
                    <li key={i} className="flex flex-col gap-0.5 border-b border-default py-3 last:border-b-0">
                      <span className="text-body text-primary">“{c.comment}”</span>
                      <span className="text-caption text-secondary">Anonymous · {formatDay(c.at, d.timeZone)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  )
}
