import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { ClashWarning } from '@/components/sessions/ClashWarning'
import { DurationField } from '@/components/sessions/DurationField'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox, RadioGroup } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { FormSection } from '@/components/ui/FormLayout'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { SelectField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { formatDay, formatTime, localDate, plural, weekdayList } from '@/lib/format'
import { type EditInput, type Session, type SessionMode, useClashes, useEditSession, useSession, useSessionOptions, useSessions } from './data'
import { useSessionPaths } from './paths'

type Errors = Partial<Record<'date' | 'start' | 'durationMinutes' | 'location' | 'joinUrl' | 'trainerMemberId' | 'scope', string>>

/** /admin/courses/sessions/:id/edit — C1.06; /trainer/sessions/:id/edit — T3.06 Edit session (+ C1.04 for repeating sessions). */
export function EditSessionPage() {
  const { id = '' } = useParams()
  const paths = useSessionPaths()
  const query = useSession(id)
  if (query.isPending) return <div aria-busy="true" className="h-40" />
  if (query.isError) {
    return (
      <Panel>
        <StatePanel kind="no-results" title="Session not found" />
      </Panel>
    )
  }
  if (!query.data.can.schedule) {
    return (
      <>
        <PageHeader title="You can’t edit this session" breadcrumb={[{ label: paths.listLabel, to: paths.list }]} />
        <Panel>
          <StatePanel
            kind="restricted"
            title="Only admins and the course’s lead trainer can change sessions"
            description="Ask them if this session needs to move."
          />
        </Panel>
      </>
    )
  }
  if (query.data.session.status !== 'scheduled') {
    return (
      <>
        <PageHeader title="This session can’t be edited" breadcrumb={[{ label: paths.listLabel, to: paths.list }]} />
        <Panel>
          <StatePanel kind="restricted" title="Held and cancelled sessions don’t change" description="Their attendance and reports are kept as they are." />
        </Panel>
      </>
    )
  }
  return <EditForm session={query.data.session} />
}

function EditForm({ session: s }: { session: Session }) {
  const navigate = useNavigate()
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const edit = useEditSession(s.id)
  const paths = useSessionPaths()
  const options = useSessionOptions()
  const series = useSessions({ cohortId: s.cohort.id })

  const [date, setDate] = useState(localDate(s.startsAt, timeZone))
  const [start, setStart] = useState(formatTime(s.startsAt, timeZone))
  const [minutes, setMinutes] = useState(Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60_000))
  const [mode, setMode] = useState<SessionMode>(s.mode)
  const [location, setLocation] = useState(s.location ?? '')
  const [joinUrl, setJoinUrl] = useState(s.joinUrl ?? '')
  const [trainerId, setTrainerId] = useState(s.trainer?.id ?? '')
  const [notify, setNotify] = useState(true)
  const [errors, setErrors] = useState<Errors>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [askScope, setAskScope] = useState(false)

  const cohort = options.data?.cohorts.find((c) => c.id === s.cohort.id)
  const course = cohort?.courses.find((c) => c.courseId === s.course.id)
  const trainers = course?.trainers.filter((t) => t.status !== 'deactivated') ?? []
  const effectiveTrainer = trainerId || trainers.find((t) => t.isLead)?.id || null
  const trainerPerson = trainers.find((t) => t.id === effectiveTrainer)
  const clashes = useClashes(
    date && /^\d{2}:\d{2}$/.test(start) ? { date, start, durationMinutes: minutes, trainerMemberId: effectiveTrainer, mode, joinUrl, excludeId: s.id } : null,
  )
  const cohortDates = cohort
  const originalDate = localDate(s.startsAt, timeZone)
  const remaining = (series.data?.sessions ?? []).filter((x) => x.series?.id === s.series?.id && x.status === 'scheduled')
  const following = remaining.filter((x) => x.startsAt >= s.startsAt).length

  function validate(): boolean {
    const next: Errors = {
      date: !date
        ? 'Choose a date.'
        : cohortDates && (date < cohortDates.startsOn || date > cohortDates.endsOn)
          ? `Choose a date within ${s.cohort.name}.`
          : undefined,
      location: mode === 'in_person' && !location.trim() ? 'Enter where it happens.' : undefined,
      joinUrl:
        mode === 'online' && joinUrl.trim() && !/^https:\/\/\S+$/.test(joinUrl.trim()) ? 'Paste the full meeting link, starting with https://' : undefined,
    }
    setErrors(next)
    return !Object.values(next).some(Boolean)
  }

  async function save(scope: EditInput['scope']) {
    setFailed(null)
    try {
      const result = await edit.mutateAsync({ scope, date, start, durationMinutes: minutes, mode, location, joinUrl, trainerMemberId: trainerId || null, notify })
      navigate(paths.session(s.id), {
        replace: true,
        state: {
          notice: `${result.updated > 1 ? `${result.updated} sessions` : 'Session'} updated${notify ? ` · ${plural(result.emailed, 'email')} sent` : ''}.`,
        },
      })
    } catch (error) {
      setAskScope(false)
      if (error instanceof ApiError && Array.isArray(error.details)) {
        setErrors(Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
      } else {
        setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'Your changes weren’t saved. Try again.')
      }
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return
    if (s.series && s.series.sessions > 1) setAskScope(true)
    else void save('this')
  }

  const day = formatDay(s.startsAt, timeZone)

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: paths.listLabel, to: paths.list }, { label: `${s.title} · ${day}`, to: paths.session(s.id) }, { label: 'Edit' }]}
        title="Edit session"
        description={[s.title, s.cohort.name, s.number && `Session ${s.number} of ${s.total}`].filter(Boolean).join(' · ')}
      />
      <div className="flex items-start gap-4 max-lg:flex-col">
        <Panel className="w-[680px] max-w-full min-w-0">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            {failed && (
              <AlertBanner tone="error" title="Couldn’t save">
                {failed}
              </AlertBanner>
            )}
            <FormSection title="When">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3 max-md:grid-cols-2">
                <div className="max-md:col-span-2">
                  <TextField
                    label="Date"
                    type="date"
                    value={date}
                    min={cohortDates?.startsOn}
                    max={cohortDates?.endsOn}
                    onChange={(e) => setDate(e.target.value)}
                    error={errors.date}
                  />
                </div>
                <DurationField value={minutes} onChange={setMinutes} start={start} error={errors.durationMinutes} />
                <TextField label="Start" type="time" value={start} onChange={(e) => setStart(e.target.value)} error={errors.start} />
              </div>
            </FormSection>
            <FormSection title="Where">
              <RadioGroup
                label="Where"
                options={[
                  { value: 'online', label: 'Online' },
                  { value: 'in_person', label: 'In person' },
                ]}
                value={mode}
                onChange={setMode}
              />
              {mode === 'in_person' ? (
                <TextField label="Location" value={location} onChange={(e) => setLocation(e.target.value)} error={errors.location} />
              ) : (
                <TextField
                  label="Meeting link"
                  optional
                  type="url"
                  placeholder="https://zoom.us/j/…"
                  value={joinUrl}
                  onChange={(e) => setJoinUrl(e.target.value)}
                  error={errors.joinUrl}
                />
              )}
            </FormSection>
            <FormSection title="Trainer">
              <SelectField
                label="Trainer"
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
                error={errors.trainerMemberId}
                helper="From the course’s trainers in this cohort."
              >
                <option value="">No trainer</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                    {t.isLead ? ' (lead)' : ''}
                  </option>
                ))}
              </SelectField>
            </FormSection>
            <Checkbox label="Email participants and the trainer about the change" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <ClashWarning clashes={clashes.data} timeZone={timeZone} trainerName={trainerPerson ? `${trainerPerson.firstName} ${trainerPerson.lastName}` : undefined} />
            <div className="flex gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
              <Button variant="secondary" onClick={() => navigate(paths.session(s.id))} disabled={edit.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={edit.isPending}>
                {edit.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Panel>
        {s.series && s.series.sessions > 1 && (
          <aside className="w-[356px] shrink-0 max-lg:w-full">
            <Panel>
              <PanelHeader title="This session repeats" />
              <p className="text-caption text-secondary">
                {s.title} runs on {weekdayList(s.series.weekdays, { plural: true })}. When you save, you choose whether the change applies to this session only,
                or to this and the following sessions.
              </p>
              <p className="text-caption text-secondary">Moving the date keeps the session number. Attendance and the report move with it.</p>
            </Panel>
          </aside>
        )}
      </div>

      {s.series && (
        <ScopeDialog
          open={askScope}
          onClose={() => !edit.isPending && setAskScope(false)}
          pending={edit.isPending}
          day={day}
          dateChanged={date !== originalDate}
          total={s.series.sessions}
          weekdays={s.series.weekdays}
          following={following}
          onContinue={(scope) => void save(scope)}
        />
      )}
    </>
  )
}

