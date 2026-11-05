import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { RecordingPanel } from '@/components/sessions/Recording'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { DetailList } from '@/components/ui/FormLayout'
import { Video } from 'lucide-react'
import { ChartIcon, ChevronRightIcon, ClipboardIcon, CloseIcon, InfoTriangleIcon, PencilIcon, UserGroupIcon } from '@/components/ui/icons'
import { Metrics } from '@/components/ui/Metrics'
import { useRemind } from '@/pages/reports/data'
import { Badge, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { formatDay, formatDayWithYear, formatTime, formatTimeRange, plural, weekdayList } from '@/lib/format'
import { isPast, startClass, useCancelSession, useSession, whereLabel, type SessionDetail } from './data'
import { useSessionPaths } from './paths'
import { ResourcesPanel } from './ResourcesPanel'
import { SessionStatusBadge } from './SessionRow'

/** /admin/courses/sessions/:id — C1.03 Session detail; /trainer/sessions/:id — T3.02, T3.02b held. */
export function SessionDetailPage() {
  const { id = '' } = useParams()
  const paths = useSessionPaths()
  const query = useSession(id)
  if (query.isPending) return <div aria-busy="true" aria-label="Loading session" className="h-40" />
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <>
        <PageHeader title={missing ? 'Session not found' : 'Couldn’t load this session'} breadcrumb={[{ label: paths.listLabel, to: paths.list }]} />
        <Panel>
          <StatePanel kind={missing ? 'no-results' : 'error'} title={missing ? 'This session doesn’t exist' : 'Something went wrong'} />
        </Panel>
      </>
    )
  }
  return <SessionView data={query.data} />
}

