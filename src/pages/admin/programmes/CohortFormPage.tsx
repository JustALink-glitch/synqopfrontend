import { useState, type FormEvent } from 'react'
import { PermanentDeleteSection } from '@/components/admin/PermanentDelete'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox, RadioGroup } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { FormLayout, FormSection, NextSteps } from '@/components/ui/FormLayout'
import { PageHeader, Panel } from '@/components/ui/Page'
import { SelectField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import {
  useArchiveCohort,
  useCohort,
  useCreateCohort,
  useProgramme,
  useProgrammes,
  useUpdateCohort,
  type CohortCourse,
  type CohortInput,
  type CohortSummary,
} from './data'
import { deliveryOptions } from './labels'

type Errors = Partial<Record<'programmeId' | 'name' | 'startsOn' | 'endsOn' | 'usualLocation' | 'courseIds', string>>

/** /admin/cohorts/new?programme= — A3.07 New cohort. */
export function NewCohortPage() {
  const [params] = useSearchParams()
  const programmes = useProgrammes()
  const [programmeId, setProgrammeId] = useState(params.get('programme') ?? '')
  if (programmes.isPending) return <div aria-busy="true" className="h-40" />
  const live = (programmes.data?.programmes ?? []).filter((p) => p.status !== 'archived')
  return (
    <CohortForm
      programmeId={programmeId}
      onProgrammeChange={setProgrammeId}
      programmeOptions={live.map((p) => ({ id: p.id, name: p.name }))}
      initial={{ name: '', startsOn: '', endsOn: '', deliveryMode: 'online', usualLocation: '', courseIds: [] }}
    />
  )
}

/** /admin/cohorts/:id/edit — A3.08 Edit cohort (with A3.09 archive). */
export function EditCohortPage() {
  const { id = '' } = useParams()
  const query = useCohort(id)
  if (query.isPending) return <div aria-busy="true" className="h-40" />
  if (query.isError) {
    return (
      <Panel>
        <StatePanel kind="no-results" title="Cohort not found" />
      </Panel>
    )
  }
  const { cohort, courses, programmeCourses } = query.data
  return (
    <CohortForm
      existing={cohort}
      existingCourses={courses}
      programmeId={cohort.programme.id}
      programmeOptions={[cohort.programme]}
      libraryOverride={programmeCourses}
      initial={{
        name: cohort.name,
        startsOn: cohort.startsOn,
        endsOn: cohort.endsOn,
        deliveryMode: cohort.deliveryMode,
        usualLocation: cohort.usualLocation ?? '',
        courseIds: courses.map((c) => c.courseId),
      }}
    />
  )
}

function CohortForm({
  existing,
  existingCourses = [],
  programmeId,
  onProgrammeChange,
  programmeOptions,
  libraryOverride,
  initial,
}: {
  existing?: CohortSummary
  existingCourses?: CohortCourse[]
  programmeId: string
  onProgrammeChange?: (id: string) => void
  programmeOptions: { id: string; name: string }[]
  libraryOverride?: { id: string; name: string }[]
  initial: CohortInput
}) {
  const navigate = useNavigate()
  const programme = useProgramme(libraryOverride ? '' : programmeId)
  const create = useCreateCohort()
  const update = useUpdateCohort(existing?.id ?? '')
  const [form, setForm] = useState(initial)
  const [coursesTouched, setCoursesTouched] = useState(Boolean(existing))
  const [errors, setErrors] = useState<Errors>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const saving = create.isPending || update.isPending

  const library = libraryOverride ?? (programmeId && programme.data ? programme.data.courses : [])
  // On a new cohort every course is ticked until the admin changes the selection.
  const selected = coursesTouched ? form.courseIds : library.map((c) => c.id)
  const locked = new Set(existingCourses.filter((c) => c.firstSessionAt).map((c) => c.courseId))

  const set = <K extends keyof CohortInput>(key: K, value: CohortInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Errors = {
      programmeId: programmeId ? undefined : 'Choose a programme.',
      name: form.name.trim() ? undefined : 'Enter a cohort name.',
      startsOn: form.startsOn ? undefined : 'Choose a start date.',
      endsOn: !form.endsOn ? 'Choose an end date.' : form.startsOn && form.endsOn < form.startsOn ? 'End date must be on or after the start date.' : undefined,
    }
    setErrors(next)
    setFailed(null)
    if (Object.values(next).some(Boolean)) return
    const input = { ...form, courseIds: selected }
    try {
      if (existing) {
        await update.mutateAsync(input)
        navigate(`/admin/cohorts/${existing.id}`)
      } else {
        const result = await create.mutateAsync({ ...input, programmeId })
        navigate(`/admin/cohorts/${result.cohort.id}`, { replace: true })
      }
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        setErrors(Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
      } else {
        setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'Your changes weren’t saved. Check your connection and try again.')
      }
    }
  }

  const backTo = existing ? `/admin/cohorts/${existing.id}` : '/admin/cohorts'
  const canArchive = existing && existing.status !== 'active'

  return (
    <>
      <PageHeader
        breadcrumb={
          existing
            ? [{ label: 'Cohorts', to: '/admin/cohorts' }, { label: existing.name, to: backTo }, { label: 'Edit' }]
            : [{ label: 'Cohorts', to: '/admin/cohorts' }, { label: 'New cohort' }]
        }
        title={existing ? 'Edit cohort' : 'New cohort'}
        description={existing ? `${existing.name} · ${existing.programme.name}` : 'Cohorts belong to one programme and run its courses over set dates.'}
      />
      <FormLayout
        aside={
          existing ? (
            <Panel>
              <h2 className="text-heading-section text-primary">Changing dates</h2>
              <p className="text-caption text-secondary">
                The end date sets when this cohort completes. Sessions after a new end date are flagged for you to move or cancel.
              </p>
            </Panel>
          ) : (
            <NextSteps
              title="After you create the cohort"
              steps={[
                { title: 'Add participants', description: 'Import a CSV or add people one by one.' },
                { title: 'Assign trainers', description: 'Choose a trainer for each course.' },
                { title: 'Schedule sessions', description: 'Add the first session; trainers take attendance from there.' },
              ]}
            />
          )
        }
      >
        <Panel>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            {failed && (
              <AlertBanner tone="error" title="Couldn’t save the cohort">
                {failed}
              </AlertBanner>
            )}
            <FormSection title="Basics">
              <SelectField
                label="Programme"
                disabled={Boolean(existing)}
                helper={existing ? 'A cohort can’t move to another programme.' : 'Cohorts share the programme’s courses.'}
                value={programmeId}
                onChange={(e) => {
                  onProgrammeChange?.(e.target.value)
                  setCoursesTouched(false)
                  setErrors((prev) => ({ ...prev, programmeId: undefined }))
                }}
                error={errors.programmeId}
              >
                <option value="">Select a programme</option>
                {programmeOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Cohort name"
                placeholder="e.g. Cohort 7 — Apr 2027"
                helper="Shown to trainers and participants."
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                error={errors.name}
              />
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <TextField label="Start date" type="date" value={form.startsOn} onChange={(e) => set('startsOn', e.target.value)} error={errors.startsOn} />
                <TextField
                  label="End date"
                  type="date"
                  min={form.startsOn || undefined}
                  value={form.endsOn}
                  onChange={(e) => set('endsOn', e.target.value)}
                  error={errors.endsOn}
                />
              </div>
            </FormSection>

            <FormSection title="Delivery">
              <RadioGroup
                label="Delivery"
                description="How sessions in this cohort usually run. Each session can still be online or in person."
                options={deliveryOptions}
                value={form.deliveryMode}
                onChange={(value) => set('deliveryMode', value)}
              />
              <TextField
                label="Usual location"
                optional
                placeholder="e.g. Yaba hub"
                value={form.usualLocation}
                onChange={(e) => set('usualLocation', e.target.value)}
                error={errors.usualLocation}
              />
            </FormSection>

            <FormSection
              title="Courses"
              description={
                existing
                  ? 'Courses come from the programme. A course that already has sessions can’t be unticked.'
                  : 'Courses come from the programme. Untick any this cohort won’t run.'
              }
            >
              {!programmeId ? (
                <p className="text-body text-secondary">Choose a programme to see its courses.</p>
              ) : !libraryOverride && programme.isPending ? (
                <p className="text-body text-secondary">Loading courses…</p>
              ) : library.length === 0 ? (
                <p className="text-body text-secondary">This programme has no courses yet. You can add courses later, and they can join this cohort.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {library.map((course) => (
                    <Checkbox
                      key={course.id}
                      label={course.name}
                      checked={selected.includes(course.id)}
                      disabled={locked.has(course.id)}
                      onChange={(e) => {
                        setCoursesTouched(true)
                        set('courseIds', e.target.checked ? [...selected, course.id] : selected.filter((id) => id !== course.id))
                      }}
                    />
                  ))}
                </div>
              )}
              {errors.courseIds && <p className="text-caption text-error-fg">{errors.courseIds}</p>}
            </FormSection>

            {existing && (
              <div className="flex items-start gap-4 rounded-md border border-default p-4 max-md:flex-col">
                <div className="flex flex-1 flex-col gap-0.5">
                  <h2 className="text-body-strong text-primary">Archive cohort</h2>
                  <p className="text-caption text-secondary">
                    Archived cohorts are read-only and hidden from lists. Records, certificates and reports are kept.
                  </p>
                  {!canArchive && <p className="text-caption text-muted">Available after the end date, {formatDate(existing.endsOn, { year: true })}.</p>}
                </div>
                <Button variant="secondary" disabled={!canArchive} onClick={() => setArchiveOpen(true)}>
                  Archive cohort
                </Button>
              </div>
            )}
            {existing && <PermanentDeleteSection kind="cohort" id={existing.id} />}

            <div className="flex gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
              <Button variant="secondary" onClick={() => navigate(backTo)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : existing ? 'Save changes' : 'Create cohort'}
              </Button>
            </div>
          </form>
        </Panel>
      </FormLayout>
      {existing && <ArchiveCohortDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} cohort={existing} />}
    </>
  )
}

