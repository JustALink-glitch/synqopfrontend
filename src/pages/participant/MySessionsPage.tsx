import { Video } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { DetailList } from '@/components/ui/FormLayout'
import { TextAreaField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { CalendarIcon, ChevronRightIcon } from '@/components/ui/icons'
import { EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { formatDay, formatTime, formatTimeRange, localDate, plural, relativeDay, todayIn } from '@/lib/format'
import { addDays } from '@/lib/schedule'
import { addMonths, mondayOf, monthLabel, monthOf, useScheduleView, weekRange } from '@/components/sessions/period'
import { DayGroups, MonthCalendar, PeriodNav, ScheduleRow, ViewSwitch } from '@/components/sessions/Schedule'
import { duration, sessionWhere, useMySession, useMySessions, useRateSession, type MySession } from './data'
import { ResourceRow, SessionBadge } from './SessionBits'

const BASE = '/participant/sessions'

function when(s: MySession, timeZone?: string) {
  const day = relativeDay(s.startsAt, timeZone)
  return `${day === 'Today' || day === 'Yesterday' ? day : formatDay(s.startsAt, timeZone)} · ${formatTime(s.startsAt, timeZone)}`
}

function pastLine(s: MySession) {
  if (s.status === 'cancelled') return s.cancellationReason ? `Cancelled — ${s.cancellationReason}` : 'Cancelled by the trainer'
  const a = s.attendance
  return [sessionWhere(s), a?.minutesInMeeting ? `${duration(a.minutesInMeeting)} in the meeting` : null, a?.note].filter(Boolean).join(' · ')
}

function SessionLink({ s, timeZone, past }: { s: MySession; timeZone: string; past?: boolean }) {
  return (
    <li className="border-b border-default last:border-b-0">
      <Link to={`${BASE}/${s.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-hover">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-strong text-primary">
            {past ? formatDay(s.startsAt, timeZone) : when(s, timeZone)} · {s.course.name}
          </span>
          <span className="truncate text-caption text-secondary">
            {past ? pastLine(s) : [s.number ? `Session ${s.number}` : null, sessionWhere(s)].filter(Boolean).join(' · ')}
          </span>
        </span>
        {(past || s.status !== 'scheduled') && <SessionBadge session={s} />}
        <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
      </Link>
    </li>
  )
}

/** One session in the week list or calendar, in the same shape as the admin and trainer lists. */
function ScheduleLine({ s, timeZone }: { s: MySession; timeZone: string }) {
  return (
    <ScheduleRow
      to={`${BASE}/${s.id}`}
      startsAt={s.startsAt}
      endsAt={s.endsAt}
      timeZone={timeZone}
      title={s.course.name}
      detail={[s.number ? `Session ${s.number} of ${s.total}` : null, s.trainer].filter(Boolean).join(' · ') || null}
      where={sessionWhere(s)}
      mode={s.mode}
      cancelled={s.status === 'cancelled'}
      note={
        s.status === 'cancelled' && (
          <span className="truncate text-caption text-muted">{s.cancellationReason ? `Cancelled — ${s.cancellationReason}` : 'Cancelled'}</span>
        )
      }
      trailing={s.status !== 'scheduled' && s.status !== 'cancelled' && <SessionBadge session={s} />}
    />
  )
}

/** /participant/sessions — P4.01 Sessions: a week list or month calendar, and past attendance. */
export function MySessionsPage() {
  const query = useMySessions()
  const [view, setView] = useScheduleView('participant')
  const today = todayIn(query.data?.timeZone)
  const [week, setWeek] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [allPast, setAllPast] = useState(false)
  if (query.isPending) return <div aria-busy="true" aria-label="Loading sessions" className="h-40" />
  if (query.isError) {
    return (
      <>
        <PageHeader title="Sessions" />
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load your sessions"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      </>
    )
  }
  const { sessions, attendance: a, timeZone } = query.data
  const shownWeek = week ?? mondayOf(today)
  const shownMonth = month ?? monthOf(today)
  const inWeek = sessions.filter((s) => {
    const d = localDate(s.startsAt, timeZone)
    return d >= shownWeek && d <= addDays(shownWeek, 6)
  })
  const past = sessions.filter((s) => s.status === 'held').reverse()
  const thisWeek = shownWeek === mondayOf(today)
  const thisMonth = shownMonth === monthOf(today)
  const line = (s: MySession) => <ScheduleLine key={s.id} s={s} timeZone={timeZone} />

  return (
    <>
      <PageHeader
        title="Sessions"
        description={
          a.recorded
            ? `Your attendance: ${a.present} of ${plural(a.recorded, 'session')} · ${a.rate}%. Excused counts as not attended.`
            : 'Your attendance shows here after your first session.'
        }
      />
      {sessions.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<CalendarIcon size={24} />}
            title="No sessions yet"
            body="When your trainers schedule sessions for your courses, they appear here."
          />
        </Panel>
      ) : (
        <>
          <PeriodNav
            unit={view === 'calendar' ? 'month' : 'week'}
            label={view === 'calendar' ? monthLabel(shownMonth) : weekRange(shownWeek)}
            onMove={(step) => (view === 'calendar' ? setMonth(addMonths(shownMonth, step)) : setWeek(addDays(shownWeek, step * 7)))}
            onToday={() => (view === 'calendar' ? setMonth(monthOf(today)) : setWeek(mondayOf(today)))}
            atToday={view === 'calendar' ? thisMonth : thisWeek}
          >
            <ViewSwitch value={view} onChange={setView} />
          </PeriodNav>
          <div className="grid grid-cols-[minmax(0,1fr)_356px] items-start gap-4 max-lg:grid-cols-1">
            <Panel className="min-w-0 gap-4">
              {view === 'calendar' ? (
                <MonthCalendar
                  month={shownMonth}
                  today={today}
                  timeZone={timeZone}
                  items={sessions.map((s) => ({ ...s, title: s.course.name, cancelled: s.status === 'cancelled' }))}
                  colourKey={(s) => s.course.id}
                  colourLabel={(s) => s.course.name}
                  row={line}
                />
              ) : inWeek.length === 0 ? (
                <EmptyState icon={<CalendarIcon size={24} />} title="No sessions this week" body="Use the arrows to see other weeks." />
              ) : (
                <DayGroups items={inWeek.map((s) => ({ ...s, cancelled: s.status === 'cancelled' }))} timeZone={timeZone} today={today} row={line} />
              )}
            </Panel>
            <Panel aria-labelledby="past-title" className="gap-1">
              <div className="flex items-start justify-between gap-3">
                <PanelHeader id="past-title" title="Past sessions" description="Your attendance as recorded." />
                {past.length > 5 && !allPast && (
                  <button
                    type="button"
                    onClick={() => setAllPast(true)}
                    className="inline-flex h-7 shrink-0 items-center gap-1 text-caption-strong text-brand-text hover:underline"
                  >
                    All past
                    <ChevronRightIcon size={14} />
                  </button>
                )}
              </div>
              {past.length === 0 ? (
                <p className="py-3 text-body text-secondary">None yet.</p>
              ) : (
                <ul>
                  {(allPast ? past : past.slice(0, 5)).map((s) => (
                    <SessionLink key={s.id} s={s} timeZone={timeZone} past />
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

/** /participant/sessions/:id — P4.02 live now, P4.02b in person, P4.02c past. */
export function MySessionPage() {
  const { id = '' } = useParams()
  const query = useMySession(id)
  if (query.isPending) return <div aria-busy="true" aria-label="Loading session" className="h-40" />
  if (query.isError) {
    const notFound = (query.error as { status?: number }).status === 404
    return (
      <>
        <PageHeader title={notFound ? 'Session not found' : 'Couldn’t load the session'} breadcrumb={[{ label: 'Sessions', to: BASE }]} />
        <Panel>
          <StatePanel
            kind={notFound ? 'no-results' : 'error'}
            title={notFound ? 'It isn’t one of your sessions.' : 'Something went wrong'}
            description="Go back to your sessions."
          />
        </Panel>
      </>
    )
  }
  const { session: s, resources, timeZone, feedback } = query.data
  const day = relativeDay(s.startsAt, timeZone)
  const dayLabel = day === 'Today' || day === 'Yesterday' ? day : formatDay(s.startsAt, timeZone)
  const statusText = { scheduled: 'Scheduled', in_progress: 'In progress', held: 'Held', cancelled: 'Cancelled' }[s.status]
  const a = s.attendance

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Sessions', to: BASE }, { label: `${s.course.name} · ${dayLabel}` }]}
        title={s.course.name}
        badge={
          <span
            className={
              s.status === 'in_progress'
                ? 'inline-flex h-[22px] items-center gap-1.5 rounded-full bg-info-bg px-2 text-caption-strong text-info-fg'
                : 'inline-flex h-[22px] items-center gap-1.5 rounded-full bg-neutral-bg px-2 text-caption-strong text-neutral-fg'
            }
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {statusText}
          </span>
        }
        description={[
          s.number ? `Session ${s.number} of ${s.total}` : null,
          `${dayLabel}, ${formatTimeRange(s.startsAt, s.endsAt, timeZone)}`,
          sessionWhere(s),
          s.trainer,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          s.joinUrl ? (
            <a
              href={s.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand pr-4 pl-3 text-label-button text-on-brand hover:bg-brand-hover"
            >
              <Video aria-hidden className="size-4" />
              {s.joinUrl.includes('zoom.us') ? 'Join Zoom' : 'Join session'}
            </a>
          ) : undefined
        }
      />
      {s.status === 'cancelled' && (
        <AlertBanner tone="warning" title="This session was cancelled">
          {s.cancellationReason ?? 'Your trainer will let you know about any catch-up.'}
        </AlertBanner>
      )}
      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          {s.joinUrl && (
            <AlertBanner title="Join with the email you use on Synqop">
              Your attendance counts automatically when Zoom is connected. Please don’t share this link.
            </AlertBanner>
          )}
          {s.mode === 'online' && !s.joinUrl && s.status === 'scheduled' && (
            <AlertBanner title="The joining link appears here the day before">Check back on {formatDay(s.startsAt, timeZone)}.</AlertBanner>
          )}
          {s.mode === 'in_person' && s.status !== 'held' && s.status !== 'cancelled' && (
            <Panel aria-labelledby="where-title" className="gap-1">
              <PanelHeader id="where-title" title="Where to go" />
              <p className="text-body text-primary">{s.location ?? 'In person'}</p>
              <p className="text-caption text-secondary">Your trainer marks attendance in the room.</p>
            </Panel>
          )}
          {s.status === 'held' && (
            <Panel aria-labelledby="attendance-title" className="gap-1">
              <PanelHeader
                id="attendance-title"
                title="Your attendance"
                description={
                  a
                    ? a.source === 'zoom'
                      ? 'Recorded from Zoom.'
                      : a.source === 'edited'
                        ? 'Updated by your trainer.'
                        : 'Marked by your trainer.'
                    : 'Not recorded yet.'
                }
              />
              {a ? (
                <DetailList
                  items={[
                    { label: 'Status', value: { present: 'Present', absent: 'Absent', excused: 'Excused' }[a.status] },
                    ...(a.joinedAt ? [{ label: 'Joined', value: formatTime(a.joinedAt, timeZone) }] : []),
                    ...(a.minutesInMeeting !== null ? [{ label: 'In the meeting', value: duration(a.minutesInMeeting) }] : []),
                    ...(a.note ? [{ label: 'Note', value: a.note }] : []),
                  ]}
                />
              ) : null}
              <p className="text-caption text-secondary">Looks wrong? Tell your trainer — they can correct it.</p>
            </Panel>
          )}
          {feedback.canRate && <RatePanel sessionId={s.id} mine={feedback.mine} />}
          {s.status !== 'cancelled' && (
            <Panel aria-labelledby="resources-title" className="gap-1">
              <PanelHeader id="resources-title" title="Resources for this session" />
              {resources.length > 0 ? (
                <div>
                  {resources.map((r) => (
                    <ResourceRow key={r.id} resource={r} />
                  ))}
                </div>
              ) : (
                <p className="py-2 text-body text-secondary">Nothing shared yet. Slides, notes and links from your trainer show here.</p>
              )}
            </Panel>
          )}
        </div>
        <aside className="w-[356px] shrink-0 max-lg:w-full">
          <Panel aria-labelledby="session-details">
            <PanelHeader id="session-details" title="Details" />
            <DetailList
              items={[
                { label: 'When', value: `${dayLabel}, ${formatTimeRange(s.startsAt, s.endsAt, timeZone)}` },
                { label: 'Where', value: s.mode === 'online' ? sessionWhere(s).replace(', ', ' · ') : (s.location ?? 'In person') },
                ...(s.trainer
                  ? [
                      {
                        label: 'Trainer',
                        value: s.trainerBio ? (
                          <span className="flex flex-col gap-0.5">
                            <span>{s.trainer}</span>
                            <span className="text-caption text-secondary">{s.trainerBio}</span>
                          </span>
                        ) : (
                          s.trainer
                        ),
                      },
                    ]
                  : []),
                {
                  label: 'Course',
                  value: (
                    <Link to={`/participant/courses/${s.course.cohortCourseId}`} className="hover:underline">
                      {s.course.name}
                    </Link>
                  ),
                },
              ]}
            />
          </Panel>
        </aside>
      </div>
    </>
  )
}

/** P4.03 "How was this session?" — optional, anonymous, can be changed. */
function RatePanel({ sessionId, mine }: { sessionId: string; mine: { rating: number; comment: string | null } | null }) {
  const [open, setOpen] = useState(false)
  return (
    <Panel aria-labelledby="rate-title" className="gap-3">
      <PanelHeader
        id="rate-title"
        title="How was this session?"
        description={mine ? `You rated it ${mine.rating} out of 5. Thanks — it helps your trainer.` : 'Optional and anonymous. Takes 30 seconds.'}
      />
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {mine ? 'Change your rating' : 'Rate this session'}
        </Button>
      </div>
      {open && <RateDialog sessionId={sessionId} mine={mine} onClose={() => setOpen(false)} />}
    </Panel>
  )
}

function RateDialog({ sessionId, mine, onClose }: { sessionId: string; mine: { rating: number; comment: string | null } | null; onClose: () => void }) {
  const rate = useRateSession(sessionId)
  const [rating, setRating] = useState<number | null>(mine?.rating ?? null)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!rating) return setError('Choose a rating from 1 to 5.')
    try {
      await rate.mutateAsync({ rating, comment })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? err.message : 'Your feedback wasn’t sent. Try again.')
    }
  }

  return (
    <Dialog
      open
      onClose={() => !rate.isPending && onClose()}
      width={520}
      title="How useful was this session?"
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={rate.isPending}>
            Skip
          </Button>
          <Button type="submit" form="rate-session" disabled={rate.isPending}>
            {rate.isPending ? 'Sending…' : 'Send feedback'}
          </Button>
        </>
      }
    >
      <form id="rate-session" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div role="radiogroup" aria-label="Rating, 1 not useful to 5 very useful" className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                onClick={() => {
                  setRating(n)
                  setError(null)
                }}
                className={
                  rating === n
                    ? 'h-9 rounded-full border border-brand bg-brand-subtle text-body-strong text-brand-text focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none max-md:h-11'
                    : 'h-9 rounded-full border border-default bg-surface text-body text-secondary hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none max-md:h-11'
                }
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-caption text-secondary">
            <span>Not useful</span>
            <span>Very useful</span>
          </div>
          {error && <p className="text-caption text-error-fg">{error}</p>}
        </div>
        <TextAreaField label="Anything to add?" optional value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} />
        <p className="text-caption text-secondary">Anonymous — your trainer sees the results, not your name.</p>
      </form>
    </Dialog>
  )
}
