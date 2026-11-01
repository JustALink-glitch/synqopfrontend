import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { FormLayout, FormSection } from '@/components/ui/FormLayout'
import { PageHeader, Panel } from '@/components/ui/Page'
import { SelectField, TextAreaField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { TRAINER_ROLES, useMembers } from '@/pages/admin/people/members'
import { useCohorts, useCreateCourse, useProgrammes } from './data'

type Errors = Partial<Record<'programmeId' | 'name' | 'plannedSessions' | 'defaultLeadMemberId' | 'cohortIds', string>>

/** /admin/courses/new?programme= — A2.03 New course (shared course library). */
export function NewCoursePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fromProgramme = params.get('programme')
  const programmes = useProgrammes()
  const cohorts = useCohorts()
  const trainers = useMembers(TRAINER_ROLES)
  const create = useCreateCourse()

  const [programmeId, setProgrammeId] = useState(fromProgramme ?? '')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [planned, setPlanned] = useState('')
  const [leadId, setLeadId] = useState('')
  const [cohortIds, setCohortIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [failed, setFailed] = useState<string | null>(null)

  const liveProgrammes = (programmes.data?.programmes ?? []).filter((p) => p.status !== 'archived')
  const openCohorts = (cohorts.data ?? []).filter(
    (c) => c.programme.id === programmeId && (c.status === 'active' || c.status === 'upcoming' || c.status === 'draft'),
  )
  const trainerOptions = (trainers.data ?? []).filter((m) => m.status !== 'deactivated')
  const backTo = fromProgramme ? `/admin/programmes/${fromProgramme}` : '/admin/courses/library'

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const sessions = planned.trim() === '' ? null : Number(planned)
    const next: Errors = {
      programmeId: programmeId ? undefined : 'Choose a programme.',
      name: name.trim() ? undefined : 'Enter a course name.',
      plannedSessions: sessions !== null && (!Number.isInteger(sessions) || sessions < 0 || sessions > 500) ? 'Enter a whole number from 0 to 500.' : undefined,
    }
    setErrors(next)
    setFailed(null)
    if (Object.values(next).some(Boolean)) return
    try {
      await create.mutateAsync({
        programmeId,
        name,
        description,
        plannedSessions: sessions,
        defaultLeadMemberId: leadId || null,
        cohortIds: cohortIds.filter((id) => openCohorts.some((c) => c.id === id)),
      })
      navigate(fromProgramme ? backTo : '/admin/courses/library', { state: { created: name.trim() } })
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        setErrors(Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
      } else {
        setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'The course wasn’t created. Check your connection and try again.')
      }
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Courses & sessions', to: '/admin/courses/library' }, { label: 'New course' }]}
        title="New course"
        description="Courses hold sessions, assignments and resources."
      />
      <FormLayout>
        <Panel>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            <AlertBanner title="Your organisation uses a shared course library">
              This course is added to the programme and can be reused by its cohorts. Change this in Settings › Programme setup.
            </AlertBanner>
            {failed && (
              <AlertBanner tone="error" title="Couldn’t create the course">
                {failed}
              </AlertBanner>
            )}
            <FormSection title="Basics">
              <SelectField
                label="Programme"
                value={programmeId}
                onChange={(e) => {
                  setProgrammeId(e.target.value)
                  setCohortIds([])
                  setErrors((prev) => ({ ...prev, programmeId: undefined }))
                }}
                error={errors.programmeId}
              >
                <option value="">Select a programme</option>
                {liveProgrammes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Course name"
                placeholder="e.g. Data Visualisation"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setErrors((prev) => ({ ...prev, name: undefined }))
                }}
                error={errors.name}
              />
              <TextAreaField
                label="Description"
                optional
                placeholder="What participants will be able to do after this course"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <TextField
                label="Planned sessions per cohort"
                type="number"
                inputMode="numeric"
                min={0}
                max={500}
                helper="Used to show delivery progress."
                value={planned}
                onChange={(e) => {
                  setPlanned(e.target.value)
                  setErrors((prev) => ({ ...prev, plannedSessions: undefined }))
                }}
                error={errors.plannedSessions}
              />
              <SelectField
                label="Default lead trainer"
                optional
                helper={trainerOptions.length === 0 ? 'Invite trainers from Trainers first.' : 'You can change it per cohort.'}
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                error={errors.defaultLeadMemberId}
              >
                <option value="">Select a trainer</option>
                {trainerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                    {m.status === 'invited' ? ' (invited)' : ''}
                  </option>
                ))}
              </SelectField>
            </FormSection>

            <FormSection title="Add to existing cohorts" description="Only active and upcoming cohorts in this programme.">
              {!programmeId ? (
                <p className="text-body text-secondary">Choose a programme to see its cohorts.</p>
              ) : openCohorts.length === 0 ? (
                <p className="text-body text-secondary">
                  This programme has no active or upcoming cohorts. New cohorts can pick the course when you create them.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {openCohorts.map((cohort) => (
                    <Checkbox
                      key={cohort.id}
                      label={cohort.name}
                      checked={cohortIds.includes(cohort.id)}
                      onChange={(e) => setCohortIds((prev) => (e.target.checked ? [...prev, cohort.id] : prev.filter((id) => id !== cohort.id)))}
                    />
                  ))}
                </div>
              )}
              {errors.cohortIds && <p className="text-caption text-error-fg">{errors.cohortIds}</p>}
            </FormSection>

            <div className="flex gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
              <Button variant="secondary" onClick={() => navigate(backTo)} disabled={create.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create course'}
              </Button>
            </div>
          </form>
        </Panel>
      </FormLayout>
    </>
  )
}