function SessionView({ data }: { data: SessionDetail }) {
  const { session: s, can } = data
  const { state } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const paths = useSessionPaths()
  const trainerArea = paths.area === 'trainer'
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const [cancelling, setCancelling] = useState(false)
  const [copied, setCopied] = useState(false)
  const notice = (location.state as { notice?: string } | null)?.notice

  const day = formatDay(s.startsAt, timeZone)
  const when = `${formatDayWithYear(s.startsAt, timeZone)}, ${formatTimeRange(s.startsAt, s.endsAt, timeZone)}${s.series ? ` · repeats ${weekdayList(s.series.weekdays)}` : ''}`
  const scheduled = s.status === 'scheduled'
  const past = s.status === 'held' || s.status === 'in_progress'
  const reportOverdue = s.status === 'held' && !s.report.submittedAt && isPast(s.report.dueAt)
  const rate = s.attendance.recorded ? Math.round((s.attendance.present / s.attendance.recorded) * 100) : null
  const canJoin = Boolean(s.joinUrl) && (s.status === 'scheduled' || s.status === 'in_progress')
  const reportDue = `${formatDay(s.report.dueAt, timeZone)}, ${formatTime(s.report.dueAt, timeZone)}`

  // A Synqop Zoom meeting can be started as host from here (pilot feedback, Nov 2026).
  const canStart = Boolean(s.zoom?.managed) && canJoin && (trainerArea || can.schedule)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  async function start() {
    setStarting(true)
    setStartError(null)
    setStartError(await startClass(s.id))
    setStarting(false)
  }

  async function copy() {
    if (!s.joinUrl) return
    await navigator.clipboard.writeText(s.joinUrl).catch(() => undefined)
    setCopied(true)
  }

  const actions = (
    <>
      {scheduled && can.schedule && (
        <>
          <Button variant="secondary" icon={<CloseIcon size={16} />} onClick={() => setCancelling(true)}>
            Cancel session
          </Button>
          <Button variant={trainerArea && canJoin ? 'secondary' : 'primary'} icon={<PencilIcon size={16} />} onClick={() => navigate('edit')}>
            Edit session
          </Button>
        </>
      )}
      {!trainerArea && past && !s.cancelled && can.attendance && (
        <>
          <Button variant={s.attendance.recorded ? 'secondary' : 'primary'} icon={<ClipboardIcon size={16} />} onClick={() => navigate('attendance')}>
            {s.attendance.recorded ? 'Open register' : 'Take attendance'}
          </Button>
        </>
      )}
      {trainerArea && s.status === 'held' && can.attendance && s.attendance.recorded > 0 && (
        <Button variant="secondary" onClick={() => navigate('attendance')}>
          Edit attendance
        </Button>
      )}
      {trainerArea && s.status === 'held' && can.report && (
        <Button variant={s.report.submittedAt ? 'secondary' : 'primary'} onClick={() => navigate(`/trainer/reports/${s.id}`)}>
          {s.report.submittedAt ? 'View report' : 'Write report'}
        </Button>
      )}
      {trainerArea && canStart && (
        <Button icon={<Video aria-hidden className="size-4" />} onClick={() => void start()} disabled={starting}>
          {starting ? 'Opening Zoom…' : 'Start class'}
        </Button>
      )}
      {trainerArea && canJoin && !canStart && (
        <a
          href={s.joinUrl!}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand pr-4 pl-3 text-label-button text-on-brand hover:bg-brand-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
        >
          <Video aria-hidden className="size-4" />
          {whereLabel(s) === 'Online · Zoom' ? 'Join Zoom' : 'Join meeting'}
        </a>
      )}
    </>
  )

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: paths.listLabel, to: paths.list }, { label: `${s.title} · ${day}` }]}
        title={s.title}
        badge={<SessionStatusBadge status={s.status} />}
        description={[
          s.cohort.name,
          s.number && `Session ${s.number} of ${s.total}`,
          `${day}, ${formatTimeRange(s.startsAt, s.endsAt, timeZone)}`,
          trainerArea ? whereLabel(s) : s.trainer?.name,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={actions}
      />
      {notice && <AlertBanner tone="success" title={notice} />}
      {startError && (
        <AlertBanner tone="error" title="Couldn’t start the class">
          {startError}
        </AlertBanner>
      )}
      {s.cancelled && (
        <AlertBanner title={`Cancelled${s.cancelled.by ? ` by ${s.cancelled.by}` : ''} on ${formatDay(s.cancelled.at, timeZone)}`}>
          {s.cancelled.reason ? `Reason: ${s.cancelled.reason}. ` : ''}Cancelled sessions don’t count towards attendance or delivery, and need no report.
        </AlertBanner>
      )}
      {s.zoom?.problem && !s.cancelled && (
        <AlertBanner tone="warning" title="Zoom needs a look">
          {s.zoom.problem}
        </AlertBanner>
      )}
      {s.zoom && s.zoom.unmatched > 0 && can.attendance && (
        <AlertBanner tone="warning" title={`${s.zoom.unmatched} Zoom ${s.zoom.unmatched === 1 ? 'attendee' : 'attendees'} to match`}>
          Zoom couldn’t link {s.zoom.unmatched === 1 ? 'this name' : 'these names'} to anyone in {s.cohort.name}.{' '}
          <Link to="attendance/zoom" className="font-medium underline">
            Match Zoom attendees
          </Link>
        </AlertBanner>
      )}
      {trainerArea && can.report && reportOverdue && (
        <AlertBanner tone="warning" title="Your session report is overdue">
          It was due {reportDue}. Admins can see it’s late — a late report still counts.
        </AlertBanner>
      )}

      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          {trainerArea && !s.cancelled && (
            <Panel aria-labelledby="attendance-title" className="gap-0">
              <PanelHeader
                id="attendance-title"
                title="Attendance"
                description={
                  scheduled
                    ? s.mode === 'in_person'
                      ? 'In person — you mark the register when the session starts.'
                      : 'The register opens when the session starts. Mark it by hand until Zoom is connected.'
                    : s.attendance.recorded
                      ? `${s.attendance.recorded} of ${s.expected} recorded.`
                      : 'Not recorded yet.'
                }
              />
              <DetailList
                items={[
                  { label: 'Expected', value: plural(s.expected, 'participant') },
                  ...(past ? [{ label: 'Present', value: s.attendance.recorded ? `${s.attendance.present} · ${rate}% of those recorded` : '—' }] : []),
                  {
                    label: 'Register',
                    value: scheduled ? (
                      `Opens at ${formatTime(s.startsAt, timeZone)}`
                    ) : s.attendance.recorded ? (
                      'Saved'
                    ) : (
                      <Badge tone="warning">Not recorded</Badge>
                    ),
                  },
                ]}
              />
              {past && can.attendance && (
                <div className="pt-3">
                  <Button variant={s.attendance.recorded ? 'secondary' : 'primary'} onClick={() => navigate('attendance')}>
                    {s.attendance.recorded ? 'Open register' : 'Take attendance'}
                  </Button>
                </div>
              )}
            </Panel>
          )}
          {!trainerArea && past && !s.cancelled && (
            <Metrics
              items={[
                {
                  label: 'Present',
                  icon: <UserGroupIcon size={18} />,
                  value: s.attendance.recorded ? s.attendance.present : '—',
                  context: `of ${plural(s.expected, 'participant')} expected`,
                },
                {
                  label: 'Attendance',
                  icon: <ChartIcon size={18} />,
                  value: rate === null ? '—' : `${rate}%`,
                  context: s.attendance.recorded ? `${s.attendance.present} ÷ ${s.attendance.recorded} · present ÷ recorded` : 'Not recorded yet',
                },
                s.zoom
                  ? {
                      label: 'To review',
                      icon: <InfoTriangleIcon size={18} />,
                      value: s.zoom.unmatched,
                      tone: s.zoom.unmatched ? ('warning' as const) : undefined,
                      context: 'Zoom attendees not matched',
                    }
                  : {
                      label: 'Not marked',
                      icon: <InfoTriangleIcon size={18} />,
                      value: Math.max(0, s.expected - s.attendance.recorded),
                      tone: s.expected - s.attendance.recorded > 0 ? ('warning' as const) : undefined,
                      context: 'Participants without a mark',
                    },
              ]}
            />
          )}
          {!trainerArea && past && !s.cancelled && <AdminReportPanel data={data} timeZone={timeZone} />}
          {!trainerArea && !(past && !s.cancelled) && (
            <Panel aria-labelledby="details-title">
              <PanelHeader id="details-title" title="Details" />
              <DetailList items={details(data, when, paths, true)} />
            </Panel>
          )}
          {!s.cancelled && <ResourcesPanel data={data} />}
          {trainerArea && s.status === 'held' && (
            <Panel className="gap-0">
              <PanelHeader title="Participant feedback" description="Anonymous. Only you and admins see it." />
              <Link
                to="feedback"
                className="flex items-center justify-between gap-3 border-b border-default py-3 text-body-strong text-primary hover:text-brand-text"
              >
                See ratings and comments
                <span className="text-caption-strong text-brand-text">View</span>
              </Link>
            </Panel>
          )}
        </div>

        <div className="flex w-[356px] shrink-0 flex-col gap-4 max-lg:w-full">
          {!trainerArea && past && !s.cancelled && (
            <>
              <Panel aria-labelledby="details-title" className="gap-0">
                <PanelHeader id="details-title" title="Details" />
                <DetailList items={details(data, when, paths, false)} />
              </Panel>
              <Panel aria-labelledby="more-title" className="gap-0">
                <PanelHeader id="more-title" title="More about this session" />
                <Link
                  to="attendance/history"
                  className="flex items-center justify-between border-b border-default py-3 text-body text-primary last:border-b-0 hover:text-brand-text"
                >
                  Attendance changes
                  <ChevronRightIcon size={16} className="text-icon-muted" />
                </Link>
                {s.status === 'held' && (
                  <Link to="feedback" className="flex items-center justify-between py-3 text-body text-primary hover:text-brand-text">
                    Participant feedback
                    <ChevronRightIcon size={16} className="text-icon-muted" />
                  </Link>
                )}
              </Panel>
            </>
          )}
          {!s.cancelled && !trainerArea && !past && (
            <Panel aria-labelledby="attendance-title">
              <PanelHeader
                id="attendance-title"
                title="Attendance"
                description={
                  scheduled
                    ? 'Marked from the register once the session starts. You or the trainer can record it.'
                    : s.attendance.recorded
                      ? `${s.attendance.recorded} of ${s.expected} recorded`
                      : 'Not recorded yet.'
                }
              />
              {past && rate !== null && (
                <div className="flex items-baseline gap-2">
                  <span className="text-metric-large text-primary">{rate}%</span>
                  <span className="text-caption text-secondary">
                    {s.attendance.present} present ÷ {s.attendance.recorded} recorded
                  </span>
                </div>
              )}
              {past && s.attendance.recorded === 0 && (
                <div>
                  <Badge tone="warning">Not recorded</Badge>
                </div>
              )}
              {past && (
                <Button variant={s.attendance.recorded ? 'secondary' : 'primary'} fullWidth onClick={() => navigate('attendance')}>
                  {s.attendance.recorded ? 'Open register' : 'Take attendance'}
                </Button>
              )}
              {s.status === 'held' && (
                <Button variant="secondary" fullWidth onClick={() => navigate('feedback')}>
                  Participant feedback
                </Button>
              )}
            </Panel>
          )}
          {!s.cancelled && (trainerArea || !past) && (
            <Panel aria-labelledby="report-title">
              <PanelHeader
                id="report-title"
                title="Session report"
                description={
                  s.report.submittedAt
                    ? `Submitted ${formatDay(s.report.submittedAt, timeZone)}.`
                    : trainerArea
                      ? `Due ${reportDue} — ${s.status === 'held' ? 'after the session ended' : 'after the session ends'}.`
                      : `${s.trainer ? s.trainer.name.split(' ')[0] : 'The trainer'} submits it after the session. Due ${reportDue}.`
                }
              />
              {(reportOverdue || s.report.submittedAt) && (
                <div>{reportOverdue ? <Badge tone="error">Overdue</Badge> : <Badge tone="success">Submitted</Badge>}</div>
              )}
              {trainerArea && !s.report.submittedAt && !can.report && <p className="text-caption text-secondary">Written by the course’s lead trainer.</p>}
              {s.status === 'held' && (trainerArea ? can.report || s.report.submittedAt : true) && (
                <Link
                  to={trainerArea ? `/trainer/reports/${s.id}` : `/admin/courses/reports/${s.id}`}
                  className="inline-flex items-center gap-1 text-caption-strong text-brand-text hover:underline"
                >
                  {trainerArea && can.report && !s.report.submittedAt ? 'Write report' : 'View report'}
                  <ChevronRightIcon size={14} />
                </Link>
              )}
            </Panel>
          )}
          {trainerArea && (
            <Panel aria-labelledby="details-title" className="gap-0">
              <PanelHeader id="details-title" title="Details" />
              <DetailList items={details(data, when, paths, false)} />
            </Panel>
          )}
          {s.recording && <RecordingPanel recording={s.recording} />}
          {canStart && !trainerArea && (
            <Button fullWidth icon={<Video aria-hidden className="size-4" />} onClick={() => void start()} disabled={starting}>
              {starting ? 'Opening Zoom…' : 'Start class as host'}
            </Button>
          )}
          {s.joinUrl && !s.cancelled && !trainerArea && !past && (
            <Button variant="secondary" fullWidth icon={<Video aria-hidden className="size-4" />} onClick={copy}>
              {copied ? 'Link copied' : whereLabel(s) === 'Online · Zoom' ? 'Copy Zoom link' : 'Copy meeting link'}
            </Button>
          )}
        </div>
      </div>

      {scheduled && can.schedule && <CancelSessionDialog open={cancelling} onClose={() => setCancelling(false)} data={data} timeZone={timeZone} />}
    </>
  )
}