/** A3.09 Archive cohort. Before it starts, archiving cancels it. */
export function ArchiveCohortDialog({ open, onClose, cohort }: { open: boolean; onClose: () => void; cohort: CohortSummary }) {
  const navigate = useNavigate()
  const archive = useArchiveCohort(cohort.id)
  const [failed, setFailed] = useState<string | null>(null)
  const notStarted = cohort.status === 'upcoming' || cohort.status === 'draft'

  async function confirm() {
    setFailed(null)
    try {
      await archive.mutateAsync()
      navigate('/admin/cohorts', { state: { archived: cohort.name } })
    } catch (error) {
      setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'It wasn’t archived. Try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !archive.isPending && onClose()}
      width={440}
      title={`Archive ${cohort.name}?`}
      description={
        notStarted
          ? 'It hasn’t started, so archiving cancels it. It becomes read-only and leaves cohort lists and the overview.'
          : 'It becomes read-only and leaves cohort lists and the overview. Participant records, certificates, outcomes and reports are kept.'
      }
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={archive.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={archive.isPending}>
            {archive.isPending ? 'Archiving…' : 'Archive cohort'}
          </Button>
        </>
      }
    >
      <p className="text-caption text-secondary">You can unarchive it from Cohorts › Archived.</p>
      {failed && (
        <AlertBanner tone="error" title="Couldn’t archive">
          {failed}
        </AlertBanner>
      )}
    </Dialog>
  )
}
