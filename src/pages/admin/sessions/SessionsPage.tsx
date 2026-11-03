import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { Button } from '@/components/ui/Button'
import { DetailList } from '@/components/ui/FormLayout'
import { addMonths, mondayOf, monthGrid, monthLabel, monthOf, useScheduleView, weekRange } from '@/components/sessions/period'
import { DayGroups, MonthCalendar, PeriodNav, ViewSwitch } from '@/components/sessions/Schedule'
import { CalendarIcon, ChevronRightIcon } from '@/components/ui/icons'
import { Badge, EmptyState, Panel, PanelHeader } from '@/components/ui/Page'
import { FilterSelect } from '@/components/ui/SearchField'
import { formatDay, localDate, todayIn } from '@/lib/format'
import { addDays } from '@/lib/schedule'
import { useCohorts, useCourses } from '@/pages/admin/programmes/data'
import { CoursesHeader } from './CoursesHeader'
import { useSessions } from './data'
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
                  row={(s) => <SessionRow key={s.id} session={s} timeZone={timeZone} />}
                />
              ) : sessions.length === 0 ? (
                <EmptyState icon={<CalendarIcon size={24} />} title="No sessions this week" body="Use the arrows to see other weeks, or schedule a session." />
              ) : (
                <DayGroups items={sessions} timeZone={timeZone} today={today} row={(s) => <SessionRow key={s.id} session={s} timeZone={timeZone} />} />
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