/** C1.03b Session report: submitted, or overdue with a reminder to the trainer. */
function AdminReportPanel({ data, timeZone }: { data: SessionDetail; timeZone: string | undefined }) {
  const s = data.session
  const remind = useRemind(s.id)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const overdue = s.status === 'held' && !s.report.submittedAt && isPast(s.report.dueAt)
  const due = `${formatDay(s.report.dueAt, timeZone)}, ${formatTime(s.report.dueAt, timeZone)}`
  const who = s.trainer?.name ?? 'The trainer'
  return (
    <Panel aria-labelledby="report-title">
      <PanelHeader id="report-title" title="Session report" description={`Due ${due}.`} />
      <div className="flex flex-wrap items-center gap-3">
        {s.report.submittedAt ? (
          <>
            <Badge tone="success">Submitted</Badge>
            <span className="text-body text-secondary">
              {who} submitted it on {formatDay(s.report.submittedAt, timeZone)}.
            </span>
          </>
        ) : overdue ? (
          <>
            <Badge tone="error">Overdue</Badge>
            <span className="text-body text-secondary">
              {who} hasn’t submitted it. It was due {due}.
            </span>
          </>
        ) : (
          <span className="text-body text-secondary">{s.status === 'in_progress' ? 'The session is still running.' : `${who} hasn’t submitted it yet.`}</span>
        )}
      </div>
      {s.report.submittedAt ? (
        <Link to={`/admin/courses/reports/${s.id}`} className="inline-flex items-center gap-1 self-start text-caption-strong text-brand-text hover:underline">
          View report
          <ChevronRightIcon size={14} />
        </Link>
      ) : (
        s.status === 'held' &&
        s.trainer && (
          <button
            type="button"
            disabled={remind.isPending || Boolean(sentTo)}
            onClick={() => remind.mutate(undefined, { onSuccess: (r) => setSentTo(r.to) })}
            className="inline-flex items-center gap-1 self-start text-caption-strong text-brand-text hover:underline disabled:text-secondary disabled:no-underline"
          >
            {sentTo ? `Reminder sent to ${sentTo}` : remind.isPending ? 'Sending…' : `Remind ${s.trainer.name.split(' ')[0]}`}
            {!sentTo && <ChevronRightIcon size={14} />}
          </button>
        )
      )}
    </Panel>
  )
}

