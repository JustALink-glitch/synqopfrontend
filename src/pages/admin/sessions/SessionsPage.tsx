import { CalendarX2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { BulkBar } from '@/components/collection/Collection'
import { useSelection } from '@/components/collection/selection'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { DetailList } from '@/components/ui/FormLayout'
import { addMonths, mondayOf, monthGrid, monthLabel, monthOf, useScheduleView, weekRange } from '@/components/sessions/period'
import { DayGroups, MonthCalendar, PeriodNav, ViewSwitch } from '@/components/sessions/Schedule'
import { CalendarIcon, ChevronRightIcon } from '@/components/ui/icons'
import { Badge, EmptyState, Panel, PanelHeader } from '@/components/ui/Page'
import { FilterSelect } from '@/components/ui/SearchField'
import { formatDay, formatTimeRange, localDate, plural, todayIn } from '@/lib/format'
import { addDays } from '@/lib/schedule'
import { useCohorts, useCourses } from '@/pages/admin/programmes/data'
import { CoursesHeader } from './CoursesHeader'
import { useCancelSessions, useSessions, type Session } from './data'
import { SessionRow } from './SessionRow'

/** /admin/courses — C1.01 Sessions (week list or month calendar), C1.01e empty. */
export function SessionsPage() {
  const navigate = useNavigate()
  const { state } = useAuth()
  const orgZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const today = todayIn(orgZone)
  const [view, setView] = useScheduleView('admin')
  const [week, setWeek] = useState(() => mondayOf(today))
  const [month, setMonth] = useState(() => monthOf(today))
  const [cohortId, setCohortId] = useState('')
  const cohorts = useCohorts()
  const courses = useCourses()
  const grid = monthGrid(month)
  const range = view === 'calendar' ? { from: grid.from, to: grid.to } : { from: week, to: addDays(week, 6) }
  const query = useSessions({ ...range, cohortId: cohortId || undefined })
  const timeZone = query.data?.timeZone ?? orgZone

  const sessions = query.data?.sessions ?? []
  const counted = view === 'calendar' ? sessions.filter((s) => localDate(s.startsAt, timeZone).slice(0, 7) === month.slice(0, 7)) : sessions
  const live = counted.filter((s) => !s.cancelled)
  const thisWeek = week === mondayOf(today)
  const thisMonth = month === monthOf(today)
  const openCohorts = (cohorts.data ?? []).filter((c) => ['active', 'upcoming', 'draft'].includes(c.status))

  // Tick upcoming sessions to cancel several at once (pilot feedback, Nov 2026).
  const changeable = sessions.filter((s) => s.status === 'scheduled' && !s.cancelled)
  const selection = useSelection(changeable.map((s) => s.id))
  const [cancelling, setCancelling] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const row = (s: Session) => (
    <SessionRow
      key={s.id}
      session={s}
      timeZone={timeZone}
      select={s.status === 'scheduled' && !s.cancelled ? { checked: selection.has(s.id), onChange: () => selection.toggle(s.id) } : undefined}
    />
  )

  const scheduleButton = (
    <Button
      icon={<CalendarIcon size={16} />}
      onClick={() => navigate(`sessions/new${cohortId ? `?cohort=${cohortId}` : ''}`)}
      disabled={!cohorts.isPending && openCohorts.length === 0}
      title={openCohorts.length === 0 ? 'Create a cohort first' : undefined}
    >
      Schedule session
    </Button>
  )

  return (
    <>
      <CoursesHeader tab="sessions" actions={scheduleButton} courseCount={courses.data?.length} />

      {query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load sessions"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : query.data && !query.data.hasAny && !cohortId ? (
        <Panel className="py-16">
          <EmptyState
            icon={<CalendarIcon size={24} />}
            title="No sessions scheduled yet"
            body={
              openCohorts.length === 0
                ? 'Sessions belong to a course in a cohort. Create a cohort and add its courses first.'
                : 'Sessions belong to a course in a cohort. Schedule the first one — repeating sessions are created in one go.'
            }
            actions={openCohorts.length > 0 && scheduleButton}
          />
        </Panel>
      ) : (
        <>
          <PeriodNav
            unit={view === 'calendar' ? 'month' : 'week'}
            label={view === 'calendar' ? monthLabel(month) : weekRange(week)}
            onMove={(step) => (view === 'calendar' ? setMonth(addMonths(month, step)) : setWeek(addDays(week, step * 7)))}
            onToday={() => (view === 'calendar' ? setMonth(monthOf(today)) : setWeek(mondayOf(today)))}
            atToday={view === 'calendar' ? thisMonth : thisWeek}
          >
            <FilterSelect aria-label="Cohort" value={cohortId} onChange={(e) => setCohortId(e.target.value)} className="w-48 max-md:flex-1">
              <option value="">All cohorts</option>
              {(cohorts.data ?? [])
                .filter((c) => c.status !== 'archived')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </FilterSelect>
            <ViewSwitch value={view} onChange={setView} />
          </PeriodNav>

          {notice && <AlertBanner tone="success" title={notice} />}
          <BulkBar
            selection={selection}
            noun={['session', 'sessions']}
            actions={[
              {
                label: 'Cancel sessions',
                icon: <CalendarX2 aria-hidden className="size-4" />,
                destructive: true,
                run: async () => (setNotice(null), setCancelling(true)),
              },
            ]}
          />
          {cancelling && (
            <CancelSessionsDialog
              sessions={changeable.filter((s) => selection.has(s.id))}
              timeZone={timeZone}
              onClose={() => setCancelling(false)}
              onDone={(text) => {
                setCancelling(false)
                selection.clear()
                setNotice(text)
              }}
            />
          )}
          <div className="flex items-start gap-4 max-lg:flex-col">
            <Panel className="min-w-0 flex-1 gap-4 max-lg:w-full" aria-busy={query.isPending}>
              {query.isPending ? (
                <div className="h-40" />
              ) : view === 'calendar' ? (
                <MonthCalendar
                  month={month}
                  today={today}
                  timeZone={timeZone}
                  items={sessions}
                  colourKey={(s) => s.course.id}
                  colourLabel={(s) => s.course.name}
                  row={row}
                />
              ) : sessions.length === 0 ? (
                <EmptyState icon={<CalendarIcon size={24} />} title="No sessions this week" body="Use the arrows to see other weeks, or schedule a session." />
              ) : (
                <DayGroups items={sessions} timeZone={timeZone} today={today} row={row} />
              )}
            </Panel>

            <div className="flex w-[356px] shrink-0 flex-col gap-4 max-lg:w-full">
              <Panel aria-labelledby="confirm-title">
                <PanelHeader id="confirm-title" title="Attendance to confirm" description="Past sessions with no attendance recorded." />
                {(query.data?.attendanceToConfirm ?? []).length === 0 ? (
                  <p className="py-2 text-body text-secondary">Nothing to confirm.</p>
                ) : (
                  <ul>
                    {query.data!.attendanceToConfirm.map((s) => (
                      <li key={s.id} className="border-b border-default last:border-b-0">
                        <Link to={`sessions/${s.id}/attendance`} className="flex items-center gap-3 py-3 hover:bg-surface-hover">
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-body-strong text-primary">{s.title}</span>
                            <span className="text-caption text-secondary">
                              {formatDay(s.startsAt, timeZone)} · {s.cohort.name} · {s.trainer?.name ?? 'No trainer'}
                            </span>
                          </span>
                          <Badge tone="warning">Not recorded</Badge>
                          <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-caption text-secondary">Attendance rates exclude sessions until they are recorded.</p>
              </Panel>
              <Panel aria-labelledby="week-title">
                <PanelHeader
                  id="week-title"
                  title={view === 'calendar' ? (thisMonth ? 'This month' : 'Month summary') : thisWeek ? 'This week' : 'Week summary'}
                />
                <DetailList
                  items={[
                    { label: 'Sessions', value: live.length },
                    { label: 'In person', value: live.filter((s) => s.mode === 'in_person').length },
                    { label: 'Online', value: live.filter((s) => s.mode === 'online').length },
                    ...(counted.length > live.length ? [{ label: 'Cancelled', value: counted.length - live.length }] : []),
                  ]}
                />
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  )
}

/** Cancel several sessions with one reason (pilot feedback, Nov 2026). Each person gets one email listing theirs. */
function CancelSessionsDialog({
  sessions,
  timeZone,
  onClose,
  onDone,
}: {
  sessions: Session[]
  timeZone: string | undefined
  onClose: () => void
  onDone: (notice: string) => void
}) {
  const cancel = useCancelSessions()
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const sorted = [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) return setError('Add a reason. Participants see it in the email.')
    setFailed(null)
    try {
      const r = await cancel.mutateAsync({ ids: sorted.map((s) => s.id), reason, notify })
      onDone(
        [
          `${plural(r.cancelled, 'session')} cancelled.`,
          notify && r.cancelled ? `${plural(r.emailed, 'email')} sent.` : '',
          r.skipped.length ? `${plural(r.skipped.length, 'session')} skipped: ${r.skipped[0]!.reason}` : '',
        ]
          .filter(Boolean)
          .join(' '),
      )
    } catch (err) {
      setFailed(err instanceof ApiError && err.status < 500 ? err.message : 'Nothing was cancelled. Try again.')
    }
  }

  return (
    <Dialog
      open
      onClose={() => !cancel.isPending && onClose()}
      width={440}
      title={`Cancel ${plural(sorted.length, 'session')}?`}
      description="Each participant and trainer gets one email listing the sessions that affect them."
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={cancel.isPending}>
            Keep sessions
          </Button>
          <Button type="submit" form="cancel-sessions" variant="destructive" disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelling…' : `Cancel ${plural(sorted.length, 'session')}`}
          </Button>
        </>
      }
    >
      <form id="cancel-sessions" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {failed && (
          <AlertBanner tone="error" title="Couldn’t cancel">
            {failed}
          </AlertBanner>
        )}
        <ul className="max-h-40 overflow-y-auto rounded-md border border-default px-3">
          {sorted.map((s) => (
            <li key={s.id} className="flex flex-col border-b border-default py-2 last:border-b-0">
              <span className="truncate text-body-strong text-primary">{s.title}</span>
              <span className="truncate text-caption text-secondary">
                {formatDay(s.startsAt, timeZone)}, {formatTimeRange(s.startsAt, s.endsAt, timeZone)} · {s.cohort.name}
              </span>
            </li>
          ))}
        </ul>
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
        <Checkbox label="Email participants and trainers" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
      </form>
    </Dialog>
  )
}
