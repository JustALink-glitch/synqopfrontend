import { useState, type FormEvent } from 'react'
import { PermanentDeleteSection } from '@/components/admin/PermanentDelete'
import { useNavigate, useParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormLayout, FormSection } from '@/components/ui/FormLayout'
import { PageHeader, Panel } from '@/components/ui/Page'
import { SelectField, TextAreaField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { TRAINER_ROLES, useMembers } from '@/pages/admin/people/members'
import { useArchiveCourse, useCourseDetail, useUpdateCourse, type CourseDetail } from './data'

type Errors = Partial<Record<'name' | 'plannedSessions' | 'defaultLeadMemberId', string>>

/** /admin/courses/library/:id/edit — A2.05 Edit course, with A2.06 Archive course. */
export function EditCoursePage() {
  const { id = '' } = useParams()
  const query = useCourseDetail(id)
  if (query.isPending) return <div aria-busy="true" aria-label="Loading course" className="h-40" />
  if (query.isError) {
    return (
      <>
        <PageHeader
          title="Couldn’t load the course"
          breadcrumb={[
            { label: 'Courses & sessions', to: '/admin/courses' },
            { label: 'Courses', to: '/admin/courses/library' },
          ]}
        />
        <Panel>
          <StatePanel
            kind="error"
            title="Something went wrong"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      </>
    )
  }
  return <CourseForm data={query.data} />
}

function CourseForm({ data }: { data: CourseDetail }) {
  const { course: c } = data
  const navigate = useNavigate()
  const trainers = useMembers(TRAINER_ROLES)
  const update = useUpdateCourse(c.id)
  const archive = useArchiveCourse(c.id)
  const [name, setName] = useState(c.name)
  const [description, setDescription] = useState(c.description ?? '')
  const [planned, setPlanned] = useState(c.plannedSessions === null ? '' : String(c.plannedSessions))
  const [leadId, setLeadId] = useState(c.defaultLead?.id ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const back = `/admin/courses/library/${c.id}`
  const trainerOptions = (trainers.data ?? []).filter((m) => m.status !== 'deactivated')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const sessions = planned.trim() === '' ? null : Number(planned)
    const next: Errors = {
      name: name.trim() ? undefined : 'Enter a course name.',
      plannedSessions: sessions !== null && (!Number.isInteger(sessions) || sessions < 0 || sessions > 500) ? 'Enter a whole number from 0 to 500.' : undefined,
    }
    setErrors(next)
    setFailed(null)
    if (Object.values(next).some(Boolean)) return
    try {
      await update.mutateAsync({ name: name.trim(), description, plannedSessions: sessions, defaultLeadMemberId: leadId || null })
      navigate(back, { state: { saved: 'Course saved' } })
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details))
        setErrors(Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
      else setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'The course wasn’t saved. Check your connection and try again.')
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Courses & sessions', to: '/admin/courses' },
          { label: 'Courses', to: '/admin/courses/library' },
          { label: c.name, to: back },
          { label: 'Edit' },
        ]}
        title="Edit course"
        description="Changes apply to every cohort that uses this course. Sessions already held aren’t changed."
      />
      <FormLayout>
        <Panel>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            <AlertBanner title={c.libraryMode === 'shared' ? 'Your organisation uses a shared course library' : 'Your organisation keeps courses per cohort'}>
              {c.libraryMode === 'shared'
                ? 'This course is part of the programme and can be reused by its cohorts. Change this in Settings › Programme setup.'
                : 'Changes here only affect cohorts that run this course. Change this in Settings › Programme setup.'}
            </AlertBanner>
            {failed && <AlertBanner tone="error" title={failed} />}
            <FormSection title="Basics">
              <SelectField label="Programme" value={c.programme.id} disabled helper="A course stays in its programme.">
                <option value={c.programme.id}>{c.programme.name}</option>
              </SelectField>
              <TextField
                label="Course name"
                value={name}
                maxLength={120}
                onChange={(e) => {
                  setName(e.target.value)
                  setErrors((p) => ({ ...p, name: undefined }))
                }}
                error={errors.name}
              />
              <TextAreaField label="Description" optional value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <TextField
                  label="Planned sessions per cohort"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={500}
                  helper="Used to show delivery progress. Cohorts that set their own number keep it."
                  value={planned}
                  onChange={(e) => {
                    setPlanned(e.target.value)
                    setErrors((p) => ({ ...p, plannedSessions: undefined }))
                  }}
                  error={errors.plannedSessions}
                />
                <SelectField
                  label="Default lead trainer"
                  optional
                  helper="For cohorts that add this course from now on. You can change it per cohort."
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  error={errors.defaultLeadMemberId}
                >
                  <option value="">No default</option>
                  {trainerOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                      {m.status === 'invited' ? ' (invited)' : ''}
                    </option>
                  ))}
                </SelectField>
              </div>
            </FormSection>
            <div className="flex justify-end gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
              <Button variant="secondary" onClick={() => navigate(back)} disabled={update.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Panel>
        <Panel className="gap-3">
          <div className="flex items-center gap-4 max-md:flex-col max-md:items-stretch">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className="text-body-strong text-primary">Archive course</h2>
              <p className="text-caption text-secondary">
                It leaves the course library, so new cohorts can’t use it. Cohorts that already run it keep everything. You can restore it.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setArchiving(true)}>
              Archive course
            </Button>
          </div>
          <PermanentDeleteSection kind="course" id={c.id} />
        </Panel>
      </FormLayout>
      <Dialog
        open={archiving}
        onClose={() => setArchiving(false)}
        title={`Archive ${c.name}?`}
        description="It leaves the course library, so new cohorts can’t use it. Cohorts that already run it keep it, with all sessions, assignments, grades and resources."
        actions={
          <>
            <Button variant="secondary" onClick={() => setArchiving(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={archive.isPending}
              onClick={() =>
                archive.mutate(undefined, {
                  onSuccess: () => navigate('/admin/courses/library', { state: { archived: c.name } }),
                  onError: () => setFailed('The course wasn’t archived. Try again.'),
                })
              }
            >
              {archive.isPending ? 'Archiving…' : 'Archive course'}
            </Button>
          </>
        }
      >
        {data.cohorts.length > 0 && (
          <AlertBanner title={`Used by ${data.cohorts.length === 1 ? '1 cohort' : `${data.cohorts.length} cohorts`}`}>
            {data.cohorts.map((h) => `${h.name} (${h.status})`).join(', ')}. Nothing changes for {data.cohorts.length === 1 ? 'it' : 'them'}.
          </AlertBanner>
        )}
        {data.cohorts.length === 0 && <p className="text-body text-secondary">No cohort runs it.</p>}
        <p className="text-caption text-secondary">You can restore an archived course from Courses › Archived.</p>
      </Dialog>
    </>
  )
}