function details(data: SessionDetail, when: string, paths: ReturnType<typeof useSessionPaths>, full: boolean) {
  const s = data.session
  const where = s.joinUrl ? (
    <>
      {whereLabel(s)} ·{' '}
      <a href={s.joinUrl} target="_blank" rel="noreferrer" className={`font-normal text-brand-text underline ${full ? 'break-all' : 'whitespace-nowrap'}`}>
        {full ? s.joinUrl : 'meeting link'}
      </a>
    </>
  ) : s.mode === 'online' ? (
    <>
      Online · <span className="font-normal text-muted">{s.zoom?.pending ? 'Zoom meeting being created…' : 'no meeting link yet'}</span>
    </>
  ) : (
    whereLabel(s)
  )
  const trainerLink = paths.trainer
  return [
    { label: 'When', value: when },
    { label: 'Where', value: where },
    ...(full ? [{ label: 'Course', value: s.course.name }] : []),
    {
      label: 'Cohort',
      value: (
        <>
          <Link to={paths.cohort(s.cohort.id)} className="hover:underline">
            {s.cohort.name}
          </Link>
          {full && <span className="font-normal text-secondary"> · {plural(s.expected, 'participant')} expected</span>}
        </>
      ),
    },
    {
      label: 'Trainer',
      value: s.trainer ? (
        trainerLink ? (
          <Link to={trainerLink(s.trainer.id)} className="hover:underline">
            {s.trainer.name}
            {s.trainer.isLead ? ' (lead)' : ''}
          </Link>
        ) : (
          `${s.trainer.name}${s.trainer.isLead ? ' (lead)' : ''}`
        )
      ) : (
        <span className="font-normal text-muted">Not assigned</span>
      ),
    },
  ]
}