/** C1.04 Edit a repeating session. */
function ScopeDialog({
  open,
  onClose,
  pending,
  day,
  dateChanged,
  total,
  weekdays,
  following,
  onContinue,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  day: string
  dateChanged: boolean
  total: number
  weekdays: number[]
  following: number
  onContinue: (scope: EditInput['scope']) => void
}) {
  const [scope, setScope] = useState<EditInput['scope']>('this')
  const options = dateChanged
    ? [{ value: 'this' as const, label: `Only this session — ${day}` }]
    : [
        { value: 'this' as const, label: `Only this session — ${day}` },
        { value: 'following' as const, label: `This and following sessions — ${plural(following, 'session')}` },
        { value: 'all' as const, label: 'All sessions in the series' },
      ]
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={440}
      title="Edit a repeating session"
      description={`This session is part of a series of ${total} on ${weekdayList(weekdays, { plural: true })}.`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => onContinue(dateChanged ? 'this' : scope)} disabled={pending}>
            {pending ? 'Saving…' : 'Continue'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 [&_fieldset>div]:flex-col [&_fieldset>div]:gap-y-3">
        <RadioGroup label="Apply to" options={options} value={dateChanged ? 'this' : scope} onChange={setScope} />
      </div>
      {dateChanged && <p className="text-caption text-secondary">You changed the date, so this applies to this session only.</p>}
      <p className="text-caption text-secondary">Held sessions never change; their attendance and reports are kept.</p>
    </Dialog>
  )
}
