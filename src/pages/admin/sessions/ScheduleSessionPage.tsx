import clsx from 'clsx'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { ClashWarning } from '@/components/sessions/ClashWarning'
import { DurationField } from '@/components/sessions/DurationField'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { RadioGroup } from '@/components/ui/Choice'
import { FormSection } from '@/components/ui/FormLayout'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { SelectField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { addToClock, formatDate, formatDuration, plural, todayIn, weekdayList } from '@/lib/format'
import { MAX_SESSIONS_PER_SCHEDULE, occurrences, weekdayOf, type Weekday } from '@/lib/schedule'
import { useClashes, useScheduleSessions, useSessionOptions, type SessionMode } from './data'
import { useSessionPaths } from './paths'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
type Errors = Partial<
  Record<'cohortId' | 'courseId' | 'trainerMemberId' | 'date' | 'start' | 'durationMinutes' | 'repeat' | 'count' | 'until' | 'location' | 'joinUrl', string>
>

/** /admin/courses/sessions/new?cohort=&course= — C1.02; /trainer/sessions/new — T3.03 Schedule session. */
export function ScheduleSessionPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const today = todayIn(timeZone)
  const paths = useSessionPaths()
  const options = useSessionOptions()
  const schedule = useScheduleSessions()

  const [cohortId, setCohortId] = useState(params.get('cohort') ?? '')
  const [courseId, setCourseId] = useState(params.get('course') ?? '')
  const [trainerId, setTrainerId] = useState<string | null>(null)
  const [date, setDate] = useState('')
  const [start, setStart] = useState('10:00')
  const [minutes, setMinutes] = useState(120)
  const [repeats, setRepeats] = useState<'none' | 'weekly'>('none')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [ends, setEnds] = useState<'count' | 'until'>('count')
  const [count, setCount] = useState('10')
  const [until, setUntil] = useState('')
  const [mode, setMode] = useState<SessionMode>('online')
  const [location, setLocation] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [failed, setFailed] = useState<string | null>(null)

  const open = (options.data?.cohorts ?? []).filter((c) => ['active', 'upcoming', 'draft'].includes(c.status))
  const selectedCohort = open.find((c) => c.id === cohortId)
  const courses = selectedCohort?.courses ?? []
  const course = courses.find((c) => c.courseId === courseId)
  const trainers = course?.trainers.filter((t) => t.status !== 'deactivated') ?? []
  // Default to the course's lead until the admin picks someone.
  const trainer = trainerId ?? trainers.find((t) => t.isLead)?.id ?? ''
  // Default date: today, or the cohort's first day if it hasn't started.
  const effectiveDate = date || (selectedCohort ? (selectedCohort.startsOn > today ? selectedCohort.startsOn : today) : '')
  const effectiveDays = weekdays.length ? weekdays : effectiveDate ? [weekdayOf(effectiveDate)] : []

  const repeat: { weekdays: Weekday[]; count?: number; until?: string } | null =
    repeats === 'weekly' ? { weekdays: effectiveDays as Weekday[], ...(ends === 'count' ? { count: Number(count) || 0 } : until ? { until } : {}) } : null
  const dates = effectiveDate && (!repeat || (repeat.count ?? repeat.until)) ? occurrences(effectiveDate, repeat) : []
  const outside = selectedCohort ? dates.filter((d) => d < selectedCohort.startsOn || d > selectedCohort.endsOn) : []

  const set =
    <T,>(setter: (v: T) => void, key: keyof Errors) =>
    (value: T) => {
      setter(value)
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Errors = {
      cohortId: cohortId ? undefined : 'Choose a cohort.',
      courseId: courseId ? undefined : 'Choose a course.',
      date: effectiveDate ? undefined : 'Choose a date.',
      location: mode === 'in_person' && !location.trim() ? 'Enter where it happens.' : undefined,
      joinUrl:
        mode === 'online' && joinUrl.trim() && !/^https:\/\/\S+$/.test(joinUrl.trim()) ? 'Paste the full meeting link, starting with https://' : undefined,
      count:
        repeats === 'weekly' && ends === 'count' && (!Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > MAX_SESSIONS_PER_SCHEDULE)
          ? `Enter a number from 1 to ${MAX_SESSIONS_PER_SCHEDULE}.`
          : undefined,
      until: repeats === 'weekly' && ends === 'until' && !until ? 'Choose an end date.' : undefined,
      repeat:
        outside.length > 0 && selectedCohort
          ? `${outside.length === dates.length ? 'These sessions fall' : `${outside.length} of ${dates.length} sessions fall`} outside ${selectedCohort.name} (${formatDate(selectedCohort.startsOn)} – ${formatDate(selectedCohort.endsOn, { year: true })}).`
          : dates.length === 0 && effectiveDate && repeats === 'weekly'
            ? 'No sessions fall on the chosen days.'
            : undefined,
    }
    setErrors(next)
    setFailed(null)
    if (Object.values(next).some(Boolean)) return
    try {
      const result = await schedule.mutateAsync({
        cohortId,
        courseId,
        trainerMemberId: trainer || null,
        date: effectiveDate,
        start,
        durationMinutes: minutes,
        repeat,
        mode,
        location,
        joinUrl,
      })
      navigate(result.created === 1 ? paths.session(result.firstSessionId) : paths.cohortSessions(cohortId), {
        state: { scheduled: result.created },
      })
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        setErrors(Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
      } else {
        setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'Nothing was scheduled. Check your connection and try again.')
      }
    }
  }

  const clashes = useClashes(
    effectiveDate && courseId && /^\d{2}:\d{2}$/.test(start)
      ? { date: effectiveDate, start, durationMinutes: minutes, repeat, trainerMemberId: trainer || null, mode, joinUrl }
      : null,
  )
  const trainerPerson = trainers.find((t) => t.id === trainer)
  const finish = addToClock(start, minutes)
  const clockRange = `${formatDuration(minutes)} (${start}–${finish.time}${finish.nextDay ? ', next day' : ''})`
  const submitLabel = dates.length > 1 ? `Schedule ${dates.length} sessions` : 'Schedule session'

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: paths.listLabel, to: paths.list }, { label: 'Schedule session' }]}
        title="Schedule session"
        description="Sessions belong to a course in a cohort. Admins and trainers can schedule them."
      />
      <div className="flex items-start gap-4 max-lg:flex-col">
        <Panel className="w-[680px] max-w-full min-w-0">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            {failed && (
              <AlertBanner tone="error" title="Couldn’t schedule">
                {failed}
              </AlertBanner>
            )}
            <FormSection title="What">
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <SelectField
                  label="Cohort"
                  value={cohortId}
                  onChange={(e) => {
                    set(setCohortId, 'cohortId')(e.target.value)
                    setCourseId('')
                    setTrainerId(null)
                  }}
                  error={errors.cohortId}
                >
                  <option value="">Select a cohort</option>
                  {open.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Course"
                  value={courseId}
                  disabled={!cohortId}
                  onChange={(e) => {
                    set(setCourseId, 'courseId')(e.target.value)
                    setTrainerId(null)
                  }}
                  error={errors.courseId}
                  helper={cohortId && selectedCohort && courses.length === 0 ? 'This cohort runs no courses yet. Add them in Edit cohort.' : undefined}
                >
                  <option value="">{cohortId ? 'Select a course' : 'Choose a cohort first'}</option>
                  {courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <SelectField
                label="Trainer"
                value={trainer}
                disabled={!course}
                onChange={(e) => set(setTrainerId, 'trainerMemberId')(e.target.value)}
                error={errors.trainerMemberId}
                helper={
                  course && trainers.length === 0
                    ? 'This course has no trainers in this cohort yet. You can add one later.'
                    : 'From the course’s trainers in this cohort.'
                }
              >
                <option value="">{trainers.length ? 'No trainer' : 'No trainers yet'}</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                    {t.isLead ? ' (lead)' : ''}
                    {t.status === 'invited' ? ' — invited' : ''}
                  </option>
                ))}
              </SelectField>
            </FormSection>

            <FormSection title="When">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3 max-md:grid-cols-2">
                <div className="max-md:col-span-2">
                  <TextField
                    label="Date"
                    type="date"
                    value={effectiveDate}
                    min={selectedCohort?.startsOn}
                    max={selectedCohort?.endsOn}
                    onChange={(e) => set(setDate, 'date')(e.target.value)}
                    error={errors.date}
                  />
                </div>
                <DurationField value={minutes} onChange={set(setMinutes, 'durationMinutes')} start={start} error={errors.durationMinutes} />
                <TextField label="Start" type="time" value={start} onChange={(e) => set(setStart, 'start')(e.target.value)} error={errors.start} />
              </div>
              <SelectField label="Repeat" value={repeats} onChange={(e) => set(setRepeats, 'repeat')(e.target.value as 'none' | 'weekly')}>
                <option value="none">Does not repeat</option>
                <option value="weekly">Weekly</option>
              </SelectField>
              {repeats === 'weekly' && (
                <>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-caption-strong text-primary">Repeat on</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((label, i) => {
                        const d = i + 1
                        const on = effectiveDays.includes(d)
                        return (
                          <button
                            key={label}
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              const nextDays = on ? effectiveDays.filter((x) => x !== d) : [...effectiveDays, d]
                              setWeekdays(nextDays.length ? nextDays : effectiveDays)
                              setErrors((prev) => ({ ...prev, repeat: undefined }))
                            }}
                            className={clsx(
                              'h-8 min-w-12 rounded-full px-3 text-caption-strong transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
                              on ? 'bg-brand text-on-brand' : 'border border-default bg-surface text-secondary hover:bg-surface-hover',
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                  <div className="flex flex-col gap-2.5">
                    <span className="text-caption-strong text-primary">Ends</span>
                    <RadioGroup
                      label="Ends"
                      options={[
                        { value: 'count', label: 'After a number of sessions' },
                        { value: 'until', label: 'On a date' },
                      ]}
                      value={ends}
                      onChange={setEnds}
                    />
                    {ends === 'count' ? (
                      <div className="w-40">
                        <TextField
                          label="Sessions"
                          type="number"
                          min={1}
                          max={MAX_SESSIONS_PER_SCHEDULE}
                          value={count}
                          onChange={(e) => set(setCount, 'count')(e.target.value)}
                          error={errors.count}
                        />
                      </div>
                    ) : (
                      <div className="w-56">
                        <TextField
                          label="Last date"
                          type="date"
                          min={effectiveDate}
                          max={selectedCohort?.endsOn}
                          value={until}
                          onChange={(e) => set(setUntil, 'until')(e.target.value)}
                          error={errors.until}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
              {errors.repeat && <p className="text-caption text-error-fg">{errors.repeat}</p>}
            </FormSection>

            <FormSection title="Where">
              <RadioGroup
                label="Where"
                options={[
                  { value: 'online', label: 'Online' },
                  { value: 'in_person', label: 'In person' },
                ]}
                value={mode}
                onChange={(value) => set(setMode, 'location')(value)}
              />
              {mode === 'in_person' ? (
                <TextField
                  label="Location"
                  placeholder="e.g. Lab 2 · Yaba hub"
                  value={location}
                  onChange={(e) => set(setLocation, 'location')(e.target.value)}
                  error={errors.location}
                />
              ) : (
                <TextField
                  label="Meeting link"
                  optional
                  type="url"
                  placeholder="https://zoom.us/j/…"
                  value={joinUrl}
                  onChange={(e) => set(setJoinUrl, 'joinUrl')(e.target.value)}
                  error={errors.joinUrl}
                  helper="Leave empty when Zoom is connected: Synqop creates a meeting, gives each participant their own link and imports attendance. Paste a link to use another meeting instead."
                />
              )}
            </FormSection>

            <ClashWarning clashes={clashes.data} timeZone={timeZone} trainerName={trainerPerson ? `${trainerPerson.firstName} ${trainerPerson.lastName}` : undefined} />
            <div className="flex gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
              <Button variant="secondary" onClick={() => navigate(-1)} disabled={schedule.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={schedule.isPending}>
                {schedule.isPending ? 'Scheduling…' : submitLabel}
              </Button>
            </div>
          </form>
        </Panel>

        <aside className="w-[356px] shrink-0 max-lg:w-full">
          <Panel aria-labelledby="preview-title">
            <PanelHeader
              id="preview-title"
              title={dates.length ? plural(dates.length, 'session') : 'Preview'}
              description={
                dates.length
                  ? `${repeats === 'weekly' ? weekdayList(effectiveDays, { plural: true }) : formatDate(dates[0]!, { year: true })}, ${clockRange}`
                  : 'Choose a cohort and date to see the sessions.'
              }
            />
            {dates.length > 0 && (
              <ol className="max-h-[520px] overflow-y-auto">
                {dates.map((d, i) => {
                  const off = selectedCohort && (d < selectedCohort.startsOn || d > selectedCohort.endsOn)
                  return (
                    <li key={d} className="flex items-center gap-3 border-b border-default py-2.5 last:border-b-0">
                      <span className={clsx('flex-1 text-body-strong', off ? 'text-error-fg' : 'text-primary')}>{formatDate(d, { year: true })}</span>
                      <span className={clsx('text-caption', off ? 'text-error-fg' : 'text-secondary')}>{off ? 'Outside the cohort' : `Session ${i + 1}`}</span>
                    </li>
                  )
                })}
              </ol>
            )}
          </Panel>
        </aside>
      </div>
    </>
  )
}