/** C1.05 / T3.07 Cancel session. */
function CancelSessionDialog({ open, onClose, data, timeZone }: { open: boolean; onClose: () => void; data: SessionDetail; timeZone: string | undefined }) {
  const s = data.session
  const cancel = useCancelSession(s.id)
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) return setError('Add a reason. Participants see it in the email.')
    setFailed(null)
    try {
      const result = await cancel.mutateAsync({ reason, notify })
      onClose()
      navigate('.', { replace: true, state: { notice: notify ? `Session cancelled. ${plural(result.emailed, 'email')} sent.` : 'Session cancelled.' } })
    } catch (err) {
      setFailed(err instanceof ApiError && err.status < 500 ? err.message : 'It wasn’t cancelled. Try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !cancel.isPending && onClose()}
      width={440}
      title="Cancel this session?"
      description={`${s.title} · ${formatDay(s.startsAt, timeZone)}, ${formatTimeRange(s.startsAt, s.endsAt, timeZone)} · ${s.cohort.name}`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={cancel.isPending}>
            Keep session
          </Button>
          <Button type="submit" form="cancel-session" variant="destructive" disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelling…' : 'Cancel session'}
          </Button>
        </>
      }
    >
      <form id="cancel-session" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {failed && (
          <AlertBanner tone="error" title="Couldn’t cancel">
            {failed}
          </AlertBanner>
        )}
        <TextField
          label="Reason"
          autoFocus
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setError(null)
          }}
          error={error}
          helper="Shown to participants in the email."
        />
        <Checkbox label="Email participants and the trainer" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        <AlertBanner title="Cancelled sessions don’t count">They’re left out of attendance and delivery progress, and need no session report.</AlertBanner>
      </form>
    </Dialog>
  )
}
